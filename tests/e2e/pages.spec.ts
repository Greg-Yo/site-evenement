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
