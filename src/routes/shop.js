'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../store');
const notify = require('../notify');
const pcConfig = require('../pc-config');

const router = express.Router();

const reservationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives. Reessayez dans quelques minutes.',
});

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const all = store.listProducts({ activeOnly: true });
  const featured = all.filter((p) => p.featured);
  const categories = store.listCategories({ activeOnly: true });
  const byCategory = categories.map((c) => ({
    name: c.category,
    count: c.n,
    products: all.filter((p) => p.category === c.category).slice(0, 4),
  }));
  res.render('shop/home', {
    title: '',
    featured: featured.length ? featured : all.slice(0, 8),
    byCategory,
    categories,
    reviews: require('../reviews'),
    page: 'home',
    bodyClass: 'page-home',
  });
});

// ---------------------------------------------------------------------------
// Products listing
// ---------------------------------------------------------------------------
router.get('/produits', (req, res) => {
  const products = store.listProducts({ activeOnly: true });
  const categories = store.listCategories({ activeOnly: true });
  const activeCat = req.query.cat && categories.some((c) => c.category === req.query.cat) ? req.query.cat : '';
  res.render('shop/products', {
    title: res.locals.t('all_products'),
    products,
    categories,
    activeCat,
    page: 'products',
  });
});

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------
router.get('/produit/:slug', (req, res) => {
  const product = store.getProductBySlug(req.params.slug);
  if (!product || !product.active) {
    return res.status(404).render('error', { code: 404, message: 'Produit introuvable.' });
  }
  const gallery = store.getProductImages(product.id);
  const settings = store.getSettings();
  const pricing = pcConfig.getPricing(settings);
  const ramOpts = pcConfig.ramOptions(product, pricing);
  res.render('shop/product', {
    title: product.name,
    product,
    gallery,
    page: 'products',
    configurable: pcConfig.isConfigurablePc(product),
    cfgBaseRam: pcConfig.parseGo(product.ram),
    cfgBaseStorage: pcConfig.parseGo(product.storage),
    cfgPricing: pricing,
    cfgRamOptions: ramOpts,
  });
});

// ---------------------------------------------------------------------------
// Cart + reservation form (single page, mimics the mockup)
// ---------------------------------------------------------------------------
router.get('/panier', (req, res) => {
  res.render('shop/cart', { title: res.locals.t('cart_title'), page: 'cart' });
});

// ---------------------------------------------------------------------------
// Reservation submission
// ---------------------------------------------------------------------------
function toInt(v, def = 0) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; }
function toNum(v) { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; }
function clean(s, max = 2000) { return String(s == null ? '' : s).trim().slice(0, max); }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

