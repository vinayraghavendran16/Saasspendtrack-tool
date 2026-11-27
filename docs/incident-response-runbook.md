# Incident response runbook
Proposed; owner appointments, contacts, monitoring and tabletop validation outstanding.

1. Detect and record UTC discovery time, reporter, affected systems and evidence references. Never copy credentials or customer contract contents into tickets.
2. Triage: critical for suspected cross-tenant disclosure, privileged compromise or widespread data loss; high for credible limited compromise or major service disruption. Assign incident commander and privacy lead.
3. Contain using approved least-disruptive controls: revoke compromised credentials, isolate affected components, freeze relevant writes if necessary. Preserve evidence and document actions. Do not destroy logs or customer data.
4. Assess scope, data categories, affected tenants, confidentiality/integrity/availability impact and ongoing risk. Record when awareness of a personal data breach is established.
5. Notify: when acting as processor, notify affected controllers without undue delay. When acting as controller, assess GDPR Article 33 supervisory authority notification within 72 hours of awareness unless unlikely to pose risk; document delays and decisions. Assess Article 34 communication without undue delay for high-risk breaches, subject to statutory exceptions. Check contractual and other jurisdiction-specific obligations.
6. Recover from verified clean state; test tenant isolation, authentication, integrity and rollback before reopening. Record measured recovery times.
7. Complete root cause analysis, corrective actions, owners and deadlines; preserve incident records under approved retention and legal holds.
 
## Tabletop scenarios
Cross-tenant disclosure; stolen administrator credential; compromised email provider; invalid payment activation; failed migration; AI provider disclosure. For each record detection, escalation, containment, notification decision, recovery and lessons learned.
 
## Evidence
Incident register, access logs, timeline, approvals, notification decisions, recovery tests and corrective-action closure. No live monitoring, emergency contacts, operating effectiveness or completed exercise asserted.
