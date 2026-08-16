'use strict';
/*
 * Recharge le catalogue معشبة الأطلس (côlon 3 poids, cheveux, pack).
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
  catalog_version: 'maachabat-colon-v1',
  hero_image: 'hero-atlas-colon.png',
  hero_title_fr: 'Les plantes, simplement.',
  hero_title_ar: 'الأعشاب، ببساطة.',
  hero_sub_fr: 'Miel du côlon, anti-chute et packs. Boutique au Maroc. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs. Paiement à la livraison.',
  hero_sub_ar: 'عسل راحة القولون، كثافة الشعر، وباقات. متجر في المغرب. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المدن. الدفع عند الاستلام.',
  about_fr: 'معشبة الأطلس (Maachabat Al Atlas) est une boutique au Maroc : miel de confort du côlon (250 g, 500 g, 1 kg), anti-chute, et pack côlon + cheveux. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs.',
  about_ar: 'معشبة الأطلس (Maachabat Al Atlas) متجر في المغرب: عسل راحة القولون (250 غ، 500 غ، 1 كغ)، مكافحة التساقط، وباقة القولون والشعر. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المدن.',
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
