import type { APIRoute } from 'astro';
import { exporterCsv } from '../../../lib/csv';
import { horodatageLocal } from '../../../lib/rsvp';
import { getDeps } from '../../../lib/services';

// Toutes les réponses, sans les filtres du tableau. La session est vérifiée par le middleware.
export const GET: APIRoute = async () => {
  const deps = await getDeps();
  const [jour, mois, annee] = horodatageLocal(deps.maintenant().toISOString(), deps.ev.evenement.date_debut).slice(0, 10).split('/');
  return new Response(exporterCsv(await deps.db.toutes(), deps.ev), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reponses-${annee}-${mois}-${jour}.csv"`,
    },
  });
};
