# Cloudflare preview and D1 release gate (draft PR #33)

**Do not merge to main or point a preview at the production `sst-trial` D1 binding.** Production Pages auto-deploys on merge; get the owner's explicit approval first.

## Required evidence before production approval
Record all of the following in the PR before requesting a merge:
- Preview Pages deployment URL and immutable Git commit SHA.
- Preview D1 database name and ID, plus evidence that it differs from production D1. Do not paste credentials.
- Schema/migration application log, database integrity check and a sample query showing preserved app_data revisions.
- Redacted end-to-end test results for authentication, two isolated accounts, invite redemption, version conflicts, consent enable/revoke, legacy import and recovery drafts.
- Production D1 backup identifier and proof of a successful restore into a **separate** database.
- Explicit go/no-go decision and production deployment authorization.

**Current evidence:** See [November 26 validation](release-readiness-2026-11-26.md) for the exact tested deployment, verified preview binding, complete migration comparison, live concurrency/currency checks and browser results. Production backup/restore and successful external AI processing remain unverified. Green CI alone is not a release gate.

## Preview database
1. Create a **new** Cloudflare D1 database dedicated to this preview (for example `sst-preview-security`). Never use the production `sst-trial` database or its ID.
2. Apply `schema.sql` first, then `migrations/001_workspace_ai_consent.sql` and `migrations/002_app_data_version.sql` **in that order**. Migration 002 is intentionally single-use; record its application. For an already populated DB, take and verify a backup before migrating.
3. Configure the **preview** Pages environment's `DB` binding to the preview database ID and preview-only email/API credentials. Keep production bindings and secrets unchanged.
4. Deploy the PR branch as a preview, verify the preview URL and environment bindings in Cloudflare, and run the checklist below with disposable test accounts.
5. Verify in the actual D1 preview database that AI settings begin disabled; one opt-in and revoke generate distinct audit events; existing app_data rows retain JSON data and have `version >= 1`.

## End-to-end checks
- Register through magic link, ensure only one redemption succeeds, verify session expiration and logout, and test expired 7-day trial.
- Join via invitation, confirm replay fails and an address in another workspace is rejected; suspend a member and confirm both reads and writes fail.
- Two different workspaces must not see each other's saved contracts, subscriptions or settings.
- Open the same workspace in two browsers. Save a change from browser A, then from stale browser B. B must receive HTTP 409, display the conflict, keep its local changes, and **must not overwrite** A's data.
- Enable AI as owner/admin after disclosure, verify an ordinary member cannot change consent, revoke, and verify subsequent extraction is blocked without any outbound AI call.
- Review imported legacy amounts and currencies manually. No currency rewrite, browser-local upload, or sample-data injection may happen without an explicit action.
- Open a workspace with an existing unsynced browser draft. Verify automatic saves pause, the draft can be exported, and it is never silently uploaded or overwritten on reload. Explicit discard must remove only that workspace's draft.
- Sign out of workspace A and into workspace B in the same browser. Verify A's draft remains intact, B cannot see or overwrite it, and no global recovery key is modified. Test pre-auth page initialization and failed hydration.
- Confirm the `/api/data` GET response contains the authenticated `workspaceId`, never an identity supplied by the browser, and that malformed workspace identities fail closed.
- Test the invite and auth rate limiter when D1 is unavailable; it must not allow unbounded sends.
- Confirm all navigation, mobile layouts, accessibility controls, notifications and production isolation.

## Current automated scope
`npm run check`, `npm test`, `node tests/security-regression.mjs`, `node tests/workspace-isolation.mjs`, `node tests/ai-consent.mjs`, and `python3 tests/migration-smoke.py`.

The SQLite smoke test is a **local simulation**, not proof that Cloudflare's remote D1 migration or preview deployment succeeded. Never claim release readiness until preview tests and binding verification have been completed.

## Rollout and rollback
- Back up production D1 and verify backup restoration in a separate DB before scheduling release.
- Apply migrations in dependency order before deploying the versioned API code; old clients without `If-Match` receive 428 after deployment, so clear stale assets/browser cache on release.
- Ensure API and browser assets deploy together, test user login, data writes, AI consent and rollback behavior.
- Migration 002 is additive, but rollback to the prior app code may ignore the revision field and could permit stale overwrites. Treat rollback as an engineering decision, not a blind revert.
- Require owner approval before any production D1 migration or main merge.

