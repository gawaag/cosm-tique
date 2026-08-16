'use strict';

const CATS = {
  honey: {
    nav: { fr: 'Miel naturel', ar: 'العسل الطبيعي' },
    filter: { fr: 'Miel naturel', ar: 'العسل الطبيعي' },
    showcase: {
      fr: { title: 'Miel naturel', sub: 'Miel brut pour la gorge et le quotidien.' },
      ar: { title: 'العسل الطبيعي', sub: 'عسل حر للحلق والاستعمال اليومي.' },
    },
  },
  colon: {
    nav: { fr: 'Côlon', ar: 'القولون' },
    filter: { fr: 'Côlon', ar: 'القولون' },
    showcase: {
      fr: { title: 'Côlon', sub: 'Transit et confort intestinal.' },
      ar: { title: 'القولون', sub: 'عبور هضمي وراحة معوية.' },
    },
  },
  hair: {
    nav: { fr: 'Cheveux', ar: 'الشعر' },
    filter: { fr: 'Cheveux', ar: 'الشعر' },
    showcase: {
      fr: { title: 'Cheveux', sub: 'Anti-chute et densité.' },
      ar: { title: 'الشعر', sub: 'مكافحة التساقط والكثافة.' },
    },
  },
  respi: {
    nav: { fr: 'Asthme', ar: 'الربو' },
    filter: { fr: 'Asthme', ar: 'الربو' },
    showcase: {
      fr: { title: 'Asthme', sub: 'Confort respiratoire, en complément du suivi médical.' },
      ar: { title: 'الربو', sub: 'راحة تنفسية، إلى جانب المتابعة الطبية.' },
    },
  },
  packs: {
    nav: { fr: 'Packs', ar: 'الباقات' },
    filter: { fr: 'Packs', ar: 'الباقات' },
    showcase: {
      fr: { title: 'Packs', sub: 'Cures combinées, tarif lot.' },
      ar: { title: 'الباقات', sub: 'علاجات مجمّعة بسعر الجملة.' },
    },
  },
};

function catNavLabel(key, lang) {
  const c = CATS[key];
  if (!c) return key;
  return c.nav[lang] || c.nav.fr;
}

function catFilterLabel(key, lang) {
  const c = CATS[key];
  if (!c) return key;
  return c.filter[lang] || c.filter.fr;
}

function catShowcase(key, lang) {
  const c = CATS[key];
  if (!c) return { title: key, sub: '' };
  return c.showcase[lang] || c.showcase.fr;
}

function productName(p, lang) {
  if (!p) return '';
  return lang === 'ar' && p.name_ar ? p.name_ar : p.name;
}

function productShort(p, lang) {
  if (!p) return '';
  if (lang === 'ar') return p.short_ar || p.short_en || p.short_fr || '';
  return p.short_fr || '';
}

function productDesc(p, lang) {
  if (!p) return '';
  if (lang === 'ar') return p.desc_ar || p.desc_en || p.desc_fr || '';
  return p.desc_fr || '';
}

function productBadges(p) {
  const raw = String((p && p.screen) || '');
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}

function productSpecLine(p) {
  if (!p) return '';
  const a = p.cpu || '';
  const b = p.ram || '';
  if (a && b) return `${a} - ${b}`;
  return a || b || p.storage || '';
}

module.exports = {
  CATS,
  catNavLabel,
  catFilterLabel,
  catShowcase,
  productName,
  productShort,
  productDesc,
  productBadges,
  productSpecLine,
};
