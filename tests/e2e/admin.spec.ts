import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './admin';

test('sans session : /admin redirige vers la connexion', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  await expect(page.getByRole('heading', { name: /Espace organisateur/ })).toBeVisible();
});

test('mauvais mot de passe : message d’erreur', async ({ page }) => {
  await page.goto('/admin/connexion');
  await page.getByLabel('Mot de passe').fill('pas-le-bon');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Mot de passe incorrect.');
});

test('connexion, cookie sûr, en-têtes, puis déconnexion', async ({ page, context }) => {
  await connecter(page);
  await expect(page.getByRole('heading', { level: 1, name: /Réponses/ })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === 'admin_session')!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  const rep = await page.request.get('/admin');
  expect(rep.headers()['cache-control']).toContain('no-store');
  expect(rep.headers()['x-robots-tag']).toContain('noindex');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
});

test('cookie falsifié refusé', async ({ page, context }) => {
  await context.addCookies([{ name: 'admin_session', value: '99999999999999.faux', url: 'http://localhost:4322' }]);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
});

test('requête depuis un autre site refusée (CSRF)', async ({ page }) => {
  await connecter(page);
  const rep = await page.request.post('/admin/deconnexion', { headers: { Origin: 'https://pirate.example' }, form: {} });
  expect(rep.status()).toBe(403);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1, name: /Réponses/ })).toBeVisible();
});

const violations = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

test('accessibilité WCAG AA de la connexion et des onglets', async ({ page }) => {
  await page.goto('/admin/connexion');
  expect(await violations(page)).toEqual([]);
  await connecter(page);
  expect(await violations(page)).toEqual([]);
});
