'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { DATA_DIR, ensureDirs } = require('./runtime-paths');
const { openSqlite } = require('./sqlite');

ensureDirs();

const db = openSqlite(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  brand          TEXT DEFAULT '',
  category       TEXT NOT NULL DEFAULT 'colon',
  price          REAL NOT NULL DEFAULT 0,
  old_price      REAL,
  stock          INTEGER NOT NULL DEFAULT 0,
  cpu            TEXT DEFAULT '',
  ram            TEXT DEFAULT '',
  storage        TEXT DEFAULT '',
  gpu            TEXT DEFAULT '',
  screen         TEXT DEFAULT '',
  os             TEXT DEFAULT '',
  short_fr       TEXT DEFAULT '',
  short_en       TEXT DEFAULT '',
  desc_fr        TEXT DEFAULT '',
  desc_en        TEXT DEFAULT '',
  image          TEXT DEFAULT '',
  featured       INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reservations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT DEFAULT '',
  message       TEXT DEFAULT '',
  offer_total   REAL,
  type          TEXT NOT NULL DEFAULT 'reservation',
  status        TEXT NOT NULL DEFAULT 'nouveau',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reservation_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name   TEXT NOT NULL,
  unit_price     REAL NOT NULL DEFAULT 0,
  quantity       INTEGER NOT NULL DEFAULT 1,
  offer_price    REAL
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_res_items_res ON reservation_items(reservation_id);
`);

// ---------------------------------------------------------------------------
// Migrations (colonnes ajoutees apres coup sur bases existantes)
// ---------------------------------------------------------------------------
(function migrate() {
  const cols = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  if (!cols.includes('category')) {
    db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'colon'");
    console.log('[db] migration: colonne "category" ajoutee aux produits');
  }
  const extra = [
    ['name_ar', "TEXT DEFAULT ''"],
    ['short_ar', "TEXT DEFAULT ''"],
    ['desc_ar', "TEXT DEFAULT ''"],
  ];
  const fresh = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  for (const [col, typ] of extra) {
    if (!fresh.includes(col)) {
      db.exec(`ALTER TABLE products ADD COLUMN ${col} ${typ}`);
      console.log(`[db] migration: colonne "${col}" ajoutee`);
    }
  }
})();

// ---------------------------------------------------------------------------
// Seed: settings
// ---------------------------------------------------------------------------
const ATTEST_FR = "J'atteste sur l'honneur, à la date de cette commande, que je ne souffre d'aucune maladie de l'estomac, ni de cancer, ni de diabète, ni d'hypertension, ni de dialyse, ni d'aucune maladie dangereuse.";
const ATTEST_AR = 'أُشهد على شرفي، بتاريخ هذا الطلب، أنني لا أعاني من أي مرض في المعدة، ولا من السرطان، ولا من السكري، ولا من الضغط، ولا من غسيل الكلى، ولا من أي مرض خطير.';

const SHOP_EMAIL = 'anas.bouaita2027@gmail.com';
const SHOP_WA = '212619915492';
const SHOP_PHONE = '+212 619 915 492';
const SHOP_SOCIAL = 'https://wa.me/212619915492';
const CATALOG_VERSION = 'maachabat-colon-v2';

const DEFAULT_SETTINGS = {
  brand_name: 'معشبة الأطلس',
  brand_latin: 'Maachabat Al Atlas',
  accent_color: '#2E8B57',
  whatsapp_number: SHOP_WA,
  contact_email: SHOP_EMAIL,
  notification_email: SHOP_EMAIL,
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: SHOP_EMAIL,
  smtp_pass: '',
  mail_from: `معشبة الأطلس <${SHOP_EMAIL}>`,
  resend_api_key: '',
  whatsapp_notify: '1',
  callmebot_apikey: '',
  notify_webhook_url: '',
  contact_phone: SHOP_PHONE,
  instagram: SHOP_SOCIAL,
  facebook: SHOP_SOCIAL,
  hero_title_fr: 'Les plantes, simplement.',
  hero_title_ar: 'الأعشاب، ببساطة.',
  hero_title_en: 'الأعشاب، ببساطة.',
  hero_sub_fr: 'Miel du côlon, boutique au Maroc. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs. Paiement à la livraison.',
  hero_sub_ar: 'عسل راحة القولون. متجر في المغرب. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المدن. الدفع عند الاستلام.',
  hero_sub_en: 'عسل راحة القولون. متجر في المغرب. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المدن. الدفع عند الاستلام.',
  hero_image: 'hero-souk-atlas.jpg',
  hero_video: '',
  about_fr: "معشبة الأطلس (Maachabat Al Atlas) est une boutique au Maroc : miel de confort du côlon (250 g, 500 g, 1 kg). Livraison 24 h à Rabat, Salé et Casablanca, 48 h dans le reste du Maroc. Paiement à la livraison. Les compléments ne se substituent pas à un traitement médical.",
  about_ar: "معشبة الأطلس (Maachabat Al Atlas) متجر في المغرب: عسل راحة القولون (250 غ، 500 غ، 1 كغ). توصيل 24 ساعة الرباط وسلا والبيضاء، 48 ساعة باقي المغرب. الدفع عند الاستلام. المكمّلات لا تغني عن علاج طبي.",
  about_en: "معشبة الأطلس (Maachabat Al Atlas) : miel du côlon. Boutique au Maroc. Livraison 24 h / 48 h. Paiement à la livraison.",
  attestation_fr: ATTEST_FR,
  attestation_ar: ATTEST_AR,
  delivery_fr: 'Boutique au Maroc. Paiement à la livraison. 24 h Rabat, Salé, Casablanca. 48 h dans le reste du Maroc.',
  delivery_ar: 'متجر في المغرب. الدفع عند الاستلام. 24 ساعة الرباط وسلا والبيضاء. 48 ساعة باقي المغرب.',
  landing_honey_hero: 'honey-hero.png',
  landing_honey_ingredients: 'honey-ingredients.png',
  landing_honey_ritual: 'honey-ritual.png',
  currency: 'MAD',
  currency_symbol: 'د.م.',
  catalog_version: CATALOG_VERSION,
};

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

/** Vente Maroc : MAD par défaut, sans écraser un symbole déjà choisi. */
function forceMoroccoCurrency() {
  const cur = String((getSetting.get('currency') || {}).value || '').trim();
  const sym = String((getSetting.get('currency_symbol') || {}).value || '').trim();
  if (!cur) upsertSetting.run('currency', 'MAD');
  if (!sym) upsertSetting.run('currency_symbol', 'د.م.');
}

function applyMaachabatBrand() {
  const force = {
    brand_name: DEFAULT_SETTINGS.brand_name,
    brand_latin: DEFAULT_SETTINGS.brand_latin,
    hero_title_fr: DEFAULT_SETTINGS.hero_title_fr,
    hero_title_ar: DEFAULT_SETTINGS.hero_title_ar,
    hero_title_en: DEFAULT_SETTINGS.hero_title_en,
    hero_sub_fr: DEFAULT_SETTINGS.hero_sub_fr,
    hero_sub_ar: DEFAULT_SETTINGS.hero_sub_ar,
    hero_sub_en: DEFAULT_SETTINGS.hero_sub_en,
    about_fr: DEFAULT_SETTINGS.about_fr,
    about_ar: DEFAULT_SETTINGS.about_ar,
    about_en: DEFAULT_SETTINGS.about_en,
    delivery_fr: DEFAULT_SETTINGS.delivery_fr,
    delivery_ar: DEFAULT_SETTINGS.delivery_ar,
    mail_from: DEFAULT_SETTINGS.mail_from,
    hero_image: DEFAULT_SETTINGS.hero_image,
    contact_email: DEFAULT_SETTINGS.contact_email,
    notification_email: DEFAULT_SETTINGS.notification_email,
    smtp_user: DEFAULT_SETTINGS.smtp_user,
    whatsapp_number: DEFAULT_SETTINGS.whatsapp_number,
    contact_phone: DEFAULT_SETTINGS.contact_phone,
    instagram: DEFAULT_SETTINGS.instagram,
    facebook: DEFAULT_SETTINGS.facebook,
  };
  for (const [k, v] of Object.entries(force)) upsertSetting.run(k, v);
  db.prepare(`
    UPDATE products SET brand = ?
    WHERE brand IN ('معشبات الأطلس', 'Miichabat Al Atlas', 'Mi3chabat Al Atlas')
       OR brand LIKE '%معشبات%'
       OR brand LIKE '%Miichabat%'
       OR brand LIKE '%Mi3chabat%'
  `).run(DEFAULT_SETTINGS.brand_name);
}
const applyMiichabatBrand = applyMaachabatBrand;

/** Contact boutique Maroc (email + WhatsApp 212). Never re-apply France +33 or Volta emails. */
function ensureAtlasContactDefaults() {
  const EMAIL = SHOP_EMAIL;
  const WA = SHOP_WA;
  const PHONE = SHOP_PHONE;
  const staleWa = new Set([
    '', '212600000000', '33600000000', '33744141908',
  ]);
  const stalePhone = new Set([
    '', '+33 6 00 00 00 00', '+212 6 00 00 00 00', '+33 7 44 14 19 08',
    '+212 6 19 91 54 92',
  ]);
  const staleEmails = new Set([
    '', 'contact@example.com', 'voltatech.contact@gmail.com',
  ]);
  let changed = false;

  const curWa = String((getSetting.get('whatsapp_number') || {}).value || '').trim();
  const waDigits = curWa.replace(/[^0-9]/g, '');
  if (curWa !== WA && (!curWa || staleWa.has(curWa) || waDigits.startsWith('33'))) {
    upsertSetting.run('whatsapp_number', WA);
    changed = true;
  }
  const curPhone = String((getSetting.get('contact_phone') || {}).value || '').trim();
  const phoneDigits = curPhone.replace(/[^0-9]/g, '');
  if (curPhone !== PHONE && (!curPhone || stalePhone.has(curPhone) || phoneDigits.startsWith('33'))) {
    upsertSetting.run('contact_phone', PHONE);
    changed = true;
  }

  const targets = {
    notification_email: EMAIL,
    contact_email: EMAIL,
  };
  for (const [key, want] of Object.entries(targets)) {
    const cur = String((getSetting.get(key) || {}).value || '').trim();
    if (!cur || staleEmails.has(cur) || /volta/i.test(cur) || /example\.com/i.test(cur)) {
      upsertSetting.run(key, want);
      changed = true;
    }
  }
  const smtpUser = String((getSetting.get('smtp_user') || {}).value || '').trim();
  if (!smtpUser || staleEmails.has(smtpUser) || /volta/i.test(smtpUser) || /example\.com/i.test(smtpUser)) {
    upsertSetting.run('smtp_user', EMAIL);
    changed = true;
  }
  const mailFrom = String((getSetting.get('mail_from') || {}).value || '').trim();
  if (!mailFrom || /example\.com/i.test(mailFrom) || /volta/i.test(mailFrom) || /HERBALIS/i.test(mailFrom) || /voltatech/i.test(mailFrom)) {
    upsertSetting.run('mail_from', `معشبة الأطلس <${EMAIL}>`);
    changed = true;
  }
  for (const key of ['instagram', 'facebook']) {
    const cur = String((getSetting.get(key) || {}).value || '').trim();
    if (!cur) {
      upsertSetting.run(key, SHOP_SOCIAL);
      changed = true;
    }
  }
  if (changed) console.log(`[db] Contact boutique: ${EMAIL} / WhatsApp ${PHONE}`);
}
const ensureVoltaContactDefaults = ensureAtlasContactDefaults;

function slugifyName(str) {
  return String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'produit';
}

// ---------------------------------------------------------------------------
// Seed: admin from environment
// ---------------------------------------------------------------------------
function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count > 0) return;
  const username = (process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`[db] Compte atelier cree: "${username}" (mot de passe depuis .env)`);
}

/** Upsert the first admin row from ADMIN_USERNAME / ADMIN_PASSWORD on every start. */
function alignAdminFromEnv() {
  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const row = db.prepare('SELECT id, username, password_hash FROM admins ORDER BY id LIMIT 1').get();
  if (row) {
    const passOk = bcrypt.compareSync(password, row.password_hash);
    if (passOk && row.username === username) return;
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE admins SET username = ?, password_hash = ? WHERE id = ?').run(username, hash, row.id);
    console.log('[db] Identifiants atelier alignes sur ADMIN_USERNAME / ADMIN_PASSWORD');
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`[db] Compte atelier cree: "${username}"`);
}

// ---------------------------------------------------------------------------
// Seed: catalogue Maroc (MAD) + photos
// ---------------------------------------------------------------------------
function catalogRowPayload(row, slug) {
  return {
    ...row,
    slug,
    name_ar: row.name_ar || '',
    short_ar: row.short_ar || '',
    desc_ar: row.desc_ar || '',
    short_en: row.short_ar || row.short_en || '',
    desc_en: row.desc_ar || row.desc_en || '',
    old_price: row.old_price == null ? null : row.old_price,
    featured: row.featured ? 1 : 0,
    active: row.active == null ? 1 : row.active,
  };
}

function insertCatalogRows(rows) {
  const insert = db.prepare(`
    INSERT INTO products
      (slug, name, name_ar, brand, category, price, old_price, stock, cpu, ram, storage, gpu, screen, os,
       short_fr, short_en, short_ar, desc_fr, desc_en, desc_ar, image, featured, active, sort_order)
    VALUES
      (@slug, @name, @name_ar, @brand, @category, @price, @old_price, @stock, @cpu, @ram, @storage, @gpu, @screen, @os,
       @short_fr, @short_en, @short_ar, @desc_fr, @desc_en, @desc_ar, @image, @featured, @active, @sort_order)
  `);
  const used = new Set(db.prepare('SELECT slug FROM products').all().map((r) => r.slug));
  for (const row of rows) {
    let slug = row.slug || slugifyName(row.name);
    let n = 2;
    const base = slug;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    insert.run(catalogRowPayload(row, slug));
  }
}

function seedFranceCatalog() {
  const catalog = require('./catalog-seed');
  insertCatalogRows(catalog);
  console.log(`[db] ${catalog.length} produits catalogue Maroc (MAD) ajoutes`);
}

function upsertProductBySlug(row) {
  const slug = row.slug || slugifyName(row.name);
  const payload = catalogRowPayload(row, slug);
  const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
  if (existing) {
    db.prepare(`
      UPDATE products SET
        name=@name, name_ar=@name_ar, brand=@brand, category=@category,
        price=@price, old_price=@old_price, stock=@stock,
        cpu=@cpu, ram=@ram, storage=@storage, gpu=@gpu, screen=@screen, os=@os,
        short_fr=@short_fr, short_en=@short_en, short_ar=@short_ar,
        desc_fr=@desc_fr, desc_en=@desc_en, desc_ar=@desc_ar,
        image=@image, featured=@featured, active=@active, sort_order=@sort_order
      WHERE slug=@slug
    `).run(payload);
    return existing.id;
  }
  const insert = db.prepare(`
    INSERT INTO products
      (slug, name, name_ar, brand, category, price, old_price, stock, cpu, ram, storage, gpu, screen, os,
       short_fr, short_en, short_ar, desc_fr, desc_en, desc_ar, image, featured, active, sort_order)
    VALUES
      (@slug, @name, @name_ar, @brand, @category, @price, @old_price, @stock, @cpu, @ram, @storage, @gpu, @screen, @os,
       @short_fr, @short_en, @short_ar, @desc_fr, @desc_en, @desc_ar, @image, @featured, @active, @sort_order)
  `);
  return insert.run(payload).lastInsertRowid;
}

/** Keep only active colon SKUs. Upsert by slug; deactivate the rest (orders stay intact). */
function ensureMaachabatCatalog() {
  const catalog = require('./catalog-seed');
  const keep = catalog.filter((p) => p.active !== 0).map((p) => p.slug).filter(Boolean);
  if (!keep.length) return;

  const ver = String((getSetting.get('catalog_version') || {}).value || '');
  const reseed = ver !== CATALOG_VERSION;

  for (const row of catalog) {
    const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(row.slug);
    if (!existing || reseed) upsertProductBySlug(row);
  }

  const placeholders = keep.map(() => '?').join(',');
  db.prepare(`UPDATE products SET active = 0, featured = 0 WHERE slug NOT IN (${placeholders})`).run(...keep);

  upsertSetting.run('catalog_version', CATALOG_VERSION);
  if (reseed) {
    console.log(`[db] Catalogue ${CATALOG_VERSION} : ${keep.length} produits actifs, autres désactivés`);
  }
}

function ensureFranceCatalog() {
  forceMoroccoCurrency();
  ensureAtlasContactDefaults();
  applyMaachabatBrand();

  const total = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (total === 0) {
    seedFranceCatalog();
    console.log('[db] Catalogue معشبة الأطلس (côlon / cheveux / packs) chargé');
  }

  upsertSetting.run('attestation_fr', ATTEST_FR);
  upsertSetting.run('attestation_ar', ATTEST_AR);

  ensureMaachabatCatalog();
}

seedAdmin();
alignAdminFromEnv();
ensureFranceCatalog();

module.exports = { db, getSetting };
