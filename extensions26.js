/* ================================================================
   Phase 48 — Payment-return detection + Paid state
   ================================================================
   What this closes:

   - User pays via Razorpay on day 11. Returns to the tool.
     Currently: nothing. Tool still says "trial: 2 days left".
     Drip keeps going. Day 12 "trial ends Friday" email arrives
     in a paying customer's inbox. Embarrassing.

   - User reaches payment page and completes payment but opens
     the tool in a fresh browser. The fresh browser has no idea
     they're paid. They see trial state.

   This phase:

   1. Detects payment on return — several triggers:
      - URL params: ?paid=1, ?razorpay_payment_id=..., #paid
      - sessionStorage flag set when the Pay button is clicked
        (so even if Razorpay strips query params on return,
        we know they completed the flow if they land back here)

   2. When detected, fires one-shot "Paid" acknowledgment:
      - Updates workspace.plan from 'trial' → 'paid'
      - Records paidAt timestamp + payment_id (if provided)
      - Fires payment_completed event to the Sheet (stops drip)
      - Shows a celebratory modal: "Payment received, workspace
        upgraded"
      - Hides every trial-expiry gating UI

   3. On every subsequent load, treats the user as paid.

   4. Manual override: Settings → "I've paid, mark my workspace
      as active" button (with payment ref input) for the case
      where auto-detection missed — paid via bank transfer,
      different browser, etc.

   Zero backend. The Sheet is the source of truth for the drip's
   "did they pay?" check (Phase 45 already reads payment_completed
   events to exclude users from the drip).
   ================================================================ */

