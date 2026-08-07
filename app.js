// SaaS Spend Track — vanilla JS app with localStorage persistence.

const STORAGE_KEY = 'saasspendtrack.v1';
const CYCLE_MONTHS = { weekly: 1/4.345, monthly: 1, quarterly: 3, yearly: 12 };
const AVATAR_COLORS = ['#7c5cff', '#35d0ba', '#ff8a4c', '#4cb1ff', '#ff5c7a', '#ffb545', '#a374ff', '#4cd3ff'];

let state = { subscriptions: [] };
let uiSort = { key: 'renewal', dir: 'asc' };

// -------- storage --------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (_) {}
  if (!Array.isArray(state.subscriptions)) state.subscriptions = [];
  if (!Array.isArray(state.invoices)) state.invoices = [];
  if (!state.alertLog) state.alertLog = {}; // { "<subId>:<trigger>:<renewalISO>": { sentAt, ackAt, escalatedAt } }
  if (!state.settings) state.settings = {}; // { slackWebhook, slackAuto, driveFolder, autoSentAlerts, plan }
  if (!state.settings.autoSentAlerts) state.settings.autoSentAlerts = {};
  if (!state.settings.plan) state.settings.plan = 'free';
}

const PLANS = {
  free:       { label: 'Free',       subLimit: 10 },
  pro:        { label: 'Pro',        subLimit: Infinity },
  enterprise: { label: 'Enterprise', subLimit: Infinity },
};
function currentPlan() { return PLANS[state.settings.plan] ? state.settings.plan : 'free'; }
function setPlan(p) {
  if (!PLANS[p]) return;
  state.settings.plan = p;
  save();
  renderPlanBadge();
  renderPricing();
  renderAll();
}
function renderPlanBadge() {
  const p = currentPlan();
  const badge = document.getElementById('plan-badge');
  badge.className = `plan-badge ${p}`;
  document.getElementById('plan-label').textContent = PLANS[p].label;
}
function renderPricing() {
  const p = currentPlan();
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.classList.toggle('plan-active', card.dataset.plan === p);
  });
}

function invoiceStatus(inv) {
  if (inv.paidDate) return 'paid';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = parseDate(inv.dueDate);
  if (due && due < today) return 'overdue';
  return 'pending';
}
function subName(id) { return state.subscriptions.find(s => s.id === id)?.name || '—'; }
function subTeam(id) { return state.subscriptions.find(s => s.id === id)?.team || ''; }
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// -------- math --------
function monthlyCost(sub) {
  const months = CYCLE_MONTHS[sub.cycle] || 1;
  return sub.cost / months;
}
function periodCost(sub) { return sub.cost || 0; } // cost for one billing period as stored

// Consumption: returns { total, assigned, utilized, unused, utilizationPct, unusedCostMonthly } or null
function consumption(sub) {
  const total = Number(sub.licenses) || 0;
  if (!total) return null;
  const assigned = Math.min(total, Math.max(0, Number(sub.assigned) || 0));
  const utilized = Math.min(total, Math.max(0, Number(sub.utilized) || 0));
  const unused = Math.max(0, total - utilized);
  const utilizationPct = Math.round((utilized / total) * 100);
  const unusedCostMonthly = (unused / total) * monthlyCost(sub);
  return { total, assigned, utilized, unused, utilizationPct, unusedCostMonthly };
}
function formatMoney(n) {
  return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMoneyShort(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
}
function parseDate(s) { return s ? new Date(s + 'T00:00:00') : null; }
function daysUntil(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}
function addCycles(date, cycle, n) {
  const d = new Date(date);
  if (cycle === 'weekly')    d.setDate(d.getDate() + 7 * n);
  else if (cycle === 'monthly')   d.setMonth(d.getMonth() + n);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3 * n);
  else /* yearly */               d.setFullYear(d.getFullYear() + n);
  return d;
}
// Returns the next renewal that is >= today, projected forward if the
// stored date is stale. Returns null if the sub has no renewal on file.
function nextRenewal(sub) {
  if (!sub.renewal) return null;
  const stored = parseDate(sub.renewal);
  const today = new Date(); today.setHours(0,0,0,0);
  if (stored >= today) return stored;
  const cycle = sub.cycle || 'monthly';
  let d = new Date(stored);
  // guard against pathological loops (e.g. renewal 20 years ago on weekly)
  for (let i = 0; i < 400 && d < today; i++) d = addCycles(d, cycle, 1);
  return d;
}
function nextRenewalISO(sub) {
  const d = nextRenewal(sub);
  return d ? d.toISOString().slice(0, 10) : null;
}
function formatDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
}

// -------- rendering --------
function activeSubs() { return state.subscriptions.filter(s => s.active !== false); }

function renderDashboard() {
  const active = activeSubs();
  const totalMonthly = active.reduce((sum, s) => sum + monthlyCost(s), 0);
  const totalAnnual = totalMonthly * 12;
  const paused = state.subscriptions.length - active.length;

  document.getElementById('stat-monthly').textContent = formatMoney(totalMonthly);
  document.getElementById('stat-monthly-sub').textContent = `${active.length} active · ${paused} paused`;
  document.getElementById('stat-annual').textContent = formatMoney(totalAnnual);

  // Invoices YTD paid / pending
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const paidYtd = state.invoices.filter(i => i.paidDate && parseDate(i.paidDate) >= yearStart);
  const paidTotal = paidYtd.reduce((s, i) => s + i.amount, 0);
  const pending = state.invoices.filter(i => invoiceStatus(i) !== 'paid');
  const overdue = pending.filter(i => invoiceStatus(i) === 'overdue');
  const pendingTotal = pending.reduce((s, i) => s + i.amount, 0);
  document.getElementById('stat-paid').textContent = formatMoney(paidTotal);
  document.getElementById('stat-paid-sub').textContent = `${paidYtd.length} invoice${paidYtd.length === 1 ? '' : 's'}`;
  document.getElementById('stat-pending').textContent = formatMoney(pendingTotal);
  const pendEl = document.getElementById('stat-pending-sub');
  pendEl.textContent = `${pending.length} pending · ${overdue.length} overdue`;
  document.getElementById('stat-pending').style.color = overdue.length ? 'var(--danger)' : '';

  const withDates = active.filter(s => s.renewal).map(s => ({ s, next: nextRenewalISO(s) })).sort((a,b) => parseDate(a.next) - parseDate(b.next));

  // Category chart
  const byCat = {};
  active.forEach(s => {
    const c = s.category || 'Uncategorized';
    byCat[c] = (byCat[c] || 0) + monthlyCost(s);
  });
  const catEntries = Object.entries(byCat).sort((a,b) => b[1] - a[1]);
  const max = catEntries[0]?.[1] || 1;
  const chart = document.getElementById('category-chart');
  chart.innerHTML = catEntries.length ? catEntries.map(([cat, val]) => `
    <div class="chart-row">
      <span>${escapeHtml(cat)}</span>
      <div class="chart-bar"><div class="chart-bar-fill" style="width:${(val/max*100).toFixed(1)}%"></div></div>
      <span class="chart-value">${formatMoney(val)}/mo</span>
    </div>
  `).join('') : '<p class="empty" style="padding:20px 0">Add subscriptions to see the breakdown.</p>';

  // Team chart
  const byTeam = {};
  active.forEach(s => {
    const t = s.team || 'Unassigned';
    byTeam[t] = (byTeam[t] || 0) + monthlyCost(s);
  });
  const teamEntries = Object.entries(byTeam).sort((a,b) => b[1] - a[1]);
  const teamMax = teamEntries[0]?.[1] || 1;
  const teamChart = document.getElementById('team-chart');
  teamChart.innerHTML = teamEntries.length ? teamEntries.map(([t, v]) => `
    <div class="chart-row">
      <span>${escapeHtml(t)}</span>
      <div class="chart-bar"><div class="chart-bar-fill" style="width:${(v/teamMax*100).toFixed(1)}%"></div></div>
      <span class="chart-value">${formatMoney(v)}/mo</span>
    </div>
  `).join('') : '<p class="empty" style="padding:20px 0">Assign a team on each subscription to see the breakdown.</p>';

  // Vendor totals
  renderVendorTotals();

  // Invoices due soon
  const dueSoon = state.invoices
    .filter(i => invoiceStatus(i) !== 'paid')
    .sort((a,b) => (parseDate(a.dueDate) || 0) - (parseDate(b.dueDate) || 0))
    .slice(0, 6);
  const dueEl = document.getElementById('due-list');
  dueEl.innerHTML = dueSoon.length ? dueSoon.map(i => {
    const st = invoiceStatus(i);
    const d = daysUntil(i.dueDate);
    const cls = st === 'overdue' ? 'danger' : d <= 7 ? 'warn' : 'ok';
    const dayLabel = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'today' : `${d}d`;
    return `<li>
      <div><div class="name">${escapeHtml(subName(i.subId))}</div><div class="meta">${escapeHtml(i.invoiceNumber || 'no #')} · due ${formatDate(i.dueDate)}</div></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="amount">${formatMoney(i.amount)}</span>
        <span class="badge ${cls}">${dayLabel}</span>
      </div>
    </li>`;
  }).join('') : '<p class="empty" style="padding:20px 0">Nothing due.</p>';

  // Upcoming renewals — projected forward for stale dates
  const upcoming = withDates.filter(x => { const d = daysUntil(x.next); return d !== null && d >= 0 && d <= 30; }).slice(0, 6);
  const ul = document.getElementById('upcoming-list');
  ul.innerHTML = upcoming.length ? upcoming.map(({ s, next }) => {
    const d = daysUntil(next);
    const badge = d <= 3 ? 'danger' : d <= 7 ? 'warn' : 'ok';
    const projected = next !== s.renewal;
    return `<li>
      <div><div class="name">${escapeHtml(s.name)}</div><div class="meta">${formatDate(next)}${projected ? ' <span class="badge" style="font-size:10px">projected</span>' : ''}</div></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="amount">${formatMoney(s.cost)}</span>
        <span class="badge ${badge}">${d === 0 ? 'today' : d + 'd'}</span>
      </div>
    </li>`;
  }).join('') : '<p class="empty" style="padding:20px 0">Nothing in the next 30 days.</p>';
}

