# Checkout sandbox runbook
Do not deploy this branch to production. Use a separate Pages project and synthetic D1 database; verify the binding UUID against the production UUID before applying migrations. Keep AI and live payment integrations disabled.
- Rehearse migrations 001–031 (or all migrations present) on the isolated database.
- Build with scripts/build-preview-us.mjs --include-checkout.
- Configure CHECKOUT_ISOLATED_SANDBOX, CHECKOUT_RESERVATIONS_ENABLED, CHECKOUT_PROVIDER_ENABLED and CHECKOUT_TEST_WEBHOOK_ENABLED as true only in the isolated project.
- Configure Razorpay test key ID, test key secret and separate test webhook secret directly in Cloudflare. Never commit credentials.
- Configure test-mode payment_link.paid webhook to the isolated project /api/razorpay/test-webhook. Confirm webhook reachability without bypassing access controls on other routes.
- Test owner and non-owner access, two simultaneous checkout attempts, successful payment, duplicate webhook, invalid signature, expired unpaid link and recovery after uncertain provider response.
- Verify ledger, checkout events, entitlement and founding slot after each scenario.
- Disable flags after testing. No production migration, payment or deployment is authorized by this runbook.
