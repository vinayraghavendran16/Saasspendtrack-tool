/* ==========================================================================
   SaaS Spend Track — Phase 10
   Data Sources: unified collection surface across 5 collection phases
   Phase 1: SSO / IdP (Okta, Entra ID, Google Workspace, JumpCloud)
   Phase 2: Direct vendor APIs (top 15 with usage endpoints)
   Phase 3: Finance / AP feeds (QuickBooks, NetSuite, Tally, Zoho Books, Xero)
   Phase 4: Unified API aggregators (Finch, Merge.dev, BetterCloud)
   Phase 5: Browser extension for shadow-IT discovery
   Browser-only build: the "Connect" flow simulates the OAuth handshake,
   writes realistic utilisation data onto the matched subscriptions, and
   records a provenance trail. Every state model matches what a real
   backend will need, so real OAuth handlers drop into the same slots.
   ========================================================================== */

/* ---------------- Catalog ---------------- */
const CONNECTOR_CATALOG = [
  // ---------- Phase 1: SSO / IdP ----------
  { id: 'okta',        phase: 1, kind: 'sso',    name: 'Okta',                   vendor: 'Okta',                colour: '#007dc1', region: 'Global', dataTypes: ['assignment','last_sso_login'], description: 'Pull every SAML/OIDC-connected app with assigned users and last SSO login. Covers 60-80% of a typical stack.', matches: ['Okta'] },
  { id: 'entra',       phase: 1, kind: 'sso',    name: 'Microsoft Entra ID',     vendor: 'Microsoft',           colour: '#0078d4', region: 'Global', dataTypes: ['assignment','last_sso_login','groups'], description: 'Azure AD users, groups, enterprise app assignments, sign-in logs (via Graph).', matches: ['Microsoft 365','Microsoft Entra ID'] },
  { id: 'gworkspace',  phase: 1, kind: 'sso',    name: 'Google Workspace',       vendor: 'Google',              colour: '#4285f4', region: 'Global', dataTypes: ['assignment','last_sso_login'], description: 'Users, org units, SAML-connected apps, login audit via Admin SDK.', matches: ['Google Workspace'] },
  { id: 'jumpcloud',   phase: 1, kind: 'sso',    name: 'JumpCloud',              vendor: 'JumpCloud',           colour: '#2d2d2d', region: 'Global', dataTypes: ['assignment','last_sso_login'], description: 'Open directory with SSO and provisioning events.', matches: [] },

  // ---------- Phase 2: Direct vendor APIs ----------
  { id: 'salesforce',  phase: 2, kind: 'api',    name: 'Salesforce',             vendor: 'Salesforce',          colour: '#00a1e0', region: 'Global', dataTypes: ['seats','last_login','feature_usage','api_calls','storage'], description: 'Users with last-login and profile; feature usage via Salesforce Optimizer and Event Monitoring.', matches: ['Salesforce Sales Cloud','Salesforce Service Cloud','Salesforce'] },
  { id: 'slack',       phase: 2, kind: 'api',    name: 'Slack',                  vendor: 'Slack',               colour: '#4A154B', region: 'Global', dataTypes: ['seats','last_active','messages_sent'], description: 'Member list, last-active date, messages sent per user via SCIM + Enterprise Grid analytics.', matches: ['Slack'] },
  { id: 'zoom',        phase: 2, kind: 'api',    name: 'Zoom',                   vendor: 'Zoom',                colour: '#2d8cff', region: 'Global', dataTypes: ['seats','last_login','meeting_minutes'], description: 'Licence assignment, last-login, meeting-minute usage per user.', matches: ['Zoom'] },
  { id: 'github',      phase: 2, kind: 'api',    name: 'GitHub Enterprise',      vendor: 'GitHub',              colour: '#24292e', region: 'Global', dataTypes: ['seats','last_active','commit_activity','copilot_usage'], description: 'Org membership, seat consumption, commit activity, Copilot usage.', matches: ['GitHub Enterprise','GitHub'] },
  { id: 'datadog',     phase: 2, kind: 'api',    name: 'Datadog',                vendor: 'Datadog',             colour: '#632ca6', region: 'Global', dataTypes: ['hosts','seats','log_ingest','custom_metrics'], description: 'Host count against committed, APM seats, log ingest, custom metrics against plan.', matches: ['Datadog'] },
  { id: 'hubspot',     phase: 2, kind: 'api',    name: 'HubSpot',                vendor: 'HubSpot',             colour: '#ff7a59', region: 'Global', dataTypes: ['seats','last_active','contacts'], description: 'Paid seats, last activity, contact tier consumption.', matches: ['HubSpot Marketing Hub','HubSpot'] },
  { id: 'atlassian',   phase: 2, kind: 'api',    name: 'Atlassian (Jira + Confluence)', vendor: 'Atlassian',   colour: '#0052cc', region: 'Global', dataTypes: ['seats','last_active'], description: 'User management API across Jira, Confluence, Bitbucket; last access, group membership.', matches: ['Atlassian Jira + Confluence','Jira','Confluence'] },
  { id: 'notion',      phase: 2, kind: 'api',    name: 'Notion',                 vendor: 'Notion',              colour: '#000000', region: 'Global', dataTypes: ['seats','last_active'], description: 'Workspace members, last active via SCIM.', matches: ['Notion'] },
  { id: 'figma',       phase: 2, kind: 'api',    name: 'Figma',                  vendor: 'Figma',               colour: '#f24e1e', region: 'Global', dataTypes: ['seats','last_active','seat_type'], description: 'Editor vs viewer seats, last login, seat type via org admin API.', matches: ['Figma'] },
  { id: 'onepassword', phase: 2, kind: 'api',    name: '1Password',              vendor: '1Password',           colour: '#2e67ff', region: 'Global', dataTypes: ['seats','last_active'], description: 'Business/Enterprise SCIM + Events API for last-active.', matches: ['1Password'] },
  { id: 'docusign',    phase: 2, kind: 'api',    name: 'DocuSign',               vendor: 'DocuSign',            colour: '#000000', region: 'Global', dataTypes: ['seats','envelopes_sent','last_envelope'], description: 'Sender seats, envelope count against plan, per-user last activity.', matches: ['DocuSign'] },
  { id: 'dropbox',     phase: 2, kind: 'api',    name: 'Dropbox Business',       vendor: 'Dropbox',             colour: '#0061ff', region: 'Global', dataTypes: ['seats','last_active','storage'], description: 'Team members, last activity, storage used per seat.', matches: ['Dropbox'] },
  { id: 'gong',        phase: 2, kind: 'api',    name: 'Gong',                   vendor: 'Gong',                colour: '#2b2b2b', region: 'Global', dataTypes: ['seats','calls_recorded'], description: 'Licensed users, call recording activity per seat.', matches: ['Gong'] },
  { id: 'apollo',      phase: 2, kind: 'api',    name: 'Apollo.io',              vendor: 'Apollo',              colour: '#1a4ac2', region: 'Global', dataTypes: ['seats','last_active','credits_used'], description: 'Seat assignment, export credit consumption, last-login.', matches: ['Apollo.io'] },
  { id: 'intercom',    phase: 2, kind: 'api',    name: 'Intercom',               vendor: 'Intercom',            colour: '#1f8ded', region: 'Global', dataTypes: ['seats','last_active','mau'], description: 'Team members, last activity, MAU against plan.', matches: ['Intercom'] },
  { id: 'zendesk',     phase: 2, kind: 'api',    name: 'Zendesk',                vendor: 'Zendesk',             colour: '#03363d', region: 'Global', dataTypes: ['seats','last_active'], description: 'Agent seats, last sign-in via Admin API.', matches: ['Zendesk'] },
  { id: 'anthropic',   phase: 2, kind: 'api',    name: 'Anthropic Claude for Work', vendor: 'Anthropic',        colour: '#d97706', region: 'Global', dataTypes: ['seats','last_active','tokens_used'], description: 'Workspace members, last-active, token usage against plan.', matches: ['Anthropic Claude for Work'] },
  { id: 'vercel',      phase: 2, kind: 'api',    name: 'Vercel',                 vendor: 'Vercel',              colour: '#000000', region: 'Global', dataTypes: ['seats','deploys','bandwidth'], description: 'Team members, deployment volume, bandwidth against plan.', matches: ['Vercel'] },
  { id: 'segment',     phase: 2, kind: 'api',    name: 'Segment',                vendor: 'Twilio Segment',      colour: '#52bd94', region: 'Global', dataTypes: ['seats','mtu','events'], description: 'Workspace members, monthly tracked users, event volume.', matches: ['Segment'] },
  { id: 'linkedinsn',  phase: 2, kind: 'api',    name: 'LinkedIn Sales Navigator', vendor: 'LinkedIn',         colour: '#0a66c2', region: 'Global', dataTypes: ['seats','last_active'], description: 'Seat assignment and usage via Sales Navigator admin panel; partial API.', matches: ['LinkedIn Sales Navigator'] },
  { id: 'adobe',       phase: 2, kind: 'api',    name: 'Adobe Creative Cloud',   vendor: 'Adobe',               colour: '#fa0f00', region: 'Global', dataTypes: ['seats','last_active'], description: 'Admin Console seat assignment, last-active via User Management API.', matches: ['Adobe Creative Cloud'] },
  { id: 'snowflake',   phase: 2, kind: 'api',    name: 'Snowflake',              vendor: 'Snowflake',           colour: '#29b5e8', region: 'Global', dataTypes: ['warehouse_usage','credits','users'], description: 'Credit consumption, warehouse size, user query history.', matches: ['Snowflake'] },
  { id: 'aws',         phase: 2, kind: 'api',    name: 'AWS',                    vendor: 'AWS',                 colour: '#ff9900', region: 'Global', dataTypes: ['spend','services','regions'], description: 'Cost Explorer, Trusted Advisor, service-level usage.', matches: ['AWS'] },
  { id: 'rippling_api',phase: 2, kind: 'api',    name: 'Rippling (as a SaaS)',   vendor: 'Rippling',            colour: '#ffc800', region: 'Global', dataTypes: ['seats','last_active'], description: 'Users and admin activity (separate from Rippling-as-HRIS in Phase 1).', matches: ['Rippling'] },

  // ---------- Phase 3: Finance / AP feeds ----------
  { id: 'quickbooks',  phase: 3, kind: 'finance',name: 'QuickBooks Online',      vendor: 'Intuit',              colour: '#2CA01C', region: 'Global', dataTypes: ['invoices','vendors','payments'], description: 'Bill / vendor sync. Matches invoices to subscriptions. SMB.', matches: [] },
  { id: 'netsuite',    phase: 3, kind: 'finance',name: 'NetSuite',               vendor: 'Oracle',              colour: '#1a94e7', region: 'Global', dataTypes: ['invoices','vendors','purchase_orders'], description: 'Vendor + AP invoice sync; map POs to contracts. Mid-market to enterprise.', matches: [] },
  { id: 'tally',       phase: 3, kind: 'finance',name: 'Tally Prime',            vendor: 'Tally Solutions',     colour: '#1a7bb9', region: 'India',  dataTypes: ['vouchers','ledgers','gst'], description: 'Indian mid-market finance. Vouchers and ledgers; GST breakdown per vendor.', matches: [] },
  { id: 'zohobooks',   phase: 3, kind: 'finance',name: 'Zoho Books',             vendor: 'Zoho',                colour: '#e42527', region: 'Global / India', dataTypes: ['bills','vendors','purchase_orders'], description: 'Indian SMB finance; bill + vendor sync with native Zoho People sync.', matches: [] },
  { id: 'xero',        phase: 3, kind: 'finance',name: 'Xero',                   vendor: 'Xero',                colour: '#13b5ea', region: 'Global', dataTypes: ['bills','contacts','payments'], description: 'SMB AP; contact (vendor) and bill sync with GST / VAT.', matches: [] },
  { id: 'sap',         phase: 3, kind: 'finance',name: 'SAP S/4HANA',            vendor: 'SAP',                 colour: '#0070c0', region: 'Global', dataTypes: ['invoices','vendors','cost_centers'], description: 'Enterprise ERP. Vendor master, AP invoices, cost-centre allocation.', matches: [] },
  { id: 'ramp',        phase: 3, kind: 'finance',name: 'Ramp',                   vendor: 'Ramp',                colour: '#000000', region: 'US',     dataTypes: ['transactions','cards','vendors'], description: 'Corporate-card transaction feed catches shadow SaaS on cards.', matches: [] },
  { id: 'razorpayx',   phase: 3, kind: 'finance',name: 'RazorpayX Corporate',    vendor: 'Razorpay',            colour: '#02042b', region: 'India',  dataTypes: ['transactions','cards','vendors'], description: 'Indian corporate card feed for shadow-IT detection.', matches: [] },

  // ---------- Phase 4: Unified APIs ----------
  { id: 'finch',       phase: 4, kind: 'unified', name: 'Finch (HR)',            vendor: 'Finch',               colour: '#111111', region: 'Global', dataTypes: ['employees','payroll','deductions'], description: 'Unified API across 200+ HRIS / payroll systems. One connection covers the HR side.', matches: [] },
  { id: 'merge',       phase: 4, kind: 'unified', name: 'Merge.dev',             vendor: 'Merge',               colour: '#111111', region: 'Global', dataTypes: ['hris','ticketing','filestorage'], description: 'Unified API spanning HRIS, ATS, Ticketing, File Storage. Drop-in multi-system coverage.', matches: [] },
  { id: 'bettercloud', phase: 4, kind: 'unified', name: 'BetterCloud',           vendor: 'BetterCloud',         colour: '#1F9BE5', region: 'Global', dataTypes: ['seats','usage','spend'], description: 'SaaS management aggregator. Pre-built connectors for ~100 tools.', matches: [] },
  { id: 'josys',       phase: 4, kind: 'unified', name: 'Josys',                 vendor: 'Josys',               colour: '#4F46E5', region: 'Global', dataTypes: ['seats','usage','licenses'], description: 'SaaS management platform with licence + usage aggregation.', matches: [] },
  { id: 'nudge',       phase: 4, kind: 'unified', name: 'Nudge Security',       vendor: 'Nudge',                colour: '#6366F1', region: 'Global', dataTypes: ['shadow_it','accounts'], description: 'Email-signal discovery of every SaaS account across the org (even non-SSO).', matches: [] },

  // ---------- Phase 5: Browser extension ----------
  { id: 'chromeext',   phase: 5, kind: 'extension', name: 'SaaS Spend Track Chrome extension', vendor: 'SaaS Spend Track', colour: '#16a34a', region: 'Global', dataTypes: ['last_visit','shadow_it','session_minutes'], description: 'Install on IT and Finance browsers. Captures every SaaS login the wearer makes, catches shadow IT the other methods miss.', matches: [] },
];

