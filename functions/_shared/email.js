// Zoho ZeptoMail transactional send + the trial email templates.
// Copy is adapted from Vinay's Apps Script drip, reframed for the 7-day gated
// trial (access pauses after day 7; data is preserved and returns on payment).

const SUPPORT_PHONE = '+91-9168481989';

// Accept either the raw Send Mail token or Zoho's copied Authorization value.
// Never log credentials, recipients, message bodies, or raw provider responses.
function mailFailure(error, status, diagnostic = {}) {
  const result = { ok: false, error, ...(status ? { status } : {}), ...diagnostic };
  console.error('ZeptoMail send failed', result);
  return result;
}

async function sendResend(env, { to, subject, html }) {
  const fail = (error, status) => {
    const result = { ok: false, error, ...(status ? { status } : {}) };
    console.error('Resend send failed', result);
    return result;
  };
  const token = typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  if (!token || /\s/.test(token)) return fail('invalid_token_format');
  const from = (env.FROM_EMAIL || 'hello@saasspendtrack.com').trim();
  const replyTo = (env.REPLY_TO || from).trim();
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html }),
    });
    if (res.body) await res.body.cancel().catch(() => {});
    if (res.status >= 300 && res.status < 400) return fail('provider_redirect', res.status);
    if (!res.ok) return fail('provider_rejected', res.status);
    return { ok: true };
  } catch (error) {
    return fail(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'transport_error');
  }
}

export async function sendEmail(env, { to, subject, html }) {
  const provider = env.EMAIL_PROVIDER || 'zeptomail';
  if (provider === 'resend') return sendResend(env, { to, subject, html });
  if (provider !== 'zeptomail') return { ok: false, error: 'invalid_email_provider' };
  const rawToken = typeof env.ZEPTOMAIL_TOKEN === 'string' ? env.ZEPTOMAIL_TOKEN.trim() : '';
  if (!rawToken) return mailFailure('no_token');
  const token = rawToken.replace(/^Zoho-enczapikey\s+/i, '');
  if (!token || /\s/.test(token) || /^Zoho-enczapikey$/i.test(token)) {
    return mailFailure('invalid_token_format');
  }
  if (rawToken !== env.ZEPTOMAIL_TOKEN || token !== rawToken) {
    console.info('ZeptoMail token normalized', {
      outerWhitespaceRemoved: rawToken !== env.ZEPTOMAIL_TOKEN,
      authorizationPrefixRemoved: token !== rawToken,
    });
  }
  const url = (env.ZEPTOMAIL_URL || 'https://api.zeptomail.in/v1.1/email').trim();
  // Restrict credential-bearing requests to documented provider endpoints.
  const allowedEndpoints = new Set([
    'https://api.zeptomail.in/v1.1/email',
    'https://api.zeptomail.com/v1.1/email',
    'https://cpaas.zoho.in/v1.1/email',
    'https://cpaas.zoho.com/v1.1/email',
  ]);
  if (!allowedEndpoints.has(url)) return mailFailure('invalid_provider_endpoint');
  const from = (env.FROM_EMAIL || 'hello@saasspendtrack.com').trim();
  const fromName = env.FROM_NAME || 'SaaS Spend Track';
  const replyTo = (env.REPLY_TO || from).trim();
  try {
    const res = await fetch(url, {
      method: 'POST',
      // Do not forward the email or credentials through a provider redirect.
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify({
        from: { address: from, name: fromName },
        to: [{ email_address: { address: to } }],
        reply_to: [{ address: replyTo, name: fromName }],
        subject,
        htmlbody: html,
      }),
    });
    if (res.status >= 300 && res.status < 400) {
      // Only emit a fixed, known provider origin/path; never an arbitrary Location
      // (which may contain tokens). Do not forward credentials across redirects.
      let destination = 'unrecognized';
      try {
        const target = new URL(res.headers.get('Location'), url);
        const knownOrigins = ['https://api.zeptomail.in', 'https://api.zeptomail.com', 'https://cpaas.zoho.in', 'https://cpaas.zoho.com'];
        if (knownOrigins.includes(target.origin)) {
          destination = target.origin + (target.pathname === '/v1.1/email' ? '/v1.1/email' : '/[other-path]');
        }
      } catch { /* no usable Location */ }
      if (res.body) await res.body.cancel().catch(() => {});
      return mailFailure('provider_redirect', res.status, { destination });
    }
    // A provider response may echo the email or magic-link token. Do not log it.
    if (res.body) await res.body.cancel().catch(() => {});
    if (!res.ok) return mailFailure('provider_rejected', res.status);
    // Accepted by the provider; inbox delivery still requires an end-to-end check.
    return { ok: true };
  } catch (error) {
    // Classify known runtime failures without exposing exception text.
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return mailFailure('timeout');
    if (/redirect/i.test(error?.message || '')) return mailFailure('redirect_rejected');
    if (/AbortSignal\.timeout/.test(error?.message || '')) return mailFailure('timeout_unsupported');
    return mailFailure('transport_error');
  }
}

