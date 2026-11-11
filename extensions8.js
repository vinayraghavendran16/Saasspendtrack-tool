/* ==========================================================================
   SaaS Spend Track — Phase 7
   Mobile owner flow
   - Dedicated mobile-first view at #owner (or ?owner=email)
   - Shows just one owner's pending alerts as swipeable cards
   - One-tap Acknowledge / Escalate / Start renegotiation
   - When loaded with ?owner=email, the whole app renders in mobile mode
     (hides sidebar, focuses on the owner surface). Lets you email a direct
     link to an owner that works straight from their phone.
   ========================================================================== */

/* ---------------- Who is the current owner ---------------- */
function currentOwnerEmail() {
  const url = new URL(location.href);
  return (url.searchParams.get('owner') || state.settings.currentOwner || '').toLowerCase();
}
function setCurrentOwner(email) {
  state.settings.currentOwner = email || '';
  save(); renderOwnerView();
}

function alertsForOwner(email) {
  if (!email) return [];
  return computeAlerts().filter(a => (a.sub.owner?.email || '').toLowerCase() === email.toLowerCase() && a.status !== 'acknowledged');
}
function ownersWithAlerts() {
  const all = computeAlerts();
  const emails = new Set();
  all.forEach(a => { if (a.sub.owner?.email && a.status !== 'acknowledged') emails.add(a.sub.owner.email.toLowerCase()); });
  return [...emails].sort();
}

