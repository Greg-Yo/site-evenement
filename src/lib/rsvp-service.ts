import { ErreurDoublon, type Db, type Reponse } from './db';
import type { EventConfig, Lang } from './event';
import { depasseLimite } from './limites';
import { emailConfirmation, emailLienModification, emailRegrets, type Liens } from './mail/templates';
import type { Expediteur } from './mail/types';
import { rsvpOuvert, valider, type ChampsRsvp, type ErreursRsvp } from './rsvp';

export type Deps = {
  db: Db; expediteur: Expediteur; ev: EventConfig; maintenant: () => Date; urlBase: string;
  invitationPdf: (r: Reponse) => Promise<Uint8Array>; limite: number;
};
export type Resultat =
  | { type: 'ok'; reponse: Reponse; emailEnvoye: boolean }
  | { type: 'doublon' } | { type: 'ferme' } | { type: 'limite' } | { type: 'ignore' } | { type: 'introuvable' }
  | { type: 'invalide'; erreurs: ErreursRsvp };

const FENETRE = 10 * 60 * 1000;

export function liens(r: Reponse, urlBase: string): Liens {
  return {
    programme: `${urlBase}/${r.langue}/programme`,
    modifier: `${urlBase}/${r.langue}/rsvp/modifier?jeton=${encodeURIComponent(r.jeton)}`,
  };
}

export function nomFichierInvitation(nom: string): string {
  const propre = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Invitation-${propre || 'invite'}.pdf`;
}

async function envoyerConfirmation(r: Reponse, deps: Deps): Promise<boolean> {
  try {
    const l = liens(r, deps.urlBase);
    if (r.vient) {
      const c = emailConfirmation(deps.ev, r, l);
      const pdf = await deps.invitationPdf(r);
      await deps.expediteur.envoyer({ a: r.email, ...c, piecesJointes: [{ nom: nomFichierInvitation(r.nom), contenu: pdf, type: 'application/pdf' }] });
    } else {
      await deps.expediteur.envoyer({ a: r.email, ...emailRegrets(deps.ev, r, l) });
    }
    await deps.db.marquerEmailEnvoye(r.id, true);
    return true;
  } catch (e) {
    console.error('Envoi de la confirmation impossible :', e);
    await deps.db.marquerEmailEnvoye(r.id, false);
    return false;
  }
}

async function renvoyerLien(email: string, deps: Deps): Promise<void> {
  const r = await deps.db.parEmail(email);
  if (!r) return;
  try {
    await deps.expediteur.envoyer({ a: r.email, ...emailLienModification(deps.ev, r, liens(r, deps.urlBase)) });
  } catch (e) {
    console.error('Envoi du lien de modification impossible :', e);
  }
}

export async function soumettre(champs: ChampsRsvp, langue: Lang, ip: string, deps: Deps): Promise<Resultat> {
  if (champs.piege) return { type: 'ignore' };
  const maintenant = deps.maintenant();
  if (!rsvpOuvert(deps.ev.evenement, maintenant)) return { type: 'ferme' };
  if (await depasseLimite(deps.db, `rsvp:${ip}`, deps.limite, FENETRE, maintenant)) return { type: 'limite' };
  const v = valider(champs, deps.ev.moments.map((m) => m.id), langue);
  if (!v.ok) return { type: 'invalide', erreurs: v.erreurs };
  let reponse: Reponse;
  try {
    reponse = await deps.db.ajouter(v.data, maintenant);
  } catch (e) {
    if (!(e instanceof ErreurDoublon)) throw e;
    await renvoyerLien(v.data.email, deps);
    return { type: 'doublon' };
  }
  return { type: 'ok', reponse, emailEnvoye: await envoyerConfirmation(reponse, deps) };
}

export async function modifier(jeton: string, champs: ChampsRsvp, langue: Lang, deps: Deps): Promise<Resultat> {
  const existante = await deps.db.parJeton(jeton);
  if (!existante) return { type: 'introuvable' };
  const maintenant = deps.maintenant();
  if (!rsvpOuvert(deps.ev.evenement, maintenant)) return { type: 'ferme' };
  const v = valider({ ...champs, email: existante.email }, deps.ev.moments.map((m) => m.id), langue);
  if (!v.ok) return { type: 'invalide', erreurs: v.erreurs };
  const { email: _ignore, ...sansEmail } = v.data;
  const reponse = (await deps.db.modifier(jeton, sansEmail, maintenant))!;
  return { type: 'ok', reponse, emailEnvoye: await envoyerConfirmation(reponse, deps) };
}
