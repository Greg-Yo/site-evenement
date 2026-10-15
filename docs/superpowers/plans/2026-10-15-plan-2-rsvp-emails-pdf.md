# Plan 2 : confirmations, livre d'or, e-mails et invitation PDF

> **Pour les exécutants :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**Objectif :** un invité confirme sa présence sur `/{lang}/rsvp` (avec ou sans JavaScript), la réponse est enregistrée, son message apparaît dans le livre d'or, et il reçoit un e-mail avec son invitation PDF personnalisée et un lien pour modifier sa réponse.

**Architecture :**
- La logique vit dans des modules purs et testés : validation (`rsvp.ts`), base (`db.ts`), anti-spam (`limites.ts`), e-mails (`mail/`), PDF (`pdf/`), orchestration (`rsvp-service.ts`). Les pages Astro ne font qu'appeler l'orchestration et afficher le résultat.
- Base libSQL : fichier local `.data/local.db`, Turso en ligne (plan 3).
- E-mails : en local, enregistrés dans `.data/outbox/` ; en ligne, envoyés par l'API Brevo ou Resend.
- Le formulaire est traité directement par la page `/{lang}/rsvp` en `POST`. C'est le principe du formulaire HTML classique, qui fonctionne sans JavaScript.

**Pile technique :** Astro 7.3 (rendu serveur), @libsql/client 0.18, pdf-lib 1.17 + @pdf-lib/fontkit 1.1, qrcode, sharp, zod 4.6, Vitest 5 (+ happy-dom pour un test DOM), Playwright.

**Spécification :** `docs/superpowers/specs/2026-10-12-site-evenement-design.md`, sections 3 (page 5), 6, 7, 8 et 9. Suivi du plan 1 : `docs/superpowers/plans/2026-10-13-suivi-plan-1.md`. Maquette : `docs/maquettes/03-infos-rsvp.html` (partie RSVP) et `04-admin-email-pdf.html` (e-mail, PDF).

