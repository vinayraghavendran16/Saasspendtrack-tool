# Payment queue review — 2026-11-27

Baseline: release candidate 8f281f9954743966dc407fa7b6692452d29afe2c.

Finding: the previous processor calculated one lease timestamp before iterating up to 20 notifications. A slow batch could allow later items to begin with a lease that was already partly consumed or expired. Each item now receives its own lease immediately before its atomic conditional claim. Completion updates remain fenced by that item's lease timestamp.

Validation added: tests/payment-notifications.mjs verifies distinct per-item leases and lease-fenced completion using a deterministic D1 stub.

Limitations: this is not an exactly-once email guarantee. A worker crash after provider acceptance but before recording acceptance can cause a retry and duplicate email unless the provider supports an idempotency key. Provider acceptance is not proof of inbox delivery. Scheduled invocation, secret configuration, and live delivery remain deployment gates.

This branch is separate from the frozen release candidate. Do not merge without full CI and engineering review.
