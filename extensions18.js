/* ==========================================================================
   SaaS Spend Track — Phase 24
   Demo seed-data switcher
   ---------------------------------------------------------------------------
   One-click preset loader so the distributor can walk into any room with
   a relevant-looking workspace. Three presets, plus the existing Acme
   default, plus a "custom cohort" that re-runs the current preset.

   Presets:
   - Indian SaaS startup (~₹2-6Cr spend, 80 employees, early-stage,
     tools weighted to engineering and PLG)
   - Mid-market BFSI (~₹15-25Cr spend, 400 employees, compliance-heavy,
     tools weighted to security, risk, legal)
   - Manufacturing (~₹8-15Cr spend, 250 employees, operations-heavy,
     tools weighted to ERP, supply chain, shop floor)

   Everything stays in the browser. Loading a preset replaces the current
   state (confirmation prompt) and keeps the user's workspace / trial state.
   ========================================================================== */

const DEMO_PRESETS = {
  'indian-saas': {
    label: 'Indian SaaS startup',
    description: 'Series A/B SaaS company, ~80 people, Bengaluru. Engineering-heavy stack, PLG motion.',
    company: 'Nexlo (Series B · Bengaluru)',
    currencyPrefix: '₹',
    employees: 80,
    vendors: [
      // name, monthly_cost_inr, category, team, licenses, active_users, renewal_days
      ['AWS', 820000, 'Infrastructure', 'Engineering', null, null, 201],
      ['Vercel', 45000, 'Infrastructure', 'Engineering', 20, 18, 12],
      ['Supabase', 28000, 'Database', 'Engineering', null, null, 87],
      ['Posthog', 42000, 'Analytics', 'Product', null, null, 67],
      ['Linear', 12000, 'Engineering', 'Engineering', 55, 52, 42],
      ['GitHub Team', 18500, 'Development', 'Engineering', 55, 54, 88],
      ['Figma', 31000, 'Design', 'Design', 24, 22, 27],
      ['Anthropic Claude', 95000, 'AI / LLM', 'Engineering', 40, 38, 81],
      ['OpenAI API', 180000, 'AI / LLM', 'Engineering', null, null, 56],
      ['Slack', 62000, 'Communication', 'All', 80, 78, 47],
      ['Google Workspace', 48000, 'Productivity', 'IT', 85, 80, 74],
      ['Notion', 24000, 'Productivity', 'All', 80, 70, 92],
      ['1Password', 16000, 'Security', 'IT', 85, 82, 212],
      ['Zoom', 32000, 'Communication', 'Sales', 25, 22, 64],
      ['HubSpot Starter', 28000, 'Marketing', 'Marketing', 5, 5, 44],
      ['Apollo.io', 48000, 'Sales Intelligence', 'Sales', 8, 8, 84],
      ['Mixpanel', 22000, 'Analytics', 'Product', null, null, 115],
      ['Sentry', 18000, 'Observability', 'Engineering', null, null, 46],
      ['Pagerduty', 14000, 'Observability', 'Engineering', 12, 11, 131],
      ['Razorpay', 0, 'Payments', 'Finance', null, null, 999], // flat fee shown elsewhere
      ['Zoho Books', 8500, 'Finance', 'Finance', 3, 3, 65],
      ['Loom', 6000, 'Communication', 'All', 15, 9, 33],
      ['Calendly', 7500, 'Productivity', 'Sales', 20, 18, 73],
      ['Airtable', 16000, 'Productivity', 'Ops', 25, 20, 95],
      ['Tally', 3500, 'Finance', 'Finance', 2, 2, 140],
    ],
    departments: ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Finance', 'Ops', 'IT', 'People'],
  },

  'bfsi-midmarket': {
    label: 'Mid-market BFSI',
    description: 'Regulated financial services, ~400 people. Heavy spend on security, risk, legal, compliance. On-prem stance.',
    company: 'Vaidya Capital (BFSI · Mumbai)',
    currencyPrefix: '₹',
    employees: 420,
    vendors: [
      ['Microsoft 365 E5', 1520000, 'Productivity', 'IT', 450, 420, 143],
      ['Oracle Database', 2800000, 'Database', 'IT', null, null, 185],
      ['SAP S/4HANA', 4500000, 'ERP', 'Finance', 150, 128, 212],
      ['Salesforce Financial Services Cloud', 1250000, 'CRM', 'Sales', 180, 165, 98],
      ['Okta Workforce Identity', 285000, 'Security', 'IT', 450, 440, 66],
      ['Microsoft Defender for Cloud', 420000, 'Security', 'IT', null, null, 32],
      ['CrowdStrike Falcon', 680000, 'Security', 'IT', 500, 485, 112],
      ['Splunk Enterprise', 950000, 'Observability', 'IT', null, null, 78],
      ['ServiceNow IT Service Management', 580000, 'IT Service Management', 'IT', 120, 112, 155],
      ['Workday HCM', 720000, 'HR', 'People', 450, 440, 71],
      ['DocuSign CLM', 215000, 'Legal', 'Legal', 45, 40, 163],
      ['Thomson Reuters CLEAR', 125000, 'Risk & Compliance', 'Compliance', 15, 12, 203],
      ['Nasdaq BWise GRC', 185000, 'Risk & Compliance', 'Compliance', 25, 22, 158],
      ['Moody\'s Analytics ERS', 395000, 'Risk & Compliance', 'Risk', null, null, 227],
      ['Symphony', 92000, 'Communication', 'Trading', 40, 38, 48],
      ['Bloomberg Terminal', 1680000, 'Market Data', 'Trading', 24, 24, 365],
      ['Refinitiv Eikon', 420000, 'Market Data', 'Research', 12, 12, 192],
      ['Zoom', 52000, 'Communication', 'All', 420, 410, 64],
      ['Adobe Acrobat Pro', 68000, 'Productivity', 'Legal', 85, 72, 183],
      ['Tanium Core', 215000, 'Security', 'IT', null, null, 94],
      ['Veeam Backup', 145000, 'Infrastructure', 'IT', null, null, 102],
      ['Darktrace', 285000, 'Security', 'IT', null, null, 131],
      ['OneTrust', 185000, 'Risk & Compliance', 'Compliance', 15, 15, 176],
      ['Automation Anywhere', 320000, 'Automation', 'Ops', 60, 48, 148],
      ['Mulesoft Anypoint', 625000, 'Integration', 'IT', null, null, 215],
      ['Kyndryl Cloud Services', 1850000, 'Infrastructure', 'IT', null, null, 365],
    ],
    departments: ['IT', 'Finance', 'Sales', 'Compliance', 'Risk', 'People', 'Legal', 'Trading', 'Research', 'Ops'],
  },

  'manufacturing': {
    label: 'Manufacturing',
    description: 'Multi-plant Indian manufacturer, ~250 people. ERP-heavy, supply chain, shop-floor tools.',
    company: 'Bharathi Industries (Manufacturing · Chennai)',
    currencyPrefix: '₹',
    employees: 250,
    vendors: [
      ['SAP S/4HANA', 2800000, 'ERP', 'IT', 120, 108, 212],
      ['Microsoft 365', 420000, 'Productivity', 'IT', 280, 262, 143],
      ['AutoCAD + Inventor', 580000, 'CAD / Design', 'Engineering', 45, 42, 195],
      ['Solidworks Premium', 320000, 'CAD / Design', 'Engineering', 25, 24, 128],
      ['Siemens Teamcenter PLM', 850000, 'PLM', 'Engineering', 40, 36, 245],
      ['Oracle NetSuite', 680000, 'ERP', 'Finance', 60, 55, 182],
      ['Infor Supply Chain', 395000, 'Supply Chain', 'Ops', 80, 72, 165],
      ['Qlik Sense Enterprise', 185000, 'Analytics', 'Finance', 50, 42, 92],
      ['PTC ThingWorx IoT', 420000, 'IoT / MES', 'Ops', null, null, 128],
      ['Rockwell FactoryTalk', 625000, 'MES', 'Ops', null, null, 198],
      ['Salesforce Sales Cloud', 580000, 'CRM', 'Sales', 40, 36, 98],
      ['Workday HCM', 420000, 'HR', 'People', 250, 240, 71],
      ['Zoho Books', 24000, 'Finance', 'Finance', 8, 8, 65],
      ['Tally Prime Server', 48000, 'Finance', 'Finance', 12, 12, 140],
      ['DocuSign', 85000, 'Legal', 'Legal', 20, 18, 163],
      ['Zoom', 32000, 'Communication', 'All', 200, 180, 64],
      ['Slack', 28000, 'Communication', 'Office', 150, 125, 47],
      ['GitHub', 14000, 'Development', 'Engineering', 25, 22, 88],
      ['Azure DevOps', 42000, 'Development', 'Engineering', 35, 32, 118],
      ['Veeam Backup', 68000, 'Infrastructure', 'IT', null, null, 102],
      ['CrowdStrike Falcon', 285000, 'Security', 'IT', 280, 270, 112],
      ['SolarWinds NPM', 125000, 'Observability', 'IT', null, null, 158],
      ['Blue Yonder TMS', 485000, 'Supply Chain', 'Ops', null, null, 175],
      ['SAP Ariba', 395000, 'Procurement', 'Ops', 30, 26, 220],
      ['Lucidchart', 24000, 'Productivity', 'Engineering', 45, 38, 85],
    ],
    departments: ['IT', 'Engineering', 'Ops', 'Finance', 'Sales', 'People', 'Legal', 'Office'],
  },
};

