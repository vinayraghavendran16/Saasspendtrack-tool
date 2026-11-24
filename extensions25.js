/* ================================================================
   Phase 47 - Settings view + multi-currency display
   ================================================================
   Adds:
   - Settings sidebar tab (last position)
   - Workspace name editor
   - Default display currency (USD / INR / EUR / GBP / AUD / SGD /
     AED / JPY / CAD) with live FX via frankfurter.app
   - Data export (download full workspace as JSON)
   - "Clear my data" (nuclear reset with confirm)
   - Trial-reset helper (for your distributor demos)

   Multi-currency works by MONKEY-PATCHING the global formatMoney()
   so every existing view picks up conversion automatically - no
   refactor of 120+ formatMoney call sites needed.

   FX rates fetched from frankfurter.app (free, no API key,
   business-daily rates), cached in localStorage for 24h.

   Contract costs are stored as the user entered them (base
   currency = USD assumed, since the tool was USD-only for 46
   phases). If a user switches display to INR, the displayed
   numbers are USD × rate. Future phase can add per-contract
   source currency; this phase gets the display right first.
   ================================================================ */

(() => {

/* ---------------- Supported currencies ---------------- */

const CURRENCIES = [
  { code: 'USD', symbol: '$',   label: 'US Dollar',           locale: 'en-US' },
  { code: 'INR', symbol: '₹',   label: 'Indian Rupee',        locale: 'en-IN' },
  { code: 'EUR', symbol: '€',   label: 'Euro',                locale: 'de-DE' },
  { code: 'GBP', symbol: '£',   label: 'British Pound',       locale: 'en-GB' },
  { code: 'AUD', symbol: 'A$',  label: 'Australian Dollar',   locale: 'en-AU' },
  { code: 'SGD', symbol: 'S$',  label: 'Singapore Dollar',    locale: 'en-SG' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham',          locale: 'ar-AE' },
  { code: 'JPY', symbol: '¥',   label: 'Japanese Yen',        locale: 'ja-JP' },
  { code: 'CAD', symbol: 'C$',  label: 'Canadian Dollar',     locale: 'en-CA' },
];

function currencyDef(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

/* ---------------- Settings state ---------------- */

function ss() {
  state.settings = state.settings || {};
  state.settings.display = state.settings.display || {};
  // Defaults
  if (!state.settings.display.currency) state.settings.display.currency = 'USD';
  return state.settings.display;
}

function fxState() {
  state.settings = state.settings || {};
  state.settings.fx = state.settings.fx || { rates: { USD: 1 }, fetchedAt: null };
  return state.settings.fx;
}

/* ---------------- FX fetch + cache ---------------- */

const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FX_BASE = 'USD';

async function refreshFx(force = false) {
  const fx = fxState();
  const now = Date.now();
  if (!force && fx.fetchedAt && (now - fx.fetchedAt) < FX_CACHE_TTL_MS && Object.keys(fx.rates).length > 2) {
    return fx.rates;
  }
  try {
    const symbols = CURRENCIES.map(c => c.code).filter(c => c !== FX_BASE).join(',');
    const url = `https://api.frankfurter.app/latest?from=${FX_BASE}&to=${symbols}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('fx http ' + res.status);
    const data = await res.json();
    if (!data || !data.rates) throw new Error('fx bad response');
    fx.rates = { USD: 1, ...data.rates };
    fx.fetchedAt = now;
    if (typeof save === 'function') save();
  } catch (e) {
    console.warn('FX refresh failed; keeping stale rates', e);
  }
  return fx.rates;
}

function convert(amountUSD, toCode) {
  if (amountUSD == null || isNaN(amountUSD)) return amountUSD;
  if (toCode === 'USD') return amountUSD;
  const rates = fxState().rates || {};
  const rate = rates[toCode];
  if (!rate) return amountUSD; // Fallback: show USD if we don't have the rate yet
  return amountUSD * rate;
}

/* ---------------- Formatter monkey-patch ---------------- */

/* Capture the originals so we can delegate for the USD case and
   so our patch is idempotent if the module reloads. */
let origFormatMoney = null;
let origFormatMoneyShort = null;

function patchFormatters() {
  if (window.formatMoney && !window.formatMoney._p47) {
    origFormatMoney = window.formatMoney;
    window.formatMoney = function (n) {
      const code = ss().currency || 'USD';
      if (state.settings?.currency || code === 'USD') return origFormatMoney(n);
      const converted = convert(n, code);
      const def = currencyDef(code);
      if (converted == null || isNaN(converted)) return def.symbol + '-';
      const formatted = Math.abs(converted) < 1
        ? converted.toLocaleString(def.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : Math.round(converted).toLocaleString(def.locale);
      return def.symbol + formatted;
    };
    window.formatMoney._p47 = true;
  }
  if (window.formatMoneyShort && !window.formatMoneyShort._p47) {
    origFormatMoneyShort = window.formatMoneyShort;
    window.formatMoneyShort = function (n) {
      const code = ss().currency || 'USD';
      if (state.settings?.currency || code === 'USD') return origFormatMoneyShort(n);
      const converted = convert(n, code);
      const def = currencyDef(code);
      if (converted == null || isNaN(converted)) return def.symbol + '-';
      if (Math.abs(converted) >= 1000000) return def.symbol + (converted / 1000000).toFixed(1) + 'M';
      if (Math.abs(converted) >= 1000)    return def.symbol + (converted / 1000).toFixed(1) + 'k';
      return def.symbol + Math.round(converted);
    };
    window.formatMoneyShort._p47 = true;
  }
}

/* ---------------- UI: Settings view ---------------- */

function renderSettingsView(host) {
  const s = ss();
  const fx = fxState();
  const def = currencyDef(s.currency);
  const fxAgeHours = fx.fetchedAt ? Math.round((Date.now() - fx.fetchedAt) / (1000 * 60 * 60)) : null;
  let w = {};
  try { w = workspace(); } catch (_) {}

  host.innerHTML = `
    <div class="view-head">
      <h1>Settings</h1>
      <p class="muted">Workspace preferences. Everything stays in this browser.</p>
    </div>

    <div class="st-grid">

      <section class="st-card">
        <h3>Workspace</h3>
        <label class="st-field">
          <span>Company name</span>
          <input type="text" id="st-ws-name" value="${escapeHtml(w.companyName || w.name || '')}" placeholder="Acme Corp"/>
        </label>
        <label class="st-field">
          <span>Owner email</span>
          <input type="email" id="st-ws-email" value="${escapeHtml(w.ownerEmail || '')}" placeholder="you@acme.com"/>
        </label>
        <button type="button" class="st-save" id="st-save-ws">Save workspace</button>
      </section>

      <section class="st-card">
        <h3>Display currency</h3>
        <p class="st-note">All $ amounts shown in the tool convert to this currency at live FX rates. The underlying contract data is unchanged.</p>
        <label class="st-field">
          <span>Currency</span>
          <select id="st-currency">
            ${CURRENCIES.map(c => `<option value="${c.code}" ${s.currency === c.code ? 'selected' : ''}>${c.code} · ${c.label}</option>`).join('')}
          </select>
        </label>
        <div class="st-fx-status">
          ${fxAgeHours != null
            ? `Rates last refreshed ${fxAgeHours === 0 ? 'just now' : fxAgeHours + 'h ago'} · base USD · source frankfurter.app`
            : `Rates not loaded yet · <button type="button" class="st-link" id="st-fx-fetch">Fetch now</button>`}
        </div>
        <div class="st-fx-rates" id="st-fx-rates">
          ${Object.entries(fx.rates || {}).map(([k, v]) =>
            k !== 'USD' ? `<span><b>${k}</b> ${(+v).toFixed(2)}</span>` : ''
          ).join('')}
        </div>
      </section>

      <section class="st-card">
        <h3>Data</h3>
        <p class="st-note">Download your entire workspace as JSON for backup, team handoff, or migration. Nothing ever leaves this device unless you download it.</p>
        <div class="st-row">
          <button type="button" class="st-btn" id="st-export-json">Download workspace (.json)</button>
          <button type="button" class="st-btn" id="st-import-json">Restore from .json</button>
          <input type="file" id="st-import-file" accept=".json" hidden/>
        </div>
      </section>

      <section class="st-card">
        <h3>Trial controls</h3>
        <p class="st-note">For demos and QA. Resets or extends your trial window locally.</p>
        <div class="st-row">
          <button type="button" class="st-btn" id="st-trial-extend">Extend trial by 14 days</button>
          <button type="button" class="st-btn" id="st-trial-reset">Reset trial to day 1</button>
        </div>
      </section>

      <section class="st-card is-danger">
        <h3>Danger zone</h3>
        <p class="st-note">Permanently delete everything in this browser. Contracts, vendors, onboarding progress, FX cache. Cannot be undone unless you have a .json backup.</p>
        <button type="button" class="st-btn st-btn-danger" id="st-wipe">Clear everything</button>
      </section>

    </div>
  `;

  // --- Workspace save ---
  host.querySelector('#st-save-ws').onclick = () => {
    try {
      const w = workspace();
      w.companyName = host.querySelector('#st-ws-name').value.trim();
      w.ownerEmail = host.querySelector('#st-ws-email').value.trim();
      if (typeof save === 'function') save();
      toast('Workspace saved');
    } catch (e) { alert('Save failed: ' + e.message); }
  };

  // --- Currency change ---
  host.querySelector('#st-currency').onchange = async (e) => {
    const code = e.target.value;
    s.currency = code;
    if (typeof save === 'function') save();
    if (code !== 'USD' && (!fx.rates[code] || !fx.fetchedAt)) {
      toast('Fetching latest rates...');
      await refreshFx(true);
    }
    toast('Display currency set to ' + code);
    try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
    try { switchView('settings'); } catch (_) {}
  };

  // Manual FX fetch button (only shown when rates not yet loaded)
  const fxBtn = host.querySelector('#st-fx-fetch');
  if (fxBtn) fxBtn.onclick = async () => { await refreshFx(true); switchView('settings'); };

  // --- Data export / import ---
  host.querySelector('#st-export-json').onclick = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const name = `saasspendtrack-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    if (typeof window.downloadFile === 'function') { try { window.downloadFile(name, blob); toast('Workspace exported'); return; } catch (_) {} }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Workspace exported');
  };
  host.querySelector('#st-import-json').onclick = () => host.querySelector('#st-import-file').click();
  host.querySelector('#st-import-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm('Restore will OVERWRITE your current workspace. Continue?')) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (typeof data !== 'object' || !data) throw new Error('Not a workspace file');
      Object.assign(state, data);
      if (typeof save === 'function') save();
      toast('Workspace restored. Reloading.');
      setTimeout(() => location.reload(), 900);
    } catch (err) { alert('Restore failed: ' + err.message); }
  };

  // --- Trial controls ---
  host.querySelector('#st-trial-extend').onclick = () => {
    try {
      const w = workspace();
      const start = new Date(w.trialStartedAt || Date.now());
      start.setDate(start.getDate() - 14);
      w.trialStartedAt = start.toISOString();
      if (typeof save === 'function') save();
      toast('Trial extended by 14 days');
      renderSettingsView(host);
    } catch (e) { alert(e.message); }
  };
  host.querySelector('#st-trial-reset').onclick = () => {
    try {
      const w = workspace();
      w.trialStartedAt = new Date().toISOString();
      w.plan = 'trial';
      if (typeof save === 'function') save();
      toast('Trial reset to day 1');
      renderSettingsView(host);
    } catch (e) { alert(e.message); }
  };

  // --- Danger: wipe ---
  host.querySelector('#st-wipe').onclick = () => {
    const confirm1 = prompt('Type DELETE in capitals to wipe this workspace:');
    if (confirm1 !== 'DELETE') { toast('Cancelled'); return; }
    try {
      localStorage.clear();
      sessionStorage.clear();
      // Delete any IndexedDB too
      if (indexedDB && indexedDB.databases) {
        indexedDB.databases().then(dbs => dbs.forEach(d => indexedDB.deleteDatabase(d.name)));
      }
      toast('Workspace wiped. Reloading in 2s.');
      setTimeout(() => location.reload(), 2000);
    } catch (e) { alert(e.message); }
  };
}

function toast(msg) {
  const existing = document.querySelector('.st-toast'); if (existing) existing.remove();
  const t = document.createElement('div'); t.className = 'st-toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
}

/* ---------------- Nav tab + view wiring ---------------- */

function injectSettingsTab() {
  if (document.querySelector('.tab[data-view="settings"]')) return;
  const nav = document.querySelector('.app-nav, nav.sidebar, nav');
  if (!nav) return;
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.type = 'button'; btn.dataset.view = 'settings';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
    <span>Settings</span>
  `;
  btn.addEventListener('click', () => { try { switchView('settings'); } catch (_) {} });
  nav.appendChild(btn);
}

function ensureSettingsContainer() {
  let host = document.querySelector('.view[data-view="settings"]');
  if (host) return host;
  host = document.createElement('div');
  host.className = 'view'; host.setAttribute('data-view', 'settings'); host.hidden = true;
  const main = document.querySelector('main, .main, .app-main, .views-container') || document.body;
  main.appendChild(host);
  return host;
}

function wire() {
  injectSettingsTab();
  ensureSettingsContainer();
  patchFormatters();

  const prev = window.switchView;
  if (typeof prev !== 'function' || prev._st47) return;
  window.switchView = function (name, opts) {
    const r = prev.apply(this, arguments);
    try {
      if (name === 'settings') {
        const host = ensureSettingsContainer();
        document.querySelectorAll('.view').forEach(v => { v.hidden = (v.getAttribute('data-view') !== 'settings'); });
        host.hidden = false;
        renderSettingsView(host);
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === 'settings'));
      }
    } catch (_) {}
    return r;
  };
  window.switchView._st47 = true;
}

const _prevAll47 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll47) {
  window.renderAll = function () {
    _prevAll47.apply(this, arguments);
    try { injectSettingsTab(); patchFormatters(); } catch (_) {}
  };
}

/* ---------------- Public handle ---------------- */

window.Settings = {
  open: () => { try { switchView('settings'); } catch (_) {} },
  setCurrency: async (code) => {
    if (!CURRENCIES.some(c => c.code === code)) throw new Error('Unknown currency: ' + code);
    ss().currency = code;
    if (typeof save === 'function') save();
    await refreshFx();
    if (typeof renderAll === 'function') renderAll();
  },
  refreshFx,
};

/* ---------------- Boot ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    wire();
    // Prefetch FX rates in the background if user already set a non-USD currency.
    if (ss().currency !== 'USD') refreshFx();
  }, 500);
});

})();
