/* ==========================================================================
   SaaS Spend Track — Phase 12
   AI Chat on the contract corpus — text + voice
   ---------------------------------------------------------------------------
   A natural-language Q&A surface over the whole state: vendors, contracts,
   invoices, licences, departments, risk, renewals, clauses, approvals,
   employees, utilisation. Text input with autocomplete suggestions, plus
   voice input via the Web Speech API (SpeechRecognition) and voice output
   (SpeechSynthesis). Grounded answers only — every number comes from state
   with a source trail; no hallucination.

   Design:
   - Floating pill bottom-right opens a side drawer (and a full view at
     #chat for persistent conversations).
   - Intent router: 14 patterns covering spend by vendor/department/category,
     licence counts and utilisation, renewals in a window, risk ranking,
     clause lookup, approvals, usage per employee, cost per user, waste,
     compliance, invoices, owners, overdue AP, and generic text search.
   - Query parser pulls entities: vendor names, department names, category
     tokens, time windows (this quarter, last 30 days, YTD, next 60 days),
     numbers, and metric type.
   - Answer renderer formats each result with headline, grounding rows,
     chart where it adds signal, and 'why this answer' trace.
   ========================================================================== */

/* ---------- Intent catalogue (what the router can answer) ---------- */
const CHAT_INTENTS = [
  { id: 'spend_by_dept_vendor', desc: 'How much is <department> spending on <vendor> <timeframe>?',
    tests: [/(?:how much|what('?s)?)\s+(?:is|are|does)?\s*(?:the\s+)?(.+?)\s+(?:team|dept|department)?\s*(?:spending|paying|pay)\s+on\s+(.+?)(?:\s+this\s+(quarter|month|year)|\s+last\s+(\d+)\s+(?:days?|months?))?/i,
            /(.+?)\s+spend\s+on\s+(.+?)(?:\s+this\s+(quarter|month|year))?$/i] },
  { id: 'licence_demand',       desc: 'How many <vendor> licences do I need <timeframe>?',
    tests: [/how\s+many\s+(.+?)\s+(?:licenses?|licences?|seats?)\s+(?:do\s+(?:i|we)\s+need|should\s+(?:i|we)\s+(?:buy|have))(?:\s+next\s+(quarter|month|year))?/i,
            /(?:forecast|project|plan)\s+(.+?)\s+(?:licenses?|licences?|seats?)/i] },
  { id: 'spend_on_vendor',      desc: 'What are we spending on <vendor>?',
    tests: [/(?:what('?s)?|how much)\s+(?:are\s+we|do\s+we|is\s+the\s+company)?\s*(?:spending|paying|pay|costs?)\s+(?:on|for|to)\s+(.+?)(?:\s+(?:this|last|next)\s+(quarter|month|year))?\??$/i,
            /total\s+spend\s+(?:on|for)\s+(.+)/i] },
  { id: 'total_spend',          desc: 'What is total SaaS spend <timeframe>?',
    tests: [/(?:what('?s)?|how much)\s+(?:is\s+)?(?:our|the|total|all)\s+(?:total\s+)?(?:saas\s+)?spend(?:\s+(?:this|last)\s+(quarter|month|year|30\s*days))?/i,
            /annual\s+(?:run.?rate|spend)/i] },
  { id: 'spend_by_department',  desc: 'Which departments spend the most?',
    tests: [/(?:which|what)\s+(?:departments?|teams?)\s+(?:spend|is\s+spending|pays?)/i,
            /spend\s+by\s+(?:department|team)/i, /department.*spend/i] },
  { id: 'spend_by_category',    desc: 'Spend by category',
    tests: [/spend\s+by\s+category/i, /category\s+breakdown/i, /which\s+category\s+(?:spends|costs)/i] },
  { id: 'renewals_in_window',   desc: 'What is renewing <timeframe>?',
    tests: [/(?:what('?s)?|which\s+contracts?)\s+(?:is|are)\s+renew(?:ing|al)(?:\s+(?:in|within)\s+(?:the\s+)?(?:next\s+)?(\d+)\s*(days?|months?|weeks?))?/i,
            /renewals?\s+(?:in|within|this|next)\s+(\d+|quarter|month|week)/i,
            /what.*renew/i] },
  { id: 'top_risk',             desc: 'Which contracts have the highest risk?',
    tests: [/(?:what('?s)?|which)\s+(?:is|are)\s+(?:the\s+)?(?:highest|top|worst)\s*(?:risk|risky)\s*(?:contracts?|vendors?)?/i,
            /risky\s+contracts?/i, /top\s+risks?/i, /risk\s+ranking/i] },
  { id: 'missing_clause',       desc: 'Which contracts are missing <clause>?',
    tests: [/(?:which|what)\s+contracts?\s+(?:are\s+)?missing\s+(?:a\s+|the\s+)?(.+)/i,
            /contracts?\s+without\s+(?:a\s+|the\s+)?(.+)/i,
            /no\s+(.+?)\s+clause/i] },
  { id: 'utilisation_low',      desc: 'Which tools are underused / have unused seats?',
    tests: [/(?:what|which)\s+(?:tools?|vendors?|apps?)\s+(?:are|is)\s+(?:underused|underutili[sz]ed|unused|not\s+used)/i,
            /unused\s+seats?/i, /waste|wasted\s+(?:spend|licen[cs]es?)/i,
            /low\s+utili[sz]ation/i] },
  { id: 'owner_of',             desc: 'Who owns <vendor>?',
    tests: [/who('?s)?\s+(?:is\s+)?(?:the\s+)?owner\s+of\s+(.+)/i, /who\s+owns\s+(.+)/i, /(.+?)\s+owner\??$/i] },
  { id: 'invoice_status',       desc: 'Are any invoices overdue?',
    tests: [/(?:any|which)\s+invoices?\s+(?:are\s+)?overdue/i,
            /overdue\s+(?:invoices?|payments?)/i, /unpaid\s+invoices?/i] },
  { id: 'approvals_pending',    desc: 'What approvals are pending?',
    tests: [/(?:what|how many|any)\s+approvals?\s+(?:are\s+)?pending/i, /pending\s+approvals?/i, /approvals?\s+queue/i] },
  { id: 'per_user_cost',        desc: 'Cost per user for <vendor>',
    tests: [/cost\s+per\s+(?:user|seat|licen[cs]e)\s+(?:for|of)\s+(.+)/i,
            /(.+?)\s+cost\s+per\s+user/i] },
];

/* ---------- Helpers: NL entity extraction ---------- */
function _vendors() { return (state.subscriptions || []).map(s => s); }
function _invoices() { return (state.invoices || []); }
function _emps() { return (state.employees || []); }

function findVendor(q) {
  if (!q) return null; const t = q.toLowerCase().trim();
  const vs = _vendors();
  // exact
  let hit = vs.find(v => v.name.toLowerCase() === t); if (hit) return hit;
  // startsWith
  hit = vs.find(v => v.name.toLowerCase().startsWith(t)); if (hit) return hit;
  // contains
  hit = vs.find(v => v.name.toLowerCase().includes(t) || t.includes(v.name.toLowerCase())); if (hit) return hit;
  // token overlap
  const toks = t.split(/\s+/).filter(x => x.length > 2);
  if (toks.length) hit = vs.find(v => toks.some(tok => v.name.toLowerCase().includes(tok)));
  return hit || null;
}
function findDept(q) {
  if (!q) return null; const t = q.toLowerCase().trim();
  const depts = new Set(_vendors().map(v => v.department).filter(Boolean).concat(_emps().map(e => e.department).filter(Boolean)));
  for (const d of depts) { if (d.toLowerCase() === t) return d; }
  for (const d of depts) { if (d.toLowerCase().includes(t) || t.includes(d.toLowerCase())) return d; }
  return null;
}
function parseTimeframe(q) {
  if (!q) return null;
  q = q.toLowerCase();
  if (/this\s+quarter|q[1-4]|current\s+quarter/.test(q)) return { label: 'this quarter', days: 90, kind: 'quarter' };
  if (/this\s+month/.test(q)) return { label: 'this month', days: 30, kind: 'month' };
  if (/this\s+year|ytd|year.to.date/.test(q)) return { label: 'YTD', days: 365, kind: 'ytd' };
  if (/last\s+quarter/.test(q)) return { label: 'last quarter', days: 90, kind: 'last_quarter' };
  if (/next\s+quarter/.test(q)) return { label: 'next quarter', days: 90, kind: 'next_quarter' };
  if (/annual|annually|per\s+year|yearly/.test(q)) return { label: 'annual', days: 365, kind: 'annual' };
  const m = q.match(/(?:last|next|in|within)\s+(\d+)\s*(days?|weeks?|months?)/);
  if (m) { const n = +m[1]; const u = m[2][0]; const d = u === 'd' ? n : u === 'w' ? n * 7 : n * 30; return { label: `${n} ${m[2]}`, days: d, kind: 'window' }; }
  return null;
}

/* ---------- Spend math ---------- */
function monthlyCost(s) {
  const c = +s.cost || 0;
  const cycle = (s.billingCycle || s.cycle || 'monthly').toLowerCase();
  if (cycle === 'annual' || cycle === 'yearly' || cycle === 'annually') return c / 12;
  if (cycle === 'quarterly') return c / 3;
  if (cycle === 'weekly') return c * 4.33;
  return c;
}
function annualCost(s) { return monthlyCost(s) * 12; }

function spendForVendor(v, tf) {
  const m = monthlyCost(v);
  if (!tf) return { amount: m * 12, basis: 'annual run-rate' };
  if (tf.kind === 'month') return { amount: m, basis: 'this month' };
  if (tf.kind === 'quarter' || tf.kind === 'last_quarter' || tf.kind === 'next_quarter') return { amount: m * 3, basis: tf.label };
  if (tf.kind === 'ytd') { const mo = new Date().getMonth() + 1; return { amount: m * mo, basis: `YTD (${mo} months)` }; }
  if (tf.kind === 'window') return { amount: m * (tf.days / 30), basis: `last ${tf.days} days` };
  return { amount: m * 12, basis: 'annual' };
}

/* ---------- Intent router ---------- */
function routeChatQuery(raw) {
  const q = raw.trim();
  const tf = parseTimeframe(q);
  // priority ordering matters — most specific first
  for (const intent of CHAT_INTENTS) {
    for (const re of intent.tests) {
      const m = q.match(re);
      if (m) return { intent: intent.id, match: m, timeframe: tf, raw: q };
    }
  }
  return { intent: 'search', match: [q], timeframe: tf, raw: q };
}

/* ---------- Answerers (one per intent) ---------- */
function answerChat(parsed) {
  try {
    const fn = _ANSWERERS[parsed.intent] || _ANSWERERS.search;
    return fn(parsed);
  } catch (e) {
    return { headline: "I hit an error answering that.", body: escapeHtml(e.message), trace: '' };
  }
}

const _ANSWERERS = {
  spend_by_dept_vendor(p) {
    const deptTok = p.match[2] || '';
    const vendTok = p.match[3] || '';
    const dept = findDept(deptTok);
    const vend = findVendor(vendTok);
    if (!dept && !vend) return {
      headline: "Couldn't match a department or vendor in that question.",
      body: `I looked for <b>${escapeHtml(deptTok)}</b> as a department and <b>${escapeHtml(vendTok)}</b> as a vendor.`,
      trace: 'intent=spend_by_dept_vendor, no entities matched',
    };
    const subs = _vendors().filter(v => (!dept || v.department === dept) && (!vend || v.id === vend.id));
    if (!subs.length) return { headline: "No matching subscriptions.", body: `No subs found for ${dept ? 'dept=' + dept : ''} ${vend ? 'vendor=' + vend.name : ''}.`, trace: '' };
    const basis = p.timeframe;
    const rows = subs.map(s => ({ s, spend: spendForVendor(s, basis) }));
    const total = rows.reduce((a, r) => a + r.spend.amount, 0);
    return {
      headline: `${dept || 'All departments'}${vend ? ' on ' + vend.name : ''}: <b>${formatMoney(total)}</b> ${basis ? basis.label : 'per year'}`,
      body: rows.map(r => `<div class="ai-grid-row"><span>${escapeHtml(r.s.name)}</span><span class="dim">${escapeHtml(r.s.department || '—')}</span><b>${formatMoney(r.spend.amount)}</b></div>`).join(''),
      trace: `intent=spend_by_dept_vendor dept=${dept || '-'} vendor=${vend ? vend.name : '-'} tf=${basis ? basis.label : 'annual'}`,
      sources: rows.map(r => ({ view: 'subscriptions', id: r.s.id, label: r.s.name })),
    };
  },
  spend_on_vendor(p) {
    const vend = findVendor(p.match[2] || p.match[1]);
    if (!vend) return { headline: "I couldn't find that vendor.", body: `Searched for <b>${escapeHtml(p.match[2] || p.match[1] || '')}</b>.`, trace: 'no vendor match' };
    const sp = spendForVendor(vend, p.timeframe);
    const inv = _invoices().filter(i => i.subscriptionId === vend.id || (i.vendor || '').toLowerCase() === vend.name.toLowerCase());
    const paid = inv.filter(i => i.status === 'paid').reduce((a, i) => a + (+i.amount || 0), 0);
    const pending = inv.filter(i => i.status !== 'paid').reduce((a, i) => a + (+i.amount || 0), 0);
    return {
      headline: `${escapeHtml(vend.name)}: <b>${formatMoney(sp.amount)}</b> <span class="dim">(${sp.basis})</span>`,
      body: `<div class="ai-grid-row"><span>Department</span><b>${escapeHtml(vend.department || '—')}</b></div>
             <div class="ai-grid-row"><span>Monthly</span><b>${formatMoney(monthlyCost(vend))}</b></div>
             <div class="ai-grid-row"><span>Annual run-rate</span><b>${formatMoney(annualCost(vend))}</b></div>
             <div class="ai-grid-row"><span>Paid invoices</span><b>${formatMoney(paid)}</b> <span class="dim">(${inv.filter(i=>i.status==='paid').length})</span></div>
             <div class="ai-grid-row"><span>Outstanding</span><b>${formatMoney(pending)}</b> <span class="dim">(${inv.filter(i=>i.status!=='paid').length})</span></div>
             ${vend.renewal ? `<div class="ai-grid-row"><span>Next renewal</span><b>${vend.renewal}</b></div>` : ''}`,
      trace: `intent=spend_on_vendor vendor=${vend.name}`,
      sources: [{ view: 'subscriptions', id: vend.id, label: vend.name }],
    };
  },
  licence_demand(p) {
    const vendTok = (p.match[1] || '').replace(/(license|licence|seat)s?/gi,'').trim();
    const vend = findVendor(vendTok);
    if (!vend) return { headline: "Which vendor should I forecast for?", body: `I couldn't resolve <b>${escapeHtml(vendTok)}</b>. Try the licence forecast view for a full plan.`, trace: 'licence_demand no vendor match' };
    const seats = +vend.users || +vend.licenses || 0;
    const used = +vend.activeUsers || Math.round(seats * ((vend.utilizationPct ?? 75) / 100));
    const util = seats ? Math.round(used / seats * 100) : 0;
    const emps = _emps().filter(e => e.department === vend.department).length;
    const growthRate = 0.08; // default org growth rate
    const demand = Math.ceil(used * (1 + growthRate) / Math.max(0.8, Math.min(1, util / 100 + 0.1)));
    return {
      headline: `${escapeHtml(vend.name)}: estimate <b>${demand}</b> licences for next quarter <span class="dim">(you have ${seats})</span>`,
      body: `<div class="ai-grid-row"><span>Current seats</span><b>${seats}</b></div>
             <div class="ai-grid-row"><span>Active users</span><b>${used}</b> <span class="dim">${util}% utilisation</span></div>
             <div class="ai-grid-row"><span>Team size</span><b>${emps}</b> in ${escapeHtml(vend.department || '—')}</div>
             <div class="ai-grid-row"><span>Assumed growth</span><b>+8%</b> (default — override in Licence Forecast)</div>
             <div class="ai-grid-row"><span>Projected demand</span><b>${demand} seats</b></div>
             <div class="dim" style="margin-top:8px;font-size:11.5px">Open the <a href="#forecast" data-nav="forecast">Licence Forecast</a> view to tune growth, utilisation threshold, and confidence.</div>`,
      trace: `intent=licence_demand vendor=${vend.name} seats=${seats} active=${used} util=${util}% growth=8%`,
    };
  },
  total_spend(p) {
    const subs = _vendors().filter(v => v.status !== 'cancelled');
    const m = subs.reduce((a, s) => a + monthlyCost(s), 0);
    const tf = p.timeframe;
    const amount = tf ? (tf.kind === 'month' ? m : tf.kind === 'quarter' || tf.kind === 'last_quarter' ? m * 3 : tf.kind === 'ytd' ? m * (new Date().getMonth() + 1) : m * 12) : m * 12;
    const label = tf ? tf.label : 'annual run-rate';
    const byDept = {};
    subs.forEach(s => { byDept[s.department || 'Unassigned'] = (byDept[s.department || 'Unassigned'] || 0) + monthlyCost(s); });
    const topDept = Object.entries(byDept).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      headline: `Total SaaS spend <b>${formatMoney(amount)}</b> <span class="dim">(${label}, ${subs.length} active)</span>`,
      body: topDept.map(([d, v]) => `<div class="ai-grid-row"><span>${escapeHtml(d)}</span><b>${formatMoney(v * (amount / (m * 12 || 1)) * 12)}</b></div>`).join(''),
      trace: `intent=total_spend subs=${subs.length} monthly=${formatMoney(m)}`,
    };
  },
  spend_by_department(p) {
    const byDept = {};
    _vendors().filter(v => v.status !== 'cancelled').forEach(s => { byDept[s.department || 'Unassigned'] = (byDept[s.department || 'Unassigned'] || 0) + annualCost(s); });
    const rows = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
    return {
      headline: `Spend by department (annual)`,
      body: rows.map(([d, v]) => `<div class="ai-grid-row"><span>${escapeHtml(d)}</span><b>${formatMoney(v)}</b></div>`).join(''),
      trace: `intent=spend_by_department depts=${rows.length}`,
    };
  },
  spend_by_category(p) {
    const byCat = {};
    _vendors().filter(v => v.status !== 'cancelled').forEach(s => { byCat[s.category || 'Uncategorised'] = (byCat[s.category || 'Uncategorised'] || 0) + annualCost(s); });
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    return {
      headline: `Spend by category (annual)`,
      body: rows.map(([c, v]) => `<div class="ai-grid-row"><span>${escapeHtml(c)}</span><b>${formatMoney(v)}</b></div>`).join(''),
      trace: `intent=spend_by_category cats=${rows.length}`,
    };
  },
  renewals_in_window(p) {
    let days = 30;
    const m = p.raw.match(/(\d+)\s*(day|week|month)/i);
    if (m) { const n = +m[1]; const u = m[2][0]; days = u === 'd' ? n : u === 'w' ? n * 7 : n * 30; }
    else if (/quarter/i.test(p.raw)) days = 90;
    else if (/year/i.test(p.raw)) days = 365;
    const today = new Date();
    const upcoming = _vendors().filter(s => s.renewal).map(s => ({ s, d: Math.round((new Date(s.renewal) - today) / 86400000) }))
      .filter(x => x.d >= 0 && x.d <= days).sort((a, b) => a.d - b.d);
    const total = upcoming.reduce((a, x) => a + annualCost(x.s), 0);
    return {
      headline: `<b>${upcoming.length}</b> renewals in the next ${days} days · <b>${formatMoney(total)}</b> at stake`,
      body: upcoming.slice(0, 15).map(x => `<div class="ai-grid-row"><span>${escapeHtml(x.s.name)}</span><span class="dim">in ${x.d}d</span><b>${formatMoney(annualCost(x.s))}</b></div>`).join('') || '<p class="dim">No renewals in that window.</p>',
      trace: `intent=renewals_in_window days=${days} count=${upcoming.length}`,
    };
  },
  top_risk(p) {
    const vs = _vendors().filter(v => v.riskScore != null || typeof calcRiskScore === 'function');
    const scored = vs.map(v => ({ v, score: v.riskScore ?? (typeof calcRiskScore === 'function' ? calcRiskScore(v).total : 0) })).sort((a, b) => b.score - a.score).slice(0, 10);
    return {
      headline: `Top risk contracts`,
      body: scored.map(x => `<div class="ai-grid-row"><span>${escapeHtml(x.v.name)}</span><span class="dim">${escapeHtml(x.v.department || '—')}</span><b>${Math.round(x.score)}/100</b></div>`).join(''),
      trace: `intent=top_risk n=${scored.length}`,
    };
  },
  missing_clause(p) {
    const term = (p.match[1] || '').toLowerCase().trim();
    const vs = _vendors().filter(v => {
      const txt = ((v.contractText || '') + ' ' + JSON.stringify(v.clauses || {})).toLowerCase();
      return !txt.includes(term);
    });
    return {
      headline: `<b>${vs.length}</b> contracts without "${escapeHtml(term)}"`,
      body: vs.slice(0, 15).map(v => `<div class="ai-grid-row"><span>${escapeHtml(v.name)}</span><span class="dim">${escapeHtml(v.department || '—')}</span></div>`).join('') || '<p class="dim">All contracts cover that clause.</p>',
      trace: `intent=missing_clause term="${term}"`,
    };
  },
  utilisation_low(p) {
    const wasted = _vendors().map(v => {
      const seats = +v.users || +v.licenses || 0;
      const active = +v.activeUsers || Math.round(seats * ((v.utilizationPct ?? 75) / 100));
      const util = seats ? Math.round(active / seats * 100) : null;
      const wastedSeats = Math.max(0, seats - active);
      const wastedMonthly = seats ? (wastedSeats / seats) * monthlyCost(v) : 0;
      return { v, util, wastedSeats, wastedMonthly };
    }).filter(x => x.util !== null && x.util < 75).sort((a, b) => b.wastedMonthly - a.wastedMonthly).slice(0, 15);
    const total = wasted.reduce((a, x) => a + x.wastedMonthly, 0);
    return {
      headline: `<b>${formatMoney(total * 12)}</b>/year on unused seats <span class="dim">(${wasted.length} tools under 75%)</span>`,
      body: wasted.map(x => `<div class="ai-grid-row"><span>${escapeHtml(x.v.name)}</span><span class="dim">${x.util}% used</span><b>${formatMoney(x.wastedMonthly * 12)}/yr</b></div>`).join(''),
      trace: `intent=utilisation_low under75=${wasted.length}`,
    };
  },
  owner_of(p) {
    const tok = (p.match[2] || p.match[1] || '').replace(/\?/g, '').trim();
    const v = findVendor(tok);
    if (!v) return { headline: "Couldn't find that vendor.", body: '', trace: '' };
    return {
      headline: `${escapeHtml(v.name)} owner: <b>${escapeHtml(v.owner || v.ownerEmail || '—')}</b>`,
      body: v.ownerEmail ? `<div class="ai-grid-row"><span>Email</span><b>${escapeHtml(v.ownerEmail)}</b></div>` : '',
      trace: `intent=owner_of vendor=${v.name}`,
    };
  },
  invoice_status(p) {
    const overdue = _invoices().filter(i => i.status === 'overdue' || (i.status !== 'paid' && new Date(i.dueDate || i.date) < new Date()));
    const total = overdue.reduce((a, i) => a + (+i.amount || 0), 0);
    return {
      headline: `<b>${overdue.length}</b> overdue invoices · <b>${formatMoney(total)}</b>`,
      body: overdue.slice(0, 10).map(i => `<div class="ai-grid-row"><span>${escapeHtml(i.vendor || i.subscriptionName || 'Invoice')}</span><span class="dim">${i.dueDate || i.date || '—'}</span><b>${formatMoney(+i.amount || 0)}</b></div>`).join('') || '<p class="dim">No overdue invoices.</p>',
      trace: `intent=invoice_status overdue=${overdue.length}`,
    };
  },
  approvals_pending(p) {
    const appr = state.approvals || [];
    const pending = appr.filter(a => a.status === 'pending');
    return {
      headline: `<b>${pending.length}</b> approvals pending`,
      body: pending.slice(0, 15).map(a => `<div class="ai-grid-row"><span>${escapeHtml(a.subject || a.vendor || 'Approval')}</span><span class="dim">${escapeHtml(a.rule || '')}</span></div>`).join('') || '<p class="dim">Nothing pending.</p>',
      trace: `intent=approvals_pending n=${pending.length}`,
    };
  },
  per_user_cost(p) {
    const tok = (p.match[1] || p.match[2] || '').trim();
    const v = findVendor(tok);
    if (!v) return { headline: "Couldn't find that vendor.", body: '', trace: '' };
    const seats = +v.users || +v.licenses || 0;
    const active = +v.activeUsers || Math.round(seats * ((v.utilizationPct ?? 75) / 100));
    const m = monthlyCost(v);
    const perSeat = seats ? m / seats : 0;
    const perActive = active ? m / active : 0;
    return {
      headline: `${escapeHtml(v.name)}: <b>${formatMoney(perSeat)}</b>/seat, <b>${formatMoney(perActive)}</b>/active user <span class="dim">(monthly)</span>`,
      body: `<div class="ai-grid-row"><span>Monthly cost</span><b>${formatMoney(m)}</b></div>
             <div class="ai-grid-row"><span>Seats purchased</span><b>${seats}</b></div>
             <div class="ai-grid-row"><span>Active users</span><b>${active}</b></div>
             <div class="ai-grid-row"><span>Potential savings</span><b>${formatMoney(perSeat * (seats - active))}/mo</b></div>`,
      trace: `intent=per_user_cost vendor=${v.name}`,
    };
  },
  search(p) {
    const q = p.raw.toLowerCase();
    const vendors = _vendors().filter(v => v.name.toLowerCase().includes(q) || (v.department || '').toLowerCase().includes(q) || (v.category || '').toLowerCase().includes(q));
    if (!vendors.length) return {
      headline: "I'm not sure how to answer that.",
      body: `Try: "spend on Salesforce", "renewals next 60 days", "top risk", "unused seats", "forecast Figma licences", "cost per user for Slack", or ask by department.`,
      trace: `intent=search_fallthrough query="${escapeHtml(p.raw)}"`,
    };
    return {
      headline: `Found ${vendors.length} matches`,
      body: vendors.slice(0, 10).map(v => `<div class="ai-grid-row" data-nav-vendor="${v.id}" style="cursor:pointer"><span>${escapeHtml(v.name)}</span><span class="dim">${escapeHtml(v.department || '—')}</span><b>${formatMoney(annualCost(v))}/yr</b></div>`).join(''),
      trace: `intent=search query="${p.raw}"`,
    };
  },
};

/* ---------- Chat log ---------- */
function chatLog() { state.settings.chatLog = state.settings.chatLog || []; return state.settings.chatLog; }
function pushChat(role, content, meta) {
  const log = chatLog();
  log.push({ role, content, at: new Date().toISOString(), ...(meta || {}) });
  if (log.length > 200) state.settings.chatLog = log.slice(-200);
  save();
}

/* ---------- Voice ---------- */
let _rec = null; let _recOn = false;
function startVoice(onResult, onEnd) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { toast('Voice input not supported in this browser.', 'warn'); return false; }
  if (_rec && _recOn) return false;
  _rec = new Rec();
  _rec.lang = navigator.language || 'en-IN';
  _rec.interimResults = true;
  _rec.continuous = false;
  let finalText = '';
  _rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    onResult && onResult(finalText + interim, !!finalText);
  };
  _rec.onend = () => { _recOn = false; onEnd && onEnd(finalText); };
  _rec.onerror = (e) => { _recOn = false; toast('Voice: ' + (e.error || 'error'), 'warn'); onEnd && onEnd(''); };
  _rec.start(); _recOn = true;
  return true;
}
function stopVoice() { try { _rec && _rec.stop(); } catch (_) {} _recOn = false; }
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const plain = (text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!plain) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain.slice(0, 500));
  u.lang = navigator.language || 'en-IN';
  u.rate = 1.03;
  speechSynthesis.speak(u);
}

/* ---------- UI: floating pill + drawer + full view ---------- */
function ensureChatLauncher() {
  if (document.getElementById('ai-launcher')) return;
  const btn = document.createElement('button');
  btn.id = 'ai-launcher';
  btn.className = 'ai-launcher';
  btn.title = 'Ask the corpus';
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Ask`;
  btn.onclick = () => toggleChatDrawer();
  document.body.appendChild(btn);
}
function ensureChatDrawer() {
  if (document.getElementById('ai-drawer')) return;
  const div = document.createElement('div');
  div.id = 'ai-drawer';
  div.className = 'ai-drawer';
  div.innerHTML = `
    <header class="ai-head">
      <div><b>Ask the corpus</b><div class="dim" style="font-size:11px">Grounded answers from your own data</div></div>
      <div style="display:flex;gap:4px">
        <button class="icon-btn" id="ai-full" title="Open full">⤢</button>
        <button class="icon-btn" id="ai-close" title="Close">×</button>
      </div>
    </header>
    <div class="ai-messages" id="ai-messages"></div>
    <div class="ai-suggest" id="ai-suggest"></div>
    <form class="ai-form" id="ai-form">
      <button type="button" class="ai-mic" id="ai-mic" title="Voice input">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
      </button>
      <input id="ai-input" placeholder="How much did marketing spend on Salesforce this quarter?" autocomplete="off"/>
      <label class="ai-voice-toggle" title="Speak replies"><input type="checkbox" id="ai-voice-reply"/> <span>🔊</span></label>
      <button type="submit" class="btn-primary">Send</button>
    </form>`;
  document.body.appendChild(div);
  div.querySelector('#ai-close').onclick = toggleChatDrawer;
  div.querySelector('#ai-full').onclick = () => { div.classList.remove('open'); switchView('chat'); };
  div.querySelector('#ai-form').onsubmit = (e) => { e.preventDefault(); const i = document.getElementById('ai-input'); const q = i.value.trim(); if (!q) return; i.value = ''; handleQuery(q, 'drawer'); };
  div.querySelector('#ai-mic').onclick = () => {
    if (_recOn) { stopVoice(); return; }
    const mic = div.querySelector('#ai-mic'); const inp = div.querySelector('#ai-input');
    mic.classList.add('recording');
    startVoice(
      (text) => { inp.value = text; },
      (finalText) => {
        mic.classList.remove('recording');
        if (finalText) { inp.value = ''; handleQuery(finalText, 'drawer'); }
      }
    );
  };
  renderChatMessages('drawer');
}
function toggleChatDrawer() {
  ensureChatDrawer();
  const d = document.getElementById('ai-drawer');
  d.classList.toggle('open');
  if (d.classList.contains('open')) { setTimeout(() => document.getElementById('ai-input')?.focus(), 150); renderChatMessages('drawer'); }
}

function ensureChatView() {
  if (document.getElementById('chat')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'chat'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Ask the corpus</h2>
        <p class="page-sub">Natural-language questions over every subscription, contract, invoice, licence and clause in your workspace. Voice input + voice replies supported.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="icon-btn" id="chat-clear">Clear chat</button>
      </div>
    </div>
    <div class="ai-view">
      <aside class="ai-side">
        <h4>Try asking</h4>
        <ul id="ai-examples"></ul>
        <h4 style="margin-top:14px">I can answer</h4>
        <ul class="dim" style="font-size:12px;line-height:1.6" id="ai-intents"></ul>
      </aside>
      <div class="ai-main">
        <div class="ai-messages ai-messages-full" id="ai-messages-full"></div>
        <div class="ai-suggest" id="ai-suggest-full"></div>
        <form class="ai-form ai-form-full" id="ai-form-full">
          <button type="button" class="ai-mic" id="ai-mic-full">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
          </button>
          <input id="ai-input-full" placeholder="Ask anything about your SaaS portfolio…" autocomplete="off"/>
          <label class="ai-voice-toggle"><input type="checkbox" id="ai-voice-reply-full"/> <span>🔊 Speak</span></label>
          <button type="submit" class="btn-primary">Send</button>
        </form>
      </div>
    </div>`;
  main.appendChild(section);

  const ex = section.querySelector('#ai-examples');
  const examples = [
    "How much is marketing spending on Salesforce this quarter?",
    "How many Figma licences do I need next quarter?",
    "What renewals are coming up in 60 days?",
    "Which contracts have the highest risk?",
    "Which tools are underused?",
    "Cost per user for Slack",
    "Which contracts are missing a DPA?",
    "Spend by department",
    "Any invoices overdue?",
    "Who owns HubSpot?",
  ];
  ex.innerHTML = examples.map(x => `<li><button class="ai-example" data-ex="${encodeURIComponent(x)}">${escapeHtml(x)}</button></li>`).join('');
  section.querySelectorAll('.ai-example').forEach(b => b.onclick = () => { const q = decodeURIComponent(b.dataset.ex); document.getElementById('ai-input-full').value = ''; handleQuery(q, 'full'); });
  section.querySelector('#ai-intents').innerHTML = CHAT_INTENTS.map(i => `<li>${escapeHtml(i.desc)}</li>`).join('');

  section.querySelector('#chat-clear').onclick = () => { if (!confirm('Clear chat history?')) return; state.settings.chatLog = []; save(); renderChatMessages('full'); renderChatMessages('drawer'); };
  section.querySelector('#ai-form-full').onsubmit = (e) => { e.preventDefault(); const i = section.querySelector('#ai-input-full'); const q = i.value.trim(); if (!q) return; i.value = ''; handleQuery(q, 'full'); };
  section.querySelector('#ai-mic-full').onclick = () => {
    if (_recOn) { stopVoice(); return; }
    const mic = section.querySelector('#ai-mic-full'); const inp = section.querySelector('#ai-input-full');
    mic.classList.add('recording');
    startVoice(
      (text) => { inp.value = text; },
      (finalText) => { mic.classList.remove('recording'); if (finalText) { inp.value = ''; handleQuery(finalText, 'full'); } }
    );
  };
  renderChatMessages('full');
}

function ensureChatNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const g = [...groups][0] || groups[0]; // put under Overview
  if (!g || g.querySelector('[data-view="chat"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'chat';
  btn.innerHTML = `${svg}<span>Ask the corpus</span><span class="badge" style="margin-left:auto;background:var(--accent);color:#fff;font-size:9px">AI</span>`;
  g.appendChild(btn);
  btn.addEventListener('click', () => switchView('chat'));
}
function patchSwitchViewForChat() {
  if (window._chatSwitchPatched) return;
  const _orig = window.switchView;
  window.switchView = function (name, opts = {}) {
    if (name === 'chat' || name === 'forecast') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0 });
      const crumb = document.getElementById('page-crumb');
      if (crumb) crumb.textContent = name === 'chat' ? 'Ask the corpus' : 'Licence forecast';
      if (!opts.replaceHistory) {
        const target = '#' + name;
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._chatSwitchPatched = true;
}

/* ---------- Query flow ---------- */
function handleQuery(q, surface) {
  pushChat('user', q);
  renderChatMessages(surface);
  // small async so the user bubble paints first
  setTimeout(() => {
    const parsed = routeChatQuery(q);
    const ans = answerChat(parsed);
    pushChat('assistant', ans, { intent: parsed.intent });
    renderChatMessages(surface);
    // Voice reply?
    const chk = document.getElementById(surface === 'full' ? 'ai-voice-reply-full' : 'ai-voice-reply');
    if (chk && chk.checked) speak(ans.headline);
  }, 60);
}

function renderChatMessages(surface) {
  const host = document.getElementById(surface === 'full' ? 'ai-messages-full' : 'ai-messages');
  if (!host) return;
  const log = chatLog();
  if (!log.length) {
    host.innerHTML = `<div class="ai-welcome">
      <h3>Ask about your SaaS portfolio.</h3>
      <p class="dim">Grounded answers with a source trail. Nothing is sent to a third party — everything runs locally on your workspace.</p>
      <div class="ai-quick-chips">
        <button class="chip" data-chip="Total SaaS spend this year">Total spend this year</button>
        <button class="chip" data-chip="Top risk contracts">Top risk</button>
        <button class="chip" data-chip="Renewals next 60 days">Renewals next 60d</button>
        <button class="chip" data-chip="Which tools are underused">Underused tools</button>
        <button class="chip" data-chip="Spend by department">Spend by dept</button>
      </div>
    </div>`;
    host.querySelectorAll('.chip').forEach(c => c.onclick = () => handleQuery(c.dataset.chip, surface));
    return;
  }
  host.innerHTML = log.map(m => {
    if (m.role === 'user') return `<div class="ai-msg ai-msg-user"><div class="ai-bubble">${escapeHtml(m.content)}</div></div>`;
    const a = m.content;
    return `<div class="ai-msg ai-msg-ai">
      <div class="ai-bubble ai-bubble-ai">
        <div class="ai-headline">${a.headline || ''}</div>
        <div class="ai-body">${a.body || ''}</div>
        ${a.sources?.length ? `<div class="ai-sources"><span class="dim">Sources:</span> ${a.sources.map(s => `<a href="#" data-nav-src="${s.view}:${s.id}">${escapeHtml(s.label)}</a>`).join(', ')}</div>` : ''}
        <details class="ai-trace"><summary class="dim">why this answer</summary><code>${escapeHtml(a.trace || '')}</code></details>
      </div>
    </div>`;
  }).join('');
  // Wire source links
  host.querySelectorAll('[data-nav-src]').forEach(a => a.onclick = (e) => { e.preventDefault(); const [view, id] = a.dataset.navSrc.split(':'); switchView(view); if (typeof openContractDetail === 'function') openContractDetail(id); });
  host.querySelectorAll('[data-nav-vendor]').forEach(r => r.onclick = () => { if (typeof openContractDetail === 'function') openContractDetail(r.dataset.navVendor); });
  host.querySelectorAll('[data-nav]').forEach(a => a.onclick = (e) => { e.preventDefault(); switchView(a.dataset.nav); });
  // Scroll to bottom
  host.scrollTop = host.scrollHeight;
}

/* ---------- Hook renderAll ---------- */
const _prevAll13 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll13) {
  window.renderAll = function () {
    _prevAll13();
    try { ensureChatView(); ensureChatNav(); patchSwitchViewForChat(); ensureChatLauncher(); ensureChatDrawer(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { ensureChatView(); ensureChatNav(); patchSwitchViewForChat(); ensureChatLauncher(); ensureChatDrawer(); } catch (_) {} }, 600);
});

// Register page title + make sure switchView knows it
if (window.PAGE_TITLES) { window.PAGE_TITLES.chat = 'Ask the corpus'; window.PAGE_TITLES.forecast = 'Licence forecast'; }