/* ---------------- Per-vendor source map ---------------- */
function matchesForVendor(subName) {
  const name = (subName || '').toLowerCase();
  return CONNECTOR_CATALOG.filter(c => c.matches.some(m => name === m.toLowerCase() || name.includes(m.toLowerCase())));
}

/* ---------------- Connection state ---------------- */
function connections() { state.settings.connections = state.settings.connections || {}; return state.settings.connections; }
function isConnected(connectorId) { return !!(connections()[connectorId] && connections()[connectorId].status === 'connected'); }
function connection(connectorId) { return connections()[connectorId] || null; }
function setConnection(connectorId, data) {
  state.settings.connections = { ...connections(), [connectorId]: data };
  save();
}
function disconnect(connectorId) {
  const c = { ...connections() }; delete c[connectorId];
  state.settings.connections = c; save();
  // Remove source tag from affected subscriptions
  state.subscriptions.forEach(s => { if (s.dataSource?.connectorId === connectorId) { delete s.dataSource; } });
  save();
}

/* ---------------- Simulated OAuth + sync ---------------- */
function simulateConnect(connectorId) {
  const cat = CONNECTOR_CATALOG.find(c => c.id === connectorId);
  if (!cat) return { ok: false, error: 'Unknown connector' };
  setConnection(connectorId, {
    connectorId, status: 'connected',
    connectedAt: new Date().toISOString(),
    connectedBy: (state.settings.users?.find(u => u.role === 'owner')?.email) || 'owner@acme.com',
    lastSyncAt: new Date().toISOString(),
    scope: cat.dataTypes,
    simulated: true,
  });
  return simulatePull(connectorId);
}

