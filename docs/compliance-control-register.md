# Compliance control register
Status: proposed controls, not certification. Owners below are roles, not confirmed appointments.

| Control | Proposed owner | Evidence | Cadence |
|---|---|---|---|
| Privileged access and MFA | Security owner | Access inventory, MFA evidence, revocation records | Quarterly and on departure |
| Change management | Engineering | Reviewed PR, exact SHA CI, release approval and rollback record | Each release |
| Vulnerability management | Engineering | Dependency scans, triage and remediation records | Weekly and each release |
| Recovery | Operations | Encrypted backup, restore result, measured RTO/RPO | Quarterly and before migrations |
| Incident response | Security owner | Incident log, severity assessment, notification decisions | Each incident; annual exercise |
| Vendor assurance | Privacy owner | DPA, subprocessor register, transfer assessment | Annual and on change |
| Data rights | Privacy owner | Verified request, scope, response and deletion evidence | Each request |
| IP provenance | Legal owner | Contributor assignments, asset provenance, dependency licence inventory | Each release |
 
## Proposed retention schedule (requires approval and legal review)
- Magic links: delete expired/used tokens after 24 hours.
- Sessions: delete expired/revoked sessions after 24 hours.
- Rate-limit identifiers: delete inactive counters after 48 hours, subject to maximum configured rate-limit window and abuse investigation needs.
- Security audit logs: propose 90 days online, longer only for documented necessity.
- Payment records: retain according to applicable accounting/tax obligations; confirm jurisdictions.
- Backups: define bounded retention, isolated access and deletion propagation; no unapproved deletion of existing backups.
- Customer content: contractually defined deletion/export window; legal holds documented.
 
## GDPR request workflow
Verify identity proportionately; establish controller/processor role and workspace authority; locate data across primary systems and subprocessors; assess exceptions and third-party rights; respond within applicable statutory deadlines; record decisions without duplicating sensitive content. For processor-held workspace data, coordinate with the controller. Assess breach notification obligations and timing under Articles 33 and 34.
 
## Evidence gaps
No independent SOC 2 audit, operating-period evidence, approved retention schedule, executed DPA inventory, verified trademark clearance or contributor assignment evidence has been established by this register. No runtime enforcement is implemented here.
