import { describe, expect, test } from 'vitest';
import { detectLang, formatDate, formatHeure, isLang, switchPath, ui } from '../../src/lib/i18n';

describe('detectLang', () => {
  test('le cookie valide gagne', () => expect(detectLang('en', 'fr-FR')).toBe('en'));
  test('un cookie invalide est ignoré', () => expect(detectLang('de', 'en-US')).toBe('en'));
  test('respecte les poids q', () => expect(detectLang(undefined, 'de;q=1, en;q=0.8, fr;q=0.9')).toBe('fr'));
  test('en-GB donne en', () => expect(detectLang(undefined, 'en-GB,en;q=0.9')).toBe('en'));
  test('joker ou vide donne fr', () => {
    expect(detectLang(undefined, '*')).toBe('fr');
    expect(detectLang(undefined, null)).toBe('fr');
    expect(detectLang(undefined, '')).toBe('fr');
  });
  test('langue non gérée donne fr', () => expect(detectLang(undefined, 'es-ES,de')).toBe('fr'));
});

test('isLang', () => {
  expect(isLang('fr')).toBe(true);
  expect(isLang('de')).toBe(false);
  expect(isLang(undefined)).toBe(false);
});

test('switchPath remplace le préfixe de langue', () => {
  expect(switchPath('/fr/programme', 'en')).toBe('/en/programme');
  expect(switchPath('/fr/', 'en')).toBe('/en/');
  expect(switchPath('/fr', 'en')).toBe('/en/');
  expect(switchPath('/', 'en')).toBe('/en/');
});

test('ui traduit les libellés', () => {
  expect(ui('fr', 'nav.programme')).toBe('Programme & lieux');
  expect(ui('en', 'nav.programme')).toBe('Schedule & venues');
});

test('formatDate', () => {
  expect(formatDate('2027-06-14T16:00:00+02:00', 'fr')).toBe('lundi 14 juin 2027');
  expect(formatDate('2027-06-14T16:00:00+02:00', 'en')).toBe('Monday, June 14, 2027');
});

test('formatDate garde le jour local quel que soit le fuseau du serveur', () => {
  expect(formatDate('2027-06-14T01:00:00+02:00', 'fr')).toBe('lundi 14 juin 2027');
  expect(formatDate('2027-06-14T23:30:00-05:00', 'en')).toBe('Monday, June 14, 2027');
  expect(formatDate('2027-06-14T01:00:00+0200', 'fr')).toBe('lundi 14 juin 2027');
  expect(formatDate('2027-06-14T10:00:00Z', 'fr')).toBe('lundi 14 juin 2027');
});

test('formatHeure', () => {
  expect(formatHeure('19:00', 'fr')).toBe('19 h');
  expect(formatHeure('19:30', 'fr')).toBe('19 h 30');
  expect(formatHeure('19:00', 'en')).toBe('7 pm');
  expect(formatHeure('11:30', 'en')).toBe('11:30 am');
  expect(formatHeure('00:15', 'en')).toBe('12:15 am');
});
