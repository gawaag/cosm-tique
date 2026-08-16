'use strict';

const nodemailer = require('nodemailer');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n, sym) {
  return Number(n).toLocaleString('fr-FR') + ' ' + sym;
}

function resendKey(settings = {}) {
  return (settings.resend_api_key || process.env.RESEND_API_KEY || '').trim();
}

function smtpFrom(settings = {}) {
  const host = (settings.smtp_host || process.env.SMTP_HOST || '').trim();
  const user = (settings.smtp_user || process.env.SMTP_USER || '').trim();
  // Gmail app passwords are often copied with spaces — strip them.
  const pass = (settings.smtp_pass || process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const port = Number(settings.smtp_port || process.env.SMTP_PORT || 465);
  const secure = String(settings.smtp_secure || process.env.SMTP_SECURE || 'true') === 'true' || port === 465;
  return { host, user, pass, port, secure };
}

function isSmtpConfigured(settings = {}) {
  const s = smtpFrom(settings);
  return !!(s.host && s.user && s.pass);
}

function isConfigured(settings = {}) {
  return !!(resendKey(settings) || isSmtpConfigured(settings));
}

function createTransport(settings = {}) {
  const s = smtpFrom(settings);
  if (!s.host || !s.user || !s.pass) return null;
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

function fromAddress(settings, smtpUser) {
  const custom = (settings.mail_from || process.env.MAIL_FROM || '').trim();
  if (resendKey(settings)) {
    // Compte Resend gratuit : expéditeur = onboarding@resend.dev (domaine non vérifié).
    if (custom && /resend\.dev/i.test(custom)) return custom;
    return `${settings.brand_name || 'معشبات الأطلس'} <onboarding@resend.dev>`;
  }
  if (custom) return custom;
  if (smtpUser) return `"${settings.brand_name || 'Boutique'}" <${smtpUser}>`;
  return `${settings.brand_name || 'معشبات الأطلس'} <voltatech.contact@gmail.com>`;
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

function explainMailError(err) {
  const msg = String(err && err.message ? err.message : err || 'Échec');
  const low = msg.toLowerCase();
  if (low.includes('timeout') || low.includes('etimedout') || low.includes('econnrefused')
    || low.includes('enetunreach') || low.includes('blocked')) {
    return msg + ' — Sur Render gratuit, les ports SMTP (465/587) sont bloqués. Utilisez Resend (HTTPS) : variable RESEND_API_KEY.';
  }
  if (low.includes('invalid login') || low.includes('username and password') || low.includes('badcredentials')) {
    return msg + ' — Vérifiez le mot de passe d’application Gmail (16 caractères), pas le mot de passe du compte.';
  }
  return msg;
}

async function sendViaResend(settings, { from, to, subject, html, text, replyTo }) {
  const key = resendKey(settings);
  if (!key) return null;
  const body = {
    from,
    to: [to],
    subject,
    html,
    text,
  };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.message || data.name || JSON.stringify(data) || res.statusText;
    throw new Error(`Resend: ${detail}`);
  }
  return { sent: true, to, via: 'resend', id: data.id };
}

async function sendViaSmtp(settings, { from, to, subject, html, text, replyTo }) {
  const transport = createTransport(settings);
  if (!transport) return null;
  await transport.sendMail({
    from,
    to,
    replyTo: replyTo || undefined,
    subject,
    html,
    text,
  });
  return { sent: true, to, via: 'smtp' };
}

async function dispatchEmail(settings, payload) {
  const recipient = payload.to;
  if (!recipient) {
    return { sent: false, reason: 'not_configured', error: 'Destinataire manquant.' };
  }
  if (!isConfigured(settings)) {
    return {
      sent: false,
      reason: 'not_configured',
      error: 'Email non configuré. Sur Render gratuit : créez une clé Resend (RESEND_API_KEY). En local : SMTP Gmail OK.',
    };
  }

  const from = fromAddress(settings, smtpFrom(settings).user);
  const mail = { ...payload, from, to: recipient };

  // Resend (HTTPS) d’abord — seul moyen fiable sur Render free.
  if (resendKey(settings)) {
    try {
      return await sendViaResend(settings, mail);
    } catch (err) {
      console.error('[mail] Resend échec:', err.message);
      // Si SMTP aussi dispo, tenter en secours (local / Render payant).
      if (!isSmtpConfigured(settings)) {
        return { sent: false, reason: 'error', error: explainMailError(err) };
      }
    }
  }

  try {
    const result = await sendViaSmtp(settings, mail);
    if (!result) {
      return { sent: false, reason: 'not_configured', error: 'SMTP incomplet.' };
    }
    return result;
  } catch (err) {
    console.error('[mail] SMTP échec:', err.message);
    return { sent: false, reason: 'error', error: explainMailError(err) };
  }
}

async function sendReservationEmail(reservation, settings) {
  const recipient = recipientOf(settings);
  if (!recipient) {
    console.log(`[mail] Destinataire manquant — réservation #${reservation.id} non notifiée.`);
    return { sent: false, reason: 'not_configured' };
  }
  const { html, text, typeLabel } = buildContent(reservation, settings);
  const result = await dispatchEmail(settings, {
    to: recipient,
    replyTo: reservation.email || undefined,
    subject: `${typeLabel} #${String(reservation.id).padStart(5, '0')} — ${reservation.customer_name}`,
    html,
    text,
  });
  if (result.sent) {
    console.log(`[mail] Notification envoyée #${reservation.id} -> ${recipient} (${result.via})`);
  }
  return result;
}

async function sendTestEmail(settings, toOverride) {
  const recipient = (toOverride || '').trim() || recipientOf(settings);
  return dispatchEmail(settings, {
    to: recipient,
    subject: `Test ${settings.brand_name || 'Boutique'} — notifications OK`,
    text: `Ceci est un email de test. Les réservations seront envoyées à ${recipient}.`,
    html: `<p>Ceci est un <strong>email de test</strong>.</p><p>Les réservations seront envoyées à <code>${esc(recipient)}</code>.</p>`,
  });
}

module.exports = {
  sendReservationEmail,
  sendTestEmail,
  isConfigured,
  isSmtpConfigured,
  buildContent,
  recipientOf,
  smtpFrom,
  resendKey,
};
