# Role-based experience architecture
Function (Finance, Revenue, IT, Procurement, Marketing, HR, Operations, custom), responsibility (executive, leader, manager, analyst, application owner), and authorized scope are independent. A user may hold multiple functions. CRO and RevOps are presets, not security roles.
## Experience presets
| Preset | Default priorities |
|---|---|
| CRO | revenue technology investment, business objectives, budget, decisions |
| RevOps | GTM portfolio, usage, renewal actions, scenarios |
| CFO | commitments, budget variance, financial evidence, approvals |
| IT | dependencies, application inventory, security, usage |
| Procurement | vendor terms, renewal deadlines, negotiations, approvals |
## Authorization
Existing server-side membership and entitlement checks remain authoritative. Persona selection never grants access. Department or application restrictions require server-side enforcement before release; until then do not expose a purported scoped view to users without verified authorization. Preferences are per user per workspace; no duplicate business records. Default-deny new permissions. TrackAI and exports use identical authorization and scope.
## Metric contract
Every metric has stable ID, definition version, authoritative source, period, currency, scope, freshness, evidence status, missing-data behavior. No cross-currency aggregation without explicit FX policy. Projected, reconciled and owner-attested savings are distinct; no causal revenue claims. Report and dashboard parity is a release gate.
## Pending
Inspect existing membership schema, normalized D1 versus legacy JSON authority, existing metrics and V1 navigation. Design preference persistence only after this audit. No new permission grants or database changes in this specification.
