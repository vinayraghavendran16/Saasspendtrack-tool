# CLAUDE.md - rules for working in this repo

Guidance for any AI/dev session changing this codebase. Follow it so new features
inherit the security, structure, and reliability already in place. When unsure,
prefer the safe option and preserve existing behaviour (zero feature regression).

## What this is

SaaS Spend Track: a single-file web app on Cloudflare Pages + Pages Functions,
backed by a Cloudflare D1 database (`sst-trial`). Trial is 7 days, gated, with a
magic-link login; paid unlock via a Razorpay webhook; owner dashboard at
`/admin.html`.

## Build & files - READ THIS FIRST

- **`index.html` is the deployable source of truth.** It is a ~1.24 MB
  self-contained bundle (HTML + CSS + JS inlined). Edit it directly, or via the
  injector approach below - never regenerate it blindly.
- **DO NOT run `bundle.py`.** Its sources (`index.src.html`, `app.js`,
  `extensions*.js`) are **out of sync** with `index.html` and regenerating drops
  content (it once deleted the whole Command Centre). `bundle.py` now aborts if
  output would be >10% smaller - do not `--force` past that without reconciling
  sources first.
- The trial gate (`auth-gate.js` / `auth-gate.css`) and `trial-legacy-off.js` are
  **inlined** into `index.html`. To change them: edit those source files, then
  rebuild with the injector (`inject_gate.py`: restores the clean base from the
  pinned git revision and re-injects). Verify `grep -c "Command Centre" index.html`
  stays at 9 afterward.
- Deploys are automatic from `main` via Cloudflare Pages. No build step runs on
  deploy - the committed `index.html` is served as-is.

## Backend (Cloudflare Pages Functions) - `functions/api/*`

One file per route. Shared helpers and guards live in `functions/_shared/util.js`
and `email.js`.

### Security constraints (non-negotiable)

- **Every endpoint that does paid/valuable work or touches account data MUST gate
  first:**
  ```js
  import { requireEntitled } from '../_shared/util.js';
  export async function onRequestPost({ request, env }) {
    const gate = await requireEntitled(request, env);
    if (gate.response) return gate.response;   // 401 anon, 403 expired
    const { user } = gate;                      // entitled - proceed
  }
  ```
  Owner-only endpoints use `requireAdmin` the same way. GET health checks that
  return only a boolean may stay open.
- **Rate-limit** anything abusable with `rateLimit(env, key, limit, windowMs)`
  (D1-backed, fails open). Existing keys: `ai:<email>` 60/h, `clm:<email>` 30/h,
  `sheet:<email>` 60/h, `authreq:ip:<ip>` 20/h, `authreq:em:<email>` 5/15m.
- **SSRF:** before `fetch()`-ing any user-supplied URL, require
  `isPublicHttpsHost(url)` (blocks internal/loopback/link-local/private/IPv6).
- **Never echo raw error text to the client.** `console.error(...)` the real
  error server-side; return a generic message.
- Secrets live only in Cloudflare env vars (see `.env.example`) - never in client
  code or committed files. Mark tokens/secrets as "Secret/Encrypt".
- Razorpay webhook must verify the HMAC signature (`hmacSha256Hex` + `safeEqual`).
- Auth: magic-link tokens are stored hashed (`sha256Hex`), single-use, 15-min TTL;
  sessions are server-side with HttpOnly/Secure/SameSite=Lax cookies.

### Conventions

- Validate input: `normalizeEmail()`; cap body sizes; reject bad shapes with 400.
- The client calls functions **same-origin with cookies** - don't add
  `credentials: 'omit'`, and keep endpoints same-origin so the session cookie flows.
- Entitlement is decided server-side by `/api/me`; the client gate only renders UI
  and **fails open** on backend error (never brick the app).

## Database (D1 `sst-trial`)

- Schema in `schema.sql`, all `CREATE ... IF NOT EXISTS` so migrations are
  re-runnable: `wrangler d1 execute sst-trial --remote --file=./schema.sql`.
- Add an **index** for any column you query by. Add `created_at`/timestamps on new
  tables.
- Per-account app data is a single JSON blob in `app_data`, keyed by `email`.
- After adding a table/column/index to `schema.sql`, re-run the migration above.

## Error handling & observability

- The client trial gate failing open is intentional - keep it.
- Server: `console.error` with context on failures; return generic client messages.

## Testing & CI

- `tests/unit.mjs` covers auth, entitlement, rate limiting, the SSRF guard, and the
  data endpoint. Run `npm test`; `npm run check` syntax-checks all functions.
- **Add tests for any new critical path** (auth, payments, entitlement).
- CI (`.github/workflows/ci.yml`) runs syntax-check + tests on every push/PR.

## Adding an env var

1. Add it to `.env.example` (documented, no real value).
2. Set it in the Cloudflare Pages project → Settings → Variables (Secret if a token).
3. Redeploy (env changes apply on next deploy) - e.g. an empty commit to `main`.

## Known deferred work (don't assume it's done)

- `index.html` is a 22k-line monolith; a modular split is a dedicated project.
- Subscription data is still a client-side blob - reading it is possible in
  devtools; the valuable *compute* is server-gated, which is the enforced line.
- Webhook writes aren't wrapped in a transaction (idempotent via `rp_payment_id`).
- Full app accessibility audit (only the added gate/admin surfaces are done).

See `TRIAL-SETUP.md` (infra setup), `.env.example` (vars), `VINAY-TODO.md` (roadmap).
