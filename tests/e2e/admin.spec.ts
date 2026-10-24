import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { connecter, email, ORIGINE_SERVEUR, repondre } from './admin';
import { messagesEnvoyesA } from './outbox';

test('sans session : /admin redirige vers la connexion', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  await expect(page.getByRole('heading', { name: /Espace organisateur/ })).toBeVisible();
});

// Seul test avec un mot de passe erroné : ne jamais le dupliquer. 2 projets × (1 essai + 1 reprise)
// = 4 mots de passe erronés, soit tout le budget avant le blocage de 127.0.0.1 (5 échecs en 15 minutes).
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
  await context.addCookies([{ name: 'admin_session', value: '99999999999999.faux', url: 'http://127.0.0.1:4322' }]);
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

test('tableau : compteurs, recherche, filtre de présence, export CSV', async ({ page }, info) => {
  const oui = email(info, 'adm-oui');
  const non = email(info, 'adm-non');
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Iris Admin', email: oui, moment: ['diner'] });
  await repondre(page, { vient: 'non', nom: 'Noé Admin', email: non });
  await connecter(page);
  await expect(page.getByText('Personnes attendues')).toBeVisible();
  await page.getByLabel('Rechercher un nom ou un e-mail').fill(oui);
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('row').nth(1)).toContainText('Iris Admin');
  await page.getByLabel('Rechercher un nom ou un e-mail').fill(non);
  await page.getByLabel('Présence').selectOption('oui');
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await expect(page.getByText('Aucune réponse ne correspond à ces filtres.')).toBeVisible();
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Export CSV/ }).click()]);
  const contenu = readFileSync(await telechargement.path(), 'utf8');
  expect(contenu.charCodeAt(0)).toBe(0xfeff);
  expect(contenu).toContain(`Iris Admin;${oui};`);
});

test('export CSV sans session : 401', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4322' });
  expect((await ctx.get('/api/admin/export.csv')).status()).toBe(401);
});

