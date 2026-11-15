/* ================================================================
   Phase 49 — Command palette (⌘K)
   ================================================================
   One-keystroke launcher for every meaningful action in the tool.

   Trigger: Cmd+K on Mac, Ctrl+K on Windows/Linux, or click the
            small "⌘K" chip in the header.

   What's indexed:
   - Navigate to any view
   - Run any report export
   - Open any onboarding flow
   - Open settings / bulk import / data export
   - Direct Ask Track query: type `ask: how many renewals this quarter`
     and hit Enter — opens Ask Track with the query pre-populated.

   Fuzzy matches on title + keywords. Ranks exact prefix matches
   highest. Keyboard-first: ↑↓ to move, Enter to run, Esc to close.
   Remembers last 5 used actions and surfaces them when the input
   is empty.
   ================================================================ */

(() => {

/* ---------------- Action catalog ---------------- */

const CMDS = [
  // Navigation
  { id: 'nav.dashboard',     title: 'Dashboard',              group: 'Navigate', keys: ['home', 'overview'],
    run: () => safeSwitch('dashboard') },
  { id: 'nav.insights',      title: 'Insights',               group: 'Navigate', keys: ['trends'],
    run: () => safeSwitch('insights') },
  { id: 'nav.analytics',     title: 'Analytics',              group: 'Navigate', keys: ['charts'],
    run: () => safeSwitch('analytics') },
  { id: 'nav.subscriptions', title: 'Subscriptions',          group: 'Navigate', keys: ['vendors', 'tools', 'saas'],
    run: () => safeSwitch('subscriptions') },
  { id: 'nav.invoices',      title: 'Invoices',               group: 'Navigate', keys: ['bills', 'receipts'],
    run: () => safeSwitch('invoices') },
  { id: 'nav.consumption',   title: 'Licence usage',          group: 'Navigate', keys: ['forecast', 'seats', 'utilization'],
    run: () => safeSwitch('consumption') },
  { id: 'nav.contracts',     title: 'Contract terms',         group: 'Navigate', keys: ['upload contract', 'parse', 'msa'],
    run: () => safeSwitch('contracts') },
  { id: 'nav.renewals',      title: 'Renewals',               group: 'Navigate', keys: ['calendar', 'upcoming'],
    run: () => safeSwitch('renewals') },
  { id: 'nav.alerts',        title: 'Alerts',                 group: 'Navigate', keys: ['notifications'],
    run: () => safeSwitch('alerts') },
  { id: 'nav.risk',          title: 'Risk analytics',         group: 'Navigate', keys: ['auto-renew traps', 'orphans', 'shadow saas'],
    run: () => safeSwitch('risk') },
  { id: 'nav.playbook',      title: 'Clause playbook',        group: 'Navigate', keys: ['negotiation', 'clauses'],
    run: () => safeSwitch('playbook') },
  { id: 'nav.team',          title: 'Team directory',         group: 'Navigate', keys: ['employees', 'people', 'users'],
    run: () => safeSwitch('team') },
  { id: 'nav.integrations',  title: 'Integrations',           group: 'Navigate', keys: ['connections', 'apps'],
    run: () => safeSwitch('integrations') },
  { id: 'nav.roadmap',       title: 'Integration roadmap',    group: 'Navigate', keys: ['coming soon'],
    run: () => safeSwitch('roadmap') },
  { id: 'nav.reports',       title: 'Reports',                group: 'Navigate', keys: ['downloads', 'export', 'pdf', 'csv'],
    run: () => safeSwitch('reports') },
  { id: 'nav.pricing',       title: 'Plans & pricing',        group: 'Navigate', keys: ['upgrade', 'pay', 'buy'],
    run: () => safeSwitch('pricing') },
  { id: 'nav.chat',          title: 'Ask Track',              group: 'Navigate', keys: ['ai', 'chat', 'question', 'search'],
    run: () => safeSwitch('chat') },
  { id: 'nav.settings',      title: 'Settings',               group: 'Navigate', keys: ['preferences', 'workspace', 'currency'],
    run: () => safeSwitch('settings') },

  // Create / import
  { id: 'do.bulk_import',    title: 'Bulk import from CSV…',  group: 'Actions', keys: ['upload csv', 'paste spreadsheet', 'import vendors'],
    run: () => window.BulkImport?.open() },
  { id: 'do.load_sample',    title: 'Load sample contract',   group: 'Actions', keys: ['demo', 'try'],
    run: () => { safeSwitch('contracts'); setTimeout(() => document.getElementById('sample-contract')?.click(), 300); } },

  // Reports / exports
  { id: 'report.spend',      title: 'Download Monthly Spend Summary (PDF)',    group: 'Reports', keys: ['export pdf', 'spend report'],
    run: () => window.Reports?.spendSummary() },
  { id: 'report.renewals',   title: 'Download Renewal Roster (CSV)',           group: 'Reports', keys: ['export csv', 'renewal list'],
    run: () => window.Reports?.renewalRoster() },
  { id: 'report.savings',    title: 'Download Savings Opportunities (PDF)',    group: 'Reports', keys: ['findings', 'waste'],
    run: () => window.Reports?.savings() },

  // Onboarding
  { id: 'ob.tour',           title: 'Replay the welcome tour',                 group: 'Help', keys: ['walkthrough', 'guided'],
    run: () => window.OnboardHelp?.runFlow?.('tour') },
  { id: 'ob.help',           title: 'Open the Help panel',                     group: 'Help', keys: ['how-to', 'guides'],
    run: () => window.OnboardHelp?.open?.() },
  { id: 'ob.restore_checklist', title: 'Restore the onboarding checklist',     group: 'Help', keys: ['get started', 'bring back'],
    run: () => window.OnboardHelp?.resetChecklist?.() },

  // Settings + currency shortcuts
  { id: 'set.currency.inr',  title: 'Show amounts in INR (₹)',                 group: 'Settings', keys: ['india rupee'],
    run: () => window.Settings?.setCurrency?.('INR') },
  { id: 'set.currency.usd',  title: 'Show amounts in USD ($)',                 group: 'Settings', keys: ['dollar'],
    run: () => window.Settings?.setCurrency?.('USD') },
  { id: 'set.currency.eur',  title: 'Show amounts in EUR (€)',                 group: 'Settings', keys: ['euro'],
    run: () => window.Settings?.setCurrency?.('EUR') },
  { id: 'set.currency.gbp',  title: 'Show amounts in GBP (£)',                 group: 'Settings', keys: ['pound', 'british'],
    run: () => window.Settings?.setCurrency?.('GBP') },
  { id: 'set.export_json',   title: 'Export workspace as JSON',                group: 'Settings', keys: ['backup', 'download'],
    run: () => { safeSwitch('settings'); setTimeout(() => document.getElementById('st-export-json')?.click(), 400); } },
  { id: 'set.sub_currency',  title: 'Edit per-subscription currency…',         group: 'Settings', keys: ['inr', 'native price', 'local currency'],
    run: () => window.SubCurrency?.edit?.() },
  { id: 'set.trial_extend',  title: 'Extend trial by 14 days',                 group: 'Settings', keys: ['more time'],
    run: () => { safeSwitch('settings'); setTimeout(() => document.getElementById('st-trial-extend')?.click(), 400); } },

  // Payment shortcut
  { id: 'pay.open',          title: 'Open Plans & pricing',                    group: 'Payment', keys: ['pay', 'upgrade', 'buy'],
    run: () => safeSwitch('pricing') },
];

/* ---------------- State ---------------- */

function cpState() {
  state.settings = state.settings || {};
  state.settings.cmdpal = state.settings.cmdpal || { recent: [] };
  return state.settings.cmdpal;
}

function rememberRecent(id) {
  const s = cpState();
  s.recent = [id, ...(s.recent || []).filter(x => x !== id)].slice(0, 5);
  if (typeof save === 'function') save();
}

function safeSwitch(name) {
  try { if (typeof switchView === 'function') switchView(name); } catch (_) {}
}

/* ---------------- Fuzzy match ---------------- */

/* Score a command against the query. Higher = better match.
   - Exact prefix match on title → +100
   - Any word starts with query → +50
   - Title contains query substring → +20
   - Keyword exact → +15, keyword contains → +5
   - Group name contains → +3
*/
function scoreCmd(cmd, q) {
  if (!q) return 0;
  const query = q.toLowerCase().trim();
  const title = cmd.title.toLowerCase();
  const group = (cmd.group || '').toLowerCase();
  const keys = (cmd.keys || []).map(k => k.toLowerCase());

  let s = 0;
  if (title.startsWith(query)) s += 100;
  const words = title.split(/\W+/);
  for (const w of words) {
    if (w.startsWith(query)) { s += 50; break; }
  }
  if (title.includes(query)) s += 20;
  for (const k of keys) {
    if (k === query) s += 15;
    else if (k.includes(query)) s += 5;
  }
  if (group.includes(query)) s += 3;

  // Character-interleaved fuzzy match (e.g. "ddc" matches "Dashboard contracts")
  // Only used if no other match hit yet.
  if (s === 0) {
    let i = 0;
    for (const ch of title) {
      if (ch === query[i]) i++;
      if (i >= query.length) { s += 2; break; }
    }
  }
  return s;
}

function filterCmds(query) {
  // Special-case: "ask: ..." runs a direct Ask Track query
  if (query.toLowerCase().startsWith('ask:') || query.toLowerCase().startsWith('ask ')) {
    const q = query.replace(/^ask[: ]\s*/i, '').trim();
    return [{
      id: 'ask.query',
      title: `Ask Track: "${q || '...'}"`,
      group: 'Ask Track',
      _askQuery: q,
      run: () => {
        safeSwitch('chat');
        setTimeout(() => {
          const input = document.querySelector('#ai-input, textarea, input[type="text"]');
          if (!input) return;
          input.value = q;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          // Try to submit if there's a form
          const form = input.closest('form');
          if (form && q) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }, 350);
      },
    }];
  }

  if (!query) {
    // Empty state: recent + top nav items
    const s = cpState();
    const recent = (s.recent || [])
      .map(id => CMDS.find(c => c.id === id))
      .filter(Boolean)
      .map(c => ({ ...c, _recent: true }));
    const defaults = CMDS.filter(c => c.group === 'Navigate').slice(0, 6);
    const seen = new Set();
    return [...recent, ...defaults].filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id); return true;
    }).slice(0, 10);
  }
  return CMDS
    .map(c => ({ cmd: c, s: scoreCmd(c, query) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map(x => x.cmd);
}

/* ---------------- UI ---------------- */

let selectedIndex = 0;
let currentResults = [];

function open() {
  if (document.getElementById('cp-modal')) return;
  selectedIndex = 0;
  currentResults = filterCmds('');

  const m = document.createElement('div');
  m.id = 'cp-modal';
  m.className = 'cp-modal';
  m.innerHTML = `
    <div class="cp-backdrop" id="cp-backdrop"></div>
    <div class="cp-card">
      <div class="cp-input-wrap">
        <svg class="cp-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="cp-input" class="cp-input" placeholder="Jump to… or type &quot;ask: how many renewals this quarter&quot;" autocomplete="off" autofocus/>
        <kbd class="cp-esc">esc</kbd>
      </div>
      <div class="cp-results" id="cp-results"></div>
      <div class="cp-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>
  `;
  document.body.appendChild(m);

  const input = m.querySelector('#cp-input');
  const backdrop = m.querySelector('#cp-backdrop');

  backdrop.onclick = close;
  input.oninput = () => {
    currentResults = filterCmds(input.value);
    selectedIndex = 0;
    renderResults();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1); renderResults(); scrollSelectedIntoView(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); renderResults(); scrollSelectedIntoView(); return; }
    if (e.key === 'Enter') { e.preventDefault(); runSelected(); return; }
  };
  renderResults();
}

