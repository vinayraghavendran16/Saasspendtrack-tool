/* ==========================================================================
   SaaS Spend Track — Phase 35
   Trial signup capture
   ---------------------------------------------------------------------------
   Problem: the tool is browser-only. Every trial signup disappears into
   the user's localStorage without us ever knowing who they are.

   Solution: on first visit, show a non-dismissable modal that asks for
   work email (required) and company (optional). On submit, we:
     1. POST the row to a Google Apps Script endpoint which appends it
        to your tracking Sheet
     2. Set workspace.ownerEmail so the modal never re-appears
     3. Log a 'trial_started' timestamp on the workspace
     4. Let the app render

   Endpoint URL is in state.settings.signupEndpoint. If unset, uses the
   default (SIGNUP_ENDPOINT_DEFAULT) below. Replace that constant with
   your deployed Apps Script URL once the Sheet is set up.

   If the endpoint is unreachable (offline, placeholder, misconfigured),
   we still create the workspace and log the captured details locally
   under state.settings.pendingSignups for later retry.
   ========================================================================== */

// Google Apps Script Web App deployment URL (ends in /exec)
const SIGNUP_ENDPOINT_DEFAULT = 'https://script.google.com/macros/s/AKfycbyaZnzM7Qq22uRyAcQ_PEQuXpZNRkdFhJuz2PZ2Csn_bt7LN2HXa6F-CbAmkh684kA/exec';

// Personal / disposable email domains the signup modal rejects.
// Users must submit a work email so we know which company they're from.
const PERSONAL_EMAIL_DOMAINS = new Set([
  // Major personal providers
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.in', 'yahoo.ca', 'yahoo.com.au', 'yahoo.fr', 'yahoo.de',
  'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.in', 'hotmail.co.uk', 'hotmail.co.in',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'rediffmail.com',
  'mail.com',
  'gmx.com', 'gmx.net', 'gmx.de',
  'yandex.com', 'yandex.ru',
  'qq.com', '163.com', '126.com', 'sina.com', 'foxmail.com',
  'zoho.com',
  'fastmail.com', 'fastmail.fm',
  'tutanota.com',
  // Disposable / temp
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'temp-mail.org',
  '10minutemail.com', 'yopmail.com', 'trashmail.com', 'getnada.com',
  'sharklasers.com', 'throwawaymail.com', 'maildrop.cc', 'dispostable.com',
]);

function isPersonalEmail(email) {
  const domain = (email || '').toLowerCase().split('@')[1] || '';
  if (!domain) return false;
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) return true;
  // Catch subdomains of blocked providers (e.g. "foo.gmail.com" edge case)
  for (const d of PERSONAL_EMAIL_DOMAINS) {
    if (domain.endsWith('.' + d)) return true;
  }
  return false;
}

function signupEndpoint() {
  return (state.settings.signupEndpoint && state.settings.signupEndpoint.startsWith('http'))
    ? state.settings.signupEndpoint
    : SIGNUP_ENDPOINT_DEFAULT;
}

function needsSignupCapture() {
  const w = workspace();
  const email = (w.ownerEmail || '').toLowerCase();
  // These are placeholders that mean "never captured"
  const placeholders = ['vinay@whizzlead.com', 'owner@acme.corp', 'owner@example.com', ''];
  return placeholders.includes(email) && !w.signupCaptured;
}

function markSignupCaptured(email, company) {
  const w = workspace();
  w.ownerEmail = email;
  w.companyName = company || w.companyName || '';
  w.signupCaptured = true;
  w.trialStartedAt = w.trialStartedAt || new Date().toISOString();
  // Update the owner user record
  if (Array.isArray(w.users)) {
    const owner = w.users.find(u => u.role === 'owner');
    if (owner) { owner.email = email; owner.name = (email.split('@')[0] || 'Owner'); }
  }
  save();
}

/* POST to the configured endpoint. Non-blocking: resolves even if offline
   so the user never sees an error page. Failed submissions are queued
   under state.settings.pendingSignups for a later retry. */
async function submitSignup(payload) {
  const url = signupEndpoint();
  if (!url || url.includes('PASTE-YOUR-DEPLOYMENT-ID')) {
    console.warn('Signup endpoint not configured; capture is local only.');
    queuePending(payload);
    return { ok: false, reason: 'no_endpoint' };
  }
  try {
    // Apps Script Web Apps need no-cors + form-encoded body to avoid
    // the CORS preflight. The response will be opaque; that's fine —
    // we just need the row to land in the Sheet.
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => body.append(k, String(v ?? '')));
    await fetch(url, { method: 'POST', mode: 'no-cors', body });
    return { ok: true };
  } catch (e) {
    console.warn('Signup POST failed, queuing locally', e);
    queuePending(payload);
    return { ok: false, reason: 'network' };
  }
}
function queuePending(p) {
  state.settings.pendingSignups = state.settings.pendingSignups || [];
  state.settings.pendingSignups.push(p);
  save();
}

