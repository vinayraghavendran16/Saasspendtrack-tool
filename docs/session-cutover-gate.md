# Session hashing cutover (proposed, not authorized)
 
Use the existing sessionStorageId helper for every session issuer, lookup and logout. Inventory all SQL writes and reads of sessions across the full checkout before changing any issuer. Include magic links, OAuth, admin and scheduled jobs.

Preferred cutover: coordinated invalidation of existing sessions during the approved maintenance window, subject to separate approval for forced sign-out. Preserve user and workspace records. Do not accept raw database session IDs after cutover. Do not log cookie values or hashes.

Required tests:
- New magic-link and enabled OAuth sessions authenticate with hashed database IDs.
- Raw cookie value is absent from database; stored hash cannot authenticate as a cookie.
- Logout deletes the hashed record and clears cookie.
- Expired, malformed and revoked cookies fail closed.
- Legacy raw sessions are rejected after cutover.
- Concurrent requests and logout do not resurrect sessions.
- Existing workspace records and memberships are unchanged.
- Recovery deployment supports hashed sessions or forces reauthentication; never restore raw-token authentication as a silent fallback.

Do not delete sessions, enable a migration or deploy until exact-candidate CI and isolated preview checks pass and forced sign-out is approved. Existing backups may contain raw sessions; protect them and ensure restoration does not reactivate old credentials.
