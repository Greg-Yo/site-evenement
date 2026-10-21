import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = '.data/test-outbox';

export function messagesEnvoyesA(email: string) {
  if (!existsSync(DOSSIER)) return [];
  return readdirSync(DOSSIER).sort().filter((nom) => existsSync(join(DOSSIER, nom, 'meta.json'))).map((nom) => {
    const dossier = join(DOSSIER, nom);
    return { dossier, meta: JSON.parse(readFileSync(join(dossier, 'meta.json'), 'utf8')), html: readFileSync(join(dossier, 'message.html'), 'utf8') };
  }).filter((m) => m.meta.a === email.toLowerCase());
}
