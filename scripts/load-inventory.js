'use strict';
/*
 * Charge le catalogue et passe la devise en euro.
 * Usage: node scripts/load-inventory.js
 * (Ne touche pas aux reservations ni au compte admin.)
 *
 * NOTE: les PC gamer et telephones Samsung sont des exemples pour garnir la
 * boutique. Ajuste prix / stock / specs (ou supprime) depuis l'admin.
 */
require('dotenv').config();
const store = require('../src/store');
const fs = require('fs');
const path = require('path');

const CAT_PC = 'PC Portable';
const CAT_GAMER = 'PC Gamer';
const CAT_TEL = 'Telephone';

// --- Devise + identite ---
store.setSettings({
  currency: 'EUR',
  currency_symbol: '€',
  brand_name: 'VOLTA',
  accent_color: '#0071e3',
  hero_title_fr: 'Le high-tech, simplement.',
  hero_title_en: 'Tech, made simple.',
  hero_sub_fr: 'PC portables, machines gamer et smartphones comme neufs.',
  hero_sub_en: 'Like-new laptops, gaming PCs and smartphones.',
  about_fr: 'VOLTA selectionne du high-tech comme neuf (PC portables Dell, PC gamer et smartphones Samsung) a prix justes. Pack Office et antivirus offerts sur les PC. Bases en France, reponse rapide sur WhatsApp.',
  about_en: 'VOLTA hand-picks like-new tech (Dell laptops, gaming PCs and Samsung phones) at fair prices. Free Office pack and antivirus on laptops. Based in France, quick reply on WhatsApp.',
});

// --- Purge produits existants ---
for (const p of store.listProducts()) {
  if (p.image) { try { fs.unlinkSync(path.join(__dirname, '..', 'public', 'uploads', p.image)); } catch (e) {} }
  store.deleteProduct(p.id);
}

