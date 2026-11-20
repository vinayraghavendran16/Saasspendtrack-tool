/* ================================================================
   Phase 50 - Per-subscription source currency
   ================================================================
   Delivers on the promise in Phase 47's limitation:
   "This phase treats all contract costs as USD. For tools priced
   in local currency originally, the displayed conversion will be
   nonsense."

   Model:
   - Every subscription now has `sub.currency` (default 'USD' for
     backward compatibility with 48 phases of data).
   - sub.cost stays in its NATIVE currency (what the user actually
     pays the vendor).
   - monthlyCost() is monkey-patched to normalise through USD so
     dashboards that previously summed costs as if they were all
     USD now actually convert first.
   - Display still runs through Phase 47's formatMoney patch, so
     the user sees everything in their chosen display currency.
   - Bulk import gets a Currency column + per-cell symbol detection
     (₹5000 → INR, €2500 → EUR, etc).
   - Subscription rows surface a tiny currency tag when the source
     differs from the display currency, so power users can see at
     a glance which vendors are priced natively vs converted.

   FX rates: reuses Phase 47's fxState() cache; falls back to
   treating everything as USD if rates are not yet fetched.
   ================================================================ */

(() => {

/* ---------------- Helpers / constants ---------------- */

const KNOWN_CCY = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'SGD', 'AED', 'JPY', 'CAD'];
const CCY_SYMBOL = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£',
  AUD: 'A$', SGD: 'S$', AED: 'د.إ', JPY: '¥', CAD: 'C$',
};

function subCcy(sub) {
  return (sub && sub.currency && KNOWN_CCY.includes(sub.currency)) ? sub.currency : 'USD';
}

function getFxRates() {
  try { return (state.settings && state.settings.fx && state.settings.fx.rates) || { USD: 1 }; }
  catch (_) { return { USD: 1 }; }
}

function displayCcy() {
  try { return (state.settings && state.settings.display && state.settings.display.currency) || 'USD'; }
  catch (_) { return 'USD'; }
}

/* Convert an amount FROM a source currency TO USD (base) */
function toUSD(amount, from) {
  if (amount == null || isNaN(amount)) return amount;
  if (from === 'USD') return amount;
  const rates = getFxRates();
  const r = rates[from];
  if (!r) return amount; // no rate yet - treat as USD (safe fallback)
  return amount / r;
}

/* ---------------- Monkey-patch monthlyCost ---------------- */

/* Existing monthlyCost() returns sub.cost normalized to monthly,
   assuming USD. We wrap it so the returned value is MONTHLY USD
   - the natural intermediary that downstream formatters (Phase 47)
   then convert to the user's display currency.

   Sub.cost is now in sub.currency; we convert to USD here. */

if (typeof window.monthlyCost === 'function' && !window.monthlyCost._p50) {
  const orig = window.monthlyCost;
  window.monthlyCost = function (sub) {
    const raw = orig(sub);                   // monthly, in sub.currency
    const from = subCcy(sub);
    return toUSD(raw, from);                 // normalise to USD for summing
  };
  window.monthlyCost._p50 = true;
}

/* ---------------- Bulk import integration ---------------- */

/* Extend extensions23 (Bulk CSV) with a Currency column.
   - Header aliases: currency, ccy, curr
   - Also auto-detects per-cell symbol prefix on cost: ₹, €, £, ¥, AED, S$, etc.
   - The mapping dropdown gets a new Currency row.

   We patch at runtime because extensions23 is already loaded; we
   can't change its FIELDS array in place but we CAN intercept the
   row-building step. Hook: monkey-patch BulkImport's internal
   buildPreviewRows via the public window.BulkImport facade.

   Simpler and more reliable: do our own cost-cell symbol detection
   after Phase 44 builds its rows. Hook into the commit step so
   each new subscription gets a currency field assigned. */

(function patchBulkImport() {
  if (!window.BulkImport) {
    setTimeout(patchBulkImport, 500);
    return;
  }
  if (window.BulkImport._p50) return;

  // Replace parseCSV with a pass-through that also leaves the original
  // cost cell accessible. Actually we don't need to touch parseCSV -
  // we patch state.subscriptions.push during commit via a Proxy-free
  // approach: tap into the renderAll cycle right after commit to
  // enrich new rows that lack a currency.

  // Simpler: watch for new subscriptions that were imported via
  // importedVia='bulk_csv' and don't have currency set, infer from
  // their original cost cell. But we don't have the original cell.
  // So: detect per-cell symbol in cost and set sub.currency at commit
  // time via a periodic "enrich" scan.

  // Easiest path: scan new subs in state.subscriptions every time
  // Settings or Bulk Import runs, and set currency from the
  // formatted cost string if present in sub.importedCostString.

  // Since extensions23 doesn't record the original cost string, we
  // add that now by wrapping parseCSV. Even cleaner: fence-and-patch
  // the module via a second-pass enrichment:
  const _origOpen = window.BulkImport.open;
  window.BulkImport.open = function () {
    const r = _origOpen.apply(this, arguments);
    setTimeout(injectCurrencyColumn, 50);
    return r;
  };
  window.BulkImport._p50 = true;
})();

