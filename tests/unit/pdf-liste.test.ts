import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { expect, test } from 'vitest';
import { parseEvent } from '../../src/lib/event';
import type { Polices } from '../../src/lib/pdf/invitation';
import { genererListe, lignesCellule, lignesListe, paginer } from '../../src/lib/pdf/liste';
import { rep } from './fabriques';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));
const polices: Polices = {
  titre: readFileSync('src/assets/fonts/Caveat-Bold.ttf'),
  texte: readFileSync('src/assets/fonts/Nunito-Regular.ttf'),
  texteGras: readFileSync('src/assets/fonts/Nunito-ExtraBold.ttf'),
};

test('lignesListe : seulement les confirmés, triés, abrégés', () => {
  const l = lignesListe(ev, [
    rep({ nom: 'Martin Zoé', vient: true, moments: ['accueil', 'soiree'], accompagnants: ['Léo Martin'] }),
    rep({ nom: 'Paul Absent', vient: false }),
    rep({ nom: 'Émilie Durand', vient: true, moments: ['diner'], telephone: '06 12' }),
  ]);
  expect(l).toEqual([
    { nom: 'Émilie Durand', accompagnants: '—', email: expect.any(String), telephone: '06 12', personnes: 1, moments: 'D' },
    { nom: 'Martin Zoé', accompagnants: 'Léo Martin', email: expect.any(String), telephone: '—', personnes: 2, moments: 'A·S' },
  ]);
});

test('paginer', () => {
  expect(paginer([10, 10, 10], 25, 25)).toEqual([[0, 1], [2]]);
  expect(paginer([10, 10, 10, 10], 15, 30)).toEqual([[0], [1, 2, 3]]);
  expect(paginer([50], 20, 20)).toEqual([[0]]);
  expect(paginer([], 20, 20)).toEqual([[]]);
});

test('genererListe : PDF A4 valide, une page pour quelques invités', async () => {
  const octets = await genererListe({ ev, reponses: [rep({ vient: true, moments: ['diner'] })], polices, maintenant: new Date('2027-01-15T12:00:00Z') });
  const doc = await PDFDocument.load(octets);
  expect(doc.getPageCount()).toBe(1);
  expect(doc.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
  expect(doc.getTitle()).toContain('Liste des confirmés');
});

test('genererListe : 120 foyers, noms très longs et emoji → plusieurs pages sans erreur', async () => {
  const reponses = Array.from({ length: 120 }, (_, i) => rep({
    id: i + 1, vient: true, moments: ['accueil', 'diner'], email: `invite${i}@exemple.fr`,
    nom: i % 10 === 0 ? `${'Maximilien-Alexandre '.repeat(6)}🎉 ${i}` : `Invité ${i}`,
    accompagnants: i % 7 === 0 ? ['A'.repeat(150), 'Léo 🥳', 'Zoé', 'Noé'] : [],
  }));
  const doc = await PDFDocument.load(await genererListe({ ev, reponses, polices, maintenant: new Date() }));
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
}, 20_000);

test('lignesCellule : un téléphone international tient sur deux lignes sans perdre de chiffre', async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit((await import('@pdf-lib/fontkit')).default);
  const f = await doc.embedFont(polices.texte, { subset: true });
  // Colonne Téléphone : 70 pt moins 2 × 3 pt de marge intérieure.
  for (const tel of ['+33 6 12 34 56 78', '+44 7911 123456']) {
    const l = lignesCellule(tel, f, 8.5, 64, 2);
    expect(l.length).toBeLessThanOrEqual(2);
    expect(l.join(' ')).toBe(tel);
    for (const ligne of l) expect(f.widthOfTextAtSize(ligne, 8.5)).toBeLessThanOrEqual(64);
  }
  // Au-delà du maximum, la dernière ligne finit par « … ».
  const long = lignesCellule('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28', f, 8.5, 64, 2);
  expect(long).toHaveLength(2);
  expect(long[1].endsWith('…')).toBe(true);
});

test('genererListe : téléphone +33 sur deux lignes, PDF valide', async () => {
  const octets = await genererListe({ ev, reponses: [rep({ vient: true, telephone: '+33 6 12 34 56 78', moments: ['diner'] })], polices, maintenant: new Date('2027-01-15T12:00:00Z') });
  expect((await PDFDocument.load(octets)).getPageCount()).toBe(1);
});

test('genererListe : aucun confirmé → une page', async () => {
  const doc = await PDFDocument.load(await genererListe({ ev, reponses: [], polices, maintenant: new Date() }));
  expect(doc.getPageCount()).toBe(1);
});

test('écrit un aperçu dans .data/ pour contrôle visuel', async () => {
  const prenoms = ['Camille', 'Léo', 'Zoé', 'Noé', 'Inès', 'Jules', 'Chloé', 'Hugo'];
  const reponses = Array.from({ length: 40 }, (_, i) => rep({
    id: i + 1, vient: i % 9 !== 4, email: i % 6 === 0 ? `une.adresse.vraiment.tres.longue.${i}@exemple-de-domaine.fr` : `invite${i}@exemple.fr`,
    nom: i % 8 === 0 ? `Marie-Charlotte de La Rochefoucauld-Montmorency 🎉 ${i}` : `${prenoms[i % 8]} Martin ${i}`,
    telephone: i % 3 ? (i % 2 ? '+33 6 12 34 56 78' : '+44 7911 123456') : null,
    accompagnants: i === 3 ? ['A'.repeat(150), 'Léo 🥳', 'Zoé', 'Noé'] : i % 5 === 0 ? ['Léo 🥳', 'Zoé Dupont-Lefèvre', 'Noé', 'Inès Bertrand', 'Jules Petit'] : i % 2 ? [`${prenoms[(i + 3) % 8]} Martin`] : [],
    moments: ev.moments.filter((_, k) => (i + k) % 3).map((m) => m.id),
  }));
  mkdirSync('.data', { recursive: true });
  writeFileSync('.data/apercu-liste.pdf', await genererListe({ ev, reponses, polices, maintenant: new Date('2027-01-15T12:00:00Z') }));
}, 20_000);
