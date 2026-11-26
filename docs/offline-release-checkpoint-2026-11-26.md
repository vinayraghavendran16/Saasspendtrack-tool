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
- Authenticate Wrangler in the release workspace and review relevant audit logs before configuration changes.
- Dashboard preflight verified the Preview environment binds `DB` to `sst-preview-us`, AI is globally disabled, and the owner-only Access application covers the base and wildcard Preview hostnames. Both the base and current immutable hostname redirected unauthenticated requests. Reverify the immutable deployment after upload.
- Configure missing USAGE_HMAC_SECRET only in Preview, deploy exact tested application and verify usage API.
- Repeat affected UI workflows on immutable post-fix deployment; clean up only exact synthetic fixture run.
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
