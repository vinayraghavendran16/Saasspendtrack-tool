# V1 operational follow-ups
- Renewal queue uniqueness prevents duplicate rows, not exactly-once external email delivery. Verify concurrent worker claims and ambiguous provider outcomes before enabling scheduled sends.
- Trial email cadence currently checks email_log before sending; concurrent ticks can duplicate messages. Keep scheduler disabled until delivery claim and recovery policy is verified.
- Query performance: inspect EXPLAIN QUERY PLAN against representative synthetic data for retention, renewal scans and financial reporting. Do not add indexes blindly or introduce migration numbering conflicts with checkout.
- Browser acceptance: exercise session expiry during save, failed network request, 409 revision conflict, retry without losing unsaved input, mobile navigation and dashboard filters.
- No production changes or deletion authorized. Record exact tested commit and evidence for each gate.
