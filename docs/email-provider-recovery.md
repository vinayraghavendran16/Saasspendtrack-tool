# Transactional email recovery

ZeptoMail remains the default. Explicit EMAIL_PROVIDER=resend selects Resend for all transactional sends; this is not automatic failover. Never retry automatically after ambiguous acceptance or timeout.

## Preview configuration

- Use an isolated preview workspace, verified sender domain and sending-only Resend API key stored as a Cloudflare secret RESEND_API_KEY.
- Set EMAIL_PROVIDER=resend, FROM_EMAIL and REPLY_TO to approved addresses. Keep secrets out of source, screenshots and logs.
- Verify provider DNS records without replacing existing mail records blindly; reconcile SPF and DKIM with existing providers.
- Test magic link, single use, expiration, correct preview origin, invitation and welcome delivery. Check inbox and spam, provider acceptance is not proof of delivery.
- Exercise rejected credentials, timeout, rate limits and unknown provider; confirm no cross-provider requests or sensitive logs.

## Recovery and release

Record sanitized provider status, timestamp and incident reference. Do not record recipients, message bodies or authentication links in diagnostics. For rollback select EMAIL_PROVIDER=zeptomail only after confirming Zoho is healthy; otherwise retain maintenance. Never switch production credentials or reopen public access without explicit approval. PR #58 is separate from frozen PR #56. Migration 033 and payment reconciliation remain subject to their own gates.

## Monitoring design (not implemented)

Aggregate provider acceptance/failure counts by provider and error class, with no email addresses or tokens. Alert on sustained failures with a minimum sample size; expose only aggregates to authorized platform owners. A synthetic inbox check is required to distinguish acceptance from delivery. Trial activation changes are separate and require entitlement and migration review.
