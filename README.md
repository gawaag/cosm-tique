# TechPortables - Boutique de PC portables

Site de vente/reservation de PC portables. Bilingue **FR/EN**, mode **clair/sombre**,
panier + reservation (avec message et offre), contact **WhatsApp**, et un **panneau
d'administration securise** pour gerer produits, reservations et contenu du site.

## Demarrage

```bash
npm install
npm start
```

- Site public : http://localhost:3000
- Administration : http://localhost:3000/admin

Les identifiants admin sont definis dans le fichier `.env`
(`ADMIN_USERNAME` / `ADMIN_PASSWORD`). Changez le mot de passe apres la premiere
connexion depuis **Parametres > Securite**.

## Ce que le client peut faire

- Parcourir les modeles, voir la fiche produit (specs, photos).
- Ajouter au panier, choisir la quantite.
- Valider une reservation via un formulaire (nom, telephone, email, message).
- Proposer une offre de prix.
- Contacter directement sur WhatsApp (bouton flottant + par produit + au panier).

## Ce que l'admin peut faire (sans toucher au code)

- Ajouter / modifier / supprimer des produits, avec photo, prix, stock, specs, descriptions FR/EN.
- Mettre des produits en avant sur l'accueil.
- Voir et gerer les reservations et offres (statut : nouveau / traite / annule).
- Modifier le contenu du site : nom, couleur, numero WhatsApp, contact, textes d'accueil, page "A propos".
- Changer son mot de passe.

## Notifications email (recapitulatif de reservation)

A chaque reservation/offre, un email recapitulatif (client, produits, quantites,
offre, message) est envoye a l'administrateur. Configurez le SMTP dans `.env` :

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=votre@gmail.com
SMTP_PASS=mot_de_passe_application   # Gmail: cree un "mot de passe d'application"
MAIL_FROM="Ma boutique <votre@gmail.com>"
ADMIN_EMAIL=destinataire@exemple.com  # sinon: email de contact defini dans l'admin
```

Si le SMTP n'est pas configure, les reservations restent visibles dans l'admin
(l'envoi est simplement ignore, aucune erreur).

## SEO et performance

- `sitemap.xml` et `robots.txt` generes automatiquement.
- Balises `<title>`, meta description, canonical, Open Graph et Twitter Card.
- Donnees structurees JSON-LD (schema.org `Product` sur les fiches, `Store` sur l'accueil).
- Rendu cote serveur (HTML pret pour l'indexation), JS minimal -> tres rapide.
- Definir `SITE_URL` dans `.env` avec l'URL publique (pour des liens SEO absolus corrects).

## Securite mise en place

- Mots de passe haches avec **bcrypt**.
- Sessions signees, cookies `httpOnly` + `SameSite`, protection contre la fixation de session.
- Protection **CSRF** sur tous les formulaires.
- En-tetes de securite **Helmet** + **CSP** (scripts avec nonce).
- **Rate limiting** (limitation des tentatives) sur la connexion et les reservations.
- Requetes SQL **parametrees** (pas d'injection), validation et nettoyage des entrees.
- Uploads d'images restreints (type et taille), noms de fichiers aleatoires.
- Prix **revalides cote serveur** a la reservation (le panier client ne peut pas etre falsifie).
- Protection anti-spam des formulaires : **honeypot** + rate limiting.

## Configuration

Tout se regle dans `.env` :

| Variable | Role |
|----------|------|
| `PORT` | Port d'ecoute (defaut 3000) |
| `SESSION_SECRET` | Secret de signature des sessions |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Compte admin cree au 1er demarrage |
| `SECURE_COOKIES` | `true` en production derriere HTTPS |
| `NODE_ENV` | `production` en ligne |

## Passage en production (resume)

> **Attention :** Netlify ne convient pas à ce projet (serveur Node + SQLite).
> Voir [DEPLOY.md](./DEPLOY.md) pour Render / Railway / Fly.io.

1. Mettre `NODE_ENV=production` et `SECURE_COOKIES=true` dans `.env`.
2. Configurer l’email + WhatsApp dans **Admin → Personnel** (et tester).
3. Servir derrière HTTPS.
4. Sauvegarder regulierement le dossier `data/` (base SQLite) et `public/uploads/`.

## Structure

```
server.js            Serveur Express + securite
src/db.js            Base SQLite + schema + donnees de demo
src/store.js         Acces aux donnees (produits, reservations, parametres)
src/i18n.js          Traductions FR/EN
src/routes/shop.js   Pages publiques + reservation
src/routes/admin.js  Espace administrateur
views/               Gabarits EJS
public/              CSS, JS, images uploadees
data/                Base de donnees (genere, a sauvegarder)
```
