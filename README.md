# SaaS Spend Track

Every SaaS subscription and contract, in one place. Built for Indian and APAC mid-market.

**Live**: https://app.saasspendtrack.com · **Marketing**: https://saasspendtrack.com
**Artifact mirror**: https://claude.ai/artifact/VYKSe4Z2MnHAtxrJVLE7k5

Browser-only app, no backend, state in localStorage. On-prem available for BFSI, healthcare and other regulated industries.

## What's in it

**Command Centre (onboarding hub)**
- First landing page for new workspaces: 13 guided ingestion and setup paths
- Load individual contracts, bulk drop, copy-paste, import a folder of PDFs
- Connect a CLM (12 tools: SpotDraft, Ironclad, Juro, LinkSquares, Concord, Conga, Agiloft, DocuSign CLM, Gatekeeper, ContractWorks, Icertis, Sirion) via CSV export or direct API sync
- Import a Google Sheet (server-side fetch, no CORS), connect accounting (QuickBooks, Xero, NetSuite, Zoho Books, Tally, FreshBooks, Sage)
- Discover shadow tools from an expense/card CSV; discover apps via SSO (Okta, Google Workspace, Entra ID, OneLogin, JumpCloud)
- Import invoices, add the team directory, set up the workspace (fiscal year, default notice window)

**Governance**
- **Vendors tab** - the governance register: every vendor with department, why/when procured, approval status (InfoSec / Legal / Procurement / Finance), and next review
- **InfoSec module** - per-vendor security reviews: 10-item onboarding checklist, status, data classification, owner, annual re-review dates; connects to GRC tools (Vanta, Drata, Secureframe, OneTrust, SecurityScorecard, Whistic, UpGuard)
- **Full-screen vendor editor** - all parameters: internal stakeholders (InfoSec/Legal/Procurement contacts mapped from the team directory), vendor AE/CSM contact, procurement reason and date, approvals and reviews
- **Reporting** - cross-functional pivot (CFO/CRO/IT/Procurement/InfoSec): metric × split (department/team/function/tool/owner/InfoSec status/month/quarter) × date range, with filters, 9 persona presets, and CSV export
- **Renewal Guides** - curated, source-grounded vendor renewal/cancellation playbooks built from live web search with citations and unverified-fact flagging

**Spend management**
- Dashboard (notice windows surfaced at top), Analytics, Insights
- Invoice tracking with OCR ingestion
- Explicit department / cost-center field per tool (overrides owner-derived department in reports)
- Spend by department, category, vendor, any time window
- 12-month trend charts

**Contract intelligence**
- Bulk upload with OCR for scanned PDFs (Tesseract.js)
- AI contract extraction via `/api/extract` (Anthropic, PDF-native) with regex fallback
- Auto-repair of constant-offset PDF font garble (shifted text layers recovered before extraction)
- Duplicate detection (exact source hash + per-vendor), original-PDF download, processing indicator
- Official MSA links per vendor + signed-MSA upload with clause-source tagging
- 8-dimension risk engine: Financial / Legal / Operational / Functional / Usage / Data / Compliance / Vendor concentration
- Clause playbook with deviation scoring, industry weighting
- Legal review PDF export

**Renewals and workflow**
- Renewal Command Center with 8 lanes (overdue, critical, decide soon, upcoming, renewing, renegotiating, downgrading, cancelling)
- Approval chains (Finance / CFO / CEO / Legal / Security) with 5 seeded policy rules
- Per-clause comment threads inside the contract review modal
- Scenario Planner: cancel / downgrade / renegotiate / consolidate with annual $ impact
- Mobile owner inbox with direct-link mode

**AI and forecasting**
- **Ask Track** - natural-language Q&A with 20 intents over vendors, contracts, invoices, licences, departments
- Voice input via Web Speech API (en-IN + 11 other languages)
- Voice replies with Indian female voice preference, Natural/Neural voice picker
- Fuzzy vendor matching (hotspot → HubSpot) via Levenshtein
- Cmd+K global command palette with suggestions
- **Licence Forecast** - capacity planning model projects Q+1 to Q+4 demand per vendor with headcount growth, utilisation target, confidence buffer

**Workspace**
- 6 roles (Owner/Admin/Finance/Legal/IT/Viewer), invite tokens
- 14-day trial with real expiry enforcement (gate blocks app, read-only mode preserves data)
- Workspace, users, invites, trials
- Data Sources: 44 connectors across 5 phases (SSO, direct API, finance, unified API, Chrome extension)

