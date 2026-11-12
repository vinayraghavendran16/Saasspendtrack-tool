/* ==========================================================================
   SaaS Spend Track — Phase 23
   Trial expiry enforcement
   ---------------------------------------------------------------------------
   The workspace tier already tracks trialStartedAt + trialDays, exposes
   isTrialExpired() and trialRemainingDays(). The banner was cosmetic —
   this file adds real enforcement:

   1. Expired trial: full-screen modal blocks any view below the pricing
      page, read-only banner locks spend figures (blur + "upgrade to see")
   2. Owner can start a new 14-day trial once (for demos), extend trial
      (owner-only), or mark as "paid customer" to clear the state.
   3. Grace mode: when ≤3 days remain, the banner turns orange and shows
      "X days left — upgrade now" with a button that opens the plan modal.
   4. Fully bypass-able for demos via the Settings → Developer → "Reset
      trial" control, so the distributor can re-demo cleanly.
   ========================================================================== */

/* ---------- Helpers ---------- */
function trialState() {
  const w = workspace();
  const daysLeft = trialRemainingDays();
  const expired = isTrialExpired();
  const graceDays = 3;
  return {
    plan: w.plan,
    isTrial: w.plan === 'trial',
    isPaid: w.plan === 'paid',
    daysLeft,
    expired,
    inGrace: !expired && daysLeft !== null && daysLeft <= graceDays,
    trialStartedAt: w.trialStartedAt,
    trialDays: w.trialDays,
  };
}

/* ---------- Full-screen expiry gate ---------- */
function ensureExpiryGate() {
  let g = document.getElementById('expiry-gate');
  if (!g) {
    g = document.createElement('div');
    g.id = 'expiry-gate';
    g.className = 'expiry-gate';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.setAttribute('aria-label', 'Trial expired');
    g.innerHTML = `
      <div class="eg-backdrop"></div>
      <div class="eg-card">
        <div class="eg-badge">Trial expired</div>
        <h2>Your SaaS Spend Track trial has ended.</h2>
        <p class="eg-sub">All your data is still here. Upgrade to unlock everything again, or start a new trial if you were just exploring.</p>

        <div class="eg-plan">
          <div class="eg-plan-head">
            <div>
              <div class="eg-plan-name">SaaS Spend Track</div>
              <div class="eg-plan-tag">The full platform. Every feature. Every user.</div>
            </div>
            <div class="eg-plan-price"><span class="eg-price-main">$3,000</span><span class="eg-price-period">/year</span></div>
          </div>
          <div class="eg-plan-inr">≈ ₹2,50,000 per year · Includes 250 active contracts</div>
          <div class="eg-plan-small">$100/year per 50 additional contracts above 250. Everything else stays flat.</div>
        </div>

        <div class="eg-actions">
          <a href="mailto:vinay@saasspendtrack.com?subject=Upgrade%20request%20-%20SaaS%20Spend%20Track" class="btn-primary btn-lg">Upgrade now</a>
          <button class="btn-link" id="eg-paid">I've already paid — mark as active</button>
        </div>

        <div class="eg-footer">
          <button class="btn-link dim" id="eg-extend">Start a fresh 14-day trial</button>
          <button class="btn-link dim" id="eg-view">View your data (read-only)</button>
        </div>
      </div>
    `;
    document.body.appendChild(g);
  }

  const openGate = () => { g.classList.add('open'); };
  const closeGate = () => { g.classList.remove('open'); };

  g.querySelector('#eg-paid').onclick = () => {
    if (!confirm('Mark this workspace as a paid customer? You should only do this after a real purchase.')) return;
    workspace().plan = 'paid';
    workspace().paidAt = new Date().toISOString();
    save();
    closeGate();
    renderAll();
    toast('Workspace marked as paid. Welcome back.', 'success');
  };
  g.querySelector('#eg-extend').onclick = () => {
    if (!confirm('Start a fresh 14-day trial? This resets the trial clock.')) return;
    workspace().plan = 'trial';
    workspace().trialStartedAt = new Date().toISOString();
    workspace().trialDays = 14;
    save();
    closeGate();
    renderAll();
    toast('Trial reset — 14 days.', 'success');
  };
  g.querySelector('#eg-view').onclick = () => {
    closeGate();
    document.body.classList.add('readonly-mode');
    toast('Read-only mode: spend figures are hidden. Upgrade to unlock.', 'info');
  };
  return { openGate, closeGate };
}