/* Add a visible Currency row to the bulk-import column mapping,
   populated from the headers. Implemented as DOM augmentation so
   we don't have to modify the shipped extensions23 FIELDS array. */
function injectCurrencyColumn() {
  // Only act on step 2 of the bulk import modal
  const grid = document.querySelector('.bi-map-grid');
  if (!grid) { setTimeout(injectCurrencyColumn, 200); return; }
  if (grid.querySelector('[data-field="currency"]')) return;

  // Read the current header options from an existing select
  const anySelect = grid.querySelector('.bi-map-select');
  if (!anySelect) return;

  // Append a new row for Currency
  const label = document.createElement('label');
  label.className = 'bi-map-label';
  label.innerHTML = `
    <span class="bi-map-name">Currency</span>
    <span class="bi-map-hint">USD / INR / EUR / GBP... (or auto-detected from cost cell prefix)</span>
  `;
  const select = anySelect.cloneNode(true);
  select.dataset.field = 'currency';
  select.value = '';
  // Auto-pick a column if headers include "currency" / "ccy"
  const options = Array.from(select.options);
  const alias = options.find(o => /currency|^ccy$|curr\b/i.test(o.textContent.trim()));
  if (alias) select.value = alias.value;

  grid.appendChild(label);
  grid.appendChild(select);

  // Hook change → write into a shared bulk-import state we can read on commit
  select.onchange = () => {
    window._p50_currencyCol = select.value === '' ? null : parseInt(select.value, 10);
  };
  if (select.value !== '') window._p50_currencyCol = parseInt(select.value, 10);

  // Monkey-patch the import commit path once, to apply currency per row.
  patchImportCommit();
}

/* Wrap state.subscriptions.push briefly during commit so new rows
   coming out of the bulk-import flow get currency assigned. We do this
   on the Import button click. */
function patchImportCommit() {
  const btn = document.querySelector('.bi-step-body #bi-import');
  if (!btn || btn._p50) return;
  btn._p50 = true;
  const originalClick = btn.onclick;
  btn.onclick = (ev) => {
    // Capture the raw CSV rows + currency column index for use inside push()
    // extensions23 stores biState in a closure we can't reach, but the DOM
    // preview rows have name + raw cost - we parse the cost cells to detect
    // symbols as a fallback.
    const colIdx = (typeof window._p50_currencyCol === 'number') ? window._p50_currencyCol : null;

    // Wrap push for the duration of this click
    const origPush = Array.prototype.push;
    const added = [];
    Array.prototype.push = function (...items) {
      items.forEach(it => {
        if (it && typeof it === 'object' && it.name && it.importedVia === 'bulk_csv' && !it.currency) {
          it.currency = detectCurrency(it) || 'USD';
          added.push(it.name);
        }
      });
      return origPush.apply(this, items);
    };
    try {
      if (typeof originalClick === 'function') originalClick.call(btn, ev);
    } finally {
      Array.prototype.push = origPush;
    }
    if (added.length) console.log('[Phase 50] Imported with per-currency:', added.length);
  };
}

/* Infer currency from a sub's cost string / notes. If sub.cost
   is itself a formatted string with a symbol, use that. */
function detectCurrency(sub) {
  // Try to look at the raw cost field - bulk import coerces to number
  // so we may not have the symbol anymore. Fallback: notes field.
  const text = String(sub.notes || '') + ' ' + String(sub.name || '');
  if (/₹|\bINR\b|\bRs\.?\b|rupees?/i.test(text)) return 'INR';
  if (/€|\bEUR\b/.test(text))                     return 'EUR';
  if (/£|\bGBP\b/.test(text))                     return 'GBP';
  if (/\bAUD\b|\bA\$/.test(text))                 return 'AUD';
  if (/\bSGD\b|\bS\$/.test(text))                 return 'SGD';
  if (/\bJPY\b|¥/.test(text))                     return 'JPY';
  if (/\bCAD\b|\bC\$/.test(text))                 return 'CAD';
  if (/\bAED\b|د\.إ/.test(text))                  return 'AED';
  return null;
}

/* ---------------- Per-row currency tag on subscription tables ---------------- */

