import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Expediteur, Message } from './types';

const horodatage = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '-').slice(0, 19);
const nomFichier = (n: string) => n.replace(/[\\/]/g, '_');

// Compteur partagé par toutes les boîtes d'envoi du processus : getExpediteur() en crée une par envoi.
let compteur = 0;

export function creerOutbox(dossier: string, maintenant: () => Date = () => new Date()): Expediteur {
  return {
    async envoyer(m: Message) {
      const date = maintenant();
      const d = join(dossier, `${horodatage(date)}-${++compteur}`);
      mkdirSync(d, { recursive: true });
      const pj = m.piecesJointes ?? [];
      writeFileSync(join(d, 'message.html'), m.html);
      writeFileSync(join(d, 'message.txt'), m.texte);
      for (const p of pj) writeFileSync(join(d, nomFichier(p.nom)), p.contenu);
      // meta.json en dernier : sa présence signale un e-mail complet.
      writeFileSync(join(d, 'meta.json'), JSON.stringify({ a: m.a, sujet: m.sujet, date: date.toISOString(), piecesJointes: pj.map((p) => nomFichier(p.nom)) }, null, 2));
    },
  };
}
