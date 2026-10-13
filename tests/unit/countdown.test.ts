import { expect, test } from 'vitest';
import { remaining } from '../../src/scripts/countdown';

const T = Date.parse('2027-06-14T16:00:00+02:00');

test('décompose le temps restant', () => {
  const now = T - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
  expect(remaining(now, T)).toEqual({ jours: 2, heures: 3, minutes: 4, secondes: 5, passe: false });
});

test('arrondit à la seconde inférieure', () => {
  expect(remaining(T - 1500, T)).toEqual({ jours: 0, heures: 0, minutes: 0, secondes: 1, passe: false });
});

test('après la date : zéros et passe = true, jamais de négatif', () => {
  expect(remaining(T + 10_000, T)).toEqual({ jours: 0, heures: 0, minutes: 0, secondes: 0, passe: true });
  expect(remaining(T, T).passe).toBe(true);
});
