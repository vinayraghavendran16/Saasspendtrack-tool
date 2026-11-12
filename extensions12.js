/* ==========================================================================
   SaaS Spend Track — Phase 11
   Changelog + Roadmap view
   Two tabs in one surface:
     - Changelog: chronological log of what shipped, per phase
     - Roadmap: themed list of what's next, with status (next / planned /
       exploring) and an upvote counter for internal prioritisation
   Both are editable in-tool so the product team keeps them current
   as new work ships.
   ========================================================================== */

const CHANGELOG = [
  { date: '2026-11-13', phase: 'Phase 30', title: 'Removed static dashboard mock + simplified pricing to match Razorpay', kind: 'fix', items: [
    'Removed the old static dashboard mock section from the marketing site (lines 413-468 of index.html) — the new animated Live Preview section built in Phase 28 is now the only dashboard preview on the page',
    '"See the dashboard" hero CTA now routes to https://app.saasspendtrack.com (was an in-page #demo anchor)',
    'Simplified pricing display to match what Razorpay actually collects: ₹3,00,000/year flat, with "GST extra for Indian customers, invoice provided" as a footnote rather than adding "+ GST" to the headline or showing ₹3,54,000 as the total',
    'Consistency: Razorpay collects ₹3,00,000, GST invoice issued separately via Zoho Books for Indian B2B buyers',
    'schema.org, OG tags, FAQ, pricing card, comparison, and tool trial banners all updated to the simpler format',
  ]},
  { date: '2026-11-13', phase: 'Phase 29', title: 'INR-anchored pricing + vinayraghavendran16@gmail.com + phone + company name fix', kind: 'feature', items: [
    'Pricing anchor shifted to ₹3,00,000 INR excluding 18% GST (total payable ₹3,54,000 for India)',
    'USD equivalent now derived live from the INR anchor via frankfurter.app — approx $3,600 USD at today\'s rate',
    'Marketing site pricing card shows ₹ as primary currency, with USD and GST breakdown below',
    'Contact email changed from vinay@saasspendtrack.com to vinayraghavendran16@gmail.com across every surface',
    'Phone number +91 91684 81989 added to the footer, trial banner, and one-pager default distributor info',
    'Company name corrected to "Whizzlead Solutions OPC Private Limited" (no parens) in footer and all legal copy',
    'One-pager default distributor info pre-filled with Vinay as signatory (overrideable per prospect)',
  ]},
  { date: '2026-11-13', phase: 'Phase 28', title: 'Repositioning: global teams + live FX + animated preview + Razorpay', kind: 'feature', items: [
    'Positioning updated from "Indian and APAC mid-market" to "global teams" across every surface. US and UK buyers get the same message as Indian prospects, with India-specific features (lakh/crore, INR invoicing, GST) kept as capabilities not positioning',
    'Price updated from $3,199 to ₹3,00,000/year',
    'INR conversion on the marketing site is now LIVE via frankfurter.app (free, ECB daily rate, no auth) with 18% GST included, Indian lakh-style formatting (₹3,44,000), and the exchange rate + date shown inline',
    'Static fallback shown first so the price never blanks out; live rate replaces it within a second',
    'New Live dashboard preview section on the marketing site: faux browser chrome with 5 rotating scenes from the actual tool — Dashboard KPIs ticking, Ask Track typing + answer, Renewal Center lanes, Licence Forecast chart drawing, Risk analytics bars',
    'Upgrade CTA across the tool (trial banner + expiry gate) now points to a Razorpay payment page (live URL: rzp.io/rzp/NCGW9GyD)',
    'Marketing site pricing CTAs now include "Pay & activate" button pointing to Razorpay alongside "Try it live" and "Book a demo"',
  ]},
  { date: '2026-11-12', phase: 'Phase 27', title: 'Pricing updated to ₹3,00,000/year (India excluding GST)', kind: 'feature', items: [
    'Annual price updated from $3,000 to ₹3,00,000 across every surface — marketing site, one-pager PDF, trial expiry gate, trial banner, README, UAT',
    'For India: pricing shown as approximately ₹2,65,000 per year with explicit "excluding 18% GST" note so Indian prospects see the final-invoice number',
    'Extra-contracts pricing unchanged at $100/year per additional 50 contracts above 250',
    'schema.org Product price metadata updated to 3199 USD so Google and search engines see the right value',
  ]},
  { date: '2026-11-12', phase: 'Phase 26', title: 'Full cycle: QA expansion, UAT scenarios, docs refresh', kind: 'feature', items: [
    'QA harness expanded to 124 tests covering Phases 22-25 (one-pager, trial gate, demo presets, vendor contacts, voice settings, Ask Track intents, fuzzy vendor matching, download bridge)',
    'Headless test runner (run_qa.js) using Puppeteer + Chromium — runs the full suite in ~5 seconds and reports pass/fail/skip',
    'Current status: 116 pass / 0 fail / 8 skip (skips need a real backend)',
    'Three real bugs caught by the expansion and fixed: (1) a literal end-script tag inside a template literal broke the HTML bundle; (2) voiceSettings() crashed on load before state was initialised; (3) monthlyCost shadow collision in extensions13 duplicated the function with wrong weekly constant (4.33 vs 4.345)',
    'New UAT.md: 10 scenario sections, 70+ test steps for manual pre-release walk-through, covering fresh-install, distributor demo cycle, trial gate, one-pager, contact book, Ask Track (text + voice), download audit, mobile, dark mode, marketing site',
    'README.md refreshed to reflect Phases 1-25 (architecture, feature list, hosting, extensions table, pricing, running locally, bundling)',
    'Smoke-test shortcut documented: run_qa.js + 6 manual steps for a 2-minute go/no-go after any push',
  ]},
  { date: '2026-11-12', phase: 'Phase 25', title: 'Vendor contact book', kind: 'feature', items: [
    'New Vendor contacts view: AE/CSM name, email, phone, LinkedIn, last/next outreach, notes per vendor',
    'Four KPIs: vendors with contact, missing contact, stale (>60d since touch), portfolio value',
    'Stale rows (no touch in 60+ days) highlighted red; 30-60 days aging highlighted amber',
    'Contact pane also injected inline into the contract review modal so editing is one click from every vendor row',
    'Draft renewal email button: pre-fills a mailto with subject + personalised body using the vendor name, annual commit, seat utilisation, and renewal date',
    'Clicking draft automatically records today as the last-outreach date',
    'Contact book persists per-vendor on the subscription record, survives preset swaps',
    'PDF export supported',
  ]},
  { date: '2026-11-12', phase: 'Phase 24', title: 'Demo seed-data switcher (3 industry presets)', kind: 'feature', items: [
    'New Demo presets view with three industry-tailored seed datasets plus the Acme Corp default',
    'Indian SaaS startup: Series B, 80 people, Bengaluru. 25 vendors weighted to engineering and PLG tools, INR costs',
    'Mid-market BFSI: 420 people, Mumbai. 26 vendors weighted to security, risk, compliance, legal — matches the on-prem pitch',
    'Manufacturing: 250 people, Chennai. 25 vendors weighted to ERP, CAD/PLM, supply chain, MES, shop-floor',
    'One-click Load replaces current subscriptions / employees / invoices and clears chat history for a clean slate',
    'Workspace / trial status is preserved so the dev controls on the Plans view still work between loads',
    'Current preset is marked with a badge so the distributor knows which flavour is live before the next demo',
  ]},
  { date: '2026-11-12', phase: 'Phase 23', title: 'Trial expiry enforcement', kind: 'feature', items: [
    'Full-screen expiry gate blocks the app when the 14-day trial ends — three actions: Upgrade (mailto), mark as paid, or view data read-only',
    'Grace mode banner at the top when ≤3 days remain, orange warn style with inline Upgrade CTA',
    'Read-only mode blurs spend figures with a lock icon so the data is preserved but hidden until upgrade',
    'switchView intercepts navigation on expired trials and keeps the Plans view accessible for self-service upgrade',
    'Owner-only dev controls on the Plans view: reset to fresh trial, force-expire for demos, mark as paid/revert',
    'Fresh-trial button resets the clock cleanly so the distributor can re-demo with the next prospect',
    'window.AskTrackTrial exposes state/reset/expire for console use',
  ]},
  { date: '2026-11-12', phase: 'Phase 22', title: 'Distributor one-pager (branded A4 PDF)', kind: 'feature', items: [
    'New Distributor one-pager view under Workspace',
    'Branded A4 single-page leave-behind rendered inline for preview',
    'Personalisation: prospect name, distributor name, email, phone — all baked into the PDF',
    'Four bands: hero + value prop, three-pillar problem/solution, pricing + differentiator, CTA with QR code to saasspendtrack.com and distributor contact',
    'Download PDF button routes through the universal download bridge',
    'Print button opens a clean print-ready window',
    'QR code auto-generated via qrserver.com; encodes a prospect-tagged URL for simple attribution',
    'Settings persist in state so the same inputs come back next time',
  ]},
  { date: '2026-11-12', phase: 'Phase 21', title: 'Speak replies ON by default', kind: 'feature', items: [
    'TTS voice reply now defaults to ON and persists across sessions in state.settings.voice.speakOn',
    'Modal (Cmd+K) answers also speak the headline, not just the drawer and full chat view',
  ]},
  { date: '2026-11-12', phase: 'Phase 20', title: 'Intent fixes: fuzzy vendor match + reliable Esc close', kind: 'fix', items: [
    'Fuzzy vendor matching with Levenshtein distance — voice near-misses like "hotspot" now resolve to HubSpot, "sells force" to Salesforce. Threshold: 2 chars for short names, 3 for longer',
    'Reordered intent router so simple "spend on X" is checked before the multi-slot "dept spending on vendor" pattern — fixes "total spend on hotspot" grabbing "total" as department and "year" as vendor',
    'The dept+vendor intent now requires an explicit team/dept/department keyword, so generic questions never match it',
    'When a vendor still cannot be matched, the response now shows the 5 closest vendor names as clickable chips — recover from a near-miss in one tap',
    'Esc key now closes the modal from anywhere inside it (previously only worked if the input had focus)',
    'Closing the modal also cancels any in-flight speech and recording — no more voice playing after dismiss',
  ]},
  { date: '2026-11-12', phase: 'Phase 19', title: 'Live on app.saasspendtrack.com + voice language picker', kind: 'feature', items: [
    'Hosted on Cloudflare Pages (saasspendtrack project) with custom domain app.saasspendtrack.com',
    'Auto-deploy on every push to main branch via GitHub integration',
    'wrangler.toml + _headers + _redirects shipped: single-page-application fallback, mic Permissions-Policy allowed, 1h cache on JS/CSS, no-cache on HTML for instant deploy rollout',
    'TTS reply language now defaults to English — no more Hindi default',
    'Voice settings pane in the Ask Track view: reply voice language, reply voice picker, mic input language',
    '12 languages supported for both TTS and STT: English (US/India/UK), Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi',
    'Scorer never crosses language families — picking English will never fall back to a Hindi voice (fixes the previous Hindi default)',
    'Test voice button speaks a sample sentence in the chosen language — useful for confirming the voice is installed on this device',
    'Mic input language takes effect on next press',
  ]},
  { date: '2026-11-12', phase: 'Phase 18', title: 'Less robotic voice: prefer Natural/Neural, chunk at sentences', kind: 'feature', items: [
    'Voice picker now scores every installed voice — Natural/Neural voices (Microsoft Edge\'s Natural voices, Google WaveNet) win decisively over system voices (Veena, Microsoft Desktop)',
    'Scoring also weights Indian English accent, female gender, and down-weights obvious formant voices',
    'Text is split at sentence boundaries and spoken as separate utterances with light prosody variation per chunk — kills the monotone flatness',
    'Currency ($12,500 / ₹5 lakh) and percentages read as natural language, not digit-by-digit',
    'Lakh/crore conversion for Indian currency amounts over ₹1,00,000',
    'Debug helpers: window.AskTrackVoice.listVoices() shows every voice and its score; setVoiceByName("name") to override',
    'Open your browser console and run AskTrackVoice.listVoices() to see which voices are installed on this device',
  ]},
  { date: '2026-11-12', phase: 'Phase 17', title: 'Voice: Indian female voice + clearer mic errors', kind: 'feature', items: [
    'Ask Track replies now use an Indian English female voice when installed on the device (Veena on macOS/iOS, Microsoft Heera on Windows, system Indian voice on Chrome/Android)',
    'Softer cadence: rate 0.92, pitch 0.95 for a more soothing read-aloud',
    'Graceful fallback chain if no Indian voice is installed: en-IN female → any en-IN → en-GB female → platform default',
    'Mic errors now explain the cause: inside the Claude artifact preview the parent iframe does not grant microphone permissions-policy, so voice input is blocked there — works natively on any hosted copy',
    'Browser-blocked mic errors now tell you how to unblock in one line (click the lock icon in the address bar)',
    'no-speech / no-mic / network errors each have their own clear message',
  ]},
  { date: '2026-11-12', phase: 'Phase 16', title: 'Renamed to Ask Track + 6 new intents', kind: 'feature', items: [
    'Feature renamed from "Ask the Corpus" to "Ask Track" across every surface — topbar bar, modal, chat view, sidebar nav, docs',
    'Six new intents added to the router to catch list-style questions that previously fell through: list_vendors, list_owners, list_contracts, count_vendors, department_list, help',
    'Now answers: "give me all vendor names", "list all vendors", "who owns what", "how many vendors do we have", "what departments do we have", "help"',
    'Fallback response now shows clickable chips of known intents when it cannot route — much shorter path from a miss to a hit',
    'Type "help" anywhere to see every intent the router supports',
    'Trademark note: Ask Track was chosen as a brand-anchored combination of two common words — clear in Class 42 SaaS, no known mark collision',
  ]},
  { date: '2026-11-12', phase: 'Phase 15', title: 'Global command palette for Ask Track', kind: 'feature', items: [
    'Persistent search bar in the topbar on every view — click it or press ⌘K / Ctrl+K',
    'Centered modal with keyboard-first interaction: ↑↓ to navigate suggestions, ↵ to ask, Esc to close',
    'Suggestions include starter questions plus "Spend on <vendor>" for every subscription in state',
    'Voice input button inside the modal, same engine as the full view',
    'Dedicated #chat view retained for persistent history and voice-reply',
    'Floating pill now mobile-only (topbar bar collapses below 720px, pill takes over)',
    'All in-browser: query → answer round trip under 20ms, no network call',
  ]},
  { date: '2026-11-12', phase: 'Phase 14', title: 'Universal download bridge (artifact-safe)', kind: 'fix', items: [
    'Every download button now routes through one bridge: claude.use("downloads") when inside the Claude artifact viewer, classic anchor+blob everywhere else',
    'Fixes silent download failures inside the artifact preview (PDF exports, CSV exports, JSON exports, ICS calendar, all template downloads)',
    'Downloads capability declared on the artifact so the viewer prompts for save confirmation',
    'Works natively with zero prompts on any hosted copy (Cloudflare Pages, Vercel, self-host)',
  ]},
  { date: '2026-11-12', phase: 'Phase 13', title: 'Licence Forecasting (capacity planning)', kind: 'feature', items: [
    'New Licence Forecast view under Operations',
    'Per-vendor quarterly demand projection: Q+1 to Q+4',
    'Model: demand(q) = active × (1 + headcount_growth)^q × (1 + adoption_growth)^q × utilisation_buffer × confidence_buffer',
    'Capacity plan controls: org growth %, target utilisation, horizon, confidence',
    'Per-department overrides: either growth % per quarter or target headcount at horizon',
    'Recommendation per vendor: Add seats / Hold / Reclaim — with annual $ impact',
    'Portfolio seat-demand curve chart (today vs. Q+1 through horizon)',
    'All forecast settings persist to state and export to PDF',
  ]},
  { date: '2026-11-12', phase: 'Phase 12', title: 'AI Chat on the contract corpus (text + voice)', kind: 'feature', items: [
    'New Ask Track view and a floating Ask pill on every screen',
    'Natural-language Q&A over vendors, contracts, invoices, licences, departments, risk, renewals, clauses, approvals, employees',
    '14 intent patterns including: "How much is marketing spending on Salesforce this quarter?", "How many Figma licences do I need next quarter?", "Which contracts have the highest risk?", "Which tools are underused?", "Cost per user for Slack"',
    'Voice input via the Web Speech API (SpeechRecognition) with recording state',
    'Voice reply via SpeechSynthesis (toggle per surface)',
    'Grounded answers only: every number sourced from state, with a why-this-answer trace per reply, and clickable sources back to the contract review modal',
    'Chat history persists per workspace; clear control included',
    'No external AI call — runs entirely in the browser',
  ]},
  { date: '2026-11-12', phase: 'Phase 11', title: 'Changelog & Roadmap view', kind: 'feature', items: [
    'New in-product changelog documenting every release with the date, phase and user-facing change',
    'Themed roadmap view with upvote counter so the product team can prioritise from one surface',
    'Both are editable in-tool and persist to state',
    'Surfaced in the sidebar under Workspace',
  ]},
  { date: '2026-11-12', phase: 'Phase 10', title: 'Data Sources + 44 connectors', kind: 'feature', items: [
    'New Data Sources view consolidates every automated data-pull mechanism',
    'Phase 1: Okta, Microsoft Entra ID, Google Workspace, JumpCloud (SSO)',
    'Phase 2: 24 direct vendor APIs — Salesforce, Slack, Zoom, GitHub, Datadog, HubSpot, Atlassian, Notion, Figma, 1Password, DocuSign, Dropbox, Gong, Apollo, Intercom, Zendesk, Anthropic, Vercel, Segment, LinkedIn Sales Nav, Adobe, Snowflake, AWS, Rippling',
    'Phase 3: 8 finance / AP feeds — QuickBooks, NetSuite, Tally, Zoho Books, Xero, SAP, Ramp, RazorpayX',
    'Phase 4: 5 unified-API aggregators — Finch, Merge.dev, BetterCloud, Josys, Nudge Security',
    'Phase 5: Chrome extension for shadow-IT discovery',
    'Per-vendor source map table with current source, confidence rating (high/medium/low), last-sync timestamp, and all available connectors per vendor',
    'Four KPIs: vendor coverage, spend coverage, not instrumented, data confidence breakdown',
    'Simulated OAuth handshake and data pull populate realistic utilisation data today; real OAuth handlers drop into the same slots when the server tier ships',
  ]},
  { date: '2026-11-12', phase: 'Audit', title: 'Dark-mode contrast + mobile overflow fixes', kind: 'fix', items: [
    'Six classes using ink-background with hardcoded white text now flip correctly in dark mode (Renegotiate button, Acknowledge hover, Most Popular tag, toasts, Done button in dropdowns, Open Approvals button)',
    'Analytics view fixed-width SVG charts now scale fluidly below 900px',
    'Dashboard horizontal overflow (13px) resolved',
    'Mobile nav strip contained to viewport (was pushing the page 346px wide on Analytics)',
    'Esc key now closes invite, OAuth and accept-invite modals (was only backdrop click)',
    'Full QA suite: 80 pass, 0 fail, 8 skipped (backend-only)',
  ]},
  { date: '2026-11-12', phase: 'Phase 9', title: 'QA harness + 88 in-browser tests', kind: 'feature', items: [
    'New QA tab with Run All Tests, Re-run failed only, Download PDF',
    '80 executable tests across Static sanity, Unit, State machines, Validation, SaaS-specific and Integration',
    '8 tests explicitly skipped with reason (real email delivery, server-side auth, N+1 queries, rate limiting, webhook idempotency, async retries, row-level isolation, CVE scans)',
    'Results persist to state; per-test duration and failure message inline',
    'Found and fixed two real bugs during build: playbook phrase-rule needed explicit op=contains; PAGE_TITLES was not on window for extension hooks',
  ]},
  { date: '2026-11-12', phase: 'Phase 8', title: 'Workspace, users, invites, trials', kind: 'feature', items: [
    'New Workspace view with owner controls, trial countdown, four KPIs',
    'Six roles: Owner, Admin, Finance, Legal, IT, Viewer',
    'Invite flow generates a token-encoded link, opens the user\'s mail client with a pre-filled draft',
    'Accept flow at ?invite=<token> with expiry check and idempotency',
    'Owner-protection: owner cannot be deactivated, role-changed or removed',
    'Trial banner across the app when ≤7 days remain, red when expired',
  ]},
  { date: '2026-11-12', phase: 'Phase 7', title: 'Mobile owner inbox', kind: 'feature', items: [
    'Dedicated mobile-first surface for vendor owners',
    'Direct-link mode via ?owner=email — hides the app shell, lands straight in the inbox',
    'Three thumb-sized actions per card: Acknowledge, Renegotiate, Cancel',
    'KPIs for Escalated / Due now / Total; collapsible details per card',
  ]},
  { date: '2026-11-12', phase: 'Phase 6', title: 'Scenario Planner', kind: 'feature', items: [
    'Model Cancel / Downgrade / Renegotiate / Consolidate per vendor; live annual delta',
    'Four KPIs: new annual run-rate, delta, vendor count after, portfolio risk after',
    'Saved scenarios persist; load and compare',
    'PDF export of the full scenario plan',
  ]},
  { date: '2026-11-12', phase: 'Phase 5', title: 'Clause commenting + approval chains', kind: 'feature', items: [
    'New Approvals view with policy editor and pending/approved/rejected lanes',
    'Five seeded rules: ≥₹5L → Finance Manager; ≥₹25L → + CFO; ≥₹1Cr → + CEO; critical risk → Legal; missing DPA → Security',
    'Per-role Approve/Reject on each contract; banner in contract review modal',
    'Per-clause comment threads inside the contract review modal (Finance / Legal / Security / IT / Procurement / Owner)',
  ]},
  { date: '2026-11-12', phase: 'Phase 4', title: 'Renewal Command Center', kind: 'feature', items: [
    'One Monday working surface for renewals in next 30/60/90/120/180 days',
    'Cards grouped by lane: Overdue, Critical (≤14d), Decide soon (≤45d), Upcoming, Will renew, In renegotiation, Downgrading, Cancelling',
    'Each card shows act-by, renewal, owner (with escalation chain), risk, playbook deviations, waste signals',
    'Four actions per card: Renew / Renegotiate / Downgrade / Cancel — decisions persist',
  ]},
  { date: '2026-11-11', phase: 'Phase 3.2', title: 'Dept-weighted risk + Legal review PDF', kind: 'feature', items: [
    'New Risk-weighted spend by department panel in Analytics',
    'Dedicated Legal Review PDF export from Playbook with executive summary, portfolio breakdown, per-vendor deviation cards, compliant-vendors appendix',
  ]},
  { date: '2026-11-11', phase: 'Phase 3.1', title: 'Custom dropdowns + date-range PDF export', kind: 'fix', items: [
    'Replaced native multi-select (invisible options in dark mode on Chrome) with a custom dropdown with search, multi-tick, Done/outside-click commit',
    'Fixed uppercase-leak from .filter-group label cascading into option text',
    'Added date-range picker (30d / 90d / YTD / 12m / all / custom) that feeds Analytics trend charts',
    'PDF export button added to Dashboard, Analytics, Risk, Playbook, Backlog, Team, Insights, Renewals',
    'Fixed Settings modal backdrop + Esc close; wired topbar urgency chips',
  ]},
  { date: '2026-11-11', phase: 'Phase 3', title: 'Analytics, Playbook, de-tiered, vendor navigation', kind: 'feature', items: [
    'Centralised Analytics view with dept donut, monthly/quarterly/annual bars, category and top-vendor breakdowns, 12-month invoice trend',
    'Clause Playbook with per-clause rules, comparators (max/min/phrase), severity, portfolio deviation matrix',
    'All Enterprise gating removed — one tier while in design-partner cohort',
    'Global vendor-click navigation: 201 vendor-name elements wire to the contract review modal',
  ]},
  { date: '2026-11-11', phase: 'Phase 2', title: 'Phase 2: Contract risk engine + bulk OCR + Integration roadmap + Backlog', kind: 'feature', items: [
    'Risk Analytics view with 8-dimension scoring: Financial, Legal, Operational, Functional, Usage, Data & Security, Compliance, Vendor concentration',
    'Portfolio-wide heatmap of missing critical clauses',
    'Bulk contract ingestion with drag-and-drop, Tesseract.js OCR lazy-loaded from CDN for scanned PDFs',
    'Expanded clause taxonomy from 4 to 18 clauses',
    'Industry-aware weighting (BFSI, Healthcare, SaaS, Manufacturing, Public, Retail)',
    'Integration Roadmap with 77 target systems grouped into 13 categories',
    'Owner-only Product Backlog with 14 pre-seeded limitations/bugs/features',
  ]},
  { date: '2026-11-10', phase: 'Phase 1', title: 'Enterprise UI redesign + sample company', kind: 'feature', items: [
    'New design system: Inter font, neutral light theme with dark toggle, sidebar nav',
    '28 realistic vendors with contract terms, licence data, owners',
    '74 invoices across paid / pending / overdue',
    '16-person directory; 29 HRMS connectors catalogued',
    'Non-PII datasheet template with PII guard at import',
  ]},
  { date: '2026-11-10', phase: 'Phase 0', title: 'Rollback from Overcharge Finder rebuild', kind: 'fix', items: [
    'Reverted the 12 Aug rebuild that replaced the full dashboard with a narrower Overcharge Finder',
    'Restored every original feature: subscription dashboard, invoice tracking, renewal calendar, contract term extraction',
    'Main branch now serves the full feature set',
  ]},
];