**Écarts assumés avec la spécification** (décisions du responsable, à ne pas « corriger ») :
- **Pas de point d'entrée `POST /api/rsvp` séparé :** la page `/{lang}/rsvp` traite son propre `POST`, et la page `/{lang}/rsvp/modifier` aussi. Le comportement demandé (fonctionne sans JavaScript, mêmes validations) est inchangé, avec moins de code.
- **Pas de photo dans l'e-mail :** une image dans un e-mail exige une adresse publique accessible (impossible en local avec `localhost`). La photo figure sur l'invitation PDF jointe ; l'e-mail garde le bandeau aux couleurs du site.
- **Rechargement après envoi :** recharger la page de remerciement renvoie le formulaire ; l'invité voit « déjà répondu » et reçoit à nouveau son lien (borné par la limite d'envois). Accepté pour ne pas mettre de données personnelles dans une adresse de redirection.
- **Test d'intégration (§12) :** couvert par les tests unitaires du service (base en mémoire, boîte d'envoi factice) et par les tests de bout en bout (boîte d'envoi réelle).
- **Consultation de la boîte d'envoi de test :** l'onglet prévu dans l'admin arrive avec l'admin (plan 3). En attendant, on ouvre directement les fichiers `.data/outbox/*/message.html`.

## Contraintes globales

- **Variables d'environnement** (noms exacts) :
  - `DATABASE_URL` : défaut `file:.data/local.db` ;
  - `DATABASE_TOKEN` ;
  - `MAIL_MODE` : `outbox` par défaut, ou `api` ;
  - `MAIL_PROVIDER` : `brevo` ou `resend` ;
  - `MAIL_API_KEY` ;
  - `MAIL_FROM` : adresse e-mail de l'expéditeur ;
  - `OUTBOX_DIR` : défaut `.data/outbox` ;
  - `RSVP_LIMITE` : défaut `5` ;
  - `MAINTENANT_TEST` : réservé aux tests, fige l'horloge des réponses.
- **Anti-spam :** 5 envois au plus par adresse IP toutes les 10 minutes (clé `rsvp:<ip>`), compteur stocké dans la table `limites`, entrées de plus de 24 h purgées.
- **Validation :**
  - nom de 2 à 100 caractères ;
  - e-mail valide de 254 caractères au plus, comparé sans tenir compte de la casse ;
  - téléphone de 30 caractères au plus ;
  - 10 accompagnants au plus, de 1 à 100 caractères chacun ;
  - au moins un moment si l'invité vient, et uniquement des moments du YAML ;
  - message de 1 000 caractères au plus.
- **Date limite :** les réponses sont ouvertes tant que la date du jour, **dans le fuseau de l'événement** (celui de `date_debut`), est inférieure ou égale à `date_limite_rsvp`.
- **Une réponse par adresse e-mail.** Un second envoi avec la même adresse ne modifie rien : il renvoie le lien de modification à cette adresse.
- **Données personnelles :** jamais dans une URL, sauf le jeton opaque du lien de modification. Tout texte saisi par un invité est échappé en HTML (page, e-mail).
- **Textes d'interface :** tutoiement, en FR et EN, dans `src/lib/i18n.ts`.
- **Astro 7 :**
  - les espaces avant un élément en ligne disparaissent : ajouter `{" "}` quand un espace visible est voulu ;
  - une imbrication HTML invalide (bloc dans `<p>`) casse la compilation ;
  - une règle `display:` écrase l'attribut `hidden` : ajouter `[hidden] { display: none }` quand on s'en sert.
- **Contraste :** le texte crème sur fond orange est en gras et fait au moins 1.2rem ; le petit texte orange utilise `var(--c-principale-fonce)`.
- **Tests de bout en bout :** serveur dédié sur le port **4322**, avec une base et une boîte d'envoi de test (`.data/test.db`, `.data/test-outbox`) vidées avant chaque exécution, et une horloge figée (`MAINTENANT_TEST`).
- **Commits :** en français, à l'impératif, sans ligne de co-auteur.

## Points de vigilance

1. **Texte hostile** (`<script>`, `&`, guillemets) dans le nom ou le message : affiché tel quel, échappé dans la page et dans l'e-mail, jamais interprété. Testé aux tâches 5 et 8.
2. **Caractères absents des polices** (emoji, idéogrammes) dans un nom ou un titre de moment : le PDF se génère quand même, sans erreur. Testé à la tâche 6.
3. **Même adresse écrite autrement** (`  Camille@Exemple.FR `) : traitée comme un doublon, pas de seconde réponse. Testé aux tâches 2, 7 et 8.
4. **Échec d'envoi d'e-mail** (fournisseur indisponible) : la réponse est enregistrée, la page indique que l'e-mail arrivera plus tard, `email_envoye = 0`. Testé à la tâche 7.
5. **Rechargement de la page après envoi** (renvoi du même formulaire) : aucune seconde réponse, message « déjà répondu ». Testé aux tâches 7 et 8.

---

## Structure des fichiers

```
src/lib/
  moments.ts              # momentLabel()                                  (tâche 1)
  db.ts                   # Db (libSQL), openDb(), getDb()                (tâche 2)
  limites.ts              # depasseLimite()                                (tâche 2)
  rsvp.ts                 # lireFormulaire(), valider(), rsvpOuvert()      (tâche 3)
  mail/types.ts           # Message, PieceJointe, Expediteur               (tâche 4)
  mail/outbox.ts          # creerOutbox()                                  (tâche 4)
  mail/api.ts             # payloadBrevo(), payloadResend(), creerApi()    (tâche 4)
  mail/index.ts           # getExpediteur()                                (tâche 4)
  mail/templates.ts       # emailConfirmation(), emailRegrets(), emailLienModification() (tâche 5)
  pdf/invitation.ts       # genererInvitation()                            (tâche 6)
  pdf/ressources.ts       # polices(), photoJpeg()                         (tâche 6)
  rsvp-service.ts         # soumettre(), modifier()                        (tâche 7)
  services.ts             # getDeps() : câblage réel                       (tâche 8)
src/assets/fonts/         # Caveat-Bold.ttf, Nunito-Regular.ttf, Nunito-ExtraBold.ttf (tâche 6)
src/components/RsvpForm.astro, LivreDor.astro                             (tâche 8)
src/scripts/rsvp-form.ts                                                  (tâche 8)
src/pages/[lang]/rsvp.astro                                               (tâche 8)
src/pages/[lang]/rsvp/modifier.astro                                      (tâche 9)
tests/unit/moments.test.ts, countdown-dom.test.ts, db.test.ts, limites.test.ts, rsvp.test.ts,
           mail.test.ts, templates.test.ts, pdf.test.ts, rsvp-service.test.ts
tests/e2e/outbox.ts (aide), rsvp.spec.ts
```

---

### Tâche 1 : corrections de la revue du plan 1

**Fichiers :**
- Créer : `src/lib/moments.ts`, `tests/unit/moments.test.ts`, `tests/unit/countdown-dom.test.ts`
- Modifier : `src/scripts/countdown.ts`, `src/scripts/lightbox.ts`, `src/scripts/map.ts`, `src/components/Polaroid.astro`, `src/lib/event.ts`, `src/layouts/Base.astro`, `src/pages/[lang]/index.astro`, `src/pages/[lang]/programme.astro`, `evenement/evenement.yaml`, `evenement/LISEZMOI.md`, `tests/unit/event.test.ts`, `tests/e2e/pages.spec.ts`, `package.json` (happy-dom)

**Interfaces :**
- Produit :
  - `momentLabel(m: EventConfig['moments'][number], lang: Lang): string` ;
  - `afficher(el: HTMLElement, r: ReturnType<typeof remaining>): void` (dans `countdown.ts`) ;
  - champ facultatif `site.logo?: string`.

- [ ] **Étape 1 : installer happy-dom**

Exécuter : `npm install --save-dev happy-dom`

- [ ] **Étape 2 : écrire les tests qui échouent**

`tests/unit/moments.test.ts` :
```ts
import { expect, test } from 'vitest';
import { momentLabel } from '../../src/lib/moments';

const m = { id: 'brunch', heure: '11:00', jour: { fr: 'Dimanche', en: 'Sunday' }, titre: { fr: 'Brunch', en: 'Brunch' }, lieu: 'x' };

test('momentLabel avec jour', () => {
  expect(momentLabel(m, 'fr')).toBe('Dimanche 11 h · Brunch');
  expect(momentLabel(m, 'en')).toBe('Sunday 11 am · Brunch');
});

test('momentLabel sans jour', () => {
  expect(momentLabel({ ...m, jour: undefined, heure: '19:30', titre: { fr: 'Dîner' } }, 'fr')).toBe('19 h 30 · Dîner');
});
```

`tests/unit/countdown-dom.test.ts` :
```ts
// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { afficher } from '../../src/scripts/countdown';

function monter(casesCachees: boolean) {
  document.body.innerHTML = `<div data-countdown="x"><ul class="cd-cases"${casesCachees ? ' hidden' : ''}>
    <li><b data-unit="jours"></b></li><li><b data-unit="heures"></b></li></ul><p class="cd-passe"${casesCachees ? '' : ' hidden'}>fin</p></div>`;
  return document.querySelector<HTMLElement>('[data-countdown]')!;
}

test('réaffiche les cases si le serveur croyait la date passée', () => {
  const el = monter(true);
  afficher(el, { jours: 3, heures: 4, minutes: 0, secondes: 0, passe: false });
  expect(el.querySelector('.cd-cases')!.hasAttribute('hidden')).toBe(false);
  expect(el.querySelector('.cd-passe')!.hasAttribute('hidden')).toBe(true);
  expect(el.querySelector('[data-unit="jours"]')!.textContent).toBe('3');
  expect(el.querySelector('[data-unit="heures"]')!.textContent).toBe('04');
});

test('masque les cases quand la date est passée', () => {
  const el = monter(false);
  afficher(el, { jours: 0, heures: 0, minutes: 0, secondes: 0, passe: true });
  expect(el.querySelector('.cd-cases')!.hasAttribute('hidden')).toBe(true);
  expect(el.querySelector('.cd-passe')!.hasAttribute('hidden')).toBe(false);
});
```

Ajouter dans `tests/unit/event.test.ts`, dans `describe('parseEvent')` :
```ts
test('refuse un lien javascript:', () => {
  const yaml = base + '\ninfos:\n  cadeaux: { texte: "x", lien_cagnotte: "javascript:alert(1)" }\n';
  expect(problemsOf(yaml).some((p) => p.startsWith('infos.cadeaux.lien_cagnotte :'))).toBe(true);
});

test('logo facultatif', () => {
  expect(parseEvent(base, PHOTOS).site.logo).toBeUndefined();
  const ev = parseEvent(base.replace('site:\n', 'site:\n  logo: "Coco"\n'), PHOTOS);
  expect(ev.site.logo).toBe('Coco');
});
```

Exécuter : `npx vitest run tests/unit/moments.test.ts tests/unit/countdown-dom.test.ts tests/unit/event.test.ts`
Attendu : ÉCHEC (modules ou exports manquants, lien `javascript:` accepté, champ `logo` inconnu retiré par zod).

- [ ] **Étape 3 : implémenter**

`src/lib/moments.ts` :
```ts
import { t, type EventConfig, type Lang } from './event';
import { formatHeure } from './i18n';

export function momentLabel(m: EventConfig['moments'][number], lang: Lang): string {
  const jour = t(m.jour, lang);
  return `${jour ? jour + ' ' : ''}${formatHeure(m.heure, lang)} · ${t(m.titre, lang)}`;
}
```

`src/scripts/countdown.ts` : remplacer `mountCountdowns` par la version ci-dessous. `remaining` est inchangée.
```ts
export function afficher(el: HTMLElement, r: ReturnType<typeof remaining>): void {
  el.querySelector('.cd-cases')?.toggleAttribute('hidden', r.passe);
  el.querySelector('.cd-passe')?.toggleAttribute('hidden', !r.passe);
  if (r.passe) return;
  for (const k of ['jours', 'heures', 'minutes', 'secondes'] as const) {
    const span = el.querySelector(`[data-unit="${k}"]`);
    if (span) span.textContent = String(r[k]).padStart(k === 'jours' ? 1 : 2, '0');
  }
}

export function mountCountdowns(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-countdown]').forEach((el) => {
    const target = Date.parse(el.dataset.countdown!);
    const tick = () => {
      const r = remaining(Date.now(), target);
      afficher(el, r);
      return !r.passe;
    };
    if (tick()) {
      const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000);
    }
  });
}
```

`src/scripts/lightbox.ts` : mémoriser la photo qui a ouvert la visionneuse.
- Déclarer `let ouvreur = 0;` à côté de `let i = 0;`.
- Dans le gestionnaire de clic, ajouter `ouvreur = n;` avant `show(n);`.
- Remplacer la dernière ligne par `dlg.addEventListener('close', () => links[ouvreur].focus());`.

`src/scripts/map.ts` : remplacer `if (!markers.has(l.id)) markers.set(l.id, m);` par `markers.set(l.id, m);`.

`src/components/Polaroid.astro` : remplacer `sizes={`${width}px`}` par `sizes={`(max-width: 760px) 90vw, ${width}px`}`.

`src/lib/event.ts` :
- dans `site`, ajouter `logo: z.string().optional(),` ;
- remplacer `z.url()` par `z.url({ protocol: /^https?$/ })` pour `url_publique`, `infos.hebergements[].lien` et `infos.cadeaux.lien_cagnotte` (n'accepte que http et https ; `z.httpUrl()` est à éviter car il refuse `localhost`, utilisé par le contenu d'exemple).

`src/layouts/Base.astro` : remplacer `const logo = siteTitre.split(' ')[0];` par `const logo = ev.site.logo ?? siteTitre;`.

`evenement/evenement.yaml` : dans `site:`, ajouter `logo: "Coco"` sous `titre`. `evenement/LISEZMOI.md` : dans la ligne `site` du tableau, ajouter « logo (facultatif, court ; à défaut, le titre complet) ».

`src/pages/[lang]/index.astro` : importer `momentLabel` depuis `../../lib/moments` et remplacer le contenu du `<h3 class="hand">` des cartes par `{momentLabel(m, lang)}`. Supprimer l'import de `formatHeure` s'il n'est plus utilisé.

`src/pages/[lang]/programme.astro` : importer `momentLabel` et remplacer la construction de `titre` par `titre: momentLabel(m, lang)`. Supprimer l'import de `formatHeure` s'il n'est plus utilisé.

- [ ] **Étape 4 : test de bout en bout de la visionneuse** (ajouter dans `describe('Notre histoire')` de `tests/e2e/pages.spec.ts`)

```ts
test('la visionneuse rend le focus à la photo qui l’a ouverte', async ({ page }) => {
  await page.goto('/fr/histoire');
  const premier = page.locator('a[data-lightbox]').first();
  await premier.click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(premier).toBeFocused();
});
```

- [ ] **Étape 5 : vérifier**

Exécuter : `npx vitest run`, `npx playwright test tests/e2e/pages.spec.ts`, `npm run build`
Attendu : tout RÉUSSI.

- [ ] **Étape 6 : commit**

```bash
git add -A
git commit -m "Corrige les points relevés par la revue du plan 1"
```

---

### Tâche 2 : base de données et anti-spam

**Fichiers :**
- Créer : `src/lib/db.ts`, `src/lib/limites.ts`, `tests/unit/db.test.ts`, `tests/unit/limites.test.ts`
- Modifier : `package.json` (dépendance `@libsql/client`)

**Interfaces :**
- Produit :
  - `type Reponse = { id: number; jeton: string; langue: Lang; vient: boolean; nom: string; email: string; telephone: string | null; accompagnants: string[]; moments: string[]; message: string | null; messageMasque: boolean; emailEnvoye: boolean; creeLe: string; modifieLe: string }` ;
  - `type NouvelleReponse = Pick<Reponse, 'langue' | 'vient' | 'nom' | 'email' | 'telephone' | 'accompagnants' | 'moments' | 'message'>` ;
  - `class Db` avec les méthodes :
    - `ajouter(r: NouvelleReponse, maintenant: Date): Promise<Reponse>`, qui lève `ErreurDoublon` si l'e-mail existe ;
    - `parEmail(email: string): Promise<Reponse | null>` ;
    - `parJeton(jeton: string): Promise<Reponse | null>` ;
    - `modifier(jeton: string, r: Omit<NouvelleReponse, 'email'>, maintenant: Date): Promise<Reponse | null>` ;
    - `marquerEmailEnvoye(id: number, envoye: boolean): Promise<void>` ;
    - `messagesVisibles(limite: number): Promise<{ nom: string; message: string; creeLe: string }[]>`, du plus récent au plus ancien ;
    - `ajouterTentative(cle: string, maintenant: Date): Promise<void>` ;
    - `compterTentatives(cle: string, depuis: Date): Promise<number>` ;
    - `purgerTentatives(avant: Date): Promise<void>` ;
  - `class ErreurDoublon extends Error` ;
  - `openDb(url: string, authToken?: string): Promise<Db>` ;
  - `getDb(): Promise<Db>` (singleton lu depuis l'environnement) ;
  - `depasseLimite(db: Db, cle: string, max: number, fenetreMs: number, maintenant: Date): Promise<boolean>`.

- [ ] **Étape 1 : installer**

Exécuter : `npm install @libsql/client@^0.18.0`

- [ ] **Étape 2 : écrire les tests qui échouent**

`tests/unit/db.test.ts` :
```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { ErreurDoublon, openDb, type Db, type NouvelleReponse } from '../../src/lib/db';

const T0 = new Date('2027-01-10T10:00:00Z');
const camille: NouvelleReponse = {
  langue: 'fr', vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', telephone: null,
  accompagnants: ['Léo Martin'], moments: ['accueil', 'diner'], message: 'Joyeux anniversaire !',
};

let db: Db;
beforeEach(async () => { db = await openDb(':memory:'); });

describe('réponses', () => {
  test('ajouter puis relire par e-mail (insensible à la casse) et par jeton', async () => {
    const r = await db.ajouter(camille, T0);
    expect(r.id).toBeGreaterThan(0);
    expect(r.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r).toMatchObject({ ...camille, messageMasque: false, emailEnvoye: false, creeLe: T0.toISOString() });
    expect((await db.parEmail('CAMILLE@exemple.FR'))?.id).toBe(r.id);
    expect((await db.parJeton(r.jeton))?.nom).toBe('Camille Martin');
    expect(await db.parJeton('inconnu')).toBeNull();
  });

  test('refuse un doublon d’e-mail', async () => {
    await db.ajouter(camille, T0);
    await expect(db.ajouter({ ...camille, email: 'Camille@Exemple.fr' }, T0)).rejects.toBeInstanceOf(ErreurDoublon);
  });

  test('modifier conserve l’e-mail et met à jour la date', async () => {
    const r = await db.ajouter(camille, T0);
    const T1 = new Date('2027-01-11T10:00:00Z');
    const m = await db.modifier(r.jeton, { ...camille, vient: false, accompagnants: [], moments: [], message: null }, T1);
    expect(m).toMatchObject({ email: 'camille@exemple.fr', vient: false, accompagnants: [], modifieLe: T1.toISOString(), creeLe: T0.toISOString() });
    expect(await db.modifier('inconnu', camille, T1)).toBeNull();
  });

  test('marquerEmailEnvoye', async () => {
    const r = await db.ajouter(camille, T0);
    await db.marquerEmailEnvoye(r.id, true);
    expect((await db.parJeton(r.jeton))?.emailEnvoye).toBe(true);
  });

  test('messagesVisibles : récents d’abord, sans messages vides', async () => {
    await db.ajouter(camille, T0);
    await db.ajouter({ ...camille, email: 'b@exemple.fr', nom: 'Thomas', message: null }, new Date('2027-01-11T00:00:00Z'));
    await db.ajouter({ ...camille, email: 'c@exemple.fr', nom: 'Emma', message: 'Happy birthday!' }, new Date('2027-01-12T00:00:00Z'));
    expect((await db.messagesVisibles(10)).map((m) => m.nom)).toEqual(['Emma', 'Camille Martin']);
    expect(await db.messagesVisibles(1)).toHaveLength(1);
  });
});
```

`tests/unit/limites.test.ts` :
```ts
import { expect, test } from 'vitest';
import { openDb } from '../../src/lib/db';
import { depasseLimite } from '../../src/lib/limites';

test('autorise max envois par fenêtre puis bloque, par clé', async () => {
  const db = await openDb(':memory:');
  const t = new Date('2027-01-10T10:00:00Z');
  for (let i = 0; i < 5; i++) expect(await depasseLimite(db, 'rsvp:1.2.3.4', 5, 600_000, t)).toBe(false);
  expect(await depasseLimite(db, 'rsvp:1.2.3.4', 5, 600_000, t)).toBe(true);
  expect(await depasseLimite(db, 'rsvp:5.6.7.8', 5, 600_000, t)).toBe(false);
  const apres = new Date(t.getTime() + 600_001);
  expect(await depasseLimite(db, 'rsvp:1.2.3.4', 5, 600_000, apres)).toBe(false);
});
```

Exécuter : `npx vitest run tests/unit/db.test.ts tests/unit/limites.test.ts`. Attendu : ÉCHEC (modules introuvables).

- [ ] **Étape 3 : implémenter `src/lib/db.ts`**

```ts
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
```

> Si `@libsql/client` 0.18 refuse l'URL `':memory:'`, utiliser `'file::memory:'` dans les tests, sans autre changement.

- [ ] **Étape 4 : implémenter `src/lib/limites.ts`**

```ts
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
```

- [ ] **Étape 5 : vérifier**

Exécuter : `npx vitest run tests/unit/db.test.ts tests/unit/limites.test.ts`, puis `npx vitest run`. Attendu : RÉUSSI.

- [ ] **Étape 6 : commit**

```bash
git add -A
git commit -m "Ajoute la base des réponses et la limite d'envois"
```

---

### Tâche 3 : lecture et validation du formulaire

**Fichiers :**
- Créer : `src/lib/rsvp.ts`, `tests/unit/rsvp.test.ts`
- Modifier : `src/lib/i18n.ts` (clés `rsvp.err.*`)

**Interfaces :**
- Consomme : `EventConfig`, `NouvelleReponse`, `Lang`, `UiKey`.
- Produit :
  - `type ChampsRsvp = { vient: boolean | null; nom: string; email: string; telephone: string; accompagnants: string[]; moments: string[]; message: string; piege: string }` ;
  - `type ErreursRsvp = Partial<Record<'vient' | 'nom' | 'email' | 'telephone' | 'accompagnants' | 'moments' | 'message', UiKey>>` ;
  - `lireFormulaire(fd: FormData): ChampsRsvp` ;
  - `valider(c: ChampsRsvp, momentIds: string[], langue: Lang): { ok: true; data: NouvelleReponse } | { ok: false; erreurs: ErreursRsvp }` ;
  - `rsvpOuvert(evenement: EventConfig['evenement'], maintenant: Date): boolean` ;
  - `nombrePersonnes(r: { vient: boolean; accompagnants: string[] }): number` ;
  - `CHAMPS_VIDES: ChampsRsvp`.
- Noms des champs HTML : `vient` (`oui` / `non`), `nom`, `email`, `telephone`, `accompagnant` (répété), `moment` (répété), `message`, `ne_pas_remplir` (champ piège).

- [ ] **Étape 1 : ajouter les clés d'erreur dans `DICT` (`src/lib/i18n.ts`)**

```ts
  'rsvp.err.vient': { fr: 'Indique si tu viens ou non.', en: 'Tell us whether you are coming.' },
  'rsvp.err.nom': { fr: 'Indique ton prénom et ton nom (2 à 100 caractères).', en: 'Enter your first and last name (2–100 characters).' },
  'rsvp.err.email': { fr: 'Adresse e-mail invalide.', en: 'Invalid email address.' },
  'rsvp.err.telephone': { fr: 'Numéro trop long (30 caractères au plus).', en: 'Phone number too long (30 characters max).' },
  'rsvp.err.accompagnants': { fr: '10 accompagnants au plus, 100 caractères chacun.', en: 'Up to 10 plus-ones, 100 characters each.' },
  'rsvp.err.moments': { fr: 'Choisis au moins un moment.', en: 'Choose at least one moment.' },
  'rsvp.err.message': { fr: 'Message trop long (1 000 caractères au plus).', en: 'Message too long (1,000 characters max).' },
```

- [ ] **Étape 2 : écrire les tests qui échouent**

`tests/unit/rsvp.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { CHAMPS_VIDES, lireFormulaire, nombrePersonnes, rsvpOuvert, valider, type ChampsRsvp } from '../../src/lib/rsvp';

const IDS = ['accueil', 'diner', 'soiree', 'brunch'];
const ok: ChampsRsvp = { ...CHAMPS_VIDES, vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', moments: ['diner'] };

describe('lireFormulaire', () => {
  test('lit, nettoie et ignore les accompagnants vides', () => {
    const fd = new FormData();
    fd.set('vient', 'oui'); fd.set('nom', '  Camille Martin '); fd.set('email', '  Camille@Exemple.FR ');
    fd.append('accompagnant', 'Léo'); fd.append('accompagnant', '  '); fd.append('accompagnant', '');
    fd.append('moment', 'diner'); fd.append('moment', 'soiree'); fd.set('message', '  Bravo ');
    expect(lireFormulaire(fd)).toEqual({
      vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', telephone: '',
      accompagnants: ['Léo'], moments: ['diner', 'soiree'], message: 'Bravo', piege: '',
    });
  });
  test('présence absente → null ; champ piège lu', () => {
    const fd = new FormData(); fd.set('ne_pas_remplir', 'http://spam');
    expect(lireFormulaire(fd)).toMatchObject({ vient: null, piege: 'http://spam' });
  });
});

describe('valider', () => {
  test('cas valide → données prêtes à enregistrer', () => {
    expect(valider({ ...ok, telephone: '06 12', message: 'Super' }, IDS, 'fr')).toEqual({
      ok: true,
      data: { langue: 'fr', vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', telephone: '06 12', accompagnants: [], moments: ['diner'], message: 'Super' },
    });
  });
  test('ne vient pas : accompagnants et moments vidés, téléphone et message vides → null', () => {
    const r = valider({ ...ok, vient: false, accompagnants: ['Léo'], moments: [] }, IDS, 'en');
    expect(r).toEqual({ ok: true, data: expect.objectContaining({ vient: false, accompagnants: [], moments: [], telephone: null, message: null, langue: 'en' }) });
  });
  test('erreurs par champ', () => {
    const r = valider({
      ...ok, vient: true, nom: 'C', email: 'pas-un-email', telephone: '1'.repeat(31),
      accompagnants: Array(11).fill('x'), moments: [], message: 'm'.repeat(1001),
    }, IDS, 'fr');
    expect(r).toEqual({ ok: false, erreurs: {
      nom: 'rsvp.err.nom', email: 'rsvp.err.email', telephone: 'rsvp.err.telephone',
      accompagnants: 'rsvp.err.accompagnants', moments: 'rsvp.err.moments', message: 'rsvp.err.message',
    } });
  });
  test('présence manquante, moment inconnu, accompagnant trop long', () => {
    expect(valider({ ...ok, vient: null }, IDS, 'fr')).toEqual({ ok: false, erreurs: { vient: 'rsvp.err.vient' } });
    expect(valider({ ...ok, moments: ['piscine'] }, IDS, 'fr')).toEqual({ ok: false, erreurs: { moments: 'rsvp.err.moments' } });
    expect(valider({ ...ok, accompagnants: ['x'.repeat(101)] }, IDS, 'fr')).toEqual({ ok: false, erreurs: { accompagnants: 'rsvp.err.accompagnants' } });
  });
  test('e-mail de plus de 254 caractères refusé', () => {
    expect(valider({ ...ok, email: 'a'.repeat(250) + '@x.fr' }, IDS, 'fr')).toEqual({ ok: false, erreurs: { email: 'rsvp.err.email' } });
  });
});

describe('rsvpOuvert (fuseau de l’événement)', () => {
  const ev = { date_debut: '2027-06-14T16:00:00+02:00', date_limite_rsvp: '2027-05-01', lieu_court: { fr: 'x' } };
  test('ouvert jusqu’à 23:59 heure locale du jour limite', () => {
    expect(rsvpOuvert(ev, new Date('2027-05-01T21:59:00Z'))).toBe(true);  // 23:59 à Paris
    expect(rsvpOuvert(ev, new Date('2027-05-01T22:00:00Z'))).toBe(false); // 00:00 le 2 mai à Paris
  });
});

test('nombrePersonnes', () => {
  expect(nombrePersonnes({ vient: true, accompagnants: ['a', 'b'] })).toBe(3);
  expect(nombrePersonnes({ vient: false, accompagnants: ['a'] })).toBe(0);
});
```

Exécuter : `npx vitest run tests/unit/rsvp.test.ts`. Attendu : ÉCHEC (module introuvable).

- [ ] **Étape 3 : implémenter `src/lib/rsvp.ts`**

```ts
import type { NouvelleReponse } from './db';
import type { EventConfig, Lang } from './event';
import type { UiKey } from './i18n';

export type ChampsRsvp = {
  vient: boolean | null; nom: string; email: string; telephone: string;
  accompagnants: string[]; moments: string[]; message: string; piege: string;
};
export type ErreursRsvp = Partial<Record<'vient' | 'nom' | 'email' | 'telephone' | 'accompagnants' | 'moments' | 'message', UiKey>>;

export const CHAMPS_VIDES: ChampsRsvp = { vient: null, nom: '', email: '', telephone: '', accompagnants: [], moments: [], message: '', piege: '' };

const texte = (fd: FormData, nom: string) => String(fd.get(nom) ?? '').trim();
const liste = (fd: FormData, nom: string) => fd.getAll(nom).map((v) => String(v).trim()).filter(Boolean);

export function lireFormulaire(fd: FormData): ChampsRsvp {
  const vient = texte(fd, 'vient');
  return {
    vient: vient === 'oui' ? true : vient === 'non' ? false : null,
    nom: texte(fd, 'nom'),
    email: texte(fd, 'email').toLowerCase(),
    telephone: texte(fd, 'telephone'),
    accompagnants: liste(fd, 'accompagnant'),
    moments: liste(fd, 'moment'),
    message: texte(fd, 'message'),
    piege: texte(fd, 'ne_pas_remplir'),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function valider(c: ChampsRsvp, momentIds: string[], langue: Lang):
  { ok: true; data: NouvelleReponse } | { ok: false; erreurs: ErreursRsvp } {
  const erreurs: ErreursRsvp = {};
  const email = c.email.trim().toLowerCase();
  if (c.vient === null) erreurs.vient = 'rsvp.err.vient';
  if (c.nom.length < 2 || c.nom.length > 100) erreurs.nom = 'rsvp.err.nom';
  if (email.length > 254 || !EMAIL.test(email)) erreurs.email = 'rsvp.err.email';
  if (c.telephone.length > 30) erreurs.telephone = 'rsvp.err.telephone';
  if (c.message.length > 1000) erreurs.message = 'rsvp.err.message';
  if (c.vient) {
    if (c.accompagnants.length > 10 || c.accompagnants.some((a) => a.length > 100)) erreurs.accompagnants = 'rsvp.err.accompagnants';
    if (c.moments.length === 0 || c.moments.some((m) => !momentIds.includes(m))) erreurs.moments = 'rsvp.err.moments';
  }
  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return {
    ok: true,
    data: {
      langue, vient: c.vient!, nom: c.nom, email, telephone: c.telephone || null,
      accompagnants: c.vient ? c.accompagnants : [], moments: c.vient ? [...new Set(c.moments)] : [], message: c.message || null,
    },
  };
}

/** Date du jour (AAAA-MM-JJ) dans le fuseau de l'heure ISO donnée en référence. */
function dateLocale(maintenant: Date, isoReference: string): string {
  const m = isoReference.match(/([+-])(\d{2}):?(\d{2})$/);
  const minutes = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(maintenant.getTime() + minutes * 60_000).toISOString().slice(0, 10);
}

export function rsvpOuvert(evenement: EventConfig['evenement'], maintenant: Date): boolean {
  return dateLocale(maintenant, evenement.date_debut) <= evenement.date_limite_rsvp;
}

export function nombrePersonnes(r: { vient: boolean; accompagnants: string[] }): number {
  return r.vient ? 1 + r.accompagnants.length : 0;
}
```

- [ ] **Étape 4 : vérifier**

Exécuter : `npx vitest run tests/unit/rsvp.test.ts`, puis `npx vitest run`. Attendu : RÉUSSI.

- [ ] **Étape 5 : commit**

```bash
git add -A
git commit -m "Ajoute la lecture et la validation du formulaire de réponse"
```

---

### Tâche 4 : envoi des e-mails (boîte d'envoi locale et API)

**Fichiers :**
- Créer : `src/lib/mail/types.ts`, `src/lib/mail/outbox.ts`, `src/lib/mail/api.ts`, `src/lib/mail/index.ts`, `tests/unit/mail.test.ts`

**Interfaces :**
- Produit :
  - `type PieceJointe = { nom: string; contenu: Uint8Array; type: string }` ;
  - `type Message = { a: string; sujet: string; html: string; texte: string; piecesJointes?: PieceJointe[] }` ;
  - `interface Expediteur { envoyer(m: Message): Promise<void> }` ;
  - `creerOutbox(dossier: string, maintenant?: () => Date): Expediteur` ;
  - `payloadBrevo(m: Message, de: { email: string; nom: string }): object` ;
  - `payloadResend(m: Message, de: { email: string; nom: string }): object` ;
  - `creerApi(o: { fournisseur: 'brevo' | 'resend'; cle: string; de: { email: string; nom: string }; fetch?: typeof fetch }): Expediteur` ;
  - `getExpediteur(nomExpediteur: string): Expediteur`.
- Format de la boîte d'envoi : un dossier par e-mail, `<OUTBOX_DIR>/<AAAAMMJJ-HHMMSS-mmm>-<n>/`, contenant :
  - `meta.json` : `{ a, sujet, date, piecesJointes: [noms] }` ;
  - `message.html` ;
  - `message.txt` ;
  - les pièces jointes, chacune sous son nom.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/unit/mail.test.ts` :
```ts
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { creerApi, payloadBrevo, payloadResend } from '../../src/lib/mail/api';
import { creerOutbox } from '../../src/lib/mail/outbox';
import type { Message } from '../../src/lib/mail/types';

const msg: Message = {
  a: 'camille@exemple.fr', sujet: 'Ton invitation', html: '<p>Bonjour</p>', texte: 'Bonjour',
  piecesJointes: [{ nom: 'Invitation-Camille.pdf', contenu: new Uint8Array([37, 80, 68, 70]), type: 'application/pdf' }],
};
const de = { email: 'fete@exemple.fr', nom: 'Coco a 40 ans' };

describe('outbox', () => {
  test('écrit un dossier par e-mail avec méta, html, texte et pièces jointes', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'outbox-'));
    const ob = creerOutbox(dossier, () => new Date('2027-01-10T10:11:12.345Z'));
    await ob.envoyer(msg);
    await ob.envoyer({ ...msg, piecesJointes: [] });
    const dirs = readdirSync(dossier).sort();
    expect(dirs).toEqual(['20270110-101112-345-1', '20270110-101112-345-2']);
    const d = join(dossier, dirs[0]);
    expect(JSON.parse(readFileSync(join(d, 'meta.json'), 'utf8'))).toEqual({
      a: 'camille@exemple.fr', sujet: 'Ton invitation', date: '2027-01-10T10:11:12.345Z', piecesJointes: ['Invitation-Camille.pdf'],
    });
    expect(readFileSync(join(d, 'message.html'), 'utf8')).toBe('<p>Bonjour</p>');
    expect(readFileSync(join(d, 'message.txt'), 'utf8')).toBe('Bonjour');
    expect([...readFileSync(join(d, 'Invitation-Camille.pdf'))]).toEqual([37, 80, 68, 70]);
  });
});

