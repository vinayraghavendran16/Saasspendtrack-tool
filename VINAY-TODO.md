# Vinay's open items

Everything I need **you** to do, in priority order. I keep this file
up to date every phase — anything that only you can do (dashboard
clicks, OAuth, payment setup, legal filings, copy sign-off) lives
here. Tick items off by removing them from the list, or ask me to.

Last updated: 2026-11-18 (after Command Centre, Reporting, InfoSec, Vendors, connectors, Renewal Guides, PDF garble-repair, department field, full vendor editor)

> UI/UX + UAT pass on 18 Nov 2026: healthy. 26/26 views render, zero console
> errors, dark/light contrast fixed, all new modules verified end to end. The
> in-browser QA suite reads 100% of applicable tests (3 demo-only integration
> tests now skip on a blank workspace instead of failing). Nothing from that
> pass needs your action. Your open items below are unchanged.

---

## P1 — payment / compliance (money-related)

### Set SUPPORT_PHONE in Apps Script (reply-to already done)
`REPLY_TO` is set. One placeholder left in the welcome-email config at
the top of `Code.gs`:
```
const SUPPORT_PHONE  = 'REPLACE_WITH_YOUR_PHONE';
```
Set it to +91 91684 81989 (or whichever number you want on email
signatures). Edit directly in the Apps Script editor — no deploy needed;
drip picks it up on the next scheduled run.

---

## P1.5 — reliability (small but worth doing)

### Wire a Razorpay webhook into the Apps Script endpoint
Right now payment detection is browser-side (Phase 48): user returns from
Razorpay → tool detects → event fired to sheet → drip stops within 24h.
If a user pays but never returns to the tool, we don't know. The drip
will still send "last day of trial" to a paying customer.

Fix: Razorpay dashboard → Settings → Webhooks → Add webhook:
- URL: your Apps Script `/exec` endpoint (same as signup)
- Events: `payment.captured` (and optionally `order.paid`)
- Secret: generate one and save it

Then I add a `doPost` branch that detects the Razorpay payload shape
and fires `payment_completed` with the Razorpay payment_id. Takes ~15 min
once the webhook is configured in Razorpay — ping me when done.

---

## P1.5 — Discoverability launches (new, website SEO push)

### Listings (one-time, each ~30 min)
These are where buyers evaluating "SaaS management tools" actually look. Submit once, they appear in comparison searches forever.

- [ ] **G2** — https://www.g2.com/products/new. Need: product name, website, 2-sentence description, category (SaaS Spend Management), 3-5 screenshots, logo. I'll draft the copy; you submit.
- [ ] **Capterra** — https://www.capterra.com/vendors/sign-up. Same kit. Also lands on GetApp + Software Advice (same owner).
- [ ] **AlternativeTo.net** — https://alternativeto.net. Submit as alternative to Vendr, Zylo, Spendesk. Free, high SEO value.
- [ ] **Product Hunt** — https://www.producthunt.com/posts/new. Timed launch (pick a Tuesday morning US time). Draft the launch post together before you go.
- [ ] **StackShare** — https://stackshare.io/apps/new. Dev-oriented but shows up for enterprise buyer searches.
- [ ] **Slant.co** — https://www.slant.co. User-driven comparison site; worth submitting.

### Content distribution (recurring, each ~15 min)
After the comparison pages are live, seed them where buyers hang out.

- [ ] **Show HN post** on Hacker News — "Show HN: SaaS Spend Track — browser-only SaaS management, $3,499 flat". Pick a Tuesday or Wednesday 10am US ET for best traffic. Lead with the architecture differentiator (browser-only, no backend).
- [ ] **Reddit posts** — r/SaaS, r/startups, r/procurement, r/finance, r/CFO (if permitted; some of these ban promotion but welcome comparison discussion). Not posting your product; posting the comparison content with a disclosure that you built it.
- [ ] **LinkedIn posts** on your personal account weekly for 4 weeks after launch. Pattern: lead with a procurement / SaaS-spend insight, close with "I built a tool for this; link in comments". Your Whatfix + Proshort audience is exactly the ICP.
- [ ] **Indian SaaS media** — Inc42, YourStory, Moneycontrol Tech. Pitch the "bootstrapped Indian SaaS management tool challenging US incumbents" story. Your 13y resume gives credibility.

### Marketing site assets I still need from you
- [ ] **og-image.png** — 1200×630. Design brief in previous TODO. Needed for LinkedIn / Twitter / Slack previews.
- [ ] **Product screenshots** — 5-6 clean ones for G2 / Capterra / Product Hunt. I can generate from the Claude artifact but your real browser renders are better.
- [ ] **Founder headshot** — one professional photo for the About page byline + comparison pages author bio.
- [ ] **One real customer logo + testimonial** — once you have your first paying customer. Massively changes the trust signal on comparison pages.

---

## P2 — PWA icon pack (new, from Phase 54)

