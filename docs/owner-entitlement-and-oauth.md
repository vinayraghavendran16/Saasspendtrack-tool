# Platform owner and OAuth

## Owner scope

Set `PLATFORM_OWNER_EMAIL` to the designated account email in the relevant Pages environment. The authenticated owner has non-expiring access in their owned workspace, with no commercial seat cap. Other workspaces retain their existing entitlement, membership rules and 50-member cap. This branch does not enforce a contract-count cap. The exemption does not grant a role, write payment records, or override global feature gates or security rate limits.

## Deferred registration

The initial trial-only launch uses email magic links. Keep production `OAUTH_ENABLED=false`. The registration instructions below are for later, separately approved SSO work. Live provider registration and tests are not initial launch gates.

Use confidential web applications with server-side code redemption. Register the exact HTTPS Web redirect URI for each client.

| Provider | Production | Isolated US Pages |
| --- | --- | --- |
| Google | `https://app.saasspendtrack.com/api/auth/oauth/google/callback` | `https://saasspendtrack-preview-us.pages.dev/api/auth/oauth/google/callback` |
| Microsoft | `https://app.saasspendtrack.com/api/auth/oauth/microsoft/callback` | `https://saasspendtrack-preview-us.pages.dev/api/auth/oauth/microsoft/callback` |

For a protected branch or deployment alias, register that exact origin with the same path and keep Access enabled. Use separate credentials for testing. Use no wildcard, query string, or trailing slash in the registered URI.

**Google Cloud**

1. Open **Google Auth Platform → Branding** and configure the app and contact details. Under **Audience**, choose External and add approved test users if testing outside your Google organization. Use Internal only for eligible organization accounts.
2. Open **Clients → Create client**, select **Web application**, and enter the Google URI under **Authorized redirect URIs**. This flow does not need an Authorized JavaScript origin.
3. Save the client ID and secret into the corresponding Pages environment. The requested scopes are `openid email profile`. Complete any Google launch or verification requirements applicable to the audience before enabling public sign-in.

[Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)

**Microsoft Entra**

1. Open **Microsoft Entra ID → App registrations → New registration**. Select the account type that supports both organizational directories and personal Microsoft accounts for the `/common` endpoint.
2. Under **Authentication → Add a platform**, choose **Web** and enter the Microsoft URI. Leave implicit grants and public-client flows disabled.
3. Copy the **Application (client) ID**. Under **Certificates & secrets → Client secrets**, create a secret and save the secret **Value** in Cloudflare. No Microsoft Graph data scope is needed.

[Microsoft authorization-code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) · [Redirect URI rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)

## Cloudflare Pages environment

| Binding | Type and value |
| --- | --- |
| `APP_URL` | Plain text, approved HTTPS app origin |
| `OAUTH_ENABLED` | Plain text, `true` only in an approved test environment after configuration. Leave production disabled pending approval. |
| `GOOGLE_OAUTH_CLIENT_ID` | Plain text, Google Web client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Secret, Google Web client secret |
| `MICROSOFT_OAUTH_CLIENT_ID` | Plain text, Entra Application (client) ID |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Secret, Entra secret Value |
| `DB` | D1 binding for the same environment, with migration 003 already applied |
| `PLATFORM_OWNER_EMAIL` | Environment binding for the designated owner |

## Linking and security audit

Sign in by email first, then choose **Connect Google** or **Connect Microsoft** in Settings. You can subsequently sign in with the linked provider or continue using email. A provider email claim never creates, matches, or merges an app account. A provider/issuer/subject tuple can link to only one account.

Both flows use authorization code, S256 PKCE, a nonce, and a one-use ten-minute state bound to a secure HttpOnly browser cookie. Linking requires a same-origin POST, a valid app session, and the same session on callback. The database checks that the linking session remains valid when saving the identity. Social login verifies the existing identity and active workspace context before issuing a normal hashed session.

ID token verification uses RS256, fixed Google or tenant-specific Microsoft JWKS endpoints, issuer, audience and authorized-party checks, nonce and token-time validation, and Microsoft v2 tenant binding. Redirects from token or key endpoints fail closed. Provider tokens are not persisted.

Before a later SSO enablement, smoke-test both live providers using approved isolated accounts, including first-time linking, repeat login, wrong account, suspended membership, and email fallback. The owner and OAuth changes require no migration beyond existing 003. Migration 033 remains a separate release gate for legacy payment reconciliation.
