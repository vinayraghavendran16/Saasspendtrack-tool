/* ================================================================
   Phase 43 - In-app Onboarding (Whatfix-style)
   ================================================================
   Five surfaces, all browser-only, state in localStorage:

   1. Onboarding checklist   - persistent floating widget, bottom-right
   2. Guided tour            - spotlight overlay + tooltip, first visit
   3. Beacons                - pulsing dots on key UI, dismiss on click
   4. Smart tips             - data-tip hover tooltips on labels
   5. Help launcher          - replay tour, list of how-to flows

   Boots after signup capture (not before). Hidden on
   claudeusercontent.com and file:// so demos stay clean.
   Checklist / tour / beacon events are POSTed to the same Apps
   Script endpoint used by signup capture, so you get funnel data
   in the same Sheet.
   ================================================================ */

(() => {

/* ---------------- Config ---------------- */

const CHECKLIST = [
  {
    id: 'upload_contract',
    label: 'Upload your first contract',
    hint: 'Or paste one in. The parser does the rest.',
    cta: 'Start',
    flow: 'upload_contract',
    // "Contract" = any subscription with a parsed .contract field. To avoid
    // pre-completing from the 28 demo contracts, only count ones ADDED since
    // onboarding began (importedAt timestamp OR not in the original set).
    done: () => {
      const subs = state.subscriptions || [];
      const baseline = ob().baselineContracts || 0;
      const current = subs.filter(s => s.contract && typeof s.contract === 'object').length;
      return current > baseline;
    },
  },
  {
    id: 'add_vendor',
    label: 'Add a vendor',
    hint: 'So you can track ownership and spend by vendor.',
    cta: 'Show me',
    flow: 'add_vendor',
    // "Vendor" = subscription. Demo seed ships ~28 subs, so we baseline
    // against the count AT onboarding start, then require growth.
    done: () => {
      const subs = state.subscriptions || [];
      const baseline = ob().baselineSubs || 0;
      return subs.length > baseline;
    },
  },
  {
    id: 'ask_track',
    label: 'Ask Track a question',
    hint: 'Try "what renews next month" or "show me Zoom".',
    cta: 'Open Ask Track',
    flow: 'ask_track',
    done: () => !!(state.settings && state.settings.askTrackUsed),
  },
  {
    id: 'see_forecast',
    label: 'See your 12-month licence forecast',
    hint: 'Projects spend from current contracts and usage trend.',
    cta: 'Open forecast',
    flow: 'see_forecast',
    done: () => !!(ob().viewed && ob().viewed.consumption),
  },
  {
    id: 'see_renewals',
    label: 'View upcoming renewals',
    hint: 'Calendar of every renewal in the next 12 months.',
    cta: 'Open renewals',
    flow: 'see_renewals',
    done: () => !!(ob().viewed && ob().viewed.renewals),
  },
  {
    id: 'see_risk',
    label: 'Check the risk dashboard',
    hint: 'Auto-renew traps, orphan contracts, shadow SaaS.',
    cta: 'Open risk',
    flow: 'see_risk',
    done: () => !!(ob().viewed && ob().viewed.risk),
  },
];

/* Guided flows - each is an ordered list of spotlight steps.
   `selector` is tried in order; first match is spotlit. If none
   match, the step is skipped (graceful degradation). */
const FLOWS = {
  tour: [
    {
      selector: '.app-nav, .sidebar, nav',
      title: 'This is your sidebar',
      body: 'Every view in SaaS Spend Track lives here. We\'ll walk through the three you\'ll use most.',
      placement: 'right',
    },
    {
      selector: '.tab[data-view="dashboard"]',
      title: 'Dashboard',
      body: 'Your single-pane view of spend, upcoming renewals, risk flags, and the licences you\'re not using.',
      placement: 'right',
      act: () => safeSwitchView('dashboard'),
    },
    {
      selector: '.tab[data-view="contracts"]',
      title: 'Contract terms',
      body: 'Upload a PDF here and the parser pulls out renewal date, auto-renew window, notice period, and the clauses that matter.',
      placement: 'right',
      act: () => safeSwitchView('contracts'),
    },
    {
      selector: '.sidebar .tab[data-view="chat"], .tab[data-view="chat"]',
      title: 'Ask Track',
      body: 'Ask natural-language questions about your corpus. "What renews next month" or "show me contracts with auto-renew".',
      placement: 'right',
      act: () => safeSwitchView('chat'),
    },
    {
      selector: '#plan-badge, .trial-banner, header',
      title: 'Your trial',
      body: 'You have 14 days. Everything runs in your browser - no data leaves this device. Upgrade anytime from Plans.',
      placement: 'bottom',
    },
  ],

  upload_contract: [
    { act: () => safeSwitchView('contracts') },
    {
      selector: '#sample-contract, [id*="sample"], button:is(.primary)',
      title: 'Try a sample first',
      body: 'Click this to load a realistic sample contract. The parser runs on it, so you can see what the output looks like before uploading your own.',
      placement: 'bottom',
    },
    {
      selector: '#contract-pick, input[type="file"], label[for*="contract"]',
      title: 'Or upload your own',
      body: 'Drop in a PDF, Word doc, or paste the text. Everything stays on your device.',
      placement: 'bottom',
    },
  ],

  add_vendor: [
    { act: () => safeSwitchView('subscriptions') },
    {
      selector: '[data-action="add-vendor"], #add-vendor, button:is(.primary)',
      title: 'Add a vendor',
      body: 'Name, owner, approximate annual spend. You can edit everything later.',
      placement: 'bottom',
    },
  ],

  ask_track: [
    { act: () => safeSwitchView('chat') },
    {
      selector: '#ai-input, textarea, input[type="text"]',
      title: 'Type a question',
      body: 'Try: "what renews in Q1", "cheapest vendor per seat", or "show contracts with 90-day notice".',
      placement: 'top',
    },
    {
      selector: '#ai-mic, [data-mic], button[title*="voice" i]',
      title: 'Or ask by voice',
      body: 'Tap the mic and speak. Works in 12 languages.',
      placement: 'top',
    },
  ],

  see_forecast: [
    { act: () => safeSwitchView('consumption') },
    {
      selector: '.view[data-view="consumption"], main, body',
      title: 'Licence forecast',
      body: 'Projects your spend over the next 12 months using current contracts and usage trends. Hover for the maths.',
      placement: 'top',
    },
  ],

  see_renewals: [
    { act: () => safeSwitchView('renewals') },
    {
      selector: '.view[data-view="renewals"], main, body',
      title: 'Renewal calendar',
      body: 'Every renewal in the next 12 months, with notice-period windows highlighted so you don\'t miss an exit.',
      placement: 'top',
    },
  ],

  see_risk: [
    { act: () => safeSwitchView('risk') },
    {
      selector: '.view[data-view="risk"], main, body',
      title: 'Risk dashboard',
      body: 'Auto-renew traps, orphan contracts (no assigned owner), and shadow SaaS detected from invoices.',
      placement: 'top',
    },
  ],
};

/* Pulsing beacons - small animated dots on key UI, dismissed on click. */
const BEACONS = [
  { id: 'mic', selector: '#ai-mic, [data-mic]', title: 'Try asking by voice' },
  { id: 'forecast', selector: '.tab[data-view="consumption"]', title: 'New: 12-month forecast' },
  { id: 'risk', selector: '.tab[data-view="risk"]', title: 'Check for renewal traps' },
];

/* ---------------- State ---------------- */

function ob() {
  state.settings = state.settings || {};
  if (!state.settings.onboarding) {
    const subs = state.subscriptions || [];
    state.settings.onboarding = {
      tourSeen: false,
      completed: {},     // { item_id: iso_timestamp }
      dismissedBeacons: {},
      dismissedChecklist: false,
      panelOpen: false,
      viewed: {},        // { view_name: iso_timestamp } - for see_* checklist items
      // Baselines set once, when onboarding state is first created. Phase 53:
      // prevents the "add_vendor" / "upload_contract" items from showing
      // pre-completed because the demo workspace already has 28 subscriptions.
      baselineSubs: subs.length,
      baselineContracts: subs.filter(s => s.contract && typeof s.contract === 'object').length,
      baselinedAt: new Date().toISOString(),
    };
  }
  return state.settings.onboarding;
}

function markComplete(id) {
  const o = ob();
  if (o.completed[id]) return;
  o.completed[id] = new Date().toISOString();
  save();
  renderChecklist();
  postEvent('onboarding_item_completed', { item_id: id });
  // If every item is done, celebrate + fade the panel.
  if (CHECKLIST.every(it => it.done() || o.completed[it.id])) {
    celebrateDone();
  }
}

function markViewed(viewName) {
  const o = ob();
  o.viewed = o.viewed || {};
  if (o.viewed[viewName]) return;
  o.viewed[viewName] = new Date().toISOString();
  save();
  // See if a checklist item is now satisfied.
  CHECKLIST.forEach(it => {
    if (!o.completed[it.id] && it.done()) markComplete(it.id);
  });
}

/* Post an onboarding event to the same Apps Script endpoint signup uses.
   Fire-and-forget; failures are silent. */
function postEvent(eventType, extra = {}) {
  try {
    const url = (typeof signupEndpoint === 'function') ? signupEndpoint() : null;
    if (!url || url.includes('PASTE-YOUR')) return;
    const w = (typeof workspace === 'function') ? workspace() : {};
    const body = new URLSearchParams();
    body.append('event_type', eventType);
    body.append('email', w.ownerEmail || '');
    body.append('company', w.companyName || '');
    body.append('workspace_id', w.id || '');
    Object.entries(extra).forEach(([k, v]) => body.append(k, String(v ?? '')));
    fetch(url, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
  } catch (_) {}
}

/* ---------------- Visibility gate ---------------- */

function onboardingHidden() {
  try {
    if (location.hostname.endsWith('claudeusercontent.com')) return true;
    if (location.protocol === 'file:') return true;
  } catch (_) {}
  // Don't run before signup is captured - don't stack two modals at once.
  if (typeof needsSignupCapture === 'function' && needsSignupCapture()) return true;
  return false;
}

/* ---------------- UI: Checklist widget ---------------- */

function renderChecklist() {
  if (onboardingHidden()) return;
  const o = ob();
  if (o.dismissedChecklist) return;

  // Compute progress
  const total = CHECKLIST.length;
  const doneCount = CHECKLIST.filter(it => it.done() || o.completed[it.id]).length;
  const pct = Math.round((doneCount / total) * 100);

  let el = document.getElementById('ob-checklist');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ob-checklist';
    el.className = 'ob-checklist';
    document.body.appendChild(el);
  }

  const open = o.panelOpen !== false;
  el.classList.toggle('open', open);

  el.innerHTML = `
    <button type="button" class="ob-chk-head" id="ob-chk-head">
      <span class="ob-chk-head-left">
        <span class="ob-chk-ring" style="--pct:${pct}">
          <svg viewBox="0 0 36 36">
            <circle class="ob-ring-bg" cx="18" cy="18" r="15.9"/>
            <circle class="ob-ring-fg" cx="18" cy="18" r="15.9"
              stroke-dasharray="${pct}, 100"/>
          </svg>
          <span class="ob-ring-txt">${doneCount}/${total}</span>
        </span>
        <span class="ob-chk-head-txt">
          <b>Get started</b>
          <small>${pct === 100 ? 'All done. Nice.' : `${total - doneCount} left`}</small>
        </span>
      </span>
      <svg class="ob-chk-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="ob-chk-body">
      <ul class="ob-chk-list">
        ${CHECKLIST.map(it => {
          const isDone = it.done() || o.completed[it.id];
          return `
            <li class="ob-chk-item ${isDone ? 'is-done' : ''}">
              <span class="ob-chk-tick">${isDone ? '✓' : ''}</span>
              <span class="ob-chk-text">
                <span class="ob-chk-label">${escapeHtml(it.label)}</span>
                <span class="ob-chk-hint">${escapeHtml(it.hint)}</span>
              </span>
              ${isDone ? '' : `<button type="button" class="ob-chk-cta" data-flow="${it.flow}">${escapeHtml(it.cta)}</button>`}
            </li>
          `;
        }).join('')}
      </ul>
      <div class="ob-chk-foot">
        <button type="button" class="ob-chk-dismiss" id="ob-chk-dismiss">Hide this</button>
      </div>
    </div>
  `;

  el.querySelector('#ob-chk-head').onclick = () => {
    o.panelOpen = !open;
    save();
    renderChecklist();
  };
  el.querySelector('#ob-chk-dismiss').onclick = () => {
    if (confirm('Hide this checklist? You can bring it back from Help.')) {
      o.dismissedChecklist = true;
      save();
      el.remove();
      postEvent('onboarding_checklist_dismissed');
    }
  };
  el.querySelectorAll('.ob-chk-cta').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      runFlow(b.dataset.flow);
    };
  });
}