test('téléchargement de la liste des confirmés', async ({ page }) => {
  await connecter(page);
  const [t] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /PDF liste des confirmés/ }).click()]);
  expect(t.suggestedFilename()).toBe('liste-des-confirmes.pdf');
  expect(readFileSync(await t.path()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('téléchargement de toutes les invitations', async ({ page }, info) => {
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Pia Invitations', email: email(info, 'adm-invs'), moment: ['diner'] });
  await connecter(page);
  const [t] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Toutes les invitations/ }).click()]);
  expect(t.suggestedFilename()).toBe('invitations.pdf');
  expect(readFileSync(await t.path()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('actions : invitation PDF, renvoi, modification, suppression', async ({ page }, info) => {
  const adr = email(info, 'adm-actions');
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Jade Actions', email: adr, moment: ['accueil'] });
  await connecter(page);
  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Invitation PDF de Jade Actions' }).click()]);
  expect(readFileSync(await pdf.path()).subarray(0, 5).toString()).toBe('%PDF-');

  await page.getByRole('button', { name: 'Renvoyer l’e-mail à Jade Actions' }).click();
  await expect(page.getByRole('status')).toHaveText('E-mail renvoyé.');
  expect(messagesEnvoyesA(adr)).toHaveLength(2);

  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await page.getByRole('link', { name: 'Modifier la réponse de Jade Actions' }).click();
  await page.getByLabel('Prénom & nom').fill('Jade Modifiée');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toContainText('Réponse modifiée.');

  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await expect(page.getByRole('row').nth(1)).toContainText('Jade Modifiée');
  await page.getByRole('link', { name: 'Supprimer la réponse de Jade Modifiée' }).click();
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page.getByRole('status')).toHaveText('Réponse supprimée.');
  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await expect(page.getByText('Aucune réponse ne correspond à ces filtres.')).toBeVisible();
});

test('action sur une réponse inexistante : message, pas d’erreur 500', async ({ page }) => {
  await connecter(page);
  const rep = await page.request.post('/api/admin/reponses/999999/renvoyer', { headers: { Origin: ORIGINE_SERVEUR }, form: {} });
  expect(rep.status()).toBeLessThan(500);
  await page.goto(rep.url());
  await expect(page.getByRole('alert')).toHaveText("Cette réponse n'existe plus.");
  expect((await page.request.get('/api/admin/reponses/999999/invitation.pdf')).status()).toBe(404);
  expect((await page.request.get('/admin/reponses/abc/supprimer')).status()).toBe(404);
});

test('pas de défilement horizontal de la page à 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await connecter(page);
  for (const url of ['/admin', '/admin/livre-dor', '/admin/outbox']) {
    await page.goto(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});

const violations = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

test('accessibilité WCAG AA de la connexion et des onglets', async ({ page }, info) => {
  // Un message masqué doit figurer dans le livre d'or analysé.
  const texte = `Message masqué pour l'audit ${info.project.name} ${Date.now()}`;
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Axel Audit', email: email(info, 'adm-axe'), moment: ['diner'], message: texte });

  await page.goto('/admin/connexion');
  expect(await violations(page)).toEqual([]);
  await connecter(page);
  expect(await violations(page)).toEqual([]);
  await page.goto('/admin/livre-dor');
  await page.getByRole('listitem').filter({ hasText: texte }).getByRole('button', { name: 'Masquer' }).click();
  await expect(page.getByRole('status')).toHaveText('Message masqué.');
  await expect(page.getByRole('listitem').filter({ hasText: texte })).toContainText('· masqué');
  expect(await violations(page)).toEqual([]);
  // Nettoyage : le message ne gêne pas les autres tests.
  await page.getByRole('listitem').filter({ hasText: texte }).getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toHaveText('Message supprimé.');
  await page.goto('/admin/outbox');
  expect(await violations(page)).toEqual([]);
});

test('livre d’or : masquer, réafficher, supprimer (la réponse reste)', async ({ page }, info) => {
  const adr = email(info, 'adm-livre');
  const texte = `Message de modération ${info.project.name} ${Date.now()}`;
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Lou Livre', email: adr, moment: ['diner'], message: texte });
  await page.goto('/fr/rsvp');
  await expect(page.getByText(texte)).toBeVisible();

  await connecter(page);
  await page.goto('/admin/livre-dor');
  const carte = page.getByRole('listitem').filter({ hasText: texte });
  await carte.getByRole('button', { name: 'Masquer' }).click();
  await expect(page.getByRole('status')).toHaveText('Message masqué.');
  await page.goto('/fr/rsvp');
  await expect(page.getByText(texte)).toHaveCount(0);

  await page.goto('/admin/livre-dor');
  await page.getByRole('listitem').filter({ hasText: texte }).getByRole('button', { name: 'Afficher' }).click();
  await page.goto('/fr/rsvp');
  await expect(page.getByText(texte)).toBeVisible();

  await page.goto('/admin/livre-dor');
  await page.getByRole('listitem').filter({ hasText: texte }).getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toHaveText('Message supprimé.');
  await expect(page.getByText(texte)).toHaveCount(0);
  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await expect(page.getByRole('row').nth(1)).toContainText('Lou Livre');
});

test('boîte d’envoi de test : liste et lecture d’un e-mail', async ({ page }, info) => {
  const adr = email(info, 'adm-outbox');
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Max Outbox', email: adr, moment: ['diner'] });
  await connecter(page);
  await page.getByRole('link', { name: 'Boîte d’envoi (test)' }).click();
  const ligne = page.getByRole('row').filter({ hasText: adr });
  await expect(ligne).toHaveCount(1);
  const href = await ligne.getByRole('link', { name: 'Voir l’e-mail' }).getAttribute('href');
  const rep = await page.request.get(href!);
  expect(rep.headers()['content-type']).toContain('text/html');
  expect(rep.headers()['content-security-policy']).toContain('sandbox');
  expect(await rep.text()).toContain('Max');
  expect((await page.request.get('/api/admin/outbox/..%2F/message.html')).status()).toBe(404);
});
