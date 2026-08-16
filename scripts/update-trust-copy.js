'use strict';
require('dotenv').config();
const { db } = require('../src/db');

const aboutFr = "HERBALIS formule des compléments ciblés : confort du côlon et du microbiote, anti-chute et pousse capillaire, confort des voies respiratoires. Gélules végétales, fabrication française. Paiement sécurisé (CB, Apple Pay), livraison 48 h, satisfait ou remboursé 30 jours.";
const aboutAr = "هيرباليس يصيغ مكمّلات موجّهة: راحة القولون والميكروبيوتا، مكافحة التساقط، وراحة الجهاز التنفسي. كبسولات نباتية، تصنيع فرنسي. دفع آمن، توصيل 48 ساعة، رضا أو استرداد 30 يوماً.";

const upsert = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
upsert.run('about_fr', aboutFr);
upsert.run('about_ar', aboutAr);
upsert.run('brand_name', 'HERBALIS');
console.log('Trust copy HERBALIS mise a jour.');
