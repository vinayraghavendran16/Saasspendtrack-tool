# SDLC and release gates

Applies to all SaaS Spend Track changes. A commit is implementation evidence, not verification or release approval.

## Lifecycle
1. Requirements: acceptance criteria, scope, risk, dependencies and data/privacy impact.
2. Design: architecture, authorization, threat model, migrations and rollback.
3. Implementation: isolated branch, reviewable changes, tests alongside code.
4. Verification: CI, review, preview, system and acceptance evidence.
5. Release: explicit platform owner approval, verified backups, migration rehearsal, rollback plan.
6. Operations: smoke checks, monitoring, incident response and post-release review.

## Mandatory test matrix
| Level | Required evidence |
|---|---|
| Unit | Positive, negative, boundary and failure cases for changed logic |
| Integration | Actual isolated database, migrations, API authorization, provider mocks and failure handling |
| System | Production-like preview with isolated data and configuration |
| E2E | Browser signup, login, workspace creation, save/reload, invite, role isolation, billing sandbox, logout |
| UAT | Acceptance criteria signed off by owner; alpha and controlled beta where appropriate |
| Smoke | Critical routes and journeys after preview and production deployment |
| Regression | Full existing suite plus new defect tests |
| Exploratory | Documented manual desktop/mobile sessions and findings |
| Performance | Baseline and bounded load in isolated environment; p95 latency, error rate, resource use |
| Security | Tenant isolation, privilege escalation, direct endpoint access, CSRF, XSS, session replay, secrets and dependency scanning |
| Usability/accessibility | Keyboard, focus, labels, contrast, responsive layout and screen-reader checks; target WCAG 2.2 AA |

## Release rules
- No production customer data in test fixtures; no live QA mutations.
- Never run load tests against production without separate authorization.
- No real payment, customer email or external AI request in automated tests unless explicitly sandboxed.
- Missing evidence is NOT RUN, never PASS. Record commit SHA, environment, command, date, result and defects.
- No unresolved critical/high security or data-integrity defects; other exceptions require explicit documented owner acceptance.
- CI must pass on the exact release candidate; review and branch protection must be verified, not assumed.
- Rehearse migrations and rollback on isolated copies; preserve backups and verify restore.
- Production deployment, migrations, access changes and cron reactivation require explicit approval.
- Analytics raw retention cleanup must remain disabled until aggregate retention is implemented and tested.
- Current analytics commits are unverified until dedicated tests and preview checks pass.
