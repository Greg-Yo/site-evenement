import { expect, test } from '@playwright/test';
import { messagesEnvoyesA } from './outbox';

const email = (info: { project: { name: string } }, tag: string) => `${tag}-${info.project.name}-${Date.now()}@exemple.fr`;

test('confirmation complète : merci, e-mail avec PDF, message dans le livre d’or', async ({ page }, info) => {
  const adresse = email(info, 'oui');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Camille <b>Martin</b>');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByRole('button', { name: '+ Ajouter un accompagnant' }).click();
  await page.getByLabel('Accompagnant 1').fill('Léo Martin');
  await page.getByLabel('19 h · Dîner').check();
  const mot = `Joyeux anniversaire ${info.project.name} ${Date.now()}`;
  await page.getByLabel(/Un petit mot/).fill(mot);
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();

  await expect(page.getByRole('heading', { name: /Merci Camille/ })).toBeVisible();
  await expect(page.getByText("C'est noté pour 2 personnes")).toBeVisible();
  await expect(page.getByText(adresse)).toBeVisible();
  await expect(page.locator('.livre')).toContainText(mot);
  await expect(page.locator('.livre')).toContainText('Camille <b>Martin</b>');

  const m = messagesEnvoyesA(adresse);
  expect(m).toHaveLength(1);
  expect(m[0].meta.piecesJointes).toEqual(['Invitation-Camille-b-Martin-b.pdf']);
  expect(m[0].html).toContain('/fr/rsvp/modifier?jeton=');
});

test('ne vient pas : moments et accompagnants masqués, e-mail sans PDF', async ({ page }, info) => {
  const adresse = email(info, 'non');
  await page.goto('/fr/rsvp');
  await page.getByLabel('😢 Je ne pourrai pas').check();
  await expect(page.getByText('À quels moments seras-tu là ?')).toBeHidden();
  await page.getByLabel('Prénom & nom').fill('Paul Leroy');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText('Dommage ! Merci de nous avoir prévenus.')).toBeVisible();
  expect(messagesEnvoyesA(adresse)[0].meta.piecesJointes).toEqual([]);
});

test('erreurs : champs signalés, saisie conservée', async ({ page }) => {
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Camille');
  await page.getByLabel(/^E-mail/).fill('pas-un-email');
  await page.locator('form.rsvp').evaluate((f: HTMLFormElement) => f.setAttribute('novalidate', ''));
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText('Merci de corriger les champs signalés.')).toBeVisible();
  await expect(page.getByText('Adresse e-mail invalide.')).toBeVisible();
  await expect(page.getByText('Choisis au moins un moment.')).toBeVisible();
  await expect(page.getByLabel('Prénom & nom')).toHaveValue('Camille');
  await expect(page.getByLabel(/^E-mail/)).toHaveAttribute('aria-invalid', 'true');
});

test('doublon : message, aucune seconde réponse, lien renvoyé', async ({ page }, info) => {
  const adresse = email(info, 'double');
  for (const nom of ['Premier Nom', 'Second Nom']) {
    await page.goto('/fr/rsvp');
    await page.getByLabel('😢 Je ne pourrai pas').check();
    await page.getByLabel('Prénom & nom').fill(nom);
    await page.getByLabel(/^E-mail/).fill(nom === 'Second Nom' ? `  ${adresse.toUpperCase()} ` : adresse);
    await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  }
  await expect(page.getByText('Tu as déjà répondu avec cette adresse')).toBeVisible();
  const m = messagesEnvoyesA(adresse);
  expect(m).toHaveLength(2);
  expect(m[1].meta.sujet).toContain('modifier');
});

test('fonctionne sans JavaScript', async ({ browser }, info) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  const adresse = email(info, 'nojs');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Sans Script');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByLabel('Accompagnant 2').fill('Ami Deux');
  await page.getByLabel('16 h · Accueil').check();
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText("C'est noté pour 2 personnes")).toBeVisible();
  await ctx.close();
});

test('version anglaise', async ({ page }) => {
  await page.goto('/en/rsvp');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Are you coming?');
  await expect(page.getByLabel("🎉 I'm coming!")).toBeVisible();
});

test('l’accueil affiche un extrait du livre d’or', async ({ page }, info) => {
  const mot = `Extrait accueil ${info.project.name} ${Date.now()}`;
  await page.goto('/fr/rsvp');
  await page.getByLabel('😢 Je ne pourrai pas').check();
  await page.getByLabel('Prénom & nom').fill('Julie Bernard');
  await page.getByLabel(/^E-mail/).fill(email(info, 'extrait'));
  await page.getByLabel(/Un petit mot/).fill(mot);
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await page.goto('/fr/');
  // Un autre test peut avoir laissé un message plus récent : on vérifie qu'un extrait signé s'affiche.
  await expect(page.locator('.tu-viens blockquote footer')).toContainText('—');
});
