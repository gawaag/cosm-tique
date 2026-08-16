# Mise en ligne — Netlify

Ce site est une application **Express + EJS + SQLite**. Sur Netlify elle tourne en **fonction serverless** (`netlify/functions/server.js`), pas en site statique.

## Brancher le site Netlify au dépôt

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. GitHub : **`gawaag/cosm-tique`**
3. Réglages (déjà dans `netlify.toml`, à vérifier) :
   - **Build command :** `npm ci`
   - **Publish directory :** `public`
   - **Functions directory :** `netlify/functions`
   - Pas « static site only »
4. **Environment variables** (Site settings → Environment variables) — **ne pas** définir `PORT` :

```
NODE_ENV=production
SECURE_COOKIES=true
SESSION_SECRET=une-longue-chaine-aleatoire
SITE_URL=https://maachabatalatlas.netlify.app
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mot-de-passe-fort
ADMIN_PATH=/atelier-miichabat-7k2
ADMIN_EMAIL=anas.bouaita2027@gmail.com
RESEND_API_KEY=re_xxxxxxxx
```

Optionnel : `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (souvent inutiles si Resend est configuré).

5. Déployer, puis ouvrir `https://maachabatalatlas.netlify.app/`
6. Si un ancien service **Render** existe encore : **désactiver l’auto-deploy** (et idéalement suspendre le service) pour que les clients ne voient plus les déploiements Render.

## Limite SQLite / uploads

Netlify Functions n’ont **pas de disque persistant**. La base est copiée dans `/tmp` au démarrage à froid, puis renvoyée vers **Netlify Blobs** après les requêtes POST/PUT/PATCH/DELETE.

- Commandes, stock, sessions et photos admin **peuvent se perdre** si deux instances écrivent en même temps, ou si Blobs échoue.
- Les images catalogue versionnées dans `public/uploads/` sont servies en statique (CDN) et restent stables.

## Local

```
npm install
npm start
```

`node server.js` écoute sur `PORT` (défaut 3000). Sur Netlify, `app.listen` n’est pas appelé.

## Sécurité déjà en place

- Sessions httpOnly, CSRF, Helmet/CSP, mots de passe bcrypt
- Rate limiting (site + admin + login + réservations)
- Prix revalidés côté serveur, honeypot anti-spam
- `/admin` interdit dans `robots.txt`
- `.env` et `data/` exclus du git

## Checklist avant ouverture au public

1. Changer le mot de passe admin (`ADMIN_PASSWORD`)
2. Tester l’email et WhatsApp depuis Personnel
3. HTTPS + `SECURE_COOKIES=true` + `SITE_URL` = l’URL Netlify
4. Ne pas laisser Render publier la même boutique en parallèle
