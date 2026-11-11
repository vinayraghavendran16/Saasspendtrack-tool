/* ==========================================================================
   SaaS Spend Track — Phase 6
   Scenario Planner
   - Drag vendors into a Proposed Changes tray
   - Apply actions: cancel, downgrade %, renegotiate price %, consolidate
   - See deltas on run-rate, annual spend, risk exposure, headcount utilisation
   - Save / load named scenarios
   ========================================================================== */

/* ---------------- State ---------------- */
function scenarios() { state.settings.scenarios = state.settings.scenarios || []; return state.settings.scenarios; }
function activeScenario() {
  state.settings.activeScenario = state.settings.activeScenario || { id: 'draft', name: 'Draft scenario', changes: {} };
  return state.settings.activeScenario;
}
function updateActiveScenario(patch) {
  state.settings.activeScenario = { ...activeScenario(), ...patch };
  save(); renderScenarioPlanner();
}
function setChange(subId, change) {
  const s = { ...activeScenario() };
  s.changes = { ...s.changes };
  if (change == null) delete s.changes[subId];
  else s.changes[subId] = change;
  updateActiveScenario(s);
}

/* ---------------- Apply a change to a subscription ---------------- */
// change: { action: 'keep'|'cancel'|'downgrade'|'renegotiate'|'consolidate', pct?, mergeToSubId?, note? }
function applyChange(sub, change) {
  if (!change || change.action === 'keep') return { monthly: monthlyCost(sub), seats: sub.licenses || 0, risk: null, survives: true };
  const baseMonthly = monthlyCost(sub);
  switch (change.action) {
    case 'cancel':
      return { monthly: 0, seats: 0, risk: 0, survives: false };
    case 'downgrade': {
      // downgrade pct = how much you cut (0-100)
      const cutPct = Math.min(95, Math.max(0, parseFloat(change.pct) || 25));
      return { monthly: baseMonthly * (1 - cutPct / 100), seats: Math.round((sub.licenses || 0) * (1 - cutPct / 100)), risk: null, survives: true };
    }
    case 'renegotiate': {
      // renegotiate = reduce price by pct, keep seats
      const cutPct = Math.min(60, Math.max(0, parseFloat(change.pct) || 10));
      return { monthly: baseMonthly * (1 - cutPct / 100), seats: sub.licenses || 0, risk: null, survives: true };
    }
    case 'consolidate':
      // consolidate = treat this vendor as cancelled; assume merged into another
      return { monthly: 0, seats: 0, risk: 0, survives: false, mergeToSubId: change.mergeToSubId };
    default:
      return { monthly: baseMonthly, seats: sub.licenses || 0, risk: null, survives: true };
  }
}

/* ---------------- Compute scenario summary ---------------- */
function scenarioSummary() {
  const sc = activeScenario();
  const ctx = portfolioCtx();
  const base = { monthly: 0, risk: 0, count: 0, vendorsRemoved: 0, annualSaved: 0, contractsAtRisk: 0 };
  const after = { monthly: 0, risk: 0, count: 0 };
  const deltas = []; // per-vendor { sub, change, baseMonthly, newMonthly, delta }
  activeSubs().forEach(sub => {
    const bm = monthlyCost(sub);
    const risk = sub.contract ? scoreContract(sub, ctx).overall : 10;
    base.monthly += bm;
    base.risk += risk;
    base.count++;
    const change = sc.changes[sub.id];
    const res = applyChange(sub, change);
    after.monthly += res.monthly;
    if (res.survives) {
      after.count++;
      after.risk += (res.risk != null ? res.risk : risk);
    } else {
      base.vendorsRemoved++;
      base.annualSaved += bm * 12;
    }
    if (change && change.action !== 'keep') {
      deltas.push({ sub, change, baseMonthly: bm, newMonthly: res.monthly, deltaMonthly: res.monthly - bm, risk, survives: res.survives, mergeToSubId: res.mergeToSubId });
    }
  });
  const baseRiskAvg = base.count ? Math.round(base.risk / base.count) : 0;
  const afterRiskAvg = after.count ? Math.round(after.risk / after.count) : 0;
  return {
    base, after, deltas,
    baseRiskAvg, afterRiskAvg,
    deltaMonthly: after.monthly - base.monthly,
    deltaAnnual: (after.monthly - base.monthly) * 12,
    deltaRisk: afterRiskAvg - baseRiskAvg,
  };
}

