# V1 cutover runbook — 2026-11-27
Decision: HOLD until final exact commit and live gates pass. This is a procedure, not production authorization.

## 1. Pin and inspect (read-only)
Record exact candidate SHA, all five successful workflow runs, actual production deployment ID/source, Cloudflare account/project, production DB binding and migration ledger. Use a clean checkout. Run npm ci, npm run test:release. Do not use repository root as static assets. Run npm run build:preview-us (without --out, to allocate a unique temporary directory); inspect returned allowlist and functions inventory. Deploy only this directory from the checkout with Pages Functions, using verified preview project/branch. Never infer production settings from wrangler.toml.

## 2. Isolated live validation
Confirm preview DB is distinct from production; Access restrictions active. Test magic-link delivery/redeem/replay, two tenant isolation, save revisions, consent, extraction with synthetic data and approved provider configuration, expired trial read-only, middleware rejection and allowed same-origin browser mutations. Test payment in isolated provider test mode with test-specific credentials/catalogue, replay and renewal, outbox invocation and delivery. No real payments. Keep OAuth/AOP/commercial reports and retention disabled pending their own approvals. Verify public assets and response headers. Record results against immutable deployment URL.

## 3. Recovery and maintenance
Record approved 60-minute maintenance window and recovery target; actual recovery time must be measured. Verify encrypted backup off-device retrieval and separate key custody. Before snapshot, block customer writes and authentication/provisioning mutations at ingress, pause cron and integrations, and drain in-flight operations. Preserve or reconcile incoming payment events; never acknowledge an event without durable capture. app_data freeze triggers alone do NOT freeze all writers. Export fresh snapshot, encrypt, verify decryption and restore to unbound isolated D1. Rehearse every missing migration through 027 on that snapshot, verify integrity, FK checks and exact legacy row comparisons. Record redacted evidence and elapsed time. Stop if migration ledger differs, any writer remains uncontrolled, or recovery fails.

## 4. Approved production cutover
Only with explicit go-live approval: confirm exact tested SHA and bindings again. Apply only missing migrations in order, stop at first failure. Verify schema, data and integrity before deployment. Deploy allowlisted assets and Functions, verify immutable deployment and actual production binding. Maintain write freeze until smoke checks pass. Validate authenticated customer flow and payment configuration without unauthorized real charges. Resume writes and scheduled jobs only after owner sign-off; reconcile payments and monitor errors, outbox dead rows and entitlement discrepancies.

## 5. Abort/recovery
Keep ingress closed if any gate fails. Do not blindly restore a stale snapshot over later writes or revert to the legacy unconditional-upsert application. Keep additive schema for compatible code rollback; use only a rehearsed revision-safe deployment. If unavailable, remain in maintenance and repair forward or execute the approved recovery plan with post-snapshot reconciliation. Never delete isolated customer-data copies without explicit authorization.

## Open gates
Combined exact-head CI; independent security approval; live middleware and payment configuration; full production snapshot rehearsal through 027; off-device key retrieval; actual rollback target; scheduler and dead-letter monitoring. No secrets, customer values or backup contents in Git.
