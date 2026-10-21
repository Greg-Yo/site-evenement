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

## Tests

```bash
npm test            # tests unitaires
npm run test:e2e    # tests dans le navigateur
```

Projet en cours de développement.