describe('API', () => {
  test('payload Brevo', () => {
    expect(payloadBrevo(msg, de)).toEqual({
      sender: { name: 'Coco a 40 ans', email: 'fete@exemple.fr' }, to: [{ email: 'camille@exemple.fr' }],
      subject: 'Ton invitation', htmlContent: '<p>Bonjour</p>', textContent: 'Bonjour',
      attachment: [{ name: 'Invitation-Camille.pdf', content: 'JVBERg==' }],
    });
  });
  test('payload Resend', () => {
    expect(payloadResend(msg, de)).toEqual({
      from: 'Coco a 40 ans <fete@exemple.fr>', to: ['camille@exemple.fr'], subject: 'Ton invitation',
      html: '<p>Bonjour</p>', text: 'Bonjour', attachments: [{ filename: 'Invitation-Camille.pdf', content: 'JVBERg==' }],
    });
  });
  test('appelle le bon point d’accès avec la clé, et lève une erreur si la réponse n’est pas 2xx', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 201 }));
    await creerApi({ fournisseur: 'brevo', cle: 'k1', de, fetch: f }).envoyer(msg);
    expect(f).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ 'api-key': 'k1', 'content-type': 'application/json' }),
    }));
    const g = vi.fn(async () => new Response('{}', { status: 200 }));
    await creerApi({ fournisseur: 'resend', cle: 'k2', de, fetch: g }).envoyer(msg);
    expect(g).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer k2' }),
    }));
    const h = vi.fn(async () => new Response('quota', { status: 429 }));
    await expect(creerApi({ fournisseur: 'brevo', cle: 'k', de, fetch: h }).envoyer(msg)).rejects.toThrow(/429/);
  });
});
```

Exécuter : `npx vitest run tests/unit/mail.test.ts`. Attendu : ÉCHEC (modules introuvables).

- [ ] **Étape 2 : implémenter**

`src/lib/mail/types.ts` :
```ts
export type PieceJointe = { nom: string; contenu: Uint8Array; type: string };
export type Message = { a: string; sujet: string; html: string; texte: string; piecesJointes?: PieceJointe[] };
export interface Expediteur { envoyer(m: Message): Promise<void> }
```

`src/lib/mail/outbox.ts` :
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Expediteur, Message } from './types';

const horodatage = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '-').slice(0, 19);

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
      for (const p of pj) writeFileSync(join(d, p.nom.replace(/[\\/]/g, '_')), p.contenu);
      // meta.json en dernier : sa présence signale un e-mail complet.
      writeFileSync(join(d, 'meta.json'), JSON.stringify({ a: m.a, sujet: m.sujet, date: date.toISOString(), piecesJointes: pj.map((p) => p.nom) }, null, 2));
    },
  };
}
```

> `horodatage(new Date('2027-01-10T10:11:12.345Z'))` vaut `'20270110-101112-345'`. Le compteur, commun à tout le processus, évite les collisions dans la même milliseconde (le serveur de test reçoit des envois simultanés des deux projets Playwright). Le test de la boîte d'envoi est le seul du fichier à l'utiliser, d'où les suffixes `-1` et `-2`.

`src/lib/mail/api.ts` :
```ts
import type { Expediteur, Message } from './types';

type De = { email: string; nom: string };
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

export function payloadBrevo(m: Message, de: De) {
  return {
    sender: { name: de.nom, email: de.email }, to: [{ email: m.a }], subject: m.sujet,
    htmlContent: m.html, textContent: m.texte,
    ...(m.piecesJointes?.length ? { attachment: m.piecesJointes.map((p) => ({ name: p.nom, content: b64(p.contenu) })) } : {}),
  };
}

export function payloadResend(m: Message, de: De) {
  return {
    from: `${de.nom} <${de.email}>`, to: [m.a], subject: m.sujet, html: m.html, text: m.texte,
    ...(m.piecesJointes?.length ? { attachments: m.piecesJointes.map((p) => ({ filename: p.nom, content: b64(p.contenu) })) } : {}),
  };
}

export function creerApi(o: { fournisseur: 'brevo' | 'resend'; cle: string; de: De; fetch?: typeof fetch }): Expediteur {
  const f = o.fetch ?? fetch;
  return {
    async envoyer(m: Message) {
      const brevo = o.fournisseur === 'brevo';
      const res = await f(brevo ? 'https://api.brevo.com/v3/smtp/email' : 'https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(brevo ? { 'api-key': o.cle } : { authorization: `Bearer ${o.cle}` }) },
        body: JSON.stringify(brevo ? payloadBrevo(m, o.de) : payloadResend(m, o.de)),
      });
      if (!res.ok) throw new Error(`Envoi d'e-mail refusé par ${o.fournisseur} : ${res.status} ${await res.text()}`);
    },
  };
}
```

`src/lib/mail/index.ts` :
```ts
import { creerApi } from './api';
import { creerOutbox } from './outbox';
import type { Expediteur } from './types';

export function getExpediteur(nomExpediteur: string): Expediteur {
  if ((process.env.MAIL_MODE || 'outbox') !== 'api') return creerOutbox(process.env.OUTBOX_DIR || '.data/outbox');
  const fournisseur = process.env.MAIL_PROVIDER === 'resend' ? 'resend' : 'brevo';
  const cle = process.env.MAIL_API_KEY;
  const email = process.env.MAIL_FROM;
  if (!cle || !email) throw new Error('MAIL_MODE=api exige MAIL_API_KEY et MAIL_FROM');
  return creerApi({ fournisseur, cle, de: { email, nom: nomExpediteur } });
}
```

- [ ] **Étape 3 : vérifier**

Exécuter : `npx vitest run tests/unit/mail.test.ts`, puis `npx vitest run`. Attendu : RÉUSSI.

- [ ] **Étape 4 : commit**

```bash
git add -A
git commit -m "Ajoute l'envoi d'e-mails en local et par API"
```

---

### Tâche 5 : contenu des e-mails

**Fichiers :**
- Créer : `src/lib/mail/templates.ts`, `tests/unit/templates.test.ts`
- Modifier : `src/lib/theme.ts` (export `couleursTheme`)

**Interfaces :**
- Consomme : `EventConfig`, `t`, `findLieu`, `Reponse`, `momentLabel`, `formatDate`.
- Produit aussi : `couleursTheme(theme: EventConfig['theme']): { principale; principaleFonce; fond; texte; texteDoux; douce }` dans `src/lib/theme.ts` (chaînes `#rrggbb`), réutilisée par `themeVars`, puis par le PDF à la tâche 6.
- Produit :
  - `type Liens = { programme: string; modifier: string }` ;
  - `emailConfirmation(ev: EventConfig, r: Reponse, liens: Liens): { sujet: string; html: string; texte: string }` ;
  - `emailRegrets(ev, r, liens)` (même forme) ;
  - `emailLienModification(ev, r, liens)` (même forme) ;
  - `echapper(s: string): string`.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/unit/templates.test.ts` :
```ts
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Reponse } from '../../src/lib/db';
import { parseEvent } from '../../src/lib/event';
import { echapper, emailConfirmation, emailLienModification, emailRegrets } from '../../src/lib/mail/templates';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));
const r: Reponse = {
  id: 1, jeton: 'JETON', langue: 'fr', vient: true, nom: 'Camille <script>alert(1)</script>', email: 'camille@exemple.fr',
  telephone: null, accompagnants: ['Léo & Co'], moments: ['accueil', 'soiree'], message: null,
  messageMasque: false, emailEnvoye: false, creeLe: '', modifieLe: '',
};
const liens = { programme: 'https://site.fr/fr/programme', modifier: 'https://site.fr/fr/rsvp/modifier?jeton=JETON' };

