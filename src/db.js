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
  whatsapp_number: '212600000000', // format international sans "+" ni espaces
  contact_email: 'contact@example.com',
  notification_email: '',
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: '',
  smtp_pass: '',
  mail_from: '',
  whatsapp_notify: '1',
  callmebot_apikey: '',
  notify_webhook_url: '',
  contact_phone: '+212 6 00 00 00 00',
  hero_title_fr: 'Le high-tech, simplement.',
  hero_title_en: 'Tech, made simple.',
  hero_sub_fr: 'PC portables, machines gamer et smartphones comme neufs.',
  hero_sub_en: 'Like-new laptops, gaming PCs and smartphones.',
  about_fr: "VOLTA, c’est 3 ans d’expérience dans le high-tech comme neuf. Nous travaillons avec des fournisseurs de confiance. Toutes les pièces sont et seront testées lors de la vente — en appel vidéo ou en main propre à Montrouge (92120), Île-de-France. Paiements sécurisés via Leboncoin, eBay Marketplace ou PayPal.",
  about_en: "VOLTA has 3 years of experience in like-new tech. We work with trusted suppliers. Every part is and will be tested at sale — on a video call or in person in Montrouge (92120), Île-de-France. Secure payments via Leboncoin, eBay Marketplace or PayPal.",
  currency: 'MAD',
  currency_symbol: 'DH',
  cfg_storage_step_gb: '256',
  cfg_storage_step_price: '40',
  cfg_storage_max_steps: '3',
  cfg_ram_upgrade_price: '25',
  cfg_ram_downgrade_price: '15',
};

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

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
// Seed: sample products
// ---------------------------------------------------------------------------
function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return;
  const insert = db.prepare(`
    INSERT INTO products
      (slug, name, brand, price, old_price, stock, cpu, ram, storage, gpu, screen, os,
       short_fr, short_en, desc_fr, desc_en, image, featured, active, sort_order)
    VALUES
      (@slug, @name, @brand, @price, @old_price, @stock, @cpu, @ram, @storage, @gpu, @screen, @os,
       @short_fr, @short_en, @desc_fr, @desc_en, @image, @featured, @active, @sort_order)
  `);
  const samples = [
    {
      slug: 'probook-z15', name: 'ProBook Z15', brand: 'HP', price: 6290, old_price: 6990, stock: 8,
      cpu: 'Intel Core i7-1165G7', ram: '16 Go DDR4', storage: 'SSD 512 Go NVMe', gpu: 'Intel Iris Xe',
      screen: '15.6" Full HD IPS', os: 'Windows 11 Pro',
      short_fr: 'Ultraportable pro, autonomie et securite.', short_en: 'Pro ultrabook, battery life and security.',
      desc_fr: "Le ProBook Z15 combine puissance et mobilite pour les professionnels exigeants.",
      desc_en: 'The ProBook Z15 blends power and mobility for demanding professionals.',
      image: '', featured: 1, active: 1, sort_order: 1,
    },
    {
      slug: 'pc-portable-ar', name: 'PC Portable AR', brand: 'Asus', price: 5490, old_price: null, stock: 12,
      cpu: 'Intel Core i7-1255U', ram: '16 Go DDR4', storage: 'SSD 512 Go NVMe', gpu: 'Intel Iris Xe',
      screen: '14" Full HD', os: 'Windows 11',
      short_fr: 'Leger et polyvalent pour le quotidien.', short_en: 'Light and versatile for everyday use.',
      desc_fr: 'Un portable equilibre, ideal pour le travail et les etudes.',
      desc_en: 'A balanced laptop, ideal for work and studies.',
      image: '', featured: 1, active: 1, sort_order: 2,
    },
    {
      slug: 'gamer-rtx-17', name: 'Gamer RTX 17', brand: 'MSI', price: 12990, old_price: 13990, stock: 4,
      cpu: 'Intel Core i9-13900H', ram: '32 Go DDR5', storage: 'SSD 1 To NVMe', gpu: 'NVIDIA RTX 4070 8 Go',
      screen: '17.3" QHD 165 Hz', os: 'Windows 11',
      short_fr: 'Machine de jeu, ecran 165 Hz et RTX 4070.', short_en: 'Gaming machine, 165 Hz screen and RTX 4070.',
      desc_fr: 'Performances extremes pour le gaming et la creation 3D.',
      desc_en: 'Extreme performance for gaming and 3D creation.',
      image: '', featured: 1, active: 1, sort_order: 3,
    },
    {
      slug: 'ultra-thin-13', name: 'UltraThin 13', brand: 'Dell', price: 7490, old_price: null, stock: 6,
      cpu: 'Intel Core i5-1340P', ram: '16 Go LPDDR5', storage: 'SSD 512 Go NVMe', gpu: 'Intel Iris Xe',
      screen: '13.4" 2.5K tactile', os: 'Windows 11',
      short_fr: 'Compact, ecran 2.5K tactile.', short_en: 'Compact, 2.5K touch display.',
      desc_fr: 'Design fin et premium, parfait pour la mobilite.',
      desc_en: 'Slim premium design, perfect for mobility.',
      image: '', featured: 0, active: 1, sort_order: 4,
    },
  ];
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  tx(samples);
  console.log(`[db] ${samples.length} produits de demonstration ajoutes`);
}

seedAdmin();
seedProducts();

module.exports = { db, getSetting };
