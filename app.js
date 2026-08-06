// SaaS Spend Track — vanilla JS app with localStorage persistence.

const STORAGE_KEY = 'saasspendtrack.v1';
const CYCLE_MONTHS = { weekly: 1/4.345, monthly: 1, quarterly: 3, yearly: 12 };
const AVATAR_COLORS = ['#7c5cff', '#35d0ba', '#ff8a4c', '#4cb1ff', '#ff5c7a', '#ffb545', '#a374ff', '#4cd3ff'];

let state = { subscriptions: [] };

// -------- storage --------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (_) {}
  if (!Array.isArray(state.subscriptions)) state.subscriptions = [];
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// -------- math --------
function monthlyCost(sub) {
  const months = CYCLE_MONTHS[sub.cycle] || 1;
  return sub.cost / months;
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
  document.getElementById('stat-monthly-sub').textContent = `across ${active.length} subscription${active.length === 1 ? '' : 's'}`;
  document.getElementById('stat-annual').textContent = formatMoney(totalAnnual);
  document.getElementById('stat-count').textContent = active.length;
  document.getElementById('stat-count-sub').textContent = `${paused} paused`;

  // Next renewal
  const withDates = active.filter(s => s.renewal).sort((a,b) => parseDate(a.renewal) - parseDate(b.renewal));
  const nextFuture = withDates.find(s => daysUntil(s.renewal) >= 0);
  if (nextFuture) {
    const d = daysUntil(nextFuture.renewal);
    document.getElementById('stat-next').textContent = nextFuture.name;
    document.getElementById('stat-next-sub').textContent = `${formatMoney(nextFuture.cost)} in ${d} day${d === 1 ? '' : 's'}`;
  } else {
    document.getElementById('stat-next').textContent = '—';
    document.getElementById('stat-next-sub').textContent = 'no upcoming renewals';
  }

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

  // Upcoming renewals
  const upcoming = withDates.filter(s => { const d = daysUntil(s.renewal); return d !== null && d >= 0 && d <= 30; }).slice(0, 6);
  const ul = document.getElementById('upcoming-list');
  ul.innerHTML = upcoming.length ? upcoming.map(s => {
    const d = daysUntil(s.renewal);
    const badge = d <= 3 ? 'danger' : d <= 7 ? 'warn' : 'ok';
    return `<li>
      <div><div class="name">${escapeHtml(s.name)}</div><div class="meta">${formatDate(s.renewal)}</div></div>
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

  // Populate categories
  const cats = [...new Set(state.subscriptions.map(s => s.category).filter(Boolean))].sort();
  const filterSel = document.getElementById('filter-category');
  const current = filterSel.value;
  filterSel.innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  filterSel.value = current;

  const rows = state.subscriptions.filter(s => {
    if (q && !(s.name.toLowerCase().includes(q) || (s.category||'').toLowerCase().includes(q))) return false;
    if (cat && s.category !== cat) return false;
    return true;
  });

  document.getElementById('empty-state').style.display = rows.length ? 'none' : 'block';
  tbody.innerHTML = rows.map(s => `
    <tr>
      <td><div class="name-cell">
        <div class="avatar" style="background:${avatarColor(s.name)}">${initials(s.name)}</div>
        <div><div style="font-weight:600">${escapeHtml(s.name)}</div>${s.notes ? `<div style="color:var(--text-dim);font-size:11px">${escapeHtml(s.notes)}</div>` : ''}</div>
      </div></td>
      <td>${escapeHtml(s.category || '—')}</td>
      <td>${formatMoney(s.cost)}</td>
      <td style="text-transform:capitalize">${s.cycle}</td>
      <td>${formatMoney(monthlyCost(s))}</td>
      <td>${s.renewal ? formatDate(s.renewal) : '—'}${renderCancelBy(s)}</td>
      <td>${s.active !== false ? '<span class="badge ok">Active</span>' : '<span class="badge">Paused</span>'}${renderContractBadges(s)}</td>
      <td class="actions-cell">
        <button class="icon-btn" data-edit="${s.id}">Edit</button>
        <button class="icon-btn danger" data-delete="${s.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openModal(b.dataset.edit));
  tbody.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => deleteSub(b.dataset.delete));
}

function renderContractBadges(s) {
  if (!s.contract) return '';
  const parts = [];
  if (s.contract.autoRenew) parts.push('<span class="badge warn" title="Auto-renews">Auto-renew</span>');
  if (s.contract.priceCapPct != null) parts.push(`<span class="badge" title="Price-increase cap">≤${s.contract.priceCapPct}%</span>`);
  return parts.length ? `<div class="contract-summary">${parts.join('')}</div>` : '';
}
function renderCancelBy(s) {
  if (!s.contract?.noticeDays || !s.renewal) return '';
  const renewal = parseDate(s.renewal);
  const cancelBy = new Date(renewal); cancelBy.setDate(cancelBy.getDate() - s.contract.noticeDays);
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Math.round((cancelBy - today) / 86400000);
  const cls = days < 0 ? 'danger' : days <= 14 ? 'warn' : 'ok';
  const label = days < 0 ? 'notice window passed' : `cancel by ${cancelBy.toLocaleDateString('en-US', { month:'short', day:'numeric' })}`;
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
    const subs = activeSubs().filter(s => {
      const d = parseDate(s.renewal); if (!d) return false;
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    }).sort((a,b) => parseDate(a.renewal) - parseDate(b.renewal));
    const total = subs.reduce((sum, s) => sum + s.cost, 0);
    return `<div class="renewal-month">
      <h3>${m.label} · ${formatMoney(total)}</h3>
      ${subs.length ? '<ul>' + subs.map(s => `<li>
        <div><div style="font-weight:600">${escapeHtml(s.name)}</div><div class="day">${formatDate(s.renewal)}</div></div>
        <div style="font-weight:600">${formatMoney(s.cost)}</div>
      </li>`).join('') + '</ul>' : '<p class="empty" style="padding:16px 0;font-size:12px">No renewals</p>'}
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
  const yearly = active.filter(s => s.cycle === 'yearly');
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
  if (!recos.length) recos.push('✅ Nothing jumping out — your subscription mix looks lean.');
  document.getElementById('recos').innerHTML = recos.map(r => `<li style="background:var(--panel-2);padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.5">${r}</li>`).join('');
}

function renderAll() {
  renderDashboard();
  renderSubscriptions();
  renderRenewals();
  renderInsights();
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
    notes: document.getElementById('f-notes').value.trim(),
    active: document.getElementById('f-active').checked,
  };
  const idx = state.subscriptions.findIndex(s => s.id === id);
  if (idx >= 0) state.subscriptions[idx] = sub;
  else state.subscriptions.push(sub);
  save();
  renderAll();
  closeModal();
}

function deleteSub(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;
  if (!confirm(`Delete "${sub.name}"?`)) return;
  state.subscriptions = state.subscriptions.filter(s => s.id !== id);
  save();
  renderAll();
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
    sel.innerHTML = '<option value="">Attach to subscription…</option>' +
      state.subscriptions.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }
  window._lastExtract = result;
}

function attachToSub() {
  const id = document.getElementById('attach-sub').value;
  const result = window._lastExtract;
  if (!id || !result) { alert('Pick a subscription first.'); return; }
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;
  sub.contract = {
    renewalType: result.renewalType?.value || null,
    autoRenew: result.renewalType?.value === 'Auto-renew',
    noticeDays: result.noticePeriod?.days || null,
    termLength: result.termLength?.value || null,
    priceCapPct: result.priceCap?.pct ?? null,
  };
  save();
  renderAll();
  alert(`Saved contract terms to ${sub.name}.`);
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
    { id: crypto.randomUUID(), name: 'Figma',        cost: 15,    cycle: 'monthly', category: 'Design',        renewal: future(4),  notes: 'Professional plan', active: true },
    { id: crypto.randomUUID(), name: 'Notion',       cost: 96,    cycle: 'yearly',  category: 'Productivity',  renewal: future(45), notes: 'Team plan', active: true },
    { id: crypto.randomUUID(), name: 'GitHub',       cost: 4,     cycle: 'monthly', category: 'Development',   renewal: future(12), notes: 'Pro', active: true },
    { id: crypto.randomUUID(), name: 'Vercel',       cost: 20,    cycle: 'monthly', category: 'Development',   renewal: future(18), notes: '', active: true },
    { id: crypto.randomUUID(), name: 'ChatGPT Plus', cost: 20,    cycle: 'monthly', category: 'AI / LLM',      renewal: future(6),  notes: '', active: true },
    { id: crypto.randomUUID(), name: 'Claude Pro',   cost: 20,    cycle: 'monthly', category: 'AI / LLM',      renewal: future(22), notes: '', active: true },
    { id: crypto.randomUUID(), name: 'Slack',        cost: 87.5,  cycle: 'monthly', category: 'Communication', renewal: future(9),  notes: '', active: true },
    { id: crypto.randomUUID(), name: 'Google Workspace', cost: 72, cycle: 'yearly', category: 'Productivity',  renewal: future(120),notes: 'Business Starter', active: true },
    { id: crypto.randomUUID(), name: 'HubSpot',      cost: 800,   cycle: 'monthly', category: 'Marketing',     renewal: future(28), notes: 'Marketing Hub Pro', active: true },
    { id: crypto.randomUUID(), name: 'Zoom',         cost: 149.9, cycle: 'yearly',  category: 'Communication', renewal: future(65), notes: 'Pro annual', active: true },
    { id: crypto.randomUUID(), name: 'Dropbox',      cost: 12,    cycle: 'monthly', category: 'Storage',       renewal: future(2),  notes: '', active: true },
    { id: crypto.randomUUID(), name: 'Netflix',      cost: 15.49, cycle: 'monthly', category: 'Entertainment', renewal: future(14), notes: 'Standard', active: false },
  ];
  save();
  renderAll();
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
      if (!Array.isArray(data.subscriptions)) throw new Error('Bad file');
      state = data; save(); renderAll();
      alert(`Imported ${data.subscriptions.length} subscription(s).`);
    } catch (e) {
      alert('Could not import: ' + e.message);
    }
  };
  reader.readAsText(file);
}
function clearAll() {
  if (!confirm('Delete ALL subscriptions? This cannot be undone.')) return;
  state = { subscriptions: [] };
  save();
  renderAll();
}

// -------- wiring --------
function switchView(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  renderAll();

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
  document.getElementById('add-btn').addEventListener('click', () => openModal(null));
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('sub-form').addEventListener('submit', handleSubmit);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.getElementById('search').addEventListener('input', renderSubscriptions);
  document.getElementById('filter-category').addEventListener('change', renderSubscriptions);
  document.getElementById('seed-btn').addEventListener('click', seed);
  document.getElementById('export-btn').addEventListener('click', exportJson);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

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
  document.getElementById('contract-file').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('contract-text').value = reader.result;
      renderExtract(extractContract(reader.result));
    };
    reader.readAsText(f);
    e.target.value = '';
  });
  document.getElementById('attach-btn').addEventListener('click', attachToSub);
});
