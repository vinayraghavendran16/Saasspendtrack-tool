/* ================================================================
   Phase 44 — Bulk CSV import for subscriptions
   ================================================================
   Three-step modal:
     1. Paste CSV / upload .csv / .tsv file
     2. Column mapping (auto-detects common header names)
     3. Preview + dry-run (shows adds / duplicates / errors, commits)

   Fuzzy-matches against existing vendors (Levenshtein from Ask Track)
   to flag duplicates. Imports create real subscription rows; the
   user can then open the Subscriptions view and edit.

   Entry points:
   - "Bulk import" button injected into the Subscriptions view header
   - window.BulkImport.open() for QA / help launcher

   Also ties into onboarding: a successful import auto-ticks
   both "add_vendor" and "upload_contract" checklist items.
   ================================================================ */

(() => {

/* ---------------- Schema we map to ---------------- */

const FIELDS = [
  { key: 'name',     label: 'Vendor name',       required: true,  hint: 'Salesforce, Zoom, Figma...' },
  { key: 'cost',     label: 'Cost',              required: false, hint: 'Numeric. $ and commas stripped.' },
  { key: 'cycle',    label: 'Billing cycle',     required: false, hint: 'monthly / yearly / quarterly' },
  { key: 'category', label: 'Category',          required: false, hint: 'CRM, Analytics, Design...' },
  { key: 'team',     label: 'Owning team',       required: false, hint: 'Sales, Marketing, Engineering...' },
  { key: 'owner',    label: 'Owner email',       required: false, hint: 'The person responsible for this tool' },
  { key: 'renewal',  label: 'Renewal date',      required: false, hint: 'ISO (2026-05-14) or natural (14 May 2026)' },
  { key: 'licenses', label: 'Licences purchased',required: false, hint: 'Numeric' },
  { key: 'notes',    label: 'Notes',             required: false, hint: 'Free text' },
  { key: 'url',      label: 'URL / website',     required: false, hint: 'https://vendor.com' },
];

/* Common header aliases → our field keys. Case-insensitive match. */
const HEADER_ALIASES = {
  name:     ['vendor', 'vendor name', 'tool', 'software', 'product', 'saas', 'service', 'app', 'application', 'name', 'subscription'],
  cost:     ['cost', 'price', 'amount', 'annual spend', 'annual cost', 'monthly cost', 'spend', 'yearly cost', 'yearly spend', 'acv', 'arr', 'total', 'subscription cost'],
  cycle:    ['cycle', 'billing', 'billing cycle', 'billing period', 'period', 'frequency', 'term', 'interval'],
  category: ['category', 'type', 'segment', 'bucket', 'function', 'use case'],
  team:     ['team', 'department', 'dept', 'owner team', 'business unit', 'bu', 'division'],
  owner:    ['owner', 'owner email', 'contact', 'contact email', 'manager', 'point of contact', 'poc', 'responsible', 'primary contact'],
  renewal:  ['renewal', 'renewal date', 'renews on', 'renews', 'next renewal', 'end date', 'expiration', 'expires', 'contract end', 'renewal due'],
  licenses: ['licenses', 'licences', 'seats', 'seat count', 'users', 'user count', 'quantity', 'qty'],
  notes:    ['notes', 'note', 'comment', 'comments', 'description', 'remarks'],
  url:      ['url', 'website', 'site', 'link', 'web', 'vendor url'],
};

/* ---------------- CSV parser (vanilla, handles quotes + commas inside quotes) ---------------- */

function parseCSV(text, delimiter) {
  // Auto-detect delimiter if not given
  if (!delimiter) {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    delimiter = tabCount > commaCount ? '\t' : ',';
  }

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === delimiter) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell && cell.trim().length));
}

/* ---------------- Field coercion ---------------- */

