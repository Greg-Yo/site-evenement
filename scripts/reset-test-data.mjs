import { rmSync } from 'node:fs';

// Repart d'une base et d'une boîte d'envoi de test vides, juste avant le démarrage du serveur de test.
for (const p of ['.data/test.db', '.data/test.db-journal', '.data/test.db-wal', '.data/test.db-shm', '.data/test-outbox']) {
  rmSync(p, { recursive: true, force: true });
}
