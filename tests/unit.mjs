// Unit tests for the trial/auth/payments backend. Run: node tests/unit.mjs
// Pure-logic coverage with mocked D1 — no network, no real database.
import * as U from '../functions/_shared/util.js';
import * as DATA from '../functions/api/data.js';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.error('  FAIL:', name); } };
const section = (s) => console.log('\n' + s);

// ---- crypto (known-answer vectors) ----
section('crypto');
ok(await U.sha256Hex('hello') === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', 'sha256 vector');
ok(await U.hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog')
   === 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8', 'hmac vector');
ok(U.randomToken(32).length === 64, 'token length');
ok(U.safeEqual('abc', 'abc') && !U.safeEqual('abc', 'abd') && !U.safeEqual('ab', 'abc'), 'safeEqual');

// ---- validation / cookies ----
section('validation & cookies');
ok(U.normalizeEmail(' Foo@Bar.COM ') === 'foo@bar.com', 'email normalize');
ok(U.normalizeEmail('nope') === null, 'email reject');
ok(U.parseCookies({ headers: { get: () => 'sst_session=xyz; a=1' } }).sst_session === 'xyz', 'cookie parse');
ok(U.sessionCookie('s').includes('HttpOnly') && U.sessionCookie('s').includes('Secure'), 'cookie flags');
ok(U.isAdmin({ ADMIN_EMAILS: 'a@x.com, b@x.com' }, 'B@X.com') === true, 'isAdmin match');
ok(U.isAdmin({ ADMIN_EMAILS: 'a@x.com' }, 'c@x.com') === false, 'isAdmin reject');

// ---- entitlement ----
section('entitlement');
const noDb = { DB: { prepare: () => ({ bind: () => ({ run: async () => {} }) }) } };
let e = await U.resolveEntitlement(noDb, { email: 'a', status: 'active', trial_ends_at: 0 });
ok(e.entitled && e.status === 'active', 'active entitled');
e = await U.resolveEntitlement(noDb, { email: 'a', status: 'trial', trial_ends_at: Date.now() + 3 * U.DAY });
ok(e.entitled && e.daysLeft >= 1 && e.daysLeft <= 3, 'trial entitled, daysLeft');
e = await U.resolveEntitlement(noDb, { email: 'a', status: 'trial', trial_ends_at: Date.now() - 1000 });
ok(!e.entitled && e.status === 'expired', 'expired trial blocks');

// ---- SSRF guard ----
section('ssrf guard');
ok(U.isPublicHttpsHost('https://api.ironclad.com/v1') === true, 'allow public https');
ok(U.isPublicHttpsHost('http://api.ironclad.com') === false, 'block http');
for (const h of ['https://localhost/x', 'https://127.0.0.1', 'https://169.254.169.254/meta',
  'https://10.0.0.1', 'https://192.168.1.1', 'https://172.16.0.1', 'https://x.internal', 'https://[::1]'])
  ok(U.isPublicHttpsHost(h) === false, 'block ' + h);

// ---- rate limiter (mock D1) ----
section('rate limiter');
let n = 0;
const rlEnv = { DB: { prepare: () => ({ bind: () => ({ first: async () => ({ count: ++n }) }) }) } };
let r; for (let i = 0; i < 3; i++) r = await U.rateLimit(rlEnv, 'k', 3, 1000);
ok(r.ok && r.count === 3, 'at limit allowed');
r = await U.rateLimit(rlEnv, 'k', 3, 1000);
ok(!r.ok && r.count === 4, 'over limit blocked');
r = await U.rateLimit({ DB: { prepare: () => { throw new Error('x'); } } }, 'k', 1, 1000);
ok(r.ok, 'rate limiter fails open on error');

// ---- data endpoint (entitled-gated writes) ----
section('data endpoint');
function dataEnv(store, user) {
  return { DB: { prepare(sql) { return { bind: (...a) => ({
    first: async () => sql.includes('sessions') ? (user ? { email: user.email, expires_at: Date.now() + 1e9 } : null)
      : sql.includes('app_data') ? store.row : user,
    run: async () => { if (sql.includes('INSERT INTO app_data')) { store.row = { data: a[1] }; store.saved = a[1]; } },
  }) }; } } };
}
const active = { email: 'u@x.com', status: 'active', trial_ends_at: 0 };
const req = { headers: { get: () => 'sst_session=s' } };
let res = await DATA.onRequestGet({ request: req, env: dataEnv({ row: null }, active) });
ok((await res.json()).empty === true, 'GET empty when no data');
const store = {};
res = await DATA.onRequestPut({ request: { ...req, text: async () => JSON.stringify({ subscriptions: [1] }) }, env: dataEnv(store, active) });
ok((await res.json()).ok === true && store.saved.includes('subscriptions'), 'PUT saves when entitled');
res = await DATA.onRequestPut({ request: { ...req, text: async () => '{}' },
  env: dataEnv({}, { email: 'e', status: 'trial', trial_ends_at: Date.now() - 1 }) });
ok(res.status === 403, 'PUT blocked when expired');
res = await DATA.onRequestGet({ request: { headers: { get: () => '' } }, env: dataEnv({}, null) });
ok(res.status === 401, 'GET 401 without session');

// ---- preset generator endpoint (validation + gating; no network) ----
section('preset generator');
import * as PRESET from '../functions/api/preset/generate.js';
function presetEnv(user, key) {
  let rl = 0;
  return { ANTHROPIC_API_KEY: key, ADMIN_EMAILS: '', DB: { prepare(sql) { return { bind: (...a) => ({
    first: async () => {
      if (/sessions/i.test(sql)) return user ? { email: user.email, expires_at: Date.now() + 1e9 } : null;
      if (/rate/i.test(sql)) return { count: ++rl };
      if (/users/i.test(sql)) return user;
      return user;
    },
    run: async () => {},
  }) }; } } };
}
const pReq = (body) => ({ headers: { get: () => 'sst_session=s' }, json: async () => body });
let pr = await PRESET.onRequestGet({ env: { ANTHROPIC_API_KEY: 'x' } });
ok((await pr.json()).configured === true, 'GET reports configured');
pr = await PRESET.onRequestPost({ request: { headers: { get: () => '' }, json: async () => ({ url: 'acme.com' }) }, env: presetEnv(null, 'x') });
ok(pr.status === 401, 'POST 401 without session');
pr = await PRESET.onRequestPost({ request: pReq({}), env: presetEnv(active, 'x') });
ok(pr.status === 400 && (await pr.json()).error === 'no_url', 'POST 400 when no url');
pr = await PRESET.onRequestPost({ request: pReq({ url: 'http://10.0.0.1' }), env: presetEnv(active, 'x') });
ok(pr.status === 400 && (await pr.json()).error === 'bad_url', 'POST 400 on SSRF/private url');
pr = await PRESET.onRequestPost({ request: pReq({ url: 'acme.com' }), env: presetEnv(active, undefined) });
ok(pr.status === 501 && (await pr.json()).error === 'not_configured', 'POST 501 when API key missing');
pr = await PRESET.onRequestPost({ request: pReq({ url: 'acme.com' }), env: presetEnv({ email: 'e', status: 'trial', trial_ends_at: Date.now() - 1 }, 'x') });
ok(pr.status === 403, 'POST 403 when trial expired');

// ---- result ----
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
