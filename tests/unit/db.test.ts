import { beforeEach, describe, expect, test } from 'vitest';
import { ErreurDoublon, openDb, type Db, type NouvelleReponse } from '../../src/lib/db';

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
});