router.post('/reservation', reservationLimiter, (req, res) => {
  const verifyCsrf = req.app.locals.verifyCsrf;
  return verifyCsrf(req, res, () => {
    // Honeypot anti-spam: ce champ est cache, un humain ne le remplit jamais.
    if (clean(req.body.website, 100)) {
      return res.render('shop/confirmation', {
        title: res.locals.t('reservation_ok_title'), page: 'confirm', reservationId: 0,
      });
    }

    const name = clean(req.body.customer_name, 120);
    const phone = clean(req.body.phone, 40);
    const email = clean(req.body.email, 160);
    let message = clean(req.body.message, 2000);
    const globalOffer = toNum(req.body.offer_total);

    const PAY_LABELS = {
      leboncoin: 'Leboncoin (protection acheteur)',
      ebay: 'eBay Marketplace (protection acheteur)',
      paypal: 'PayPal (protection acheteur)',
      handoff: 'Remise en main propre — Montrouge (92120)',
    };
    const payKey = clean(req.body.payment_pref, 40);
    const paymentPref = PAY_LABELS[payKey] ? payKey : '';
    const reqRdv = req.body.req_rdv === '1';
    const reqPhotos = req.body.req_photos === '1';
    const reqInfo = req.body.req_info === '1';

    const metaLines = [];
    if (paymentPref) metaLines.push('Paiement souhaité: ' + PAY_LABELS[paymentPref]);
    if (reqRdv) metaLines.push('Demande: prise de rendez-vous');
    if (reqPhotos) metaLines.push('Demande: plus de photos');
    if (reqInfo) metaLines.push('Demande: plus d’informations');
    if (metaLines.length) {
      const block = metaLines.join('\n');
      message = message ? (block + '\n\n' + message) : block;
      message = message.slice(0, 2000);
    }

    const errors = [];
    if (!name) errors.push('Le nom est obligatoire.');
    if (!phone) errors.push('Le telephone est obligatoire.');
    if (email && !isEmail(email)) errors.push('Email invalide.');

    // Parse cart sent by client (JSON string). Prices are re-validated from DB.
    let rawItems = [];
    try {
      rawItems = JSON.parse(req.body.items || '[]');
      if (!Array.isArray(rawItems)) rawItems = [];
    } catch { rawItems = []; }

    const items = [];
    const settingsForPrice = store.getSettings();
    const pricing = pcConfig.getPricing(settingsForPrice);
    for (const it of rawItems.slice(0, 50)) {
      const product = store.getProductById(toInt(it.id));
      if (!product || !product.active) continue;
      const qty = Math.min(Math.max(toInt(it.qty, 1), 1), 99);
      const offer = it.offer != null ? toNum(it.offer) : null;
      const configurable = pcConfig.isConfigurablePc(product);
      const cfg = configurable
        ? pcConfig.normalizeConfig(it.config || {}, product, pricing)
        : pcConfig.normalizeConfig({}, product, pricing);
      const unitPrice = configurable
        ? pcConfig.configuredUnitPrice(product.price, product, cfg, pricing)
        : product.price;
      items.push({
        product_id: product.id,
        product_name: configurable
          ? pcConfig.productNameWithConfig(product, cfg, pricing)
          : product.name,
        unit_price: unitPrice,
        quantity: qty,
        offer_price: offer,
      });
    }

    if (!items.length) errors.push('Votre panier est vide.');

    if (errors.length) {
      return res.status(400).render('shop/cart', {
        title: res.locals.t('cart_title'),
        page: 'cart',
        errors,
        form: {
          customer_name: name,
          phone,
          email,
          message: clean(req.body.message, 2000),
          payment_pref: paymentPref || 'handoff',
          req_rdv: reqRdv,
          req_photos: reqPhotos,
          req_info: reqInfo,
          offer_total: req.body.offer_total || '',
        },
      });
    }

    const type = (globalOffer != null || items.some((i) => i.offer_price != null)) ? 'offer' : 'reservation';
    const id = store.createReservation({ customer_name: name, phone, email, message, type, items, offer_total: globalOffer });

    // Toujours enregistré en admin, puis notifications email + WhatsApp (async).
    const full = store.getReservation(id);
    const settings = store.getSettings();
    notify.notifyReservation(full, settings)
      .then((r) => {
        console.log(`[notify] #${id} email=${r.email.sent} whatsapp=${r.whatsapp.sent} webhook=${r.webhook.sent}`);
        try {
          store.setSetting('last_notify_log', JSON.stringify({
            at: new Date().toISOString(),
            id,
            email: r.email,
            whatsapp: r.whatsapp,
            webhook: r.webhook,
          }));
        } catch (_) { /* ignore */ }
      })
      .catch((err) => console.error('[notify] erreur', err.message));

    return res.render('shop/confirmation', {
      title: res.locals.t('reservation_ok_title'),
      page: 'confirm',
      reservationId: id,
    });
  });
});

// ---------------------------------------------------------------------------
// Static content pages
// ---------------------------------------------------------------------------
router.get('/a-propos', (req, res) => {
  res.render('shop/about', { title: res.locals.t('about_title'), page: 'about' });
});
router.get('/contact', (req, res) => {
  res.render('shop/contact', { title: res.locals.t('contact_title'), page: 'contact' });
});
router.get('/mentions-legales', (req, res) => {
  res.render('shop/legal', { title: res.locals.t('footer_legal'), page: 'legal', which: 'legal' });
});
router.get('/confidentialite', (req, res) => {
  res.render('shop/legal', { title: res.locals.t('footer_privacy'), page: 'privacy', which: 'privacy' });
});

// ---------------------------------------------------------------------------
// SEO: robots.txt & sitemap.xml
// ---------------------------------------------------------------------------
router.get('/robots.txt', (req, res) => {
  const base = res.locals.siteUrl;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${base}/sitemap.xml\n`
  );
});

router.get('/sitemap.xml', (req, res) => {
  const base = res.locals.siteUrl;
  const staticPaths = ['/', '/produits', '/a-propos', '/contact'];
  const products = store.listProducts({ activeOnly: true });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const urls = [];
  for (const p of staticPaths) urls.push(`<url><loc>${esc(base + p)}</loc><changefreq>weekly</changefreq></url>`);
  for (const pr of products) urls.push(`<url><loc>${esc(base + '/produit/' + pr.slug)}</loc><changefreq>weekly</changefreq></url>`);
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  );
});

module.exports = router;
