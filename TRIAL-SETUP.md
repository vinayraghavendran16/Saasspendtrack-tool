# Trial gating + auth - setup

This PR adds a traditional gated trial to the app: magic-link sign-in, a 7-day
trial, a hard lock on day 8, instant unlock on payment (Razorpay webhook), and a
Zoho ZeptoMail upgrade email cadence.

The **code** ships in this PR. The steps below are the **account/infra config**
only you can do (Cloudflare dashboard, Zoho, Razorpay). Nothing works until these
are done, but the app stays usable in the meantime because the gate **fails open**
if `/api/me` isn't reachable.

## What's in the code

- `functions/api/auth/request.js` - email a one-time sign-in link (starts trial on first sight)
- `functions/api/auth/verify.js` - consume link, create session cookie, redirect to app
- `functions/api/me.js` - entitlement source of truth (the gate reads this)
- `functions/api/auth/logout.js`
- `functions/api/razorpay/webhook.js` - on payment, flip user to `active`
- `functions/api/cron/tick.js` - idempotent email cadence runner
- `functions/_shared/util.js`, `functions/_shared/email.js`
- `auth-gate.js` / `auth-gate.css` - login screen, trial banner, expiry lock (wired into `index.html`)
- `schema.sql` - D1 tables
- `cron-worker/` - optional hourly Cloudflare worker that pings the cadence runner

## 1. Create the D1 database + tables

```bash
wrangler d1 create sst-trial
# copy the database_id it prints
wrangler d1 execute sst-trial --remote --file=./schema.sql
```

## 2. Bind D1 to the Pages project

Cloudflare dashboard → your Pages project (app.saasspendtrack.com) → **Settings →
Functions → D1 database bindings** → add:

- Variable name: `DB`
- D1 database: `sst-trial`

(Add it to **Production**, and Preview if you use preview deploys.)

## 3. Set environment variables + secrets

Same project → **Settings → Environment variables** (Production). Mark the tokens
as **Secret**.

| Name | Value |
|------|-------|
| `APP_URL` | `https://app.saasspendtrack.com` |
| `FROM_EMAIL` | `hello@saasspendtrack.com` (must be a verified ZeptoMail sender) |
| `FROM_NAME` | `SaaS Spend Track` |
| `REPLY_TO` | branded reply address, e.g. `hello@saasspendtrack.com` (optional; defaults to `FROM_EMAIL`). Keep your personal Gmail out of customer email. |
| `ZEPTOMAIL_TOKEN` | your ZeptoMail **Send Mail** token (secret) |
| `ZEPTOMAIL_URL` | `https://api.zeptomail.in/v1.1/email` (use `.com` if your Zoho account is not India) |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you set on the Razorpay webhook (secret) |
| `CRON_SECRET` | any long random string (secret) |
| `ADMIN_EMAILS` | your owner email(s), comma-separated - who can open the admin command centre |
| `USD_INR` | FX rate for showing USD revenue in ₹ (e.g. `86`) |

## 4. Zoho ZeptoMail

1. ZeptoMail → add and **verify the `saasspendtrack.com` domain** (SPF/DKIM DNS records).
2. Create a **Mail Agent**, copy its **Send Mail token** → that's `ZEPTOMAIL_TOKEN`.
3. Confirm `hello@saasspendtrack.com` is an allowed from-address.

## 5. Razorpay webhook

Razorpay dashboard → **Settings → Webhooks → Add New Webhook**:

- URL: `https://app.saasspendtrack.com/api/razorpay/webhook`
- Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
- Active events: `payment.captured` and `payment_link.paid`

The paying email on the Razorpay page becomes the account that unlocks. Tell
buyers to pay with the same email they signed up with (the paywall screen says so).

## 6. Email cadence schedule

Option A (on Cloudflare):

```bash
cd cron-worker
wrangler deploy
wrangler secret put CRON_SECRET   # same value as the Pages app
```

Option B (external): point any scheduler (e.g. cron-job.org) at
`https://app.saasspendtrack.com/api/cron/tick?token=YOUR_CRON_SECRET` hourly.