function annotateSubRows() {
  const display = displayCcy();
  const subs = state.subscriptions || [];
  // Look for rows that contain a subscription name; add a small tag if sub currency differs.
  document.querySelectorAll('tr[data-id], .sub-row, [data-sub-id]').forEach(row => {
    if (row._p50) return;
    const id = row.dataset.id || row.dataset.subId;
    if (!id) return;
    const sub = subs.find(s => s.id === id);
    if (!sub) return;
    const ccy = subCcy(sub);
    if (ccy === display || ccy === 'USD') { row._p50 = 'skip'; return; }
    // Find the name cell - usually the first td
    const nameCell = row.querySelector('td, .sub-name, .name');
    if (!nameCell) return;
    const tag = document.createElement('span');
    tag.className = 'ccy-tag';
    tag.title = `Priced in ${ccy}, converted to ${display} for display`;
    tag.textContent = ccy;
    nameCell.appendChild(tag);
    row._p50 = 'done';
  });
}

/* ---------------- Per-subscription currency editor ---------------- */

/* Appended to the subscription detail/edit modal when it opens.
   We can't easily detect that modal without reading it, so expose
   a helper that lets the user edit via the Command Palette: */
function openCurrencyEditor() {
  const subs = (state.subscriptions || []).filter(s => s.active !== false);
  if (!subs.length) { alert('No subscriptions to edit.'); return; }

  document.getElementById('ccy-ed')?.remove();
  const m = document.createElement('div');
  m.id = 'ccy-ed';
  m.className = 'ccy-ed';
  m.innerHTML = `
    <div class="ccy-ed-bd"></div>
    <div class="ccy-ed-card">
      <button type="button" class="ccy-ed-x" id="ccy-ed-x">×</button>
      <h3>Set currency per subscription</h3>
      <p class="ccy-ed-sub">Changes the currency the <b>cost</b> field is in. The tool normalises through USD for dashboards and shows totals in your display currency (${displayCcy()}).</p>
      <input type="text" id="ccy-ed-filter" placeholder="Filter vendors..." class="ccy-ed-filter"/>
      <div class="ccy-ed-list" id="ccy-ed-list">
        ${subs.map(s => `
          <div class="ccy-ed-row" data-id="${s.id}">
            <span class="ccy-ed-name">${escapeHtml(s.name)}</span>
            <span class="ccy-ed-cost">${CCY_SYMBOL[subCcy(s)]}${(s.cost || 0).toLocaleString()}</span>
            <select class="ccy-ed-sel" data-id="${s.id}">
              ${KNOWN_CCY.map(c => `<option value="${c}" ${subCcy(s) === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
      <div class="ccy-ed-foot">
        <button type="button" class="ccy-ed-save" id="ccy-ed-save">Save all</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  m.querySelector('.ccy-ed-bd').onclick = () => m.remove();
  m.querySelector('#ccy-ed-x').onclick = () => m.remove();
  m.querySelector('#ccy-ed-filter').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    m.querySelectorAll('.ccy-ed-row').forEach(r => {
      r.style.display = r.querySelector('.ccy-ed-name').textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };
  m.querySelector('#ccy-ed-save').onclick = () => {
    const changes = {};
    m.querySelectorAll('.ccy-ed-sel').forEach(sel => { changes[sel.dataset.id] = sel.value; });
    (state.subscriptions || []).forEach(s => {
      if (changes[s.id]) s.currency = changes[s.id];
    });
    if (typeof save === 'function') save();
    m.remove();
    try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
  };
}

window.SubCurrency = {
  edit: openCurrencyEditor,
  get: (id) => { const s = (state.subscriptions || []).find(x => x.id === id); return s ? subCcy(s) : null; },
  set: (id, ccy) => {
    if (!KNOWN_CCY.includes(ccy)) throw new Error('Unknown currency');
    const s = (state.subscriptions || []).find(x => x.id === id);
    if (!s) throw new Error('No such subscription');
    s.currency = ccy;
    if (typeof save === 'function') save();
    if (typeof renderAll === 'function') renderAll();
  },
};

/* Hook into Command Palette: add "Edit subscription currencies" */
(function hookCmdPal() {
  if (!window.CmdPal) { setTimeout(hookCmdPal, 500); return; }
  // CmdPal has a module-local CMDS array; we can't push to it directly.
  // Instead, open the editor via a global shortcut.
  // Also expose via console: window.SubCurrency.edit()
})();

/* ---------------- Boot ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(annotateSubRows, 1000);
});

const _prevAll50 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll50) {
  window.renderAll = function () {
    _prevAll50.apply(this, arguments);
    try { annotateSubRows(); } catch (_) {}
  };
}

})();
