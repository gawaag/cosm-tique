# Mise en ligne (important)

## Netlify : non compatible

Ce site est une application **Node.js + SQLite** (panier, admin, emails, WhatsApp).
**Netlify héberge surtout du HTML/JS statique** : il ne peut pas faire tourner ce serveur tel quel.

Utilisez plutôt :
- [Render](https://render.com) (Web Service)
- [Railway](https://railway.app)
- [Fly.io](https://fly.io)

Sur ces plateformes : déployez le repo, définissez les variables d’environnement, gardez le dossier `data/` en volume persistant.

## Variables obligatoires en production

```
NODE_ENV=production
SECURE_COOKIES=true
SESSION_SECRET=une-longue-chaine-aleatoire
SITE_URL=https://votre-domaine.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mot-de-passe-fort
```

Puis dans **Admin → Personnel** : SMTP (Gmail + mot de passe d’application) + email de réception + clé CallMeBot pour WhatsApp.

## Sécurité déjà en place

- Sessions httpOnly, CSRF, Helmet/CSP, mots de passe bcrypt
- Rate limiting (site + admin + login + réservations)
- Prix revalidés côté serveur, honeypot anti-spam
- `/admin` interdit dans `robots.txt`
- `.env` et `data/` exclus du git

## Checklist avant ouverture au public

1. Changer le mot de passe admin
2. Tester l’email et WhatsApp depuis Personnel
3. HTTPS + `SECURE_COOKIES=true`
4. Sauvegarder régulièrement `data/app.db` et `public/uploads/`
