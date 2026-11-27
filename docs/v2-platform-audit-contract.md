# Platform-wide audit and action provenance
Owner requirement: capture changes across the platform, from ingestion to manual edits and reporting, including mode of action.
 
## Coverage
Inventory all mutation routes, imports, background jobs, integrations, legacy workspace saves, settings, auth/access changes, contracts, invoices, employees, licenses, allocations, renewals, approvals, decisions, AI actions, report definitions, saved filters, exports and deletions. Record material report generation/export as activity, not a data mutation. Do not log every transient click by default. Record failed/denied security-sensitive actions separately from committed mutations.
 
## Event contract
Tenant ID from authenticated context; immutable event ID; server timestamp; actor type and stable actor ID; initiator and executing principal where different; action verb; entity type and stable ID; mode (manual_ui, bulk_import, integration_sync, api, scheduled_job, ai_assisted, system); outcome; correlation/request ID; batch ID; source reference; changed field names; allowlisted redacted before/after values or version references; rationale when available; schema version. Never infer mode solely from a client-provided string. AI proposals, approvals and executions are distinct events.
 
## Reliability and privacy
Successful mutation and audit event must commit atomically, or use a transactional outbox. No success event for rolled-back writes. Idempotent retries, bounded payloads, tenant-scoped indexes and cursor pagination. Legacy JSON saves need server-side diff with stable IDs, not whole-document snapshots. Never store secrets, auth tokens, raw contract text, full employee records, payment credentials or unrestricted request bodies. Use field allowlists and redaction. Audit reads/exports themselves audited. Owner-only access initially; scoped roles only after authorization design. Retention, tenant erasure, backup and legal hold policy required before activation. Append-only within retention; do not claim tamper-proof without independent integrity controls.
 
## Implementation sequence
1. Inventory existing usage, AI egress, vendor case, payment, decision and financial audit sources; distinguish activity from audit and identify gaps.
2. Shared event schema, mode taxonomy, redaction, atomic writer and tests.
3. Integrate every mutation surface module by module; start with department allocations and population changes. Maintain a route coverage matrix and CI checks; no claim of full coverage until verified.
4. Owner audit explorer, filters by actor/mode/entity/time/action, change details, correlation timeline, export controls.
5. Tenant-specific descriptive learning from authorized, minimized events only; no cross-tenant learning, no causal inference from action logs, no raw sensitive payloads to AI.
 
Default off for new explorer and learning; do not alter frozen V1 or deploy production. Audit capture rollout must be reviewed independently of explorer visibility.
