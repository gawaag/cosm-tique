'use strict';

/** Secret atelier path. Change via ADMIN_PATH in .env — never linked from the public site. */
const DEFAULT_ADMIN_PATH = '/atelier-miichabat-7k2';

const RESERVED = new Set([
  '/', '/admin', '/produits', '/produit', '/panier', '/contact',
  '/a-propos', '/mentions-legales', '/confidentialite', '/lang',
  '/static', '/uploads', '/robots.txt', '/sitemap.xml',
]);

function resolveAdminPath() {
  let raw = String(process.env.ADMIN_PATH || DEFAULT_ADMIN_PATH).trim();
  if (!raw) raw = DEFAULT_ADMIN_PATH;
  if (!raw.startsWith('/')) raw = '/' + raw;
  raw = raw.replace(/\/+$/, '') || DEFAULT_ADMIN_PATH;
  const lower = raw.toLowerCase();
  if (RESERVED.has(lower) || lower.startsWith('/admin/') || lower.startsWith('/produit/')) {
    return DEFAULT_ADMIN_PATH;
  }
  return raw;
}

module.exports = { DEFAULT_ADMIN_PATH, resolveAdminPath };