function simulatePull(connectorId) {
  const cat = CONNECTOR_CATALOG.find(c => c.id === connectorId);
  if (!cat) return { ok: false, error: 'Unknown connector' };
  if (!isConnected(connectorId)) return { ok: false, error: 'Not connected' };

  const touched = [];
  const now = new Date().toISOString();
  const conn = connections()[connectorId];
  conn.lastSyncAt = now;

  // For each subscription the catalog matches, update licences + utilised
  state.subscriptions.forEach(sub => {
    const catMatches = matchesForVendor(sub.name);
    if (!catMatches.includes(cat)) return;
    // Preserve existing licence count if present; otherwise invent a reasonable one
    const base = Number(sub.licenses) || Math.max(5, Math.round((monthlyCost(sub) || 1000) / 30));
    // Realistic utilisation range per category
    const util = {
      'Communication': 0.72, 'Productivity': 0.78, 'Development': 0.82, 'CRM': 0.74,
      'Design': 0.56, 'Marketing': 0.62, 'Sales Intelligence': 0.60, 'Support': 0.68,
      'Security': 0.92, 'HR': 0.86, 'Analytics': 0.58, 'Legal': 0.72, 'Observability': 0.75,
      'Data': 0.80, 'Infrastructure': 0.85, 'AI / LLM': 0.86,
    };
    const u = util[sub.category] || 0.65;
    const jitter = (seed) => { let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) & 0x7fffffff; return (x % 100) / 500; }; // deterministic small jitter
    const utilPct = Math.max(0.3, Math.min(0.97, u + jitter(sub.name) - 0.05));
    const assigned = Math.round(base * (0.88 + jitter(sub.id) * 0.4));
    const utilized = Math.round(assigned * utilPct);
    sub.licenses = base;
    sub.assigned = Math.min(base, assigned);
    sub.utilized = Math.min(sub.assigned, utilized);
    sub.dataSource = {
      connectorId, connectorName: cat.name, phase: cat.phase, kind: cat.kind,
      lastSyncAt: now, syncedBy: conn.connectedBy, confidence: cat.kind === 'api' ? 'high' : cat.kind === 'sso' ? 'medium' : 'low',
    };
    touched.push(sub);
  });
  save();
  return { ok: true, touched: touched.length, vendors: touched.map(s => s.name) };
}

