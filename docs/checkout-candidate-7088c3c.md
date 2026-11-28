# Verified sandbox candidate
Code SHA: 7088c3ccff6267de9513a677863f259b5ce523c9
All five workflows completed successfully: application CI, checkout regression, security hardening, combined migration rehearsal, supply chain evidence.
Use a detached checkout of this exact SHA. This documentation commit is not the candidate.
Create a new dedicated Pages project and synthetic D1 database. Verify the remote DB binding before any migration. Do not use existing production or preview databases. Keep checkout flags off until the isolated deployment is verified. Configure only test-mode credentials. Execute the sandbox runbook and record actual provider results. No production deployment authorized.
