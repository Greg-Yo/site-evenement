import type { APIRoute } from 'astro';
import { idDepuisParam } from '../../../../../lib/admin/reponses';
import { nomFichierInvitation } from '../../../../../lib/rsvp-service';
import { getDeps } from '../../../../../lib/services';

// Seulement pour un invité qui vient : les autres n'ont pas d'invitation.
export const GET: APIRoute = async (ctx) => {
  const id = idDepuisParam(ctx.params.id);
  const deps = await getDeps();
  const r = id === null ? null : await deps.db.parId(id);
  if (!r || !r.vient) return new Response('Introuvable', { status: 404 });
  // Copie dans un ArrayBuffer neuf : le type attendu par Response exclut les SharedArrayBuffer.
  return new Response(new Uint8Array(await deps.invitationPdf(r)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomFichierInvitation(r.nom)}"`,
    },
  });
};
