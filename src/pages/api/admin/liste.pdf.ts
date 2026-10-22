import type { APIRoute } from 'astro';
import { genererListe } from '../../../lib/pdf/liste';
import { polices } from '../../../lib/pdf/ressources';
import { getDeps } from '../../../lib/services';

// Invités confirmés, à imprimer pour l'accueil. La session est vérifiée par le middleware.
export const GET: APIRoute = async () => {
  const deps = await getDeps();
  const pdf = await genererListe({ ev: deps.ev, reponses: await deps.db.toutes(), polices: polices(), maintenant: deps.maintenant() });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="liste-des-confirmes.pdf"',
    },
  });
};