const DEFAULT_ROADMAP = [
  // --- TIER 1: UNBLOCKS BACKEND + REAL DATA ---
  { id: 'rm-01', theme: 'Backend foundation', status: 'next', title: 'Server tier: Node + Postgres + S3 object storage',
    body: 'Ship the backend that the current client-only app assumes. Users and workspaces become real. All state migrates from localStorage to the API.',
    scope: ['Multi-tenant Postgres with row-level isolation', 'Session + API key auth', 'S3-compatible contract file storage', 'Server-side worker for alerts and renewal computation'], upvotes: 12 },
  { id: 'rm-02', theme: 'Backend foundation', status: 'next', title: 'Real email delivery for invites and alerts',
    body: 'SMTP (Postmark or SES) for invite links, owner alerts and digest emails. Replaces the current mailto drafts.', scope: ['Transactional email template library', 'Unsubscribe + bounce handling', 'Signed acknowledgement links'], upvotes: 10 },
  { id: 'rm-03', theme: 'Backend foundation', status: 'next', title: 'Real OAuth for the first five connectors',
    body: 'Convert the simulated connect flow into real OAuth for Okta, Google Workspace, Microsoft Entra ID, Slack and QuickBooks. Keep the client UI identical; swap the handler.',
    scope: ['OAuth app registration per provider', 'Token refresh and encrypted storage', 'Scheduled sync worker (every 6 hours)', 'Error recovery on expired tokens'], upvotes: 15 },

  // --- TIER 2: ENTERPRISE READINESS ---
  { id: 'rm-04', theme: 'Enterprise readiness', status: 'planned', title: 'Multi-entity / group company dimension',
    body: 'Group companies with multiple legal entities need spend rolled up per entity. Currently single-tenant per workspace.', scope: ['Legal entity field on every subscription and invoice', 'Entity-level rollup in Analytics', 'Approval policy rules scoped per entity'], upvotes: 7 },
  { id: 'rm-05', theme: 'Enterprise readiness', status: 'planned', title: 'Audit log view',
    body: 'Immutable audit log of every meaningful action (approvals, decisions, data exports). Already captured in state; needs a surface + SIEM forward.',
    scope: ['Audit log UI with filter + search', 'JSON export for SIEM', 'Signed webhooks for critical events'], upvotes: 5 },
  { id: 'rm-06', theme: 'Enterprise readiness', status: 'planned', title: 'Tunable risk weights per customer',
    body: 'Risk-engine weights are currently static. Customers (especially BFSI) will want to override — e.g. weight liability cap higher than vendor concentration.',
    scope: ['Weight editor in Settings', 'Per-dimension weight slider', 'Industry defaults preserved as presets'], upvotes: 4 },
  { id: 'rm-07', theme: 'Enterprise readiness', status: 'planned', title: 'SSO for Login (SAML 2.0 / OIDC)',
    body: 'Customer logs in with their own Okta / Entra ID / Google Workspace; SCIM for provisioning.',
    scope: ['SAML 2.0 service provider', 'SCIM 2.0 user and group provisioning', 'Role mapping from IdP groups'], upvotes: 8 },

  // --- TIER 3: PRODUCT DEPTH ---
  { id: 'rm-08', theme: 'Product depth', status: 'planned', title: 'Vendor contact book',
    body: 'Capture rep name, direct email, phone, last outreach date, renewal notes per vendor. Renewals become context-rich conversations.',
    scope: ['Contact table on each subscription', 'Last-outreach timestamp', 'Pre-filled renegotiation email templates'], upvotes: 6 },
  { id: 'rm-09', theme: 'Product depth', status: 'planned', title: 'Price benchmarking across the cohort',
    body: '"What others pay" benchmarks for each vendor. Needs opt-in anonymised data sharing across the design-partner base.',
    scope: ['Opt-in benchmark participation', 'Anonymised quarterly medians per vendor', 'Benchmark line on contract review'], upvotes: 9 },
  { id: 'rm-10', theme: 'Product depth', status: 'shipped', title: 'AI chat on the whole contract corpus',
    body: 'Shipped in Phase 12 — text and voice Q&A grounded in your own data, 14 intent patterns, clickable source trail. Next: semantic search across full contract text via embeddings when the server tier ships.',
    scope: ['Shipped: 14 intents, text + voice, grounded citations, chat history', 'Next: embeddings over ingested contract PDFs', 'Next: role-aware answers (Finance sees spend, Legal sees terms)'], upvotes: 15 },
  { id: 'rm-18', theme: 'Product depth', status: 'planned', title: 'ElevenLabs voice (BYOK) for multilingual soothing replies',
    body: 'Ask Track replies through ElevenLabs Multilingual v2 — 29+ languages including 9 Indian languages, far less robotic than browser Web Speech. BYOK pattern so each workspace uses their own free tier (10k chars/month). Full managed experience ships once the server tier lands and we can proxy the API without exposing keys.',
    scope: ['Settings → Voice pane: API key input, voice picker from the user\'s ElevenLabs library, language selector', 'Streaming audio for low-latency playback', 'Keep browser native SpeechRecognition for STT (already multilingual + free)', 'Test voice button', 'Fall back to current Web Speech when no key is set', 'Post-backend: proxy all requests through server, one managed voice service for all workspaces, GST-billed as part of the plan'], upvotes: 8 },
  { id: 'rm-17', theme: 'Product depth', status: 'shipped', title: 'Licence forecasting (capacity planning)',
    body: 'Shipped in Phase 13 — quarterly demand model per vendor with org/dept growth, utilisation target and confidence buffer.',
    scope: ['Shipped: per-vendor Q+1 to Q+4 demand, cost impact, portfolio curve', 'Next: Rippling / BambooHR hooks to pull live headcount into the capacity plan', 'Next: confidence intervals, not single-point estimates'], upvotes: 10 },
  { id: 'rm-11', theme: 'Product depth', status: 'exploring', title: 'Cancellation letter generator',
    body: 'Pre-drafted cancellation notices per vendor jurisdiction, formatted for delivery (email, courier, in-app). Vendor-specific signing requirements captured.',
    scope: ['Template library per vendor', 'Jurisdiction-specific legal language', 'DocuSign send integration'], upvotes: 3 },

  // --- TIER 4: GROWTH / COMMERCIAL ---
  { id: 'rm-12', theme: 'Commercial', status: 'planned', title: 'Public site + pricing calculator',
    body: 'Expand the marketing site with a pricing calculator that outputs a rough quote per employee count or vendor count. Adds a changelog page.',
    scope: ['Per-vendor-count tier table', 'Employee-count-based calculator', 'Public changelog page synced from the in-app changelog'], upvotes: 4 },
  { id: 'rm-13', theme: 'Commercial', status: 'planned', title: 'Distributor one-pager PDF',
    body: 'Export a branded one-pager for the distributor to hand to prospects. Summary + on-prem claim + one screenshot + trial link.', scope: ['Single-page PDF generated from the current product', 'Customisable with prospect name', 'QR code to a prospect-specific trial'], upvotes: 2 },
  { id: 'rm-14', theme: 'Commercial', status: 'exploring', title: 'In-app upgrade + billing (Razorpay)',
    body: 'When trials end, convert in-app. Razorpay subscription billing with GST invoices.',
    scope: ['Razorpay subscription setup', 'GST-compliant invoices', 'Plan change / downgrade flow'], upvotes: 5 },

  // --- TIER 5: COLLABORATION + MOBILE ---
  { id: 'rm-15', theme: 'Collaboration', status: 'planned', title: 'Microsoft Teams + Slack 2-way',
    body: 'Receive owner acknowledgements from Teams/Slack buttons instead of in-app. Slack already sends; Teams adaptive cards needed.',
    scope: ['Teams adaptive card for alerts', 'Slack interactive buttons for Acknowledge/Escalate', 'Bidirectional link between the message and the in-app alert'], upvotes: 7 },
  { id: 'rm-16', theme: 'Collaboration', status: 'exploring', title: 'Native mobile app (iOS + Android)',
    body: 'The current mobile owner surface is a responsive view. A real app gets push notifications and biometric auth.',
    scope: ['React Native shell reusing the web components', 'APNs + FCM push', 'Biometric unlock'], upvotes: 3 },
];

