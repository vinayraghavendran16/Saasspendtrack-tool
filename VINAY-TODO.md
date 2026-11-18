# SaaS Spend Track — launch to-do

Last updated: 2026-11-18 (session). Owner: Vinay.

## Done
- [x] Website PR merged: new module sections live + **international Pay link fixed** (`MhqdtN2a` replaced the placeholder). Geo-swap verified live.
- [x] Trial gating built (app repo **PR #2**): magic-link auth, 7-day trial, day-8 lock, Razorpay unlock, ZeptoMail upgrade cadence. Fails open until configured.

## P1 — make the trial live (config only Vinay can do; see TRIAL-SETUP.md)
- [ ] Create + bind the **D1** database (`sst-trial`), apply `schema.sql`, bind as `DB`.
- [ ] Set Pages secrets: `ZEPTOMAIL_TOKEN`, `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`; vars `APP_URL`, `FROM_EMAIL`, `FROM_NAME`, `ZEPTOMAIL_URL`.
- [ ] Verify `saasspendtrack.com` as a **ZeptoMail** sender (SPF/DKIM).
- [ ] Add the **Razorpay webhook** → `/api/razorpay/webhook` (events: payment.captured, payment_link.paid).
- [ ] Schedule the **cadence** (deploy `cron-worker/` or point a cron at `/api/cron/tick`).
- [ ] Merge PR #2 after D1 + secrets are set, then smoke-test signup → link → trial → expiry → pay → unlock.

## P1 — payment path
- [ ] Verify the **third pay link** `rzp.io/rzp/2T2PfXBC` ("Upgrade to Pro" in the site's "How it works" step): confirm it's current and the right amount. If it should match the main flow, give it the same geo-swap as the pricing button.
- [ ] Confirm the manual **GST invoice** (Zoho Books) turnaround after payment.

## Decisions pending
- [x] **Email cadence home: Zoho (ZeptoMail), on Cloudflare.** Decided. Fires from trial start; Apps Script not used for cadence.
- [ ] Reconcile the app's cosmetic **Free/Pro plan badge** with the real trial/paid state so they don't contradict.
- [ ] **Harden the gate:** move subscription/contract data server-side so the lock can't be bypassed in devtools (paid-backend phase).
- [ ] Registered office on legal doc/footer: **Bengaluru → Chennai**? (confirm the registered office actually moved before changing the legal doc.)

## P2 — launch polish
- [ ] Footer address Bengaluru → Chennai (website).
- [ ] `SUPPORT_PHONE` set wherever support contact is shown.
- [ ] PWA icon PNGs from `icon.svg`; `vinay@saasspendtrack.com` forwarding.
- [ ] Distribution assets: og-image 1200x630, 5-6 screenshots, directory listings (G2, Capterra, Product Hunt, etc.).
