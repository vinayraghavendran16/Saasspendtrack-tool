# US preview readiness — 2026-11-26

## Decision

**Deployed to isolated US Preview; live authenticated workflow validation remains pending.** The dedicated US D1, Pages Production/Preview environment configuration, Access owner-only policy, release package, and preview deployment are verified as described in the latest verification section. Do not promote this preview to production without a separate explicit approval.

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
- **Outstanding validation:** authenticated browser/API workflows (save and stale-write conflict against live D1, tenant separation, consent/audit screens, accessibility and full live E2E) could not run because this task has no authorized Cloudflare Access session in the app and no app-level synthetic workspace sessions. No cookies, OTPs, or customer data were read or stored. AI remains globally disabled. Local regression coverage for these behaviors passed, but it is not a substitute for live end-to-end evidence.
- Scope check: deployment target was only `saasspendtrack-preview-us`; no main merge, production application/database/DNS/cron/Access policy change, customer-data migration, or AI enablement occurred.
