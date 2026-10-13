import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export type Lang = 'fr' | 'en';
export type Localized = { fr: string; en?: string };

const L = z
  .union([z.string(), z.object({ fr: z.string(), en: z.string().optional() })])
  .transform((v): Localized => (typeof v === 'string' ? { fr: v } : v));
const Photo = z.string().regex(/^photos\/[^/]+\.(jpe?g|png|webp)$/i, 'doit être de la forme photos/nom.jpg');
const Couleur = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'couleur au format #rrggbb');
const Id = z.string().regex(/^[a-z0-9-]+$/, 'minuscules, chiffres et tirets uniquement');

const schema = z.object({
  site: z.object({
    titre: L,
    url_publique: z.url(),
    contact: z.object({ nom: z.string(), email: z.email(), telephone: z.string().optional() }),
  }),
  theme: z
    .object({
      couleurs: z.object({ principale: Couleur, fond: Couleur, texte: Couleur, douce: Couleur }).partial().prefault({}),
      polices: z.object({ titres: z.string(), texte: z.string() }).partial().prefault({}),
    })
    .prefault({}),
  evenement: z.object({
    date_debut: z.iso.datetime({ offset: true }),
    date_limite_rsvp: z.iso.date(),
    lieu_court: L,
  }),
  accueil: z.object({
    accroche: L,
    photo_principale: Photo,
    photo_secondaire: Photo.optional(),
    legende_photo: L.optional(),
  }),
  histoire: z.object({
    intro: L,
    chapitres: z
      .array(z.object({ annee: z.string(), titre: L, texte: L, photo: Photo.optional(), legende: L.optional() }))
      .default([]),
  }),
  galerie: z.array(z.object({ photo: Photo, legende: L.optional() })).default([]),
  lieux: z
    .array(z.object({ id: Id, nom: z.string(), adresse: z.string(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
    .min(1),
  moments: z
    .array(
      z.object({
        id: Id,
        heure: z.string().regex(/^\d{2}:\d{2}$/, 'heure au format HH:MM'),
        jour: L.optional(),
        titre: L,
        description: L.optional(),
        lieu: z.string(),
        photo: Photo.optional(),
      }),
    )
    .min(1),
  infos: z
    .object({
      hebergements: z
        .array(
          z.object({
            nom: z.string(),
            etiquette: L.optional(),
            distance: z.string().optional(),
            prix: z.string().optional(),
            lien: z.url().optional(),
            photo: Photo.optional(),
            lat: z.number().optional(),
            lng: z.number().optional(),
          }),
        )
        .default([]),
      tenue: z.object({ texte: L, couleurs: z.array(Couleur).default([]) }).optional(),
      cadeaux: z.object({ texte: L, lien_cagnotte: z.url().optional() }).optional(),
      acces: z.object({ texte: L }).optional(),
      faq: z.array(z.object({ question: L, reponse: L })).default([]),
    })
    .prefault({}),
  rsvp: z.object({ titre: L, message_merci: L }),
  email: z.object({ expediteur_nom: z.string(), objet: L }),
});

export type EventConfig = z.output<typeof schema>;

export class EventConfigError extends Error {
  constructor(public problems: string[]) {
    super('Configuration de l’événement invalide :\n- ' + problems.join('\n- '));
    this.name = 'EventConfigError';
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, k) => (typeof k === 'number' ? `${acc}[${k}]` : acc ? `${acc}.${String(k)}` : String(k)), '');
}

function photoFields(ev: EventConfig): [string, string][] {
  const out: [string, string][] = [['accueil.photo_principale', ev.accueil.photo_principale]];
  if (ev.accueil.photo_secondaire) out.push(['accueil.photo_secondaire', ev.accueil.photo_secondaire]);
  ev.histoire.chapitres.forEach((c, i) => c.photo && out.push([`histoire.chapitres[${i}].photo`, c.photo]));
  ev.galerie.forEach((g, i) => out.push([`galerie[${i}].photo`, g.photo]));
  ev.moments.forEach((m, i) => m.photo && out.push([`moments[${i}].photo`, m.photo]));
  ev.infos.hebergements.forEach((h, i) => h.photo && out.push([`infos.hebergements[${i}].photo`, h.photo]));
  return out;
}

function duplicates<T extends { id: string }>(items: T[], field: string): string[] {
  const seen = new Set<string>();
  return items.flatMap((it, i) => {
    if (seen.has(it.id)) return [`${field}[${i}].id : identifiant « ${it.id} » utilisé plusieurs fois`];
    seen.add(it.id);
    return [];
  });
}

export function parseEvent(yamlText: string, photoKeys: string[]): EventConfig {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (e) {
    throw new EventConfigError([`YAML invalide : ${(e as Error).message}`]);
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    throw new EventConfigError(res.error.issues.map((i) => `${formatPath(i.path) || '(racine)'} : ${i.message}`));
  }
  const ev = res.data;
  const problems: string[] = [];
  const lieuIds = new Set(ev.lieux.map((l) => l.id));
  ev.moments.forEach((m, i) => {
    if (!lieuIds.has(m.lieu)) problems.push(`moments[${i}].lieu : le lieu « ${m.lieu} » n’existe pas dans « lieux »`);
  });
  problems.push(...duplicates(ev.lieux, 'lieux'), ...duplicates(ev.moments, 'moments'));
  const keys = new Set(photoKeys.map((k) => k.toLowerCase()));
  for (const [field, p] of photoFields(ev)) {
    if (!keys.has(p.toLowerCase())) problems.push(`${field} : fichier introuvable evenement/${p}`);
  }
  if (new Date(ev.evenement.date_limite_rsvp + 'T23:59:59') >= new Date(ev.evenement.date_debut)) {
    problems.push('evenement.date_limite_rsvp : doit précéder evenement.date_debut');
  }
  if (problems.length) throw new EventConfigError(problems);
  return ev;
}

export function t(text: Localized | undefined, lang: Lang): string {
  if (!text) return '';
  return (lang === 'en' && text.en) || text.fr;
}

export function findLieu(ev: EventConfig, id: string) {
  const lieu = ev.lieux.find((l) => l.id === id);
  if (!lieu) throw new Error(`Lieu inconnu : ${id}`);
  return lieu;
}
