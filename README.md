# SaaS Spend Track

A zero-dependency web tool for tracking SaaS subscription spend. See what you're paying, when things renew, and where you can cut.

**Live:** [saasspendtrack.com](https://saasspendtrack.com/)

## Features

- **Dashboard** — Monthly + annualized spend, active subscription count, next upcoming renewal.
- **Subscriptions** — Add, edit, pause, and delete subscriptions. Search and filter by category.
- **Renewals** — 90-day rolling calendar view grouped by month.
- **Insights** — Top spend, breakdown by billing cycle, and automatic recommendations (switch monthly → yearly, category consolidation, high-cost line items, expiring-soon warnings).
- **Local-first** — Data lives in your browser's `localStorage`. Nothing is uploaded. Export/import JSON to move between browsers.

## Running locally

It's a static site — no build step.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `index.html` directly in a browser.

## Files

- `index.html` — layout and shell
- `styles.css` — dark/light responsive theme
- `app.js` — state, rendering, and persistence
