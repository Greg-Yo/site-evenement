import type { APIRoute } from 'astro';
import { idDepuisParam } from '../../../../../lib/admin/reponses';
import { renvoyerConfirmation } from '../../../../../lib/rsvp-service';
import { getDeps } from '../../../../../lib/services';

const CODES = { ok: 'renvoye', echec: 'echec_envoi', introuvable: 'introuvable' } as const;

export const POST: APIRoute = async (ctx) => {
  const id = idDepuisParam(ctx.params.id);
  const res = id === null ? 'introuvable' : await renvoyerConfirmation(id, await getDeps());
  return ctx.redirect(`/admin?ok=${CODES[res]}`, 303);
};
