import type { Reponse } from '../db';
import { nombrePersonnes } from '../rsvp';

export type Statistiques = { reponses: number; foyers: number; personnes: number; refus: number; parMoment: Record<string, number> };
export type Filtres = { q: string; presence: 'tous' | 'oui' | 'non'; moment: string };

export function statistiques(reponses: Reponse[], momentIds: string[]): Statistiques {
  const parMoment: Record<string, number> = Object.fromEntries(momentIds.map((id) => [id, 0]));
  let foyers = 0, personnes = 0, refus = 0;
  for (const r of reponses) {
    if (!r.vient) { refus++; continue; }
    foyers++;
    const n = nombrePersonnes(r);
    personnes += n;
    for (const m of r.moments) if (m in parMoment) parMoment[m] += n;
  }
  return { reponses: reponses.length, foyers, personnes, refus, parMoment };
}

export function lireFiltres(params: URLSearchParams, momentIds: string[]): Filtres {
  const presence = params.get('presence');
  const moment = params.get('moment') ?? '';
  return {
    q: (params.get('q') ?? '').trim(),
    presence: presence === 'oui' || presence === 'non' ? presence : 'tous',
    moment: momentIds.includes(moment) ? moment : '',
  };
}

// Minuscules, sans accents, sans espaces autour.
function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function filtrer(reponses: Reponse[], f: Filtres): Reponse[] {
  const q = normaliser(f.q);
  return reponses.filter((r) => {
    if (q && !normaliser(r.nom).includes(q) && !normaliser(r.email).includes(q)) return false;
    if (f.presence === 'oui' && !r.vient) return false;
    if (f.presence === 'non' && r.vient) return false;
    if (f.moment && !r.moments.includes(f.moment)) return false;
    return true;
  });
}

/** Abréviations uniques des titres : allongées tant qu'elles se confondent, numérotées si les titres sont identiques. */
export function abreviations(moments: { id: string; titre: string }[], longueurMin: number): Record<string, string> {
  const titres = moments.map((m) => Array.from(m.titre));
  const longueurs = moments.map(() => longueurMin);
  const abr = (i: number) => titres[i].slice(0, longueurs[i]).join('');
  const conflits = () => {
    const parAbr = new Map<string, number[]>();
    moments.forEach((_, i) => parAbr.set(abr(i), [...(parAbr.get(abr(i)) ?? []), i]));
    return [...parAbr.values()].filter((g) => g.length > 1);
  };
  for (let allonge = true; allonge; ) {
    allonge = false;
    for (const i of conflits().flat()) {
      if (longueurs[i] < titres[i].length) { longueurs[i]++; allonge = true; }
    }
  }
  const res: Record<string, string> = Object.fromEntries(moments.map((m, i) => [m.id, abr(i)]));
  // Titres identiques en entier : seule la numérotation les distingue.
  for (const g of conflits()) g.forEach((i, n) => { res[moments[i].id] = `${abr(i)} ${n + 1}`; });
  return res;
}

/** Identifiant d'une route : entier strictement positif écrit en chiffres, sinon null. */
export function idDepuisParam(v: string | undefined): number | null {
  if (!v || !/^[1-9][0-9]*$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

const FLASH: Record<string, { texte: string; type: 'ok' | 'erreur' }> = {
  renvoye: { texte: 'E-mail renvoyé.', type: 'ok' },
  echec_envoi: { texte: "L'e-mail n'a pas pu être envoyé. Réessayez plus tard.", type: 'erreur' },
  modifie: { texte: "Réponse modifiée. Renvoyez l'e-mail si l'invité doit recevoir la nouvelle invitation.", type: 'ok' },
  supprime: { texte: 'Réponse supprimée.', type: 'ok' },
  introuvable: { texte: "Cette réponse n'existe plus.", type: 'erreur' },
  masque: { texte: 'Message masqué.', type: 'ok' },
  affiche: { texte: 'Message affiché.', type: 'ok' },
  message_supprime: { texte: 'Message supprimé.', type: 'ok' },
};

/** Message de retour d'une action (`?ok=<code>`) ; code inconnu : rien. */
export function messageFlash(code: string | null): { texte: string; type: 'ok' | 'erreur' } | null {
  return code !== null && Object.hasOwn(FLASH, code) ? FLASH[code] : null;
}
