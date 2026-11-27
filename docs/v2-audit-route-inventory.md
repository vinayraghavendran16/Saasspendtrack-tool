# Audit route inventory

66 API files discovered on V2. This is a file inventory, not verified mutation coverage. Each handler and shared write path requires inspection. Existing specialized evidence must be linked rather than blindly duplicated. Legacy data.js needs entity-level diff; read-only reports and exports need activity classification; cron and webhooks require trusted system provenance.

| Route file | Coverage verification |
|---|---|
| `functions/api/account/accept.js` | Pending handler audit |
| `functions/api/account/invite.js` | Pending handler audit |
| `functions/api/account/member-remove.js` | Pending handler audit |
| `functions/api/account/member-role.js` | Pending handler audit |
| `functions/api/account/members.js` | Pending handler audit |
| `functions/api/account/usage.js` | Pending handler audit |
| `functions/api/admin/stats.js` | Pending handler audit |
| `functions/api/ai/audit.js` | Pending handler audit |
| `functions/api/ai/consent.js` | Pending handler audit |
| `functions/api/ai/evidence.js` | Pending handler audit |
| `functions/api/ai/lock.js` | Pending handler audit |
| `functions/api/aop/approve.js` | Pending handler audit |
| `functions/api/aop/revisions.js` | Pending handler audit |
| `functions/api/aop/scenarios.js` | Pending handler audit |
| `functions/api/ask.js` | Pending handler audit |
| `functions/api/auth/logout.js` | Pending handler audit |
| `functions/api/auth/request.js` | Pending handler audit |
| `functions/api/auth/verify.js` | Pending handler audit |
| `functions/api/clm-sync.js` | Pending handler audit |
| `functions/api/commercial/catalogue.js` | Pending handler audit |
| `functions/api/commercial/contracts.js` | Pending handler audit |
| `functions/api/commercial/lines.js` | Pending handler audit |
| `functions/api/commercial/parties.js` | Pending handler audit |
| `functions/api/commercial/products.js` | Pending handler audit |
| `functions/api/commercial/report.js` | Pending handler audit |
| `functions/api/commercial/spend.js` | Pending handler audit |
| `functions/api/cron/payment-notifications.js` | Pending handler audit |
| `functions/api/cron/tick.js` | Pending handler audit |
| `functions/api/data.js` | Pending handler audit |
| `functions/api/decisions/action-review.js` | Pending handler audit |
| `functions/api/decisions/actions.js` | Pending handler audit |
| `functions/api/decisions/approve.js` | Pending handler audit |
| `functions/api/decisions/create.js` | Pending handler audit |
| `functions/api/decisions/financial-attest.js` | Pending handler audit |
| `functions/api/decisions/financial-review.js` | Pending handler audit |
| `functions/api/decisions/financial-summary.js` | Pending handler audit |
| `functions/api/decisions/outcome.js` | Pending handler audit |
| `functions/api/decisions/recommend.js` | Pending handler audit |
| `functions/api/decisions/revisions.js` | Pending handler audit |
| `functions/api/extract.js` | Pending handler audit |
| `functions/api/financial/capabilities.js` | Pending handler audit |
| `functions/api/financial/population-selection.js` | Pending handler audit |
| `functions/api/financial/population.js` | Pending handler audit |
| `functions/api/financial/pupm-trend.js` | Pending handler audit |
| `functions/api/financial/pupm.js` | Pending handler audit |
| `functions/api/governance/accept.js` | Pending handler audit |
| `functions/api/governance/assign-case.js` | Pending handler audit |
| `functions/api/governance/cases.js` | Pending handler audit |
| `functions/api/governance/create-case.js` | Pending handler audit |
| `functions/api/governance/overdue.js` | Pending handler audit |
| `functions/api/governance/ownership.js` | Pending handler audit |
| `functions/api/governance/transfer.js` | Pending handler audit |
| `functions/api/governance/update-case.js` | Pending handler audit |
| `functions/api/me.js` | Pending handler audit |
| `functions/api/platform/internal.js` | Pending handler audit |
| `functions/api/platform/settings.js` | Pending handler audit |
| `functions/api/platform/usage.js` | Pending handler audit |
| `functions/api/preset/generate.js` | Pending handler audit |
| `functions/api/razorpay/webhook.js` | Pending handler audit |
| `functions/api/rb2b/ingest.js` | Pending handler audit |
| `functions/api/rb2b/list.js` | Pending handler audit |
| `functions/api/renewal-guide.js` | Pending handler audit |
| `functions/api/sheet-csv.js` | Pending handler audit |
| `functions/api/technology-graph/edges.js` | Pending handler audit |
| `functions/api/technology-graph/impact.js` | Pending handler audit |
| `functions/api/technology-graph/nodes.js` | Pending handler audit |

Non-route surfaces: shared helpers, client-side report state, import pipelines, database triggers, migrations, administrative scripts and external integration callbacks require separate inventory.
