import type { Reponse } from '../../src/lib/db';

// Réponse complète avec des valeurs par défaut ; `partiel` écrase ce qui compte pour le test.
export function rep(partiel: Partial<Reponse> = {}): Reponse {
  return {
    id: 1, jeton: 'j', langue: 'fr', vient: true, nom: 'Invité', email: 'invite@x.fr', telephone: null, accompagnants: [], moments: [],
    message: null, messageMasque: false, emailEnvoye: true, creeLe: '2027-01-01T00:00:00.000Z', modifieLe: '2027-01-01T00:00:00.000Z',
    ...partiel,
  };
}
