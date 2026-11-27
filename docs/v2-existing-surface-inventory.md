# Existing application surface inventory

Source: V2 base index.html blob 07c1fc3e24c3f72d8fc4881db94632f57502562e. This is a static extraction, not a live D1 audit or final V1 inventory.

## View IDs
- command-centre
- dashboard
- invoices
- subscriptions
- consumption
- team
- alerts
- renewals
- contracts
- integrations
- pricing
- insights
- analytics
- playbook
- risk
- roadmap
- backlog

## API path literals
- /api/2
- /api/account/
- /api/account/invite
- /api/account/member-remove
- /api/account/member-role
- /api/account/members
- /api/ai/audit
- /api/ai/consent
- /api/ai/evidence
- /api/ai/lock
- /api/ask
- /api/auth/logout
- /api/auth/request
- /api/clm-sync
- /api/data
- /api/extract
- /api/me
- /api/platform/internal
- /api/preset/generate
- /api/public
- /api/renewal-guide
- /api/rest/1/organizations
- /api/sheet-csv
- /api/v1
- /api/v1/contracts
- /api/v2
- /api/v3

## Metric-related named functions (candidates for semantic review, not proven duplicates)
- showCurrencyReview
- currencyGroup
- monthlyCost
- monthlyCostInOriginalCurrency
- periodCost
- workspaceCurrency
- annualCost
- spendForVendor
- forecastVendor
- forecastAll
- renderForecast
- renderForecastChart
- wireForecast
- ensureForecastView
- ensureForecastNav
- rptAnnual
- buildReport
- ensureReportingView
- renderReporting
- ensureReportingNav
- patchSwitchViewForReporting
- coerceCost
- importCurrencyMatches
- monthlySpendOf
- buildSpendSummary
- buildSavings
- exportSpendSummary
- exportSavingsReport
- renderReportsView
- ensureReportsContainer
- currencyDef
- openCurrencyEditor
- exportDiagnosticReport

## Audit gates
Reconcile with frozen V1 candidate before changing navigation. Trace each metric to its authoritative store (legacy JSON or normalized D1), currency, period, scope and provenance. Do not infer equivalence from names. No removal until parity and authorization tests pass.
