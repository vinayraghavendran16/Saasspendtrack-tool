/* ==========================================================================
   SaaS Spend Track — Phase 3.2
   - Department-weighted risk inside Analytics
   - Legal-review PDF for the Clause playbook
   ========================================================================== */

/* =============== Department-weighted risk =============== */
function computeDeptRisk() {
  const ctx = portfolioCtx();
  const byDept = {}; // dept -> { contracts, totalMonthly, riskWeighted }
  state.subscriptions.forEach(sub => {
    if (!sub.contract) return;
    const dept = sub.team || 'Unassigned';
    const m = monthlyCost(sub);
    const r = scoreContract(sub, ctx);
    if (!byDept[dept]) byDept[dept] = { dept, contracts: 0, totalMonthly: 0, riskSum: 0, maxRisk: 0, topVendor: null, topRisk: 0 };
    const b = byDept[dept];
    b.contracts++; b.totalMonthly += m;
    b.riskSum += r.overall;
    b.maxRisk = Math.max(b.maxRisk, r.overall);
    if (r.overall > b.topRisk) { b.topRisk = r.overall; b.topVendor = sub.name; b.topSubId = sub.id; }
    // weighted exposure: fraction of year spent × risk fraction
    b.exposure = (b.exposure || 0) + (r.overall / 100) * m * 12;
  });
  return Object.values(byDept).map(b => ({
    ...b,
    avgRisk: Math.round(b.riskSum / b.contracts),
    exposure: Math.round(b.exposure),
  })).sort((a, b) => b.exposure - a.exposure);
}

function renderDeptRiskPanel() {
  // Find the Analytics panel grid and append a span-2 panel for dept risk
  const host = document.getElementById('analytics-body');
  if (!host) return;
  // Only insert once per render, and only if we have scored contracts
  if (host.querySelector('[data-dept-risk]')) return;
  const rows = computeDeptRisk();
  if (!rows.length) return;
  const panelGrid = host.querySelector('.panel-grid');
  if (!panelGrid) return;

  const totalExposure = rows.reduce((s, x) => s + x.exposure, 0);
  const maxExposure = Math.max(1, ...rows.map(r => r.exposure));
  const maxAvg = Math.max(1, ...rows.map(r => r.avgRisk));

  const panel = document.createElement('div');
  panel.className = 'panel span-2';
  panel.dataset.deptRisk = '1';
  panel.innerHTML = `
    <h2>Risk-weighted spend by department</h2>
    <p class="panel-sub">Average contract risk and annualised risk exposure (risk × annual spend). Departments carrying more exposure deserve renewal attention first, regardless of which spends the most.</p>
    <div class="dept-risk-grid">
      <div class="dept-risk-chart">
        <div class="chart-legend" style="margin-bottom:6px">
          <span class="legend-chip"><span class="legend-sw" style="background:#2563eb"></span>Avg risk (0-100)</span>
          <span class="legend-chip"><span class="legend-sw" style="background:#dc2626"></span>Annualised exposure</span>
        </div>
        <div class="chart">
          ${rows.map(r => {
            const avgPct = (r.avgRisk / 100) * 100;
            const expPct = (r.exposure / maxExposure) * 100;
            return `<div class="dept-risk-row">
              <span class="chart-label"><a href="#" class="link" data-dept-filter="${escapeHtml(r.dept)}">${escapeHtml(r.dept)}</a></span>
              <div style="display:flex;flex-direction:column;gap:3px;flex:1">
                <div class="chart-bar" title="Avg risk: ${r.avgRisk}/100 (across ${r.contracts} contracts)"><div class="chart-bar-fill" style="--w:${avgPct.toFixed(1)}%;background:#2563eb"></div></div>
                <div class="chart-bar" title="Annualised exposure: ${formatMoney(r.exposure)}"><div class="chart-bar-fill" style="--w:${expPct.toFixed(1)}%;background:#dc2626"></div></div>
              </div>
              <span class="chart-value" style="min-width:120px"><div style="font-size:11px;color:var(--text-dim)">${r.avgRisk} · ${r.contracts} contracts</div><div style="font-weight:600">${formatMoney(r.exposure)}</div></span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="dept-risk-table">
        <table class="sub-table">
          <thead><tr><th>Department</th><th class="num">Contracts</th><th class="num">Avg risk</th><th class="num">Exposure / yr</th><th>Highest-risk vendor</th></tr></thead>
          <tbody>${rows.map(r => `<tr>
            <td><a href="#" class="link" data-dept-filter="${escapeHtml(r.dept)}"><b>${escapeHtml(r.dept)}</b></a></td>
            <td class="num">${r.contracts}</td>
            <td class="num"><span class="badge ${riskBand(r.avgRisk).cls}">${r.avgRisk}</span></td>
            <td class="num">${formatMoney(r.exposure)}</td>
            <td>${r.topVendor ? `<a href="#" class="link" data-vendor-nav="${r.topSubId}">${escapeHtml(r.topVendor)}</a> · <span style="color:var(--text-dim)">${r.topRisk}</span>` : '—'}</td>
          </tr>`).join('')}
          <tr style="background:var(--panel-2);font-weight:700"><td>Portfolio total</td><td class="num">${rows.reduce((s, r) => s + r.contracts, 0)}</td><td class="num">—</td><td class="num">${formatMoney(totalExposure)}</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  panelGrid.appendChild(panel);

  // Wire the dept filter shortcut and vendor navigation
  panel.querySelectorAll('[data-dept-filter]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    setAnalyticsFilters({ departments: [el.dataset.deptFilter] });
  }));
  panel.querySelectorAll('[data-vendor-nav]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault(); openVendorNav(el.dataset.vendorNav);
  }));
}

