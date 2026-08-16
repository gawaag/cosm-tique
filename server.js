'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { getSettings, listCategories } = require('./src/store');
const { resolveLang, translator, LANGS, htmlDir, formatReviewDate } = require('./src/i18n');
const { catNavLabel, catFilterLabel, catShowcase, productName, productShort, productDesc, productBadges, productSpecLine } = require('./src/categories');
const shopRoutes = require('./src/routes/shop');
const adminRoutes = require('./src/routes/admin');
const { resolveAdminPath } = require('./src/admin-path');
const { isServerless, ROOT, DATA_DIR, UPLOAD_DIR, PUBLIC_DIR, BUNDLED_UPLOADS } = require('./src/runtime-paths');
const { openSqlite } = require('./src/sqlite');
const SqlSessionStore = require('./src/sql-session-store')(session);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const secureCookies = process.env.SECURE_COOKIES === 'true' || isProd;
const ADMIN_PATH = resolveAdminPath();
app.locals.adminPath = ADMIN_PATH;

if (isProd) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change-me') {
    console.error('[securite] SESSION_SECRET manquant ou trop faible en production. Arrêt.');
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'change-me' || process.env.ADMIN_PASSWORD === 'admin1234') {
    console.warn('[securite] Changez ADMIN_PASSWORD (ou le mot de passe admin) avant d’exposer le site.');
  }
}

// Derrière un reverse proxy / hébergeur HTTPS
if (secureCookies || isProd) app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// View engine
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));

// ---------------------------------------------------------------------------
// Security headers (Helmet + CSP with per-request nonce for inline scripts)
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      mediaSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: secureCookies ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
const sessionDb = openSqlite(path.join(DATA_DIR, 'sessions.db'));
app.use(session({
  store: new SqlSessionStore({
    client: sessionDb,
    expired: { clear: !isServerless, intervalMs: 15 * 60 * 1000 },
  }),
  name: 'sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    secure: secureCookies,
    maxAge: 1000 * 60 * 60 * (isProd ? 4 : 8),
  },
}));

// ---------------------------------------------------------------------------
// Rate limiting (general + plus strict sur le chemin atelier)
// ---------------------------------------------------------------------------
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 400 : 600,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(ADMIN_PATH, rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 120 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de requetes. Reessayez plus tard.',
}));

// ---------------------------------------------------------------------------
// CSRF protection (double-submit token stored in session)
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  next();
});
function verifyCsrf(req, res, next) {
  const token = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!token || token !== req.session.csrf) {
    return res.status(403).render('error', {
      code: 403,
      message: 'Requete invalide (jeton de securite manquant ou expire). Rechargez la page.',
    });
  }
  next();
}
app.locals.verifyCsrf = verifyCsrf;

// ---------------------------------------------------------------------------
// Locale + shared template locals
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  let lang = req.cookies?.lang;
  if (!lang && req.query.lang) lang = req.query.lang;
  lang = resolveLang(lang || parseCookie(req.headers.cookie).lang || 'ar');
  res.locals.lang = lang;
  res.locals.langs = LANGS;
  res.locals.dir = htmlDir(lang);
  res.locals.t = translator(lang);
  res.locals.settings = getSettings();
  res.locals.navCategories = listCategories({ activeOnly: true })
    .filter((c) => !['respi', 'honey'].includes(String(c.category || '').toLowerCase()));
  res.locals.catNav = (key) => catNavLabel(key, lang);
  res.locals.catFilter = (key) => catFilterLabel(key, lang);
  res.locals.catShow = (key) => catShowcase(key, lang);
  res.locals.pName = (p) => productName(p, lang);
  res.locals.pShort = (p) => productShort(p, lang);
  res.locals.pDesc = (p) => productDesc(p, lang);
  res.locals.pBadges = productBadges;
  res.locals.pSpec = productSpecLine;
  res.locals.formatReviewDate = (iso) => formatReviewDate(iso, lang);
  res.locals.currentPath = req.path;
  res.locals.siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  res.locals.isAdmin = !!(req.session && req.session.adminId);
  res.locals.username = req.session && req.session.username;
  next();
});

function parseCookie(str) {
  const out = {};
  if (!str) return out;
  for (const part of str.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// Language switch endpoint
app.get('/lang/:lang', (req, res) => {
  const lang = resolveLang(req.params.lang);
  res.setHeader('Set-Cookie', `lang=${lang}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`);
  const back = req.get('referer') || '/';
  res.redirect(back);
});

// ---------------------------------------------------------------------------
// Static assets
// ---------------------------------------------------------------------------
app.use('/static', express.static(PUBLIC_DIR, { maxAge: isProd ? '7d' : 0 }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: isProd ? '30d' : 0 }));
if (isServerless && BUNDLED_UPLOADS !== UPLOAD_DIR && fs.existsSync(BUNDLED_UPLOADS)) {
  app.use('/uploads', express.static(BUNDLED_UPLOADS, { maxAge: isProd ? '30d' : 0 }));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/', shopRoutes);
app.use(ADMIN_PATH, adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { code: 404, message: 'Page introuvable.' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const code = err.status || 500;
  res.status(code).render('error', {
    code,
    message: isProd ? 'Une erreur est survenue.' : (err.message || 'Erreur serveur.'),
  });
});

module.exports = app;

if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`\n  Boutique en ligne sur http://localhost:${PORT}`);
    if (isProd) {
      console.log('  Atelier: chemin secret (variable ADMIN_PATH)\n');
    } else {
      console.log(`  Atelier: http://localhost:${PORT}${ADMIN_PATH}\n`);
    }
  });
}
