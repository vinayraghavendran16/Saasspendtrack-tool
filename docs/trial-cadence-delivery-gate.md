# Trial cadence delivery gate
Trial cadence mail defaults off via TRIAL_CADENCE_ENABLED. Do not enable until the following are implemented and verified.
- Durable unique claim per email and cadence kind, separate from historical successful email_log records.
- Atomic claim checks current trial eligibility and historical delivery.
- Persist provider acceptance before marking delivered; never automatically retry ambiguous transport failures or expired in-flight claims.
- Operator reconciliation of ambiguous claims using provider evidence, with audited resolution.
- Test simultaneous ticks, payment during claim, provider rejection, timeout, crash after acceptance, and historical sent records.
- Allocate migration numbering only after checkout integration is reconciled.
Trial expiry and optional usage retention continue independently. This gate does not disable login or welcome mail.
