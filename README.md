# Site d'événement

Modèle de site web réutilisable pour un événement heureux (anniversaire, mariage, fête) : présentation, histoire et photos, programme et carte des lieux, infos pratiques, confirmation de présence avec invitation PDF par e-mail, livre d'or et espace organisateur.

- Spécification : [docs/superpowers/specs/2026-10-12-site-evenement-design.md](docs/superpowers/specs/2026-10-12-site-evenement-design.md)
- Maquettes : [docs/maquettes/](docs/maquettes/) (à ouvrir dans un navigateur)

## Démarrer en local

Prérequis : [Node.js](https://nodejs.org) 22 ou plus.

```bash
npm install
npm run dev
```

Ouvrir http://localhost:4321. Le contenu se modifie dans [`evenement/`](evenement/LISEZMOI.md).

### Réponses et e-mails en local

Les réponses sont enregistrées dans `.data/local.db`. Aucun e-mail n'est réellement envoyé : chaque e-mail (avec l'invitation PDF) est rangé dans un dossier de `.data/outbox/` ; ouvrir `message.html` dans un navigateur pour le voir.

## Espace organisateur

Adresse : `/admin` (par exemple http://localhost:4321/admin en local).

Il faut définir deux variables, dans `.env` en local ou sur Vercel en ligne :
- `ADMIN_PASSWORD` : le mot de passe de connexion, 12 caractères au moins ;
- `SESSION_SECRET` : 32 caractères au moins (commande de génération dans [`.env.example`](.env.example)).

Sans elles, l'espace organisateur est désactivé, et la page de connexion l'explique.

Onglets :
- **Réponses** : statistiques, recherche et filtres, export CSV, PDF de la liste des confirmés et de toutes les invitations ; pour chaque réponse, renvoyer l'e-mail, modifier, supprimer ou télécharger l'invitation ;
- **Livre d'or** : masquer, réafficher ou supprimer un message ;
- **Boîte d'envoi (test)** : en local seulement, les e-mails qui auraient été envoyés.

## Mise en ligne

Le guide pas à pas est dans [DEPLOIEMENT.md](DEPLOIEMENT.md) : base Turso, e-mails Brevo ou Resend, hébergement Vercel.

## Nouvel événement

1. Copier le projet dans un nouveau dépôt GitHub.
2. Remplacer le contenu du dossier `evenement/` : `evenement.yaml` et les photos (voir [evenement/LISEZMOI.md](evenement/LISEZMOI.md)).
3. Créer une nouvelle base Turso : les réponses d'un événement ne doivent pas se mélanger avec celles d'un autre.
4. Déployer en suivant [DEPLOIEMENT.md](DEPLOIEMENT.md), avec un nouveau projet Vercel.

## Tests

```bash
npm test            # tests unitaires
npm run test:e2e    # tests dans le navigateur
```
