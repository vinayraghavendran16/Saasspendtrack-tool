/* ==========================================================================
   SaaS Spend Track — Phase 13
   Licence Forecasting — capacity-planning module
   ---------------------------------------------------------------------------
   Projects licence demand per vendor for the next 1 / 2 / 4 quarters based
   on headcount, growth plan, department utilisation and vendor-specific
   seat consumption. Outputs a per-vendor recommendation (add / hold /
   downgrade), a quarter-by-quarter table, portfolio cost impact, and a
   capacity curve chart.

   Model — kept simple and auditable, not a black box:
   demand(q) = ceil(
     activeUsers_today
     × (1 + headcountGrowth)^q
     × (1 + adoptionGrowth)^q
     × bufferFactor
   )
   where
     bufferFactor = 1 + max(0, utilTarget - currentUtil)
     adoptionGrowth per vendor from usage trend (default 2%)
     headcountGrowth from capacity plan (overrideable per department)
   Then recommendation:
     shortfall = max(0, demand - currentSeats)
     surplus   = max(0, currentSeats - demand - cushion)
     cushion   = max(1, round(demand × 0.05))

   Scenario inputs:
     - Org headcount growth % per quarter (global default 5%)
     - Per-department override (table)
     - Target utilisation % (default 85%)
     - Horizon: 1Q / 2Q / 4Q
     - Confidence: low / medium / high (adjusts buffer)

   Capacity planning import:
     paste a 2-column list "Department, Headcount Q+4" and the module
     reconciles against current headcount to derive growth per dept.
   ========================================================================== */

/* ---------------- Settings / defaults ---------------- */
function fcSettings() {
  state.settings.forecast = state.settings.forecast || {
    headcountGrowth: 5,           // % per quarter
    utilTarget: 85,               // target utilisation
    horizon: 4,                   // quarters
    confidence: 'medium',         // low / medium / high
    deptGrowth: {},               // overrides per department
    capacityPlan: {},             // dept -> target headcount at horizon
    adoptionGrowth: 2,            // % per quarter (per-vendor fallback)
  };
  return state.settings.forecast;
}

/* ---------------- Core maths ---------------- */
function _vendorSeats(v) {
  const seats = +v.users || +v.licenses || 0;
  const active = +v.activeUsers || Math.round(seats * ((v.utilizationPct ?? 75) / 100));
  const util = seats ? active / seats : 0;
  return { seats, active, util };
}
function _deptGrowth(dept, s) {
  if (s.deptGrowth && s.deptGrowth[dept] != null) return (+s.deptGrowth[dept]) / 100;
  // derive from capacity plan if set
  if (s.capacityPlan && s.capacityPlan[dept] != null) {
    const current = (state.employees || []).filter(e => e.department === dept).length || 1;
    const target = +s.capacityPlan[dept];
    if (target > 0 && current > 0) {
      const factor = target / current;
      return Math.pow(factor, 1 / Math.max(1, s.horizon || 4)) - 1;
    }
  }
  return (s.headcountGrowth || 0) / 100;
}
function _confidenceBuffer(conf) { return conf === 'high' ? 1.02 : conf === 'low' ? 1.15 : 1.08; }

function forecastVendor(v, horizon, s) {
  const { seats, active, util } = _vendorSeats(v);
  const dG = _deptGrowth(v.department || 'Unassigned', s);
  const aG = (v.adoptionGrowth != null ? +v.adoptionGrowth : s.adoptionGrowth) / 100;
  const uTarget = (s.utilTarget || 85) / 100;
  const buffer = Math.max(1.0, uTarget / Math.max(0.5, util || 1));
  const confBuf = _confidenceBuffer(s.confidence);
  const quarters = [];
  for (let q = 1; q <= horizon; q++) {
    const demand = Math.ceil(active * Math.pow(1 + dG, q) * Math.pow(1 + aG, q) * Math.min(buffer, 1.3) * confBuf);
    quarters.push({ q, demand });
  }
  const terminal = quarters[quarters.length - 1].demand;
  const cushion = Math.max(1, Math.round(terminal * 0.05));
  let rec = 'hold', delta = 0;
  if (terminal > seats) { rec = 'add'; delta = terminal - seats; }
  else if (seats > terminal + cushion) { rec = 'downgrade'; delta = -(seats - terminal); }
  return { v, seats, active, util: Math.round(util * 100), dG: dG * 100, aG: aG * 100, quarters, terminal, cushion, rec, delta };
}

