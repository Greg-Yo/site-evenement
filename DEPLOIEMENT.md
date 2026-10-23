# Mettre le site en ligne

Ce guide met le site en ligne sur Vercel, gratuitement. Il ne demande aucune connaissance en programmation. Comptez une heure environ.

Il faut trois services :
- **Turso** garde les réponses des invités (la base de données) ;
- **Brevo** ou **Resend** envoie les e-mails ;
- **Vercel** héberge le site.

Prérequis : le projet est sur GitHub, dans un dépôt à vous.

Gardez un fichier texte ouvert à côté : vous y noterez les valeurs à recopier dans Vercel (étape 5). Ne le partagez pas, et ne l'ajoutez pas au dépôt.

## 1. Turso (base de données)

1. Créez un compte gratuit sur [turso.tech](https://turso.tech).
2. Créez une base de données. Choisissez la région la plus proche de vos invités (par exemple en Europe).
3. Ouvrez la base. Copiez son URL : elle commence par `libsql://`. C'est `DATABASE_URL`.
4. Créez un jeton (« token ») avec les droits de lecture et d'écriture. Copiez-le : c'est `DATABASE_TOKEN`. Il ne s'affiche qu'une fois.

Les tables sont créées automatiquement à la première visite du site.

## 2. E-mails

Choisissez **un** des deux services.

### Brevo (le plus simple)

1. Créez un compte gratuit sur [brevo.com](https://www.brevo.com).
2. Ajoutez une adresse d'expédition (menu « Expéditeurs »). Brevo envoie un e-mail de confirmation : cliquez sur le lien. Cette adresse est `MAIL_FROM`.
3. Créez une clé API (menu « SMTP et API », onglet « Clés API »). Copiez-la : c'est `MAIL_API_KEY`.

**Attention aux adresses Gmail ou Outlook.** Une adresse `@gmail.com`, `@outlook.fr` ou `@hotmail.com` comme expéditeur pose problème. Ces messageries publient une règle DMARC : un e-mail envoyé en leur nom par un autre service peut être refusé, ou classé en indésirables. Brevo peut aussi remplacer l'adresse affichée. Le mieux est une adresse sur votre propre nom de domaine, authentifié dans Brevo (menu « Domaines »). Sinon, faites un essai avant d'envoyer le lien à vos invités.

### Resend (si vous avez un nom de domaine)

1. Créez un compte gratuit sur [resend.com](https://resend.com).
2. Ajoutez votre nom de domaine (menu « Domains »). Recopiez les enregistrements DNS indiqués chez votre registraire, puis attendez que Resend affiche « Verified ».
3. Créez une clé API (menu « API Keys »). C'est `MAIL_API_KEY`.
4. L'adresse d'expédition doit être sur ce domaine, par exemple `fete@mon-domaine.fr`. C'est `MAIL_FROM`.

Sans domaine vérifié, Resend n'envoie qu'à votre propre adresse : les invités ne recevraient rien.

## 3. L'adresse publique du site

L'adresse du site sera `https://<projet>.vercel.app`. Choisissez dès maintenant le nom du projet (minuscules, chiffres et tirets), par exemple `anniversaire-camille`.

1. Dans `evenement/evenement.yaml`, remplacez `site.url_publique` par cette adresse :
   ```yaml
   url_publique: "https://anniversaire-camille.vercel.app"
   ```
2. Faites un commit, puis envoyez-le sur GitHub.

Cette adresse sert aux liens des e-mails et au QR code de l'invitation. Si Vercel attribue une autre adresse (nom déjà pris), corrigez-la de la même façon après le déploiement.

## 4. Vercel (hébergement)

1. Créez un compte gratuit sur [vercel.com](https://vercel.com), avec votre compte GitHub.
2. Cliquez sur « Add New… », puis « Project ». Importez le dépôt GitHub du site.
3. Donnez au projet le nom choisi à l'étape 3.
4. Préréglage (« Framework Preset ») : **Astro**.
5. Commande de compilation (« Build Command ») : `npm run build`.
6. Ne cliquez pas encore sur « Deploy » : ajoutez d'abord les variables (étape 5).

Après la création du projet, vérifiez la version de Node : « Settings », puis « Build and Deployment », « Node.js Version » : **22.x**.

## 5. Variables d'environnement

Dans l'écran d'import (section « Environment Variables »), ou plus tard dans « Settings », puis « Environment Variables », ajoutez :

| Nom | Valeur | Obligatoire |
|---|---|---|
| `DEPLOY_TARGET` | `vercel` | Oui |
| `DATABASE_URL` | L'URL Turso (`libsql://…`) | Oui |
| `DATABASE_TOKEN` | Le jeton Turso | Oui |
| `MAIL_MODE` | `api` | Oui |
| `MAIL_PROVIDER` | `brevo` ou `resend` | Oui |
| `MAIL_API_KEY` | La clé API du service d'e-mails | Oui |
| `MAIL_FROM` | L'adresse d'expédition vérifiée | Oui |
| `ADMIN_PASSWORD` | Le mot de passe de l'espace organisateur, à inventer | Oui |
| `SESSION_SECRET` | Une suite aléatoire de 32 caractères au moins (voir ci-dessous) | Oui |
| `RSVP_LIMITE` | Nombre d'envois de formulaire autorisés par adresse IP toutes les 10 minutes (5 par défaut) | Non |

Pour générer `SESSION_SECRET`, lancez cette commande dans un terminal, sur votre ordinateur (Node.js installé) :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copiez la ligne affichée.

Choisissez un mot de passe long pour `ADMIN_PASSWORD`. L'espace organisateur contient les noms, e-mails et téléphones des invités.

Une variable modifiée plus tard ne s'applique qu'au déploiement suivant (« Deployments », puis « Redeploy »).

## 6. Déployer

Cliquez sur « Deploy ». La compilation dure quelques minutes.

Si `evenement.yaml` contient une erreur, la compilation échoue. Le journal de Vercel affiche alors « Contenu de l'événement invalide », suivi de la liste des problèmes. Corrigez-les, faites un commit, et Vercel recompile tout seul.

Ensuite, chaque commit envoyé sur GitHub met le site à jour automatiquement.

## 7. Vérifications après le déploiement

- [ ] Répondez au formulaire avec votre propre adresse, et un petit message pour le livre d'or. Vous recevez l'e-mail, avec l'invitation PDF en pièce jointe.
- [ ] Connectez-vous à `/admin` avec `ADMIN_PASSWORD`.
- [ ] Téléchargez le CSV, le PDF de la liste et le PDF de toutes les invitations.
- [ ] Dans « Livre d'or », masquez ce message, puis vérifiez qu'il a disparu du site.
- [ ] Vérifiez qu'aucun bandeau rouge de configuration n'apparaît en haut de l'admin.
- [ ] Vérifiez que les photos s'affichent sur `/fr/histoire` et `/fr/programme`.

Ensuite, supprimez votre réponse de test dans l'admin.

## 8. Offres gratuites

Les offres gratuites suffisent pour une fête de quelques centaines d'invités. Leurs limites changent souvent : **revérifiez-les sur le site de chaque service au moment de la mise en ligne.** Points à regarder :
- Brevo et Resend : nombre d'e-mails par jour et par mois ;
- Turso : taille de la base et nombre de lectures ;
- Vercel : l'offre « Hobby » est réservée à un usage personnel et non commercial.

## 9. Dépannage

**« En ligne, DATABASE_URL est obligatoire (base Turso). »**
La variable `DATABASE_URL` manque sur Vercel. Ajoutez-la (étape 5), avec `DATABASE_TOKEN`, puis redéployez.

**Tout le monde est déconnecté de l'admin.**
C'est normal après un changement de `ADMIN_PASSWORD` ou de `SESSION_SECRET` : toutes les sessions sont fermées. Reconnectez-vous avec le mot de passe actuel.

**Une page liste des erreurs de contenu.**
`evenement.yaml` ou une photo pose problème. La liste donne le nom exact du champ concerné. Corrigez-le en suivant [evenement/LISEZMOI.md](evenement/LISEZMOI.md), puis faites un commit.

**Un bandeau rouge parle des e-mails, en haut de l'admin.**
La configuration des e-mails est incomplète, et les e-mails ne partent pas. Le bandeau dit quoi corriger : `MAIL_MODE` doit valoir `api`, `MAIL_API_KEY` et `MAIL_FROM` doivent être remplis, `MAIL_PROVIDER` doit valoir `brevo` ou `resend`. Corrigez la variable, puis redéployez. Les invités déjà inscrits peuvent recevoir leur e-mail avec « Renvoyer l'e-mail », dans l'admin.

**« Trop de tentatives : réessayez dans 15 minutes. »**
Il y a eu 5 mots de passe erronés en 15 minutes depuis votre connexion. Attendez 15 minutes sans réessayer : chaque essai pendant le blocage le prolonge.

**L'admin dit qu'elle est désactivée.**
`ADMIN_PASSWORD` manque, ou `SESSION_SECRET` fait moins de 32 caractères. Corrigez la variable, puis redéployez.