test('echapper', () => expect(echapper(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'));

describe('confirmation', () => {
  const m = emailConfirmation(ev, r, liens);
  test('objet issu du YAML dans la langue de l’invité', () => expect(m.sujet).toBe('🎉 Ton invitation pour les 40 ans de Coco'));
  test('récapitulatif : personnes, moments choisis avec lieu, date, liens', () => {
    expect(m.html).toContain('Camille &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('Léo &amp; Co');
    expect(m.html).toContain('16 h · Accueil');
    expect(m.html).toContain('22 h · Soirée');
    expect(m.html).toContain('La Guinguette');
    expect(m.html).not.toContain('19 h · Dîner');
    expect(m.html).toContain('lundi 14 juin 2027');
    expect(m.html).toContain(liens.programme);
    expect(m.html).toContain(liens.modifier);
    expect(m.texte).toContain('2 personnes');
    expect(m.texte).toContain(liens.modifier);
  });
  test('version anglaise', () => {
    const en = emailConfirmation(ev, { ...r, langue: 'en' }, liens);
    expect(en.sujet).toBe("🎉 Your invitation to Coco's 40th");
    expect(en.html).toContain('4 pm · Welcome');
    expect(en.texte).toContain('2 people');
  });
});

test('regrets : pas de moments, lien de modification', () => {
  const m = emailRegrets(ev, { ...r, vient: false, moments: [], accompagnants: [] }, liens);
  expect(m.html).not.toContain('Accueil');
  expect(m.html).toContain(liens.modifier);
  expect(m.sujet).toContain('Coco a 40 ans');
});

test('lien de modification', () => {
  const m = emailLienModification(ev, r, liens);
  expect(m.html).toContain(liens.modifier);
  expect(m.texte).toContain(liens.modifier);
});
```

Exécuter : `npx vitest run tests/unit/templates.test.ts`. Attendu : ÉCHEC (module introuvable).

- [ ] **Étape 2 : exporter `couleursTheme` dans `src/lib/theme.ts` et l'utiliser dans `themeVars`**

```ts
export function couleursTheme(theme: Theme) {
  const c = { ...SOLEIL, ...theme.couleurs };
  return {
    principale: c.principale,
    principaleFonce: darkenUntil(c.principale, c.fond),
    fond: c.fond,
    texte: c.texte,
    texteDoux: darkenUntil(mix(c.texte, c.fond, 0.75), c.fond),
    douce: c.douce,
  };
}
```

Dans `themeVars`, remplacer le calcul des couleurs par `const c = couleursTheme(theme);` et les valeurs par `c.principale`, `c.principaleFonce`, `c.fond`, `c.texte`, `c.texteDoux`, `c.douce`. Les sorties restent identiques, et `tests/unit/theme.test.ts` doit toujours passer.

- [ ] **Étape 3 : implémenter `src/lib/mail/templates.ts`**

Mise en page en tableaux et styles en ligne, pour les messageries. Tout texte venant de l'invité ou du YAML passe par `echapper`.

```ts
import type { Reponse } from '../db';
import { findLieu, t, type EventConfig, type Lang } from '../event';
import { formatDate } from '../i18n';
import { momentLabel } from '../moments';
import { couleursTheme } from '../theme';

export type Liens = { programme: string; modifier: string };
type Contenu = { sujet: string; html: string; texte: string };

export function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const TXT = {
  fr: {
    confirme: "C'est confirmé !", bonjour: (n: string) => `À très vite, ${n} !`,
    merci: 'Merci pour ta réponse ! Voici ton invitation personnelle en pièce jointe.',
    personnes: (n: number) => (n > 1 ? `${n} personnes` : '1 personne'),
    programme: 'Voir le programme et la carte', modifier: 'Modifier ma réponse',
    regretsTitre: 'Dommage !', regrets: "Merci de nous avoir prévenus. Si tes plans changent, tu peux modifier ta réponse à tout moment.",
    sujetRegrets: (s: string) => `${s} : réponse bien reçue`,
    lienTitre: 'Ton lien de modification',
    lien: 'Tu as déjà répondu avec cette adresse. Pour changer ta réponse, utilise ce lien :',
    sujetLien: (s: string) => `${s} : modifier ta réponse`,
  },
  en: {
    confirme: "It's confirmed!", bonjour: (n: string) => `See you soon, ${n}!`,
    merci: 'Thanks for your reply! Your personal invitation is attached.',
    personnes: (n: number) => (n > 1 ? `${n} people` : '1 person'),
    programme: 'See the schedule and map', modifier: 'Change my reply',
    regretsTitre: 'What a shame!', regrets: 'Thanks for letting us know. If your plans change, you can update your reply at any time.',
    sujetRegrets: (s: string) => `${s}: reply received`,
    lienTitre: 'Your edit link',
    lien: 'You have already replied with this address. To change your reply, use this link:',
    sujetLien: (s: string) => `${s}: change your reply`,
  },
} satisfies Record<Lang, unknown>;

// Fond foncé dérivé : le texte blanc des boutons et du bandeau doit atteindre 4,5:1 (le #ec5e27 n'atteint que 3,3:1).
function couleurs(ev: EventConfig) {
  const c = couleursTheme(ev.theme);
  return { principale: c.principaleFonce, fond: c.fond, texte: c.texte };
}

function bouton(href: string, libelle: string, c: ReturnType<typeof couleurs>, plein: boolean): string {
  const style = plein
    ? `background:${c.principale};color:#ffffff;`
    : `background:#ffffff;color:${c.texte};border:2px solid ${c.texte};`;
  return `<a href="${echapper(href)}" style="${style}display:inline-block;padding:12px 18px;border-radius:10px;font-weight:bold;text-decoration:none;margin:4px 6px 4px 0">${echapper(libelle)}</a>`;
}

function gabarit(ev: EventConfig, lang: Lang, titre: string, corps: string): string {
  const c = couleurs(ev);
  return `<!doctype html><html><body style="margin:0;background:#f4efe8;font-family:Arial,Helvetica,sans-serif;color:${c.texte}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe8;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${c.fond};border-radius:16px;overflow:hidden">
<tr><td style="background:${c.principale};color:#ffffff;text-align:center;padding:24px 16px">
<div style="font-size:14px;font-weight:bold">${echapper(t(ev.site.titre, lang))}</div>
<div style="font-size:30px;font-weight:bold;margin-top:6px">${titre}</div></td></tr>
<tr><td style="padding:24px 28px;font-size:16px;line-height:1.6">${corps}</td></tr>
</table></td></tr></table></body></html>`;
}

function personnes(r: Reponse): string[] {
  return [r.nom, ...r.accompagnants];
}

function lignesMoments(ev: EventConfig, r: Reponse): { label: string; lieu: string }[] {
  return ev.moments.filter((m) => r.moments.includes(m.id)).map((m) => {
    const l = findLieu(ev, m.lieu);
    return { label: momentLabel(m, r.langue), lieu: `${l.nom}, ${l.adresse}` };
  });
}

export function emailConfirmation(ev: EventConfig, r: Reponse, liens: Liens): Contenu {
  const T = TXT[r.langue];
  const c = couleurs(ev);
  const prenom = r.nom.split(' ')[0];
  const date = formatDate(ev.evenement.date_debut, r.langue);
  const moments = lignesMoments(ev, r);
  const corps = `<p style="margin:0 0 12px">${echapper(T.merci)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px"><tr><td style="padding:14px 18px;font-size:15px">
<b>${echapper(date)}</b><br>${echapper(T.personnes(personnes(r).length))} : ${personnes(r).map(echapper).join(', ')}<br>
${moments.map((m) => `<b>${echapper(m.label)}</b> : ${echapper(m.lieu)}`).join('<br>')}
</td></tr></table>
<p style="margin:18px 0 0">${bouton(liens.programme, T.programme, c, true)}${bouton(liens.modifier, T.modifier, c, false)}</p>`;
  const texte = [
    T.bonjour(prenom), '', T.merci, '', date, `${T.personnes(personnes(r).length)} : ${personnes(r).join(', ')}`,
    ...moments.map((m) => `- ${m.label} : ${m.lieu}`), '', `${T.programme} : ${liens.programme}`, `${T.modifier} : ${liens.modifier}`,
  ].join('\n');
  return { sujet: t(ev.email.objet, r.langue), html: gabarit(ev, r.langue, echapper(T.bonjour(prenom)), corps), texte };
}

export function emailRegrets(ev: EventConfig, r: Reponse, liens: Liens): Contenu {
  const T = TXT[r.langue];
  const c = couleurs(ev);
  const corps = `<p style="margin:0 0 12px">${echapper(T.regrets)}</p><p style="margin:18px 0 0">${bouton(liens.modifier, T.modifier, c, true)}</p>`;
  return {
    sujet: T.sujetRegrets(t(ev.site.titre, r.langue)),
    html: gabarit(ev, r.langue, echapper(T.regretsTitre), corps),
    texte: [T.regretsTitre, '', T.regrets, '', `${T.modifier} : ${liens.modifier}`].join('\n'),
  };
}

export function emailLienModification(ev: EventConfig, r: Reponse, liens: Liens): Contenu {
  const T = TXT[r.langue];
  const c = couleurs(ev);
  const corps = `<p style="margin:0 0 12px">${echapper(T.lien)}</p><p style="margin:18px 0 0">${bouton(liens.modifier, T.modifier, c, true)}</p>`;
  return {
    sujet: T.sujetLien(t(ev.site.titre, r.langue)),
    html: gabarit(ev, r.langue, echapper(T.lienTitre), corps),
    texte: [T.lienTitre, '', T.lien, liens.modifier].join('\n'),
  };
}
```


- [ ] **Étape 4 : vérifier**

Exécuter : `npx vitest run tests/unit/templates.test.ts tests/unit/theme.test.ts`, puis `npx vitest run`. Attendu : RÉUSSI.

- [ ] **Étape 5 : commit**

```bash
git add -A
git commit -m "Ajoute le contenu des e-mails de confirmation"
```

---

### Tâche 6 : invitation PDF

**Fichiers :**
- Créer : `src/assets/fonts/Caveat-Bold.ttf`, `src/assets/fonts/Nunito-Regular.ttf`, `src/assets/fonts/Nunito-ExtraBold.ttf`, `src/assets/fonts/OFL-Caveat.txt`, `src/assets/fonts/OFL-Nunito.txt`, `src/lib/pdf/invitation.ts`, `src/lib/pdf/ressources.ts`, `tests/unit/pdf.test.ts`, `tests/unit/pdf-ressources.test.ts`
- Modifier : `src/env.d.ts`, `package.json`

**Interfaces :**
- Consomme : `EventConfig`, `Reponse`, `t`, `findLieu`, `momentLabel`, `formatDate`, `couleursTheme` (tâche 5).
- Produit :
  - `type Polices = { titre: Uint8Array; texte: Uint8Array; texteGras: Uint8Array }` ;
  - `genererInvitation(d: { ev: EventConfig; reponse: Pick<Reponse, 'nom' | 'accompagnants' | 'moments' | 'langue'>; photo: Uint8Array | null; polices: Polices; urlQr: string }): Promise<Uint8Array>` ;
  - pour les tests : `mesurerInvitation(d): Promise<{ disposition: Disposition; yFin: number }>`, `BAS_CONTENU: number`, `dessinable(texte: string, police: PDFFont): string` ;
  - `polices(): Polices` ;
  - `photoJpeg(chemin: string): Promise<Uint8Array | null>` (`ressources.ts`).

- [ ] **Étape 1 : installer et télécharger les polices** (licence SIL Open Font License)

```bash
npm install pdf-lib@^1.17.1 @pdf-lib/fontkit@^1.1.1 qrcode sharp
npm install --save-dev @types/qrcode
mkdir -p src/assets/fonts
curl -sL -o src/assets/fonts/Caveat-Bold.ttf      "https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjRV6SII.ttf"
curl -sL -o src/assets/fonts/Nunito-Regular.ttf   "https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf"
curl -sL -o src/assets/fonts/Nunito-ExtraBold.ttf "https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDDsmRTM.ttf"
curl -sL -o src/assets/fonts/OFL-Nunito.txt       "https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt"
curl -sL -o src/assets/fonts/OFL-Caveat.txt       "https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/OFL.txt"
```

Vérifier : les trois `.ttf` commencent par les octets `00 01 00 00` (`head -c 4 fichier | od -An -tx1`). Si une URL a changé, en obtenir une nouvelle avec `curl -s -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@400;800"`.

Ajouter à `src/env.d.ts` :
```ts
declare module '*.ttf?inline' {
  const dataUrl: string;
  export default dataUrl;
}
```

- [ ] **Étape 2 : écrire les tests qui échouent**

`tests/unit/pdf.test.ts` :
```ts
import { readFileSync, readdirSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { beforeAll, describe, expect, test } from 'vitest';
import { parseEvent } from '../../src/lib/event';
import fontkit from '@pdf-lib/fontkit';
import { BAS_CONTENU, dessinable, genererInvitation, mesurerInvitation, type Polices } from '../../src/lib/pdf/invitation';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));
const polices: Polices = {
  titre: readFileSync('src/assets/fonts/Caveat-Bold.ttf'),
  texte: readFileSync('src/assets/fonts/Nunito-Regular.ttf'),
  texteGras: readFileSync('src/assets/fonts/Nunito-ExtraBold.ttf'),
};
let photo: Uint8Array;
beforeAll(async () => {
  photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ec5e27' } }).jpeg().toBuffer();
});

const reponse = { nom: 'Camille Martin', accompagnants: ['Léo Martin'], moments: ['accueil', 'soiree'], langue: 'fr' as const };

describe('genererInvitation', () => {
  test('PDF A5 d’une page, titre contenant le nom', async () => {
    const octets = await genererInvitation({ ev, reponse, photo, polices, urlQr: 'http://localhost:4321/fr/programme' });
    expect(Buffer.from(octets.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(octets);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(420);
    expect(Math.round(height)).toBe(595);
    expect(doc.getTitle()).toBe('Invitation – Camille Martin');
  });

  test('fonctionne sans photo et en anglais', async () => {
    const octets = await genererInvitation({ ev, reponse: { ...reponse, langue: 'en' }, photo: null, polices, urlQr: 'http://x/en/programme' });
    expect((await PDFDocument.load(octets)).getTitle()).toBe('Invitation – Camille Martin');
  });

  test('caractères absents des polices (emoji, idéogrammes) : pas d’erreur', async () => {
    const r = { ...reponse, nom: 'Coco 🎉 李', accompagnants: ['Zoë 💃'] };
    await expect(genererInvitation({ ev, reponse: r, photo, polices, urlQr: 'http://x' })).resolves.toBeInstanceOf(Uint8Array);
  });

  test('cas courant : disposition la plus aérée, avec photo', async () => {
    const m = await mesurerInvitation({ ev, reponse, photo, polices, urlQr: 'http://x' });
    expect(m.disposition).toEqual({ photo: true, tailleNoms: 26, interligne: 13 });
    expect(m.yFin).toBeGreaterThanOrEqual(BAS_CONTENU);
  });

  test('10 accompagnants et tous les moments : disposition compacte, contenu au-dessus du QR code', async () => {
    const r = { ...reponse, accompagnants: Array.from({ length: 10 }, (_, i) => `Accompagnant numéro ${i + 1}`), moments: ev.moments.map((m) => m.id) };
    const m = await mesurerInvitation({ ev, reponse: r, photo, polices, urlQr: 'http://x' });
    expect(m.disposition.tailleNoms).toBeLessThan(26);
    expect(m.yFin).toBeGreaterThanOrEqual(BAS_CONTENU);
    await expect(genererInvitation({ ev, reponse: r, photo, polices, urlQr: 'http://x' })).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe('dessinable', () => {
  test('retire emoji et idéogrammes absents de la police, garde les accents', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const f = await doc.embedFont(polices.texte, { subset: true });
    expect(dessinable('Coco 🎉 李 Zoë', f)).toBe('Coco Zoë');
  });
});
```

Exécuter : `npx vitest run tests/unit/pdf.test.ts`. Attendu : ÉCHEC (module introuvable).

- [ ] **Étape 3 : implémenter `src/lib/pdf/invitation.ts`**

```ts
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Reponse } from '../db';
import { findLieu, t, type EventConfig } from '../event';
import { formatDate } from '../i18n';
import { momentLabel } from '../moments';
import { couleursTheme } from '../theme';

export type Polices = { titre: Uint8Array; texte: Uint8Array; texteGras: Uint8Array };
type Donnees = {
  ev: EventConfig; reponse: Pick<Reponse, 'nom' | 'accompagnants' | 'moments' | 'langue'>;
  photo: Uint8Array | null; polices: Polices; urlQr: string;
};

const A5: [number, number] = [419.53, 595.28];
const MARGE = 24;

const couleur = (hex: string) => rgb(...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]));

/** Retire les caractères que la police ne sait pas dessiner (emoji, idéogrammes…). */
export function dessinable(texte: string, police: PDFFont): string {
  const jeu = new Set(police.getCharacterSet());
  return [...texte].filter((ch) => jeu.has(ch.codePointAt(0)!)).join('').replace(/\s{2,}/g, ' ').trim();
}

function couper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  let ligne = '';
  for (const mot of texte.split(' ')) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (police.widthOfTextAtSize(essai, taille) <= largeur || !ligne) ligne = essai;
    else { lignes.push(ligne); ligne = mot; }
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

function centrer(page: PDFPage, texte: string, police: PDFFont, taille: number, y: number, c: ReturnType<typeof rgb>) {
  const w = police.widthOfTextAtSize(texte, taille);
  page.drawText(texte, { x: (page.getWidth() - w) / 2, y, size: taille, font: police, color: c });
}

const TXT = {
  fr: { etiquette: 'INVITATION PERSONNELLE', hate1: 'Nous avons hâte de te voir !', hateN: 'Nous avons hâte de vous voir !', qr: ['Programme, carte', 'et infos pratiques'] },
  en: { etiquette: 'PERSONAL INVITATION', hate1: "We can't wait to see you!", hateN: "We can't wait to see you all!", qr: ['Schedule, map', 'and practical info'] },
};

export type Disposition = { photo: boolean; tailleNoms: number; interligne: number };
/** Du plus aéré au plus compact : la première disposition qui tient au-dessus du QR code est retenue. */
const DISPOSITIONS: Disposition[] = [
  { photo: true, tailleNoms: 26, interligne: 13 },
  { photo: true, tailleNoms: 18, interligne: 12 },
  { photo: false, tailleNoms: 18, interligne: 12 },
  { photo: false, tailleNoms: 14, interligne: 11 },
];
const [W, H] = A5;
const LARGEUR = W - 2 * MARGE;
const HAUT_CONTENU = H - 120;
/** Limite basse du contenu : au-dessus du QR code (64 pt) et de sa légende. */
export const BAS_CONTENU = MARGE + 80;
const CADRE = { w: 190, h: 150 };

type Ligne = { texte: string; police: PDFFont; taille: number };

async function preparer(d: Donnees) {
  const { ev, reponse: r } = d;
  const lang = r.langue;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [fTitre, fTexte, fGras] = await Promise.all([
    doc.embedFont(d.polices.titre, { subset: true }),
    doc.embedFont(d.polices.texte, { subset: true }),
    doc.embedFont(d.polices.texteGras, { subset: true }),
  ]);
  const noms = [r.nom, ...r.accompagnants].map((n) => dessinable(n, fTitre)).filter(Boolean);
  const texteNoms = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} & ${noms.at(-1)}` : noms[0] ?? '';
  const lignesMoments: Ligne[] = ev.moments.filter((m) => r.moments.includes(m.id)).flatMap((m) => {
    const l = findLieu(ev, m.lieu);
    return [
      { texte: dessinable(`${momentLabel(m, lang)} : ${l.nom}`, fGras), police: fGras, taille: 9.5 },
      { texte: dessinable(l.adresse, fTexte), police: fTexte, taille: 8.5 },
    ];
  });
  let disp = DISPOSITIONS[0];
  let lignesNoms: string[] = [];
  let yFin = 0;
  for (disp of DISPOSITIONS) {
    lignesNoms = couper(texteNoms, fTitre, disp.tailleNoms, LARGEUR);
    const hauteur = (disp.photo && d.photo ? CADRE.h : 0) + 16 + lignesNoms.length * disp.tailleNoms + 36
      + (lignesMoments.length ? 12 + lignesMoments.length * disp.interligne + 14 : 0);
    yFin = HAUT_CONTENU - hauteur;
    if (yFin >= BAS_CONTENU) break;
  }
  return { doc, fTitre, fTexte, fGras, lignesNoms, lignesMoments, disp, yFin };
}

/** Disposition retenue et position la plus basse du contenu (utile aux tests). */
export async function mesurerInvitation(d: Donnees): Promise<{ disposition: Disposition; yFin: number }> {
  const p = await preparer(d);
  return { disposition: p.disp, yFin: p.yFin };
}

export async function genererInvitation(d: Donnees): Promise<Uint8Array> {
  const { ev, reponse: r } = d;
  const lang = r.langue;
  const T = TXT[lang];
  const c = couleursTheme(ev.theme);
  const { doc, fTitre, fTexte, fGras, lignesNoms, lignesMoments, disp } = await preparer(d);
  const page = doc.addPage(A5);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: couleur(c.fond) });

  // Bandeau
  page.drawRectangle({ x: 0, y: H - 110, width: W, height: 110, color: couleur(c.principaleFonce) });
  centrer(page, T.etiquette, fGras, 10, H - 34, couleur(c.fond));
  const titre = dessinable(t(ev.site.titre, lang), fTitre);
  let tailleTitre = 40;
  while (fTitre.widthOfTextAtSize(titre, tailleTitre) > LARGEUR && tailleTitre > 18) tailleTitre -= 2;
  centrer(page, titre, fTitre, tailleTitre, H - 80, couleur(c.fond));

  // Photo façon polaroïd
  let y = HAUT_CONTENU;
  if (disp.photo && d.photo) {
    const img = await doc.embedJpg(d.photo);
    const dim = img.scaleToFit(CADRE.w - 14, CADRE.h - 34);
    const x0 = (W - CADRE.w) / 2;
    y -= CADRE.h;
    page.drawRectangle({ x: x0 + 3, y: y - 3, width: CADRE.w, height: CADRE.h, color: rgb(0.85, 0.8, 0.75) });
    page.drawRectangle({ x: x0, y, width: CADRE.w, height: CADRE.h, color: rgb(1, 1, 1) });
    page.drawImage(img, { x: x0 + (CADRE.w - dim.width) / 2, y: y + 27 + (CADRE.h - 34 - dim.height) / 2, width: dim.width, height: dim.height });
  }

  // Noms
  y -= 16;
  for (const ligne of lignesNoms) {
    y -= disp.tailleNoms;
    centrer(page, ligne, fTitre, disp.tailleNoms, y, couleur(c.principaleFonce));
  }
  y -= 18;
  centrer(page, r.accompagnants.length ? T.hateN : T.hate1, fTexte, 11, y, couleur(c.texte));
  y -= 18;
  centrer(page, dessinable(formatDate(ev.evenement.date_debut, lang), fGras), fGras, 12, y, couleur(c.texte));

  // Moments choisis
  if (lignesMoments.length) {
    const hauteur = lignesMoments.length * disp.interligne + 14;
    y -= 12 + hauteur;
    page.drawRectangle({ x: MARGE, y, width: LARGEUR - 80, height: hauteur, color: rgb(1, 1, 1) });
    let ly = y + hauteur - 18;
    for (const l of lignesMoments) {
      page.drawText(l.texte, { x: MARGE + 10, y: ly, size: l.taille, font: l.police, color: couleur(l.police === fGras ? c.texte : c.texteDoux), maxWidth: LARGEUR - 100 });
      ly -= disp.interligne;
    }
  }

  // QR code vers le programme
  const png = await QRCode.toBuffer(d.urlQr, { margin: 1, width: 240 });
  const qr = await doc.embedPng(png);
  page.drawImage(qr, { x: W - MARGE - 64, y: MARGE, width: 64, height: 64 });
  T.qr.forEach((ligne, i) => {
    const w = fTexte.widthOfTextAtSize(ligne, 8);
    page.drawText(ligne, { x: W - MARGE - 72 - w, y: MARGE + 34 - i * 11, size: 8, font: fTexte, color: couleur(c.texteDoux) });
  });

  doc.setTitle(`Invitation – ${r.nom}`);
  doc.setCreator(t(ev.site.titre, lang));
  return doc.save();
}
```

> `preparer` et le dessin calculent la hauteur de la même façon : la position finale du contenu dessiné est égale à `yFin`. Toute modification de l'un doit être répercutée dans l'autre ; le test « reste au-dessus du QR code » le vérifie.

- [ ] **Étape 4 : implémenter `src/lib/pdf/ressources.ts`**

```ts
import sharp from 'sharp';
import caveat from '../../assets/fonts/Caveat-Bold.ttf?inline';
import nunito from '../../assets/fonts/Nunito-Regular.ttf?inline';
import nunitoGras from '../../assets/fonts/Nunito-ExtraBold.ttf?inline';
import type { Polices } from './invitation';

const decoder = (dataUrl: string) => new Uint8Array(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));

