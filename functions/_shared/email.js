// Zoho ZeptoMail transactional send + the trial email templates.

export async function sendEmail(env, { to, subject, html }) {
  const url = env.ZEPTOMAIL_URL || 'https://api.zeptomail.in/v1.1/email';
  const from = env.FROM_EMAIL || 'hello@saasspendtrack.com';
  const fromName = env.FROM_NAME || 'SaaS Spend Track';
  if (!env.ZEPTOMAIL_TOKEN) {
    console.error('ZEPTOMAIL_TOKEN not set; cannot send', subject, 'to', to);
    return { ok: false, error: 'no_token' };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // ZeptoMail uses its own scheme, not Bearer:
      Authorization: `Zoho-enczapikey ${env.ZEPTOMAIL_TOKEN}`,
    },
    body: JSON.stringify({
      from: { address: from, name: fromName },
      to: [{ email_address: { address: to } }],
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

const shell = (inner) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;line-height:1.55">
  <div style="padding:20px 0;font-weight:700;font-size:18px;color:#16a34a">SaaS Spend Track</div>
  ${inner}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0"/>
  <div style="font-size:12px;color:#64748b">Whizzlead Solutions OPC Private Limited &middot; Chennai, India<br/>
  You received this because you started a SaaS Spend Track trial.</div>
</div>`;

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${label}</a>`;

export function loginLinkEmail(link) {
  return {
    subject: 'Your SaaS Spend Track sign-in link',
    html: shell(`
      <p>Click below to sign in. This link works once and expires in 15 minutes.</p>
      <p style="margin:24px 0">${btn(link, 'Sign in to SaaS Spend Track')}</p>
      <p style="font-size:13px;color:#64748b">If you did not request this, you can ignore this email.</p>`),
  };
}

export function welcomeEmail() {
  return {
    subject: 'Welcome — your 7-day trial has started',
    html: shell(`
      <p>You're in. Your free trial runs for the next 7 days with full access.</p>
      <p>Add your subscriptions, import a contract, and watch your renewal notice windows light up.</p>
      <p style="font-size:13px;color:#64748b">We'll remind you before the trial ends. Upgrade any time to keep going.</p>`),
  };
}

export function trialNudgeEmail(kind, daysLeft, payUrl) {
  const copy = {
    day3: `You're 3 days into your trial. The teams that get the most out of SaaS Spend Track add every subscription and import at least one contract in week one.`,
    day6: `One day left on your trial. Upgrade now so you don't lose access to your dashboard and renewal tracking.`,
    day7: `Your trial ends today. Upgrade to keep your access, your data, and your renewal alerts running without a break.`,
  }[kind] || `Your trial is ending soon.`;
  return {
    subject: kind === 'day3' ? 'How’s your trial going?' : `Your trial ends ${daysLeft <= 0 ? 'today' : 'tomorrow'}`,
    html: shell(`
      <p>${copy}</p>
      <p style="margin:24px 0">${btn(payUrl, 'Upgrade now')}</p>`),
  };
}

export function expiredEmail(payUrl) {
  return {
    subject: 'Your trial has ended — upgrade to get back in',
    html: shell(`
      <p>Your 7-day trial has ended and your access is paused. Your data is safe.</p>
      <p>Upgrade to unlock your dashboard again right away.</p>
      <p style="margin:24px 0">${btn(payUrl, 'Upgrade and get back in')}</p>`),
  };
}

export function paidEmail() {
  return {
    subject: 'You’re all set — welcome to SaaS Spend Track',
    html: shell(`
      <p>Payment received and your account is active. Thank you.</p>
      <p>Your GST invoice will follow separately. Reply to this email if you need anything.</p>`),
  };
}
