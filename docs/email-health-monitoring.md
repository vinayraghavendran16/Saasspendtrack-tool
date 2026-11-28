# Email health monitoring

Current implementation emits email_provider_health structured logs with bounded provider and outcome values. It does not persist counters or send alerts.

## Dashboard contract

Owner-only access using requireAdmin; no customer identifiers. UTC hourly buckets, provider, accepted count, failure count by fixed outcome. Acceptance rate = accepted / attempts; zero attempts displays no data. Distinguish provider acceptance from synthetic inbox delivery. Do not expose raw logs.

## Proposed alerts

Critical: 5 consecutive failed synthetic sign-in checks or 5 failures out of at least 5 attempts in 15 minutes. Warning: failure rate >= 20% with >= 10 attempts in 15 minutes. Deduplicate by provider and alert class for 60 minutes; resolve after 2 healthy windows. Deliver alerts through an independent channel, not the failing provider. Thresholds are provisional and require validation.

## Storage and rollout

Prefer Cloudflare log aggregation or Analytics Engine with explicit preview binding and cost review; do not introduce a production D1 migration in frozen V1. Proposed retention 30 days for aggregates, subject to operational and compliance review. Test authorization, missing binding, zero traffic, duplicate alerts, outage and recovery. No production changes without approval.