/* Try to send any queued submissions when the user next loads with
   an endpoint set. Fire and forget. */
async function retryPending() {
  const url = signupEndpoint();
  if (!url || url.includes('PASTE-YOUR-DEPLOYMENT-ID')) return;
  const queue = state.settings.pendingSignups || [];
  if (!queue.length) return;
  const remaining = [];
  for (const p of queue) {
    try {
      const body = new URLSearchParams();
      Object.entries(p).forEach(([k, v]) => body.append(k, String(v ?? '')));
      await fetch(url, { method: 'POST', mode: 'no-cors', body });
    } catch (_) { remaining.push(p); }
  }
  state.settings.pendingSignups = remaining;
  save();
}

/* Context captured about the visitor */
async function captureContext() {
  let country = '';
  try {
    const r = await fetch('https://ipapi.co/json/');
    if (r.ok) { const d = await r.json(); country = d.country_code || ''; }
  } catch (_) {}
  return {
    timestamp: new Date().toISOString(),
    locale: navigator.language || '',
    country,
    referrer: document.referrer || 'direct',
    user_agent: (navigator.userAgent || '').slice(0, 300),
    workspace_id: workspace().id || '',
    // UTM params from the URL
    utm_source: new URLSearchParams(location.search).get('utm_source') || '',
    utm_medium: new URLSearchParams(location.search).get('utm_medium') || '',
    utm_campaign: new URLSearchParams(location.search).get('utm_campaign') || '',
    ref: new URLSearchParams(location.search).get('ref') || '',
  };
}

/* ---------- The modal ----------
   Two modes:
     mode='initial'  - first-time capture, non-dismissable (no email yet)
     mode='change'   - change email after capture, dismissable, prefilled
*/
function ensureSignupModal(mode = 'initial') {
  // Remove any existing modal (so changing from initial → change is clean)
  const existing = document.getElementById('signup-modal');
  if (existing) existing.remove();

  const w = workspace();
  const isChange = mode === 'change';
  const currentEmail = (w.ownerEmail || '').toLowerCase();
  const currentCompany = w.companyName || '';

  const m = document.createElement('div');
  m.id = 'signup-modal';
  m.className = 'signup-modal' + (isChange ? ' sm-change' : '');
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-label', isChange ? 'Change your email' : 'Start your free trial');
  m.innerHTML = `
    <div class="sm-backdrop" ${isChange ? 'data-close' : ''}></div>
    <div class="sm-card">
      ${isChange ? '<button type="button" class="sm-close" data-close aria-label="Close">×</button>' : ''}
      <div class="sm-brand">
        <div class="sm-logo">SST</div>
        <div>
          <div class="sm-brand-name">SaaS Spend Track</div>
          <div class="sm-brand-tag">${isChange ? 'Change your email' : 'Start your 14-day trial'}</div>
        </div>
      </div>
      <h2>${isChange ? 'Use a different email' : 'Work email only. No credit card.'}</h2>
      <p class="sm-sub">${isChange
        ? 'Switching the email we have on file for this workspace. We\'ll log the change in our records so follow-up goes to the right address. Must be a work email (gmail, yahoo etc not accepted).'
        : 'Your workspace runs entirely in your browser. We just need your <b>work email</b> (gmail, yahoo etc not accepted) so we can send your login link when you open the tool on another device, and handle GST invoicing for Indian customers.'}</p>
      <form id="signup-form" class="sm-form">
        <label>Work email *
          <input type="email" id="signup-email" value="${escapeHtml(currentEmail)}" placeholder="you@yourcompany.com" required autocomplete="email" autofocus/>
        </label>
        <label>Company <span class="sm-optional">(optional)</span>
          <input type="text" id="signup-company" value="${escapeHtml(currentCompany)}" placeholder="Your company name" autocomplete="organization"/>
        </label>
        <div class="sm-error" id="signup-error" hidden></div>
        <button type="submit" class="sm-primary" id="signup-submit">${isChange ? 'Update email →' : 'Start my 14-day trial →'}</button>
      </form>
      ${!isChange ? `
        <div class="sm-fine">
          <span>Already a customer? <a href="#" id="signup-paid">I've already paid, skip this</a></span>
        </div>
      ` : ''}
      <div class="sm-foot">
        ${isChange
          ? 'The previous email stays in our records for history. The new email becomes the one we\'ll use going forward.'
          : 'Your email is stored locally and in our tracking sheet so we can follow up. Nothing from your contracts or vendor data ever leaves your browser.'}
        <a href="https://saasspendtrack.com/privacy.html" target="_blank" rel="noopener">Privacy</a>.
      </div>
    </div>
  `;
  document.body.appendChild(m);

  const form = m.querySelector('#signup-form');
  const emailEl = m.querySelector('#signup-email');
  const companyEl = m.querySelector('#signup-company');
  const errEl = m.querySelector('#signup-error');
  const btn = m.querySelector('#signup-submit');

  // Close handlers (change mode only)
  if (isChange) {
    m.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => m.remove()));
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc, true); }
    }, true);
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = emailEl.value.trim().toLowerCase();
    const company = companyEl.value.trim();
    if (!/.+@.+\..+/.test(email)) {
      errEl.textContent = 'Please enter a valid email address.'; errEl.hidden = false; return;
    }
    if (isPersonalEmail(email)) {
      const domain = email.split('@')[1] || '';
      errEl.innerHTML = `<b>${escapeHtml(domain)}</b> looks like a personal email. Please use your work email so we can match your trial to your company for follow-up and GST invoicing.`;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = isChange ? 'Update email →' : 'Start my 14-day trial →';
      return;
    }
    if (isChange && email === currentEmail && company === currentCompany) {
      m.remove(); return; // nothing changed
    }
    errEl.hidden = true;
    btn.disabled = true; btn.textContent = isChange ? 'Updating…' : 'Starting your trial…';
    const ctx = await captureContext();
    const payload = isChange
      ? { email, company, previous_email: currentEmail, event_type: 'email_changed', ...ctx }
      : { email, company, event_type: 'trial_started', ...ctx };
    await submitSignup(payload);
    markSignupCaptured(email, company);
    m.classList.add('sm-done');
    setTimeout(() => {
      m.remove();
      try { renderAll(); } catch (_) {}
      try { refreshIdentityChip(); } catch (_) {}
      try {
        toast(isChange
          ? `Updated. Your email is now ${email}.`
          : `Welcome. Confirmation sent to ${email}.`,
          'success'
        );
      } catch (_) {}
    }, 350);
  };

  const paidLink = m.querySelector('#signup-paid');
  if (paidLink) paidLink.onclick = (e) => {
    e.preventDefault();
    const email = prompt('Great. What email was your purchase under? (so we can mark your workspace as paid)') || '';
    if (!/.+@.+\..+/.test(email)) return;
    markSignupCaptured(email.toLowerCase().trim(), '');
    workspace().plan = 'paid';
    workspace().paidAt = new Date().toISOString();
    save();
    m.remove();
    try { renderAll(); } catch (_) {}
    try { refreshIdentityChip(); } catch (_) {}
    try { toast(`Marked as paid. Welcome back, ${email}.`, 'success'); } catch (_) {}
    captureContext().then(ctx => submitSignup({ email, company: '', manual_paid: 'yes', event_type: 'paid_marked', ...ctx }));
  };
}

