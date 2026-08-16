'use strict';
require('dotenv').config();
const { db } = require('../src/db');

const aboutFr = "معشبات الأطلس (Miichabat Al Atlas) propose quatre formules naturelles : miel brut, confort du côlon, anti-chute, et confort respiratoire. Packs à tarif lot. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs. Paiement à la livraison.";
const aboutAr = "معشبات الأطلس (Miichabat Al Atlas) أربع صيغ طبيعية: عسل حر، راحة القولون، مكافحة تساقط الشعر، وراحة التنفس. باقات بسعر الجملة. توصيل 24 ساعة الرباط وسلا والبيضاء، 48 ساعة باقي المغرب. الدفع عند الاستلام.";

const upsert = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
upsert.run('about_fr', aboutFr);
upsert.run('about_ar', aboutAr);
upsert.run('brand_name', 'معشبات الأطلس');
upsert.run('brand_latin', 'Miichabat Al Atlas');
console.log('Trust copy معشبات الأطلس mise a jour.');
