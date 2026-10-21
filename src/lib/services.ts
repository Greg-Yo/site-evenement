import { getDb } from './db';
import { getEvent } from './load-event';
import { getExpediteur } from './mail/index';
import { genererInvitation } from './pdf/invitation';
import { photoJpeg, polices } from './pdf/ressources';
import { limiteDepuisEnv, type Deps } from './rsvp-service';

let limiteAvertie = false;

function maintenantTest(): Date {
  const v = process.env.MAINTENANT_TEST;
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : new Date();
}

export async function getDeps(): Promise<Deps> {
  const ev = getEvent();
  const brut = process.env.RSVP_LIMITE;
  const limite = limiteDepuisEnv(brut);
  if (brut !== undefined && brut !== '' && String(limite) !== brut && !limiteAvertie) {
    limiteAvertie = true;
    console.warn(`RSVP_LIMITE invalide (« ${brut} ») : valeur par défaut ${limite} utilisée.`);
  }
  const urlBase = ev.site.url_publique.replace(/\/+$/, '');
  return {
    db: await getDb(),
    // Créé au moment de l'envoi : une configuration d'e-mail incomplète ne doit pas empêcher d'afficher les pages,
    // elle fait seulement échouer l'envoi (réponse enregistrée, « l'e-mail arrivera plus tard »).
    expediteur: { envoyer: (m) => getExpediteur(ev.email.expediteur_nom).envoyer(m) },
    ev,
    // MAINTENANT_TEST fige l'horloge pour les tests de bout en bout (sinon liés à la date réelle et à la date limite).
    maintenant: maintenantTest,
    urlBase,
    limite,
    invitationPdf: async (r) => genererInvitation({
      ev, reponse: r, photo: await photoJpeg(ev.accueil.photo_principale), polices: polices(), urlQr: `${urlBase}/${r.langue}/programme`,
    }),
  };
}