function close() { document.getElementById('cp-modal')?.remove(); }

function renderResults() {
  const host = document.getElementById('cp-results');
  if (!host) return;

  if (!currentResults.length) {
    host.innerHTML = `<div class="cp-empty">No match. Try fewer keywords, or start with <code>ask:</code> to send a question to Ask Track.</div>`;
    return;
  }

  // Group results
  const groups = {};
  currentResults.forEach((c, i) => {
    const g = (c._recent ? 'Recent' : (c.group || 'Other'));
    groups[g] = groups[g] || [];
    groups[g].push({ cmd: c, idx: i });
  });

  host.innerHTML = Object.entries(groups).map(([g, items]) => `
    <div class="cp-group">
      <div class="cp-group-label">${escapeHtml(g)}</div>
      ${items.map(({ cmd, idx }) => `
        <button type="button" class="cp-item ${idx === selectedIndex ? 'is-selected' : ''}" data-idx="${idx}">
          <span class="cp-item-title">${escapeHtml(cmd.title)}</span>
          ${cmd._recent ? '<span class="cp-item-tag">recent</span>' : ''}
        </button>
      `).join('')}
    </div>
  `).join('');

  host.querySelectorAll('.cp-item').forEach(el => {
    el.onmouseenter = () => { selectedIndex = parseInt(el.dataset.idx, 10); renderResults(); };
    el.onclick = () => { selectedIndex = parseInt(el.dataset.idx, 10); runSelected(); };
  });
}

