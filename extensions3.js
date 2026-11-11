/* ==========================================================================
   SaaS Spend Track — Phase 3.1
   - Custom multiselect (fixes the native-dropdown visibility bug)
   - UX / bug sweep (modal close, keyboard, listener guards)
   - PDF export with configurable date range for every dashboard
   ========================================================================== */

/* ================================================================
   Custom Multiselect Component
   Replaces native <select multiple> which renders unreadable options
   in dark mode on Chrome. Markup: a button that opens a themed panel
   of checkboxes. Click outside to close.
   ================================================================ */
function multiselect({ id, label, options, selected, onChange, placeholder = 'All', width = 200 }) {
  const sel = new Set(selected);
  const txt = sel.size === 0 ? placeholder : (sel.size === 1 ? options.find(o => o.value === [...sel][0])?.label : `${sel.size} selected`);
  return `<div class="ms" id="${id}" style="min-width:${width}px">
    <button type="button" class="ms-btn" data-ms-toggle>
      <span class="ms-label">${escapeHtml(txt)}</span>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="ms-panel" hidden>
      <div class="ms-search"><input type="search" placeholder="Search…" data-ms-search aria-label="Search options" /></div>
      <div class="ms-list">
        ${options.map(o => `<label class="ms-item"><input type="checkbox" value="${escapeHtml(o.value)}" ${sel.has(o.value) ? 'checked' : ''}><span>${escapeHtml(o.label)}</span></label>`).join('')}
      </div>
      <div class="ms-foot">
        <button type="button" class="ms-clear">Clear</button>
        <button type="button" class="ms-close primary">Done</button>
      </div>
    </div>
  </div>`;
}

function wireMultiselects(root, handlers) {
  root.querySelectorAll('.ms').forEach(el => {
    const id = el.id;
    const btn = el.querySelector('[data-ms-toggle]');
    const panel = el.querySelector('.ms-panel');
    const search = el.querySelector('[data-ms-search]');
    const items = [...el.querySelectorAll('.ms-item')];
    const checks = [...el.querySelectorAll('input[type="checkbox"]')];
    const label = el.querySelector('.ms-label');
    const updateLabel = () => {
      const picked = checks.filter(c => c.checked);
      label.textContent = picked.length === 0 ? (handlers[id]?.placeholder || 'All') :
                           picked.length === 1 ? (items.find(i => i.querySelector('input').checked)?.querySelector('span').textContent || picked.length) :
                           `${picked.length} selected`;
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // close any other open panel
      document.querySelectorAll('.ms-panel').forEach(p => { if (p !== panel) p.hidden = true; });
      panel.hidden = !panel.hidden;
      if (!panel.hidden && search) setTimeout(() => search.focus(), 10);
    });
    if (search) search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      items.forEach(it => { it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
    let dirty = false;
    const commit = () => {
      if (!dirty) return; dirty = false;
      handlers[id]?.onChange(checks.filter(x => x.checked).map(x => x.value));
    };
    checks.forEach(c => c.addEventListener('change', () => { dirty = true; updateLabel(); }));
    el.querySelector('.ms-clear').addEventListener('click', () => {
      checks.forEach(c => c.checked = false); updateLabel(); dirty = true; commit(); panel.hidden = true;
    });
    el.querySelector('.ms-close').addEventListener('click', () => { commit(); panel.hidden = true; });
    // Commit when panel closes any other way (outside click, Escape)
    new MutationObserver(() => { if (panel.hidden) commit(); }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    updateLabel();
  });
  // Click-outside closes any open multiselect
  if (!window._msOutsideBound) {
    window._msOutsideBound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ms')) document.querySelectorAll('.ms-panel').forEach(p => p.hidden = true);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelectorAll('.ms-panel').forEach(p => p.hidden = true);
    });
  }
}

/* ================================================================
   Replace Analytics filter row with the custom multiselect
   ================================================================ */
