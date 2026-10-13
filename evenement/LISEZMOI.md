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