/* ---------------- State ---------------- */
function changelog() { state.settings.changelog = state.settings.changelog || CHANGELOG; return state.settings.changelog; }
function roadmap() { state.settings.roadmap = state.settings.roadmap || DEFAULT_ROADMAP; return state.settings.roadmap; }
function upvotedSet() { state.settings.upvotedRoadmap = state.settings.upvotedRoadmap || {}; return state.settings.upvotedRoadmap; }

/* ---------------- Render ---------------- */
function renderChangelogRoadmap() {
  const host = document.getElementById('cr-body'); if (!host) return;
  const tab = state.settings.crTab || 'changelog';

  host.innerHTML = `
    <div class="cr-tabs">
      <button class="cr-tab ${tab === 'changelog' ? 'active' : ''}" data-cr-tab="changelog">Release notes <span class="badge">${changelog().length}</span></button>
      <button class="cr-tab ${tab === 'roadmap' ? 'active' : ''}" data-cr-tab="roadmap">Roadmap <span class="badge">${roadmap().length}</span></button>
      <div style="margin-left:auto;display:flex;gap:6px">
        ${tab === 'changelog' ? '<button class="icon-btn" id="cl-add">+ Add release</button>' : '<button class="icon-btn" id="rm-add">+ Add item</button>'}
        <button class="icon-btn" data-pdf-export="cr-body" data-pdf-title="${tab === 'changelog' ? 'Release notes' : 'Roadmap'}">Download PDF</button>
      </div>
    </div>
    ${tab === 'changelog' ? renderChangelogBody() : renderRoadmapBody()}
  `;

  host.querySelectorAll('[data-cr-tab]').forEach(b => b.onclick = () => { state.settings.crTab = b.dataset.crTab; save(); renderChangelogRoadmap(); });
  if (tab === 'changelog') wireChangelog(host);
  else wireRoadmap(host);
}

