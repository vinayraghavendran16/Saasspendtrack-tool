# Vinay's open items

Everything that needs **you** (dashboard clicks, payment setup, copy
sign-off, assets). In priority order by revenue impact. Tick items off
by removing them, or ask me to.

Last updated: 2026-11-19 - **reconciled to the current architecture.**

> Architecture change (Nov 2026): the trial now runs entirely on
> **Cloudflare** - D1 database (`sst-trial`), Pages Functions, magic-link
> login, ZeptoMail email cadence, a cron that advances the cadence, a
> Razorpay webhook, and an owner Command Centre dashboard. This
> **replaces the old Google Apps Script + Sheet**, which is retired
> (`trial-legacy-off.js`). Several items from the old list are therefore
> already handled and have moved to the archive.

---

## P0 - revenue path (verify, then close out)

### Razorpay webhook: configured. One check left.
Status as of 19 Nov:
- Webhook is created in Razorpay and Enabled, pointing at
  `https://app.saasspendtrack.com/api/razorpay/webhook` (last updated 18 Nov).
- `RAZORPAY_WEBHOOK_SECRET` is set in Cloudflare (confirmed: the live
  endpoint returns "bad signature" not "secret not configured").
- All other env vars are present in Cloudflare: `APP_URL`, `CRON_SECRET`,
  `FROM_EMAIL`, `FROM_NAME`, `REPLY_TO`, `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL`,
  `USD_INR`, plus the `sst-trial` D1 binding.

The only unknown is whether the secret VALUE in Cloudflare matches the one
in the Razorpay webhook. If they differ, Razorpay still shows "Enabled" but
every delivery fails with a 401 and no account is flipped.

Confirm with either:
1. Razorpay dashboard: open the webhook row, check its recent delivery log.
   200 means fully working. 401 means the secrets do not match and need
   re-entering on one side.
2. Run one real or test-mode payment with a fresh email and watch the
   Command Centre flip that account to active.

### Check event coverage for international payers
The international USD flow uses a Razorpay payment link
(`rzp.io/rzp/MhqdtN2a`), which fires `payment_link.paid`, not
`payment.captured`. The webhook handles both, but make sure
`payment_link.paid` is among the subscribed events on the webhook (the
"55 events" selection almost certainly includes it, worth a glance).

---

## P1 - get found and convert the first users

### Directory listings (one-time, ~30 min each; I draft copy, you submit)
Where buyers evaluating "SaaS management tools" actually look.

- [ ] **G2** - https://www.g2.com/products/new
- [ ] **Capterra** - https://www.capterra.com/vendors/sign-up (also feeds GetApp + Software Advice)
- [ ] **AlternativeTo.net** - submit as an alternative to Vendr, Zylo, Spendesk
- [ ] **Product Hunt** - https://www.producthunt.com/posts/new (timed launch, Tue AM US; draft the post with me first)
- [ ] **StackShare** - https://stackshare.io/apps/new
- [ ] **Slant.co** - https://www.slant.co

### Assets the listings need
- [ ] **Product screenshots** - 5-6 clean ones (your real browser renders beat generated ones)
- [ ] **Founder headshot** - one professional photo for the About byline + compare-page author bio
- [ ] **First customer logo + testimonial** - once you have a paying customer. Biggest trust-signal upgrade on the compare pages. (Gated on first sale.)
- [ ] **og-image.png** - 1200×630. *I can scaffold this now* (see below).

### Distribution (after the compare pages are live; recurring)
- [ ] **Show HN** - "Show HN: SaaS Spend Track - browser-only SaaS management, $3,499 flat". Lead with the browser-only/no-backend differentiator. Tue/Wed 10am US ET.
- [ ] **Reddit** - r/SaaS, r/startups, r/procurement, r/finance (post the comparison content with a build disclosure, not an ad).
- [ ] **LinkedIn** - weekly for 4 weeks post-launch. Procurement/SaaS-spend insight → "I built a tool for this; link in comments." Your Whatfix + Proshort audience is the ICP.
- [ ] **Indian SaaS media** - Inc42, YourStory, Moneycontrol Tech. Angle: bootstrapped Indian SaaS-management tool vs US incumbents.