/* ---------------- Render ---------------- */
function renderOwnerView() {
  const host = document.getElementById('owner-body'); if (!host) return;
  const email = currentOwnerEmail();
  const ctx = portfolioCtx();
  const pb = playbook();
  const owners = ownersWithAlerts();

  if (!email) {
    // No owner picked yet - show a picker
    host.innerHTML = `
      <div class="ow-wrap">
        <div class="ow-empty">
          <h3>Who are you?</h3>
          <p>This surface shows just your renewals. Pick your email to continue, or open a direct link from your email client.</p>
          <select class="rc-select ow-owner-pick">
            <option value="">Choose your email…</option>
            ${owners.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
          </select>
        </div>
      </div>`;
    host.querySelector('.ow-owner-pick').addEventListener('change', e => setCurrentOwner(e.target.value));
    return;
  }

  const alerts = alertsForOwner(email);
  const subInfo = (sub) => {
    const risk = sub.contract ? scoreContract(sub, ctx).overall : null;
    const win = computeNoticeWindow(sub);
    const ev = sub.contract ? evaluatePlaybook(sub) : null;
    const devs = ev ? ev.results.filter(r => r.state === 'deviation' || r.state === 'missing') : [];
    return { risk, win, devs };
  };
  // Group by subscription
  const grouped = {};
  alerts.forEach(a => { (grouped[a.sub.id] ||= { sub: a.sub, triggers: [] }).triggers.push(a); });
  const cards = Object.values(grouped);

  const countOverdue = alerts.filter(a => a.status === 'escalated').length;
  const countDue = alerts.filter(a => a.status === 'due' || a.status === 'sent').length;

  host.innerHTML = `
    <div class="ow-wrap">
      <div class="ow-head">
        <div class="ow-greet">
          <div class="ow-hi">Hi ${escapeHtml(email.split('@')[0].split('.')[0].charAt(0).toUpperCase() + email.split('@')[0].split('.')[0].slice(1))}</div>
          <div class="ow-sub">${alerts.length ? `You have ${alerts.length} renewal${alerts.length === 1 ? '' : 's'} that need attention.` : 'You are all caught up.'}</div>
        </div>
        <button class="icon-btn ow-switch" id="ow-switch">Switch</button>
      </div>

      <div class="ow-kpi-row">
        <div class="ow-kpi"><div class="ow-kpi-value" style="color:${countOverdue ? 'var(--danger-text)' : 'var(--text)'}">${countOverdue}</div><div class="ow-kpi-label">Escalated</div></div>
        <div class="ow-kpi"><div class="ow-kpi-value" style="color:${countDue ? 'var(--warning-text)' : 'var(--text)'}">${countDue}</div><div class="ow-kpi-label">Due now</div></div>
        <div class="ow-kpi"><div class="ow-kpi-value">${alerts.length}</div><div class="ow-kpi-label">Total</div></div>
      </div>

      ${cards.length === 0 ? `<div class="ow-done">
        <div class="ow-done-icon">✓</div>
        <h3>Inbox zero.</h3>
        <p>Nothing on your plate right now. Come back when the next alert fires.</p>
      </div>` : `
      <div class="ow-cards">${cards.map(({ sub, triggers }) => {
        const { risk, win, devs } = subInfo(sub);
        const worst = triggers.sort((a, b) => a.trigger - b.trigger)[0];
        const status = worst.status; // escalated | due | sent | scheduled
        return `<div class="ow-card status-${status}">
          <div class="ow-card-head">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <div class="avatar" style="background:${avatarColor(sub.name)};width:40px;height:40px;border-radius:9px;font-size:13px">${initials(sub.name)}</div>
              <div style="min-width:0">
                <div class="ow-vendor">${escapeHtml(sub.name)}</div>
                <div class="ow-meta">${escapeHtml(sub.team || '—')} · ${formatMoney(monthlyCost(sub) * 12)}/yr</div>
              </div>
            </div>
            <div class="ow-urgency ${status === 'escalated' ? 'danger' : status === 'sent' || status === 'due' ? 'warn' : 'info'}">
              ${status === 'escalated' ? 'Escalated' : status === 'sent' ? 'Awaiting ack' : status === 'due' ? 'Due now' : 'Scheduled'}
            </div>
          </div>
          <div class="ow-fact-row">
            <div class="ow-fact">
              <div class="ow-fact-label">Act by</div>
              <div class="ow-fact-value ${win && win.daysLeft < 7 ? 'urgent' : ''}">${win ? win.cancelBy.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</div>
              <div class="ow-fact-sub">${win ? (win.daysLeft < 0 ? `${Math.abs(win.daysLeft)} days overdue` : `${win.daysLeft} days`) : 'no notice period'}</div>
            </div>
            <div class="ow-fact">
              <div class="ow-fact-label">Risk</div>
              <div class="ow-fact-value">${risk != null ? risk : '—'}</div>
              <div class="ow-fact-sub">${risk != null ? riskBand(risk).label : 'no contract'}</div>
            </div>
            <div class="ow-fact">
              <div class="ow-fact-label">Alerts</div>
              <div class="ow-fact-value">${triggers.length}</div>
              <div class="ow-fact-sub">${triggers.map(t => `${t.trigger}d`).join(' · ')}</div>
            </div>
          </div>
          ${devs.length ? `<div class="ow-devs">
            <b>${devs.length} playbook deviation${devs.length === 1 ? '' : 's'}:</b>
            ${devs.slice(0, 2).map(d => escapeHtml(d.label)).join(', ')}${devs.length > 2 ? ` + ${devs.length - 2} more` : ''}
          </div>` : ''}
          <div class="ow-actions">
            <button class="ow-btn ow-btn-ack" data-ow-act="ack" data-ow-sub="${sub.id}">Acknowledge</button>
            <button class="ow-btn ow-btn-reneg" data-ow-act="reneg" data-ow-sub="${sub.id}">I'll renegotiate</button>
            <button class="ow-btn ow-btn-cancel" data-ow-act="cancel" data-ow-sub="${sub.id}">Cancel it</button>
          </div>
          <details class="ow-more">
            <summary>More details</summary>
            <div class="ow-detail">
              <div><b>Category:</b> ${escapeHtml(sub.category || '—')}</div>
              <div><b>Renewal:</b> ${sub.renewal || '—'}</div>
              <div><b>Notes:</b> ${escapeHtml(sub.notes || '—')}</div>
              <div><b>Manager:</b> ${escapeHtml(sub.manager?.name || '—')} ${sub.manager?.email ? `(${escapeHtml(sub.manager.email)})` : ''}</div>
            </div>
          </details>
        </div>`;
      }).join('')}</div>`}

      <div class="ow-foot">
        <p>You received a warning because you are the owner on this vendor. Tap <b>Acknowledge</b> if you have this under control; tap <b>Renegotiate</b> or <b>Cancel</b> to pass the decision upstream. Alerts you ignore will escalate to your manager in 3 days.</p>
      </div>
    </div>
  `;

  // Wire actions
  document.getElementById('ow-switch').onclick = () => { setCurrentOwner(''); };
  host.querySelectorAll('[data-ow-act]').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.owAct;
    const subId = btn.dataset.owSub;
    const sub = state.subscriptions.find(s => s.id === subId);
    if (!sub) return;
    if (action === 'ack') {
      // Acknowledge all triggers for this sub+owner
      alerts.filter(a => a.sub.id === subId).forEach(a => acknowledgeAlert(a.key, email));
      toast(`Acknowledged ${sub.name}.`, 'success');
    } else if (action === 'reneg') {
      setRenewalDecision(subId, 'renegotiate', `Owner (${email}) will renegotiate`);
      alerts.filter(a => a.sub.id === subId).forEach(a => acknowledgeAlert(a.key, email));
      toast(`Marked ${sub.name} for renegotiation.`, 'success');
    } else if (action === 'cancel') {
      if (!confirm(`Confirm cancel at renewal for ${sub.name}?`)) return;
      setRenewalDecision(subId, 'cancel', `Owner (${email}) decided to cancel`);
      alerts.filter(a => a.sub.id === subId).forEach(a => acknowledgeAlert(a.key, email));
      toast(`${sub.name} marked to cancel.`, 'success');
    }
    renderOwnerView();
  }));
}