/* ---------- Identity chip in the sidebar footer ----------
   Replaces the plain "All features unlocked" badge once a signup
   is captured. Shows the email + a Change link. */
function refreshIdentityChip() {
  const badge = document.getElementById('plan-badge');
  if (!badge) return;
  const w = workspace();
  if (!w.signupCaptured && (w.ownerEmail || '').toLowerCase().includes('@whizzlead.com')) {
    // No real email yet, leave default badge alone
    return;
  }
  const email = (w.ownerEmail || '').toLowerCase();
  badge.innerHTML = `
    <div class="identity-chip">
      <span class="plan-dot" style="background:var(--success)"></span>
      <div class="identity-main">
        <div class="identity-label">Signed in as</div>
        <div class="identity-email" title="${escapeHtml(email)}">${escapeHtml(email)}</div>
      </div>
      <button type="button" class="identity-change" id="identity-change-btn" title="Change email">Change</button>
    </div>
  `;
  const btn = document.getElementById('identity-change-btn');
  if (btn) btn.onclick = (e) => { e.stopPropagation(); ensureSignupModal('change'); };
}

function maybeShowSignupModal() {
  if (!needsSignupCapture()) return;
  // Do not show in the artifact preview (claudeusercontent.com) or local file:// — keep the demo experience clean
  try {
    if (location.hostname.endsWith('claudeusercontent.com')) return;
    if (location.protocol === 'file:') return;
  } catch (_) {}
  ensureSignupModal('initial');
}

/* ---------- Hook into app lifecycle ---------- */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try { maybeShowSignupModal(); } catch (e) { console.warn(e); }
    try { retryPending(); } catch (_) {}
    try { refreshIdentityChip(); } catch (_) {}
  }, 300);
});

// Also refresh the identity chip after renderAll (sidebar rebuilds can wipe it)
const _prevAll21 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll21) {
  window.renderAll = function () {
    _prevAll21();
    try { refreshIdentityChip(); } catch (_) {}
  };
}

window.AskTrackSignup = {
  needsCapture: needsSignupCapture,
  markCaptured: markSignupCaptured,
  endpoint: signupEndpoint,
  setEndpoint: (url) => { state.settings.signupEndpoint = url; save(); retryPending(); return url; },
  pending: () => state.settings.pendingSignups || [],
  changeEmail: () => ensureSignupModal('change'),
  reset: () => {
    // Developer helper: forget the signup so the modal re-appears
    workspace().signupCaptured = false;
    workspace().ownerEmail = 'vinay@whizzlead.com';
    save();
    maybeShowSignupModal();
  },
};