/* ---------------- Render ---------------- */
const SC_ACTION_LABELS = {
  keep: 'No change', cancel: 'Cancel at renewal', downgrade: 'Downgrade', renegotiate: 'Renegotiate price', consolidate: 'Consolidate into another vendor',
};

function renderScenarioPlanner() {
  const host = document.getElementById('scenario-body');
  if (!host) return;
  const sc = activeScenario();
  const summary = scenarioSummary();
  const subs = activeSubs().sort((a, b) => monthlyCost(b) - monthlyCost(a));
  const savedScenarios = scenarios();

  const absDelta = Math.abs(summary.deltaAnnual);
  const savings = summary.deltaAnnual < 0;

  host.innerHTML = `
    <div class="sc-head-bar">
      <div class="sc-head-left">
        <label>Scenario name
          <input type="text" id="sc-name" value="${escapeHtml(sc.name)}" style="width:280px;height:32px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--panel);color:var(--text);font-family:inherit;font-size:13px;font-weight:600"/>
        </label>
      </div>
      <div class="sc-head-right">
        <select class="rc-select" id="sc-load">
          <option value="">Load saved scenario…</option>
          ${savedScenarios.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
        <button class="icon-btn" id="sc-save">Save scenario</button>
        <button class="icon-btn" id="sc-reset">Reset changes</button>
        <button class="icon-btn" data-pdf-export="scenario-body" data-pdf-title="Scenario plan">Download PDF</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-label">Annual run-rate</span>
        <span class="stat-value">${formatMoney(summary.after.monthly * 12)}</span>
        <span class="stat-sub">was ${formatMoney(summary.base.monthly * 12)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Annual delta</span>
        <span class="stat-value" style="color:${savings ? 'var(--success-text)' : summary.deltaAnnual > 0 ? 'var(--danger-text)' : 'var(--text)'}">${savings ? '-' : summary.deltaAnnual > 0 ? '+' : ''}${formatMoney(absDelta)}</span>
        <span class="stat-sub">${savings ? `${Math.round((absDelta / (summary.base.monthly * 12 || 1)) * 100)}% saved` : summary.deltaAnnual > 0 ? 'added' : 'no change'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Vendors after</span>
        <span class="stat-value">${summary.after.count}</span>
        <span class="stat-sub">was ${summary.base.count} · ${summary.base.vendorsRemoved} removed</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Portfolio risk</span>
        <span class="stat-value" style="color:${summary.deltaRisk < 0 ? 'var(--success-text)' : summary.deltaRisk > 0 ? 'var(--danger-text)' : 'var(--text)'}">${summary.afterRiskAvg}</span>
        <span class="stat-sub">was ${summary.baseRiskAvg} ${summary.deltaRisk !== 0 ? `· ${summary.deltaRisk > 0 ? '+' : ''}${summary.deltaRisk}` : ''}</span>
      </div>
    </div>

    <div class="panel-grid">
      <div class="panel span-2">
        <h2>Proposed changes <span class="badge info">${summary.deltas.length}</span></h2>
        <p class="panel-sub">Mark any vendor's action. Cancel removes it from the run-rate; downgrade or renegotiate cuts a percentage; consolidate points it at another vendor.</p>
        ${summary.deltas.length === 0 ? '<p class="empty" style="padding:40px 0">No changes yet. Open the Vendor stack below and act on one.</p>' : `
        <div class="sc-changes">
          ${summary.deltas.map(d => `<div class="sc-change">
            <div class="sc-change-head">
              <div class="rc-vendor">
                <div class="avatar" style="background:${avatarColor(d.sub.name)}">${initials(d.sub.name)}</div>
                <div><div class="rc-name"><a href="#" class="vendor-link" data-vendor-nav="${d.sub.id}">${escapeHtml(d.sub.name)}</a></div>
                     <div class="rc-meta">${escapeHtml(d.sub.team || '—')} · ${escapeHtml(d.sub.category || '—')}</div></div>
              </div>
              <div class="sc-change-delta ${d.deltaMonthly < 0 ? 'save' : d.deltaMonthly > 0 ? 'add' : ''}">
                <div>${d.deltaMonthly < 0 ? '-' : d.deltaMonthly > 0 ? '+' : ''}${formatMoney(Math.abs(d.deltaMonthly * 12))}/yr</div>
                <div class="rc-cost-sub">${formatMoney(d.baseMonthly)} → ${formatMoney(d.newMonthly)}/mo</div>
              </div>
            </div>
            <div class="sc-change-body">
              <span class="badge ${d.change.action === 'cancel' || d.change.action === 'consolidate' ? 'danger' : d.change.action === 'downgrade' ? 'warn' : 'info'}">${SC_ACTION_LABELS[d.change.action]}</span>
              ${d.change.pct ? `<span class="rc-meta">${d.change.pct}% cut</span>` : ''}
              ${d.change.mergeToSubId ? `<span class="rc-meta">→ ${escapeHtml(state.subscriptions.find(s => s.id === d.change.mergeToSubId)?.name || 'unknown')}</span>` : ''}
              ${d.change.note ? `<span class="rc-meta">· ${escapeHtml(d.change.note)}</span>` : ''}
              <button class="link" data-sc-clear="${d.sub.id}" style="margin-left:auto">Remove</button>
            </div>
          </div>`).join('')}
        </div>`}
      </div>

      <div class="panel span-2">
        <h2>Vendor stack</h2>
        <p class="panel-sub">Sorted by monthly spend. Pick an action per vendor to add it to the proposed changes above.</p>
        <div class="sc-stack">
          ${subs.map(s => {
            const change = sc.changes[s.id];
            const risk = s.contract ? scoreContract(s, portfolioCtx()).overall : null;
            return `<div class="sc-row ${change && change.action !== 'keep' ? 'changed' : ''}">
              <div class="sc-row-main">
                <div class="rc-vendor">
                  <div class="avatar" style="background:${avatarColor(s.name)}">${initials(s.name)}</div>
                  <div><div class="rc-name"><a href="#" class="vendor-link" data-vendor-nav="${s.id}">${escapeHtml(s.name)}</a></div>
                       <div class="rc-meta">${escapeHtml(s.team || '—')} · ${formatMoney(monthlyCost(s))}/mo · ${formatMoney(monthlyCost(s)*12)}/yr${risk != null ? ` · risk ${risk}` : ''}</div></div>
                </div>
              </div>
              <div class="sc-row-actions">
                <select class="rc-select sc-action-sel" data-sc-sub="${s.id}">
                  ${['keep','cancel','downgrade','renegotiate','consolidate'].map(a => `<option value="${a}" ${(change?.action || 'keep') === a ? 'selected' : ''}>${SC_ACTION_LABELS[a]}</option>`).join('')}
                </select>
                ${(change?.action === 'downgrade' || change?.action === 'renegotiate')
                  ? `<input type="number" class="sc-pct" data-sc-pct="${s.id}" value="${change.pct || (change.action === 'downgrade' ? 25 : 10)}" min="1" max="95" step="5" style="width:70px;height:30px;padding:0 6px;border:1px solid var(--border);border-radius:4px;background:var(--panel);color:var(--text);font-family:inherit;font-size:12px"/><span style="color:var(--text-dim);font-size:11px">% cut</span>`
                  : ''}
                ${change?.action === 'consolidate'
                  ? `<select class="rc-select sc-merge" data-sc-merge="${s.id}">
                      <option value="">Merge into…</option>
                      ${subs.filter(x => x.id !== s.id).map(x => `<option value="${x.id}" ${change.mergeToSubId === x.id ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}
                    </select>`
                  : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Wire
  document.getElementById('sc-name').addEventListener('change', e => { updateActiveScenario({ name: e.target.value || 'Untitled' }); });
  document.getElementById('sc-save').onclick = () => {
    const sc2 = { ...activeScenario(), id: activeScenario().id === 'draft' ? crypto.randomUUID() : activeScenario().id, savedAt: new Date().toISOString() };
    const arr = scenarios().filter(x => x.id !== sc2.id);
    arr.push(sc2);
    state.settings.scenarios = arr;
    state.settings.activeScenario = sc2;
    save(); renderScenarioPlanner();
    toast(`Saved "${sc2.name}".`, 'success');
  };
  document.getElementById('sc-load').addEventListener('change', e => {
    const id = e.target.value; if (!id) return;
    const sc3 = scenarios().find(s => s.id === id);
    if (sc3) { state.settings.activeScenario = { ...sc3 }; save(); renderScenarioPlanner(); }
  });
  document.getElementById('sc-reset').onclick = () => {
    updateActiveScenario({ changes: {} });
    toast('Changes reset.', 'success');
  };
  host.querySelectorAll('[data-sc-clear]').forEach(b => b.onclick = () => setChange(b.dataset.scClear, null));
  host.querySelectorAll('.sc-action-sel').forEach(sel => sel.addEventListener('change', () => {
    const subId = sel.dataset.scSub; const action = sel.value;
    if (action === 'keep') setChange(subId, null);
    else {
      const prev = activeScenario().changes[subId] || {};
      setChange(subId, { action, pct: prev.pct || (action === 'downgrade' ? 25 : action === 'renegotiate' ? 10 : undefined), mergeToSubId: prev.mergeToSubId });
    }
  }));
  host.querySelectorAll('[data-sc-pct]').forEach(inp => inp.addEventListener('change', () => {
    const subId = inp.dataset.scPct;
    const prev = activeScenario().changes[subId]; if (!prev) return;
    setChange(subId, { ...prev, pct: parseFloat(inp.value) || 0 });
  }));
  host.querySelectorAll('[data-sc-merge]').forEach(sel => sel.addEventListener('change', () => {
    const subId = sel.dataset.scMerge;
    const prev = activeScenario().changes[subId]; if (!prev) return;
    setChange(subId, { ...prev, mergeToSubId: sel.value || null });
  }));
}

/* ---------------- View + nav ---------------- */
function ensureScenarioView() {
  if (document.getElementById('scenario')) return;
  const main = document.querySelector('.main-area main');
  if (!main) return;
  const section = document.createElement('section');
  section.id = 'scenario';
  section.className = 'view';
  section.innerHTML = `
    <div class="section-head"><div><h2>Scenario planner</h2><p class="page-sub">Model what happens if you cut, downgrade, renegotiate or consolidate parts of the stack. Numbers update live. Save scenarios to compare.</p></div></div>
    <div id="scenario-body"></div>
  `;
  main.appendChild(section);
}
function ensureScenarioNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const overviewGroup = [...groups][0];
  if (!overviewGroup || overviewGroup.querySelector('[data-view="scenario"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'scenario';
  btn.innerHTML = `${svg}<span>Scenario planner</span>`;
  // Put after Analytics
  const analytics = overviewGroup.querySelector('[data-view="analytics"]');
  if (analytics && analytics.nextSibling) overviewGroup.insertBefore(btn, analytics.nextSibling);
  else overviewGroup.appendChild(btn);
  btn.addEventListener('click', () => switchView('scenario'));
}
function patchSwitchViewForScenario() {
  if (window._scSwitchPatched) return;
  const _orig = window.switchView;
  window.switchView = function (name, opts = {}) {
    if (name === 'scenario') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Scenario planner';
      if (!opts.replaceHistory) {
        const target = '#scenario';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._scSwitchPatched = true;
}

/* Hook renderAll */
const _prevAll7 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll7) {
  window.renderAll = function () {
    _prevAll7();
    try {
      ensureScenarioView();
      ensureScenarioNav();
      patchSwitchViewForScenario();
      renderScenarioPlanner();
    } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureScenarioView();
      ensureScenarioNav();
      patchSwitchViewForScenario();
      renderScenarioPlanner();
    } catch (_) {}
  }, 300);
});