const products = [
  // ============ PC PORTABLES (reels) ============
  {
    name: 'Dell i5 10e - 8 Go / 256 Go SSD', brand: 'Dell', category: CAT_PC, price: 199, old_price: null, stock: 1,
    cpu: 'Intel Core i5 10e generation', ram: '8 Go', storage: 'SSD 256 Go', gpu: 'Intel UHD Graphics', screen: '14" Full HD', os: '',
    short_fr: 'Etat comme neuf. Pack Office + antivirus offerts.', short_en: 'Like-new. Free Office pack + antivirus.',
    desc_fr: "PC portable Dell avec processeur Intel Core i5 10e generation, 8 Go de RAM et 256 Go de SSD, ecran 14 pouces Full HD.\n\nPossibilite d'installation du pack Office et de l'antivirus gratuitement.\nEtat comme neuf.\nN'hesitez pas a me contacter pour plus d'informations ou de photos.",
    desc_en: 'Dell laptop with 10th-gen Intel Core i5, 8 GB RAM and 256 GB SSD, 14-inch Full HD display. Free Office pack and antivirus available. Like-new condition.',
    featured: 1, active: 1, sort_order: 1,
  },
  {
    name: 'Dell Latitude 5410 - i5 10e / 16 Go', brand: 'Dell', category: CAT_PC, price: 230, old_price: null, stock: 1,
    cpu: 'Intel Core i5 10e generation', ram: '16 Go', storage: 'SSD 256 Go', gpu: 'Intel UHD Graphics', screen: '14" Full HD', os: '',
    short_fr: 'Comme neuf. 16 Go de RAM. Pack Office offert.', short_en: 'Like-new. 16 GB RAM. Free Office pack.',
    desc_fr: "PC portable Dell Latitude 5410 avec processeur Intel Core i5 10e generation, 16 Go de RAM et 256 Go de SSD, ecran 14 pouces Full HD.\n\nPossibilite d'installation du pack Office et de l'antivirus gratuitement.\nEtat comme neuf.",
    desc_en: 'Dell Latitude 5410 with 10th-gen Intel Core i5, 16 GB RAM and 256 GB SSD, 14-inch Full HD display. Free Office pack. Like-new condition.',
    featured: 1, active: 1, sort_order: 2,
  },
  {
    name: 'Dell i5 10e Tactile - 16 Go (ou 8 Go)', brand: 'Dell', category: CAT_PC, price: 239, old_price: null, stock: 1,
    cpu: 'Intel Core i5 10e generation', ram: '16 Go (ou 8 Go)', storage: 'SSD 256 Go', gpu: 'Intel UHD Graphics', screen: '14" tactile', os: '',
    short_fr: 'Ecran tactile. Polyvalent. Comme neuf.', short_en: 'Touchscreen. Versatile. Like-new.',
    desc_fr: "PC portable Dell tactile avec processeur Intel Core i5 10e generation, 16 Go de RAM (ou 8 Go) et 256 Go de SSD, ecran tactile.\n\nUsage polyvalent. Pack Office et antivirus installes gratuitement.\nEtat comme neuf.",
    desc_en: 'Touchscreen Dell laptop with 10th-gen Intel Core i5, 16 GB RAM (or 8 GB) and 256 GB SSD. Free Office pack. Like-new condition.',
    featured: 1, active: 1, sort_order: 3,
  },

  // ============ PC GAMER (exemples a ajuster) ============
  {
    name: 'Acer Nitro 5 - Gaming RTX 2060', brand: 'Acer', category: CAT_GAMER, price: 519, old_price: 599, stock: 1,
    cpu: 'Intel Core i5', ram: '16 Go', storage: 'SSD 512 Go', gpu: 'NVIDIA GeForce RTX 2060', screen: '15.6" 144 Hz', os: '',
    short_fr: 'Entree de gamme gaming, ecran 144 Hz.', short_en: 'Entry gaming, 144 Hz screen.',
    desc_fr: 'Acer Nitro 5, PC portable gamer avec NVIDIA RTX 2060, 16 Go de RAM et 512 Go de SSD, ecran 144 Hz.\nEtat comme neuf.',
    desc_en: 'Acer Nitro 5 gaming laptop with RTX 2060, 16 GB RAM and 512 GB SSD, 144 Hz screen. Like-new.',
    featured: 0, active: 1, sort_order: 4,
  },
  {
    name: 'HP Victus - Gaming RTX 2060', brand: 'HP', category: CAT_GAMER, price: 549, old_price: null, stock: 1,
    cpu: 'AMD Ryzen 5', ram: '16 Go', storage: 'SSD 512 Go', gpu: 'NVIDIA GeForce RTX 2060', screen: '16.1" Full HD', os: '',
    short_fr: 'Gamer sobre et efficace, RTX 2060.', short_en: 'Clean and efficient gamer, RTX 2060.',
    desc_fr: 'HP Victus, PC portable gamer avec NVIDIA RTX 2060, 16 Go de RAM et 512 Go de SSD.\nEtat comme neuf.',
    desc_en: 'HP Victus gaming laptop with RTX 2060, 16 GB RAM and 512 GB SSD. Like-new.',
    featured: 0, active: 1, sort_order: 5,
  },
  {
    name: 'Predator Helios 300 - Gaming RTX 2070', brand: 'Acer', category: CAT_GAMER, price: 599, old_price: 699, stock: 1,
    cpu: 'Intel Core i7', ram: '16 Go', storage: 'SSD 1 To', gpu: 'NVIDIA GeForce RTX 2070', screen: '15.6" 144 Hz', os: '',
    short_fr: 'Machine de guerre gaming. RTX 2070.', short_en: 'Gaming beast. RTX 2070.',
    desc_fr: 'Acer Predator Helios 300, PC portable gamer avec NVIDIA RTX 2070, 16 Go de RAM et 1 To de SSD.\nParfait pour le jeu haute definition et la creation. Etat comme neuf.',
    desc_en: 'Acer Predator Helios 300 with RTX 2070, 16 GB RAM and 1 TB SSD. Like-new.',
    featured: 1, active: 1, sort_order: 6,
  },
  {
    name: 'MSI Leopard - Gaming RTX 2070', brand: 'MSI', category: CAT_GAMER, price: 579, old_price: 679, stock: 1,
    cpu: 'Intel Core i7', ram: '16 Go', storage: 'SSD 1 To', gpu: 'NVIDIA GeForce RTX 2070', screen: '15.6" 144 Hz', os: '',
    short_fr: 'Gamer nerveux. RTX 2070, 1 To SSD.', short_en: 'Fast gamer. RTX 2070, 1 TB SSD.',
    desc_fr: 'MSI Leopard, PC portable gamer avec NVIDIA RTX 2070, 16 Go de RAM et 1 To de SSD (meme config que le Predator Helios 300).\nEtat comme neuf.',
    desc_en: 'MSI Leopard with RTX 2070, 16 GB RAM and 1 TB SSD. Like-new.',
    featured: 0, active: 1, sort_order: 7,
  },
  {
    name: 'ASUS TUF Gaming - RTX 3060', brand: 'Asus', category: CAT_GAMER, price: 699, old_price: 799, stock: 1,
    cpu: 'AMD Ryzen 7', ram: '16 Go', storage: 'SSD 512 Go', gpu: 'NVIDIA GeForce RTX 3060', screen: '15.6" 144 Hz', os: '',
    short_fr: 'Robuste et puissant, RTX 3060.', short_en: 'Rugged and powerful, RTX 3060.',
    desc_fr: 'ASUS TUF Gaming, PC portable gamer avec NVIDIA RTX 3060, 16 Go de RAM et 512 Go de SSD, ecran 144 Hz.\nEtat comme neuf.',
    desc_en: 'ASUS TUF Gaming with RTX 3060, 16 GB RAM and 512 GB SSD, 144 Hz. Like-new.',
    featured: 1, active: 1, sort_order: 8,
  },
  {
    name: 'Lenovo Legion 5 - RTX 3060', brand: 'Lenovo', category: CAT_GAMER, price: 749, old_price: 849, stock: 1,
    cpu: 'AMD Ryzen 7', ram: '16 Go', storage: 'SSD 1 To', gpu: 'NVIDIA GeForce RTX 3060', screen: '15.6" 165 Hz', os: '',
    short_fr: 'Le meilleur du gaming abordable. 165 Hz.', short_en: 'Best of affordable gaming. 165 Hz.',
    desc_fr: 'Lenovo Legion 5, PC portable gamer avec NVIDIA RTX 3060, 16 Go de RAM et 1 To de SSD, ecran 165 Hz.\nEtat comme neuf.',
    desc_en: 'Lenovo Legion 5 with RTX 3060, 16 GB RAM and 1 TB SSD, 165 Hz. Like-new.',
    featured: 1, active: 1, sort_order: 9,
  },

  // ============ TELEPHONES SAMSUNG (exemples a ajuster) ============
  {
    name: 'Samsung Galaxy A54 5G - 128 Go', brand: 'Samsung', category: CAT_TEL, price: 249, old_price: 299, stock: 1,
    cpu: 'Exynos 1380', ram: '8 Go', storage: '128 Go', gpu: '', screen: '6.4" Super AMOLED 120 Hz', os: 'Android',
    short_fr: 'Le best-seller milieu de gamme, 5G.', short_en: 'Mid-range best-seller, 5G.',
    desc_fr: 'Samsung Galaxy A54 5G, 8 Go de RAM et 128 Go de stockage, ecran 6.4" Super AMOLED 120 Hz.\nEtat comme neuf, avec accessoires.',
    desc_en: 'Samsung Galaxy A54 5G, 8 GB RAM and 128 GB storage, 6.4" Super AMOLED 120 Hz. Like-new.',
    featured: 0, active: 1, sort_order: 10,
  },
  {
    name: 'Samsung Galaxy S20 FE - 128 Go', brand: 'Samsung', category: CAT_TEL, price: 219, old_price: 279, stock: 1,
    cpu: 'Qualcomm Snapdragon', ram: '6 Go', storage: '128 Go', gpu: '', screen: '6.5" Super AMOLED 120 Hz', os: 'Android',
    short_fr: 'Flagship malin, ecran 120 Hz.', short_en: 'Smart flagship, 120 Hz.',
    desc_fr: 'Samsung Galaxy S20 FE, 6 Go de RAM et 128 Go de stockage, ecran 6.5" 120 Hz.\nEtat comme neuf.',
    desc_en: 'Samsung Galaxy S20 FE, 6 GB RAM and 128 GB storage, 6.5" 120 Hz. Like-new.',
    featured: 0, active: 1, sort_order: 11,
  },
  {
    name: 'Samsung Galaxy S21 - 128 Go', brand: 'Samsung', category: CAT_TEL, price: 299, old_price: 379, stock: 1,
    cpu: 'Exynos 2100', ram: '8 Go', storage: '128 Go', gpu: '', screen: '6.2" Dynamic AMOLED 120 Hz', os: 'Android',
    short_fr: 'Flagship compact et rapide.', short_en: 'Compact, fast flagship.',
    desc_fr: 'Samsung Galaxy S21, 8 Go de RAM et 128 Go de stockage, ecran 6.2" Dynamic AMOLED 120 Hz.\nEtat comme neuf.',
    desc_en: 'Samsung Galaxy S21, 8 GB RAM and 128 GB storage, 6.2" Dynamic AMOLED 120 Hz. Like-new.',
    featured: 1, active: 1, sort_order: 12,
  },
  {
    name: 'Samsung Galaxy S22 - 128 Go', brand: 'Samsung', category: CAT_TEL, price: 379, old_price: 459, stock: 1,
    cpu: 'Qualcomm Snapdragon 8 Gen 1', ram: '8 Go', storage: '128 Go', gpu: '', screen: '6.1" Dynamic AMOLED 120 Hz', os: 'Android',
    short_fr: 'Premium, photo au top.', short_en: 'Premium, great camera.',
    desc_fr: 'Samsung Galaxy S22, 8 Go de RAM et 128 Go de stockage, ecran 6.1" Dynamic AMOLED 120 Hz.\nEtat comme neuf.',
    desc_en: 'Samsung Galaxy S22, 8 GB RAM and 128 GB storage, 6.1" Dynamic AMOLED 120 Hz. Like-new.',
    featured: 1, active: 1, sort_order: 13,
  },
];

for (const p of products) store.createProduct(p);

const cats = store.listCategories();
console.log('Catalogue charge:', store.listProducts().length, 'produits.');
console.log('Categories:', cats.map((c) => `${c.category} (${c.n})`).join(', '));
