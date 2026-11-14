# SaaS Spend Track — UAT Scenarios

Last updated: 12 Nov 2026 · Phase 25 · Covers tool + marketing site.

**Environment**: https://app.saasspendtrack.com (production) or /home/claude/saasspendtrack_app.html (local bundle).

For each scenario below, run the steps top to bottom. Record pass/fail in the right column. Any fail becomes a new task.

Automated regression: `node /home/claude/run_qa.js` runs 124 in-browser tests headlessly. Currently **116 pass / 0 fail / 8 skip** (skips need a real backend).

---

## 1. First-run flow (Fresh user)

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 1.1 | Open https://app.saasspendtrack.com for the first time | Dashboard loads with Acme Corp sample data, 28 vendors visible |  |
| 1.2 | Topbar shows "Ask Track" search bar with ⌘K chip | Bar is visible to the right of the breadcrumb, placeholder reads "Ask Track…" |  |
| 1.3 | Click through the top 3 KPIs (monthly spend, annual run-rate, upcoming renewals) | Numbers render, no NaN or blanks |  |
| 1.4 | Click **Subscriptions** in sidebar | List of 28 vendors renders, sortable columns |  |
| 1.5 | Click any vendor row | Contract review modal opens with contract text extraction, risk score, approval banner, playbook deviations, clause comments, and vendor contact pane |  |
| 1.6 | Close modal with Esc | Modal closes; focus returns to vendor list |  |
| 1.7 | Toggle dark mode (sun/moon icon in topbar) | All text remains legible, no blank cells, no white-on-white buttons |  |

## 2. Distributor demo cycle (BFSI prospect)

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 2.1 | Sidebar → **Demo presets** | Four preset cards: Acme Corp, Indian SaaS startup, Mid-market BFSI, Manufacturing |  |
| 2.2 | Click "Load this preset" on **Mid-market BFSI** → confirm | Workspace reloads with Vaidya Capital data: 26 vendors, 420 employees, Mumbai |  |
| 2.3 | Current preset card shows "Loaded" badge | Visual confirmation |  |
| 2.4 | Dashboard reflects BFSI tools (Oracle, SAP, Splunk, Okta, CrowdStrike, Bloomberg Terminal, Thomson Reuters) | Vendor list is now BFSI-flavoured |  |
| 2.5 | Sidebar → **Risk analytics** | 8-dimension risk shows higher scores for BFSI compliance signals |  |
| 2.6 | Sidebar → **Plans** → scroll to **Workspace status** panel | Trial dev controls visible: Reset / Force expire / Mark paid |  |
| 2.7 | Click **Reset to fresh 14-day trial** → confirm | Banner at top reads "14 days left in your trial" |  |

## 3. Trial expiry gate

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 3.1 | Sidebar → **Plans** → **Force expire (demo)** | Full-screen "Trial expired" gate overlays everything |  |
| 3.2 | Try to click anywhere outside the gate | Only the three buttons on the gate are interactive |  |
| 3.3 | Click **Start a fresh 14-day trial** → confirm | Gate closes, 14-day banner reappears at top |  |
| 3.4 | Repeat 3.1, then click **View your data (read-only)** | Gate closes, spend figures blur with lock icon |  |
| 3.5 | Reset trial again (Plans view) | Normal mode restored, all numbers visible |  |
| 3.6 | Force expire + click **I've already paid** → confirm | Workspace marked as paid, banner disappears, full access restored |  |
| 3.7 | Revert to trial (dev panel) for the next scenario |  |  |

## 4. Distributor one-pager

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 4.1 | Sidebar → **One-pager** | Branded A4 preview visible, scrollable |  |
| 4.2 | Enter prospect name: "Nexlo Technologies" | Name appears in the hero band immediately |  |
| 4.3 | Enter distributor details (name, email, phone) | Details appear in the CTA band |  |
| 4.4 | Click **Download PDF** | PDF downloads with filename `saas-spend-track-for-nexlo-technologies.pdf` |  |
| 4.5 | Open the PDF | Single A4 page, colour-matched, QR code visible in bottom right |  |
| 4.6 | Scan the QR code with phone | Opens `https://saasspendtrack.com?ref=Nexlo%20Technologies` |  |
| 4.7 | Click **Print** | New window opens with same layout; browser print dialog appears |  |

## 5. Vendor contact book

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 5.1 | Sidebar → **Vendor contacts** | Table of all active vendors with 7 editable columns |  |
| 5.2 | Four KPIs visible at top | Vendors with contact / Missing / Stale >60d / Portfolio value |  |
| 5.3 | Inline-edit AE name, email, phone for Salesforce | Fields save on blur, no explicit save button needed |  |
| 5.4 | Set a last-outreach date >60 days ago | Row highlights red (stale) |  |
| 5.5 | Click the ✉️ action button | mailto opens in default mail client with pre-filled subject and personalised body (vendor name, annual commit, seat utilisation, renewal date) |  |
| 5.6 | Close the mail client | The last-outreach date auto-updates to today, row no longer red |  |
| 5.7 | Open a Subscriptions row → scroll to Vendor contact pane in the modal | Same contact data visible, editable from within the contract modal |  |

