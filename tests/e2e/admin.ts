import { expect, test, type Page } from '@playwright/test';

// Valeur de playwright.config.ts (webServer.env).
const MOT_DE_PASSE = 'mot-de-passe-de-test';

const origine = () => new URL(test.info().project.use.baseURL!).origin;

export async function connecter(page: Page): Promise<void> {
  await page.goto('/admin/connexion');
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// Envoie une réponse au formulaire public sans passer par l'interface (champs répétés : tableau de valeurs).
export async function repondre(page: Page, champs: Record<string, string | string[]>): Promise<void> {
  const form = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) {
    for (const v of Array.isArray(valeur) ? valeur : [valeur]) form.append(nom, v);
  }
  const rep = await page.request.post('/fr/rsvp', { headers: { Origin: origine() }, form });
  expect(rep.status()).toBe(200);
}
