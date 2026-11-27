# Procurement and usage architecture
Status: proposed architecture, not implemented. Preserve existing product and data.
## Commercial model
Tenant-scoped parties with supplier/reseller/publisher roles (not mutually exclusive); product belongs to publisher; SKU belongs to product; contract references legal supplier and optional reseller; purchase line references contract, SKU, quantity, unit, currency, price, discount, term, minimum commitment and billing schedule. Multiple sellers per product, multiple contracts per seller. Optional reseller override per line. Distinguish purchase lines, invoices, entitlements, assignments and observations. Support seat, consumption, credit, tiered and fixed pricing. Rollups count each purchase line once; no currency summation without explicit FX provenance. Preserve legacy subscription IDs and map via reviewed migration, never duplicate spend. Link governance cases to supplier, publisher, product or contract.
## Usage platform
Adapter interface: capability discovery, authorization, inventory, assignments, metrics, incremental sync, pagination, revocation and health. Normalize tenant, connector instance, external user/product/SKU IDs, metric key/unit, window, observed timestamp, source, coverage and quality. Vendor-specific metric registry with versioned active definitions. Unknown/stale distinct from zero. Identity mapping via immutable external IDs and verified directory mapping; ambiguous matches require review. Support API/service accounts separately. Never revoke licences automatically in MVP.
Sources: direct APIs, IdP logs, authorized report ingestion, generic authenticated ingestion, manual. Direct and SSO evidence not interchangeable. Deduplicate events and preserve provenance. Microsoft Graph reports D7/D30/D90/D180 Reports.Read.All; Salesforce LoginHistory permission gated; Sales Navigator analytics requires SNAP approval and new partner intake currently closed per official docs, use authorized CSV imports initially. Validate other vendors individually before advertising availability.
## Cross-functional views
Finance: committed vs paid vs accrued, allocation, potential vs realized savings. Procurement: supplier/reseller portfolio, SKU pricing, contracts, disputes, approval. Business/RevOps: feature adoption, utilization, optimization. IT: identity lifecycle, sync health, access review. Granular RBAC and audit, aggregate by default, individual usage restricted to legitimate authorized roles.
## Build plan
1. Inventory legacy schema and stable IDs; additive normalized commercial tables and migration rehearsal.
2. Supplier/product/SKU/contract line UI, imports, reconciliation and hierarchy rollups.
3. Connector registry, encrypted tenant-bound credentials, consent, queue, leases, rate limits, retries, health and revocation.
4. Directory and Microsoft 365 adapter, Salesforce adapter, generic report import, Sales Navigator CSV mapping.
5. Versioned usage definitions, coverage and staleness, recommendations linked to actual commercial terms.
6. Department views and governance alerts. Later connectors prioritized by customer demand and verified API rights.
## Validation
Tenant isolation across all foreign keys and APIs; same publisher via two resellers; multi-SKU contract; duplicate invoice/line import; amendments and effective dates; direct/no reseller; currency and quantity reconciliation; seat vs credit units; partial sync, 429, expired token, pagination, missing data, identity ambiguity, service account, duplicate events and stale reports. Verify no secrets in logs, scoped read-only credentials, revocation, retention and DSAR; synthetic fixtures and authorized sandbox provider tests. No production deployment or employee surveillance.
## References
https://help.zluri.com/docs/licenses-overview
https://www.zluri.com/blog/how-zluri-helps-with-software-license-management
https://zylo.com/wp-content/uploads/2022/02/Zylo-ITAM-Review-Report-enterprise-saas-management-certification.pdf
https://learn.microsoft.com/en-us/graph/api/reportroot-getoffice365activeuserdetail?view=graph-rest-1.0
https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-loginhistory.html
https://learn.microsoft.com/en-us/linkedin/sales/analytics-services/
https://learn.microsoft.com/en-gb/linkedin/sales/
