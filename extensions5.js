/* ==========================================================================
   SaaS Spend Track — Phase 4
   Renewal Command Center
   One working surface: every renewal in the next 120 days as cards.
   Each card shows act-by, risk, playbook deviations, owner, and three actions.
   ========================================================================== */

/* ---------------- Settings ---------------- */
function renewalFilters() { return state.settings.renewalFilters || { horizon: 120, lane: 'all', owner: '' }; }
function setRenewalFilters(patch) {
  state.settings.renewalFilters = { ...renewalFilters(), ...patch };
  save();
  renderRenewalCenter();
}

function renewalDecisions() { return state.settings.renewalDecisions || {}; }
function setRenewalDecision(subId, kind, note) {
  const d = { ...renewalDecisions() };
  d[subId] = { kind, note: note || '', at: new Date().toISOString(), by: 'me' };
  state.settings.renewalDecisions = d;
  save();
  renderRenewalCenter();
  renderAll();
}
function clearRenewalDecision(subId) {
  const d = { ...renewalDecisions() }; delete d[subId];
  state.settings.renewalDecisions = d;
  save();
  renderRenewalCenter();
  renderAll();
}

/* ---------------- Build the pipeline ---------------- */
function buildRenewalPipeline() {
  const f = renewalFilters();
  const today = new Date(); today.setHours(0,0,0,0);
  const horizonDate = new Date(today); horizonDate.setDate(horizonDate.getDate() + (f.horizon || 120));
  const ctx = portfolioCtx();
  const pb = playbook();
  const decs = renewalDecisions();

  const rows = activeSubs().map(s => {
    const renewal = nextRenewal(s);
    if (!renewal) return null;
    if (renewal > horizonDate) return null;
    const win = computeNoticeWindow(s);
    const risk = s.contract ? scoreContract(s, ctx) : null;
    const ev = s.contract ? evaluatePlaybook(s) : { results: [], score: null, requiredCount: 0 };
    const deviations = ev.results.filter(r => r.state === 'deviation' || r.state === 'missing');

    // Lane classification
    let lane;
    if (decs[s.id]) {
      lane = decs[s.id].kind; // renew / renegotiate / cancel / downgrade
    } else if (win && win.daysLeft < 0) {
      lane = 'overdue';
    } else if (win && win.daysLeft <= 14) {
      lane = 'critical';
    } else if (win && win.daysLeft <= 45) {
      lane = 'soon';
    } else {
      lane = 'upcoming';
    }
    return { s, renewal, win, risk, ev, deviations, lane, decision: decs[s.id] || null };
  }).filter(Boolean);

  // Filter by lane / owner
  const filtered = rows.filter(r => {
    if (f.lane && f.lane !== 'all' && r.lane !== f.lane) return false;
    if (f.owner && (r.s.owner?.email || '').toLowerCase() !== f.owner.toLowerCase()) return false;
    return true;
  });

  // Sort within lane by act-by then renewal
  const laneOrder = { overdue: 0, critical: 1, soon: 2, upcoming: 3, renew: 4, renegotiate: 5, downgrade: 6, cancel: 7 };
  filtered.sort((a, b) => {
    const la = laneOrder[a.lane] ?? 99, lb = laneOrder[b.lane] ?? 99;
    if (la !== lb) return la - lb;
    const ad = a.win ? a.win.daysLeft : 999;
    const bd = b.win ? b.win.daysLeft : 999;
    return ad - bd;
  });

  // Group for pipeline view
  const lanes = {};
  filtered.forEach(r => { (lanes[r.lane] ||= []).push(r); });

  return { rows: filtered, lanes, horizon: f.horizon || 120 };
}

/* ---------------- Render ---------------- */
const LANE_META = {
  overdue:     { label: 'Overdue',               colour: 'danger',  tag: 'Act-by date missed' },
  critical:    { label: 'Critical (≤14 days)',   colour: 'danger',  tag: 'Decide this week' },
  soon:        { label: 'Decide soon (≤45 days)',colour: 'warn',    tag: 'In the window' },
  upcoming:    { label: 'Upcoming',              colour: 'info',    tag: 'Prepare now' },
  renew:       { label: 'Will renew',            colour: 'ok',      tag: 'Decision locked' },
  renegotiate: { label: 'In renegotiation',      colour: 'info',    tag: 'Working the vendor' },
  downgrade:   { label: 'Downgrading',           colour: 'warn',    tag: 'Scope change' },
  cancel:      { label: 'Cancelling',            colour: 'danger',  tag: 'Exit in flight' },
};

