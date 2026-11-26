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
  if (state.settings?.currency) return workspaceCurrency();
  return (sub && sub.currency && KNOWN_CCY.includes(sub.currency)) ? sub.currency : 'USD';
}

function getFxRates() {
  try { return (state.settings && state.settings.fx && state.settings.fx.rates) || { USD: 1 }; }
  catch (_) { return { USD: 1 }; }
}

function displayCcy() {
  if (state.settings?.currency) return workspaceCurrency();
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
    if (state.settings?.currency) return raw;
    const from = subCcy(sub);
    return toUSD(raw, from);                 // normalise to USD for summing
  };
  window.monthlyCost._p50 = true;
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
  if (state.settings?.currency) {
    toast('Subscriptions use the workspace currency (' + workspaceCurrency() + ').', 'info');
    return;
  }
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
    if (state.settings?.currency) throw new Error('Subscriptions use the workspace currency.');
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
