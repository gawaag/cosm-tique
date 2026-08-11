'use strict';

const DEFAULTS = {
  storageStepGb: 256,
  storageStepPrice: 40,
  storageMaxSteps: 3,
  ramUpgradePrice: 25,   // 8 Go → 16 Go
  ramDowngradePrice: 15, // 16 Go → 8 Go
};

function toNum(v, fallback) {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseGo(str) {
  const m = String(str || '').match(/(\d+(?:[.,]\d+)?)\s*(Go|GB|go|gb|To|TB|to|tb)/i);
  if (!m) return null;
  let n = parseFloat(String(m[1]).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  if (unit === 'to' || unit === 'tb') n *= 1024;
  return Math.round(n);
}

function getPricing(settings) {
  const s = settings || {};
  return {
    storageStepGb: Math.max(64, toInt(s.cfg_storage_step_gb, DEFAULTS.storageStepGb)),
    storageStepPrice: Math.max(0, toNum(s.cfg_storage_step_price, DEFAULTS.storageStepPrice)),
    storageMaxSteps: Math.min(8, Math.max(0, toInt(s.cfg_storage_max_steps, DEFAULTS.storageMaxSteps))),
    ramUpgradePrice: Math.max(0, toNum(s.cfg_ram_upgrade_price, DEFAULTS.ramUpgradePrice)),
    ramDowngradePrice: Math.max(0, toNum(s.cfg_ram_downgrade_price, DEFAULTS.ramDowngradePrice)),
  };
}

function isConfigurablePc(product) {
  const cat = String((product && product.category) || '');
  const name = String((product && product.name) || '');
  if (/smart|phone|t[eé]l[eé]phone|mobile/i.test(cat + ' ' + name)) return false;
  if (/pc|ordinateur|laptop|gamer|gaming|portable|notebook/i.test(cat + ' ' + name)) return true;
  return !!(parseGo(product && product.ram) || parseGo(product && product.storage));
}

/** Base RAM effective pour le choix 8/16. */
function baseRamGb(product) {
  return parseGo(product && product.ram) || 8;
}

/**
 * Options RAM :
 * - base 8 → 8 (défaut) ou 16 (+upgrade)
 * - base 16 → 16 (défaut) ou 8 (−downgrade)
 * - autre → uniquement la base
 */
function ramOptions(product, pricing) {
  const p = pricing || DEFAULTS;
  const base = baseRamGb(product);
  if (base <= 8) {
    return [
      { gb: 8, delta: 0, isDefault: true },
      { gb: 16, delta: p.ramUpgradePrice, isDefault: false },
    ];
  }
  if (base === 16) {
    return [
      { gb: 16, delta: 0, isDefault: true },
      { gb: 8, delta: -p.ramDowngradePrice, isDefault: false },
    ];
  }
  return [{ gb: base, delta: 0, isDefault: true }];
}

function clampSteps(n, max) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(max, v);
}

function normalizeConfig(raw, product, pricing) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const p = pricing || DEFAULTS;
  const options = ramOptions(product || {}, p);
  const defaultRam = (options.find((o) => o.isDefault) || options[0]).gb;
  let ramGb = toInt(src.ramGb, NaN);
  if (!Number.isFinite(ramGb) && src.ramSteps != null) {
    // Ancien format : ignore, garde le défaut
    ramGb = defaultRam;
  }
  if (!options.some((o) => o.gb === ramGb)) ramGb = defaultRam;
  const other = String(src.otherSoftware || src.other || '').trim().slice(0, 120);
  return {
    storageSteps: clampSteps(src.storageSteps, p.storageMaxSteps),
    ramGb,
    office: true,
    antivirus: src.antivirus === true || src.antivirus === 1 || src.antivirus === '1',
    otherSoftware: other,
  };
}

function ramDelta(product, ramGb, pricing) {
  const opt = ramOptions(product, pricing).find((o) => o.gb === ramGb);
  return opt ? opt.delta : 0;
}

function upgradeExtra(product, cfg, pricing) {
  const p = pricing || DEFAULTS;
  const c = normalizeConfig(cfg, product, p);
  const storageExtra = c.storageSteps * p.storageStepPrice;
  const ramExtra = ramDelta(product, c.ramGb, p);
  return storageExtra + ramExtra;
}

function configuredUnitPrice(basePrice, product, cfg, pricing) {
  const base = Number(basePrice) || 0;
  return Math.round((base + upgradeExtra(product, cfg, pricing)) * 100) / 100;
}

function configSummary(product, cfg, pricing) {
  const p = pricing || DEFAULTS;
  const c = normalizeConfig(cfg, product, p);
  const baseStorage = parseGo(product.storage) || 0;
  const parts = [];
  const storageFinal = baseStorage + c.storageSteps * p.storageStepGb;
  if (baseStorage || c.storageSteps) {
    parts.push(
      c.storageSteps
        ? `Stockage ${storageFinal} Go (+${c.storageSteps * p.storageStepGb} Go)`
        : `Stockage ${baseStorage} Go (base)`
    );
  }
  parts.push(`RAM ${c.ramGb} Go`);
  parts.push('Office inclus (offert)');
  if (c.antivirus) parts.push('Antivirus (coût à confirmer)');
  if (c.otherSoftware) parts.push(`Autre logiciel: ${c.otherSoftware} (coût à confirmer)`);
  return parts.join(' · ');
}

function productNameWithConfig(product, cfg, pricing) {
  const summary = configSummary(product, cfg, pricing);
  if (!summary) return product.name;
  return `${product.name} — ${summary}`.slice(0, 500);
}

module.exports = {
  DEFAULTS,
  parseGo,
  getPricing,
  isConfigurablePc,
  baseRamGb,
  ramOptions,
  normalizeConfig,
  ramDelta,
  upgradeExtra,
  configuredUnitPrice,
  configSummary,
  productNameWithConfig,
};