(() => {

/* ---------------- State ---------------- */

function paidState() {
  state.settings = state.settings || {};
  state.settings.paid = state.settings.paid || {
    isPaid: false,
    paidAt: null,
    paymentId: null,
    method: null,       // 'razorpay' | 'manual' | 'other'
    acknowledged: false // user has seen the "Payment received" modal
  };
  return state.settings.paid;
}

function isPaid() {
  const p = paidState();
  return !!p.isPaid;
}

/* ---------------- Detection: on-load scan ---------------- */

function detectPaymentOnLoad() {
  try {
    const url = new URL(location.href);
    const qs = url.searchParams;

    // Razorpay standard success params
    const rpId = qs.get('razorpay_payment_id') || qs.get('payment_id');
    const paidFlag = qs.get('paid') === '1' || qs.get('status') === 'success';
    const hashPaid = location.hash === '#paid' || location.hash === '#payment-success';

    // sessionStorage trail: set when user clicked a Pay button
    const pendingTrail = sessionStorage.getItem('sst_pay_pending');

    let trigger = null;
    if (rpId) trigger = { method: 'razorpay', paymentId: rpId };
    else if (paidFlag || hashPaid) trigger = { method: 'razorpay', paymentId: null };
    else if (pendingTrail) {
      // User clicked Pay and came back without query params. If they
      // were gone > 30s and < 30min, assume success-ish (Razorpay
      // flow takes a little while). Avoid false positive on quick
      // back button.
      const clickedAt = parseInt(pendingTrail, 10);
      const elapsed = Date.now() - clickedAt;
      if (elapsed > 30 * 1000 && elapsed < 30 * 60 * 1000) {
        trigger = { method: 'razorpay', paymentId: null, inferred: true };
      }
    }

    if (trigger) {
      markPaid(trigger);
      // Clean the URL so refreshes don't re-fire
      try {
        const clean = new URL(location.href);
        ['razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature',
         'payment_id', 'paid', 'status'].forEach(k => clean.searchParams.delete(k));
        if (clean.hash === '#paid' || clean.hash === '#payment-success') clean.hash = '';
        history.replaceState({}, '', clean.toString());
      } catch (_) {}
      sessionStorage.removeItem('sst_pay_pending');
    }
  } catch (e) { console.warn('detectPaymentOnLoad failed', e); }
}

/* ---------------- Mark Paid ---------------- */

function markPaid({ method, paymentId, inferred }) {
  const p = paidState();
  if (p.isPaid) return; // already marked
  p.isPaid = true;
  p.paidAt = new Date().toISOString();
  p.paymentId = paymentId || null;
  p.method = method || 'razorpay';
  p.inferred = !!inferred;

  // Update workspace plan
  try {
    const w = workspace();
    w.plan = 'paid';
    w.paidAt = p.paidAt;
  } catch (_) {}

  if (typeof save === 'function') save();

  // Fire telemetry so the drip stops on its next daily run
  postPaymentEvent({ paymentId, method, inferred });

  // Show celebratory acknowledgment (once)
  showPaidAck();

  // Repaint any trial-state UI
  try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
}

/* ---------------- Telemetry to Sheet (stops drip) ---------------- */

function postPaymentEvent({ paymentId, method, inferred }) {
  try {
    const url = (typeof signupEndpoint === 'function') ? signupEndpoint() : null;
    if (!url || url.includes('PASTE-YOUR')) return;
    const w = (typeof workspace === 'function') ? workspace() : {};
    const body = new URLSearchParams();
    body.append('event_type', 'payment_completed');
    body.append('email', w.ownerEmail || '');
    body.append('company', w.companyName || '');
    body.append('workspace_id', w.id || '');
    body.append('method', method || 'razorpay');
    body.append('payment_id', paymentId || '');
    body.append('inferred', inferred ? '1' : '');
    fetch(url, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
  } catch (_) {}
}

/* ---------------- Celebratory acknowledgment modal ---------------- */

function showPaidAck() {
  const p = paidState();
  if (p.acknowledged) return;

  document.getElementById('pay-ack')?.remove();
  const m = document.createElement('div');
  m.id = 'pay-ack';
  m.className = 'pay-ack';
  m.innerHTML = `
    <div class="pay-ack-backdrop"></div>
    <div class="pay-ack-card">
      <div class="pay-ack-check">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h2>Payment received</h2>
      <p class="pay-ack-sub">${p.inferred
        ? "Welcome back. If you just completed a payment, your workspace is now unlocked. Any upcoming trial emails will stop within 24 hours."
        : "Your workspace is now on the paid plan. Trial reminders will not be sent again."}</p>
      ${p.paymentId ? `<div class="pay-ack-ref">Payment reference: <code>${escapeHtml(p.paymentId)}</code></div>` : ''}
      <div class="pay-ack-detail">
        <div><b>What changes</b></div>
        <ul>
          <li>Trial countdown removed from the sidebar</li>
          <li>Paywalls (Pay button prompts) hidden</li>
          <li>Your data, contracts, and settings stay exactly where they are — nothing moves</li>
          <li>Welcome email with receipt sent to your inbox within a few minutes</li>
        </ul>
      </div>
      <div class="pay-ack-foot">
        <span>Payment didn't go through or this is a mistake?</span>
        <button type="button" class="pay-ack-link" id="pay-ack-undo">Undo</button>
      </div>
      <button type="button" class="pay-ack-primary" id="pay-ack-close">Got it</button>
    </div>
  `;
  document.body.appendChild(m);

  m.querySelector('#pay-ack-close').onclick = () => {
    p.acknowledged = true;
    if (typeof save === 'function') save();
    m.remove();
  };
  m.querySelector('#pay-ack-undo').onclick = () => {
    if (!confirm('Undo the paid marking? Your workspace returns to trial state and drip emails may resume.')) return;
    const px = paidState();
    px.isPaid = false; px.paidAt = null; px.paymentId = null; px.acknowledged = false; px.inferred = false;
    try {
      const w = workspace();
      w.plan = 'trial';
      delete w.paidAt;
    } catch (_) {}
    if (typeof save === 'function') save();
    m.remove();
    try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
  };
}

/* ---------------- Instrument every Pay button ---------------- */

/* When user clicks any Pay link (Razorpay URL or data-pay attribute),
   drop a sessionStorage trail so we can infer payment on return
   even if query params are stripped. */
function wirePayButtons() {
  // Links that go to rzp.io or an in-tool pay geo router
  document.querySelectorAll('a[href*="rzp.io"], a[href*="razorpay"], [data-pay], [data-pay-india], [data-pay-global], [data-pay-geo]').forEach(el => {
    if (el._sst_pay_wired) return;
    el._sst_pay_wired = true;
    const handler = () => { try { sessionStorage.setItem('sst_pay_pending', String(Date.now())); } catch (_) {} };
    el.addEventListener('click', handler);
    el.addEventListener('auxclick', handler);
  });
}

/* ---------------- Hide trial-gating UI once paid ---------------- */

function hideTrialChrome() {
  if (!isPaid()) return;
  // Remove any trial countdown badge/banner Phase 23 (trial expiry) added
  document.querySelectorAll('.trial-banner, .trial-countdown, [data-trial-only]').forEach(el => el.remove());
  // Replace "Trial" plan badges with "Paid"
  document.querySelectorAll('.plan-badge, [data-plan-badge]').forEach(el => {
    if (el.textContent.toLowerCase().includes('trial')) {
      el.textContent = 'Paid plan · Active';
      el.classList.add('is-paid');
    }
  });
}

/* ---------------- Manual override (Settings integration) ---------------- */

/* Appended as a button in the Settings view. Also callable from
   the console as window.MarkPaid.manual('ref123'). */
function manualMarkPaid(paymentId, method = 'manual') {
  const px = paidState();
  if (px.isPaid) {
    alert('Workspace is already marked paid.');
    return;
  }
  markPaid({ method, paymentId: paymentId || null, inferred: false });
}

function injectManualPaidButton() {
  if (isPaid()) return;
  const settings = document.querySelector('.view[data-view="settings"]');
  if (!settings || !settings.querySelector('.st-grid')) return;
  if (settings.querySelector('#pay-manual-card')) return;
  const card = document.createElement('section');
  card.className = 'st-card';
  card.id = 'pay-manual-card';
  card.innerHTML = `
    <h3>I've paid — unlock my workspace</h3>
    <p class="st-note">If auto-detection missed your payment (bank transfer, different browser, or Razorpay redirect didn't bring you back), enter your payment reference here to mark the workspace paid. Fires the same confirmation flow.</p>
    <label class="st-field">
      <span>Payment reference (optional)</span>
      <input type="text" id="pay-manual-ref" placeholder="pay_ABC123 or bank UTR"/>
    </label>
    <button type="button" class="st-save" id="pay-manual-btn">Mark as paid</button>
  `;
  // Insert before the Danger zone card if present
  const danger = settings.querySelector('.st-card.is-danger');
  if (danger) settings.querySelector('.st-grid').insertBefore(card, danger);
  else settings.querySelector('.st-grid').appendChild(card);
  card.querySelector('#pay-manual-btn').onclick = () => {
    const ref = card.querySelector('#pay-manual-ref').value.trim();
    if (!confirm('Mark this workspace as paid? This will stop trial emails and remove trial chrome.')) return;
    manualMarkPaid(ref || null, 'manual');
  };
}

/* ---------------- Public handle ---------------- */

window.MarkPaid = {
  manual: manualMarkPaid,
  isPaid,
  state: paidState,
  undo: () => {
    const px = paidState();
    px.isPaid = false; px.paidAt = null; px.paymentId = null; px.acknowledged = false; px.inferred = false;
    try { const w = workspace(); w.plan = 'trial'; delete w.paidAt; } catch (_) {}
    if (typeof save === 'function') save();
    if (typeof renderAll === 'function') renderAll();
  },
};

/* ---------------- Boot ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    detectPaymentOnLoad();
    wirePayButtons();
    hideTrialChrome();
    injectManualPaidButton();
  }, 600);
});

// Rebind after re-renders
const _prevAll48 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll48) {
  window.renderAll = function () {
    _prevAll48.apply(this, arguments);
    try {
      wirePayButtons();
      hideTrialChrome();
      injectManualPaidButton();
    } catch (_) {}
  };
}

// Also re-check when the user switches to settings
const _prevSwitch48 = typeof switchView === 'function' ? switchView : null;
if (_prevSwitch48 && !_prevSwitch48._p48) {
  window.switchView = function (name, opts) {
    const r = _prevSwitch48.apply(this, arguments);
    if (name === 'settings') setTimeout(injectManualPaidButton, 120);
    return r;
  };
  window.switchView._p48 = true;
}

})();
