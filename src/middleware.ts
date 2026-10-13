import { defineMiddleware } from 'astro:middleware';
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

  const first = ctx.url.pathname.split('/')[1];
  if (/^[a-z]{2}$/.test(first) && !isLang(first)) return ctx.redirect('/', 302);
  if (isLang(first)) {
    ctx.locals.lang = first;
    ctx.cookies.set('lang', first, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  return next();
});
