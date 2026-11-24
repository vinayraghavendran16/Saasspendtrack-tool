# Cloudflare preview and D1 release gate (draft PR #33)

**Do not merge to main or point a preview at the production `sst-trial` D1 binding.** Production Pages auto-deploys on merge; get the owner's explicit approval first.

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
