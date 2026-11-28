# Checkout sandbox release evidence
Verified checkpoint: d0cf5ff73bf0a6035d27de30dd35b0d7eb408e7e. All five GitHub workflows passed.
The subsequent preflight script must pass CI before selecting a new candidate.
## Preflight
Run node scripts/checkout-sandbox-preflight.mjs <dedicated-project> <dedicated-db-uuid> <exact-head-sha>.
The script only checks local inputs, clean checkout, known database exclusions and builds assets. It does not establish remote isolation or deploy.
Independently verify the actual Pages project, D1 binding, access policies, synthetic data and test-mode credentials.
## Rollback
Disable all checkout flags in the dedicated sandbox project, disable the test webhook, restore the previous known-good sandbox deployment if available, and retain ledger and checkout audit data. Never reverse migrations or delete payment records automatically. Verify disabled endpoints return 503 and the original preview remains unaffected.
## Open gates
Actual provider responses, authenticated role tests, webhook delivery, full payment transaction, remote binding verification, historical customer reconciliation, operational alerts and explicit production approval remain outstanding.