## Read-only verification of the existing `sst-preview` database

The auth investigation already identified a dedicated preview database (`sst-preview`), so **do not create or rebind a new database merely to inspect it**. Before running a migration, inspect the current schema. These commands require an authorized Cloudflare CLI session; they must not be run against `sst-trial`:

```sh
npx wrangler d1 execute sst-preview --remote --command "SELECT name, type FROM sqlite_master WHERE type IN ('table','index') AND name IN ('accounts','app_data','workspace_ai_settings','workspace_ai_consent_events','idx_ai_consent_account') ORDER BY name;"
npx wrangler d1 execute sst-preview --remote --command "PRAGMA table_info(app_data);"
npx wrangler d1 execute sst-preview --remote --command "PRAGMA integrity_check;"
npx wrangler d1 execute sst-preview --remote --command "SELECT COUNT(*) AS total_rows, SUM(CASE WHEN version IS NULL OR version < 1 THEN 1 ELSE 0 END) AS invalid_versions FROM app_data;"
```

**Interpretation:** If `app_data.version` already exists, **never reapply migration 002**; it contains an `ALTER TABLE ... ADD COLUMN` and is not idempotent. If the column is missing, the last SELECT will fail as expected: do not treat that as evidence of corrupt data. Back up the preview database first, then apply only the missing migrations, after confirming the existing `accounts` and `app_data` schema. `CREATE TABLE IF NOT EXISTS` does not repair an incompatible existing table, so compare columns before treating migration 001 as complete. If `app_data` is missing entirely, stop and inspect the initialization history rather than blindly applying migration 002.

Do not output customer contract JSON, email addresses, secrets or magic-link URLs as evidence. Record only the redacted schema, counts, integrity result, preview DB ID and deployment SHA. These read-only commands do not establish that a backup can be restored or that end-to-end tenant isolation works; those remain separate release gates.

## Validation evidence — 2026-11-24

- Operator terminal screenshots confirm authenticated Wrangler access to remote `sst-preview` (ID `ccdbb7a7-9cb5-45d7-8bac-8b8024626fc8`).
- `app_data.version` is INTEGER NOT NULL DEFAULT 1 with CHECK (version >= 1).
- `workspace_ai_settings` and `workspace_ai_consent_events` exist with account references, boolean constraints, default-disabled settings and required audit fields. Do not reapply either migration solely for verification.
- Operator confirmed email receipt and successful sign-in on the Codex auth-fix preview. This is not yet proof of the latest development deployment's behavior.
- GitHub comparison confirms the Codex auth-debug branch is an ancestor of development commit `7402a853e684eaf4d9d516f6c57aca30d755b671`. CI run 45359080169 and security run 45359080049 both succeeded for that commit.
- Still required: latest immutable preview URL and binding evidence, integrity and revision-count queries, live multi-account and browser regression evidence, and authorized backup/restore rehearsal. Production release remains blocked.

## Repeatable live API validation

From an authorized local checkout of the latest development commit, independently confirm the immutable eight-character Pages preview URL and its actual DB binding to sst-preview. Use two newly created disposable, entitled owner workspaces with no saved state. Set PREVIEW_URL, PREVIEW_DB_VERIFIED=sst-preview, PREVIEW_TEST_CONFIRM=disposable-empty-workspaces, PREVIEW_OWNER_A_COOKIE and PREVIEW_OWNER_B_COOKIE in the local process environment. Cookie values are full Cookie header values; do not commit, log, paste or transmit them to chat. Run npm run test:preview. The runner rejects production hostnames, redirects, nonempty workspaces and missing binding attestation; the attestation is not an independent binding check. It writes synthetic state, exercises concurrent revision conflicts, enables and revokes AI consent, and logs out owner A. Use fresh disposable accounts on reruns. Verify consent is disabled even if the runner fails. Record the deployment SHA, redacted PASS/FAIL output and independent D1 evidence. Browser UI, member permissions, invitation replay, audit rows and backup/restore remain separate gates.
