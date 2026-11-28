# Trial-only legacy payment reconciliation

The release owner assigns a named payments operator and a separate approver before deploying. The operator must have read access to the intended Razorpay merchant and production D1 review metadata. Use the existing private access route and an authenticated session listed in `ADMIN_EMAILS`. The application endpoint `GET /api/admin/legacy-payment-reconciliation` is read-only. Follow its `next` cursor via `?after=` to inspect the entire unresolved queue.

## Investigate and record the outcome

1. Open a restricted case. Record the review key, review version, event type, received time, reason and any original or conflicting amount and currency. Use UTC for the case timeline. Keep raw webhook bodies, secrets, card data and customer contact details out of the queue and case notes.
2. In Razorpay **Live Mode** for production, look up the exact `pay_…` reference. Verify the merchant, capture and refund state, amount and currency in minor units, and the associated order and product. Establish the intended workspace independently using the provider's product association and the approved product and price evidence. A page ID, public slug, email or event name alone is insufficient.
3. For a digest-only row, search provider delivery history using the event type and received time. Hash the exact signed request body locally and compare it with the review key before using its reference. If provider evidence is unavailable, retain the row and escalate it to the release owner and Razorpay support.
4. Cross-check `payment_ledger` and `legacy_payment_ids` for the reference before deciding how to handle it. Record the provider evidence reference, verified product and price, whether prior credit exists, the decision and both reviewers in the restricted case. Acceptable outcomes include already credited, unrelated product, refund confirmed, or processing through a separately approved and verified entitlement path. Leave incomplete or contradictory evidence unresolved. This queue does not perform refunds or activate or revoke entitlements.
5. After approval, use an individually authorized D1 update to mark only that row resolved. In the update, set `resolved_at` and set `resolution_ref` to the approved case ID. Match the exact `review_key`, the reviewed `review_version`, and `resolved_at IS NULL`. Require exactly one affected row and read it back. Record the timestamp, version and result in the case. If the update matches no row, re-read the case and investigate new evidence. Never delete the review record. New contradictory evidence can reopen the row. The approved case retains the prior decision.

## Late Payment Link events

When the catalogue is absent, empty or unreadable, a signed `payment_link.paid` with usable payment evidence is queued as `missing_link_catalogue`. HTTP 200 means the evidence was durably recorded for review. It does not confirm entitlement. If the payment evidence is malformed, its digest is queued and HTTP 422 is returned. Storage failure returns HTTP 503 so Razorpay can retry. A present catalogue still requires the exact verified `plink_…`, amount, currency and customer validation before automatic credit. A reference with conflicting evidence cannot be automatically credited, even after its review row is marked resolved.

Do not synthesize catalogue entries for Payment Pages or use a signed amount as the sole price authority. Reconcile late captures through the procedure above. Check the queue regularly and alert on persistence faults or provider delivery failures. Razorpay's retry window is limited. [Razorpay webhook retries](https://razorpay.com/docs/webhooks/best-practices)

## Initial trial-only launch

Email magic links are the launch sign-in method. Keep `OAUTH_ENABLED=false` and dynamic paid checkout disabled. Google and Microsoft registration, live SSO testing, and Razorpay checkout remediation are separate workstreams. Keep AI processing, trial email cadence, trial delivery health, payment queue automation, and usage retention disabled.

The authenticated legacy webhook remains in scope for payment reconciliation. Keep its signing credentials and subscriptions in place. Leave the catalogue unset unless separately approved with provider evidence. The review queue handles late signed payment events without granting access.

## Production approval gates

1. Keep public maintenance active. Record the verified retirement of all eight legacy SaaS Spend Track Payment Pages. They showed zero sales and units in Live Mode. Check the provider backlog and undelivered events independently, including Razorpay support ticket `22112509`.
2. Confirm the named reconciliation operator and separate approver. Verify the operator's `ADMIN_EMAILS` authorization after email sign-in over the authorized private test route. Cloudflare Access success and the app login screen verify only the outer access layer.
3. Review the exact artifact SHA, its CI, the fresh protected backup and rehearsal, and the production D1 ledger. At preflight, confirm 001–027 are recorded and 033 is absent. Hold all production writes until the owner approves the reviewed candidate. Migration 033 must be separately approved for the pinned database and applied before deploying the code that uses it. Leave 028–032 outside this release.
4. Keep maintenance on during deployment and private smoke testing. Verify email magic-link sign-in, owner lifetime access, tenant boundaries and reconciliation access with the approved test accounts. Public reopening requires a separate approval.
