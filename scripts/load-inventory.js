'use strict';
/*
 * Recharge le catalogue معشبة الأطلس (miel, côlon, cheveux, asthme, packs).
 * Usage: node scripts/load-inventory.js
 */
require('dotenv').config();
const store = require('../src/store');
const catalog = require('../src/catalog-seed');

store.setSettings({
  currency: 'MAD',
  currency_symbol: 'د.م.',
  brand_name: 'معشبة الأطلس',
  brand_latin: 'Maachabat Al Atlas',
  accent_color: '#2E8B57',
  catalog_version: 'maachabat-atlas-v1',
  hero_title_fr: 'Les plantes, simplement.',
  hero_title_ar: 'الأعشاب، ببساطة.',
  hero_sub_fr: 'Miel naturel, côlon, cheveux et asthme. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs. Paiement à la livraison.',
  hero_sub_ar: 'عسل حر، راحة القولون، كثافة الشعر، ونفس مرتاح. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المدن. الدفع عند الاستلام.',
  about_fr: 'معشبة الأطلس (Maachabat Al Atlas) propose quatre formules naturelles : miel, côlon, cheveux, asthme. Packs à tarif lot. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs.',
  about_ar: 'معشبة الأطلس (Maachabat Al Atlas) أربع صيغ طبيعية: عسل، قولون، شعر، ربو. باقات بسعر الجملة. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المدن.',
});

for (const p of store.listProducts()) {
  store.deleteProduct(p.id);
}

for (const row of catalog) {
  store.createProduct({
    ...row,
    short_en: row.short_ar || '',
    desc_en: row.desc_ar || '',
  });
}

console.log(catalog.length + ' produits معشبة الأطلس charges.');
