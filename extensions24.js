/* ================================================================
   Phase 46 - Export deliverables (Reports view)
   ================================================================
   Three artifacts, each one click:

   1. Monthly Spend Summary (PDF)   - one-page, branded, with
      headline numbers, top 10 vendors, category breakdown.
   2. Renewal Roster (CSV)          - every renewal in the next
      12 months, with notice dates and $ exposure.
   3. Savings Opportunities (PDF)   - ranked findings with
      estimated $ savings per item.

   All reports pull live from state. Uses html2pdf.js (already
   loaded in extensions3) and the downloadFile() bridge
   (extensions15) so files land on both artifact and hosted.
   ================================================================ */

(() => {

/* ---------------- Helpers ---------------- */

function moneyFmt(n) {
  if (n == null || isNaN(n)) return '-';
  if (typeof formatMoney === 'function') return formatMoney(n);
  return '$' + Math.round(n).toLocaleString();
}

function fmtDate(d) {
  if (!d) return '-';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function todayNice() { return fmtDate(new Date()); }

function wsName() {
  try { const w = workspace(); return w.companyName || w.name || 'Your workspace'; }
  catch (_) { return 'Your workspace'; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ms = d.getTime() - today.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/* ---------------- CSV helpers ---------------- */

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCSV(headers, rows) {
  const headerLine = headers.map(csvEscape).join(',');
  const body = rows.map(r => headers.map(h => csvEscape(r[h] ?? '')).join(',')).join('\n');
  return headerLine + '\n' + body;
}

function downloadBlob(filename, blob) {
  if (typeof window.downloadFile === 'function') {
    try { window.downloadFile(filename, blob); return; } catch (_) {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- Data builders ---------------- */

function activeSubs() {
  return (state.subscriptions || []).filter(s => s.active !== false);
}

function monthlySpendOf(sub) {
  if (typeof monthlyCost === 'function') return monthlyCost(sub);
  // Fallback
  const c = parseFloat(sub.cost) || 0;
  if (sub.cycle === 'yearly')    return c / 12;
  if (sub.cycle === 'quarterly') return c / 3;
  return c;
}

function buildSpendSummary() {
  const subs = activeSubs();
  const totalMonthly = subs.reduce((s, x) => s + monthlySpendOf(x), 0);
  const totalAnnual = totalMonthly * 12;
  const byCat = {};
  subs.forEach(s => { const c = s.category || 'Uncategorised'; byCat[c] = (byCat[c] || 0) + monthlySpendOf(s); });
  const catRows = Object.entries(byCat).map(([k, v]) => ({ cat: k, monthly: v })).sort((a, b) => b.monthly - a.monthly);
  const top10 = [...subs].sort((a, b) => monthlySpendOf(b) - monthlySpendOf(a)).slice(0, 10);

  // Next 90 days of renewals
  const upcoming = subs.filter(s => {
    const d = daysUntil(s.renewal);
    return d != null && d >= 0 && d <= 90;
  }).sort((a, b) => daysUntil(a.renewal) - daysUntil(b.renewal));

  return { subs, totalMonthly, totalAnnual, catRows, top10, upcoming };
}

function buildRenewalRoster() {
  const subs = activeSubs();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const future = new Date(now); future.setDate(future.getDate() + 365);
  const rows = subs
    .filter(s => s.renewal)
    .map(s => {
      const renewal = new Date(s.renewal);
      if (isNaN(renewal.getTime())) return null;
      if (renewal < now || renewal > future) return null;
      const days = daysUntil(s.renewal);
      const noticeDays = (s.contract && s.contract.noticeDays) || 0;
      const noticeDate = new Date(renewal);
      noticeDate.setDate(noticeDate.getDate() - noticeDays);
      const annualCost = monthlySpendOf(s) * 12;
      return {
        Vendor: s.name,
        Category: s.category || '',
        Team: s.team || '',
        'Renewal date': fmtDate(renewal),
        'Days until': days,
        'Notice date': noticeDays ? fmtDate(noticeDate) : '-',
        'Notice period (days)': noticeDays || '',
        'Auto-renew': (s.contract && s.contract.autoRenew) ? 'Yes' : 'No',
        'Annual cost': annualCost.toFixed(2),
        'Owner email': s.ownerEmail || '',
        URL: s.url || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a['Days until'] - b['Days until']);
  return rows;
}

function buildSavings() {
  const subs = activeSubs();
  const findings = [];

  // 1. Underused licences
  subs.forEach(s => {
    if (!s.licenses || !s.assigned) return;
    const utilization = s.assigned / s.licenses;
    if (utilization < 0.7) {
      const costPerSeat = (monthlySpendOf(s) * 12) / s.licenses;
      const wastedSeats = s.licenses - s.assigned;
      const estAnnualSaving = wastedSeats * costPerSeat;
      findings.push({
        type: 'Underused licences',
        vendor: s.name,
        detail: `${s.assigned} of ${s.licenses} seats assigned (${Math.round(utilization * 100)}%). Right-size at renewal.`,
        savings: estAnnualSaving,
      });
    }
  });

  // 2. Auto-renew traps (renewing within 60 days + notice window elapsing)
  subs.forEach(s => {
    if (!s.contract || !s.contract.autoRenew) return;
    const days = daysUntil(s.renewal);
    const notice = s.contract.noticeDays || 0;
    if (days != null && days >= 0 && days <= notice + 15) {
      findings.push({
        type: 'Auto-renew trap',
        vendor: s.name,
        detail: `Renews in ${days}d with a ${notice}d notice period. Decide now or auto-renew locks another term.`,
        savings: monthlySpendOf(s) * 12,  // full year at risk
      });
    }
  });

  // 3. Overlapping tools (same category, multiple vendors)
  const catMap = {};
  subs.forEach(s => {
    const c = s.category || 'Uncategorised';
    catMap[c] = catMap[c] || [];
    catMap[c].push(s);
  });
  Object.entries(catMap).forEach(([cat, list]) => {
    if (list.length < 2) return;
    if (cat === 'Uncategorised') return;
    // Overlap savings estimate: smallest vendor in the category
    const sorted = [...list].sort((a, b) => monthlySpendOf(b) - monthlySpendOf(a));
    const consolidationCandidate = sorted[sorted.length - 1];
    findings.push({
      type: 'Overlapping tools',
      vendor: list.map(s => s.name).join(' + '),
      detail: `${list.length} vendors in <b>${cat}</b>. Consolidating onto one could save the cost of ${consolidationCandidate.name}.`,
      savings: monthlySpendOf(consolidationCandidate) * 12,
    });
  });

  // 4. Orphan contracts (no owner)
  subs.forEach(s => {
    if (s.ownerEmail || (s.contract && s.contract.owner)) return;
    findings.push({
      type: 'Orphan contract',
      vendor: s.name,
      detail: `No owner assigned. Audit before the next renewal - orphan tools are the #1 source of ghost spend.`,
      savings: monthlySpendOf(s) * 12 * 0.1,  // conservative 10% risk
    });
  });

  findings.sort((a, b) => b.savings - a.savings);
  const totalSavings = findings.reduce((s, f) => s + f.savings, 0);
  return { findings, totalSavings };
}

/* ---------------- PDF renderer (shared chrome) ---------------- */

async function renderPdf(filename, bodyHtml, opts = {}) {
  await ensureHtml2Pdf();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed; left:-10000px; top:0; width:794px; background:#fff; color:#101828; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;';
  wrap.innerHTML = `
    <div style="padding:40px 44px 20px; border-bottom:1px solid #e4e7ec;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px; height:40px; background:#0f1829; color:#fff; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; border-radius:8px;">SST</div>
          <div>
            <div style="font-weight:700; font-size:16px; letter-spacing:-0.01em;">SaaS Spend Track</div>
            <div style="font-size:12px; color:#667085;">${escapeHtml(wsName())}</div>
          </div>
        </div>
        <div style="text-align:right; font-size:12px; color:#667085;">
          <div style="font-weight:600; color:#101828; font-size:14px;">${escapeHtml(opts.title || 'Report')}</div>
          <div>${todayNice()}</div>
        </div>
      </div>
    </div>
    <div style="padding:28px 44px 40px;">${bodyHtml}</div>
    <div style="padding:16px 44px 36px; border-top:1px solid #e4e7ec; font-size:11px; color:#98a2b3; text-align:center;">
      Generated by SaaS Spend Track · app.saasspendtrack.com · ${todayNice()}
    </div>
  `;
  document.body.appendChild(wrap);
  try {
    await window.html2pdf()
      .from(wrap)
      .set({
        margin: 0,
        filename,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
      })
      .save();
  } finally {
    wrap.remove();
  }
}

async function ensureHtml2Pdf() {
  if (window.html2pdf) return;
  // The function in extensions3 is named loadHtml2Pdf or similar; try a few.
  if (typeof loadHtml2Pdf === 'function') { await loadHtml2Pdf(); return; }
  if (typeof ensureHtml2Pdf2 === 'function') { await ensureHtml2Pdf2(); return; }
  // Last-resort: load it ourselves.
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ---------------- Report 1: Monthly Spend Summary ---------------- */

async function exportSpendSummary() {
  const d = buildSpendSummary();
  const catBarMax = d.catRows[0] ? d.catRows[0].monthly : 1;
  const body = `
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px;">
      ${stat('Monthly spend',  moneyFmt(d.totalMonthly))}
      ${stat('Annualised',     moneyFmt(d.totalAnnual))}
      ${stat('Active vendors', d.subs.length.toString())}
      ${stat('Renewals (90d)', d.upcoming.length.toString())}
    </div>

    <h3 style="margin:0 0 12px; font-size:15px; color:#101828;">Top 10 vendors by monthly spend</h3>
    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:28px;">
      <thead>
        <tr style="background:#f8fafc; border-bottom:1px solid #e4e7ec;">
          <th style="text-align:left; padding:8px 10px; font-weight:600; color:#667085;">Vendor</th>
          <th style="text-align:left; padding:8px 10px; font-weight:600; color:#667085;">Category</th>
          <th style="text-align:right; padding:8px 10px; font-weight:600; color:#667085;">Monthly</th>
          <th style="text-align:right; padding:8px 10px; font-weight:600; color:#667085;">Annual</th>
          <th style="text-align:left; padding:8px 10px; font-weight:600; color:#667085;">Next renewal</th>
        </tr>
      </thead>
      <tbody>
        ${d.top10.map(s => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 10px; font-weight:500; color:#101828;">${escapeHtml(s.name)}</td>
            <td style="padding:8px 10px; color:#475467;">${escapeHtml(s.category || '-')}</td>
            <td style="padding:8px 10px; text-align:right; color:#101828;">${moneyFmt(monthlySpendOf(s))}</td>
            <td style="padding:8px 10px; text-align:right; color:#101828;">${moneyFmt(monthlySpendOf(s) * 12)}</td>
            <td style="padding:8px 10px; color:#475467;">${s.renewal ? fmtDate(s.renewal) : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h3 style="margin:0 0 12px; font-size:15px; color:#101828;">Spend by category</h3>
    <div style="margin-bottom:28px;">
      ${d.catRows.slice(0, 10).map(c => {
        const pct = Math.round((c.monthly / catBarMax) * 100);
        return `
          <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
              <span style="color:#101828;">${escapeHtml(c.cat)}</span>
              <span style="color:#475467;">${moneyFmt(c.monthly)}/mo</span>
            </div>
            <div style="background:#f1f5f9; height:7px; border-radius:4px; overflow:hidden;">
              <div style="background:#2563eb; height:100%; width:${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    ${d.upcoming.length ? `
      <h3 style="margin:0 0 12px; font-size:15px; color:#101828;">Renewals in the next 90 days</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#f8fafc; border-bottom:1px solid #e4e7ec;">
            <th style="text-align:left; padding:8px 10px; font-weight:600; color:#667085;">Vendor</th>
            <th style="text-align:left; padding:8px 10px; font-weight:600; color:#667085;">Renewal</th>
            <th style="text-align:right; padding:8px 10px; font-weight:600; color:#667085;">Days</th>
            <th style="text-align:right; padding:8px 10px; font-weight:600; color:#667085;">Annual</th>
          </tr>
        </thead>
        <tbody>
          ${d.upcoming.slice(0, 20).map(s => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 10px; color:#101828;">${escapeHtml(s.name)}</td>
              <td style="padding:8px 10px; color:#475467;">${fmtDate(s.renewal)}</td>
              <td style="padding:8px 10px; text-align:right; color:${daysUntil(s.renewal) < 30 ? '#dc2626' : '#101828'}; font-weight:${daysUntil(s.renewal) < 30 ? '600' : '400'};">${daysUntil(s.renewal)}</td>
              <td style="padding:8px 10px; text-align:right; color:#101828;">${moneyFmt(monthlySpendOf(s) * 12)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}
  `;
  await renderPdf(`spend-summary-${todayISO()}.pdf`, body, { title: 'Monthly spend summary' });
  trackExport('spend_summary_pdf', { vendors: d.subs.length, total_monthly: Math.round(d.totalMonthly) });
}

function stat(label, value) {
  return `
    <div style="background:#f8fafc; border:1px solid #e4e7ec; border-radius:8px; padding:14px 16px;">
      <div style="font-size:11px; color:#667085; text-transform:uppercase; letter-spacing:0.05em; font-weight:500;">${escapeHtml(label)}</div>
      <div style="font-size:22px; font-weight:700; color:#101828; margin-top:3px; letter-spacing:-0.02em;">${escapeHtml(value)}</div>
    </div>
  `;
}

/* ---------------- Report 2: Renewal Roster CSV ---------------- */

function exportRenewalRoster() {
  const rows = buildRenewalRoster();
  if (!rows.length) { alert('No upcoming renewals in the next 12 months.'); return; }
  const headers = ['Vendor', 'Category', 'Team', 'Renewal date', 'Days until', 'Notice date', 'Notice period (days)', 'Auto-renew', 'Annual cost', 'Owner email', 'URL'];
  const csv = rowsToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(`renewal-roster-${todayISO()}.csv`, blob);
  trackExport('renewal_roster_csv', { rows: rows.length });
}

/* ---------------- Report 3: Savings Opportunities ---------------- */

async function exportSavingsReport() {
  const d = buildSavings();
  if (!d.findings.length) {
    alert('No savings opportunities detected. Your spend looks tight - nothing to flag.');
    return;
  }
  const body = `
    <div style="background:#eff6ff; border:1px solid #dbeafe; border-radius:10px; padding:18px 22px; margin-bottom:28px; text-align:center;">
      <div style="font-size:11px; color:#2563eb; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Estimated annual savings</div>
      <div style="font-size:30px; font-weight:800; color:#0f1829; margin-top:4px; letter-spacing:-0.02em;">${moneyFmt(d.totalSavings)}</div>
      <div style="font-size:12px; color:#475467; margin-top:4px;">${d.findings.length} finding${d.findings.length === 1 ? '' : 's'} across underused licences, auto-renew traps, overlaps, and orphan contracts</div>
    </div>

    <h3 style="margin:0 0 12px; font-size:15px; color:#101828;">Findings, ranked by potential saving</h3>
    ${d.findings.map((f, i) => {
      const typeColor = {
        'Underused licences': '#2563eb',
        'Auto-renew trap':    '#dc2626',
        'Overlapping tools':  '#f59e0b',
        'Orphan contract':    '#8b5cf6',
      }[f.type] || '#667085';
      return `
        <div style="background:#fff; border:1px solid #e4e7ec; border-radius:8px; padding:14px 16px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:${typeColor}20; color:${typeColor}; font-size:10px; font-weight:600; padding:2px 7px; border-radius:4px; text-transform:uppercase; letter-spacing:0.04em;">${escapeHtml(f.type)}</span>
              <span style="font-weight:600; color:#101828; font-size:13px;">${escapeHtml(f.vendor)}</span>
            </div>
            <div style="text-align:right; color:#059669; font-weight:700; font-size:14px; white-space:nowrap;">${moneyFmt(f.savings)}/yr</div>
          </div>
          <div style="font-size:12px; color:#475467; line-height:1.5;">${f.detail}</div>
        </div>
      `;
    }).join('')}

    <div style="margin-top:28px; padding:16px; background:#f8fafc; border-radius:8px; font-size:11.5px; color:#667085; line-height:1.5;">
      <b style="color:#101828;">How to read this.</b> Savings are estimates based on current contract terms, usage data, and typical negotiation outcomes. Underused-licence savings assume you right-size at renewal. Auto-renew trap savings are the <i>annual commitment at risk</i>, not guaranteed recovery. Overlap savings assume full consolidation onto one tool. Orphan contract savings are a 10% risk reserve - orphan tools are the single largest source of shadow spend.
    </div>
  `;
  await renderPdf(`savings-opportunities-${todayISO()}.pdf`, body, { title: 'Savings opportunities' });
  trackExport('savings_report_pdf', { findings: d.findings.length, total_savings: Math.round(d.totalSavings) });
}

/* ---------------- Reports view ---------------- */

const REPORTS = [
  {
    id: 'spend_summary',
    title: 'Monthly spend summary',
    sub: 'One-page PDF with your headline numbers, top vendors, and category breakdown. Send to finance.',
    format: 'PDF',
    run: exportSpendSummary,
    needs: () => activeSubs().length > 0,
  },
  {
    id: 'renewal_roster',
    title: 'Renewal roster (next 12 months)',
    sub: 'CSV with every upcoming renewal, notice date, auto-renew flag, and $ exposure. Open in Excel.',
    format: 'CSV',
    run: exportRenewalRoster,
    needs: () => activeSubs().filter(s => s.renewal).length > 0,
  },
  {
    id: 'savings_report',
    title: 'Savings opportunities',
    sub: 'Ranked list of underused licences, auto-renew traps, overlapping tools, and orphan contracts with estimated $ savings per item.',
    format: 'PDF',
    run: exportSavingsReport,
    needs: () => activeSubs().length > 0,
  },
];

function renderReportsView(host) {
  const subsCount = activeSubs().length;
  host.innerHTML = `
    <div class="view-head">
      <h1>Reports</h1>
      <p class="muted">Download these any time. They always reflect your current state.</p>
    </div>

    ${subsCount === 0 ? `
      <div class="rpt-empty">
        <b>No subscriptions loaded yet.</b>
        <div>Upload a contract or run <b>Bulk import</b> on the Subscriptions view, then come back to generate reports.</div>
      </div>
    ` : ''}

    <div class="rpt-grid">
      ${REPORTS.map(r => {
        const ok = r.needs();
        return `
          <div class="rpt-card ${ok ? '' : 'is-disabled'}">
            <div class="rpt-card-head">
              <span class="rpt-fmt rpt-fmt-${r.format.toLowerCase()}">${r.format}</span>
              <h3>${escapeHtml(r.title)}</h3>
            </div>
            <p class="rpt-sub">${escapeHtml(r.sub)}</p>
            <button type="button" class="rpt-btn" data-rpt="${r.id}" ${ok ? '' : 'disabled'}>
              ${ok ? 'Download' : 'Needs data'}
            </button>
          </div>
        `;
      }).join('')}
    </div>

    <div class="rpt-foot">
      <b>Coming soon:</b> scheduled email delivery of these reports to a distribution list. For now, generate on demand.
    </div>
  `;
  host.querySelectorAll('.rpt-btn[data-rpt]').forEach(b => {
    b.onclick = async () => {
      const r = REPORTS.find(x => x.id === b.dataset.rpt);
      if (!r) return;
      b.disabled = true;
      const originalText = b.textContent;
      b.textContent = 'Generating...';
      try { await r.run(); }
      catch (err) { console.error(err); alert('Export failed: ' + err.message); }
      b.disabled = false;
      b.textContent = originalText;
    };
  });
}

/* ---------------- Sidebar nav + view wiring ---------------- */

function injectNavTab() {
  if (document.querySelector('.tab[data-view="reports"]')) return;
  // Place after "risk" if present, else at the end of the primary nav.
  const nav = document.querySelector('.app-nav, nav.sidebar, nav');
  if (!nav) return;
  const after = nav.querySelector('.tab[data-view="risk"]') || nav.querySelector('.tab[data-view="alerts"]') || nav.lastElementChild;
  const btn = document.createElement('button');
  btn.className = 'tab';
  btn.type = 'button';
  btn.dataset.view = 'reports';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <path d="M14 3v6h6"/>
      <path d="M8 13h8M8 17h5"/>
    </svg>
    <span>Reports</span>
  `;
  btn.addEventListener('click', () => { try { switchView('reports'); } catch (_) {} });
  if (after && after.parentNode) after.parentNode.insertBefore(btn, after.nextSibling);
  else nav.appendChild(btn);
}

function ensureReportsContainer() {
  let host = document.querySelector('.view[data-view="reports"]');
  if (host) return host;
  host = document.createElement('div');
  host.className = 'view';
  host.setAttribute('data-view', 'reports');
  host.hidden = true;
  // Find the main view container to append to
  const main = document.querySelector('main, .main, .app-main, .views-container') || document.body;
  main.appendChild(host);
  return host;
}

/* Monkey-patch switchView to render Reports on demand. */
function wire() {
  injectNavTab();
  ensureReportsContainer();
  const prev = window.switchView;
  if (typeof prev !== 'function' || prev._rp46) return;
  window.switchView = function (name, opts) {
    const r = prev.apply(this, arguments);
    try {
      if (name === 'reports') {
        const host = ensureReportsContainer();
        // Hide other views, show this one
        document.querySelectorAll('.view').forEach(v => { v.hidden = (v.getAttribute('data-view') !== 'reports'); });
        host.hidden = false;
        renderReportsView(host);
        // Highlight nav tab
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === 'reports'));
      }
    } catch (_) {}
    return r;
  };
  window.switchView._rp46 = true;
}

/* Hook renderAll so sidebar rebuilds don't lose the tab. */
const _prevAll46 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll46) {
  window.renderAll = function () {
    _prevAll46.apply(this, arguments);
    try { injectNavTab(); } catch (_) {}
  };
}

/* ---------------- Telemetry ---------------- */

function trackExport(id, extra) {
  try {
    const url = (typeof signupEndpoint === 'function') ? signupEndpoint() : null;
    if (!url || url.includes('PASTE-YOUR')) return;
    const w = (typeof workspace === 'function') ? workspace() : {};
    const body = new URLSearchParams();
    body.append('event_type', 'export_' + id);
    body.append('email', w.ownerEmail || '');
    body.append('company', w.companyName || '');
    body.append('workspace_id', w.id || '');
    Object.entries(extra || {}).forEach(([k, v]) => body.append(k, String(v ?? '')));
    fetch(url, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
  } catch (_) {}
}

/* ---------------- Public handle + boot ---------------- */

window.Reports = {
  spendSummary: exportSpendSummary,
  renewalRoster: exportRenewalRoster,
  savings: exportSavingsReport,
  view: () => { try { switchView('reports'); } catch (_) {} },
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(wire, 400);
});

})();
