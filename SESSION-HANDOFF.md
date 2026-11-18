# SaaS Spend Track — Session Handoff (context for a new chat)

Paste or attach this file at the start of a new chat to carry full context.
Last updated: 2026-11-18.

## What the project is
**SaaS Spend Track** — a SaaS spend + contract-management product.
- **App (product):** https://app.saasspendtrack.com — single-file HTML SPA.
- **Marketing site:** https://saasspendtrack.com
- **Owner:** Vinay Raghavendran / **Whizzlead Solutions OPC Private Limited** (no parens). Director & signatory: **Raghavendran Vittal**. Phone: **+91 91684 81989**. Based in Chennai.
- Data lives in the browser (localStorage) for the current tier; AI features call Cloudflare Pages Functions.

## Repos & deploy
- **App repo:** `vinayraghavendran16/...` → working copy `/home/claude/saasspendtrack-tool/`. Entry point is `index.html` (one big file, ~36 inline `<script>` blocks). Auto-deploys from `main` via **Cloudflare Pages** to app.saasspendtrack.com.
  - Backend: `functions/api/*.js` (Cloudflare Pages Functions, same-origin). Current endpoints: `extract.js` (AI contract extraction, PDF-native), `ask.js` (Ask Track), `renewal-guide.js` (source-grounded guides via web search), `sheet-csv.js` (Google Sheet fetch), `clm-sync.js` (generic authenticated REST proxy for connectors).
  - Env var **ANTHROPIC_API_KEY** is set in Cloudflare. `EXTRACT_MODEL` optional override; otherwise auto-discovers newest Sonnet.
  - Pre-generated renewal guides are static JSON in `/guides/*.json` (12 vendors) + `/guides/index.json`. Regenerate with `node scripts/gen-guides.mjs`.
- **Website repo:** `vinayraghavendran16/saasspendtrack-website` → `/home/claude/saasspendtrack-website/`. Static multi-page site, auto-deploys from `main` via Cloudflare Pages.
  - **PR #2 is OPEN** (branch `feat/governance-and-new-modules`): adds the new app modules as marketing sections + a visual Governance spotlight, and fixes the international Pay link. **Needs merge to go live.**

