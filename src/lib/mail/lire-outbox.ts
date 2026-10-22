import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type EntreeOutbox = { dossier: string; a: string; sujet: string; date: string; piecesJointes: string[] };

// Nom de dossier écrit par creerOutbox ; en JS, $ sans drapeau m refuse un saut de ligne final.
const DOSSIER = /^\d{8}-\d{6}-\d{3}-\d+$/;
const compteur = (d: string) => Number(d.slice(d.lastIndexOf('-') + 1));

function lireMeta(racine: string, dossier: string): EntreeOutbox | null {
  if (!DOSSIER.test(dossier)) return null;
  try {
    const m = JSON.parse(readFileSync(join(racine, dossier, 'meta.json'), 'utf8'));
    if (typeof m?.a !== 'string' || typeof m.sujet !== 'string' || typeof m.date !== 'string') return null;
    const pj = Array.isArray(m.piecesJointes) ? m.piecesJointes.filter((p: unknown): p is string => typeof p === 'string') : [];
    return { dossier, a: m.a, sujet: m.sujet, date: m.date, piecesJointes: pj };
  } catch {
    return null;
  }
}

export function listerOutbox(racine: string, limite = 100): EntreeOutbox[] {
  if (!existsSync(racine)) return [];
  const entrees: EntreeOutbox[] = [];
  for (const d of readdirSync(racine)) {
    const e = lireMeta(racine, d);
    if (e) entrees.push(e);
  }
  entrees.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : compteur(y.dossier) - compteur(x.dossier)));
  return entrees.slice(0, limite);
}

const typeDe = (nom: string) =>
  nom.endsWith('.html') ? 'text/html; charset=utf-8' : nom.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';

export function lireFichierOutbox(racine: string, dossier: string, fichier: string): { contenu: Buffer; type: string } | null {
  const meta = lireMeta(racine, dossier);
  if (!meta) return null;
  // Seuls message.html et les pièces jointes déclarées ; aucun chemin n'est construit avant ce contrôle.
  if (fichier !== 'message.html' && !meta.piecesJointes.includes(fichier)) return null;
  try {
    const chemin = join(racine, dossier, fichier);
    if (!statSync(chemin).isFile()) return null;
    return { contenu: readFileSync(chemin), type: typeDe(fichier) };
  } catch {
    return null;
  }
}
