'use strict';
const store = require('../src/store');
const { translator } = require('../src/i18n');

store.setSettings({
  about_fr:
    "VOLTA, c’est 3 ans d’expérience dans le high-tech comme neuf. Nous travaillons avec des fournisseurs de confiance. Toutes les pièces sont et seront testées lors de la vente — en appel vidéo ou en main propre à Montrouge (92120), Île-de-France. Paiements sécurisés via Leboncoin, eBay Marketplace ou PayPal.",
  about_en:
    'VOLTA has 3 years of experience in like-new tech. We work with trusted suppliers. Every part is and will be tested at sale — on a video call or in person in Montrouge (92120), Île-de-France. Secure payments via Leboncoin, eBay Marketplace or PayPal.',
});

const t = translator('fr');
console.log('trust_pay_title:', t('trust_pay_title'));
console.log('trust_badge_handoff:', t('trust_badge_handoff'));
console.log('attract_software:', t('attract_software'));
console.log('about ok:', store.getSettings().about_fr.includes('Montrouge'));
