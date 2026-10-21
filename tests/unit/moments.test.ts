import { expect, test } from 'vitest';
import { momentLabel } from '../../src/lib/moments';

const m = { id: 'brunch', heure: '11:00', jour: { fr: 'Dimanche', en: 'Sunday' }, titre: { fr: 'Brunch', en: 'Brunch' }, lieu: 'x' };

test('momentLabel avec jour', () => {
  expect(momentLabel(m, 'fr')).toBe('Dimanche 11 h · Brunch');
  expect(momentLabel(m, 'en')).toBe('Sunday 11 am · Brunch');
});

test('momentLabel sans jour', () => {
  expect(momentLabel({ ...m, jour: undefined, heure: '19:30', titre: { fr: 'Dîner' } }, 'fr')).toBe('19 h 30 · Dîner');
});
