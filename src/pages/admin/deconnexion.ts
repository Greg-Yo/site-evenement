import type { APIRoute } from 'astro';
import { NOM_COOKIE } from '../../lib/auth';

export const POST: APIRoute = (ctx) => {
  ctx.cookies.delete(NOM_COOKIE, { path: '/' });
  return ctx.redirect('/admin/connexion', 303);
};