### Create proper PNG icons for the PWA manifest
Phase 54 ships with an `icon.svg` placeholder. Real PWAs want
PNG icons at multiple sizes for every platform:

- `/icon-192.png` — 192×192 (Android home screen)
- `/icon-512.png` — 512×512 (splash screen generation)
- `/icon-maskable-512.png` — 512×512 with 10% safe-zone padding (Android adaptive icons)
- `/apple-touch-icon.png` — 180×180 (iOS home screen)

Design brief:
- Dark navy background `#0f1829`
- Blue inner square `#2563eb` with 15% padding (becomes 10% padding on maskable)
- White "SST" text, bold, centred
- Rounded corners on the icon-192 / icon-512 / apple-touch (iOS adds its own rounding)
- Maskable: no rounded corners, full square (Android will mask)

Takes 10 minutes in Figma or Canva. Or ping me and I'll generate
SVG-rendered PNGs from the current icon.svg.

Then: Cloudflare Pages auto-serves whatever is in the repo root,
so just commit the PNGs to `/public/` or repo root and push.

---

## P2 — nice-to-have / brand polish

### Create `og-image.png` for OpenGraph link previews
When `saasspendtrack.com` or `app.saasspendtrack.com` is shared on
LinkedIn, WhatsApp, Slack, Twitter, iMessage, etc., it shows an empty
preview card right now. Need a 1200 × 630 PNG at `/og-image.png` in
the website repo.

Rough brief:
- Dark navy background matching the app (`#0f1829`)
- Product name "SaaS Spend Track" in white
- Tagline line 2: "Contract + spend management that runs in your browser"
- Small SST logo top-left

You can make it in Figma / Canva in 10 min. Or I can scaffold one and
you swap in the final later — tell me.

### (Optional) Set up `vinay@saasspendtrack.com` email forwarding
Currently all contact forms and email drips reply-to your personal
`@gmail.com`. If you want a branded address, Cloudflare Email Routing
is free:

1. Cloudflare dashboard → saasspendtrack.com domain → Email → Email Routing
2. Add route: `vinay@saasspendtrack.com` → forward to your Gmail
3. Update `REPLY_TO` constant in Apps Script to the new address

Purely cosmetic — doesn't change functionality.

### Fix the footer address (now outdated) + write real "About" copy
The website footer still says "HSR Layout, Bengaluru 560102" but you're
in **Chennai** now. Two things:
- Update the address to your current Chennai location (send me the line you want and I'll change it; I didn't want to publish a specific address without your say-so).
- For trust signals, consider adding: a one-line "who built this" (Vinay + 13y RevOps background), a link to your LinkedIn, and a real support email (not the form).

---

## Done / archive (keep for reference)

These are closed. Listed here so you can see what's shipped.

- ✅ Apps Script "Anyone" access set, welcome email live, mail permission granted (Phase 41 night session)
- ✅ Cloudflare Pages redeployed after bundle pipeline fix (Phase 42)
- ✅ Signup modal dark-theme fix verified live (Phase 39/40)
- ✅ Dark modal CSS fix verified in Incognito after cache bust
- ✅ Command Centre: 13 working ingestion/setup paths, no stubs (18 Nov)
- ✅ Reporting module (cross-functional pivot + CSV export) (18 Nov)
- ✅ InfoSec module (per-vendor reviews, checklist, GRC connectors) (18 Nov)
- ✅ Vendors governance tab + full-screen vendor editor with stakeholders/approvals (18 Nov)
- ✅ CLM / accounting / SSO / GRC connectors (CSV + user-token API sync) (18 Nov)
- ✅ Renewal Guides (source-grounded, pre-generated for 12 vendors) (18 Nov)
- ✅ PDF constant-offset font-garble auto-repair in contract extraction (18 Nov)
- ✅ Explicit department / cost-center field (hybrid with owner-derived fallback) (18 Nov)
- ✅ Notice windows moved to top of dashboard; dark-mode contrast fixes (18 Nov)
- ✅ Trial email drip trigger installed in Apps Script (17 Nov)
- ✅ Duplicate `saasspendtrack` Worker deleted from Cloudflare (17 Nov)
- ✅ Razorpay International USD page wired in (rzp.io/rzp/MhqdtN2a) — app + website Pay buttons now route non-Indian users to it (18 Nov)
- ✅ LUT for FY 2026-27 filed (zero-rated exports)
- ✅ REPLY_TO set in Apps Script welcome/drip email config
- ✅ Website updated with governance/InfoSec/reporting/connectors/renewal-guide sections + international Pay fix (PR #2, 18 Nov)

---

## Rules of this file

- I only add to this file. Things move out when you actually do them AND tell me.
- I don't add tasks that are mine to build — those go in `extensions*.js` or `trial-tracking/*.gs`.
- Priority order matters: P0 blocks, P1 is important but not blocking the next trial user, P2 is polish.
- If you want something **off** this list without doing it, tell me — I'll move it to a "won't-do / parked" section.