export function polices(): Polices {
  return { titre: decoder(caveat), texte: decoder(nunito), texteGras: decoder(nunitoGras) };
}

const photos = import.meta.glob<string>('/evenement/photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { query: '?inline', import: 'default' });

/** Photo de l'événement, réduite à 1 200 px de large et convertie en JPEG (seul format accepté avec le PNG par pdf-lib). */
export async function photoJpeg(chemin: string): Promise<Uint8Array | null> {
  const cle = Object.keys(photos).find((k) => k.toLowerCase() === `/evenement/${chemin}`.toLowerCase());
  if (!cle) return null;
  const brut = decoder(await photos[cle]());
  return new Uint8Array(await sharp(brut).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer());
}
```

> Les polices et les photos sont intégrées au code serveur par `?inline` (base64), si bien qu'aucune lecture de disque n'a lieu à l'exécution, ce qui est compatible avec Vercel. Le test de l'étape 5 le vérifie ; la compilation complète le confirmera à la tâche 8, quand `services.ts` importera ce module. En cas d'échec, le signaler (NEEDS_CONTEXT) au lieu de passer par `fs`.

- [ ] **Étape 5 : tester le chargement des ressources** (`?inline` est géré par Vite, dans Vitest comme dans Astro)

`tests/unit/pdf-ressources.test.ts` :
```ts
import { PDFDocument } from 'pdf-lib';
import { expect, test } from 'vitest';
import { photoJpeg, polices } from '../../src/lib/pdf/ressources';

test('polices : trois TTF valides', () => {
  const p = polices();
  for (const f of [p.titre, p.texte, p.texteGras]) expect([...f.slice(0, 4)]).toEqual([0, 1, 0, 0]);
});

test('photoJpeg : JPEG de 1 200 px au plus, intégrable par pdf-lib ; null si absente', async () => {
  const jpg = await photoJpeg('photos/hero.jpg');
  expect(jpg).not.toBeNull();
  expect([...jpg!.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  const doc = await PDFDocument.create();
  expect((await doc.embedJpg(jpg!)).width).toBeLessThanOrEqual(1200);
  expect(await photoJpeg('photos/absente.jpg')).toBeNull();
});
```

- [ ] **Étape 6 : vérifier**

Exécuter : `npx vitest run tests/unit/pdf.test.ts tests/unit/pdf-ressources.test.ts`, puis `npx vitest run`, puis `npm run build`. Attendu : RÉUSSI.

- [ ] **Étape 7 : commit**

```bash
git add -A
git commit -m "Ajoute la génération de l'invitation PDF"
```

---

### Tâche 7 : orchestration d'une réponse

**Fichiers :**
- Créer : `src/lib/rsvp-service.ts`, `tests/unit/rsvp-service.test.ts`

**Interfaces :**
- Consomme : `Db`, `ErreurDoublon`, `depasseLimite`, `lireFormulaire`, `valider`, `rsvpOuvert`, `Expediteur`, `emailConfirmation`, `emailRegrets`, `emailLienModification`.
- Produit :
  - `type Deps = { db: Db; expediteur: Expediteur; ev: EventConfig; maintenant: () => Date; urlBase: string; invitationPdf: (r: Reponse) => Promise<Uint8Array>; limite: number }` ;
  - `type Resultat` (union) :
    - `{ type: 'ok'; reponse: Reponse; emailEnvoye: boolean }` ;
    - `{ type: 'doublon' }` ;
    - `{ type: 'ferme' }` ;
    - `{ type: 'limite' }` ;
    - `{ type: 'ignore' }` ;
    - `{ type: 'invalide'; erreurs: ErreursRsvp } ;`
    - `{ type: 'introuvable' }` ;
  - `soumettre(champs: ChampsRsvp, langue: Lang, ip: string, deps: Deps): Promise<Resultat>` ;
  - `modifier(jeton: string, champs: ChampsRsvp, langue: Lang, deps: Deps): Promise<Resultat>` ;
  - `liens(r: Reponse, urlBase: string): Liens` ;
  - `nomFichierInvitation(nom: string): string`.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/unit/rsvp-service.test.ts` :
```ts
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { openDb, type Db } from '../../src/lib/db';
import { parseEvent } from '../../src/lib/event';
import type { Expediteur, Message } from '../../src/lib/mail/types';
import { CHAMPS_VIDES, type ChampsRsvp } from '../../src/lib/rsvp';
import { modifier, nomFichierInvitation, soumettre, type Deps } from '../../src/lib/rsvp-service';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));
const champs: ChampsRsvp = { ...CHAMPS_VIDES, vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', moments: ['diner'], message: 'Bravo' };
const AVANT = new Date('2027-01-10T10:00:00Z');
const APRES = new Date('2027-05-02T10:00:00Z');

let db: Db;
let envoyes: Message[];
let deps: Deps;
beforeEach(async () => {
  db = await openDb(':memory:');
  envoyes = [];
  const expediteur: Expediteur = { envoyer: async (m) => { envoyes.push(m); } };
  deps = { db, expediteur, ev, maintenant: () => AVANT, urlBase: 'https://site.fr', invitationPdf: async () => new Uint8Array([37, 80, 68, 70]), limite: 5 };
});

describe('soumettre', () => {
  test('vient : enregistre, envoie confirmation + PDF, marque l’e-mail envoyé', async () => {
    const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
    expect(r.type).toBe('ok');
    if (r.type !== 'ok') return;
    expect(r.emailEnvoye).toBe(true);
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0].a).toBe('camille@exemple.fr');
    expect(envoyes[0].piecesJointes).toEqual([{ nom: 'Invitation-Camille-Martin.pdf', contenu: new Uint8Array([37, 80, 68, 70]), type: 'application/pdf' }]);
    expect(envoyes[0].html).toContain(`https://site.fr/fr/rsvp/modifier?jeton=${r.reponse.jeton}`);
    expect((await db.parEmail('camille@exemple.fr'))?.emailEnvoye).toBe(true);
  });

  test('ne vient pas : e-mail de regrets sans PDF', async () => {
    await soumettre({ ...champs, vient: false, moments: [] }, 'fr', '1.1.1.1', deps);
    expect(envoyes[0].piecesJointes ?? []).toEqual([]);
  });

  test('doublon (casse et espaces différents) : rien n’est modifié, le lien est renvoyé', async () => {
    await soumettre(champs, 'fr', '1.1.1.1', deps);
    const r = await soumettre({ ...champs, email: '  Camille@Exemple.FR ', nom: 'Autre Nom', vient: false, moments: [] }, 'fr', '1.1.1.1', deps);
    expect(r).toEqual({ type: 'doublon' });
    expect((await db.parEmail('CAMILLE@EXEMPLE.FR'))?.nom).toBe('Camille Martin');
    expect(envoyes).toHaveLength(2);
    expect(envoyes[1].sujet).toContain('modifier');
  });

  test('après la date limite : fermé, rien d’enregistré', async () => {
    expect(await soumettre(champs, 'fr', '1.1.1.1', { ...deps, maintenant: () => APRES })).toEqual({ type: 'ferme' });
    expect(await db.parEmail('camille@exemple.fr')).toBeNull();
  });

  test('champ piège rempli : ignoré en silence', async () => {
    expect(await soumettre({ ...champs, piege: 'http://spam' }, 'fr', '1.1.1.1', deps)).toEqual({ type: 'ignore' });
    expect(envoyes).toHaveLength(0);
  });

  test('invalide : erreurs, rien d’enregistré', async () => {
    const r = await soumettre({ ...champs, email: 'x' }, 'fr', '1.1.1.1', deps);
    expect(r).toEqual({ type: 'invalide', erreurs: { email: 'rsvp.err.email' } });
  });

  test('limite par IP', async () => {
    for (let i = 0; i < 5; i++) await soumettre({ ...champs, email: `p${i}@exemple.fr` }, 'fr', '9.9.9.9', deps);
    expect(await soumettre({ ...champs, email: 'p6@exemple.fr' }, 'fr', '9.9.9.9', deps)).toEqual({ type: 'limite' });
  });

  test('échec d’envoi : réponse enregistrée, emailEnvoye = false', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await soumettre(champs, 'fr', '1.1.1.1', { ...deps, expediteur: { envoyer: async () => { throw new Error('panne'); } } });
    expect(r).toMatchObject({ type: 'ok', emailEnvoye: false });
    expect((await db.parEmail('camille@exemple.fr'))?.emailEnvoye).toBe(false);
    err.mockRestore();
  });
});

describe('modifier', () => {
  test('met à jour et renvoie une confirmation ; l’e-mail ne change pas', async () => {
    const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
    if (r.type !== 'ok') throw new Error();
    const m = await modifier(r.reponse.jeton, { ...champs, email: 'pirate@exemple.fr', accompagnants: ['Léo'] }, 'fr', deps);
    expect(m).toMatchObject({ type: 'ok', reponse: { email: 'camille@exemple.fr', accompagnants: ['Léo'] } });
    expect(envoyes).toHaveLength(2);
  });
  test('jeton inconnu', async () => {
    expect(await modifier('inconnu', champs, 'fr', deps)).toEqual({ type: 'introuvable' });
  });
  test('après la date limite : fermé', async () => {
    const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
    if (r.type !== 'ok') throw new Error();
    expect(await modifier(r.reponse.jeton, champs, 'fr', { ...deps, maintenant: () => APRES })).toEqual({ type: 'ferme' });
  });
});