function patchAnalyticsFilters() {
  const host = document.getElementById('analytics-body');
  if (!host) return;
  const bar = host.querySelector('.filter-bar');
  if (!bar || bar.dataset.customised) return;
  const allDepts = uniq(activeSubs().map(s => s.team).filter(Boolean)).sort();
  const allCats  = uniq(activeSubs().map(s => s.category).filter(Boolean)).sort();
  const allVendors = [...activeSubs()].sort((a, b) => a.name.localeCompare(b.name));
  const f = analyticsFilters();

  bar.innerHTML = `
    <div class="filter-group"><label>Department</label>${multiselect({ id: 'ms-dept', label: 'Department', options: allDepts.map(d => ({ value: d, label: d })), selected: f.departments, placeholder: 'All departments' })}</div>
    <div class="filter-group"><label>Category</label>${multiselect({ id: 'ms-cat', label: 'Category', options: allCats.map(c => ({ value: c, label: c })), selected: f.categories, placeholder: 'All categories' })}</div>
    <div class="filter-group"><label>Tool / vendor</label>${multiselect({ id: 'ms-vendor', label: 'Vendor', options: allVendors.map(v => ({ value: v.id, label: v.name })), selected: f.vendors, placeholder: 'All vendors', width: 240 })}</div>
    <div class="filter-group"><label>Date range</label>${dateRangePicker('ms-range', analyticsRange())}</div>
    <button class="icon-btn" id="flt-clear">Clear filters</button>
    <span class="filter-summary">${filteredSubs().length} / ${activeSubs().length} vendors shown</span>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button class="icon-btn" data-pdf-export="analytics-body" data-pdf-title="Analytics report">Download PDF</button>
    </div>
  `;
  bar.dataset.customised = '1';

  wireMultiselects(bar, {
    'ms-dept':   { placeholder: 'All departments', onChange: v => setAnalyticsFilters({ departments: v }) },
    'ms-cat':    { placeholder: 'All categories',  onChange: v => setAnalyticsFilters({ categories: v }) },
    'ms-vendor': { placeholder: 'All vendors',     onChange: v => setAnalyticsFilters({ vendors: v }) },
  });
  wireDateRange(bar, 'ms-range', (r) => setAnalyticsRange(r));
  document.getElementById('flt-clear').onclick = () => setAnalyticsFilters({ departments: [], categories: [], vendors: [] });
}

/* ================================================================
   Date Range Picker
   ================================================================ */
const DATE_PRESETS = [
  { id: '30d',  label: 'Last 30 days',  days: 30 },
  { id: '90d',  label: 'Last 90 days',  days: 90 },
  { id: 'ytd',  label: 'Year to date',  fn: () => { const d = new Date(new Date().getFullYear(), 0, 1); return Math.ceil((new Date() - d) / 86400000); } },
  { id: '12m',  label: 'Last 12 months', days: 365 },
  { id: 'all',  label: 'All time',      days: null },
];
function analyticsRange() { return state.settings.analyticsRange || { preset: '12m' }; }
function setAnalyticsRange(r) { state.settings.analyticsRange = r; save(); renderAll(); }
function rangeToDates(r) {
  const to = new Date(); to.setHours(23,59,59,999);
  if (!r || !r.preset || r.preset === 'all') return { from: null, to, label: 'All time' };
  if (r.preset === 'custom' && r.from && r.to) {
    return { from: new Date(r.from), to: new Date(r.to), label: `${r.from} to ${r.to}` };
  }
  const preset = DATE_PRESETS.find(p => p.id === r.preset);
  if (!preset) return { from: null, to, label: 'All time' };
  const days = preset.days || (preset.fn ? preset.fn() : 365);
  const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0,0,0,0);
  return { from, to, label: preset.label };
}
function dateRangePicker(id, range) {
  const label = DATE_PRESETS.find(p => p.id === range.preset)?.label || 'Custom';
  return `<div class="dr" id="${id}" style="min-width:160px">
    <button type="button" class="ms-btn" data-dr-toggle>
      <span class="dr-label">${escapeHtml(label)}</span>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="ms-panel" hidden style="padding:8px;min-width:240px">
      ${DATE_PRESETS.map(p => `<label class="ms-item"><input type="radio" name="${id}-r" value="${p.id}" ${range.preset === p.id ? 'checked' : ''}><span>${p.label}</span></label>`).join('')}
      <label class="ms-item"><input type="radio" name="${id}-r" value="custom" ${range.preset === 'custom' ? 'checked' : ''}><span>Custom range</span></label>
      <div class="dr-custom" style="display:flex;gap:6px;padding:6px 10px 2px">
        <input type="date" class="dr-from" value="${range.from || ''}" style="flex:1;height:30px;padding:0 6px;border:1px solid var(--border);border-radius:4px;background:var(--panel);color:var(--text);font-size:12px">
        <input type="date" class="dr-to" value="${range.to || ''}" style="flex:1;height:30px;padding:0 6px;border:1px solid var(--border);border-radius:4px;background:var(--panel);color:var(--text);font-size:12px">
      </div>
      <div class="ms-foot"><button type="button" class="ms-close primary">Done</button></div>
    </div>
  </div>`;
}
function wireDateRange(root, id, onChange) {
  const el = root.querySelector('#' + id); if (!el) return;
  const btn = el.querySelector('[data-dr-toggle]');
  const panel = el.querySelector('.ms-panel');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ms-panel').forEach(p => { if (p !== panel) p.hidden = true; });
    panel.hidden = !panel.hidden;
  });
  el.querySelectorAll('input[type="radio"]').forEach(r => r.addEventListener('change', () => {
    const v = r.value;
    if (v === 'custom') return;
    el.querySelector('.dr-label').textContent = DATE_PRESETS.find(p => p.id === v)?.label || v;
    onChange({ preset: v });
  }));
  const from = el.querySelector('.dr-from'), to = el.querySelector('.dr-to');
  [from, to].forEach(inp => inp.addEventListener('change', () => {
    if (from.value && to.value) {
      el.querySelector('input[value="custom"]').checked = true;
      el.querySelector('.dr-label').textContent = `${from.value} → ${to.value}`;
      onChange({ preset: 'custom', from: from.value, to: to.value });
    }
  }));
  el.querySelector('.ms-close').addEventListener('click', () => { panel.hidden = true; });
}

