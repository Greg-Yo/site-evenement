import { describe, expect, test } from 'vitest';
import { contrastRatio, darkenUntil, fontsHref, themeVars } from '../../src/lib/theme';

describe('contrastRatio', () => {
  test('valeurs de référence', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#fdfdf1', '#ec5e27')).toBeCloseTo(3.31, 2);
    expect(contrastRatio('#3a2419', '#fdfdf1')).toBeCloseTo(14.17, 1);
  });
  test('symétrique', () => {
    expect(contrastRatio('#ec5e27', '#fdfdf1')).toBe(contrastRatio('#fdfdf1', '#ec5e27'));
  });
});

describe('darkenUntil', () => {
  test('assombrit l’orange jusqu’à 4,5:1 sans excès', () => {
    const fonce = darkenUntil('#ec5e27', '#fdfdf1');
    const r = contrastRatio(fonce, '#fdfdf1');
    expect(r).toBeGreaterThanOrEqual(4.5);
    expect(r).toBeLessThan(5);
  });
  test('laisse intacte une couleur déjà assez contrastée', () => {
    expect(darkenUntil('#3a2419', '#fdfdf1')).toBe('#3a2419');
  });
});

describe('themeVars', () => {
  test('utilise les valeurs Soleil par défaut', () => {
    const css = themeVars({ couleurs: {}, polices: {} });
    expect(css).toContain('--c-principale:#ec5e27');
    expect(css).toContain('--c-fond:#fdfdf1');
    expect(css).toContain("--f-titres:'Caveat'");
  });
  test('le texte doux reste lisible sur le fond', () => {
    const css = themeVars({ couleurs: {}, polices: {} });
    const doux = css.match(/--c-texte-doux:(#[0-9a-f]{6})/)![1];
    expect(contrastRatio(doux, '#fdfdf1')).toBeGreaterThanOrEqual(4.5);
  });
  test('accepte une couleur personnalisée', () => {
    expect(themeVars({ couleurs: { principale: '#2a9d8f' }, polices: {} })).toContain('--c-principale:#2a9d8f');
  });
});

test('fontsHref : graisses connues pour Caveat et Nunito, aucune imposée sinon, espaces encodés', () => {
  expect(fontsHref({ couleurs: {}, polices: {} }))
    .toBe('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Nunito:wght@400;600;800&display=swap');
  expect(fontsHref({ couleurs: {}, polices: { titres: 'Great Vibes', texte: 'Open Sans' } }))
    .toBe('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Open+Sans&display=swap');
});