function coerceCost(raw) {
  if (raw == null || raw === '') return null;
  // Strip $ , ₹ € £ and whitespace. Keep decimal point.
  const cleaned = String(raw).replace(/[,₹$€£\s]/g, '').replace(/^USD|^INR|^EUR|^GBP/i, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function coerceCycle(raw) {
  if (!raw) return 'yearly';
  const s = String(raw).toLowerCase().trim();
  if (s.startsWith('month') || s === 'm' || s === 'mo' || s === '/mo' || s === 'monthly') return 'monthly';
  if (s.startsWith('year') || s === 'y' || s === 'yr' || s === 'annual' || s === 'annually') return 'yearly';
  if (s.startsWith('quarter') || s === 'q' || s === 'qtr' || s === 'quarterly') return 'quarterly';
  if (s === 'one' || s === 'one-time' || s === 'onetime') return 'one-time';
  return 'yearly';
}

function coerceDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Always format from (y,m,d) components to dodge TZ drift on
  // toISOString() — 14/05/2026 in IST must stay 2026-05-14, not 2026-05-13.
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  // ISO first
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return fmt(+iso[1], +iso[2], +iso[3]);
  // DD/MM/YYYY or DD-MM-YYYY (prefer DMY — our ICP is India + APAC)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let dd = +dmy[1], mm = +dmy[2], yy = +dmy[3];
    if (yy < 100) yy += 2000;
    // If day > 12, this cannot be MDY so DMY is unambiguous. If month > 12,
    // it must actually be MDY — swap. Otherwise default to DMY.
    if (mm > 12 && dd <= 12) { const t = dd; dd = mm; mm = t; }
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) return fmt(yy, mm, dd);
  }
  // Natural ("14 May 2026") via native parser, but normalize using UTC components.
  const d = new Date(s);
  if (!isNaN(d.getTime())) return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return null;
}

function coerceInt(raw) {
  if (raw == null || raw === '') return null;
  const n = parseInt(String(raw).replace(/[,\s]/g, ''), 10);
  return isNaN(n) ? null : n;
}

/* ---------------- Levenshtein (fallback if ask-track's isn't exposed) ---------------- */

function lev(a, b) {
  a = (a || '').toLowerCase(); b = (b || '').toLowerCase();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function findFuzzyDuplicate(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  const existing = (state.subscriptions || []);
  // Exact first
  const exact = existing.find(s => (s.name || '').toLowerCase().trim() === lower);
  if (exact) return { sub: exact, distance: 0, match: 'exact' };
  // Then fuzzy within a small distance threshold scaled to length
  let best = null;
  for (const s of existing) {
    const d = lev((s.name || '').toLowerCase().trim(), lower);
    const threshold = Math.max(2, Math.floor(lower.length / 5));
    if (d <= threshold && (!best || d < best.distance)) {
      best = { sub: s, distance: d, match: 'fuzzy' };
    }
  }
  return best;
}

/* ---------------- Auto header mapping ---------------- */

function autoMap(headers) {
  const map = {}; // { fieldKey: columnIndex }
  const used = new Set();
  const norm = headers.map(h => (h || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim());
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let i = 0; i < norm.length; i++) {
      if (used.has(i)) continue;
      if (aliases.includes(norm[i])) { map[key] = i; used.add(i); break; }
    }
  }
  return map;
}

/* ---------------- State ---------------- */

const biState = {
  rows: [],       // parsed 2D array including header row
  headers: [],
  mapping: {},    // { fieldKey: columnIndex }
  step: 1,
};

/* ---------------- UI ---------------- */

function open() {
  document.getElementById('bi-modal')?.remove();
  biState.rows = [];
  biState.headers = [];
  biState.mapping = {};
  biState.step = 1;

  const m = document.createElement('div');
  m.id = 'bi-modal';
  m.className = 'bi-modal';
  m.innerHTML = `
    <div class="bi-backdrop"></div>
    <div class="bi-card">
      <button type="button" class="bi-close" id="bi-close" title="Close">×</button>
      <div class="bi-steps">
        <span class="bi-step is-active" data-s="1">1 · Paste</span>
        <span class="bi-step" data-s="2">2 · Map columns</span>
        <span class="bi-step" data-s="3">3 · Preview &amp; import</span>
      </div>
      <div class="bi-body" id="bi-body"></div>
    </div>
  `;
  document.body.appendChild(m);
  m.querySelector('#bi-close').onclick = close;
  m.querySelector('.bi-backdrop').onclick = close;
  document.addEventListener('keydown', escClose);
  renderStep();
}

function close() {
  document.getElementById('bi-modal')?.remove();
  document.removeEventListener('keydown', escClose);
}

function escClose(e) { if (e.key === 'Escape') close(); }

function renderStep() {
  const body = document.getElementById('bi-body');
  if (!body) return;
  // Update step indicator
  document.querySelectorAll('.bi-step').forEach(el => {
    el.classList.toggle('is-active', parseInt(el.dataset.s, 10) === biState.step);
    el.classList.toggle('is-done', parseInt(el.dataset.s, 10) < biState.step);
  });
  if (biState.step === 1) body.innerHTML = step1Html();
  if (biState.step === 2) body.innerHTML = step2Html();
  if (biState.step === 3) body.innerHTML = step3Html();
  wireStep();
}

/* ----- Step 1: paste or upload ----- */

