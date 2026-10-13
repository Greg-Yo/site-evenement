import { expect, test } from '@playwright/test';

test('la racine redirige selon Accept-Language', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
  await ctx.close();
});

test('la racine redirige vers fr par défaut', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'de-DE', extraHTTPHeaders: { 'Accept-Language': 'de-DE' } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/fr\/$/);
  await ctx.close();
});

test('le bouton de langue change de langue et s’en souvient', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'fr-FR', extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  const page = await ctx.newPage();
  await page.goto('/fr/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.locator('.lang a[hreflang="en"]').click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // Accept-Language est français : seule la mémoire (cookie) peut renvoyer vers /en/.
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
  await ctx.close();
});

test('le sélecteur de langue est lisible', async ({ page }) => {
  await page.goto('/fr/');
  const { link, bg } = await page.evaluate(() => ({
    link: getComputedStyle(document.querySelector('.lang a[hreflang="en"]')!).color,
    bg: getComputedStyle(document.querySelector('.lang')!).backgroundColor,
  }));
  expect(link).not.toBe(bg);
});

test('une langue inconnue renvoie vers la racine', async ({ page }) => {
  await page.goto('/de/');
  await expect(page).toHaveURL(/\/(fr|en)\/$/);
});

test('la navigation contient les 5 pages', async ({ page }) => {
  await page.goto('/fr/');
  // Locator CSS plutôt que getByRole : sur téléphone le menu est fermé, donc masqué pour l'arbre d'accessibilité.
  await expect(page.locator('#menu a')).toHaveText(['Accueil', 'Notre histoire', 'Programme & lieux', 'Infos pratiques', "RSVP & Livre d'or"]);
  await expect(page.locator('#menu a[aria-current="page"]')).toHaveText('Accueil');
});