/* Build state from a preset. Note: costs in presets are MONTHLY INR
   (lakh/crore scale) to match the Indian market reality. */
function buildStateFromPreset(presetKey) {
  const p = DEMO_PRESETS[presetKey];
  if (!p) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  const shift = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return iso(d); };

  const subs = p.vendors.map(v => {
    const [name, monthlyCost, category, team, lic, active, renewalOffset] = v;
    const ownerEmail = `owner-${(team || 'general').toLowerCase().replace(/\W+/g, '-')}@${p.company.toLowerCase().replace(/[^a-z]+/g, '')}.com`;
    return {
      id: crypto.randomUUID(),
      name,
      cost: monthlyCost,
      cycle: 'monthly',
      billingCycle: 'monthly',
      category,
      team,
      department: team,
      renewal: shift(renewalOffset),
      status: 'active',
      active: true,
      users: lic,
      licenses: lic,
      activeUsers: active,
      utilizationPct: lic && active ? Math.round((active / lic) * 100) : null,
      owner: ownerEmail,
      ownerEmail,
      contract: {
        autoRenew: true,
        noticeDays: renewalOffset > 180 ? 90 : renewalOffset > 60 ? 60 : 30,
        termLength: '12 months',
        priceCapPct: 7,
      },
      url: `https://${name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
      notes: `Loaded from ${p.label} preset.`,
    };
  });

  // Simple employees for the department picker
  const employees = [];
  const perDept = Math.ceil(p.employees / p.departments.length);
  p.departments.forEach(dept => {
    for (let i = 0; i < perDept && employees.length < p.employees; i++) {
      employees.push({
        id: crypto.randomUUID(),
        employeeId: `${dept.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        email: `person-${dept.toLowerCase()}-${i + 1}@${p.company.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
        name: `Person ${dept} ${i + 1}`,
        title: `${dept} member`,
        department: dept,
      });
    }
  });

  return { subscriptions: subs, employees, invoices: [] };
}

/* ---------- UI: picker in the dashboard header + Settings ---------- */
function renderDemoPicker() {
  const host = document.getElementById('dp-body'); if (!host) return;
  const currentPreset = state.settings.activePreset || 'acme';
  host.innerHTML = `
    <div class="dp-grid">
      <div class="dp-card ${currentPreset === 'acme' ? 'dp-current' : ''}" data-preset="acme">
        <div class="dp-head">
          <b>Acme Corp</b>
          ${currentPreset === 'acme' ? '<span class="dp-current-tag">Loaded</span>' : ''}
        </div>
        <div class="dp-desc">The default English-language sample. 28 vendors, mid-market US SaaS feel. Good for the first look.</div>
        <div class="dp-stats"><span>28 vendors</span><span>16 employees</span><span>USD</span></div>
        <button class="btn-primary dp-load" data-preset="acme">${currentPreset === 'acme' ? 'Reload' : 'Load this preset'}</button>
      </div>
      ${Object.entries(DEMO_PRESETS).map(([key, p]) => `
        <div class="dp-card ${currentPreset === key ? 'dp-current' : ''}" data-preset="${key}">
          <div class="dp-head">
            <b>${escapeHtml(p.label)}</b>
            ${currentPreset === key ? '<span class="dp-current-tag">Loaded</span>' : ''}
          </div>
          <div class="dp-sub">${escapeHtml(p.company)}</div>
          <div class="dp-desc">${escapeHtml(p.description)}</div>
          <div class="dp-stats"><span>${p.vendors.length} vendors</span><span>${p.employees} employees</span><span>${p.currencyPrefix}</span></div>
          <button class="btn-primary dp-load" data-preset="${key}">${currentPreset === key ? 'Reload' : 'Load this preset'}</button>
        </div>
      `).join('')}
    </div>
    <div class="dp-note">⚠️ Loading a preset replaces the current workspace data (subscriptions, invoices, employees). Workspace / trial status stays. Use this between demos to show the right flavour to the next prospect.</div>
  `;
  host.querySelectorAll('.dp-load').forEach(b => b.onclick = () => {
    const key = b.dataset.preset;
    if (!confirm(`Load the ${key === 'acme' ? 'Acme Corp default' : DEMO_PRESETS[key].label} preset? This replaces current subscriptions, invoices and employees.`)) return;
    loadPreset(key);
    renderDemoPicker();
    renderAll();
    toast(`${key === 'acme' ? 'Acme Corp' : DEMO_PRESETS[key].label} loaded.`, 'success');
  });
}

function loadPreset(key) {
  if (key === 'acme') {
    // Call the base app's sample loader
    if (typeof buildSampleState === 'function') {
      const sample = buildSampleState();
      state.subscriptions = sample.subscriptions || sample;
      state.invoices = sample.invoices || [];
      if (sample.employees) state.employees = sample.employees;
    }
    state.settings.activePreset = 'acme';
  } else {
    const built = buildStateFromPreset(key);
    if (!built) return;
    state.subscriptions = built.subscriptions;
    state.invoices = built.invoices;
    state.employees = built.employees;
    state.settings.activePreset = key;
  }
  // Clear chat log + logs so the new preset is clean
  state.settings.chatLog = [];
  state.alertLog = {};
  save();
}

/* ---------- View + nav ---------- */
function ensureDemoView() {
  if (document.getElementById('demo-presets')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'demo-presets'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Demo presets</h2>
        <p class="page-sub">Pick the seed dataset that matches your prospect. Load once, demo, reset between meetings. Everything stays in the browser.</p>
      </div>
    </div>
    <div id="dp-body"></div>
    <style>
      .dp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
      .dp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
      .dp-card.dp-current { border-color: var(--accent); background: linear-gradient(180deg, var(--surface) 0%, color-mix(in srgb, var(--accent) 5%, var(--surface)) 100%); }
      .dp-head { display: flex; justify-content: space-between; align-items: center; font-size: 15px; }
      .dp-current-tag { background: var(--accent); color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 10.5px; font-weight: 600; }
      .dp-sub { font-size: 12px; color: var(--ink-dim); font-weight: 600; }
      .dp-desc { font-size: 12.5px; line-height: 1.5; color: var(--ink); min-height: 50px; }
      .dp-stats { display: flex; gap: 6px; font-size: 11px; color: var(--ink-dim); flex-wrap: wrap; }
      .dp-stats span { background: var(--surface-2); padding: 2px 8px; border-radius: 10px; }
      .dp-load { align-self: flex-start; background: var(--accent); color: #fff; border: 0; padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
      .dp-load:hover { opacity: 0.9; }
      .dp-note { margin-top: 14px; padding: 10px 12px; background: var(--surface-2); border-left: 3px solid var(--accent); font-size: 12px; color: var(--ink-dim); border-radius: 0 8px 8px 0; }
    </style>
  `;
  main.appendChild(section);
  renderDemoPicker();
}
function ensureDemoNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const g = [...groups].find(x => x.querySelector('[data-view="integrations"]')) || groups[groups.length - 1];
  if (!g || g.querySelector('[data-view="demo-presets"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'demo-presets';
  btn.innerHTML = `${svg}<span>Demo presets</span>`;
  g.appendChild(btn);
  btn.addEventListener('click', () => switchView('demo-presets'));
}

/* Patch switchView */
const _origSwForDemo = window.switchView;
if (_origSwForDemo && !window._demoSwitchPatched) {
  window.switchView = function (name, opts) {
    if (name === 'demo-presets') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0 });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Demo presets';
      if (!opts?.replaceHistory) {
        const target = '#demo-presets';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      renderDemoPicker();
      return;
    }
    return _origSwForDemo(name, opts);
  };
  window._demoSwitchPatched = true;
}

if (window.PAGE_TITLES) { window.PAGE_TITLES['demo-presets'] = 'Demo presets'; }

const _prevAll18 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll18) {
  window.renderAll = function () {
    _prevAll18();
    try { ensureDemoView(); ensureDemoNav(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { ensureDemoView(); ensureDemoNav(); } catch (_) {} }, 850);
});