/* Hook into analytics render to patch the filter bar AFTER each render */
const _prevAnalytics = typeof renderAnalytics === 'function' ? renderAnalytics : null;
if (_prevAnalytics) {
  window.renderAnalytics = function() {
    _prevAnalytics();
    try { patchAnalyticsFilters(); } catch (e) { console.warn(e); }
  };
}

/* ================================================================
   PDF export
   Uses html2pdf.js (jsPDF + html2canvas) from CDN, loaded on demand.
   Clones the target element, strips interactive-only chrome, snapshots
   at page width, and saves.
   ================================================================ */
async function loadPdfLibs() {
  if (window.html2pdf) return window.html2pdf;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.html2pdf;
}
async function exportToPdf(elementId, title) {
  toast('Preparing PDF…', 'info');
  const lib = await loadPdfLibs();
  const source = document.getElementById(elementId);
  if (!source) { toast('Nothing to export yet.', 'error'); return; }
  // Clone the element so we can strip interactive chrome without disturbing the live UI
  const clone = source.cloneNode(true);
  clone.querySelectorAll('button, .icon-btn, .ms-btn, .filter-bar .ms, [data-pdf-export], [data-vendor-nav]').forEach(el => el.remove());
  const now = new Date();
  const r = rangeToDates(analyticsRange());
  const header = document.createElement('div');
  header.style.cssText = 'padding:20px 24px 14px;border-bottom:1px solid #e4e7ec;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
  header.innerHTML = `
    <div style="font-size:11px;color:#667085;letter-spacing:.08em;text-transform:uppercase;font-weight:600">SaaS Spend Track</div>
    <h1 style="margin:4px 0 2px;font-size:22px;color:#101828">${escapeHtml(title)}</h1>
    <div style="font-size:12px;color:#667085">Date range: ${escapeHtml(r.label)} · Generated ${now.toLocaleString('en-IN')}</div>
  `;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'background:#fff;color:#101828;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:0 24px 24px;max-width:1240px;margin:0 auto';
  wrapper.appendChild(header);
  wrapper.appendChild(clone);
  // Force a white background inside the clone
  wrapper.querySelectorAll('*').forEach(el => {
    el.style.color = el.style.color || '#101828';
    const cs = getComputedStyle(el);
    if (cs.backgroundColor.includes('rgb(12,14,20)') || cs.backgroundColor.includes('rgb(18,22,31)') || cs.backgroundColor.includes('rgb(23,28,39)')) {
      el.style.background = '#ffffff';
    }
  });
  document.body.appendChild(wrapper);
  wrapper.style.position = 'absolute'; wrapper.style.left = '-99999px'; wrapper.style.top = '0'; wrapper.style.width = '1240px';
  try {
    await lib().set({
      margin: 10,
      filename: `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${now.toISOString().slice(0,10)}.pdf`,
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    }).from(wrapper).save();
    toast('PDF downloaded.', 'success');
  } catch (e) {
    toast('PDF export failed: ' + e.message, 'error');
  } finally {
    wrapper.remove();
  }
}

