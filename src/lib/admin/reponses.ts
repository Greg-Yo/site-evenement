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
