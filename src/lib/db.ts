import { createClient, type Client, type Row } from '@libsql/client';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import type { Lang } from './event';

export type Reponse = {
  id: number; jeton: string; langue: Lang; vient: boolean; nom: string; email: string; telephone: string | null;
  accompagnants: string[]; moments: string[]; message: string | null; messageMasque: boolean; emailEnvoye: boolean;
  creeLe: string; modifieLe: string;
};
export type NouvelleReponse = Pick<Reponse, 'langue' | 'vient' | 'nom' | 'email' | 'telephone' | 'accompagnants' | 'moments' | 'message'>;

export class ErreurDoublon extends Error {
  constructor() { super('Une réponse existe déjà pour cette adresse e-mail'); this.name = 'ErreurDoublon'; }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reponses (
    id INTEGER PRIMARY KEY,
    jeton TEXT NOT NULL UNIQUE,
    langue TEXT NOT NULL,
    vient INTEGER NOT NULL,
    nom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    telephone TEXT,
    accompagnants TEXT NOT NULL DEFAULT '[]',
    moments TEXT NOT NULL DEFAULT '[]',
    message TEXT,
    message_masque INTEGER NOT NULL DEFAULT 0,
    email_envoye INTEGER NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL,
    modifie_le TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS limites (cle TEXT NOT NULL, horodatage TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS limites_cle ON limites (cle, horodatage)`,
];

function versReponse(row: Row): Reponse {
  return {
    id: Number(row.id), jeton: String(row.jeton), langue: row.langue as Lang, vient: Number(row.vient) === 1,
    nom: String(row.nom), email: String(row.email), telephone: row.telephone === null ? null : String(row.telephone),
    accompagnants: JSON.parse(String(row.accompagnants)), moments: JSON.parse(String(row.moments)),
    message: row.message === null ? null : String(row.message),
    messageMasque: Number(row.message_masque) === 1, emailEnvoye: Number(row.email_envoye) === 1,
    creeLe: String(row.cree_le), modifieLe: String(row.modifie_le),
  };
}

export class Db {
  constructor(private client: Client) {}

  async ajouter(r: NouvelleReponse, maintenant: Date): Promise<Reponse> {
    const jeton = randomBytes(32).toString('base64url');
    const quand = maintenant.toISOString();
    try {
      await this.client.execute({
        sql: `INSERT INTO reponses (jeton, langue, vient, nom, email, telephone, accompagnants, moments, message, cree_le, modifie_le)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [jeton, r.langue, r.vient ? 1 : 0, r.nom, r.email.toLowerCase(), r.telephone, JSON.stringify(r.accompagnants),
          JSON.stringify(r.moments), r.message, quand, quand],
      });
    } catch (e) {
      if (/UNIQUE constraint failed: reponses\.email/i.test(String((e as Error).message))) throw new ErreurDoublon();
      throw e;
    }
    return (await this.parJeton(jeton))!;
  }

  async parEmail(email: string): Promise<Reponse | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM reponses WHERE email = ? COLLATE NOCASE', args: [email.trim()] });
    return res.rows[0] ? versReponse(res.rows[0]) : null;
  }

  async parJeton(jeton: string): Promise<Reponse | null> {
    const res = await this.client.execute({ sql: 'SELECT * FROM reponses WHERE jeton = ?', args: [jeton] });
    return res.rows[0] ? versReponse(res.rows[0]) : null;
  }

  async modifier(jeton: string, r: Omit<NouvelleReponse, 'email'>, maintenant: Date): Promise<Reponse | null> {
    const res = await this.client.execute({
      sql: `UPDATE reponses SET langue = ?, vient = ?, nom = ?, telephone = ?, accompagnants = ?, moments = ?, message = ?, modifie_le = ?
            WHERE jeton = ?`,
      args: [r.langue, r.vient ? 1 : 0, r.nom, r.telephone, JSON.stringify(r.accompagnants), JSON.stringify(r.moments), r.message,
        maintenant.toISOString(), jeton],
    });
    return res.rowsAffected ? this.parJeton(jeton) : null;
  }

  async marquerEmailEnvoye(id: number, envoye: boolean): Promise<void> {
    await this.client.execute({ sql: 'UPDATE reponses SET email_envoye = ? WHERE id = ?', args: [envoye ? 1 : 0, id] });
  }

  async messagesVisibles(limite: number): Promise<{ nom: string; message: string; creeLe: string }[]> {
    const res = await this.client.execute({
      sql: `SELECT nom, message, cree_le FROM reponses
            WHERE message IS NOT NULL AND message <> '' AND message_masque = 0
            ORDER BY cree_le DESC, id DESC LIMIT ?`,
      args: [limite],
    });
    return res.rows.map((r) => ({ nom: String(r.nom), message: String(r.message), creeLe: String(r.cree_le) }));
  }

  async ajouterTentative(cle: string, maintenant: Date): Promise<void> {
    await this.client.execute({ sql: 'INSERT INTO limites (cle, horodatage) VALUES (?, ?)', args: [cle, maintenant.toISOString()] });
  }

  async compterTentatives(cle: string, depuis: Date): Promise<number> {
    const res = await this.client.execute({
      sql: 'SELECT COUNT(*) AS n FROM limites WHERE cle = ? AND horodatage > ?',
      args: [cle, depuis.toISOString()],
    });
    return Number(res.rows[0].n);
  }

  async purgerTentatives(avant: Date): Promise<void> {
    await this.client.execute({ sql: 'DELETE FROM limites WHERE horodatage < ?', args: [avant.toISOString()] });
  }
}

export async function openDb(url: string, authToken?: string): Promise<Db> {
  if (url.startsWith('file:')) {
    const chemin = url.slice('file:'.length);
    const dossier = chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '';
    if (dossier) mkdirSync(dossier, { recursive: true });
  }
  const client = createClient({ url, authToken });
  for (const sql of SCHEMA) await client.execute(sql);
  return new Db(client);
}

let instance: Promise<Db> | undefined;

export function getDb(): Promise<Db> {
  instance ??= openDb(process.env.DATABASE_URL || 'file:.data/local.db', process.env.DATABASE_TOKEN || undefined)
    .catch((e) => { instance = undefined; throw e; });
  return instance;
}
