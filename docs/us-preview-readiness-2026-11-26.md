# US preview readiness — 2026-11-26

## Decision

**HOLD before deployment.** The dedicated US D1 and the new Pages project's Production and Preview configuration are verified. The release candidate and Functions package pass local validation. The app has not been deployed because the authenticated Wrangler session lacks Cloudflare Access application permissions, and Access protection must be verified before any application assets are uploaded.

## Candidate and repository

- Repository: `vinayraghavendran16/Saasspendtrack-tool`
- Branch: `release/production-integration-20261126`
- `git pull --ff-only`: already up to date before work began.
- Tested implementation/config commit: `58880fe347ba6dcb4d352f908fdf68407efa2e16`
- Local `npm run test:release`: passed on that exact SHA; includes syntax checks, 109 unit assertions, authentication/email, extraction validation, security regression, tenant isolation, migration smoke, consent/lock, currency/revision, browser-cache safety, and the new preview asset allowlist test.
- GitHub Actions `Development security checks`: success on the exact SHA, run [45734528383](https://github.com/vinayraghavendran16/Saasspendtrack-tool/actions/runs/45734528383).

The implementation/config commit adds the verified preview database ID, a static asset allowlist builder, its regression test, and local-secret/Wrangler-state ignores. It does not change application runtime code. This document is evidence-only and describes the commit above.

## Cloudflare infrastructure

`wrangler whoami` confirmed the existing Wrangler OAuth session belongs to `vinayraghavendran16@gmail.com`. No token or secret value was printed. Wrangler reported the account scopes include Pages and D1 access, but no Access/Zero Trust application scopes.

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

## Required before deployment

The current Wrangler identity response did not include Cloudflare Access application read/write scopes. An Access applications API read was attempted, but the automatic approval review timed out before that request ran. No Access application or policy was created, read, or changed. There are no Pages deployments yet, so unauthorized access has not been tested. No application assets were deployed.

The Cloudflare Access API requires an Access application read permission to inspect existing apps and an Access/Zero Trust write permission to create the two project-only protections. Configure the Pages `*.pages.dev` hostname and deployment-alias wildcard for this project only, allow only `vinayraghavendran16@gmail.com`, inspect for overlaps, and test both an authorized and an unauthorized identity before the first app deployment. Cloudflare documents separate protection for the project host and preview deployment aliases. [Pages Access known issue and setup](https://developers.cloudflare.com/pages/platform/known-issues/) · [Access application API permissions](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/list/)

After the Access scopes are available: deploy this tested SHA only to `saasspendtrack-preview-us` on a non-production branch; confirm the deployment still binds exclusively to `sst-preview-us`; then run deployed synthetic authentication, save/conflict, tenant isolation, AI-disabled egress, smoke, accessibility, and browser end-to-end checks. Do not merge or deploy to production as part of this preview gate.