## Everything built in this session (all app changes are LIVE on main)
- Command Centre: first-run hub, **13 working ingestion/setup paths** (no stubs): individual/bulk/folder contract upload, copy-paste, CLM import, Google Sheet import, accounting import, SSO app discovery, expense-CSV shadow-tool discovery, invoice import, team directory, workspace setup, InfoSec.
- AI contract extraction (text + PDF-native) with regex fallback; Ask Track AI (hybrid, global via top bar / mobile pill / Cmd-K).
- Official MSA links per vendor + signed-MSA upload with clause-source tagging.
- Contract upload: persistence, exact+name dedupe, processing indicator, original-PDF download (IndexedDB).
- **PDF font-garble auto-repair** (`degarbleText`): recovers constant-offset-shifted PDF text layers before clause extraction.
- **Shadow-IT discovery** from an expense/card CSV (~80 SaaS signatures).
- **Renewal Guides** module: source-grounded, cited, "not verified" flags; 12 pre-generated vendor guides.
- **CLM connectors** (12: SpotDraft, Ironclad, Juro, LinkSquares, Concord, Conga, Agiloft, DocuSign CLM, Gatekeeper, ContractWorks, Icertis, Sirion). CSV import + direct API sync via `/api/clm-sync` (user supplies token; base URL/endpoint are editable hints, nothing fabricated).
- **Accounting connectors** (QuickBooks, Xero, NetSuite, Zoho Books, Tally, FreshBooks, Sage) → feed invoice importer.
- **SSO connectors** (Okta, Google Workspace, Entra ID, OneLogin, JumpCloud) → app discovery.
- **Reporting module**: cross-functional pivot (metric × dimension × date range), 9 persona presets (CFO/CRO/IT/Procurement/InfoSec), CSV export. Department resolves explicit field → owner's directory dept → team.
- **InfoSec module**: per-vendor 10-item security checklist, status, data classification, owner, annual review dates; GRC connectors (Vanta, Drata, Secureframe, OneTrust, SecurityScorecard, Whistic, UpGuard).
- **Vendors tab** (governance register): department, why/when procured, 4-function approval badges (InfoSec/Legal/Procurement/Finance), next review.
- **Full-screen vendor editor**: all parameters incl. internal stakeholders (InfoSec/Legal/Procurement contacts from team directory), vendor AE/CSM contact, procurement reason/date, approvals + reviews. Fixed a latent bug where saving wiped infosec/contactBook/PDF data (now spreads existing record).
- **Explicit department / cost-center field** (hybrid with owner-derived fallback), in the form and CSV importers.
- Dashboard: **Notice windows moved to top**; dark-mode contrast fixes across new modules (they'd used undefined `--card`/`--bg-soft` vars — now defined for both themes).
- Workspace setup: company, domain, fiscal year, default renewal-notice window.
- QA harness: dynamic SKIP support; demo-only integration tests skip on blank workspace. Current: **138 pass / 0 fail / 11 skip** (8 need backend, 3 demo-data-dependent).
- **Razorpay International USD page wired** (`rzp.io/rzp/MhqdtN2a`) in app + website (India stays `rzp.io/rzp/NCGW9GyD`).
- **IP/TM dossier updated to v1.1** (`/home/claude/pdfgen/ip_filing_doc.py` → `SaaSSpendTrack_IP_Filing_Dossier.pdf`): new modules in Sections 2/4/7/11, entity name fixed to no-parens.
- Docs refreshed: `README.md`, `UAT.md`, `VINAY-TODO.md`.

## Current to-do (Vinay's part)
- **P1:** set `SUPPORT_PHONE` in Apps Script config; set up Razorpay `payment.captured` webhook (then ask Claude to wire the `doPost` branch — Apps Script can't read the signature header, so use a `?token=<secret>` on the `/exec` URL).
- **Merge website PR #2.**
- **P1.5 launches:** directory listings (G2, Capterra, AlternativeTo, Product Hunt, StackShare, Slant), distribution (Show HN, Reddit, 4 weeks LinkedIn, Indian SaaS media), assets (og-image 1200x630, 5-6 screenshots, founder headshot, first customer logo/testimonial).
- **P2 polish:** PWA icon PNGs (from `icon.svg`), `vinay@saasspendtrack.com` email forwarding, update footer address Bengaluru → Chennai.
- Full to-do: `VINAY-TODO.md` in the app repo. Done items (incl. both original P0s, LUT filed, REPLY_TO set, international pay) are archived there.

## Open questions / decisions pending
- **Registered office:** IP dossier + website footer say "Bengaluru". Vinay is personally in Chennai; unconfirmed whether Whizzlead's *registered office* moved. Confirm before changing the legal doc.
- Offer standing: wire the AI backend into the **global** Ask Track modal (currently the full Ask Track page uses `/api/ask`; the global Cmd-K modal uses the local rules engine).
- Whether to add more connectors to any gallery.

## Working constraints & preferences
- **No em dashes** in writing.
- Private (never publish): `vinayraghavendran16@gmail.com`.
- Legal entity name: **Whizzlead Solutions OPC Private Limited** (no parentheses). Signatory: Raghavendran Vittal.
- Git: branch before pushing if on default; end commit messages with the Co-Authored-By: Claude + Claude-Session lines; end PR bodies with the Generated-with-Claude-Code line.
- **Cloudflare cache:** after a deploy, hard-refresh (Cmd/Ctrl+Shift+R) — the browser serves the old build otherwise (hit this repeatedly).
- Verify changes live in the built-in browser; mutate state in-memory for tests and restore without `save()` so the real workspace isn't polluted.
