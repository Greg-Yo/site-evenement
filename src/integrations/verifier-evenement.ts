import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AstroIntegration } from 'astro';
import { EventConfigError, parseEvent } from '../lib/event';

// Mêmes extensions que src/lib/photos.ts, lues sur le disque (pas d'import.meta.glob ici).
const EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export function verifierEvenement(racine = 'evenement'): string[] {
  try {
    const yaml = readFileSync(join(racine, 'evenement.yaml'), 'utf8');
    const photos = readdirSync(join(racine, 'photos'))
      .filter((f) => EXTENSIONS.test(f))
      .map((f) => `photos/${f}`);
    parseEvent(yaml, photos);
    return [];
  } catch (e) {
    if (e instanceof EventConfigError) return e.problems;
    throw e;
  }
}

export function verifierEvenementIntegration(): AstroIntegration {
  return {
    name: 'verifier-evenement',
    hooks: {
      'astro:config:setup': ({ command, logger }) => {
        const problemes = verifierEvenement();
        if (!problemes.length) return;
        if (command === 'build') throw new Error('Contenu de l’événement invalide :\n- ' + problemes.join('\n- '));
        // En développement, la page d'erreur du middleware reste visible.
        for (const p of problemes) logger.warn(p);
      },
    },
  };
}
