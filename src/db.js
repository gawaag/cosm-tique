'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
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
const DEFAULT_SETTINGS = {
  brand_name: 'HERBALIS',
  accent_color: '#2E8B57',
  whatsapp_number: '33744141908',
  contact_email: 'voltatech.contact@gmail.com',
  notification_email: 'voltatech.contact@gmail.com',
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: 'voltatech.contact@gmail.com',
  smtp_pass: '',
  mail_from: 'HERBALIS <voltatech.contact@gmail.com>',
  resend_api_key: '',
  whatsapp_notify: '1',
  callmebot_apikey: '',
  notify_webhook_url: '',
  contact_phone: '+33 7 44 14 19 08',
  hero_title_fr: 'La santé naturelle, simplement.',
  hero_title_ar: 'الصحة الطبيعية، ببساطة.',
  hero_title_en: 'La santé naturelle, simplement.',
  hero_sub_fr: 'Compléments naturels ciblés pour le confort intestinal et la vitalité capillaire. Formules concentrées, fabriquées en France.',
  hero_sub_ar: 'مكملات طبيعية موجّهة لراحة الأمعاء وحيوية الشعر. صيغ مركّزة، مصنوعة في فرنسا.',
  hero_sub_en: 'Compléments naturels ciblés pour le confort intestinal et la vitalité capillaire. Formules concentrées, fabriquées en France.',
  hero_image: 'hero-botanica.png',
  hero_video: '',
  about_fr: "HERBALIS formule des compléments ciblés : confort du côlon et du microbiote, anti-chute et pousse capillaire, confort des voies respiratoires (asthme léger, gorges irritées). Gélules végétales, dosages utiles, fabrication française. Chaque lot est contrôlé en laboratoire indépendant. Paiement sécurisé (CB, Apple Pay), livraison 48 h, satisfait ou remboursé 30 jours. Les compléments ne se substituent pas à un traitement médical.",
  about_ar: "هيرباليس يصيغ مكمّلات موجّهة: راحة القولون والميكروبيوتا، مكافحة التساقط وإنبات الشعر، وراحة الجهاز التنفسي (ربو خفيف، حلق متهيّج). كبسولات نباتية، جرعات نافعة، تصنيع فرنسي. كل دفعة تُفحص في مختبر مستقل. دفع آمن (بطاقة، آبل باي)، توصيل 48 ساعة، رضا أو استرداد 30 يوماً. المكمّلات لا تغني عن علاج طبي.",
  about_en: "HERBALIS formule des compléments ciblés : confort du côlon, anti-chute, confort respiratoire. Fabrication française.",
  currency: 'EUR',
  currency_symbol: '€',
  catalog_version: 'herbalis-v1',
};

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

/** Vente France uniquement : toujours forcer EUR / € (jamais MAD / DH). */
function forceFranceCurrency() {
  const cur = (getSetting.get('currency') || {}).value;
  const sym = (getSetting.get('currency_symbol') || {}).value;
  if (cur !== 'EUR' || sym !== '€') {
    upsertSetting.run('currency', 'EUR');
    upsertSetting.run('currency_symbol', '€');
    console.log('[db] Devise forcee: EUR / € (vente France)');
  }
}

function applyHerbalisBrand() {
  const force = {
    brand_name: DEFAULT_SETTINGS.brand_name,
    accent_color: DEFAULT_SETTINGS.accent_color,
    hero_title_fr: DEFAULT_SETTINGS.hero_title_fr,
    hero_title_ar: DEFAULT_SETTINGS.hero_title_ar,
    hero_title_en: DEFAULT_SETTINGS.hero_title_en,
    hero_sub_fr: DEFAULT_SETTINGS.hero_sub_fr,
    hero_sub_ar: DEFAULT_SETTINGS.hero_sub_ar,
    hero_sub_en: DEFAULT_SETTINGS.hero_sub_en,
    hero_image: DEFAULT_SETTINGS.hero_image,
    hero_video: DEFAULT_SETTINGS.hero_video,
    about_fr: DEFAULT_SETTINGS.about_fr,
    about_ar: DEFAULT_SETTINGS.about_ar,
    about_en: DEFAULT_SETTINGS.about_en,
    mail_from: DEFAULT_SETTINGS.mail_from,
  };
  for (const [k, v] of Object.entries(force)) upsertSetting.run(k, v);
}

