import { readFileSync, readdirSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { beforeAll, describe, expect, test } from 'vitest';
import { parseEvent } from '../../src/lib/event';
import fontkit from '@pdf-lib/fontkit';
import { BAS_CONTENU, couper, dessinable, genererInvitation, mesurerInvitation, tronquer, type Polices } from '../../src/lib/pdf/invitation';

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
    const f = await doc.embedFont(polices.titre, { subset: false });
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
  });
});
