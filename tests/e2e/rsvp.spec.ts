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

test('modifier sa réponse via le lien de l’e-mail', async ({ page }, info) => {
  const adresse = email(info, 'modif');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Emma Wilson');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByLabel('16 h · Accueil').check();
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText("C'est noté pour 1 personne")).toBeVisible();

  const lien = messagesEnvoyesA(adresse)[0].html.match(/href="([^"]*\/rsvp\/modifier\?jeton=[^"]+)"/)![1].replace(/&amp;/g, '&');
  await page.goto(new URL(lien).pathname + new URL(lien).search);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modifier ma réponse');
  await expect(page.getByLabel('Prénom & nom')).toHaveValue('Emma Wilson');
  await expect(page.getByLabel(/^E-mail/)).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('16 h · Accueil')).toBeChecked();
  await page.getByRole('button', { name: '+ Ajouter un accompagnant' }).click();
  await page.getByLabel('Accompagnant 1').fill('James Wilson');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByText('Réponse mise à jour !')).toBeVisible();
  expect(messagesEnvoyesA(adresse)).toHaveLength(2);
  expect(messagesEnvoyesA(adresse)[1].html).toContain('James Wilson');
  await page.goto(new URL(lien).pathname + new URL(lien).search);
  await expect(page.getByLabel('Accompagnant 1')).toHaveValue('James Wilson');
});

test('lien de modification invalide', async ({ page }) => {
  await page.goto('/fr/rsvp/modifier?jeton=faux');
  await expect(page.getByText("Ce lien de modification n'est pas valide.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Répondre au formulaire' })).toHaveAttribute('href', '/fr/rsvp');
});

test('modification : l’e-mail ne peut pas être changé par une requête directe', async ({ page }, info) => {
  const adresse = email(info, 'verrou');
  const pirate = email(info, 'pirate');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Emma Wilson');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByLabel('16 h · Accueil').check();
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText("C'est noté pour 1 personne")).toBeVisible();

  const lien = messagesEnvoyesA(adresse)[0].html.match(/href="([^"]*\/rsvp\/modifier\?jeton=[^"]+)"/)![1].replace(/&amp;/g, '&');
  const chemin = new URL(lien).pathname + new URL(lien).search;
  const reponse = await page.request.post(chemin, {
    form: { vient: 'oui', nom: 'Emma Wilson', email: pirate, moment: 'accueil' },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(reponse.status()).toBe(200);
  expect(messagesEnvoyesA(pirate)).toHaveLength(0);
  expect(messagesEnvoyesA(adresse)).toHaveLength(2);
});

test('lien de modification absent', async ({ page }) => {
  await page.goto('/fr/rsvp/modifier');
  await expect(page.getByText("Ce lien de modification n'est pas valide.")).toBeVisible();
  await expect(page.locator('form.rsvp')).toHaveCount(0);
});

test('modification : envoi direct avec un jeton inconnu', async ({ page }, info) => {
  const adresse = email(info, 'inconnu');
  await page.goto('/fr/rsvp');
  const reponse = await page.request.post('/fr/rsvp/modifier?jeton=inconnu', {
    form: { vient: 'oui', nom: 'X Y', email: adresse, moment: 'accueil' },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(reponse.status()).toBe(200);
  expect(await reponse.text()).toContain('pas valide');
  expect(messagesEnvoyesA(adresse)).toHaveLength(0);
});

test('double clic sur envoyer : une seule réponse, un seul e-mail', async ({ page }, info) => {
  const adresse = email(info, 'dblclic');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Alix Dupont');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByLabel('16 h · Accueil').check();
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).dblclick();
  await expect(page.getByRole('heading', { name: /Merci Alix/ })).toBeVisible();
  await expect(page.getByText('déjà répondu')).toHaveCount(0);
  expect(messagesEnvoyesA(adresse)).toHaveLength(1);
});

test('envoi qui n’est pas un formulaire : pas d’erreur serveur', async ({ page }) => {
  await page.goto('/fr/rsvp');
  const origin = new URL(page.url()).origin;
  const a = await page.request.post('/fr/rsvp', { data: 'x', headers: { 'content-type': 'text/plain', Origin: origin } });
  expect(a.status()).toBe(200);
});

test('page de modification : pas de référent, non indexée', async ({ page }) => {
  await page.goto('/fr/rsvp/modifier');
  await expect(page.locator('meta[name=referrer]')).toHaveAttribute('content', 'no-referrer');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
});
