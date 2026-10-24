import type { EventConfig } from './event';

type Theme = EventConfig['theme'];
const SOLEIL = { principale: '#ec5e27', fond: '#fdfdf1', texte: '#3a2419', douce: '#fbd7c2' };
const POLICES = { titres: 'Caveat', texte: 'Nunito' };
// Graisses connues des polices par défaut ; les autres sont demandées sans graisse imposée.
const POIDS: Record<string, string> = { Caveat: '500;700', Nunito: '400;600;800' };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function darkenUntil(color: string, against: string, min = 4.5): string {
  let c = rgb(color);
  for (let i = 0; i < 100 && contrastRatio(hex(c), against) < min; i++) c = c.map((v) => v * 0.98);
  return hex(c);
}

function mix(a: string, b: string, weightA: number): string {
  const [ca, cb] = [rgb(a), rgb(b)];
  return hex(ca.map((v, i) => v * weightA + cb[i] * (1 - weightA)));
}

export function couleursTheme(theme: Theme) {
  const c = { ...SOLEIL, ...theme.couleurs };
  return {
    principale: c.principale,
    principaleFonce: darkenUntil(c.principale, c.fond),
    fond: c.fond,
    texte: c.texte,
    texteDoux: darkenUntil(mix(c.texte, c.fond, 0.75), c.fond),
    douce: c.douce,
  };
}

export function themeVars(theme: Theme): string {
  const c = couleursTheme(theme);
  const p = { ...POLICES, ...theme.polices };
  const vars: Record<string, string> = {
    '--c-principale': c.principale,
    '--c-principale-fonce': c.principaleFonce,
    '--c-fond': c.fond,
    '--c-texte': c.texte,
    '--c-texte-doux': c.texteDoux,
    '--c-douce': c.douce,
    '--f-titres': `'${p.titres}', cursive`,
    '--f-texte': `'${p.texte}', system-ui, sans-serif`,
  };
  return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
}

export function fontsHref(theme: Theme): string {
  const p = { ...POLICES, ...theme.polices };
  const fam = (name: string) => {
    const nom = name.trim();
    return `family=${nom.replace(/ +/g, '+')}${POIDS[nom] ? `:wght@${POIDS[nom]}` : ''}`;
  };
  return `https://fonts.googleapis.com/css2?${fam(p.titres)}&${fam(p.texte)}&display=swap`;
}