function forecastAll() {
  const s = fcSettings();
  const rows = (state.subscriptions || []).filter(v => v.status !== 'cancelled' && (+v.users || +v.licenses)).map(v => forecastVendor(v, s.horizon || 4, s));
  return rows;
}

/* ---------------- Render ---------------- */
function renderForecast() {
  const host = document.getElementById('fc-body');
  if (!host) return;
  const s = fcSettings();
  const rows = forecastAll();
  const horizons = s.horizon || 4;

  // KPIs
  const totalAdd = rows.filter(r => r.rec === 'add').reduce((a, r) => a + r.delta, 0);
  const totalDown = rows.filter(r => r.rec === 'downgrade').reduce((a, r) => a + Math.abs(r.delta), 0);
  const costImpact = rows.reduce((a, r) => {
    const perSeat = r.seats ? annualCost(r.v) / r.seats : 0;
    return a + perSeat * (r.rec === 'add' ? r.delta : r.rec === 'downgrade' ? r.delta : 0);
  }, 0);
  const addVendors = rows.filter(r => r.rec === 'add').length;
  const downVendors = rows.filter(r => r.rec === 'downgrade').length;

  // Capacity plan tie-in: list departments with growth
  const depts = [...new Set((state.subscriptions || []).map(v => v.department).filter(Boolean))].sort();

  host.innerHTML = `
    <div class="fc-kpis">
      <div class="kpi"><div class="kpi-label">Seats to add (Q+${horizons})</div><div class="kpi-value" style="color:${totalAdd > 0 ? 'var(--accent)' : 'var(--ink)'}">${totalAdd}</div><div class="kpi-sub">across ${addVendors} vendors</div></div>
      <div class="kpi"><div class="kpi-label">Seats to reclaim</div><div class="kpi-value" style="color:${totalDown > 0 ? '#10b981' : 'var(--ink)'}">${totalDown}</div><div class="kpi-sub">across ${downVendors} vendors</div></div>
      <div class="kpi"><div class="kpi-label">Net cost impact</div><div class="kpi-value" style="color:${costImpact > 0 ? '#ef4444' : '#10b981'}">${costImpact >= 0 ? '+' : ''}${formatMoney(costImpact)}</div><div class="kpi-sub">annual run-rate change</div></div>
      <div class="kpi"><div class="kpi-label">Vendors forecast</div><div class="kpi-value">${rows.length}</div><div class="kpi-sub">with seat-based licensing</div></div>
    </div>

    <div class="fc-grid">
      <aside class="fc-controls">
        <h4>Capacity plan</h4>
        <label>Org headcount growth (per quarter)
          <div class="fc-input-row"><input type="number" id="fc-growth" value="${s.headcountGrowth}" min="-20" max="50" step="0.5"/><span class="dim">%</span></div>
        </label>
        <label>Target utilisation
          <div class="fc-input-row"><input type="number" id="fc-util" value="${s.utilTarget}" min="50" max="100" step="1"/><span class="dim">%</span></div>
        </label>
        <label>Horizon
          <select id="fc-horizon">
            <option value="1" ${s.horizon == 1 ? 'selected' : ''}>Next quarter</option>
            <option value="2" ${s.horizon == 2 ? 'selected' : ''}>Next 2 quarters</option>
            <option value="4" ${s.horizon == 4 ? 'selected' : ''}>Next 4 quarters (1 year)</option>
          </select>
        </label>
        <label>Confidence
          <select id="fc-conf">
            <option value="low" ${s.confidence === 'low' ? 'selected' : ''}>Low (more buffer)</option>
            <option value="medium" ${s.confidence === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${s.confidence === 'high' ? 'selected' : ''}>High (lean)</option>
          </select>
        </label>
        <label>Adoption growth default
          <div class="fc-input-row"><input type="number" id="fc-adopt" value="${s.adoptionGrowth}" min="0" max="25" step="0.5"/><span class="dim">% / quarter</span></div>
        </label>

        <h4 style="margin-top:14px">Per-department growth</h4>
        <div class="fc-dept-list">
          ${depts.map(d => {
            const cur = (state.employees || []).filter(e => e.department === d).length;
            const target = s.capacityPlan[d] ?? '';
            const g = s.deptGrowth[d] ?? '';
            return `<div class="fc-dept-row">
              <div><b>${escapeHtml(d)}</b><div class="dim" style="font-size:11px">${cur} today</div></div>
              <input type="number" class="fc-dept-growth" data-dept="${encodeURIComponent(d)}" placeholder="${s.headcountGrowth}" value="${g}" step="0.5" title="Override growth % per quarter"/>
              <input type="number" class="fc-dept-cap" data-dept="${encodeURIComponent(d)}" placeholder="HC target" value="${target}" step="1" title="Target headcount at horizon"/>
            </div>`;
          }).join('')}
        </div>
        <div class="dim" style="font-size:11px;margin-top:8px">Set per-department growth % OR a target headcount — the module derives per-quarter growth from either.</div>

        <div style="display:flex;gap:6px;margin-top:12px">
          <button class="btn-primary" id="fc-apply">Recalculate</button>
          <button class="icon-btn" id="fc-reset">Reset</button>
        </div>
      </aside>

      <div class="fc-main">
        <div class="fc-table-wrap">
          <table class="fc-table">
            <thead><tr>
              <th>Vendor</th><th>Dept</th><th style="text-align:right">Seats today</th><th style="text-align:right">Active</th><th style="text-align:right">Util</th>
              ${Array.from({ length: horizons }, (_, i) => `<th style="text-align:right">Q+${i + 1}</th>`).join('')}
              <th style="text-align:right">Terminal</th><th style="text-align:right">Δ seats</th><th style="text-align:right">$/yr impact</th><th>Recommendation</th>
            </tr></thead>
            <tbody>
              ${rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map(r => {
                const perSeat = r.seats ? annualCost(r.v) / r.seats : 0;
                const impact = perSeat * r.delta;
                return `<tr class="fc-row fc-rec-${r.rec}">
                  <td><b>${escapeHtml(r.v.name)}</b></td>
                  <td class="dim">${escapeHtml(r.v.department || '—')}</td>
                  <td style="text-align:right">${r.seats}</td>
                  <td style="text-align:right">${r.active}</td>
                  <td style="text-align:right ${r.util < 60 ? 'style=\"color:#f59e0b\"' : ''}">${r.util}%</td>
                  ${r.quarters.map(q => `<td style="text-align:right">${q.demand}</td>`).join('')}
                  <td style="text-align:right"><b>${r.terminal}</b></td>
                  <td style="text-align:right;color:${r.delta > 0 ? 'var(--accent)' : r.delta < 0 ? '#10b981' : 'var(--ink-dim)'}">${r.delta > 0 ? '+' : ''}${r.delta}</td>
                  <td style="text-align:right">${impact ? (impact >= 0 ? '+' : '') + formatMoney(impact) : '—'}</td>
                  <td><span class="badge badge-rec-${r.rec}">${r.rec === 'add' ? 'Add seats' : r.rec === 'downgrade' ? 'Reclaim' : 'Hold'}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="fc-chart-wrap">
          <h4>Portfolio seat demand curve</h4>
          ${renderForecastChart(rows, horizons)}
        </div>
      </div>
    </div>
  `;

  wireForecast(host);
}

function renderForecastChart(rows, horizons) {
  // Stacked bars of total seats per quarter vs current
  const totals = [];
  const today = rows.reduce((a, r) => a + r.seats, 0);
  totals.push({ label: 'Today', value: today });
  for (let q = 1; q <= horizons; q++) {
    totals.push({ label: `Q+${q}`, value: rows.reduce((a, r) => a + r.quarters[q - 1].demand, 0) });
  }
  const max = Math.max(...totals.map(t => t.value)) || 1;
  const W = 640, H = 240, pad = 36;
  const bw = (W - pad * 2) / totals.length - 12;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-width:100%">
    ${totals.map((t, i) => {
      const x = pad + i * ((W - pad * 2) / totals.length);
      const h = (t.value / max) * (H - pad * 2);
      const y = H - pad - h;
      const color = i === 0 ? 'var(--ink-dim)' : 'var(--accent)';
      return `
        <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="4" fill="${color}" opacity="${i === 0 ? 0.4 : 0.85}"/>
        <text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="var(--ink)" font-weight="600">${t.value}</text>
        <text x="${x + bw / 2}" y="${H - pad + 16}" text-anchor="middle" font-size="11" fill="var(--ink-dim)">${t.label}</text>
      `;
    }).join('')}
    <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--border)"/>
  </svg>`;
}

