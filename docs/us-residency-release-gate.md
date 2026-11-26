# Infrastructure decision and release gate
Retain Cloudflare Pages/Workers/D1 for the current release. US database residency is a target, not a verified current fact. D1 jurisdiction can only be selected at creation. Reference: https://developers.cloudflare.com/d1/configuration/data-location/
1. Inspect existing production and preview jurisdiction using read-only dashboard/API evidence.
2. If required, create a separate US-jurisdiction preview database using wrangler d1 create sst-preview-us --jurisdiction=us. Use synthetic data only.
3. Apply migrations and run complete release tests. Verify jurisdiction, bindings, tenant isolation and restore procedures.
4. Before any production migration obtain explicit approval, freeze writes and scheduled jobs, export a protected backup, verify integrity, create a separate US jurisdiction destination, restore and compare schema and exact row contents. Keep original database unchanged and restricted.
5. Switch bindings only after validation; run smoke checks before opening writes. Rollback after new writes requires reconciliation, not a blind binding switch.
6. Verify compute processing, logs, backups and subprocessors separately; D1 jurisdiction does not constrain Workers execution.
7. Do not promise US-only processing or zero operator access without evidence.
AWS portability: preserve explicit tenant scoping and transactional invariants, isolate database adapters incrementally, test PostgreSQL compatibility before migration. No AWS resources or production changes authorized by this document.


## Observed current database evidence (2026-11-26)
Operator-provided Wrangler D1 info output reports:
- sst-trial: running_in_region APAC, jurisdiction null, read replication disabled, 11 tables.
- sst-preview: running_in_region APAC, jurisdiction null, read replication disabled, 12 tables.
These are primary-region observations and do not constitute a contractual residency attestation. No US restriction is configured. Existing database jurisdiction cannot be changed in place.

## Next isolated preview step
Create a new empty database, without changing either existing binding:
`npx wrangler@latest d1 create sst-preview-us --jurisdiction=us`
Record the returned UUID. Then add it as a separate preview-only binding and apply migrations to the empty database. Do not copy production or customer data into it. Verify with:
`npx wrangler@latest d1 info sst-preview-us --json`
Expected jurisdiction is `us`. Inspect migration history, schema parity, all automated tests and browser smoke tests before any production decision.

## US preview validation update
Operator screenshots confirm sst-preview-us jurisdiction us, WNAM, foundational schema and direct SQL migrations 001–008 completed. Wrangler migrations commands returned 7404 while name-based execute succeeded; automatic migration ledger remains unreconciled. Latest operator release-suite screenshot after source parity fix shows 109 core tests passed and subsequent release checks passed; exact tested HEAD not visible. Remote column/trigger checks and empty customer table counts not evidenced yet. Before deployment create a separate access-protected Pages project with DB bound only to sst-preview-us, no production secrets or cron, and verify the binding independently. No production changes authorized.

## Remote verification evidence
Operator screenshot confirms local HEAD 4aa72a7, remote app_data.version INTEGER NOT NULL DEFAULT 1, ai_egress_audit.request_id TEXT, triggers ai_locked_insert and ai_locked_update, and zero rows in users, accounts, app_data and memberships. This verifies selected schema invariants and empty core tables, not full schema parity. Migration ledger remains unresolved. Separate Pages project must be protected by Access before uploading application assets; verify DB binding and disable AI globally, OAuth, retention jobs and production integrations initially. Do not deploy using the migration-only Wrangler configuration.
