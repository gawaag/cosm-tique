'use strict';

const CATS = {
  colon: {
    nav: { fr: 'Côlon & Digestion', ar: 'القولون والهضم' },
    filter: { fr: 'Côlon & Microbiote', ar: 'القولون والميكروبيوتا' },
    showcase: {
      fr: { title: 'Côlon & Digestion', sub: 'Transit, microbiote et confort intestinal, formules ciblées.' },
      ar: { title: 'القولون والهضم', sub: 'عبور هضمي، ميكروبيوتا وراحة معوية بصيغ مركّزة.' },
    },
  },
  hair: {
    nav: { fr: 'Cheveux & Vitalité', ar: 'الشعر والحيوية' },
    filter: { fr: 'Anti-chute & Pousse', ar: 'مكافحة التساقط والإنبات' },
    showcase: {
      fr: { title: 'Cheveux & Vitalité', sub: 'Anti-chute, densité et pousse, actifs concentrés.' },
      ar: { title: 'الشعر والحيوية', sub: 'مكافحة التساقط والكثافة والإنبات بمكوّنات مركّزة.' },
    },
  },
  packs: {
    nav: { fr: 'Packs & Cures', ar: 'الباقات والعلاجات' },
    filter: { fr: 'Cures Complètes', ar: 'علاجات كاملة' },
    showcase: {
      fr: { title: 'Packs & Cures', sub: 'Protocoles 30 à 90 jours, y compris confort respiratoire.' },
      ar: { title: 'الباقات والعلاجات', sub: 'بروتوكولات من 30 إلى 90 يوماً، بما فيها راحة الجهاز التنفسي.' },
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
