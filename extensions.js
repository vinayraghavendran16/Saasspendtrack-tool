/* ==========================================================================
   SaaS Spend Track — Phase 2 extensions
   - Expanded clause taxonomy (18 clauses) with industry-aware weighting
   - Portfolio risk engine (8 dimensions)
   - Bulk ingestion with OCR (Tesseract.js, lazy-loaded)
   - Contracts module v2 (per-contract risk, bulk upload, OCR status)
   - Risk Analytics dashboard
   - Integration roadmap (85+ targets, categorised with status)
   - Owner Backlog view (limitations tracker, product management)
   ========================================================================== */

/* ---------------------------------------------------------------- settings */
function ownerModeEnabled() { return !!state.settings.ownerMode; }
function setOwnerMode(on) { state.settings.ownerMode = !!on; save(); renderNav(); renderAll(); }
function customerIndustry() { return state.settings.industry || 'generic'; }
function setIndustry(v) { state.settings.industry = v; save(); renderAll(); }

const INDUSTRIES = {
  generic:   { label: 'Generic / Horizontal' },
  bfsi:      { label: 'Banking, Financial Services & Insurance' },
  healthcare:{ label: 'Healthcare / Life Sciences' },
  saas:      { label: 'B2B SaaS' },
  manufacturing:{ label: 'Manufacturing / Supply Chain' },
  public:    { label: 'Public Sector / Government' },
  retail:    { label: 'Retail / E-commerce' },
};

/* ---------------------------------------------------------------- expanded clause taxonomy */
const CLAUSE_LIBRARY = [
  // --- commercial / financial
  { id: 'renewal',     label: 'Renewal type',        dim: 'financial',   weight: 2, extractor: 'renewalType',  critical: true },
  { id: 'notice',      label: 'Notice period',       dim: 'financial',   weight: 2, extractor: 'noticePeriod', critical: true },
  { id: 'term',        label: 'Term length',         dim: 'financial',   weight: 1, extractor: 'termLength' },
  { id: 'priceCap',    label: 'Price escalation cap',dim: 'financial',   weight: 2, extractor: 'priceCap',     critical: true },
  { id: 'paymentDays', label: 'Payment terms',       dim: 'financial',   weight: 1, extractor: 'paymentDays' },
  { id: 'lateFee',     label: 'Late payment penalty',dim: 'financial',   weight: 1, extractor: 'lateFee' },
  // --- legal
  { id: 'governingLaw',label: 'Governing law',       dim: 'legal',       weight: 1, extractor: 'governingLaw', critical: true },
  { id: 'disputes',    label: 'Dispute resolution',  dim: 'legal',       weight: 1, extractor: 'disputes' },
  { id: 'indemnity',   label: 'Indemnification',     dim: 'legal',       weight: 2, extractor: 'indemnity' },
  { id: 'liabilityCap',label: 'Limitation of liability', dim: 'legal',   weight: 2, extractor: 'liabilityCap', critical: true },
  { id: 'warranty',    label: 'Warranty / disclaimer', dim: 'legal',     weight: 1, extractor: 'warranty' },
  { id: 'assignment',  label: 'Assignment / change of control', dim: 'legal', weight: 1, extractor: 'assignment' },
  // --- operational / functional
  { id: 'sla',         label: 'Service level (SLA)', dim: 'operational', weight: 2, extractor: 'sla',          critical: true },
  { id: 'support',     label: 'Support tier',        dim: 'functional',  weight: 1, extractor: 'support' },
  { id: 'termination', label: 'Termination rights',  dim: 'operational', weight: 2, extractor: 'termination' },
  // --- data / security / compliance
  { id: 'dpa',         label: 'Data processing / DPA',dim: 'data',       weight: 2, extractor: 'dpa',          critical: true },
  { id: 'security',    label: 'Security certifications', dim: 'data',    weight: 2, extractor: 'security' },
  { id: 'audit',       label: 'Right to audit',      dim: 'compliance',  weight: 1, extractor: 'audit' },
];

/* ---------------------------------------------------------------- new extractors */
function _find(text, patterns, radius = 90) {
  for (const re of patterns) { const m = text.match(re); if (m) return { m, snippet: snippetAround(text, m.index, m[0].length, radius) }; }
  return null;
}
function _re(text, pats) {
  const r = _find(text, pats); if (!r) return null;
  return { value: r.m[0].replace(/\s+/g, ' ').trim().slice(0, 140), snippet: r.snippet };
}

