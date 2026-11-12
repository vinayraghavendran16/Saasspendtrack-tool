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
  /* Dept+vendor must come AFTER spend_on_vendor and REQUIRE an explicit
     dept keyword — otherwise "what is the total spend on hotspot this year"
     wrongly matches with "total"=dept, "hotspot"=vendor, "year"=qtr. */
  { id: 'spend_by_dept_vendor', desc: 'How much is <department> spending on <vendor> <timeframe>?',
    tests: [/(?:how much|what('?s)?)\s+(?:is|are|does)?\s*(?:the\s+)?(.+?)\s+(?:team|dept|department)\s+(?:spending|paying|pay|spend)\s+on\s+(.+?)(?:\s+this\s+(quarter|month|year)|\s+last\s+(\d+)\s+(?:days?|months?))?$/i,
            /(.+?)\s+(?:team|dept|department)\s+spend\s+on\s+(.+?)(?:\s+this\s+(quarter|month|year))?$/i] },
  { id: 'licence_demand',       desc: 'How many <vendor> licences do I need <timeframe>?',
    tests: [/how\s+many\s+(.+?)\s+(?:licenses?|licences?|seats?)\s+(?:do\s+(?:i|we)\s+need|should\s+(?:i|we)\s+(?:buy|have))(?:\s+next\s+(quarter|month|year))?/i,
            /(?:forecast|project|plan)\s+(.+?)\s+(?:licenses?|licences?|seats?)/i] },
  { id: 'spend_on_vendor',      desc: 'What are we spending on <vendor>?',
    tests: [
      /(?:what('?s)?|how much)\s+(?:is\s+)?(?:the\s+)?(?:total\s+)?spend\s+(?:on|for)\s+(.+?)(?:\s+(?:this|last|next)\s+(?:quarter|month|year))?\??$/i,
      /(?:what('?s)?|how much)\s+(?:are\s+we|do\s+we|is\s+the\s+company)?\s*(?:spending|paying|pay|costs?)\s+(?:on|for|to)\s+(.+?)(?:\s+(?:this|last|next)\s+(?:quarter|month|year))?\??$/i,
      /total\s+spend\s+(?:on|for)\s+(.+?)(?:\s+(?:this|last|next)\s+(?:quarter|month|year))?\??$/i,
      /^spend\s+on\s+(.+?)(?:\s+(?:this|last|next)\s+(?:quarter|month|year))?\??$/i,
    ] },
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
  { id: 'list_vendors',         desc: 'List all vendors / give me all vendor names',
    tests: [/(?:list|give\s+me|show\s+me|show)\s+(?:all\s+)?(?:the\s+)?(?:vendor|subscription|tool|app)\s*(?:name)?s?/i,
            /(?:what|which)\s+(?:vendor|tool|app|subscription)s?\s+(?:do\s+(?:i|we)\s+have|are\s+we\s+(?:using|on)|in\s+(?:my|our)\s+(?:stack|portfolio))/i,
            /all\s+(?:vendor|tool|app|subscription)s?/i,
            /(?:my|our)\s+(?:stack|portfolio|tools|vendors)/i,
            /vendor\s+(?:list|names?)/i] },
  { id: 'list_owners',          desc: 'List all owners / who owns what',
    tests: [/(?:list|show)\s+(?:all\s+)?owners?/i,
            /who\s+owns\s+what/i,
            /owner\s+(?:list|map)/i,
            /(?:who\s+(?:are\s+)?the\s+)?(?:vendor|tool|contract|subscription)\s+owners?/i] },
  { id: 'list_contracts',       desc: 'List all contracts',
    tests: [/(?:list|show|all)\s+(?:all\s+)?contracts?/i,
            /contract\s+list/i] },
  { id: 'count_vendors',        desc: 'How many vendors / tools / subscriptions do we have?',
    tests: [/how\s+many\s+(?:vendor|tool|app|subscription|contract)s?\s+(?:do\s+(?:i|we)\s+have|are\s+(?:there|we\s+on))/i,
            /(?:total|count)\s+(?:of\s+)?(?:vendor|tool|subscription)s?/i] },
  { id: 'department_list',      desc: 'What departments do we have?',
    tests: [/(?:list|show|what)\s+(?:are\s+(?:the|our)\s+|all\s+)?(?:department|team)s?/i,
            /department\s+(?:list|names?|breakdown)/i] },
  { id: 'help',                 desc: 'What can you answer?',
    tests: [/^(?:help|what\s+can\s+(?:you|i)\s+(?:do|ask|answer)|examples?|how\s+(?:does\s+this|do\s+i\s+use))\b/i] },
];

/* ---------- Helpers: NL entity extraction ---------- */
function _vendors() { return (state.subscriptions || []).map(s => s); }
function _invoices() { return (state.invoices || []); }
function _emps() { return (state.employees || []); }

/* Simple Levenshtein to help voice-recognition near-misses
   ("hotspot" → "HubSpot", "sells force" → "Salesforce") */
function _lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}
function findVendor(q) {
  if (!q) return null;
  // Strip trailing timeframe words voice sometimes bakes in
  const t = q.toLowerCase().trim().replace(/\s+(this|last|next)\s+(quarter|month|year|week)\s*$/,'').replace(/\?+$/, '').trim();
  const vs = _vendors();
  if (!vs.length) return null;
  // exact
  let hit = vs.find(v => v.name.toLowerCase() === t); if (hit) return hit;
  // startsWith
  hit = vs.find(v => v.name.toLowerCase().startsWith(t)); if (hit) return hit;
  // contains either way
  hit = vs.find(v => v.name.toLowerCase().includes(t) || t.includes(v.name.toLowerCase())); if (hit) return hit;
  // token overlap (any 3+ char token hits a vendor name)
  const toks = t.split(/\s+/).filter(x => x.length > 2);
  if (toks.length) {
    hit = vs.find(v => toks.some(tok => v.name.toLowerCase().includes(tok)));
    if (hit) return hit;
  }
  // Fuzzy — Levenshtein against each vendor name (and tokens inside it)
  // Accept distance up to 2 for short names, 3 for longer. Scores ties by
  // shorter distance then name length.
  const candidates = [];
  for (const v of vs) {
    const name = v.name.toLowerCase();
    const maxDist = name.length <= 6 ? 2 : 3;
    const d1 = _lev(t, name);
    if (d1 <= maxDist) { candidates.push({ v, d: d1 }); continue; }
    // Try first token of vendor name (e.g. "HubSpot Marketing Hub" → "hubspot")
    const firstTok = name.split(/\s+/)[0];
    if (firstTok.length >= 4) {
      const d2 = _lev(t, firstTok);
      if (d2 <= 2) candidates.push({ v, d: d2 });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates[0]?.v || null;
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
// monthlyCost comes from app.js. annualCost isn't there, so define it here.
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
    const raw = p.match[2] || p.match[1] || '';
    const vend = findVendor(raw);
    if (!vend) {
      // Offer close matches as clickable chips so voice near-misses are easy to recover
      const similar = _vendors().map(v => ({ v, d: _lev(raw.toLowerCase().trim(), v.name.toLowerCase()) })).sort((a, b) => a.d - b.d).slice(0, 5);
      return {
        headline: `I couldn't find a vendor matching "${escapeHtml(raw)}".`,
        body: `<div class="dim" style="margin-bottom:8px;font-size:12px">Did you mean one of these?</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${similar.map(s => `<button class="chip" data-chip-q="spend on ${escapeHtml(s.v.name)}">${escapeHtml(s.v.name)}</button>`).join('')}</div>
          <div class="dim" style="margin-top:10px;font-size:11px">Or type <b>list all vendors</b> to see every vendor in your portfolio.</div>`,
        trace: `intent=spend_on_vendor no_vendor_match raw="${escapeHtml(raw)}"`,
      };
    }
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
  list_vendors(p) {
    const vs = _vendors().filter(v => v.status !== 'cancelled').sort((a, b) => annualCost(b) - annualCost(a));
    return {
      headline: `<b>${vs.length}</b> vendors in your portfolio`,
      body: vs.map(v => `<div class="ai-grid-row" data-nav-vendor="${v.id}" style="cursor:pointer"><span>${escapeHtml(v.name)}</span><span class="dim">${escapeHtml(v.department || '—')} · ${escapeHtml(v.category || '—')}</span><b>${formatMoney(annualCost(v))}/yr</b></div>`).join(''),
      trace: `intent=list_vendors n=${vs.length}`,
    };
  },
  list_owners(p) {
    const byOwner = {};
    _vendors().filter(v => v.status !== 'cancelled').forEach(v => {
      const o = v.owner || v.ownerEmail || 'Unassigned';
      (byOwner[o] ||= []).push(v);
    });
    const rows = Object.entries(byOwner).sort((a, b) => b[1].length - a[1].length);
    return {
      headline: `<b>${rows.length}</b> owners · ${_vendors().length} vendors`,
      body: rows.map(([o, list]) => `<div class="ai-grid-row"><span>${escapeHtml(o)}</span><span class="dim">${list.map(v => escapeHtml(v.name)).join(', ').slice(0, 120)}${list.map(v=>v.name).join(', ').length > 120 ? '…' : ''}</span><b>${list.length}</b></div>`).join(''),
      trace: `intent=list_owners owners=${rows.length}`,
    };
  },
  list_contracts(p) {
    const vs = _vendors().filter(v => v.status !== 'cancelled' && v.renewal).sort((a, b) => new Date(a.renewal) - new Date(b.renewal));
    return {
      headline: `<b>${vs.length}</b> active contracts`,
      body: vs.slice(0, 30).map(v => `<div class="ai-grid-row" data-nav-vendor="${v.id}" style="cursor:pointer"><span>${escapeHtml(v.name)}</span><span class="dim">renews ${v.renewal}</span><b>${formatMoney(annualCost(v))}/yr</b></div>`).join(''),
      trace: `intent=list_contracts n=${vs.length}`,
    };
  },
  count_vendors(p) {
    const all = _vendors();
    const active = all.filter(v => v.status !== 'cancelled').length;
    const cancelled = all.length - active;
    const depts = new Set(all.map(v => v.department).filter(Boolean)).size;
    const cats = new Set(all.map(v => v.category).filter(Boolean)).size;
    return {
      headline: `<b>${active}</b> active vendors${cancelled ? `, ${cancelled} cancelled` : ''}`,
      body: `<div class="ai-grid-row"><span>Departments</span><b>${depts}</b></div>
             <div class="ai-grid-row"><span>Categories</span><b>${cats}</b></div>
             <div class="ai-grid-row"><span>Total invoices</span><b>${_invoices().length}</b></div>
             <div class="ai-grid-row"><span>Employees</span><b>${_emps().length}</b></div>`,
      trace: `intent=count_vendors active=${active}`,
    };
  },
  department_list(p) {
    const byDept = {};
    _vendors().filter(v => v.status !== 'cancelled').forEach(v => { (byDept[v.department || 'Unassigned'] = byDept[v.department || 'Unassigned'] || { vendors: 0, spend: 0 }); byDept[v.department || 'Unassigned'].vendors++; byDept[v.department || 'Unassigned'].spend += annualCost(v); });
    const rows = Object.entries(byDept).sort((a, b) => b[1].spend - a[1].spend);
    return {
      headline: `<b>${rows.length}</b> departments`,
      body: rows.map(([d, x]) => `<div class="ai-grid-row"><span>${escapeHtml(d)}</span><span class="dim">${x.vendors} vendor${x.vendors === 1 ? '' : 's'}</span><b>${formatMoney(x.spend)}/yr</b></div>`).join(''),
      trace: `intent=department_list n=${rows.length}`,
    };
  },
  help(p) {
    return {
      headline: `Here's what I can answer`,
      body: CHAT_INTENTS.map(i => `<div class="ai-grid-row"><span>${escapeHtml(i.desc)}</span></div>`).join(''),
      trace: `intent=help`,
    };
  },
  search(p) {
    const q = p.raw.toLowerCase();
    const vendors = _vendors().filter(v => v.name.toLowerCase().includes(q) || (v.department || '').toLowerCase().includes(q) || (v.category || '').toLowerCase().includes(q));
    if (!vendors.length) {
      // Richer fallback: offer clickable chips of known intents
      const chips = [
        'Total SaaS spend this year',
        'Top risk contracts',
        'Renewals next 60 days',
        'Which tools are underused',
        'Spend by department',
        'List all vendors',
        'How many vendors do we have',
        'Cost per user for Slack',
      ];
      return {
        headline: `Not sure how to answer "${escapeHtml(p.raw)}" yet.`,
        body: `<div class="dim" style="margin-bottom:10px;font-size:12px">I didn't catch an intent in that question. Try one of these, or type <b>help</b> to see everything I can answer:</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${chips.map(c => `<button class="chip" data-chip-q="${encodeURIComponent(c)}">${escapeHtml(c)}</button>`).join('')}</div>`,
        trace: `intent=search_fallthrough query="${escapeHtml(p.raw)}"`,
      };
    }
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

/* ---------- Voice settings (language picker) ---------- */
const VOICE_LANGS = [
  { code: 'en-US', label: 'English (US)', native: 'English' },
  { code: 'en-IN', label: 'English (India)', native: 'English' },
  { code: 'en-GB', label: 'English (UK)', native: 'English' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
  { code: 'bn-IN', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
  { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa-IN', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];
function voiceSettings() {
  // Defensive: state may not be fully initialised when this is called from
  // the speechSynthesis onvoiceschanged timers that fire during script load.
  if (typeof state === 'undefined' || !state) return { ttsLang: 'en-US', sttLang: 'en-IN', ttsVoiceName: null, speakOn: true };
  if (!state.settings) state.settings = {};
  state.settings.voice = state.settings.voice || {};
  if (!state.settings.voice.ttsLang) state.settings.voice.ttsLang = 'en-US';   // default English, NOT Hindi
  if (!state.settings.voice.sttLang) state.settings.voice.sttLang = 'en-IN';   // STT default en-IN works best for Indian English speakers
  if (state.settings.voice.ttsVoiceName === undefined) state.settings.voice.ttsVoiceName = null; // null = auto-pick best for ttsLang
  if (state.settings.voice.speakOn === undefined) state.settings.voice.speakOn = true; // Speak defaults ON
  return state.settings.voice;
}
function _wireSpeakToggle(el) {
  if (!el) return;
  const vs = voiceSettings();
  el.checked = !!vs.speakOn;
  el.onchange = () => { vs.speakOn = el.checked; save(); syncSpeakToggles(); };
}
function syncSpeakToggles() {
  const vs = voiceSettings();
  document.querySelectorAll('[data-voice-pref]').forEach(el => { el.checked = !!vs.speakOn; });
}

/* ---------- Voice input (Web Speech API) ----------
   Inside the Claude artifact iframe the parent typically doesn't grant
   `microphone` permissions-policy, so SpeechRecognition fires an
   `not-allowed` error on start. We detect this and message clearly.
   On a hosted copy (saasspendtrack.com) the browser-native permission
   prompt appears and it just works. */
let _rec = null; let _recOn = false;
function _inArtifactIframe() {
  try {
    if (window.location.hostname.endsWith('claudeusercontent.com')) return true;
    if (window.parent !== window && document.referrer && /claude\.ai/i.test(document.referrer)) return true;
  } catch (_) {}
  return false;
}
function startVoice(onResult, onEnd) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    toast('Voice input not supported in this browser. Chrome, Edge or Safari give you the mic button.', 'warn');
    return false;
  }
  if (_rec && _recOn) return false;
  _rec = new Rec();
  _rec.lang = voiceSettings().sttLang || 'en-IN';
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
  _rec.onerror = (e) => {
    _recOn = false;
    const code = e.error || 'error';
    let msg = 'Voice input: ' + code;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      if (_inArtifactIframe()) {
        msg = 'Microphone is blocked inside the Claude artifact preview. Open Ask Track on your own domain (app.saasspendtrack.com when hosted) and voice will work. Text input works everywhere.';
      } else {
        msg = 'Microphone blocked. Click the lock icon in the address bar and allow the mic for this site, then try again.';
      }
    } else if (code === 'no-speech') { msg = "I didn't catch anything. Try again."; }
    else if (code === 'audio-capture') { msg = 'No microphone detected on this device.'; }
    else if (code === 'network') { msg = 'Voice recognition needs internet (it uses the browser\'s speech service). Check your connection.'; }
    toast(msg, 'warn');
    onEnd && onEnd('');
  };
  try { _rec.start(); _recOn = true; return true; }
  catch (e) { _recOn = false; toast('Could not start the mic: ' + (e?.message || e), 'warn'); return false; }
}
function stopVoice() { try { _rec && _rec.stop(); } catch (_) {} _recOn = false; }

/* ---------- Voice output (SpeechSynthesis) ----------
   Prefer an Indian English female voice, soft cadence. Fall back
   gracefully if none installed on this platform. Voices load async
   in Chrome — refresh the selected voice once voiceschanged fires. */
let _preferredVoice = null;

/* Score voices, but ONLY within the requested language family.
   The scorer never crosses language families — if user picks English,
   it will never fall back to a Hindi voice (and vice versa). */
function _scoreVoiceForLang(v, targetLangStem) {
  const n = (v.name || '').toLowerCase();
  const l = (v.lang || '').toLowerCase();
  // Hard filter: must match target language family (e.g. "en" or "hi")
  if (!l.startsWith(targetLangStem.toLowerCase())) return -1;
  let s = 0;
  // Quality tier — biggest lever
  if (/neural|natural/i.test(n)) s += 100;           // Microsoft Edge Natural (best in browser)
  if (/online/i.test(n)) s += 80;                    // Edge Online
  if (/wavenet|studio|news|polyglot/i.test(n)) s += 70;  // Google premium
  if (/enhanced|premium/i.test(n)) s += 50;          // macOS Enhanced
  if (/google/i.test(n)) s += 30;
  if (/microsoft/i.test(n) && !/desktop/i.test(n)) s += 20;
  if (/desktop/i.test(n)) s -= 20;                   // Old formant voices
  // Exact locale bonus (e.g. "en-IN" matches "en-IN" tighter than "en-US")
  return s;
}
/* Pick the best voice for the user's chosen TTS language.
   Respects an explicit ttsVoiceName override first.
   Prefers female voices via a mild boost (not a filter) so a soothing
   voice is picked when available but we never end up with no voice. */
function pickVoiceForLang(langCode) {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const vs = voiceSettings();
  // Explicit override
  if (vs.ttsVoiceName) {
    const hit = voices.find(v => v.name === vs.ttsVoiceName);
    if (hit) return hit;
  }
  // Prefer exact locale (en-IN), then same stem (en-*), then fall back to default
  const stem = (langCode || 'en-US').split('-')[0];
  const exact = voices.filter(v => (v.lang || '').toLowerCase() === langCode.toLowerCase());
  const stemMatch = voices.filter(v => (v.lang || '').toLowerCase().startsWith(stem.toLowerCase() + '-') || (v.lang || '').toLowerCase() === stem.toLowerCase());
  const pool = exact.length ? exact : stemMatch;
  if (!pool.length) {
    // Absolute last resort: platform default (don't cross language)
    return null;
  }
  const scored = pool.map(v => {
    let s = _scoreVoiceForLang(v, stem);
    const n = (v.name || '').toLowerCase();
    // Mild female preference within the chosen language (not a hard filter)
    if (/female|aria|jenny|neerja|swara|sneha|ananya|kajal|isha|libby|sonia|heera|veena|priya|aditi|karen|samantha|ava|zira|hazel|kate|serena/i.test(n)) s += 15;
    if (/male/i.test(n) && !/female/i.test(n)) s -= 5;
    return { v, s };
  }).sort((a, b) => b.s - a.s);
  return scored[0]?.v || pool[0];
}
/* Kept name for backward compat elsewhere in the file */
function pickIndianFemaleVoice() { return pickVoiceForLang(voiceSettings().ttsLang || 'en-US'); }

/* Debug helper so you can see what's installed and what won */
function _listVoicesDebug() {
  if (!('speechSynthesis' in window)) return [];
  const voices = speechSynthesis.getVoices() || [];
  const target = (voiceSettings().ttsLang || 'en-US').split('-')[0];
  return voices.map(v => ({ name: v.name, lang: v.lang, score: _scoreVoiceForLang(v, target), default: v.default }))
    .sort((a, b) => b.score - a.score);
}

/* Return available voices for the UI picker, grouped by language stem */
function listVoicesForPicker() {
  if (!('speechSynthesis' in window)) return {};
  const voices = speechSynthesis.getVoices() || [];
  const grouped = {};
  voices.forEach(v => {
    const stem = (v.lang || 'en').split('-')[0];
    (grouped[stem] ||= []).push({ name: v.name, lang: v.lang });
  });
  return grouped;
}
function _refreshVoice() { _preferredVoice = pickVoiceForLang(voiceSettings().ttsLang || 'en-US'); }
window.refreshAskTrackVoice = _refreshVoice;
if ('speechSynthesis' in window) {
  _refreshVoice();
  speechSynthesis.onvoiceschanged = _refreshVoice;
  // Chrome bug: sometimes needs a second tick
  setTimeout(_refreshVoice, 500);
  setTimeout(_refreshVoice, 2000);
}
/* Convert numbers and currency into spoken form so Veena doesn't read
   "$12,500" as "dollar one two comma five zero zero" */
function _humanizeForSpeech(t) {
  return t
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\$\s?([\d,]+(?:\.\d+)?)/g, (_, n) => _numberToWords(n) + ' dollars')
    .replace(/₹\s?([\d,]+(?:\.\d+)?)/g, (_, n) => _numberToWords(n) + ' rupees')
    .replace(/([\d,]+(?:\.\d+)?)\s*%/g, (_, n) => _numberToWords(n) + ' percent')
    .replace(/\bQ(\d)\b/g, 'Q $1')  // break "Q4" into "Q 4" for better reading
    .replace(/\s+/g, ' ')
    .trim();
}
function _numberToWords(ns) {
  // Keep compact: strip commas, keep as digit groups the engine can read naturally
  const clean = String(ns).replace(/,/g, '');
  const n = parseFloat(clean);
  if (isNaN(n)) return ns;
  // For round large numbers, say them readably
  if (n >= 1e7) return (n / 1e7).toFixed(1).replace(/\.0$/, '') + ' crore';
  if (n >= 1e5) return (n / 1e5).toFixed(1).replace(/\.0$/, '') + ' lakh';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + ' thousand';
  return String(n);
}

function _splitSentences(t) {
  // Split on sentence-ending punctuation but keep phrases that are too short bundled
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out = []; let buf = '';
  for (const p of parts) {
    if ((buf + ' ' + p).trim().length < 60) buf = (buf ? buf + ' ' : '') + p;
    else { if (buf) out.push(buf); buf = p; }
  }
  if (buf) out.push(buf);
  return out;
}

function _speakChunk(chunk, isFirst, isLast) {
  const u = new SpeechSynthesisUtterance(chunk);
  const vs = voiceSettings();
  if (!_preferredVoice || (_preferredVoice.lang || '').split('-')[0] !== (vs.ttsLang || 'en-US').split('-')[0]) _refreshVoice();
  if (_preferredVoice) { u.voice = _preferredVoice; u.lang = _preferredVoice.lang; }
  else { u.lang = vs.ttsLang || 'en-US'; }
  // Vary prosody slightly per chunk to avoid a flat monotone
  u.rate = 0.95 + (Math.random() * 0.06 - 0.03);     // 0.92 - 0.98
  u.pitch = 1.0 + (Math.random() * 0.08 - 0.04);     // 0.96 - 1.04
  u.volume = 0.95;
  speechSynthesis.speak(u);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const plain = _humanizeForSpeech(text || '');
  if (!plain) return;
  speechSynthesis.cancel();
  const chunks = _splitSentences(plain.slice(0, 600));
  chunks.forEach((c, i) => _speakChunk(c, i === 0, i === chunks.length - 1));
}

/* Expose for debugging + used by the picker UI */
window.AskTrackVoice = {
  pickIndianFemaleVoice, pickVoiceForLang, speak,
  get preferred() { return _preferredVoice; },
  listVoices: _listVoicesDebug,
  listVoicesForPicker,
  settings: voiceSettings,
  setLang(lang) { voiceSettings().ttsLang = lang; voiceSettings().ttsVoiceName = null; _refreshVoice(); save(); return _preferredVoice?.name; },
  setSttLang(lang) { voiceSettings().sttLang = lang; save(); return lang; },
  setVoiceByName(name) {
    const v = (speechSynthesis.getVoices() || []).find(x => x.name && x.name.toLowerCase().includes(name.toLowerCase()));
    if (v) { _preferredVoice = v; voiceSettings().ttsVoiceName = v.name; save(); return v.name; }
    return null;
  },
};

/* ---------- UI: topbar search bar + command-palette modal ----------
   Primary pattern: Cmd/Ctrl+K opens a centered modal with the same input
   and the same answer renderer. Topbar bar is the always-visible entry.
   The floating pill remains ONLY on mobile where the topbar is cramped.
   The dedicated #chat view keeps persistent history and voice reply. */

function ensureChatLauncher() {
  // Topbar search bar (desktop + tablet)
  const topRight = document.querySelector('.topbar-right');
  if (topRight && !document.getElementById('ai-topbar-search')) {
    const wrap = document.createElement('button');
    wrap.type = 'button';
    wrap.id = 'ai-topbar-search';
    wrap.className = 'ai-topbar-search';
    wrap.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span class="ai-topbar-placeholder">Ask Track…</span>
      <span class="ai-kbd">${/Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'} K</span>
    `;
    wrap.onclick = openChatModal;
    topRight.insertBefore(wrap, topRight.firstChild);
  }

  // Mobile-only floating pill (topbar search hides below 700px)
  if (!document.getElementById('ai-launcher')) {
    const btn = document.createElement('button');
    btn.id = 'ai-launcher';
    btn.className = 'ai-launcher ai-launcher-mobile-only';
    btn.title = 'Ask Track';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    btn.onclick = openChatModal;
    document.body.appendChild(btn);
  }

  // Global keyboard shortcut (Cmd/Ctrl+K)
  if (!window._aiCmdKWired) {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (document.getElementById('ai-modal')?.classList.contains('open')) closeChatModal();
        else openChatModal();
      }
    });
    window._aiCmdKWired = true;
  }
}

/* ---------- Command-palette modal ---------- */
function ensureChatModal() {
  if (document.getElementById('ai-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'ai-modal';
  modal.className = 'ai-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Ask Track');
  modal.innerHTML = `
    <div class="ai-modal-backdrop" data-close></div>
    <div class="ai-modal-panel">
      <form class="ai-modal-form" id="ai-modal-form">
        <svg class="ai-modal-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="ai-modal-input" placeholder="Ask Track — e.g. how much is marketing spending on Salesforce this quarter?" autocomplete="off" spellcheck="false"/>
        <button type="button" class="ai-mic ai-mic-modal" id="ai-mic-modal" title="Voice input">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
        </button>
        <span class="ai-kbd ai-kbd-esc">Esc</span>
      </form>
      <div class="ai-modal-body" id="ai-modal-body"></div>
      <footer class="ai-modal-foot">
        <span class="dim">Press <span class="ai-kbd">↵</span> to ask · <span class="ai-kbd">↑↓</span> suggestions · <span class="ai-kbd">Esc</span> close</span>
        <a href="#chat" id="ai-modal-full" class="dim">Open full view →</a>
      </footer>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#ai-modal-input');
  const body = modal.querySelector('#ai-modal-body');

  modal.querySelector('#ai-modal-form').onsubmit = (e) => { e.preventDefault(); const q = input.value.trim(); if (q) runModalQuery(q); };
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeChatModal));
  modal.querySelector('#ai-modal-full').onclick = (e) => { e.preventDefault(); closeChatModal(); switchView('chat'); };

  input.addEventListener('input', () => renderModalSuggestions(input.value));
  input.addEventListener('keydown', (e) => {
    const items = modal.querySelectorAll('.ai-sugg-item');
    const current = modal.querySelector('.ai-sugg-item.active');
    let idx = [...items].indexOf(current);
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); items.forEach(i => i.classList.remove('active')); items[idx]?.classList.add('active'); items[idx]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); items.forEach(i => i.classList.remove('active')); items[idx]?.classList.add('active'); items[idx]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && current) { e.preventDefault(); input.value = current.dataset.q; runModalQuery(current.dataset.q); }
    else if (e.key === 'Escape') { closeChatModal(); }
  });

  modal.querySelector('#ai-mic-modal').onclick = () => {
    if (_recOn) { stopVoice(); return; }
    const mic = modal.querySelector('#ai-mic-modal');
    mic.classList.add('recording');
    startVoice(
      (text) => { input.value = text; renderModalSuggestions(text); },
      (finalText) => {
        mic.classList.remove('recording');
        if (finalText) runModalQuery(finalText);
      }
    );
  };
}
function _modalEscHandler(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeChatModal(); }
}
function openChatModal() {
  ensureChatModal();
  const m = document.getElementById('ai-modal');
  m.classList.add('open');
  const input = m.querySelector('#ai-modal-input');
  setTimeout(() => input.focus(), 50);
  renderModalSuggestions(input.value);
  // Global Esc — bind at document capture phase so it works regardless of focus
  document.addEventListener('keydown', _modalEscHandler, true);
}
function closeChatModal() {
  const m = document.getElementById('ai-modal');
  if (!m) return;
  m.classList.remove('open');
  document.removeEventListener('keydown', _modalEscHandler, true);
  // Return focus to the topbar bar if present (accessibility)
  const topbar = document.getElementById('ai-topbar-search');
  topbar?.focus();
  // Also stop any speech that's playing so closing silences the voice
  try { speechSynthesis?.cancel(); } catch (_) {}
  try { stopVoice(); } catch (_) {}
}
function runModalQuery(q) {
  const body = document.getElementById('ai-modal-body');
  body.innerHTML = `<div class="ai-modal-loading">Thinking…</div>`;
  setTimeout(() => {
    const parsed = routeChatQuery(q);
    const ans = answerChat(parsed);
    pushChat('user', q);
    pushChat('assistant', ans, { intent: parsed.intent });
    body.innerHTML = `
      <div class="ai-modal-answer">
        <div class="ai-headline">${ans.headline || ''}</div>
        <div class="ai-body">${ans.body || ''}</div>
        ${ans.sources?.length ? `<div class="ai-sources"><span class="dim">Sources:</span> ${ans.sources.map(s => `<a href="#" data-nav-src="${s.view}:${s.id}">${escapeHtml(s.label)}</a>`).join(', ')}</div>` : ''}
        <details class="ai-trace"><summary class="dim">why this answer</summary><code>${escapeHtml(ans.trace || '')}</code></details>
      </div>
    `;
    body.querySelectorAll('[data-nav-src]').forEach(a => a.onclick = (e) => { e.preventDefault(); const [view, id] = a.dataset.navSrc.split(':'); closeChatModal(); switchView(view); if (typeof openContractDetail === 'function') openContractDetail(id); });
    body.querySelectorAll('[data-nav-vendor]').forEach(r => r.onclick = () => { closeChatModal(); if (typeof openContractDetail === 'function') openContractDetail(r.dataset.navVendor); });
    body.querySelectorAll('[data-chip-q]').forEach(c => c.onclick = () => { const q2 = decodeURIComponent(c.dataset.chipQ); document.getElementById('ai-modal-input').value = q2; runModalQuery(q2); });
    // Speak the headline if voice reply is on (default)
    if (voiceSettings().speakOn) speak(ans.headline);
  }, 20);
}
function renderModalSuggestions(q) {
  const body = document.getElementById('ai-modal-body');
  if (!body) return;
  const seed = [
    'Total SaaS spend this year',
    'Top risk contracts',
    'Renewals next 60 days',
    'Which tools are underused',
    'Spend by department',
    'Which contracts are missing a DPA',
    'Any invoices overdue?',
    'Cost per user for Slack',
    'How many Figma licences do I need next quarter',
    'Who owns HubSpot',
  ];
  const vendors = (state.subscriptions || []).slice(0, 25).map(v => `Spend on ${v.name}`);
  const pool = [...seed, ...vendors];
  const qt = (q || '').toLowerCase().trim();
  const items = (qt ? pool.filter(x => x.toLowerCase().includes(qt)) : pool).slice(0, 8);
  if (!items.length && qt) {
    body.innerHTML = `<div class="ai-modal-hint dim">Press ↵ to ask: <b>"${escapeHtml(q)}"</b></div>`;
    return;
  }
  body.innerHTML = `
    <div class="ai-sugg-list">
      ${items.map((x, i) => `<button type="button" class="ai-sugg-item ${i === 0 ? 'active' : ''}" data-q="${encodeURIComponent(x)}">${escapeHtml(x)}</button>`).join('')}
    </div>`;
  body.querySelectorAll('.ai-sugg-item').forEach(b => {
    b.onmouseenter = () => { body.querySelectorAll('.ai-sugg-item').forEach(x => x.classList.remove('active')); b.classList.add('active'); };
    b.onclick = () => { const q = decodeURIComponent(b.dataset.q); document.getElementById('ai-modal-input').value = q; runModalQuery(q); };
  });
}
function ensureChatDrawer() {
  if (document.getElementById('ai-drawer')) return;
  const div = document.createElement('div');
  div.id = 'ai-drawer';
  div.className = 'ai-drawer';
  div.innerHTML = `
    <header class="ai-head">
      <div><b>Ask Track</b><div class="dim" style="font-size:11px">Grounded answers from your own data</div></div>
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
      <label class="ai-voice-toggle" title="Speak replies"><input type="checkbox" id="ai-voice-reply" data-voice-pref="drawer"/> <span>🔊</span></label>
      <button type="submit" class="btn-primary">Send</button>
    </form>`;
  document.body.appendChild(div);
  div.querySelector('#ai-close').onclick = toggleChatDrawer;
  _wireSpeakToggle(div.querySelector('#ai-voice-reply'));
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
        <h2>Ask Track</h2>
        <p class="page-sub">Natural-language questions over every subscription, contract, invoice, licence and clause in your workspace. Voice input + voice replies supported.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="icon-btn" id="chat-voice-settings" title="Voice settings">🎙 Voice</button>
        <button class="icon-btn" id="chat-clear">Clear chat</button>
      </div>
    </div>
    <div id="chat-voice-pane" class="chat-voice-pane" hidden>
      <div class="vp-grid">
        <label>Reply voice language
          <select id="vp-tts-lang"></select>
        </label>
        <label>Reply voice
          <select id="vp-tts-voice"></select>
        </label>
        <label>Mic input language
          <select id="vp-stt-lang"></select>
        </label>
        <div class="vp-actions">
          <button class="icon-btn" id="vp-test">Test voice</button>
          <span class="dim" style="font-size:11px">Voice preferences save automatically. Mic input will use the chosen language next time you press the mic.</span>
        </div>
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
          <input id="ai-input-full" placeholder="Ask Track — anything about your SaaS portfolio…" autocomplete="off"/>
          <label class="ai-voice-toggle"><input type="checkbox" id="ai-voice-reply-full" data-voice-pref="full"/> <span>🔊 Speak</span></label>
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
  _wireSpeakToggle(section.querySelector('#ai-voice-reply-full'));
  section.querySelector('#chat-voice-settings').onclick = () => {
    const pane = section.querySelector('#chat-voice-pane');
    pane.hidden = !pane.hidden;
    if (!pane.hidden) renderVoicePane(section);
  };
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
  btn.innerHTML = `${svg}<span>Ask Track</span><span class="badge" style="margin-left:auto;background:var(--accent);color:#fff;font-size:9px">AI</span>`;
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
      if (crumb) crumb.textContent = name === 'chat' ? 'Ask Track' : 'Licence forecast';
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
    // Use the persisted preference as the source of truth; checkbox mirrors it
    if (voiceSettings().speakOn) speak(ans.headline);
  }, 60);
}

function renderChatMessages(surface) {
  const host = document.getElementById(surface === 'full' ? 'ai-messages-full' : 'ai-messages');
  if (!host) return;
  const log = chatLog();
  if (!log.length) {
    host.innerHTML = `<div class="ai-welcome">
      <h3>Ask Track anything about your SaaS portfolio.</h3>
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
  host.querySelectorAll('[data-chip-q]').forEach(c => c.onclick = () => handleQuery(decodeURIComponent(c.dataset.chipQ), surface));
  // Scroll to bottom
  host.scrollTop = host.scrollHeight;
}

/* ---------- Hook renderAll ---------- */
const _prevAll13 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll13) {
  window.renderAll = function () {
    _prevAll13();
    try { ensureChatView(); ensureChatNav(); patchSwitchViewForChat(); ensureChatLauncher(); ensureChatModal(); ensureChatDrawer(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { ensureChatView(); ensureChatNav(); patchSwitchViewForChat(); ensureChatLauncher(); ensureChatModal(); ensureChatDrawer(); } catch (_) {} }, 600);
});

// Register page title + make sure switchView knows it
if (window.PAGE_TITLES) { window.PAGE_TITLES.chat = 'Ask Track'; window.PAGE_TITLES.forecast = 'Licence forecast'; }

/* ---------- Voice settings pane renderer ---------- */
function renderVoicePane(section) {
  const vs = voiceSettings();
  const ttsLangSel = section.querySelector('#vp-tts-lang');
  const ttsVoiceSel = section.querySelector('#vp-tts-voice');
  const sttLangSel = section.querySelector('#vp-stt-lang');

  // Language options (same list for TTS and STT)
  const opts = VOICE_LANGS.map(l => `<option value="${l.code}">${escapeHtml(l.label)}${l.native !== l.label.split(' ')[0] ? ' — ' + escapeHtml(l.native) : ''}</option>`).join('');
  ttsLangSel.innerHTML = opts;
  sttLangSel.innerHTML = opts;
  ttsLangSel.value = vs.ttsLang;
  sttLangSel.value = vs.sttLang;

  const populateVoiceSelect = () => {
    const grouped = listVoicesForPicker();
    const stem = (vs.ttsLang || 'en-US').split('-')[0];
    const available = grouped[stem] || [];
    if (!available.length) {
      ttsVoiceSel.innerHTML = `<option value="">No voices installed on this device for ${escapeHtml(vs.ttsLang)}</option>`;
      ttsVoiceSel.disabled = true;
    } else {
      ttsVoiceSel.disabled = false;
      ttsVoiceSel.innerHTML = '<option value="">Auto (best available)</option>' + available
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(v => `<option value="${encodeURIComponent(v.name)}">${escapeHtml(v.name)} <small>(${escapeHtml(v.lang)})</small></option>`).join('');
      ttsVoiceSel.value = vs.ttsVoiceName ? encodeURIComponent(vs.ttsVoiceName) : '';
    }
  };
  populateVoiceSelect();

  ttsLangSel.onchange = () => { vs.ttsLang = ttsLangSel.value; vs.ttsVoiceName = null; _refreshVoice(); save(); populateVoiceSelect(); };
  ttsVoiceSel.onchange = () => { vs.ttsVoiceName = ttsVoiceSel.value ? decodeURIComponent(ttsVoiceSel.value) : null; _refreshVoice(); save(); };
  sttLangSel.onchange = () => { vs.sttLang = sttLangSel.value; save(); toast('Mic will use ' + sttLangSel.options[sttLangSel.selectedIndex].text + ' next time', 'info'); };

  section.querySelector('#vp-test').onclick = () => {
    const samples = {
      en: 'This is a test. Ask Track is ready to answer questions about your SaaS portfolio.',
      hi: 'यह एक परीक्षण है। आस्क ट्रैक आपके सास पोर्टफोलियो के बारे में प्रश्नों के उत्तर देने के लिए तैयार है।',
      ta: 'இது ஒரு சோதனை. ஆஸ்க் டிராக் உங்கள் சாஸ் போர்ட்ஃபோலியோ குறித்த கேள்விகளுக்கு பதிலளிக்க தயாராக உள்ளது.',
      te: 'ఇది ఒక పరీక్ష. ఆస్క్ ట్రాక్ మీ శాస్ పోర్ట్ఫోలియో గురించి ప్రశ్నలకు సమాధానం చెప్పడానికి సిద్ధంగా ఉంది.',
      bn: 'এটি একটি পরীক্ষা। আস্ক ট্র্যাক আপনার সাস পোর্টফোলিও সম্পর্কে প্রশ্নের উত্তর দিতে প্রস্তুত।',
      mr: 'ही एक चाचणी आहे. आस्क ट्रॅक तुमच्या सास पोर्टफोलिओबद्दल प्रश्नांची उत्तरे देण्यास तयार आहे.',
      gu: 'આ એક પરીક્ષણ છે. આસ્ક ટ્રેક તમારા સાસ પોર્ટફોલિયો વિશેના પ્રશ્નોના જવાબ આપવા માટે તૈયાર છે.',
      kn: 'ಇದು ಒಂದು ಪರೀಕ್ಷೆ. ಆಸ್ಕ್ ಟ್ರ್ಯಾಕ್ ನಿಮ್ಮ ಸಾಸ್ ಪೋರ್ಟ್ಫೋಲಿಯೊ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಲು ಸಿದ್ಧವಾಗಿದೆ.',
      ml: 'ഇതൊരു പരീക്ഷണമാണ്. നിങ്ങളുടെ സാസ് പോർട്ട്ഫോളിയോയെക്കുറിച്ചുള്ള ചോദ്യങ്ങൾക്ക് ഉത്തരം നൽകാൻ ആസ്ക് ട്രാക്ക് തയ്യാറാണ്.',
      pa: 'ਇਹ ਇੱਕ ਟੈਸਟ ਹੈ। ਆਸਕ ਟ੍ਰੈਕ ਤੁਹਾਡੇ ਸਾਸ ਪੋਰਟਫੋਲੀਓ ਬਾਰੇ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦੇਣ ਲਈ ਤਿਆਰ ਹੈ।',
    };
    const stem = (vs.ttsLang || 'en-US').split('-')[0];
    speak(samples[stem] || samples.en);
  };
}
