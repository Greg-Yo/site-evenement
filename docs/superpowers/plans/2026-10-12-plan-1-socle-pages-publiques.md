# Plan 1 : socle et pages de présentation

> **Pour les exécutants :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**Objectif :** un site Astro bilingue (FR/EN) qui affiche, à partir du seul dossier `evenement/`, les pages Accueil, Notre histoire, Programme & lieux et Infos pratiques dans le style « Soleil ».

**Architecture :**
- Astro en rendu serveur. Le contenu vient de `evenement/evenement.yaml`, importé au moment de la compilation (`?raw`), puis validé par un schéma zod. Aucun accès disque à l'exécution, donc compatible Vercel.
- Les photos de `evenement/photos/` passent par `import.meta.glob` puis `astro:assets`.
- La logique pure (schéma, langue, thème, compte à rebours, itinéraires) vit dans `src/lib/` et `src/scripts/`, testée avec Vitest. Les pages Astro se contentent d'afficher.

**Pile technique :** Node 22+, Astro 7.3, @astrojs/node 11, @astrojs/vercel 11, zod 4.6, yaml 2.9, Leaflet 1.9.4, Vitest 5, Playwright + @axe-core/playwright.

**Spécification :** `docs/superpowers/specs/2026-10-12-site-evenement-design.md`. Maquettes : `docs/maquettes/01…04`.

**Découpage en 3 plans** (chacun livre un logiciel qui fonctionne et qui est testé) :
1. **Ce plan :** socle, contenu, langues, thème, pages de présentation.
2. **Plan 2 :** base de données, page RSVP & Livre d'or, e-mails, invitation PDF.
3. **Plan 3 :** admin, export CSV, PDF de la liste, mise en ligne (Vercel, Turso, Brevo ou Resend).

Le lien « RSVP & Livre d'or » de la navigation pointe dès ce plan vers `/{lang}/rsvp`, une page créée dans le plan 2.

## Contraintes globales

- Langues : `fr` et `en` uniquement. Tout texte affiché du YAML accepte `"texte"` ou `{ fr, en }` ; si `en` manque, on affiche `fr`.
- URL : `/{lang}/`, `/{lang}/histoire`, `/{lang}/programme`, `/{lang}/infos` (plan 2 : `/{lang}/rsvp`). Mêmes chemins dans les deux langues.
- Racine `/` : redirige selon le cookie `lang`, à défaut `Accept-Language`, à défaut `fr`. Visiter une page `/fr/…` ou `/en/…` enregistre le cookie `lang` (1 an).
- Couleurs par défaut : principale `#ec5e27`, fond `#fdfdf1`, texte `#3a2419`, douce `#fbd7c2`. Polices par défaut : titres `Caveat`, texte `Nunito`.
- Contraste (WCAG AA) :
  - l'orange `#ec5e27` est réservé au grand texte (24 px et plus, ou 18,66 px et plus en gras) ;
  - le petit texte orange, ou le petit texte posé sur un fond orange, utilise `--c-principale-fonce`, dérivée automatiquement pour atteindre 4,5:1 sur le fond.
- Téléphone d'abord : aucun défilement horizontal à 360 px.
- Tutoiement dans les textes d'interface d'exemple.
- Messages de commit en français, à l'impératif, sans ligne de co-auteur.

## Points de vigilance

Les cinq cas que la spécification implique sans les tester explicitement, et qui risquent le plus de gêner un utilisateur :

1. **Traduction anglaise absente** pour un texte du YAML : la page EN affiche le texte FR, sans « undefined » ni chaîne vide. Testé à la tâche 2.
2. **Photo citée dans le YAML mais absente** du dossier : le site affiche un message nommant le champ et le fichier, au lieu d'une erreur 500 opaque. Testé aux tâches 2 et 3.
3. **Compte à rebours après la date de l'événement** : aucun chiffre négatif, un message « C'est le grand jour ! » (ou équivalent) s'affiche. Testé à la tâche 7.
4. **Rubriques facultatives vides** (aucun hébergement, aucune FAQ, aucune galerie, pas de photo secondaire) : la rubrique disparaît, sans titre orphelin ni plantage. Testé aux tâches 8 et 10.
5. **Langue inconnue ou `Accept-Language` complexe** (`/de/`, `en-GB,en;q=0.9`, `*`) : `/de/` redirige vers `/`, `en-GB` donne `en`, `*` donne `fr`. Testé aux tâches 4 et 6.

---

## Structure des fichiers

```
package.json, astro.config.mjs, tsconfig.json, vitest.config.ts, playwright.config.ts, .env.example
evenement/
  evenement.yaml              # contenu d'exemple (Coco, Bordeaux)
  LISEZMOI.md                 # explication de chaque champ
  photos/*.jpg                # photos d'exemple Unsplash
src/
  env.d.ts
  lib/
    event.ts                  # schéma zod + parseEvent() + t()  (pur, testé)
    load-event.ts             # getEvent() : import ?raw + clés photos (non testé unitairement)
    photos.ts                 # glob des photos, photo(path)
    i18n.ts                   # langues, détection, textes d'interface
    theme.ts                  # contraste, couleur foncée dérivée, variables CSS
    geo.ts                    # liens Google Maps / Waze
  scripts/
    countdown.ts              # remaining() pur + montage navigateur
    lightbox.ts               # visionneuse galerie (navigateur)
    map.ts                    # carte Leaflet (navigateur)
  middleware.ts               # cookie de langue + page d'erreur de configuration
  styles/global.css
  layouts/Base.astro
  components/
    Nav.astro  Footer.astro  Wave.astro  Polaroid.astro  PageHead.astro  Countdown.astro
  pages/
    index.astro               # redirection selon langue
    [lang]/index.astro  [lang]/histoire.astro  [lang]/programme.astro  [lang]/infos.astro
tests/
  unit/event.test.ts  unit/example-event.test.ts  unit/i18n.test.ts  unit/theme.test.ts
  unit/geo.test.ts  unit/countdown.test.ts
  e2e/langue.spec.ts  e2e/pages.spec.ts  e2e/accessibilite.spec.ts
```

---

### Tâche 1 : initialiser le projet

**Fichiers :**
- Créer : `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `src/env.d.ts`, `src/pages/[lang]/index.astro` (temporaire, remplacé à la tâche 7), `tests/unit/sanity.test.ts`

**Interfaces :**
- Produit : scripts npm `dev`, `build`, `preview`, `test`, `test:e2e`. Variable `DEPLOY_TARGET` (`vercel` sinon Node).

- [ ] **Étape 1 : créer `package.json`**

```json
{
  "name": "site-evenement",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@astrojs/node": "^11.1.7",
    "@astrojs/vercel": "^11.0.14",
    "astro": "^7.3.8",
    "leaflet": "^1.9.4",
    "yaml": "^2.9.1",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@astrojs/check": "latest",
    "@axe-core/playwright": "latest",
    "@playwright/test": "latest",
    "@types/leaflet": "^1.9.0",
    "typescript": "^5.6.0",
    "vitest": "^5.0.4"
  }
}
```

- [ ] **Étape 2 : installer**

Exécuter : `npm install` puis `npx playwright install chromium`
Attendu : aucune erreur. **Si l'installation signale un conflit de versions entre `astro` et un adaptateur,** aligner sur les versions que `npm view @astrojs/node peerDependencies` indique, puis noter la version retenue dans le message de commit.

- [ ] **Étape 3 : créer `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: process.env.DEPLOY_TARGET === 'vercel' ? vercel() : node({ mode: 'standalone' }),
  server: { port: 4321 },
});
```

> Astro 7 : avant d'aller plus loin, lire le guide de migration officiel (docs.astro.build, « Upgrade to Astro v7 ») et vérifier que `output: 'server'`, `Astro.cookies`, `Astro.redirect`, `defineMiddleware`, `astro:assets` (`<Image>`) et `import.meta.glob` n'ont pas changé de nom ni de forme. En cas de changement, adapter le code de ce plan **sans changer le comportement**, et l'indiquer dans le commit.

- [ ] **Étape 4 : créer `tsconfig.json`, `src/env.d.ts`, `.env.example`**

`tsconfig.json` :
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "tests/**/*"],
  "exclude": ["dist"]
}
```

`src/env.d.ts` :
```ts
/// <reference types="astro/client" />
declare module '*.yaml?raw' {
  const content: string;
  export default content;
}
```

`.env.example` :
```
# Cible de déploiement : laisser vide en local, "vercel" en ligne
DEPLOY_TARGET=
```

- [ ] **Étape 5 : créer `vitest.config.ts` et `playwright.config.ts`**

`vitest.config.ts` :
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'] } });
```

`playwright.config.ts` :
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  webServer: { command: 'npm run dev', url: 'http://localhost:4321/fr/', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'telephone', use: { ...devices['Pixel 7'] } },
  ],
});
```

- [ ] **Étape 6 : test de fumée**

`tests/unit/sanity.test.ts` :
```ts
import { expect, test } from 'vitest';
test('vitest fonctionne', () => { expect(1 + 1).toBe(2); });
```

`src/pages/[lang]/index.astro` (temporaire) :
```astro
---
---
<h1>Site en construction</h1>
```

Exécuter : `npm test` (attendu : 1 test réussi), puis `npm run build` (attendu : build terminé sans erreur).

- [ ] **Étape 7 : commit**

```bash
git add -A
git commit -m "Initialise le projet Astro, Vitest et Playwright"
```

---

### Tâche 2 : schéma du contenu et validation

**Fichiers :**
- Créer : `src/lib/event.ts`
- Tester : `tests/unit/event.test.ts`

**Interfaces :**
- Produit :
  - `type Lang = 'fr' | 'en'` (réexporté depuis `i18n.ts` à la tâche 4 ; défini ici pour éviter une dépendance circulaire) ;
  - `type Localized = { fr: string; en?: string }` ;
  - `type EventConfig` (sortie du schéma) ;
  - `class EventConfigError extends Error { problems: string[] }` ;
  - `parseEvent(yamlText: string, photoKeys: string[]): EventConfig` ;
  - `t(text: Localized | undefined, lang: Lang): string` ;
  - `findLieu(ev: EventConfig, id: string)` → lieu.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/unit/event.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { parseEvent, t, EventConfigError } from '../../src/lib/event';

const PHOTOS = ['photos/hero.jpg', 'photos/a.jpg'];
const base = `
site:
  titre: { fr: "Coco a 40 ans", en: "Coco turns 40" }
  url_publique: "https://exemple.fr"
  contact: { nom: "Julie", email: "julie@exemple.fr" }
evenement:
  date_debut: "2027-06-14T16:00:00+02:00"
  date_limite_rsvp: "2027-05-01"
  lieu_court: "Bordeaux"
accueil:
  accroche: { fr: "On fait la fête !" }
  photo_principale: photos/hero.jpg
histoire:
  intro: "Il était une fois"
lieux:
  - { id: domaine, nom: "Domaine", adresse: "12 allée", lat: 44.83, lng: -0.58 }
moments:
  - { id: diner, heure: "19:00", titre: { fr: "Dîner", en: "Dinner" }, lieu: domaine }
rsvp:
  titre: { fr: "Tu viens ?", en: "Are you coming?" }
  message_merci: "Merci !"
email:
  expediteur_nom: "Coco"
  objet: "Ton invitation"
`;

function problemsOf(yaml: string, photos = PHOTOS): string[] {
  try { parseEvent(yaml, photos); return []; }
  catch (e) { if (e instanceof EventConfigError) return e.problems; throw e; }
}

describe('parseEvent', () => {
  test('accepte une configuration minimale et normalise les textes', () => {
    const ev = parseEvent(base, PHOTOS);
    expect(ev.evenement.lieu_court).toEqual({ fr: 'Bordeaux' });
    expect(ev.galerie).toEqual([]);
    expect(ev.infos.hebergements).toEqual([]);
    expect(ev.infos.faq).toEqual([]);
    expect(ev.histoire.chapitres).toEqual([]);
  });

  test('signale un lieu de moment inconnu avec son chemin', () => {
    const p = problemsOf(base.replace('lieu: domaine }', 'lieu: salle }'));
    expect(p).toContain('moments[0].lieu : le lieu « salle » n’existe pas dans « lieux »');
  });

  test('signale une photo absente du dossier', () => {
    const p = problemsOf(base.replace('photos/hero.jpg', 'photos/absente.jpg'));
    expect(p).toContain('accueil.photo_principale : fichier introuvable evenement/photos/absente.jpg');
  });

  test('signale un identifiant de moment en double', () => {
    const yaml = base.replace(
      'moments:\n',
      'moments:\n  - { id: diner, heure: "20:00", titre: "Bis", lieu: domaine }\n',
    );
    expect(problemsOf(yaml)).toContain('moments[1].id : identifiant « diner » utilisé plusieurs fois');
  });

  test('refuse une date limite postérieure à l’événement', () => {
    const p = problemsOf(base.replace('2027-05-01', '2027-07-01'));
    expect(p).toContain('evenement.date_limite_rsvp : doit précéder evenement.date_debut');
  });

  test('signale un champ obligatoire manquant', () => {
    const p = problemsOf(base.replace(/rsvp:\n(.*\n){2}/, ''));
    expect(p.some((x) => x.startsWith('rsvp :'))).toBe(true);
  });

  test('signale un YAML mal formé', () => {
    expect(problemsOf('site: [')[0]).toMatch(/^YAML invalide/);
  });
});

