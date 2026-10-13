import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/fr/', '/en/', '/fr/histoire', '/fr/programme', '/fr/infos'];

for (const url of PAGES) {
  test(`${url} : aucune violation WCAG AA`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('.leaflet-container').analyze();
    expect(res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });

  test(`${url} : pas de défilement horizontal à 360 px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('menu téléphone : s’ouvre au clic', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/fr/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav).toBeHidden();
  await page.locator('header').getByRole('button', { name: 'Menu' }).click();
  await expect(nav).toBeVisible();
  await expect(page.locator('header').getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');
});

test('pied de page : espace avant le courriel', async ({ page }) => {
  await page.goto('/fr/');
  await expect(page.locator('footer')).toContainText('Une question ? contact@exemple.fr');
});
