'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const store = require('../store');
const { UPLOAD_DIR, ensureDirs } = require('../runtime-paths');

const router = express.Router();
ensureDirs();

// ---------------------------------------------------------------------------
// Upload config (images only, random names, size-limited)
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype] || '';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Format d\'image non supporte (JPEG, PNG, WEBP, GIF).'), ok);
  },
});

// ---------------------------------------------------------------------------
// Auth middleware + CSRF wrapper
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.redirect(dest(req, '/login'));
}
function csrf(req, res, next) {
  return req.app.locals.verifyCsrf(req, res, next);
}
function dest(req, suffix = '') {
  return (req.baseUrl || '') + suffix;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives de connexion. Reessayez dans 15 minutes.',
});

// Layout flag for admin pages — never expose this path on the public site
router.use((req, res, next) => {
  res.locals.admin = true;
  res.locals.adminBase = req.baseUrl || '';
  res.locals.allCategories = store.listCategories({ activeOnly: false });
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect(dest(req));
  res.render('admin/login', { title: 'Connexion', error: null, layout: false });
});

router.post('/login', loginLimiter, csrf, (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const admin = store.getAdminByUsername(username);
  const ok = admin && bcrypt.compareSync(password, admin.password_hash);
  if (!ok) {
    return res.status(401).render('admin/login', {
      title: 'Connexion',
      error: 'Identifiants incorrects.',
      layout: false,
    });
  }
  // Prevent session fixation
  req.session.regenerate((err) => {
    if (err) return res.status(500).render('admin/login', { title: 'Connexion', error: 'Erreur de session.', layout: false });
    req.session.adminId = admin.id;
    req.session.username = admin.username;
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    res.redirect(dest(req));
  });
});

router.post('/logout', requireAuth, csrf, (req, res) => {
  req.session.destroy(() => res.redirect(dest(req, '/login')));
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const products = store.listProducts();
  const reservations = store.listReservations({ limit: 8 });
  const counts = store.countReservationsByStatus();
  res.render('admin/dashboard', {
    title: 'Tableau de bord',
    products,
    reservations,
    counts,
    section: 'dashboard',
  });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
router.get('/produits', requireAuth, (req, res) => {
  res.render('admin/products', {
    title: 'Gestion des produits',
    products: store.listProducts(),
    section: 'products',
  });
});

router.get('/produits/nouveau', requireAuth, (req, res) => {
  res.render('admin/product-form', {
    title: 'Nouveau produit',
    product: null,
    gallery: [],
    section: 'products',
    error: null,
  });
});

router.get('/produits/:id/modifier', requireAuth, (req, res) => {
  const product = store.getProductById(Number(req.params.id));
  if (!product) return res.redirect(dest(req, '/produits'));
  res.render('admin/product-form', {
    title: 'Modifier ' + product.name,
    product,
    gallery: store.getProductImages(product.id),
    section: 'products',
    error: null,
  });
});

function parseProductBody(body) {
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const optNum = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
  const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
  return {
    name: str(body.name, 160),
    brand: str(body.brand, 80),
    category: str(body.category, 60) || 'colon',
    price: num(body.price),
    old_price: optNum(body.old_price),
    stock: int(body.stock),
    cpu: str(body.cpu, 160),
    ram: str(body.ram, 80),
    storage: str(body.storage, 120),
    gpu: str(body.gpu, 160),
    screen: str(body.screen, 120),
    os: str(body.os, 80),
    short_fr: str(body.short_fr, 300),
    short_en: str(body.short_ar, 300) || str(body.short_en, 300),
    short_ar: str(body.short_ar, 300),
    desc_fr: str(body.desc_fr, 4000),
    desc_en: str(body.desc_ar, 4000) || str(body.desc_en, 4000),
    desc_ar: str(body.desc_ar, 4000),
    name_ar: str(body.name_ar, 160),
    featured: body.featured ? 1 : 0,
    active: body.active ? 1 : 0,
    sort_order: int(body.sort_order),
  };
}

function handleUploadErrors(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      req._uploadError = err.message;
    }
    next();
  });
}

router.post('/produits/nouveau', requireAuth, handleUploadErrors, csrf, (req, res) => {
  const data = parseProductBody(req.body);
  if (!data.name) {
    if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    return res.status(400).render('admin/product-form', {
      title: 'Nouveau produit', product: data, gallery: [], section: 'products',
      error: req._uploadError || 'Le nom du produit est obligatoire.',
    });
  }
  if (req.file) data.image = req.file.filename;
  store.createProduct(data);
  res.redirect(dest(req, '/produits'));
});

