import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseEvent } from '../../src/lib/event';

test('le contenu d’exemple est valide', () => {
  const yaml = readFileSync('evenement/evenement.yaml', 'utf8');
  const photos = readdirSync('evenement/photos').map((f) => `photos/${f}`);
  const ev = parseEvent(yaml, photos);
  expect(ev.moments.map((m) => m.id)).toEqual(['accueil', 'diner', 'soiree', 'brunch']);
  expect(ev.infos.hebergements).toHaveLength(3);
});
