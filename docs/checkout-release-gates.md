# Payment release gates
Production activation is prohibited until every gate is evidenced and approved.
## Historical founding allocation
Reconcile distinct historical founding purchasers in the payment ledger against provider exports and legacy manual entitlements. Resolve duplicate identities, refunds and workspace mapping manually. Do not assume zero historical customers. Preserve historical records. The new checkout slot allocator currently does not count legacy allocations; implement a durable allocation mechanism and test it before live activation.
## Operational monitoring
Monitor unresolved provider claims, created checkouts past expiry, signed webhook 503 responses, ledger-to-checkout mismatches and remaining founding capacity. Alert on unresolved claims older than 15 minutes. Do not log secrets, raw webhook payloads or customer email addresses in operational alerts.
## Read-only synthetic diagnostic queries
SELECT count(*) FROM checkout_provider_claims WHERE completed_at IS NULL AND claimed_at < (CAST(strftime('%s','now') AS INTEGER)*1000-900000);
SELECT count(*) FROM checkout_intents WHERE status='created' AND expires_at < CAST(strftime('%s','now') AS INTEGER)*1000;
SELECT count(*) FROM checkout_intents c LEFT JOIN payment_ledger p ON p.payment_id=c.payment_id WHERE c.status='paid' AND (p.payment_id IS NULL OR p.link_id<>c.link_id OR p.amount<>c.amount OR p.currency<>c.currency);
SELECT count(*) FROM checkout_intents WHERE founding_slot IS NOT NULL;
## Release evidence
Require green CI at exact candidate SHA, isolated D1 binding verification, actual test-mode provider response validation, signed webhook replay and concurrent delivery tests, owner/non-owner HTTP tests, historical allocation reconciliation, rollback rehearsal and explicit production approval. Monitoring queries above are not a deployed alerting service.
