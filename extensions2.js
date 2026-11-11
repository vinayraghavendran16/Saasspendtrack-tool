/* ==========================================================================
   SaaS Spend Track — Phase 3
   - Centralised Analytics (department pie, grouped spend bars, filter chip row)
   - Clause Playbook (define approved terms, score deviation across portfolio)
   - Global vendor-name navigation (click vendor anywhere → contract review)
   ========================================================================== */

/* ----------------------------------------------------------------- helpers */
function uniq(arr) { return [...new Set(arr)]; }
function svgPie(parts, size = 240) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const cx = size / 2, cy = size / 2, r = size / 2 - 10, R = r + 6;
  let a = -Math.PI / 2;
  const slices = parts.map((p, i) => {
    const frac = p.value / total;
    const a2 = a + frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(a),   y1 = cy + r * Math.sin(a);
    const x2 = cx + r * Math.cos(a2),  y2 = cy + r * Math.sin(a2);
    const large = frac > 0.5 ? 1 : 0;
    const path = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    a = a2;
    return `<path d="${path}" fill="${p.colour}" stroke="var(--panel)" stroke-width="2">
      <title>${p.label}: ${formatMoney(p.value)} (${(frac * 100).toFixed(1)}%)</title></path>`;
  }).join('');
  // Donut hole + center total
  const hole = `<circle cx="${cx}" cy="${cy}" r="${r * 0.56}" fill="var(--panel)"/>`;
  const label = `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-dim)" font-size="11" font-family="var(--font)">Total / mo</text>
                 <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="var(--text)" font-size="16" font-weight="700" font-family="var(--font)">${formatMoneyShort(total)}</text>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${slices}${hole}${label}</svg>`;
}
function svgGroupedBars(groups, labels, colours, w = 640, h = 240) {
  const padL = 56, padR = 12, padT = 12, padB = 36;
  const bw = (w - padL - padR) / groups.length;
  const maxV = Math.max(1, ...groups.flatMap(g => g.values));
  const niceMax = Math.ceil(maxV / 1000) * 1000;
  const gy = (v) => padT + (h - padT - padB) * (1 - v / niceMax);
  const bar = (g, gi) => g.values.map((v, i) => {
    const slot = bw / (g.values.length + 1);
    const x = padL + gi * bw + slot * (i + 0.5);
    const y = gy(v); const bh = h - padB - y;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(slot * 0.9).toFixed(1)}" height="${Math.max(2, bh).toFixed(1)}" fill="${colours[i]}" rx="2">
      <title>${g.label} ${labels[i]}: ${formatMoney(v)}</title></rect>`;
  }).join('');
  const bars = groups.map(bar).join('');
  const xLabels = groups.map((g, gi) => `<text x="${(padL + gi * bw + bw / 2).toFixed(1)}" y="${h - 14}" text-anchor="middle" fill="var(--text-dim)" font-size="11" font-family="var(--font)">${escapeHtml(g.label.length > 10 ? g.label.slice(0, 10) + '…' : g.label)}</text>`).join('');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const v = niceMax * p; const y = gy(v);
    return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--border)" stroke-width="1"/><text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="var(--text-dim)" font-size="10" font-family="var(--font)">${formatMoneyShort(v)}</text>`;
  }).join('');
  const legend = labels.map((l, i) => `<span class="legend-chip"><span class="legend-sw" style="background:${colours[i]}"></span>${l}</span>`).join('');
  return { svg: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">${yTicks}${bars}${xLabels}</svg>`, legend: `<div class="chart-legend">${legend}</div>` };
}
const CHART_PALETTE = ['#2563eb', '#16a34a', '#d97706', '#be185d', '#7c3aed', '#0891b2', '#dc2626', '#4338ca', '#059669', '#b45309', '#0369a1', '#9333ea'];

