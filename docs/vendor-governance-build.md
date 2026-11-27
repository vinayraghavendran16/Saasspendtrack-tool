# Vendor governance and accountability
Status: product requirements, not implemented. Tenant-scoped throughout.
## Ownership
Workspace defaults and vendor overrides: business, finance, technical, backup, escalation owner, shared mailbox. Internal owners must be active workspace members; external mailbox destinations require owner approval and verification. No cross-tenant lookup or automatic forwarding to external addresses. Distinguish role assignment, acceptance, provider acceptance, delivery/bounce, acknowledgement and resolution. Never treat opens as acknowledgement.
Offboarding: revoke access, identify affected assignments, atomically transfer to eligible member or mark unassigned and route to verified workspace fallback; retain organization-owned history. Quarterly ownership certification; optional directory integration later. No inference of employee departure from silence alone.
## Notifications
Vendor renewal milestones 90/60/30/14/7/1 days; notice deadline 30/14/7/3/1; missed notice alert. Configurable timezone, thresholds and channels. Finance and business owner default recipients, technical owner for technical events; deduplicate addresses; shared mailbox fallback. Unacknowledged alert escalates to backup then escalation owner, with urgency-aware configurable SLA. Acknowledgement is not closure. Require explicit renewal decision and owner. Keep sensitive contract details inside authenticated app by default.
Durable outbox with unique tenant/vendor/event/deadline/milestone/recipient key, lease, bounded retries, dead-letter state, provider acceptance versus delivery, verified bounce handling, no promise of exactly-once external delivery. Revalidate recipient membership and event revision immediately before send; cancel superseded reminders. Weekly digest for authorized recipients. Billing notices go to verified billing contact and workspace owner, not every vendor owner.
## Escalations
Separate case entity linked to vendor and optional contract, direction inbound/outbound, severity, status, owner, backup, external contact, SLA due time, next action, financial exposure with currency, evidence, timeline, resolution and root cause. State transitions audited. Separate response and resolution SLA. Manual correspondence capture initially; mailbox ingestion only after explicit integration authorization, sender verification and tenant routing. External replies never grant access or change case state automatically. Vendor health score transparent and configurable; unresolved critical cases visible at renewal approval.
## Acceptance gates
- Tenant isolation for ownership, cases, evidence, notification routing, exports and direct IDs.
- RBAC: members see permitted workspace data; authorized admins assign owners; owner approves external destinations.
- Missing owner, deactivated owner, bulk transfer, invalid destination, bounce, shared mailbox fallback, duplicate role recipient, stale queued recipient.
- Deadline timezone/DST, leap day, edited/cancelled contract, notice versus renewal date, missed scheduler tick, duplicate concurrent tick, acknowledgement versus closure.
- Provider timeout, retry, dead letter, ambiguous send outcome, duplicate webhook, no real customer email in preview.
- Inbound/outbound escalation, reassignment, SLA breach, reopen, resolution history, attachment authorization, malicious content escaping.
- Audit actor/time/tenant, data minimization, retention and deletion policy, no secrets or sensitive contract content in logs.
- Migration rehearsal and preservation of legacy alerts; exact candidate CI, browser E2E and isolated live provider sandbox before release.
## Implementation order
Inventory current subscription/contract/alert schema and UI; additive tenant-scoped migration; routing and deadline engine; outbox; ownership UI; escalation API/UI; audit and digest; integration and security validation. Do not deploy or send live emails until approved release gates pass.
