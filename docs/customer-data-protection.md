# Customer data protection requirements

Status: proposed release requirements, not certification or verified production claims.

## Security guarantees and boundaries
Default deny external AI processing. Core manual workflows must remain usable without AI. Workspace owner may enable AI only with explicit informed consent; revocation blocks subsequent requests, not previously transmitted data. A proposed owner-controlled AI lock prevents ordinary admins/members from enabling AI. Provider retention and training terms require contractual verification. Do not promise zero retention or no training without evidence.
Cloud hosting necessarily processes service data. Platform operator access to plaintext is not cryptographically prevented by current architecture. Restrict operational access, audit privileged access, prohibit routine support browsing. Future customer-held encryption keys require separate design and acceptance; do not claim zero knowledge today.

## Implementation requirements
- Inventory every outbound destination, payload category, purpose, credential and retention policy, including browser scripts, AI, email, payments, imports, integrations and webhooks.
- Centralize AI authorization and outbound requests. Default deny on missing consent, policy, database failure or unrecognized destination. Enforce workspace identity server-side; no client override. Cover extraction, assistant, renewal guide and preset generation, including model discovery and retries.
- Add workspace AI lock, explicit consent version, owner-only policy changes, audit records and privacy settings UI. Document concurrent revocation limitations and in-flight requests.
- Audit outbound AI attempts using workspace ID, feature, timestamp, destination and outcome only; no prompts, contract text, vendor names or raw provider errors. Restrict audit access to workspace admins; platform reports aggregate only.
- Minimize payloads; show users categories sent before invoking AI. No AI calls in analytics, routine reporting or background tasks.
- First-party analytics only for authenticated app; no session replay or customer data in telemetry. Review third-party browser scripts and CSP.
- Document encryption, backups, retention, deletion, subprocessors, support access and incident response with evidence; distinguish provider guarantees from product guarantees.
- Design optional customer-controlled client-side encryption separately; assess key recovery, multi-user sharing, search, reporting, metadata leakage and malicious client update threat.

## Acceptance gates
1. Fresh workspace: all AI endpoints deny; network spy sees zero provider requests, including model discovery.
2. Missing or invalid consent, missing schema, DB failure, suspended member, cross-tenant attempt and locked workspace: deny with zero provider calls.
3. Enabled workspace: only explicit authorized actions transmit documented minimized fields to allowlisted provider; no secrets or other tenant data.
4. Revocation: subsequent calls deny; audit records contain no payload. Lock cannot be bypassed through direct API calls.
5. Manual contract entry, renewal tracking, spend calculations, import/export and reporting function with AI disabled.
6. Browser network capture and server outbound mock tests verify destinations. Test preview with synthetic data only.
7. Operator access and backup/restore controls reviewed; customer-facing statements match verified evidence.
8. No production deployment without owner approval and SDLC release gates.
