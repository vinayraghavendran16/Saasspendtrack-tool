# Offline release checkpoint — 2026-11-26

Decision: HOLD production. Cloudflare dashboard access has resumed. Wrangler remains unauthenticated in the release workspace. Do not modify Access policies, credentials, production or database bindings as a workaround.

## Evidence boundaries
- Application candidate `538cdc3`: release regression suite and all 16 browser checks passed in Chromium, Firefox, and WebKit ([CI run](https://github.com/vinayraghavendran16/Saasspendtrack-tool/actions/runs/45870290593)).
- US Preview 63477a2c / 13b4d92: historical authenticated API and synthetic E2E evidence in us-preview-readiness-2026-11-26.md. Corrected browser UI not yet verified live.
- Earlier development preview and restore evidence in final-release-gates-2026-11-26.md is historical, not certification of this integrated candidate. Earlier restore covered migrations 001–002; do not claim production-data restore compatibility with 003–008 without separate validation.
- Earlier synthetic cleanup.json is for the development preview, not the US Preview run sst-us-e2e-20261126-8b731.
- Browser validation used synthetic data. WebKit coverage does not certify Safari on Apple devices.
- Candidate packaging succeeded locally: 23 allowlisted static assets and a compiled Pages Functions Worker.

## Offline gates
- [x] Release regressions and browser checks passed at `538cdc3`.
- [x] Synthetic full-chain migration and backup/restore checks passed. Production-data restore compatibility for migrations 003–008 remains open.
- [ ] Owner review of backup/key custody, retention, recovery objectives and acceptable downtime. No assumptions about these decisions.

## Deferred live gates
- Wrangler authentication on the deployment Mac and isolated Preview deployment completed.
- Dashboard preflight verified the Preview environment binds `DB` to `sst-preview-us`, AI is globally disabled, and the owner-only Access application covers the base and wildcard Preview hostnames. Both the base and current immutable hostname redirected unauthenticated requests. Reverify the immutable deployment after upload.
- Preview-only usage secret configured and authenticated usage reporting verified.
- All 23 live assertions passed on the immutable candidate. Both synthetic runs were cleaned up and scoped counts verified zero.
- Confirm production migration state and fresh authorized backup/restore plan, no customer-data transfer without approval.
- Separate explicit production authorization. No merge, deployment, migrations, DNS, cron or AI changes authorized by this checkpoint.

## Recovery sign-off for the integrated candidate

The local drill was rerun and passed on the tested application tree. It verified all eight migrations, legacy row/currency preservation, exact synthetic snapshot restoration, database integrity, and exclusion of a write committed after the snapshot. The earlier isolated D1 restore with production data covered migrations 001–002. Its bulk SQL import hit `SQLITE_TOOBIG`; parameterized restoration succeeded.

Before production approval, record the following and attach the evidence to the candidate:

| Decision or evidence | Required record |
| --- | --- |
| Recovery point and downtime | Owner-approved maximum tolerable data loss and downtime, plus the maintenance window. |
| Backup and key custody | Owner-approved off-device location, separately controlled recovery key, retrieval verification and retention for the backup and isolated copy. Record identifiers only. |
| Production-data restore | With approval, record a fresh snapshot, isolated unbound D1 target, actual migration state, parameterized restore results, missing migrations applied in order, integrity and redacted row comparisons, and elapsed recovery time. |
| Post-snapshot writes | Record the write-freeze or reconciliation procedure, the snapshot cutoff, who reconciles later writes, and validation before reopening writes. |
| Rollback target | Record the known-good production deployment and verify that it preserves revision-checked saves and consent enforcement. Keep additive schema during code rollback. |

Use the [existing release and rollback checklist](release-readiness-2026-11-26.md#backup-rollback-and-production-release-checklist) for execution. Production data and credentials stay outside Git.

### Rollback baseline review

The repository's `main` baseline `ec812b4` writes workspace snapshots with an unconditional upsert. The release application `538cdc3` requires a matching revision on updates and advances the stored revision with the write. Reverting to the `main` implementation after migration could overwrite newer data while leaving its revision unchanged. Do not designate that baseline as a write-enabled rollback target.

Before the maintenance window, capture the actual production deployment ID and source, and verify a production-eligible rollback target against the migrated schema in isolation. Until that verification passes, the rollback target remains open. The Git branch comparison alone does not identify the currently serving production deployment.

## Live US Preview validation — 2026-11-27 IST

- Immutable deployment [6e85ac8f](https://6e85ac8f.saasspendtrack-preview-us.pages.dev), ID `6e85ac8f-4056-4772-8e8f-decd24894adb`, application source `538cdc3`, live runner `75cd29e`.
- The first run passed 22 checks. The JSON export assertion failed after reload. The runner was updated to wait for the synthetic workspace to hydrate, then the retry passed 23 checks with zero failures on the same deployment.
- The fixture helper verified the isolated US Preview database binding and AI-disabled flag. The operator's Terminal output confirmed scoped cleanup left zero rows after each run. No private fixture manifests are included.
- Production remains on hold pending recovery sign-off and explicit authorization.

## Recovery rehearsal — 2026-11-27 IST

- Read-only production schema inspection confirmed the AI consent tables and `app_data.version INTEGER DEFAULT 1`. Tables introduced by 003–008 were absent.
- A fresh 708,015-byte production export was encrypted on the operator's Mac and verified by decryption. The in-memory restore of that snapshot passed migrations 003–008, integrity and foreign-key checks, and exact row comparison across all 11 pre-existing application tables.
- Migrations 003–008 also passed on the earlier separate D1 restore `sst-restore-validation-20261126` (`31d88e3c-911c-4dde-bdfe-886cba572722`). Operator output showed `quick_check = ok`, no foreign-key violations, and the `ai_egress_audit.request_id` column. The fresh snapshot was exercised locally; the remote rehearsal used the earlier restore.
- Recovery sign-off, a verified fallback or tested write-freeze recovery path, and explicit production authorization remain open.
