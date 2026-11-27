# Department identity audit
Reviewed migrations 017, 018, 021, 023 and 030. Contract ownership maps contracts to vendor IDs, not departments. Employee subjects and source status do not establish department membership. AOP versions store assumptions JSON, not an authoritative department registry. Technology graph nodes have tenant-local composite IDs and a department kind, but are explicitly asserted dependencies, not verified finance master data. Reporting facts have no department column.
 
## Proposed authority
Introduce a dedicated tenant-local financial department registry with stable opaque IDs, display label and lifecycle status. Do not treat graph labels, AOP assumption names or current employee attributes as canonical identity. Explicitly map source department identifiers to the registry, with source namespace and review provenance. Graph links are optional mappings, not authorization. Historical allocations retain stable IDs even after a rename or retirement. Department population observations must resolve the same registry ID before publication.
 
## Integration gates
Audit legacy app_data department fields and current import paths before migration. Never auto-merge departments by label. Use composite account/department foreign keys, reject cross-tenant mappings and inactive departments for new allocations, retain historical records. Owner-only default-off until department-scoped access is enforced. Ledger fact snapshot and version publication must be atomic; no mutable published allocation. Existing organization PUPM remains independent.
