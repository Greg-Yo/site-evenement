# Site d'événement réutilisable : spécification

*Date : 12/10/2026 · Statut : validée*
*Maquettes de référence : `docs/maquettes/` (style « Soleil », à ouvrir dans un navigateur)*

## 1. Objectif

Un **modèle de site web réutilisable** pour un événement heureux (anniversaire, mariage, fête…). Pour chaque événement, l'organisateur remplace le contenu (textes, photos, lieux, dates) **sans toucher au code**.

Le site :
- présente l'événement : histoire, photos, programme, lieux sur une carte, infos pratiques ;
- recueille les confirmations de présence (RSVP) ;
- envoie à chaque invité qui confirme un **e-mail avec une invitation PDF personnalisée** ;
- donne à l'organisateur un **espace admin** : liste des réponses, export, PDF de la liste des confirmés, modération du livre d'or.

**Critères de réussite**

- Un invité sur téléphone trouve en moins d'une minute la date, le lieu et l'itinéraire, et confirme en moins de deux minutes.
- L'organisateur crée le site d'un nouvel événement en modifiant uniquement le dossier `evenement/`.
- Le site tourne entièrement sur la machine de l'organisateur, sans aucun compte externe. Il passe ensuite en ligne gratuitement, sans réécriture.

## 2. Décisions prises

