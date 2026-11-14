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

// Replace this with your Apps Script deployment URL (ends in /exec)
const SIGNUP_ENDPOINT_DEFAULT = 'https://script.google.com/macros/s/PASTE-YOUR-DEPLOYMENT-ID/exec';

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

/* ---------- The modal ---------- */
function ensureSignupModal() {
  if (document.getElementById('signup-modal')) return;
  const m = document.createElement('div');
  m.id = 'signup-modal';
  m.className = 'signup-modal';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-label', 'Start your free trial');
  m.innerHTML = `
    <div class="sm-backdrop"></div>
    <div class="sm-card">
      <div class="sm-brand">
        <div class="sm-logo">SST</div>
        <div>
          <div class="sm-brand-name">SaaS Spend Track</div>
          <div class="sm-brand-tag">Start your 14-day trial</div>
        </div>
      </div>
      <h2>One field. No credit card.</h2>
      <p class="sm-sub">Your workspace runs entirely in your browser. We just need your work email so we can send your login link when you want to open the tool on another device, and so you don't lose your data.</p>
      <form id="signup-form" class="sm-form">
        <label>Work email *
          <input type="email" id="signup-email" placeholder="you@yourcompany.com" required autocomplete="email" autofocus/>
        </label>
        <label>Company <span class="sm-optional">(optional)</span>
          <input type="text" id="signup-company" placeholder="Your company name" autocomplete="organization"/>
        </label>
        <div class="sm-error" id="signup-error" hidden></div>
        <button type="submit" class="sm-primary" id="signup-submit">Start my 14-day trial →</button>
      </form>
      <div class="sm-fine">
        <span>Already a customer? <a href="#" id="signup-paid">I've already paid, skip this</a></span>
      </div>
      <div class="sm-foot">
        Your email is stored locally and in our tracking sheet so we can follow up. Nothing from your contracts or vendor data ever leaves your browser. <a href="https://saasspendtrack.com/privacy.html" target="_blank" rel="noopener">Privacy</a>.
      </div>
    </div>
  `;
  document.body.appendChild(m);

  const form = m.querySelector('#signup-form');
  const emailEl = m.querySelector('#signup-email');
  const companyEl = m.querySelector('#signup-company');
  const errEl = m.querySelector('#signup-error');
  const btn = m.querySelector('#signup-submit');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = emailEl.value.trim().toLowerCase();
    const company = companyEl.value.trim();
    if (!/.+@.+\..+/.test(email)) {
      errEl.textContent = 'Please enter a valid work email.'; errEl.hidden = false; return;
    }
    errEl.hidden = true;
    btn.disabled = true; btn.textContent = 'Starting your trial…';
    const ctx = await captureContext();
    const payload = { email, company, ...ctx };
    await submitSignup(payload);
    markSignupCaptured(email, company);
    // Close the modal
    m.classList.add('sm-done');
    setTimeout(() => {
      m.remove();
      try { renderAll(); } catch (_) {}
      try { toast(`Welcome. Your workspace is ready, ${email.split('@')[0]}.`, 'success'); } catch (_) {}
    }, 350);
  };

  m.querySelector('#signup-paid').onclick = (e) => {
    e.preventDefault();
    // They claim to have already paid; prompt for email for record-keeping anyway
    const email = prompt('Great. What email was your purchase under? (so we can mark your workspace as paid)') || '';
    if (!/.+@.+\..+/.test(email)) return;
    markSignupCaptured(email.toLowerCase().trim(), '');
    workspace().plan = 'paid';
    workspace().paidAt = new Date().toISOString();
    save();
    m.remove();
    try { renderAll(); } catch (_) {}
    try { toast('Marked as paid. Welcome back.', 'success'); } catch (_) {}
    // Fire-and-forget a note to the sheet so you know a "manual paid" claim happened
    captureContext().then(ctx => submitSignup({ email, company: '', manual_paid: 'yes', ...ctx }));
  };
}

function maybeShowSignupModal() {
  if (!needsSignupCapture()) return;
  // Do not show in the artifact preview (claudeusercontent.com) or local file:// — keep the demo experience clean
  try {
    if (location.hostname.endsWith('claudeusercontent.com')) return;
    if (location.protocol === 'file:') return;
  } catch (_) {}
  ensureSignupModal();
}

/* ---------- Hook into app lifecycle ---------- */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try { maybeShowSignupModal(); } catch (e) { console.warn(e); }
    try { retryPending(); } catch (_) {}
  }, 300);
});

window.AskTrackSignup = {
  needsCapture: needsSignupCapture,
  markCaptured: markSignupCaptured,
  endpoint: signupEndpoint,
  setEndpoint: (url) => { state.settings.signupEndpoint = url; save(); retryPending(); return url; },
  pending: () => state.settings.pendingSignups || [],
  reset: () => {
    // Developer helper: forget the signup so the modal re-appears
    workspace().signupCaptured = false;
    workspace().ownerEmail = 'vinay@whizzlead.com';
    save();
    maybeShowSignupModal();
  },
};
