import type { Db } from './db';

const JOUR = 24 * 60 * 60 * 1000;

/** Enregistre une tentative et indique si la clé a déjà atteint `max` tentatives dans la fenêtre. */
export async function depasseLimite(db: Db, cle: string, max: number, fenetreMs: number, maintenant: Date): Promise<boolean> {
  await db.purgerTentatives(new Date(maintenant.getTime() - JOUR));
  const n = await db.compterTentatives(cle, new Date(maintenant.getTime() - fenetreMs));
  if (n >= max) return true;
  await db.ajouterTentative(cle, maintenant);
  return false;
}