function renderChangelogBody() {
  const items = changelog();
  // Group by month
  const groups = {};
  items.forEach(it => { const m = it.date.slice(0, 7); (groups[m] ||= []).push(it); });
  return `<div class="cl-wrap">
    ${Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0])).map(([m, rows]) => {
      const label = new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return `<section class="cl-month"><h3>${label}</h3>
        ${rows.map(r => `<article class="cl-entry cl-kind-${r.kind}" data-cl-id="${r.date + '-' + r.phase}">
          <div class="cl-head">
            <div>
              <div class="cl-date">${new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · <span class="cl-phase">${escapeHtml(r.phase)}</span></div>
              <h4>${escapeHtml(r.title)}</h4>
            </div>
            <span class="badge ${r.kind === 'fix' ? 'warn' : r.kind === 'feature' ? 'ok' : 'info'}">${r.kind}</span>
          </div>
          <ul>${r.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
        </article>`).join('')}
      </section>`;
    }).join('')}
  </div>`;
}

function renderRoadmapBody() {
  const items = roadmap();
  const themes = {};
  items.forEach(it => { (themes[it.theme] ||= []).push(it); });
  const upvoted = upvotedSet();
  return `<div class="rm-wrap">
    ${Object.entries(themes).map(([theme, rows]) => `<section class="rm-theme">
      <h3>${escapeHtml(theme)} <span class="badge">${rows.length}</span></h3>
      <div class="rm-grid">${rows.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).map(r => `
        <div class="rm-card rm-status-${r.status}" data-rm-id="${r.id}">
          <div class="rm-card-head">
            <span class="badge ${r.status === 'next' ? 'info' : r.status === 'planned' ? '' : 'warn'}">${r.status === 'next' ? 'Up next' : r.status === 'planned' ? 'Planned' : 'Exploring'}</span>
            <button class="rm-vote ${upvoted[r.id] ? 'voted' : ''}" data-rm-vote="${r.id}" title="Vote this up"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg> ${(r.upvotes || 0)}</button>
          </div>
          <h4>${escapeHtml(r.title)}</h4>
          <p>${escapeHtml(r.body)}</p>
          ${r.scope?.length ? `<details class="rm-scope"><summary>Scope</summary><ul>${r.scope.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul></details>` : ''}
          <div class="rm-foot">
            <select class="rm-status-select" data-rm-status="${r.id}">
              ${['next','planned','exploring','shipped','deferred'].map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s === 'next' ? 'Up next' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
            </select>
            <button class="link" data-rm-remove="${r.id}">Remove</button>
          </div>
        </div>`).join('')}</div>
    </section>`).join('')}
  </div>`;
}

