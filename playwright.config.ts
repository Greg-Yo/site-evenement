import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Les ressources tierces (polices Google, tuiles OpenStreetMap) ne sont pas ce que l'on teste : leur lenteur ou leur
    // limitation de débit retardait l'événement « load » des navigations jusqu'à dépasser le délai du test.
    launchOptions: { args: ['--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND, MAP tile.openstreetmap.org ~NOTFOUND'] },
  },
  webServer: {
    // Le nettoyage fait partie de la commande : il a lieu une seule fois, avant que le serveur n'ouvre la base.
    command: `node scripts/reset-test-data.mjs && node node_modules/astro/bin/astro.mjs dev --port ${PORT}`,
    url: `http://localhost:${PORT}/fr/infos`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: 'file:.data/test.db', OUTBOX_DIR: '.data/test-outbox', MAIL_MODE: 'outbox', RSVP_LIMITE: '1000',
      MAINTENANT_TEST: '2027-01-15T12:00:00+01:00',
    },
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'telephone', use: { ...devices['Pixel 7'] } },
  ],
});