router.post('/produits/:id/modifier', requireAuth, handleUploadErrors, csrf, (req, res) => {
  const id = Number(req.params.id);
  const current = store.getProductById(id);
  if (!current) return res.redirect(dest(req, '/produits'));
  const data = parseProductBody(req.body);
  if (!data.name) {
    if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    return res.status(400).render('admin/product-form', {
      title: 'Modifier', product: { ...current, ...data }, gallery: store.getProductImages(id),
      section: 'products', error: req._uploadError || 'Le nom du produit est obligatoire.',
    });
  }
  if (req.file) {
    // remove old main image file if it was an upload
    if (current.image) fs.unlink(path.join(UPLOAD_DIR, current.image), () => {});
    data.image = req.file.filename;
  } else if (req.body.remove_image === '1') {
    if (current.image) fs.unlink(path.join(UPLOAD_DIR, current.image), () => {});
    data.image = '';
  } else {
    data.image = current.image;
  }
  store.updateProduct(id, data);
  res.redirect(dest(req, '/produits'));
});

router.post('/produits/:id/supprimer', requireAuth, csrf, (req, res) => {
  const id = Number(req.params.id);
  const product = store.getProductById(id);
  if (product) {
    if (product.image) fs.unlink(path.join(UPLOAD_DIR, product.image), () => {});
    for (const img of store.getProductImages(id)) fs.unlink(path.join(UPLOAD_DIR, img.filename), () => {});
    store.deleteProduct(id);
  }
  res.redirect(dest(req, '/produits'));
});

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
router.get('/reservations', requireAuth, (req, res) => {
  res.render('admin/reservations', {
    title: 'Réservations',
    reservations: store.listReservations(),
    counts: store.countReservationsByStatus(),
    section: 'reservations',
  });
});

router.get('/reservations/imprimer', requireAuth, (req, res) => {
  const reservations = store.listReservations();
  res.render('admin/reservations-print', {
    title: 'Réservations — impression',
    reservations,
    settings: store.getSettings(),
    printedAt: new Date().toLocaleString('fr-FR'),
  });
});

router.post('/reservations/:id/statut', requireAuth, csrf, (req, res) => {
  const status = ['nouveau', 'traite', 'annule'].includes(req.body.status) ? req.body.status : 'nouveau';
  store.setReservationStatus(Number(req.params.id), status);
  res.redirect(dest(req, '/reservations'));
});

