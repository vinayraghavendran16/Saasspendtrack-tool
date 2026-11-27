# Department cost allocation contract (proposed, default off)
 
Department PUPM is net invoiced spend allocated to a department divided by its observed employee count for the same closed month. It is not payment, commitment, or utilization. The organization metric remains authoritative and unchanged.

## Evidence and identity
- Use reporting_financial_facts invoice/credit rows as the sole numerator source. Scope every lookup by authenticated account. Never accept a client-supplied account ID.
- Department identity must be stable and tenant-scoped; do not use mutable display names as identifiers. Verify the canonical department registry before adding foreign keys.
- Allocate each fact independently in its native currency using integer minor units. Credits retain their negative sign. No FX or cross-currency totals.
- Explicit weights in integer basis points must sum to at most 10000; the remainder belongs to an explicit unallocated bucket. Use deterministic largest remainder apportionment, with stable ID tie-breaks, to conserve every minor unit.
- Version allocations and record actor, source, rationale, fact snapshot and timestamp. Never overwrite a previously published allocation. A correction supersedes it. Stale ledger evidence invalidates the allocation until reviewed.
- Department population uses the same month and employee denominator; missing, zero, conflicting or stale population makes the ratio unavailable, not zero. Never infer historical population from current team membership.
- Do not sum or average departmental PUPM to obtain organization PUPM. Department populations may overlap; organization counts require independent evidence.
 
## Acceptance gates
- Exact conservation by fact and currency, including credits, zero, rounding and unallocated balances.
- Tenant isolation, owner-only write and read until scoped permissions are implemented, default-off feature flag.
- Atomic publication of allocation versions; duplicate department IDs rejected; concurrent publication conflicts fail closed.
- Missing allocations are unallocated, never silently spread across departments.
- UI shows allocation basis, population provenance, completeness unknown, unallocated totals and reconciled totals.
- No migration or production activation until registry and ledger lifecycle have been audited. Browser baseline must pass before new UI integration.