function renewalCard({ s, renewal, win, risk, ev, deviations, lane, decision }) {
  const meta = LANE_META[lane];
  const daysToRenewal = Math.round((renewal - new Date()) / 86400000);
  const actByDays = win ? win.daysLeft : null;
  const riskBand_ = risk ? riskBand(risk.overall) : null;
  const annual = monthlyCost(s) * 12;
  const dpiStr = decision ? `${decision.kind} · ${new Date(decision.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : null;

  return `<div class="rc-card lane-${lane}" data-rc-sub="${s.id}">
    <div class="rc-card-head">
      <div class="rc-vendor">
        <div class="avatar" style="background:${avatarColor(s.name)}">${initials(s.name)}</div>
        <div>
          <div class="rc-name"><a href="#" class="vendor-link" data-vendor-nav="${s.id}">${escapeHtml(s.name)}</a></div>
          <div class="rc-meta">${escapeHtml(s.team || '—')} · ${escapeHtml(s.category || '—')}</div>
        </div>
      </div>
      <div class="rc-cost">
        <div class="rc-cost-main">${formatMoney(annual)}</div>
        <div class="rc-cost-sub">${formatMoney(monthlyCost(s))}/mo</div>
      </div>
    </div>

    <div class="rc-timeline">
      <div class="rc-time">
        <div class="rc-time-label">Act by</div>
        <div class="rc-time-value ${actByDays != null && actByDays < 0 ? 'overdue' : actByDays != null && actByDays <= 14 ? 'urgent' : ''}">${win ? win.cancelBy.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
        <div class="rc-time-sub">${actByDays != null ? (actByDays < 0 ? `${Math.abs(actByDays)} days overdue` : `${actByDays} days left`) : 'notice period not on file'}</div>
      </div>
      <div class="rc-time">
        <div class="rc-time-label">Renews</div>
        <div class="rc-time-value">${renewal.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        <div class="rc-time-sub">${daysToRenewal} days</div>
      </div>
      <div class="rc-time">
        <div class="rc-time-label">Owner</div>
        <div class="rc-time-value">${escapeHtml(s.owner?.name || 'unassigned')}</div>
        <div class="rc-time-sub">${s.owner?.email ? `escalates to ${escapeHtml(s.manager?.name || 'manager')}` : 'add an owner to arm alerts'}</div>
      </div>
    </div>

    <div class="rc-signals">
      ${risk ? `<div class="rc-signal risk-cell ${riskBand_.cls}" title="Contract risk ${risk.overall}/100"><b>${risk.overall}</b> risk</div>` : '<div class="rc-signal rc-signal-muted">No contract on file</div>'}
      ${deviations.length ? `<div class="rc-signal badge danger">${deviations.length} playbook deviation${deviations.length === 1 ? '' : 's'}</div>` : (ev.requiredCount ? '<div class="rc-signal badge ok">Playbook: compliant</div>' : '')}
      ${(() => {
        const cons = consumption(s);
        if (cons && cons.utilizationPct < 70) return `<div class="rc-signal badge warn">${cons.utilizationPct}% seat use · ${formatMoney(cons.unusedCostMonthly)}/mo idle</div>`;
        return '';
      })()}
      ${s.contract?.priceCapPct == null && s.contract?.renewalType === 'Auto-renew' ? '<div class="rc-signal badge danger">No price cap</div>' : ''}
    </div>

    ${deviations.length ? `<div class="rc-deviations">
      <div class="rc-dev-head">Playbook deviations</div>
      <ul>${deviations.slice(0, 3).map(d => `<li><b>${escapeHtml(d.label)}:</b> ${d.state === 'missing' ? 'missing' : `expected ${escapeHtml(d.expected || '—')}, got ${escapeHtml(d.actual || '—')}`}</li>`).join('')}${deviations.length > 3 ? `<li class="rc-dev-more">+ ${deviations.length - 3} more</li>` : ''}</ul>
    </div>` : ''}

    <div class="rc-foot">
      ${decision ? `<div class="rc-decision">
        <span class="badge ${decision.kind === 'cancel' ? 'danger' : decision.kind === 'renew' ? 'ok' : 'warn'}">${decision.kind}</span>
        <span class="rc-decision-note">${escapeHtml(decision.note || '')}</span>
        <button class="link" data-rc-clear="${s.id}">Reset decision</button>
      </div>` : `<div class="rc-actions">
        <button class="icon-btn rc-act" data-rc-act="renew" data-rc-sub="${s.id}" title="Lock the renewal">Renew</button>
        <button class="icon-btn rc-act rc-act-primary" data-rc-act="renegotiate" data-rc-sub="${s.id}" title="Start renegotiation">Renegotiate</button>
        <button class="icon-btn rc-act" data-rc-act="downgrade" data-rc-sub="${s.id}" title="Downgrade tier or seats">Downgrade</button>
        <button class="icon-btn danger rc-act" data-rc-act="cancel" data-rc-sub="${s.id}" title="Cancel at renewal">Cancel</button>
      </div>`}
    </div>
  </div>`;
}

function renderRenewalCenter() {
  const host = document.getElementById('rc-body');
  if (!host) return;
  const { rows, lanes, horizon } = buildRenewalPipeline();
  const f = renewalFilters();

  // KPI summary
  const totalAnnual = rows.reduce((s, r) => s + monthlyCost(r.s) * 12, 0);
  const overdueCount = (lanes.overdue || []).length;
  const critCount    = (lanes.critical || []).length;
  const actionTaken  = rows.filter(r => r.decision).length;
  const unassigned   = rows.filter(r => !r.s.owner?.email).length;

  // Owner filter list
  const owners = [...new Set(activeSubs().map(s => s.owner?.email).filter(Boolean))].sort();

  host.innerHTML = `
    <div class="rc-filter-bar">
      <div class="filter-group"><label>Horizon</label>
        <select class="rc-select" id="rc-horizon">
          <option value="30"  ${f.horizon === 30  ? 'selected' : ''}>Next 30 days</option>
          <option value="60"  ${f.horizon === 60  ? 'selected' : ''}>Next 60 days</option>
          <option value="90"  ${f.horizon === 90  ? 'selected' : ''}>Next 90 days</option>
          <option value="120" ${(f.horizon || 120) === 120 ? 'selected' : ''}>Next 120 days</option>
          <option value="180" ${f.horizon === 180 ? 'selected' : ''}>Next 180 days</option>
        </select>
      </div>
      <div class="filter-group"><label>Lane</label>
        <select class="rc-select" id="rc-lane">
          <option value="all" ${f.lane === 'all' ? 'selected' : ''}>All lanes</option>
          ${Object.entries(LANE_META).map(([k, v]) => `<option value="${k}" ${f.lane === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group"><label>Owner</label>
        <select class="rc-select" id="rc-owner">
          <option value="">Everyone</option>
          ${owners.map(o => `<option value="${escapeHtml(o)}" ${f.owner === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
        </select>
      </div>
      <button class="icon-btn" id="rc-clear">Clear</button>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="icon-btn" data-pdf-export="rc-body" data-pdf-title="Renewal Command Center">Download PDF</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">In the pipeline</span><span class="stat-value">${rows.length}</span><span class="stat-sub">next ${horizon} days</span></div>
      <div class="stat-card"><span class="stat-label">Annualised spend in play</span><span class="stat-value">${formatMoney(totalAnnual)}</span><span class="stat-sub">across pipeline</span></div>
      <div class="stat-card"><span class="stat-label">Act-by missed or imminent</span><span class="stat-value" style="color:var(--danger-text)">${overdueCount + critCount}</span><span class="stat-sub">${overdueCount} overdue · ${critCount} ≤14 days</span></div>
      <div class="stat-card"><span class="stat-label">Decisions logged</span><span class="stat-value">${actionTaken}</span><span class="stat-sub">${unassigned} unassigned owner${unassigned === 1 ? '' : 's'}</span></div>
    </div>

    ${rows.length === 0 ? '<div class="panel"><p class="empty">Nothing renewing in the chosen window. Widen the horizon or clear the filters.</p></div>' : ''}

    ${Object.entries(LANE_META).map(([k, v]) => {
      const laneRows = lanes[k] || [];
      if (!laneRows.length) return '';
      const laneAnnual = laneRows.reduce((s, r) => s + monthlyCost(r.s) * 12, 0);
      return `<section class="rc-lane">
        <div class="rc-lane-head">
          <div>
            <h3>${v.label} <span class="badge ${v.colour}">${laneRows.length}</span></h3>
            <p>${v.tag} · ${formatMoney(laneAnnual)} annualised</p>
          </div>
        </div>
        <div class="rc-cards">${laneRows.map(renewalCard).join('')}</div>
      </section>`;
    }).join('')}
  `;

  // Wire up filter changes
  document.getElementById('rc-horizon').addEventListener('change', e => setRenewalFilters({ horizon: parseInt(e.target.value, 10) }));
  document.getElementById('rc-lane').addEventListener('change', e => setRenewalFilters({ lane: e.target.value }));
  document.getElementById('rc-owner').addEventListener('change', e => setRenewalFilters({ owner: e.target.value }));
  document.getElementById('rc-clear').onclick = () => setRenewalFilters({ horizon: 120, lane: 'all', owner: '' });

  // Wire action buttons (delegate once per render)
  host.querySelectorAll('[data-rc-act]').forEach(btn => btn.addEventListener('click', () => {
    const kind = btn.dataset.rcAct;
    const subId = btn.dataset.rcSub;
    const note = prompt(`Add a note for this ${kind} decision (optional):`, '');
    if (note === null) return; // cancelled
    setRenewalDecision(subId, kind, note);
    toast(`Marked as ${kind}.`, 'success');
  }));
  host.querySelectorAll('[data-rc-clear]').forEach(btn => btn.addEventListener('click', () => {
    clearRenewalDecision(btn.dataset.rcClear);
    toast('Decision cleared.', 'success');
  }));
}

/* ---------------- Patch nav + view ---------------- */
function ensureRenewalCenterView() {
  if (document.getElementById('renewal-center')) return;
  const main = document.querySelector('.main-area main');
  if (!main) return;
  const section = document.createElement('section');
  section.id = 'renewal-center';
  section.className = 'view';
  section.innerHTML = `
    <div class="section-head"><div><h2>Renewal Command Center</h2><p class="page-sub">Your Monday working surface. Every renewal in the chosen horizon, grouped by urgency, with risk, playbook deviations and owner. Pick an action to move it along.</p></div></div>
    <div id="rc-body"></div>
  `;
  // Insert at top-ish of main
  main.insertBefore(section, main.firstChild.nextSibling);
}

function ensureRenewalCenterNavLink() {
  // Add into Overview group (first .nav-group) as the first tab, so it's the default landing when desired
  const firstGroup = document.querySelector('.sidebar .nav-group');
  if (!firstGroup || firstGroup.querySelector('[data-view="renewal-center"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab';
  btn.dataset.view = 'renewal-center';
  btn.innerHTML = `${svg}<span>Renewal Center</span><span class="nav-count" id="nav-count-renewal-center" hidden></span>`;
  // Insert as the second item (after Dashboard)
  const dashTab = firstGroup.querySelector('[data-view="dashboard"]');
  if (dashTab && dashTab.nextSibling) firstGroup.insertBefore(btn, dashTab.nextSibling);
  else firstGroup.appendChild(btn);
  btn.addEventListener('click', () => switchView('renewal-center'));
}

/* Extend VIEWS at runtime */
function registerRenewalCenterInViews() {
  // Expose the renewal-center in the global PAGE_TITLES (now on window)
  if (window.PAGE_TITLES && !window.PAGE_TITLES['renewal-center']) window.PAGE_TITLES['renewal-center'] = 'Renewal Command Center';
  // VIEWS is a const in app.js scope; we can't mutate it. Instead wrap switchView to accept our view id.
  if (window._rcSwitchPatched) return;
  const _orig = window.switchView;
  if (typeof _orig !== 'function') return;
  window.switchView = function (name, opts = {}) {
    if (name === 'renewal-center') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      const crumb = document.getElementById('page-crumb');
      if (crumb) crumb.textContent = 'Renewal Command Center';
      if (!opts.replaceHistory) {
        const target = '#renewal-center';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._rcSwitchPatched = true;
}

/* Update nav count */
function updateRenewalCenterNavCount() {
  const el = document.getElementById('nav-count-renewal-center');
  if (!el) return;
  const { rows, lanes } = buildRenewalPipeline();
  const urgent = (lanes.overdue || []).length + (lanes.critical || []).length;
  el.textContent = urgent;
  el.hidden = !urgent;
}

/* Hook into renderAll */
const _prevAll5 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll5) {
  window.renderAll = function () {
    _prevAll5();
    try {
      ensureRenewalCenterView();
      ensureRenewalCenterNavLink();
      registerRenewalCenterInViews();
      renderRenewalCenter();
      updateRenewalCenterNavCount();
    } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureRenewalCenterView();
      ensureRenewalCenterNavLink();
      registerRenewalCenterInViews();
      renderRenewalCenter();
      updateRenewalCenterNavCount();
    } catch (_) {}
  }, 200);
});
