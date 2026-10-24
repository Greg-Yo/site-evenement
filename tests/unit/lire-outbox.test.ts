import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { listerOutbox, lireFichierOutbox } from '../../src/lib/mail/lire-outbox';
import { creerOutbox } from '../../src/lib/mail/outbox';

let racine: string;
beforeEach(async () => {
  racine = mkdtempSync(join(tmpdir(), 'outbox-'));
  const dates = [new Date('2027-01-15T10:00:00Z'), new Date('2027-01-15T11:00:00Z')];
  const boite = creerOutbox(racine, () => dates.shift()!);
  await boite.envoyer({ a: 'camille@x.fr', sujet: 'Premier', html: '<p>Camille</p>', texte: 'Camille',
    piecesJointes: [{ nom: 'Invitation-Camille.pdf', contenu: new Uint8Array([37, 80, 68, 70]), type: 'application/pdf' }] });
  await boite.envoyer({ a: 'leo@x.fr', sujet: 'Second', html: '<p>Léo</p>', texte: 'Léo' });
});

test('listerOutbox : plus récents d’abord, dossiers incomplets ignorés', () => {
  mkdirSync(join(racine, '20270101-000000-000-99'));             // sans meta.json
  mkdirSync(join(racine, '20270101-000000-000-98'));
  writeFileSync(join(racine, '20270101-000000-000-98', 'meta.json'), '{pas du json');
  const l = listerOutbox(racine);
  expect(l.map((e) => e.sujet)).toEqual(['Second', 'Premier']);
  expect(l[1].piecesJointes).toEqual(['Invitation-Camille.pdf']);
});

test('listerOutbox : à date égale, le compteur se compare en nombre', () => {
  const meta = (sujet: string) => JSON.stringify({ a: 'x@x.fr', sujet, date: '2028-01-01T00:00:00.000Z', piecesJointes: [] });
  for (const n of [9, 10]) {
    mkdirSync(join(racine, `20280101-000000-000-${n}`));
    writeFileSync(join(racine, `20280101-000000-000-${n}`, 'meta.json'), meta(`n${n}`));
  }
  expect(listerOutbox(racine).map((e) => e.sujet).slice(0, 2)).toEqual(['n10', 'n9']);
  expect(listerOutbox(racine, 1)).toHaveLength(1);
  expect(listerOutbox(join(racine, 'absent'))).toEqual([]);
});

test('lireFichierOutbox : message et pièces jointes déclarées seulement', () => {
  const [, premier] = listerOutbox(racine);
  expect(lireFichierOutbox(racine, premier.dossier, 'message.html')?.type).toBe('text/html; charset=utf-8');
  expect(lireFichierOutbox(racine, premier.dossier, 'Invitation-Camille.pdf')?.type).toBe('application/pdf');
  expect(lireFichierOutbox(racine, premier.dossier, 'meta.json')).toBeNull();
  expect(lireFichierOutbox(racine, premier.dossier, 'message.txt')).toBeNull();
  expect(lireFichierOutbox(racine, premier.dossier, '../meta.json')).toBeNull();
  expect(lireFichierOutbox(racine, '..', 'message.html')).toBeNull();
  expect(lireFichierOutbox(racine, `${premier.dossier}/..`, 'message.html')).toBeNull();
  expect(lireFichierOutbox(racine, `${premier.dossier}\n`, 'message.html')).toBeNull();
  expect(lireFichierOutbox(racine, '20990101-000000-000-1', 'message.html')).toBeNull();
});

test('lireFichierOutbox : meta.json modifié à la main déclarant ../x', () => {
  const [, premier] = listerOutbox(racine);
  const m = join(racine, premier.dossier, 'meta.json');
  writeFileSync(m, JSON.stringify({ a: 'x@x.fr', sujet: 's', date: '2027-01-15T10:00:00.000Z', piecesJointes: ['../x', '..\\x', '..'] }));
  writeFileSync(join(racine, 'x'), 'secret');
  for (const f of ['../x', '..\\x', '..']) expect(lireFichierOutbox(racine, premier.dossier, f)).toBeNull();
});
