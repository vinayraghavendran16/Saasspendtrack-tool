// Zoho ZeptoMail transactional send + the trial email templates.
// Copy is adapted from Vinay's Apps Script drip, reframed for the 7-day gated
// trial (access pauses after day 7; data is preserved and returns on payment).

const SUPPORT_PHONE = '+91-9168481989';

export async function sendEmail(env, { to, subject, html }) {
  const url = env.ZEPTOMAIL_URL || 'https://api.zeptomail.in/v1.1/email';
  const from = env.FROM_EMAIL || 'hello@saasspendtrack.com';
  const fromName = env.FROM_NAME || 'SaaS Spend Track';
  const replyTo = env.REPLY_TO || from; // branded, not a personal inbox
  if (!env.ZEPTOMAIL_TOKEN) {
    console.error('ZEPTOMAIL_TOKEN not set; cannot send', subject, 'to', to);
    return { ok: false, error: 'no_token' };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Zoho-enczapikey ${env.ZEPTOMAIL_TOKEN}`,
    },
    body: JSON.stringify({
      from: { address: from, name: fromName },
      to: [{ email_address: { address: to } }],
      reply_to: [{ address: replyTo, name: fromName }],
      subject,
      htmlbody: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('ZeptoMail send failed', res.status, body.slice(0, 300));
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

const hi = (company) => (company ? `team at ${esc(company)}` : 'there');
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shell(heading, paragraphs, action) {
  const body = paragraphs.map((p) => `    <p style="margin:0 0 14px;">${p}</p>`).join('\n');
  const btn = action
    ? `    <p style="margin:24px 0;"><a href="${action.url}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${action.label} &rarr;</a></p>`
    : '';
  return `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#101828;line-height:1.55;font-size:15px;max-width:560px;margin:0 auto;">
  <div style="background:#0b1120;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;">
    <span style="display:inline-block;width:34px;height:34px;background:#2563eb;color:#fff;font-weight:800;font-size:13px;text-align:center;line-height:34px;border-radius:8px;vertical-align:middle;">SST</span>
    <span style="font-weight:700;font-size:16px;margin-left:12px;vertical-align:middle;">SaaS Spend Track</span>
  </div>
  <div style="border:1px solid #e4e7ec;border-top:0;border-radius:0 0 10px 10px;padding:24px;">
    <h2 style="margin:0 0 14px;font-size:19px;line-height:1.3;">${heading}</h2>
${body}
${btn}
    <hr style="border:0;border-top:1px solid #e4e7ec;margin:22px 0;"/>
    <p style="font-size:13px;color:#667085;">Any questions, hit reply or message ${SUPPORT_PHONE}. I read every one of these personally.</p>
    <p style="font-size:12px;color:#98a2b3;margin-top:16px;">Vinay &middot; Whizzlead Solutions OPC Private Limited<br/>
    You're getting this because you started a SaaS Spend Track trial. Reply <b>stop</b> to opt out.</p>
  </div>
</div>`;
}

// --- Transactional ---

export function loginLinkEmail(link) {
  return {
    subject: 'Your SaaS Spend Track sign-in link',
    html: shell('Your sign-in link', [
      'Click below to sign in. The link works once and expires in 15 minutes.',
    ], { url: link, label: 'Sign in' }),
  };
}

export function welcomeEmail(company, appUrl) {
  return {
    subject: 'Your SaaS Spend Track trial is live',
    html: shell('Your 7-day trial is live', [
      `Hi ${hi(company)},`,
      'Welcome to SaaS Spend Track. You have full access for the next 7 days. The fastest way to see the value: open the tool, go to <b>Contract terms</b>, and load a sample contract. The parser pulls out the renewal date, notice window, auto-renew clause and price-cap in about 10 seconds.',
      'Prefer to start with your own numbers? Use <b>Bulk Import</b> on the Subscriptions tab, paste your vendor spreadsheet, and the dashboard builds in one click.',
      'On day 8 access pauses behind a payment screen. Your data is preserved and comes right back when you upgrade, any time, from the Pay button in the tool.',
    ], { url: appUrl, label: 'Open the tool' }),
  };
}

export function paidEmail() {
  return {
    subject: "You're all set - welcome to SaaS Spend Track",
    html: shell("You're in", [
      'Payment received and your account is active. Thank you.',
      'Your GST invoice will follow separately. Reply to this email if you need anything at all.',
    ]),
  };
}

// --- Cadence (fired from trial start by the hourly tick) ---

export function nudgeEmail(kind, payUrl, appUrl) {
  const map = {
    day2: {
      subject: 'Fastest way to see what SaaS Spend Track does',
      heading: 'The 10-second value test',
      paras: [
        "You started a couple of days ago. If you haven't loaded a contract yet, here's the shortcut: open the tool, go to <b>Contract terms</b>, click <b>Load a sample contract</b>. You'll see renewal date, notice window, auto-renew clause and price-cap pulled out instantly. That's the whole value prop in one screen.",
      ],
      action: { url: appUrl, label: 'Open the tool' },
    },
    day4: {
      subject: 'Three findings worth looking for on your dashboard',
      heading: 'Three findings that pay for the tool',
      paras: [
        '<b>1. Auto-renew traps.</b> Anything flagged red is a contract auto-renewing inside its notice window. Missing that window turns a one-year commitment into another full year. Diary the notice date now.',
        '<b>2. Licences nobody uses.</b> Any vendor under 60% utilization is a renewal lever: "we\'re at 45% of seats, cut the commit or we move." Vendors cave more than you\'d think.',
        '<b>3. Overlapping tools.</b> Zoom + Meet, Figma + XD, Notion + Confluence. Each is a consolidation conversation worth having.',
      ],
      action: { url: appUrl, label: 'Open your dashboard' },
    },
    day6: {
      subject: 'Your SaaS Spend Track trial ends tomorrow',
      heading: 'One day left',
      paras: [
        'Quick heads-up: your trial ends tomorrow. On day 8, access pauses behind a payment screen. Your data stays safe and comes back the moment you upgrade.',
        'Lock in your access now so there is no break.',
      ],
      action: { url: payUrl, label: 'Upgrade now' },
    },
  };
  const m = map[kind] || map.day6;
  return { subject: m.subject, html: shell(m.heading, m.paras, m.action) };
}

export function expiredEmail(payUrl) {
  return {
    subject: 'Your trial has ended - upgrade to get back in',
    html: shell('Your trial has ended', [
      'Your 7-day trial is up and access is paused. Nothing is deleted, your data is waiting for you.',
      'Upgrade and you are back in immediately.',
    ], { url: payUrl, label: 'Upgrade and get back in' }),
  };
}
