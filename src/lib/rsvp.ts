import type { NouvelleReponse } from './db';
import type { EventConfig, Lang } from './event';
import type { UiKey } from './i18n';

export type ChampsRsvp = {
  vient: boolean | null; nom: string; email: string; telephone: string;
  accompagnants: string[]; moments: string[]; message: string; piege: string;
};
export type ErreursRsvp = Partial<Record<'vient' | 'nom' | 'email' | 'telephone' | 'accompagnants' | 'moments' | 'message', UiKey>>;

export const CHAMPS_VIDES: ChampsRsvp = { vient: null, nom: '', email: '', telephone: '', accompagnants: [], moments: [], message: '', piege: '' };

const texte = (fd: FormData, nom: string) => String(fd.get(nom) ?? '').trim();
const liste = (fd: FormData, nom: string) => fd.getAll(nom).map((v) => String(v).trim()).filter(Boolean);

export function lireFormulaire(fd: FormData): ChampsRsvp {
  const vient = texte(fd, 'vient');
  return {
    vient: vient === 'oui' ? true : vient === 'non' ? false : null,
    nom: texte(fd, 'nom'),
    email: texte(fd, 'email').toLowerCase(),
    telephone: texte(fd, 'telephone'),
    accompagnants: liste(fd, 'accompagnant'),
    moments: liste(fd, 'moment'),
    message: texte(fd, 'message'),
    piege: texte(fd, 'ne_pas_remplir'),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function valider(c: ChampsRsvp, momentIds: string[], langue: Lang):
  { ok: true; data: NouvelleReponse } | { ok: false; erreurs: ErreursRsvp } {
  const erreurs: ErreursRsvp = {};
  const email = c.email.trim().toLowerCase();
  if (c.vient === null) erreurs.vient = 'rsvp.err.vient';
  if (c.nom.length < 2 || c.nom.length > 100) erreurs.nom = 'rsvp.err.nom';
  if (email.length > 254 || !EMAIL.test(email)) erreurs.email = 'rsvp.err.email';
  if (c.telephone.length > 30) erreurs.telephone = 'rsvp.err.telephone';
  if (c.message.length > 1000) erreurs.message = 'rsvp.err.message';
  if (c.vient) {
    if (c.accompagnants.length > 10 || c.accompagnants.some((a) => a.length > 100)) erreurs.accompagnants = 'rsvp.err.accompagnants';
    if (c.moments.length === 0 || c.moments.some((m) => !momentIds.includes(m))) erreurs.moments = 'rsvp.err.moments';
  }
  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return {
    ok: true,
    data: {
      langue, vient: c.vient!, nom: c.nom, email, telephone: c.telephone || null,
      accompagnants: c.vient ? c.accompagnants : [], moments: c.vient ? [...new Set(c.moments)] : [], message: c.message || null,
    },
  };
}

/** Date du jour (AAAA-MM-JJ) dans le fuseau de l'heure ISO donnée en référence. */
function dateLocale(maintenant: Date, isoReference: string): string {
  const m = isoReference.match(/([+-])(\d{2}):?(\d{2})$/);
  const minutes = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(maintenant.getTime() + minutes * 60_000).toISOString().slice(0, 10);
}

export function rsvpOuvert(evenement: EventConfig['evenement'], maintenant: Date): boolean {
  return dateLocale(maintenant, evenement.date_debut) <= evenement.date_limite_rsvp;
}

export function nombrePersonnes(r: { vient: boolean; accompagnants: string[] }): number {
  return r.vient ? 1 + r.accompagnants.length : 0;
}