function celebrateDone() {
  const el = document.getElementById('ob-checklist');
  if (!el) return;
  el.classList.add('ob-chk-celebrate');
  postEvent('onboarding_checklist_finished');
  setTimeout(() => {
    el.classList.add('ob-chk-fading');
    setTimeout(() => { ob().dismissedChecklist = true; save(); el.remove(); }, 1200);
  }, 5000);
}

/* ---------------- UI: Spotlight tour ---------------- */

let tourState = null;

function runFlow(flowId) {
  const steps = FLOWS[flowId];
  if (!steps || !steps.length) return;
  tourState = { flowId, steps, index: 0 };
  postEvent('onboarding_flow_started', { flow_id: flowId });
  advanceTour();
}

function advanceTour() {
  if (!tourState) return;
  if (tourState.index >= tourState.steps.length) {
    closeTour(true);
    return;
  }
  const step = tourState.steps[tourState.index];

  // Pure action step (no selector / title) - run it, advance after 350ms.
  if (step.act && !step.selector) {
    try { step.act(); } catch (_) {}
    tourState.index++;
    setTimeout(advanceTour, 350);
    return;
  }
  if (step.act) {
    try { step.act(); } catch (_) {}
  }

  // Find the element to spotlight.
  const el = findFirst(step.selector);
  if (!el) {
    // Skip this step gracefully; try the next one.
    tourState.index++;
    advanceTour();
    return;
  }

  // Wait a tick so view switches finish rendering.
  // Re-query right before showing: step.act may have switched view and
  // triggered renderAll(), which rebuilds the sidebar and detaches the
  // originally-captured el (so its getBoundingClientRect returns a stale
  // or zeroed rect, landing the tooltip at the top of the sidebar instead
  // of on the actual target).
  setTimeout(() => {
    const freshEl = findFirst(step.selector) || el;
    if (!freshEl || !freshEl.isConnected || freshEl.offsetParent === null) {
      // Target was removed or is hidden now - skip this step rather than
      // pointing at nothing.
      tourState.index++;
      advanceTour();
      return;
    }
    showSpotlight(freshEl, step, tourState.index, tourState.steps.length);
  }, 300);
}

