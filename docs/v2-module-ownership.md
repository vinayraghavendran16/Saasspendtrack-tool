# Proposed V2 module ownership
No V1 changes; no navigation removal until parity is demonstrated.
| Group | Canonical pages | Existing surfaces to reconcile |
|---|---|---|
| Overview | My workspace, Executive overview, Action centre | dashboard, command-centre, alerts, owner inbox |
| Technology | Portfolio, Vendors, Licence usage, Dependency map | subscriptions, consumption, vendors |
| Financials | Spend analytics, Invoices, Budgets & AOP, Savings & ROI, Forecasting | analytics, invoices, licence forecast, financial-intelligence prototype |
| Contracts & risk | Contracts, Renewal centre, Risk & compliance, Clause playbook | contracts, renewals, risk, playbook, InfoSec, renewal guides |
| Decisions | Recommendations, Scenario planner, Approvals, Decision history | insights, scenario planner, approvals |
| Reporting | Reports, Report builder, Scheduled reports | reporting and exports |
| People & ownership | Departments, Team directory, Vendor contacts | team, vendor contacts |
| Administration | Settings, Data sources, Integrations, Access, Plans | integrations, roadmap, pricing, backlog (internal only) |
TrackAI is global. Labels are proposed, not a claim all pages exist.
## Boundaries
Action centre is a cross-module task projection, not a second renewal or approval store. Reporting consumes the same metric definitions as Financials. Decisions owns proposals, versions and approval workflow; Financials owns outcome evidence; Technology owns dependency relationships. Existing IDs and deep links remain compatible until migration tests pass. No duplicate writes or independent role-specific stores.
## Release gates
Compare frozen V1 source and migration inventory, map API permissions, preserve demo isolation, test mobile and desktop, ensure disabled V2 routes do not appear, reconcile data authorities before switching any read path.
