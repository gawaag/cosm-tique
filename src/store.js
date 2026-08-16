'use strict';

const { db } = require('./db');

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
function setSetting(key, value) {
  upsertSetting.run(key, value == null ? '' : String(value));
}
function setSettings(obj) {
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) upsertSetting.run(k, v == null ? '' : String(v));
  });
  tx(Object.entries(obj));
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
function listProducts({ activeOnly = false, featuredOnly = false, category = null } = {}) {
  let sql = 'SELECT * FROM products';
  const where = [];
  const params = [];
  if (activeOnly) where.push('active = 1');
  if (featuredOnly) where.push('featured = 1');
  if (category) { where.push('category = ?'); params.push(category); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY sort_order ASC, id ASC';
  return db.prepare(sql).all(...params);
}

function listCategories({ activeOnly = true } = {}) {
  const sql = `SELECT category, COUNT(*) AS n FROM products ${activeOnly ? 'WHERE active = 1' : ''} GROUP BY category ORDER BY MIN(sort_order), category`;
  return db.prepare(sql).all().filter((r) => r.category);
}

function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}
function getProductBySlug(slug) {
  return db.prepare('SELECT * FROM products WHERE slug = ?').get(slug);
}
function getProductImages(productId) {
  return db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id').all(productId);
}

function slugify(str) {
  return String(str)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'produit';
}

function uniqueSlug(base, excludeId = null) {
  let slug = slugify(base);
  let candidate = slug;
  let n = 2;
  while (true) {
    const row = db.prepare('SELECT id FROM products WHERE slug = ?').get(candidate);
    if (!row || row.id === excludeId) return candidate;
    candidate = `${slug}-${n++}`;
  }
}

const productCols = ['name','name_ar','brand','category','price','old_price','stock','cpu','ram','storage','gpu','screen','os','short_fr','short_en','short_ar','desc_fr','desc_en','desc_ar','image','featured','active','sort_order'];

function createProduct(data) {
  const slug = uniqueSlug(data.name || 'produit');
  const stmt = db.prepare(`
    INSERT INTO products (slug, ${productCols.join(', ')})
    VALUES (@slug, ${productCols.map((c) => '@' + c).join(', ')})
  `);
  const row = { slug };
  for (const c of productCols) row[c] = data[c] ?? (['old_price'].includes(c) ? null : (typeof (data[c]) === 'number' ? 0 : ''));
  const info = stmt.run(row);
  return info.lastInsertRowid;
}

function updateProduct(id, data) {
  const current = getProductById(id);
  if (!current) return false;
  let slug = current.slug;
  if (data.name && data.name !== current.name) slug = uniqueSlug(data.name, id);
  const stmt = db.prepare(`
    UPDATE products SET slug=@slug, ${productCols.map((c) => `${c}=@${c}`).join(', ')}
    WHERE id=@id
  `);
  const row = { id, slug };
  for (const c of productCols) row[c] = data[c] ?? current[c];
  stmt.run(row);
  return true;
}

function deleteProduct(id) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
}

function addProductImage(productId, filename) {
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM product_images WHERE product_id = ?').get(productId).m;
  return db.prepare('INSERT INTO product_images (product_id, filename, sort_order) VALUES (?, ?, ?)').run(productId, filename, max + 1).lastInsertRowid;
}
function deleteProductImage(id) {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ?').get(id);
  db.prepare('DELETE FROM product_images WHERE id = ?').run(id);
  return img;
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
function createReservation({ customer_name, phone, email, message, type, items, offer_total }) {
  const tx = db.transaction(() => {
    let offerTotal = (offer_total != null) ? offer_total : null;
    for (const it of items) {
      if (it.offer_price != null) offerTotal = (offerTotal || 0) + it.offer_price * it.quantity;
    }
    const info = db.prepare(`
      INSERT INTO reservations (customer_name, phone, email, message, offer_total, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(customer_name, phone, email || '', message || '', offerTotal, type || 'reservation');
    const rid = info.lastInsertRowid;
    const insItem = db.prepare(`
      INSERT INTO reservation_items (reservation_id, product_id, product_name, unit_price, quantity, offer_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const it of items) {
      insItem.run(rid, it.product_id || null, it.product_name, it.unit_price || 0, it.quantity || 1, it.offer_price ?? null);
    }
    return rid;
  });
  return tx();
}

function listReservations({ limit = null } = {}) {
  let sql = 'SELECT * FROM reservations ORDER BY created_at DESC, id DESC';
  if (limit) sql += ' LIMIT ' + Number(limit);
  const reservations = db.prepare(sql).all();
  const itemsStmt = db.prepare('SELECT * FROM reservation_items WHERE reservation_id = ?');
  for (const r of reservations) r.items = itemsStmt.all(r.id);
  return reservations;
}

function getReservation(id) {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (r) r.items = db.prepare('SELECT * FROM reservation_items WHERE reservation_id = ?').all(id);
  return r;
}

function setReservationStatus(id, status) {
  return db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(status, id).changes > 0;
}
function deleteReservation(id) {
  return db.prepare('DELETE FROM reservations WHERE id = ?').run(id).changes > 0;
}

function countReservationsByStatus() {
  const rows = db.prepare('SELECT status, COUNT(*) AS c FROM reservations GROUP BY status').all();
  const out = { nouveau: 0, traite: 0, annule: 0 };
  for (const r of rows) out[r.status] = r.c;
  return out;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
function getAdminByUsername(username) {
  return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
}
function getAdminById(id) {
  return db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
}
function updateAdminPassword(id, hash) {
  return db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, id).changes > 0;
}

module.exports = {
  getSettings, setSetting, setSettings,
  listProducts, listCategories, getProductById, getProductBySlug, getProductImages,
  createProduct, updateProduct, deleteProduct,
  addProductImage, deleteProductImage,
  createReservation, listReservations, getReservation, setReservationStatus,
  deleteReservation, countReservationsByStatus,
  getAdminByUsername, getAdminById, updateAdminPassword,
};
