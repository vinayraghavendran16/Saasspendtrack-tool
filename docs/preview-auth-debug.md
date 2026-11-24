# Preview authentication investigation — 2026-11-24

## Verified evidence

- Working branch: `codex/cloudflare-auth-debug`, created from `development/cloud-foundation-audit` at `f8689ec24f4706ac165009b2ac82e28d9683e235`. The debug branch did not previously exist remotely.
- At inspection, latest preview: `https://3ba36107.saasspendtrack.pages.dev`, successful Git deployment of that base SHA, from `development/cloud-foundation-audit`.
- Preview `DB`: `sst-preview`, ID `ccdbb7a7-9cb5-45d7-8bac-8b8024626fc8`.
- Production `DB`: `sst-trial`, ID `33e16d8e-579e-4454-959b-dbbbb368081a`. IDs differ. No production database was queried or modified.
- Preview has a `ZEPTOMAIL_TOKEN` secret binding. The Cloudflare API redacts its value; a missing value in metadata does **not** mean the secret is absent or empty.
- Preview `ZEPTOMAIL_URL` is `https://api.zeptomail.in/v1.1/email`; `FROM_EMAIL` is `hello@saasspendtrack.com`. `FROM_NAME` and `REPLY_TO` are absent but default to `SaaS Spend Track` and the sender address.
- `APP_URL` points to stale preview `https://978936e4.saasspendtrack.pages.dev`.
- Reproduced `{"ok":true,"emailed":false}` on the latest preview. A live tail confirmed provider HTTP 500. The logged provider body did not yield a usable error code.

## Conclusions and patch

The provider's underlying reason for HTTP 500 is **not yet established**. Domain verification and a successful Zoho-console test do not verify the particular Cloudflare secret, Mail Agent, or outbound API request. Do not report this as resolved until a delivered email and successful redemption are observed.

Confirmed code defects repaired:
- Copying a complete `Zoho-enczapikey …` authorization value into `ZEPTOMAIL_TOKEN` previously doubled the prefix. Accept raw or prefixed tokens, trim outer whitespace, and reject malformed values without network calls. Whether preview has this exact defect cannot be established from redacted secret metadata.
- Raw provider response logging could disclose recipients, message content or credentials. Log only fixed failure categories and HTTP status.
- Transport exceptions could escape a best-effort send and break sign-in redemption. Handle them, use a bounded timeout, and reject redirects.
- All three sign-in forms displayed inbox success regardless of `emailed:false` or HTTP errors. They now require affirmative success and permit retry on failure.
- Magic-link generation and verification on this project's preview hosts now use the request's preview origin, preventing stale APP_URL from routing authentication to an older deployment. Production behavior is preserved.

## Preview-only configuration and verification

1. Cloudflare dashboard → Workers & Pages → `saasspendtrack` → Settings. Select **Preview** before any edit. Never change Production or “all environments.”
2. Under Bindings, verify `DB` points to `sst-preview` and the preview ID above. Do not bind `sst-trial`. Existing schema must be checked before applying migrations; do not blindly rerun migration 002.
3. Under Variables and Secrets, set `ZEPTOMAIL_TOKEN` as a **secret** to the Send Mail API token for the intended India-region Mail Agent. Prefer the raw token, without quotes or a header name. Do not use an OAuth access token or SMTP password. Enter it securely in the dashboard; never paste it into chat, logs or command arguments. If replacement is required, use a preview-specific agent/token; do not rotate or modify production credentials.
4. Confirm `ZEPTOMAIL_URL=https://api.zeptomail.in/v1.1/email`, `FROM_EMAIL=hello@saasspendtrack.com`. Verify that sender is authorized for the **same Mail Agent** as the preview token. Optionally set `FROM_NAME=SaaS Spend Track` and `REPLY_TO=hello@saasspendtrack.com` explicitly.
5. Set preview `APP_URL` to the intended stable preview branch alias shown in Deployments, not production or a retired immutable deployment. Magic-link auth is now pinned to the requested preview, but invites and other emails still use APP_URL.
6. Redeploy **only** `codex/cloudflare-auth-debug`. In deployment details, confirm environment Preview, full Git SHA matching `git rev-parse HEAD`, and isolated `DB` ID. Secret/settings changes require a new deployment; old immutable URLs retain their old configuration.
7. On the new immutable preview URL, request a sign-in email using the authorized test address. Confirm `emailed:true`, actual inbox receipt, and that the link's host matches this preview. Do not share its query string. Redeem once; confirm an authenticated session, then verify replay fails. A provider 2xx alone is not proof of inbox delivery.
8. If HTTP 500 remains, inspect the matching Mail Agent's transaction logs. Escalate to Zoho with timestamp, endpoint, sender, and provider status/error code only—never credentials or magic links. Do not switch data-center endpoints speculatively.

`CRON_SECRET`, payment secrets and AI keys are absent from preview. They are not required by the magic-link request/verify flow; do not copy production secrets into preview to diagnose this issue.

## Local validation

`npm run check`; `npm test` (92 existing unit assertions plus the new email/auth suite); security-regression; workspace-isolation; ai-consent; welcome-email; browser-cache-safety; migration-smoke all pass. The migration smoke check is local SQLite, not a remote migration.

References: [Zoho email API](https://www.zoho.com/zeptomail/help/api/email-sending.html), [Cloudflare bindings](https://developers.cloudflare.com/pages/functions/bindings/), [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/).