function scrollSelectedIntoView() {
  const el = document.querySelector('.cp-item.is-selected');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

function runSelected() {
  const cmd = currentResults[selectedIndex];
  if (!cmd) return;
  close();
  if (cmd.id && !cmd._askQuery) rememberRecent(cmd.id);
  try { cmd.run(); } catch (e) { console.error('cmd failed', cmd.id, e); }
}

/* ---------------- Global keyboard listener ---------------- */

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    open();
  }
});

/* ---------------- Trigger chip in the header ---------------- */

function injectTriggerChip() {
  if (document.getElementById('cp-trigger')) return;
  // Only show when not on an artifact preview (same gate as onboarding)
  try {
    if (location.hostname.endsWith('claudeusercontent.com')) return;
    if (location.protocol === 'file:') return;
  } catch (_) {}
  // Anchor to the header/plan badge area
  const anchor = document.getElementById('plan-badge') || document.querySelector('header .right, header, .app-header');
  if (!anchor) return;
  const chip = document.createElement('button');
  chip.id = 'cp-trigger';
  chip.type = 'button';
  chip.className = 'cp-trigger';
  chip.title = 'Command palette (' + (navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K') + ')';
  chip.innerHTML = `
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    <span>${navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}</span>
  `;
  chip.onclick = open;
  if (anchor.parentNode) anchor.parentNode.insertBefore(chip, anchor);
  else document.body.appendChild(chip);
}

/* ---------------- Public handle ---------------- */

window.CmdPal = { open, close };

/* ---------------- Boot ---------------- */

document.addEventListener('DOMContentLoaded', () => { setTimeout(injectTriggerChip, 400); });
const _prevAll49 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll49) {
  window.renderAll = function () {
    _prevAll49.apply(this, arguments);
    try { injectTriggerChip(); } catch (_) {}
  };
}

})();