/* ---------------- Coverage computation ---------------- */
function dataCoverage() {
  const subs = activeSubs();
  const total = subs.length;
  const withSource = subs.filter(s => s.dataSource);
  const byPhase = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  withSource.forEach(s => { byPhase[s.dataSource.phase]++; });
  const byConfidence = { high: 0, medium: 0, low: 0 };
  withSource.forEach(s => { byConfidence[s.dataSource.confidence] = (byConfidence[s.dataSource.confidence] || 0) + 1; });
  const notInstrumented = subs.filter(s => !s.dataSource);
  const totalMonthly = subs.reduce((a, s) => a + monthlyCost(s), 0);
  const uninstrumentedMonthly = notInstrumented.reduce((a, s) => a + monthlyCost(s), 0);
  const coveragePct = total ? Math.round((withSource.length / total) * 100) : 0;
  const spendCoveragePct = totalMonthly ? Math.round(((totalMonthly - uninstrumentedMonthly) / totalMonthly) * 100) : 0;
  return { total, withSource: withSource.length, notInstrumented, byPhase, byConfidence, coveragePct, spendCoveragePct, totalMonthly, uninstrumentedMonthly };
}

/* ---------------- Render ---------------- */
const PHASE_META = [
  null,
  { id: 1, label: 'Phase 1 · SSO / Identity Provider', blurb: 'One connection to your IdP maps every SSO-connected app. Covers 60-80% of a typical stack.' },
  { id: 2, label: 'Phase 2 · Direct vendor APIs',      blurb: 'Per-vendor OAuth apps for the deepest usage data. Each one unlocks real last-active and feature-level consumption.' },
  { id: 3, label: 'Phase 3 · Finance / AP feeds',      blurb: 'Pull every invoice from the accounting system. Reconciles spend and catches card-charged shadow IT.' },
  { id: 4, label: 'Phase 4 · Unified API aggregators', blurb: 'One connection covers many tools. Pay per-tenant to the aggregator; trade price for breadth.' },
  { id: 5, label: 'Phase 5 · Browser extension',       blurb: 'Captures every SaaS login the wearer makes. The only reliable way to catch non-SSO shadow IT.' },
];