## 6. Ask Track (text + voice)

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 6.1 | Press ⌘K (Mac) or Ctrl+K anywhere in the app | Centered modal opens, input autofocused |  |
| 6.2 | Type "total spend on hubspot this year" | Modal shows HubSpot monthly, annual run-rate, paid/outstanding invoices, next renewal |  |
| 6.3 | Type "give me all vendor names" | Full vendor list with department and annual spend, clickable rows |  |
| 6.4 | Type "spend by department" | Grid of departments ranked by annual spend |  |
| 6.5 | Type "help" | Lists all 20 intents the router supports |  |
| 6.6 | Type a nonsense query like "foobar" | Fallback with clickable chip suggestions |  |
| 6.7 | Type a near-miss like "hotspot" (voice mishearing HubSpot) | Fuzzy match resolves to HubSpot automatically |  |
| 6.8 | Press Esc in the modal | Modal closes, focus returns to topbar bar |  |
| 6.9 | Open #chat view → click **🎙 Voice** button | Voice settings pane opens with 3 dropdowns |  |
| 6.10 | Switch TTS language to Hindi, click **Test voice** | Hindi sample sentence plays (needs OS Hindi voice installed) |  |
| 6.11 | Switch back to English (US), click Test again | English sample plays |  |
| 6.12 | On a hosted copy, click the mic button and speak a query | Transcription appears, query runs, answer speaks aloud |  |

## 7. Downloads audit

Verify every download works on both the hosted copy (native browser save) and the Claude artifact (via `claude.use("downloads")`).

| # | Button | Expected |
|---|--------|----------|
| 7.1 | Dashboard → Download PDF | Dashboard PDF saves |
| 7.2 | Analytics → Download PDF | Analytics PDF saves |
| 7.3 | Risk → Download PDF | Risk PDF saves |
| 7.4 | Playbook → Download PDF | Playbook PDF saves |
| 7.5 | Playbook → Download Legal review PDF | Legal review PDF (different layout) saves |
| 7.6 | Renewal Center → Download PDF | Renewal PDF saves |
| 7.7 | Scenario planner → Download PDF | Scenario PDF saves |
| 7.8 | Licence forecast → Download PDF | Forecast PDF saves |
| 7.9 | QA tests → Download PDF | QA report PDF saves |
| 7.10 | Changelog → Download PDF (both tabs) | Changelog or roadmap PDF saves |
| 7.11 | One-pager → Download PDF | Distributor PDF saves |
| 7.12 | Vendor contacts → Download PDF | Contact book PDF saves |
| 7.13 | Subscriptions → CSV | subscriptions.csv saves |
| 7.14 | Invoices → CSV | invoices.csv saves |
| 7.15 | Settings → Full JSON export | state.json saves |
| 7.16 | Alerts → ICS calendar | alerts.ics saves |
| 7.17 | Backlog → Export JSON | backlog.json saves |
| 7.18 | Team directory → both CSV templates | templates save |

## 8. Mobile responsive

Test on a phone-width viewport (375×667) by resizing the browser.

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 8.1 | Topbar search bar hides, floating 🔍 pill appears bottom-right | Mobile-only entry to Ask Track |  |
| 8.2 | Sidebar collapses, mobile nav strip appears at top | No horizontal overflow |  |
| 8.3 | Dashboard KPIs stack vertically | One per row |  |
| 8.4 | Analytics charts resize to viewport width | No 346px forced min-width |  |
| 8.5 | Renewal center lane cards stack vertically | Readable on small screen |  |
| 8.6 | Subscriptions list scrolls horizontally if needed | Table doesn't overflow page |  |
| 8.7 | One-pager preview scales down to fit | Scaled with transform; still readable |  |

## 9. Dark mode contrast

Toggle dark mode (sun/moon icon in topbar) and walk through every view.

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 9.1 | Every KPI number visible | No invisible text |  |
| 9.2 | All primary buttons have readable text | No white-on-white or black-on-black |  |
| 9.3 | Multiselect dropdowns readable | Dark background, light checkboxes |  |
| 9.4 | Modals render with correct contrast | Expiry gate, contract modal, invite modal |  |
| 9.5 | Trial banner readable | Info blue or warn orange on dark background |  |

## 10. Marketing site

Open https://saasspendtrack.com in a fresh window.

| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| 10.1 | Hero loads | New headline about "Indian and APAC mid-market" |  |
| 10.2 | Hero CTA "Try it live, free" → opens app.saasspendtrack.com in new tab | Tool loads cleanly |  |
| 10.3 | Scroll to **Pricing** section | Single dark card with $3,499/year, 250 contracts, $100/50 extra, "Indian customers: 18% GST" sub-line |  |
| 10.4 | Dual CTAs: "Try it live" and "Book a 30-min demo" | Both buttons visible and clickable |  |
| 10.5 | "Book a demo" → opens mailto to vinayraghavendran16@gmail.com | Mail client opens |  |
| 10.6 | Scroll to FAQ | Updated answers mention $3,499/yr, 250 contracts, on-prem option |  |
| 10.7 | Mobile responsive (375px) | Pricing card stacks, feature columns go to 1-up |  |
| 10.8 | OG preview (paste URL in LinkedIn/Twitter) | Preview shows updated copy |  |

---

## Smoke test shortcut

For a 2-minute go/no-go after each push:

```bash
# Automated
cd /home/claude && node run_qa.js
# Should print: PASS 116 / FAIL 0 / SKIP 8

# Manual
# 1. Load https://app.saasspendtrack.com
# 2. Press ⌘K → ask "spend by department"
# 3. Sidebar → Demo presets → load BFSI
# 4. Sidebar → One-pager → fill prospect → Download PDF
# 5. Sidebar → Vendor contacts → draft email on any vendor
# 6. Sidebar → Plans → Force expire → Reset
```

If any of those six steps fail, roll back the latest commit.
