'use strict';
/*
 * Recharge le catalogue HERBALIS (côlon, cheveux, respiration).
 * Usage: node scripts/load-inventory.js
 */
require('dotenv').config();
const store = require('../src/store');
const catalog = require('../src/catalog-seed');

store.setSettings({
  currency: 'EUR',
  currency_symbol: '€',
  brand_name: 'HERBALIS',
  accent_color: '#2E8B57',
  catalog_version: 'herbalis-v1',
  hero_title_fr: 'La santé naturelle, simplement.',
  hero_title_ar: 'الصحة الطبيعية، ببساطة.',
  hero_sub_fr: 'Compléments naturels ciblés pour le confort intestinal et la vitalité capillaire. Formules concentrées, fabriquées en France.',
  hero_sub_ar: 'مكملات طبيعية موجّهة لراحة الأمعاء وحيوية الشعر. صيغ مركّزة، مصنوعة في فرنسا.',
  about_fr: 'HERBALIS formule des compléments ciblés : côlon, anti-chute, confort respiratoire. Fabrication française.',
  about_ar: 'هيرباليس يصيغ مكمّلات موجّهة: القولون، مكافحة التساقط، الراحة التنفسية. تصنيع فرنسي.',
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

console.log(catalog.length + ' produits HERBALIS charges.');
