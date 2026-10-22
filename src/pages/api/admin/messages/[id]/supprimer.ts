import type { APIRoute } from 'astro';
import { idDepuisParam } from '../../../../../lib/admin/reponses';
import { getDeps } from '../../../../../lib/services';

export const POST: APIRoute = async (ctx) => {
  const id = idDepuisParam(ctx.params.id);
  const trouve = id !== null && (await (await getDeps()).db.supprimerMessage(id));
  return ctx.redirect(`/admin/livre-dor?ok=${trouve ? 'message_supprime' : 'introuvable'}`, 303);
};
