import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  // Un seul worker : sur une machine à 4 cœurs, la conversion des images (sharp, /_image) sous charge parallèle dépassait les délais.
  workers: 1,
  // Une relance locale absorbe les rares délais dépassés dus à la conversion des images à la demande ; en CI, aucune.
  retries: process.env.CI ? 0 : 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Les ressources tierces (polices Google, tuiles OpenStreetMap) ne sont pas ce que l'on teste : leur lenteur ou leur
    // limitation de débit retardait l'événement « load » des navigations jusqu'à dépasser le délai du test.
    launchOptions: { args: ['--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND, MAP tile.openstreetmap.org ~NOTFOUND'] },
  },
  webServer: {
    // Le nettoyage fait partie de la commande : il a lieu une seule fois, avant que le serveur n'ouvre la base.
    // On teste la version compilée : le mode développement compile chaque page à la première requête, ce qui causait des délais dépassés.
    command: 'node scripts/reset-test-data.mjs && node node_modules/astro/bin/astro.mjs build && node dist/server/entry.mjs',
    url: `http://127.0.0.1:${PORT}/fr/rsvp`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      HOST: '127.0.0.1', PORT: String(PORT),
      DATABASE_URL: 'file:.data/test.db', OUTBOX_DIR: '.data/test-outbox', MAIL_MODE: 'outbox', RSVP_LIMITE: '1000',
      MAINTENANT_TEST: '2027-01-15T12:00:00+01:00',
      ADMIN_PASSWORD: 'mot-de-passe-de-test', SESSION_SECRET: 'secret-de-session-pour-les-tests-0123456789',
    },
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'telephone', use: { ...devices['Pixel 7'] } },
  ],
});
