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
