import type { APIRoute } from 'astro';
import { lireFichierOutbox } from '../../../../../lib/mail/lire-outbox';
import { outboxActive } from '../../../../../lib/mail/index';

// Fichiers de la boîte d'envoi de test. La session est vérifiée par le middleware.
export const GET: APIRoute = ({ params }) => {
  const introuvable = () => new Response('Introuvable', { status: 404 });
  if (!outboxActive()) return introuvable();
  const racine = process.env.OUTBOX_DIR || '.data/outbox';
  const f = lireFichierOutbox(racine, params.dossier ?? '', params.fichier ?? '');
  if (!f) return introuvable();
  const headers: Record<string, string> = { 'Content-Type': f.type, 'X-Content-Type-Options': 'nosniff' };
  if (f.type.startsWith('text/html')) headers['Content-Security-Policy'] = 'sandbox';
  else headers['Content-Disposition'] = 'inline';
  return new Response(new Uint8Array(f.contenu), { headers });
};
