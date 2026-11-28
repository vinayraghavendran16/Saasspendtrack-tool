# Combined V1 integration checklist
Comparison against validation/v1-notification-gap-20261128: checkout reserves migrations 028–032; hardening has no numbered migrations. Shared changed path package.json requires manual reconciliation preserving both test suites. Verify current heads again before integration; checkout may change independently.
Create a separate integration branch only after checkout owner confirms a stable checkpoint. Assign trial delivery schema the next unused migration number, run combined migration rehearsal and both release and checkout workflows. Keep trial cadence and health flags disabled until schema and operator procedures are verified.
Scheduler now prioritizes active trials; historical expired rows can still starve under sustained load. Before enabling cadence, implement eligible-job pagination and test >500 accounts.
Do not merge to production or activate payment or email flags without explicit approval.
