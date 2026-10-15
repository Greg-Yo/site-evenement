import { getDb } from './db';
import { getEvent } from './load-event';
import { getExpediteur } from './mail/index';
import { genererInvitation } from './pdf/invitation';
import { photoJpeg, polices } from './pdf/ressources';
import type { Deps } from './rsvp-service';

export async function getDeps(): Promise<Deps> {
  const ev = getEvent();
  const urlBase = ev.site.url_publique.replace(/\/+$/, '');
  return {
    db: await getDb(),
    // Créé au moment de l'envoi : une configuration d'e-mail incomplète ne doit pas empêcher d'afficher les pages,
    // elle fait seulement échouer l'envoi (réponse enregistrée, « l'e-mail arrivera plus tard »).
    expediteur: { envoyer: (m) => getExpediteur(ev.email.expediteur_nom).envoyer(m) },
    ev,
    // MAINTENANT_TEST fige l'horloge pour les tests de bout en bout (sinon liés à la date réelle et à la date limite).
    maintenant: () => (process.env.MAINTENANT_TEST ? new Date(process.env.MAINTENANT_TEST) : new Date()),
    urlBase,
    limite: Number(process.env.RSVP_LIMITE || 5),
    invitationPdf: async (r) => genererInvitation({
      ev, reponse: r, photo: await photoJpeg(ev.accueil.photo_principale), polices: polices(), urlQr: `${urlBase}/${r.langue}/programme`,
    }),
  };
}
