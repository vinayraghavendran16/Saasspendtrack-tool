# Vinay's open items

Everything I need **you** to do, in priority order. I keep this file
up to date every phase — anything that only you can do (dashboard
clicks, OAuth, payment setup, legal filings, copy sign-off) lives
here. Tick items off by removing them from the list, or ask me to.

Last updated: Phase 54 — 2026-11-15

---

## P0 — blocking / time-sensitive

### Install the trial email drip trigger (Phase 45, 3 min)
The code is already in `trial-tracking/drip-emails.gs`. You need to:

1. Open Apps Script (**Extensions → Apps Script** from the Signups Sheet)
2. Scroll to the bottom of `Code.gs` → paste the **entire** contents of `drip-emails.gs`
3. Save
4. Left sidebar → clock icon (Triggers) → **+ Add Trigger**
   - Function: `runDailyDrip`
   - Event source: Time-driven → Day timer → **9am to 10am** (IST)
5. Run `testDripNow` once from the editor to verify it sends you an email

Full walkthrough: `trial-tracking/DRIP-SETUP.md`.

Until you install this, no drip emails go out to trial users.

### Delete the standalone `saasspendtrack` Worker (cleanup from last night)
In Cloudflare Dashboard → Workers & Pages, you now have **two**
projects with the same name:
- `saasspendtrack` (Worker, at `saasspendtrack.vinayraghavendran16.workers.dev`) — the one we created last night by mistake
- `saasspendtrack` (Pages project, serving `app.saasspendtrack.com`) — the real one

Delete the Worker (first row). The Pages project is unaffected.

---

## P1 — payment / compliance (money-related)

### Activate Razorpay International Payments + create USD payment page
Right now the Pay button geo-routes to Razorpay for Indian users
but falls through to a placeholder (`rzp.io/rzp/INTERNATIONAL-PLACEHOLDER`)
for everyone else. To fix:

1. In Razorpay dashboard → Settings → International Payments → **Activate**
2. Create a new payment page in USD at the same $3,499/year price
3. Send me the URL (looks like `rzp.io/rzp/XXXXXXXX`)
4. I'll replace the placeholder and redeploy

Until this is done, international visitors see the Pay button but it goes nowhere.

### File LUT for FY 2026-27 on gst.gov.in (zero-rated exports)
Required to collect international payments without charging 18% GST
(which international customers won't pay). Standard annual filing for
Indian exporters of services.

1. Log into gst.gov.in
2. Services → User Services → Furnish Letter of Undertaking (LUT)
3. Form GST RFD-11, FY 2026-27
4. Two witnesses needed (name + address)
5. File and download the acknowledgment

Without this, international Razorpay payments will trigger GST due,
which is a mess to reconcile.

### Fill in REPLY_TO and SUPPORT_PHONE in Apps Script
In the welcome-email config at the top of `Code.gs`, there are two
placeholder constants:
```
const REPLY_TO       = 'REPLACE_WITH_YOUR_EMAIL';
const SUPPORT_PHONE  = 'REPLACE_WITH_YOUR_PHONE';
```
These control where welcome and drip emails reply-to, and what phone
number appears in signature lines. Edit directly in the Apps Script
editor — no deploy needed for welcome email changes; drip picks them
up on the next scheduled run.

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

### Write real "About" copy for the website footer
Current footer just says "Whizzlead Solutions OPC Private Limited,
HSR Layout, Bengaluru 560102". For trust signals, consider adding:
- One-line "who built this" (Vinay + 13y RevOps background)
- Link to your LinkedIn
- A real email (not the form)

---

## Done / archive (keep for reference)

These are closed. Listed here so you can see what's shipped.

- ✅ Apps Script "Anyone" access set, welcome email live, mail permission granted (Phase 41 night session)
- ✅ Cloudflare Pages redeployed after bundle pipeline fix (Phase 42)
- ✅ Signup modal dark-theme fix verified live (Phase 39/40)
- ✅ Dark modal CSS fix verified in Incognito after cache bust

---

## Rules of this file

- I only add to this file. Things move out when you actually do them AND tell me.
- I don't add tasks that are mine to build — those go in `extensions*.js` or `trial-tracking/*.gs`.
- Priority order matters: P0 blocks, P1 is important but not blocking the next trial user, P2 is polish.
- If you want something **off** this list without doing it, tell me — I'll move it to a "won't-do / parked" section.