function wireForecast(host) {
  const s = fcSettings();
  const apply = () => {
    s.headcountGrowth = +document.getElementById('fc-growth').value || 0;
    s.utilTarget = +document.getElementById('fc-util').value || 85;
    s.horizon = +document.getElementById('fc-horizon').value || 4;
    s.confidence = document.getElementById('fc-conf').value;
    s.adoptionGrowth = +document.getElementById('fc-adopt').value || 0;
    s.deptGrowth = {}; s.capacityPlan = {};
    document.querySelectorAll('.fc-dept-growth').forEach(i => { if (i.value !== '') s.deptGrowth[decodeURIComponent(i.dataset.dept)] = +i.value; });
    document.querySelectorAll('.fc-dept-cap').forEach(i => { if (i.value !== '') s.capacityPlan[decodeURIComponent(i.dataset.dept)] = +i.value; });
    save();
    renderForecast();
    toast('Forecast updated.', 'success');
  };
  host.querySelector('#fc-apply').onclick = apply;
  host.querySelector('#fc-reset').onclick = () => { if (!confirm('Reset forecast settings?')) return; state.settings.forecast = null; save(); renderForecast(); };
}

/* ---------------- View + nav ---------------- */
function ensureForecastView() {
  if (document.getElementById('forecast')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'forecast'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Licence forecast</h2>
        <p class="page-sub">Capacity-planning-driven licence demand. Model headcount growth, utilisation target and per-vendor adoption; get recommendations for every seat-based contract.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="icon-btn" data-pdf-export="fc-body" data-pdf-title="Licence forecast">Download PDF</button>
      </div>
    </div>
    <div id="fc-body"></div>
  `;
  main.appendChild(section);
  renderForecast();
}
function ensureForecastNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  // Place under "Consumption" if that group exists, otherwise Operations
  const g = [...groups].find(x => x.querySelector('[data-view="consumption"]')) || [...groups].find(x => x.querySelector('[data-view="analytics"]')) || groups[1];
  if (!g || g.querySelector('[data-view="forecast"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 12 9 18 15 10 21 16"/><path d="M14 10h7v7"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'forecast';
  btn.innerHTML = `${svg}<span>Licence forecast</span>`;
  g.appendChild(btn);
  btn.addEventListener('click', () => switchView('forecast'));
}

/* Patch switchView to render on entry */
const _origSwitchForFC = window.switchView;
if (_origSwitchForFC && !window._fcSwitchPatched) {
  window.switchView = function (name, opts) {
    const r = _origSwitchForFC(name, opts);
    if (name === 'forecast') { try { renderForecast(); } catch (_) {} }
    return r;
  };
  window._fcSwitchPatched = true;
}

/* Hook renderAll */
const _prevAll14 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll14) {
  window.renderAll = function () {
    _prevAll14();
    try { ensureForecastView(); ensureForecastNav(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { ensureForecastView(); ensureForecastNav(); } catch (_) {} }, 650);
});