describe('t', () => {
  test('retourne la langue demandée', () => {
    expect(t({ fr: 'Dîner', en: 'Dinner' }, 'en')).toBe('Dinner');
  });
  test('retombe sur le français si la traduction manque ou est vide', () => {
    expect(t({ fr: 'Dîner' }, 'en')).toBe('Dîner');
    expect(t({ fr: 'Dîner', en: '' }, 'en')).toBe('Dîner');
  });
  test('retourne une chaîne vide pour un texte absent', () => {
    expect(t(undefined, 'fr')).toBe('');
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Exécuter : `npx vitest run tests/unit/event.test.ts`
Attendu : ÉCHEC, « Cannot find module '../../src/lib/event' ».

- [ ] **Étape 3 : implémenter `src/lib/event.ts`**

```ts
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
```

> Le message zod d'un champ obligatoire manquant est de la forme `rsvp : Invalid input: expected object, received undefined`. Le test vérifie seulement le préfixe `rsvp :`.

- [ ] **Étape 4 : vérifier le succès**

Exécuter : `npx vitest run tests/unit/event.test.ts`
Attendu : tous les tests RÉUSSIS. Si zod 4.6 n'expose pas `prefault`, `z.url`, `z.email` ou `z.iso.*`, utiliser leurs équivalents documentés dans zod 4 sans changer les messages attendus.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/event.ts tests/unit/event.test.ts
git commit -m "Ajoute le schéma du contenu de l'événement et sa validation"
```

---

### Tâche 3 : contenu d'exemple et chargement

**Fichiers :**
- Créer : `evenement/evenement.yaml`, `evenement/LISEZMOI.md`, `evenement/photos/*.jpg`, `src/lib/photos.ts`, `src/lib/load-event.ts`
- Tester : `tests/unit/example-event.test.ts`

**Interfaces :**
- Consomme : `parseEvent`, `EventConfig` (tâche 2).
- Produit :
  - `photoKeys: string[]` et `photo(path: string): ImageMetadata` (`src/lib/photos.ts`) ;
  - `getEvent(): EventConfig` (`src/lib/load-event.ts`), mis en cache, qui lève `EventConfigError`.

- [ ] **Étape 1 : télécharger les photos d'exemple (licence Unsplash, usage libre)**

```bash
mkdir -p evenement/photos
cd evenement/photos
curl -sL -o hero.jpg     "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&q=80&fm=jpg"
curl -sL -o toast.jpg    "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=1600&q=80&fm=jpg"
curl -sL -o portrait.jpg "https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=1600&q=80&fm=jpg"
curl -sL -o ballons.jpg  "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1600&q=80&fm=jpg"
curl -sL -o jardin.jpg   "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1600&q=80&fm=jpg"
curl -sL -o diner.jpg    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80&fm=jpg"
curl -sL -o soiree.jpg   "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1600&q=80&fm=jpg"
curl -sL -o bar.jpg      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=1600&q=80&fm=jpg"
cd ../..
```

Vérifier : `ls -la evenement/photos` affiche 8 fichiers de plus de 50 Ko.

- [ ] **Étape 2 : écrire `evenement/evenement.yaml`**

```yaml
# Contenu de l'événement — voir LISEZMOI.md pour le détail de chaque champ.
site:
  titre: { fr: "Coco a 40 ans", en: "Coco turns 40" }
  url_publique: "http://localhost:4321"
  contact: { nom: "Julie", email: "contact@exemple.fr", telephone: "06 12 34 56 78" }

theme:
  couleurs: { principale: "#ec5e27", fond: "#fdfdf1", texte: "#3a2419", douce: "#fbd7c2" }
  polices: { titres: "Caveat", texte: "Nunito" }

evenement:
  date_debut: "2027-06-14T16:00:00+02:00"
  date_limite_rsvp: "2027-05-01"
  lieu_court: { fr: "Domaine des Tilleuls, Bordeaux", en: "Domaine des Tilleuls, Bordeaux" }

accueil:
  accroche: { fr: "On fait la fête !", en: "Let's party!" }
  photo_principale: photos/hero.jpg
  photo_secondaire: photos/toast.jpg
  legende_photo: { fr: "la bande, été 2024", en: "the gang, summer 2024" }

histoire:
  intro:
    fr: "Quarante ans de fous rires, de voyages improvisés et de dîners qui finissent à 3 h du matin. Pour fêter ça, Coco réunit tous ceux qui ont compté, le temps d'une journée sous le soleil bordelais."
    en: "Forty years of belly laughs, spur-of-the-moment trips and dinners that end at 3 a.m. To celebrate, Coco is gathering everyone who matters for a sunny day in Bordeaux."
  chapitres:
    - annee: "1987"
      titre: { fr: "Une petite tornade est née", en: "A little whirlwind is born" }
      texte:
        fr: "Coco débarque un 14 juin, avec déjà ce rire qu'on reconnaît à l'autre bout d'une salle."
        en: "Coco arrives on a 14th of June, already with that laugh you can recognise from across a room."
      photo: photos/ballons.jpg
      legende: { fr: "les premiers ballons", en: "the first balloons" }
    - annee: "2009"
      titre: { fr: "La bande se forme", en: "The gang comes together" }
      texte:
        fr: "Un appart' trop petit, une colocation trop bruyante et des amitiés qui ne se sont jamais défaites depuis."
        en: "A flat too small, a flatshare too loud, and friendships that have lasted ever since."
      photo: photos/hero.jpg
      legende: { fr: "la bande, toujours", en: "the gang, always" }
    - annee: "2027"
      titre: { fr: "40 ans, et toujours en route", en: "40, and still on the road" }
      texte:
        fr: "Des voyages, des projets, des retrouvailles… et l'envie de réunir tout le monde pour une journée sous le soleil."
        en: "Trips, projects, reunions… and the wish to bring everyone together for a day in the sun."
      photo: photos/portrait.jpg
      legende: { fr: "sur la route", en: "on the road" }

galerie:
  - { photo: photos/toast.jpg, legende: { fr: "Santé !", en: "Cheers!" } }
  - { photo: photos/ballons.jpg }
  - { photo: photos/portrait.jpg }
  - { photo: photos/bar.jpg }
  - { photo: photos/soiree.jpg }
  - { photo: photos/diner.jpg }
  - { photo: photos/hero.jpg }

lieux:
  - { id: domaine, nom: "Domaine des Tilleuls", adresse: "12 allée des Tilleuls, 33000 Bordeaux", lat: 44.8378, lng: -0.5800 }
  - { id: guinguette, nom: "La Guinguette", adresse: "Quai Richelieu, 33000 Bordeaux", lat: 44.8435, lng: -0.5690 }
  - { id: cafe-port, nom: "Café du Port", adresse: "Quai des Chartrons, 33000 Bordeaux", lat: 44.8550, lng: -0.5650 }

moments:
  - id: accueil
    heure: "16:00"
    titre: { fr: "Accueil", en: "Welcome" }
    description: { fr: "Jardin du domaine", en: "In the estate garden" }
    lieu: domaine
    photo: photos/jardin.jpg
  - id: diner
    heure: "19:00"
    titre: { fr: "Dîner", en: "Dinner" }
    description: { fr: "Grande tablée sous les arbres", en: "Long table under the trees" }
    lieu: domaine
    photo: photos/diner.jpg
  - id: soiree
    heure: "22:00"
    titre: { fr: "Soirée", en: "Party" }
    description: { fr: "DJ & piste de danse", en: "DJ & dance floor" }
    lieu: guinguette
    photo: photos/soiree.jpg
  - id: brunch
    heure: "11:00"
    jour: { fr: "Dimanche", en: "Sunday" }
    titre: { fr: "Brunch", en: "Brunch" }
    description: { fr: "Le lendemain, pour les courageux", en: "The day after, for the brave" }
    lieu: cafe-port
    photo: photos/bar.jpg

infos:
  hebergements:
    - { nom: "Hôtel des Quais", etiquette: { fr: "Code COCO40 : -10 %", en: "Code COCO40: 10% off" }, distance: "400 m", prix: "~95 €/nuit", lien: "https://exemple.fr/hotel", photo: photos/bar.jpg, lat: 44.8410, lng: -0.5760 }
    - { nom: "Gîte Les Chartrons", etiquette: { fr: "Idéal familles", en: "Great for families" }, distance: "1,5 km", prix: "~180 €/nuit", lien: "https://exemple.fr/gite", photo: photos/portrait.jpg, lat: 44.8480, lng: -0.5800 }
    - { nom: "Auberge du Port", etiquette: { fr: "Petit budget", en: "Budget" }, distance: "2 km", prix: "~35 €/nuit", lien: "https://exemple.fr/auberge", photo: photos/hero.jpg }
  tenue:
    texte:
      fr: "Chic et décontracté, couleurs chaudes bienvenues ! Prévois des chaussures plates : on danse sur l'herbe."
      en: "Smart casual, warm colours welcome! Bring flat shoes: we'll be dancing on the grass."
    couleurs: ["#ec5e27", "#fbd7c2", "#fdfdf1", "#c9822b", "#3a2419"]
  cadeaux:
    texte:
      fr: "Ta présence est le plus beau des cadeaux. Pour ceux qui le souhaitent, une cagnotte finance le prochain voyage de Coco."
      en: "Your presence is the best gift. If you wish, a group fund will pay for Coco's next trip."
    lien_cagnotte: "https://exemple.fr/cagnotte"
  acces:
    texte:
      fr: "Parking gratuit au domaine (60 places). Tram B arrêt « Les Tilleuls » à 5 min. Navette vers la Guinguette à 21 h 45."
      en: "Free parking at the estate (60 spaces). Tram B, \"Les Tilleuls\" stop, 5 min walk. Shuttle to La Guinguette at 9:45 pm."
  faq:
    - { question: { fr: "Les enfants sont-ils les bienvenus ?", en: "Are children welcome?" }, reponse: { fr: "Oui ! Un coin jeux et une baby-sitter sont prévus de 16 h à 23 h.", en: "Yes! A play area and a babysitter are available from 4 pm to 11 pm." } }
    - { question: { fr: "Puis-je venir accompagné(e) ?", en: "Can I bring someone?" }, reponse: { fr: "Indique simplement tes accompagnants dans le formulaire RSVP.", en: "Just list them in the RSVP form." } }

rsvp:
  titre: { fr: "Tu viens ?", en: "Are you coming?" }
  message_merci: { fr: "Merci ! Ton invitation arrive par e-mail.", en: "Thank you! Your invitation is on its way by email." }

email:
  expediteur_nom: "Coco a 40 ans"
  objet: { fr: "🎉 Ton invitation pour les 40 ans de Coco", en: "🎉 Your invitation to Coco's 40th" }
```

- [ ] **Étape 3 : écrire le test qui échoue**

`tests/unit/example-event.test.ts` :
```ts
import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseEvent } from '../../src/lib/event';

test('le contenu d’exemple est valide', () => {
  const yaml = readFileSync('evenement/evenement.yaml', 'utf8');
  const photos = readdirSync('evenement/photos').map((f) => `photos/${f}`);
  const ev = parseEvent(yaml, photos);
  expect(ev.moments.map((m) => m.id)).toEqual(['accueil', 'diner', 'soiree', 'brunch']);
  expect(ev.infos.hebergements).toHaveLength(3);
});
```

Exécuter : `npx vitest run tests/unit/example-event.test.ts`
Attendu : RÉUSSI si l'étape 2 est correcte. En cas d'échec, le message `EventConfigError` nomme le champ fautif ; corriger le YAML.

- [ ] **Étape 4 : écrire `src/lib/photos.ts` et `src/lib/load-event.ts`**

`src/lib/photos.ts` :
```ts
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>(
  '/evenement/photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);

export const photoKeys: string[] = Object.keys(files).map((k) => k.replace('/evenement/', ''));

export function photo(path: string): ImageMetadata {
  const key = Object.keys(files).find((k) => k.toLowerCase() === `/evenement/${path}`.toLowerCase());
  if (!key) throw new Error(`Photo introuvable : evenement/${path}`);
  return files[key].default;
}
```

`src/lib/load-event.ts` :
```ts
import yamlText from '../../evenement/evenement.yaml?raw';
import { parseEvent, type EventConfig } from './event';
import { photoKeys } from './photos';

let cache: EventConfig | undefined;

export function getEvent(): EventConfig {
  cache ??= parseEvent(yamlText, photoKeys);
  return cache;
}
```

- [ ] **Étape 5 : écrire `evenement/LISEZMOI.md`**

```markdown
# Modifier le contenu de l'événement

Tout le site est rempli à partir de **`evenement.yaml`** et des photos du dossier **`photos/`**. Il n'y a rien d'autre à modifier.

## Règles générales
- Un texte peut s'écrire `"Texte"` (identique en FR et EN) ou `{ fr: "Texte", en: "Text" }`. S'il manque la version anglaise, le texte français est affiché.
- Une photo s'écrit `photos/nom-du-fichier.jpg` (formats acceptés : jpg, png, webp). Le fichier doit exister dans `photos/`.
- Les identifiants (`id`) s'écrivent en minuscules, chiffres et tirets, sans espaces ni accents.
- En cas d'erreur, le site affiche la liste des problèmes avec le nom exact du champ concerné.

## Rubriques
| Rubrique | Contenu |
|---|---|
| `site` | Titre du site, adresse publique (sert au QR code et aux e-mails), contact |
| `theme` | Facultatif. Couleurs (`principale`, `fond`, `texte`, `douce`) au format `#rrggbb`, polices Google Fonts (`titres`, `texte`) |
| `evenement` | Date et heure de début avec fuseau (`2027-06-14T16:00:00+02:00`), date limite de réponse (`2027-05-01`), lieu en quelques mots |
| `accueil` | Accroche, photo principale, photo secondaire (facultative), légende |
| `histoire` | Introduction, puis chapitres : `annee`, `titre`, `texte`, `photo`, `legende` |
| `galerie` | Liste de photos avec légende facultative |
| `lieux` | Chaque lieu : `id`, `nom`, `adresse`, `lat`, `lng`. Pour obtenir les coordonnées : clic droit sur le lieu dans Google Maps, puis clic sur les chiffres pour les copier. |
| `moments` | Les étapes de la journée, qui sont aussi les cases à cocher du RSVP : `id`, `heure` (HH:MM), `jour` (facultatif, ex. « Dimanche »), `titre`, `description`, `lieu` (l'`id` d'un lieu), `photo` |
| `infos` | Tout est facultatif : `hebergements`, `tenue`, `cadeaux`, `acces`, `faq`. Une rubrique absente n'est pas affichée. |
| `rsvp` | Titre de la page de réponse, message de remerciement |
| `email` | Nom de l'expéditeur, objet de l'e-mail |

## Crédits des photos d'exemple
Photos libres de droits issues d'Unsplash (licence Unsplash). Remplace-les par les tiennes.
```

- [ ] **Étape 6 : commit**

```bash
git add evenement src/lib/photos.ts src/lib/load-event.ts tests/unit/example-event.test.ts
git commit -m "Ajoute le contenu d'exemple et son chargement"
```

---

### Tâche 4 : langues

**Fichiers :**
- Créer : `src/lib/i18n.ts`
- Tester : `tests/unit/i18n.test.ts`

**Interfaces :**
- Consomme : `Lang` (tâche 2).
- Produit :
  - `LANGS: readonly Lang[]` ;
  - `isLang(x: unknown): x is Lang` ;
  - `detectLang(cookie: string | undefined, acceptLanguage: string | null): Lang` ;
  - `switchPath(pathname: string, to: Lang): string` ;
  - `ui(lang: Lang, key: UiKey): string`, avec `type UiKey` ;
  - `formatDate(iso: string, lang: Lang): string`, qui donne « samedi 14 juin 2027 » ou « Saturday, June 14, 2027 », dans le fuseau de la date fournie ;
  - `formatHeure(hhmm: string, lang: Lang): string`, qui donne « 19 h » ou « 19 h 30 » en français, « 7 pm » ou « 7:30 pm » en anglais.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/unit/i18n.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { detectLang, formatDate, formatHeure, isLang, switchPath, ui } from '../../src/lib/i18n';

describe('detectLang', () => {
  test('le cookie valide gagne', () => expect(detectLang('en', 'fr-FR')).toBe('en'));
  test('un cookie invalide est ignoré', () => expect(detectLang('de', 'en-US')).toBe('en'));
  test('respecte les poids q', () => expect(detectLang(undefined, 'de;q=1, en;q=0.8, fr;q=0.9')).toBe('fr'));
  test('en-GB donne en', () => expect(detectLang(undefined, 'en-GB,en;q=0.9')).toBe('en'));
  test('joker ou vide donne fr', () => {
    expect(detectLang(undefined, '*')).toBe('fr');
    expect(detectLang(undefined, null)).toBe('fr');
    expect(detectLang(undefined, '')).toBe('fr');
  });
  test('langue non gérée donne fr', () => expect(detectLang(undefined, 'es-ES,de')).toBe('fr'));
});

test('isLang', () => {
  expect(isLang('fr')).toBe(true);
  expect(isLang('de')).toBe(false);
  expect(isLang(undefined)).toBe(false);
});

test('switchPath remplace le préfixe de langue', () => {
  expect(switchPath('/fr/programme', 'en')).toBe('/en/programme');
  expect(switchPath('/fr/', 'en')).toBe('/en/');
  expect(switchPath('/fr', 'en')).toBe('/en/');
  expect(switchPath('/', 'en')).toBe('/en/');
});

test('ui traduit les libellés', () => {
  expect(ui('fr', 'nav.programme')).toBe('Programme & lieux');
  expect(ui('en', 'nav.programme')).toBe('Schedule & venues');
});

test('formatDate', () => {
  expect(formatDate('2027-06-14T16:00:00+02:00', 'fr')).toBe('lundi 14 juin 2027');
  expect(formatDate('2027-06-14T16:00:00+02:00', 'en')).toBe('Monday, June 14, 2027');
});

test('formatHeure', () => {
  expect(formatHeure('19:00', 'fr')).toBe('19 h');
  expect(formatHeure('19:30', 'fr')).toBe('19 h 30');
  expect(formatHeure('19:00', 'en')).toBe('7 pm');
  expect(formatHeure('11:30', 'en')).toBe('11:30 am');
  expect(formatHeure('00:15', 'en')).toBe('12:15 am');
});
```

> Le 14 juin 2027 est un **lundi**. Les textes de démonstration des maquettes disaient « samedi » : la date réelle fait foi, l'interface la calcule.

- [ ] **Étape 2 : vérifier l'échec**

Exécuter : `npx vitest run tests/unit/i18n.test.ts`
Attendu : ÉCHEC, module introuvable.

- [ ] **Étape 3 : implémenter `src/lib/i18n.ts`**

```ts
import type { Lang } from './event';
export type { Lang } from './event';

export const LANGS = ['fr', 'en'] as const satisfies readonly Lang[];

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

export function detectLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (isLang(cookie)) return cookie;
  const prefs = (acceptLanguage ?? '')
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { lang: tag.trim().toLowerCase().split('-')[0], q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((p) => p.lang && !Number.isNaN(p.q))
    .sort((a, b) => b.q - a.q || a.index - b.index);
  const found = prefs.find((p) => isLang(p.lang));
  return found ? (found.lang as Lang) : 'fr';
}

export function switchPath(pathname: string, to: Lang): string {
  const rest = pathname.replace(/^\/(fr|en)(?=\/|$)/, '');
  const clean = rest === '' || rest === '/' ? '/' : rest;
  return `/${to}${clean}`;
}

const DICT = {
  'nav.accueil': { fr: 'Accueil', en: 'Home' },
  'nav.histoire': { fr: 'Notre histoire', en: 'Our story' },
  'nav.programme': { fr: 'Programme & lieux', en: 'Schedule & venues' },
  'nav.infos': { fr: 'Infos pratiques', en: 'Practical info' },
  'nav.rsvp': { fr: "RSVP & Livre d'or", en: 'RSVP & Guestbook' },
  'nav.menu': { fr: 'Menu', en: 'Menu' },
  'nav.langue': { fr: 'Changer de langue', en: 'Change language' },
  'accueil.cta': { fr: 'Je viens ! →', en: "I'm coming! →" },
  'accueil.histoire_lien': { fr: "Lire toute l'histoire →", en: 'Read the whole story →' },
  'accueil.programme': { fr: 'Le programme', en: 'The schedule' },
  'accueil.carte': { fr: 'Voir la carte des lieux', en: 'See the venue map' },
  'accueil.souvenirs': { fr: 'Quelques souvenirs', en: 'A few memories' },
  'accueil.confirmer': { fr: 'Je confirme ma présence', en: 'Confirm my attendance' },
  'accueil.avant': { fr: 'Merci de confirmer avant le', en: 'Please reply before' },
  'compte.jours': { fr: 'jours', en: 'days' },
  'compte.heures': { fr: 'heures', en: 'hours' },
  'compte.minutes': { fr: 'minutes', en: 'minutes' },
  'compte.secondes': { fr: 'secondes', en: 'seconds' },
  'compte.passe': { fr: "C'est le grand jour !", en: "It's the big day!" },
  'histoire.titre': { fr: 'Notre histoire', en: 'Our story' },
  'histoire.galerie': { fr: 'La galerie', en: 'The gallery' },
  'histoire.galerie_aide': { fr: "Clique sur une photo pour l'agrandir", en: 'Click a photo to enlarge it' },
  'galerie.fermer': { fr: 'Fermer', en: 'Close' },
  'galerie.precedente': { fr: 'Photo précédente', en: 'Previous photo' },
  'galerie.suivante': { fr: 'Photo suivante', en: 'Next photo' },
  'programme.titre': { fr: 'Programme & lieux', en: 'Schedule & venues' },
  'programme.itineraire': { fr: 'Itinéraire Google Maps', en: 'Google Maps directions' },
  'programme.waze': { fr: 'Waze', en: 'Waze' },
  'programme.legende_lieux': { fr: 'Lieux de la fête', en: 'Party venues' },
  'programme.legende_hebergements': { fr: 'Hébergements conseillés', en: 'Suggested stays' },
  'programme.dormir': { fr: 'Tu viens de loin ? Hôtels et gîtes conseillés sont dans les Infos pratiques.', en: 'Coming from afar? Suggested hotels are in Practical info.' },
  'programme.dormir_lien': { fr: 'Voir les hébergements →', en: 'See places to stay →' },
  'programme.voir_carte': { fr: 'Voir sur la carte', en: 'Show on map' },
  'infos.titre': { fr: 'Infos pratiques', en: 'Practical info' },
  'infos.sous_titre': { fr: "Tout ce qu'il faut savoir pour profiter à fond", en: 'Everything you need to know' },
  'infos.dormir': { fr: 'Où dormir', en: 'Where to stay' },
  'infos.reserver': { fr: 'Réserver', en: 'Book' },
  'infos.tenue': { fr: 'Tenue', en: 'Dress code' },
  'infos.cadeaux': { fr: 'Cadeaux', en: 'Gifts' },
  'infos.cagnotte': { fr: 'Participer à la cagnotte', en: 'Contribute to the fund' },
  'infos.acces': { fr: 'Accès & parking', en: 'Getting there & parking' },
  'infos.contact': { fr: 'Contact', en: 'Contact' },
  'infos.faq': { fr: 'Questions fréquentes', en: 'FAQ' },
  'infos.ecrire': { fr: 'Écrire un e-mail', en: 'Send an email' },
  'pied.question': { fr: 'Une question ?', en: 'Any question?' },
  'erreur.config': { fr: 'Le contenu de l’événement contient des erreurs', en: 'The event content contains errors' },
} as const satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof DICT;

export function ui(lang: Lang, key: UiKey): string {
  return DICT[key][lang];
}

export function formatDate(iso: string, lang: Lang): string {
  const offset = iso.match(/([+-]\d{2}):?(\d{2})$/);
  const date = new Date(iso);
  // Affiche la date telle qu'elle est vécue sur place, quel que soit le fuseau du serveur.
  const minutes = offset ? (offset[1].startsWith('-') ? -1 : 1) * (Math.abs(Number(offset[1])) * 60 + Number(offset[2])) : 0;
  const local = new Date(date.getTime() + minutes * 60_000);
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(local);
}

export function formatHeure(hhmm: string, lang: Lang): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (lang === 'fr') return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}
```

- [ ] **Étape 4 : vérifier le succès**

Exécuter : `npx vitest run tests/unit/i18n.test.ts`
Attendu : RÉUSSI.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/i18n.ts tests/unit/i18n.test.ts
git commit -m "Ajoute la gestion des langues et les textes d'interface"
```

---

### Tâche 5 : thème et contraste

**Fichiers :**
- Créer : `src/lib/theme.ts`
- Tester : `tests/unit/theme.test.ts`

**Interfaces :**
- Consomme : `EventConfig['theme']` (tâche 2).
- Produit :
  - `contrastRatio(a: string, b: string): number` ;
  - `darkenUntil(color: string, against: string, min?: number): string` ;
  - `themeVars(theme: EventConfig['theme']): string`, qui renvoie la déclaration CSS `--c-principale:…;--c-principale-fonce:…;--c-fond:…;--c-texte:…;--c-texte-doux:…;--c-douce:…;--f-titres:…;--f-texte:…` ;
  - `fontsHref(theme: EventConfig['theme']): string`.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/unit/theme.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { contrastRatio, darkenUntil, fontsHref, themeVars } from '../../src/lib/theme';

describe('contrastRatio', () => {
  test('valeurs de référence', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#fdfdf1', '#ec5e27')).toBeCloseTo(3.31, 2);
    expect(contrastRatio('#3a2419', '#fdfdf1')).toBeCloseTo(14.17, 1);
  });
  test('symétrique', () => {
    expect(contrastRatio('#ec5e27', '#fdfdf1')).toBe(contrastRatio('#fdfdf1', '#ec5e27'));
  });
});

describe('darkenUntil', () => {
  test('assombrit l’orange jusqu’à 4,5:1 sans excès', () => {
    const fonce = darkenUntil('#ec5e27', '#fdfdf1');
    const r = contrastRatio(fonce, '#fdfdf1');
    expect(r).toBeGreaterThanOrEqual(4.5);
    expect(r).toBeLessThan(5);
  });
  test('laisse intacte une couleur déjà assez contrastée', () => {
    expect(darkenUntil('#3a2419', '#fdfdf1')).toBe('#3a2419');
  });
});

describe('themeVars', () => {
  test('utilise les valeurs Soleil par défaut', () => {
    const css = themeVars({ couleurs: {}, polices: {} });
    expect(css).toContain('--c-principale:#ec5e27');
    expect(css).toContain('--c-fond:#fdfdf1');
    expect(css).toContain("--f-titres:'Caveat'");
  });
  test('le texte doux reste lisible sur le fond', () => {
    const css = themeVars({ couleurs: {}, polices: {} });
    const doux = css.match(/--c-texte-doux:(#[0-9a-f]{6})/)![1];
    expect(contrastRatio(doux, '#fdfdf1')).toBeGreaterThanOrEqual(4.5);
  });
  test('accepte une couleur personnalisée', () => {
    expect(themeVars({ couleurs: { principale: '#2a9d8f' }, polices: {} })).toContain('--c-principale:#2a9d8f');
  });
});

test('fontsHref construit l’URL Google Fonts', () => {
  expect(fontsHref({ couleurs: {}, polices: { texte: 'Open Sans' } })).toBe(
    'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Open+Sans:wght@400;600;800&display=swap',
  );
});
```

- [ ] **Étape 2 : vérifier l'échec**

Exécuter : `npx vitest run tests/unit/theme.test.ts`
Attendu : ÉCHEC, module introuvable.

- [ ] **Étape 3 : implémenter `src/lib/theme.ts`**

```ts
import type { EventConfig } from './event';

type Theme = EventConfig['theme'];
const SOLEIL = { principale: '#ec5e27', fond: '#fdfdf1', texte: '#3a2419', douce: '#fbd7c2' };
const POLICES = { titres: 'Caveat', texte: 'Nunito' };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function darkenUntil(color: string, against: string, min = 4.5): string {
  let c = rgb(color);
  for (let i = 0; i < 100 && contrastRatio(hex(c), against) < min; i++) c = c.map((v) => v * 0.98);
  return hex(c);
}

function mix(a: string, b: string, weightA: number): string {
  const [ca, cb] = [rgb(a), rgb(b)];
  return hex(ca.map((v, i) => v * weightA + cb[i] * (1 - weightA)));
}

export function themeVars(theme: Theme): string {
  const c = { ...SOLEIL, ...theme.couleurs };
  const p = { ...POLICES, ...theme.polices };
  const vars: Record<string, string> = {
    '--c-principale': c.principale,
    '--c-principale-fonce': darkenUntil(c.principale, c.fond),
    '--c-fond': c.fond,
    '--c-texte': c.texte,
    '--c-texte-doux': darkenUntil(mix(c.texte, c.fond, 0.75), c.fond),
    '--c-douce': c.douce,
    '--f-titres': `'${p.titres}', cursive`,
    '--f-texte': `'${p.texte}', system-ui, sans-serif`,
  };
  return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
}

export function fontsHref(theme: Theme): string {
  const p = { ...POLICES, ...theme.polices };
  const fam = (name: string, weights: string) => `family=${name.trim().replace(/ /g, '+')}:wght@${weights}`;
  return `https://fonts.googleapis.com/css2?${fam(p.titres, '500;700')}&${fam(p.texte, '400;600;800')}&display=swap`;
}
```

- [ ] **Étape 4 : vérifier le succès**

Exécuter : `npx vitest run tests/unit/theme.test.ts`
Attendu : RÉUSSI.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/theme.ts tests/unit/theme.test.ts
git commit -m "Ajoute le thème de couleurs avec contraste garanti"
```

---

### Tâche 6 : mise en page commune, redirection et cookie de langue

**Fichiers :**
- Créer : `src/middleware.ts`, `src/pages/index.astro`, `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`, `src/components/Wave.astro`, `src/components/PageHead.astro`, `src/components/Polaroid.astro`, `src/styles/global.css`
- Modifier : `src/pages/[lang]/index.astro` (nouvelle version temporaire)
- Tester : `tests/e2e/langue.spec.ts`

**Interfaces :**
- Consomme : `getEvent`, `t`, `detectLang`, `isLang`, `switchPath`, `ui`, `themeVars`, `fontsHref`, `photo`.
- Produit :
  - `<Base lang title current>`, avec `current` parmi `'accueil' | 'histoire' | 'programme' | 'infos' | 'rsvp'` ;
  - `<PageHead title subtitle?>` : bandeau orange et vague ;
  - `<Wave color?>` ;
  - `<Polaroid src: ImageMetadata, alt, caption?, rotate?, tape?, width>` ;
  - `Astro.locals.lang: Lang` (fixé par le middleware sur les routes `/[lang]/…`).

- [ ] **Étape 1 : écrire les tests de bout en bout qui échouent**

`tests/e2e/langue.spec.ts` :
```ts
import { expect, test } from '@playwright/test';

test('la racine redirige selon Accept-Language', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
  await ctx.close();
});

test('la racine redirige vers fr par défaut', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'Accept-Language': 'de-DE' } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/fr\/$/);
  await ctx.close();
});

test('le bouton de langue change de langue et s’en souvient', async ({ page }) => {
  await page.goto('/fr/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.locator('.lang a[hreflang="en"]').click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
});

test('une langue inconnue renvoie vers la racine', async ({ page }) => {
  await page.goto('/de/');
  await expect(page).toHaveURL(/\/(fr|en)\/$/);
});

test('la navigation contient les 5 pages', async ({ page }) => {
  await page.goto('/fr/');
  // Locator CSS plutôt que getByRole : sur téléphone le menu est fermé, donc masqué pour l'arbre d'accessibilité.
  await expect(page.locator('#menu a')).toHaveText(['Accueil', 'Notre histoire', 'Programme & lieux', 'Infos pratiques', "RSVP & Livre d'or"]);
  await expect(page.locator('#menu a[aria-current="page"]')).toHaveText('Accueil');
});
```

- [ ] **Étape 2 : vérifier l'échec**

Exécuter : `npx playwright test tests/e2e/langue.spec.ts --project=ordinateur`
Attendu : ÉCHEC (pas de redirection, pas de navigation).

- [ ] **Étape 3 : écrire `src/middleware.ts`**

```ts
import { defineMiddleware } from 'astro:middleware';
import { EventConfigError } from './lib/event';
import { isLang } from './lib/i18n';
import { getEvent } from './lib/load-event';

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const onRequest = defineMiddleware(async (ctx, next) => {
  try {
    getEvent();
  } catch (e) {
    if (!(e instanceof EventConfigError)) throw e;
    const items = e.problems.map((p) => `<li>${escape(p)}</li>`).join('');
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Configuration invalide</title>` +
        `<body style="font-family:system-ui;max-width:760px;margin:40px auto;padding:0 16px">` +
        `<h1>Le contenu de l’événement contient des erreurs</h1><p>Corrige <code>evenement/evenement.yaml</code> :</p><ul>${items}</ul>`,
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  const first = ctx.url.pathname.split('/')[1];
  if (/^[a-z]{2}$/.test(first) && !isLang(first)) return ctx.redirect('/', 302);
  if (isLang(first)) {
    ctx.locals.lang = first;
    ctx.cookies.set('lang', first, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  return next();
});
```

Ajouter à `src/env.d.ts` :
```ts
declare namespace App {
  interface Locals { lang: import('./lib/event').Lang }
}
```

- [ ] **Étape 4 : écrire `src/pages/index.astro`**

```astro
---
import { detectLang } from '../lib/i18n';
const lang = detectLang(Astro.cookies.get('lang')?.value, Astro.request.headers.get('accept-language'));
return Astro.redirect(`/${lang}/`, 302);
---
```

- [ ] **Étape 5 : écrire `src/styles/global.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--c-fond); color: var(--c-texte); font-family: var(--f-texte); font-size: 17px; line-height: 1.6; overflow-x: hidden; }
img { display: block; max-width: 100%; height: auto; }
a { color: var(--c-principale-fonce); font-weight: 800; }
h1, h2, h3 { line-height: 1.05; }
.hand { font-family: var(--f-titres); font-weight: 700; }
.container { width: min(1100px, 100% - 32px); margin-inline: auto; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
:focus-visible { outline: 3px solid var(--c-texte); outline-offset: 3px; border-radius: 4px; }

/* Boutons */
.btn { display: inline-block; padding: 14px 26px; border-radius: 16px; font-weight: 800; font-size: 1rem; text-decoration: none; border: 0; cursor: pointer; font-family: inherit; }
.btn-clair { background: var(--c-fond); color: var(--c-principale-fonce); box-shadow: 0 5px 0 rgba(0,0,0,.18); }
.btn-plein { background: var(--c-principale-fonce); color: var(--c-fond); box-shadow: 0 5px 0 rgba(0,0,0,.22); }
.btn-contour { background: #fff; color: var(--c-texte); border: 2px solid var(--c-texte); }
.btn-petit { padding: 8px 12px; font-size: .85rem; border-radius: 10px; }
.btn:active { transform: translateY(3px); box-shadow: none; }

/* Zones orange : texte clair, grand ou gras uniquement */
.zone-orange { background: var(--c-principale); color: var(--c-fond); }
.zone-orange p, .zone-orange .meta { font-weight: 800; font-size: 1.15rem; }
.zone-orange a:not(.btn) { color: var(--c-fond); }

/* Polaroïd */
.pola { background: #fff; padding: 10px 10px 38px; box-shadow: 0 10px 24px rgba(58,36,25,.25); position: relative; margin: 0; }
.pola img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: var(--ratio, 4/3); }
.pola figcaption { position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-family: var(--f-titres); font-size: 1.3rem; color: var(--c-texte); }
.tape { position: absolute; top: -12px; left: 50%; width: 80px; height: 24px; margin-left: -40px; background: rgba(253,253,241,.8); transform: rotate(-4deg); box-shadow: 0 1px 3px rgba(0,0,0,.15); z-index: 1; }

/* Vague */
.wave { display: block; width: 100%; height: 40px; }

/* Bandeau de page */
.page-head { text-align: center; padding: 24px 16px 8px; }
.page-head h1 { font-family: var(--f-titres); font-size: clamp(3rem, 9vw, 4.5rem); margin: 0; }
.page-head p { margin: 6px 0 0; }

/* Titres de section */
.titre-section { font-family: var(--f-titres); font-size: clamp(2.4rem, 6vw, 3rem); color: var(--c-principale); margin: 0 0 16px; font-weight: 700; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

- [ ] **Étape 6 : écrire les composants**

`src/components/Wave.astro` :
```astro
---
interface Props { color?: string }
const { color = 'var(--c-principale)' } = Astro.props;
---
<svg class="wave" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path d="M0 0h1000v10c-120 30-240 30-360 10S400-10 280 10 80 40 0 18z" style={`fill:${color}`} />
</svg>
```

`src/components/Polaroid.astro` :
```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';
interface Props { src: ImageMetadata; alt: string; caption?: string; rotate?: number; tape?: boolean; width: number; ratio?: string; class?: string }
const { src, alt, caption, rotate = 0, tape = true, width, ratio = '4/3', class: cls = '' } = Astro.props;
---
<figure class={`pola ${cls}`} style={`transform:rotate(${rotate}deg);--ratio:${ratio}`}>
  {tape && <span class="tape" aria-hidden="true"></span>}
  <Image src={src} alt={alt} width={width} widths={[width, width * 2]} sizes={`${width}px`} loading="lazy" />
  {caption && <figcaption>{caption}</figcaption>}
</figure>
```

`src/components/Nav.astro` :
```astro
---
import type { Lang } from '../lib/event';
import { switchPath, ui } from '../lib/i18n';
interface Props { lang: Lang; current: 'accueil' | 'histoire' | 'programme' | 'infos' | 'rsvp'; logo: string }
const { lang, current, logo } = Astro.props;
const items = [
  ['accueil', '', 'nav.accueil'],
  ['histoire', 'histoire', 'nav.histoire'],
  ['programme', 'programme', 'nav.programme'],
  ['infos', 'infos', 'nav.infos'],
  ['rsvp', 'rsvp', 'nav.rsvp'],
] as const;
const path = Astro.url.pathname;
---
<header class="nav zone-orange">
  <div class="nav-in">
    <a class="logo hand" href={`/${lang}/`}>☀ {logo}</a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="menu">
      <span aria-hidden="true">☰</span><span class="sr-only">{ui(lang, 'nav.menu')}</span>
    </button>
    <nav id="menu" aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'}>
      <ul>
        {items.map(([id, slug, key]) => (
          <li><a href={`/${lang}/${slug}`} aria-current={current === id ? 'page' : undefined}>{ui(lang, key)}</a></li>
        ))}
      </ul>
    </nav>
    <div class="lang" aria-label={ui(lang, 'nav.langue')}>
      <a href={switchPath(path, 'fr')} hreflang="fr" lang="fr" aria-current={lang === 'fr' ? 'true' : undefined}>FR</a>
      <span aria-hidden="true">|</span>
      <a href={switchPath(path, 'en')} hreflang="en" lang="en" aria-current={lang === 'en' ? 'true' : undefined}>EN</a>
    </div>
  </div>
</header>

<style>
  .nav-in { display: flex; align-items: center; gap: 16px; padding: 12px 16px; max-width: 1200px; margin: 0 auto; }
  .logo { font-size: 1.9rem; color: var(--c-fond); text-decoration: none; margin-right: auto; }
  nav ul { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px 22px; flex-wrap: wrap; }
  nav a { color: var(--c-fond); text-decoration: none; font-weight: 800; font-size: 1rem; padding-bottom: 3px; white-space: nowrap; }
  nav a[aria-current='page'] { border-bottom: 3px solid var(--c-fond); }
  .lang { background: var(--c-fond); border-radius: 10px; padding: 4px 10px; white-space: nowrap; }
  .lang a { color: var(--c-principale-fonce); text-decoration: none; }
  .lang a[aria-current='true'] { text-decoration: underline; text-underline-offset: 3px; }
  .lang span { color: var(--c-principale-fonce); }
  .burger { display: none; background: none; border: 2px solid var(--c-fond); color: var(--c-fond); border-radius: 10px; font-size: 1.3rem; padding: 2px 10px; cursor: pointer; }
  @media (max-width: 900px) {
    .burger { display: block; order: 3; }
    .lang { order: 2; }
    nav { order: 4; flex-basis: 100%; display: none; }
    nav.ouvert { display: block; }
    nav ul { flex-direction: column; padding: 8px 0; }
    nav a { display: block; padding: 10px 0; font-size: 1.15rem; }
    .nav-in { flex-wrap: wrap; }
  }
</style>

<script>
  const btn = document.querySelector<HTMLButtonElement>('.burger');
  const nav = document.getElementById('menu');
  btn?.addEventListener('click', () => {
    const open = nav!.classList.toggle('ouvert');
    btn.setAttribute('aria-expanded', String(open));
  });
</script>
```

`src/components/Footer.astro` :
```astro
---
import type { Lang } from '../lib/event';
import { formatDate, ui } from '../lib/i18n';
import { t } from '../lib/event';
import { getEvent } from '../lib/load-event';
interface Props { lang: Lang }
const { lang } = Astro.props;
const ev = getEvent();
---
<footer>
  {t(ev.site.titre, lang)} · {formatDate(ev.evenement.date_debut, lang)} · {ui(lang, 'pied.question')}
  <a href={`mailto:${ev.site.contact.email}`}>{ev.site.contact.email}</a>
</footer>
<style>
  footer { background: var(--c-texte); color: var(--c-fond); text-align: center; padding: 20px 16px; font-size: .95rem; }
  footer a { color: var(--c-fond); }
</style>
```

`src/components/PageHead.astro` :
```astro
---
import Wave from './Wave.astro';
interface Props { title: string; subtitle?: string }
const { title, subtitle } = Astro.props;
---
<div class="page-head zone-orange">
  <h1>{title}</h1>
  {subtitle && <p>{subtitle}</p>}
</div>
<Wave />
```

`src/layouts/Base.astro` :
```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import type { Lang } from '../lib/event';
import { t } from '../lib/event';
import { getEvent } from '../lib/load-event';
import { fontsHref, themeVars } from '../lib/theme';
interface Props { lang: Lang; title?: string; current: 'accueil' | 'histoire' | 'programme' | 'infos' | 'rsvp' }
const { lang, title, current } = Astro.props;
const ev = getEvent();
const siteTitre = t(ev.site.titre, lang);
const logo = siteTitre.split(' ')[0];
---
<!doctype html>
<html lang={lang} style={themeVars(ev.theme)}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title ? `${title} · ${siteTitre}` : siteTitre}</title>
    <meta name="description" content={t(ev.accueil.accroche, lang)} />
    <link rel="alternate" hreflang="fr" href={Astro.url.pathname.replace(/^\/en/, '/fr')} />
    <link rel="alternate" hreflang="en" href={Astro.url.pathname.replace(/^\/fr/, '/en')} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href={fontsHref(ev.theme)} />
    <slot name="head" />
  </head>
  <body>
    <a class="sr-only" href="#contenu">{lang === 'fr' ? 'Aller au contenu' : 'Skip to content'}</a>
    <Nav lang={lang} current={current} logo={logo} />
    <main id="contenu"><slot /></main>
    <Footer lang={lang} />
  </body>
</html>
```

- [ ] **Étape 7 : remplacer `src/pages/[lang]/index.astro` (version temporaire)**

```astro
---
import Base from '../../layouts/Base.astro';
const lang = Astro.locals.lang;
---
<Base lang={lang} current="accueil"><p class="container">…</p></Base>
```

- [ ] **Étape 8 : vérifier le succès**

Exécuter : `npx playwright test tests/e2e/langue.spec.ts`
Attendu : RÉUSSI dans les projets `ordinateur` et `telephone`. Sur téléphone, le test « navigation » trouve les liens même menu fermé, car ils sont présents dans le DOM.

Vérifier aussi à la main : renommer temporairement `photos/hero.jpg` en `photos/hero2.jpg` dans le YAML, ouvrir `http://localhost:4321/fr/`. La page d'erreur liste `accueil.photo_principale : fichier introuvable evenement/photos/hero2.jpg`. Remettre la valeur d'origine.

- [ ] **Étape 9 : commit**

```bash
git add -A
git commit -m "Ajoute la mise en page commune, la navigation et le choix de langue"
```

---

### Tâche 7 : page d'Accueil et compte à rebours

**Fichiers :**
- Créer : `src/scripts/countdown.ts`, `src/components/Countdown.astro`
- Modifier : `src/pages/[lang]/index.astro` (version définitive)
- Tester : `tests/unit/countdown.test.ts`, `tests/e2e/pages.spec.ts` (création)

**Interfaces :**
- Consomme : `Base`, `Polaroid`, `Wave`, `getEvent`, `photo`, `t`, `ui`, `formatDate`, `formatHeure`, `findLieu`.
- Produit :
  - `remaining(nowMs: number, targetMs: number): { jours: number; heures: number; minutes: number; secondes: number; passe: boolean }` ;
  - `mountCountdowns(root?: ParentNode): void` ;
  - `<Countdown target lang>`.

- [ ] **Étape 1 : écrire le test unitaire qui échoue**

`tests/unit/countdown.test.ts` :
```ts
import { expect, test } from 'vitest';
import { remaining } from '../../src/scripts/countdown';

const T = Date.parse('2027-06-14T16:00:00+02:00');

test('décompose le temps restant', () => {
  const now = T - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
  expect(remaining(now, T)).toEqual({ jours: 2, heures: 3, minutes: 4, secondes: 5, passe: false });
});

test('arrondit à la seconde inférieure', () => {
  expect(remaining(T - 1500, T)).toEqual({ jours: 0, heures: 0, minutes: 0, secondes: 1, passe: false });
});

test('après la date : zéros et passe = true, jamais de négatif', () => {
  expect(remaining(T + 10_000, T)).toEqual({ jours: 0, heures: 0, minutes: 0, secondes: 0, passe: true });
  expect(remaining(T, T).passe).toBe(true);
});
```

Exécuter : `npx vitest run tests/unit/countdown.test.ts`. Attendu : ÉCHEC, module introuvable.

- [ ] **Étape 2 : implémenter `src/scripts/countdown.ts`**

```ts
export function remaining(nowMs: number, targetMs: number) {
  const diff = Math.floor((targetMs - nowMs) / 1000);
  if (diff <= 0) return { jours: 0, heures: 0, minutes: 0, secondes: 0, passe: true };
  return {
    jours: Math.floor(diff / 86400),
    heures: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    secondes: diff % 60,
    passe: false,
  };
}

export function mountCountdowns(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-countdown]').forEach((el) => {
    const target = Date.parse(el.dataset.countdown!);
    const tick = () => {
      const r = remaining(Date.now(), target);
      if (r.passe) {
        el.querySelector('.cd-cases')?.setAttribute('hidden', '');
        el.querySelector('.cd-passe')?.removeAttribute('hidden');
        return false;
      }
      for (const k of ['jours', 'heures', 'minutes', 'secondes'] as const) {
        const span = el.querySelector(`[data-unit="${k}"]`);
        if (span) span.textContent = String(r[k]).padStart(k === 'jours' ? 1 : 2, '0');
      }
      return true;
    };
    if (tick()) {
      const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000);
    }
  });
}
```

Exécuter : `npx vitest run tests/unit/countdown.test.ts`. Attendu : RÉUSSI.

- [ ] **Étape 3 : écrire `src/components/Countdown.astro`**

Le rendu serveur calcule une première valeur, ce qui garantit un affichage correct même sans JavaScript.

```astro
---
import type { Lang } from '../lib/event';
import { ui } from '../lib/i18n';
import { remaining } from '../scripts/countdown';
interface Props { target: string; lang: Lang }
const { target, lang } = Astro.props;
const r = remaining(Date.now(), Date.parse(target));
const unites = ['jours', 'heures', 'minutes', 'secondes'] as const;
---
<div class="countdown" data-countdown={target} role="timer" aria-live="off">
  <ul class="cd-cases" hidden={r.passe}>
    {unites.map((u) => (
      <li><b data-unit={u} class="hand">{String(r[u]).padStart(u === 'jours' ? 1 : 2, '0')}</b>{ui(lang, `compte.${u}`)}</li>
    ))}
  </ul>
  <p class="cd-passe hand" hidden={!r.passe}>{ui(lang, 'compte.passe')}</p>
</div>
<style>
  .countdown { padding: 8px 16px 24px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
  li { background: #fff; border-radius: 18px; padding: 12px 18px; text-align: center; min-width: 80px; box-shadow: 0 6px 16px rgba(236,94,39,.18); font-weight: 700; color: var(--c-texte-doux); }
  b { display: block; font-size: 2.6rem; line-height: 1; color: var(--c-principale); }
  .cd-passe { text-align: center; font-size: 2.6rem; color: var(--c-principale); margin: 0; }
  @media (max-width: 420px) { li { min-width: 64px; padding: 10px 10px; } b { font-size: 2rem; } }
</style>
<script>
  import { mountCountdowns } from '../scripts/countdown';
  mountCountdowns();
</script>
```

- [ ] **Étape 4 : écrire `src/pages/[lang]/index.astro` (version définitive)**

Le bloc « Tu viens ? » affiche un extrait du livre d'or seulement à partir du plan 2. Ici, il contient le titre, la date limite et le bouton.

```astro
---
import Base from '../../layouts/Base.astro';
import Countdown from '../../components/Countdown.astro';
import Polaroid from '../../components/Polaroid.astro';
import Wave from '../../components/Wave.astro';
import { Image } from 'astro:assets';
import { findLieu, t } from '../../lib/event';
import { formatDate, formatHeure, ui } from '../../lib/i18n';
import { getEvent } from '../../lib/load-event';
import { photo } from '../../lib/photos';

const lang = Astro.locals.lang;
const ev = getEvent();
const titre = t(ev.site.titre, lang);
const apercuMoments = ev.moments.slice(0, 3);
const souvenirs = ev.galerie.slice(0, 5);
const rotations = [-6, 4, -2, 7, -4];
---
<Base lang={lang} current="accueil">
  <section class="hero zone-orange">
    <div class="hero-in">
      <div class="hero-txt">
        <span class="kicker">{t(ev.accueil.accroche, lang)}</span>
        <h1 class="hand">{titre}</h1>
        <p class="meta">{formatDate(ev.evenement.date_debut, lang)} · {t(ev.evenement.lieu_court, lang)}</p>
        <a class="btn btn-clair" href={`/${lang}/rsvp`}>{ui(lang, 'accueil.cta')}</a>
      </div>
      <div class="hero-photos">
        <Polaroid src={photo(ev.accueil.photo_principale)} alt="" caption={t(ev.accueil.legende_photo, lang) || undefined} rotate={3} width={520} class="photo1" />
        {ev.accueil.photo_secondaire && (
          <Polaroid src={photo(ev.accueil.photo_secondaire)} alt="" tape={false} rotate={-8} width={180} ratio="1/1" class="photo2" />
        )}
      </div>
    </div>
  </section>
  <Wave />
  <Countdown target={ev.evenement.date_debut} lang={lang} />

  <section class="container histoire">
    {ev.histoire.chapitres.at(-1)?.photo && (
      <Polaroid src={photo(ev.histoire.chapitres.at(-1)!.photo!)} alt="" rotate={-3} width={360} ratio="4/5" />
    )}
    <div>
      <h2 class="titre-section">{ui(lang, 'nav.histoire')}</h2>
      <p>{t(ev.histoire.intro, lang)}</p>
      <a href={`/${lang}/histoire`}>{ui(lang, 'accueil.histoire_lien')}</a>
    </div>
  </section>

  <section class="programme">
    <div class="container">
      <h2 class="titre-section centre" style="color:var(--c-texte)">{ui(lang, 'accueil.programme')}</h2>
      <ul class="cartes">
        {apercuMoments.map((m) => (
          <li class="carte">
            {m.photo && <Image src={photo(m.photo)} alt="" width={400} height={240} class="carte-img" />}
            <div class="carte-txt">
              <h3 class="hand">{t(m.jour, lang) && `${t(m.jour, lang)} `}{formatHeure(m.heure, lang)} · {t(m.titre, lang)}</h3>
              <p>{t(m.description, lang)}</p>
              <p class="lieu">📍 {findLieu(ev, m.lieu).nom}</p>
            </div>
          </li>
        ))}
      </ul>
      <p class="centre"><a class="btn btn-plein" href={`/${lang}/programme`}>{ui(lang, 'accueil.carte')}</a></p>
    </div>
  </section>

  {souvenirs.length > 0 && (
    <section class="souvenirs container">
      <h2 class="titre-section centre">{ui(lang, 'accueil.souvenirs')}</h2>
      <div class="bande">
        {souvenirs.map((g, i) => (
          <Polaroid src={photo(g.photo)} alt={t(g.legende, lang)} tape={false} rotate={rotations[i]} width={200} ratio="1/1" />
        ))}
      </div>
    </section>
  )}

  <section class="tu-viens zone-orange">
    <h2 class="hand">{t(ev.rsvp.titre, lang)}</h2>
    <p>{ui(lang, 'accueil.avant')} {formatDate(ev.evenement.date_limite_rsvp + 'T12:00:00+00:00', lang)}.</p>
    <a class="btn btn-clair" href={`/${lang}/rsvp`}>{ui(lang, 'accueil.confirmer')}</a>
  </section>
</Base>

<style>
  .hero { padding: 24px 16px 8px; }
  .hero-in { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1.05fr .95fr; gap: 32px; align-items: center; }
  .kicker { display: inline-block; background: var(--c-fond); color: var(--c-principale-fonce); font-weight: 800; padding: 4px 12px; border-radius: 10px; }
  .hero h1 { font-size: clamp(3.4rem, 10vw, 6rem); line-height: .9; margin: 16px 0 10px; }
  .hero .meta { margin: 0 0 24px; }
  .hero-photos { position: relative; padding: 12px; }
  .hero-photos :global(.photo2) { position: absolute; width: 38%; left: -6%; bottom: -8%; }
  .histoire { display: grid; grid-template-columns: .8fr 1.2fr; gap: 48px; align-items: center; padding-block: 32px 48px; }
  .programme { background: var(--c-douce); padding: 40px 0 48px; }
  .centre { text-align: center; }
  .cartes { list-style: none; padding: 0; margin: 0 0 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
  .carte { background: var(--c-fond); border-radius: 18px; overflow: hidden; box-shadow: 0 6px 18px rgba(58,36,25,.12); }
  .carte-img { width: 100%; height: 160px; object-fit: cover; }
  .carte-txt { padding: 14px 18px 18px; }
  .carte h3 { font-size: 1.9rem; color: var(--c-principale); margin: 0 0 4px; }
  .carte p { margin: 0; }
  .carte .lieu { color: var(--c-texte-doux); font-size: .95rem; margin-top: 4px; }
  .souvenirs { padding-block: 48px; }
  .bande { display: flex; justify-content: center; flex-wrap: wrap; }
  .bande :global(.pola) { width: 180px; margin: 0 -6px 12px; }
  .tu-viens { text-align: center; padding: 48px 16px; }
  .tu-viens h2 { font-size: clamp(3rem, 8vw, 3.6rem); margin: 0 0 8px; }
  .tu-viens p { margin: 0 0 24px; }
  @media (max-width: 760px) {
    .hero-in, .histoire { grid-template-columns: 1fr; }
    .hero-txt { text-align: center; order: 2; }
    .hero-photos { order: 1; }
    .bande :global(.pola) { width: 140px; }
  }
</style>
```

- [ ] **Étape 5 : écrire le test de bout en bout de l'Accueil**

`tests/e2e/pages.spec.ts` :
```ts
import { expect, test } from '@playwright/test';

test.describe('Accueil', () => {
  test('affiche titre, date, compte à rebours et liens', async ({ page }) => {
    await page.goto('/fr/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coco a 40 ans');
    // La date figure aussi dans le pied de page : on vise celle du bandeau.
    await expect(page.locator('.hero .meta')).toContainText('lundi 14 juin 2027');
    await expect(page.getByRole('timer')).toContainText('jours');
    await expect(page.getByRole('link', { name: 'Je viens ! →' })).toHaveAttribute('href', '/fr/rsvp');
    await expect(page.getByRole('heading', { name: 'Le programme' })).toBeVisible();
  });

  test('version anglaise', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coco turns 40');
    await expect(page.locator('.hero .meta')).toContainText('Monday, June 14, 2027');
  });

  test('compte à rebours passé : message au lieu des chiffres', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-06-15T10:00:00+02:00') });
    await page.goto('/fr/');
    await expect(page.getByText("C'est le grand jour !")).toBeVisible();
    await expect(page.locator('.cd-cases')).toBeHidden();
  });

  test('pas de défilement horizontal à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/fr/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
```

Exécuter : `npx playwright test tests/e2e/pages.spec.ts`
Attendu : RÉUSSI. Le test « compte à rebours passé » fonctionne grâce au script navigateur, qui masque les cases dès son premier passage ; le rendu serveur, lui, utilise l'heure réelle.

- [ ] **Étape 6 : contrôle visuel**

Ouvrir `http://localhost:4321/fr/` sur ordinateur et en vue téléphone (outils de développement, 375 px). Comparer avec `docs/maquettes/01-accueil-photos.html` : polaroïds inclinés, vague, cartes du programme sur fond pêche, bloc orange « Tu viens ? ».

- [ ] **Étape 7 : commit**

```bash
git add -A
git commit -m "Ajoute la page d'accueil et le compte à rebours"
```

---

### Tâche 8 : page Notre histoire et galerie

**Fichiers :**
- Créer : `src/pages/[lang]/histoire.astro`, `src/scripts/lightbox.ts`
- Modifier : `tests/e2e/pages.spec.ts` (ajout)

**Interfaces :**
- Consomme : `Base`, `PageHead`, `Polaroid`, `getEvent`, `photo`, `t`, `ui`.
- Produit : `mountLightbox(root?: ParentNode): void`. Il prend les liens `a[data-lightbox]` (chacun avec `href` = image en grand et `data-caption`) et le `<dialog id="lightbox">`.

- [ ] **Étape 1 : écrire les tests de bout en bout qui échouent** (ajouter à `tests/e2e/pages.spec.ts`)

```ts
test.describe('Notre histoire', () => {
  test('frise et galerie', async ({ page }) => {
    await page.goto('/fr/histoire');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notre histoire');
    for (const annee of ['1987', '2009', '2027']) await expect(page.getByText(annee, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'La galerie' })).toBeVisible();
  });

  test('la visionneuse s’ouvre, défile et se ferme au clavier', async ({ page }) => {
    await page.goto('/fr/histoire');
    await page.locator('a[data-lightbox]').first().click();
    const dlg = page.locator('dialog#lightbox');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('figcaption')).toHaveText('Santé !');
    await page.keyboard.press('ArrowRight');
    await expect(dlg.locator('img')).toHaveAttribute('src', /ballons/);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(dlg.locator('img')).toHaveAttribute('src', /hero/);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });
});
```

> En mode développement, Astro sert les images à une adresse qui contient le nom du fichier d'origine (`/_image?href=…ballons…`), d'où les vérifications par expression régulière.

Exécuter : `npx playwright test tests/e2e/pages.spec.ts -g "Notre histoire" --project=ordinateur`. Attendu : ÉCHEC (404).

- [ ] **Étape 2 : implémenter `src/scripts/lightbox.ts`**

```ts
export function mountLightbox(root: ParentNode = document): void {
  const dlg = root.querySelector<HTMLDialogElement>('dialog#lightbox');
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-lightbox]'));
  if (!dlg || links.length === 0) return;
  const img = dlg.querySelector('img')!;
  const cap = dlg.querySelector('figcaption')!;
  let i = 0;

  const show = (n: number) => {
    i = (n + links.length) % links.length;
    img.src = links[i].href;
    img.alt = links[i].dataset.caption ?? '';
    cap.textContent = links[i].dataset.caption ?? '';
    cap.hidden = !links[i].dataset.caption;
  };

  links.forEach((a, n) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      show(n);
      dlg.showModal();
    }),
  );
  dlg.querySelector('[data-prev]')!.addEventListener('click', () => show(i - 1));
  dlg.querySelector('[data-next]')!.addEventListener('click', () => show(i + 1));
  dlg.querySelector('[data-close]')!.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
  dlg.addEventListener('close', () => links[i].focus());
}
```

- [ ] **Étape 3 : écrire `src/pages/[lang]/histoire.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import PageHead from '../../components/PageHead.astro';
import Polaroid from '../../components/Polaroid.astro';
import { Image, getImage } from 'astro:assets';
import { t } from '../../lib/event';
import { ui } from '../../lib/i18n';
import { getEvent } from '../../lib/load-event';
import { photo } from '../../lib/photos';

const lang = Astro.locals.lang;
const ev = getEvent();
const galerie = await Promise.all(
  ev.galerie.map(async (g, n) => ({
    ...g,
    grand: (await getImage({ src: photo(g.photo), width: 1600 })).src,
    forme: n === 0 ? 'big' : n === 2 ? 'tall' : '',
  })),
);
---
<Base lang={lang} current="histoire" title={ui(lang, 'histoire.titre')}>
  <PageHead title={ui(lang, 'histoire.titre')} subtitle={t(ev.histoire.intro, lang)} />

  {ev.histoire.chapitres.length > 0 && (
    <ol class="frise container">
      {ev.histoire.chapitres.map((c, n) => (
        <li class={`chap ${n % 2 ? 'inverse' : ''}`}>
          {c.photo && <Polaroid src={photo(c.photo)} alt="" caption={t(c.legende, lang) || undefined} rotate={n % 2 ? 3 : -3} width={460} />}
          <div class="chap-txt">
            <p class="annee hand">{c.annee}</p>
            <h2>{t(c.titre, lang)}</h2>
            <p>{t(c.texte, lang)}</p>
          </div>
        </li>
      ))}
    </ol>
  )}

  {galerie.length > 0 && (
    <section class="galerie">
      <div class="container">
        <h2 class="titre-section" style="color:var(--c-texte)">{ui(lang, 'histoire.galerie')}</h2>
        <p class="aide">{ui(lang, 'histoire.galerie_aide')}</p>
        <ul class="mosaique">
          {galerie.map((g) => (
            <li class={g.forme}>
              <a href={g.grand} data-lightbox data-caption={t(g.legende, lang)}>
                <Image src={photo(g.photo)} alt={t(g.legende, lang)} width={600} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )}

  <dialog id="lightbox" aria-label={ui(lang, 'histoire.galerie')}>
    <figure><img src="" alt="" /><figcaption></figcaption></figure>
    <button type="button" data-prev aria-label={ui(lang, 'galerie.precedente')}>‹</button>
    <button type="button" data-next aria-label={ui(lang, 'galerie.suivante')}>›</button>
    <button type="button" data-close aria-label={ui(lang, 'galerie.fermer')}>✕</button>
  </dialog>
</Base>

<style>
  .frise { list-style: none; padding: 32px 0 16px; margin-block: 0; position: relative; }
  .frise::before { content: ''; position: absolute; left: 50%; top: 32px; bottom: 16px; border-left: 3px dashed var(--c-principale); opacity: .5; }
  .chap { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; margin-bottom: 48px; position: relative; }
  .chap::after { content: ''; position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; background: var(--c-principale); border: 4px solid var(--c-fond); border-radius: 50%; box-shadow: 0 0 0 2px var(--c-principale); }
  .chap.inverse > :global(.pola) { order: 2; }
  .annee { font-size: 3.4rem; color: var(--c-principale); line-height: 1; margin: 0; }
  .chap h2 { font-size: 1.3rem; margin: 6px 0 8px; }
  .chap-txt p:last-child { color: var(--c-texte-doux); margin: 0; }
  .galerie { background: var(--c-douce); padding: 40px 0 56px; text-align: center; }
  .aide { margin: 0 0 24px; }
  .mosaique { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 140px; gap: 12px; }
  .mosaique li { border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(58,36,25,.15); }
  .mosaique .big { grid-column: span 2; grid-row: span 2; }
  .mosaique .tall { grid-row: span 2; }
  .mosaique a, .mosaique img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .mosaique a:hover img { transform: scale(1.04); transition: transform .3s; }
  dialog { border: 0; padding: 0; background: transparent; max-width: 92vw; max-height: 92vh; overflow: visible; }
  dialog::backdrop { background: rgba(30,18,12,.85); }
  dialog figure { margin: 0; background: #fff; padding: 12px 12px 44px; position: relative; }
  dialog img { max-width: 86vw; max-height: 78vh; width: auto; height: auto; }
  dialog figcaption { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; font-family: var(--f-titres); font-size: 1.5rem; color: var(--c-texte); }
  dialog button { position: fixed; top: 50%; background: var(--c-fond); color: var(--c-texte); border: 0; width: 48px; height: 48px; border-radius: 50%; font-size: 1.8rem; cursor: pointer; }
  dialog [data-prev] { left: 12px; } dialog [data-next] { right: 12px; }
  dialog [data-close] { top: 12px; right: 12px; font-size: 1.2rem; }
  @media (max-width: 760px) {
    .frise::before, .chap::after { display: none; }
    .chap { grid-template-columns: 1fr; gap: 20px; }
    .chap.inverse > :global(.pola) { order: 0; }
    .mosaique { grid-template-columns: repeat(2, 1fr); }
  }
</style>
<script>
  import { mountLightbox } from '../../scripts/lightbox';
  mountLightbox();
</script>
```

- [ ] **Étape 4 : tester une galerie vide** (point de vigilance 4)

Ajouter à `tests/unit/event.test.ts`, dans `describe('parseEvent')` :
```ts
test('galerie et chapitres absents donnent des listes vides', () => {
  const ev = parseEvent(base, PHOTOS);
  expect(ev.galerie).toHaveLength(0);
  expect(ev.histoire.chapitres).toHaveLength(0);
});
```

La page n'affiche alors ni frise ni galerie, grâce aux conditions `length > 0` ci-dessus.

- [ ] **Étape 5 : vérifier le succès**

Exécuter : `npx vitest run` puis `npx playwright test tests/e2e/pages.spec.ts -g "Notre histoire"`
Attendu : RÉUSSI.

- [ ] **Étape 6 : commit**

```bash
git add -A
git commit -m "Ajoute la page Notre histoire avec frise et galerie"
```

---

### Tâche 9 : page Programme & lieux et carte

**Fichiers :**
- Créer : `src/lib/geo.ts`, `src/scripts/map.ts`, `src/pages/[lang]/programme.astro`
- Tester : `tests/unit/geo.test.ts`, `tests/e2e/pages.spec.ts` (ajout)

**Interfaces :**
- Consomme : `getEvent`, `findLieu`, `photo`, `t`, `ui`, `formatHeure`.
- Produit :
  - `googleMapsUrl(lat: number, lng: number): string` ;
  - `wazeUrl(lat: number, lng: number): string` ;
  - `type MapData = { lieux: { id: string; num: number; nom: string; titre: string; lat: number; lng: number }[]; hebergements: { nom: string; lat: number; lng: number }[]; legendeHebergement: string }` ;
  - `mountMap(el: HTMLElement, data: MapData): void`. L'événement `focus-lieu` (sur `document`, avec `detail` = id) centre la carte.

- [ ] **Étape 1 : test unitaire qui échoue**

`tests/unit/geo.test.ts` :
```ts
import { expect, test } from 'vitest';
import { googleMapsUrl, wazeUrl } from '../../src/lib/geo';

test('liens d’itinéraire', () => {
  expect(googleMapsUrl(44.8378, -0.58)).toBe('https://www.google.com/maps/dir/?api=1&destination=44.8378%2C-0.58');
  expect(wazeUrl(44.8378, -0.58)).toBe('https://waze.com/ul?ll=44.8378%2C-0.58&navigate=yes');
});
```

Exécuter : `npx vitest run tests/unit/geo.test.ts`. Attendu : ÉCHEC.

- [ ] **Étape 2 : implémenter `src/lib/geo.ts`**

```ts
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function wazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`;
}
```

Exécuter : `npx vitest run tests/unit/geo.test.ts`. Attendu : RÉUSSI.

- [ ] **Étape 3 : implémenter `src/scripts/map.ts`**

```ts
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapData = {
  lieux: { id: string; num: number; nom: string; titre: string; lat: number; lng: number }[];
  hebergements: { nom: string; lat: number; lng: number }[];
  legendeHebergement: string;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function pin(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color}"><span>${esc(label)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

export function mountMap(el: HTMLElement, data: MapData): void {
  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const css = getComputedStyle(document.documentElement);
  const orange = css.getPropertyValue('--c-principale-fonce').trim();
  const brun = css.getPropertyValue('--c-texte').trim();
  const markers = new Map<string, L.Marker>();
  const points: L.LatLngExpression[] = [];

  for (const l of data.lieux) {
    const m = L.marker([l.lat, l.lng], { icon: pin(orange, String(l.num)), title: l.nom })
      .addTo(map)
      .bindPopup(`<b>${esc(l.titre)}</b><br>${esc(l.nom)}`);
    if (!markers.has(l.id)) markers.set(l.id, m);
    points.push([l.lat, l.lng]);
  }
  for (const h of data.hebergements) {
    L.marker([h.lat, h.lng], { icon: pin(brun, '🛏'), title: h.nom })
      .addTo(map)
      .bindPopup(`<b>${esc(h.nom)}</b><br>${esc(data.legendeHebergement)}`);
    points.push([h.lat, h.lng]);
  }
  map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });

  document.addEventListener('focus-lieu', (e) => {
    const m = markers.get((e as CustomEvent<string>).detail);
    if (!m) return;
    map.setView(m.getLatLng(), 16);
    m.openPopup();
  });
}
```

> Plusieurs moments au même lieu (accueil et dîner au domaine) donnent des repères superposés. Le premier numéro est retenu pour le centrage, et les deux restent cliquables.

- [ ] **Étape 4 : écrire `src/pages/[lang]/programme.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import PageHead from '../../components/PageHead.astro';
import { Image } from 'astro:assets';
import { findLieu, t } from '../../lib/event';
import { googleMapsUrl, wazeUrl } from '../../lib/geo';
import { formatDate, formatHeure, ui } from '../../lib/i18n';
import { getEvent } from '../../lib/load-event';
import { photo } from '../../lib/photos';
import type { MapData } from '../../scripts/map';

const lang = Astro.locals.lang;
const ev = getEvent();
const etapes = ev.moments.map((m, i) => {
  const lieu = findLieu(ev, m.lieu);
  return { m, lieu, num: i + 1, titre: `${t(m.jour, lang) ? t(m.jour, lang) + ' ' : ''}${formatHeure(m.heure, lang)} · ${t(m.titre, lang)}` };
});
const mapData: MapData = {
  lieux: etapes.map((e) => ({ id: e.lieu.id, num: e.num, nom: e.lieu.nom, titre: e.titre, lat: e.lieu.lat, lng: e.lieu.lng })),
  hebergements: ev.infos.hebergements
    .filter((h) => h.lat !== undefined && h.lng !== undefined)
    .map((h) => ({ nom: h.nom, lat: h.lat!, lng: h.lng! })),
  legendeHebergement: ui(lang, 'programme.legende_hebergements'),
};
---
<Base lang={lang} current="programme" title={ui(lang, 'programme.titre')}>
  <PageHead title={ui(lang, 'programme.titre')} subtitle={formatDate(ev.evenement.date_debut, lang) + ' · ' + t(ev.evenement.lieu_court, lang)} />

  <div class="prog container">
    <ol class="etapes">
      {etapes.map((e) => (
        <li class="etape">
          {e.m.photo && <Image src={photo(e.m.photo)} alt="" width={240} height={300} class="etape-img" />}
          <div class="etape-txt">
            <h2 class="hand"><span aria-hidden="true">{e.num} · </span>{e.titre}</h2>
            <p class="desc">{t(e.m.description, lang)}</p>
            <p class="adresse"><b>{e.lieu.nom}</b><br />{e.lieu.adresse}</p>
            <div class="actions">
              <a class="btn btn-plein btn-petit" href={googleMapsUrl(e.lieu.lat, e.lieu.lng)} target="_blank" rel="noopener">{ui(lang, 'programme.itineraire')}</a>
              <a class="btn btn-contour btn-petit" href={wazeUrl(e.lieu.lat, e.lieu.lng)} target="_blank" rel="noopener">{ui(lang, 'programme.waze')}</a>
              <button class="btn btn-contour btn-petit voir" type="button" data-lieu={e.lieu.id}>{ui(lang, 'programme.voir_carte')}</button>
            </div>
          </div>
        </li>
      ))}
    </ol>
    <div class="carte-box">
      <div id="carte" role="region" aria-label={ui(lang, 'programme.titre')}></div>
      <p class="legende">
        <span><i style="background:var(--c-principale-fonce)"></i>{ui(lang, 'programme.legende_lieux')}</span>
        {mapData.hebergements.length > 0 && <span><i style="background:var(--c-texte)"></i>{ui(lang, 'programme.legende_hebergements')}</span>}
      </p>
    </div>
  </div>

  {ev.infos.hebergements.length > 0 && (
    <div class="dormir container">
      <p>{ui(lang, 'programme.dormir')}</p>
      <a class="btn btn-plein btn-petit" href={`/${lang}/infos#dormir`}>{ui(lang, 'programme.dormir_lien')}</a>
    </div>
  )}

  <script type="application/json" id="map-data" set:html={JSON.stringify(mapData).replace(/</g, '\\u003c')} />
</Base>

<style>
  .prog { display: grid; grid-template-columns: 1fr 1.15fr; gap: 32px; padding-block: 24px 40px; align-items: start; }
  .etapes { list-style: none; padding: 0; margin: 0; }
  .etape { display: grid; grid-template-columns: 110px 1fr; gap: 14px; background: #fff; border-radius: 18px; overflow: hidden; margin-bottom: 16px; box-shadow: 0 6px 16px rgba(58,36,25,.1); }
  .etape-img { width: 100%; height: 100%; min-height: 170px; object-fit: cover; }
  .etape-txt { padding: 14px 16px 16px 0; }
  .etape h2 { font-size: 1.9rem; color: var(--c-principale); margin: 0; }
  .desc { margin: 2px 0 6px; }
  .adresse { color: var(--c-texte-doux); font-size: .95rem; margin: 0 0 10px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .carte-box { position: sticky; top: 12px; }
  #carte { height: 540px; border-radius: 18px; border: 6px solid #fff; box-shadow: 0 10px 24px rgba(58,36,25,.2); z-index: 0; }
  .legende { display: flex; gap: 18px; flex-wrap: wrap; font-weight: 700; font-size: .95rem; }
  .legende i { display: inline-block; width: 14px; height: 14px; border-radius: 50%; vertical-align: -2px; margin-right: 6px; }
  .dormir { background: var(--c-douce); border-radius: 18px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 40px; flex-wrap: wrap; }
  .dormir p { margin: 0; font-weight: 700; }
  :global(.pin) { width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
  :global(.pin span) { transform: rotate(45deg); color: #fff; font-weight: 800; font-size: 14px; }
  @media (max-width: 860px) {
    .prog { grid-template-columns: 1fr; }
    .carte-box { position: static; }
    #carte { height: 380px; }
  }
  @media (max-width: 420px) { .etape { grid-template-columns: 1fr; } .etape-img { min-height: 0; height: 160px; } .etape-txt { padding: 0 16px 16px; } }
</style>

<script>
  import { mountMap, type MapData } from '../../scripts/map';
  const el = document.getElementById('carte');
  const data = JSON.parse(document.getElementById('map-data')!.textContent!) as MapData;
  if (el) mountMap(el, data);
  document.querySelectorAll<HTMLButtonElement>('button.voir').forEach((b) =>
    b.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('focus-lieu', { detail: b.dataset.lieu }));
      if (window.matchMedia('(max-width: 860px)').matches) el?.scrollIntoView({ behavior: 'smooth' });
    }),
  );
</script>
```

> Écart assumé avec la maquette : au lieu de rendre toute la carte d'étape cliquable, un bouton « Voir sur la carte » explicite déclenche le centrage. C'est accessible au clavier et ne capte pas les clics destinés aux liens d'itinéraire.

- [ ] **Étape 5 : test de bout en bout** (ajouter à `tests/e2e/pages.spec.ts`)

```ts
test.describe('Programme & lieux', () => {
  test('étapes, liens d’itinéraire et carte', async ({ page }) => {
    await page.goto('/fr/programme');
    await expect(page.getByRole('heading', { level: 2, name: /Dîner/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Itinéraire Google Maps' }).first())
      .toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=44\.8378/);
    await expect(page.locator('#carte .leaflet-marker-icon')).toHaveCount(6);
    await page.getByRole('button', { name: 'Voir sur la carte' }).nth(2).click();
    await expect(page.locator('.leaflet-popup')).toContainText('La Guinguette');
  });

  test('version anglaise des heures', async ({ page }) => {
    await page.goto('/en/programme');
    await expect(page.getByRole('heading', { level: 2, name: /7 pm · Dinner/ })).toBeVisible();
  });
});
```

Exécuter : `npx playwright test tests/e2e/pages.spec.ts -g "Programme"`
Attendu : RÉUSSI. Six repères : 4 lieux de moments et 2 hébergements avec coordonnées.

- [ ] **Étape 6 : commit**

```bash
git add -A
git commit -m "Ajoute la page Programme et lieux avec carte interactive"
```

---

### Tâche 10 : page Infos pratiques

**Fichiers :**
- Créer : `src/pages/[lang]/infos.astro`
- Modifier : `tests/e2e/pages.spec.ts` (ajout), `tests/unit/event.test.ts` (ajout)

**Interfaces :**
- Consomme : `Base`, `PageHead`, `getEvent`, `photo`, `t`, `ui`.

- [ ] **Étape 1 : test unitaire des rubriques facultatives** (point de vigilance 4)

Ajouter à `tests/unit/event.test.ts`, dans `describe('parseEvent')` :
```ts
test('infos absentes : listes vides et rubriques indéfinies', () => {
  const ev = parseEvent(base, PHOTOS);
  expect(ev.infos).toEqual({ hebergements: [], faq: [] });
});

test('infos partielles : seule la tenue', () => {
  const ev = parseEvent(base + '\ninfos:\n  tenue: { texte: "Chic" }\n', PHOTOS);
  expect(ev.infos.tenue).toEqual({ texte: { fr: 'Chic' }, couleurs: [] });
  expect(ev.infos.cadeaux).toBeUndefined();
});
```

Exécuter : `npx vitest run tests/unit/event.test.ts`. Attendu : RÉUSSI (le comportement vient du schéma de la tâche 2).

- [ ] **Étape 2 : test de bout en bout qui échoue** (ajouter à `tests/e2e/pages.spec.ts`)

```ts
test.describe('Infos pratiques', () => {
  test('rubriques, ancres et FAQ dépliable', async ({ page }) => {
    await page.goto('/fr/infos');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Infos pratiques');
    for (const h of ['Où dormir', 'Tenue', 'Cadeaux', 'Accès & parking', 'Contact', 'Questions fréquentes']) {
      await expect(page.getByRole('heading', { name: h })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Réserver' })).toHaveCount(3);
    await page.getByRole('link', { name: /Où dormir/ }).first().click();
    await expect(page).toHaveURL(/#dormir$/);
    const q = page.getByText('Puis-je venir accompagné(e) ?');
    await q.click();
    await expect(page.getByText('Indique simplement tes accompagnants')).toBeVisible();
  });
});
```

Exécuter : `npx playwright test tests/e2e/pages.spec.ts -g "Infos"`. Attendu : ÉCHEC (404).

- [ ] **Étape 3 : écrire `src/pages/[lang]/infos.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import PageHead from '../../components/PageHead.astro';
import { Image } from 'astro:assets';
import { t } from '../../lib/event';
import { ui } from '../../lib/i18n';
import { getEvent } from '../../lib/load-event';
import { photo } from '../../lib/photos';

const lang = Astro.locals.lang;
const ev = getEvent();
const { hebergements, tenue, cadeaux, acces, faq } = ev.infos;
const contact = ev.site.contact;
const pastilles = [
  hebergements.length > 0 && ['dormir', '🛏', ui(lang, 'infos.dormir')],
  tenue && ['tenue', '👗', ui(lang, 'infos.tenue')],
  cadeaux && ['cadeaux', '🎁', ui(lang, 'infos.cadeaux')],
  acces && ['acces', '🚗', ui(lang, 'infos.acces')],
  faq.length > 0 && ['faq', '❓', ui(lang, 'infos.faq')],
  ['contact', '📞', ui(lang, 'infos.contact')],
].filter(Boolean) as [string, string, string][];
---
<Base lang={lang} current="infos" title={ui(lang, 'infos.titre')}>
  <PageHead title={ui(lang, 'infos.titre')} subtitle={ui(lang, 'infos.sous_titre')} />

  <div class="container infos">
    <nav class="pastilles" aria-label={ui(lang, 'infos.titre')}>
      {pastilles.map(([id, icone, label]) => <a href={`#${id}`}><span aria-hidden="true">{icone}</span> {label}</a>)}
    </nav>

    {hebergements.length > 0 && (
      <section id="dormir">
        <h2 class="titre-section">{ui(lang, 'infos.dormir')}</h2>
        <ul class="hotels">
          {hebergements.map((h) => (
            <li class="hotel">
              {h.photo && <Image src={photo(h.photo)} alt="" width={420} height={240} class="hotel-img" />}
              <div class="hotel-txt">
                {h.etiquette && <span class="tag">{t(h.etiquette, lang)}</span>}
                <h3>{h.nom}</h3>
                <p class="meta">{[h.distance, h.prix].filter(Boolean).join(' · ')}</p>
                {h.lien && <a class="btn btn-plein btn-petit" href={h.lien} target="_blank" rel="noopener">{ui(lang, 'infos.reserver')}<span class="sr-only"> : {h.nom}</span></a>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    )}

    <div class="boites">
      {tenue && (
        <section id="tenue" class="boite">
          <h2 class="hand">👗 {ui(lang, 'infos.tenue')}</h2>
          <p>{t(tenue.texte, lang)}</p>
          {tenue.couleurs.length > 0 && <div class="nuancier" aria-hidden="true">{tenue.couleurs.map((c) => <i style={`background:${c}`}></i>)}</div>}
        </section>
      )}
      {cadeaux && (
        <section id="cadeaux" class="boite">
          <h2 class="hand">🎁 {ui(lang, 'infos.cadeaux')}</h2>
          <p>{t(cadeaux.texte, lang)}</p>
          {cadeaux.lien_cagnotte && <a class="btn btn-plein btn-petit" href={cadeaux.lien_cagnotte} target="_blank" rel="noopener">{ui(lang, 'infos.cagnotte')}</a>}
        </section>
      )}
      {acces && (
        <section id="acces" class="boite">
          <h2 class="hand">🚗 {ui(lang, 'infos.acces')}</h2>
          <p>{t(acces.texte, lang)}</p>
        </section>
      )}
      <section id="contact" class="boite">
        <h2 class="hand">📞 {ui(lang, 'infos.contact')}</h2>
        <p>{contact.nom}{contact.telephone && <><br /><b>{contact.telephone}</b></>}<br />{contact.email}</p>
        <a class="btn btn-contour btn-petit" href={`mailto:${contact.email}`}>{ui(lang, 'infos.ecrire')}</a>
      </section>
    </div>

    {faq.length > 0 && (
      <section id="faq" class="faq">
        <h2 class="titre-section">{ui(lang, 'infos.faq')}</h2>
        {faq.map((f, i) => (
          <details open={i === 0}>
            <summary>{t(f.question, lang)}</summary>
            <p>{t(f.reponse, lang)}</p>
          </details>
        ))}
      </section>
    )}
  </div>
</Base>

<style>
  .infos { padding-block: 16px 48px; }
  section { scroll-margin-top: 16px; }
  .pastilles { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 28px; }
  .pastilles a { background: #fff; border: 2px solid var(--c-douce); border-radius: 30px; padding: 8px 16px; color: var(--c-texte); text-decoration: none; }
  .hotels { list-style: none; padding: 0; margin: 0 0 36px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
  .hotel { background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 6px 16px rgba(58,36,25,.1); }
  .hotel-img { width: 100%; height: 140px; object-fit: cover; }
  .hotel-txt { padding: 14px 16px 18px; }
  .hotel h3 { margin: 6px 0 2px; font-size: 1.1rem; }
  .tag { display: inline-block; background: var(--c-douce); border-radius: 8px; padding: 2px 8px; font-size: .85rem; font-weight: 800; }
  .meta { color: var(--c-texte-doux); margin: 0 0 10px; font-size: .95rem; }
  .boites { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-bottom: 36px; }
  .boite { background: #fff; border-radius: 18px; padding: 20px 22px; box-shadow: 0 6px 16px rgba(58,36,25,.1); }
  .boite h2 { font-size: 2.1rem; color: var(--c-principale); margin: 0 0 6px; }
  .boite p { color: var(--c-texte-doux); margin: 0 0 12px; }
  .nuancier { display: flex; gap: 8px; }
  .nuancier i { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1px #ddd; }
  details { background: #fff; border-radius: 14px; padding: 14px 18px; margin-bottom: 10px; box-shadow: 0 3px 10px rgba(58,36,25,.08); }
  summary { font-weight: 800; cursor: pointer; }
  details p { margin: 10px 0 0; color: var(--c-texte-doux); }
</style>
```

- [ ] **Étape 4 : vérifier le succès**

Exécuter : `npx playwright test tests/e2e/pages.spec.ts -g "Infos"`. Attendu : RÉUSSI.

- [ ] **Étape 5 : commit**

```bash
git add -A
git commit -m "Ajoute la page Infos pratiques"
```

---

### Tâche 11 : accessibilité, téléphone et vérification finale

**Fichiers :**
- Créer : `tests/e2e/accessibilite.spec.ts`
- Modifier : les styles concernés si un contrôle échoue

**Interfaces :** aucune nouvelle.

- [ ] **Étape 1 : écrire les tests**

`tests/e2e/accessibilite.spec.ts` :
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/fr/', '/en/', '/fr/histoire', '/fr/programme', '/fr/infos'];

for (const url of PAGES) {
  test(`${url} : aucune violation WCAG AA`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('.leaflet-container').analyze();
    expect(res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });

  test(`${url} : pas de défilement horizontal à 360 px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('menu téléphone : s’ouvre au clic', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/fr/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');
});
```

> La carte Leaflet est exclue de l'analyse axe : ses contrôles internes sont du code tiers, que l'on ne modifie pas.

- [ ] **Étape 2 : exécuter et corriger**

Exécuter : `npx playwright test tests/e2e/accessibilite.spec.ts --project=ordinateur`
Attendu : RÉUSSI. En cas de violation `color-contrast`, appliquer la règle des contraintes globales : passer l'élément en `var(--c-principale-fonce)` ou l'agrandir et le mettre en gras sur fond orange. Ne pas changer les couleurs du thème. Relancer jusqu'au succès.

- [ ] **Étape 3 : suite complète**

Exécuter : `npm test && npx playwright test && npm run build`
Attendu : tous les tests réussis dans les deux projets (ordinateur et téléphone), build sans erreur.

- [ ] **Étape 4 : mettre à jour le `README.md`**

Ajouter avant « Projet en cours de développement. » :
~~~markdown
## Démarrer en local

Prérequis : [Node.js](https://nodejs.org) 22 ou plus.

```bash
npm install
npm run dev
```

Ouvrir http://localhost:4321. Le contenu se modifie dans [`evenement/`](evenement/LISEZMOI.md).

## Tests

```bash
npm test            # tests unitaires
npm run test:e2e    # tests dans le navigateur
```
~~~

- [ ] **Étape 5 : commit et envoi**

```bash
git add -A
git commit -m "Ajoute les contrôles d'accessibilité et la documentation de démarrage"
git push
```

---

## Suite

Après validation de ce plan exécuté, rédiger le **plan 2** (base de données, RSVP & livre d'or, e-mails, invitation PDF) à partir des sections 6 à 9 de la spécification, puis le **plan 3** (admin, CSV, PDF de la liste, déploiement) à partir des sections 10 et 13.