test('nomFichierInvitation', () => {
  expect(nomFichierInvitation('Camille Martin')).toBe('Invitation-Camille-Martin.pdf');
  expect(nomFichierInvitation('Zoë / <Léa>')).toBe('Invitation-Zoe-Lea.pdf');
});
```

Exécuter : `npx vitest run tests/unit/rsvp-service.test.ts`. Attendu : ÉCHEC (module introuvable).

- [ ] **Étape 2 : implémenter `src/lib/rsvp-service.ts`**

```ts
import { ErreurDoublon, type Db, type Reponse } from './db';
import type { EventConfig, Lang } from './event';
import { depasseLimite } from './limites';
import { emailConfirmation, emailLienModification, emailRegrets, type Liens } from './mail/templates';
import type { Expediteur } from './mail/types';
import { rsvpOuvert, valider, type ChampsRsvp, type ErreursRsvp } from './rsvp';

export type Deps = {
  db: Db; expediteur: Expediteur; ev: EventConfig; maintenant: () => Date; urlBase: string;
  invitationPdf: (r: Reponse) => Promise<Uint8Array>; limite: number;
};
export type Resultat =
  | { type: 'ok'; reponse: Reponse; emailEnvoye: boolean }
  | { type: 'doublon' } | { type: 'ferme' } | { type: 'limite' } | { type: 'ignore' } | { type: 'introuvable' }
  | { type: 'invalide'; erreurs: ErreursRsvp };

const FENETRE = 10 * 60 * 1000;

export function liens(r: Reponse, urlBase: string): Liens {
  return {
    programme: `${urlBase}/${r.langue}/programme`,
    modifier: `${urlBase}/${r.langue}/rsvp/modifier?jeton=${encodeURIComponent(r.jeton)}`,
  };
}

export function nomFichierInvitation(nom: string): string {
  const propre = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Invitation-${propre || 'invite'}.pdf`;
}

async function envoyerConfirmation(r: Reponse, deps: Deps): Promise<boolean> {
  try {
    const l = liens(r, deps.urlBase);
    if (r.vient) {
      const c = emailConfirmation(deps.ev, r, l);
      const pdf = await deps.invitationPdf(r);
      await deps.expediteur.envoyer({ a: r.email, ...c, piecesJointes: [{ nom: nomFichierInvitation(r.nom), contenu: pdf, type: 'application/pdf' }] });
    } else {
      await deps.expediteur.envoyer({ a: r.email, ...emailRegrets(deps.ev, r, l) });
    }
    await deps.db.marquerEmailEnvoye(r.id, true);
    return true;
  } catch (e) {
    console.error('Envoi de la confirmation impossible :', e);
    await deps.db.marquerEmailEnvoye(r.id, false);
    return false;
  }
}

async function renvoyerLien(email: string, deps: Deps): Promise<void> {
  const r = await deps.db.parEmail(email);
  if (!r) return;
  try {
    await deps.expediteur.envoyer({ a: r.email, ...emailLienModification(deps.ev, r, liens(r, deps.urlBase)) });
  } catch (e) {
    console.error('Envoi du lien de modification impossible :', e);
  }
}

export async function soumettre(champs: ChampsRsvp, langue: Lang, ip: string, deps: Deps): Promise<Resultat> {
  if (champs.piege) return { type: 'ignore' };
  const maintenant = deps.maintenant();
  if (!rsvpOuvert(deps.ev.evenement, maintenant)) return { type: 'ferme' };
  if (await depasseLimite(deps.db, `rsvp:${ip}`, deps.limite, FENETRE, maintenant)) return { type: 'limite' };
  const v = valider(champs, deps.ev.moments.map((m) => m.id), langue);
  if (!v.ok) return { type: 'invalide', erreurs: v.erreurs };
  let reponse: Reponse;
  try {
    reponse = await deps.db.ajouter(v.data, maintenant);
  } catch (e) {
    if (!(e instanceof ErreurDoublon)) throw e;
    await renvoyerLien(v.data.email, deps);
    return { type: 'doublon' };
  }
  return { type: 'ok', reponse, emailEnvoye: await envoyerConfirmation(reponse, deps) };
}

export async function modifier(jeton: string, champs: ChampsRsvp, langue: Lang, deps: Deps): Promise<Resultat> {
  const existante = await deps.db.parJeton(jeton);
  if (!existante) return { type: 'introuvable' };
  const maintenant = deps.maintenant();
  if (!rsvpOuvert(deps.ev.evenement, maintenant)) return { type: 'ferme' };
  const v = valider({ ...champs, email: existante.email }, deps.ev.moments.map((m) => m.id), langue);
  if (!v.ok) return { type: 'invalide', erreurs: v.erreurs };
  const { email: _ignore, ...sansEmail } = v.data;
  const reponse = (await deps.db.modifier(jeton, sansEmail, maintenant))!;
  return { type: 'ok', reponse, emailEnvoye: await envoyerConfirmation(reponse, deps) };
}
```

- [ ] **Étape 3 : vérifier**

Exécuter : `npx vitest run tests/unit/rsvp-service.test.ts`, puis `npx vitest run`. Attendu : RÉUSSI, sortie propre (l'erreur attendue du test « échec d'envoi » est masquée par le `spyOn`).

- [ ] **Étape 4 : commit**

```bash
git add -A
git commit -m "Ajoute le traitement complet d'une réponse"
```

---

### Tâche 8 : page RSVP & Livre d'or

**Fichiers :**
- Créer : `src/lib/services.ts`, `src/components/RsvpForm.astro`, `src/components/LivreDor.astro`, `src/scripts/rsvp-form.ts`, `src/pages/[lang]/rsvp.astro`, `scripts/reset-test-data.mjs`, `tests/e2e/outbox.ts`, `tests/e2e/rsvp.spec.ts`
- Modifier : `src/lib/i18n.ts` (clés `rsvp.*`, `livre.*`), `playwright.config.ts`, `src/pages/[lang]/index.astro` (extrait du livre d'or)

**Interfaces :**
- Consomme : `soumettre`, `Resultat`, `Deps`, `lireFormulaire`, `CHAMPS_VIDES`, `rsvpOuvert`, `nombrePersonnes`, `getDb`, `getExpediteur`, `genererInvitation`, `polices`, `photoJpeg`, `getEvent`.
- Produit :
  - `getDeps(): Promise<Deps>` (`services.ts`) ;
  - `<RsvpForm lang ev champs erreurs? libelleEnvoyer emailVerrouille?>` ;
  - `<LivreDor lang messages>` ;
  - `messagesEnvoyesA(email: string): { dossier: string; meta: { a: string; sujet: string; piecesJointes: string[] }; html: string }[]` (`tests/e2e/outbox.ts`).

- [ ] **Étape 1 : configuration des tests de bout en bout (serveur dédié)**

`scripts/reset-test-data.mjs` (nouveau) :
```js
import { rmSync } from 'node:fs';

// Repart d'une base et d'une boîte d'envoi de test vides, juste avant le démarrage du serveur de test.
for (const p of ['.data/test.db', '.data/test.db-journal', '.data/test.db-wal', '.data/test.db-shm', '.data/test-outbox']) {
  rmSync(p, { recursive: true, force: true });
}
```

`playwright.config.ts` (remplacer le contenu) :
```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    // Le nettoyage fait partie de la commande : il a lieu une seule fois, avant que le serveur n'ouvre la base.
    command: `node scripts/reset-test-data.mjs && node node_modules/astro/bin/astro.mjs dev --port ${PORT}`,
    url: `http://localhost:${PORT}/fr/infos`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: 'file:.data/test.db', OUTBOX_DIR: '.data/test-outbox', MAIL_MODE: 'outbox', RSVP_LIMITE: '1000',
      MAINTENANT_TEST: '2027-01-15T12:00:00+01:00',
    },
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'telephone', use: { ...devices['Pixel 7'] } },
  ],
});
```

> `MAINTENANT_TEST` fige l'horloge du serveur de test avant la date limite : les tests de réponse ne dépendent pas de la date réelle. L'adresse de disponibilité (`/fr/infos`) n'ouvre pas la base, contrairement à l'accueil.

`tests/e2e/outbox.ts` :
```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = '.data/test-outbox';

export function messagesEnvoyesA(email: string) {
  if (!existsSync(DOSSIER)) return [];
  return readdirSync(DOSSIER).sort().filter((nom) => existsSync(join(DOSSIER, nom, 'meta.json'))).map((nom) => {
    const dossier = join(DOSSIER, nom);
    return { dossier, meta: JSON.parse(readFileSync(join(dossier, 'meta.json'), 'utf8')), html: readFileSync(join(dossier, 'message.html'), 'utf8') };
  }).filter((m) => m.meta.a === email.toLowerCase());
}
```

- [ ] **Étape 2 : textes d'interface** (ajouter à `DICT` dans `src/lib/i18n.ts`)

```ts
  'rsvp.je_viens': { fr: '🎉 Je viens !', en: "🎉 I'm coming!" },
  'rsvp.je_ne_viens_pas': { fr: '😢 Je ne pourrai pas', en: "😢 I can't make it" },
  'rsvp.presence': { fr: 'Ta réponse', en: 'Your reply' },
  'rsvp.nom': { fr: 'Prénom & nom', en: 'First & last name' },
  'rsvp.email': { fr: 'E-mail', en: 'Email' },
  'rsvp.email_aide': { fr: 'pour recevoir ton invitation', en: 'to receive your invitation' },
  'rsvp.telephone': { fr: 'Téléphone', en: 'Phone' },
  'rsvp.facultatif': { fr: '(facultatif)', en: '(optional)' },
  'rsvp.accompagnants': { fr: 'Accompagnants', en: 'Plus-ones' },
  'rsvp.accompagnant': { fr: 'Accompagnant', en: 'Plus-one' },
  'rsvp.ajouter': { fr: '+ Ajouter un accompagnant', en: '+ Add a plus-one' },
  'rsvp.retirer': { fr: 'Retirer', en: 'Remove' },
  'rsvp.moments': { fr: 'À quels moments seras-tu là ?', en: 'Which moments will you join?' },
  'rsvp.message': { fr: 'Un petit mot ?', en: 'A few words?' },
  'rsvp.message_aide': { fr: "(affiché dans le livre d'or)", en: '(shown in the guestbook)' },
  'rsvp.envoyer': { fr: 'Envoyer ma réponse', en: 'Send my reply' },
  'rsvp.enregistrer': { fr: 'Enregistrer les modifications', en: 'Save changes' },
  'rsvp.note': { fr: 'Tu pourras modifier ta réponse grâce au lien reçu par e-mail.', en: 'You can change your reply with the link in your email.' },
  'rsvp.erreurs': { fr: 'Merci de corriger les champs signalés.', en: 'Please fix the highlighted fields.' },
  'rsvp.merci': { fr: 'Merci', en: 'Thank you' },
  'rsvp.note_pour': { fr: "C'est noté pour", en: "We've got you down for" },
  'rsvp.personne': { fr: 'personne', en: 'person' },
  'rsvp.personnes': { fr: 'personnes', en: 'people' },
  'rsvp.email_parti': { fr: 'Ton invitation (PDF) vient de partir à', en: 'Your invitation (PDF) has just been sent to' },
  'rsvp.regrets': { fr: 'Dommage ! Merci de nous avoir prévenus.', en: 'What a shame! Thanks for letting us know.' },
  'rsvp.indesirables': { fr: 'Pense à vérifier tes courriers indésirables.', en: 'Remember to check your spam folder.' },
  'rsvp.email_plus_tard': { fr: "Réponse enregistrée : l'e-mail arrivera un peu plus tard.", en: 'Reply saved: the email will arrive a little later.' },
  'rsvp.doublon': { fr: "Tu as déjà répondu avec cette adresse : on vient de t'envoyer le lien pour modifier ta réponse.", en: 'You have already replied with this address: we just sent you the link to change your reply.' },
  'rsvp.ferme': { fr: 'Les réponses sont closes. Merci !', en: 'Replies are now closed. Thank you!' },
  'rsvp.limite': { fr: "Trop d'envois en peu de temps. Réessaie dans quelques minutes.", en: 'Too many attempts. Please try again in a few minutes.' },
  'rsvp.retour': { fr: "← Revenir à l'accueil", en: '← Back to home' },
  'livre.titre': { fr: "Le livre d'or", en: 'The guestbook' },
  'livre.vide': { fr: 'Sois le premier à laisser un mot !', en: 'Be the first to leave a message!' },
```

- [ ] **Étape 3 : écrire les tests de bout en bout qui échouent**

`tests/e2e/rsvp.spec.ts` :
```ts
import { expect, test } from '@playwright/test';
import { messagesEnvoyesA } from './outbox';

const email = (info: { project: { name: string } }, tag: string) => `${tag}-${info.project.name}-${Date.now()}@exemple.fr`;

test('confirmation complète : merci, e-mail avec PDF, message dans le livre d’or', async ({ page }, info) => {
  const adresse = email(info, 'oui');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Camille <b>Martin</b>');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByRole('button', { name: '+ Ajouter un accompagnant' }).click();
  await page.getByLabel('Accompagnant 1').fill('Léo Martin');
  await page.getByLabel('19 h · Dîner').check();
  const mot = `Joyeux anniversaire ${info.project.name} ${Date.now()}`;
  await page.getByLabel(/Un petit mot/).fill(mot);
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();

  await expect(page.getByRole('heading', { name: /Merci Camille/ })).toBeVisible();
  await expect(page.getByText("C'est noté pour 2 personnes")).toBeVisible();
  await expect(page.getByText(adresse)).toBeVisible();
  await expect(page.locator('.livre')).toContainText(mot);
  await expect(page.locator('.livre')).toContainText('Camille <b>Martin</b>');

  const m = messagesEnvoyesA(adresse);
  expect(m).toHaveLength(1);
  expect(m[0].meta.piecesJointes).toEqual(['Invitation-Camille-b-Martin-b.pdf']);
  expect(m[0].html).toContain('/fr/rsvp/modifier?jeton=');
});

test('ne vient pas : moments et accompagnants masqués, e-mail sans PDF', async ({ page }, info) => {
  const adresse = email(info, 'non');
  await page.goto('/fr/rsvp');
  await page.getByLabel('😢 Je ne pourrai pas').check();
  await expect(page.getByText('À quels moments seras-tu là ?')).toBeHidden();
  await page.getByLabel('Prénom & nom').fill('Paul Leroy');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText('Dommage ! Merci de nous avoir prévenus.')).toBeVisible();
  expect(messagesEnvoyesA(adresse)[0].meta.piecesJointes).toEqual([]);
});

test('erreurs : champs signalés, saisie conservée', async ({ page }) => {
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Camille');
  await page.getByLabel(/^E-mail/).fill('pas-un-email');
  await page.locator('form.rsvp').evaluate((f: HTMLFormElement) => f.setAttribute('novalidate', ''));
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText('Merci de corriger les champs signalés.')).toBeVisible();
  await expect(page.getByText('Adresse e-mail invalide.')).toBeVisible();
  await expect(page.getByText('Choisis au moins un moment.')).toBeVisible();
  await expect(page.getByLabel('Prénom & nom')).toHaveValue('Camille');
  await expect(page.getByLabel(/^E-mail/)).toHaveAttribute('aria-invalid', 'true');
});

test('doublon : message, aucune seconde réponse, lien renvoyé', async ({ page }, info) => {
  const adresse = email(info, 'double');
  for (const nom of ['Premier Nom', 'Second Nom']) {
    await page.goto('/fr/rsvp');
    await page.getByLabel('😢 Je ne pourrai pas').check();
    await page.getByLabel('Prénom & nom').fill(nom);
    await page.getByLabel(/^E-mail/).fill(nom === 'Second Nom' ? `  ${adresse.toUpperCase()} ` : adresse);
    await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  }
  await expect(page.getByText('Tu as déjà répondu avec cette adresse')).toBeVisible();
  const m = messagesEnvoyesA(adresse);
  expect(m).toHaveLength(2);
  expect(m[1].meta.sujet).toContain('modifier');
});

test('fonctionne sans JavaScript', async ({ browser }, info) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  const adresse = email(info, 'nojs');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Sans Script');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByLabel('Accompagnant 2').fill('Ami Deux');
  await page.getByLabel('16 h · Accueil').check();
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText("C'est noté pour 2 personnes")).toBeVisible();
  await ctx.close();
});