function extractPaymentDays(text) {
  const p = _find(text, [
    /\bnet\s+(\d{1,3})\s+days?\b/i,
    /\bpayment.{0,40}?within\s+(\d{1,3})\s+days?\b/i,
    /\bdue\s+(?:and\s+payable\s+)?within\s+(\d{1,3})\s+days?\b/i,
    /\b(\d{1,3})\s+days?\s+from\s+(?:the\s+)?invoice\s+date\b/i,
  ]);
  if (!p) return null;
  const days = parseInt(p.m[1], 10);
  return { value: `Net ${days}`, days, snippet: p.snippet };
}
function extractLateFee(text) {
  return _re(text, [
    /late\s+(?:payment\s+)?(?:fee|charge|interest)[^.]{0,120}?\d+(?:\.\d+)?\s*%/i,
    /interest\s+at\s+(?:the\s+)?rate\s+of\s+\d+(?:\.\d+)?\s*%[^.]{0,80}?per\s+(?:month|annum)/i,
  ]);
}
function extractGoverningLaw(text) {
  const r = _find(text, [
    /governed\s+by\s+(?:and\s+construed\s+in\s+accordance\s+with\s+)?the\s+laws\s+of\s+(?:the\s+)?([A-Z][A-Za-z\s,]{2,40}?)(?:[.,]|\s+without)/i,
    /laws\s+of\s+(?:the\s+)?([A-Z][A-Za-z\s,]{2,40}?)\s+shall\s+govern/i,
    /jurisdiction\s+of\s+(?:the\s+courts\s+of\s+)?([A-Z][A-Za-z\s,]{2,40})/i,
  ]);
  if (!r) return null;
  return { value: r.m[1].trim(), snippet: r.snippet };
}
function extractDisputes(text) {
  return _re(text, [
    /\bbinding\s+arbitration\b[^.]{0,120}/i,
    /\barbitration\s+(?:under|in\s+accordance\s+with|administered\s+by)[^.]{0,120}/i,
    /\bexclusive\s+jurisdiction\s+of\s+(?:the\s+)?courts[^.]{0,80}/i,
    /\bmediation\s+(?:prior\s+to|before)[^.]{0,80}/i,
  ]);
}
function extractIndemnity(text) {
  return _re(text, [
    /\b(?:mutual|one[-\s]way)\s+indemnifi(?:cation|es)[^.]{0,120}/i,
    /\bshall\s+indemnify[^.]{0,160}/i,
    /\bindemnification\s+(?:cap|limit)[^.]{0,80}/i,
  ]);
}
function extractLiabilityCap(text) {
  const r = _find(text, [
    /(?:limitation|limit)\s+of\s+liability[^.]{0,180}/i,
    /(?:aggregate\s+)?liability[^.]{0,80}?(?:not\s+exceed|shall\s+not\s+exceed|capped?\s+at|limited\s+to)[^.]{0,80}/i,
    /\btotal\s+liability[^.]{0,120}?(?:12|twelve)\s+months['’]?\s+(?:fees|charges)/i,
  ]);
  if (!r) return null;
  const txt = r.m[0];
  let cap = null;
  const mult = txt.match(/(\d+(?:\.\d+)?)\s*(?:x|times)\s+(?:the\s+)?(?:annual\s+)?fees/i);
  const months = txt.match(/(\d{1,2}|six|twelve|eighteen|twenty[-\s]four)\s+months['’]?\s+(?:fees|charges)/i);
  if (mult) cap = `${mult[1]}x annual fees`;
  else if (months) cap = `${wordToNum(months[1]) || months[1]} months' fees`;
  else cap = txt.replace(/\s+/g, ' ').trim().slice(0, 140);
  return { value: cap, snippet: r.snippet };
}
function extractWarranty(text) {
  return _re(text, [
    /\bAS[-\s]?IS\b[^.]{0,80}/i,
    /\bwithout\s+warranty\s+of\s+any\s+kind\b[^.]{0,80}/i,
    /\bdisclaim(?:s|er)[^.]{0,80}?warranties[^.]{0,80}/i,
    /\blimited\s+warranty[^.]{0,120}/i,
  ]);
}
function extractAssignment(text) {
  return _re(text, [
    /\bchange\s+of\s+control[^.]{0,140}/i,
    /\bassignment[^.]{0,80}?(?:prior\s+written\s+consent|not\s+assigned)[^.]{0,80}/i,
    /\bmay\s+not\s+assign\b[^.]{0,80}/i,
  ]);
}
function extractSla(text) {
  const r = _find(text, [
    /(?:uptime|availability)[^.]{0,80}?(\d{2,3}(?:\.\d+)?)\s*%/i,
    /service\s+level[^.]{0,80}?(\d{2,3}(?:\.\d+)?)\s*%/i,
  ]);
  if (!r) return null;
  const pct = parseFloat(r.m[1]);
  return { value: `${pct}% uptime`, pct, snippet: r.snippet };
}
function extractSupport(text) {
  return _re(text, [
    /\b(24\s*[x\/]\s*7|business\s+hours|9\s*[x\/]\s*5)[^.]{0,80}?support/i,
    /support\s+(?:is\s+)?(?:available|provided)[^.]{0,80}/i,
    /response\s+time[^.]{0,80}/i,
  ]);
}
function extractTermination(text) {
  return _re(text, [
    /terminat(?:e|ion)\s+for\s+convenience[^.]{0,120}/i,
    /terminat(?:e|ion)\s+for\s+cause[^.]{0,120}/i,
    /right\s+to\s+terminat(?:e|ion)[^.]{0,120}/i,
    /(?:either|customer)\s+party\s+may\s+terminate[^.]{0,120}/i,
  ]);
}
function extractDpa(text) {
  return _re(text, [
    /data\s+processing\s+(?:addendum|agreement|annex)[^.]{0,80}/i,
    /\bDPA\b[^.]{0,80}/i,
    /processor\s+shall[^.]{0,120}?personal\s+data/i,
    /(?:GDPR|DPDP(?:\s+Act)?|CCPA|HIPAA|PCI[-\s]?DSS)\b[^.]{0,120}/i,
  ]);
}
function extractSecurity(text) {
  return _re(text, [
    /\bSOC\s*2\s*(?:Type\s*(?:I|II|1|2))?\b[^.]{0,80}/i,
    /\bISO\s*27001\b[^.]{0,80}/i,
    /\bHIPAA\s+(?:compliant|covered)\b[^.]{0,80}/i,
    /\bPCI[-\s]?DSS\b[^.]{0,80}/i,
    /\bencryption\s+(?:at\s+rest|in\s+transit)\b[^.]{0,80}/i,
  ]);
}
function extractAudit(text) {
  return _re(text, [
    /right\s+to\s+audit[^.]{0,120}/i,
    /customer\s+shall\s+have\s+the\s+right\s+to\s+audit[^.]{0,120}/i,
    /audit\s+(?:once|not\s+more\s+than\s+once|annually)[^.]{0,80}/i,
  ]);
}

/* ---------------------------------------------------------------- table detection */
function detectTables(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let cur = null;
  const rowRe = /(\|.+\|)|((?:\S+\s*\t\s*){2,}\S+)|((?:\$[\d,]+|\d+\s*%|\d{1,3}(?:,\d{3})+)\s+.{0,80}){2,}/;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    const isRow = ln && rowRe.test(ln);
    if (isRow) {
      if (!cur) cur = { start: i, rows: [] };
      cur.rows.push(ln);
    } else if (cur) {
      if (cur.rows.length >= 3) tables.push({ ...cur, end: i });
      cur = null;
    }
  }
  if (cur && cur.rows.length >= 3) tables.push(cur);
  return tables.slice(0, 5);
}

/* ---------------------------------------------------------------- deep extraction (all clauses) */
const EXTRACTORS = {
  renewalType: extractRenewalType, noticePeriod: extractNoticePeriod, termLength: extractTermLength, priceCap: extractPriceCap,
  paymentDays: extractPaymentDays, lateFee: extractLateFee, governingLaw: extractGoverningLaw, disputes: extractDisputes,
  indemnity: extractIndemnity, liabilityCap: extractLiabilityCap, warranty: extractWarranty, assignment: extractAssignment,
  sla: extractSla, support: extractSupport, termination: extractTermination, dpa: extractDpa, security: extractSecurity, audit: extractAudit,
};
function deepExtract(text) {
  const out = {};
  CLAUSE_LIBRARY.forEach(c => { out[c.id] = EXTRACTORS[c.extractor] ? EXTRACTORS[c.extractor](text) : null; });
  const found = Object.values(out).filter(v => v).length;
  const confidence = Math.round((found / CLAUSE_LIBRARY.length) * 100);
  return { clauses: out, confidence, tables: detectTables(text), chars: text.length };
}

/* ---------------------------------------------------------------- RISK ENGINE
   Dimensions scored 0-100 (higher = more risk). Each dimension has a set of
   signal functions that emit {score, reason}. Portfolio risk is the vendor-cost
   weighted mean. */
const RISK_DIMS = [
  { id: 'financial',   label: 'Financial',             colour: '#dc2626' },
  { id: 'legal',       label: 'Legal',                 colour: '#b45309' },
  { id: 'operational', label: 'Operational',           colour: '#d97706' },
  { id: 'functional',  label: 'Functional',            colour: '#7c3aed' },
  { id: 'usage',       label: 'Usage',                 colour: '#0891b2' },
  { id: 'data',        label: 'Data & Security',       colour: '#be185d' },
  { id: 'compliance',  label: 'Compliance',            colour: '#4338ca' },
  { id: 'vendor',      label: 'Vendor concentration',  colour: '#047857' },
];

function clamp(n) { return Math.max(0, Math.min(100, n)); }

function scoreContract(sub, portfolioCtx = {}) {
  const c = sub.contract || {};
  const signals = {}; // dim -> [{ score, reason, severity }]
  const add = (dim, score, reason, severity = 'warn') => {
    (signals[dim] ||= []).push({ score: clamp(score), reason, severity });
  };

  // FINANCIAL
  if (c.autoRenew && !c.noticeDays)        add('financial', 85, 'Auto-renew with no notice period on file: can lock in next term silently', 'danger');
  else if (c.autoRenew && c.noticeDays > 60) add('financial', 55, `Auto-renew with ${c.noticeDays}-day notice window: easy to miss`, 'warn');
  if (c.priceCapPct == null && c.renewalType !== 'Manual renewal')
                                           add('financial', 60, 'No price-escalation cap in extracted terms: uplift is uncapped', 'warn');
  else if (c.priceCapPct != null && c.priceCapPct >= 8)
                                           add('financial', 45, `Price cap of ${c.priceCapPct}% is above the 5-7% market norm`, 'warn');
  if (sub.cost >= 10000 && sub.cycle === 'yearly')
                                           add('financial', 35, 'Single large annual payment: cash-flow lumpy; consider monthly or quarterly', 'info');
  // paid-but-overdue history via invoices
  const overdue = state.invoices?.filter(i => i.subId === sub.id && invoiceStatus(i) === 'overdue').length || 0;
  if (overdue >= 1)                        add('financial', 50 + overdue * 10, `${overdue} overdue invoice${overdue > 1 ? 's' : ''} on file`, 'warn');

  // LEGAL
  if (!c.governingLaw)                     add('legal', 35, 'Governing law not extracted: jurisdiction unclear', 'info');
  else if (/delaware|new york|california|texas/i.test(c.governingLaw) && !/india|singapore/i.test(c.governingLaw))
                                           add('legal', 45, `Governed by ${c.governingLaw}: disputes handled outside India`, 'warn');
  if (!c.liabilityCap)                     add('legal', 55, 'No limitation-of-liability extracted: exposure is unbounded on paper', 'warn');
  else if (/no\s+cap|unlimited|no\s+limit/i.test(c.liabilityCap || ''))
                                           add('legal', 85, 'Liability stated as unlimited', 'danger');
  if (!c.indemnity)                        add('legal', 30, 'No indemnification clause identified', 'info');

  // OPERATIONAL
  if (!c.termination)                      add('operational', 45, 'No termination-for-convenience clause identified: exit is only at renewal', 'warn');
  if (c.autoRenew && !c.noticeDays)        add('operational', 55, 'No cancellation-window tracking is possible without a notice period', 'warn');
  if (c.termLength && /24|36|multi/i.test(c.termLength))
                                           add('operational', 40, `Multi-year term (${c.termLength}): early exit will be costly`, 'info');

  // FUNCTIONAL
  if (!c.sla)                              add('functional', 40, 'No SLA extracted: availability guarantees unknown', 'info');
  else if (c.sla && /9[0-8](?!\.)/.test(c.sla))
                                           add('functional', 55, `SLA stated as ${c.sla}: below the 99%+ enterprise norm`, 'warn');
  if (!c.support)                          add('functional', 25, 'Support tier not explicitly documented', 'info');

  // USAGE (from licences and invoices)
  const cons = typeof consumption === 'function' ? consumption(sub) : null;
  if (cons) {
    if (cons.utilizationPct < 50)          add('usage', 80, `Only ${cons.utilizationPct}% of seats used; ${formatMoney(cons.unusedCostMonthly)}/mo wasted`, 'danger');
    else if (cons.utilizationPct < 70)     add('usage', 55, `${cons.utilizationPct}% utilisation: reclaimable seats at renewal`, 'warn');
    if (cons.assigned === cons.total)      add('usage', 25, 'All seats assigned: no buffer for new hires', 'info');
  } else if (sub.cost >= 1000)             add('usage', 30, 'No licence-usage data captured: cannot validate seat value', 'info');

  // DATA & SECURITY
  if (!c.dpa)                              add('data', 50, 'No DPA / data-processing terms identified', 'warn');
  if (!c.security)                         add('data', 45, 'No security certifications (SOC 2, ISO 27001, HIPAA) extracted', 'warn');

  // COMPLIANCE (industry-weighted)
  const ind = customerIndustry();
  if (ind === 'bfsi' && !c.audit)          add('compliance', 55, 'Right-to-audit missing; BFSI customers typically require it', 'warn');
  if (ind === 'healthcare' && !/hipaa/i.test(c.security || '') && !/hipaa/i.test(c.dpa || ''))
                                           add('compliance', 70, 'No HIPAA reference in security or DPA clauses', 'danger');
  if (ind === 'public' && c.governingLaw && !/india/i.test(c.governingLaw))
                                           add('compliance', 50, 'Foreign governing law may violate public-sector procurement policy', 'warn');

  // VENDOR CONCENTRATION
  const monthly = monthlyCost(sub);
  const total = portfolioCtx.totalMonthly || 1;
  const share = (monthly / total) * 100;
  if (share > 15)                          add('vendor', 70, `${share.toFixed(1)}% of total software spend sits on one vendor`, 'warn');
  else if (share > 8)                      add('vendor', 45, `${share.toFixed(1)}% of total spend`, 'info');
  const sameCategory = (portfolioCtx.byCategory?.[sub.category] || 0);
  if (sameCategory >= 3)                   add('vendor', 35, `${sameCategory} tools in '${sub.category}': consolidation opportunity`, 'info');

  // roll up per dimension
  const perDim = {};
  RISK_DIMS.forEach(d => {
    const sigs = signals[d.id] || [];
    perDim[d.id] = { score: sigs.length ? Math.round(Math.max(...sigs.map(s => s.score))) : 10, signals: sigs };
  });
  const overall = Math.round(Object.values(perDim).reduce((s, x) => s + x.score, 0) / RISK_DIMS.length);
  return { perDim, overall, signals };
}

function portfolioCtx() {
  const active = activeSubs();
  const totalMonthly = active.reduce((s, x) => s + monthlyCost(x), 0);
  const byCategory = {};
  active.forEach(s => { if (s.category) byCategory[s.category] = (byCategory[s.category] || 0) + 1; });
  return { totalMonthly, byCategory };
}
function riskBand(score) {
  if (score >= 70) return { label: 'Critical', cls: 'danger' };
  if (score >= 50) return { label: 'High',     cls: 'warn' };
  if (score >= 30) return { label: 'Medium',   cls: 'info' };
  return { label: 'Low', cls: 'ok' };
}
function recommendedAction(dim, signals) {
  if (!signals.length) return null;
  const top = signals.sort((a, b) => b.score - a.score)[0];
  const actions = {
    financial: 'Add a price-cap clause at next renegotiation; set an owner acknowledgement 90 days before the act-by date.',
    legal: 'Ask the vendor to add a mutual liability cap of 12 months\' fees and a limited indemnity for IP infringement.',
    operational: 'Negotiate a termination-for-convenience right with 60 days\' notice; capture the cancellation URL on the subscription record.',
    functional: 'Request the vendor\'s SLA document; attach it to the contract record.',
    usage: 'Reclaim unused seats before the next renewal; benchmark the committed seat count against the trailing 90-day active user count.',
    data: 'Request the latest DPA and security certification letter (SOC 2 Type II or ISO 27001); add to the contract record.',
    compliance: 'Confirm with the compliance owner whether this vendor needs to be added to the regulated-vendor register.',
    vendor: 'Review whether this vendor should remain single-sourced; identify one back-up before the next renewal.',
  };
  return actions[dim] || null;
}

/* ---------------------------------------------------------------- RENDER: per-contract risk pill */
function riskPillsFor(sub) {
  if (!sub.contract) return '';
  const r = scoreContract(sub, portfolioCtx());
  const b = riskBand(r.overall);
  return `<span class="badge ${b.cls}" title="Overall contract risk ${r.overall}/100">${b.label} risk · ${r.overall}</span>`;
}

/* ---------------------------------------------------------------- CONTRACT INGESTION v2 */
let OCR_WORKER = null;
async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.Tesseract;
}
async function pdfPagesToImages(file, maxPages = 6) {
  // Fallback: use PDF.js via CDN to rasterise. Lazy loaded.
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs';
      s.type = 'module'; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  // pdfjs mjs returns global via import, so we fall back to a simpler path:
  const buf = await file.arrayBuffer();
  const pdfjs = window.pdfjsLib || (await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs'));
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages = [];
  const n = Math.min(doc.numPages, maxPages);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push(canvas.toDataURL('image/png'));
  }
  return pages;
}
async function ocrFile(file, onProgress) {
  const T = await loadTesseract();
  const update = m => onProgress && onProgress(m.status, Math.round((m.progress || 0) * 100));
  update('loading engine', 5);
  let images = [];
  if (file.type.startsWith('image/')) images = [await file.arrayBuffer().then(b => new Blob([b], { type: file.type }))];
  else if (file.type === 'application/pdf') {
    update('rendering pdf pages', 10);
    try { images = await pdfPagesToImages(file); } catch (e) { return { ok: false, error: 'Could not render PDF for OCR: ' + e.message }; }
  }
  if (!images.length) return { ok: false, error: 'Unsupported file type for OCR' };
  let text = '';
  for (let i = 0; i < images.length; i++) {
    update(`ocr page ${i + 1}/${images.length}`, 20 + Math.round((i / images.length) * 70));
    const r = await T.recognize(images[i], 'eng', { logger: () => {} });
    text += '\n\n' + r.data.text;
  }
  update('done', 100);
  return { ok: true, text };
}

/* Bulk ingestion stage: uses existing stagedImports where possible, but adds
   per-file OCR fallback when text extraction returns nothing readable. */
async function readAndOcrIfNeeded(file, onProgress) {
  try {
    const existing = await readContractFile(file);
    const text = (existing && existing.text) || '';
    const printable = text.replace(/[^\x20-\x7E]/g, '').length;
    if (printable >= 200) return { text, ocrUsed: false };
  } catch (_) { /* fall through to OCR */ }
  const r = await ocrFile(file, onProgress);
  if (!r.ok) throw new Error(r.error);
  return { text: r.text, ocrUsed: true };
}

/* ---------------------------------------------------------------- RENDER: Contracts v2 */
function renderContractsV2() {
  const host = document.getElementById('contracts-v2');
  if (!host) return;
  const ctx = portfolioCtx();
  const rows = state.subscriptions.filter(s => s.contract).map(s => ({ s, r: scoreContract(s, ctx) }));
  rows.sort((a, b) => b.r.overall - a.r.overall);
  const summary = `<div class="stat-grid" style="margin-bottom:16px">
    <div class="stat-card"><span class="stat-label">Contracts on file</span><span class="stat-value">${rows.length}</span><span class="stat-sub">of ${state.subscriptions.length} subscriptions</span></div>
    <div class="stat-card"><span class="stat-label">Critical risk</span><span class="stat-value" style="color:var(--danger-text)">${rows.filter(x => x.r.overall >= 70).length}</span><span class="stat-sub">contracts scoring 70+</span></div>
    <div class="stat-card"><span class="stat-label">Missing DPA</span><span class="stat-value">${rows.filter(x => !x.s.contract.dpa).length}</span><span class="stat-sub">data-processing terms absent</span></div>
    <div class="stat-card"><span class="stat-label">Missing liability cap</span><span class="stat-value">${rows.filter(x => !x.s.contract.liabilityCap).length}</span><span class="stat-sub">unbounded exposure</span></div>
  </div>`;
  host.innerHTML = summary + `<div class="table-wrap"><table class="sub-table">
    <thead><tr><th>Contract</th><th>Industry fit</th><th class="num">Overall</th>
      ${RISK_DIMS.map(d => `<th class="num" title="${d.label}">${d.label.split(' ')[0].slice(0,3).toUpperCase()}</th>`).join('')}
      <th>Act by</th><th></th></tr></thead>
    <tbody>${rows.map(({ s, r }) => {
      const win = computeNoticeWindow(s);
      const b = riskBand(r.overall);
      return `<tr>
        <td><div class="name-cell"><div class="avatar" style="background:${avatarColor(s.name)}">${initials(s.name)}</div>
          <div><div style="font-weight:600">${escapeHtml(s.name)}</div><div style="color:var(--text-dim);font-size:11px">${escapeHtml(s.contract.termLength || '—')} · ${escapeHtml(s.contract.renewalType || '—')}</div></div></div></td>
        <td>${INDUSTRIES[customerIndustry()].label.split(' ')[0]}</td>
        <td class="num"><span class="badge ${b.cls}">${r.overall}</span></td>
        ${RISK_DIMS.map(d => {
          const sc = r.perDim[d.id].score;
          const band = riskBand(sc);
          return `<td class="num"><span class="risk-cell ${band.cls}" title="${d.label}: ${sc}/100${r.perDim[d.id].signals[0] ? ' — ' + r.perDim[d.id].signals[0].reason : ''}">${sc}</span></td>`;
        }).join('')}
        <td>${win ? `${win.cancelBy.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${win.daysLeft}d` : '—'}</td>
        <td class="actions-cell"><button class="icon-btn" data-contract-detail="${s.id}">Review</button></td>
      </tr>`;
    }).join('')}</tbody></table>${rows.length === 0 ? '<p class="empty">No contracts ingested yet. Upload one above or paste the text into the extractor.</p>' : ''}</div>`;
  host.querySelectorAll('[data-contract-detail]').forEach(btn => btn.onclick = () => openContractDetail(btn.dataset.contractDetail));
}

function openContractDetail(id) {
  const sub = state.subscriptions.find(s => s.id === id); if (!sub) return;
  const r = scoreContract(sub, portfolioCtx());
  const c = sub.contract || {};
  const back = document.getElementById('contract-detail-modal');
  back.hidden = false;
  back.querySelector('.modal').innerHTML = `
    <h2>${escapeHtml(sub.name)} · Contract review</h2>
    <p class="contract-summary" style="margin-bottom:14px">${escapeHtml(sub.category || '')} · ${escapeHtml(sub.team || '')} · ${formatMoney(sub.cost)} ${sub.cycle} · renewal ${sub.renewal || '—'}</p>
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="stat-card" style="cursor:default"><span class="stat-label">Overall risk</span><span class="stat-value" style="color:var(--${riskBand(r.overall).cls}-text,var(--text))">${r.overall}</span><span class="stat-sub">${riskBand(r.overall).label}</span></div>
      <div class="stat-card" style="cursor:default"><span class="stat-label">Clauses captured</span><span class="stat-value">${Object.values(c).filter(v => v).length}</span><span class="stat-sub">of ${CLAUSE_LIBRARY.length}</span></div>
      <div class="stat-card" style="cursor:default"><span class="stat-label">Signals flagged</span><span class="stat-value">${Object.values(r.signals).flat().length}</span><span class="stat-sub">across all dimensions</span></div>
      <div class="stat-card" style="cursor:default"><span class="stat-label">Notice window</span><span class="stat-value">${computeNoticeWindow(sub)?.daysLeft ?? '—'}</span><span class="stat-sub">days to act by</span></div>
    </div>
    <h3 style="font-size:13px;margin:0 0 10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Risk by dimension</h3>
    <div class="risk-dim-grid">${RISK_DIMS.map(d => {
      const { score, signals } = r.perDim[d.id];
      const b = riskBand(score);
      const action = recommendedAction(d.id, signals);
      return `<div class="risk-dim-card ${b.cls}">
        <div class="risk-dim-head"><b>${d.label}</b><span class="badge ${b.cls}">${score}</span></div>
        <ul>${signals.length ? signals.map(s => `<li>${escapeHtml(s.reason)}</li>`).join('') : '<li style="color:var(--text-dim)">No signals triggered</li>'}</ul>
        ${action ? `<div class="risk-action"><b>Recommended:</b> ${escapeHtml(action)}</div>` : ''}
      </div>`;
    }).join('')}</div>
    <h3 style="font-size:13px;margin:16px 0 8px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Clauses on file</h3>
    <div class="clause-grid">${CLAUSE_LIBRARY.map(cl => {
      const v = c[cl.id === 'renewal' ? 'renewalType' : cl.id === 'notice' ? 'noticeDays' : cl.id === 'term' ? 'termLength' : cl.id === 'priceCap' ? 'priceCapPct' : cl.id];
      const present = v != null && v !== '';
      return `<div class="clause-card ${present ? '' : 'missing'}">
        <div class="clause-label">${cl.label}${cl.critical ? ' <span class="badge danger" style="margin-left:4px">critical</span>' : ''}</div>
        <div class="clause-value">${present ? escapeHtml(String(v)) : '<i>not detected</i>'}</div>
      </div>`;
    }).join('')}</div>
    <div class="actions" style="margin-top:16px"><button type="button" class="primary" onclick="document.getElementById('contract-detail-modal').hidden = true">Close</button></div>
  `;
}

/* ---------------------------------------------------------------- RENDER: Risk Analytics */
function renderRiskAnalytics() {
  const host = document.getElementById('risk-analytics-body'); if (!host) return;
  const ctx = portfolioCtx();
  const rows = state.subscriptions.filter(s => s.contract).map(s => ({ s, r: scoreContract(s, ctx) }));
  if (!rows.length) { host.innerHTML = '<p class="empty">No contracts scored yet. Ingest contracts under Contract terms.</p>'; return; }
  const overallAvg = Math.round(rows.reduce((s, x) => s + x.r.overall, 0) / rows.length);
  const dimAvg = {}; RISK_DIMS.forEach(d => { dimAvg[d.id] = Math.round(rows.reduce((s, x) => s + x.r.perDim[d.id].score, 0) / rows.length); });
  const byBand = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  rows.forEach(({ r }) => { byBand[riskBand(r.overall).label]++; });
  const exposure = rows.reduce((s, x) => s + (x.r.overall / 100) * monthlyCost(x.s) * 12, 0);

  const top = [...rows].sort((a, b) => b.r.overall - a.r.overall).slice(0, 8);
  const dimMax = Math.max(1, ...Object.values(dimAvg));

  host.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">Portfolio risk</span><span class="stat-value">${overallAvg}</span><span class="stat-sub">average across ${rows.length} contracts</span></div>
      <div class="stat-card"><span class="stat-label">Critical / High</span><span class="stat-value" style="color:var(--danger-text)">${byBand.Critical + byBand.High}</span><span class="stat-sub">${byBand.Critical} critical · ${byBand.High} high</span></div>
      <div class="stat-card"><span class="stat-label">Annualised exposure</span><span class="stat-value">${formatMoney(exposure)}</span><span class="stat-sub">risk × annual spend</span></div>
      <div class="stat-card"><span class="stat-label">Industry profile</span><span class="stat-value" style="font-size:16px;line-height:1.3">${INDUSTRIES[customerIndustry()].label}</span><span class="stat-sub">weighting applied to clause set</span></div>
    </div>
    <div class="panel-grid">
      <div class="panel">
        <h2>Risk by dimension</h2>
        <div class="chart">${RISK_DIMS.map(d => {
          const v = dimAvg[d.id]; const b = riskBand(v);
          return `<div class="chart-row"><span class="chart-label">${d.label}</span><div class="chart-bar"><div class="chart-bar-fill" style="--w:${(v / dimMax * 100).toFixed(1)}%;background:${d.colour}"></div></div><span class="chart-value">${v}</span></div>`;
        }).join('')}</div>
      </div>
      <div class="panel">
        <h2>Contracts by risk band</h2>
        <div class="chart">${['Critical', 'High', 'Medium', 'Low'].map(band => {
          const v = byBand[band]; const max = Math.max(1, ...Object.values(byBand));
          const b = riskBand(band === 'Critical' ? 90 : band === 'High' ? 60 : band === 'Medium' ? 35 : 10);
          return `<div class="chart-row"><span class="chart-label">${band}</span><div class="chart-bar"><div class="chart-bar-fill" style="--w:${(v / max * 100).toFixed(1)}%;background:var(--${b.cls === 'ok' ? 'success' : b.cls}-text, var(--text))"></div></div><span class="chart-value">${v}</span></div>`;
        }).join('')}</div>
      </div>
      <div class="panel span-2">
        <h2>Highest-risk contracts</h2>
        <div class="table-wrap"><table class="sub-table">
          <thead><tr><th>Vendor</th><th>Team</th><th class="num">Annual spend</th><th class="num">Risk</th><th>Top signal</th></tr></thead>
          <tbody>${top.map(({ s, r }) => {
            const topSig = Object.values(r.signals).flat().sort((a, b) => b.score - a.score)[0];
            return `<tr><td><b>${escapeHtml(s.name)}</b></td><td>${escapeHtml(s.team || '—')}</td><td class="num">${formatMoney(monthlyCost(s) * 12)}</td>
              <td class="num"><span class="badge ${riskBand(r.overall).cls}">${r.overall}</span></td>
              <td style="color:var(--text-dim);font-size:12.5px">${topSig ? escapeHtml(topSig.reason) : '—'}</td></tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>
      <div class="panel span-2">
        <h2>Gap heatmap &mdash; critical clauses missing across the portfolio</h2>
        <div class="heatmap">${CLAUSE_LIBRARY.filter(c => c.critical).map(c => {
          const missing = rows.filter(({ s }) => { const v = s.contract[c.id === 'renewal' ? 'renewalType' : c.id === 'notice' ? 'noticeDays' : c.id === 'term' ? 'termLength' : c.id === 'priceCap' ? 'priceCapPct' : c.id]; return v == null || v === ''; }).length;
          const pct = Math.round((missing / rows.length) * 100);
          return `<div class="heat-cell" style="--p:${pct}%" title="${missing} of ${rows.length} contracts missing this clause"><b>${c.label}</b><span>${missing}/${rows.length} missing</span><div class="heat-bar"></div></div>`;
        }).join('')}</div>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------- RENDER: Integration roadmap */
const INTEGRATION_ROADMAP = [
  { cat: 'Finance & ERP', items: [
    { name: 'NetSuite',       status: 'planned', phase: 'Q1', note: 'Vendor + AP invoice sync; map to subscription + invoice records' },
    { name: 'SAP S/4HANA',    status: 'planned', phase: 'Q2', note: 'Vendor master + PO sync; large enterprise' },
    { name: 'Oracle Fusion',  status: 'planned', phase: 'Q2', note: 'Cloud ERP; AP + vendor master' },
    { name: 'QuickBooks Online', status: 'planned', phase: 'Q1', note: 'SMB AP sync; expense classification' },
    { name: 'Zoho Books',     status: 'planned', phase: 'Q1', note: 'Indian SMB finance; bill + vendor sync' },
    { name: 'Tally Prime',    status: 'planned', phase: 'Q2', note: 'Indian mid-market; CSV + Tally Connector' },
    { name: 'Sage Intacct',   status: 'planned', phase: 'Q2', note: 'Mid-market AP' },
    { name: 'Xero',           status: 'planned', phase: 'Q1', note: 'SMB AP; GST / VAT' },
    { name: 'Microsoft Dynamics 365', status: 'planned', phase: 'Q3', note: 'Finance + Supply Chain' },
  ]},
  { cat: 'Procurement & Spend', items: [
    { name: 'Coupa',          status: 'planned', phase: 'Q2', note: 'Supplier + PO sync; large procurement teams' },
    { name: 'Ivalua',         status: 'planned', phase: 'Q3', note: 'Procurement suite integration' },
    { name: 'Procurify',      status: 'planned', phase: 'Q2', note: 'Mid-market procurement' },
    { name: 'Tipalti',        status: 'planned', phase: 'Q2', note: 'AP automation + payments' },
    { name: 'Airbase',        status: 'planned', phase: 'Q2', note: 'Spend management cross-feed' },
    { name: 'Spendesk',       status: 'planned', phase: 'Q3', note: 'Cards + invoices' },
    { name: 'Ramp',           status: 'planned', phase: 'Q2', note: 'Transaction feed for discovery' },
    { name: 'Brex',           status: 'planned', phase: 'Q3', note: 'Transaction feed for discovery' },
  ]},
  { cat: 'Expense & Cards', items: [
    { name: 'Expensify',      status: 'planned', phase: 'Q2', note: 'Card transactions for shadow-IT discovery' },
    { name: 'Concur',         status: 'planned', phase: 'Q3', note: 'Expense reports for large enterprise' },
    { name: 'Happay',         status: 'planned', phase: 'Q2', note: 'Indian corporate expense' },
    { name: 'RazorpayX Corporate Cards', status: 'planned', phase: 'Q1', note: 'Indian mid-market card issuer' },
  ]},
  { cat: 'CLM & Contract Repositories', items: [
    { name: 'DocuSign CLM',   status: 'planned', phase: 'Q2', note: 'Pull executed contracts into the extractor' },
    { name: 'Ironclad',       status: 'planned', phase: 'Q3', note: 'Contract repository sync' },
    { name: 'LinkSquares',    status: 'planned', phase: 'Q3', note: 'Contract repository sync' },
    { name: 'Evisort (Workday)', status: 'planned', phase: 'Q3', note: 'Contract repository sync' },
    { name: 'Sirion',         status: 'planned', phase: 'Q4', note: 'Supplier contract sync' },
    { name: 'SpotDraft',      status: 'planned', phase: 'Q2', note: 'Indian CLM' },
    { name: 'Concord',        status: 'planned', phase: 'Q4', note: 'Mid-market CLM' },
    { name: 'PandaDoc',       status: 'planned', phase: 'Q2', note: 'E-signature + contracts' },
  ]},
  { cat: 'Identity & SSO', items: [
    { name: 'Okta',           status: 'planned', phase: 'Q1', note: 'SSO + app discovery via Okta app catalog' },
    { name: 'Microsoft Entra ID (Azure AD)', status: 'planned', phase: 'Q1', note: 'SSO + app discovery' },
    { name: 'Google Workspace', status: 'planned', phase: 'Q1', note: 'SSO + user provisioning' },
    { name: 'JumpCloud',      status: 'planned', phase: 'Q2', note: 'SSO' },
    { name: 'OneLogin',       status: 'planned', phase: 'Q3', note: 'SSO' },
    { name: 'Keycloak',       status: 'planned', phase: 'Q2', note: 'Open-source SSO for on-prem' },
  ]},
  { cat: 'HRIS & Directory', items: [
    { name: 'Rippling',       status: 'planned', phase: 'Q2', note: 'Employee + department + offboarding' },
    { name: 'Gusto',          status: 'planned', phase: 'Q2', note: 'US SMB payroll + HR' },
    { name: 'BambooHR',       status: 'planned', phase: 'Q2', note: 'Mid-market HRIS' },
    { name: 'Workday HCM',    status: 'planned', phase: 'Q3', note: 'Enterprise HCM' },
    { name: 'ADP',            status: 'planned', phase: 'Q3', note: 'Payroll + directory' },
    { name: 'Personio',       status: 'planned', phase: 'Q3', note: 'European HRIS' },
    { name: 'Zoho People',    status: 'planned', phase: 'Q2', note: 'Indian HR' },
    { name: 'Darwinbox',      status: 'planned', phase: 'Q2', note: 'Indian / APAC HRIS' },
    { name: 'KekaHR',         status: 'planned', phase: 'Q2', note: 'Indian SMB HR' },
  ]},
  { cat: 'Communication', items: [
    { name: 'Slack',          status: 'live',    phase: 'Now', note: 'Incoming webhook for alerts (shipped)' },
    { name: 'Microsoft Teams', status: 'planned', phase: 'Q1', note: 'Adaptive cards for alerts + approvals' },
    { name: 'Email (SMTP + Gmail + Outlook)', status: 'planned', phase: 'Q1', note: 'Server-side send for alerts' },
    { name: 'WhatsApp Business', status: 'planned', phase: 'Q3', note: 'Owner acknowledgement for Indian teams' },
    { name: 'PagerDuty',      status: 'planned', phase: 'Q4', note: 'Escalation to on-call' },
  ]},
  { cat: 'Storage & Document Sources', items: [
    { name: 'Google Drive',   status: 'partial', phase: 'Q1', note: 'Folder-based import (manual today); OAuth sync planned' },
    { name: 'Microsoft OneDrive / SharePoint', status: 'planned', phase: 'Q1', note: 'OAuth folder sync' },
    { name: 'Dropbox',        status: 'planned', phase: 'Q2', note: 'Folder sync' },
    { name: 'Box',            status: 'planned', phase: 'Q2', note: 'Enterprise document repository' },
    { name: 'Zoho WorkDrive', status: 'planned', phase: 'Q3', note: 'Indian document storage' },
    { name: 'AWS S3 / compatible', status: 'planned', phase: 'Q2', note: 'On-prem and private cloud' },
  ]},
  { cat: 'Collaboration & ITSM', items: [
    { name: 'Jira',           status: 'planned', phase: 'Q2', note: 'Create tickets from alerts and risks' },
    { name: 'ServiceNow',     status: 'planned', phase: 'Q3', note: 'Enterprise ticketing + approvals' },
    { name: 'Linear',         status: 'planned', phase: 'Q2', note: 'Modern teams; create issues' },
    { name: 'Freshservice',   status: 'planned', phase: 'Q3', note: 'ITSM' },
    { name: 'Zendesk',        status: 'planned', phase: 'Q3', note: 'Support ticket creation' },
  ]},
  { cat: 'BI & Reporting', items: [
    { name: 'Looker Studio',  status: 'planned', phase: 'Q2', note: 'Pre-built templates' },
    { name: 'Power BI',       status: 'planned', phase: 'Q2', note: 'On-prem connector' },
    { name: 'Tableau',        status: 'planned', phase: 'Q3', note: 'Portfolio risk visualisation' },
    { name: 'Metabase',       status: 'planned', phase: 'Q2', note: 'Open-source BI' },
    { name: 'Snowflake data share', status: 'planned', phase: 'Q4', note: 'Push contract + spend data to the customer warehouse' },
    { name: 'BigQuery',       status: 'planned', phase: 'Q4', note: 'Same as above' },
  ]},
  { cat: 'Security & Compliance', items: [
    { name: 'Vanta',          status: 'planned', phase: 'Q2', note: 'Pull vendor security posture' },
    { name: 'Drata',          status: 'planned', phase: 'Q2', note: 'Continuous compliance evidence' },
    { name: 'Secureframe',    status: 'planned', phase: 'Q3', note: 'Compliance evidence' },
    { name: 'Nudge Security', status: 'planned', phase: 'Q3', note: 'SaaS discovery via email signals' },
    { name: 'Splunk',         status: 'planned', phase: 'Q4', note: 'SIEM audit-log forwarding' },
  ]},
  { cat: 'CRM & Vendor Mapping', items: [
    { name: 'Salesforce',     status: 'planned', phase: 'Q2', note: 'Vendor-as-account linking for mutual customers' },
    { name: 'HubSpot',        status: 'planned', phase: 'Q2', note: 'SMB CRM' },
    { name: 'Zoho CRM',       status: 'planned', phase: 'Q2', note: 'Indian mid-market' },
  ]},
  { cat: 'Payments (India)', items: [
    { name: 'Razorpay',       status: 'planned', phase: 'Q1', note: 'Subscription billing for the product itself' },
    { name: 'Cashfree',       status: 'planned', phase: 'Q2', note: 'Backup PSP' },
    { name: 'Stripe',         status: 'planned', phase: 'Q1', note: 'International billing' },
  ]},
];
function renderIntegrationRoadmap() {
  const host = document.getElementById('roadmap-body'); if (!host) return;
  const totals = INTEGRATION_ROADMAP.reduce((acc, g) => { g.items.forEach(i => { acc[i.status] = (acc[i.status] || 0) + 1; acc.total++; }); return acc; }, { total: 0 });
  host.innerHTML = `<div class="stat-grid" style="margin-bottom:16px">
    <div class="stat-card"><span class="stat-label">Integration targets</span><span class="stat-value">${totals.total}</span><span class="stat-sub">across ${INTEGRATION_ROADMAP.length} categories</span></div>
    <div class="stat-card"><span class="stat-label">Live</span><span class="stat-value" style="color:var(--success-text)">${totals.live || 0}</span><span class="stat-sub">shipping today</span></div>
    <div class="stat-card"><span class="stat-label">In progress</span><span class="stat-value" style="color:var(--warning-text)">${totals.partial || 0}</span><span class="stat-sub">partial / beta</span></div>
    <div class="stat-card"><span class="stat-label">Planned</span><span class="stat-value">${totals.planned || 0}</span><span class="stat-sub">on the roadmap</span></div>
  </div>
  <p class="contract-lede">Each integration is a planned connection point, not a promise. The roadmap below is grouped by category; each row shows status (live / partial / planned), target quarter, and purpose. Prioritisation is driven by customer need, not vendor popularity. Owners can reshuffle this list in the Product backlog.</p>
  ${INTEGRATION_ROADMAP.map(group => `<div class="roadmap-group">
    <h3>${group.cat} <span class="badge">${group.items.length}</span></h3>
    <div class="roadmap-grid">${group.items.map(it => `<div class="roadmap-tile status-${it.status}">
      <div class="roadmap-head"><b>${escapeHtml(it.name)}</b><span class="badge ${it.status === 'live' ? 'ok' : it.status === 'partial' ? 'warn' : ''}">${it.status}</span></div>
      <div class="roadmap-phase">${it.phase}</div>
      <div class="roadmap-note">${escapeHtml(it.note)}</div>
    </div>`).join('')}</div>
  </div>`).join('')}`;
}

/* ---------------------------------------------------------------- RENDER: Product backlog (owner only) */
const DEFAULT_BACKLOG = [
  // Known limitations (generated from current implementation)
  { id: 'lim-1',  kind: 'limitation', area: 'OCR',          sev: 'high',   status: 'open', title: 'OCR is English-only and runs in the browser',
    detail: 'Tesseract.js is loaded on demand from a CDN. Non-English contracts (Hindi, Spanish, German) will not extract reliably. Plan: add a server-side OCR worker with language auto-detect (PaddleOCR) in Phase 2.' },
  { id: 'lim-2',  kind: 'limitation', area: 'Extraction',   sev: 'medium', status: 'open', title: 'Pattern-based extraction misses ambiguously drafted clauses',
    detail: 'Regex-based extractors catch the most common phrasings but miss double-negatives and unusual drafting. Plan: add an LLM post-pass for the clauses that scored low confidence, with the model self-hosted per the On-prem architecture.' },
  { id: 'lim-3',  kind: 'limitation', area: 'Table parsing',sev: 'medium', status: 'open', title: 'Tables detected heuristically; no header-cell binding',
    detail: 'Order-form pricing tables are flagged but not parsed into structured rows. Plan: adopt Camelot or Tabula for PDF tables; keep the heuristic for OCR output.' },
  { id: 'lim-4',  kind: 'limitation', area: 'Risk engine',  sev: 'low',    status: 'open', title: 'Risk weights are static; not calibrated against a customer baseline',
    detail: 'Each customer should be able to shift weights (a startup may weight liability lower than an Indian bank). Plan: expose per-org weight overrides in Settings.' },
  { id: 'lim-5',  kind: 'limitation', area: 'Collaboration',sev: 'medium', status: 'open', title: 'No in-product commenting on a flagged clause',
    detail: 'Users cannot leave notes against a specific extracted clause for Legal to review. Plan: add per-clause threads tied to the subscription record; notify owner + manager in Slack.' },
  { id: 'lim-6',  kind: 'limitation', area: 'Multi-entity', sev: 'medium', status: 'open', title: 'Single-tenant data model; no legal-entity dimension',
    detail: 'Group companies with multiple legal entities cannot see spend cleanly per entity. Plan: add an entity dimension on subscriptions and roll-ups.' },
  { id: 'lim-7',  kind: 'limitation', area: 'Deviation',    sev: 'medium', status: 'open', title: 'No "playbook" to flag deviation from a standard template',
    detail: 'Mature CLMs (LinkSquares, Sirion) let legal define a clause playbook and flag deviations. Plan: add a Playbook module where the customer uploads their approved clauses and the risk engine scores deviation.' },
  { id: 'lim-8',  kind: 'limitation', area: 'Vendor benchmarks', sev: 'low', status: 'open', title: 'No external price benchmarks',
    detail: 'Spendflo and Vendr pitch "what others pay" benchmarks. Plan: anonymised, opt-in benchmarking across the Pro customer base; publish quarterly medians.' },
  { id: 'lim-9',  kind: 'limitation', area: 'Mobile',       sev: 'low',    status: 'open', title: 'Mobile layout works but is read-only in practice',
    detail: 'Owners on their phones can see alerts but editing is painful. Plan: ship a lightweight mobile view for acknowledge / escalate flows.' },
  { id: 'lim-10', kind: 'limitation', area: 'Audit log',    sev: 'medium', status: 'open', title: 'Audit log not surfaced in the UI',
    detail: 'Logs exist in the data model but there is no review screen. Plan: add Settings → Audit log with export.' },
  { id: 'bug-1',  kind: 'bug',        area: 'Contracts',    sev: 'low',    status: 'open', title: 'Scanned PDFs over ~20 pages time out OCR',
    detail: 'The in-browser worker is capped at 6 pages. Plan: paginated OCR and background progress toasts.' },
  { id: 'feat-1', kind: 'feature',    area: 'Risk',         sev: 'high',   status: 'open', title: 'Benchmark bar per risk dimension against peers',
    detail: 'Show "you are at 62 on Legal risk; peer median is 48" in the Risk Analytics dashboard.' },
  { id: 'feat-2', kind: 'feature',    area: 'Alerts',       sev: 'medium', status: 'open', title: 'Owner acknowledgement via one-click email link',
    detail: 'Acknowledge should be a signed URL; no need to open the app.' },
  { id: 'feat-3', kind: 'feature',    area: 'Integrations', sev: 'high',   status: 'open', title: 'First five connectors to ship in Phase 1',
    detail: 'Prioritise: QuickBooks, Zoho Books, Google Workspace, Okta, Slack (already live). Scope each in a one-pager.' },
];

function initBacklog() {
  if (!Array.isArray(state.settings.backlog)) state.settings.backlog = DEFAULT_BACKLOG.map(x => ({ ...x }));
}
function renderBacklog() {
  const host = document.getElementById('backlog-body'); if (!host) return;
  initBacklog();
  if (!ownerModeEnabled()) {
    host.innerHTML = `<div class="panel"><p class="contract-lede">The Product Backlog is visible only in Owner Mode. Open Settings (top right) and toggle <b>Owner mode</b> on to see the known limitations and planned improvements.</p></div>`;
    return;
  }
  const items = state.settings.backlog;
  const stats = items.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; a[x.kind] = (a[x.kind] || 0) + 1; return a; }, {});
  host.innerHTML = `
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat-card"><span class="stat-label">Items on the backlog</span><span class="stat-value">${items.length}</span><span class="stat-sub">${stats.open || 0} open · ${stats.done || 0} done</span></div>
      <div class="stat-card"><span class="stat-label">Known limitations</span><span class="stat-value">${stats.limitation || 0}</span><span class="stat-sub">things the tool does not do well yet</span></div>
      <div class="stat-card"><span class="stat-label">Bugs</span><span class="stat-value">${stats.bug || 0}</span><span class="stat-sub">tracked defects</span></div>
      <div class="stat-card"><span class="stat-label">Feature requests</span><span class="stat-value">${stats.feature || 0}</span><span class="stat-sub">planned improvements</span></div>
    </div>
    <div class="section-head"><div><h2>Review one by one</h2><p class="page-sub">Each item lists what is missing today and the plan to fix it. Mark done, defer, or drop as you work through the list.</p></div>
      <div class="controls"><button class="icon-btn" id="backlog-add">+ Add item</button><button class="icon-btn" id="backlog-export">Export JSON</button></div></div>
    <div class="backlog-list">${items.map(it => `<div class="backlog-item sev-${it.sev} status-${it.status}" data-backlog-id="${it.id}">
      <div class="backlog-head">
        <div class="backlog-kind"><span class="badge ${it.kind === 'bug' ? 'danger' : it.kind === 'feature' ? 'info' : 'warn'}">${it.kind}</span>
          <span class="badge">${escapeHtml(it.area)}</span>
          <span class="badge ${it.sev === 'high' ? 'danger' : it.sev === 'medium' ? 'warn' : ''}">${it.sev}</span>
          <span class="badge ${it.status === 'done' ? 'ok' : it.status === 'in_progress' ? 'info' : ''}">${it.status.replace('_', ' ')}</span>
        </div>
        <div class="backlog-actions">
          <button class="icon-btn" data-backlog-cycle="${it.id}">Cycle status</button>
          <button class="icon-btn danger" data-backlog-remove="${it.id}">Remove</button>
        </div>
      </div>
      <div class="backlog-title">${escapeHtml(it.title)}</div>
      <div class="backlog-detail">${escapeHtml(it.detail)}</div>
    </div>`).join('')}</div>`;
  host.querySelectorAll('[data-backlog-cycle]').forEach(b => b.onclick = () => {
    const it = items.find(x => x.id === b.dataset.backlogCycle);
    const order = ['open', 'in_progress', 'done', 'deferred'];
    it.status = order[(order.indexOf(it.status) + 1) % order.length];
    save(); renderBacklog();
  });
  host.querySelectorAll('[data-backlog-remove]').forEach(b => b.onclick = () => {
    const id = b.dataset.backlogRemove;
    state.settings.backlog = items.filter(x => x.id !== id); save(); renderBacklog();
  });
  const addBtn = document.getElementById('backlog-add');
  if (addBtn) addBtn.onclick = () => {
    const title = prompt('Title for the new item:'); if (!title) return;
    const detail = prompt('Detail / the plan to fix it:') || '';
    state.settings.backlog.push({ id: 'cus-' + crypto.randomUUID().slice(0, 6), kind: 'feature', area: 'Custom', sev: 'medium', status: 'open', title, detail });
    save(); renderBacklog();
  };
  const exBtn = document.getElementById('backlog-export');
  if (exBtn) exBtn.onclick = () => downloadFile('backlog.json', JSON.stringify(state.settings.backlog, null, 2), 'application/json');
}

/* ---------------------------------------------------------------- NAV / wiring */
function renderNav() {
  // Show/hide owner-only nav entries
  document.querySelectorAll('[data-owner-only]').forEach(el => { el.hidden = !ownerModeEnabled(); });
}

// Patch into existing renderAll
const _origRenderAll = typeof renderAll === 'function' ? renderAll : null;
if (_origRenderAll) {
  window.renderAll = function () {
    _origRenderAll();
    try { renderContractsV2(); } catch (e) { console.warn(e); }
    try { renderRiskAnalytics(); } catch (e) { console.warn(e); }
    try { renderIntegrationRoadmap(); } catch (e) { console.warn(e); }
    try { renderBacklog(); } catch (e) { console.warn(e); }
    renderNav();
  };
}

// Settings modal opener
function openSettingsModal() {
  const back = document.getElementById('settings-modal');
  if (!back) return;
  back.hidden = false;
  back.querySelector('#f-industry').value = customerIndustry();
  back.querySelector('#f-owner-mode').checked = ownerModeEnabled();
}
function closeSettingsModal() { document.getElementById('settings-modal').hidden = true; }
function saveSettingsModal() {
  setIndustry(document.getElementById('f-industry').value);
  setOwnerMode(document.getElementById('f-owner-mode').checked);
  closeSettingsModal();
}

// Bulk upload handler
async function bulkContractUpload(files) {
  const status = document.getElementById('bulk-ocr-status');
  if (!status) return;
  const log = (msg) => { const p = document.createElement('div'); p.textContent = msg; p.style.fontSize = '12px'; status.appendChild(p); status.scrollTop = status.scrollHeight; };
  status.innerHTML = '';
  for (const file of files) {
    const bar = document.createElement('div'); bar.textContent = '• ' + file.name + ' — reading…'; status.appendChild(bar);
    try {
      const { text, ocrUsed } = await readAndOcrIfNeeded(file, (stage, pct) => { bar.textContent = `• ${file.name} — ${stage} (${pct}%)`; });
      const ex = deepExtract(text);
      const name = file.name.replace(/\.(pdf|txt|png|jpg|jpeg)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      const existing = state.subscriptions.find(s => s.name.toLowerCase() === name.toLowerCase());
      const subId = existing ? existing.id : (() => {
        const s = { id: crypto.randomUUID(), name, cost: 0, cycle: 'yearly', category: '', team: '', renewal: null, notes: `Draft from contract ingest${ocrUsed ? ' (OCR)' : ''}`, url: '', active: true };
        state.subscriptions.push(s); return s.id;
      })();
      const sub = state.subscriptions.find(s => s.id === subId);
      const c = ex.clauses;
      sub.contract = {
        renewalType: c.renewal?.value || null,
        autoRenew: c.renewal?.value === 'Auto-renew',
        noticeDays: c.notice?.days || null,
        termLength: c.term?.value || null,
        priceCapPct: c.priceCap?.pct ?? null,
        paymentDays: c.paymentDays?.days || null,
        governingLaw: c.governingLaw?.value || null,
        liabilityCap: c.liabilityCap?.value || null,
        indemnity: c.indemnity?.value || null,
        sla: c.sla?.value || null,
        support: c.support?.value || null,
        termination: c.termination?.value || null,
        dpa: c.dpa?.value || null,
        security: c.security?.value || null,
        audit: c.audit?.value || null,
        warranty: c.warranty?.value || null,
        assignment: c.assignment?.value || null,
        lateFee: c.lateFee?.value || null,
        confidence: ex.confidence,
        ocrUsed,
      };
      bar.textContent = `✓ ${file.name} → ${sub.name} · ${ex.confidence}% confidence${ocrUsed ? ' · OCR' : ''}`;
    } catch (e) {
      bar.textContent = `✗ ${file.name} — ${e.message || e}`;
      bar.style.color = 'var(--danger-text)';
    }
  }
  save(); renderAll();
}

/* Wire up DOM once the page is ready */
document.addEventListener('DOMContentLoaded', () => {
  // Settings modal open from topbar
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
  const saveBtn = document.getElementById('settings-save');
  if (saveBtn) saveBtn.addEventListener('click', saveSettingsModal);
  const cancelBtn = document.getElementById('settings-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeSettingsModal);

  // Bulk upload
  const bulk = document.getElementById('bulk-upload');
  if (bulk) bulk.addEventListener('change', e => { if (e.target.files.length) bulkContractUpload([...e.target.files]); e.target.value = ''; });
  const bulkDrop = document.getElementById('bulk-drop');
  if (bulkDrop) {
    bulkDrop.addEventListener('dragover', e => { e.preventDefault(); bulkDrop.classList.add('dragover'); });
    bulkDrop.addEventListener('dragleave', () => bulkDrop.classList.remove('dragover'));
    bulkDrop.addEventListener('drop', e => { e.preventDefault(); bulkDrop.classList.remove('dragover'); if (e.dataTransfer.files.length) bulkContractUpload([...e.dataTransfer.files]); });
  }
  renderNav();
  // Initial render of new views (in case they're the hash target)
  setTimeout(() => { try { renderAll(); } catch (_) {} }, 50);
});
