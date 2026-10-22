import { expect, type Page } from '@playwright/test';

// Valeur de playwright.config.ts (webServer.env).
const MOT_DE_PASSE = 'mot-de-passe-de-test';

// Origine telle que le serveur la reconstruit : sans `security.allowedDomains`, Astro ignore l'en-tête Host et utilise
// `localhost:<port>`. Les requêtes forgées (sans Sec-Fetch-Site) doivent l'envoyer en Origin pour passer `checkOrigin`,
// même si les tests visent 127.0.0.1.
export const ORIGINE_SERVEUR = 'http://localhost:4322';

// Adresse unique par test et par projet : la base est partagée entre les tests.
export const email = (info: { project: { name: string } }, tag: string) => `${tag}-${info.project.name}-${Date.now()}@exemple.fr`;

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
  const rep = await page.request.post('/fr/rsvp', { headers: { Origin: ORIGINE_SERVEUR }, form });
  expect(rep.status()).toBe(200);
  // La page répond 200 aussi pour une erreur de saisie, un doublon ou un formulaire fermé : seule la carte de remerciement
  // avec le prénom prouve que la réponse est enregistrée.
  const prenom = String(champs.nom ?? '').trim().split(' ')[0];
  const corps = await rep.text();
  const message = `réponse non enregistrée pour ${champs.email}`;
  expect(corps, message).toContain('carte-resultat');
  expect(corps, message).toContain(`Merci ${prenom} !`);
}