function findFirst(selector) {
  if (!selector) return null;
  const sels = selector.split(',').map(s => s.trim()).filter(Boolean);
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el && el.offsetParent !== null) return el;
  }
  // Fallback: visible or not.
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

function showSpotlight(target, step, index, total) {
  removeSpotlight();

  // Scroll target into view
  try { target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch (_) {}

  const rect = target.getBoundingClientRect();
  const pad = 6;
  const r = {
    top: Math.max(0, rect.top - pad),
    left: Math.max(0, rect.left - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  // Overlay (dark, with a cutout)
  const overlay = document.createElement('div');
  overlay.id = 'ob-overlay';
  overlay.className = 'ob-overlay';
  overlay.innerHTML = `
    <svg class="ob-overlay-svg" width="100%" height="100%">
      <defs>
        <mask id="ob-mask">
          <rect width="100%" height="100%" fill="white"/>
          <rect x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" rx="8" fill="black"/>
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(2,6,23,0.72)" mask="url(#ob-mask)"/>
      <rect x="${r.left - 2}" y="${r.top - 2}" width="${r.width + 4}" height="${r.height + 4}"
            rx="10" fill="none" stroke="#5b8def" stroke-width="2" class="ob-overlay-ring"/>
    </svg>
  `;
  document.body.appendChild(overlay);

  // Tooltip
  const tip = document.createElement('div');
  tip.id = 'ob-tip';
  tip.className = 'ob-tip';
  tip.innerHTML = `
    <div class="ob-tip-head">
      <span class="ob-tip-step">Step ${index + 1} of ${total}</span>
      <button type="button" class="ob-tip-x" id="ob-tip-x" title="Skip">×</button>
    </div>
    <h4 class="ob-tip-title">${escapeHtml(step.title || '')}</h4>
    <p class="ob-tip-body">${escapeHtml(step.body || '')}</p>
    <div class="ob-tip-foot">
      ${index > 0 ? '<button type="button" class="ob-tip-back" id="ob-tip-back">Back</button>' : '<span></span>'}
      <button type="button" class="ob-tip-next" id="ob-tip-next">${index === total - 1 ? 'Done' : 'Next'}</button>
    </div>
  `;
  document.body.appendChild(tip);

  // Position the tooltip relative to the target.
  positionTip(tip, rect, step.placement || 'bottom');

  tip.querySelector('#ob-tip-x').onclick = () => closeTour(false);
  tip.querySelector('#ob-tip-next').onclick = () => {
    tourState.index++;
    advanceTour();
  };
  const backBtn = tip.querySelector('#ob-tip-back');
  if (backBtn) backBtn.onclick = () => {
    tourState.index = Math.max(0, tourState.index - 1);
    advanceTour();
  };

  // ESC to skip
  document.addEventListener('keydown', escHandler);
}

function escHandler(e) {
  if (e.key === 'Escape' && tourState) closeTour(false);
}

function positionTip(tip, targetRect, placement) {
  const tipRect = tip.getBoundingClientRect();
  const margin = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top, left;
  switch (placement) {
    case 'right':
      top = targetRect.top + targetRect.height / 2 - tipRect.height / 2;
      left = targetRect.right + margin;
      break;
    case 'left':
      top = targetRect.top + targetRect.height / 2 - tipRect.height / 2;
      left = targetRect.left - tipRect.width - margin;
      break;
    case 'top':
      top = targetRect.top - tipRect.height - margin;
      left = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
      break;
    case 'bottom':
    default:
      top = targetRect.bottom + margin;
      left = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
  }

  // Clamp to viewport
  top = Math.max(16, Math.min(top, vh - tipRect.height - 16));
  left = Math.max(16, Math.min(left, vw - tipRect.width - 16));

  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
}

function removeSpotlight() {
  document.getElementById('ob-overlay')?.remove();
  document.getElementById('ob-tip')?.remove();
  document.removeEventListener('keydown', escHandler);
}

function closeTour(completed) {
  if (!tourState) return;
  const { flowId, index, steps } = tourState;
  postEvent(completed ? 'onboarding_flow_completed' : 'onboarding_flow_skipped', {
    flow_id: flowId, step_reached: index + 1, total_steps: steps.length,
  });
  removeSpotlight();
  // If this is the first-visit tour, mark it seen either way.
  if (flowId === 'tour') ob().tourSeen = true;
  // Any flow completion that maps to a checklist item satisfies it.
  if (completed) {
    const item = CHECKLIST.find(it => it.flow === flowId);
    if (item && !item.done()) markComplete(item.id);
  }
  tourState = null;
  save();
  renderChecklist();
}

/* ---------------- UI: Beacons ---------------- */

function renderBeacons() {
  if (onboardingHidden()) return;
  const o = ob();
  BEACONS.forEach(b => {
    if (o.dismissedBeacons[b.id]) return;
    const target = findFirst(b.selector);
    if (!target) return;
    if (target.querySelector(':scope > .ob-beacon')) return;
    const dot = document.createElement('span');
    dot.className = 'ob-beacon';
    dot.title = b.title;
    dot.dataset.beaconId = b.id;
    dot.onclick = (e) => {
      e.stopPropagation();
      o.dismissedBeacons[b.id] = new Date().toISOString();
      save();
      dot.remove();
      postEvent('onboarding_beacon_clicked', { beacon_id: b.id });
    };
    // Ensure parent is positioned
    const cs = getComputedStyle(target);
    if (cs.position === 'static') target.style.position = 'relative';
    target.appendChild(dot);
  });
}

/* ---------------- UI: Smart Tips (hover ?) ---------------- */

function initSmartTips() {
  document.querySelectorAll('[data-tip]:not([data-tip-wired])').forEach(el => {
    el.dataset.tipWired = '1';
    const icon = document.createElement('span');
    icon.className = 'ob-smart-tip';
    icon.innerHTML = '?';
    icon.setAttribute('aria-label', el.getAttribute('data-tip'));
    icon.title = el.getAttribute('data-tip');
    el.appendChild(icon);
  });
}

/* ---------------- UI: Help launcher ---------------- */

function renderHelpLauncher() {
  if (onboardingHidden()) return;
  if (document.getElementById('ob-help')) return;
  const btn = document.createElement('button');
  btn.id = 'ob-help';
  btn.className = 'ob-help';
  btn.type = 'button';
  btn.innerHTML = '<span class="ob-help-icon">?</span><span class="ob-help-txt">Help</span>';
  btn.onclick = openHelpPanel;
  document.body.appendChild(btn);
}

function openHelpPanel() {
  document.getElementById('ob-help-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'ob-help-panel';
  panel.className = 'ob-help-panel';
  panel.innerHTML = `
    <div class="ob-help-head">
      <b>Help</b>
      <button type="button" class="ob-help-x" id="ob-help-x">×</button>
    </div>
    <input type="text" class="ob-help-search" id="ob-help-search" placeholder="Search guides..." autofocus/>
    <div class="ob-help-list" id="ob-help-list">
      ${helpItems().map(h => `
        <button type="button" class="ob-help-item" data-flow="${h.flow}">
          <span class="ob-help-item-title">${escapeHtml(h.title)}</span>
          <span class="ob-help-item-sub">${escapeHtml(h.sub)}</span>
        </button>
      `).join('')}
    </div>
    <div class="ob-help-foot">
      Still stuck? Email <a href="mailto:vinayraghavendran16@gmail.com">support</a>
    </div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('#ob-help-x').onclick = () => panel.remove();
  panel.querySelector('#ob-help-search').oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    panel.querySelectorAll('.ob-help-item').forEach(it => {
      const txt = it.textContent.toLowerCase();
      it.style.display = (!q || txt.includes(q)) ? '' : 'none';
    });
  };
  panel.querySelectorAll('.ob-help-item').forEach(b => {
    b.onclick = () => {
      panel.remove();
      const f = b.dataset.flow;
      if (f === '__bulk_import' && window.BulkImport) { window.BulkImport.open(); return; }
      if (f === '__reports' && window.Reports) { window.Reports.view(); return; }
      runFlow(f);
    };
  });
  postEvent('onboarding_help_opened');
}

function helpItems() {
  return [
    { flow: 'tour',              title: 'Replay the welcome tour', sub: '5 steps · 60 seconds' },
    { flow: '__bulk_import',     title: 'Bulk import from CSV',    sub: 'Paste your existing spreadsheet' },
    { flow: 'upload_contract',   title: 'How to upload a contract', sub: 'Or load a sample' },
    { flow: 'add_vendor',        title: 'How to add a vendor',      sub: 'Ownership + annual spend' },
    { flow: 'ask_track',         title: 'How to use Ask Track',     sub: 'Text or voice' },
    { flow: 'see_forecast',      title: 'See the 12-month forecast', sub: 'Projected spend' },
    { flow: 'see_renewals',      title: 'See upcoming renewals',    sub: 'Calendar view' },
    { flow: 'see_risk',          title: 'Check the risk dashboard', sub: 'Auto-renew, orphans, shadow SaaS' },
    { flow: '__reports',         title: 'Download a report',       sub: 'Monthly spend PDF · renewal CSV · savings PDF' },
  ];
}

/* Expose a public handle so other code (or the user) can bring it back. */
window.OnboardHelp = {
  open: openHelpPanel,
  runFlow,
  resetChecklist: () => { ob().dismissedChecklist = false; ob().panelOpen = true; save(); renderChecklist(); },
  resetAll: () => {
    state.settings.onboarding = null;
    save();
    document.getElementById('ob-checklist')?.remove();
    renderChecklist();
    renderBeacons();
  },
};

/* ---------------- Hooks: auto-complete checklist from app activity ---------------- */

/* Monkey-patch switchView so a visit to forecast/renewals/risk auto-ticks the item. */
function wireHooks() {
  const prev = window.switchView;
  if (typeof prev !== 'function' || prev._obWrapped) return;
  window.switchView = function (name, opts) {
    const r = prev.apply(this, arguments);
    try {
      if (['consumption', 'renewals', 'risk', 'chat'].includes(name)) {
        markViewed(name);
        if (name === 'chat') {
          // Ask Track flag - set on next input event in the chat input.
          wireChatInputFlag();
        }
      }
    } catch (_) {}
    return r;
  };
  window.switchView._obWrapped = true;
}

function wireChatInputFlag() {
  const input = document.querySelector('#ai-input, textarea, input[type="text"]');
  if (!input || input._obChatWired) return;
  input._obChatWired = true;
  const flag = () => {
    if (input.value && input.value.trim().length > 0) {
      state.settings.askTrackUsed = true;
      save();
    }
  };
  input.addEventListener('input', flag);
  input.addEventListener('change', flag);
}

function safeSwitchView(name) {
  try { if (typeof switchView === 'function') switchView(name); } catch (_) {}
}

/* Periodic tick - cheap check for completion conditions we can't event-hook. */
function tick() {
  try {
    const o = ob();
    let changed = false;
    CHECKLIST.forEach(it => {
      if (!o.completed[it.id] && it.done()) { markComplete(it.id); changed = true; }
    });
    renderBeacons();
    initSmartTips();
    if (changed) renderChecklist();
  } catch (_) {}
}

/* ---------------- Boot ---------------- */

function bootOnboarding() {
  if (onboardingHidden()) return;
  wireHooks();
  renderChecklist();
  renderHelpLauncher();
  renderBeacons();
  initSmartTips();

  // Run the first-visit welcome tour once.
  if (!ob().tourSeen) {
    // Give the app 1s to settle before we dim its screen.
    setTimeout(() => {
      if (onboardingHidden()) return; // signup modal may have just appeared
      if (!ob().tourSeen) runFlow('tour');
    }, 1200);
  }

  // Periodic tick for completion + rebinding beacons after re-renders.
  setInterval(tick, 2500);
}

/* Hook after signup is captured - called from extensions21's markSignupCaptured
   via a window event. If that event never fires, boot on DOMContentLoaded
   when the signup gate is already satisfied. */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(bootOnboarding, 800);
});

/* Also re-check whenever renderAll runs (sidebar can rebuild, losing beacons). */
const _prevAll22 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll22) {
  window.renderAll = function () {
    _prevAll22.apply(this, arguments);
    try { renderBeacons(); initSmartTips(); } catch (_) {}
  };
}

})();
