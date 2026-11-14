/* ==========================================================================
   SaaS Spend Track — Phase 22
   Distributor one-pager
   ---------------------------------------------------------------------------
   Branded A4 leave-behind the distributor can print or email to each
   prospect. Rendered inline for preview with a Download PDF button
   that routes through the existing universal download bridge.

   Design: single A4 page (210mm x 297mm), 4 bands:
   1. Hero: logo, product name, one-line value prop, prospect name
      (optional personalisation field)
   2. The problem (one sentence) + three solution columns
   3. Pricing card (one tier)
   4. CTA band with QR code to saasspendtrack.com and company info

   Personalisation: prospect name + distributor name are editable in the
   preview and bake into the PDF. State persists so the same values come
   back next time.
   ========================================================================== */

function onepagerSettings() {
  state.settings.onepager = state.settings.onepager || {
    prospectName: '',
    distributorName: 'Vinay Raghavendran',
    distributorEmail: 'vinayraghavendran16@gmail.com',
    distributorPhone: '+91 91684 81989',
    accentColor: '#0f2a5e',
    prospectRegion: 'india',   // 'india' or 'global' — swaps currency on the pricing block
  };
  return state.settings.onepager;
}

/* ---------------- Render ---------------- */
function renderOnepager() {
  const host = document.getElementById('op-body');
  if (!host) return;
  const s = onepagerSettings();

  host.innerHTML = `
    <div class="op-controls">
      <div class="op-ctrl-row">
        <label>Prospect name <input id="op-prospect" value="${escapeHtml(s.prospectName)}" placeholder="e.g. Acme Corp"/></label>
        <label>Distributor name <input id="op-distributor" value="${escapeHtml(s.distributorName)}" placeholder="Your name"/></label>
        <label>Distributor email <input id="op-dist-email" value="${escapeHtml(s.distributorEmail)}" placeholder="you@firm.com"/></label>
        <label>Distributor phone <input id="op-dist-phone" value="${escapeHtml(s.distributorPhone)}" placeholder="+91 ..."/></label>
        <label>Prospect region
          <select id="op-region">
            <option value="india" ${s.prospectRegion==='india'?'selected':''}>🇮🇳 India (INR primary)</option>
            <option value="global" ${s.prospectRegion==='global'?'selected':''}>🌐 Global (USD primary)</option>
          </select>
        </label>
      </div>
      <div class="op-ctrl-row" style="margin-top:8px">
        <button class="btn-primary" id="op-download">Download PDF</button>
        <button class="icon-btn" id="op-print">Print</button>
        <span class="dim" style="font-size:12px;margin-left:auto">A4 single page · ready to print or email</span>
      </div>
    </div>

    <div class="op-page-wrap">
      <div id="op-page" class="op-page">
        ${onepagerHtml(s)}
      </div>
    </div>
  `;

  // Wire inputs
  const sync = () => {
    s.prospectName = document.getElementById('op-prospect').value;
    s.distributorName = document.getElementById('op-distributor').value;
    s.distributorEmail = document.getElementById('op-dist-email').value;
    s.distributorPhone = document.getElementById('op-dist-phone').value;
    s.prospectRegion = document.getElementById('op-region').value;
    save();
    document.getElementById('op-page').innerHTML = onepagerHtml(s);
  };
  ['op-prospect','op-distributor','op-dist-email','op-dist-phone'].forEach(id => {
    const el = document.getElementById(id);
    el.oninput = sync;
  });
  document.getElementById('op-region').onchange = sync;

  document.getElementById('op-download').onclick = async () => {
    const page = document.getElementById('op-page');
    if (typeof window.exportElementToPdf === 'function') {
      // Use the universal pipeline; passes through saveFileUniversal
      const title = s.prospectName ? `saas-spend-track-for-${s.prospectName.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}` : 'saas-spend-track-onepager';
      await _onepagerDirectPdf(page, title);
    } else {
      toast('PDF library not ready yet, try again in a second.', 'warn');
    }
  };
  document.getElementById('op-print').onclick = () => {
    // Open a clean print window with just the page
    const w = window.open('', '_blank', 'width=900,height=1100');
    // Build the print snippet via concatenation so no literal end-script
    // tag appears in this file's own text. HTML parsers close any script
    // block on the first end-script tag they see, regardless of context.
    const printSnippet = '<' + 'script>setTimeout(()=>window.print(),500);</' + 'script>';
    w.document.write(`<!doctype html><html><head><title>SaaS Spend Track — ${escapeHtml(s.prospectName || 'One-pager')}</title>
      <style>${getOnepagerPrintCss()}</style>
      </head><body>${document.getElementById('op-page').outerHTML}${printSnippet}</body></html>`);
    w.document.close();
  };
}

