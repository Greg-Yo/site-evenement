import { expect, test } from 'vitest';
import { openDb } from '../../src/lib/db';
import { depasseLimite } from '../../src/lib/limites';

test('autorise max envois par fenêtre puis bloque, par clé', async () => {
  const db = await openDb(':memory:');
  const t = new Date('2027-01-10T10:00:00Z');
  for (let i = 0; i < 5; i++) expect(await depasseLimite(db, 'rsvp:1.2.3.4', 5, 600_000, t)).toBe(false);
  expect(await depasseLimite(db, 'rsvp:1.2.3.4', 5, 600_000, t)).toBe(true);
  expect(await depasseLimite(db, 'rsvp:5.6.7.8', 5, 600_000, t)).toBe(false);
  const apres = new Date(t.getTime() + 600_001);
  expect(await depasseLimite(db, 'rsvp:1.2.3.4', 5, 600_000, apres)).toBe(false);
});
