# V1 release acceptance

No production deployment is authorized by this document.

## Before deployment
- Pin the reviewed commit and require all CI workflows green on that exact commit.
- Reconcile payment branch independently; do not enable dynamic checkout until test-mode payment, webhook replay and entitlement checks pass.
- Verify production project, database UUID, runtime flags and secret presence without printing secret values.
- Export a fresh production database backup, verify integrity and rehearse migrations against an isolated copy.
- Record current deployment ID, migration inventory and maintenance policy.
- Obtain explicit owner approval.

## Acceptance
- Verify magic-link login, logout, workspace isolation, member roles, trial entitlement, version conflicts and currency safeguards.
- Verify dashboard filters, mobile layout, contract import, renewal dates and financial reporting using synthetic data.
- Verify AI disabled/consent behavior and audit access.
- Verify scheduled notification configuration and absence of duplicate delivery before enabling schedulers.
- Keep unvalidated features disabled.

## Rollback
- Stop rollout on authorization bypass, cross-tenant exposure, data corruption, payment mismatch or sustained critical endpoint errors.
- Reinstate maintenance protection and disable affected feature flags.
- Roll back application deployment only after confirming schema compatibility.
- Never restore a stale database over newer customer writes without reconciliation and explicit approval.
- Record incident evidence, affected scope, recovery validation and owner approval before reopening.
