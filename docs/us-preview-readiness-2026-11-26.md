# US preview readiness — 2026-11-26

## Decision

**The auth-link fix is deployed and owner-verified live magic-link login passed on US Preview.** Local and CI gates pass; authenticated synthetic-workspace E2E, accessibility and responsive UI validation remain outstanding. Do not promote this preview to production without a separate explicit approval.

## Candidate and repository

- Repository: `vinayraghavendran16/Saasspendtrack-tool`
- Branch: `release/production-integration-20261126`
- `git pull --ff-only`: already up to date before work began.
- Tested implementation/config commit: `58880fe347ba6dcb4d352f908fdf68407efa2e16`
- Local `npm run test:release`: passed on that exact SHA; includes syntax checks, 109 unit assertions, authentication/email, extraction validation, security regression, tenant isolation, migration smoke, consent/lock, currency/revision, browser-cache safety, and the new preview asset allowlist test.
- GitHub Actions `Development security checks`: success on the exact SHA, run [45734528383](https://github.com/vinayraghavendran16/Saasspendtrack-tool/actions/runs/45734528383).

The implementation/config commit adds the verified preview database ID, a static asset allowlist builder, its regression test, and local-secret/Wrangler-state ignores. It does not change application runtime code. This document is evidence-only and describes the commit above.

## Cloudflare infrastructure

`wrangler whoami` confirmed the existing Wrangler OAuth session belongs to `vinayraghavendran16@gmail.com`. No token or secret value was printed. Wrangler reported the account scopes include Pages and D1 access, but no Access/Zero Trust write scope.

The authoritative read-only `wrangler d1 info sst-preview-us --json` response returned:

- UUID: `1f35200e-11ae-498d-a7a7-a0909259084c`
- Jurisdiction: `us`
- Primary region: `WNAM`
- Read replication: disabled

This is the UUID used in `wrangler.preview-us.toml`. Cloudflare defines D1 jurisdiction at creation time; there is no per-binding jurisdiction option to add. The binding points at the already-created US database. The file explicitly names Wrangler's default `d1_migrations` table and `migrations/` directory. [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/) · [D1 migration configuration and ledger naming](https://developers.cloudflare.com/d1/reference/migrations/)

The `saasspendtrack-preview-us` Pages project exists at `https://saasspendtrack-preview-us.pages.dev`, with production branch `main` and no deployments yet. Its Production and Preview environment configurations now both show exactly one D1 binding, `DB` → the verified US D1 UUID, and the following plain-text flags/URL:

```text
APP_URL=https://saasspendtrack-preview-us.pages.dev
AI_GLOBAL_DISABLED=true
OAUTH_ENABLED=false
USAGE_RETENTION_ENABLED=false
```

Only this new Pages project was configured. The existing production project, production database `sst-trial`, APAC preview database, production DNS, cron jobs, and existing Access applications were not changed. No customer data was migrated.

After the prior evidence commit, a read-only Access applications API query succeeded (HTTP 200) and found no application matching either `saasspendtrack-preview-us.pages.dev` or `*.saasspendtrack-preview-us.pages.dev`. The authorized create request for a project-only application covering both host patterns and allowing only `vinayraghavendran16@gmail.com` returned HTTP 403. No Access application or policy was created or changed.

## Schema and migration reconciliation

The remote D1 `sqlite_master` table, index, and trigger definitions were compared with an in-memory SQLite database initialized from `schema.sql`, then migrations 001–008 applied in filename order. All 37 expected application objects matched exactly. There were no missing or unexpected application objects and no DDL differences. Cloudflare's internal `_cf_KV` object was excluded. This comparison included the `app_data.version` default/check, all migration-added tables and indexes, both AI lock triggers, and `ai_egress_audit.request_id`.

Before ledger reconciliation, aggregate counts were zero in `users`, `sessions`, `accounts`, `memberships`, `app_data`, `invites`, `workspace_ai_settings`, `workspace_ai_consent_events`, and `ai_egress_audit`. No row contents were read.

The schema had been applied by direct SQL before this work, so `d1_migrations` did not exist and Wrangler listed all eight files as pending. After exact schema parity was established, the standard Wrangler ledger structure was created and only the eight filenames were inserted. No migration SQL was rerun. `wrangler d1 migrations list ... --remote` now reports **no migrations to apply**. The ledger's `applied_at` field records the reconciliation time, not the unavailable original direct-SQL execution time.

SHA-256 of migration files in the tested commit:

| Migration | SHA-256 |
|---|---|
| `001_workspace_ai_consent.sql` | `8657a81e183ba0e979547ea2610c529d821b39e25a1b7ce56a25374d18820d7b` |
| `002_app_data_version.sql` | `52e311d48e19e81624bb1d6271922f84dd30e233973d7d867c3ed07d12c793e7` |
| `003_oauth_identity.sql` | `622c755bfb033e1c5bf7b05f24b6c8da1caf950a7a9a93d95b1dc1ae9220ff80` |
| `004_platform_settings.sql` | `a6820a3b174091cdc069806b4489e1ea0091d157605c43890c9c7eb37dc05c72` |
| `005_usage_events.sql` | `e53b3dd9330b64d8ea3dcdd1c4027229e54f3f44efeee39dd3062fec5d7c443e` |
| `006_ai_policy_lock.sql` | `16ffd187eaa11f40c38712ceb5584ad2805ba10af4161eb2dd67cffe1b5791c4` |
| `007_ai_egress_audit.sql` | `5530b743efc9d4d9acad9c2f6c872f824740c80bcdea0d2f83707af926e42b53` |
| `008_ai_audit_correlation.sql` | `8031a7426bd9d2fed8efced1cb513ca7102f3381a2d78b0445d5b5e57cef7851` |

## Deployment package and test scope

`npm run build:preview-us -- --out /private/tmp/sst-preview-us-assets-final` produced an allowlisted static package of 23 files: the app entry point, its PWA icons/manifest/service worker, Pages headers/redirects, and the 12 indexed vendor guides. It excludes repository source files, `admin.html`, docs, tests, migrations, environment files, git metadata, and Wrangler local state. Pages Functions remain under the repository-root `functions/` tree for Wrangler's Pages build rather than entering the static asset directory.

`wrangler pages functions build` compiled the Functions successfully and generated a route manifest with 29 `/api/*` routes. The Functions Worker build is server-side output; the allowlisted static artifact does not include the Functions source tree or internal owner bundle. As with any browser application, the public HTML necessarily contains code executed by the browser; Cloudflare Access must protect the project before that HTML is deployed.

The release tests include an AI gateway test that stubs `fetch` and verifies `AI_GLOBAL_DISABLED=true` produces zero provider calls, alongside consent, destination allowlist, lock, tenant authorization, and revocation checks. This is local regression evidence, not a deployed network capture.

## Pre-deployment gate (resolved by dashboard verification and preview deployment below)

The owner manually created the Access application. The current Chrome dashboard session then allowed read-only inspection of its exact destinations and policy. Wrangler/API Access read and auth-log endpoints remain unavailable to the CLI identity; dashboard evidence is recorded in the latest section below.

Do not recreate the Access application. Cloudflare's Pages documentation requires separate protection for the project `*.pages.dev` hostname and preview deployment aliases; each must be inspected and tested before the first asset upload. [Pages Access known issue and setup](https://developers.cloudflare.com/pages/platform/known-issues/) · [Access application API permissions](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/list/)

The existing Access app/policy was inspected read-only in the dashboard and the exact tested application commit was deployed only to the US Pages Preview environment. The latest section separates verified live edge protection from app-authenticated workflows that still need an authorized session.

## Historical resume verification — 2026-11-26 (commit `fb7a02b6de671c21fb3d379cedd2e7dc25b8d0d9`)

- Release branch was clean at the requested commit. Its only difference from the previously tested application commit `58880fe347ba6dcb4d352f908fdf68407efa2e16` is this evidence document.
- The existing Wrangler login successfully read the Pages project and D1. The Pages project API reported no deployment yet. Production and Preview both bind only `DB` to `sst-preview-us` UUID `1f35200e-11ae-498d-a7a7-a0909259084c`; both retain `AI_GLOBAL_DISABLED=true`, `OAUTH_ENABLED=false`, and `USAGE_RETENTION_ENABLED=false`.
- `wrangler d1 info sst-preview-us --json` confirmed jurisdiction `us`, primary region `WNAM`, and disabled read replication. `wrangler d1 migrations list sst-preview-us --remote --config wrangler.preview-us.toml` reported **No migrations to apply**.
- `npm run test:release` passed on this commit, including syntax checks, 109 unit assertions, AI gateway/consent, workspace isolation, platform-owner authorization, currency preservation, migration smoke, revision-conflict coverage, browser-cache checks, and the preview asset allowlist.
- `npm run build:preview-us -- --out /private/tmp/sst-preview-us-assets-fb7a02b` rebuilt the 23-file static allowlist. Pages Functions compiled successfully and emitted 29 `/api/*` routes. The package and Functions output remain in temporary storage; no assets were uploaded.
- Unauthenticated requests to both `saasspendtrack-preview-us.pages.dev` and `test.saasspendtrack-preview-us.pages.dev` returned HTTP 302 to the Cloudflare Access login host. The Access applications list endpoint returned HTTP 200 with zero results. However, the current Wrangler OAuth scope list has no Access application read permission, so the empty result is not authoritative. The dashboard opened in a signed-out session.
- The observed redirects verify that an Access login gate is active on those two tested hostnames. They do **not** establish the owner-only email rule or demonstrate denial of a different identity. Since the existing Wrangler login lacks Access application read permission and the dashboard session is signed out, the owner-only policy and unauthorized-identity test remain unverified.

**Historical status at that checkpoint:** hold before upload; no deployment existed. This status was superseded by the owner’s later manual dashboard verification and the deployment/evidence below. No Access application was recreated or changed, no customer data was migrated, and no production resource was modified.

## Deployment and post-deployment verification — 2026-11-26

- Evidence branch: `release/production-integration-20261126`, starting from `fcd19b862f73fe43fc320b2dc31fa2f783f11e69`. Tested application/config source commit: `58880fe347ba6dcb4d352f908fdf68407efa2e16`. The difference from `fcd19b8` is release evidence documentation only; no application behavior changed.
- Access application was inspected read-only in the signed-in Cloudflare dashboard. Application: `saasspendtrack-preview-us.pages.dev`, ID `4ba82fa7-e7f5-461d-b476-f6391a650e7e`. Destinations show the base host and `*.saasspendtrack-preview-us.pages.dev`. The app has exactly one attached policy: `SST US Preview – Owner Only`, action Allow, policy ID `e2f97155-22c9-4f5f-8b4a-5faa23b4b71d`, one rule. Policy details show one Include email rule for `vinayraghavendran16@gmail.com`; no Bypass or extra Allow policy was visible. Dashboard Policy Tester showed the owner identity as allowed. This is dashboard-observed evidence, distinct from API evidence.
- Access authentication logs could not be retrieved: the existing Wrangler/API identity received HTTP 403 for Access auth-log/policy endpoints, and the dashboard logs view did not render usable entries. Therefore no explicit log event proving an unauthorized login denial was captured. The user’s manual Incognito test (unauthorized email received no OTP) remains owner-attested and not conclusive by itself. The single owner-only Include rule plus Access default-deny and no Bypass/extra Allow policy provide configuration-level denial evidence; no independent unauthorized identity successfully authenticated.
- Before deployment, the project had no latest deployment, consistent with the owner’s earlier post-OTP HTTP 522. This supports the inference that the 522 was caused by the absent Pages origin/deployment; it was not reproduced after deployment.
- `wrangler pages deploy` uploaded the 23-file allowlisted static package from the exact tested source commit and included the repository-root Pages Functions bundle. Deployment ID: `fceabc94-06db-4968-9e59-67ae41a615eb`; environment **Preview**; Cloudflare source metadata `58880fe`; branch `release-production-integration-20261126`. Immutable URL: [https://fceabc94.saasspendtrack-preview-us.pages.dev](https://fceabc94.saasspendtrack-preview-us.pages.dev). Branch alias: [https://release-production-integrati.saasspendtrack-preview-us.pages.dev](https://release-production-integrati.saasspendtrack-preview-us.pages.dev).
- After deployment, unauthenticated requests to the immutable URL, branch alias, and project hostname returned HTTP 302 to Access. At the immutable URL, `/`, `/api/me`, `/api/data`, `/admin.html`, `/schema.sql`, `/migrations/001_workspace_ai_consent.sql`, `/.env`, `/.git/config`, and `/functions/api/me.js` all returned HTTP 302 before application assets or endpoints could be read. This verifies edge protection for representative app and internal paths; it does not itself prove the outcome for a particular authenticated unauthorized identity.
- The US D1 read-back still reports database `sst-preview-us`, UUID `1f35200e-11ae-498d-a7a7-a0909259084c`, jurisdiction `us`, region WNAM, and read replication disabled. Wrangler reports **No migrations to apply**. The previously verified Pages Production and Preview configs point `DB` only to this UUID and retain `AI_GLOBAL_DISABLED=true`, `OAUTH_ENABLED=false`, `USAGE_RETENTION_ENABLED=false`, and the US preview `APP_URL`.
- `npm run test:release` passed locally after deployment from the release branch: syntax checks, 109 unit assertions, security regressions, workspace isolation, AI gateway/consent, currency preservation, migration smoke/CAS conflict, browser-cache safety, and asset allowlist checks. The deployment output confirms successful Functions bundle upload; the bundle is generated by Wrangler from the exact source commit.
- GitHub Actions `Development security checks` passed on evidence commit `19816d22f31f18a6d9bab74f43d1548f54b38418`, run [45773820351](https://github.com/vinayraghavendran16/Saasspendtrack-tool/actions/runs/45773820351). The deployed application source remains the tested `58880fe` commit; subsequent commits changed release evidence only.
- **Outstanding validation:** authenticated browser/API workflows (save and stale-write conflict against live D1, tenant separation, consent/audit screens, accessibility and full live E2E) could not run because this task has no authorized Cloudflare Access session in the app and no app-level synthetic workspace sessions. No cookies, OTPs, or customer data were read or stored. AI remains globally disabled. Local regression coverage for these behaviors passed, but it is not a substitute for live end-to-end evidence.
- **Sign-in email blocker confirmed after deployment:** the owner’s browser showed “Send failed — try again” for `vinayraghavendran16@gmail.com`. The initial read-only secret listing found no secrets. After the owner saved the ZeptoMail key, a fresh listing showed `ZEPTOMAIL_TOKEN` in the **Production environment of the isolated `saasspendtrack-preview-us` Pages project**, while the **Preview environment still has no secrets**. Values remain encrypted and were never read. `functions/_shared/email.js` requires `ZEPTOMAIL_TOKEN` and returns `no_token` when it is absent, while `/api/auth/request` reports `emailed:false` and the UI displays the observed failure. The screenshot’s environment selector showed Production; the deployment listing confirms the project currently has only the Preview deployment `fceabc94-06db-4968-9e59-67ae41a615eb` and no Production deployment. This is not the existing live production Pages project, and no production app deployment or change was made by this work. For the preview test, set the secret under the project's **Preview** environment and set `ZEPTOMAIL_URL=https://cpaas.zoho.in/v1.1/email` there to match the copied key’s Mail Agent endpoint; keep the sender authorized. Remove the misplaced key from this isolated project's Production environment through the dashboard if it is intended to remain preview-only. Then redeploy Preview and retry sign-in. The app E2E gate remains blocked until delivery and link redemption succeed.
- Scope check: deployment target was only `saasspendtrack-preview-us`; no main merge, production application/database/DNS/cron/Access policy change, customer-data migration, or AI enablement occurred.

## Preview email redeployment and final validation — 2026-11-26

- The owner confirmed the encrypted `ZEPTOMAIL_TOKEN` and `ZEPTOMAIL_URL` were saved in the isolated project's Preview environment and the misplaced Production secret was removed. A fresh Wrangler secret listing verified `ZEPTOMAIL_TOKEN` is encrypted in **Preview** and that the project's **Production** secret list is empty. The configured endpoint value was not read by Wrangler; its configuration is owner-attested from the dashboard. Neither secret value was accessed.
- Redeployed only to `saasspendtrack-preview-us` using the existing validated 23-file package and Functions source from application commit `58880fe347ba6dcb4d352f908fdf68407efa2e16`. Wrangler compiled the Functions bundle and completed the upload. New deployment ID: `b344120a-04b1-45ec-a620-fcff884904bd`; environment **Preview**; branch `release-production-integration-20261126`; Cloudflare source metadata `58880fe`. Immutable URL: [https://b344120a.saasspendtrack-preview-us.pages.dev](https://b344120a.saasspendtrack-preview-us.pages.dev). This redeployment changes no application source behavior.
- Fresh unauthenticated HTTP checks of the immutable deployment URL, branch alias, and project hostname each returned HTTP 302 with a Cloudflare Access redirect. This confirms the login gate remains active across all three host forms. Owner-only policy configuration remains backed by the prior dashboard-observed evidence above; no auth log event was available to independently prove a denied unauthorized login.
- `npm run test:release` passed after this redeployment from release branch HEAD `8d15bf51d4b79d2c3f782dff3de4cb442441f017`. It passed syntax validation, 109 unit assertions, the authentication/email and extraction contract suites, security and tenant-isolation checks, currency/revision/migration/consent checks, browser-cache and deployed parity tests, and the 23-file asset allowlist test. In particular, mocked email-provider paths pass; these do not prove a live provider accepted or delivered an email.
- GitHub Actions `Development security checks` passed for evidence HEAD `8d15bf51d4b79d2c3f782dff3de4cb442441f017`, run [45776211137](https://github.com/vinayraghavendran16/Saasspendtrack-tool/actions/runs/45776211137). The deployed application source remains the tested `58880fe` SHA; the later release commits are documentation-only.
- **Magic-link test remains blocked, not passed.** Chrome is signed in to the owner’s account, but the available browser-control bridge failed with “Browser attachment requires a network policy.” Therefore no request was sent, no message receipt was claimed, and no OTP or sign-in URL was accessed. The release still needs the owner’s authenticated request to the new deployment and confirmation that the message arrives and redemption succeeds. Do not treat the API mock tests as live email evidence.
- **Live authenticated product E2E remains pending** for the same session-control reason. Local security, workspace isolation, AI consent, audit, migration, currency and stale-write suites pass, but have not been represented as live authenticated preview tests. AI remains disabled.
- PR #33 currently targets `main` from `development/cloud-foundation-audit`, not this release branch. The US preview deployment is from the release branch's already-tested application SHA; this release evidence must not be described as code included in PR #33. No PR branch or description was changed from this session.
- Scope check: this redeployment targeted only the isolated US Preview project. No production project, production database, DNS, cron, customer data, Access configuration, AI setting, or main branch was changed; no merge or production deployment occurred.

## US preview magic-link origin fix — 2026-11-26

- Root cause: `functions/_shared/auth-url.js` trusted HTTPS subdomains of `saasspendtrack.pages.dev`, but not `saasspendtrack-preview-us.pages.dev`. The auth-request handler therefore built the sign-in link from the inherited `APP_URL`, which could send the owner away from the deployment that issued the link.
- The host check now accepts HTTPS subdomains under either Pages suffix, validates DNS-label syntax and hostname length, and rejects credentials, non-HTTPS URLs, malformed labels, and suffix lookalikes. Requests for the existing production app continue to use configured `APP_URL`; the existing `saasspendtrack.pages.dev` behavior is preserved.
- Regression coverage exercises the existing Pages preview domain, the new US immutable deployment URL and branch alias, the production hostname/configured URL, malformed hosts, HTTP, and malicious lookalike suffixes. Handler-level tests verify generated magic links and successful post-authentication redirects resolve to the originating preview deployment; production continues to redirect to its configured application URL.
- Full `npm run test:release` passed locally after the fix, including syntax checks, 109 unit assertions, email/auth integration, tenant isolation, AI-off/consent, migration, currency/revision, security, browser cache, and asset allowlist suites. GitHub Actions `Development security checks` passed on exact code commit `13b4d925492a3e04ef667ce95eb04d8aa9787def`, run [45779562655](https://github.com/vinayraghavendran16/Saasspendtrack-tool/actions/runs/45779562655).
- Rebuilt the explicit 23-file preview allowlist from code commit `13b4d92`; Wrangler compiled and uploaded the root Pages Functions bundle. Deployed exclusively to `saasspendtrack-preview-us`, environment **Preview**, branch `release-production-integration-20261126`. Deployment ID: `63477a2c-09d6-4e31-a2d0-1662dec17e59`, source `13b4d92`. New immutable URL for owner testing: [https://63477a2c.saasspendtrack-preview-us.pages.dev](https://63477a2c.saasspendtrack-preview-us.pages.dev). Branch alias: [https://release-production-integrati.saasspendtrack-preview-us.pages.dev](https://release-production-integrati.saasspendtrack-preview-us.pages.dev).
- Fresh unauthenticated requests to the immutable deployment URL, branch alias, and project hostname all returned HTTP 302 redirects to Cloudflare Access. The owner-only Access policy was not modified.
- Fresh read-only D1 inspection confirmed `sst-preview-us` UUID `1f35200e-11ae-498d-a7a7-a0909259084c`, jurisdiction `us`, region WNAM, read replication disabled; Wrangler reports no migrations to apply. `wrangler.preview-us.toml` continues to bind `DB` to that UUID. The Pages deployment record identifies the new build as **Preview**. Pages environment bindings and feature flags were not changed by this deployment; the previously verified Preview binding points to this same isolated D1 and `AI_GLOBAL_DISABLED=true` remains in force.
- The deployment package includes Pages Functions routing; Wrangler successfully compiled and uploaded the Functions bundle containing the updated `authAppUrl`. Regression tests verify request-link creation and successful post-auth redirects for both Pages preview suffixes, and configured production redirect behavior.
- **Owner-verified live authentication PASS:** the owner confirmed successful magic-link login on deployment `63477a2c`. This is owner-attested evidence; no mailbox, OTP or sign-in token was accessed by Codex.
- AI remains globally disabled. No production configuration, DNS, Access policy, customer data, or main branch was changed. Deployment is authorized only to the isolated `saasspendtrack-preview-us` Preview environment.

## Authenticated E2E follow-up — 2026-11-26

- Updated the live API smoke harness to accept only HTTPS origins on `saasspendtrack-preview-us.pages.dev` (the project hostname or one deployment/branch alias), reject malformed hosts, non-HTTPS, credentials, ports and lookalikes, and require the explicit `PREVIEW_DB_VERIFIED=sst-preview-us` confirmation before any mutation. New regression tests verify the target guard. This is test tooling only; no Pages redeployment is required for this change.
- `npm run test:release` passed after the harness change. It includes local persistence/CRUD, tenant isolation, optimistic concurrency, session invalidation, currency validation/preservation, AI consent and zero-egress guards, audit/privacy suites, import/export round trips, accessibility-related static regressions, and asset/security checks. These use local stubs/fixtures and do not count as live Preview results.
- **Live authenticated E2E remains blocked:** the browser-control bridge returned “Browser attachment requires a network policy,” and none of the local disposable Preview session variables are available. The live smoke harness requires two distinct empty synthetic workspace sessions and refuses nonempty workspaces. No owner workspace was mutated, and no session cookie was requested, read or exposed. Live checks for CRUD persistence, tenant isolation, concurrent writes, contract management, consent/audit screens, export behavior, session invalidation, accessibility and responsive layouts therefore remain unverified in Preview.
- The owner-verified login proves magic-link redemption and Access for that owner session; it does not substitute for two-tenant synthetic E2E or UI review. The report records that distinction explicitly. AI remains globally disabled and the previous D1, Access, environment and deployment checks remain unchanged.
