import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { beforeAll, describe, expect, test } from 'vitest';
import { parseEvent, type Lang } from '../../src/lib/event';
import fontkit from '@pdf-lib/fontkit';
import { BAS_CONTENU, couper, dessinable, OPTIONS_TITRE, genererInvitation, genererInvitations, mesurerInvitation, tronquer, type Polices } from '../../src/lib/pdf/invitation';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));
const polices: Polices = {
  titre: readFileSync('src/assets/fonts/Caveat-Bold.ttf'),
  texte: readFileSync('src/assets/fonts/Nunito-Regular.ttf'),
  texteGras: readFileSync('src/assets/fonts/Nunito-ExtraBold.ttf'),
};
let photo: Uint8Array;
beforeAll(async () => {
  photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ec5e27' } }).jpeg().toBuffer();
});

const reponse = { nom: 'Camille Martin', accompagnants: ['Léo Martin'], moments: ['accueil', 'soiree'], langue: 'fr' as const };

describe('genererInvitation', () => {
  test('PDF A5 d’une page, titre contenant le nom', async () => {
    const octets = await genererInvitation({ ev, reponse, photo, polices, urlQr: 'http://localhost:4321/fr/programme' });
    expect(Buffer.from(octets.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(octets);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(420);
    expect(Math.round(height)).toBe(595);
    expect(doc.getTitle()).toBe('Invitation – Camille Martin');
  });

  test('fonctionne sans photo et en anglais', async () => {
    const octets = await genererInvitation({ ev, reponse: { ...reponse, langue: 'en' }, photo: null, polices, urlQr: 'http://x/en/programme' });
    expect((await PDFDocument.load(octets)).getTitle()).toBe('Invitation – Camille Martin');
  });

  test('caractères absents des polices (emoji, idéogrammes) : pas d’erreur', async () => {
    const r = { ...reponse, nom: 'Coco 🎉 李', accompagnants: ['Zoë 💃'] };
    await expect(genererInvitation({ ev, reponse: r, photo, polices, urlQr: 'http://x' })).resolves.toBeInstanceOf(Uint8Array);
  });

  test('cas courant : disposition la plus aérée, avec photo', async () => {
    const m = await mesurerInvitation({ ev, reponse, photo, polices, urlQr: 'http://x' });
    expect(m.disposition).toEqual({ photo: true, tailleNoms: 26, interligne: 13 });
    expect(m.yFin).toBeGreaterThanOrEqual(BAS_CONTENU);
  });

  test('10 accompagnants et tous les moments : disposition compacte, contenu au-dessus du QR code', async () => {
    const r = { ...reponse, accompagnants: Array.from({ length: 10 }, (_, i) => `Accompagnant numéro ${i + 1}`), moments: ev.moments.map((m) => m.id) };
    const m = await mesurerInvitation({ ev, reponse: r, photo, polices, urlQr: 'http://x' });
    expect(m.disposition.tailleNoms).toBeLessThan(26);
    expect(m.yFin).toBeGreaterThanOrEqual(BAS_CONTENU);
    await expect(genererInvitation({ ev, reponse: r, photo, polices, urlQr: 'http://x' })).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe('dessinable', () => {
  test('retire emoji et idéogrammes absents de la police, garde les accents', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const f = await doc.embedFont(polices.texte, { subset: true });
    expect(dessinable('Coco 🎉 李 Zoë', f)).toBe('Coco Zoë');
  });
});

describe('tronquer et couper', () => {
  test('tronquer : coupe avec … et respecte la largeur ; texte court inchangé', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const f = await doc.embedFont(polices.texte, { subset: true });
    const long = 'rue des Lilas '.repeat(15).slice(0, 200);
    const r = tronquer(long, f, 8.5, 271);
    expect(r.endsWith('…')).toBe(true);
    expect(f.widthOfTextAtSize(r, 8.5)).toBeLessThanOrEqual(271);
    expect(tronquer('Court', f, 8.5, 271)).toBe('Court');
  });

  test('couper : un mot plus large que la ligne est découpé', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const f = await doc.embedFont(polices.titre, OPTIONS_TITRE);
    const mot = 'A'.repeat(80);
    const lignes = couper(mot, f, 26, 371);
    expect(lignes.length).toBeGreaterThan(1);
    for (const l of lignes) expect(f.widthOfTextAtSize(l, 26)).toBeLessThanOrEqual(371);
    expect(lignes.join('')).toBe(mot);
  });

  test('noms et adresses démesurés : le contenu reste au-dessus du QR code', async () => {
    const r = { ...reponse, nom: 'X'.repeat(100), accompagnants: Array.from({ length: 10 }, () => 'Y'.repeat(100)), moments: ev.moments.map((m) => m.id) };
    const m = await mesurerInvitation({ ev, reponse: r, photo, polices, urlQr: 'http://x' });
    expect(m.yFin).toBeGreaterThanOrEqual(BAS_CONTENU);
  }, 20_000);
});

describe('Caveat sans variantes contextuelles', () => {
  test('la largeur de la chaîne entière égale la somme de ses parties', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const f = await doc.embedFont(polices.titre, OPTIONS_TITRE);
    const tout = f.widthOfTextAtSize('Camille Martin', 26);
    const parties = f.widthOfTextAtSize('Camille ', 26) + f.widthOfTextAtSize('Martin', 26);
    expect(Math.abs(tout - parties)).toBeLessThan(1);
  });

  test('écrit des aperçus dans .data/ pour contrôle visuel', async () => {
    mkdirSync('.data', { recursive: true });
    const normal = { ...reponse, nom: 'Camille Martin', accompagnants: ['Léo Martin'] };
    const dix = { ...reponse, accompagnants: Array.from({ length: 10 }, (_, i) => `Accompagnant numéro ${i + 1}`), moments: ev.moments.map((m) => m.id) };
    writeFileSync('.data/apercu-normal.pdf', await genererInvitation({ ev, reponse: normal, photo, polices, urlQr: 'http://localhost:4321/fr/programme' }));
    writeFileSync('.data/apercu-dix.pdf', await genererInvitation({ ev, reponse: dix, photo, polices, urlQr: 'http://localhost:4321/fr/programme' }));
  }, 20_000);
});

const compter = (doc: PDFDocument, cle: string, valeur?: string) => doc.context.enumerateIndirectObjects()
  .filter(([, o]) => o instanceof PDFRawStream && (valeur ? o.dict.get(PDFName.of(cle)) === PDFName.of(valeur) : o.dict.has(PDFName.of(cle)))).length;

describe('genererInvitations', () => {
  test('genererInvitations : une page A5 par invité', async () => {
    const octets = await genererInvitations({ ev, reponses: [reponse, { ...reponse, nom: 'Thomas' }, { ...reponse, nom: 'Emma', langue: 'en' }],
      photo, polices, urlQr: (l) => `http://localhost:4321/${l}/programme` });
    const doc = await PDFDocument.load(octets);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPages().every((p) => Math.round(p.getWidth()) === 420)).toBe(true);
  });

  test('genererInvitations : photo et polices intégrées une seule fois, 60 invités en moins de 10 s', async () => {
    const debut = Date.now();
    const reponses = Array.from({ length: 60 }, (_, i) => ({ ...reponse, nom: `Invité ${i}`, langue: (i % 2 ? 'en' : 'fr') as Lang }));
    const doc = await PDFDocument.load(await genererInvitations({ ev, reponses, photo, polices, urlQr: (l) => `https://site.fr/${l}/programme` }));
    expect(Date.now() - debut).toBeLessThan(10_000);
    expect(doc.getPageCount()).toBe(60);
    expect(compter(doc, 'Subtype', 'Image')).toBe(3); // la photo + un QR code par langue
    const fichiersPolice = new Set(doc.context.enumerateIndirectObjects()
      .map(([, o]) => (o instanceof PDFDict ? o.get(PDFName.of('FontFile2')) : undefined))
      .filter(Boolean).map(String)).size;
    expect(fichiersPolice).toBe(3);                   // 3 fichiers de police TrueType, quel que soit le nombre d'invités
  }, 20_000);

  test('genererInvitations : aucun invité → une page', async () => {
    const doc = await PDFDocument.load(await genererInvitations({ ev, reponses: [], photo, polices, urlQr: () => 'https://site.fr' }));
    expect(doc.getPageCount()).toBe(1);
  });
});