test('version anglaise', async ({ page }) => {
  await page.goto('/en/rsvp');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Are you coming?');
  await expect(page.getByLabel("🎉 I'm coming!")).toBeVisible();
});

test('l’accueil affiche un extrait du livre d’or', async ({ page }, info) => {
  const mot = `Extrait accueil ${info.project.name} ${Date.now()}`;
  await page.goto('/fr/rsvp');
  await page.getByLabel('😢 Je ne pourrai pas').check();
  await page.getByLabel('Prénom & nom').fill('Julie Bernard');
  await page.getByLabel(/^E-mail/).fill(email(info, 'extrait'));
  await page.getByLabel(/Un petit mot/).fill(mot);
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await page.goto('/fr/');
  // Un autre test peut avoir laissé un message plus récent : on vérifie qu'un extrait signé s'affiche.
  await expect(page.locator('.tu-viens blockquote footer')).toContainText('—');
});
```

> Les deux projets (ordinateur, téléphone) s'exécutent en parallèle sur le même serveur : chaque test utilise une adresse unique, construite avec le nom du projet et l'heure. Le dernier test vérifie qu'un extrait signé s'affiche sans en fixer l'auteur, car un autre test peut avoir laissé un message plus récent entre-temps.

Exécuter : `npx playwright test tests/e2e/rsvp.spec.ts --project=ordinateur`. Attendu : ÉCHEC (page 404).

- [ ] **Étape 4 : écrire `src/lib/services.ts`**

```ts
import { getDb } from './db';
import { getEvent } from './load-event';
import { getExpediteur } from './mail/index';
import { genererInvitation } from './pdf/invitation';
import { photoJpeg, polices } from './pdf/ressources';
import type { Deps } from './rsvp-service';

export async function getDeps(): Promise<Deps> {
  const ev = getEvent();
  const urlBase = ev.site.url_publique.replace(/\/+$/, '');
  return {
    db: await getDb(),
    // Créé au moment de l'envoi : une configuration d'e-mail incomplète ne doit pas empêcher d'afficher les pages,
    // elle fait seulement échouer l'envoi (réponse enregistrée, « l'e-mail arrivera plus tard »).
    expediteur: { envoyer: (m) => getExpediteur(ev.email.expediteur_nom).envoyer(m) },
    ev,
    // MAINTENANT_TEST fige l'horloge pour les tests de bout en bout (sinon liés à la date réelle et à la date limite).
    maintenant: () => (process.env.MAINTENANT_TEST ? new Date(process.env.MAINTENANT_TEST) : new Date()),
    urlBase,
    limite: Number(process.env.RSVP_LIMITE || 5),
    invitationPdf: async (r) => genererInvitation({
      ev, reponse: r, photo: await photoJpeg(ev.accueil.photo_principale), polices: polices(), urlQr: `${urlBase}/${r.langue}/programme`,
    }),
  };
}
```

- [ ] **Étape 5 : écrire les composants**

`src/components/RsvpForm.astro` :
- **Sans JavaScript :** le formulaire est complet et utilisable, avec 3 champs d'accompagnant vides.
- **Avec JavaScript :** il est amélioré par `src/scripts/rsvp-form.ts`.

```astro
---
import type { EventConfig, Lang } from '../lib/event';
import { ui } from '../lib/i18n';
import { momentLabel } from '../lib/moments';
import type { ChampsRsvp, ErreursRsvp } from '../lib/rsvp';
interface Props { lang: Lang; ev: EventConfig; champs: ChampsRsvp; erreurs?: ErreursRsvp; libelleEnvoyer: string; emailVerrouille?: boolean }
const { lang, ev, champs, erreurs = {}, libelleEnvoyer, emailVerrouille = false } = Astro.props;
const acc = [...champs.accompagnants, '', '', ''].slice(0, Math.max(3, champs.accompagnants.length + 1));
const err = (k: keyof ErreursRsvp) => (erreurs[k] ? ui(lang, erreurs[k]!) : '');
---
<form class="rsvp" method="post">
  {Object.keys(erreurs).length > 0 && <p class="alerte" role="alert">{ui(lang, 'rsvp.erreurs')}</p>}
  <div class="hp" aria-hidden="true"><label>Ne pas remplir <input name="ne_pas_remplir" tabindex="-1" autocomplete="off" /></label></div>

  <fieldset class="presence" aria-describedby={erreurs.vient ? 'err-vient' : undefined}>
    <legend class="sr-only">{ui(lang, 'rsvp.presence')}</legend>
    <label class="choix"><input type="radio" name="vient" value="oui" checked={champs.vient === true} required /> <span>{ui(lang, 'rsvp.je_viens')}</span></label>
    <label class="choix"><input type="radio" name="vient" value="non" checked={champs.vient === false} /> <span>{ui(lang, 'rsvp.je_ne_viens_pas')}</span></label>
  </fieldset>
  {erreurs.vient && <p class="err" id="err-vient">{err('vient')}</p>}

  <div class="ligne">
    <div>
      <label for="nom">{ui(lang, 'rsvp.nom')}</label>
      <input id="nom" name="nom" value={champs.nom} required minlength="2" maxlength="100" autocomplete="name"
        aria-invalid={erreurs.nom ? 'true' : undefined} aria-describedby={erreurs.nom ? 'err-nom' : undefined} />
      {erreurs.nom && <p class="err" id="err-nom">{err('nom')}</p>}
    </div>
    <div>
      <label for="telephone">{ui(lang, 'rsvp.telephone')}{' '}<small>{ui(lang, 'rsvp.facultatif')}</small></label>
      <input id="telephone" name="telephone" type="tel" value={champs.telephone} maxlength="30" autocomplete="tel"
        aria-invalid={erreurs.telephone ? 'true' : undefined} aria-describedby={erreurs.telephone ? 'err-telephone' : undefined} />
      {erreurs.telephone && <p class="err" id="err-telephone">{err('telephone')}</p>}
    </div>
  </div>

  <label for="email">{ui(lang, 'rsvp.email')}{' '}<small>— {ui(lang, 'rsvp.email_aide')}</small></label>
  <input id="email" name="email" type="email" value={champs.email} required maxlength="254" autocomplete="email" readonly={emailVerrouille}
    aria-invalid={erreurs.email ? 'true' : undefined} aria-describedby={erreurs.email ? 'err-email' : undefined} />
  {erreurs.email && <p class="err" id="err-email">{err('email')}</p>}

  <div class="si-vient">
    <fieldset>
      <legend>{ui(lang, 'rsvp.accompagnants')}</legend>
      <ul class="accompagnants">
        {acc.map((a, i) => (
          <li>
            <label class="sr-only" for={`acc-${i + 1}`}>{ui(lang, 'rsvp.accompagnant')} {i + 1}</label>
            <input id={`acc-${i + 1}`} name="accompagnant" value={a} maxlength="100" placeholder={`${ui(lang, 'rsvp.accompagnant')} ${i + 1}`} />
            <button type="button" class="retirer" hidden aria-label={`${ui(lang, 'rsvp.retirer')} ${i + 1}`}>✕</button>
          </li>
        ))}
      </ul>
      <button type="button" class="ajouter" hidden>{ui(lang, 'rsvp.ajouter')}</button>
      {erreurs.accompagnants && <p class="err">{err('accompagnants')}</p>}
    </fieldset>

    <fieldset class="moments" aria-describedby={erreurs.moments ? 'err-moments' : undefined}>
      <legend>{ui(lang, 'rsvp.moments')}</legend>
      {ev.moments.map((m) => (
        <label><input type="checkbox" name="moment" value={m.id} checked={champs.moments.includes(m.id)} /> {momentLabel(m, lang)}</label>
      ))}
      {erreurs.moments && <p class="err" id="err-moments">{err('moments')}</p>}
    </fieldset>
  </div>

  <label for="message">{ui(lang, 'rsvp.message')}{' '}<small>{ui(lang, 'rsvp.message_aide')}</small></label>
  <textarea id="message" name="message" maxlength="1000" aria-invalid={erreurs.message ? 'true' : undefined}>{champs.message}</textarea>
  {erreurs.message && <p class="err">{err('message')}</p>}

  <button class="btn btn-plein envoyer" type="submit">{libelleEnvoyer}</button>
  <p class="note">{ui(lang, 'rsvp.note')}</p>
</form>

