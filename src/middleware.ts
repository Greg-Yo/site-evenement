import { defineMiddleware } from 'astro:middleware';
import { cleSession, configAdmin, NOM_COOKIE, sessionValide } from './lib/auth';
import { EventConfigError } from './lib/event';
import { isLang } from './lib/i18n';
import { getEvent } from './lib/load-event';

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const onRequest = defineMiddleware(async (ctx, next) => {
  try {
    getEvent();
  } catch (e) {
    if (!(e instanceof EventConfigError)) throw e;
    const items = e.problems.map((p) => `<li>${escape(p)}</li>`).join('');
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Configuration invalide</title>` +
        `<body style="font-family:system-ui;max-width:760px;margin:40px auto;padding:0 16px">` +
        `<h1>Le contenu de l’événement contient des erreurs</h1><p>Corrige <code>evenement/evenement.yaml</code> :</p><ul>${items}</ul>`,
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  const chemin = ctx.url.pathname;
  if (/^\/(api\/)?admin(\/|$)/.test(chemin)) {
    let reponse: Response | undefined;
    if (chemin !== '/admin/connexion') {
      const cfg = configAdmin();
      const ok = cfg.ok && sessionValide(ctx.cookies.get(NOM_COOKIE)?.value, cleSession(cfg), new Date());
      if (!ok) {
        reponse = chemin.startsWith('/api/') ? new Response('Non autorisé', { status: 401 }) : ctx.redirect('/admin/connexion', 302);
      }
    }
    reponse ??= await next();
    // Jamais en cache ni indexé, connexion comprise.
    reponse.headers.set('Cache-Control', 'no-store');
    reponse.headers.set('X-Robots-Tag', 'noindex');
    return reponse;
  }

  // Photos recalculées par sharp : le CDN de Vercel ne les garde que s'il reçoit un en-tête qui lui est destiné.
  if (/^\/_image\/?$/.test(chemin)) {
    const r = await next();
    if (!r.ok) return r;
    const cache = 'public, max-age=31536000, immutable';
    try {
      r.headers.set('Vercel-CDN-Cache-Control', cache);
      return r;
    } catch {
      // En-têtes immuables : on recopie la réponse.
      const copie = new Response(r.body, r);
      copie.headers.set('Vercel-CDN-Cache-Control', cache);
      return copie;
    }
  }

  const first = chemin.split('/')[1];
  const hitsLangPage = ctx.routePattern === '/[lang]' || ctx.routePattern.startsWith('/[lang]/');
  if (hitsLangPage && !isLang(first)) return ctx.redirect('/', 302);
  if (isLang(first)) {
    ctx.locals.lang = first;
    ctx.cookies.set('lang', first, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  return next();
});