/* ================================================================
   Add PDF-export buttons to each dashboard-like view
   ================================================================ */
function addExportButtons() {
  // Dashboard: append to the first section-head
  const places = [
    { view: 'dashboard', containerId: 'dashboard', title: 'Dashboard' },
    { view: 'risk',      containerId: 'risk-analytics-body', title: 'Risk analytics' },
    { view: 'playbook',  containerId: 'playbook-body', title: 'Clause playbook' },
    { view: 'backlog',   containerId: 'backlog-body', title: 'Product backlog' },
    { view: 'team',      containerId: 'team', title: 'Team directory' },
    { view: 'insights',  containerId: 'insights', title: 'Insights' },
    { view: 'renewals',  containerId: 'renewals', title: 'Renewals' },
  ];
  places.forEach(p => {
    const section = document.getElementById(p.view);
    if (!section) return;
    const head = section.querySelector('.section-head .controls, .section-head');
    if (!head) return;
    if (head.querySelector(`[data-pdf-export="${p.containerId}"]`)) return;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.textContent = 'Download PDF';
    btn.dataset.pdfExport = p.containerId;
    btn.dataset.pdfTitle = p.title;
    btn.style.marginLeft = 'auto';
    if (head.classList.contains('controls')) {
      head.appendChild(btn);
    } else {
      // append as a floating right-side control
      const wrap = document.createElement('div');
      wrap.className = 'controls';
      wrap.appendChild(btn);
      head.appendChild(wrap);
    }
  });
  // Delegate click
  if (!window._pdfBound) {
    window._pdfBound = true;
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pdf-export]');
      if (b) exportToPdf(b.dataset.pdfExport, b.dataset.pdfTitle || 'Report');
    });
  }
}

/* ================================================================
   Bug sweep
   ================================================================ */
function bugSweep() {
  // 1) Settings modal: backdrop click to close
  const settings = document.getElementById('settings-modal');
  if (settings && !settings.dataset.wired) {
    settings.addEventListener('click', (e) => { if (e.target === settings) settings.hidden = true; });
    settings.dataset.wired = '1';
  }
  // 2) Invoice modal already has backdrop close; make sure settings has Escape-key close
  if (!window._escBound) {
    window._escBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['settings-modal', 'contract-detail-modal'].forEach(id => {
          const m = document.getElementById(id); if (m && !m.hidden) m.hidden = true;
        });
      }
    });
  }
  // 3) Sidebar plan-badge (now a div) shouldn't claim to be clickable
  const pb = document.getElementById('plan-badge');
  if (pb && pb.tagName === 'DIV') { pb.style.cursor = 'default'; pb.removeAttribute('title'); pb.title = 'All features included'; }
  // 4) Topbar urgency chips: make sure they switch view when clicked
  document.querySelectorAll('.urgency-chip[data-goto]').forEach(c => {
    if (c.dataset.wired) return; c.dataset.wired = '1';
    c.addEventListener('click', () => switchView(c.dataset.goto));
  });
}

/* ================================================================
   Hook renderAll
   ================================================================ */
const _prevAll3 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll3) {
  window.renderAll = function () { _prevAll3(); try { addExportButtons(); bugSweep(); } catch (e) { console.warn(e); } };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { addExportButtons(); bugSweep(); } catch (_) {} }, 120);
});