function renderDataSources() {
  const host = document.getElementById('data-sources-body'); if (!host) return;
  const cov = dataCoverage();
  const subs = activeSubs().slice().sort((a, b) => monthlyCost(b) - monthlyCost(a));

  host.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">Vendor coverage</span><span class="stat-value">${cov.coveragePct}%</span><span class="stat-sub">${cov.withSource} of ${cov.total} instrumented</span></div>
      <div class="stat-card"><span class="stat-label">Spend coverage</span><span class="stat-value">${cov.spendCoveragePct}%</span><span class="stat-sub">${formatMoney(cov.totalMonthly - cov.uninstrumentedMonthly)}/mo tracked</span></div>
      <div class="stat-card"><span class="stat-label">Not instrumented</span><span class="stat-value" style="color:${cov.notInstrumented.length ? 'var(--warning-text)' : 'var(--text)'}">${cov.notInstrumented.length}</span><span class="stat-sub">${formatMoney(cov.uninstrumentedMonthly)}/mo blind</span></div>
      <div class="stat-card"><span class="stat-label">Data confidence</span><span class="stat-value">${cov.byConfidence.high || 0}<span style="color:var(--text-dim);font-size:16px"> / ${cov.byConfidence.medium || 0} / ${cov.byConfidence.low || 0}</span></span><span class="stat-sub">high / medium / low</span></div>
    </div>

    ${[1,2,3,4,5].map(ph => {
      const items = CONNECTOR_CATALOG.filter(c => c.phase === ph);
      const connected = items.filter(c => isConnected(c.id)).length;
      const meta = PHASE_META[ph];
      return `<section class="ds-phase">
        <div class="ds-phase-head">
          <div><h3>${meta.label} <span class="badge ${connected ? 'ok' : ''}">${connected} / ${items.length} connected</span></h3>
               <p>${meta.blurb}</p></div>
        </div>
        <div class="ds-grid">${items.map(renderConnectorCard).join('')}</div>
      </section>`;
    }).join('')}

    <section class="ds-phase">
      <div class="ds-phase-head"><div><h3>Per-vendor data source map <span class="badge">${cov.total}</span></h3>
        <p>Every active vendor, which connector feeds it today, and when it was last synced. "Not instrumented" rows need either a connector turned on or a manual entry.</p></div></div>
      <div class="table-wrap">
        <table class="sub-table"><thead><tr>
          <th>Vendor</th><th>Team</th><th>Category</th><th class="num">Monthly</th>
          <th>Current source</th><th>Confidence</th><th>Last sync</th><th>Available via</th>
        </tr></thead><tbody>${subs.map(s => {
          const src = s.dataSource;
          const options = matchesForVendor(s.name);
          return `<tr>
            <td><b><a href="#" class="vendor-link" data-vendor-nav="${s.id}">${escapeHtml(s.name)}</a></b></td>
            <td><span class="team-chip">${escapeHtml(s.team || '—')}</span></td>
            <td>${escapeHtml(s.category || '—')}</td>
            <td class="num">${formatMoney(monthlyCost(s))}</td>
            <td>${src ? `<span class="badge info">${escapeHtml(src.connectorName)}</span>` : '<span class="badge warn">Not instrumented</span>'}</td>
            <td>${src ? `<span class="badge ${src.confidence === 'high' ? 'ok' : src.confidence === 'medium' ? 'info' : 'warn'}">${src.confidence}</span>` : '—'}</td>
            <td>${src ? new Date(src.lastSyncAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
            <td>${options.length ? options.map(o => `<span class="badge ${isConnected(o.id) ? 'ok' : ''}" style="margin-right:3px">${escapeHtml(o.name)}</span>`).join('') : '<span style="color:var(--text-dim);font-size:11.5px">No connector yet · <a href="#" data-manual-sub="' + s.id + '" class="link">enter seats manually</a></span>'}</td>
          </tr>`;
        }).join('')}</tbody></table>
      </div>
    </section>
  `;

  host.querySelectorAll('[data-ds-connect]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.dsConnect;
    openConnectModal(id);
  }));
  host.querySelectorAll('[data-ds-pull]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.dsPull;
    const r = simulatePull(id);
    if (!r.ok) toast(r.error, 'error');
    else toast(`Pulled ${r.touched} vendor${r.touched === 1 ? '' : 's'} from ${CONNECTOR_CATALOG.find(c => c.id === id).name}.`, 'success');
    renderDataSources();
    renderAll();
  }));
  host.querySelectorAll('[data-ds-disconnect]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.dsDisconnect;
    if (!confirm(`Disconnect ${CONNECTOR_CATALOG.find(c => c.id === id).name}? Subscriptions sourced from this connector will become "Not instrumented".`)) return;
    disconnect(id);
    renderDataSources();
    renderAll();
  }));
  host.querySelectorAll('[data-manual-sub]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const sub = state.subscriptions.find(s => s.id === a.dataset.manualSub); if (!sub) return;
    const total = prompt(`${sub.name} — total licence count?`, sub.licenses || 10);
    if (total === null) return;
    const assigned = prompt(`${sub.name} — assigned seats?`, sub.assigned || Math.round(parseInt(total,10)*0.9));
    const used = prompt(`${sub.name} — actively used (last 30d)?`, sub.utilized || Math.round(parseInt(assigned||total,10)*0.6));
    sub.licenses = parseInt(total,10) || 0;
    sub.assigned = parseInt(assigned,10) || 0;
    sub.utilized = parseInt(used,10) || 0;
    sub.dataSource = { connectorId: 'manual', connectorName: 'Manual entry', phase: 0, kind: 'manual', lastSyncAt: new Date().toISOString(), confidence: 'low' };
    save(); renderDataSources(); renderAll(); toast('Seats recorded manually.', 'success');
  }));
}

function renderConnectorCard(c) {
  const conn = connection(c.id);
  const connected = isConnected(c.id);
  const lastSync = conn?.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const touches = state.subscriptions.filter(s => s.dataSource?.connectorId === c.id).length;
  return `<div class="ds-tile ${connected ? 'connected' : ''}">
    <div class="ds-tile-head">
      <div class="ds-logo" style="background:${c.colour}">${(c.name || '').slice(0,1).toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <b>${escapeHtml(c.name)}</b>
        <div class="ds-tile-meta">${escapeHtml(c.region)}${c.kind === 'api' ? ' · Direct API' : c.kind === 'sso' ? ' · Identity provider' : c.kind === 'finance' ? ' · Finance system' : c.kind === 'unified' ? ' · Unified API' : ' · Extension'}</div>
      </div>
      <span class="badge ${connected ? 'ok' : ''}">${connected ? 'Connected' : 'Available'}</span>
    </div>
    <p class="ds-desc">${escapeHtml(c.description)}</p>
    <div class="ds-data-types">${c.dataTypes.map(d => `<span class="ds-chip">${d.replace(/_/g,' ')}</span>`).join('')}</div>
    ${connected ? `<div class="ds-tile-foot">
      <div class="ds-sync"><b>${touches}</b> vendor${touches === 1 ? '' : 's'} sourced · last synced ${lastSync}</div>
      <div class="ds-tile-actions">
        <button class="icon-btn" data-ds-pull="${c.id}">Pull now</button>
        <button class="icon-btn danger" data-ds-disconnect="${c.id}">Disconnect</button>
      </div>
    </div>` : `<div class="ds-tile-foot"><div></div><button class="primary" data-ds-connect="${c.id}">Connect</button></div>`}
  </div>`;
}

/* ---------------- Connect modal (simulated OAuth handshake) ---------------- */
function openConnectModal(connectorId) {
  const cat = CONNECTOR_CATALOG.find(c => c.id === connectorId); if (!cat) return;
  let modal = document.getElementById('ds-connect-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop'; modal.id = 'ds-connect-modal';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  }
  const options = state.subscriptions.filter(s => matchesForVendor(s.name).some(x => x.id === connectorId));
  modal.hidden = false;
  modal.innerHTML = `<div class="modal" style="max-width:520px">
    <h2>Connect ${escapeHtml(cat.name)}</h2>
    <div class="ds-oauth-mock">
      <div class="ds-logo" style="background:${cat.colour};width:48px;height:48px;border-radius:10px">${cat.name.slice(0,1).toUpperCase()}</div>
      <div><b>${escapeHtml(cat.name)}</b><div style="font-size:12px;color:var(--text-dim)">${escapeHtml(cat.vendor)} · ${cat.kind.toUpperCase()}</div></div>
    </div>
    <p style="font-size:13px;line-height:1.6;color:var(--text-2);margin-bottom:10px">Clicking <b>Authorise</b> opens the OAuth consent page at the provider. You'll be asked to approve read access to:</p>
    <ul class="ds-scope-list">${cat.dataTypes.map(d => `<li><span class="ds-scope-dot"></span>${d.replace(/_/g,' ')}</li>`).join('')}</ul>
    <p style="font-size:13px;line-height:1.6;color:var(--text-2);margin:14px 0 6px">This connector will populate seats and utilisation for:</p>
    ${options.length ? `<ul class="ds-match-list">${options.map(s => `<li><b>${escapeHtml(s.name)}</b><span>${formatMoney(monthlyCost(s))}/mo · ${escapeHtml(s.team || '—')}</span></li>`).join('')}</ul>` : '<p style="font-size:13px;color:var(--text-dim);padding:10px;background:var(--panel-2);border-radius:var(--radius-sm)">No matched subscriptions in your register yet. The connection will still be saved; vendors matched later will be sourced from it automatically.</p>'}
    <div style="padding:10px 12px;background:var(--warning-soft);color:var(--warning-text);border-radius:var(--radius-sm);font-size:12px;margin-top:14px"><b>Demo build:</b> clicking Authorise simulates the OAuth handshake and populates realistic utilisation data. In production this launches the real OAuth popup.</div>
    <div class="actions" style="margin-top:14px">
      <button type="button" id="ds-c-cancel">Cancel</button>
      <button type="button" class="primary" id="ds-c-auth">Authorise &amp; connect</button>
    </div>
  </div>`;
  document.getElementById('ds-c-cancel').onclick = () => { modal.hidden = true; };
  document.getElementById('ds-c-auth').onclick = () => {
    const r = simulateConnect(connectorId);
    modal.hidden = true;
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(`${cat.name} connected · pulled data for ${r.touched} vendor${r.touched === 1 ? '' : 's'}.`, 'success');
    renderDataSources(); renderAll();
  };
}

/* ---------------- View + nav ---------------- */
function ensureDataSourcesView() {
  if (document.getElementById('data-sources')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'data-sources'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head"><div><h2>Data sources</h2><p class="page-sub">Every way the tool can pull licence and spend data in automatically. Five phases from SSO to browser extension; each phase covers a different slice of the stack. The per-vendor table at the bottom shows what's instrumented, what's manual, and what's blind.</p></div></div>
    <div id="data-sources-body"></div>
  `;
  main.appendChild(section);
}
function ensureDataSourcesNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const workspaceGroup = [...groups].find(g => g.querySelector('[data-view="workspace"]')) || [...groups][groups.length-1];
  if (!workspaceGroup || workspaceGroup.querySelector('[data-view="data-sources"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'data-sources';
  btn.innerHTML = `${svg}<span>Data sources</span><span class="nav-count" id="nav-count-data-sources" hidden></span>`;
  // Insert after workspace tab
  const wsTab = workspaceGroup.querySelector('[data-view="workspace"]');
  if (wsTab && wsTab.nextSibling) workspaceGroup.insertBefore(btn, wsTab.nextSibling);
  else workspaceGroup.appendChild(btn);
  btn.addEventListener('click', () => switchView('data-sources'));
}
function patchSwitchViewForDataSources() {
  if (window._dsSwitchPatched) return;
  const _orig = window.switchView;
  window.switchView = function (name, opts = {}) {
    if (name === 'data-sources') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0 });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Data sources';
      if (!opts.replaceHistory) {
        const target = '#data-sources';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._dsSwitchPatched = true;
}
function updateDataSourcesNavCount() {
  const el = document.getElementById('nav-count-data-sources'); if (!el) return;
  const cov = dataCoverage();
  el.textContent = cov.notInstrumented.length;
  el.hidden = !cov.notInstrumented.length;
}

/* Hook renderAll */
const _prevAll11 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll11) {
  window.renderAll = function () {
    _prevAll11();
    try {
      ensureDataSourcesView();
      ensureDataSourcesNav();
      patchSwitchViewForDataSources();
      renderDataSources();
      updateDataSourcesNavCount();
    } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureDataSourcesView();
      ensureDataSourcesNav();
      patchSwitchViewForDataSources();
      renderDataSources();
      updateDataSourcesNavCount();
    } catch (_) {}
  }, 500);
});
