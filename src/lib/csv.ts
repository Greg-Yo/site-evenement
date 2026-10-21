import type { Reponse } from './db';
import type { EventConfig } from './event';
import { horodatageLocal, nombrePersonnes } from './rsvp';

/** Une cellule CSV : neutralise les formules, puis entoure de guillemets si nécessaire. */
export function celluleCsv(v: string): string {
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

export function exporterCsv(reponses: Reponse[], ev: EventConfig): string {
  const entete = ['Nom', 'E-mail', 'Téléphone', 'Langue', 'Présence', 'Personnes', 'Accompagnants', ...ev.moments.map((m) => m.titre.fr), 'Message', 'Date'];
  const lignes = [...reponses]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
    .map((r) => [
      r.nom, r.email, r.telephone ?? '', r.langue, r.vient ? 'oui' : 'non', String(nombrePersonnes(r)), r.accompagnants.join(', '),
      ...ev.moments.map((m) => (r.moments.includes(m.id) ? 'oui' : 'non')),
      r.message ?? '', horodatageLocal(r.creeLe, ev.evenement.date_debut),
    ]);
  return '\uFEFF' + [entete, ...lignes].map((l) => l.map(celluleCsv).join(';') + '\r\n').join('');
}
