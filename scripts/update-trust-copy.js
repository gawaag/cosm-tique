'use strict';
require('dotenv').config();
const { db } = require('../src/db');

const aboutFr = "معشبة الأطلس (Maachabat Al Atlas) est une boutique au Maroc : miel de confort du côlon (250 g, 500 g, 1 kg), anti-chute, et pack côlon + cheveux. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs. Paiement à la livraison.";
const aboutAr = "معشبة الأطلس (Maachabat Al Atlas) متجر في المغرب: عسل راحة القولون، مكافحة تساقط الشعر، وباقة القولون والشعر. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المغرب. الدفع عند الاستلام.";

const upsert = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
upsert.run('about_fr', aboutFr);
upsert.run('about_ar', aboutAr);
upsert.run('brand_name', 'معشبة الأطلس');
upsert.run('brand_latin', 'Maachabat Al Atlas');
console.log('Trust copy معشبة الأطلس mise a jour.');
