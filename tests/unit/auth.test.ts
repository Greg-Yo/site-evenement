import { expect, test } from 'vitest';
import { openDb } from '../../src/lib/db';
import {
  DUREE_SESSION_MS,
  cleSession,
  configAdmin,
  creerSession,
  motDePasseCorrect,
  sessionValide,
  tenterConnexion,
} from '../../src/lib/auth';

const SECRET = 'x'.repeat(32);
const T0 = new Date('2027-01-15T12:00:00Z');

test('configAdmin', () => {
  expect(configAdmin({})).toEqual({ ok: false, probleme: "ADMIN_PASSWORD n'est pas défini : l'espace organisateur est désactivé." });
  expect(configAdmin({ ADMIN_PASSWORD: 'p', SESSION_SECRET: 'court' }))
    .toEqual({ ok: false, probleme: 'SESSION_SECRET doit contenir au moins 32 caractères.' });
  expect(configAdmin({ ADMIN_PASSWORD: 'p', SESSION_SECRET: SECRET })).toEqual({ ok: true, motDePasse: 'p', secret: SECRET });
});

test('motDePasseCorrect', () => {
  expect(motDePasseCorrect('soleil', 'soleil')).toBe(true);
  expect(motDePasseCorrect('Soleil', 'soleil')).toBe(false);
  expect(motDePasseCorrect('', 'soleil')).toBe(false);
});

test('session : valide, expirée, falsifiée, autre secret, mal formée', () => {
  const s = creerSession(SECRET, T0);
  expect(sessionValide(s, SECRET, new Date(T0.getTime() + 1000))).toBe(true);
  expect(sessionValide(s, SECRET, new Date(T0.getTime() + DUREE_SESSION_MS + 1))).toBe(false);
  expect(sessionValide(s, 'y'.repeat(32), T0)).toBe(false);
  const [exp, sig] = s.split('.');
  expect(sessionValide(`${Number(exp) + 1}.${sig}`, SECRET, T0)).toBe(false);
  for (const v of [undefined, '', 'abc', '1.2.3', `${exp}.`, `.${sig}`]) expect(sessionValide(v, SECRET, T0)).toBe(false);
});

test('cleSession : changer le mot de passe ou le secret invalide les sessions', () => {
  const cle = cleSession({ motDePasse: 'soleil', secret: SECRET });
  expect(cle).toMatch(/^[0-9a-f]{64}$/);
  const s = creerSession(cle, T0);
  expect(sessionValide(s, cleSession({ motDePasse: 'soleil', secret: SECRET }), T0)).toBe(true);
  expect(sessionValide(s, cleSession({ motDePasse: 'lune', secret: SECRET }), T0)).toBe(false);
  expect(sessionValide(s, cleSession({ motDePasse: 'soleil', secret: 'y'.repeat(32) }), T0)).toBe(false);
});

test('tenterConnexion : 5 échecs bloquent, même avec le bon mot de passe, puis débloque après 15 min', async () => {
  const db = await openDb(':memory:');
  const cfg = { motDePasse: 'soleil' };
  for (let i = 0; i < 5; i++) expect(await tenterConnexion('faux', '1.1.1.1', cfg, db, T0)).toBe('refuse');
  expect(await tenterConnexion('soleil', '1.1.1.1', cfg, db, T0)).toBe('bloque');
  expect(await tenterConnexion('soleil', '2.2.2.2', cfg, db, T0)).toBe('ok');
  expect(await tenterConnexion('soleil', '1.1.1.1', cfg, db, new Date(T0.getTime() + 15 * 60_000 + 1))).toBe('ok');
});

test('les connexions réussies ne comptent pas comme des échecs', async () => {
  const db = await openDb(':memory:');
  for (let i = 0; i < 6; i++) expect(await tenterConnexion('soleil', '1.1.1.1', { motDePasse: 'soleil' }, db, T0)).toBe('ok');
});