/* ----------------------------------------------------------------- Analytics state */
function analyticsFilters() {
  const f = state.settings.analyticsFilters || {};
  return { departments: f.departments || [], categories: f.categories || [], vendors: f.vendors || [] };
}
function setAnalyticsFilters(patch) {
  state.settings.analyticsFilters = { ...analyticsFilters(), ...patch };
  save();
  renderAnalytics();
}
function filteredSubs() {
  const f = analyticsFilters();
  return activeSubs().filter(s =>
    (!f.departments.length || f.departments.includes(s.team)) &&
    (!f.categories.length  || f.categories.includes(s.category)) &&
    (!f.vendors.length     || f.vendors.includes(s.id))
  );
}

/* ----------------------------------------------------------------- Render: Analytics */
function renderAnalytics() {
  const host = document.getElementById('analytics-body');
  if (!host) return;
  const subs = filteredSubs();
  if (!subs.length && !activeSubs().length) { host.innerHTML = '<p class="empty">No data yet. Add subscriptions or load the sample.</p>'; return; }
  const totalMonthly = subs.reduce((s, x) => s + monthlyCost(x), 0);
  const f = analyticsFilters();
  const allDepts = uniq(activeSubs().map(s => s.team).filter(Boolean)).sort();
  const allCats  = uniq(activeSubs().map(s => s.category).filter(Boolean)).sort();
  const allVendors = [...activeSubs()].sort((a, b) => a.name.localeCompare(b.name));

  // Department pie
  const byDept = {};
  subs.forEach(s => { const k = s.team || 'Unassigned'; byDept[k] = (byDept[k] || 0) + monthlyCost(s); });
  const deptEntries = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
  const deptPie = deptEntries.map(([k, v], i) => ({ label: k, value: v, colour: CHART_PALETTE[i % CHART_PALETTE.length] }));

  // Grouped bars: monthly / quarterly / annual by department
  const barGroups = deptEntries.map(([k, m]) => ({ label: k, values: [m, m * 3, m * 12] }));
  const bars = svgGroupedBars(barGroups, ['Monthly', 'Quarterly', 'Annual'], ['#2563eb', '#16a34a', '#d97706']);

  // Category breakdown (horizontal bars using existing chart primitive)
  const byCat = {};
  subs.forEach(s => { const k = s.category || 'Uncategorised'; byCat[k] = (byCat[k] || 0) + monthlyCost(s); });
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(1, ...catEntries.map(([, v]) => v));
  const catChart = catEntries.map(([k, v], i) => `<div class="chart-row"><span class="chart-label">${escapeHtml(k)}</span><div class="chart-bar"><div class="chart-bar-fill" style="--w:${(v / catMax * 100).toFixed(1)}%;background:${CHART_PALETTE[i % CHART_PALETTE.length]}"></div></div><span class="chart-value">${formatMoney(v)}</span></div>`).join('');

  // Top 10 vendors
  const topVendors = [...subs].sort((a, b) => monthlyCost(b) - monthlyCost(a)).slice(0, 10);
  const tvMax = Math.max(1, ...topVendors.map(v => monthlyCost(v)));
  const tvChart = topVendors.map(s => `<div class="chart-row"><span class="chart-label"><a href="#" class="link" data-vendor-nav="${s.id}">${escapeHtml(s.name)}</a></span><div class="chart-bar"><div class="chart-bar-fill" style="--w:${(monthlyCost(s) / tvMax * 100).toFixed(1)}%"></div></div><span class="chart-value">${formatMoney(monthlyCost(s))}</span></div>`).join('');

  // Invoice trend — monthly paid totals for the chosen range (defaults to 12 months)
  const r = (typeof rangeToDates === 'function') ? rangeToDates(state.settings.analyticsRange || { preset: '12m' }) : { from: null, to: new Date() };
  const now = new Date(); const trend = [];
  const monthsBack = r.from ? Math.max(1, Math.min(24, Math.round((now - r.from) / (86400000 * 30)))) : 12;
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const total = state.invoices.filter(iv => {
      if (!iv.paidDate) return false;
      const subOk = !f.vendors.length || f.vendors.includes(iv.subId);
      if (!subOk) return false;
      const sub = state.subscriptions.find(s => s.id === iv.subId);
      if (!sub) return false;
      if (f.departments.length && !f.departments.includes(sub.team)) return false;
      if (f.categories.length && !f.categories.includes(sub.category)) return false;
      const pd = parseDate(iv.paidDate); return pd >= d && pd < end;
    }).reduce((s, iv) => s + iv.amount, 0);
    trend.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), values: [total] });
  }
  const trendBars = svgGroupedBars(trend, ['Paid invoices'], ['#16a34a'], 680, 220);

  host.innerHTML = `
    <!-- Filter row -->
    <div class="filter-bar">
      <div class="filter-group"><label>Department</label>
        <select multiple id="flt-dept" size="1" style="min-width:160px">${allDepts.map(d => `<option value="${escapeHtml(d)}" ${f.departments.includes(d) ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}</select>
      </div>
      <div class="filter-group"><label>Category</label>
        <select multiple id="flt-cat" size="1" style="min-width:160px">${allCats.map(c => `<option value="${escapeHtml(c)}" ${f.categories.includes(c) ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <div class="filter-group"><label>Tool / vendor</label>
        <select multiple id="flt-vendor" size="1" style="min-width:200px">${allVendors.map(v => `<option value="${v.id}" ${f.vendors.includes(v.id) ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}</select>
      </div>
      <button class="icon-btn" id="flt-clear">Clear filters</button>
      <span class="filter-summary">${subs.length} / ${activeSubs().length} vendors shown · ${formatMoney(totalMonthly)}/mo</span>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">Monthly spend</span><span class="stat-value">${formatMoney(totalMonthly)}</span><span class="stat-sub">${subs.length} vendors</span></div>
      <div class="stat-card"><span class="stat-label">Quarterly spend</span><span class="stat-value">${formatMoney(totalMonthly * 3)}</span><span class="stat-sub">projected</span></div>
      <div class="stat-card"><span class="stat-label">Annual spend</span><span class="stat-value">${formatMoney(totalMonthly * 12)}</span><span class="stat-sub">projected</span></div>
      <div class="stat-card"><span class="stat-label">Departments</span><span class="stat-value">${deptEntries.length}</span><span class="stat-sub">in view</span></div>
    </div>

    <div class="panel-grid">
      <div class="panel">
        <h2>Spend by department</h2>
        <div class="pie-wrap">
          <div class="pie">${svgPie(deptPie, 220)}</div>
          <ul class="pie-legend">${deptPie.map(p => `<li><span class="legend-sw" style="background:${p.colour}"></span><span class="lgd-label">${escapeHtml(p.label)}</span><span class="lgd-val">${formatMoney(p.value)}</span></li>`).join('')}</ul>
        </div>
      </div>
      <div class="panel">
        <h2>Monthly / Quarterly / Annual by department</h2>
        ${bars.legend}
        ${bars.svg}
      </div>
      <div class="panel">
        <h2>Spend by category</h2>
        <div class="chart">${catChart || '<p class="empty">No data</p>'}</div>
      </div>
      <div class="panel">
        <h2>Top 10 vendors</h2>
        <div class="chart">${tvChart || '<p class="empty">No data</p>'}</div>
      </div>
      <div class="panel span-2">
        <h2>Paid invoices &mdash; last 12 months</h2>
        ${trendBars.legend}
        ${trendBars.svg}
      </div>
    </div>
  `;

  // Wire filters
  const mv = (sel) => [...sel.selectedOptions].map(o => o.value);
  const bind = (id, key) => {
    const s = document.getElementById(id);
    s.addEventListener('change', () => setAnalyticsFilters({ [key]: mv(s) }));
  };
  bind('flt-dept', 'departments'); bind('flt-cat', 'categories'); bind('flt-vendor', 'vendors');
  document.getElementById('flt-clear').onclick = () => setAnalyticsFilters({ departments: [], categories: [], vendors: [] });
  host.querySelectorAll('[data-vendor-nav]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); openVendorNav(el.dataset.vendorNav); }));
}

/* ----------------------------------------------------------------- Playbook */
const PLAYBOOK_ITEMS = CLAUSE_LIBRARY.map(c => ({ id: c.id, label: c.label, dim: c.dim, critical: c.critical }));

function playbook() { return state.settings.playbook || {}; }
function savePlaybook(pb) { state.settings.playbook = pb; save(); renderPlaybook(); renderAll(); }

function evaluatePlaybook(sub) {
  const pb = playbook(); const c = sub.contract || {};
  const results = PLAYBOOK_ITEMS.map(it => {
    const rule = pb[it.id];
    if (!rule || !rule.required) return { id: it.id, label: it.label, state: 'na' };
    const rawField = it.id === 'renewal' ? 'renewalType' : it.id === 'notice' ? 'noticeDays' : it.id === 'term' ? 'termLength' : it.id === 'priceCap' ? 'priceCapPct' : it.id;
    const actual = c[rawField];
    const present = actual != null && actual !== '';
    if (!present) return { id: it.id, label: it.label, state: 'missing', severity: rule.severity || 'warn', expected: rule.expected || '', actual: null };
    // Numeric comparators
    if (rule.op === 'max' && rule.limit != null) {
      const num = typeof actual === 'number' ? actual : parseFloat(String(actual).match(/\d+(?:\.\d+)?/)?.[0] || 'NaN');
      if (!isNaN(num) && num > rule.limit) return { id: it.id, label: it.label, state: 'deviation', severity: rule.severity || 'warn', expected: `≤ ${rule.limit}`, actual: String(actual) };
    }
    if (rule.op === 'min' && rule.limit != null) {
      const num = typeof actual === 'number' ? actual : parseFloat(String(actual).match(/\d+(?:\.\d+)?/)?.[0] || 'NaN');
      if (!isNaN(num) && num < rule.limit) return { id: it.id, label: it.label, state: 'deviation', severity: rule.severity || 'warn', expected: `≥ ${rule.limit}`, actual: String(actual) };
    }
    // Phrase check fires on any rule that specifies a phrase (op is optional)
    if (rule.phrase) {
      if (!new RegExp(rule.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(String(actual))) {
        return { id: it.id, label: it.label, state: 'deviation', severity: rule.severity || 'warn', expected: `contains "${rule.phrase}"`, actual: String(actual) };
      }
    }
    return { id: it.id, label: it.label, state: 'match', expected: rule.expected || '', actual: String(actual) };
  });
  const required = results.filter(r => r.state !== 'na');
  const match = required.filter(r => r.state === 'match').length;
  const score = required.length ? Math.round((match / required.length) * 100) : null;
  return { results, score, requiredCount: required.length };
}

function renderPlaybook() {
  const host = document.getElementById('playbook-body'); if (!host) return;
  const pb = playbook();
  const subs = state.subscriptions.filter(s => s.contract);
  const evals = subs.map(s => ({ s, e: evaluatePlaybook(s) })).filter(x => x.e.requiredCount > 0);
  const avg = evals.length ? Math.round(evals.reduce((a, b) => a + b.e.score, 0) / evals.length) : null;
  const requiredCount = Object.values(pb).filter(r => r.required).length;

  host.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">Rules on the playbook</span><span class="stat-value">${requiredCount}</span><span class="stat-sub">of ${PLAYBOOK_ITEMS.length} clauses covered</span></div>
      <div class="stat-card"><span class="stat-label">Portfolio compliance</span><span class="stat-value">${avg == null ? '—' : avg + '%'}</span><span class="stat-sub">avg across ${evals.length} scored contracts</span></div>
      <div class="stat-card"><span class="stat-label">Contracts with deviation</span><span class="stat-value" style="color:var(--danger-text)">${evals.filter(x => x.e.results.some(r => r.state === 'deviation' || r.state === 'missing')).length}</span><span class="stat-sub">at least one rule failing</span></div>
      <div class="stat-card"><span class="stat-label">Deviation signals</span><span class="stat-value">${evals.reduce((a, x) => a + x.e.results.filter(r => r.state === 'deviation' || r.state === 'missing').length, 0)}</span><span class="stat-sub">across the portfolio</span></div>
    </div>

    <div class="panel-grid">
      <div class="panel">
        <h2>1. Define your playbook</h2>
        <p class="panel-sub">Mark each clause as required. Add a comparator where it makes sense (price cap not above X%, notice not above Y days, SLA not below Z%). Only required rules count towards the score.</p>
        <div class="pb-rules">${PLAYBOOK_ITEMS.map(it => {
          const r = pb[it.id] || {};
          const hasOp = ['priceCap', 'notice', 'sla', 'paymentDays'].includes(it.id);
          const defaults = { priceCap: { op: 'max', limit: 7, severity: 'warn' }, notice: { op: 'max', limit: 60, severity: 'warn' }, sla: { op: 'min', limit: 99.5, severity: 'warn' }, paymentDays: { op: 'min', limit: 30, severity: 'info' } };
          const d = defaults[it.id] || {};
          return `<div class="pb-row ${r.required ? 'on' : ''}" data-pb-row="${it.id}">
            <label class="pb-check"><input type="checkbox" data-pb-req="${it.id}" ${r.required ? 'checked' : ''}/> <b>${escapeHtml(it.label)}</b>${it.critical ? ' <span class="badge danger">critical</span>' : ''}</label>
            ${hasOp ? `<span class="pb-op">
              <select data-pb-op="${it.id}" ${r.required ? '' : 'disabled'}>
                <option value="max" ${(r.op || d.op) === 'max' ? 'selected' : ''}>max</option>
                <option value="min" ${(r.op || d.op) === 'min' ? 'selected' : ''}>min</option>
              </select>
              <input type="number" step="0.5" data-pb-lim="${it.id}" value="${r.limit != null ? r.limit : (d.limit != null ? d.limit : '')}" ${r.required ? '' : 'disabled'} placeholder="limit" />
            </span>` : `<input type="text" data-pb-phrase="${it.id}" placeholder="must contain phrase (optional)" value="${escapeHtml(r.phrase || '')}" ${r.required ? '' : 'disabled'} />`}
            <select data-pb-sev="${it.id}" ${r.required ? '' : 'disabled'}>
              <option value="info" ${(r.severity || 'warn') === 'info' ? 'selected' : ''}>info</option>
              <option value="warn" ${(r.severity || 'warn') === 'warn' ? 'selected' : ''}>warn</option>
              <option value="danger" ${(r.severity || 'warn') === 'danger' ? 'selected' : ''}>critical</option>
            </select>
          </div>`;
        }).join('')}</div>
        <div class="integ-actions" style="margin-top:12px;gap:8px">
          <button class="icon-btn" id="pb-defaults">Load recommended defaults</button>
          <button class="icon-btn" id="pb-clear">Clear all</button>
        </div>
      </div>

      <div class="panel">
        <h2>2. Portfolio deviation report</h2>
        ${evals.length === 0 ? '<p class="empty">No rules yet, or no contracts to score. Add a rule to see deviations.</p>' : `
        <div class="pb-report-wrap"><table class="sub-table"><thead><tr>
          <th>Vendor</th><th class="num">Score</th>${PLAYBOOK_ITEMS.filter(it => pb[it.id]?.required).map(it => `<th title="${it.label}">${it.label.split(' ')[0].slice(0, 4)}</th>`).join('')}
        </tr></thead><tbody>
          ${evals.sort((a, b) => a.e.score - b.e.score).map(({ s, e }) => `<tr>
            <td><a href="#" class="link" data-vendor-nav="${s.id}"><b>${escapeHtml(s.name)}</b></a></td>
            <td class="num"><span class="badge ${e.score >= 90 ? 'ok' : e.score >= 70 ? 'warn' : 'danger'}">${e.score}%</span></td>
            ${e.results.filter(r => r.state !== 'na').map(r => {
              const cls = r.state === 'match' ? 'ok' : r.state === 'deviation' ? 'warn' : 'danger';
              const sym = r.state === 'match' ? '✓' : r.state === 'deviation' ? '≠' : '✗';
              const t = r.state === 'match' ? 'matches' : r.state === 'deviation' ? `${r.expected} (actual: ${r.actual})` : `required but missing (expected ${r.expected || 'present'})`;
              return `<td class="num" title="${escapeHtml(t)}"><span class="risk-cell ${cls}">${sym}</span></td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody></table></div>`}
      </div>
    </div>
  `;

  // Wire rule inputs
  host.querySelectorAll('[data-pb-req]').forEach(el => el.addEventListener('change', () => {
    const id = el.dataset.pbReq; const pb = { ...playbook() };
    if (el.checked) {
      const defaults = { priceCap: { op: 'max', limit: 7 }, notice: { op: 'max', limit: 60 }, sla: { op: 'min', limit: 99.5 }, paymentDays: { op: 'min', limit: 30 } };
      pb[id] = { required: true, severity: 'warn', ...(defaults[id] || {}) };
    } else delete pb[id];
    savePlaybook(pb);
  }));
  const read = (sel, attr) => host.querySelectorAll(sel).forEach(el => el.addEventListener('change', () => {
    const id = el.dataset[attr]; const pb = { ...playbook() }; if (!pb[id]) return;
    if (attr === 'pbOp') pb[id].op = el.value;
    if (attr === 'pbLim') pb[id].limit = parseFloat(el.value) || null;
    if (attr === 'pbPhrase') pb[id].phrase = el.value;
    if (attr === 'pbSev') pb[id].severity = el.value;
    savePlaybook(pb);
  }));
  read('[data-pb-op]', 'pbOp'); read('[data-pb-lim]', 'pbLim'); read('[data-pb-phrase]', 'pbPhrase'); read('[data-pb-sev]', 'pbSev');

  const def = document.getElementById('pb-defaults');
  if (def) def.onclick = () => {
    savePlaybook({
      renewal:    { required: true, severity: 'info' },
      notice:     { required: true, op: 'max', limit: 60, severity: 'warn' },
      term:       { required: true, severity: 'info' },
      priceCap:   { required: true, op: 'max', limit: 7, severity: 'warn' },
      paymentDays:{ required: true, op: 'min', limit: 30, severity: 'info' },
      governingLaw:{ required: true, phrase: 'India', severity: 'danger' },
      liabilityCap:{ required: true, severity: 'danger' },
      indemnity:  { required: true, severity: 'warn' },
      sla:        { required: true, op: 'min', limit: 99.5, severity: 'warn' },
      termination:{ required: true, severity: 'warn' },
      dpa:        { required: true, severity: 'danger' },
      security:   { required: true, severity: 'warn' },
      audit:      { required: true, severity: 'info' },
    });
  };
  const clr = document.getElementById('pb-clear'); if (clr) clr.onclick = () => savePlaybook({});
  host.querySelectorAll('[data-vendor-nav]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); openVendorNav(el.dataset.vendorNav); }));
}

/* ----------------------------------------------------------------- Global vendor navigation */
function openVendorNav(subId) {
  const sub = state.subscriptions.find(s => s.id === subId); if (!sub) return;
  if (sub.contract) {
    openContractDetail(subId);
  } else {
    const back = document.getElementById('contract-detail-modal');
    back.hidden = false;
    back.querySelector('.modal').innerHTML = `
      <h2>${escapeHtml(sub.name)}</h2>
      <p class="contract-summary" style="margin-bottom:14px">${escapeHtml(sub.category || '')} · ${escapeHtml(sub.team || '')} · ${formatMoney(sub.cost)} ${sub.cycle} · renewal ${sub.renewal || '—'}</p>
      <div class="panel" style="background:var(--warning-soft);border:none">
        <h2 style="font-size:14px;color:var(--warning-text);margin-bottom:6px">No contract on file</h2>
        <p style="font-size:13px;color:var(--text-2);margin:0">This vendor has a subscription record but no contract has been ingested yet. Upload the contract to see the extracted clauses and the risk score.</p>
      </div>
      <div class="actions" style="margin-top:14px">
        <button type="button" class="icon-btn" onclick="document.getElementById('contract-detail-modal').hidden = true">Close</button>
        <button type="button" class="primary" onclick="document.getElementById('contract-detail-modal').hidden = true; switchView('contracts');">Go to Contracts</button>
      </div>
    `;
  }
}

/* Attach vendor click handlers after every render. Walk known tables and
   the dashboard notice-window / vendor-totals, plus the subscription table
   first column. Uses a WeakSet to avoid double-binding. */
const _boundNav = new WeakSet();
function wireVendorLinks() {
  const byName = {}; state.subscriptions.forEach(s => { byName[s.name] = s.id; });
  const tryBind = (el, name) => {
    const id = byName[name]; if (!id || _boundNav.has(el)) return;
    el.classList.add('vendor-link');
    el.style.cursor = 'pointer';
    el.title = (el.title ? el.title + ' · ' : '') + 'Open contract review';
    el.addEventListener('click', (e) => {
      // don't intercept button clicks inside the row
      if (e.target.closest('button,a,[data-edit-cons],[data-new-inv]')) return;
      openVendorNav(id);
    });
    _boundNav.add(el);
  };

  // Subscription table first column name
  document.querySelectorAll('#sub-tbody tr .name-cell > div:last-child > div:first-child').forEach(div => tryBind(div, div.textContent.trim()));
  // Dashboard vendor-totals
  document.querySelectorAll('#vendor-tbody tr .vendor-name').forEach(div => tryBind(div, div.textContent.trim()));
  // Invoices table — first <td><b> element contains vendor name via subName helper
  document.querySelectorAll('#inv-tbody tr td:first-child').forEach(td => tryBind(td, td.textContent.trim()));
  // Consumption table first col
  document.querySelectorAll('#cons-tbody tr td:first-child b, #cons-tbody tr td:first-child').forEach(el => tryBind(el, el.textContent.trim()));
  // Alerts: first column vendor name
  document.querySelectorAll('#alerts-tbody tr td:first-child').forEach(td => tryBind(td, td.textContent.trim()));
  // Renewals calendar vendor
  document.querySelectorAll('.renewal-month li > div:first-child > div:first-child').forEach(div => tryBind(div, div.textContent.trim()));
  // Risk analytics highest-risk table
  document.querySelectorAll('#risk-analytics-body .sub-table tbody tr td:first-child b').forEach(el => tryBind(el, el.textContent.trim()));
  // Contracts v2 table
  document.querySelectorAll('#contracts-v2 .sub-table .name-cell > div:last-child > div:first-child').forEach(div => tryBind(div, div.textContent.trim()));
}

/* Hook into renderAll */
const _prev2 = typeof renderAll === 'function' ? renderAll : null;
if (_prev2) {
  window.renderAll = function () {
    _prev2();
    try { renderAnalytics(); } catch (e) { console.warn(e); }
    try { renderPlaybook();  } catch (e) { console.warn(e); }
    try { wireVendorLinks(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { renderAnalytics(); renderPlaybook(); wireVendorLinks(); } catch (_) {} }, 80);
});