function step1Html() {
  return `
    <div class="bi-step-body">
      <h3 class="bi-h">Paste your spreadsheet or upload a CSV</h3>
      <p class="bi-sub">Copy rows from Google Sheets or Excel (including the header row), or upload a <code>.csv</code> / <code>.tsv</code> file. Everything stays in your browser.</p>
      <textarea id="bi-paste" class="bi-textarea" placeholder="Vendor,Annual cost,Cycle,Owner,Renewal\nSalesforce,54000,yearly,alex@acme.com,2026-05-14\nZoom,5988,yearly,sam@acme.com,2026-09-30"></textarea>
      <div class="bi-split">
        <label class="bi-upload-btn">
          <input type="file" id="bi-file" accept=".csv,.tsv,.txt" hidden/>
          <span>Or upload file</span>
        </label>
        <button type="button" class="bi-link" id="bi-template">Download template CSV</button>
      </div>
      <div class="bi-foot">
        <span class="bi-hint">We'll auto-detect the columns in the next step.</span>
        <button type="button" class="bi-primary" id="bi-next-1" disabled>Next →</button>
      </div>
    </div>
  `;
}

/* ----- Step 2: column mapping ----- */

function step2Html() {
  const headers = biState.headers;
  const map = biState.mapping;
  const unmapped = FIELDS.filter(f => map[f.key] == null);
  const nameOk = map.name != null;
  const rowsPreview = biState.rows.slice(1, 4);
  return `
    <div class="bi-step-body">
      <h3 class="bi-h">Match your columns to the fields</h3>
      <p class="bi-sub">We auto-detected ${Object.keys(map).length} of ${FIELDS.length} fields. Confirm or adjust. Only <b>Vendor name</b> is required.</p>
      <div class="bi-map-grid">
        ${FIELDS.map(f => `
          <div class="bi-map-row ${f.required ? 'is-required' : ''}">
            <label class="bi-map-label">
              <span class="bi-map-name">${escapeHtml(f.label)}${f.required ? ' *' : ''}</span>
              <span class="bi-map-hint">${escapeHtml(f.hint)}</span>
            </label>
            <select class="bi-map-select" data-field="${f.key}">
              <option value="">— skip —</option>
              ${headers.map((h, i) => `<option value="${i}" ${map[f.key] === i ? 'selected' : ''}>${escapeHtml(h || `Column ${i + 1}`)}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
      <details class="bi-preview-table" open>
        <summary>Preview: first 3 rows from your file</summary>
        <div class="bi-table-wrap">
          <table>
            <thead><tr>${headers.map(h => `<th>${escapeHtml(h || '')}</th>`).join('')}</tr></thead>
            <tbody>${rowsPreview.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c || '')}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </details>
      <div class="bi-foot">
        <button type="button" class="bi-link" id="bi-back-2">← Back</button>
        <button type="button" class="bi-primary" id="bi-next-2" ${nameOk ? '' : 'disabled'}>Next →</button>
      </div>
    </div>
  `;
}

/* ----- Step 3: preview + import ----- */

function buildPreviewRows() {
  const map = biState.mapping;
  const dataRows = biState.rows.slice(1);
  return dataRows.map((r, idx) => {
    const get = (k) => (map[k] != null ? (r[map[k]] || '').trim() : '');
    const name = get('name');
    const sub = {
      _rowIndex: idx + 2,
      name,
      cost: coerceCost(get('cost')),
      cycle: coerceCycle(get('cycle')),
      category: get('category') || '',
      team: get('team') || '',
      ownerEmail: get('owner') || '',
      renewal: coerceDate(get('renewal')),
      licenses: coerceInt(get('licenses')),
      notes: get('notes') || '',
      url: get('url') || '',
    };
    if (!name) sub._issue = 'missing_name';
    const dup = findFuzzyDuplicate(name);
    if (dup) sub._dup = dup;
    return sub;
  });
}

function step3Html() {
  const rows = buildPreviewRows();
  biState._previewRows = rows;
  const total = rows.length;
  const missing = rows.filter(r => r._issue === 'missing_name').length;
  const exact = rows.filter(r => r._dup && r._dup.match === 'exact').length;
  const fuzzy = rows.filter(r => r._dup && r._dup.match === 'fuzzy').length;
  const newCount = rows.filter(r => !r._issue && !r._dup).length;
  return `
    <div class="bi-step-body">
      <h3 class="bi-h">Review and import</h3>
      <div class="bi-summary">
        <div class="bi-stat ok"><b>${newCount}</b><span>New to add</span></div>
        <div class="bi-stat ${fuzzy ? 'warn' : ''}"><b>${fuzzy}</b><span>Possible duplicates</span></div>
        <div class="bi-stat ${exact ? 'skip' : ''}"><b>${exact}</b><span>Exact duplicates (will skip)</span></div>
        <div class="bi-stat ${missing ? 'bad' : ''}"><b>${missing}</b><span>Missing name (will skip)</span></div>
      </div>
      <div class="bi-dup-controls" ${fuzzy ? '' : 'hidden'}>
        <label><input type="radio" name="bi-dup" value="skip" checked/> Skip possible duplicates</label>
        <label><input type="radio" name="bi-dup" value="add"/> Add anyway (I'll clean up later)</label>
      </div>
      <div class="bi-preview-rows">
        ${rows.slice(0, 50).map(r => {
          let status = 'new', label = 'New';
          if (r._issue === 'missing_name') { status = 'bad'; label = 'No name — skip'; }
          else if (r._dup && r._dup.match === 'exact') { status = 'skip'; label = `Exact dupe: ${escapeHtml(r._dup.sub.name)}`; }
          else if (r._dup && r._dup.match === 'fuzzy') { status = 'warn'; label = `Possible dupe: ${escapeHtml(r._dup.sub.name)}`; }
          return `
            <div class="bi-prow bi-prow-${status}">
              <span class="bi-prow-name">${escapeHtml(r.name || '(no name)')}</span>
              <span class="bi-prow-meta">${r.cost != null ? '$' + r.cost.toLocaleString() : '—'} · ${escapeHtml(r.cycle)} ${r.renewal ? ' · renews ' + escapeHtml(r.renewal) : ''}</span>
              <span class="bi-prow-tag bi-prow-tag-${status}">${label}</span>
            </div>
          `;
        }).join('')}
        ${rows.length > 50 ? `<div class="bi-prow-more">... and ${rows.length - 50} more</div>` : ''}
      </div>
      <div class="bi-foot">
        <button type="button" class="bi-link" id="bi-back-3">← Back</button>
        <button type="button" class="bi-primary" id="bi-import">Import ${newCount + (fuzzy || 0)} row${(newCount + fuzzy) === 1 ? '' : 's'}</button>
      </div>
    </div>
  `;
}

/* ----- Wiring per step ----- */

function wireStep() {
  const body = document.getElementById('bi-body');
  if (!body) return;

  if (biState.step === 1) {
    const paste = body.querySelector('#bi-paste');
    const file = body.querySelector('#bi-file');
    const next = body.querySelector('#bi-next-1');
    const tpl = body.querySelector('#bi-template');
    const refreshNextEnabled = () => { next.disabled = !(paste.value.trim() || biState.rows.length); };
    paste.oninput = refreshNextEnabled;
    paste.onpaste = () => setTimeout(refreshNextEnabled, 30);
    file.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const text = await f.text();
      paste.value = text;
      refreshNextEnabled();
    };
    tpl.onclick = downloadTemplate;
    next.onclick = () => {
      const text = paste.value.trim();
      if (!text) return;
      try {
        const rows = parseCSV(text);
        if (!rows.length) { alert('Could not parse any rows.'); return; }
        biState.rows = rows;
        biState.headers = rows[0].map(h => (h || '').trim());
        biState.mapping = autoMap(biState.headers);
        biState.step = 2;
        renderStep();
      } catch (err) {
        alert('Parse failed: ' + err.message);
      }
    };
  }

  if (biState.step === 2) {
    body.querySelectorAll('.bi-map-select').forEach(sel => {
      sel.onchange = (e) => {
        const key = e.target.dataset.field;
        const val = e.target.value;
        if (val === '') delete biState.mapping[key];
        else biState.mapping[key] = parseInt(val, 10);
        // Recompute "next" enabled state
        const nameOk = biState.mapping.name != null;
        body.querySelector('#bi-next-2').disabled = !nameOk;
      };
    });
    body.querySelector('#bi-back-2').onclick = () => { biState.step = 1; renderStep(); };
    body.querySelector('#bi-next-2').onclick = () => {
      if (biState.mapping.name == null) return;
      biState.step = 3;
      renderStep();
    };
  }

  if (biState.step === 3) {
    body.querySelector('#bi-back-3').onclick = () => { biState.step = 2; renderStep(); };
    body.querySelector('#bi-import').onclick = commitImport;
  }
}

/* ----- Commit ----- */

function commitImport() {
  const rows = biState._previewRows || buildPreviewRows();
  const dupPolicy = (document.querySelector('input[name="bi-dup"]:checked') || {}).value || 'skip';

  let added = 0, skipped = 0, dupes = 0;
  const today = new Date().toISOString();

  rows.forEach(r => {
    if (r._issue === 'missing_name') { skipped++; return; }
    if (r._dup && r._dup.match === 'exact') { dupes++; return; }
    if (r._dup && r._dup.match === 'fuzzy' && dupPolicy === 'skip') { dupes++; return; }

    const sub = {
      id: crypto.randomUUID(),
      name: r.name,
      cost: r.cost != null ? r.cost : 0,
      cycle: r.cycle,
      category: r.category,
      team: r.team,
      renewal: r.renewal,
      notes: r.notes,
      url: r.url,
      active: true,
      licenses: r.licenses || null,
      assigned: null,
      utilized: null,
      ownerEmail: r.ownerEmail || null,
      importedAt: today,
      importedVia: 'bulk_csv',
    };
    state.subscriptions.push(sub);
    added++;
  });

  if (typeof save === 'function') save();
  if (typeof renderAll === 'function') try { renderAll(); } catch (_) {}

  // Fire onboarding events + auto-tick checklist
  try {
    if (typeof postOnboardingEvent === 'function') {
      postOnboardingEvent('bulk_import_completed', { added, dupes, skipped, total: rows.length });
    }
    if (window.OnboardHelp) {
      // trigger a tick so the checklist re-evaluates "add_vendor" and "upload_contract"
      setTimeout(() => { try { renderAll && renderAll(); } catch (_) {} }, 100);
    }
  } catch (_) {}

  close();

  // Navigate to subscriptions so the user sees what landed
  try { if (typeof switchView === 'function') switchView('subscriptions'); } catch (_) {}

  toast(`Imported ${added} subscription${added === 1 ? '' : 's'}${dupes ? ` · skipped ${dupes} duplicate${dupes === 1 ? '' : 's'}` : ''}${skipped ? ` · skipped ${skipped} invalid` : ''}`);
}

/* ---------------- Template CSV download ---------------- */

function downloadTemplate() {
  const header = ['Vendor', 'Annual cost', 'Cycle', 'Category', 'Team', 'Owner email', 'Renewal date', 'Licences', 'Notes', 'URL'];
  const sample = [
    ['Salesforce', '54000', 'yearly', 'CRM',       'Sales',       'alex@acme.com', '2026-05-14', '45',  'Enterprise, 7% uplift cap', 'https://salesforce.com'],
    ['Zoom',       '5988',  'yearly', 'Meetings',  'Sales',       'sam@acme.com',  '2026-09-30', '60',  'Webinar add-on',            'https://zoom.us'],
    ['Figma',      '2700',  'monthly','Design',    'Design',      'ria@acme.com',  '2026-04-01', '36',  'Org plan',                  'https://figma.com'],
  ];
  const csv = [header, ...sample].map(r => r.map(c => {
    const s = String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'saas-spend-track-template.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- Toast ---------------- */

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'bi-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('bi-toast-out'); setTimeout(() => t.remove(), 400); }, 3800);
}

/* ---------------- Bridge to Onboarding telemetry ---------------- */

function postOnboardingEvent(eventType, extra = {}) {
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

/* ---------------- Inject "Bulk import" button into the Subscriptions view ---------------- */

function injectImportButton() {
  // Look for the subscriptions view container; place button at top.
  const view = document.querySelector('.view[data-view="subscriptions"], #view-subscriptions, [data-view="subscriptions"]');
  if (!view) return;
  if (view.querySelector('.bi-launch')) return;
  // Place at the start of the view so it's visible immediately.
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bi-launch';
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Bulk import</span>`;
  btn.onclick = open;
  // Find a sensible anchor — a heading, a toolbar, otherwise prepend to view.
  const anchor = view.querySelector('h1, h2, .view-head, .toolbar');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling);
  else view.prepend(btn);
}

/* ---------------- Boot ---------------- */

window.BulkImport = { open, close, parseCSV, autoMap };

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(injectImportButton, 500);
});

// Re-inject after view switches (DOM may rebuild)
const _prevSwitch23 = typeof switchView === 'function' ? switchView : null;
if (_prevSwitch23 && !_prevSwitch23._bi23) {
  window.switchView = function (name, opts) {
    const r = _prevSwitch23.apply(this, arguments);
    if (name === 'subscriptions') setTimeout(injectImportButton, 100);
    return r;
  };
  window.switchView._bi23 = true;
}

const _prevAll23 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll23) {
  window.renderAll = function () {
    _prevAll23.apply(this, arguments);
    try { injectImportButton(); } catch (_) {}
  };
}

})();