<style>
  .rsvp { background: #fff; border-radius: 22px; padding: 26px 28px; box-shadow: 0 10px 26px rgba(58,36,25,.12); }
  .rsvp label, .rsvp legend { display: block; font-weight: 800; margin: 16px 0 6px; }
  .rsvp small { font-weight: 600; color: var(--c-texte-doux); }
  .rsvp input:not([type=radio]):not([type=checkbox]), .rsvp textarea { width: 100%; border: 2px solid #ecdcd0; border-radius: 12px; padding: 11px 14px; font: inherit; background: var(--c-fond); }
  .rsvp input[aria-invalid=true], .rsvp textarea[aria-invalid=true] { border-color: #b3261e; }
  .rsvp textarea { min-height: 100px; resize: vertical; }
  fieldset { border: 0; padding: 0; margin: 0; }
  .presence { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .choix { margin: 0 !important; position: relative; }
  .choix input { position: absolute; opacity: 0; inset: 0; }
  .choix span { display: block; text-align: center; padding: 16px; border-radius: 14px; border: 2px solid #ecdcd0; background: var(--c-fond); font-size: 1.05rem; cursor: pointer; }
  .choix input:checked + span { background: var(--c-principale-fonce); border-color: var(--c-principale-fonce); color: var(--c-fond); }
  .choix input:focus-visible + span { outline: 3px solid var(--c-texte); outline-offset: 3px; }
  .ligne { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .accompagnants { list-style: none; padding: 0; margin: 0; }
  .accompagnants li { display: flex; gap: 8px; margin-bottom: 8px; }
  .accompagnants li[hidden], .rsvp [hidden] { display: none; }
  .retirer { background: none; border: 0; font-size: 1.1rem; cursor: pointer; color: var(--c-texte-doux); }
  .ajouter { background: none; border: 2px dashed var(--c-principale-fonce); color: var(--c-principale-fonce); border-radius: 12px; padding: 9px 14px; font: inherit; font-weight: 800; cursor: pointer; }
  .moments label { display: flex; align-items: center; gap: 10px; font-weight: 600; margin: 6px 0; background: var(--c-fond); border: 2px solid #ecdcd0; border-radius: 12px; padding: 10px 14px; }
  .moments input { accent-color: var(--c-principale-fonce); width: 18px; height: 18px; }
  .err { color: #b3261e; font-weight: 700; margin: 6px 0 0; }
  .alerte { background: #fde7e5; color: #8d1f18; border-radius: 12px; padding: 10px 14px; font-weight: 700; margin: 0 0 8px; }
  .envoyer { width: 100%; margin-top: 22px; font-size: 1.1rem; }
  .note { font-size: .9rem; color: var(--c-texte-doux); text-align: center; margin: 10px 0 0; }
  .hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
  @media (max-width: 560px) { .ligne { grid-template-columns: 1fr; } .rsvp { padding: 20px 16px; } }
</style>

<script>
  import { monterFormulaire } from '../scripts/rsvp-form';
  monterFormulaire();
</script>
```

`src/scripts/rsvp-form.ts` :
```ts
/** Améliore le formulaire : masque la partie « je viens » si besoin, gère l'ajout et le retrait d'accompagnants. */
export function monterFormulaire(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>('form.rsvp');
  if (!form) return;
  const siVient = form.querySelector<HTMLElement>('.si-vient')!;
  const liste = form.querySelector<HTMLUListElement>('.accompagnants')!;
  const ajouter = form.querySelector<HTMLButtonElement>('.ajouter')!;

  const majPresence = () => {
    const non = form.querySelector<HTMLInputElement>('input[name=vient][value=non]')!.checked;
    siVient.hidden = non;
  };
  form.querySelectorAll('input[name=vient]').forEach((r) => r.addEventListener('change', majPresence));
  majPresence();

  // Avec JS : on ne garde visibles que les lignes remplies (au moins une), et on montre les boutons.
  const lignes = () => Array.from(liste.querySelectorAll('li'));
  const renumeroter = () => lignes().filter((li) => !li.hidden).forEach((li, i) => {
    const input = li.querySelector('input')!;
    const label = li.querySelector('label')!;
    const base = label.textContent!.replace(/\s*\d+$/, '');
    label.textContent = `${base} ${i + 1}`;
    input.placeholder = `${base} ${i + 1}`;
  });
  lignes().forEach((li, i) => {
    const input = li.querySelector('input')!;
    li.hidden = !input.value && i > 0;
    li.querySelector<HTMLButtonElement>('.retirer')!.hidden = false;
    li.querySelector<HTMLButtonElement>('.retirer')!.addEventListener('click', () => {
      input.value = '';
      if (lignes().filter((l) => !l.hidden).length > 1) li.hidden = true;
      renumeroter();
    });
  });
  if (lignes().every((li) => li.querySelector('input')!.value === '')) lignes()[0].hidden = true;
  ajouter.hidden = false;
  ajouter.addEventListener('click', () => {
    const visibles = lignes().filter((l) => !l.hidden);
    if (visibles.length >= 10) return;
    let cachee = lignes().find((l) => l.hidden);
    if (!cachee) {
      cachee = lignes()[0].cloneNode(true) as HTMLLIElement;
      const n = lignes().length + 1;
      cachee.querySelector('input')!.id = `acc-${n}`;
      cachee.querySelector('label')!.htmlFor = `acc-${n}`;
      cachee.querySelector('input')!.value = '';
      cachee.querySelector('.retirer')!.addEventListener('click', () => { cachee!.querySelector('input')!.value = ''; cachee!.hidden = true; renumeroter(); });
      liste.append(cachee);
    }
    cachee.hidden = false;
    renumeroter();
    cachee.querySelector('input')!.focus();
  });
  renumeroter();
}
```

> Comportement attendu, sur lequel s'appuient les tests :
> - **Sans JavaScript :** les champs « Accompagnant 1 » à « Accompagnant 3 » sont visibles.
> - **Avec JavaScript, formulaire vide :** aucune ligne n'est visible au départ, et le premier clic sur « + Ajouter un accompagnant » fait apparaître « Accompagnant 1 ».
> - **Champs cachés :** une ligne masquée (`hidden`) est toujours envoyée, mais vide ; elle est donc ignorée par `lireFormulaire`.

`src/components/LivreDor.astro` :
```astro
---
import type { Lang } from '../lib/event';
import { ui } from '../lib/i18n';
interface Props { lang: Lang; messages: { nom: string; message: string }[] }
const { lang, messages } = Astro.props;
---
<section class="livre" aria-labelledby="titre-livre">
  <h2 id="titre-livre" class="titre-section">{ui(lang, 'livre.titre')}</h2>
  {messages.length === 0 && <p class="vide">{ui(lang, 'livre.vide')}</p>}
  <ul>
    {messages.map((m) => (
      <li><blockquote><p>« {m.message} »</p><footer>{m.nom}</footer></blockquote></li>
    ))}
  </ul>
</section>
<style>
  ul { list-style: none; padding: 0; margin: 0; }
  li { background: #fff; border-radius: 16px; padding: 16px 18px; margin-bottom: 14px; box-shadow: 0 6px 14px rgba(58,36,25,.1); position: relative; }
  li:nth-child(odd) { transform: rotate(-1deg); } li:nth-child(even) { transform: rotate(1deg); }
  li::before { content: ''; position: absolute; top: -8px; right: 20px; width: 16px; height: 16px; border-radius: 50%; background: var(--c-principale-fonce); }
  blockquote { margin: 0; }
  blockquote p { font-family: var(--f-titres); font-size: 1.5rem; line-height: 1.2; margin: 0 0 8px; overflow-wrap: anywhere; }
  footer { color: var(--c-texte-doux); font-weight: 700; }
  .vide { color: var(--c-texte-doux); }
</style>
```

- [ ] **Étape 6 : écrire `src/pages/[lang]/rsvp.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import PageHead from '../../components/PageHead.astro';
import RsvpForm from '../../components/RsvpForm.astro';
import LivreDor from '../../components/LivreDor.astro';
import { t } from '../../lib/event';
import { formatDate, ui } from '../../lib/i18n';
import { CHAMPS_VIDES, lireFormulaire, nombrePersonnes, rsvpOuvert, type ChampsRsvp } from '../../lib/rsvp';
import { soumettre, type Resultat } from '../../lib/rsvp-service';
import { getDeps } from '../../lib/services';

const lang = Astro.locals.lang;
const deps = await getDeps();
const ev = deps.ev;
let champs: ChampsRsvp = CHAMPS_VIDES;
let resultat: Resultat | null = null;
if (Astro.request.method === 'POST') {
  champs = lireFormulaire(await Astro.request.formData());
  let ip = 'inconnue';
  try { ip = Astro.clientAddress; } catch { console.warn('Adresse IP indisponible : limite d’envois partagée par tous les visiteurs'); }
  resultat = await soumettre(champs, lang, ip, deps);
}
const ouvert = rsvpOuvert(ev.evenement, deps.maintenant());
const messages = await deps.db.messagesVisibles(30);
const afficherFormulaire = ouvert && (!resultat || resultat.type === 'invalide' || resultat.type === 'limite');
const avant = formatDate(ev.evenement.date_limite_rsvp + 'T12:00:00+00:00', lang);
---
<Base lang={lang} current="rsvp" title={t(ev.rsvp.titre, lang)}>
  <PageHead title={t(ev.rsvp.titre, lang)} subtitle={`${ui(lang, 'accueil.avant')} ${avant}`} />
  <div class="container grille">
    <div>
      {resultat?.type === 'ok' && (
        <div class="carte-resultat" role="status">
          <p class="gros" aria-hidden="true">{resultat.reponse.vient ? '🥳' : '💌'}</p>
          <h2 class="hand">{ui(lang, 'rsvp.merci')} {resultat.reponse.nom.split(' ')[0]} !</h2>
          {resultat.reponse.vient ? (
            <p>{ui(lang, 'rsvp.note_pour')} {nombrePersonnes(resultat.reponse)}{' '}
              {ui(lang, nombrePersonnes(resultat.reponse) > 1 ? 'rsvp.personnes' : 'rsvp.personne')}.</p>
          ) : <p>{ui(lang, 'rsvp.regrets')}</p>}
          {resultat.reponse.vient && <p>{t(ev.rsvp.message_merci, lang)}</p>}
          {resultat.emailEnvoye ? (
            <p>{ui(lang, 'rsvp.email_parti')}{' '}<b>{resultat.reponse.email}</b>. {ui(lang, 'rsvp.indesirables')}</p>
          ) : <p>{ui(lang, 'rsvp.email_plus_tard')}</p>}
          <a class="btn btn-contour" href={`/${lang}/`}>{ui(lang, 'rsvp.retour')}</a>
        </div>
      )}
      {resultat?.type === 'ignore' && <div class="carte-resultat" role="status"><h2 class="hand">{ui(lang, 'rsvp.merci')} !</h2></div>}
      {resultat?.type === 'doublon' && <p class="info" role="status">{ui(lang, 'rsvp.doublon')}</p>}
      {resultat?.type === 'limite' && <p class="info" role="alert">{ui(lang, 'rsvp.limite')}</p>}
      {(!ouvert || resultat?.type === 'ferme') && <p class="info" role="status">{ui(lang, 'rsvp.ferme')}</p>}
      {afficherFormulaire && (
        <RsvpForm lang={lang} ev={ev} champs={champs} erreurs={resultat?.type === 'invalide' ? resultat.erreurs : {}} libelleEnvoyer={ui(lang, 'rsvp.envoyer')} />
      )}
    </div>
    <LivreDor lang={lang} messages={messages} />
  </div>
</Base>
<style>
  .grille { display: grid; grid-template-columns: 1.1fr .9fr; gap: 36px; padding-block: 20px 48px; align-items: start; }
  .carte-resultat { background: #fff; border-radius: 22px; padding: 32px 24px; text-align: center; box-shadow: 0 10px 26px rgba(58,36,25,.12); }
  .carte-resultat .gros { font-size: 3.5rem; margin: 0; }
  .carte-resultat h2 { font-size: 2.8rem; color: var(--c-principale); margin: 4px 0 8px; }
  .info { background: var(--c-douce); border-radius: 14px; padding: 14px 18px; font-weight: 700; margin: 0 0 16px; }
  @media (max-width: 860px) { .grille { grid-template-columns: 1fr; } }
</style>
```

> **Protection contre la falsification de requêtes (CSRF) :** Astro vérifie par défaut l'en-tête `Origin` des `POST` de formulaire (`security.checkOrigin`, activé par défaut pour les pages rendues à la demande). Vérifier dans le guide Astro 7 que c'est toujours le cas. Si ce n'est pas le cas, ajouter `security: { checkOrigin: true }` à `astro.config.mjs` et l'indiquer.

- [ ] **Étape 7 : extrait du livre d'or sur l'Accueil**

Dans `src/pages/[lang]/index.astro` :
- dans le bloc de script en tête, importer `getDb` depuis `../../lib/db` et ajouter (une panne de base ne doit pas faire tomber l'accueil) :
```ts
let extrait: { nom: string; message: string } | undefined;
try { extrait = (await (await getDb()).messagesVisibles(1))[0]; } catch (e) { console.error('Livre d’or indisponible :', e); }
```
- dans la section `.tu-viens`, après le bouton, ajouter :
```astro
    {extrait && (
      <blockquote class="extrait"><p>« {extrait.message} »</p><footer>— {extrait.nom}</footer></blockquote>
    )}
```
- ajouter à son style :
```css
  .extrait { margin: 32px auto 0; max-width: 520px; background: var(--c-fond); color: var(--c-texte); border-radius: 18px; padding: 18px 24px; transform: rotate(-1deg); }
  .extrait p { font-family: var(--f-titres); font-size: 1.6rem; line-height: 1.2; margin: 0; overflow-wrap: anywhere; }
  .extrait footer { font-size: .95rem; color: var(--c-texte-doux); margin-top: 6px; font-weight: 700; }
```

> Dans `.tu-viens` (zone orange), la règle `.zone-orange p` donnerait au paragraphe de l'extrait la couleur crème. Le fond crème de `.extrait` rendrait alors le texte invisible. Vérifier visuellement, et si besoin préciser `.tu-viens .extrait p { color: var(--c-texte); }`.

- [ ] **Étape 8 : vérifier**

Exécuter : `npx playwright test tests/e2e/rsvp.spec.ts`, puis `npx playwright test`, `npx vitest run` et `npm run build`.
Attendu : tout RÉUSSI dans les deux projets.

Puis contrôler visuellement `/fr/rsvp` (ordinateur et téléphone) par rapport à `docs/maquettes/03-infos-rsvp.html`, et décrire le résultat dans le rapport.

- [ ] **Étape 9 : commit**

```bash
git add -A
git commit -m "Ajoute la page de réponse et le livre d'or"
```

---

### Tâche 9 : modifier sa réponse

**Fichiers :**
- Créer : `src/pages/[lang]/rsvp/modifier.astro`
- Modifier : `src/lib/i18n.ts` (clés `modif.*`), `tests/e2e/rsvp.spec.ts`

**Interfaces :**
- Consomme : `modifier`, `getDeps`, `RsvpForm`, `lireFormulaire`, `CHAMPS_VIDES`, `rsvpOuvert`.

- [ ] **Étape 1 : textes** (ajouter à `DICT`)

```ts
  'modif.titre': { fr: 'Modifier ma réponse', en: 'Change my reply' },
  'modif.introuvable': { fr: "Ce lien de modification n'est pas valide.", en: 'This edit link is not valid.' },
  'modif.ok': { fr: 'Réponse mise à jour ! Un e-mail récapitulatif vient de partir.', en: 'Reply updated! A summary email is on its way.' },
  'modif.repondre': { fr: 'Répondre au formulaire', en: 'Go to the reply form' },
```

- [ ] **Étape 2 : test de bout en bout qui échoue** (ajouter à `tests/e2e/rsvp.spec.ts`)

```ts
test('modifier sa réponse via le lien de l’e-mail', async ({ page }, info) => {
  const adresse = email(info, 'modif');
  await page.goto('/fr/rsvp');
  await page.getByLabel('🎉 Je viens !').check();
  await page.getByLabel('Prénom & nom').fill('Emma Wilson');
  await page.getByLabel(/^E-mail/).fill(adresse);
  await page.getByLabel('16 h · Accueil').check();
  await page.getByRole('button', { name: 'Envoyer ma réponse' }).click();
  await expect(page.getByText("C'est noté pour 1 personne")).toBeVisible();

  const lien = messagesEnvoyesA(adresse)[0].html.match(/href="([^"]*\/rsvp\/modifier\?jeton=[^"]+)"/)![1].replace(/&amp;/g, '&');
  await page.goto(new URL(lien).pathname + new URL(lien).search);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modifier ma réponse');
  await expect(page.getByLabel('Prénom & nom')).toHaveValue('Emma Wilson');
  await expect(page.getByLabel(/^E-mail/)).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('16 h · Accueil')).toBeChecked();
  await page.getByRole('button', { name: '+ Ajouter un accompagnant' }).click();
  await page.getByLabel('Accompagnant 1').fill('James Wilson');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByText('Réponse mise à jour !')).toBeVisible();
  expect(messagesEnvoyesA(adresse)).toHaveLength(2);
});

test('lien de modification invalide', async ({ page }) => {
  await page.goto('/fr/rsvp/modifier?jeton=faux');
  await expect(page.getByText("Ce lien de modification n'est pas valide.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Répondre au formulaire' })).toHaveAttribute('href', '/fr/rsvp');
});
```

> Le lien de l'e-mail pointe vers `url_publique` (`http://localhost:4321` dans l'exemple). Le test n'en garde donc que le chemin et la requête, et passe par le serveur de test (port 4322).

Exécuter : `npx playwright test tests/e2e/rsvp.spec.ts -g "modif" --project=ordinateur`. Attendu : ÉCHEC (404).

- [ ] **Étape 3 : écrire `src/pages/[lang]/rsvp/modifier.astro`**

```astro
---
import Base from '../../../layouts/Base.astro';
import PageHead from '../../../components/PageHead.astro';
import RsvpForm from '../../../components/RsvpForm.astro';
import { ui } from '../../../lib/i18n';
import { CHAMPS_VIDES, lireFormulaire, rsvpOuvert, type ChampsRsvp } from '../../../lib/rsvp';
import { modifier, type Resultat } from '../../../lib/rsvp-service';
import { getDeps } from '../../../lib/services';

const lang = Astro.locals.lang;
const deps = await getDeps();
const jeton = Astro.url.searchParams.get('jeton') ?? '';
const existante = jeton ? await deps.db.parJeton(jeton) : null;
let champs: ChampsRsvp = existante
  ? { ...CHAMPS_VIDES, vient: existante.vient, nom: existante.nom, email: existante.email, telephone: existante.telephone ?? '',
      accompagnants: existante.accompagnants, moments: existante.moments, message: existante.message ?? '' }
  : CHAMPS_VIDES;
let resultat: Resultat | null = null;
if (existante && Astro.request.method === 'POST') {
  champs = { ...lireFormulaire(await Astro.request.formData()), email: existante.email, piege: '' };
  resultat = await modifier(jeton, champs, lang, deps);
}
const ouvert = rsvpOuvert(deps.ev.evenement, deps.maintenant());
---
<Base lang={lang} current="rsvp" title={ui(lang, 'modif.titre')}>
  <PageHead title={ui(lang, 'modif.titre')} />
  <div class="container etroit">
    {!existante && (
      <p class="info" role="alert">{ui(lang, 'modif.introuvable')}{' '}<a href={`/${lang}/rsvp`}>{ui(lang, 'modif.repondre')}</a></p>
    )}
    {existante && resultat?.type === 'ok' && (
      <p class="info" role="status">{resultat.emailEnvoye ? ui(lang, 'modif.ok') : ui(lang, 'rsvp.email_plus_tard')}</p>
    )}
    {existante && (!ouvert || resultat?.type === 'ferme') && <p class="info" role="status">{ui(lang, 'rsvp.ferme')}</p>}
    {existante && ouvert && resultat?.type !== 'ok' && (
      <RsvpForm lang={lang} ev={deps.ev} champs={champs} erreurs={resultat?.type === 'invalide' ? resultat.erreurs : {}}
        libelleEnvoyer={ui(lang, 'rsvp.enregistrer')} emailVerrouille />
    )}
  </div>
</Base>
<style>
  .etroit { max-width: 720px; padding-block: 20px 48px; }
  .info { background: var(--c-douce); border-radius: 14px; padding: 14px 18px; font-weight: 700; }
</style>
```

- [ ] **Étape 4 : vérifier**

Exécuter : `npx playwright test tests/e2e/rsvp.spec.ts`, puis `npx vitest run`. Attendu : RÉUSSI.

- [ ] **Étape 5 : commit**

```bash
git add -A
git commit -m "Permet de modifier sa réponse grâce au lien reçu"
```

---

### Tâche 10 : accessibilité, documentation et vérification finale

**Fichiers :**
- Modifier : `tests/e2e/accessibilite.spec.ts`, `.env.example`, `README.md`, `evenement/LISEZMOI.md`

- [ ] **Étape 1 : étendre les contrôles d'accessibilité**

Dans `tests/e2e/accessibilite.spec.ts`, ajouter `'/fr/rsvp'`, `'/en/rsvp'` et `'/fr/rsvp/modifier?jeton=faux'` au tableau `PAGES`.

Exécuter : `npx playwright test tests/e2e/accessibilite.spec.ts --project=ordinateur`. Corriger toute violation (contraste, libellés) dans les composants de la tâche 8, en respectant les contraintes globales, puis relancer jusqu'au succès.

- [ ] **Étape 2 : documentation**

`.env.example` (remplacer) :
```
# Cible de déploiement : laisser vide en local, "vercel" en ligne
DEPLOY_TARGET=

# Base de données : fichier local par défaut ; en ligne, l'URL Turso et son jeton
DATABASE_URL=file:.data/local.db
DATABASE_TOKEN=

# E-mails : "outbox" (local, rien n'est envoyé : voir .data/outbox) ou "api"
MAIL_MODE=outbox
# Si MAIL_MODE=api : "brevo" ou "resend", la clé API et l'adresse d'expédition vérifiée
MAIL_PROVIDER=brevo
MAIL_API_KEY=
MAIL_FROM=
OUTBOX_DIR=.data/outbox

# Anti-spam : nombre d'envois de formulaire autorisés par adresse IP toutes les 10 minutes
RSVP_LIMITE=5
```

`README.md` : sous « Démarrer en local », ajouter :
```markdown
### Réponses et e-mails en local

Les réponses sont enregistrées dans `.data/local.db`. Aucun e-mail n'est réellement envoyé : chaque e-mail (avec l'invitation PDF) est rangé dans un dossier de `.data/outbox/` ; ouvrir `message.html` dans un navigateur pour le voir.
```

`evenement/LISEZMOI.md` : ajouter une section « Invitation PDF et e-mails » qui indique que :
- la photo principale (`accueil.photo_principale`) figure sur l'invitation PDF ;
- les e-mails utilisent `email.expediteur_nom` et `email.objet` ;
- les liens des e-mails et le QR code reposent sur `site.url_publique`, à remplacer par l'adresse du site en ligne.

- [ ] **Étape 3 : suite complète**

Exécuter : `npx vitest run && npx playwright test && npm run build && npx astro check`. Attendu : tout RÉUSSI dans les deux projets, sortie des tests unitaires propre, aucune erreur de type (corriger celles du code de ce plan ; signaler celles du plan 1 sans les corriger).

- [ ] **Étape 4 : commit**

```bash
git add -A
git commit -m "Ajoute les contrôles d'accessibilité et la documentation des réponses"
```

---

## Suite

Le **plan 3** (admin, export CSV, PDF de la liste et de toutes les invitations, boîte d'envoi dans l'admin, mise en ligne) reprend les sections 10 et 13 de la spécification, ainsi que les points reportés de `docs/superpowers/plans/2026-10-13-suivi-plan-1.md`.