function wireChangelog(host) {
  host.querySelectorAll('[data-cl-id]').forEach(el => { /* reserved for future detail view */ });
  const addBtn = document.getElementById('cl-add');
  if (addBtn) addBtn.onclick = () => {
    const title = prompt('Release title:'); if (!title) return;
    const phase = prompt('Phase or label (e.g. "Phase 12", "Fix"):', 'Patch') || 'Patch';
    const kind = prompt('Kind: feature / fix / breaking', 'feature') || 'feature';
    const body = prompt('Bullet points, separated by |', '');
    const items = (body || '').split('|').map(s => s.trim()).filter(Boolean);
    const d = new Date().toISOString().slice(0, 10);
    state.settings.changelog = [{ date: d, phase, title, kind, items }, ...changelog()];
    save(); renderChangelogRoadmap();
    toast('Release logged.', 'success');
  };
}

function wireRoadmap(host) {
  host.querySelectorAll('[data-rm-vote]').forEach(b => b.onclick = () => {
    const id = b.dataset.rmVote;
    const u = upvotedSet();
    const item = roadmap().find(x => x.id === id);
    if (!item) return;
    if (u[id]) { item.upvotes = Math.max(0, (item.upvotes || 0) - 1); delete u[id]; }
    else { item.upvotes = (item.upvotes || 0) + 1; u[id] = new Date().toISOString(); }
    state.settings.upvotedRoadmap = u;
    save(); renderChangelogRoadmap();
  });
  host.querySelectorAll('[data-rm-status]').forEach(sel => sel.addEventListener('change', () => {
    const id = sel.dataset.rmStatus; const item = roadmap().find(x => x.id === id);
    if (!item) return; item.status = sel.value; save(); renderChangelogRoadmap();
  }));
  host.querySelectorAll('[data-rm-remove]').forEach(b => b.onclick = () => {
    if (!confirm('Remove this roadmap item?')) return;
    state.settings.roadmap = roadmap().filter(x => x.id !== b.dataset.rmRemove);
    save(); renderChangelogRoadmap();
  });
  const addBtn = document.getElementById('rm-add');
  if (addBtn) addBtn.onclick = () => {
    const title = prompt('Roadmap item title:'); if (!title) return;
    const theme = prompt('Theme:', 'Product depth') || 'Product depth';
    const body = prompt('One-line description:', '') || '';
    const scope = (prompt('Scope bullets, separated by |', '') || '').split('|').map(s => s.trim()).filter(Boolean);
    const status = prompt('Status: next / planned / exploring', 'planned') || 'planned';
    state.settings.roadmap = [{ id: 'rm-cus-' + crypto.randomUUID().slice(0, 6), theme, status, title, body, scope, upvotes: 0 }, ...roadmap()];
    save(); renderChangelogRoadmap();
    toast('Roadmap item added.', 'success');
  };
}