const hi = (company) => (company ? `team at ${esc(company)}` : 'there');
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shell(heading, paragraphs, action, reason = 'You are receiving this account-related email from SaaS Spend Track.') {
  const body = paragraphs.map((p) => `    <p style="margin:0 0 14px;">${p}</p>`).join('\n');
  const btn = action
    ? `    <p style="margin:24px 0;"><a href="${esc(action.url)}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${action.label} &rarr;</a></p>`
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
    ${esc(reason)}</p>
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
  // Welcome is sent after the first successful magic-link sign-in. The
  // seven-day clock begins at signup, not at the first contract import.
  const url = esc(appUrl);
  const section = (title, content) => `
    <h3 style="font-size:17px;line-height:1.35;margin:26px 0 9px;color:#101828;">${title}</h3>
    <p style="margin:0 0 12px;">${content}</p>`;
  const link = (label) => `<a href="${url}" style="color:#2563eb;text-decoration:none;font-weight:700;">${label} &rarr;</a>`;
  return {
    subject: 'Welcome to SaaS Spend Track — your 7-day trial starts now',
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#101828;line-height:1.65;font-size:15px;max-width:580px;margin:0 auto;">
  <div style="background:#0b1120;color:#fff;padding:22px 26px;border-radius:10px 10px 0 0;">
    <span style="display:inline-block;width:34px;height:34px;background:#2563eb;color:#fff;font-weight:800;font-size:13px;text-align:center;line-height:34px;border-radius:8px;vertical-align:middle;">SST</span>
    <span style="font-weight:700;font-size:17px;margin-left:12px;vertical-align:middle;">SaaS Spend Track</span>
  </div>
  <div style="border:1px solid #e4e7ec;border-top:0;border-radius:0 0 10px 10px;padding:26px;">
    <p style="margin:0 0 14px;">Hi ${hi(company)}, welcome to SaaS Spend Track!</p>
    <p style="margin:0 0 14px;">I'm glad you're here. Most companies don't know exactly what they're paying for across their SaaS stack until a renewal sneaks up on them. We're here to change that.</p>
    <p style="margin:0 0 14px;">Here's how to get the most from your trial:</p>
    ${section('Your free 7-day trial', 'Your trial starts when you sign up, with no credit card required. Explore your SaaS subscriptions, renewal dates, notice windows, invoices and spend insights in one workspace.')}
    <p style="margin:0 0 14px;">${link('Open your dashboard')}</p>
    ${section('Get your first win in minutes', 'Start with one vendor. Add its subscription cost, billing cycle and next renewal date. Then add the notice period from your contract. You can build from there at your own pace.')}
    <p style="margin:0 0 14px;">${link('Add your first subscription')}</p>
    ${section('What should you look for?', 'Start with three questions: Which contracts are coming up for renewal? Which licenses are going unused? And where are you paying for overlapping tools? Those are often the easiest places to find savings.')}
    <p style="margin:0 0 14px;">${link('Explore SaaS Spend Track')}</p>
    ${section('What happens after seven days?', 'At the end of the trial, access to paid features pauses until you upgrade. Your saved data stays in your workspace, so you can pick up where you left off after upgrading. No surprise charges.')}
    ${section('Questions? Just reply.', 'Whether you need help adding your first contract, understanding a feature, or choosing a plan, reply to this email. It goes to our team, and we\'ll help you get started.')}
    <p style="margin:22px 0 8px;">Let's find the spend hiding in plain sight.</p>
    <p style="margin:0;">Vinay<br/><b>Founder, SaaS Spend Track</b><br/>Whizzlead Solutions OPC Private Limited</p>
    <hr style="border:0;border-top:1px solid #e4e7ec;margin:26px 0 18px;"/>
    <p style="font-size:12px;color:#667085;margin:0;">You're receiving this account email because you signed up for SaaS Spend Track. Need help? Reply to this email.</p>
  </div>
</div>`,
  };
}

export function paidEmail({renewal=false, amount, currency, expiresAt} = {}) {
  const details = [];
  if (Number.isSafeInteger(amount) && currency === 'USD') details.push('Payment received: ' + esc(new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount/100)) + '.');
  if (Number.isSafeInteger(expiresAt)) details.push('Access valid through the expiry date shown in your account: ' + esc(new Date(expiresAt).toISOString().slice(0,10)) + ' (UTC).');
  return {
    subject: renewal ? 'Your SaaS Spend Track renewal is confirmed' : 'Your SaaS Spend Track payment is confirmed',
    html: shell('Payment confirmed', ['Thank you. Your payment has been received and your access is active.', ...details, 'Reply to this email if you need billing assistance.'], {url:'https://app.saasspendtrack.com/',label:'Open your workspace'}),
  };
}

export function subscriptionLifecycleEmail(kind, expiresAt) {
  const date = esc(new Date(expiresAt).toISOString().slice(0,10));
  const expired = kind === 'expired' || kind === 'after3' || kind === 'after7';
  const subject = expired ? 'Your SaaS Spend Track subscription has expired' : 'Your SaaS Spend Track subscription expires on ' + date;
  return {subject,html:shell(subject,[expired ? 'Your paid access has expired.' : 'Your current paid access expires on ' + date + ' (UTC).','Review your subscription and renewal options in your account.'],{url:'https://app.saasspendtrack.com/#pricing',label:'Review subscription'})};
}

export function paymentFailureEmail() {
  return {subject:'Your SaaS Spend Track payment was unsuccessful',html:shell('Payment unsuccessful',['We could not confirm your attempted payment. No additional access has been granted for this attempt.','Review your billing options or contact us if you need help.'],{url:'https://app.saasspendtrack.com/#pricing',label:'Review billing'})};
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

// --- Multi-user: invite + member-cap alert ---
export function inviteEmail(link, inviterEmail) {
  return {
    subject: 'You have been invited to SaaS Spend Track',
    html: shell(
      'Join your team on SaaS Spend Track',
      [
        `${esc(inviterEmail) || 'A teammate'} invited you to their SaaS Spend Track workspace, where your team tracks every contract, renewal and software cost in one place.`,
        'Accept below to join and sign in. This link is single-use and expires in 7 days.',
      ],
      { url: link, label: 'Accept invite' },
    ),
  };
}

export function memberCapEmail(accountId, ownerEmail) {
  return {
    subject: 'A SaaS Spend Track workspace hit the 50-member cap',
    html: shell(
      'Member cap reached',
      [
        `Workspace <b>${esc(accountId)}</b> (owner ${esc(ownerEmail)}) tried to invite a member past the 50-member limit.`,
        'Reach out to them if they should be allowed more seats.',
      ],
    ),
  };
}
