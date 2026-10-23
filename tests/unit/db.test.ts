import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clientPour, ErreurDoublon, getDb, openDb, type Db, type NouvelleReponse } from '../../src/lib/db';

const T0 = new Date('2027-01-10T10:00:00Z');
const camille: NouvelleReponse = {
  langue: 'fr', vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', telephone: null,
  accompagnants: ['Léo Martin'], moments: ['accueil', 'diner'], message: 'Joyeux anniversaire !',
};

let db: Db;
beforeEach(async () => { db = await openDb(':memory:'); });

describe('réponses', () => {
  test('ajouter puis relire par e-mail (insensible à la casse) et par jeton', async () => {
    const r = await db.ajouter(camille, T0);
    expect(r.id).toBeGreaterThan(0);
    expect(r.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r).toMatchObject({ ...camille, messageMasque: false, emailEnvoye: false, creeLe: T0.toISOString() });
    expect((await db.parEmail('CAMILLE@exemple.FR'))?.id).toBe(r.id);
    expect((await db.parJeton(r.jeton))?.nom).toBe('Camille Martin');
    expect(await db.parJeton('inconnu')).toBeNull();
  });

  test('refuse un doublon d’e-mail', async () => {
    await db.ajouter(camille, T0);
    await expect(db.ajouter({ ...camille, email: 'Camille@Exemple.fr' }, T0)).rejects.toBeInstanceOf(ErreurDoublon);
  });

  test('modifier conserve l’e-mail et met à jour la date', async () => {
    const r = await db.ajouter(camille, T0);
    const T1 = new Date('2027-01-11T10:00:00Z');
    const m = await db.modifier(r.jeton, { ...camille, vient: false, accompagnants: [], moments: [], message: null }, T1);
    expect(m).toMatchObject({ email: 'camille@exemple.fr', vient: false, accompagnants: [], modifieLe: T1.toISOString(), creeLe: T0.toISOString() });
    expect(await db.modifier('inconnu', camille, T1)).toBeNull();
  });

  test('marquerEmailEnvoye', async () => {
    const r = await db.ajouter(camille, T0);
    await db.marquerEmailEnvoye(r.id, true);
    expect((await db.parJeton(r.jeton))?.emailEnvoye).toBe(true);
  });

  test('messagesVisibles : récents d’abord, sans messages vides', async () => {
    await db.ajouter(camille, T0);
    await db.ajouter({ ...camille, email: 'b@exemple.fr', nom: 'Thomas', message: null }, new Date('2027-01-11T00:00:00Z'));
    await db.ajouter({ ...camille, email: 'c@exemple.fr', nom: 'Emma', message: 'Happy birthday!' }, new Date('2027-01-12T00:00:00Z'));
    expect((await db.messagesVisibles(10)).map((m) => m.nom)).toEqual(['Emma', 'Camille Martin']);
    expect(await db.messagesVisibles(1)).toHaveLength(1);
  });

  test('toutes, parId, supprimer', async () => {
    const a = await db.ajouter({ ...camille, email: 'a@x.fr' }, new Date('2027-01-01T10:00:00Z'));
    const b = await db.ajouter({ ...camille, email: 'b@x.fr' }, new Date('2027-01-02T10:00:00Z'));
    expect((await db.toutes()).map((r) => r.email)).toEqual(['b@x.fr', 'a@x.fr']);
    expect((await db.parId(a.id))?.email).toBe('a@x.fr');
    expect(await db.supprimer(a.id)).toBe(true);
    expect(await db.supprimer(a.id)).toBe(false);
    expect(await db.parId(a.id)).toBeNull();
    expect(b.id).toBeGreaterThan(0);
  });

  test('modération des messages', async () => {
    const r = await db.ajouter({ ...camille, message: 'Bravo' }, new Date());
    expect(await db.masquerMessage(r.id, true)).toBe(true);
    expect(await db.messagesVisibles(10)).toEqual([]);
    expect((await db.messages())[0]).toMatchObject({ id: r.id, message: 'Bravo', masque: true });
    await db.masquerMessage(r.id, false);
    expect(await db.messagesVisibles(10)).toHaveLength(1);
    expect(await db.supprimerMessage(r.id)).toBe(true);
    expect(await db.messages()).toEqual([]);
    expect((await db.parId(r.id))?.nom).toBe(camille.nom);
    expect(await db.masquerMessage(9999, true)).toBe(false);
  });
});

test('clientPour', () => {
  expect(clientPour('file:.data/local.db')).toBe('natif');
  expect(clientPour(':memory:')).toBe('natif');
  expect(clientPour('libsql://site-coco.turso.io')).toBe('web');
  expect(clientPour('https://site-coco.turso.io')).toBe('web');
});

test('getDb exige DATABASE_URL en ligne', () => {
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('DATABASE_URL', '');
  try {
    expect(() => getDb()).toThrow('En ligne, DATABASE_URL est obligatoire (base Turso).');
  } finally {
    vi.unstubAllEnvs();
  }
});
