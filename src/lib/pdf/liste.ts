import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import { abreviations, statistiques } from '../admin/reponses';
import type { Reponse } from '../db';
import { t, type EventConfig } from '../event';
import { formatDate } from '../i18n';
import { horodatageLocal, nombrePersonnes } from '../rsvp';
import { couleursTheme } from '../theme';
import { couleur, couper, dessinable, OPTIONS_TITRE, tronquer, type Polices } from './invitation';

export type LigneListe = { nom: string; accompagnants: string; email: string; telephone: string; personnes: number; moments: string };

/** Invités qui viennent, triés par nom. */
export const confirmesParNom = (reponses: Reponse[]): Reponse[] =>
  reponses.filter((r) => r.vient).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

/** Invités qui viennent, triés par nom ; moments abrégés en une lettre. */
export function lignesListe(ev: EventConfig, reponses: Reponse[]): LigneListe[] {
  const abr = abreviations(ev.moments.map((m) => ({ id: m.id, titre: m.titre.fr })), 1);
  return confirmesParNom(reponses)
    .map((r) => ({
      nom: r.nom,
      accompagnants: r.accompagnants.length ? r.accompagnants.join(', ') : '—',
      email: r.email,
      telephone: r.telephone || '—',
      personnes: nombrePersonnes(r),
      moments: ev.moments.filter((m) => r.moments.includes(m.id)).map((m) => abr[m.id]).join('·'),
    }));
}

/** Indices des lignes de chaque page ; une page reçoit toujours au moins une ligne, même trop haute. */
export function paginer(hauteurs: number[], dispoPremiere: number, dispoSuivantes: number): number[][] {
  const pages: number[][] = [[]];
  let reste = dispoPremiere;
  hauteurs.forEach((h, i) => {
    const page = pages.at(-1)!;
    if (h > reste && page.length) {
      pages.push([i]);
      reste = dispoSuivantes - h;
    } else {
      page.push(i);
      reste -= h;
    }
  });
  return pages;
}

const A4: [number, number] = [595.28, 841.89];
const [W, H] = A4;
const MARGE = 36;
const PIED = 24;
const BAS = MARGE + PIED;
const COLONNES = [
  { titre: '', largeur: 18 },
  { titre: 'Nom', largeur: 105 },
  { titre: 'Accompagnants', largeur: 120 },
  { titre: 'E-mail', largeur: 125 },
  { titre: 'Téléphone', largeur: 70 },
  { titre: 'Pers.', largeur: 30 },
  { titre: 'Moments', largeur: 55 },
];
const PAD = 3;
const HAUT_ENTETE_TABLEAU = 18;
const INTERLIGNE = 11;
/** Haut du tableau : sous l'en-tête de la page 1, sous le rappel des suivantes. */
const HAUT_TABLEAU_1 = H - MARGE - 62;
const HAUT_TABLEAU_N = H - MARGE - 20;
const MAX_ACCOMPAGNANTS = 3;

type Cellules = { nom: string; accompagnants: string[]; autres: string[] };

