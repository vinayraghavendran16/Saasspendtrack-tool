# SaaS Spend Track — launch to-do (priority order)

Last updated: 2026-11-19. Owner: Vinay. Trial = 7-day, gated, Zoho/ZeptoMail email.

## Done
- [x] Website: international Pay link fixed + new sections live (geo-swap verified).
- [x] Trial gating built (PR #2): magic-link auth, 7-day trial, day-8 lock, Razorpay unlock.
- [x] Email cadence in ZeptoMail, your voice, 7-day (welcome, day-2, day-4, day-6, expired, paid).
- [x] Admin command centre `/admin.html`: trials, conversion, churn, ARR, revenue, pipeline, signups, emails sent.
- [x] Razorpay webhook created → Cloudflare URL.

## DO FIRST — launch blockers (trial does nothing until these are done)
1. **Create + bind D1.** `wrangler d1 create sst-trial` → apply `schema.sql` → bind as `DB` on the Pages project.
2. **Set Cloudflare secrets/vars:** `ZEPTOMAIL_TOKEN`, `RAZORPAY_WEBHOOK_SECRET` (the value from Razorpay), `CRON_SECRET`, `APP_URL`, `FROM_EMAIL`, `FROM_NAME`, `REPLY_TO`, `ADMIN_EMAILS`, `USD_INR`, `ZEPTOMAIL_URL`.
3. **Verify ZeptoMail sender** domain `saasspendtrack.com` (SPF/DKIM). No verified sender = no emails.
4. **Confirm the Razorpay webhook:** events = `payment.captured` + `payment_link.paid`, secret matches `RAZORPAY_WEBHOOK_SECRET`.
5. **Merge PR #2.**
6. **Schedule the cadence:** deploy `cron-worker/` (or point any cron at `/api/cron/tick?token=CRON_SECRET`).
7. **Smoke-test end to end:** signup → link → trial banner → force-expire → lock → test pay → unlock → check `/admin.html`.

## RIGHT AFTER
8. **Turn off the Apps Script:** delete the `runDailyDrip` trigger; delete the old Razorpay webhook pointing at the `/exec` URL. Sheet no longer needed.
9. **Third pay link `2T2PfXBC`** ("Upgrade to Pro" on the site): confirm it's current/right amount; give it the same geo-swap as the pricing button, or point it at the main flow.
10. **GST invoice** (Zoho Books) same-day turnaround confirmed.

## POLISH
11. Footer address Bengaluru → Chennai (website).
12. `SUPPORT_PHONE` wherever support is shown.
13. PWA icon PNGs from `icon.svg`; `vinay@saasspendtrack.com` forwarding.
14. Distribution assets: og-image 1200x630, 5-6 screenshots; listings (G2, Capterra, Product Hunt, etc.).

## ROADMAP (post-launch)
- **Email open + reply tracking** in the admin panel (ZeptoMail open-tracking + webhook). Panel shows sent-counts only for now.
- **Harden the gate:** move subscription/contract data server-side so the lock can't be bypassed in devtools.
- **Reconcile** the app's cosmetic Free/Pro plan badge with the real trial/paid state.
- Registered office on legal doc/footer: Bengaluru → Chennai (confirm the registered office actually moved first).
