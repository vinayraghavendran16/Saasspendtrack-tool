# Security remediation and compliance register
Baseline: 92aaace6abd0ac408797a523bd715e9fb4d1f65b. Status: static review; dynamic tests not run. No production authorization implied by this document.

## Release gates
- SEC-001: webhook signature verification exists but product, amount, currency and completed payment status must be matched to an approved server-side catalogue. Confirm actual Razorpay link IDs and settlement currencies before enabling automatic activation. Test wrong product, partial payment, wrong currency, missing identity, duplicate and concurrent events using synthetic signed fixtures only.
- SEC-002: active entitlement currently has no expiry check. Confirm annual term and legacy grandfathering; preserve existing paid access until billing records are reconciled. Test renewal, expiry, refund and duplicate events.
- SEC-003: session IDs are stored as bearer credentials. Introduce hashed storage with an explicit migration and compatibility plan covering every session writer, reader, logout and fixture helper. Test old sessions, new sessions, revocation and expiry.
- SEC-004: durable unique payment event ledger and atomic entitlement updates; do not rely on the latest payment ID alone.
- SEC-005: remove customer email and transaction amounts from routine webhook logs; retain minimal event metadata.
- SEC-006: document and enforce retention of rate-limit identifiers, login tokens, sessions, audit events and backups.
- SEC-007: review trial commencement on verified login and abuse protections.
- Verify privileged MFA, CSP compatibility, API cache controls, dependency and licence scans, full write freeze and safe rollback.
- No unresolved high-risk findings without remediation and validation. No production mutations or real payment tests.

## SOC 2 Type II readiness
Collect dated evidence of access reviews, MFA, change approvals, CI, incident response, vulnerability management, vendor reviews, backup recovery, monitoring, retention and staff security responsibilities. Define system boundaries and applicable Trust Services Criteria with an independent CPA. No attestation claimed.

## GDPR readiness
Map controller/processor roles and data flows; verify lawful bases, notices, Article 28 DPA, subprocessors, international transfer safeguards, records of processing, rights requests, deletion/backup retention, breach response and DPIA applicability. AI consent is not blanket GDPR compliance. Verify production residency separately from US preview.

## IP and trademark
Verify legal entity and contributor assignments, source and asset provenance, third-party licences, AI-generated code review and confidential information controls. Perform India/US trademark clearance and assess descriptiveness and Classes 9/42 with counsel. No registration or clearance claimed.

## Evidence convention
Record exact SHA, test environment, method, result, date and residual risk. Distinguish static findings, historical evidence, fresh tests and independent assurance. Do not store customer data or secrets in Git.
