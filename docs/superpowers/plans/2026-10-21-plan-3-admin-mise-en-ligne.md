# Plan 3 : espace organisateur et mise en ligne

> **Pour les exécutants :** sous-compétence REQUISE : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**Objectif :** l'organisateur se connecte sur `/admin` avec un mot de passe. Il y consulte, filtre, exporte (CSV) et gère les réponses, imprime la liste des confirmés et toutes les invitations en PDF, modère le livre d'or et lit la boîte d'envoi de test. Le site est prêt à être mis en ligne sur Vercel + Turso + Brevo/Resend, avec un guide pas à pas.

**Architecture :**
- La logique de l'admin vit dans des modules purs et testés : session et mot de passe (`auth.ts`), statistiques et filtres (`admin/reponses.ts`), export (`csv.ts`), PDF de la liste (`pdf/liste.ts`), lecture de la boîte d'envoi (`mail/lire-outbox.ts`). Les pages Astro ne font qu'appeler ces modules et afficher le résultat.
- Le middleware protège toutes les adresses `/admin/*` et `/api/admin/*`, sauf la page de connexion.
- **Pages et adresses :**
  - les pages de l'admin sont sous `/admin/` et traitent leurs propres formulaires (`POST`), comme les pages RSVP ;
  - les actions sans page (renvoyer, masquer, supprimer un message) et les téléchargements sont sous `/api/admin/` ;
  - après une action, la page de retour reçoit un code dans l'adresse (`?ok=renvoye`), jamais de donnée personnelle.
- Tout fonctionne sans JavaScript.

**Pile technique :** Astro 7.3 (rendu serveur), @libsql/client 0.18, pdf-lib 1.17 + @pdf-lib/fontkit, node:crypto, Vitest 5, Playwright.