/* ---------------- Setup: view + nav + routing ---------------- */
function ensureOwnerView() {
  if (document.getElementById('owner')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'owner';
  section.className = 'view';
  section.innerHTML = `
    <div class="section-head"><div><h2>Your inbox</h2><p class="page-sub">The owner-facing surface. Shows just the renewals assigned to the current owner. Share a direct link via <code>?owner=email@example.com</code> and the recipient can act with one tap on their phone.</p></div></div>
    <div id="owner-body"></div>
  `;
  main.appendChild(section);
}
function ensureOwnerNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const overview = [...groups][0];
  if (!overview || overview.querySelector('[data-view="owner"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 8l8 5 8-5"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'owner';
  btn.innerHTML = `${svg}<span>Owner inbox</span><span class="nav-count" id="nav-count-owner" hidden></span>`;
  overview.appendChild(btn);
  btn.addEventListener('click', () => switchView('owner'));
}
function patchSwitchViewForOwner() {
  if (window._owSwitchPatched) return;
  const _orig = window.switchView;
  window.switchView = function (name, opts = {}) {
    if (name === 'owner') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Owner inbox';
      if (!opts.replaceHistory) {
        const target = '#owner';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._owSwitchPatched = true;
}
function updateOwnerNavCount() {
  const el = document.getElementById('nav-count-owner'); if (!el) return;
  const email = currentOwnerEmail();
  if (!email) { el.hidden = true; return; }
  const n = alertsForOwner(email).length;
  el.textContent = n; el.hidden = !n;
}

/* Owner-only landing: when loaded with ?owner=..., hide everything else and
   go straight to the owner view (optimised for phones) */
function applyOwnerOnlyMode() {
  const url = new URL(location.href);
  if (!url.searchParams.get('owner')) return;
  document.documentElement.classList.add('owner-only');
  // Switch to the owner view immediately
  setTimeout(() => { try { switchView('owner'); } catch (_) {} }, 400);
}

/* Hook renderAll */
const _prevAll8 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll8) {
  window.renderAll = function () {
    _prevAll8();
    try {
      ensureOwnerView();
      ensureOwnerNav();
      patchSwitchViewForOwner();
      renderOwnerView();
      updateOwnerNavCount();
    } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureOwnerView();
      ensureOwnerNav();
      patchSwitchViewForOwner();
      renderOwnerView();
      updateOwnerNavCount();
      applyOwnerOnlyMode();
    } catch (_) {}
  }, 350);
});