function renderSubscriptions() {
  const tbody = document.getElementById('sub-tbody');
  const q = document.getElementById('search').value.trim().toLowerCase();
  const cat = document.getElementById('filter-category').value;
  const status = document.getElementById('filter-status').value;

  // Populate categories
  const cats = [...new Set(state.subscriptions.map(s => s.category).filter(Boolean))].sort();
  const filterSel = document.getElementById('filter-category');
  const current = filterSel.value;
  filterSel.innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  filterSel.value = current;

  const rows = state.subscriptions.filter(s => {
    if (q && !(
      s.name.toLowerCase().includes(q)
      || (s.category||'').toLowerCase().includes(q)
      || (s.team||'').toLowerCase().includes(q)
      || (s.notes||'').toLowerCase().includes(q)
    )) return false;
    if (cat && s.category !== cat) return false;
    if (status === 'active' && s.active === false) return false;
    if (status === 'paused' && s.active !== false) return false;
    return true;
  });

  // Sort
  const sortKey = uiSort.key;
  const dir = uiSort.dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    let av, bv;
    if (sortKey === 'monthly')      { av = monthlyCost(a); bv = monthlyCost(b); }
    else if (sortKey === 'cost')    { av = a.cost; bv = b.cost; }
    else if (sortKey === 'renewal') { av = parseDate(nextRenewalISO(a))?.getTime() ?? Infinity; bv = parseDate(nextRenewalISO(b))?.getTime() ?? Infinity; }
    else                            { av = (a[sortKey] || '').toString().toLowerCase(); bv = (b[sortKey] || '').toString().toLowerCase(); }
    if (av < bv) return -1 * dir;
    if (av > bv) return  1 * dir;
    return 0;
  });

  // Sort indicators
  document.querySelectorAll('.sub-table thead th[data-sort]').forEach(th => {
    const k = th.dataset.sort;
    th.classList.toggle('sorted', k === sortKey);
    th.classList.toggle('sorted-desc', k === sortKey && uiSort.dir === 'desc');
  });

  document.getElementById('empty-state').style.display = rows.length ? 'none' : 'block';
  tbody.innerHTML = rows.map(s => {
    const next = nextRenewalISO(s);
    const projected = next && next !== s.renewal;
    return `
    <tr>
      <td><div class="name-cell">
        <div class="avatar" style="background:${avatarColor(s.name)}">${initials(s.name)}</div>
        <div><div style="font-weight:600">${escapeHtml(s.name)}</div>${s.notes ? `<div style="color:var(--text-dim);font-size:11px">${escapeHtml(s.notes)}</div>` : ''}</div>
      </div></td>
      <td>${s.team ? `<span class="team-chip">${escapeHtml(s.team)}</span>` : '<span style="color:var(--text-dim)">—</span>'}</td>
      <td>${escapeHtml(s.category || '—')}</td>
      <td class="num">${formatMoney(s.cost)}</td>
      <td style="text-transform:capitalize">${s.cycle}</td>
      <td class="num">${formatMoney(monthlyCost(s))}</td>
      <td>${next ? formatDate(next) : '—'}${projected ? ' <span class="badge" style="font-size:10px" title="Original date passed; projected forward one cycle">projected</span>' : ''}${renderCancelBy(s)}</td>
      <td>${s.active !== false ? '<span class="badge ok">Active</span>' : '<span class="badge">Paused</span>'}${renderContractBadges(s)}</td>
      <td class="actions-cell">
        <button class="icon-btn" data-edit="${s.id}">Edit</button>
        <button class="icon-btn danger" data-delete="${s.id}">Delete</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openModal(b.dataset.edit));
  tbody.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => deleteSub(b.dataset.delete));
}

function computeNoticeWindow(s) {
  if (!s.contract?.noticeDays || !s.renewal) return null;
  const renewal = nextRenewal(s);
  if (!renewal) return null;
  const cancelBy = new Date(renewal); cancelBy.setDate(cancelBy.getDate() - s.contract.noticeDays);
  const today = new Date(); today.setHours(0,0,0,0);
  const daysLeft = Math.round((cancelBy - today) / 86400000);
  const daysToRenewal = Math.round((renewal - today) / 86400000);
  return { cancelBy, daysLeft, daysToRenewal, renewal };
}

function renderNoticeWindows() {
  const box = document.getElementById('notice-windows');
  const rows = activeSubs()
    .map(s => ({ sub: s, win: computeNoticeWindow(s) }))
    .filter(x => x.win)
    .sort((a, b) => a.win.daysLeft - b.win.daysLeft);

  if (!rows.length) {
    box.innerHTML = `<div class="notice-empty">
      No notice windows yet. Extract a contract in <b>Contracts</b> and attach it to a subscription to see its personalized act-by date here.
    </div>`;
    return;
  }

  box.innerHTML = rows.map(({ sub, win }) => {
    let tier;
    if (win.daysLeft < 0)      tier = 'passed';
    else if (win.daysLeft <= 7)  tier = 'urgent';
    else if (win.daysLeft <= 30) tier = 'warn';
    else                         tier = 'ok';

    const label = win.daysLeft < 0
      ? 'notice window has passed'
      : `to give notice · renews in ${win.daysToRenewal}d`;

    const num = win.daysLeft < 0 ? Math.abs(win.daysLeft) : win.daysLeft;
    const unit = win.daysLeft < 0 ? `day${num === 1 ? '' : 's'} overdue` : `day${num === 1 ? '' : 's'} left`;

    const clauseParts = [`<b>${sub.contract.noticeDays}-day</b> notice`];
    if (sub.contract.termLength) clauseParts.push(`${sub.contract.termLength} term`);
    if (sub.contract.priceCapPct != null) clauseParts.push(`≤${sub.contract.priceCapPct}% cap`);
    if (sub.contract.autoRenew) clauseParts.push('auto-renews');

    return `<div class="notice-card ${tier}">
      <span class="vendor">${escapeHtml(sub.name)}</span>
      <span class="actby">Act by <b>${win.cancelBy.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b></span>
      <div class="countdown"><span class="num">${num}</span><span class="unit">${unit}</span></div>
      <div class="actby">${label}</div>
      <div class="clause">${clauseParts.join(' · ')}</div>
    </div>`;
  }).join('');
}

function renderConsumption() {
  const rows = state.subscriptions
    .map(s => ({ s, c: consumption(s) }))
    .filter(x => x.c)
    .sort((a, b) => b.c.unusedCostMonthly - a.c.unusedCostMonthly);

  // Stat cards
  document.getElementById('cons-vendors').textContent = rows.length;
  document.getElementById('cons-vendors-sub').textContent = `of ${state.subscriptions.length} subscription${state.subscriptions.length === 1 ? '' : 's'}`;
  const totalSeats    = rows.reduce((s, x) => s + x.c.total, 0);
  const assignedSeats = rows.reduce((s, x) => s + x.c.assigned, 0);
  const utilizedSeats = rows.reduce((s, x) => s + x.c.utilized, 0);
  document.getElementById('cons-assigned').textContent = `${assignedSeats} / ${totalSeats}`;
  // Weighted utilization = utilized-cost / license-cost
  const licenseCost  = rows.reduce((s, x) => s + monthlyCost(x.s), 0);
  const utilizedCost = rows.reduce((s, x) => s + (x.c.utilized / x.c.total) * monthlyCost(x.s), 0);
  const weightedPct  = licenseCost > 0 ? Math.round((utilizedCost / licenseCost) * 100) : 0;
  document.getElementById('cons-util').textContent = licenseCost > 0 ? `${weightedPct}%` : '—';
  const wastedMonthly = rows.reduce((s, x) => s + x.c.unusedCostMonthly, 0);
  document.getElementById('cons-wasted').textContent = formatMoney(wastedMonthly);
  document.getElementById('cons-wasted-sub').textContent = wastedMonthly > 0
    ? `${formatMoney(wastedMonthly * 12)}/yr if left in place`
    : 'no unused seats';

  const tbody = document.getElementById('cons-tbody');
  const empty = document.getElementById('cons-empty');
  empty.style.display = rows.length ? 'none' : 'block';
  tbody.innerHTML = rows.map(({ s, c }) => {
    const fillCls = c.utilizationPct >= 80 ? 'good' : c.utilizationPct >= 60 ? 'mid' : 'bad';
    const rowCls = c.unusedCostMonthly > 0 ? 'wasted' : '';
    return `<tr class="${rowCls}">
      <td><span class="vendor-name">${escapeHtml(s.name)}</span>${s.active === false ? ' <span class="badge">Paused</span>' : ''}</td>
      <td>${s.team ? `<span class="team-chip">${escapeHtml(s.team)}</span>` : '<span style="color:var(--text-dim)">—</span>'}</td>
      <td class="num">${c.total}</td>
      <td class="num">${c.assigned}</td>
      <td class="num">${c.utilized}</td>
      <td class="num">${c.unused}</td>
      <td>
        <div class="util-bar">
          <div class="util-track"><div class="util-fill ${fillCls}" style="width:${c.utilizationPct}%"></div></div>
          <span class="util-pct">${c.utilizationPct}%</span>
        </div>
      </td>
      <td class="num ${c.unusedCostMonthly > 0 ? 'pending-cell gt0' : ''}">${formatMoney(c.unusedCostMonthly)}</td>
      <td class="num ${c.unusedCostMonthly > 0 ? 'pending-cell gt0' : ''}">${formatMoney(c.unusedCostMonthly * 12)}</td>
      <td class="actions-cell"><button class="icon-btn" data-edit-cons="${s.id}">Edit seats</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-edit-cons]').forEach(b => b.onclick = () => openModal(b.dataset.editCons));
}

function renderVendorTotals() {
  const tbody = document.getElementById('vendor-tbody');
  const empty = document.getElementById('vendor-empty');
  if (!state.subscriptions.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const rows = state.subscriptions.map(s => {
    const invs = state.invoices.filter(i => i.subId === s.id);
    const paid = invs.filter(i => i.paidDate).reduce((sum, i) => sum + i.amount, 0);
    const pend = invs.filter(i => !i.paidDate).reduce((sum, i) => sum + i.amount, 0);
    const monthly = monthlyCost(s);
    return { s, invCount: invs.length, paid, pend, total: paid + pend, monthly };
  }).sort((a, b) => b.total - a.total || b.monthly - a.monthly);

  tbody.innerHTML = rows.map(r => {
    const c = consumption(r.s);
    let seatsCell = '<span style="color:var(--text-dim)">—</span>';
    let unusedCell = '<span style="color:var(--text-dim)">—</span>';
    if (c) {
      const cls = c.utilizationPct < 60 ? 'danger' : c.utilizationPct < 80 ? 'warn' : 'ok';
      seatsCell = `<span title="Assigned ${c.assigned} of ${c.total}">${c.utilized}/${c.total}</span> <span class="badge ${cls}">${c.utilizationPct}%</span>`;
      const uc = c.unusedCostMonthly;
      unusedCell = uc > 0 ? `<span class="pending-cell gt0">${formatMoney(uc)}</span>` : formatMoney(0);
    }
    return `
    <tr>
      <td><span class="vendor-name">${escapeHtml(r.s.name)}</span>${r.s.active === false ? ' <span class="badge">Paused</span>' : ''}</td>
      <td>${r.s.team ? `<span class="team-chip">${escapeHtml(r.s.team)}</span>` : '<span style="color:var(--text-dim)">—</span>'}</td>
      <td class="num">${formatMoney(r.monthly)}</td>
      <td class="num">${formatMoney(r.monthly * 12)}</td>
      <td class="num">${seatsCell}</td>
      <td class="num">${unusedCell}</td>
      <td class="num">${r.invCount}</td>
      <td class="num paid-cell ${r.paid > 0 ? 'gt0' : ''}">${formatMoney(r.paid)}</td>
      <td class="num pending-cell ${r.pend > 0 ? 'gt0' : ''}">${formatMoney(r.pend)}</td>
      <td class="num"><b>${formatMoney(r.total)}</b></td>
      <td class="actions-cell"><button class="icon-btn" data-new-inv="${r.s.id}" title="Log invoice for ${escapeHtml(r.s.name)}">+ Invoice</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-new-inv]').forEach(b => b.onclick = () => openInvModal(null, b.dataset.newInv));
}

function renderInvoices() {
  const tbody = document.getElementById('inv-tbody');
  const empty = document.getElementById('inv-empty');
  const vSel = document.getElementById('inv-filter-vendor');
  const sSel = document.getElementById('inv-filter-status');
  const currentV = vSel.value, currentS = sSel.value;
  vSel.innerHTML = '<option value="">All vendors</option>' + state.subscriptions.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  vSel.value = currentV;

  const statusRank = { overdue: 0, pending: 1, paid: 2 };
  const rows = state.invoices.filter(i => {
    if (currentV && i.subId !== currentV) return false;
    if (currentS && invoiceStatus(i) !== currentS) return false;
    return true;
  }).sort((a, b) => {
    const sa = statusRank[invoiceStatus(a)], sb = statusRank[invoiceStatus(b)];
    if (sa !== sb) return sa - sb;
    // within status: soonest due first for unpaid, most recent paid first for paid
    const da = parseDate(a.dueDate)?.getTime() ?? Infinity;
    const db = parseDate(b.dueDate)?.getTime() ?? Infinity;
    return invoiceStatus(a) === 'paid' ? db - da : da - db;
  });

  empty.style.display = rows.length ? 'none' : 'block';
  tbody.innerHTML = rows.map(i => {
    const st = invoiceStatus(i);
    const badgeCls = st === 'paid' ? 'ok' : st === 'overdue' ? 'danger' : 'warn';
    const badgeText = st === 'paid' ? `Paid ${formatDate(i.paidDate)}` : st === 'overdue' ? 'Overdue' : 'Pending';
    return `<tr>
      <td>${escapeHtml(subName(i.subId))}</td>
      <td>${subTeam(i.subId) ? `<span class="team-chip">${escapeHtml(subTeam(i.subId))}</span>` : '—'}</td>
      <td>${escapeHtml(i.invoiceNumber || '—')}</td>
      <td>${formatMoney(i.amount)}</td>
      <td>${i.issueDate ? formatDate(i.issueDate) : '—'}</td>
      <td>${formatDate(i.dueDate)}</td>
      <td><span class="badge ${badgeCls}">${badgeText}</span></td>
      <td class="actions-cell">
        ${st !== 'paid' ? `<button class="icon-btn" data-mark-paid="${i.id}">Mark paid</button>` : ''}
        <button class="icon-btn" data-edit-inv="${i.id}">Edit</button>
        <button class="icon-btn danger" data-delete-inv="${i.id}">Delete</button>
      </td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-mark-paid]').forEach(b => b.onclick = () => markPaid(b.dataset.markPaid));
  tbody.querySelectorAll('[data-edit-inv]').forEach(b => b.onclick = () => openInvModal(b.dataset.editInv));
  tbody.querySelectorAll('[data-delete-inv]').forEach(b => b.onclick = () => deleteInvoice(b.dataset.deleteInv));
}

function openInvModal(id, prefillSubId) {
  const inv = id ? state.invoices.find(i => i.id === id) : null;
  document.getElementById('inv-modal-title').textContent = inv ? 'Edit invoice' : 'Add invoice';
  document.getElementById('inv-id').value = inv?.id || '';
  const subSel = document.getElementById('inv-sub');
  subSel.innerHTML = '<option value="">Choose vendor…</option>' + state.subscriptions.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  const chosenSubId = inv?.subId || prefillSubId || document.getElementById('inv-filter-vendor')?.value || '';
  subSel.value = chosenSubId;
  // Prefill amount from the sub's stored cost when adding a new invoice
  const prefillSub = chosenSubId ? state.subscriptions.find(s => s.id === chosenSubId) : null;
  document.getElementById('inv-amount').value = inv?.amount ?? (prefillSub?.cost ?? '');
  document.getElementById('inv-number').value = inv?.invoiceNumber || '';
  document.getElementById('inv-issue').value = inv?.issueDate || '';
  document.getElementById('inv-due').value = inv?.dueDate || '';
  document.getElementById('inv-paid').value = inv?.paidDate || '';
  document.getElementById('inv-notes').value = inv?.notes || '';
  document.getElementById('inv-modal').hidden = false;
}
function closeInvModal() { document.getElementById('inv-modal').hidden = true; }

function handleInvSubmit(e) {
  e.preventDefault();
  const subId = document.getElementById('inv-sub').value;
  if (!subId) { alert('Pick a vendor.'); return; }
  const id = document.getElementById('inv-id').value || crypto.randomUUID();
  const inv = {
    id, subId,
    amount: parseFloat(document.getElementById('inv-amount').value) || 0,
    invoiceNumber: document.getElementById('inv-number').value.trim(),
    issueDate: document.getElementById('inv-issue').value || null,
    dueDate: document.getElementById('inv-due').value || null,
    paidDate: document.getElementById('inv-paid').value || null,
    notes: document.getElementById('inv-notes').value.trim(),
  };
  const idx = state.invoices.findIndex(i => i.id === id);
  if (idx >= 0) state.invoices[idx] = inv; else state.invoices.push(inv);
  save();
  renderAll();
  closeInvModal();
}

function markPaid(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;
  inv.paidDate = new Date().toISOString().slice(0, 10);
  save();
  renderAll();
}
function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  state.invoices = state.invoices.filter(i => i.id !== id);
  save();
  renderAll();
}

function renderContractBadges(s) {
  if (!s.contract) return '';
  const parts = [];
  if (s.contract.autoRenew) parts.push('<span class="badge warn" title="Auto-renews">Auto-renew</span>');
  if (s.contract.priceCapPct != null) parts.push(`<span class="badge" title="Price-increase cap">≤${s.contract.priceCapPct}%</span>`);
  return parts.length ? `<div class="contract-summary">${parts.join('')}</div>` : '';
}
function renderCancelBy(s) {
  const win = computeNoticeWindow(s);
  if (!win) return '';
  const cls = win.daysLeft < 0 ? 'danger' : win.daysLeft <= 7 ? 'danger' : win.daysLeft <= 30 ? 'warn' : 'ok';
  const label = win.daysLeft < 0
    ? `notice window passed`
    : `cancel by ${win.cancelBy.toLocaleDateString('en-US', { month:'short', day:'numeric' })} · ${win.daysLeft}d left`;
  return `<div style="margin-top:4px"><span class="badge ${cls}" title="Notice period: ${s.contract.noticeDays} days">${label}</span></div>`;
}

function renderRenewals() {
  const cal = document.getElementById('renewal-calendar');
  const now = new Date();
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
  });
  cal.innerHTML = months.map(m => {
    const subs = activeSubs()
      .map(s => ({ s, next: nextRenewal(s) }))
      .filter(x => x.next && x.next.getFullYear() === m.year && x.next.getMonth() === m.month)
      .sort((a,b) => a.next - b.next);
    const total = subs.reduce((sum, x) => sum + x.s.cost, 0);
    return `<div class="renewal-month">
      <h3>${m.label} · ${formatMoney(total)}</h3>
      ${subs.length ? '<ul>' + subs.map(({ s, next }) => {
        const win = computeNoticeWindow(s);
        const actby = win && win.daysLeft >= 0
          ? `<div class="day" style="color:var(--warning);margin-top:2px">act by ${win.cancelBy.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${win.daysLeft}d</div>`
          : '';
        return `<li>
          <div><div style="font-weight:600">${escapeHtml(s.name)}</div><div class="day">${formatDate(next.toISOString().slice(0,10))}</div>${actby}</div>
          <div style="font-weight:600">${formatMoney(s.cost)}</div>
        </li>`;
      }).join('') + '</ul>' : '<p class="empty" style="padding:16px 0;font-size:12px">No renewals</p>'}
    </div>`;
  }).join('');
}

function renderInsights() {
  const active = activeSubs();
  const top = [...active].sort((a,b) => monthlyCost(b) - monthlyCost(a)).slice(0, 5);
  document.getElementById('top-spend').innerHTML = top.length ? top.map(s => `
    <li>
      <div><div class="name">${escapeHtml(s.name)}</div><div class="meta">${escapeHtml(s.category || 'Uncategorized')}</div></div>
      <span class="amount">${formatMoney(monthlyCost(s))}/mo</span>
    </li>
  `).join('') : '<p class="empty">No data.</p>';

  const byCycle = {};
  active.forEach(s => { byCycle[s.cycle] = (byCycle[s.cycle] || 0) + monthlyCost(s); });
  const entries = Object.entries(byCycle).sort((a,b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  document.getElementById('cycle-chart').innerHTML = entries.length ? entries.map(([cycle, val]) => `
    <div class="chart-row">
      <span style="text-transform:capitalize">${cycle}</span>
      <div class="chart-bar"><div class="chart-bar-fill" style="width:${(val/max*100).toFixed(1)}%"></div></div>
      <span class="chart-value">${formatMoney(val)}/mo</span>
    </div>
  `).join('') : '<p class="empty">No data.</p>';

  // Recommendations
  const recos = [];
  const monthly = active.filter(s => s.cycle === 'monthly');
  if (monthly.length >= 3) {
    const savings = monthly.reduce((sum, s) => sum + s.cost * 12 * 0.15, 0);
    recos.push(`💡 <b>Switch monthly plans to yearly.</b> You have ${monthly.length} monthly subscriptions. Annual plans typically save ~15%, roughly <b>${formatMoney(savings)}/year</b>.`);
  }
  const dupCats = Object.entries(active.reduce((acc, s) => { const c = s.category || 'Uncategorized'; acc[c] = (acc[c] || 0) + 1; return acc; }, {})).filter(([,n]) => n >= 3);
  dupCats.forEach(([c, n]) => recos.push(`🔍 <b>${n} tools in ${escapeHtml(c)}.</b> Review whether you need all of them or if one can replace others.`));
  const expensive = active.filter(s => monthlyCost(s) > 100);
  expensive.forEach(s => recos.push(`💸 <b>${escapeHtml(s.name)}</b> is one of your bigger line items at ${formatMoney(monthlyCost(s))}/mo. Confirm active usage.`));
  const soon = active.filter(s => { const d = daysUntil(s.renewal); return d !== null && d >= 0 && d <= 7; });
  soon.forEach(s => recos.push(`⏰ <b>${escapeHtml(s.name)}</b> renews in ${daysUntil(s.renewal)} day(s). Cancel now if you won't use it.`));
  active.forEach(s => {
    if (!s.contract?.autoRenew || !s.contract.noticeDays || !s.renewal) return;
    const renewal = parseDate(s.renewal);
    const cancelBy = new Date(renewal); cancelBy.setDate(cancelBy.getDate() - s.contract.noticeDays);
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.round((cancelBy - today) / 86400000);
    if (days >= 0 && days <= 21) {
      recos.push(`📄 <b>${escapeHtml(s.name)}</b> auto-renews and requires ${s.contract.noticeDays} days' notice — decide by <b>${cancelBy.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</b>.`);
    }
  });
  // Missing renewal dates — the silent failure that breaks everything downstream
  const missingRenewal = active.filter(s => !s.renewal);
  if (missingRenewal.length) {
    recos.push(`🗓️ <b>${missingRenewal.length} subscription${missingRenewal.length === 1 ? '' : 's'} missing a renewal date</b> — add one to enable countdowns and reminders: ${missingRenewal.slice(0,5).map(s => escapeHtml(s.name)).join(', ')}${missingRenewal.length > 5 ? '…' : ''}.`);
  }

  // Price-hike detection: an unpaid invoice > expected per-period cost by ≥5%
  active.forEach(s => {
    const per = periodCost(s);
    if (!per) return;
    const invs = state.invoices.filter(i => i.subId === s.id);
    if (!invs.length) return;
    const latest = invs.sort((a,b) => (parseDate(b.dueDate) || 0) - (parseDate(a.dueDate) || 0))[0];
    if (!latest) return;
    const pctOver = (latest.amount - per) / per;
    if (pctOver >= 0.05) {
      const cap = s.contract?.priceCapPct;
      const capBreached = cap != null && pctOver * 100 > cap;
      const msg = capBreached
        ? `🚨 <b>${escapeHtml(s.name)}</b> latest invoice ${formatMoney(latest.amount)} is ${(pctOver*100).toFixed(1)}% over expected ${formatMoney(per)} — <b>above the ${cap}% contract cap</b>. Push back.`
        : `📈 <b>${escapeHtml(s.name)}</b> latest invoice ${formatMoney(latest.amount)} is ${(pctOver*100).toFixed(1)}% over your saved rate ${formatMoney(per)}${cap != null ? ` (contract cap ${cap}%)` : ''}. Confirm this isn't a stealth increase.`;
      recos.push(msg);
    }
  });

  // Utilization — unused seats
  const wasted = active.map(s => ({ s, c: consumption(s) })).filter(x => x.c && x.c.unusedCostMonthly > 0);
  if (wasted.length) {
    const total = wasted.reduce((sum, x) => sum + x.c.unusedCostMonthly, 0);
    const worst = [...wasted].sort((a,b) => b.c.unusedCostMonthly - a.c.unusedCostMonthly).slice(0, 3);
    recos.push(`💺 <b>${formatMoney(total)}/mo on unused seats</b> across ${wasted.length} vendor${wasted.length === 1 ? '' : 's'}. Biggest offenders: ${worst.map(x => `${escapeHtml(x.s.name)} (${x.c.utilizationPct}% used, ${formatMoney(x.c.unusedCostMonthly)}/mo)`).join(', ')}. Downgrade or reclaim seats before renewal.`);
  }

  // Overdue invoices summary
  const od = state.invoices.filter(i => invoiceStatus(i) === 'overdue');
  if (od.length) {
    const total = od.reduce((s, i) => s + i.amount, 0);
    recos.push(`❗ <b>${od.length} overdue invoice${od.length === 1 ? '' : 's'}</b> totaling ${formatMoney(total)}. Clear or dispute before finance closes the month.`);
  }

  if (!recos.length) recos.push('✅ Nothing jumping out — your subscription mix looks lean.');
  document.getElementById('recos').innerHTML = recos.map(r => `<li style="background:var(--panel-2);padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.5">${r}</li>`).join('');
}

function renderAll() {
  renderUrgencyStrip();
  renderDashboard();
  renderNoticeWindows();
  renderSubscriptions();
  renderInvoices();
  renderConsumption();
  renderAlerts();
  renderRenewals();
  renderInsights();
  slackAutoPost();
}

function renderUrgencyStrip() {
  const strip = document.getElementById('urgency-strip');
  const overdueCount = state.invoices.filter(i => invoiceStatus(i) === 'overdue').length;
  const urgentNotice = activeSubs().map(s => computeNoticeWindow(s)).filter(w => w && w.daysLeft >= 0 && w.daysLeft <= 14).length;
  const dueSoon = state.invoices.filter(i => {
    if (invoiceStatus(i) === 'paid') return false;
    const d = daysUntil(i.dueDate);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const chips = [];
  const alerts = computeAlerts();
  const escalatedAlerts = alerts.filter(a => a.status === 'escalated').length;
  const awaitingAck = alerts.filter(a => a.status === 'sent').length;
  if (overdueCount)     chips.push({ tier: 'danger', view: 'invoices', txt: `${overdueCount} overdue` });
  if (escalatedAlerts)  chips.push({ tier: 'danger', view: 'alerts',   txt: `${escalatedAlerts} escalated` });
  if (awaitingAck)      chips.push({ tier: 'warn',   view: 'alerts',   txt: `${awaitingAck} awaiting ack` });
  if (urgentNotice)     chips.push({ tier: 'warn',   view: 'dashboard',txt: `${urgentNotice} act-by soon` });
  if (dueSoon)          chips.push({ tier: 'warn',   view: 'invoices', txt: `${dueSoon} due in 7d` });
  const wastedMonthly = state.subscriptions.reduce((s, sub) => { const c = consumption(sub); return s + (c ? c.unusedCostMonthly : 0); }, 0);
  if (wastedMonthly > 0) chips.push({ tier: 'warn', view: 'consumption', txt: `${formatMoney(wastedMonthly)}/mo wasted` });
  strip.innerHTML = chips.map(c => `<button class="urgency-chip ${c.tier}" data-goto="${c.view}"><span class="dot"></span>${c.txt}</button>`).join('');
  strip.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => switchView(b.dataset.goto));
}

// -------- modal --------
function openModal(id) {
  const modal = document.getElementById('modal');
  const sub = id ? state.subscriptions.find(s => s.id === id) : null;
  document.getElementById('modal-title').textContent = sub ? 'Edit subscription' : 'Add subscription';
  document.getElementById('f-id').value = sub?.id || '';
  document.getElementById('f-name').value = sub?.name || '';
  document.getElementById('f-cost').value = sub?.cost ?? '';
  document.getElementById('f-cycle').value = sub?.cycle || 'monthly';
  document.getElementById('f-category').value = sub?.category || '';
  document.getElementById('f-renewal').value = sub?.renewal || '';
  document.getElementById('f-team').value = sub?.team || '';
  document.getElementById('f-url').value = sub?.url || '';
  document.getElementById('f-lic-total').value = sub?.licenses ?? '';
  document.getElementById('f-lic-assigned').value = sub?.assigned ?? '';
  document.getElementById('f-lic-utilized').value = sub?.utilized ?? '';
  document.getElementById('f-owner-name').value = sub?.owner?.name || '';
  document.getElementById('f-owner-email').value = sub?.owner?.email || '';
  document.getElementById('f-manager-name').value = sub?.manager?.name || '';
  document.getElementById('f-manager-email').value = sub?.manager?.email || '';
  document.getElementById('f-notes').value = sub?.notes || '';
  document.getElementById('f-active').checked = sub ? sub.active !== false : true;
  modal.hidden = false;
  setTimeout(() => document.getElementById('f-name').focus(), 50);
}
function closeModal() { document.getElementById('modal').hidden = true; }

function handleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('f-id').value || crypto.randomUUID();
  const sub = {
    id,
    name: document.getElementById('f-name').value.trim(),
    cost: parseFloat(document.getElementById('f-cost').value) || 0,
    cycle: document.getElementById('f-cycle').value,
    category: document.getElementById('f-category').value.trim(),
    renewal: document.getElementById('f-renewal').value || null,
    team: document.getElementById('f-team').value.trim(),
    url: document.getElementById('f-url').value.trim(),
    licenses:  parseInt(document.getElementById('f-lic-total').value, 10) || null,
    assigned:  parseInt(document.getElementById('f-lic-assigned').value, 10) || null,
    utilized:  parseInt(document.getElementById('f-lic-utilized').value, 10) || null,
    owner: {
      name: document.getElementById('f-owner-name').value.trim(),
      email: document.getElementById('f-owner-email').value.trim(),
    },
    manager: {
      name: document.getElementById('f-manager-name').value.trim(),
      email: document.getElementById('f-manager-email').value.trim(),
    },
    notes: document.getElementById('f-notes').value.trim(),
    active: document.getElementById('f-active').checked,
    contract: state.subscriptions.find(x => x.id === id)?.contract || null,
  };
  const idx = state.subscriptions.findIndex(s => s.id === id);
  const isNew = idx < 0;
  if (isNew) {
    const limit = PLANS[currentPlan()].subLimit;
    if (state.subscriptions.length >= limit) {
      if (confirm(`Free plan is capped at ${limit} subscriptions. Upgrade to Pro to keep adding?`)) {
        setPlan('pro');
      } else {
        return;
      }
    }
  }
  if (idx >= 0) state.subscriptions[idx] = sub;
  else state.subscriptions.push(sub);
  save();
  renderAll();
  closeModal();
}

function deleteSub(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;
  const invCount = state.invoices.filter(i => i.subId === id).length;
  const msg = invCount ? `Delete "${sub.name}" and ${invCount} invoice(s)?` : `Delete "${sub.name}"?`;
  if (!confirm(msg)) return;
  state.subscriptions = state.subscriptions.filter(s => s.id !== id);
  state.invoices = state.invoices.filter(i => i.subId !== id);
  save();
  renderAll();
}

// -------- alerts --------
const ALERT_TRIGGERS = [90, 60, 30]; // days before renewal
const ACK_GRACE_DAYS = 3;

function alertKey(subId, trigger, renewalISO) { return `${subId}:${trigger}:${renewalISO}`; }

// Returns the flat list of computed alerts for all active subs with a
// renewal date and an owner email. Each entry is: { sub, trigger, fireOn,
// renewalOn, log, status }.
function computeAlerts() {
  const today = new Date(); today.setHours(0,0,0,0);
  const out = [];
  activeSubs().forEach(sub => {
    if (!sub.owner?.email) return;
    const renewal = nextRenewal(sub);
    if (!renewal) return;
    const renewalISO = renewal.toISOString().slice(0, 10);
    ALERT_TRIGGERS.forEach(trigger => {
      const fireOn = new Date(renewal); fireOn.setDate(fireOn.getDate() - trigger);
      const key = alertKey(sub.id, trigger, renewalISO);
      const log = state.alertLog[key] || {};
      let status;
      if (log.ackAt) {
        status = 'acknowledged';
      } else if (fireOn > today) {
        status = 'scheduled';
      } else {
        // Trigger has fired. Auto-mark sentAt on first read if the log is empty.
        if (!log.sentAt) log.sentAt = fireOn.toISOString().slice(0, 10);
        const daysSinceFire = Math.round((today - fireOn) / 86400000);
        if (daysSinceFire >= ACK_GRACE_DAYS) status = 'escalated';
        else status = 'sent';
      }
      out.push({ sub, trigger, fireOn, renewalOn: renewal, key, log, status });
    });
  });
  out.sort((a, b) => a.fireOn - b.fireOn);
  return out;
}

function acknowledgeAlert(key, actor) {
  const log = state.alertLog[key] || {};
  log.ackAt = new Date().toISOString().slice(0, 10);
  log.ackBy = actor || 'user';
  state.alertLog[key] = log;
  save(); renderAll();
}
function escalateAlert(key) {
  const log = state.alertLog[key] || {};
  log.escalatedAt = new Date().toISOString().slice(0, 10);
  if (!log.sentAt) log.sentAt = log.escalatedAt;
  state.alertLog[key] = log;
  save(); renderAll();
}
function unacknowledgeAlert(key) {
  const log = state.alertLog[key] || {};
  delete log.ackAt; delete log.ackBy;
  state.alertLog[key] = log;
  save(); renderAll();
}

function alertRecipients(a) {
  if (a.status === 'escalated' && a.sub.manager?.email) {
    return { to: [a.sub.manager.email], cc: a.sub.owner?.email ? [a.sub.owner.email] : [], primary: a.sub.manager };
  }
  return { to: a.sub.owner?.email ? [a.sub.owner.email] : [], cc: [], primary: a.sub.owner };
}
function alertSubject(a) {
  return `Renewal decision needed: ${a.sub.name} in ${a.trigger} days (${formatMoney(a.sub.cost)})`;
}
function alertBody(a) {
  const win = computeNoticeWindow(a.sub);
  const lines = [
    `${a.sub.name} renews on ${formatDate(a.renewalOn.toISOString().slice(0,10))} — ${a.trigger} days from ${formatDate(a.fireOn.toISOString().slice(0,10))}.`,
    ``,
    `Amount: ${formatMoney(a.sub.cost)} / ${a.sub.cycle}`,
    a.sub.team ? `Team: ${a.sub.team}` : null,
    a.sub.category ? `Category: ${a.sub.category}` : null,
    a.sub.contract?.autoRenew ? `Contract: auto-renews${a.sub.contract.noticeDays ? `, requires ${a.sub.contract.noticeDays} days' notice to cancel` : ''}` : null,
    a.sub.contract?.priceCapPct != null ? `Price-increase cap: ${a.sub.contract.priceCapPct}%` : null,
    win && win.daysLeft >= 0 ? `Act by: ${formatDate(win.cancelBy.toISOString().slice(0,10))} (${win.daysLeft} days from today)` : null,
    ``,
    `Please decide: renew, renegotiate, or cancel. Reply to acknowledge.`,
    a.status === 'escalated' ? `\nThis is an ESCALATION — the owner did not acknowledge within ${ACK_GRACE_DAYS} days.` : ``,
  ].filter(x => x !== null);
  return lines.join('\n');
}
function alertMailto(a) {
  const r = alertRecipients(a);
  if (!r.to.length) return null;
  const params = new URLSearchParams();
  params.set('subject', alertSubject(a));
  params.set('body', alertBody(a));
  if (r.cc.length) params.set('cc', r.cc.join(','));
  return `mailto:${r.to.join(',')}?${params.toString().replace(/\+/g, '%20')}`;
}
function alertSlackPayload(a) {
  const r = alertRecipients(a);
  const audience = r.primary ? `<@${r.primary.name || 'owner'}>` : '';
  return {
    text: `Renewal decision needed — ${a.sub.name}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${a.status === 'escalated' ? '🚨 ESCALATION · ' : ''}${a.sub.name} renews in ${a.trigger} days` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Amount:*\n${formatMoney(a.sub.cost)} / ${a.sub.cycle}` },
        { type: 'mrkdwn', text: `*Renews:*\n${formatDate(a.renewalOn.toISOString().slice(0,10))}` },
        { type: 'mrkdwn', text: `*Owner:*\n${a.sub.owner?.name || a.sub.owner?.email || '—'}` },
        { type: 'mrkdwn', text: `*Team:*\n${a.sub.team || '—'}` },
      ] },
      { type: 'section', text: { type: 'mrkdwn', text: `${audience} Please decide — renew, renegotiate, or cancel. Then acknowledge in SaaS Spend Track.` } },
    ],
  };
}
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const o = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = o; }, 1200);
    }
  }, () => alert('Copy failed. Selection is in your clipboard? Try again.'));
}

function statusPill(status) {
  const map = {
    scheduled:    { cls: '',       txt: 'Scheduled' },
    sent:         { cls: 'warn',   txt: 'Awaiting ack' },
    escalated:    { cls: 'danger', txt: 'Escalated' },
    acknowledged: { cls: 'ok',     txt: 'Acknowledged' },
  }[status] || { cls: '', txt: status };
  return `<span class="badge ${map.cls}">${map.txt}</span>`;
}

function renderAlerts() {
  const alerts = computeAlerts();
  const filter = document.getElementById('alert-filter').value;
  const filtered = alerts.filter(a => {
    if (!filter) return true;
    if (filter === 'due') return a.status === 'sent' || a.status === 'escalated';
    return a.status === filter;
  });

  document.getElementById('alerts-scheduled').textContent   = alerts.filter(a => a.status === 'scheduled').length;
  document.getElementById('alerts-due').textContent         = alerts.filter(a => (a.status === 'sent' || a.status === 'escalated') && !a.log.ackAt).length;
  document.getElementById('alerts-awaiting').textContent    = alerts.filter(a => a.status === 'sent').length;
  document.getElementById('alerts-escalated').textContent   = alerts.filter(a => a.status === 'escalated').length;

  const empty = document.getElementById('alerts-empty');
  const tbody = document.getElementById('alerts-tbody');
  empty.style.display = filtered.length ? 'none' : 'block';
  if (!filtered.length) { tbody.innerHTML = ''; return; }

  tbody.innerHTML = filtered.map((a, idx) => {
    const owner = a.sub.owner;
    const mgr = a.sub.manager;
    const ownerCell = owner?.email
      ? `<div class="alert-contact"><b>${escapeHtml(owner.name || owner.email)}</b><br>${escapeHtml(owner.email)}</div>`
      : `<div class="alert-contact missing">No owner set</div>`;
    const mgrCell = mgr?.email
      ? `<div class="alert-contact"><b>${escapeHtml(mgr.name || mgr.email)}</b><br>${escapeHtml(mgr.email)}</div>`
      : `<div class="alert-contact missing">No manager set</div>`;

    const canSend = alertMailto(a) !== null;
    const isAck = a.status === 'acknowledged';
    const hasSlack = !!slackWebhook();
    const actions = [
      canSend ? `<a class="icon-btn" href="${alertMailto(a)}" title="Compose email in your mail app">Email</a>` : '',
      hasSlack
        ? `<button class="icon-btn" data-slack-send="${idx}" title="Post this alert to your Slack channel">Send to Slack</button>`
        : `<button class="icon-btn" data-slack="${idx}" title="Copy Slack Block Kit JSON">Copy Slack JSON</button>`,
      isAck
        ? `<button class="icon-btn" data-unack="${a.key}">Undo ack</button>`
        : `<button class="icon-btn" data-ack="${a.key}">Acknowledge</button>`,
      (!isAck && a.status !== 'escalated' && mgr?.email) ? `<button class="icon-btn danger" data-esc="${a.key}">Escalate now</button>` : '',
    ].filter(Boolean).join('');

    const trigCls = a.trigger === 30 ? 'd30' : a.trigger === 60 ? 'd60' : 'd90';
    const fireISO = a.fireOn.toISOString().slice(0, 10);
    const renewISO = a.renewalOn.toISOString().slice(0, 10);
    const dayFromNow = Math.round((a.fireOn - new Date(new Date().setHours(0,0,0,0))) / 86400000);
    const fireLabel = dayFromNow > 0 ? `in ${dayFromNow}d` : dayFromNow === 0 ? 'today' : `${Math.abs(dayFromNow)}d ago`;

    return `<tr>
      <td><b>${escapeHtml(a.sub.name)}</b>${a.sub.team ? `<div class="alert-contact">${escapeHtml(a.sub.team)}</div>` : ''}</td>
      <td><span class="alert-trigger ${trigCls}">T-${a.trigger}d</span></td>
      <td>${formatDate(fireISO)}<div class="alert-contact">${fireLabel}</div></td>
      <td>${formatDate(renewISO)}<div class="alert-contact">${formatMoney(a.sub.cost)}</div></td>
      <td>${ownerCell}</td>
      <td>${mgrCell}</td>
      <td>${statusPill(a.status)}${a.log.ackAt ? `<div class="alert-contact">${escapeHtml(a.log.ackAt)}</div>` : a.log.escalatedAt ? `<div class="alert-contact">escalated ${escapeHtml(a.log.escalatedAt)}</div>` : ''}</td>
      <td><div class="alert-actions">${actions}</div></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-ack]').forEach(b => b.onclick = () => acknowledgeAlert(b.dataset.ack));
  tbody.querySelectorAll('[data-unack]').forEach(b => b.onclick = () => unacknowledgeAlert(b.dataset.unack));
  tbody.querySelectorAll('[data-esc]').forEach(b => b.onclick = () => { if (confirm('Escalate to manager now?')) escalateAlert(b.dataset.esc); });
  tbody.querySelectorAll('[data-slack]').forEach(b => {
    const a = filtered[+b.dataset.slack];
    b.onclick = () => copyToClipboard(JSON.stringify(alertSlackPayload(a), null, 2), b);
  });
  tbody.querySelectorAll('[data-slack-send]').forEach(b => {
    const a = filtered[+b.dataset.slackSend];
    b.onclick = () => slackSendAlert(a, b);
  });
}

function icsDate(d) {
  const iso = new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return iso;
}
function downloadIcs() {
  const alerts = computeAlerts().filter(a => a.status !== 'acknowledged');
  if (!alerts.length) { alert('No unacknowledged alerts to export.'); return; }
  const now = new Date();
  const events = alerts.map(a => {
    const start = new Date(a.fireOn); start.setHours(9, 0, 0, 0);
    const end = new Date(start); end.setHours(9, 30, 0, 0);
    const uid = `alert-${a.key}@saasspendtrack`;
    const desc = alertBody(a).replace(/\n/g, '\\n');
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${alertSubject(a).replace(/[\n,;]/g, ' ')}`,
      `DESCRIPTION:${desc}`,
      a.sub.owner?.email ? `ATTENDEE;CN=${(a.sub.owner.name || a.sub.owner.email).replace(/[,;]/g,' ')}:mailto:${a.sub.owner.email}` : null,
      `BEGIN:VALARM`,
      `TRIGGER:-PT9H`,
      `ACTION:DISPLAY`,
      `DESCRIPTION:${alertSubject(a).replace(/[\n,;]/g, ' ')}`,
      `END:VALARM`,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  }).join('\r\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SaaS Spend Track//EN',
    'CALSCALE:GREGORIAN',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
  downloadFile('saas-spendtrack-alerts.ics', ics, 'text/calendar;charset=utf-8');
}

// -------- integrations: Slack --------
function slackWebhook() { return state.settings.slackWebhook || ''; }
async function slackSend(payload) {
  const url = slackWebhook();
  if (!url) throw new Error('No webhook configured.');
  // Slack incoming webhooks return CORS headers that allow browser POSTs.
  // Response body is usually 'ok' plaintext.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Slack ${res.status}: ${text || 'error'}`);
  return text;
}
async function slackTest(btn) {
  const status = document.getElementById('slack-status');
  status.textContent = ''; status.className = 'integ-status';
  if (!slackWebhook()) { status.textContent = 'Add a webhook URL first.'; status.className = 'integ-status err'; return; }
  btn.disabled = true;
  try {
    await slackSend({
      text: '✅ SaaS Spend Track connected.',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*✅ SaaS Spend Track is connected.* Renewal alerts will land here.' } }],
    });
    status.textContent = 'Delivered.';
    status.className = 'integ-status ok';
  } catch (e) {
    status.textContent = e.message;
    status.className = 'integ-status err';
  } finally { btn.disabled = false; }
}
async function slackSendAlert(alert, btn) {
  if (!slackWebhook()) { alert && alert(); return; }
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    await slackSend(alertSlackPayload(alert));
    if (btn) btn.textContent = 'Sent ✓';
  } catch (e) {
    if (btn) btn.textContent = 'Failed';
    console.error(e);
  } finally {
    if (btn) setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1400);
  }
}
// Auto-post: called after computeAlerts on renderAll. Fires once per alert key.
async function slackAutoPost() {
  if (!state.settings.slackAuto || !slackWebhook()) return;
  const alerts = computeAlerts();
  const dueForAuto = alerts.filter(a =>
    (a.status === 'sent' || a.status === 'escalated') &&
    !state.settings.autoSentAlerts[a.key]
  );
  for (const a of dueForAuto) {
    try {
      await slackSend(alertSlackPayload(a));
      state.settings.autoSentAlerts[a.key] = new Date().toISOString();
    } catch (e) {
      console.warn('Auto-post failed for', a.key, e);
      break; // don't hammer a bad webhook
    }
  }
  save();
}

// -------- integrations: bulk contract import --------
let stagedImports = [];

function parseFilename(name) {
  // "HubSpot_MSA_2026.txt" -> "HubSpot MSA 2026" -> best-effort vendor: first token
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const vendor = base.split(/\s+/)[0] || base;
  return { vendor, base };
}

async function readContractFile(f) {
  const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
  if (isPdf) {
    try {
      return { file: f, text: await extractTextFromPdf(await f.arrayBuffer()), error: null };
    } catch (e) {
      return { file: f, text: '', error: e.message };
    }
  }
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res({ file: f, text: r.result, error: null });
    r.onerror = () => res({ file: f, text: '', error: 'File read failed' });
    r.readAsText(f);
  });
}