/** Contact boutique (email + WhatsApp France). */
function ensureVoltaContactDefaults() {
  const EMAIL = 'voltatech.contact@gmail.com';
  const WA = '33744141908';
  const PHONE = '+33 7 44 14 19 08';
  const targets = {
    notification_email: EMAIL,
    contact_email: EMAIL,
    whatsapp_number: WA,
    contact_phone: PHONE,
  };
  const placeholders = new Set([
    '', 'contact@example.com', '212600000000', '33600000000',
    '+33 6 00 00 00 00', '+212 6 00 00 00 00',
  ]);
  let changed = false;
  for (const [key, want] of Object.entries(targets)) {
    const cur = String((getSetting.get(key) || {}).value || '').trim();
    if (!cur || placeholders.has(cur) || cur !== want) {
      upsertSetting.run(key, want);
      changed = true;
    }
  }
  const smtpUser = String((getSetting.get('smtp_user') || {}).value || '').trim();
  if (!smtpUser || placeholders.has(smtpUser) || smtpUser.includes('example.com')) {
    upsertSetting.run('smtp_user', EMAIL);
    changed = true;
  }
  const mailFrom = String((getSetting.get('mail_from') || {}).value || '').trim();
  if (!mailFrom || mailFrom.includes('example.com') || mailFrom.includes('VOLTA')) {
    upsertSetting.run('mail_from', `HERBALIS <${EMAIL}>`);
    changed = true;
  }
  if (changed) console.log(`[db] Contact boutique: ${EMAIL} / WhatsApp ${PHONE}`);
}

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
  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`[db] Compte admin cree: "${username}" (mot de passe depuis .env)`);
}

// ---------------------------------------------------------------------------
// Seed: catalogue France (€) + photos
// ---------------------------------------------------------------------------
function insertCatalogRows(rows) {
  const insert = db.prepare(`
    INSERT INTO products
      (slug, name, name_ar, brand, category, price, old_price, stock, cpu, ram, storage, gpu, screen, os,
       short_fr, short_en, short_ar, desc_fr, desc_en, desc_ar, image, featured, active, sort_order)
    VALUES
      (@slug, @name, @name_ar, @brand, @category, @price, @old_price, @stock, @cpu, @ram, @storage, @gpu, @screen, @os,
       @short_fr, @short_en, @short_ar, @desc_fr, @desc_en, @desc_ar, @image, @featured, @active, @sort_order)
  `);
  const used = new Set();
  for (const row of rows) {
    let slug = slugifyName(row.name);
    let n = 2;
    while (used.has(slug)) slug = `${slugifyName(row.name)}-${n++}`;
    used.add(slug);
    insert.run({
      ...row,
      slug,
      name_ar: row.name_ar || '',
      short_ar: row.short_ar || '',
      desc_ar: row.desc_ar || '',
      short_en: row.short_ar || row.short_en || '',
      desc_en: row.desc_ar || row.desc_en || '',
      old_price: row.old_price == null ? null : row.old_price,
    });
  }
}

function seedFranceCatalog() {
  const catalog = require('./catalog-seed');
  insertCatalogRows(catalog);
  console.log(`[db] ${catalog.length} produits catalogue France (€) ajoutes`);
}

function ensureFranceCatalog() {
  forceFranceCurrency();
  ensureVoltaContactDefaults();
  applyHerbalisBrand();

  const version = String((getSetting.get('catalog_version') || {}).value || '');
  const pcLeftover = db.prepare(`
    SELECT COUNT(*) AS c FROM products
    WHERE category IN ('Ordinateurs','Gaming','Smartphones','PC Portable','PC Gamer','Telephone')
       OR name LIKE '%RTX%' OR name LIKE '%Galaxy%' OR name LIKE '%Dell%' OR name LIKE '%i5%'
  `).get().c;
  const total = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;

  if (version !== 'herbalis-v1' || total === 0 || pcLeftover > 0) {
    db.exec('DELETE FROM product_images; DELETE FROM products;');
    seedFranceCatalog();
    upsertSetting.run('catalog_version', 'herbalis-v1');
    console.log('[db] Catalogue HERBALIS (côlon / cheveux / respiration) chargé');
  }
}

seedAdmin();
ensureFranceCatalog();

module.exports = { db, getSetting };
