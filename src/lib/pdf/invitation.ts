import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Reponse } from '../db';
import { findLieu, t, type EventConfig, type Lang } from '../event';
import { formatDate } from '../i18n';
import { momentLabel } from '../moments';
import { couleursTheme } from '../theme';

export type Polices = { titre: Uint8Array; texte: Uint8Array; texteGras: Uint8Array };
type ReponseInvitation = Pick<Reponse, 'nom' | 'accompagnants' | 'moments' | 'langue'>;
type Donnees = { ev: EventConfig; reponse: ReponseInvitation; photo: Uint8Array | null; polices: Polices; urlQr: string };
/** Données d'une page : `photo` indique seulement s'il faut lui réserver une place. */
type Page = Omit<Donnees, 'polices'>;

const A5: [number, number] = [419.53, 595.28];
const MARGE = 24;
/** Caveat : variantes contextuelles et ligatures désactivées (pdf-lib en avance mal les glyphes), police complète (le sous-ensemble la corrompt). */
export const OPTIONS_TITRE = { subset: false, features: { calt: false, liga: false, clig: false, dlig: false, rlig: false, salt: false, ss01: false } };

export const couleur = (hex: string) => rgb(...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]));

/** Retire les caractères que la police ne sait pas dessiner (emoji, idéogrammes…). */
export function dessinable(texte: string, police: PDFFont): string {
  const jeu = new Set(police.getCharacterSet());
  return [...texte].filter((ch) => jeu.has(ch.codePointAt(0)!)).join('').replace(/\s{2,}/g, ' ').trim();
}

const mesures = new WeakMap<PDFFont, Map<string, number>>();
/** Largeur d'une chaîne entière (crénage et substitutions compris), mise en cache car la mesure est coûteuse. */
function mesurer(police: PDFFont, taille: number, texte: string): number {
  let m = mesures.get(police);
  if (!m) mesures.set(police, (m = new Map()));
  const k = `${taille}|${texte}`;
  let w = m.get(k);
  if (w === undefined) m.set(k, (w = police.widthOfTextAtSize(texte, taille)));
  return w;
}

/** Plus grand nombre de caractères (au moins 1) dont le préfixe, suivi de `suffixe`, tient dans `largeur`. */
function plusLongPrefixe(chars: string[], police: PDFFont, taille: number, largeur: number, suffixe = ''): number {
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (mesurer(police, taille, chars.slice(0, mid).join('') + suffixe) <= largeur) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Coupe un mot trop large pour `largeur` en morceaux qui tiennent, caractère par caractère. */
function morceaux(mot: string, police: PDFFont, taille: number, largeur: number): string[] {
  const res: string[] = [];
  let reste = [...mot];
  while (reste.length) {
    const n = Math.max(1, plusLongPrefixe(reste, police, taille, largeur));
    res.push(reste.slice(0, n).join(''));
    reste = reste.slice(n);
  }
  return res;
}

/** Retourne le texte tel quel s'il tient dans `largeur`, sinon le coupe et ajoute « … ». */
export function tronquer(texte: string, police: PDFFont, taille: number, largeur: number): string {
  if (mesurer(police, taille, texte) <= largeur) return texte;
  const chars = [...texte];
  const n = plusLongPrefixe(chars, police, taille, largeur, '…');
  return chars.slice(0, n).join('').trimEnd() + '…';
}

export function couper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  let ligne = '';
  const mots = texte.split(' ').flatMap((m) => (mesurer(police, taille, m) > largeur ? morceaux(m, police, taille, largeur) : [m]));
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (mesurer(police, taille, essai) <= largeur || !ligne) ligne = essai;
    else { lignes.push(ligne); ligne = mot; }
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

function centrer(page: PDFPage, texte: string, police: PDFFont, taille: number, y: number, c: ReturnType<typeof rgb>) {
  const w = police.widthOfTextAtSize(texte, taille);
  page.drawText(texte, { x: (page.getWidth() - w) / 2, y, size: taille, font: police, color: c });
}

const TXT = {
  fr: { etiquette: 'INVITATION PERSONNELLE', hate1: 'Nous avons hâte de te voir !', hateN: 'Nous avons hâte de vous voir !', qr: ['Programme, carte', 'et infos pratiques'] },
  en: { etiquette: 'PERSONAL INVITATION', hate1: "We can't wait to see you!", hateN: "We can't wait to see you all!", qr: ['Schedule, map', 'and practical info'] },
};

export type Disposition = { photo: boolean; tailleNoms: number; interligne: number };
/** Du plus aéré au plus compact : la première disposition qui tient au-dessus du QR code est retenue. */
const DISPOSITIONS: Disposition[] = [
  { photo: true, tailleNoms: 26, interligne: 13 },
  { photo: true, tailleNoms: 18, interligne: 12 },
  { photo: false, tailleNoms: 18, interligne: 12 },
  { photo: false, tailleNoms: 14, interligne: 11 },
  { photo: false, tailleNoms: 12, interligne: 10 },
];
const [W, H] = A5;
const LARGEUR = W - 2 * MARGE;
const HAUT_CONTENU = H - 120;
/** Limite basse du contenu : au-dessus du QR code (64 pt) et de sa légende. */
export const BAS_CONTENU = MARGE + 80;
const CADRE = { w: 190, h: 150 };

type Ligne = { texte: string; police: PDFFont; taille: number };

/** Document partagé par toutes les pages : polices et photo intégrées une fois, QR codes mis en cache par adresse. */
type Ressources = {
  doc: PDFDocument; fTitre: PDFFont; fTexte: PDFFont; fGras: PDFFont;
  photo: () => Promise<PDFImage> | null; qr: (url: string) => Promise<PDFImage>;
};

async function preparerDocument(polices: Polices, photo: Uint8Array | null): Promise<Ressources> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [fTitre, fTexte, fGras] = await Promise.all([
    doc.embedFont(polices.titre, OPTIONS_TITRE),
    doc.embedFont(polices.texte, { subset: true }),
    doc.embedFont(polices.texteGras, { subset: true }),
  ]);
  // Photo intégrée à la première page qui l'affiche : une invitation sans place pour elle ne l'embarque pas.
  let img: Promise<PDFImage> | undefined;
  const qrs = new Map<string, Promise<PDFImage>>();
  return {
    doc, fTitre, fTexte, fGras,
    photo: () => (photo ? (img ??= doc.embedJpg(photo)) : null),
    qr: (url) => {
      let q = qrs.get(url);
      if (!q) qrs.set(url, (q = QRCode.toBuffer(url, { margin: 1, width: 240 }).then((png) => doc.embedPng(png))));
      return q;
    },
  };
}

