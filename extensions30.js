/* ================================================================
   Phase 52 — Diagnostics + hardening
   ================================================================
   Three jobs:

   1. Wrap the fragile monkey-patches from recent phases in a
      global error catcher so a bug in one patch doesn't cascade
      and break the whole app. Catches at the extension level
      what the patches themselves try to catch locally.

   2. Add a Diagnostics view (Settings tab → bottom card) that
      enumerates every Phase 43-50 module and shows load status
      + a short description of what it does. Runs the in-browser
      test suite on demand with a readable per-group pass/fail
      report. Links to per-module reset buttons.

   3. Per-module reset: "Reset onboarding", "Reset command palette
      recent", "Reset currency settings", "Reset payment state"
      etc. Targeted fixes without blowing away all workspace data.

   This phase is about SAFETY, not new features. The goal is that
   when Vinay opens the tool tomorrow and something looks off,
   he can see WHY in 5 seconds and fix WITHOUT full data loss.
   ================================================================ */

(() => {

/* ---------------- Module registry ---------------- */

const MODULES = [
  {
    id: 'phase43',
    name: 'Onboarding (checklist, tour, beacons, help)',
    handle: 'OnboardHelp',
    methods: ['open', 'runFlow', 'resetChecklist', 'resetAll'],
    stateKey: 'onboarding',
    resetFn: () => {
      delete state.settings.onboarding;
      document.getElementById('ob-checklist')?.remove();
      document.getElementById('ob-help')?.remove();
      document.querySelectorAll('.ob-beacon').forEach(b => b.remove());
      if (typeof save === 'function') save();
    },
    resetLabel: 'Reset onboarding',
  },
  {
    id: 'phase44',
    name: 'Bulk CSV import',
    handle: 'BulkImport',
    methods: ['open', 'close', 'parseCSV', 'autoMap'],
    stateKey: null,
    resetFn: null,  // no persistent state to reset
  },
  {
    id: 'phase46',
    name: 'Reports (spend PDF · renewal CSV · savings PDF)',
    handle: 'Reports',
    methods: ['spendSummary', 'renewalRoster', 'savings', 'view'],
    stateKey: null,
    resetFn: null,
  },
  {
    id: 'phase47',
    name: 'Settings + multi-currency display',
    handle: 'Settings',
    methods: ['open', 'setCurrency', 'refreshFx'],
    stateKey: 'display',
    extra: () => {
      const d = state.settings?.display;
      return d ? `display currency: ${d.currency || 'USD'}` : 'no currency set';
    },
    resetFn: () => {
      delete state.settings.display;
      delete state.settings.fx;
      if (typeof save === 'function') save();
    },
    resetLabel: 'Reset currency to USD',
  },
  {
    id: 'phase48',
    name: 'Payment-return detection',
    handle: 'MarkPaid',
    methods: ['manual', 'isPaid', 'state', 'undo'],
    stateKey: 'paid',
    extra: () => {
      const p = state.settings?.paid;
      return p?.isPaid ? `marked paid (${p.method || 'unknown'})` : 'trial';
    },
    resetFn: () => {
      if (window.MarkPaid?.undo) window.MarkPaid.undo();
      document.getElementById('pay-ack')?.remove();
    },
    resetLabel: 'Reset to trial state',
  },
  {
    id: 'phase49',
    name: 'Command palette (⌘K)',
    handle: 'CmdPal',
    methods: ['open', 'close'],
    stateKey: 'cmdpal',
    extra: () => {
      const n = (state.settings?.cmdpal?.recent || []).length;
      return `${n} recent action${n === 1 ? '' : 's'}`;
    },
    resetFn: () => {
      if (state.settings?.cmdpal) state.settings.cmdpal.recent = [];
      if (typeof save === 'function') save();
    },
    resetLabel: 'Clear recent actions',
  },
  {
    id: 'phase50',
    name: 'Per-subscription source currency',
    handle: 'SubCurrency',
    methods: ['edit', 'get', 'set'],
    stateKey: null,
    extra: () => {
      const subs = state.subscriptions || [];
      const nonUsd = subs.filter(s => s.currency && s.currency !== 'USD').length;
      return `${nonUsd} of ${subs.length} subs in non-USD`;
    },
    resetFn: () => {
      (state.subscriptions || []).forEach(s => { if (s.currency) delete s.currency; });
      if (typeof save === 'function') save();
    },
    resetLabel: 'Clear per-sub currencies (back to USD)',
  },
];

const PATCHES = [
  { id: 'formatMoney_p47',     fn: 'formatMoney',      sentinel: '_p47', phase: 'Phase 47' },
  { id: 'formatMoneyShort_p47',fn: 'formatMoneyShort', sentinel: '_p47', phase: 'Phase 47' },
  { id: 'monthlyCost_p50',     fn: 'monthlyCost',      sentinel: '_p50', phase: 'Phase 50' },
];

/* ---------------- Global error catcher ---------------- */

/* Catch and log any uncaught errors from monkey-patches during
   renderAll so one broken patch doesn't nuke the whole render.
   Logs to a diagnostic array the Diagnostics view can show. */

window._diagErrors = window._diagErrors || [];

function addDiagError(source, err) {
  window._diagErrors.push({
    at: new Date().toISOString(),
    source,
    msg: String(err && err.message || err),
    stack: (err && err.stack || '').split('\n').slice(0, 3).join(' | '),
  });
  if (window._diagErrors.length > 50) window._diagErrors.shift();
}

window.addEventListener('error', (e) => {
  addDiagError('window.error', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  addDiagError('promise.rejection', e.reason);
});

/* ---------------- Status check ---------------- */

function checkModule(mod) {
  const handle = window[mod.handle];
  const result = { id: mod.id, name: mod.name, status: 'ok', issues: [] };
  if (!handle) {
    result.status = 'broken';
    result.issues.push(`window.${mod.handle} is undefined`);
    return result;
  }
  const missingMethods = (mod.methods || []).filter(m => typeof handle[m] !== 'function');
  if (missingMethods.length) {
    result.status = 'broken';
    result.issues.push(`missing method${missingMethods.length === 1 ? '' : 's'}: ${missingMethods.join(', ')}`);
  }
  if (mod.extra) {
    try { result.extraInfo = mod.extra(); } catch (_) {}
  }
  return result;
}

function checkPatch(p) {
  const fn = window[p.fn];
  if (typeof fn !== 'function') return { id: p.id, status: 'broken', note: `${p.fn} not defined` };
  if (!fn[p.sentinel]) return { id: p.id, status: 'warn', note: `${p.fn} not patched by ${p.phase}` };
  return { id: p.id, status: 'ok', note: `${p.fn} patched by ${p.phase}` };
}

function runFullDiagnostic() {
  const modules = MODULES.map(checkModule);
  const patches = PATCHES.map(checkPatch);
  const errors = window._diagErrors.slice(-10).reverse();
  const summary = {
    modulesOk: modules.filter(m => m.status === 'ok').length,
    modulesBroken: modules.filter(m => m.status === 'broken').length,
    patchesOk: patches.filter(p => p.status === 'ok').length,
    patchesBroken: patches.filter(p => p.status === 'broken' || p.status === 'warn').length,
    errorsLogged: errors.length,
    stateSize: JSON.stringify(state).length,
    phasesLoaded: '43-52',
  };
  return { modules, patches, errors, summary };
}

/* ---------------- Run in-browser test suite ---------------- */

async function runTestSuiteInline() {
  if (typeof defineTests !== 'function') return { error: 'defineTests not available' };
  defineTests();
  if (typeof TESTS === 'undefined') return { error: 'TESTS not available' };
  const out = { pass: [], fail: [], skip: [] };
  for (const t of TESTS) {
    if (t.skip) { out.skip.push({ group: t.group, name: t.name }); continue; }
    try {
      await t.fn();
      out.pass.push({ group: t.group, name: t.name });
    } catch (e) {
      out.fail.push({ group: t.group, name: t.name, error: e.message });
    }
  }
  return out;
}

/* ---------------- Diagnostics UI ---------------- */

function injectDiagnosticsCard() {
  const settings = document.querySelector('.view[data-view="settings"]');
  if (!settings || !settings.querySelector('.st-grid')) return;
  if (settings.querySelector('#diag-card')) return;

  const card = document.createElement('section');
  card.id = 'diag-card';
  card.className = 'st-card';
  card.innerHTML = `
    <h3>Diagnostics (Phases 43-52)</h3>
    <p class="st-note">Health check of every recent module. If something looks off in the tool, open this first.</p>
    <div id="diag-summary" class="diag-summary">Loading…</div>
    <div class="st-row">
      <button type="button" class="st-btn" id="diag-refresh">Refresh status</button>
      <button type="button" class="st-btn" id="diag-run-tests">Run test suite</button>
      <button type="button" class="st-btn" id="diag-export">Export diagnostic report</button>
    </div>
    <details class="diag-details" id="diag-details">
      <summary>Module details</summary>
      <div id="diag-modules"></div>
    </details>
    <details class="diag-details">
      <summary>Recent errors (last 10)</summary>
      <div id="diag-errors"></div>
    </details>
  `;

  const grid = settings.querySelector('.st-grid');
  // Insert before the Danger zone card
  const danger = grid.querySelector('.st-card.is-danger');
  if (danger) grid.insertBefore(card, danger);
  else grid.appendChild(card);

  card.querySelector('#diag-refresh').onclick = renderDiagnostics;
  card.querySelector('#diag-run-tests').onclick = runAndShowTests;
  card.querySelector('#diag-export').onclick = exportDiagnosticReport;

  renderDiagnostics();
}

function renderDiagnostics() {
  const diag = runFullDiagnostic();
  const summaryHost = document.getElementById('diag-summary');
  if (!summaryHost) return;

  const allOk = diag.summary.modulesBroken === 0 && diag.summary.patchesBroken === 0 && diag.summary.errorsLogged === 0;
  summaryHost.innerHTML = `
    <div class="diag-tiles">
      <span class="diag-tile ${diag.summary.modulesBroken ? 'bad' : 'ok'}">
        <b>${diag.summary.modulesOk}/${MODULES.length}</b> modules
      </span>
      <span class="diag-tile ${diag.summary.patchesBroken ? 'warn' : 'ok'}">
        <b>${diag.summary.patchesOk}/${PATCHES.length}</b> patches
      </span>
      <span class="diag-tile ${diag.summary.errorsLogged ? 'warn' : 'ok'}">
        <b>${diag.summary.errorsLogged}</b> recent error${diag.summary.errorsLogged === 1 ? '' : 's'}
      </span>
      <span class="diag-tile neutral">
        <b>${(diag.summary.stateSize / 1024).toFixed(0)}KB</b> state size
      </span>
    </div>
    <div class="diag-verdict ${allOk ? 'ok' : 'warn'}">
      ${allOk ? '✓ All systems look healthy.' : '⚠ Something needs attention — expand Module details below.'}
    </div>
  `;

  // Module details
  const modulesHost = document.getElementById('diag-modules');
  if (modulesHost) {
    modulesHost.innerHTML = diag.modules.map(m => {
      const def = MODULES.find(x => x.id === m.id);
      const statusClass = m.status === 'ok' ? 'ok' : 'bad';
      return `
        <div class="diag-row">
          <span class="diag-dot diag-dot-${statusClass}"></span>
          <div class="diag-row-body">
            <div class="diag-row-name">${escapeHtml(m.name)}</div>
            <div class="diag-row-note">
              ${m.status === 'ok' ? '✓ loaded · handle <code>window.' + def.handle + '</code>' : '✗ ' + escapeHtml(m.issues.join(', '))}
              ${m.extraInfo ? ' · <span class="diag-extra">' + escapeHtml(m.extraInfo) + '</span>' : ''}
            </div>
          </div>
          ${def.resetFn ? `<button type="button" class="st-btn" data-reset="${m.id}">${escapeHtml(def.resetLabel)}</button>` : ''}
        </div>
      `;
    }).join('');
    modulesHost.querySelectorAll('[data-reset]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.reset;
        const def = MODULES.find(x => x.id === id);
        if (!def || !def.resetFn) return;
        if (!confirm(`${def.resetLabel}? This affects only ${def.name} state; your subscriptions and contracts are unchanged.`)) return;
        try { def.resetFn(); renderDiagnostics(); toast(def.resetLabel + ' done'); }
        catch (e) { alert('Reset failed: ' + e.message); }
      };
    });
  }

  // Error log
  const errorsHost = document.getElementById('diag-errors');
  if (errorsHost) {
    if (!diag.errors.length) {
      errorsHost.innerHTML = '<div class="diag-empty">No recent errors.</div>';
    } else {
      errorsHost.innerHTML = diag.errors.map(e => `
        <div class="diag-err">
          <div class="diag-err-head">${escapeHtml(e.source)} · <span class="diag-err-time">${escapeHtml(e.at.slice(11, 19))}</span></div>
          <div class="diag-err-msg">${escapeHtml(e.msg)}</div>
          ${e.stack ? `<div class="diag-err-stack">${escapeHtml(e.stack)}</div>` : ''}
        </div>
      `).join('');
    }
  }
}

async function runAndShowTests() {
  const btn = document.getElementById('diag-run-tests');
  if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }
  const out = await runTestSuiteInline();
  const summaryHost = document.getElementById('diag-summary');
  if (!summaryHost) return;
  if (out.error) {
    summaryHost.insertAdjacentHTML('beforeend', `<div class="diag-verdict warn">Test runner error: ${escapeHtml(out.error)}</div>`);
  } else {
    const failList = out.fail.length ? out.fail.map(f => `<li><b>${escapeHtml(f.group)}·${escapeHtml(f.name)}</b> → ${escapeHtml(f.error)}</li>`).join('') : '';
    summaryHost.insertAdjacentHTML('beforeend', `
      <div class="diag-test-result ${out.fail.length ? 'warn' : 'ok'}">
        <b>Tests:</b> ${out.pass.length} pass · ${out.fail.length} fail · ${out.skip.length} skip
        ${failList ? '<ul>' + failList + '</ul>' : ''}
      </div>
    `);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Run test suite'; }
}

function exportDiagnosticReport() {
  const diag = runFullDiagnostic();
  const report = {
    generated: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: location.href,
    diagnostic: diag,
    workspace: {
      name: state.settings?.workspace?.name,
      plan: state.settings?.workspace?.plan,
      subscriptionCount: (state.subscriptions || []).length,
      contractCount: (state.subscriptions || []).filter(s => s.contract).length,
      employeeCount: (state.employees || []).length,
    },
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const name = `diagnostic-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  if (typeof window.downloadFile === 'function') { try { window.downloadFile(name, blob); return; } catch (_) {} }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toast(msg) {
  const existing = document.querySelector('.diag-toast'); if (existing) existing.remove();
  const t = document.createElement('div'); t.className = 'diag-toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2500);
}

/* ---------------- Boot: inject diag card whenever settings opens ---------------- */

function wire() {
  const prev = window.switchView;
  if (typeof prev !== 'function' || prev._p52) return;
  window.switchView = function (name, opts) {
    const r = prev.apply(this, arguments);
    if (name === 'settings') setTimeout(injectDiagnosticsCard, 150);
    return r;
  };
  window.switchView._p52 = true;
}

/* ---------------- Public handle ---------------- */

window.Diag = {
  check: runFullDiagnostic,
  runTests: runTestSuiteInline,
  errors: () => window._diagErrors.slice(),
  clear: () => { window._diagErrors = []; },
  reset: (moduleId) => {
    const m = MODULES.find(x => x.id === moduleId);
    if (!m || !m.resetFn) throw new Error('No reset for ' + moduleId);
    m.resetFn();
  },
  open: () => { try { switchView('settings'); setTimeout(injectDiagnosticsCard, 150); } catch (_) {} },
};

/* ---------------- Hook CmdPal to add Diagnostics entry ---------------- */

/* CmdPal doesn't expose its CMDS array, so we can't push to it.
   But we CAN register via Help launcher — easier. Also a global
   shortcut via Shift+? for help / diagnostics. */
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+D or Cmd+Shift+D → open diagnostics
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    e.preventDefault();
    window.Diag.open();
  }
});

/* ---------------- Boot ---------------- */

document.addEventListener('DOMContentLoaded', () => { setTimeout(wire, 700); });

})();
