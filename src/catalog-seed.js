'use strict';

const BRAND = 'معشبة الأطلس';

const COLON_POSO_FR = 'Une cuillère 2 fois par jour, 30 min avant chaque repas, matin et soir.';
const COLON_POSO_AR = 'ملعقة مرتين في اليوم، 30 دقيقة قبل الأكل، صباحاً ومساءً.';

function colonSku({ slug, cpu, price, old_price, sort_order }) {
  return {
    slug,
    name: 'Confort côlon',
    name_ar: 'راحة القولون',
    brand: BRAND,
    category: 'colon',
    price,
    old_price,
    stock: 64,
    cpu,
    ram: 'Cure',
    storage: 'عسل حر، نباتات الأطلس',
    gpu: 'المغرب',
    screen: '100% Naturel|Vegan',
    os: COLON_POSO_FR,
    short_fr: `Miel de confort du côlon, format ${cpu}.`,
    short_ar: `عسل راحة القولون، وزن ${cpu}.`,
    desc_fr: `Miel naturel pour le confort du côlon et la digestion. Format ${cpu}. Posologie : ${COLON_POSO_FR} Beaucoup d'eau. Avis médical si douleur persistante.`,
    desc_ar: `عسل حر لراحة القولون والهضم. الوزن ${cpu}. الجرعة: ${COLON_POSO_AR} ماء كثير. استشارة طبية إذا استمر الألم.`,
    image: 'honey-hero.png',
    featured: 1,
    active: 1,
    sort_order,
  };
}

/** 5 produits uniquement : côlon 250 g / 500 g / 1 kg, anti-chute, pack. Prix MAD. */
module.exports = [
  colonSku({ slug: 'confort-colon-250g', cpu: '250 g', price: 199, old_price: 229, sort_order: 1 }),
  colonSku({ slug: 'confort-colon-500g', cpu: '500 g', price: 299, old_price: 380, sort_order: 2 }),
  colonSku({ slug: 'confort-colon-1kg', cpu: '1 kg', price: 499, old_price: 599, sort_order: 3 }),
  {
    slug: 'anti-chute',
    name: 'Anti-chute', name_ar: 'كثافة الشعر',
    brand: BRAND, category: 'hair', price: 199, old_price: 249, stock: 70,
    cpu: '90 gélules', ram: 'Cure', storage: 'Biotine, zinc, millet',
    gpu: 'المغرب', screen: '100% Naturel|Vegan', os: '1 gélule au petit-déjeuner',
    short_fr: 'Chute de cheveux, biotine et zinc.',
    short_ar: 'تساقط الشعر، بيوتين وزنك.',
    desc_fr: 'Biotine, zinc et millet pour cheveux qui tombent au lavage. Comptez 8 à 12 semaines. Ne remplace pas un traitement prescrit.',
    desc_ar: 'بيوتين وزنك ودخن للشعر اللي كيطاح فالغسيل. 8 إلى 12 أسبوع. ما كيعوّضش علاج موصوف.',
    image: 'p-hair-biotin.png', featured: 1, active: 1, sort_order: 4,
  },
  {
    slug: 'pack-colon-cheveux',
    name: 'Pack côlon + cheveux', name_ar: 'باقة القولون والشعر',
    brand: BRAND, category: 'packs', price: 349, old_price: 428, stock: 28,
    cpu: '2 formules', ram: 'Cure', storage: 'راحة القولون + كثافة الشعر',
    gpu: 'المغرب', screen: '100% Naturel|Vegan', os: 'Suivre chaque formule',
    short_fr: 'Duo ventre et chute de cheveux.',
    short_ar: 'ثنائي البطن وتساقط الشعر.',
    desc_fr: 'Les deux formules côlon et cheveux, tarif lot. Livraison 24 h Rabat / Salé / Casa, 48 h ailleurs. Boutique au Maroc.',
    desc_ar: 'صيغتا القولون والشعر بسعر الجملة. توصيل 24 ساعة الرباط سلا البيضاء، 48 ساعة باقي المدن. متجر في المغرب.',
    image: 'p-pack-cure.png', featured: 1, active: 1, sort_order: 5,
  },
];
