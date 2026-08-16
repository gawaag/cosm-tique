'use strict';

const mailer = require('./mailer');

function fmt(n, sym) {
  return Number(n).toLocaleString('fr-FR') + ' ' + (sym || '');
}

function buildWhatsAppText(reservation, settings) {
  const sym = settings.currency_symbol || 'د.م.';
  const typeLabel = reservation.type === 'offer' ? 'OFFRE' : 'RÉSERVATION';
  const lines = [
    `🔔 Nouvelle ${typeLabel} — ${settings.brand_name || 'Boutique'}`,
    `#${String(reservation.id).padStart(5, '0')}`,
    `Client: ${reservation.customer_name}`,
    `Tél: ${reservation.phone}`,
  ];
  if (reservation.email) lines.push(`Email: ${reservation.email}`);
  lines.push('');
  for (const i of reservation.items || []) {
    lines.push(`• ${i.product_name} x${i.quantity} (${fmt(i.unit_price, sym)})`);
  }
  if (reservation.offer_total != null) lines.push(`Offre totale: ${fmt(reservation.offer_total, sym)}`);
  if (reservation.message) lines.push(`Message: ${reservation.message}`);
  return lines.join('\n');
}

/**
 * Envoi WhatsApp via CallMeBot (gratuit / simple).
 * Doc: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 * L'utilisateur doit d'abord activer l'API sur son WhatsApp et obtenir une clé.
 */
async function sendWhatsAppCallMeBot(reservation, settings) {
  const phone = String(settings.whatsapp_number || '').replace(/[^0-9]/g, '');
  const apikey = (settings.callmebot_apikey || process.env.CALLMEBOT_APIKEY || '').trim();
  if (!phone || !apikey) {
    return { sent: false, reason: 'not_configured' };
  }
  const text = buildWhatsAppText(reservation, settings);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    const body = await res.text();
    if (!res.ok) {
      console.error('[whatsapp] CallMeBot HTTP', res.status, body.slice(0, 200));
      return { sent: false, reason: 'error', error: `HTTP ${res.status}` };
    }
    console.log(`[whatsapp] Notification CallMeBot envoyée #${reservation.id} -> ${phone}`);
    return { sent: true, to: phone };
  } catch (err) {
    console.error('[whatsapp] Échec CallMeBot:', err.message);
    return { sent: false, reason: 'error', error: err.message };
  }
}

/** Webhook optionnel (Make.com / n8n / Zapier) */
async function sendWebhook(reservation, settings) {
  const url = (settings.notify_webhook_url || process.env.NOTIFY_WEBHOOK_URL || '').trim();
  if (!url) return { sent: false, reason: 'not_configured' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'reservation.created',
        brand: settings.brand_name,
        reservation,
        whatsapp_text: buildWhatsAppText(reservation, settings),
      }),
    });
    if (!res.ok) return { sent: false, reason: 'error', error: `HTTP ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: 'error', error: err.message };
  }
}

/**
 * Enregistre en base (déjà fait) + email + WhatsApp + webhook.
 * Ne throw jamais.
 */
async function notifyReservation(reservation, settings) {
  const results = {
    email: { sent: false },
    whatsapp: { sent: false },
    webhook: { sent: false },
  };

  try { results.email = await mailer.sendReservationEmail(reservation, settings); }
  catch (e) { results.email = { sent: false, reason: 'error', error: e.message }; }

  const waEnabled = String(settings.whatsapp_notify || '1') !== '0';
  if (waEnabled) {
    try { results.whatsapp = await sendWhatsAppCallMeBot(reservation, settings); }
    catch (e) { results.whatsapp = { sent: false, reason: 'error', error: e.message }; }
  } else {
    results.whatsapp = { sent: false, reason: 'disabled' };
  }

  try { results.webhook = await sendWebhook(reservation, settings); }
  catch (e) { results.webhook = { sent: false, reason: 'error', error: e.message }; }

  return results;
}

function whatsappConfigured(settings) {
  const phone = String(settings.whatsapp_number || '').replace(/[^0-9]/g, '');
  const apikey = (settings.callmebot_apikey || process.env.CALLMEBOT_APIKEY || '').trim();
  return !!(phone && apikey);
}

module.exports = {
  notifyReservation,
  sendWhatsAppCallMeBot,
  buildWhatsAppText,
  whatsappConfigured,
};
