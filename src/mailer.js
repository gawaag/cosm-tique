'use strict';

const nodemailer = require('nodemailer');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n, sym) {
  return Number(n).toLocaleString('fr-FR') + ' ' + sym;
}

function smtpFrom(settings) {
  const host = (settings.smtp_host || process.env.SMTP_HOST || '').trim();
  const user = (settings.smtp_user || process.env.SMTP_USER || '').trim();
  const pass = (settings.smtp_pass || process.env.SMTP_PASS || '').trim();
  const port = Number(settings.smtp_port || process.env.SMTP_PORT || 587);
  const secure = String(settings.smtp_secure || process.env.SMTP_SECURE || '') === 'true' || port === 465;
  return { host, user, pass, port, secure };
}

function isConfigured(settings = {}) {
  const s = smtpFrom(settings);
  return !!(s.host && s.user && s.pass);
}

function createTransport(settings = {}) {
  const s = smtpFrom(settings);
  if (!s.host || !s.user || !s.pass) return null;
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
  });
}

function buildContent(reservation, settings) {
  const sym = settings.currency_symbol || '';
  const rows = (reservation.items || []).map((i) => {
    const offer = i.offer_price != null ? ` — <strong>Offre: ${fmt(i.offer_price, sym)}</strong>` : '';
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(i.product_name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">x${i.quantity}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${fmt(i.unit_price, sym)}${offer}</td>
    </tr>`;
  }).join('');

  const total = (reservation.items || []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const wa = `https://wa.me/${String(reservation.phone).replace(/[^0-9]/g, '')}`;
  const typeLabel = reservation.type === 'offer' ? 'OFFRE' : 'Réservation';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#16202a">
    <h2 style="color:${esc(settings.accent_color || '#0071e3')}">Nouvelle ${typeLabel} — ${esc(settings.brand_name || '')}</h2>
    <p style="margin:0 0 4px"><strong>Client :</strong> ${esc(reservation.customer_name)}</p>
    <p style="margin:0 0 4px"><strong>Téléphone :</strong> ${esc(reservation.phone)} &nbsp; (<a href="${wa}">WhatsApp</a>)</p>
    ${reservation.email ? `<p style="margin:0 0 4px"><strong>Email :</strong> <a href="mailto:${esc(reservation.email)}">${esc(reservation.email)}</a></p>` : ''}
    <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #eee">
      <thead><tr style="background:#f6f8fa">
        <th style="padding:8px 10px;text-align:left">Produit</th>
        <th style="padding:8px 10px">Qté</th>
        <th style="padding:8px 10px;text-align:right">Prix</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:8px 10px;text-align:right"><strong>Total (prix affiché)</strong></td>
        <td style="padding:8px 10px;text-align:right"><strong>${fmt(total, sym)}</strong></td>
      </tr></tfoot>
    </table>
    ${reservation.offer_total != null ? `<p><strong>Offre totale proposée :</strong> ${fmt(reservation.offer_total, sym)}</p>` : ''}
    ${reservation.message ? `<div style="background:#f6f8fa;border-left:3px solid ${esc(settings.accent_color || '#0071e3')};padding:10px 14px;margin:10px 0"><strong>Message :</strong><br>${esc(reservation.message).replace(/\n/g, '<br>')}</div>` : ''}
    <p style="color:#6b7a89;font-size:13px">Réservation #${String(reservation.id).padStart(5, '0')} — ${esc(reservation.created_at || '')}</p>
  </div>`;

  const text = [
    `Nouvelle ${typeLabel} - ${settings.brand_name}`,
    `Client: ${reservation.customer_name}`,
    `Téléphone: ${reservation.phone}`,
    reservation.email ? `Email: ${reservation.email}` : '',
    '',
    ...(reservation.items || []).map((i) => `- ${i.product_name} x${i.quantity} (${fmt(i.unit_price, sym)})` + (i.offer_price != null ? ` Offre: ${fmt(i.offer_price, sym)}` : '')),
    '',
    reservation.offer_total != null ? `Offre totale proposée: ${fmt(reservation.offer_total, sym)}` : '',
    reservation.message ? `Message: ${reservation.message}` : '',
    `#${String(reservation.id).padStart(5, '0')}`,
  ].filter(Boolean).join('\n');

  return { html, text, typeLabel };
}

function recipientOf(settings) {
  return (settings.notification_email || '').trim()
    || (settings.contact_email || '').trim()
    || (process.env.ADMIN_EMAIL || '').trim();
}

async function sendReservationEmail(reservation, settings) {
  const recipient = recipientOf(settings);
  const transport = createTransport(settings);
  if (!transport || !recipient) {
    console.log(`[mail] SMTP ou destinataire manquant — réservation #${reservation.id} non notifiée.`);
    return { sent: false, reason: 'not_configured' };
  }
  const { html, text, typeLabel } = buildContent(reservation, settings);
  const smtp = smtpFrom(settings);
  const from = (settings.mail_from || process.env.MAIL_FROM || '').trim()
    || `"${settings.brand_name || 'Boutique'}" <${smtp.user}>`;
  try {
    await transport.sendMail({
      from,
      to: recipient,
      replyTo: reservation.email || undefined,
      subject: `${typeLabel} #${String(reservation.id).padStart(5, '0')} — ${reservation.customer_name}`,
      html,
      text,
    });
    console.log(`[mail] Notification envoyée #${reservation.id} -> ${recipient}`);
    return { sent: true, to: recipient };
  } catch (err) {
    console.error('[mail] Échec envoi email:', err.message);
    return { sent: false, reason: 'error', error: err.message };
  }
}

async function sendTestEmail(settings, toOverride) {
  const recipient = (toOverride || '').trim() || recipientOf(settings);
  const transport = createTransport(settings);
  if (!transport || !recipient) {
    return { sent: false, reason: 'not_configured', error: 'SMTP ou destinataire manquant.' };
  }
  const smtp = smtpFrom(settings);
  const from = (settings.mail_from || process.env.MAIL_FROM || '').trim()
    || `"${settings.brand_name || 'Boutique'}" <${smtp.user}>`;
  try {
    await transport.sendMail({
      from,
      to: recipient,
      subject: `Test ${settings.brand_name || 'Boutique'} — notifications OK`,
      text: `Ceci est un email de test. Les réservations seront envoyées à ${recipient}.`,
      html: `<p>Ceci est un <strong>email de test</strong>.</p><p>Les réservations seront envoyées à <code>${esc(recipient)}</code>.</p>`,
    });
    return { sent: true, to: recipient };
  } catch (err) {
    return { sent: false, reason: 'error', error: err.message };
  }
}

module.exports = {
  sendReservationEmail,
  sendTestEmail,
  isConfigured,
  buildContent,
  recipientOf,
  smtpFrom,
};