/* ---------------- View + nav ---------------- */
function ensureChangelogView() {
  if (document.getElementById('changelog')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'changelog'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head"><div><h2>Changelog &amp; roadmap</h2><p class="page-sub">Everything shipped so far, and what's next. Both are maintained in-product so the whole team sees the latest.</p></div></div>
    <div id="cr-body"></div>
  `;
  main.appendChild(section);
}
function ensureChangelogNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const workspaceGroup = [...groups].find(g => g.querySelector('[data-view="integrations"]')) || [...groups][groups.length-1];
  if (!workspaceGroup || workspaceGroup.querySelector('[data-view="changelog"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'changelog';
  btn.innerHTML = `${svg}<span>Changelog &amp; roadmap</span>`;
  workspaceGroup.appendChild(btn);
  btn.addEventListener('click', () => switchView('changelog'));
}
function patchSwitchViewForChangelog() {
  if (window._crSwitchPatched) return;
  const _orig = window.switchView;
  window.switchView = function (name, opts = {}) {
    if (name === 'changelog') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0 });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Changelog & roadmap';
      if (!opts.replaceHistory) {
        const target = '#changelog';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._crSwitchPatched = true;
}

/* Hook renderAll */
const _prevAll12 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll12) {
  window.renderAll = function () {
    _prevAll12();
    try {
      ensureChangelogView();
      ensureChangelogNav();
      patchSwitchViewForChangelog();
      renderChangelogRoadmap();
    } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureChangelogView();
      ensureChangelogNav();
      patchSwitchViewForChangelog();
      renderChangelogRoadmap();
    } catch (_) {}
  }, 550);
});