export async function genererListe(d: { ev: EventConfig; reponses: Reponse[]; polices: Polices; maintenant: Date }): Promise<Uint8Array> {
  const { ev } = d;
  const c = couleursTheme(ev.theme);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [fTitre, fTexte, fGras] = await Promise.all([
    doc.embedFont(d.polices.titre, OPTIONS_TITRE),
    doc.embedFont(d.polices.texte, { subset: true }),
    doc.embedFont(d.polices.texteGras, { subset: true }),
  ]);
  const titreFr = t(ev.site.titre, 'fr');
  const lignes = lignesListe(ev, d.reponses);
  const stats = statistiques(d.reponses, ev.moments.map((m) => m.id));
  const abr = abreviations(ev.moments.map((m) => ({ id: m.id, titre: m.titre.fr })), 1);

  const larg = (i: number) => COLONNES[i].largeur - 2 * PAD;
  const cellules: Cellules[] = lignes.map((l) => {
    // Nom par nom : un accompagnant réduit à rien (emoji seul) ne laisse pas de virgule orpheline.
    const noms = l.accompagnants.split(', ').map((n) => dessinable(n, fTexte)).filter(Boolean).join(', ') || '—';
    let acc = couper(noms, fTexte, 8.5, larg(2));
    if (acc.length > MAX_ACCOMPAGNANTS) {
      acc = acc.slice(0, MAX_ACCOMPAGNANTS);
      acc[MAX_ACCOMPAGNANTS - 1] = tronquer(`${acc[MAX_ACCOMPAGNANTS - 1]}…`, fTexte, 8.5, larg(2));
    }
    return {
      nom: tronquer(dessinable(l.nom, fGras), fGras, 9, larg(1)),
      accompagnants: acc,
      autres: [l.email, l.telephone, String(l.personnes), l.moments].map((v, i) => tronquer(dessinable(v, fTexte), fTexte, 8.5, larg(3 + i))),
    };
  });
  const hauteurs = cellules.map((cl) => Math.max(1, cl.accompagnants.length) * INTERLIGNE + 8);
  const pages = paginer(hauteurs, HAUT_TABLEAU_1 - HAUT_ENTETE_TABLEAU - BAS, HAUT_TABLEAU_N - HAUT_ENTETE_TABLEAU - BAS);

  const texte = (p: PDFPage, s: string, x: number, y: number, police: PDFFont, taille: number, coul = c.texte) =>
    p.drawText(s, { x, y, size: taille, font: police, color: couleur(coul) });
  const aDroite = (p: PDFPage, s: string, y: number, police: PDFFont, taille: number, coul = c.texte) =>
    texte(p, s, W - MARGE - police.widthOfTextAtSize(s, taille), y, police, taille, coul);

  const enTetePremiere = (p: PDFPage) => {
    const pers = `${stats.personnes} pers.`;
    const foyers = `${stats.foyers} foyers`;
    const droite = Math.max(fGras.widthOfTextAtSize(pers, 14), fTexte.widthOfTextAtSize(foyers, 10));
    const titre = tronquer(dessinable(`${titreFr} · Liste des confirmés`, fTitre), fTitre, 26, W - 2 * MARGE - droite - 16);
    texte(p, titre, MARGE, H - MARGE - 20, fTitre, 26, c.principale);
    const edite = horodatageLocal(d.maintenant.toISOString(), ev.evenement.date_debut).slice(0, 10);
    const sousTitre = tronquer(dessinable(`${formatDate(ev.evenement.date_debut, 'fr')} · Édité le ${edite}`, fTexte), fTexte, 10, W - 2 * MARGE - droite - 16);
    texte(p, sousTitre, MARGE, H - MARGE - 38, fTexte, 10);
    aDroite(p, pers, H - MARGE - 18, fGras, 14, c.principaleFonce);
    aDroite(p, foyers, H - MARGE - 36, fTexte, 10);
    p.drawRectangle({ x: MARGE, y: H - MARGE - 53, width: W - 2 * MARGE, height: 3, color: couleur(c.principale) });
  };
  const rappel = (p: PDFPage) =>
    texte(p, tronquer(dessinable(`${titreFr} · Liste des confirmés (suite)`, fTexte), fTexte, 9, W - 2 * MARGE), MARGE, H - MARGE - 9, fTexte, 9, c.texteDoux);

  /** En-tête du tableau dont le haut est en `y` ; retourne le haut de la première ligne. */
  const enTeteTableau = (p: PDFPage, y: number) => {
    p.drawRectangle({ x: MARGE, y: y - HAUT_ENTETE_TABLEAU, width: W - 2 * MARGE, height: HAUT_ENTETE_TABLEAU, color: couleur(c.douce) });
    let x = MARGE;
    COLONNES.forEach((col, i) => {
      if (col.titre) texte(p, tronquer(col.titre.toUpperCase(), fGras, 8, larg(i)), x + PAD, y - 12, fGras, 8);
      x += col.largeur;
    });
    return y - HAUT_ENTETE_TABLEAU;
  };

  const ligneTableau = (p: PDFPage, cl: Cellules, y: number, h: number) => {
    const base = y - 13;
    let x = MARGE;
    p.drawRectangle({ x: x + 5, y: base - 1, width: 8, height: 8, borderColor: couleur(c.texteDoux), borderWidth: 0.8 });
    x += COLONNES[0].largeur;
    texte(p, cl.nom, x + PAD, base, fGras, 9);
    x += COLONNES[1].largeur;
    cl.accompagnants.forEach((l, i) => texte(p, l, x + PAD, base - i * INTERLIGNE, fTexte, 8.5));
    x += COLONNES[2].largeur;
    cl.autres.forEach((v, i) => {
      texte(p, v, x + PAD, base, fTexte, 8.5);
      x += COLONNES[3 + i].largeur;
    });
    p.drawLine({ start: { x: MARGE, y: y - h }, end: { x: W - MARGE, y: y - h }, thickness: 0.5, color: couleur('#eeeeee') });
  };

  let page = doc.addPage(A4);
  let y = 0;
  pages.forEach((indices, n) => {
    if (n === 0) enTetePremiere(page);
    else { page = doc.addPage(A4); rappel(page); }
    y = enTeteTableau(page, n === 0 ? HAUT_TABLEAU_1 : HAUT_TABLEAU_N);
    for (const i of indices) {
      ligneTableau(page, cellules[i], y, hauteurs[i]);
      y -= hauteurs[i];
    }
  });
  if (!lignes.length) {
    texte(page, 'Aucun invité confirmé pour l\'instant.', MARGE + PAD, y - 14, fTexte, 9, c.texteDoux);
    y -= 20;
  }

  // Légende et totaux par moment, en personnes.
  const legende = couper(dessinable(`Moments : ${ev.moments.map((m) => `${abr[m.id]} = ${m.titre.fr}`).join(' · ')}`, fTexte), fTexte, 8.5, W - 2 * MARGE);
  const totaux = couper(dessinable(`Totaux : ${ev.moments.map((m) => `${m.titre.fr} ${stats.parMoment[m.id]}`).join(' · ')}`, fGras), fGras, 8.5, W - 2 * MARGE);
  const besoin = 14 + (legende.length + totaux.length) * INTERLIGNE;
  if (y - besoin < BAS) {
    page = doc.addPage(A4);
    rappel(page);
    y = HAUT_TABLEAU_N;
  }
  y -= 14;
  for (const l of legende) { y -= INTERLIGNE - 2; texte(page, l, MARGE, y, fTexte, 8.5, c.texteDoux); y -= 2; }
  for (const l of totaux) { y -= INTERLIGNE - 2; texte(page, l, MARGE, y, fGras, 8.5); y -= 2; }

  const total = doc.getPageCount();
  doc.getPages().forEach((p, i) => aDroite(p, `Page ${i + 1} / ${total}`, MARGE, fTexte, 8, c.texteDoux));

  doc.setTitle(`Liste des confirmés – ${titreFr}`);
  doc.setCreator(titreFr);
  return doc.save();
}