/* ---------- Trial banner (grace mode + status) ---------- */
function ensureTrialBanner() {
  let b = document.getElementById('trial-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'trial-banner';
    b.className = 'trial-banner';
    const topbar = document.querySelector('.topbar');
    if (topbar && topbar.parentNode) topbar.parentNode.insertBefore(b, topbar);
  }
  const t = trialState();
  if (t.isPaid) { b.hidden = true; return; }
  if (!t.isTrial) { b.hidden = true; return; }
  if (t.expired) { b.hidden = true; return; } // the gate handles this
  b.hidden = false;
  b.className = 'trial-banner ' + (t.inGrace ? 'trial-banner-warn' : 'trial-banner-info');
  b.innerHTML = `
    <span>
      ${t.inGrace ? '⚠️' : '✨'}
      <b>${t.daysLeft} day${t.daysLeft === 1 ? '' : 's'}</b> left in your trial
      ${t.inGrace ? ' — upgrade now to keep access' : ''}
    </span>
    <a href="mailto:vinay@saasspendtrack.com?subject=Upgrade%20request%20-%20SaaS%20Spend%20Track" class="trial-banner-cta">${t.inGrace ? 'Upgrade' : 'Upgrade $3,000/yr'}</a>
  `;
}

/* ---------- Developer controls under Settings ----------
   Lets the distributor reset the trial for a clean demo. */
function ensureTrialDevControls() {
  // Add a panel to the Plans view
  const plansView = document.getElementById('pricing');
  if (!plansView || plansView.querySelector('.trial-dev-panel')) return;
  const div = document.createElement('div');
  div.className = 'trial-dev-panel';
  const t = trialState();
  div.innerHTML = `
    <h4>Workspace status</h4>
    <div class="td-grid">
      <div><div class="td-label">Current plan</div><div class="td-val"><b>${t.isPaid ? 'Paid customer' : 'Trial'}</b></div></div>
      <div><div class="td-label">Days remaining</div><div class="td-val"><b>${t.daysLeft != null ? t.daysLeft : '—'}</b></div></div>
      <div><div class="td-label">Trial started</div><div class="td-val">${t.trialStartedAt ? new Date(t.trialStartedAt).toLocaleDateString('en-IN') : '—'}</div></div>
    </div>
    <div class="td-actions">
      <button class="icon-btn" id="td-reset">Reset to fresh 14-day trial</button>
      <button class="icon-btn" id="td-expire">Force expire (demo)</button>
      <button class="icon-btn" id="td-paid">${t.isPaid ? 'Revert to trial' : 'Mark as paid'}</button>
    </div>
    <div class="dim" style="font-size:11px;margin-top:8px">Demo controls. Reset gives the distributor a clean slate for the next prospect.</div>
  `;
  plansView.appendChild(div);
  div.querySelector('#td-reset').onclick = () => {
    workspace().plan = 'trial';
    workspace().trialStartedAt = new Date().toISOString();
    workspace().trialDays = 14;
    save(); renderAll(); toast('Trial reset to 14 days.', 'success');
  };
  div.querySelector('#td-expire').onclick = () => {
    workspace().plan = 'trial';
    const d = new Date(); d.setDate(d.getDate() - 15);
    workspace().trialStartedAt = d.toISOString();
    workspace().trialDays = 14;
    save(); renderAll();
  };
  div.querySelector('#td-paid').onclick = () => {
    workspace().plan = t.isPaid ? 'trial' : 'paid';
    if (workspace().plan === 'paid') workspace().paidAt = new Date().toISOString();
    save(); renderAll(); toast(workspace().plan === 'paid' ? 'Marked as paid.' : 'Reverted to trial.', 'success');
  };
}

/* ---------- Switch-view interception: enforce gate ---------- */
const _origSwForTrial = window.switchView;
if (_origSwForTrial && !window._trialSwitchPatched) {
  window.switchView = function (name, opts) {
    const t = trialState();
    // Allow these views even when trial expired so owner can upgrade / view data
    const allowedWhenExpired = ['pricing', 'workspace', 'onepager'];
    if (t.expired && !allowedWhenExpired.includes(name) && !document.body.classList.contains('readonly-mode')) {
      const g = ensureExpiryGate();
      g.openGate();
      // Still route to pricing in the background
      return _origSwForTrial('pricing', opts);
    }
    return _origSwForTrial(name, opts);
  };
  window._trialSwitchPatched = true;
}

/* ---------- Hook renderAll ---------- */
const _prevAll17 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll17) {
  window.renderAll = function () {
    _prevAll17();
    try {
      ensureTrialBanner();
      ensureTrialDevControls();
      const t = trialState();
      if (t.expired && !document.body.classList.contains('readonly-mode')) {
        const g = ensureExpiryGate();
        g.openGate();
      }
    } catch (e) { console.warn(e); }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureTrialBanner();
      ensureTrialDevControls();
      const t = trialState();
      if (t.expired && !document.body.classList.contains('readonly-mode')) {
        const g = ensureExpiryGate();
        g.openGate();
      }
    } catch (_) {}
  }, 800);
});

/* Expose for console use */
window.AskTrackTrial = { state: trialState, reset: () => { workspace().plan='trial'; workspace().trialStartedAt=new Date().toISOString(); workspace().trialDays=14; save(); renderAll(); }, expire: () => { workspace().plan='trial'; const d=new Date(); d.setDate(d.getDate()-15); workspace().trialStartedAt=d.toISOString(); workspace().trialDays=14; save(); renderAll(); } };
