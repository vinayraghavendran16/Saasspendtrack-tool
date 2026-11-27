# Semantic metric catalogue v0.1
All metrics require definition version, authorized scope, period/as-of, native currency, provenance, freshness, completeness. Missing data is unknown, not zero. No cross-currency sums without explicit FX policy.
| ID | Definition | Basis |
|---|---|---|
| commitment.monthly | recurring amount divided by billing cycle months | active subscription snapshot |
| commitment.annualized | monthly commitment times 12 | run rate, not actual |
| spend.invoiced | eligible invoice facts less credits | normalized ledger, period |
| spend.paid | confirmed payment facts only | unavailable unless payment evidence exists |
| licence.unassigned | purchased minus assigned | known counts only |
| licence.unused | purchased minus utilized | known counts only |
| opportunity.unused_cost | unused fraction times recurring cost | estimate, not savings |
| exposure.renewal | contractual commitment at risk | contract terms |
| savings.projected | selected alternative expected benefit | decision revision |
| savings.reconciled | approved baseline less eligible observed cost | financial review |
| savings.attested | reconciled outcome with owner attestation and exclusive allocation | not independent audit |
| budget.variance | actual eligible spend minus approved comparable budget | matched period/scope/currency |
| roi.attributable | (attributable benefit minus investment)/investment | unknown without evidence or positive denominator |
Dashboard, report, export and TrackAI must use the same definitions. No runtime metric changes in this document. Golden fixtures, data authority mapping and permissions are prerequisites.
