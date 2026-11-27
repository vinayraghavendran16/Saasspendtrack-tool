# Commercial schema audit
Migration filenames explicitly referenced in existing smoke tests:
- 001_workspace_ai_consent.sql
- 002_app_data_version.sql
- 005_usage_events.sql
- 006_ai_policy_lock.sql
- 007_ai_egress_audit.sql
- 008_ai_audit_correlation.sql
PR 42 changes include 028–034; PR 46 changed-file listing returned no migration matches, which does not prove absence from its base. Full migration directory enumeration and live D1 inspection remain required. Existing commercial-pricing.js is reused. Do not create duplicate pricing, usage or headcount tables until their actual DDL and read/write paths are inspected.