---

## Ready for me to do now (not blocked on you)

Ask and I'll ship these:
- [ ] **og-image.png** (1200×630) so shared links stop showing an empty card
- [ ] **PWA PNG icon pack** from the existing `icon.svg` - `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png` (10% safe-zone), `/apple-touch-icon.png` (180×180)
- [ ] **Listing copy drafts** for G2 / Capterra / AlternativeTo
- [ ] **Show HN + 4-week LinkedIn sequence** drafts

---

## P2 - polish / brand

### Fix the footer address + round out the About page
Footer still says "HSR Layout, Bengaluru 560102" - you're in **Chennai**
now. Send me the line you want and I'll change it. While there: a one-line
"who built this" (you + 13y RevOps), a LinkedIn link, and a real support
email.

### (Optional) Branded inbox `vinay@saasspendtrack.com`
Email already sends from `hello@saasspendtrack.com` (not a personal inbox),
so this is cosmetic. If you want a personal branded address:
1. Cloudflare → saasspendtrack.com → Email → Email Routing
2. Route `vinay@saasspendtrack.com` → your Gmail
3. Set `REPLY_TO` env var to it and redeploy

---

## Done / archive (shipped - kept for reference)

- ✅ **Trial system rebuilt on Cloudflare** - D1 `sst-trial`, magic-link login, server-side per-account data (follows you across devices), 7-day gate with hard lock on day 8, upgrade restores access (Nov)
- ✅ **Email cadence on ZeptoMail + cron** - welcome through trial-ending drip, admin email excluded from metrics (Nov)
- ✅ **Razorpay webhook function** built with HMAC verify (needs dashboard config - see P0) (Nov)
- ✅ **Owner Command Centre dashboard** - trials, expected + actual revenue, ARR, churn (`/admin.html`) (Nov)
- ✅ **Old Apps Script trial retired** (`trial-legacy-off.js`); no sheet to maintain (Nov)
- ✅ **Security audit P0–P3 applied and live** - entitlement gate on AI endpoints, rate limiting, SSRF guard, error sanitization, tests + CI, gate/admin accessibility (Nov)
- ✅ **CLAUDE.md** repo guardrails added (Nov)
- ✅ Support phone + branded from/reply-to now set in the Cloudflare email code (`functions/_shared/email.js`) - *supersedes the old "set SUPPORT_PHONE in Apps Script" item*
- ✅ Razorpay International USD page wired in; app + website route non-Indian users to it (18 Nov)
- ✅ Command Centre, Reporting, InfoSec, Vendors governance, connectors, Renewal Guides, PDF garble-repair, department field (18 Nov)
- ✅ Website updated with governance/InfoSec/reporting/connectors/renewal sections + international Pay fix (PR #2); homepage clean light redesign + sub-page rollout (Nov)
- ✅ LUT for FY 2026-27 filed (zero-rated exports)
- ✅ Duplicate `saasspendtrack` Worker deleted from Cloudflare (17 Nov)

---

## Retired (old architecture - no longer applies)

- ~~Set SUPPORT_PHONE in Apps Script~~ → now in `functions/_shared/email.js`, already set
- ~~Wire a Razorpay webhook into the Apps Script endpoint~~ → replaced by the Cloudflare webhook function (see P0)
- ~~Apps Script trial drip / sheet upkeep~~ → replaced by Cloudflare cron + D1

---

## Rules of this file

- Only additions go in; items leave when you've done them AND told me.
- Tasks that are mine to *build* live in the code, not here.
- Priority is by revenue impact: P0 blocks money working, P1 blocks getting found, P2 is polish.
- Want something off the list without doing it? Tell me and I'll move it to a parked section.
