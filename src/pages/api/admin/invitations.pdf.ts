import type { APIRoute } from 'astro';
import { genererInvitations } from '../../../lib/pdf/invitation';
import { confirmesParNom } from '../../../lib/pdf/liste';
import { photoJpeg, polices } from '../../../lib/pdf/ressources';
import { getDeps } from '../../../lib/services';

// Une invitation par invité qui vient, dans l'ordre de la liste. La session est vérifiée par le middleware.
export const GET: APIRoute = async () => {
  const deps = await getDeps();
  const pdf = await genererInvitations({
    ev: deps.ev,
    reponses: confirmesParNom(await deps.db.toutes()),
    photo: await photoJpeg(deps.ev.accueil.photo_principale),
    polices: polices(),
    urlQr: (l) => `${deps.urlBase}/${l}/programme`,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="invitations.pdf"',
    },
  });
};