Cadence (each sent once per user): welcome on signup, day-3 nudge, 1-day-left
nudge, and an "expired" email when the trial lapses.

## 6b. Stop the old Apps Script from double-emailing

All trial email now sends from ZeptoMail. To avoid trial users getting two
welcomes and two drips, disable email sending in the existing Apps Script
(the Google Sheet signup logger), but keep it logging signups:

- In the Apps Script, **delete the `runDailyDrip` time-driven trigger** (clock
  icon in the left sidebar), so the 14-day Gmail drip stops firing.
- In `doPost`, comment out the `sendWelcomeEmail(...)` call so it still writes the
  signup row but sends no Gmail welcome.

The Sheet stays as your signup record; emails come from ZeptoMail only. (The old
drip was 14-day; the ZeptoMail cadence is 7-day to match the gate.)

## 6c. Add the app_data table (server-side data)

Subscriptions/contracts now save to the account (D1), not just the browser, so
data follows you across devices. The `app_data` table was added to `schema.sql`;
re-run the schema (it uses `CREATE TABLE IF NOT EXISTS`, so it only adds the new
table and leaves existing data alone):

```bash
wrangler d1 execute sst-trial --remote --file=./schema.sql
```

On first load in a signed-in browser, whatever is already in that browser's
localStorage is migrated up to the server automatically. After that, every save
pushes to the server and every load pulls from it.

## 7. Verify (after deploy)

1. Open app.saasspendtrack.com in a clean browser → login screen appears.
2. Enter your email → receive the link → clicking it drops you into the app with a
   "7 days left" banner.
3. In D1, set your `trial_ends_at` to the past:
   `wrangler d1 execute sst-trial --remote --command "UPDATE users SET trial_ends_at=0 WHERE email='you@x.com'"`
   → reload → the expiry lock appears.
4. Make a ₹1 test payment (or fire a Razorpay test webhook) with that email →
   reload → you're back in.

## Admin command centre (owner-only)

Lives at **`https://app.saasspendtrack.com/admin.html`** (bookmark it; it's
`noindex` and the data endpoint rejects anyone not in `ADMIN_EMAILS`).

Sign in with your owner email (same magic-link flow). It shows: total trials,
active trials, paid customers, conversion %, trial churn %, realised ARR, total
revenue, trial pipeline, a 14-day signups chart, emails-sent counts, and a recent-
accounts table. It reads live from D1 - **no Google Sheet needed** for trials/paid.

Not tracked yet: email **opens** and **replies** (shows sent counts only). Adding
opens needs ZeptoMail open-tracking + a small webhook; say the word and I'll wire it.

## Gating a new server feature (reuse for anything paid)

Any new endpoint that does valuable work (AI extraction, exports, analysis)
should sit behind the entitlement guard. Then bypassing the client overlay gets
an expired/unpaid user nothing - the endpoint returns 403.

```js
import { requireEntitled } from '../_shared/util.js';

export async function onRequestPost({ request, env }) {
  const gate = await requireEntitled(request, env);
  if (gate.response) return gate.response;   // 401 not signed in, 403 not entitled
  const { user, ent } = gate;                // entitled account - do the work
  // ...
}
```

Owner-only endpoints use `requireAdmin` the same way. This is where "developers
can't get the value for free" is actually enforced - on the server, per request.

## Known limits (worth hardening later)

- **Data still lives in the browser (localStorage).** The gate blocks the UI and
  is server-authoritative via `/api/me`, which stops normal users cold. A
  determined developer could remove the overlay in devtools since the data isn't
  server-side yet. Real hardening = move subscription/contract data behind the
  session. Fine for launch; flag for the paid-backend phase.
- The app's own "Free/Pro" **plan badge** (localStorage) is cosmetic and separate
  from this trial gate. Reconcile the two in a follow-up so they don't confuse.
- Sessions last 30 days; tune in `functions/_shared/util.js` (`SESSION_DAYS`).
