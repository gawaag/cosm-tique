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
  category       TEXT NOT NULL DEFAULT 'PC Portable',
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
    db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'PC Portable'");
    console.log('[db] migration: colonne "category" ajoutee aux produits');
  }
})();

// ---------------------------------------------------------------------------
// Seed: settings
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  brand_name: 'VOLTA',
  accent_color: '#0071e3',
  whatsapp_number: '33744141908', // +33 7 44 14 19 08 (sans + ni espaces)
  contact_email: 'voltatech.contact@gmail.com',
  notification_email: 'voltatech.contact@gmail.com',
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: 'voltatech.contact@gmail.com',
  smtp_pass: '',
  mail_from: 'VOLTA <voltatech.contact@gmail.com>',
  whatsapp_notify: '1',
  callmebot_apikey: '',
  notify_webhook_url: '',
  contact_phone: '+33 7 44 14 19 08',
  hero_title_fr: 'Le high-tech, simplement.',
  hero_title_en: 'Tech, made simple.',
  hero_sub_fr: 'PC portables, machines gamer et smartphones comme neufs. Vente France uniquement.',
  hero_sub_en: 'Like-new laptops, gaming PCs and smartphones. France sales only.',
  about_fr: "VOLTA, c’est 3 ans d’expérience dans le high-tech comme neuf. Nous travaillons avec des fournisseurs de confiance. Toutes les pièces sont et seront testées lors de la vente — en appel vidéo ou en main propre à Montrouge (92120), Île-de-France. Paiements sécurisés via Leboncoin, eBay Marketplace ou PayPal. Vente exclusivement en France.",
  about_en: "VOLTA has 3 years of experience in like-new tech. We work with trusted suppliers. Every part is and will be tested at sale — on a video call or in person in Montrouge (92120), Île-de-France. Secure payments via Leboncoin, eBay Marketplace or PayPal. France sales only.",
  currency: 'EUR',
  currency_symbol: '€',
  cfg_storage_step_gb: '256',
  cfg_storage_step_price: '40',
  cfg_storage_max_steps: '3',
  cfg_ram_upgrade_price: '25',
  cfg_ram_downgrade_price: '15',
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

/** Contact / réservations VOLTA (email + WhatsApp France). */
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
      // Toujours aligner sur le contact boutique (email réservations + WhatsApp).
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
  if (!mailFrom || mailFrom.includes('example.com')) {
    upsertSetting.run('mail_from', `VOLTA <${EMAIL}>`);
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
      (slug, name, brand, category, price, old_price, stock, cpu, ram, storage, gpu, screen, os,
       short_fr, short_en, desc_fr, desc_en, image, featured, active, sort_order)
    VALUES
      (@slug, @name, @brand, @category, @price, @old_price, @stock, @cpu, @ram, @storage, @gpu, @screen, @os,
       @short_fr, @short_en, @desc_fr, @desc_en, @image, @featured, @active, @sort_order)
  `);
  const used = new Set();
  for (const row of rows) {
    let slug = slugifyName(row.name);
    let n = 2;
    while (used.has(slug)) slug = `${slugifyName(row.name)}-${n++}`;
    used.add(slug);
    insert.run({ ...row, slug, old_price: row.old_price == null ? null : row.old_price });
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

  const demo = db.prepare(`
    SELECT COUNT(*) AS c FROM products
    WHERE slug IN ('probook-z15','pc-portable-ar','gamer-rtx-17','ultra-thin-13')
       OR price >= 5000
  `).get().c;
  const total = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const noImages = db.prepare(`
    SELECT COUNT(*) AS c FROM products WHERE active = 1 AND (image IS NULL OR image = '')
  `).get().c;

  if (total === 0 || demo > 0 || (total > 0 && noImages === total)) {
    db.exec('DELETE FROM product_images; DELETE FROM products;');
    seedFranceCatalog();
  }

  // Strictement vendus : S22 + Acer Nitro
  const sold = db.prepare(`
    UPDATE products SET stock = 0,
      short_fr = CASE WHEN short_fr LIKE 'Vendu%' THEN short_fr ELSE 'Vendu — plus disponible.' END,
      short_en = CASE WHEN short_en LIKE 'Sold%' THEN short_en ELSE 'Sold — no longer available.' END
    WHERE name LIKE '%S22%' OR name LIKE '%Nitro 5%'
  `).run();
  if (sold.changes) console.log(`[db] ${sold.changes} produit(s) marques vendus (S22 / Nitro)`);
}

seedAdmin();
ensureFranceCatalog();

module.exports = { db, getSetting };
