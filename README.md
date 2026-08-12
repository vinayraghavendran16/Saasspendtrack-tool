# Overcharge Finder — SaaSSpendTrack

A zero-dependency web tool that checks what your software vendors charged against what your contracts actually permit.

**Live:** [saasspendtrack.com](https://saasspendtrack.com/)

## What it does

You record two things per vendor: what the contract says, and what you were billed. The tool reconciles them and produces a findings ledger — every charge that doesn't match its own contract, with the clause it contradicts and the money involved.

### The seven checks

| Check | Triggers when |
|---|---|
| Rate above contract | Billed unit price exceeds the contracted rate |
| Seats above order form | Seats billed exceed the licensed count |
| Uplift cap exceeded | Renewal increase exceeds the contracted ceiling |
| Tier not as contracted | Charged plan differs from the one named in the contract |
| Billed for an inclusion | A line item the subscription fee already covers |
| Billed after cancellation | Invoices continued past the cancellation date |
| **Dispute window status** | Days since invoice vs the contract's invoice-acceptance clause |

The last one is the important one. Most contracts limit billing disputes to 30–90 days after invoicing. Finding an overcharge outside that window is finding money you've already lost, so every result is labelled Open, Closing or Closed.

## Screens

- **Vendors** — contracted terms beside billed reality, with a clause-reference field so findings can cite their source.
- **Findings** — the reconciliation ledger, split into what's still claimable and what has already expired.
- **Renewals** — the last day you can give notice, counted back from each contract's own notice period. Not the renewal date.
- **Data** — JSON export/import, dispute-letter drafts, and delete-everything.

## Design constraints

**No clause extraction.** A static client-side app can't read PDFs, so you type the contracted terms in yourself. You read the clause once; the tool does the arithmetic every month afterward and cites where the number came from. That's what makes the output credible enough to send to a vendor.

**Local only.** Everything lives in this browser's `localStorage`. No account, no upload, no server, no integration, no admin access to anything. Export to move it between machines. If the site disappeared tomorrow your data would still be in your browser — which, after Productiv destroyed every customer's data in August 2026 with four days' notice, is worth stating plainly.

## Running locally

No build step.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

- `index.html` — shell, tabs, vendor editor drawer
- `styles.css` — dark theme; green marks money coming back, red marks money taken
- `app.js` — state, the reconciliation engine, rendering, export

## Not in this version

Clause extraction from PDFs, invoice ingestion from accounting systems, and contributed benchmark data all need a backend. The vendor record shape is designed to accommodate them later.