router.post('/reservations/:id/supprimer', requireAuth, csrf, (req, res) => {
  store.deleteReservation(Number(req.params.id));
  res.redirect(dest(req, '/reservations'));
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const SETTING_KEYS = [
  'brand_name', 'accent_color', 'whatsapp_number', 'contact_email', 'notification_email', 'contact_phone',
  'instagram', 'facebook',
  'hero_title_fr', 'hero_title_ar', 'hero_sub_fr', 'hero_sub_ar',
  'about_fr', 'about_ar', 'currency', 'currency_symbol', 'brand_latin',
  'attestation_fr', 'attestation_ar',
  'hero_image', 'hero_video',
  'delivery_fr', 'delivery_ar',
  'landing_honey_hero', 'landing_honey_ingredients', 'landing_honey_ritual',
];

router.get('/parametres', requireAuth, (req, res) => {
  res.render('admin/settings', {
    title: 'Paramètres du site',
    settings: store.getSettings(),
    section: 'settings',
    notice: req.query.ok ? 'Paramètres enregistrés.' : null,
    pwError: null,
    pwOk: null,
  });
});

router.post('/parametres', requireAuth, csrf, (req, res) => {
  const update = {};
  for (const k of SETTING_KEYS) {
    if (k in req.body) update[k] = String(req.body[k] || '').slice(0, 5000);
  }
  if (update.whatsapp_number != null) update.whatsapp_number = update.whatsapp_number.replace(/[^0-9]/g, '');
  if (update.notification_email != null) update.notification_email = String(update.notification_email).trim();
  if (update.contact_email != null) update.contact_email = String(update.contact_email).trim();
  store.setSettings(update);
  res.redirect(dest(req, '/parametres?ok=1'));
});

router.post('/parametres/mot-de-passe', requireAuth, csrf, (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');
  const confirm = String(req.body.confirm_password || '');
  const admin = store.getAdminById(req.session.adminId);
  const render = (pwError, pwOk) => res.render('admin/settings', {
    title: 'Paramètres du site', settings: store.getSettings(), section: 'settings', notice: null, pwError, pwOk,
  });
  if (!admin || !bcrypt.compareSync(current, admin.password_hash)) return render('Mot de passe actuel incorrect.', null);
  if (next.length < 8) return render('Le nouveau mot de passe doit contenir au moins 8 caractères.', null);
  if (next !== confirm) return render('La confirmation ne correspond pas.', null);
  store.updateAdminPassword(admin.id, bcrypt.hashSync(next, 12));
  render(null, 'Mot de passe mis à jour.');
});

// ---------------------------------------------------------------------------
// Espace personnel (email SMTP + WhatsApp + impression)
// ---------------------------------------------------------------------------
function personnelLocals(extra = {}) {
  const mailer = require('../mailer');
  const notify = require('../notify');
  const settings = store.getSettings();
  let lastNotify = null;
  try { lastNotify = settings.last_notify_log ? JSON.parse(settings.last_notify_log) : null; } catch (_) {}
  return {
    title: 'Espace personnel',
    settings,
    section: 'personnel',
    notice: null,
    error: null,
    mailConfigured: mailer.isConfigured(settings),
    waConfigured: notify.whatsappConfigured(settings),
    recipient: mailer.recipientOf(settings),
    lastNotify,
    smtpPassSet: !!(settings.smtp_pass || process.env.SMTP_PASS),
    resendSet: !!(settings.resend_api_key || process.env.RESEND_API_KEY),
    viaResend: !!(settings.resend_api_key || process.env.RESEND_API_KEY),
    ...extra,
  };
}

router.get('/personnel', requireAuth, (req, res) => {
  const notice = req.query.ok === '1'
    ? (req.query.incomplete === '1'
      ? 'Enregistré, mais l’email n’est pas prêt : il manque encore l’identifiant SMTP et/ou le mot de passe d’application Gmail.'
      : 'Paramètres personnels enregistrés.')
    : req.query.test === 'mail-ok' ? 'Email de test envoyé. Vérifiez votre boîte (et les spams).'
    : req.query.test === 'wa-ok' ? 'Message WhatsApp de test envoyé.'
    : null;
  const error = req.query.test === 'mail-fail' ? decodeURIComponent(req.query.msg || 'Échec envoi email.')
    : req.query.test === 'wa-fail' ? decodeURIComponent(req.query.msg || 'Échec WhatsApp.')
    : null;
  res.render('admin/personnel', personnelLocals({ notice, error }));
});

router.post('/personnel', requireAuth, csrf, (req, res) => {
  const email = String(req.body.notification_email || '').trim().slice(0, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).render('admin/personnel', personnelLocals({ error: 'Adresse email de réception invalide.' }));
  }

  const current = store.getSettings();
  let smtpUser = String(req.body.smtp_user || '').trim().slice(0, 200);
  // Si l’identifiant SMTP est vide, on reprend l’email de réception (cas Gmail typique).
  if (!smtpUser && email) smtpUser = email;

  let smtpHost = String(req.body.smtp_host || '').trim().slice(0, 200);
  if (!smtpHost && /@gmail\.com$/i.test(smtpUser || email || '')) smtpHost = 'smtp.gmail.com';

  const update = {
    notification_email: email,
    smtp_host: smtpHost,
    smtp_port: String(req.body.smtp_port || '465').trim().slice(0, 10),
    smtp_secure: req.body.smtp_secure === 'true' ? 'true' : 'false',
    smtp_user: smtpUser,
    mail_from: String(req.body.mail_from || '').trim().slice(0, 200),
    whatsapp_notify: req.body.whatsapp_notify === '1' ? '1' : '0',
    notify_webhook_url: String(req.body.notify_webhook_url || '').trim().slice(0, 500),
  };

  const newPass = String(req.body.smtp_pass || '');
  if (newPass && newPass !== '********') update.smtp_pass = newPass.replace(/\s+/g, '').slice(0, 200);

  const newResend = String(req.body.resend_api_key || '');
  if (newResend && newResend !== '********') update.resend_api_key = newResend.trim().slice(0, 200);

  const newKey = String(req.body.callmebot_apikey || '');
  if (newKey && newKey !== '********') update.callmebot_apikey = newKey.slice(0, 120);
  else if (!newKey && !current.callmebot_apikey) update.callmebot_apikey = '';

  store.setSettings(update);

  const mailer = require('../mailer');
  const after = store.getSettings();
  if (!mailer.isConfigured(after)) {
    return res.redirect(dest(req, '/personnel?ok=1&incomplete=1'));
  }
  res.redirect(dest(req, '/personnel?ok=1'));
});

router.post('/personnel/test-email', requireAuth, csrf, async (req, res) => {
  const mailer = require('../mailer');
  const settings = store.getSettings();
  if (!mailer.isConfigured(settings)) {
    return res.redirect(dest(req, '/personnel?test=mail-fail&msg=') + encodeURIComponent(
      'Email incomplet. Sur Render gratuit : ajoutez RESEND_API_KEY. Sinon : Identifiant SMTP + mot de passe d’application Gmail, puis Enregistrer.'
    ));
  }
  if (!mailer.recipientOf(settings)) {
    return res.redirect(dest(req, '/personnel?test=mail-fail&msg=') + encodeURIComponent(
      'Indiquez l’adresse email qui reçoit les formulaires.'
    ));
  }
  const result = await mailer.sendTestEmail(settings);
  if (result.sent) return res.redirect(dest(req, '/personnel?test=mail-ok'));
  const msg = encodeURIComponent(result.error || 'Échec');
  return res.redirect(dest(req, '/personnel?test=mail-fail&msg=') + msg);
});

router.post('/personnel/test-whatsapp', requireAuth, csrf, async (req, res) => {
  const notify = require('../notify');
  const settings = store.getSettings();
  const fake = {
    id: 0,
    type: 'reservation',
    customer_name: 'Test معشبة الأطلس',
    phone: settings.whatsapp_number || '',
    email: settings.notification_email || '',
    message: 'Message de test depuis l’espace Personnel.',
    items: [{ product_name: 'Produit test', quantity: 1, unit_price: 1 }],
    offer_total: null,
    created_at: new Date().toISOString(),
  };
  const result = await notify.sendWhatsAppCallMeBot(fake, settings);
  if (result.sent) return res.redirect(dest(req, '/personnel?test=wa-ok'));
  const msg = encodeURIComponent(result.error || result.reason || 'Échec');
  return res.redirect(dest(req, '/personnel?test=wa-fail&msg=') + msg);
});

// ---------------------------------------------------------------------------
// Photos (hero + landing)
// ---------------------------------------------------------------------------
const PHOTO_SLOTS = {
  hero: { key: 'hero_image', label: 'Bandeau d’accueil' },
  honey_hero: { key: 'landing_honey_hero', label: 'Page miel — visuel principal' },
  honey_ingredients: { key: 'landing_honey_ingredients', label: 'Page miel — ingrédients' },
  honey_ritual: { key: 'landing_honey_ritual', label: 'Page miel — rituel' },
};

function isGeneratedUpload(name) {
  return /^[a-f0-9]{32}\.(jpe?g|png|webp|gif)$/i.test(String(name || ''));
}

function safeUnlinkUpload(filename) {
  if (!filename || !isGeneratedUpload(filename)) return;
  fs.unlink(path.join(UPLOAD_DIR, filename), () => {});
}

router.get('/photos', requireAuth, (req, res) => {
  res.render('admin/photos', {
    title: 'Photos',
    settings: store.getSettings(),
    products: store.listProducts(),
    section: 'photos',
    notice: req.query.ok ? 'Photo enregistrée.' : null,
    error: req.query.err || null,
  });
});

router.post('/photos/:slot', requireAuth, handleUploadErrors, csrf, (req, res) => {
  const slot = PHOTO_SLOTS[req.params.slot];
  if (!slot) return res.redirect(dest(req, '/photos'));
  if (req._uploadError || !req.file) {
    return res.redirect(dest(req, '/photos?err=') + encodeURIComponent(req._uploadError || 'Choisissez une image (JPEG, PNG, WEBP, GIF, max 4 Mo).'));
  }
  const current = store.getSettings();
  safeUnlinkUpload(current[slot.key]);
  store.setSettings({ [slot.key]: req.file.filename });
  res.redirect(dest(req, '/photos?ok=1'));
});

router.post('/photos/:slot/supprimer', requireAuth, csrf, (req, res) => {
  const slot = PHOTO_SLOTS[req.params.slot];
  if (!slot) return res.redirect(dest(req, '/photos'));
  const current = store.getSettings();
  safeUnlinkUpload(current[slot.key]);
  store.setSettings({ [slot.key]: '' });
  res.redirect(dest(req, '/photos?ok=1'));
});

module.exports = router;
