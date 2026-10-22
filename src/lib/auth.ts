import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Db } from './db';

export const NOM_COOKIE = 'admin_session';
export const DUREE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_ECHECS = 5;
const FENETRE_MS = 15 * 60 * 1000;
const CONSERVATION_MS = 24 * 60 * 60 * 1000;

export type ConfigAdmin =
  | { ok: true; motDePasse: string; secret: string }
  | { ok: false; probleme: string };

export function configAdmin(env: Record<string, string | undefined> = process.env): ConfigAdmin {
  const motDePasse = env.ADMIN_PASSWORD;
  if (!motDePasse) {
    return { ok: false, probleme: "ADMIN_PASSWORD n'est pas défini : l'espace organisateur est désactivé." };
  }
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return { ok: false, probleme: 'SESSION_SECRET doit contenir au moins 32 caractères.' };
  }
  return { ok: true, motDePasse, secret };
}

const empreinte = (s: string) => createHash('sha256').update(s).digest();

// Comparaison en temps constant sur les empreintes (longueurs égales).
export function motDePasseCorrect(saisi: string, attendu: string): boolean {
  return timingSafeEqual(empreinte(saisi), empreinte(attendu));
}

// Clé de signature liée au secret ET au mot de passe : changer l'un déconnecte tout le monde.
export function cleSession(cfg: { motDePasse: string; secret: string }): string {
  return createHash('sha256').update(cfg.secret + '\0' + cfg.motDePasse).digest('hex');
}

const signer = (secret: string, expiration: string) =>
  createHmac('sha256', secret).update(expiration).digest('base64url');

export function creerSession(secret: string, maintenant: Date): string {
  const expiration = maintenant.getTime() + DUREE_SESSION_MS;
  return `${expiration}.${signer(secret, String(expiration))}`;
}

export function sessionValide(valeur: string | undefined, secret: string, maintenant: Date): boolean {
  if (!valeur || !/^\d+\.[A-Za-z0-9_-]+$/.test(valeur)) return false;
  const [exp, sig] = valeur.split('.');
  const attendue = Buffer.from(signer(secret, exp));
  const recue = Buffer.from(sig);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return false;
  const expiration = Number(exp);
  const t = maintenant.getTime();
  return t < expiration && expiration <= t + DUREE_SESSION_MS;
}

export async function tenterConnexion(
  saisi: string,
  ip: string,
  cfg: { motDePasse: string },
  db: Db,
  maintenant: Date,
): Promise<'ok' | 'refuse' | 'bloque'> {
  const cle = 'login:' + ip;
  await db.purgerTentatives(new Date(maintenant.getTime() - CONSERVATION_MS));
  const echecs = await db.compterTentatives(cle, new Date(maintenant.getTime() - FENETRE_MS));
  if (echecs >= MAX_ECHECS) {
    await db.ajouterTentative(cle, maintenant);
    return 'bloque';
  }
  if (motDePasseCorrect(saisi, cfg.motDePasse)) return 'ok';
  await db.ajouterTentative(cle, maintenant);
  return 'refuse';
}