**Spécification :** `docs/superpowers/specs/2026-10-12-site-evenement-design.md`, sections 4.1, 8, 9, 10, 12 et 13.
- Points reportés : `docs/superpowers/plans/2026-10-13-suivi-plan-1.md` et `docs/superpowers/plans/2026-10-21-suivi-plan-2.md`.
- Maquette : `docs/maquettes/04-admin-email-pdf.html` (connexion, tableau de bord, livre d'or, PDF de la liste).

**Écarts assumés avec la spécification** (décisions du responsable, à ne pas « corriger ») :
- **Admin en français uniquement :** c'est un outil pour l'organisateur.
- **Modification d'une réponse par l'admin :**
  - pas de date limite ;
  - e-mail verrouillé, car le changer imposerait de gérer les doublons ;
  - aucun e-mail envoyé automatiquement : l'admin utilise ensuite « Renvoyer l'e-mail » s'il le souhaite.
- **Suppression d'une réponse :** elle passe par une page de confirmation (fonctionne sans JavaScript) plutôt que par une boîte de dialogue.
- **Blocage de connexion :**
  - la connexion est refusée tant qu'il y a 5 échecs ou plus dans les 15 dernières minutes depuis la même adresse IP ;
  - une tentative pendant le blocage compte comme un échec, donc le blocage dure tant que les essais continuent.
- **Mise en ligne effective :** la création des comptes Turso, Brevo/Resend et Vercel, et le déploiement, sont faits par l'organisateur en suivant `DEPLOIEMENT.md`. Le plan livre un site dont la compilation pour Vercel est vérifiée, et le guide.
- **Photos dans le code serveur :** l'import paresseux actuel est conservé. Seule la photo demandée est chargée à l'exécution, et le poids total est mesuré à la tâche 13. La conversion JPEG est mise en cache (tâche 9).
- **Date limite et changement d'heure :** documenté dans `evenement/LISEZMOI.md`, pas corrigé.
- **Export CSV :**
  - une cellule qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot reçoit une apostrophe en tête, pour qu'Excel ne l'exécute pas comme une formule ;
  - un téléphone `+33 6…` apparaît donc `'+33 6…`. C'est le prix de la sécurité, et c'est accepté.
- **Recherche en `GET` :** `/admin?q=<e-mail>` place le terme cherché dans l'adresse, et donc dans les journaux de l'hébergeur. C'est accepté, car la page n'est accessible qu'à l'organisateur et le formulaire fonctionne ainsi sans JavaScript. Aucune redirection ne propage `q`.
- **Adresse IP :** `Astro.clientAddress` suffit. Avec l'adaptateur Node, c'est l'adresse du socket ; avec `@astrojs/vercel` 11, c'est la première valeur validée de `x-forwarded-for`. Aucune lecture d'en-tête n'est ajoutée : le point reporté du plan 2 est résolu par ce constat, noté dans le suivi.
- **Images en ligne :** les photos passent par `astro:assets` et la route `/_image` (sharp) de la fonction Vercel. Pas de service d'images Vercel (`imageService` reste désactivé). La tâche 13 vérifie la présence de la route et l'affichage des photos après le déploiement.

## Contraintes globales

- **Variables d'environnement**, en plus de celles du plan 2 (noms exacts) :
  - `ADMIN_PASSWORD` : sans elle, l'admin est désactivée et la page de connexion l'explique ;
  - `SESSION_SECRET` : 32 caractères au moins, sinon l'admin est désactivée et la page de connexion l'explique ;
  - `VERCEL` : définie automatiquement par Vercel, elle sert à détecter l'exécution en ligne.
- **Cookie de session :**
  - nom `admin_session` ;
  - options `HttpOnly`, `SameSite=Lax`, `Path=/` ;
  - `Secure` si l'adresse de la requête est en `https:` ou si `VERCEL` est définie ;
  - valable 7 jours ;
  - valeur `<expiration en ms>.<HMAC-SHA256 base64url>` ;
  - signée avec une clé dérivée de `SESSION_SECRET` **et** du mot de passe (`cleSession`, tâche 4) : changer l'un ou l'autre déconnecte toutes les sessions.
- **Mot de passe :** comparaison en temps constant (`crypto.timingSafeEqual` sur les empreintes SHA-256 des deux valeurs).
- **Limite de connexion :** clé `login:<ip>` dans la table `limites` ; 5 échecs en 15 minutes bloquent la connexion.
- **Protection CSRF :** toutes les actions qui modifient des données sont en `POST`. La vérification de l'en-tête `Origin` est celle d'Astro (`security.checkOrigin`, activée par défaut) ; ne pas la désactiver.
- **Réponses de l'admin :** toutes ont `Cache-Control: no-store` et `X-Robots-Tag: noindex`, que le middleware ajoute.
- **CSV :**
  - séparateur `;`, encodage UTF-8 avec BOM, fins de ligne `\r\n` ;
  - une ligne par réponse, triée par nom.
- **PDF :**
  - liste en A4 portrait (595,28 × 841,89 pt), invitations en A5 ;
  - polices Caveat (avec `OPTIONS_TITRE`) et Nunito ;
  - tout texte saisi passe par `dessinable()` puis `tronquer()` ou `couper()`.
- **Textes de l'admin :** français, vouvoiement neutre (« Mot de passe incorrect. »), écrits directement dans les pages (pas dans `i18n.ts`).
- **Apostrophe :** les libellés et `aria-label` suivants utilisent l'apostrophe typographique `’`, que les tests cherchent : « Boîte d’envoi (test) », « Renvoyer l’e-mail à … », « Voir l’e-mail », « Livre d’or ». Tous les autres textes sont recopiés **exactement** comme le plan les écrit, avec leur apostrophe droite.
- **Rôles ARIA :** seuls les messages de retour (`messageFlash`), les erreurs de connexion et le bandeau de configuration ont un rôle `status` ou `alert`. Les autres textes n'en ont pas, par exemple « N réponse(s) affichée(s) ».
- **Redirections :** dans les pages et les points d'accès, toujours `Astro.redirect(chemin, 303)` ou `ctx.redirect(chemin, 303)`, jamais `Response.redirect()`. Ses en-têtes sont immuables, et le middleware doit pouvoir y ajouter les siens.
- **Repères :** `connexion.astro` et `Admin.astro` placent le contenu dans un `<main>`.
- **Astro 7 :**
  - ajouter `{" "}` avant un élément en ligne quand un espace visible est voulu ;
  - pas de bloc dans un `<p>` ;
  - ajouter `[hidden] { display: none }` quand une règle `display` coexiste avec `hidden`.
- **Contraste :**
  - le texte crème sur orange est en gras et fait au moins 1.2rem ;
  - le fond de l'élément actif du menu admin est `var(--c-principale-fonce)` ;
  - le petit texte orange utilise `var(--c-principale-fonce)`.
- **Téléphone :** aucune page de l'admin ne défile horizontalement à 360 px. Les tableaux larges défilent dans leur propre conteneur (`overflow-x: auto`).
- **Tests de bout en bout :**
  - port 4322, base et boîte d'envoi de test, horloge figée ;
  - deux variables ajoutées : `ADMIN_PASSWORD=mot-de-passe-de-test` et `SESSION_SECRET=secret-de-session-pour-les-tests-0123456789` ;
  - la base est partagée entre les tests, qui tournent en parallèle sur deux projets. Chaque test crée ses propres réponses avec une adresse unique, les retrouve par la recherche, et ne vérifie jamais un total exact ;
  - **toute la suite contient au plus 4 mots de passe erronés,** pour ne jamais déclencher le blocage de l'adresse `127.0.0.1`.
- **Commits :** en français, à l'impératif, sans ligne de co-auteur, sans mention d'outil.

## Points de vigilance

1. **Texte saisi par un invité qui piège le CSV** (`=SOMME(A1)`, `;`, guillemets, retour à la ligne dans le message) : chaque valeur reste dans sa cellule, et aucune formule ne s'exécute à l'ouverture dans Excel. Testé à la tâche 3.
2. **Cookie de session falsifié, expiré, signé avec un autre secret ou mal formé :** l'accès est refusé (redirection vers la connexion, ou 401 pour `/api/admin/*`). Testé aux tâches 4 et 5.
3. **Requête d'administration envoyée depuis un autre site** (en-tête `Origin` étranger) : refusée en 403, rien n'est modifié. Testé à la tâche 5.
4. **Réponse supprimée entre l'affichage du tableau et le clic** sur une action (renvoyer, modifier, supprimer, PDF) : message « Cette réponse n'existe plus. » ou 404, jamais d'erreur 500. Testé aux tâches 1 et 7.
5. **Liste PDF avec beaucoup d'invités, des noms très longs ou des emoji :** plusieurs pages, en-tête du tableau répété, aucune erreur. Testé à la tâche 8.

---

## Structure des fichiers

```
src/lib/
  mail/api.ts, mail/index.ts  # délai, erreurs sans données, problemeConfigMail()  (tâche 1)
  rsvp-service.ts             # robustesse (t. 1), renvoyerConfirmation(), modifierParAdmin() (t. 7)
  db.ts                       # requêtes de l'admin (t. 2), choix du client libSQL (t. 13)
  admin/reponses.ts           # statistiques(), lireFiltres(), filtrer(), abreviations(), messageFlash() (t. 2, 6, 7)
  rsvp.ts                     # horodatageLocal()                                  (tâche 3)
  csv.ts                      # celluleCsv(), exporterCsv()                        (tâche 3)
  auth.ts                     # configAdmin(), sessions, tenterConnexion()         (tâche 4)
  pdf/liste.ts                # lignesListe(), paginer(), genererListe()           (tâche 8)
  pdf/invitation.ts           # ressources partagées, genererInvitations()         (tâche 9)
  pdf/ressources.ts           # cache de photoJpeg()                               (tâche 9)
  mail/lire-outbox.ts         # listerOutbox(), lireFichierOutbox()                (tâche 11)
src/integrations/verifier-evenement.ts                                             (tâche 12)
src/middleware.ts             # garde de l'admin                                   (tâche 5)
src/layouts/Admin.astro                                                            (tâche 5)
src/pages/admin/connexion.astro, deconnexion.ts, index.astro                       (t. 5, 6, 7)
src/pages/admin/reponses/[id]/modifier.astro, supprimer.astro                      (tâche 7)
src/pages/admin/livre-dor.astro, outbox.astro                                      (t. 10, 11)
src/pages/api/admin/export.csv.ts, liste.pdf.ts, invitations.pdf.ts                (t. 6, 8, 9)
src/pages/api/admin/reponses/[id]/renvoyer.ts, invitation.pdf.ts                   (tâche 7)
src/pages/api/admin/messages/[id]/masquer.ts, supprimer.ts                         (tâche 10)
src/pages/api/admin/outbox/[dossier]/[fichier].ts                                  (tâche 11)
src/pages/robots.txt.ts                                                            (tâche 12)
tests/unit/fabriques.ts, admin-reponses.test.ts, csv.test.ts, auth.test.ts, pdf-liste.test.ts,
           lire-outbox.test.ts, verifier-evenement.test.ts
tests/e2e/admin.ts (aides), admin.spec.ts
DEPLOIEMENT.md                                                                     (tâche 13)
```

---

### Tâche 1 : robustesse des e-mails et du service (points reportés du plan 2)

**Fichiers :**
- Modifier : `src/lib/mail/api.ts`, `src/lib/mail/index.ts`, `src/lib/rsvp-service.ts`
- Tests : `tests/unit/mail.test.ts`, `tests/unit/rsvp-service.test.ts`

**Interfaces :**
- Produit :
  - `creerApi(o: { fournisseur; cle; de; fetch?; delaiMs?: number }): Expediteur`, avec `delaiMs` à 10 000 par défaut ;
  - `problemeConfigMail(env?: Record<string, string | undefined>): string | null`, avec `process.env` par défaut ;
  - `getExpediteur(nomExpediteur: string, env = process.env): Expediteur` ;
  - `outboxActive(env = process.env): boolean`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Dans `tests/unit/mail.test.ts`, qui définit déjà `msg` (le message d'essai) et `de` : importer en plus `problemeConfigMail`, `getExpediteur` et `outboxActive` depuis `../../src/lib/mail/index`. **Mettre à jour le test existant de `payloadResend`** (ligne 54 environ) : `from` attendu `'"Coco a 40 ans" <fete@exemple.fr>'`. Puis ajouter :

```ts
test('creerApi transmet un signal d’abandon (délai maximal)', async () => {
  let init: RequestInit | undefined;
  const f = (async (_u: string, i: RequestInit) => { init = i; return new Response('{}', { status: 201 }); }) as unknown as typeof fetch;
  await creerApi({ fournisseur: 'brevo', cle: 'k', de, fetch: f }).envoyer(msg);
  expect(init?.signal).toBeInstanceOf(AbortSignal);
});

test('erreur du fournisseur : statut et code seulement, jamais le corps', async () => {
  const f = (async () => new Response(JSON.stringify({ code: 'invalid_parameter', message: 'camille@exemple.fr est invalide' }), { status: 400 })) as unknown as typeof fetch;
  await expect(creerApi({ fournisseur: 'brevo', cle: 'k', de, fetch: f }).envoyer(msg))
    .rejects.toThrow(/^Envoi d'e-mail refusé par brevo : HTTP 400 \(invalid_parameter\)$/);
});

test('erreur sans corps JSON : statut seul', async () => {
  const f = (async () => new Response('<html>oops camille@exemple.fr</html>', { status: 502 })) as unknown as typeof fetch;
  await expect(creerApi({ fournisseur: 'resend', cle: 'k', de, fetch: f }).envoyer(msg))
    .rejects.toThrow(/^Envoi d'e-mail refusé par resend : HTTP 502$/);
});

test('Resend : nom d’expéditeur entre guillemets, guillemets et barres obliques inverses retirés', () => {
  expect(payloadResend(msg, { email: 'a@b.fr', nom: 'Coco, "40" \\ ans' }).from).toBe('"Coco, 40  ans" <a@b.fr>');
});

test('problemeConfigMail', () => {
  expect(problemeConfigMail({})).toBeNull();
  expect(problemeConfigMail({ VERCEL: '1' })).toBe('En ligne, MAIL_MODE doit valoir « api » : sinon les e-mails ne partent pas.');
  expect(problemeConfigMail({ VERCEL: '1', MAIL_MODE: 'outbox' })).toBe('En ligne, MAIL_MODE doit valoir « api » : sinon les e-mails ne partent pas.');
  expect(problemeConfigMail({ MAIL_MODE: 'api', MAIL_FROM: 'a@b.fr' })).toBe('MAIL_MODE=api exige MAIL_API_KEY et MAIL_FROM.');
  expect(problemeConfigMail({ MAIL_MODE: 'api', MAIL_API_KEY: 'k', MAIL_FROM: 'a@b.fr', MAIL_PROVIDER: 'sendgrid' })).toBe('MAIL_PROVIDER doit valoir « brevo » ou « resend ».');
  expect(problemeConfigMail({ VERCEL: '1', MAIL_MODE: 'api', MAIL_API_KEY: 'k', MAIL_FROM: 'a@b.fr' })).toBeNull();
});

test('getExpediteur refuse une configuration en erreur', () => {
  expect(() => getExpediteur('Coco', { VERCEL: '1' })).toThrow('MAIL_MODE doit valoir « api »');
});

test('outboxActive', () => {
  expect(outboxActive({})).toBe(true);
  expect(outboxActive({ MAIL_MODE: 'api' })).toBe(false);
  expect(outboxActive({ VERCEL: '1' })).toBe(false);
});
```

Dans `tests/unit/rsvp-service.test.ts` :

```ts
test('échec d’envoi puis échec de la base : pas d’exception, emailEnvoye = false', async () => {
  deps.expediteur = { envoyer: async () => { throw new Error('panne'); } };
  const marquer = vi.spyOn(db, 'marquerEmailEnvoye').mockRejectedValue(new Error('base indisponible'));
  const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
  expect(r.type === 'ok' && r.emailEnvoye).toBe(false);
  marquer.mockRestore();
});

test('modifier : réponse supprimée entre la lecture et l’écriture → introuvable', async () => {
  const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
  if (r.type !== 'ok') throw new Error();
  vi.spyOn(db, 'modifier').mockResolvedValueOnce(null);
  expect(await modifier(r.reponse.jeton, champs, 'fr', deps)).toEqual({ type: 'introuvable' });
});
```

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/mail.test.ts tests/unit/rsvp-service.test.ts`
Attendu : ÉCHEC (fonctions absentes, message d'erreur actuel contenant le corps).

- [ ] **Étape 3 : implémenter**

- **`api.ts` :**
  - passer `signal: AbortSignal.timeout(o.delaiMs ?? 10_000)` au `fetch` ;
  - en cas d'erreur, lire le corps en JSON dans un `try`, et prendre `code` (Brevo) ou `name` (Resend) s'il s'agit d'une chaîne de 60 caractères au plus ;
  - le message d'erreur est `Envoi d'e-mail refusé par <fournisseur> : HTTP <statut>`, suivi de ` (<code>)` si un code a été trouvé ;
  - `from` de Resend : `"<nom sans " ni \\>" <email>`.
- **`index.ts` :**
  - `problemeConfigMail` applique les règles du test, dans cet ordre : Vercel sans `api`, puis clé ou expéditeur manquant, puis fournisseur inconnu (`MAIL_PROVIDER` vide signifie `brevo`) ;
  - `getExpediteur` lève `new Error(probleme)` si `problemeConfigMail` renvoie un problème ;
  - `outboxActive(env)` vaut `(env.MAIL_MODE || 'outbox') !== 'api' && !env.VERCEL`.
- **`rsvp-service.ts` :**
  - dans le `catch` de `envoyerConfirmation`, l'appel `marquerEmailEnvoye(r.id, false)` reçoit son propre `.catch` qui journalise ;
  - dans `modifier`, si `db.modifier` renvoie `null`, renvoyer `{ type: 'introuvable' }`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run`
Attendu : tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/mail src/lib/rsvp-service.ts tests/unit
git commit -m "Fiabilise l'envoi des e-mails"
```

---

### Tâche 2 : requêtes, statistiques et filtres de l'admin

**Fichiers :**
- Créer : `src/lib/admin/reponses.ts`, `tests/unit/admin-reponses.test.ts`
- Modifier : `src/lib/db.ts`
- Tests : `tests/unit/db.test.ts`

**Interfaces :**
- Consomme : `Reponse` (`db.ts`), `nombrePersonnes` (`rsvp.ts`).
- Produit, sur `Db` :
  - `toutes(): Promise<Reponse[]>` : les plus récentes d'abord (`cree_le DESC, id DESC`) ;
  - `parId(id: number): Promise<Reponse | null>` ;
  - `supprimer(id: number): Promise<boolean>` : `true` si une ligne a été supprimée ;
  - `masquerMessage(id: number, masque: boolean): Promise<boolean>` ;
  - `supprimerMessage(id: number): Promise<boolean>` : `message = NULL`, `message_masque = 0` ;
  - `messages(): Promise<MessageAdmin[]>`, avec `type MessageAdmin = { id: number; nom: string; message: string; masque: boolean; creeLe: string }`. Tous les messages non vides, masqués compris, les plus récents d'abord.
- Produit, dans `admin/reponses.ts` :
  - `type Statistiques = { reponses: number; foyers: number; personnes: number; refus: number; parMoment: Record<string, number> }` ;
  - `statistiques(reponses: Reponse[], momentIds: string[]): Statistiques` : `parMoment` compte des **personnes** (1 + accompagnants), avec une clé à 0 pour chaque moment ;
  - `type Filtres = { q: string; presence: 'tous' | 'oui' | 'non'; moment: string }`, où `moment` vide signifie tous les moments ;
  - `lireFiltres(params: URLSearchParams, momentIds: string[]): Filtres` : toute valeur inconnue est remplacée par la valeur par défaut ;
  - `filtrer(reponses: Reponse[], f: Filtres): Reponse[]` : `q` est cherché dans le nom ou l'e-mail, sans tenir compte de la casse, des accents ni des espaces autour.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/unit/db.test.ts` (ajouts, base `:memory:`) :

```ts
test('toutes, parId, supprimer', async () => {
  const a = await db.ajouter({ ...camille, email: 'a@x.fr' }, new Date('2027-01-01T10:00:00Z'));
  const b = await db.ajouter({ ...camille, email: 'b@x.fr' }, new Date('2027-01-02T10:00:00Z'));
  expect((await db.toutes()).map((r) => r.email)).toEqual(['b@x.fr', 'a@x.fr']);
  expect((await db.parId(a.id))?.email).toBe('a@x.fr');
  expect(await db.supprimer(a.id)).toBe(true);
  expect(await db.supprimer(a.id)).toBe(false);
  expect(await db.parId(a.id)).toBeNull();
  expect(b.id).toBeGreaterThan(0);
});

test('modération des messages', async () => {
  const r = await db.ajouter({ ...camille, message: 'Bravo' }, new Date());
  expect(await db.masquerMessage(r.id, true)).toBe(true);
  expect(await db.messagesVisibles(10)).toEqual([]);
  expect((await db.messages())[0]).toMatchObject({ id: r.id, message: 'Bravo', masque: true });
  await db.masquerMessage(r.id, false);
  expect(await db.messagesVisibles(10)).toHaveLength(1);
  expect(await db.supprimerMessage(r.id)).toBe(true);
  expect(await db.messages()).toEqual([]);
  expect((await db.parId(r.id))?.nom).toBe(camille.nom);
  expect(await db.masquerMessage(9999, true)).toBe(false);
});
```

`tests/unit/fabriques.ts` (nouveau) exporte `rep(partiel: Partial<Reponse>): Reponse`. Ses valeurs par défaut :

```ts
{ id: 1, jeton: 'j', langue: 'fr', vient: true, nom: 'Invité', email: 'invite@x.fr', telephone: null, accompagnants: [], moments: [],
  message: null, messageMasque: false, emailEnvoye: true, creeLe: '2027-01-01T00:00:00.000Z', modifieLe: '2027-01-01T00:00:00.000Z' }
```

Les tâches 3 et 8 l'utilisent aussi. Dans `tests/unit/admin-reponses.test.ts` :

```ts
const liste = [
  rep({ nom: 'Émilie Durand', email: 'emilie@x.fr', vient: true, accompagnants: ['Léo'], moments: ['accueil', 'diner'] }),
  rep({ nom: 'Paul Leroy', email: 'paul@x.fr', vient: false }),
  rep({ nom: 'Thomas', email: 'thomas@x.fr', vient: true, moments: ['diner'] }),
];
test('statistiques', () => {
  expect(statistiques(liste, ['accueil', 'diner', 'soiree'])).toEqual({
    reponses: 3, foyers: 2, personnes: 3, refus: 1, parMoment: { accueil: 2, diner: 3, soiree: 0 },
  });
});
test('lireFiltres : valeurs inconnues remplacées par défaut', () => {
  expect(lireFiltres(new URLSearchParams('q=%20Emi%20&presence=peut-etre&moment=piscine'), ['diner']))
    .toEqual({ q: 'Emi', presence: 'tous', moment: '' });
  expect(lireFiltres(new URLSearchParams('presence=non&moment=diner'), ['diner'])).toEqual({ q: '', presence: 'non', moment: 'diner' });
});
test('filtrer : recherche sans casse ni accents, présence, moment', () => {
  expect(filtrer(liste, { q: 'EMILIE', presence: 'tous', moment: '' }).map((r) => r.nom)).toEqual(['Émilie Durand']);
  expect(filtrer(liste, { q: 'paul@', presence: 'tous', moment: '' })).toHaveLength(1);
  expect(filtrer(liste, { q: '', presence: 'non', moment: '' }).map((r) => r.nom)).toEqual(['Paul Leroy']);
  expect(filtrer(liste, { q: '', presence: 'tous', moment: 'accueil' }).map((r) => r.nom)).toEqual(['Émilie Durand']);
});
```

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/db.test.ts tests/unit/admin-reponses.test.ts`
Attendu : ÉCHEC (méthodes et module absents).

- [ ] **Étape 3 : implémenter** les méthodes de `Db` et `src/lib/admin/reponses.ts`. Normalisation de la recherche : `s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run`
Attendu : tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/db.ts src/lib/admin tests/unit
git commit -m "Ajoute les requêtes, statistiques et filtres de l'espace organisateur"
```

---

### Tâche 3 : export CSV

**Fichiers :**
- Créer : `src/lib/csv.ts`, `tests/unit/csv.test.ts`
- Modifier : `src/lib/rsvp.ts`
- Tests : `tests/unit/rsvp.test.ts`

**Interfaces :**
- Produit :
  - `horodatageLocal(iso: string, isoReference: string): string` dans `rsvp.ts`. Il renvoie `JJ/MM/AAAA HH:MM` dans le décalage horaire de `isoReference`, en réutilisant le calcul de décalage de `dateLocale` ;
  - `celluleCsv(v: string): string` ;
  - `exporterCsv(reponses: Reponse[], ev: EventConfig): string`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
// rsvp.test.ts
test('horodatageLocal', () => {
  expect(horodatageLocal('2027-01-15T22:30:00.000Z', '2027-06-14T16:00:00+02:00')).toBe('16/01/2027 00:30');
});

// csv.test.ts (ev = événement d'exemple : moments Accueil, Dîner, Soirée, Brunch)
test('celluleCsv : guillemets, séparateur, retours à la ligne, formules', () => {
  expect(celluleCsv('Camille')).toBe('Camille');
  expect(celluleCsv('a;b')).toBe('"a;b"');
  expect(celluleCsv('dit "bonjour"')).toBe('"dit ""bonjour"""');
  expect(celluleCsv('ligne1\nligne2')).toBe('"ligne1\nligne2"');
  expect(celluleCsv('=SOMME(A1)')).toBe("'=SOMME(A1)");
  expect(celluleCsv('+33 6 12')).toBe("'+33 6 12");
  expect(celluleCsv('@cmd')).toBe("'@cmd");
  expect(celluleCsv('-1;2')).toBe(`"'-1;2"`);
});

test('exporterCsv : BOM, en-tête, une ligne par réponse triée par nom, CRLF', () => {
  const csv = exporterCsv([
    rep({ nom: 'Thomas Durand', email: 't@x.fr', vient: true, accompagnants: ['Léo', 'Zoé'], moments: ['diner'], langue: 'en', telephone: null,
          message: 'Hâte !', creeLe: '2027-01-15T10:05:00.000Z' }),
    rep({ nom: 'Anne Roy', email: 'a@x.fr', vient: false, creeLe: '2027-01-14T08:00:00.000Z' }),
  ], ev);
  expect(csv.startsWith('\uFEFF')).toBe(true);
  const lignes = csv.slice(1).split('\r\n');
  expect(lignes[0]).toBe('Nom;E-mail;Téléphone;Langue;Présence;Personnes;Accompagnants;Accueil;Dîner;Soirée;Brunch;Message;Date');
  expect(lignes[1]).toBe('Anne Roy;a@x.fr;;fr;non;0;;non;non;non;non;;14/01/2027 10:00');
  expect(lignes[2]).toBe('Thomas Durand;t@x.fr;;en;oui;3;Léo, Zoé;non;oui;non;non;Hâte !;15/01/2027 12:05');
  expect(lignes[3]).toBe('');
});
```

> Le décalage de l'exemple est `+02:00`, car `date_debut` est en juin. `rep()` vient de `tests/unit/fabriques.ts` (tâche 2).

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/csv.test.ts tests/unit/rsvp.test.ts`
Attendu : ÉCHEC.

- [ ] **Étape 3 : implémenter**

- **`celluleCsv`, dans cet ordre :**
  - préfixer `'` si la valeur commence par `=`, `+`, `-`, `@`, `\t` ou `\r` ;
  - puis entourer de guillemets en doublant les `"` si la valeur contient `;`, `"`, `\r` ou `\n`.
- **`exporterCsv` :**
  - colonnes de moments dans l'ordre de `ev.moments`, avec leur titre en français ;
  - « Présence » vaut `oui` ou `non` ;
  - « Personnes » vient de `nombrePersonnes` ;
  - « Accompagnants » est la liste jointe par `, ` ;
  - « Date » vient de `horodatageLocal(r.creeLe, ev.evenement.date_debut)` ;
  - tri par `nom.localeCompare(autre, 'fr', { sensitivity: 'base' })` ;
  - chaque ligne se termine par `\r\n`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run`
Attendu : tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/csv.ts src/lib/rsvp.ts tests/unit
git commit -m "Ajoute l'export CSV des réponses"
```

---

### Tâche 4 : mot de passe, session et limite de connexion

**Fichiers :**
- Créer : `src/lib/auth.ts`, `tests/unit/auth.test.ts`

**Interfaces :**
- Consomme : `Db.ajouterTentative`, `Db.compterTentatives`, `Db.purgerTentatives`.
- Produit :
  - `NOM_COOKIE = 'admin_session'` et `DUREE_SESSION_MS = 7 * 24 * 60 * 60 * 1000` ;
  - `type ConfigAdmin = { ok: true; motDePasse: string; secret: string } | { ok: false; probleme: string }` ;
  - `configAdmin(env = process.env): ConfigAdmin` ;
  - `motDePasseCorrect(saisi: string, attendu: string): boolean` ;
  - `cleSession(cfg: { motDePasse: string; secret: string }): string` : SHA-256 hexadécimal de `secret + '\0' + motDePasse`. Les pages et le middleware passent toujours `cleSession(cfg)` comme `secret` à `creerSession` et `sessionValide` ;
  - `creerSession(secret: string, maintenant: Date): string` ;
  - `sessionValide(valeur: string | undefined, secret: string, maintenant: Date): boolean` ;
  - `tenterConnexion(saisi: string, ip: string, cfg: { motDePasse: string }, db: Db, maintenant: Date): Promise<'ok' | 'refuse' | 'bloque'>`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
const SECRET = 'x'.repeat(32);
const T0 = new Date('2027-01-15T12:00:00Z');

test('configAdmin', () => {
  expect(configAdmin({})).toEqual({ ok: false, probleme: "ADMIN_PASSWORD n'est pas défini : l'espace organisateur est désactivé." });
  expect(configAdmin({ ADMIN_PASSWORD: 'p', SESSION_SECRET: 'court' }))
    .toEqual({ ok: false, probleme: 'SESSION_SECRET doit contenir au moins 32 caractères.' });
  expect(configAdmin({ ADMIN_PASSWORD: 'p', SESSION_SECRET: SECRET })).toEqual({ ok: true, motDePasse: 'p', secret: SECRET });
});

test('motDePasseCorrect', () => {
  expect(motDePasseCorrect('soleil', 'soleil')).toBe(true);
  expect(motDePasseCorrect('Soleil', 'soleil')).toBe(false);
  expect(motDePasseCorrect('', 'soleil')).toBe(false);
});

test('session : valide, expirée, falsifiée, autre secret, mal formée', () => {
  const s = creerSession(SECRET, T0);
  expect(sessionValide(s, SECRET, new Date(T0.getTime() + 1000))).toBe(true);
  expect(sessionValide(s, SECRET, new Date(T0.getTime() + DUREE_SESSION_MS + 1))).toBe(false);
  expect(sessionValide(s, 'y'.repeat(32), T0)).toBe(false);
  const [exp, sig] = s.split('.');
  expect(sessionValide(`${Number(exp) + 1}.${sig}`, SECRET, T0)).toBe(false);
  for (const v of [undefined, '', 'abc', '1.2.3', `${exp}.`, `.${sig}`]) expect(sessionValide(v, SECRET, T0)).toBe(false);
});

test('cleSession : changer le mot de passe ou le secret invalide les sessions', () => {
  const cle = cleSession({ motDePasse: 'soleil', secret: SECRET });
  expect(cle).toMatch(/^[0-9a-f]{64}$/);
  const s = creerSession(cle, T0);
  expect(sessionValide(s, cleSession({ motDePasse: 'soleil', secret: SECRET }), T0)).toBe(true);
  expect(sessionValide(s, cleSession({ motDePasse: 'lune', secret: SECRET }), T0)).toBe(false);
  expect(sessionValide(s, cleSession({ motDePasse: 'soleil', secret: 'y'.repeat(32) }), T0)).toBe(false);
});

test('tenterConnexion : 5 échecs bloquent, même avec le bon mot de passe, puis débloque après 15 min', async () => {
  const db = await openDb(':memory:');
  const cfg = { motDePasse: 'soleil' };
  for (let i = 0; i < 5; i++) expect(await tenterConnexion('faux', '1.1.1.1', cfg, db, T0)).toBe('refuse');
  expect(await tenterConnexion('soleil', '1.1.1.1', cfg, db, T0)).toBe('bloque');
  expect(await tenterConnexion('soleil', '2.2.2.2', cfg, db, T0)).toBe('ok');
  expect(await tenterConnexion('soleil', '1.1.1.1', cfg, db, new Date(T0.getTime() + 15 * 60_000 + 1))).toBe('ok');
});

test('les connexions réussies ne comptent pas comme des échecs', async () => {
  const db = await openDb(':memory:');
  for (let i = 0; i < 6; i++) expect(await tenterConnexion('soleil', '1.1.1.1', { motDePasse: 'soleil' }, db, T0)).toBe('ok');
});
```

> Le test « débloque après 15 min » passe parce que l'essai bloqué a été noté à `T0`, comme les 5 échecs : à `T0 + 15 min + 1 ms`, plus aucun n'est dans la fenêtre.

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/auth.test.ts`
Attendu : ÉCHEC (module absent).

- [ ] **Étape 3 : implémenter `src/lib/auth.ts`**

- **Signature :** `createHmac('sha256', secret).update(String(expiration)).digest('base64url')`.
- **`sessionValide` :**
  - exiger le format `/^\d+\.[A-Za-z0-9_-]+$/` ;
  - comparer les signatures avec `timingSafeEqual`, après avoir vérifié qu'elles ont la même longueur ;
  - exiger `maintenant < expiration <= maintenant + DUREE_SESSION_MS`.
- **`tenterConnexion` :**
  1. purger les tentatives de plus de 24 h ;
  2. si `compterTentatives('login:' + ip, maintenant − 15 min)` vaut 5 ou plus, noter une tentative et renvoyer `'bloque'` ;
  3. sinon, si le mot de passe est correct, renvoyer `'ok'` ;
  4. sinon, noter une tentative et renvoyer `'refuse'`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run`
Attendu : tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/auth.ts tests/unit/auth.test.ts
git commit -m "Ajoute la session organisateur et la limite de connexion"
```

---

### Tâche 5 : accès à l'admin (garde, gabarit, connexion, déconnexion)

**Fichiers :**
- Créer :
  - `src/layouts/Admin.astro`
  - `src/pages/admin/connexion.astro`
  - `src/pages/admin/deconnexion.ts`
  - `src/pages/admin/index.astro` : titre « Réponses » seulement, complété à la tâche 6
  - `tests/e2e/admin.ts`
  - `tests/e2e/admin.spec.ts`
- Modifier : `src/middleware.ts`, `playwright.config.ts`, `.env.example`

**Interfaces :**
- Consomme : `configAdmin`, `sessionValide`, `creerSession`, `tenterConnexion`, `NOM_COOKIE`, `DUREE_SESSION_MS`, `cleSession` (tâche 4) ; `problemeConfigMail`, `outboxActive` (tâche 1) ; `getDb`.
- Produit :
  - `Admin.astro` avec les props `{ titre: string; actif: 'reponses' | 'livre-dor' | 'outbox' }` et un slot par défaut ;
  - les aides de test `connecter(page: Page): Promise<void>` et `repondre(page: Page, champs: Record<string, string | string[]>): Promise<void>`. `repondre` envoie un `POST /fr/rsvp` avec l'en-tête `Origin` ; les champs ont les noms du formulaire (`vient`, `nom`, `email`, `moment`, `message`…).

- [ ] **Étape 1 : écrire les tests de bout en bout qui échouent** (`tests/e2e/admin.spec.ts`)

```ts
test('sans session : /admin redirige vers la connexion', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  await expect(page.getByRole('heading', { name: /Espace organisateur/ })).toBeVisible();
});

test('mauvais mot de passe : message d’erreur', async ({ page }) => {
  await page.goto('/admin/connexion');
  await page.getByLabel('Mot de passe').fill('pas-le-bon');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Mot de passe incorrect.');
});

test('connexion, cookie sûr, en-têtes, puis déconnexion', async ({ page, context }) => {
  await connecter(page);
  await expect(page.getByRole('heading', { level: 1, name: /Réponses/ })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === 'admin_session')!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  const rep = await page.request.get('/admin');
  expect(rep.headers()['cache-control']).toContain('no-store');
  expect(rep.headers()['x-robots-tag']).toContain('noindex');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
});

test('cookie falsifié refusé', async ({ page, context }) => {
  await context.addCookies([{ name: 'admin_session', value: '99999999999999.faux', url: 'http://localhost:4322' }]);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
});

test('requête depuis un autre site refusée (CSRF)', async ({ page }) => {
  await connecter(page);
  const rep = await page.request.post('/admin/deconnexion', { headers: { Origin: 'https://pirate.example' }, form: {} });
  expect(rep.status()).toBe(403);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1, name: /Réponses/ })).toBeVisible();
});

const violations = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

test('accessibilité WCAG AA de la connexion et des onglets', async ({ page }) => {
  await page.goto('/admin/connexion');
  expect(await violations(page)).toEqual([]);
  await connecter(page);
  expect(await violations(page)).toEqual([]);
});
```

> Les tâches 10 et 11 ajoutent `/admin/livre-dor` et `/admin/outbox` à ce test, en visitant chaque page après la connexion. Elles les ajoutent aussi au test des 360 px de la tâche 6.

> La suite contient un seul mot de passe erroné par projet, soit 2 au total. Respecter la limite de 4 des contraintes globales.

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx playwright test tests/e2e/admin.spec.ts`
Attendu : ÉCHEC (page `/admin` absente).

- [ ] **Étape 3 : implémenter**

- **`playwright.config.ts` :** ajouter `ADMIN_PASSWORD` et `SESSION_SECRET` (valeurs des contraintes globales) à `webServer.env`.
- **`src/middleware.ts` :** après la vérification du contenu, appliquer ceci si le chemin correspond à `/^\/(api\/)?admin(\/|$)/` :
  - si le chemin n'est pas `/admin/connexion`, lire la configuration et le cookie `NOM_COOKIE`, et le vérifier avec `sessionValide(cookie, cleSession(cfg), new Date())` ;
  - si la configuration est invalide ou la session non valide :
    - pour `/api/admin/*`, répondre `new Response('Non autorisé', { status: 401 })` ;
    - sinon, rediriger (302) vers `/admin/connexion` ;
  - sur toute réponse de ces chemins, connexion comprise, poser `Cache-Control: no-store` et `X-Robots-Tag: noindex`.
- **`Admin.astro` :**
  - importer `global.css` (pour les styles du formulaire de réponse réutilisé à la tâche 7) ;
  - `themeVars` et `fontsHref` comme `Base.astro` ;
  - `<html lang="fr">`, `<meta name="robots" content="noindex">`, titre `${titre} · admin` ;
  - barre latérale brune selon la maquette :
    - logo `☀ {ev.site.logo ?? titre fr} · admin` ;
    - liens « Réponses » (`/admin`) et « Livre d’or » (`/admin/livre-dor`) ;
    - lien « Boîte d’envoi (test) » (`/admin/outbox`), seulement si `outboxActive()` ;
    - lien « Voir le site » (`/`) ;
    - formulaire `POST /admin/deconnexion` avec le bouton « Déconnexion » ;
  - lien actif avec `aria-current="page"` ;
  - en dessous de 760 px, la barre devient horizontale et passe au-dessus du contenu ;
  - si `problemeConfigMail()` renvoie un message, l'afficher dans un bandeau `role="alert"` en haut du contenu.
- **`connexion.astro`** (sans le gabarit admin : carte centrée sur fond orange, selon la maquette) :
  - titre `<h1>☀ Espace organisateur</h1>` ;
  - si la configuration est invalide, afficher `probleme` et pas de formulaire ;
  - en `GET` avec une session valide, rediriger vers `/admin` ;
  - en `POST`, lire le champ `mot_de_passe` et appeler `tenterConnexion` avec l'adresse IP (`Astro.clientAddress` dans un `try`, `'inconnue'` en cas d'échec, comme dans `rsvp.astro`) :
    - `'ok'` : poser le cookie `creerSession(cleSession(cfg), new Date())` (`httpOnly: true, sameSite: 'lax', secure: Astro.url.protocol === 'https:' || !!process.env.VERCEL, path: '/', maxAge: DUREE_SESSION_MS / 1000`), puis rediriger (303) vers `/admin` ;
    - `'refuse'` : afficher « Mot de passe incorrect. » en `role="alert"` ;
    - `'bloque'` : afficher « Trop de tentatives : réessayez dans 15 minutes. » en `role="alert"` ;
  - libellé « Mot de passe » associé au champ, `autocomplete="current-password"`.
- **`deconnexion.ts` :** exporter seulement `POST`, qui supprime le cookie (`path: '/'`) puis redirige (303) vers `/admin/connexion`.
- **`.env.example` :** ajouter `ADMIN_PASSWORD=` et `SESSION_SECRET=`, avec la commande de génération en commentaire : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run && npx astro check && npx playwright test`
Attendu : tout passe, 0 erreur.

- [ ] **Étape 5 : commit**

```bash
git add src/middleware.ts src/layouts/Admin.astro src/pages/admin playwright.config.ts .env.example tests/e2e
git commit -m "Protège l'espace organisateur par mot de passe"
```

---

### Tâche 6 : onglet Réponses et téléchargement du CSV

**Fichiers :**
- Créer : `src/pages/api/admin/export.csv.ts`
- Modifier : `src/pages/admin/index.astro`, `src/lib/admin/reponses.ts`
- Tests : `tests/unit/admin-reponses.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces :**
- Consomme : `statistiques`, `lireFiltres`, `filtrer` (tâche 2) ; `exporterCsv`, `horodatageLocal` (tâche 3) ; `getDeps()`.
- Produit : `abreviations(moments: { id: string; titre: string }[], longueurMin: number): Record<string, string>`, réutilisée par le PDF à la tâche 8.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
test('abreviations : uniques, allongées si besoin', () => {
  const m = [{ id: 'a', titre: 'Accueil' }, { id: 'd', titre: 'Dîner' }, { id: 's', titre: 'Soirée' }, { id: 'b', titre: 'Brunch' }];
  expect(abreviations(m, 1)).toEqual({ a: 'A', d: 'D', s: 'S', b: 'B' });
  expect(abreviations(m, 3)).toEqual({ a: 'Acc', d: 'Dîn', s: 'Soi', b: 'Bru' });
  expect(abreviations([{ id: 'x', titre: 'Soirée' }, { id: 'y', titre: 'Soupe' }], 1)).toEqual({ x: 'Soi', y: 'Sou' });
  expect(abreviations([{ id: 'x', titre: 'Dîner' }, { id: 'y', titre: 'Dîner' }], 1)).toEqual({ x: 'Dîner 1', y: 'Dîner 2' });
});
```

Dans `admin.spec.ts` :

```ts
test('tableau : compteurs, recherche, filtre de présence, export CSV', async ({ page }, info) => {
  const oui = email(info, 'adm-oui');
  const non = email(info, 'adm-non');
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Iris Admin', email: oui, moment: ['diner'] });
  await repondre(page, { vient: 'non', nom: 'Noé Admin', email: non });
  await connecter(page);
  await expect(page.getByText('Personnes attendues')).toBeVisible();
  await page.getByLabel('Rechercher un nom ou un e-mail').fill(oui);
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('row').nth(1)).toContainText('Iris Admin');
  await page.getByLabel('Rechercher un nom ou un e-mail').fill(non);
  await page.getByLabel('Présence').selectOption('oui');
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await expect(page.getByText('Aucune réponse ne correspond à ces filtres.')).toBeVisible();
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Export CSV/ }).click()]);
  const contenu = readFileSync(await telechargement.path(), 'utf8');
  expect(contenu.charCodeAt(0)).toBe(0xfeff);
  expect(contenu).toContain(`Iris Admin;${oui};`);
});

test('export CSV sans session : 401', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:4322' });
  expect((await ctx.get('/api/admin/export.csv')).status()).toBe(401);
});

test('pas de défilement horizontal de la page à 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await connecter(page);
  for (const url of ['/admin']) {
    await page.goto(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
```

> La fonction `email(info, tag)` est la même que dans `rsvp.spec.ts` ; la déplacer dans `tests/e2e/admin.ts` et l'importer dans les deux fichiers.

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/admin-reponses.test.ts && npx playwright test tests/e2e/admin.spec.ts`
Attendu : ÉCHEC.

- [ ] **Étape 3 : implémenter**

- **`abreviations` :**
  1. partir des `longueurMin` premiers caractères de chaque titre ;
  2. tant que deux abréviations sont égales, allonger d'un caractère toutes celles qui sont en conflit ;
  3. si des titres sont identiques en entier, suffixer ` 1`, ` 2`… dans l'ordre.
- **`index.astro`** (gabarit `Admin`, `actif="reponses"`) :
  - lire `deps.db.toutes()` et les filtres de `Astro.url.searchParams` ;
  - en-tête « Réponses » avec le lien « ⬇ Export CSV / Excel » vers `/api/admin/export.csv` ;
  - 4 tuiles : « Réponses reçues », « Foyers confirmés », « Personnes attendues », « Ne viendront pas » ;
  - pastilles `Titre FR : n` par moment ;
  - formulaire `GET` :
    - champ `q` (libellé « Rechercher un nom ou un e-mail ») ;
    - liste `presence` (libellé « Présence », options « Tous », « Viennent » = `oui`, « Ne viennent pas » = `non`) ;
    - liste `moment` (libellé « Moment », option « Tous les moments » plus les titres) ;
    - bouton « Filtrer » ;
  - phrase « N réponse(s) affichée(s) », sans rôle ARIA ;
  - tableau dans un conteneur `overflow-x: auto`, colonnes Invité, Contact, Présence, Pers., Moments, Reçu le :
    - **Invité :** nom en gras, `+ Accompagnant` par ligne, pastille `EN` si `langue === 'en'` ;
    - **Contact :** e-mail, puis téléphone ou `—` ;
    - **Présence :** pastille « Vient » ou « Ne vient pas » ;
    - **Moments :** abréviations de 3 lettres jointes par ` · `, « Tous » si tous les moments sont choisis, `—` si aucun ;
    - **Reçu le :** `JJ/MM`, tiré de `horodatageLocal`.
  - **États vides :**
    - « Aucune réponse pour l'instant. » si la base est vide ;
    - « Aucune réponse ne correspond à ces filtres. » sinon.
- **`export.csv.ts` :**
  - `GET` renvoie `exporterCsv` sur toutes les réponses, sans filtre ;
  - en-têtes `Content-Type: text/csv; charset=utf-8` et `Content-Disposition: attachment; filename="reponses-AAAA-MM-JJ.csv"`, la date étant celle de `deps.maintenant()`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run && npx astro check && npx playwright test`
Attendu : tout passe.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/admin src/pages/admin/index.astro src/pages/api/admin/export.csv.ts tests
git commit -m "Ajoute l'onglet Réponses et l'export CSV"
```

---

### Tâche 7 : actions sur une réponse (PDF, renvoi, modification, suppression)

**Fichiers :**
- Créer :
  - `src/pages/api/admin/reponses/[id]/renvoyer.ts`
  - `src/pages/api/admin/reponses/[id]/invitation.pdf.ts`
  - `src/pages/admin/reponses/[id]/modifier.astro`
  - `src/pages/admin/reponses/[id]/supprimer.astro`
- Modifier : `src/lib/rsvp-service.ts`, `src/lib/admin/reponses.ts`, `src/pages/admin/index.astro`
- Tests : `tests/unit/rsvp-service.test.ts`, `tests/unit/admin-reponses.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces :**
- Consomme : `Db.parId`, `Db.supprimer` (tâche 2) ; `envoyerConfirmation` (privée, `rsvp-service.ts`) ; `nomFichierInvitation`.
- Produit :
  - `renvoyerConfirmation(id: number, deps: Deps): Promise<'ok' | 'echec' | 'introuvable'>` ;
  - `modifierParAdmin(id: number, champs: ChampsRsvp, deps: Deps): Promise<Resultat>` : pas de date limite, e-mail et langue conservés, aucun e-mail envoyé (`emailEnvoye: false`) ;
  - `idDepuisParam(v: string | undefined): number | null`, qui accepte seulement un entier strictement positif ;
  - `messageFlash(code: string | null): { texte: string; type: 'ok' | 'erreur' } | null`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
// rsvp-service.test.ts
test('renvoyerConfirmation : ok, échec, introuvable', async () => {
  const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
  if (r.type !== 'ok') throw new Error();
  expect(await renvoyerConfirmation(r.reponse.id, deps)).toBe('ok');
  expect(envoyes).toHaveLength(2);
  expect(envoyes[1].piecesJointes).toHaveLength(1);
  deps.expediteur = { envoyer: async () => { throw new Error('panne'); } };
  expect(await renvoyerConfirmation(r.reponse.id, deps)).toBe('echec');
  expect((await db.parId(r.reponse.id))?.emailEnvoye).toBe(false);
  expect(await renvoyerConfirmation(9999, deps)).toBe('introuvable');
});

test('modifierParAdmin : après la date limite, sans e-mail, e-mail et langue conservés', async () => {
  const r = await soumettre(champs, 'en', '1.1.1.1', deps);
  if (r.type !== 'ok') throw new Error();
  deps.maintenant = () => APRES;
  const m = await modifierParAdmin(r.reponse.id, { ...champs, nom: 'Camille Roy', email: 'pirate@x.fr' }, deps);
  expect(m.type === 'ok' && m.emailEnvoye).toBe(false);
  const lue = await db.parId(r.reponse.id);
  expect(lue).toMatchObject({ nom: 'Camille Roy', email: 'camille@exemple.fr', langue: 'en' });
  expect(envoyes).toHaveLength(1);
  expect(await modifierParAdmin(9999, champs, deps)).toEqual({ type: 'introuvable' });
});

// admin-reponses.test.ts
test('idDepuisParam', () => {
  expect(idDepuisParam('12')).toBe(12);
  for (const v of [undefined, '', '0', '-3', '1.5', '12abc', '1e3']) expect(idDepuisParam(v)).toBeNull();
});
test('messageFlash', () => {
  expect(messageFlash('renvoye')).toEqual({ texte: 'E-mail renvoyé.', type: 'ok' });
  expect(messageFlash('introuvable')).toEqual({ texte: "Cette réponse n'existe plus.", type: 'erreur' });
  expect(messageFlash('<script>')).toBeNull();
  expect(messageFlash(null)).toBeNull();
});
```

**Codes de `messageFlash`** (texte exact, type) :

| Code | Texte | Type |
|---|---|---|
| `renvoye` | « E-mail renvoyé. » | ok |
| `echec_envoi` | « L'e-mail n'a pas pu être envoyé. Réessayez plus tard. » | erreur |
| `modifie` | « Réponse modifiée. Renvoyez l'e-mail si l'invité doit recevoir la nouvelle invitation. » | ok |
| `supprime` | « Réponse supprimée. » | ok |
| `introuvable` | « Cette réponse n'existe plus. » | erreur |
| `masque` | « Message masqué. » | ok |
| `affiche` | « Message affiché. » | ok |
| `message_supprime` | « Message supprimé. » | ok |

Dans `admin.spec.ts` :

```ts
test('actions : invitation PDF, renvoi, modification, suppression', async ({ page }, info) => {
  const adr = email(info, 'adm-actions');
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Jade Actions', email: adr, moment: ['accueil'] });
  await connecter(page);
  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Invitation PDF de Jade Actions' }).click()]);
  expect(readFileSync(await pdf.path()).subarray(0, 5).toString()).toBe('%PDF-');

  await page.getByRole('button', { name: 'Renvoyer l’e-mail à Jade Actions' }).click();
  await expect(page.getByRole('status')).toHaveText('E-mail renvoyé.');
  expect(messagesEnvoyesA(adr)).toHaveLength(2);

  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await page.getByRole('link', { name: 'Modifier la réponse de Jade Actions' }).click();
  await page.getByLabel('Prénom & nom').fill('Jade Modifiée');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toContainText('Réponse modifiée.');

  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await expect(page.getByRole('row').nth(1)).toContainText('Jade Modifiée');
  await page.getByRole('link', { name: 'Supprimer la réponse de Jade Modifiée' }).click();
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page.getByRole('status')).toHaveText('Réponse supprimée.');
  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await expect(page.getByText('Aucune réponse ne correspond à ces filtres.')).toBeVisible();
});

test('action sur une réponse inexistante : message, pas d’erreur 500', async ({ page }) => {
  await connecter(page);
  const rep = await page.request.post('/api/admin/reponses/999999/renvoyer', { headers: { Origin: new URL(page.url()).origin }, form: {} });
  expect(rep.status()).toBeLessThan(500);
  await page.goto(rep.url());
  await expect(page.getByRole('alert')).toHaveText("Cette réponse n'existe plus.");
  expect((await page.request.get('/api/admin/reponses/999999/invitation.pdf')).status()).toBe(404);
  expect((await page.request.get('/admin/reponses/abc/supprimer')).status()).toBe(404);
});
```

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit && npx playwright test tests/e2e/admin.spec.ts`
Attendu : ÉCHEC.

- [ ] **Étape 3 : implémenter**

- **`renvoyerConfirmation` :** lire `db.parId`, renvoyer `'introuvable'` si la réponse n'existe pas, sinon traduire le booléen de `envoyerConfirmation` en `'ok'` ou `'echec'`.
- **`modifierParAdmin` :** lire `db.parId`, puis valider avec l'e-mail existant et la langue existante. Appeler `db.modifier(existante.jeton, …)` ; si le résultat est `null`, renvoyer `'introuvable'`.
- **Messages dans `index.astro` :** lire `?ok=` et afficher `messageFlash`, en `role="status"` (ok) ou `role="alert"` (erreur).
- **Colonne Actions, avec les noms accessibles exacts :**
  - lien 📄 « Invitation PDF de {nom} », seulement si l'invité vient ;
  - formulaire `POST` vers `/api/admin/reponses/{id}/renvoyer`, avec le bouton ✉ « Renvoyer l’e-mail à {nom} » ;
  - lien ✎ « Modifier la réponse de {nom} » ;
  - lien 🗑 « Supprimer la réponse de {nom} ».

  L'icône est en `aria-hidden="true"`, et le nom accessible vient de `aria-label`.
- **`renvoyer.ts` :** `POST` uniquement. Un identifiant invalide compte comme `'introuvable'`. Rediriger (303) vers `/admin?ok=renvoye`, `echec_envoi` ou `introuvable`.
- **`invitation.pdf.ts` :**
  - 404 si l'identifiant est invalide, la réponse absente ou l'invité ne vient pas ;
  - sinon, le résultat de `deps.invitationPdf(r)`, avec l'en-tête `Content-Disposition: attachment; filename="<nomFichierInvitation>"`.
- **`modifier.astro` :**
  - gabarit `Admin`, avec `RsvpForm` prérempli, `lang="fr"`, `emailVerrouille` et le libellé « Enregistrer » ;
  - en `POST`, appeler `modifierParAdmin` :
    - `ok` : rediriger (303) vers `/admin?ok=modifie` ;
    - `invalide` : réafficher le formulaire avec les erreurs ;
    - `introuvable` : rediriger vers `/admin?ok=introuvable` ;
  - un identifiant invalide ou une réponse absente au `GET` donne un statut 404 et le texte « Cette réponse n'existe plus. ».
- **`supprimer.astro` :**
  - en `GET`, afficher « Supprimer la réponse de {nom} ? Le message du livre d'or sera supprimé aussi. Cette action est définitive. », un formulaire `POST` avec le bouton « Supprimer définitivement », et le lien « Annuler » vers `/admin` ;
  - en `POST`, rediriger (303) vers `/admin?ok=supprime`, ou `introuvable` ;
  - un identifiant invalide au `GET` donne 404.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run && npx astro check && npx playwright test`
Attendu : tout passe.

- [ ] **Étape 5 : commit**

```bash
git add src/lib src/pages/admin src/pages/api/admin tests
git commit -m "Ajoute les actions sur une réponse dans l'espace organisateur"
```

---

### Tâche 8 : PDF de la liste des confirmés

**Fichiers :**
- Créer : `src/lib/pdf/liste.ts`, `src/pages/api/admin/liste.pdf.ts`, `tests/unit/pdf-liste.test.ts`
- Modifier : `src/lib/pdf/invitation.ts` (exporter `couleur`), `src/pages/admin/index.astro` (bouton)

**Interfaces :**
- Consomme : `dessinable`, `tronquer`, `couper`, `OPTIONS_TITRE`, `Polices` (`invitation.ts`) ; `abreviations`, `statistiques` (tâches 2 et 6) ; `horodatageLocal` (tâche 3) ; `formatDate`, `couleursTheme`.
- Produit :
  - `type LigneListe = { nom: string; accompagnants: string; email: string; telephone: string; personnes: number; moments: string }` ;
  - `lignesListe(ev: EventConfig, reponses: Reponse[]): LigneListe[]` : uniquement les invités qui viennent, triés par nom (`localeCompare` en `'fr'`, `sensitivity: 'base'`). `accompagnants` est la liste jointe par `, ` ou `—`, `telephone` vaut `—` s'il est vide, et `moments` contient les abréviations d'une lettre jointes par `·` ;
  - `paginer(hauteurs: number[], dispoPremiere: number, dispoSuivantes: number): number[][]` : indices des lignes par page, chaque page reçoit au moins une ligne ;
  - `genererListe(d: { ev: EventConfig; reponses: Reponse[]; polices: Polices; maintenant: Date }): Promise<Uint8Array>`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
test('lignesListe : seulement les confirmés, triés, abrégés', () => {
  const l = lignesListe(ev, [
    rep({ nom: 'Martin Zoé', vient: true, moments: ['accueil', 'soiree'], accompagnants: ['Léo Martin'] }),
    rep({ nom: 'Paul Absent', vient: false }),
    rep({ nom: 'Émilie Durand', vient: true, moments: ['diner'], telephone: '06 12' }),
  ]);
  expect(l).toEqual([
    { nom: 'Émilie Durand', accompagnants: '—', email: expect.any(String), telephone: '06 12', personnes: 1, moments: 'D' },
    { nom: 'Martin Zoé', accompagnants: 'Léo Martin', email: expect.any(String), telephone: '—', personnes: 2, moments: 'A·S' },
  ]);
});

test('paginer', () => {
  expect(paginer([10, 10, 10], 25, 25)).toEqual([[0, 1], [2]]);
  expect(paginer([10, 10, 10, 10], 15, 30)).toEqual([[0], [1, 2, 3]]);
  expect(paginer([50], 20, 20)).toEqual([[0]]);
  expect(paginer([], 20, 20)).toEqual([[]]);
});

test('genererListe : PDF A4 valide, une page pour quelques invités', async () => {
  const octets = await genererListe({ ev, reponses: [rep({ vient: true, moments: ['diner'] })], polices, maintenant: new Date('2027-01-15T12:00:00Z') });
  const doc = await PDFDocument.load(octets);
  expect(doc.getPageCount()).toBe(1);
  expect(doc.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
  expect(doc.getTitle()).toContain('Liste des confirmés');
});

test('genererListe : 120 foyers, noms très longs et emoji → plusieurs pages sans erreur', async () => {
  const reponses = Array.from({ length: 120 }, (_, i) => rep({
    id: i + 1, vient: true, moments: ['accueil', 'diner'], email: `invite${i}@exemple.fr`,
    nom: i % 10 === 0 ? `${'Maximilien-Alexandre '.repeat(6)}🎉 ${i}` : `Invité ${i}`,
    accompagnants: i % 7 === 0 ? ['A'.repeat(150), 'Léo 🥳', 'Zoé', 'Noé'] : [],
  }));
  const doc = await PDFDocument.load(await genererListe({ ev, reponses, polices, maintenant: new Date() }));
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
});

test('genererListe : aucun confirmé → une page', async () => {
  const doc = await PDFDocument.load(await genererListe({ ev, reponses: [], polices, maintenant: new Date() }));
  expect(doc.getPageCount()).toBe(1);
});
```

E2E (`admin.spec.ts`) :

```ts
test('téléchargement de la liste des confirmés', async ({ page }) => {
  await connecter(page);
  const [t] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /PDF liste des confirmés/ }).click()]);
  expect(t.suggestedFilename()).toBe('liste-des-confirmes.pdf');
  expect(readFileSync(await t.path()).subarray(0, 5).toString()).toBe('%PDF-');
});
```

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/pdf-liste.test.ts`
Attendu : ÉCHEC (module absent).

- [ ] **Étape 3 : implémenter**

**Mise en page de `genererListe`** (marges 36 pt, largeur utile 523 pt) :

- **En-tête de la page 1, selon la maquette :**
  - titre Caveat 26 pt `<titre FR> · Liste des confirmés`, en `principale` ;
  - ligne Nunito 10 pt `<formatDate(date_debut, 'fr')> · Édité le <JJ/MM/AAAA>` (`horodatageLocal(maintenant.toISOString(), ev.evenement.date_debut).slice(0, 10)`) ;
  - à droite, `<personnes> pers.` en gras orange foncé et `<foyers> foyers` ;
  - filet orange de 3 pt.
- **Pages suivantes :** une ligne de rappel Nunito 9 pt `<titre FR> · Liste des confirmés (suite)`.
- **Tableau :**
  - largeurs des colonnes en pt : ✓ 18, Nom 105, Accompagnants 120, E-mail 125, Téléphone 70, Pers. 30, Moments 55 ;
  - en-tête sur fond `douce`, en Nunito gras 8 pt majuscules, **répété en haut de chaque page** ;
  - case à cocher : carré de 8 pt ;
  - Nom en gras 9 pt, tronqué ;
  - Accompagnants coupés sur 3 lignes au plus (`couper`, puis la dernière ligne tronquée avec « … ») ;
  - autres cellules tronquées, en Nunito 8,5 pt ;
  - hauteur d'une ligne : `max(1, lignes d'accompagnants) × 11 + 8` ;
  - filet `#eeeeee` entre les lignes.
- **Découpage :** `paginer` avec la place disponible sous l'en-tête de la page 1, et sous le rappel et l'en-tête de tableau des pages suivantes. Réserver 24 pt en bas pour le pied de page.
- **Après le tableau,** sur la dernière page, ou sur une page de plus si la place manque :
  - légende « Moments : A = Accueil · D = Dîner · … » ;
  - « Totaux : Accueil 79 · Dîner 85 · … », en personnes, tirés de `statistiques`.

  Les deux textes sont coupés avec `couper`.
- **Sans confirmé :** l'en-tête du tableau, puis la ligne « Aucun invité confirmé pour l'instant. ».
- **Pied de page :** `Page n / N` à droite, en 8 pt, sur chaque page.
- **Métadonnées :** `setTitle('Liste des confirmés – <titre FR>')`.

**Le reste :**
- **`liste.pdf.ts` :** `GET` génère la liste, avec `polices()` et `deps.maintenant()`, et l'en-tête `Content-Disposition: attachment; filename="liste-des-confirmes.pdf"`.
- **`index.astro` :** lien « 🖨 PDF liste des confirmés » dans l'en-tête.

- [ ] **Étape 4 : vérifier que les tests passent, puis contrôler à l'œil**

Lancer : `npx vitest run && npx astro check && npx playwright test`
Attendu : tout passe.

Puis écrire `.data/apercu-liste.pdf`, avec 40 invités variés dont des noms longs, et l'ouvrir. Vérifier :
- l'en-tête du tableau est répété ;
- aucun texte ne déborde de sa cellule ;
- la police Caveat est lisible ;
- les totaux sont présents.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/pdf src/pages/api/admin/liste.pdf.ts src/pages/admin/index.astro tests
git commit -m "Ajoute le PDF de la liste des confirmés"
```

---

### Tâche 9 : PDF de toutes les invitations

**Fichiers :**
- Créer : `src/pages/api/admin/invitations.pdf.ts`
- Modifier : `src/lib/pdf/invitation.ts`, `src/lib/pdf/ressources.ts`, `src/pages/admin/index.astro` (bouton)
- Tests : `tests/unit/pdf.test.ts`, `tests/unit/pdf-ressources.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces :**
- Consomme : la logique actuelle de `preparer` et `genererInvitation`.
- Produit :
  - `genererInvitation(d)` et `mesurerInvitation(d)` gardent **la même signature** : les tests existants ne changent pas ;
  - `genererInvitations(d: { ev: EventConfig; reponses: Pick<Reponse, 'nom' | 'accompagnants' | 'moments' | 'langue'>[]; photo: Uint8Array | null; polices: Polices; urlQr: (langue: Lang) => string }): Promise<Uint8Array>` : une page A5 par réponse ;
  - `photoJpeg(chemin)` est mise en cache par chemin. Deux appels renvoient le même objet, et un échec n'est pas mis en cache.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
// pdf.test.ts
const compter = (doc: PDFDocument, cle: string, valeur?: string) => doc.context.enumerateIndirectObjects()
  .filter(([, o]) => o instanceof PDFRawStream && (valeur ? o.dict.get(PDFName.of(cle)) === PDFName.of(valeur) : o.dict.has(PDFName.of(cle)))).length;

test('genererInvitations : une page A5 par invité', async () => {
  const octets = await genererInvitations({ ev, reponses: [reponse, { ...reponse, nom: 'Thomas' }, { ...reponse, nom: 'Emma', langue: 'en' }],
    photo, polices, urlQr: (l) => `http://localhost:4321/${l}/programme` });
  const doc = await PDFDocument.load(octets);
  expect(doc.getPageCount()).toBe(3);
  expect(doc.getPages().every((p) => Math.round(p.getWidth()) === 420)).toBe(true);
});

test('genererInvitations : photo et polices intégrées une seule fois, 60 invités en moins de 10 s', async () => {
  const debut = Date.now();
  const reponses = Array.from({ length: 60 }, (_, i) => ({ ...reponse, nom: `Invité ${i}`, langue: (i % 2 ? 'en' : 'fr') as Lang }));
  const doc = await PDFDocument.load(await genererInvitations({ ev, reponses, photo, polices, urlQr: (l) => `https://site.fr/${l}/programme` }));
  expect(Date.now() - debut).toBeLessThan(10_000);
  expect(doc.getPageCount()).toBe(60);
  expect(compter(doc, 'Subtype', 'Image')).toBe(3); // la photo + un QR code par langue
  const fichiersPolice = new Set(doc.context.enumerateIndirectObjects()
    .map(([, o]) => (o instanceof PDFDict ? o.get(PDFName.of('FontFile2')) : undefined))
    .filter(Boolean).map(String)).size;
  expect(fichiersPolice).toBe(3);                   // 3 fichiers de police TrueType, quel que soit le nombre d'invités
}, 20_000);

test('genererInvitations : aucun invité → une page', async () => {
  const doc = await PDFDocument.load(await genererInvitations({ ev, reponses: [], photo, polices, urlQr: () => 'https://site.fr' }));
  expect(doc.getPageCount()).toBe(1);
});

// pdf-ressources.test.ts
test('photoJpeg est mise en cache', async () => {
  const a = await photoJpeg('photos/hero.jpg');
  expect(await photoJpeg('photos/hero.jpg')).toBe(a);
});
```

> Importer `PDFDict`, `PDFName` et `PDFRawStream` depuis `pdf-lib`. Le QR code PNG est opaque, donc pdf-lib n'ajoute pas de masque `SMask` : le compte des images est exact.

E2E (`admin.spec.ts`) :

```ts
test('téléchargement de toutes les invitations', async ({ page }, info) => {
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Pia Invitations', email: email(info, 'adm-invs'), moment: ['diner'] });
  await connecter(page);
  const [t] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Toutes les invitations/ }).click()]);
  expect(t.suggestedFilename()).toBe('invitations.pdf');
  expect(readFileSync(await t.path()).subarray(0, 5).toString()).toBe('%PDF-');
});
```

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/pdf.test.ts tests/unit/pdf-ressources.test.ts`
Attendu : ÉCHEC (`genererInvitations` absente, pas de cache).

- [ ] **Étape 3 : implémenter**

- **`invitation.ts` :** découper en deux fonctions internes.
  - `preparerDocument(polices, photo)` crée le document, intègre les trois polices et la photo, et prépare un cache de QR codes par URL ;
  - `ajouterPage(ressources, { ev, reponse, urlQr })` reprend le calcul de disposition et le dessin actuels.

  `genererInvitation` et `mesurerInvitation` appellent ces deux fonctions. `genererInvitations` appelle `ajouterPage` pour chaque réponse. Sans réponse, la page unique contient le bandeau et « Aucun invité confirmé pour l'instant. ». Titre du document : `Invitations – <titre FR>`.
- **`ressources.ts` :** `const cache = new Map<string, Promise<Uint8Array | null>>()`. En cas de rejet, retirer l'entrée du cache.
- **`invitations.pdf.ts` :** `GET` sur les réponses qui viennent, triées par nom comme la liste, avec `photoJpeg(ev.accueil.photo_principale)`, `urlQr = (l) => `${deps.urlBase}/${l}/programme`` et l'en-tête `Content-Disposition: attachment; filename="invitations.pdf"`.
- **`index.astro` :** lien « 📄 Toutes les invitations (PDF) ».

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run && npx astro check && npx playwright test`
Attendu : tout passe, **tests existants de `pdf.test.ts` inchangés**.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/pdf src/pages/api/admin/invitations.pdf.ts src/pages/admin/index.astro tests
git commit -m "Ajoute le PDF de toutes les invitations"
```

---

### Tâche 10 : onglet Livre d'or

**Fichiers :**
- Créer :
  - `src/pages/admin/livre-dor.astro`
  - `src/pages/api/admin/messages/[id]/masquer.ts`
  - `src/pages/api/admin/messages/[id]/supprimer.ts`
- Tests : `tests/e2e/admin.spec.ts`

**Interfaces :**
- Consomme : `Db.messages`, `Db.masquerMessage`, `Db.supprimerMessage` (tâche 2) ; `idDepuisParam`, `messageFlash` (tâche 7) ; `horodatageLocal`.

- [ ] **Étape 1 : écrire le test de bout en bout qui échoue**

```ts
test('livre d’or : masquer, réafficher, supprimer (la réponse reste)', async ({ page }, info) => {
  const adr = email(info, 'adm-livre');
  const texte = `Message de modération ${info.project.name} ${Date.now()}`;
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Lou Livre', email: adr, moment: ['diner'], message: texte });
  await page.goto('/fr/rsvp');
  await expect(page.getByText(texte)).toBeVisible();

  await connecter(page);
  await page.goto('/admin/livre-dor');
  const carte = page.getByRole('listitem').filter({ hasText: texte });
  await carte.getByRole('button', { name: 'Masquer' }).click();
  await expect(page.getByRole('status')).toHaveText('Message masqué.');
  await page.goto('/fr/rsvp');
  await expect(page.getByText(texte)).toHaveCount(0);

  await page.goto('/admin/livre-dor');
  await page.getByRole('listitem').filter({ hasText: texte }).getByRole('button', { name: 'Afficher' }).click();
  await page.goto('/fr/rsvp');
  await expect(page.getByText(texte)).toBeVisible();

  await page.goto('/admin/livre-dor');
  await page.getByRole('listitem').filter({ hasText: texte }).getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toHaveText('Message supprimé.');
  await expect(page.getByText(texte)).toHaveCount(0);
  await page.goto(`/admin?q=${encodeURIComponent(adr)}`);
  await expect(page.getByRole('row').nth(1)).toContainText('Lou Livre');
});
```

Compléter aussi les tests de la tâche 5 et de la tâche 6 :

```ts
// test « accessibilité WCAG AA de la connexion et des onglets », après la vérification de /admin :
await page.goto('/admin/livre-dor');
expect(await violations(page)).toEqual([]);

// test « pas de défilement horizontal de la page à 360 px » :
for (const url of ['/admin', '/admin/livre-dor']) {
```

- [ ] **Étape 2 : vérifier que le test échoue**

Lancer : `npx playwright test tests/e2e/admin.spec.ts -g "livre"`
Attendu : ÉCHEC (page absente).

- [ ] **Étape 3 : implémenter**

- **`livre-dor.astro`** (gabarit `Admin`, `actif="livre-dor"`) :
  - en-tête « Livre d’or » et sous-titre « Les messages s'affichent tout de suite sur le site ; masquez ou supprimez-les si besoin. » ;
  - messages de `?ok=` ;
  - liste `<ul>`, un `<li>` par message :
    - texte « … » en police des titres ;
    - `<small>` `{nom} · JJ/MM`, suivi de ` · masqué` si besoin, avec une opacité de 0,6 pour un message masqué ;
    - formulaire `POST` vers `/api/admin/messages/{id}/masquer`, avec le champ caché `masque` à `1` ou `0` et le bouton « Masquer » ou « Afficher » ;
    - formulaire `POST` vers `.../supprimer`, avec le bouton « Supprimer » ;
  - liste vide : « Aucun message pour l'instant. ».
- **`masquer.ts`, `supprimer.ts` :** `POST` uniquement. Un identifiant invalide ou une ligne inexistante donne `introuvable`. Rediriger (303) vers `/admin/livre-dor?ok=masque`, `affiche`, `message_supprime` ou `introuvable`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx astro check && npx playwright test`
Attendu : tout passe.

- [ ] **Étape 5 : commit**

```bash
git add src/pages/admin/livre-dor.astro src/pages/api/admin/messages tests/e2e
git commit -m "Ajoute la modération du livre d'or"
```

---

### Tâche 11 : onglet Boîte d'envoi (test)

**Fichiers :**
- Créer :
  - `src/lib/mail/lire-outbox.ts`
  - `src/pages/admin/outbox.astro`
  - `src/pages/api/admin/outbox/[dossier]/[fichier].ts`
  - `tests/unit/lire-outbox.test.ts`
- Tests : `tests/e2e/admin.spec.ts`

**Interfaces :**
- Consomme : le format écrit par `creerOutbox` (dossier `AAAAMMJJ-HHMMSS-mmm-n`, puis `meta.json`, `message.html`, `message.txt` et les pièces jointes) ; `outboxActive` (tâche 1).
- Produit :
  - `type EntreeOutbox = { dossier: string; a: string; sujet: string; date: string; piecesJointes: string[] }` ;
  - `listerOutbox(racine: string, limite = 100): EntreeOutbox[]` : les plus récentes d'abord, en ignorant les dossiers sans `meta.json` valide ;
  - `lireFichierOutbox(racine: string, dossier: string, fichier: string): { contenu: Buffer; type: string } | null`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
let racine: string;
beforeEach(async () => {
  racine = mkdtempSync(join(tmpdir(), 'outbox-'));
  const dates = [new Date('2027-01-15T10:00:00Z'), new Date('2027-01-15T11:00:00Z')];
  const boite = creerOutbox(racine, () => dates.shift()!);
  await boite.envoyer({ a: 'camille@x.fr', sujet: 'Premier', html: '<p>Camille</p>', texte: 'Camille',
    piecesJointes: [{ nom: 'Invitation-Camille.pdf', contenu: new Uint8Array([37, 80, 68, 70]), type: 'application/pdf' }] });
  await boite.envoyer({ a: 'leo@x.fr', sujet: 'Second', html: '<p>Léo</p>', texte: 'Léo' });
});

test('listerOutbox : plus récents d’abord, dossiers incomplets ignorés', () => {
  mkdirSync(join(racine, '20270101-000000-000-99'));             // sans meta.json
  mkdirSync(join(racine, '20270101-000000-000-98'));
  writeFileSync(join(racine, '20270101-000000-000-98', 'meta.json'), '{pas du json');
  const l = listerOutbox(racine);
  expect(l.map((e) => e.sujet)).toEqual(['Second', 'Premier']);
  expect(l[1].piecesJointes).toEqual(['Invitation-Camille.pdf']);
});

test('lireFichierOutbox : message et pièces jointes déclarées seulement', () => {
  const [, premier] = listerOutbox(racine);
  expect(lireFichierOutbox(racine, premier.dossier, 'message.html')?.type).toBe('text/html; charset=utf-8');
  expect(lireFichierOutbox(racine, premier.dossier, 'Invitation-Camille.pdf')?.type).toBe('application/pdf');
  expect(lireFichierOutbox(racine, premier.dossier, 'meta.json')).toBeNull();
  expect(lireFichierOutbox(racine, premier.dossier, '../meta.json')).toBeNull();
  expect(lireFichierOutbox(racine, '..', 'message.html')).toBeNull();
  expect(lireFichierOutbox(racine, `${premier.dossier}/..`, 'message.html')).toBeNull();
  expect(lireFichierOutbox(racine, '20990101-000000-000-1', 'message.html')).toBeNull();
});
```

E2E :

```ts
test('boîte d’envoi de test : liste et lecture d’un e-mail', async ({ page }, info) => {
  const adr = email(info, 'adm-outbox');
  await page.goto('/fr/rsvp');
  await repondre(page, { vient: 'oui', nom: 'Max Outbox', email: adr, moment: ['diner'] });
  await connecter(page);
  await page.getByRole('link', { name: 'Boîte d’envoi (test)' }).click();
  const ligne = page.getByRole('row').filter({ hasText: adr });
  await expect(ligne).toHaveCount(1);
  const href = await ligne.getByRole('link', { name: 'Voir l’e-mail' }).getAttribute('href');
  const rep = await page.request.get(href!);
  expect(rep.headers()['content-type']).toContain('text/html');
  expect(rep.headers()['content-security-policy']).toContain('sandbox');
  expect(await rep.text()).toContain('Max');
});

// test « accessibilité WCAG AA de la connexion et des onglets », après /admin/livre-dor :
await page.goto('/admin/outbox');
expect(await violations(page)).toEqual([]);

// test « pas de défilement horizontal de la page à 360 px » :
for (const url of ['/admin', '/admin/livre-dor', '/admin/outbox']) {
```

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/lire-outbox.test.ts`
Attendu : ÉCHEC (module absent).

- [ ] **Étape 3 : implémenter**

- **`lire-outbox.ts` :**
  - `dossier` doit correspondre à `/^\d{8}-\d{6}-\d{3}-\d+$/` ;
  - `fichier` doit être `message.html` ou figurer dans `meta.piecesJointes` ;
  - types : `.html` donne `text/html; charset=utf-8`, `.pdf` donne `application/pdf`, tout le reste `application/octet-stream` ;
  - tri par `meta.date` décroissante, puis par le compteur final du nom de dossier, **comparé en nombre** et décroissant (`-10` après `-9`).
- **`[fichier].ts` :**
  - 404 si `!outboxActive()` ou si `lireFichierOutbox` renvoie `null` ;
  - en-têtes `Content-Type` du type renvoyé, et `Content-Security-Policy: sandbox` pour le HTML ;
  - les PDF s'affichent dans le navigateur (`inline`).
- **`outbox.astro`** (gabarit `Admin`, `actif="outbox"`) :
  - si `!outboxActive()`, afficher « La boîte d'envoi de test n'existe qu'en local (MAIL_MODE=outbox). » avec le statut 404 ;
  - sinon, un tableau Date (`JJ/MM HH:MM`), Destinataire, Objet, Fichiers :
    - lien « Voir l’e-mail », avec `target="_blank" rel="noopener"` ;
    - un lien par pièce jointe ;
  - la racine est `process.env.OUTBOX_DIR || '.data/outbox'`.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run && npx astro check && npx playwright test`
Attendu : tout passe.

- [ ] **Étape 5 : commit**

```bash
git add src/lib/mail/lire-outbox.ts src/pages/admin/outbox.astro src/pages/api/admin/outbox tests
git commit -m "Ajoute la consultation de la boîte d'envoi de test"
```

---

### Tâche 12 : contenu, référencement et dépendances (points reportés du plan 1)

**Fichiers :**
- Créer :
  - `src/integrations/verifier-evenement.ts`
  - `src/pages/robots.txt.ts`
  - `tests/unit/verifier-evenement.test.ts`
- Modifier : `astro.config.mjs`, `src/lib/event.ts`, `src/lib/theme.ts`, `src/layouts/Base.astro`, `package.json`, `package-lock.json`
- Tests : `tests/unit/event.test.ts`, `tests/unit/theme.test.ts`, `tests/e2e/pages.spec.ts`

**Interfaces :**
- Consomme : `parseEvent`, `EventConfigError` (`event.ts`).
- Produit :
  - `verifierEvenement(racine = 'evenement'): string[]` : la liste des problèmes, vide si le contenu est valide ;
  - `verifierEvenementIntegration(): AstroIntegration`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
// verifier-evenement.test.ts
test('exemple fourni : aucun problème', () => expect(verifierEvenement('evenement')).toEqual([]));
test('contenu invalide : problèmes lisibles', () => {
  const d = mkdtempSync(join(tmpdir(), 'ev-'));
  mkdirSync(join(d, 'photos'));
  writeFileSync(join(d, 'evenement.yaml'), 'site: {}\n');
  expect(verifierEvenement(d).length).toBeGreaterThan(0);
});

// event.test.ts : `base` et `problemsOf` existent déjà dans ce fichier
test('hébergement : lat sans lng refusé', () => {
  expect(problemsOf(base + '\ninfos:\n  hebergements:\n    - { nom: "Hôtel", lat: 44.8 }\n'))
    .toContain('infos.hebergements[0] : lat et lng vont ensemble');
});
test('hébergement : lat hors bornes refusé', () => {
  expect(problemsOf(base + '\ninfos:\n  hebergements:\n    - { nom: "Hôtel", lat: 120, lng: 0 }\n')
    .some((p) => p.startsWith('infos.hebergements[0].lat :'))).toBe(true);
});
test('police : caractères spéciaux refusés', () => {
  expect(problemsOf(base + `\ntheme:\n  polices: { titres: "Caveat';x" }\n`))
    .toContain('theme.polices.titres : lettres, chiffres et espaces uniquement');
});

// theme.test.ts : REMPLACER le test existant « fontsHref construit l’URL Google Fonts », qui attend Open Sans avec graisses
test('fontsHref : graisses connues pour Caveat et Nunito, aucune imposée sinon, espaces encodés', () => {
  expect(fontsHref({ couleurs: {}, polices: {} }))
    .toBe('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Nunito:wght@400;600;800&display=swap');
  expect(fontsHref({ couleurs: {}, polices: { titres: 'Great Vibes', texte: 'Open Sans' } }))
    .toBe('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Open+Sans&display=swap');
});
```

> `base` ne contient ni `infos:` ni `theme:` : l'ajout ne duplique aucune clé. `astro check` vérifie aussi les types des tests, d'où les objets `Theme` complets.

E2E (`pages.spec.ts`) :

```ts
test('robots.txt et hreflang absolus', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain('Disallow: /api/');
  await page.goto('/fr/programme');
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'http://localhost:4321/en/programme');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', 'http://localhost:4321/');
});
```

> `http://localhost:4321` est la valeur de `site.url_publique` dans l'exemple.

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `npx vitest run tests/unit/verifier-evenement.test.ts tests/unit/event.test.ts tests/unit/theme.test.ts`
Attendu : ÉCHEC.

- [ ] **Étape 3 : implémenter**

- **`verifier-evenement.ts` :**
  - lire `<racine>/evenement.yaml` et la liste de `<racine>/photos`, au format `photos/<fichier>` ;
  - appeler `parseEvent` et renvoyer `e.problems` pour une `EventConfigError`, ou `[]` si le contenu est valide ;
  - l'intégration utilise le crochet `astro:config:setup` (`{ command, logger }`) :
    - en `build`, s'il y a des problèmes, lever `new Error('Contenu de l’événement invalide :\n- ' + problemes.join('\n- '))` ;
    - sinon, `logger.warn` pour chaque problème, car la page d'erreur du middleware reste visible en développement.
- **`astro.config.mjs` :** `integrations: [verifierEvenementIntegration()]`.
- **`event.ts` :**
  - noms de police : `z.string().regex(/^[A-Za-z0-9 ]+$/, 'lettres, chiffres et espaces uniquement')` ;
  - hébergements : `lat` entre −90 et 90 et `lng` entre −180 et 180, plus un `superRefine` qui signale « lat et lng vont ensemble » si une seule des deux coordonnées est fournie.
- **`theme.ts` :**
  - `POIDS = { Caveat: '500;700', Nunito: '400;600;800' }` ;
  - une police absente de `POIDS` est demandée sans `:wght@` ;
  - les espaces du nom deviennent `+`.
- **`Base.astro` :**
  - les liens `hreflang` utilisent `urlBase` (`site.url_publique` sans `/` final) suivi du chemin ;
  - ajouter `hreflang="x-default"` qui pointe vers `${urlBase}/`.
- **`robots.txt.ts` :** `GET` renvoie `User-agent: *\nDisallow: /admin\nDisallow: /api/\n` en `text/plain`.
- **Dépendances :**
  1. lancer `npm audit fix` (**sans** `--force`) ;
  2. remplacer chaque `"latest"` de `devDependencies` par `^<version installée>`, lue avec `npm ls --depth=0` ;
  3. relancer `npm audit --omit=dev` et noter le résultat. Une vulnérabilité qui exige `--force` est notée dans le document de suivi (tâche 13), sans être forcée.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `npx vitest run && npx astro check && npm run build && npx playwright test`
Attendu : tout passe.

Puis vérifier l'échec de compilation : remplacer temporairement `lieu: domaine` par `lieu: inexistant` dans `evenement/evenement.yaml`, puis lancer `npm run build`. Attendu : échec avec un message qui nomme `moments[…].lieu`. **Restaurer le fichier** (`git checkout evenement/evenement.yaml`).

- [ ] **Étape 5 : commit**

```bash
git add astro.config.mjs src tests package.json package-lock.json
git commit -m "Vérifie le contenu à la compilation et améliore le référencement"
```

---

### Tâche 13 : mise en ligne (base distante, compilation Vercel, guide)

**Fichiers :**
- Créer : `DEPLOIEMENT.md`, `docs/superpowers/plans/2026-10-21-suivi-plan-3.md`
- Modifier : `src/lib/db.ts`, `README.md`, `.env.example`, `evenement/LISEZMOI.md`
- Tests : `tests/unit/db.test.ts`

**Interfaces :**
- Produit : `clientPour(url: string): 'natif' | 'web'`. Il renvoie `'natif'` pour `file:…` et `:memory:`, `'web'` pour tout le reste (`libsql://`, `https://`).

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
test('clientPour', () => {
  expect(clientPour('file:.data/local.db')).toBe('natif');
  expect(clientPour(':memory:')).toBe('natif');
  expect(clientPour('libsql://site-coco.turso.io')).toBe('web');
  expect(clientPour('https://site-coco.turso.io')).toBe('web');
});
```

- [ ] **Étape 2 : vérifier que le test échoue**

Lancer : `npx vitest run tests/unit/db.test.ts`
Attendu : ÉCHEC.

- [ ] **Étape 3 : implémenter**

- **`getDb` :** si `VERCEL` est définie et `DATABASE_URL` absente, lever `new Error('En ligne, DATABASE_URL est obligatoire (base Turso).')`. Sans cette vérification, le repli sur `file:.data/local.db` échoue sur un système de fichiers en lecture seule, avec une erreur obscure.
- **`openDb` :** importer dynamiquement `@libsql/client` (natif) ou `@libsql/client/web` selon `clientPour(url)`. En ligne, le module natif n'est ainsi jamais chargé. Créer le schéma en un seul aller-retour : `client.batch(SCHEMA, 'write')`.
- **`.env.example` :** dans un commentaire, lister les variables à définir sur Vercel.
- **`DEPLOIEMENT.md`,** guide pas à pas, phrases courtes :
  1. **Turso :** créer un compte gratuit, une base, puis copier l'URL `libsql://…` et un jeton.
  2. **E-mails :**
     - Brevo : créer un compte, vérifier l'adresse d'expédition, créer une clé API, et rappeler la limite DMARC des adresses Gmail ou Outlook ;
     - ou Resend, avec un domaine vérifié.
  3. **`site.url_publique` :** la mettre à jour avec l'adresse Vercel (`https://<projet>.vercel.app`), puis faire un commit.
  4. **Vercel :** importer le dépôt GitHub. Préréglage « Astro », commande `npm run build`, version de Node **22.x** dans les réglages du projet.
  5. **Variables d'environnement,** dans un tableau Nom, Valeur, Obligatoire :
     - `DEPLOY_TARGET=vercel` ;
     - `DATABASE_URL`, `DATABASE_TOKEN` ;
     - `MAIL_MODE=api`, `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM` ;
     - `ADMIN_PASSWORD` ;
     - `SESSION_SECRET` (commande de génération) ;
     - `RSVP_LIMITE` (facultatif).
  6. **Déployer.**
  7. **Liste de vérification après le déploiement :**
     - répondre avec sa propre adresse, puis recevoir l'e-mail et le PDF ;
     - se connecter à `/admin` ;
     - télécharger le CSV et les deux PDF ;
     - masquer un message ;
     - vérifier le bandeau de configuration, qui doit être absent ;
     - vérifier que les photos s'affichent sur `/fr/histoire` et `/fr/programme` (route `/_image`).
  8. **Offres gratuites :** les limites citées sont à revérifier au moment de la mise en ligne.
  9. **Dépannage :**
     - l'erreur « En ligne, DATABASE_URL est obligatoire » ;
     - changer `ADMIN_PASSWORD` ou `SESSION_SECRET` déconnecte toutes les sessions ;
     - la page d'erreur de contenu ;
     - le bandeau de configuration des e-mails ;
     - « Trop de tentatives ».
- **`README.md` :**
  - section « Espace organisateur » : adresse, variables, onglets ;
  - procédure « Nouvel événement » : copier le projet, remplacer `evenement/`, créer une nouvelle base Turso, déployer ;
  - lien vers `DEPLOIEMENT.md`.
- **`evenement/LISEZMOI.md` :** préciser que la date limite est évaluée dans le décalage horaire de `date_debut`. Si un changement d'heure tombe entre les deux dates, la clôture peut se décaler d'une heure : choisir une date limite qui laisse de la marge.

- [ ] **Étape 4 : vérifier**

Lancer : `npx vitest run && npx astro check && npm run build && npx playwright test`
Attendu : tout passe.

Puis la compilation pour Vercel, en PowerShell : `$env:DEPLOY_TARGET='vercel'; npm run build; Remove-Item Env:DEPLOY_TARGET`
- **Attendu :** compilation réussie, `.vercel/output/config.json` présent, et un dossier de fonction sous `.vercel/output/functions/`.
- **À noter :** la taille du dossier de fonction (`Get-ChildItem -Recurse … | Measure-Object Length -Sum`), si `libsql` (natif) y figure, et si la route `_image` figure dans `.vercel/output/config.json`.
- **Si la compilation Vercel échoue sous Windows** (liens symboliques, droits) : noter l'erreur exacte dans le suivi. Vercel compile sous Linux, ce n'est donc pas bloquant ; ne pas contourner en modifiant l'adaptateur.

- [ ] **Étape 5 : rédiger le suivi et faire le commit**

`docs/superpowers/plans/2026-10-21-suivi-plan-3.md` contient :
- les décisions prises pendant la réalisation ;
- le constat sur `Astro.clientAddress` (point anti-spam du plan 2 résolu sans code) ;
- le résultat de `npm audit` ;
- la taille de la fonction Vercel ;
- les points restants : améliorations mineures du plan 1, et tout ce qui a été reporté.

```bash
git add src/lib/db.ts tests/unit/db.test.ts DEPLOIEMENT.md README.md .env.example evenement/LISEZMOI.md docs/superpowers/plans/2026-10-21-suivi-plan-3.md
git commit -m "Prépare la mise en ligne et rédige le guide de déploiement"
```

---

## Vérification finale

- `npx vitest run` : tous les tests passent.
- `npx astro check` : 0 erreur.
- `npm run build` : réussit, et échoue avec un message clair si `evenement.yaml` est invalide.
- `npx playwright test` : les deux projets passent, y compris `admin.spec.ts`.
- Contrôle visuel dans le navigateur :
  - connexion, tableau de bord, livre d'or et boîte d'envoi, sur ordinateur et à 360 px ;
  - aperçu de la liste PDF et de toutes les invitations.
- Recherche, avant chaque commit, des mots interdits dans les messages et les fichiers ajoutés.

## Suite

Après ce plan, il reste :
- le déploiement réel par l'organisateur, en suivant `DEPLOIEMENT.md` ;
- les améliorations mineures listées dans le suivi du plan 1 (menu fermé par Échap, message après l'événement, tests supplémentaires).
