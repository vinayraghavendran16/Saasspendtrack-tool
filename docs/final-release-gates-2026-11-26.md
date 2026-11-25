# Final release gates — 2026-11-26

**Decision: NO-GO pending live AI validation. No merge or production deployment is authorized.**

## Backup and isolated restore: passed

Production `sst-trial` (`33e16d8e-579e-4454-959b-dbbbb368081a`) was inspected read-only and exported with explicit owner authorization. No production writes, migrations, configuration changes or restores were performed. Wrangler warns that export can temporarily make D1 unavailable to queries; schedule future release exports accordingly.

Backup identifier: `release-20261126`. Plaintext SHA-256: `331e47f7d0e3815416cf1bafd1fa8b84841f163bbbae6cd3a92e0739264b996e`; 707,208 bytes before encryption. Encrypted artifact is retained outside Git at `~/saasspendtrack-backups/release-20261126/production.sql.fernet`. Recovery key is separately permission-restricted at `~/saasspendtrack-backups/recovery-keys/release-20261126.key`. This is a local encrypted backup, not an independently stored off-device backup. Preserve both in the owner's secure backup system before release. Plaintext export was removed after authenticated-encryption/decryption equality was verified. Detailed customer financial aggregates remain private outside Git.

Created isolated, unbound D1 `sst-restore-validation-20261126` (`31d88e3c-911c-4dde-bdfe-886cba572722`). It is distinct from production and preview, with no Pages environment binding. It retains the restored copy for validation; it must never be attached to a public app. Its copied sessions and tokens are customer data, not testing credentials.

Initial bulk import failed atomically with `SQLITE_TOOBIG` (statement too long). The empty target was verified before retry. Schema creation plus bound-parameter row inserts succeeded. **A blind SQL-file import is not a verified rollback method for this export.** Use the validated parameterized restoration method, or another separately verified method, for the recovery runbook.

All 82 rows across nine tables matched both the export and production at verification: users 9, login_tokens 12, sessions 6, email_log 19, app_data 5, rate_limits 19, accounts 8, memberships 4, invites 0. Every row was compared using canonical full-row digests; schema matched exactly. Production and restored D1 quick_check passed, and a local SQLite restoration passed integrity_check. Zero invalid app_data JSON rows.

All financial amounts, native currency labels, billing cycles and workspace JSON were preserved exactly. Four financial aggregate groups were calculated with decimal arithmetic, separated by record collection, monetary field, currency and billing cycle. Exact underlying row equality proves preservation; no FX conversion or mixed-currency grand total was used. Customer totals are not disclosed in the PR.

Both candidate migrations were then applied **only to the isolated D1 restoration**. All five original workspace payloads and original columns remained identical, all revisions became 1, and quick_check passed. Production lacks these release migrations and was left unchanged. The production export reflects its existing nine-table schema, not a claim that every optional feature table in schema.sql exists.

[Backup comparison](release-evidence/2026-11-26-final/backup-restore.json), [restore method](release-evidence/2026-11-26-final/restore-method.json), [migration compatibility](release-evidence/2026-11-26-final/restore-compatibility.json), [encryption](release-evidence/2026-11-26-final/encryption.json), [Time Travel identifier](release-evidence/2026-11-26-final/time-travel.json).

## PR code and checks

Original evidence-only commit `c6db23c` changes nine documentation/evidence files only. It changes no application functions, browser assets, dependencies or configuration; it causes a normal preview rebuild. CI, development security checks and Pages succeeded on that SHA.

Error-handling validation exposed an application defect: extraction accepted a provider result with a string in total_contract_value and reported success. Fixed in `90af049`: validate required fields, numeric types, enum values, nested line items, vendor and confidence; accept only the expected tool; redact provider/network exception details. Valid tool results and valid JSON-text fallback remain supported. This later fix **does change application behavior**, unlike c6db23c.

109 unit assertions and all invoked regression/security/isolation/consent/browser-cache/migration suites pass. New extraction tests cover malformed results, successful mocked tool and text responses, upstream 429, network failure and zero provider calls without consent. Mocked success is not real Anthropic success. CI evidence is recorded by SHA; refresh checks after each new PR head before approval.

## AI provider setup and pending live gate

Provider: Anthropic Claude (`api.anthropic.com`). Exact server secret: `ANTHROPIC_API_KEY`. Use a fresh, workspace-scoped preview key, not an organization/admin or production key. This implementation does not send an explicit workspace header, so the key itself should be scoped to the preview workspace.

1. Open https://platform.claude.com/settings/keys and create a key in a separate preview workspace with a small spend limit and API credits.
2. Cloudflare → Workers & Pages → saasspendtrack → Settings → Variables and Secrets → **Preview**. Add type **Secret**, name `ANTHROPIC_API_KEY`, paste the value, save. Never paste it into chat, Git or command arguments; do not edit Production.
3. Leave optional `EXTRACT_MODEL` unset to use account model discovery, or choose a verified model from that preview account. Do not rely on the old fallback model named in source comments.
4. Tell the agent only that configuration is complete. A new development Preview deployment is required; existing immutable deployments do not acquire the secret retroactively. Verify its SHA, Preview environment and exclusive sst-preview binding before tests.
5. Run a synthetic contract through the actual provider and verify supplier, EUR currency, amount, dates and seats. Verify no consent/stale consent/other tenant denial, permitted extraction after explicit v2 consent, revocation, member permission restrictions, and unchanged saved workspace data. Provider/network/malformed response errors have deterministic regression coverage; distinguish those from live-provider results.

On immutable preview https://0c0bd6f3.saasspendtrack.pages.dev (90af049), six live assertions passed: default consent denial, v2 enablement, explicit 501 not_configured without the key, other-tenant denial even with a supplied workspaceId, revocation and denial after revocation. Synthetic fixtures and their rate-limit counters were removed. See [live AI gate evidence](release-evidence/2026-11-26-final/ai-live-gate.json). At inspection, neither Preview configuration nor the new deployment has the key. This is the only immediate credential blocker; no successful live extraction is claimed.

## Final production approval checklist

- [x] Authorized read-only production inspection and backup creation.
- [x] Verified separate isolated restore, full-row counts/content/currency preservation, integrity and migration compatibility.
- [x] Recovery bookmark and encrypted backup identifiers recorded.
- [ ] Live AI extraction and consent/tenant checks on the new immutable candidate after preview key configuration.
- [ ] All CI/security checks green on the exact final PR head; rerun live checks if application behavior changes.
- [ ] Owner stores backup/key in secure durable storage and selects retention for the isolated restored customer-data copy.
- [ ] Confirm recovery objectives and post-backup-write reconciliation; a restored snapshot can lose later writes.
- [ ] Explicit production release authorization, maintenance window and migration/deployment plan. Existing authorization covers backup/inspection only.

Follow the [production release and rollback checklist](release-readiness-2026-11-26.md#backup-rollback-and-production-release-checklist). Do not blindly revert to pre-versioned save code or remove additive schema. Preserve the failed state before any authorized recovery; restore only after a separately approved incident decision. No production restore was exercised here.

Sources: [Cloudflare D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/), [Pages bindings/secrets](https://developers.cloudflare.com/pages/functions/bindings/), [Claude API keys](https://platform.claude.com/docs/en/get-api-key).
