import { expect, test } from '@playwright/test';

test.describe('Accueil', () => {
  test('affiche titre, date, compte à rebours et liens', async ({ page }) => {
    await page.goto('/fr/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coco a 40 ans');
    // La date figure aussi dans le pied de page : on vise celle du bandeau.
    await expect(page.locator('.hero .meta')).toContainText('lundi 14 juin 2027');
    await expect(page.getByRole('timer')).toContainText('jours');
    await expect(page.getByRole('link', { name: 'Je viens ! →' })).toHaveAttribute('href', '/fr/rsvp');
    await expect(page.getByRole('heading', { name: 'Le programme' })).toBeVisible();
  });

  test('version anglaise', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coco turns 40');
    await expect(page.locator('.hero .meta')).toContainText('Monday, June 14, 2027');
  });

  test('compte à rebours passé : message au lieu des chiffres', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-06-15T10:00:00+02:00') });
    await page.goto('/fr/');
    await expect(page.getByText("C'est le grand jour !")).toBeVisible();
    await expect(page.locator('.cd-cases')).toBeHidden();
  });

  test('pas de défilement horizontal à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/fr/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('Notre histoire', () => {
  test('frise et galerie', async ({ page }) => {
    await page.goto('/fr/histoire');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notre histoire');
    for (const annee of ['1987', '2009', '2027']) await expect(page.getByText(annee, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'La galerie' })).toBeVisible();
  });

  test('la visionneuse s’ouvre, défile et se ferme au clavier', async ({ page }) => {
    await page.goto('/fr/histoire');
    await page.locator('a[data-lightbox]').first().click();
    const dlg = page.locator('dialog#lightbox');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('figcaption')).toHaveText('Santé !');
    await page.keyboard.press('ArrowRight');
    await expect(dlg.locator('img')).toHaveAttribute('src', /ballons/);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(dlg.locator('img')).toHaveAttribute('src', /hero/);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });
});

test.describe('Programme & lieux', () => {
  test('étapes, liens d’itinéraire et carte', async ({ page }) => {
    await page.goto('/fr/programme');
    await expect(page.getByRole('heading', { level: 2, name: /Dîner/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Itinéraire Google Maps' }).first())
      .toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=44\.8378/);
    await expect(page.locator('#carte .leaflet-marker-icon')).toHaveCount(6);
    await page.getByRole('button', { name: 'Voir sur la carte' }).nth(2).click();
    await expect(page.locator('.leaflet-popup')).toContainText('La Guinguette');
  });

  test('version anglaise des heures', async ({ page }) => {
    await page.goto('/en/programme');
    await expect(page.getByRole('heading', { level: 2, name: /7 pm · Dinner/ })).toBeVisible();
  });
});