**Sales enablement**
- Distributor one-pager PDF (branded A4 with prospect personalisation and QR code)
- Three demo seed presets: Indian SaaS startup, Mid-market BFSI, Manufacturing - one-click load between prospects
- Vendor contact book with AE/CSM details, outreach tracking, pre-drafted renewal emails
- Trial reset / force-expire / mark-paid controls for clean demo cycles

**Everything else**
- In-app Changelog + Roadmap with per-item upvote counter
- In-browser QA harness: 149 tests (141 executable, 8 need backend); 100% of applicable tests pass (data-dependent integration tests skip gracefully on a blank workspace)
- PDF export on every quantitative view
- Light/dark mode with comprehensive contrast handling
- Fully mobile-responsive

## Pricing

**$3,499/year** flat. Indian customers: 18% GST added at checkout. Includes 250 active contracts, unlimited users, every feature. $100/year per 50 additional contracts above 250. On-prem deployment available at the same price. Billed in USD (international) or INR + GST (India) via geo-routed Razorpay payment pages.

## Architecture

Single-page vanilla JS, no framework. Modular `extensions*.js` files wrap `renderAll()` to add features without touching the base app.

```
app.js               Base: state, rendering, sample data, 28 vendors
extensions.js        Risk engine, bulk OCR, integration roadmap, owner backlog
extensions2.js       Analytics, playbook, vendor-click navigation
extensions3.js       Custom multiselect, date range, PDF export, bug sweep
extensions4.js       Dept-weighted risk, Legal review PDF
extensions5.js       Renewal Command Center
extensions6.js       Approvals + clause commenting
extensions7.js       Scenario Planner
extensions8.js       Mobile owner inbox
extensions9.js       Workspace, users, invites, trials
extensions10.js      QA test harness (88 base tests)
extensions11.js      Data Sources (44 connectors)
extensions12.js      Changelog + Roadmap view
extensions13.js      Ask Track (text + voice Q&A, Cmd+K palette)
extensions14.js      Licence Forecasting
extensions15.js      Universal download bridge (artifact + hosted)
extensions16.js      Distributor one-pager
extensions17.js      Trial expiry enforcement
extensions18.js      Demo seed-data switcher
extensions19.js      Vendor contact book
extensions20.js      QA tests for Phases 22-25
```

State lives on `window.state` → `{ subscriptions, invoices, employees, alertLog, settings }`. Persisted to localStorage on every `save()`.

New views register via `switchView` monkey-patching. New tabs register via `window.PAGE_TITLES`.

## Running locally

```bash
# Static serve
python3 -m http.server 8000
# Open http://localhost:8000
```

Or open `index.html` directly in a browser (works because everything is local).

## Bundling for single-file deploy

```bash
cd /home/claude && python3 bundle.py
# Writes saasspendtrack_app.html with everything inlined
```

## Hosting

Production is on **Cloudflare Pages** at `app.saasspendtrack.com`, auto-deployed from `main` on every push. Setup files in the repo:
- `wrangler.toml` - static-assets config with SPA fallback
- `_headers` - security headers (Permissions-Policy allows microphone, strict cache for assets, no-cache for HTML)
- `_redirects` - SPA fallback

## Testing

```bash
# Automated headless suite
node /home/claude/run_qa.js
# → 141 executable; 100% of applicable tests pass (integration tests that need
#   the demo dataset skip on a blank workspace)
```

Or open the **QA tests** view in the running app and click **Run All Tests**.

UAT scenarios: see [UAT.md](UAT.md).

## Hosting-related docs

- `README-hosting.md` - Cloudflare Pages setup walkthrough
- `OnPrem_System_Requirements_Guide.pdf` (in distributor dossier) - on-prem requirements
- `India_IP_Trademark_Costs_Timelines.pdf` - IP filing costs and timelines
- `SaaSSpendTrack_IP_Filing_Dossier.pdf` - complete IP dossier

## Current version

Updated 18 Nov 2026. Since Phase 25: Command Centre, Reporting, InfoSec, Vendors tab, full-screen vendor editor, CLM/accounting/SSO/GRC connectors, Renewal Guides, shadow-IT discovery, PDF font-garble auto-repair, explicit department field. See the in-app **Changelog** view for the full history.

## Who's building this

Whizzlead Solutions OPC Private Limited. Director: Raghavendran Vittal. Product and GTM: Vinay Raghavendran. Based in Chennai.

Contact: +91 91684 81989
