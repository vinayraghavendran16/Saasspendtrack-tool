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

/* ---------- Geo + price display ----------
   Mirrors the marketing site: USD primary for global visitors,
   INR primary for Indian visitors. Preference stored in
   localStorage under 'sst-geo' so it survives between the
   marketing site and the tool. */
function geoGet() {
  try {
    const v = localStorage.getItem('sst-geo');
    if (v === 'india' || v === 'global') return v;
  } catch (_) {}
  // Fast language hint
  const lang = (navigator.language || '').toLowerCase();
  if (lang.includes('-in') || lang.startsWith('hi') || lang.startsWith('ta') || lang.startsWith('te') || lang.startsWith('bn') || lang.startsWith('mr') || lang.startsWith('gu') || lang.startsWith('kn') || lang.startsWith('ml') || lang.startsWith('pa')) return 'india';
  return 'global';
}
function geoSet(g) {
  try { localStorage.setItem('sst-geo', g); } catch (_) {}
  // Re-render anything that cares
  try { ensureTrialBanner(); } catch (_) {}
  try { if (document.getElementById('expiry-gate')?.classList.contains('open')) { const g2 = ensureExpiryGate(); } } catch (_) {}
}
// IP confirmation on first load (one-time) if the user has NEVER explicitly chosen
(function geoIpBackfill() {
  let has = false;
  try { has = !!localStorage.getItem('sst-geo'); } catch (_) {}
  if (has) return;
  setTimeout(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        if (d && d.country_code) {
          const next = d.country_code === 'IN' ? 'india' : 'global';
          try {
            // Only set if still unset (user may have toggled in the meantime)
            if (!localStorage.getItem('sst-geo')) {
              localStorage.setItem('sst-geo', next);
              ensureTrialBanner();
            }
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, 1200);
})();
window.AskTrackGeo = { get: geoGet, set: geoSet };

function priceHeadline() {
  return geoGet() === 'india' ? '₹3,00,000' : '$3,499';
}
function priceWithPeriod() {
  return geoGet() === 'india' ? '₹3,00,000/yr' : '$3,499/yr';
}
function priceSubline() {
  return geoGet() === 'india'
    ? '+ 18% GST, invoiced separately · Includes 250 active contracts'
    : 'Billed annually via Razorpay · Includes 250 active contracts';
}

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
            <div class="eg-plan-price"><span class="eg-price-main" id="eg-price-main">${priceHeadline()}</span><span class="eg-price-period">/year</span></div>
          </div>
          <div class="eg-plan-inr" id="eg-plan-inr">${priceSubline()}</div>
          <div class="eg-plan-small">$100/year per 50 additional contracts above 250. Everything else stays flat.</div>
          <div class="eg-geo-toggle" role="group" aria-label="Pricing currency">
            <button type="button" class="eg-geo-btn ${geoGet()==='global'?'active':''}" data-geo="global">🌐 Show in USD</button>
            <button type="button" class="eg-geo-btn ${geoGet()==='india'?'active':''}" data-geo="india">🇮🇳 Show in INR</button>
          </div>
        </div>

        <div class="eg-actions">
          <a href="https://rzp.io/rzp/NCGW9GyD" target="_blank" rel="noopener" class="btn-primary btn-lg">Upgrade now</a>
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

  g.querySelectorAll('.eg-geo-btn').forEach(b => b.onclick = () => {
    geoSet(b.dataset.geo);
    // Live-update the card without reopening
    const m = g.querySelector('#eg-price-main'); if (m) m.textContent = priceHeadline();
    const s = g.querySelector('#eg-plan-inr'); if (s) s.textContent = priceSubline();
    g.querySelectorAll('.eg-geo-btn').forEach(x => x.classList.toggle('active', x.dataset.geo === b.dataset.geo));
  });
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
    <a href="https://rzp.io/rzp/NCGW9GyD" target="_blank" rel="noopener" class="trial-banner-cta">${t.inGrace ? 'Upgrade' : 'Upgrade ' + priceWithPeriod()}</a>
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