| Sujet | Décision |
|---|---|
| Langues | FR et EN. Langue choisie automatiquement selon le navigateur, bouton FR \| EN pour changer |
| Accès | Site public : toute personne qui a le lien voit tout |
| Réutilisation | Un déploiement par événement ; tout le contenu dans `evenement/` |
| Hébergement | Local pour les tests, puis gratuit et sans serveur à gérer (Vercel + Turso + service d'e-mail) |
| Style | « Soleil » : orange `#ec5e27`, milk `#fdfdf1`, brun `#3a2419`, pêche `#fbd7c2` ; titres Caveat (manuscrite), texte Nunito ; photos en polaroïd, transitions en vague |
| Ton | Tutoiement dans les textes d'exemple ; tous les textes sont modifiables dans `evenement/` |
| Formulaire RSVP | Présence (oui/non), nom, e-mail, téléphone facultatif, accompagnants (prénom + nom), choix des moments, message libre |
| Livre d'or | Messages saisis dans le RSVP, affichés immédiatement et publiquement ; l'admin peut les masquer ou les supprimer |
| PDF | Invitation personnalisée A5 (jointe à l'e-mail) + liste des confirmés A4 (admin) |
| Admin | Protégée par un mot de passe unique ; liste, recherche, filtres, export CSV, PDF |

## 3. Pages

Les 5 pages publiques existent en `/fr/...` et `/en/...`.

1. **Accueil**
   - grande photo en polaroïd, titre, date et lieu, bouton « Je viens ! » ;
   - compte à rebours ;
   - aperçu de l'histoire ;
   - aperçu du programme (3 cartes au plus) ;
   - bande de souvenirs en polaroïd ;
   - bloc « Tu viens ? » avec un extrait du livre d'or.
2. **Notre histoire**
   - frise chronologique de chapitres (année, titre, texte, photo) ;
   - galerie en mosaïque, avec agrandissement et défilement au clic (visionneuse plein écran).
3. **Programme & lieux**
   - liste des moments : heure, titre, lieu, adresse, photo, boutons Google Maps et Waze ;
   - carte interactive Leaflet + OpenStreetMap : lieux en orange et numérotés, hébergements en brun ;
   - cliquer sur un moment centre la carte sur son lieu ;
   - sur téléphone, la carte passe sous la liste.
4. **Infos pratiques**
   - pastilles de navigation interne ;
   - hébergements (cartes avec étiquette, distance, prix indicatif, lien) ;
   - encadrés Tenue (avec palette de couleurs), Cadeaux (lien vers la cagnotte), Accès et parking, Contact ;
   - FAQ en questions dépliables.

   Toutes les rubriques sont facultatives : une rubrique vide n'est pas affichée.
5. **RSVP & Livre d'or**
   - formulaire à gauche, livre d'or à droite (dessous sur téléphone) ;
   - après l'envoi, écran « Merci ! » ;
   - après la date limite, le formulaire est remplacé par un message « Les réponses sont closes ».
6. **Admin** (`/admin`, non lié depuis le site)
   - connexion ;
   - onglet Réponses ;
   - onglet Livre d'or.

**Éléments communs**
- barre de navigation orange avec le bouton FR \| EN ; menu repliable (« hamburger ») sur téléphone ;
- pied de page brun avec le contact.

**Racine `/`**
- redirige vers `/fr/` ou `/en/` selon le cookie `lang`, à défaut l'en-tête `Accept-Language`, à défaut `fr` ;
- le bouton FR \| EN enregistre le cookie `lang`.

## 4. Architecture

```
Navigateur ──► Astro (rendu serveur) ──► base libSQL (fichier local ou Turso)
                 │                     └► service d'e-mail (local : boîte d'envoi fictive ; en ligne : API)
                 ├─ pages publiques (contenu lu dans evenement/)
                 ├─ /api/rsvp, /api/rsvp/[token]
                 └─ /admin/* (session par cookie signé)
```

- **Framework :** Astro (dernière version stable au démarrage du développement) en mode `server`. Adaptateur `@astrojs/node` en local, `@astrojs/vercel` en ligne. L'adaptateur est choisi par une variable d'environnement.
- **Langage :** TypeScript.
- **Styles :** CSS natif. Les couleurs et polices sont des variables CSS générées depuis `evenement/evenement.yaml`.
- **JavaScript côté navigateur :** minimal et sans framework (compte à rebours, carte, visionneuse photo, formulaire, menu).

### 4.1 Découpage en modules

| Module | Rôle | Dépend de |
|---|---|---|
| `src/lib/event.ts` | Charge et valide `evenement/evenement.yaml` avec un schéma zod ; expose un objet typé et la fonction `t(champ, langue)` | zod, yaml |
| `src/lib/i18n.ts` | Textes fixes de l'interface (boutons, libellés, erreurs) en FR et EN ; détection de la langue | — |
| `src/lib/db.ts` | Connexion libSQL, création des tables au démarrage, requêtes RSVP et livre d'or | @libsql/client |
| `src/lib/rsvp.ts` | Validation des données du formulaire, règles métier (doublons, date limite), orchestration enregistrement → PDF → e-mail | db, pdf, mail |
| `src/lib/pdf/invitation.ts` | Génère l'invitation A5 personnalisée | pdf-lib, @pdf-lib/fontkit, qrcode, sharp, event |
| `src/lib/pdf/liste.ts` | Génère la liste A4 des confirmés | pdf-lib, @pdf-lib/fontkit, event |
| `src/lib/mail/index.ts` | Interface `envoyer(message)` avec deux implémentations : `outbox` (local) et `api` (en ligne) | — |
| `src/lib/mail/templates.ts` | Gabarit HTML et texte de l'e-mail de confirmation, FR et EN | event |
| `src/lib/auth.ts` | Vérification du mot de passe admin, cookie de session signé (HMAC), limitation des tentatives | node:crypto |
| `src/lib/csv.ts` | Export CSV | — |

Chaque module est testable isolément. Les pages Astro ne font qu'afficher et appeler ces modules.

## 5. Contenu de l'événement (`evenement/`)

```
evenement/
  evenement.yaml      # tout le contenu, en FR et EN
  photos/             # photos référencées dans le YAML
```

Structure de `evenement.yaml`. Chaque texte affiché existe en `fr` et `en` ; si `en` manque, le texte `fr` est affiché.

```yaml
site:
  titre: { fr: "Coco a 40 ans", en: "Coco turns 40" }
  url_publique: "https://…"          # sert au QR code et aux liens des e-mails
  contact: { nom: "Julie", email: "contact@…", telephone: "06 …" }
theme:                               # facultatif ; valeurs « Soleil » par défaut
  couleurs: { principale: "#ec5e27", fond: "#fdfdf1", texte: "#3a2419", douce: "#fbd7c2" }
  polices: { titres: "Caveat", texte: "Nunito" }
evenement:
  date_debut: "2027-06-14T16:00:00+02:00"   # sert au compte à rebours
  date_limite_rsvp: "2027-05-01"
  lieu_court: { fr: "Bordeaux", en: "Bordeaux" }
accueil:
  accroche: { fr: "On fait la fête !", en: "Let's party!" }
  photo_principale: photos/hero.jpg
  photo_secondaire: photos/toast.jpg
  legende_photo: { fr: "la bande, été 2024", en: "the gang, summer 2024" }
histoire:
  intro: { fr: "…", en: "…" }
  chapitres:
    - { annee: "1987", titre: {fr: …, en: …}, texte: {fr: …, en: …}, photo: photos/1987.jpg, legende: {fr: …, en: …} }
galerie: [ { photo: photos/g1.jpg, legende: {fr: …, en: …} } ]
lieux:
  - { id: domaine, nom: "Domaine des Tilleuls", adresse: "…", lat: 44.8378, lng: -0.58 }
moments:                              # = les cases à cocher du RSVP
  - { id: accueil, heure: "16:00", jour: { fr: "", en: "" }, titre: {fr: "Accueil", en: "Welcome"},
      description: {fr: …, en: …}, lieu: domaine, photo: photos/accueil.jpg }
infos:
  hebergements: [ { nom, etiquette:{fr,en}, distance, prix, lien, photo, lat, lng } ]
  tenue: { texte: {fr,en}, couleurs: ["#ec5e27", …] }
  cadeaux: { texte: {fr,en}, lien_cagnotte: "https://…" }
  acces: { texte: {fr,en} }
  faq: [ { question: {fr,en}, reponse: {fr,en} } ]
rsvp:
  titre: { fr: "Tu viens ?", en: "Are you coming?" }
  message_merci: { fr: "…", en: "…" }
email:
  expediteur_nom: "Coco a 40 ans"
  objet: { fr: "🎉 Ton invitation pour les 40 ans de Coco", en: "🎉 Your invitation to Coco's 40th" }
```

- Le fichier est **validé au démarrage**. En cas d'erreur, le site affiche un message clair qui nomme le champ (par exemple « `moments[2].lieu` : le lieu “salle” n'existe pas dans `lieux` »).
- Le projet fournit un `evenement/` d'exemple complet (Coco, Bordeaux, photos Unsplash libres de droits) et un fichier `evenement/LISEZMOI.md` qui explique chaque champ.

## 6. Données

Une base libSQL :
- **en local :** le fichier `.data/local.db`, créé automatiquement ;
- **en ligne :** Turso, avec les variables `DATABASE_URL` et `DATABASE_TOKEN`.

```sql
CREATE TABLE reponses (
  id            INTEGER PRIMARY KEY,
  jeton         TEXT NOT NULL UNIQUE,      -- 32 octets aléatoires (base64url) : lien « modifier ma réponse »
  langue        TEXT NOT NULL,             -- 'fr' | 'en'
  vient         INTEGER NOT NULL,          -- 1 = oui, 0 = non
  nom           TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telephone     TEXT,
  accompagnants TEXT NOT NULL DEFAULT '[]',-- JSON : ["Léo Martin", …]
  moments       TEXT NOT NULL DEFAULT '[]',-- JSON : identifiants des moments
  message       TEXT,                      -- livre d'or
  message_masque INTEGER NOT NULL DEFAULT 0,
  email_envoye  INTEGER NOT NULL DEFAULT 0,
  cree_le       TEXT NOT NULL,
  modifie_le    TEXT NOT NULL
);
```

```sql
CREATE TABLE limites (               -- anti-spam et anti-force brute
  cle        TEXT NOT NULL,          -- ex. 'rsvp:203.0.113.4' ou 'login:203.0.113.4'
  horodatage TEXT NOT NULL
);
CREATE INDEX limites_cle ON limites (cle, horodatage);
```

Les entrées de plus de 24 h sont purgées à chaque vérification.

**Nombre de personnes d'une réponse :** 1 + nombre d'accompagnants si `vient = 1`, sinon 0.

## 7. Parcours RSVP

1. L'invité remplit le formulaire. Côté navigateur :
   - choisir « Je ne pourrai pas » masque les accompagnants et les moments ;
   - un bouton ajoute ou retire des accompagnants.
2. Envoi `POST /api/rsvp`, qui fonctionne aussi sans JavaScript : le formulaire HTML classique affiche alors 3 champs d'accompagnant vides, et les champs vides sont ignorés. Le serveur valide :
   - nom de 2 à 100 caractères ;
   - e-mail valide ;
   - téléphone facultatif, 30 caractères au plus ;
   - 10 accompagnants au plus, chacun de 1 à 100 caractères ;
   - moments appartenant à la liste du YAML, au moins un si l'invité vient ;
   - message de 1 000 caractères au plus ;
   - date limite non dépassée.
3. **Protection contre le spam :**
   - un champ piège invisible (s'il est rempli, la réponse est ignorée en silence) ;
   - 5 envois au plus par adresse IP toutes les 10 minutes. Le compteur est stocké dans une table `limites` de la base, et non en mémoire, car en ligne chaque requête peut être servie par une instance différente, dont la mémoire n'est pas partagée.
4. **E-mail déjà utilisé :** on ne crée pas de doublon et on n'écrase rien. Le serveur renvoie le lien « modifier ma réponse » à cette adresse, et la page affiche : « Tu as déjà répondu avec cette adresse : on vient de t'envoyer le lien pour modifier ta réponse. » Personne ne peut donc modifier la réponse d'un autre en connaissant seulement son e-mail.
5. **Enregistrement,** puis :
   - **si l'invité vient :** génération de l'invitation PDF et envoi de l'e-mail de confirmation, pièce jointe comprise ;
   - **sinon :** e-mail court de remerciement, sans PDF.

   Si l'envoi échoue, la réponse reste enregistrée (`email_envoye = 0`), la page dit « Réponse enregistrée, l'e-mail arrivera un peu plus tard », et l'admin peut renvoyer l'e-mail.
6. **Écran « Merci [prénom] ! » :** il rappelle le nombre de personnes et l'adresse e-mail utilisée.
7. **Modifier sa réponse :** le lien `/{langue}/rsvp/modifier?jeton=…` ouvre le formulaire prérempli. L'enregistrement renvoie un e-mail mis à jour.

## 8. E-mails

**Envoi**

- **En local** (`MAIL_MODE=outbox`, par défaut) : aucun envoi réel. Chaque e-mail est enregistré dans `.data/outbox/` (HTML + PDF) et consultable depuis l'admin, onglet « Boîte d'envoi (test) », visible seulement en local.
- **En ligne** (`MAIL_MODE=api`) : envoi par l'API du fournisseur choisi. Clé dans `MAIL_API_KEY`, expéditeur dans `MAIL_FROM`. Deux fournisseurs sont prévus derrière la même interface :
  - **Brevo** (recommandé si l'on n'a pas de nom de domaine) : 300 e-mails par jour gratuits, expéditeur vérifié par simple adresse e-mail. Limite : avec une adresse Gmail ou Outlook comme expéditeur, certains messages risquent d'arriver en courrier indésirable, car ces fournisseurs n'autorisent pas d'autres services à envoyer en leur nom (règles DMARC). Les invités sont donc invités, sur l'écran « Merci ! », à vérifier leurs indésirables ;
  - **Resend** (si l'on possède un nom de domaine, environ 10 € par an) : 3 000 e-mails par mois et 100 par jour gratuits, meilleure délivrabilité, mais un domaine vérifié est **obligatoire** pour écrire à d'autres adresses que la sienne.

  Les offres gratuites citées sont celles connues à la date de cette spécification ; elles seront revérifiées au moment de la mise en ligne.

  *Correction par rapport à la discussion initiale :* Resend seul ne suffit pas sans nom de domaine, d'où Brevo par défaut.

**Contenu**

- Gabarit HTML compatible avec les messageries (mise en page en tableaux, styles en ligne) et version texte brut. Contenu selon les maquettes :
  - bandeau orange et photo ;
  - récapitulatif : date, personnes, moments avec lieux et horaires ;
  - boutons « Voir le programme et la carte » et « Modifier ma réponse » ;
  - PDF en pièce jointe.
- Langue = celle de la page depuis laquelle l'invité a répondu.

## 9. PDF

Générés côté serveur avec `pdf-lib`, sans dépendance à un navigateur.

- **Polices :** Caveat et Nunito sont incluses dans le projet au format TTF (licence SIL Open Font License) et intégrées au PDF grâce à `@pdf-lib/fontkit`, nécessaire pour les polices personnalisées et les accents.
- **Photos :** pdf-lib n'accepte que le JPEG et le PNG. La photo est donc convertie en JPEG de 1 200 px de large au plus avec `sharp` (déjà utilisé par Astro), quel que soit son format dans `evenement/photos/`.
- **Performance :** pour « Toutes les invitations », la photo et les polices ne sont intégrées qu'une seule fois dans le document, pour rester sous la limite de durée d'exécution de l'hébergement gratuit (10 s chez Vercel).

- **Invitation (A5, une page) :**
  - bandeau « Invitation personnelle » et titre ;
  - photo principale en polaroïd ;
  - nom de l'invité et de ses accompagnants ;
  - phrase d'invitation ;
  - moments choisis avec heure, lieu et adresse ;
  - QR code (bibliothèque `qrcode`) vers `url_publique/{langue}/programme`.

  Nom du fichier : `Invitation-Prenom-Nom.pdf`.
- **Liste des confirmés (A4, plusieurs pages si besoin) :**
  - en-tête avec titre, date de l'événement, date d'édition, totaux (personnes et foyers) ;
  - tableau trié par nom : case à cocher, nom, accompagnants, e-mail, téléphone, nombre de personnes, moments (abrégés, avec légende) ;
  - totaux par moment ;
  - en-tête de tableau répété sur chaque page.

  Seules les réponses « vient » apparaissent.
- **Toutes les invitations :** un seul PDF qui assemble les invitations de tous les confirmés, une par page.

## 10. Admin

**Connexion**
- Le mot de passe se trouve dans la variable `ADMIN_PASSWORD`.
- Une fois connecté, l'organisateur reçoit un cookie `HttpOnly`, `Secure` en ligne, `SameSite=Lax`, signé par HMAC avec `SESSION_SECRET`, valable 7 jours.
- Après 5 échecs en 15 minutes depuis une même adresse IP, la connexion est bloquée 15 minutes (compteur dans la table `limites`).
- Le mot de passe est comparé en temps constant (`crypto.timingSafeEqual`, sur les empreintes SHA-256 des deux valeurs), pour ne rien révéler par la durée de la vérification.
- Toutes les routes `/admin/*` et `/api/admin/*` vérifient la session.
- Les actions qui modifient des données utilisent `POST` et vérifient l'en-tête `Origin` (protection contre la falsification de requêtes, dite CSRF).

**Onglet Réponses**
- **Compteurs :** réponses, foyers confirmés, personnes attendues, refus, personnes par moment.
- **Recherche :** par nom ou e-mail.
- **Filtres :** présence, moment.
- **Tableau :** voir les maquettes. Par ligne : PDF d'invitation, renvoyer l'e-mail, modifier (même formulaire que l'invité), supprimer (avec confirmation).
- **Export CSV** : séparateur `;`, encodage UTF-8 avec BOM pour une ouverture directe dans Excel en français. Une ligne par réponse, avec les colonnes nom, e-mail, téléphone, langue, présence, nombre de personnes, accompagnants, une colonne oui/non par moment, message, date.
- **Boutons :** « PDF liste des confirmés » et « Toutes les invitations (PDF) ».

**Onglet Livre d'or :** masquer, réafficher ou supprimer le message (la réponse elle-même est conservée).

## 11. Accessibilité et qualité

- **Contraste :** l'orange `#ec5e27` et le milk `#fdfdf1` n'atteignent ensemble que **3,31:1**. C'est suffisant pour le « grand texte » (24 px et plus, ou 18,66 px et plus en gras), mais pas pour le texte courant (4,5:1 requis). Règles :
  - **texte milk sur fond orange :** titres et boutons uniquement en grand ou en gras ; le texte courant de plus petite taille est posé sur l'orange foncé `#c94412` (4,75:1) ;
  - **texte orange sur fond milk :** l'orange `#ec5e27` est réservé aux grands titres (Caveat) et aux grands chiffres ; liens, prix et petits libellés orange utilisent `#c94412` ;
  - le brun `#3a2419` sur milk (14,2:1) ou sur pêche (10,8:1), et le brun clair `#6b4a39` sur milk (7,7:1), conviennent à tout le texte.

  Partout, l'objectif est le niveau WCAG AA. L'orange foncé est dérivé automatiquement de la couleur principale définie dans `theme`, en l'assombrissant jusqu'à atteindre 4,5:1.
- Navigation complète au clavier, contour visible sur l'élément actif, libellés de formulaire associés à leurs champs, attributs `alt` sur les photos, animations réduites si l'utilisateur l'a demandé (`prefers-reduced-motion`).
- Pensé d'abord pour le téléphone : aucun défilement horizontal à 360 px de large.
- Photos redimensionnées et converties en WebP par Astro (`astro:assets`), chargées à la demande.
- Carte : Leaflet et les tuiles OpenStreetMap ne sont chargés que sur la page Programme.

## 12. Tests

- **Unitaires (Vitest) :**
  - validation du YAML : exemple valide, erreurs lisibles ;
  - validation RSVP ;
  - règles de doublon et de date limite ;
  - calcul des totaux ;
  - CSV (BOM, échappement, colonnes de moments) ;
  - signature et vérification de session ;
  - génération des deux PDF : le fichier est valide et contient le nom de l'invité.
- **Intégration :** `POST /api/rsvp` sur une base temporaire en mode `outbox`, puis vérification de la ligne en base et du fichier d'e-mail.
- **Bout en bout (Playwright) :** RSVP complet sur téléphone ; changement de langue ; connexion admin, export CSV et téléchargement du PDF de la liste ; masquage d'un message du livre d'or.

## 13. Exécution locale et mise en ligne

- **En local :**
  - `npm install` puis `npm run dev` ;
  - le fichier `.env.example` fournit les valeurs par défaut (`MAIL_MODE=outbox`, base locale, `ADMIN_PASSWORD` à définir) ;
  - aucun compte externe n'est nécessaire.
- **En ligne,** guide pas à pas dans `DEPLOIEMENT.md` :
  1. créer une base Turso gratuite ;
  2. créer un compte Brevo (ou Resend avec un domaine) ;
  3. importer le projet dans Vercel ;
  4. renseigner les variables d'environnement ;
  5. déployer.
- **Nouvel événement :**
  1. copier le projet ;
  2. remplacer `evenement/` ;
  3. créer une nouvelle base ;
  4. déployer.

  Procédure décrite dans le `README.md`.

## 14. Hors périmètre (pour l'instant)

- Liens personnels par invité, ou liste d'invités saisie à l'avance.
- Éditeur de contenu dans l'admin (le contenu se modifie dans `evenement/`).
- Plusieurs événements dans un même déploiement.
- Plusieurs comptes administrateurs.
- Questions supplémentaires dans le RSVP (régime alimentaire, enfants, hébergement).
- Rappels automatiques par e-mail avant l'événement.