/* The single-page markup. Values come from state + current KPIs. */
function onepagerHtml(s) {
  const yearCount = new Date().getFullYear();
  const accent = s.accentColor || '#0f2a5e';
  const prospect = s.prospectName ? escapeHtml(s.prospectName) : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent('https://saasspendtrack.com' + (prospect ? '?ref=' + encodeURIComponent(s.prospectName) : ''))}&size=200x200&margin=2`;

  return `
    <!-- Band 1: Hero -->
    <div class="op-hero" style="background: linear-gradient(135deg, ${accent} 0%, #1a3d7a 100%);">
      <div class="op-brand">
        <div class="op-logo">SST</div>
        <div>
          <div class="op-brand-name">SaaS Spend Track</div>
          <div class="op-brand-tag">Every SaaS subscription and contract, in one place</div>
        </div>
      </div>
      ${prospect ? `<div class="op-prospect">Prepared for <b>${prospect}</b></div>` : ''}
      <div class="op-hero-value">
        Built for Indian and APAC mid-market. Spend tracking, contract intelligence, renewals, approvals, licence forecasting, and natural-language search — in one tool, on your browser or on-prem.
      </div>
    </div>

    <!-- Band 2: Problem + 3 pillars -->
    <div class="op-section">
      <div class="op-problem">
        <b>The problem.</b> SaaS spend at 50-500 person companies is scattered across cards, invoices, emails and Google sheets. Vendors auto-renew before anyone notices. Legal terms are buried in PDFs. Nobody owns the full picture — finance, procurement, legal and IT each see a fragment.
      </div>
      <div class="op-pillars">
        <div class="op-pillar">
          <div class="op-pillar-icon" style="background:${accent}">1</div>
          <div class="op-pillar-title">See everything</div>
          <div class="op-pillar-body">Every contract, invoice, renewal and licence utilisation in one dashboard. Spend sliced by department, category, vendor or any time window. 44 data-source connectors for auto-pulled data.</div>
        </div>
        <div class="op-pillar">
          <div class="op-pillar-icon" style="background:${accent}">2</div>
          <div class="op-pillar-title">Catch risk early</div>
          <div class="op-pillar-body">8-dimension risk engine scores every contract on financial, legal, operational, functional, usage, data, compliance and vendor-concentration risk. Clause playbook flags any deviation from your legal team's accepted terms.</div>
        </div>
        <div class="op-pillar">
          <div class="op-pillar-icon" style="background:${accent}">3</div>
          <div class="op-pillar-title">Act before renewal</div>
          <div class="op-pillar-body">Renewal command centre groups vendors by lane. Approval chains + per-clause commenting pulls finance, legal, security and procurement into one thread. Scenario planner models cancel, downgrade and renegotiate with annual impact.</div>
        </div>
      </div>
    </div>

    <!-- Band 3: Pricing + differentiator -->
    <div class="op-section op-pricing-band">
      <div class="op-pricing">
        <div class="op-price-head">One plan. Everything included.</div>
        ${s.prospectRegion === 'global' ? `
          <div class="op-price-main">$3,499<span>/year</span></div>
          <div class="op-price-inr">Billed annually via Razorpay · Includes 250 active contracts · $100/yr per 50 additional</div>
        ` : `
          <div class="op-price-main">₹3,00,000<span>/year</span></div>
          <div class="op-price-inr">+ 18% GST, invoiced separately · Includes 250 active contracts · $100/yr per 50 additional</div>
        `}
        <div class="op-price-list">Unlimited users · Unlimited departments · Every feature · Trial free, no credit card</div>
      </div>
      <div class="op-diff">
        <div class="op-diff-title">Why this, not Zluri or Spendflo?</div>
        <ul>
          <li><b>Built for India &amp; APAC</b> — lakh/crore, Indian SaaS stack seeded, INR invoicing supported</li>
          <li><b>On-prem available</b> for BFSI, healthcare, public sector and other regulated industries</li>
          <li><b>10× cheaper</b> than US enterprise alternatives (Zluri starts at ~$30,000/year)</li>
          <li><b>Browser-only</b> — data never leaves your organisation unless you choose to sync a connector</li>
          <li><b>Live in minutes</b>, not months — no implementation team</li>
        </ul>
      </div>
    </div>

    <!-- Band 4: CTA + QR -->
    <div class="op-cta">
      <div class="op-cta-left">
        <div class="op-cta-headline">Try it live right now.</div>
        <div class="op-cta-url">saasspendtrack.com</div>
        <div class="op-cta-sub">Scan or type the URL. Trial opens straight in your browser with a seed dataset. No signup required to look around.</div>
        ${(s.distributorName || s.distributorEmail || s.distributorPhone) ? `
          <div class="op-cta-contact">
            ${s.distributorName ? `<div><b>${escapeHtml(s.distributorName)}</b></div>` : ''}
            ${s.distributorEmail ? `<div>${escapeHtml(s.distributorEmail)}</div>` : ''}
            ${s.distributorPhone ? `<div>${escapeHtml(s.distributorPhone)}</div>` : ''}
          </div>
        ` : ''}
      </div>
      <div class="op-cta-qr">
        <img src="${qrUrl}" alt="QR code to saasspendtrack.com" width="110" height="110"/>
        <div class="op-cta-qr-label">Scan to open</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="op-footer">
      <span>Whizzlead Solutions OPC Private Limited · HSR Layout, Bengaluru 560102</span>
      <span>${yearCount} · One-pager v1</span>
    </div>
  `;
}

/* PDF render path — uses the html2pdf lib loaded by extensions3.js,
   routed through the universal download bridge. */
async function _onepagerDirectPdf(el, filename) {
  const lib = await (window.loadHtml2Pdf ? window.loadHtml2Pdf() : window.html2pdf);
  if (!lib) { toast('PDF library failed to load.', 'error'); return; }
  const worker = lib().set({
    margin: 0,
    filename: filename + '.pdf',
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(el);
  if (typeof window.saveFileUniversal === 'function') {
    const blob = await worker.outputPdf('blob');
    await window.saveFileUniversal(filename + '.pdf', blob, 'application/pdf');
  } else {
    await worker.save();
    toast('One-pager downloaded.', 'success');
  }
}

/* Print CSS for the new-window print path */
function getOnepagerPrintCss() {
  return `
    @page { size: A4; margin: 0; }
    body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #111; }
    ${getOnepagerCss()}
  `;
}
function getOnepagerCss() {
  return `
    .op-page { width: 210mm; min-height: 297mm; box-sizing: border-box; background: #fff; display: flex; flex-direction: column; font-size: 10.5px; line-height: 1.45; color: #111; }
    .op-hero { padding: 18mm 18mm 12mm; color: #fff; }
    .op-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8mm; }
    .op-logo { width: 48px; height: 48px; background: #fff; color: #0f2a5e; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; border-radius: 8px; letter-spacing: -0.02em; }
    .op-brand-name { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .op-brand-tag { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .op-prospect { display: inline-block; background: rgba(255,255,255,0.14); padding: 4px 12px; border-radius: 20px; font-size: 11px; margin-bottom: 6mm; }
    .op-prospect b { font-weight: 600; }
    .op-hero-value { font-size: 13px; line-height: 1.5; max-width: 170mm; opacity: 0.95; }
    .op-section { padding: 8mm 18mm; }
    .op-problem { font-size: 10.5px; line-height: 1.55; color: #333; margin-bottom: 7mm; padding-bottom: 6mm; border-bottom: 1px solid #e5e7eb; }
    .op-problem b { color: #111; }
    .op-pillars { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; }
    .op-pillar { }
    .op-pillar-icon { width: 24px; height: 24px; color: #fff; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; border-radius: 50%; margin-bottom: 4mm; }
    .op-pillar-title { font-size: 12px; font-weight: 700; margin-bottom: 2mm; color: #111; }
    .op-pillar-body { font-size: 9.5px; line-height: 1.5; color: #444; }
    .op-pricing-band { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; align-items: start; background: #f8fafc; }
    .op-pricing { background: #0f2a5e; color: #fff; padding: 7mm; border-radius: 8px; }
    .op-price-head { font-size: 11px; opacity: 0.85; margin-bottom: 2mm; }
    .op-price-main { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; }
    .op-price-main span { font-size: 14px; font-weight: 500; opacity: 0.7; margin-left: 4px; }
    .op-price-inr { font-size: 10px; opacity: 0.8; margin: 3mm 0; }
    .op-price-list { font-size: 9.5px; opacity: 0.9; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 3mm; line-height: 1.5; }
    .op-diff { }
    .op-diff-title { font-size: 11px; font-weight: 700; margin-bottom: 3mm; color: #111; }
    .op-diff ul { list-style: none; padding: 0; margin: 0; }
    .op-diff ul li { font-size: 9.5px; padding: 2mm 0 2mm 6mm; position: relative; color: #333; line-height: 1.5; }
    .op-diff ul li::before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: 700; top: 2mm; }
    .op-diff ul li b { color: #111; font-weight: 700; }
    .op-cta { background: #0f2a5e; color: #fff; padding: 8mm 18mm; display: grid; grid-template-columns: 1fr auto; gap: 8mm; align-items: center; }
    .op-cta-headline { font-size: 14px; font-weight: 700; margin-bottom: 2mm; }
    .op-cta-url { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; color: #fff; margin-bottom: 2mm; }
    .op-cta-sub { font-size: 9.5px; opacity: 0.85; max-width: 110mm; line-height: 1.5; }
    .op-cta-contact { margin-top: 4mm; font-size: 10px; opacity: 0.95; line-height: 1.5; padding-top: 3mm; border-top: 1px solid rgba(255,255,255,0.2); }
    .op-cta-qr { background: #fff; padding: 4mm; border-radius: 6px; text-align: center; }
    .op-cta-qr img { display: block; }
    .op-cta-qr-label { font-size: 8.5px; color: #333; margin-top: 2mm; font-weight: 600; }
    .op-footer { padding: 4mm 18mm; background: #0a1e42; color: rgba(255,255,255,0.7); font-size: 8px; display: flex; justify-content: space-between; }
  `;
}

/* ---------------- View + nav ---------------- */
function ensureOnepagerView() {
  if (document.getElementById('onepager')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'onepager'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Distributor one-pager</h2>
        <p class="page-sub">Branded A4 leave-behind. Add your prospect's name and your own contact details, then download the PDF or print. Every detail stays in your browser.</p>
      </div>
    </div>
    <div id="op-body"></div>
    <style>${getOnepagerCss()}
      .op-controls { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
      .op-ctrl-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .op-ctrl-row label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--ink-dim); flex: 1; min-width: 180px; }
      .op-ctrl-row input, .op-ctrl-row select { background: var(--surface-2); color: var(--ink); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 13px; }
      .op-page-wrap { display: flex; justify-content: center; overflow-x: auto; padding: 20px 0; background: #e5e7eb; border-radius: 12px; }
      .op-page { box-shadow: 0 8px 32px rgba(0,0,0,0.15); transform-origin: top center; }
      @media (max-width: 900px) { .op-page { transform: scale(0.65); margin: -140px 0; } }
    </style>
  `;
  main.appendChild(section);
  renderOnepager();
}
function ensureOnepagerNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const g = [...groups].find(x => x.querySelector('[data-view="integrations"]')) || groups[groups.length - 1];
  if (!g || g.querySelector('[data-view="onepager"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="18" x2="8" y2="18"/><line x1="16" y1="14" x2="8" y2="14"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'onepager';
  btn.innerHTML = `${svg}<span>One-pager</span>`;
  g.appendChild(btn);
  btn.addEventListener('click', () => switchView('onepager'));
}

/* Patch switchView for this view */
const _origSwForOp = window.switchView;
if (_origSwForOp && !window._opSwitchPatched) {
  window.switchView = function (name, opts) {
    if (name === 'onepager') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0 });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Distributor one-pager';
      if (!opts?.replaceHistory) {
        const target = '#onepager';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      renderOnepager();
      return;
    }
    return _origSwForOp(name, opts);
  };
  window._opSwitchPatched = true;
}

if (window.PAGE_TITLES) { window.PAGE_TITLES.onepager = 'Distributor one-pager'; }

/* Hook renderAll */
const _prevAll16 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll16) {
  window.renderAll = function () {
    _prevAll16();
    try { ensureOnepagerView(); ensureOnepagerNav(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { ensureOnepagerView(); ensureOnepagerNav(); } catch (_) {} }, 700);
});