async function stageContractFiles(files) {
  const results = await Promise.all([...files].map(readContractFile));
  results.forEach(({ file, text, error }) => {
    const { vendor } = parseFilename(file.name);
    if (error) {
      stagedImports.push({
        id: crypto.randomUUID(),
        filename: file.name,
        name: vendor,
        extracted: { renewalType: null, noticePeriod: null, termLength: null, priceCap: null },
        error,
        textLen: 0,
      });
      return;
    }
    const extracted = extractContract(text);
    stagedImports.push({
      id: crypto.randomUUID(),
      filename: file.name,
      name: vendor,
      extracted,
      textLen: text.length,
    });
  });
  renderImportPreview();
}

function renderImportPreview() {
  const box = document.getElementById('import-preview');
  const confirmBtn = document.getElementById('import-confirm');
  if (!stagedImports.length) {
    box.hidden = true;
    confirmBtn.disabled = true;
    return;
  }
  box.hidden = false;
  confirmBtn.disabled = false;
  box.innerHTML = stagedImports.map(s => {
    let detected;
    if (s.error) {
      detected = `<span style="color:var(--danger)">${escapeHtml(s.error)}</span>`;
    } else {
      const bits = [];
      if (s.extracted.renewalType) bits.push(s.extracted.renewalType.value);
      if (s.extracted.noticePeriod) bits.push(`${s.extracted.noticePeriod.days}d notice`);
      if (s.extracted.termLength) bits.push(s.extracted.termLength.value);
      if (s.extracted.priceCap) bits.push(`≤${s.extracted.priceCap.pct}% cap`);
      detected = bits.length ? bits.join(' · ') : '<span style="color:var(--warning)">no clauses detected</span>';
    }
    return `<div class="stage-row">
      <div><div class="stage-name">${escapeHtml(s.name)}</div><div class="stage-meta">${escapeHtml(s.filename)} · ${detected}</div></div>
      <button class="stage-drop" data-drop="${s.id}">remove</button>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
    stagedImports = stagedImports.filter(s => s.id !== b.dataset.drop);
    renderImportPreview();
  });
}

function confirmImport() {
  if (!stagedImports.length) return;
  stagedImports.forEach(s => {
    if (s.error) return;
    // Skip duplicates by name
    if (state.subscriptions.some(x => x.name.toLowerCase() === s.name.toLowerCase())) return;
    const e = s.extracted;
    const contract = (e.renewalType || e.noticePeriod || e.termLength || e.priceCap) ? {
      renewalType: e.renewalType?.value || null,
      autoRenew: e.renewalType?.value === 'Auto-renew',
      noticeDays: e.noticePeriod?.days || null,
      termLength: e.termLength?.value || null,
      priceCapPct: e.priceCap?.pct ?? null,
    } : null;
    state.subscriptions.push({
      id: crypto.randomUUID(),
      name: s.name,
      cost: 0,
      cycle: 'monthly',
      category: '',
      team: '',
      renewal: null,
      notes: `Imported from ${s.filename}`,
      active: true,
      contract,
    });
  });
  const n = stagedImports.length;
  stagedImports = [];
  save();
  renderAll();
  renderImportPreview();
  alert(`Staged ${n} subscription${n === 1 ? '' : 's'}. Add a cost and renewal date in the Subscriptions tab to activate alerts.`);
  switchView('subscriptions');
}

// -------- integrations: SSO / ERP request stub --------
function requestEnterprise(kind, statusEl) {
  statusEl.textContent = `Request logged — we'll reach out to enable ${kind}.`;
  statusEl.className = 'integ-status ok';
}
function exportErpCsv() {
  // Combined header including vendor + AP-ready invoice rows.
  const headers = ['vendor','vendor_email','team','category','cycle','recurring_amount','contract_end_date','notice_days','price_cap_pct','last_paid_amount','last_paid_date','last_invoice_number','open_ap_amount'];
  const rows = state.subscriptions.map(s => {
    const invs = state.invoices.filter(i => i.subId === s.id);
    const paid = invs.filter(i => i.paidDate).sort((a,b) => (parseDate(b.paidDate) || 0) - (parseDate(a.paidDate) || 0));
    const open = invs.filter(i => !i.paidDate).reduce((sum, i) => sum + i.amount, 0);
    const last = paid[0];
    return [
      s.name, s.owner?.email || '', s.team || '', s.category || '', s.cycle, s.cost,
      nextRenewalISO(s) || '', s.contract?.noticeDays ?? '', s.contract?.priceCapPct ?? '',
      last?.amount ?? '', last?.paidDate || '', last?.invoiceNumber || '', open || 0,
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  downloadFile('erp-ready-vendors.csv', csv, 'text/csv;charset=utf-8');
}

// -------- PDF text extraction --------
// Lightweight browser-side PDF text extractor. Uses DecompressionStream to
// inflate FlateDecode streams and pulls text from PDF content operators.
// Works for text-based PDFs (most e-signed / native-exported contracts);
// scanned images need OCR and we bail with a helpful error.

async function inflateBytes(bytes) {
  const blob = new Blob([bytes]);
  const stream = blob.stream().pipeThrough(new DecompressionStream('deflate'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); total += value.length;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

function decodePdfStringLit(s) {
  return s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b').replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}

function decodePdfHex(hex) {
  hex = hex.replace(/\s+/g, '');
  if (hex.length % 2) hex += '0';
  let str = '';
  for (let i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return str;
}

function extractPdfOperators(content) {
  const out = [];
  // Text-showing operators: Tj, TJ, ', "
  // Case (a): (literal) Tj  or  (literal) '  or  (literal) "
  const litRe = /\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|TJ|'|")/g;
  let m;
  while ((m = litRe.exec(content))) out.push(decodePdfStringLit(m[1]));
  // Case (b): [ (a) 25 (b) -10 (c) ] TJ
  const arrRe = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = arrRe.exec(content))) {
    const inner = m[1];
    const innerLit = /\(((?:\\[\s\S]|[^\\()])*)\)/g;
    const innerHex = /<([0-9A-Fa-f\s]+)>/g;
    let sm;
    while ((sm = innerLit.exec(inner))) out.push(decodePdfStringLit(sm[1]));
    while ((sm = innerHex.exec(inner))) out.push(decodePdfHex(sm[1]));
  }
  // Case (c): <hex> Tj
  const hexRe = /<([0-9A-Fa-f\s]+)>\s*(?:Tj|'|")/g;
  while ((m = hexRe.exec(content))) out.push(decodePdfHex(m[1]));
  return out.join(' ');
}

async function extractTextFromPdf(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new Error('Not a PDF file (missing %PDF header)');
  }
  // Latin-1 view of the binary — every byte becomes one JS char so regex works
  let raw = '';
  const CHUNK = 65536;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    raw += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }

  const parts = [];
  const streamRe = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let m;
  while ((m = streamRe.exec(raw))) {
    // Find the object dictionary preceding this stream
    const dictEnd = m.index;
    const dictStart = raw.lastIndexOf('<<', dictEnd);
    const dict = dictStart >= 0 ? raw.slice(dictStart, dictEnd) : '';
    let body = m[1];
    if (/\/Filter\s*(?:\/FlateDecode|\[\s*\/FlateDecode)/.test(dict) || /\/FlateDecode/.test(dict)) {
      try {
        const buf = new Uint8Array(body.length);
        for (let i = 0; i < body.length; i++) buf[i] = body.charCodeAt(i) & 0xff;
        const infl = await inflateBytes(buf);
        body = '';
        for (let i = 0; i < infl.length; i += CHUNK) {
          body += String.fromCharCode.apply(null, infl.subarray(i, i + CHUNK));
        }
      } catch (_) { continue; } // skip streams we can't decompress
    } else if (/\/Filter\s*\//.test(dict) && !/\/FlateDecode/.test(dict)) {
      // Non-Flate filter (LZW / DCT / JBIG2) — image or exotic, skip
      continue;
    }
    if (/Tj|TJ|'|"/.test(body)) {
      parts.push(extractPdfOperators(body));
    }
  }

  let text = parts.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (!text || text.length < 40) {
    throw new Error("Couldn't extract text — the PDF may be a scanned image or use unsupported encoding. Try copying the text into the box, or use a text-based export.");
  }
  return text;
}

// -------- contract extractor --------
// Rule-based clause extractor. Returns { field: { value, snippet } | null }.
const WORD_NUMS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, twenty:20, thirty:30, sixty:60, ninety:90 };
function wordToNum(s) { if (!s) return null; s = s.toLowerCase(); return WORD_NUMS[s] ?? (isNaN(+s) ? null : +s); }

function findMatch(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m;
  }
  return null;
}
function snippetAround(text, matchIndex, matchLen, radius = 90) {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + matchLen + radius);
  let s = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) s = '…' + s;
  if (end < text.length) s = s + '…';
  return s;
}

function extractRenewalType(text) {
  const negative = [
    /\b(shall|will|does)\s+not\s+(automatically\s+)?renew\b/i,
    /\bno\s+auto(matic)?[-\s]?renewal\b/i,
    /\brenewal\s+(only\s+)?upon\s+(mutual\s+)?(written\s+)?(consent|agreement)\b/i,
    /\brequires\s+(mutual\s+)?(written\s+)?(consent|agreement)\s+to\s+renew\b/i,
  ];
  const positive = [
    /\bautomatically\s+renew(s|ed|al)?\b/i,
    /\bauto[-\s]?renew(s|ed|al)?\b/i,
    /\b(shall|will)\s+renew\s+for\s+(successive|additional)\b/i,
    /\bevergreen\b/i,
    /\brenewal\s+term(s)?\b/i,
  ];
  const nm = findMatch(text, negative);
  if (nm) return { value: 'Manual renewal', snippet: snippetAround(text, nm.index, nm[0].length) };
  const pm = findMatch(text, positive);
  if (pm) return { value: 'Auto-renew', snippet: snippetAround(text, pm.index, pm[0].length) };
  return null;
}

function extractNoticePeriod(text) {
  // Prefer parenthetical number: "sixty (60) days"
  const patterns = [
    /\((\d{1,3})\)\s*(day|week|month)s?['’]?\s+(prior\s+|advance\s+)?(written\s+)?notice/i,
    /(?:at\s+least\s+|no\s+less\s+than\s+|minimum\s+of\s+|not\s+less\s+than\s+)?(\d{1,3})\s+(day|week|month)s?['’]?\s+(prior\s+|advance\s+)?(written\s+)?notice/i,
    /(?:at\s+least\s+|no\s+less\s+than\s+)?(thirty|sixty|ninety|forty[-\s]five|one\s+hundred(?:\s+twenty)?)\s+(day|week|month)s?['’]?\s+(prior\s+|advance\s+)?(written\s+)?notice/i,
    /notice\s+of\s+(?:at\s+least\s+|no\s+less\s+than\s+)?(?:\w+\s+)?\((\d{1,3})\)\s*(day|week|month)s?/i,
    /notice\s+of\s+(?:at\s+least\s+|no\s+less\s+than\s+)?(\d{1,3}|thirty|sixty|ninety)\s+(day|week|month)s?/i,
    /(\d{1,3})\s+(day|week|month)s?\s+before\s+(the\s+)?(end|expiration|renewal)/i,
  ];
  const m = findMatch(text, patterns);
  if (!m) return null;
  const rawNum = m[1].replace(/[-\s]+/g, ' ').trim();
  let num = wordToNum(rawNum);
  if (num === null) {
    if (/forty\s*five/i.test(rawNum)) num = 45;
    else if (/one\s+hundred\s+twenty/i.test(rawNum)) num = 120;
    else if (/one\s+hundred/i.test(rawNum)) num = 100;
  }
  if (num === null) return null;
  const unit = m[2].toLowerCase();
  const days = unit.startsWith('day') ? num : unit.startsWith('week') ? num * 7 : num * 30;
  return { value: `${num} ${unit}${num === 1 ? '' : 's'} (~${days} days)`, days, snippet: snippetAround(text, m.index, m[0].length) };
}

function extractTermLength(text) {
  // Prefer parenthetical form: "two (2) years"
  const patterns = [
    /initial\s+term[^.]{0,80}?\((\d+)\)\s*(month|year)s?/i,
    /initial\s+term[^.]{0,80}?(one|two|three|four|five|six|seven|eight|nine|ten)\s+(month|year)s?/i,
    /initial\s+term[^.]{0,80}?(\d+)\s+(month|year)s?/i,
    /(?:subscription|service)\s+term\s+of\s+\(?(\d+)\)?\s*(month|year)s?/i,
    /(?:subscription|service)\s+term\s+of\s+(one|two|three|four|five)\s+(month|year)s?/i,
    /term\s+of\s+\(?(\d+)\)?\s*(month|year)s?/i,
    /(\d+|one|two|three|four|five)[-\s](year|month)\s+(initial\s+)?term/i,
  ];
  const m = findMatch(text, patterns);
  if (!m) return null;
  const num = wordToNum(m[1]);
  if (num === null) return null;
  const unit = m[2].toLowerCase();
  return { value: `${num} ${unit}${num === 1 ? '' : 's'}`, months: unit === 'year' ? num * 12 : num, snippet: snippetAround(text, m.index, m[0].length) };
}

function extractPriceCap(text) {
  const patterns = [
    /(?:price|fee|rate|charges?)\s+(?:increase[s]?|escalation|adjustment)[^.]{0,160}?(?:not\s+(?:to\s+)?exceed|shall\s+not\s+exceed|capped\s+at|limited\s+to|no\s+more\s+than)[^.]{0,40}?\((\d+(?:\.\d+)?)\s*%\)/i,
    /(?:price|fee|rate|charges?)\s+(?:increase[s]?|escalation|adjustment)[^.]{0,160}?(?:not\s+(?:to\s+)?exceed|shall\s+not\s+exceed|capped\s+at|limited\s+to|no\s+more\s+than)[^.]{0,40}?(\d+(?:\.\d+)?)\s*%/i,
    /(?:annual\s+)?(?:increase|escalation)[^.]{0,120}?(?:capped\s+at|limited\s+to|not\s+(?:to\s+)?exceed)[^.]{0,20}?(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s+(?:annual\s+)?(?:cap|maximum)\s+on\s+(?:price|fee|rate)/i,
    /(?:price|fee|rate)[^.]{0,60}(?:will\s+not|shall\s+not)\s+increase[^.]{0,60}?(\d+(?:\.\d+)?)\s*%/i,
  ];
  const m = findMatch(text, patterns);
  if (!m) return null;
  return { value: `${m[1]}%`, pct: parseFloat(m[1]), snippet: snippetAround(text, m.index, m[0].length) };
}

function extractContract(text) {
  return {
    renewalType: extractRenewalType(text),
    noticePeriod: extractNoticePeriod(text),
    termLength: extractTermLength(text),
    priceCap: extractPriceCap(text),
  };
}

function renderExtract(result) {
  const items = [
    { key: 'renewalType', label: 'Renewal type', missing: 'Not detected — assume auto-renew and confirm with counterparty.' },
    { key: 'noticePeriod', label: 'Notice period to cancel', missing: 'Not detected.' },
    { key: 'termLength', label: 'Term length', missing: 'Not detected.' },
    { key: 'priceCap', label: 'Price-escalation cap', missing: 'No cap detected — renewal price could rise unlimited.' },
  ];
  const box = document.getElementById('extract-results');
  box.innerHTML = items.map(it => {
    const r = result[it.key];
    if (r) return `<div class="extract-item">
      <span class="label">${it.label}</span>
      <span class="value">${escapeHtml(r.value)}</span>
      <span class="snippet">${escapeHtml(r.snippet)}</span>
    </div>`;
    return `<div class="extract-item miss">
      <span class="label">${it.label}</span>
      <span class="value">${escapeHtml(it.missing)}</span>
    </div>`;
  }).join('');

  // Populate attach dropdown
  const found = Object.values(result).some(v => v);
  const attach = document.getElementById('attach-row');
  attach.hidden = !found;
  if (found) {
    const sel = document.getElementById('attach-sub');
    const btn = document.getElementById('attach-btn');
    if (state.subscriptions.length === 0) {
      sel.innerHTML = '<option value="">No subscriptions yet — add one first</option>';
      sel.disabled = true;
      btn.disabled = true;
    } else {
      sel.innerHTML = '<option value="">Attach to subscription…</option>' +
        state.subscriptions.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      sel.disabled = false;
      btn.disabled = false;
    }
  }
  window._lastExtract = result;
}

function attachToSub() {
  const id = document.getElementById('attach-sub').value;
  const result = window._lastExtract;
  if (!result) { alert('Extract clauses first.'); return; }
  if (!id) { alert('Pick a subscription from the dropdown first.'); return; }
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) { alert('That subscription no longer exists.'); return; }
  sub.contract = {
    renewalType: result.renewalType?.value || null,
    autoRenew: result.renewalType?.value === 'Auto-renew',
    noticeDays: result.noticePeriod?.days || null,
    termLength: result.termLength?.value || null,
    priceCapPct: result.priceCap?.pct ?? null,
  };
  save();
  renderAll();
  switchView('subscriptions');
  const btn = document.getElementById('attach-btn');
  const orig = btn.textContent;
  btn.textContent = `Saved to ${sub.name} ✓`;
  setTimeout(() => { btn.textContent = orig; }, 2200);
}

const SAMPLE_CONTRACT = `MASTER SUBSCRIPTION AGREEMENT

Section 4. Term and Renewal. The initial term of this Agreement shall be two (2) years commencing on the Effective Date (the "Initial Term"). Thereafter, this Agreement shall automatically renew for successive one-year renewal terms unless either party provides at least sixty (60) days' prior written notice of non-renewal before the end of the then-current term.

Section 5. Fees. Fees for the Services are set forth in the applicable Order Form. Provider may increase the Fees upon renewal; provided, however, that any such price increase shall not exceed seven percent (7%) per annum over the Fees charged in the immediately preceding term.

Section 12. Termination for Convenience. Customer may terminate this Agreement for convenience only at the end of the then-current term by providing the notice described in Section 4.`;

// -------- utils --------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function seed() {
  if (state.subscriptions.length && !confirm('Replace current data with sample subscriptions?')) return;
  const today = new Date();
  const future = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  state.subscriptions = [
    { id: crypto.randomUUID(), name: 'Figma',        cost: 15,    cycle: 'monthly', category: 'Design',        team: 'Design',      renewal: future(4),  notes: 'Professional plan', active: true,
      licenses: 12, assigned: 10, utilized: 9 },
    { id: crypto.randomUUID(), name: 'Notion',       cost: 96,    cycle: 'yearly',  category: 'Productivity',  team: 'Ops',         renewal: future(45), notes: 'Team plan', active: true },
    { id: crypto.randomUUID(), name: 'GitHub',       cost: 4,     cycle: 'monthly', category: 'Development',   team: 'Engineering', renewal: future(12), notes: 'Pro', active: true },
    { id: crypto.randomUUID(), name: 'Vercel',       cost: 20,    cycle: 'monthly', category: 'Development',   team: 'Engineering', renewal: future(18), notes: '', active: true },
    { id: crypto.randomUUID(), name: 'ChatGPT Plus', cost: 20,    cycle: 'monthly', category: 'AI / LLM',      team: 'Engineering', renewal: future(6),  notes: '', active: true },
    { id: crypto.randomUUID(), name: 'Claude Pro',   cost: 20,    cycle: 'monthly', category: 'AI / LLM',      team: 'Engineering', renewal: future(22), notes: '', active: true },
    { id: crypto.randomUUID(), name: 'Slack',        cost: 87.5,  cycle: 'monthly', category: 'Communication', team: 'Ops',         renewal: future(9),  notes: '', active: true,
      licenses: 25, assigned: 22, utilized: 14 },
    { id: crypto.randomUUID(), name: 'Google Workspace', cost: 72, cycle: 'yearly', category: 'Productivity',  team: 'Ops',         renewal: future(120),notes: 'Business Starter', active: true,
      owner:   { name: 'Sam Patel',  email: 'sam@company.com' },
      manager: { name: 'Alex Kim',   email: 'alex@company.com' } },
    { id: crypto.randomUUID(), name: 'HubSpot',      cost: 800,   cycle: 'monthly', category: 'Marketing',     team: 'Marketing',   renewal: future(28), notes: 'Marketing Hub Pro', active: true,
      owner:   { name: 'Priya Rao', email: 'priya@company.com' },
      manager: { name: 'Alex Kim',  email: 'alex@company.com' },
      licenses: 5, assigned: 5, utilized: 3 },
    { id: crypto.randomUUID(), name: 'Zoom',         cost: 149.9, cycle: 'yearly',  category: 'Communication', team: 'Sales',       renewal: future(65), notes: 'Pro annual', active: true,
      owner:   { name: 'Jordan Lee', email: 'jordan@company.com' },
      manager: { name: 'Alex Kim',   email: 'alex@company.com' } },
    { id: crypto.randomUUID(), name: 'Dropbox',      cost: 12,    cycle: 'monthly', category: 'Storage',       team: 'Ops',         renewal: future(2),  notes: '', active: true },
    { id: crypto.randomUUID(), name: 'Netflix',      cost: 15.49, cycle: 'monthly', category: 'Entertainment', team: 'People',      renewal: future(14), notes: 'Standard', active: false },
  ];
  // Sample invoices — a couple paid, a couple pending, one overdue
  const past = (days) => future(-days);
  const byName = (n) => state.subscriptions.find(s => s.name === n).id;
  state.invoices = [
    { id: crypto.randomUUID(), subId: byName('HubSpot'),      amount: 800,   invoiceNumber: 'HS-24089', issueDate: past(35), dueDate: past(5), paidDate: past(3), notes: '' },
    { id: crypto.randomUUID(), subId: byName('Slack'),        amount: 87.5,  invoiceNumber: 'SLK-1088', issueDate: past(20), dueDate: past(1), paidDate: past(1), notes: '' },
    { id: crypto.randomUUID(), subId: byName('Zoom'),         amount: 149.9, invoiceNumber: 'ZM-77712', issueDate: past(300),dueDate: past(285), paidDate: past(283), notes: 'Annual' },
    { id: crypto.randomUUID(), subId: byName('HubSpot'),      amount: 800,   invoiceNumber: 'HS-24101', issueDate: past(5),  dueDate: future(10), paidDate: null, notes: '' },
    { id: crypto.randomUUID(), subId: byName('Vercel'),       amount: 20,    invoiceNumber: 'VC-8842',  issueDate: past(3),  dueDate: future(12), paidDate: null, notes: '' },
    { id: crypto.randomUUID(), subId: byName('Figma'),        amount: 45,    invoiceNumber: 'FIG-2214', issueDate: past(15), dueDate: past(2),  paidDate: null, notes: '3 seats' },
    { id: crypto.randomUUID(), subId: byName('Google Workspace'), amount: 72,invoiceNumber: 'GW-2026',  issueDate: past(400),dueDate: past(380),paidDate: past(378), notes: '' },
  ];
  save();
  renderAll();
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportSubscriptionsCsv() {
  const headers = ['name','team','category','cost','cycle','monthly_cost','renewal','next_projected_renewal','auto_renew','notice_days','term_length','price_cap_pct','url','notes','active'];
  const rows = state.subscriptions.map(s => [
    s.name, s.team || '', s.category || '', s.cost, s.cycle,
    monthlyCost(s).toFixed(2), s.renewal || '', nextRenewalISO(s) || '',
    s.contract?.autoRenew ?? '', s.contract?.noticeDays ?? '', s.contract?.termLength || '',
    s.contract?.priceCapPct ?? '', s.url || '', s.notes || '', s.active !== false ? 'yes' : 'no',
  ]);
  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  downloadFile('subscriptions.csv', csv, 'text/csv;charset=utf-8');
}
function exportInvoicesCsv() {
  const headers = ['vendor','team','invoice_number','amount','issue_date','due_date','paid_date','status','notes'];
  const rows = state.invoices.map(i => [
    subName(i.subId), subTeam(i.subId), i.invoiceNumber || '', i.amount,
    i.issueDate || '', i.dueDate || '', i.paidDate || '', invoiceStatus(i), i.notes || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  downloadFile('invoices.csv', csv, 'text/csv;charset=utf-8');
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'saas-spendtrack-export.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.subscriptions)) throw new Error('Bad file: no subscriptions');
      state = {
        subscriptions: data.subscriptions,
        invoices: Array.isArray(data.invoices) ? data.invoices : [],
        alertLog: (data.alertLog && typeof data.alertLog === 'object') ? data.alertLog : {},
      };
      save(); renderAll();
      alert(`Imported ${state.subscriptions.length} subscription(s) and ${state.invoices.length} invoice(s).`);
    } catch (e) {
      alert('Could not import: ' + e.message);
    }
  };
  reader.readAsText(file);
}
function clearAll() {
  if (!confirm('Delete ALL subscriptions and invoices? This cannot be undone.')) return;
  state = { subscriptions: [], invoices: [], alertLog: {} };
  save();
  renderAll();
}

// -------- wiring --------
const VIEWS = ['dashboard', 'subscriptions', 'invoices', 'consumption', 'alerts', 'renewals', 'contracts', 'integrations', 'insights', 'pricing'];
function switchView(name, opts = {}) {
  if (!VIEWS.includes(name)) name = 'dashboard';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (!opts.replaceHistory) {
    const target = '#' + name;
    if (location.hash !== target) history.pushState({ view: name }, '', target);
  }
}
function viewFromHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  return VIEWS.includes(raw) ? raw : 'dashboard';
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  renderPlanBadge();
  renderPricing();
  renderAll();

  document.getElementById('plan-badge').addEventListener('click', () => switchView('pricing'));
  document.querySelectorAll('[data-choose-plan]').forEach(b => {
    b.addEventListener('click', () => {
      setPlan(b.dataset.choosePlan);
      b.textContent = b.dataset.choosePlan === 'enterprise' ? 'Talk to sales · request logged' : 'Current plan ✓';
      setTimeout(() => renderPricing(), 800);
    });
  });

  // Restore view from URL hash on load (deep-linking + reload safety)
  switchView(viewFromHash(), { replaceHistory: true });
  window.addEventListener('popstate', () => switchView(viewFromHash(), { replaceHistory: true }));
  window.addEventListener('hashchange', () => switchView(viewFromHash(), { replaceHistory: true }));

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
  document.getElementById('add-btn').addEventListener('click', () => openModal(null));
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('sub-form').addEventListener('submit', handleSubmit);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.getElementById('search').addEventListener('input', renderSubscriptions);
  document.getElementById('filter-category').addEventListener('change', renderSubscriptions);
  document.getElementById('filter-status').addEventListener('change', renderSubscriptions);

  document.querySelectorAll('.stat-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.goto;
      if (target === 'subscriptions') {
        if (card.dataset.activeOnly === '1') document.getElementById('filter-status').value = 'active';
        renderSubscriptions();
      } else if (target === 'invoices' && card.dataset.invStatus) {
        document.getElementById('inv-filter-status').value = card.dataset.invStatus;
        renderInvoices();
      }
      switchView(target);
    });
  });
  document.querySelectorAll('.sub-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (uiSort.key === k) uiSort.dir = uiSort.dir === 'asc' ? 'desc' : 'asc';
      else { uiSort.key = k; uiSort.dir = (k === 'cost' || k === 'monthly') ? 'desc' : 'asc'; }
      renderSubscriptions();
    });
  });
  document.getElementById('seed-btn').addEventListener('click', seed);
  document.getElementById('export-btn').addEventListener('click', exportJson);
  document.getElementById('csv-subs-btn').addEventListener('click', exportSubscriptionsCsv);
  document.getElementById('csv-invs-btn').addEventListener('click', exportInvoicesCsv);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeInvModal(); } });

  document.getElementById('extract-btn').addEventListener('click', () => {
    const text = document.getElementById('contract-text').value;
    if (!text.trim()) { alert('Paste some contract text first.'); return; }
    renderExtract(extractContract(text));
  });
  document.getElementById('clear-contract').addEventListener('click', () => {
    document.getElementById('contract-text').value = '';
    document.getElementById('extract-results').innerHTML = '<p class="empty" style="padding:20px 0;font-size:13px">Paste text and click <b>Extract clauses</b>.</p>';
    document.getElementById('attach-row').hidden = true;
  });
  document.getElementById('sample-contract').addEventListener('click', () => {
    document.getElementById('contract-text').value = SAMPLE_CONTRACT;
    renderExtract(extractContract(SAMPLE_CONTRACT));
  });
  document.getElementById('contract-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = '';
    const textarea = document.getElementById('contract-text');
    const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    if (isPdf) {
      textarea.value = 'Reading PDF…';
      try {
        const text = await extractTextFromPdf(await f.arrayBuffer());
        textarea.value = text;
        renderExtract(extractContract(text));
      } catch (err) {
        textarea.value = '';
        alert('PDF parsing failed: ' + err.message);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        textarea.value = reader.result;
        renderExtract(extractContract(reader.result));
      };
      reader.readAsText(f);
    }
  });
  document.getElementById('attach-btn').addEventListener('click', attachToSub);

  document.getElementById('add-inv-btn').addEventListener('click', () => openInvModal(null));
  document.getElementById('inv-cancel').addEventListener('click', closeInvModal);
  document.getElementById('inv-form').addEventListener('submit', handleInvSubmit);
  document.getElementById('inv-modal').addEventListener('click', (e) => {
    if (e.target.id === 'inv-modal') closeInvModal();
  });
  document.getElementById('inv-filter-vendor').addEventListener('change', renderInvoices);
  document.getElementById('inv-filter-status').addEventListener('change', renderInvoices);

  document.getElementById('alert-filter').addEventListener('change', renderAlerts);
  document.getElementById('download-ics').addEventListener('click', downloadIcs);

  // Integrations: Slack
  const slackHook = document.getElementById('slack-webhook');
  const slackAuto = document.getElementById('slack-auto');
  slackHook.value = state.settings.slackWebhook || '';
  slackAuto.checked = !!state.settings.slackAuto;
  document.getElementById('slack-save').addEventListener('click', () => {
    state.settings.slackWebhook = slackHook.value.trim();
    state.settings.slackAuto = slackAuto.checked;
    save();
    const s = document.getElementById('slack-status');
    s.textContent = 'Saved.'; s.className = 'integ-status ok';
    renderAll();
  });
  document.getElementById('slack-test').addEventListener('click', (e) => {
    state.settings.slackWebhook = slackHook.value.trim();
    save();
    slackTest(e.currentTarget);
  });

  // Integrations: Drive
  const driveInput = document.getElementById('drive-folder');
  driveInput.value = state.settings.driveFolder || '';
  document.getElementById('drive-save').addEventListener('click', () => {
    state.settings.driveFolder = driveInput.value.trim();
    save();
    alert('Drive folder link saved for your reference.');
  });
  const drop = document.getElementById('contract-drop');
  const multi = document.getElementById('contract-multi');
  document.getElementById('contract-pick').addEventListener('click', (e) => { e.preventDefault(); multi.click(); });
  multi.addEventListener('change', (e) => { if (e.target.files.length) stageContractFiles(e.target.files); e.target.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('dragover');
    if (e.dataTransfer.files.length) stageContractFiles(e.dataTransfer.files);
  });
  document.getElementById('import-confirm').addEventListener('click', confirmImport);

  // Integrations: SSO / ERP
  document.getElementById('sso-request').addEventListener('click', () => requestEnterprise('SSO', document.getElementById('sso-status')));
  document.getElementById('erp-request').addEventListener('click', () => requestEnterprise('ERP sync', document.getElementById('erp-status')));
  document.getElementById('erp-csv').addEventListener('click', exportErpCsv);
});
