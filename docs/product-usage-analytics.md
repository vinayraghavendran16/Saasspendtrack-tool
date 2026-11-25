# Product usage analytics
Status: proposed release scope; not implemented.

## Access
Workspace owner/admin: own workspace only, server-derived membership and role.
Platform owner: separate server-enforced platform-admin authorization; never infer platform role from workspace role.
No cross-tenant raw data in customer responses.

## Definitions
Provisioned: active membership; pending invitations reported separately.
Ever logged in: at least one successful authentication (historical last_login_at may provide baseline, not historical counts).
Active user: distinct member with successful meaningful product action in selected period, excluding login and passive page views.
Adoption: active users / provisioned users; show denominator and period.
Sessions: distinct application sessions with observed activity, never store session tokens in analytics.
Feature adoption: distinct actors with successful feature action.
Funnel: cohort-based, ordered milestones with explicit observation window; incomplete cohorts identified.
Workspace health: configurable inactivity and onboarding friction signals, not proven churn predictions.

## Instrumentation
Server-authoritative events: auth success, workspace provision, invitation accepted, subscription create/update, contract upload/extraction outcomes, renewal actions, AI extraction outcomes, save conflict/failure, export, entitlement conversion.
Client events: allowlisted navigation, onboarding step viewed/completed, pricing viewed, validation failure category. Client events are untrusted and separate from authoritative success metrics.
Record event ID, server timestamp, server-derived workspace and pseudonymous actor IDs, allowlisted event name, outcome, coarse error category, schema version. Deduplicate retries. Never store tokens, document text, contract values, prompts, email bodies, arbitrary URLs or free-form payloads. No session replay.
Track auth failures without attributing unauthenticated attempts to a workspace unless verified. Rate limit ingestion and bound payloads.
Analytics failure must not fail product operations; monitor dropped events.
Proposed raw retention 90 days, aggregate retention 12 months, subject to privacy review. Workspace deletion must include analytics deletion. No historical activity fabrication.

## Delivery
1. Inventory actual endpoints and feature actions.
2. Add isolated schema and typed event allowlist; test tenant boundaries and privacy.
3. Instrument server outcomes and minimal client friction events.
4. Workspace dashboard: provisioned, invited, ever logged in, active, sessions, last active, feature adoption, date/role/user filters, authorized export.
5. Platform dashboard: workspace and user activity, cohort funnel, feature adoption, failure categories, inactivity, trial conversion, workspace drilldown.
6. Verify counts with synthetic workspaces, event deduplication, permissions, retention, and performance.
Do not enable production collection before privacy notice, access controls and tests are reviewed.