function disposer(res: Ressources, d: Page) {
  const { ev, reponse: r } = d;
  const { fTitre, fTexte, fGras } = res;
  const lang = r.langue;
  const noms = [r.nom, ...r.accompagnants].map((n) => dessinable(n, fTitre)).filter(Boolean);
  const texteNoms = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} & ${noms.at(-1)}` : noms[0] ?? '';
  const lignesMoments: Ligne[] = ev.moments.filter((m) => r.moments.includes(m.id)).flatMap((m) => {
    const l = findLieu(ev, m.lieu);
    return [
      { texte: tronquer(dessinable(`${momentLabel(m, lang)} : ${l.nom}`, fGras), fGras, 9.5, LARGEUR - 100), police: fGras, taille: 9.5 },
      { texte: tronquer(dessinable(l.adresse, fTexte), fTexte, 8.5, LARGEUR - 100), police: fTexte, taille: 8.5 },
    ];
  });
  let disp = DISPOSITIONS[0];
  let lignesNoms: string[] = [];
  let yFin = 0;
  for (disp of DISPOSITIONS) {
    lignesNoms = couper(texteNoms, fTitre, disp.tailleNoms, LARGEUR);
    const hauteur = (disp.photo && d.photo ? CADRE.h : 0) + 16 + lignesNoms.length * disp.tailleNoms + 36
      + (lignesMoments.length ? 12 + lignesMoments.length * disp.interligne + 14 : 0);
    yFin = HAUT_CONTENU - hauteur;
    if (yFin >= BAS_CONTENU) break;
  }
  if (yFin < BAS_CONTENU) {
    // Même la disposition la plus compacte déborde : on tronque les noms avec « … ».
    const fixe = 16 + 36 + (lignesMoments.length ? 12 + lignesMoments.length * disp.interligne + 14 : 0);
    const max = Math.max(1, Math.floor((HAUT_CONTENU - BAS_CONTENU - fixe) / disp.tailleNoms));
    if (lignesNoms.length > max) {
      lignesNoms = lignesNoms.slice(0, max);
      lignesNoms[max - 1] = tronquer(`${lignesNoms[max - 1]}…`, fTitre, disp.tailleNoms, LARGEUR);
    }
    yFin = HAUT_CONTENU - (16 + lignesNoms.length * disp.tailleNoms + 36 + (lignesMoments.length ? 12 + lignesMoments.length * disp.interligne + 14 : 0));
  }
  return { lignesNoms, lignesMoments, disp, yFin };
}

/** Page A5 avec le fond et le bandeau (étiquette et titre de l'événement). */
function nouvellePage(res: Ressources, ev: EventConfig, lang: Lang): PDFPage {
  const { doc, fTitre, fGras } = res;
  const c = couleursTheme(ev.theme);
  const page = doc.addPage(A5);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: couleur(c.fond) });

  // Bandeau
  page.drawRectangle({ x: 0, y: H - 110, width: W, height: 110, color: couleur(c.principaleFonce) });
  centrer(page, TXT[lang].etiquette, fGras, 10, H - 34, couleur(c.fond));
  const titre = dessinable(t(ev.site.titre, lang), fTitre);
  let tailleTitre = 40;
  while (fTitre.widthOfTextAtSize(titre, tailleTitre) > LARGEUR && tailleTitre > 18) tailleTitre -= 2;
  centrer(page, titre, fTitre, tailleTitre, H - 80, couleur(c.fond));
  return page;
}

/** Ajoute l'invitation d'une réponse ; retourne la disposition retenue et la position la plus basse du contenu. */
async function ajouterPage(res: Ressources, d: Page): Promise<{ disposition: Disposition; yFin: number }> {
  const { ev, reponse: r } = d;
  const lang = r.langue;
  const T = TXT[lang];
  const c = couleursTheme(ev.theme);
  const { fTexte, fGras, fTitre } = res;
  const { lignesNoms, lignesMoments, disp, yFin } = disposer(res, d);
  const page = nouvellePage(res, ev, lang);

  // Photo façon polaroïd
  let y = HAUT_CONTENU;
  const photo = disp.photo ? res.photo() : null;
  if (photo) {
    const img = await photo;
    const dim = img.scaleToFit(CADRE.w - 14, CADRE.h - 34);
    const x0 = (W - CADRE.w) / 2;
    y -= CADRE.h;
    page.drawRectangle({ x: x0 + 3, y: y - 3, width: CADRE.w, height: CADRE.h, color: rgb(0.85, 0.8, 0.75) });
    page.drawRectangle({ x: x0, y, width: CADRE.w, height: CADRE.h, color: rgb(1, 1, 1) });
    page.drawImage(img, { x: x0 + (CADRE.w - dim.width) / 2, y: y + 27 + (CADRE.h - 34 - dim.height) / 2, width: dim.width, height: dim.height });
  }

  // Noms
  y -= 16;
  for (const ligne of lignesNoms) {
    y -= disp.tailleNoms;
    centrer(page, ligne, fTitre, disp.tailleNoms, y, couleur(c.principaleFonce));
  }
  y -= 18;
  centrer(page, r.accompagnants.length ? T.hateN : T.hate1, fTexte, 11, y, couleur(c.texte));
  y -= 18;
  centrer(page, dessinable(formatDate(ev.evenement.date_debut, lang), fGras), fGras, 12, y, couleur(c.texte));

  // Moments choisis
  if (lignesMoments.length) {
    const hauteur = lignesMoments.length * disp.interligne + 14;
    y -= 12 + hauteur;
    page.drawRectangle({ x: MARGE, y, width: LARGEUR - 80, height: hauteur, color: rgb(1, 1, 1) });
    let ly = y + hauteur - 18;
    for (const l of lignesMoments) {
      page.drawText(l.texte, { x: MARGE + 10, y: ly, size: l.taille, font: l.police, color: couleur(l.police === fGras ? c.texte : c.texteDoux) });
      ly -= disp.interligne;
    }
  }

  // QR code vers le programme
  const qr = await res.qr(d.urlQr);
  page.drawImage(qr, { x: W - MARGE - 64, y: MARGE, width: 64, height: 64 });
  T.qr.forEach((ligne, i) => {
    const w = fTexte.widthOfTextAtSize(ligne, 8);
    page.drawText(ligne, { x: W - MARGE - 72 - w, y: MARGE + 34 - i * 11, size: 8, font: fTexte, color: couleur(c.texteDoux) });
  });

  return { disposition: disp, yFin };
}

/** Disposition retenue et position la plus basse du contenu (utile aux tests). */
export async function mesurerInvitation(d: Donnees): Promise<{ disposition: Disposition; yFin: number }> {
  return ajouterPage(await preparerDocument(d.polices, d.photo), d);
}

export async function genererInvitation(d: Donnees): Promise<Uint8Array> {
  const res = await preparerDocument(d.polices, d.photo);
  await ajouterPage(res, d);
  res.doc.setTitle(`Invitation – ${d.reponse.nom}`);
  res.doc.setCreator(t(d.ev.site.titre, d.reponse.langue));
  return res.doc.save();
}

/** Toutes les invitations dans un seul PDF, une page A5 par réponse. */
export async function genererInvitations(d: {
  ev: EventConfig; reponses: ReponseInvitation[]; photo: Uint8Array | null; polices: Polices; urlQr: (langue: Lang) => string;
}): Promise<Uint8Array> {
  const { ev } = d;
  const res = await preparerDocument(d.polices, d.photo);
  for (const reponse of d.reponses) await ajouterPage(res, { ev, reponse, photo: d.photo, urlQr: d.urlQr(reponse.langue) });
  if (!d.reponses.length) {
    const page = nouvellePage(res, ev, 'fr');
    centrer(page, 'Aucun invité confirmé pour l\'instant.', res.fTexte, 11, HAUT_CONTENU - 40, couleur(couleursTheme(ev.theme).texteDoux));
  }
  const titreFr = t(ev.site.titre, 'fr');
  res.doc.setTitle(`Invitations – ${titreFr}`);
  res.doc.setCreator(titreFr);
  return res.doc.save();
}
