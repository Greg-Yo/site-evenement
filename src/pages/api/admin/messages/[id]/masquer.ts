import type { APIRoute } from 'astro';
import { idDepuisParam } from '../../../../../lib/admin/reponses';
import { getDeps } from '../../../../../lib/services';

export const POST: APIRoute = async (ctx) => {
  const id = idDepuisParam(ctx.params.id);
  const masque = (await ctx.request.formData()).get('masque') === '1';
  const trouve = id !== null && (await (await getDeps()).db.masquerMessage(id, masque));
  const code = !trouve ? 'introuvable' : masque ? 'masque' : 'affiche';
  return ctx.redirect(`/admin/livre-dor?ok=${code}`, 303);
};
