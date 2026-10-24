import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { verifierEvenement } from '../../src/integrations/verifier-evenement';

test('exemple fourni : aucun problème', () => expect(verifierEvenement('evenement')).toEqual([]));
test('contenu invalide : problèmes lisibles', () => {
  const d = mkdtempSync(join(tmpdir(), 'ev-'));
  mkdirSync(join(d, 'photos'));
  writeFileSync(join(d, 'evenement.yaml'), 'site: {}\n');
  expect(verifierEvenement(d).length).toBeGreaterThan(0);
});
