// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { afficher } from '../../src/scripts/countdown';

function monter(casesCachees: boolean) {
  document.body.innerHTML = `<div data-countdown="x"><ul class="cd-cases"${casesCachees ? ' hidden' : ''}>
    <li><b data-unit="jours"></b></li><li><b data-unit="heures"></b></li></ul><p class="cd-passe"${casesCachees ? '' : ' hidden'}>fin</p></div>`;
  return document.querySelector<HTMLElement>('[data-countdown]')!;
}

test('réaffiche les cases si le serveur croyait la date passée', () => {
  const el = monter(true);
  afficher(el, { jours: 3, heures: 4, minutes: 0, secondes: 0, passe: false });
  expect(el.querySelector('.cd-cases')!.hasAttribute('hidden')).toBe(false);
  expect(el.querySelector('.cd-passe')!.hasAttribute('hidden')).toBe(true);
  expect(el.querySelector('[data-unit="jours"]')!.textContent).toBe('3');
  expect(el.querySelector('[data-unit="heures"]')!.textContent).toBe('04');
});

test('masque les cases quand la date est passée', () => {
  const el = monter(false);
  afficher(el, { jours: 0, heures: 0, minutes: 0, secondes: 0, passe: true });
  expect(el.querySelector('.cd-cases')!.hasAttribute('hidden')).toBe(true);
  expect(el.querySelector('.cd-passe')!.hasAttribute('hidden')).toBe(false);
});