// Patch into analytics render (after extensions3's patch runs)
const _prevAnalytics2 = typeof renderAnalytics === 'function' ? renderAnalytics : null;
if (_prevAnalytics2) {
  window.renderAnalytics = function () {
    _prevAnalytics2();
    try { renderDeptRiskPanel(); } catch (e) { console.warn(e); }
  };
}

/* =============== Legal-review PDF export =============== */
async function exportPlaybookReview() {
  toast('Preparing Legal review PDF…', 'info');
  const lib = await loadPdfLibs();
  const ctx = portfolioCtx();
  const pb = playbook();
  const activeRules = PLAYBOOK_ITEMS.filter(it => pb[it.id]?.required);
  if (!activeRules.length) { toast('Define at least one playbook rule first.', 'warn'); return; }

  const subs = state.subscriptions.filter(s => s.contract);
  const scored = subs.map(s => ({ s, e: evaluatePlaybook(s), r: scoreContract(s, ctx) }));
  const withIssues = scored.filter(x => x.e.results.some(r => r.state === 'deviation' || r.state === 'missing'));
  const compliant = scored.filter(x => !x.e.results.some(r => r.state === 'deviation' || r.state === 'missing'));
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b.e.score, 0) / scored.length) : 0;
  const totalDeviations = scored.reduce((a, x) => a + x.e.results.filter(r => r.state === 'deviation' || r.state === 'missing').length, 0);
  const now = new Date();

  const severityLabel = { info: 'Info', warn: 'Warning', danger: 'Critical' };
  const severityColour = { info: '#1d4ed8', warn: '#b45308', danger: '#b42318' };

  // Build the printable DOM
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    background:#fff;color:#101828;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    width:1240px;padding:0;margin:0;position:absolute;left:-99999px;top:0;
  `;

  const cover = `
    <div style="padding:60px 56px 40px;border-bottom:4px solid #101828">
      <div style="font-size:11px;letter-spacing:0.12em;color:#667085;font-weight:600;text-transform:uppercase">SaaS Spend Track · Legal review</div>
      <h1 style="margin:14px 0 6px;font-size:36px;line-height:1.2;color:#101828;letter-spacing:-0.02em">Contract portfolio: playbook deviation report</h1>
      <p style="margin:0;font-size:14px;color:#475467">Prepared for legal review. Lists every contract in the portfolio scored against the current playbook, with deviations and recommended actions.</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:40px">
        <div><div style="font-size:11px;color:#667085;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Date</div><div style="font-size:16px;font-weight:600;margin-top:4px">${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
        <div><div style="font-size:11px;color:#667085;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Playbook rules</div><div style="font-size:16px;font-weight:600;margin-top:4px">${activeRules.length} active</div></div>
        <div><div style="font-size:11px;color:#667085;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Contracts scored</div><div style="font-size:16px;font-weight:600;margin-top:4px">${scored.length}</div></div>
        <div><div style="font-size:11px;color:#667085;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Portfolio compliance</div><div style="font-size:16px;font-weight:600;margin-top:4px;color:${avg >= 80 ? '#067647' : avg >= 60 ? '#b45308' : '#b42318'}">${avg}%</div></div>
      </div>
    </div>
  `;

  const summary = `
    <div style="padding:30px 56px">
      <h2 style="font-size:18px;margin:0 0 14px;color:#101828">Executive summary</h2>
      <p style="font-size:13px;line-height:1.6;color:#344054;margin:0 0 10px">The portfolio holds <b>${scored.length}</b> contracts. The playbook defines <b>${activeRules.length}</b> required clauses. Scoring against those rules shows portfolio-wide compliance of <b>${avg}%</b>, with <b>${withIssues.length}</b> contracts carrying at least one deviation or missing clause and <b>${totalDeviations}</b> deviation signals in total.</p>
      <p style="font-size:13px;line-height:1.6;color:#344054;margin:0 0 20px">Of the scored contracts, <b>${compliant.length}</b> are in full compliance with the playbook. The remaining <b>${withIssues.length}</b> are detailed below, with per-clause findings and recommended actions for each.</p>

      <h3 style="font-size:13px;margin:22px 0 8px;color:#475467;text-transform:uppercase;letter-spacing:0.06em">Active playbook rules</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e4e7ec">
        <thead><tr style="background:#f2f4f7;color:#475467">
          <th style="text-align:left;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Clause</th>
          <th style="text-align:left;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Rule</th>
          <th style="text-align:left;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Severity</th>
        </tr></thead>
        <tbody>${activeRules.map(it => {
          const r = pb[it.id];
          let rule = 'Required to be present';
          if (r.op === 'max' && r.limit != null) rule = `Value must not exceed ${r.limit}`;
          if (r.op === 'min' && r.limit != null) rule = `Value must be at least ${r.limit}`;
          if (r.phrase) rule = `Must contain phrase: "${r.phrase}"`;
          return `<tr><td style="padding:8px 10px;border-bottom:1px solid #e4e7ec"><b>${it.label}</b>${it.critical ? ' <span style="font-size:10px;padding:1px 6px;background:#fef3f2;color:#b42318;border-radius:999px;font-weight:600">critical</span>' : ''}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e7ec;color:#344054">${rule}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e7ec"><span style="font-size:11px;padding:2px 8px;background:#f2f4f7;color:${severityColour[r.severity] || '#475467'};border-radius:4px;font-weight:600">${severityLabel[r.severity] || 'Warning'}</span></td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  `;

  const breakdown = `
    <div style="padding:10px 56px 30px;page-break-before:always">
      <h2 style="font-size:18px;margin:0 0 14px;color:#101828">Portfolio breakdown</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e4e7ec">
        <thead><tr style="background:#f2f4f7;color:#475467">
          <th style="text-align:left;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Vendor</th>
          <th style="text-align:left;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Department</th>
          <th style="text-align:right;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Annual spend</th>
          <th style="text-align:right;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Compliance</th>
          <th style="text-align:right;padding:8px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Deviations</th>
        </tr></thead>
        <tbody>${scored.sort((a, b) => a.e.score - b.e.score).map(({ s, e }) => {
          const deviations = e.results.filter(r => r.state === 'deviation' || r.state === 'missing').length;
          const scoreColour = e.score >= 90 ? '#067647' : e.score >= 70 ? '#b45308' : '#b42318';
          return `<tr>
            <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec"><b>${escapeHtml(s.name)}</b></td>
            <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec;color:#475467">${escapeHtml(s.team || '—')}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec;text-align:right;font-variant-numeric:tabular-nums">${formatMoney(monthlyCost(s) * 12)}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec;text-align:right;color:${scoreColour};font-weight:600">${e.score}%</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec;text-align:right">${deviations || '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  `;

  const details = `
    <div style="padding:10px 56px 30px;page-break-before:always">
      <h2 style="font-size:18px;margin:0 0 6px;color:#101828">Vendors with deviations</h2>
      <p style="font-size:12px;color:#667085;margin:0 0 20px">${withIssues.length} vendor${withIssues.length === 1 ? '' : 's'}. Each is listed with the failing clauses, expected-versus-actual values, and the recommended action.</p>
      ${withIssues.sort((a, b) => a.e.score - b.e.score).map(({ s, e, r }) => {
        const issues = e.results.filter(x => x.state === 'deviation' || x.state === 'missing');
        const action = recommendedAction(Object.keys(r.signals).sort((a, b) => Math.max(...r.signals[b].map(x => x.score)) - Math.max(...r.signals[a].map(x => x.score)))[0] || 'legal', Object.values(r.signals).flat());
        return `<div style="margin-bottom:22px;padding:18px 22px;border:1px solid #e4e7ec;border-left:4px solid ${e.score >= 70 ? '#b45308' : '#b42318'};border-radius:6px;break-inside:avoid;page-break-inside:avoid">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px">
            <div>
              <div style="font-size:16px;font-weight:700;color:#101828">${escapeHtml(s.name)}</div>
              <div style="font-size:12px;color:#667085;margin-top:2px">${escapeHtml(s.team || '—')} · ${escapeHtml(s.category || '—')} · ${formatMoney(s.cost)} ${s.cycle} · renewal ${s.renewal || '—'}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:#667085;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Compliance</div>
              <div style="font-size:22px;font-weight:700;color:${e.score >= 70 ? '#b45308' : '#b42318'}">${e.score}%</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e4e7ec">
            <thead><tr style="background:#f9fafb;color:#475467">
              <th style="text-align:left;padding:6px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Clause</th>
              <th style="text-align:left;padding:6px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Expected</th>
              <th style="text-align:left;padding:6px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Actual</th>
              <th style="text-align:left;padding:6px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Severity</th>
            </tr></thead>
            <tbody>${issues.map(iss => `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #e4e7ec"><b>${escapeHtml(iss.label)}</b></td>
              <td style="padding:6px 10px;border-bottom:1px solid #e4e7ec;color:#344054">${escapeHtml(iss.expected || 'present')}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e4e7ec;color:${iss.state === 'missing' ? '#b42318' : '#b45308'};font-weight:${iss.state === 'missing' ? '600' : '500'}">${iss.state === 'missing' ? 'MISSING' : escapeHtml(iss.actual || '—')}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e4e7ec"><span style="font-size:11px;padding:2px 8px;background:#f2f4f7;color:${severityColour[iss.severity || 'warn']};border-radius:4px;font-weight:600">${severityLabel[iss.severity || 'warn']}</span></td>
            </tr>`).join('')}</tbody>
          </table>
          ${action ? `<div style="margin-top:12px;padding:10px 12px;background:#f9fafb;border-radius:4px;font-size:12px;line-height:1.5;color:#344054"><b>Recommended action:</b> ${escapeHtml(action)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;

  const compliantList = compliant.length ? `
    <div style="padding:10px 56px 40px;page-break-before:always">
      <h2 style="font-size:18px;margin:0 0 6px;color:#101828">Appendix: vendors in full compliance</h2>
      <p style="font-size:12px;color:#667085;margin:0 0 14px">${compliant.length} vendor${compliant.length === 1 ? '' : 's'} meet every required playbook rule.</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e4e7ec">
        <thead><tr style="background:#f2f4f7;color:#475467">
          <th style="text-align:left;padding:7px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Vendor</th>
          <th style="text-align:left;padding:7px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Department</th>
          <th style="text-align:right;padding:7px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Annual spend</th>
          <th style="text-align:left;padding:7px 10px;font-weight:600;border-bottom:1px solid #e4e7ec">Renewal</th>
        </tr></thead>
        <tbody>${compliant.map(({ s }) => `<tr>
          <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec"><b>${escapeHtml(s.name)}</b></td>
          <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec;color:#475467">${escapeHtml(s.team || '—')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec;text-align:right;font-variant-numeric:tabular-nums">${formatMoney(monthlyCost(s) * 12)}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e4e7ec;color:#475467">${s.renewal || '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  ` : '';

  const footer = `
    <div style="padding:20px 56px;border-top:1px solid #e4e7ec;color:#667085;font-size:10.5px;line-height:1.5">
      Generated by SaaS Spend Track. Scoring is rule-based and intended to prioritise legal review; it is not a substitute for a lawyer's judgment on any individual contract. Not legal advice.
    </div>
  `;

  wrapper.innerHTML = cover + summary + breakdown + details + compliantList + footer;
  document.body.appendChild(wrapper);
  try {
    const filename = `playbook-legal-review-${now.toISOString().slice(0, 10)}.pdf`;
    const worker = lib().set({
      margin: 0,
      filename,
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: '.break-avoid' },
    }).from(wrapper);
    if (typeof window.saveFileUniversal === 'function') {
      const blob = await worker.outputPdf('blob');
      await window.saveFileUniversal(filename, blob, 'application/pdf');
    } else {
      await worker.save();
      toast('Legal review PDF downloaded.', 'success');
    }
  } catch (e) {
    toast('PDF export failed: ' + e.message, 'error');
  } finally {
    wrapper.remove();
  }
}

/* Add "Download Legal review" button to the Playbook section head */
function addPlaybookLegalButton() {
  const head = document.querySelector('#playbook .section-head');
  if (!head || head.querySelector('[data-legal-review]')) return;
  let controls = head.querySelector('.controls');
  if (!controls) { controls = document.createElement('div'); controls.className = 'controls'; head.appendChild(controls); }
  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.dataset.legalReview = '1';
  btn.textContent = 'Download Legal review PDF';
  btn.style.marginRight = '8px';
  btn.onclick = exportPlaybookReview;
  // Insert before the generic PDF export button
  const genericPdf = controls.querySelector('[data-pdf-export]');
  if (genericPdf) controls.insertBefore(btn, genericPdf);
  else controls.appendChild(btn);
}

/* Hook into renderAll */
const _prevAll4 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll4) {
  window.renderAll = function () {
    _prevAll4();
    try { addPlaybookLegalButton(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { addPlaybookLegalButton(); } catch (_) {} }, 150);
});
