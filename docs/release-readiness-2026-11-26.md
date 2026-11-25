# Preview validation — 2026-11-26

Production decision: HOLD. Draft PR #33 remains unmerged. No production deployment, data or configuration was changed.

## Candidate and isolation

Tested application commit: `f3d9f54af4d7af0214fb242a42fc4b0151b61805` on `development/cloud-foundation-audit`. Immutable preview: https://9bde3b8e.saasspendtrack.pages.dev . The evidence commit is documentation-only; these results apply to this exact application candidate, not an untested later deployment.

Cloudflare deployment metadata and current project Preview configuration both contain exactly one D1 binding: `DB` → `ccdbb7a7-9cb5-45d7-8bac-8b8024626fc8`. The database metadata independently resolves it to `sst-preview`; it differs from documented production `sst-trial` (`33e16d8e-579e-4454-959b-dbbbb368081a`). APP_URL is `https://development-cloud-foundation.saasspendtrack.pages.dev`. No production database query was required. See [deployment evidence](release-evidence/2026-11-26/deployment.json).

## Executed validation

- All 21 schema objects generated locally from `schema.sql`, migration 001 and migration 002 match remote sqlite_master definitions after stripping comments, whitespace, quoting and IF NOT EXISTS. Defaults, constraints and indexes are included. Only Cloudflare's `_cf_KV` is additional. Remote `PRAGMA quick_check` returned `ok`. No migrations were reapplied. Before fixtures, app_data had zero rows, so existing real-data preservation cannot be inferred from that count. Local migration smoke verifies a pre-migration legacy row survives with revision 1. [Schema comparison](release-evidence/2026-11-26/schema-comparison.json).
- All eight regression commands passed, including 109 unit assertions, email/auth, security, workspace isolation, consent, deployed bundle parity, recovery drafts, recurring spend, CSV round trips, JSON restore, currency correction and SQLite migration/transaction tests. [Results](release-evidence/2026-11-26/regression-results.json).
- Authenticated deployed API smoke passed: missing precondition 428; stale write 409; simultaneous PUT requests yield exactly one 200 and one 409; winning payload persists; tenant isolation; EUR amount round trip; mixed currency rejected with 400; currency relabelling rejected with 422; rejected writes leave both stored payload and revision unchanged; default-denied consent, enable/revoke/isolation; logout invalidates session. [Log](release-evidence/2026-11-26/api-smoke.log).
- Eleven browser assertions passed in headless Chromium and installed Google Chrome with separate contexts: cloud hydration, browser save, visible stale conflict, retained local draft across reload, winning data in a fresh session, account isolation, no silent legacy upload, deliberate visible-control import, original 87.65 EUR preserved, local backup retained, imported amount/currency persisted into another browser. [Assertions](release-evidence/2026-11-26/browser-results.json) and [log](release-evidence/2026-11-26/browser.log).

API and browser tests used disposable `example.invalid` identities and short-lived sessions provisioned only in the verified preview database. This exercises real handlers and D1 but is not fresh proof of email delivery. Previous sign-in and invitation inbox receipt/acceptance were user-confirmed on candidate `7402a85` on November 24; those completed manual steps were not repeated. Browser saves exercised actual application save functions; import used the visible control. This is not an exhaustive click-through of every feature or cross-engine browser coverage.

Synthetic users, sessions, memberships, accounts, app_data and consent records were removed in a finally block. No session/token/credential values are committed. [Cleanup](release-evidence/2026-11-26/cleanup.json).

No new application bug was found in these checks. The branch already contains the intervening currency, transactional membership and consent fixes. No production release is authorized by these passes.

## Remaining gates

1. Preview has no AI provider key. Successful external AI processing remains untested; consent controls passed. Supply a preview-only credential if successful processing is part of the release scope.
2. Production backup identifier and successful restore into a separate database remain unverified. Execute only after explicit authorization for that production access and associated infrastructure.
3. Safari/Firefox, mobile/accessibility, exhaustive navigation and expired-trial UI are outside these executed browser assertions. Treat any required broader UAT as a separate release gate.

## Backup, rollback and production release checklist

Preparation only; no steps below authorize production actions.

- [ ] Obtain explicit approval for production backup/access, migrations, configuration changes, merge and deployment, with owner and maintenance window recorded.
- [ ] Freeze the release SHA and capture existing production deployment ID, configuration names/binding IDs, migration state and current D1 Time Travel bookmark/time. Keep secrets out of PRs.
- [ ] Export production D1 to restricted encrypted storage, record timestamp, database ID, checksum and retention owner. Do not commit the export or customer records.
- [ ] Restore the export into a separate isolated D1 database. Verify schema, row counts, quick_check, representative redacted revision/data preservation and app read/write behavior. Record restore duration and evidence; a completed export alone is not a restore test.
- [ ] Establish recovery objectives, write-freeze procedure and reconciliation of writes after the backup. Restoring an old snapshot can lose newer writes; obtain explicit incident approval before doing so.
- [ ] Inspect production schema first. Apply only missing migrations in order after verified backup. Never reapply migration 002 if version exists; never assume IF NOT EXISTS repairs incompatible consent tables.
- [ ] After approval, release API and browser assets together. Validate login, workspace isolation, current-revision saves, stale rejection, consent and currency preservation. Old clients without If-Match receive 428; require refreshed assets.
- [ ] Monitor authentication/save errors and conflict rates. Define abort triggers before release: data loss, tenant leakage, currency changes, failed auth or persistent server errors.
- [ ] Code rollback: select a known-good production deployment compatible with versioned writes and consent enforcement. Do not blindly restore pre-CAS code; it reintroduces stale overwrites. Keep additive schema in place. Do not drop version/consent tables to undo an application deployment.
- [ ] Data rollback: after explicit authorization, stop writes, preserve the failed state, restore the verified backup/bookmark using the agreed recovery plan, reconcile post-backup writes and rerun integrity/auth/isolation/save checks before reopening writes.
- [ ] Preview recovery uses a new preview deployment of the tested SHA, with sst-preview isolation checked again. Preserve the immutable tested URL above. Cloudflare Pages production rollback does not accept preview deployments as rollback targets.

References: [D1 commands and export](https://developers.cloudflare.com/d1/wrangler-commands/), [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/).
