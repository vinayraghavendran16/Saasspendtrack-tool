# SaaS Spend Track

Every SaaS subscription and contract, in one place. Built for Indian and APAC mid-market.

**Live**: https://app.saasspendtrack.com · **Marketing**: https://saasspendtrack.com
**Artifact mirror**: https://claude.ai/artifact/VYKSe4Z2MnHAtxrJVLE7k5

Browser-only app, no backend, state in localStorage. On-prem available for BFSI, healthcare and other regulated industries.

## What's in it

**Spend management**
- Dashboard, Analytics, Insights
- Invoice tracking with OCR ingestion
- Spend by department, category, vendor, any time window
- 12-month trend charts

**Contract intelligence**
- Bulk upload with OCR for scanned PDFs (Tesseract.js)
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
- **Ask Track** — natural-language Q&A with 20 intents over vendors, contracts, invoices, licences, departments
- Voice input via Web Speech API (en-IN + 11 other languages)
- Voice replies with Indian female voice preference, Natural/Neural voice picker
- Fuzzy vendor matching (hotspot → HubSpot) via Levenshtein
- Cmd+K global command palette with suggestions
- **Licence Forecast** — capacity planning model projects Q+1 to Q+4 demand per vendor with headcount growth, utilisation target, confidence buffer

**Workspace**
- 6 roles (Owner/Admin/Finance/Legal/IT/Viewer), invite tokens
- 14-day trial with real expiry enforcement (gate blocks app, read-only mode preserves data)
- Workspace, users, invites, trials
- Data Sources: 44 connectors across 5 phases (SSO, direct API, finance, unified API, Chrome extension)

**Sales enablement**
- Distributor one-pager PDF (branded A4 with prospect personalisation and QR code)
- Three demo seed presets: Indian SaaS startup, Mid-market BFSI, Manufacturing — one-click load between prospects
- Vendor contact book with AE/CSM details, outreach tracking, pre-drafted renewal emails
- Trial reset / force-expire / mark-paid controls for clean demo cycles

**Everything else**
- In-app Changelog + Roadmap with per-item upvote counter
- In-browser QA harness: 124 tests (116 pass / 0 fail / 8 skip)
- PDF export on every quantitative view
- Light/dark mode with comprehensive contrast handling
- Fully mobile-responsive

## Pricing

**$3,000/year** flat. Includes 250 active contracts, unlimited users, every feature. $100/year per 50 additional contracts above 250. On-prem deployment available at the same price.

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
- `wrangler.toml` — static-assets config with SPA fallback
- `_headers` — security headers (Permissions-Policy allows microphone, strict cache for assets, no-cache for HTML)
- `_redirects` — SPA fallback

## Testing

```bash
# Automated headless suite
node /home/claude/run_qa.js
# → PASS 116 / FAIL 0 / SKIP 8
```

Or open the **QA tests** view in the running app and click **Run All Tests**.

UAT scenarios: see [UAT.md](UAT.md).

## Hosting-related docs

- `README-hosting.md` — Cloudflare Pages setup walkthrough
- `OnPrem_System_Requirements_Guide.pdf` (in distributor dossier) — on-prem requirements
- `India_IP_Trademark_Costs_Timelines.pdf` — IP filing costs and timelines
- `SaaSSpendTrack_IP_Filing_Dossier.pdf` — complete IP dossier

## Current version

Phase 25 shipped 12 Nov 2026. See the in-app **Changelog** view for the full history.

## Who's building this

Whizzlead Solutions (OPC) Private Limited, HSR Layout, Bengaluru. Director: Raghavendran Vittal. Product and GTM: Vinay Raghavendran.

Contact: vinay@saasspendtrack.com
