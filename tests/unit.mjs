// Unit tests for the trial/auth/payments backend. Run: node tests/unit.mjs
// Pure-logic coverage with mocked D1 — no network, no real database.
import * as U from '../functions/_shared/util.js';
import * as DATA from '../functions/api/data.js';
import * as RB2B from '../functions/api/rb2b/ingest.js';

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
function dataEnv(store, user, membership) {
  // membership defaults to an active owner so role gating passes for a solo user.
  const mem = membership === undefined ? (user ? { email: user.email, account_id: 'A', role: 'owner', status: 'active' } : null) : membership;
  return { DB: { prepare(sql) { return { bind: (...a) => ({
    first: async () => sql.includes('sessions') ? (user ? { email: user.email, expires_at: Date.now() + 1e9 } : null)
      : sql.includes('app_data') ? store.row
      : sql.includes('memberships') ? mem
      : sql.includes('accounts') ? (user ? { id: 'A', owner_email: user.email } : null)
      : user,
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

// ---- Phase 4: requireEntitledRole + member-scoped endpoint enforcement ----
section('accounts phase 4 (role-gated endpoints)');
// requireEntitledRole: anon -> 401
let g4 = await U.requireEntitledRole({ headers: { get: () => '' } }, dataEnv({}, null), 'member');
ok(g4.response && g4.response.status === 401, 'requireEntitledRole 401 for anon');
// expired entitlement -> 403 (blocked before role check)
g4 = await U.requireEntitledRole(req, dataEnv({}, { email: 'e@x.com', status: 'trial', trial_ends_at: Date.now() - 1 }), 'member');
ok(g4.response && g4.response.status === 403, 'requireEntitledRole 403 when not entitled');
// active owner -> passes with membership
g4 = await U.requireEntitledRole(req, dataEnv({}, active), 'member');
ok(!g4.response && g4.user && g4.membership && g4.membership.role === 'owner', 'requireEntitledRole passes for active owner');
// suspended member -> no_account 403
g4 = await U.requireEntitledRole(req, dataEnv({}, active, { email: active.email, account_id: 'A', role: 'member', status: 'suspended' }), 'member');
ok(g4.response && g4.response.status === 403, 'requireEntitledRole 403 for suspended member');
// member calling an admin-only guard -> forbidden 403
g4 = await U.requireEntitledRole(req, dataEnv({}, active, { email: active.email, account_id: 'A', role: 'member', status: 'active' }), 'admin');
ok(g4.response && g4.response.status === 403, 'requireEntitledRole 403 when role below required');
// data PUT by a suspended member is blocked
res = await DATA.onRequestPut({ request: { ...req, text: async () => '{}' }, env: dataEnv({}, active, { email: active.email, account_id: 'A', role: 'member', status: 'suspended' }) });
ok(res.status === 403, 'data PUT blocked for suspended member');
// data GET by a suspended member is blocked
res = await DATA.onRequestGet({ request: req, env: dataEnv({ row: null }, active, { email: active.email, account_id: 'A', role: 'member', status: 'suspended' }) });
ok(res.status === 403, 'data GET blocked for suspended member');
// an active member can still read/write (shared workspace)
res = await DATA.onRequestGet({ request: req, env: dataEnv({ row: null }, active, { email: active.email, account_id: 'A', role: 'member', status: 'active' }) });
ok((await res.json()).empty === true, 'data GET ok for active member');

// ---- Phase 5: member management (change role / remove) ----
section('accounts phase 5 (member management)');
import * as MROLE from '../functions/api/account/member-role.js';
import * as MREMOVE from '../functions/api/account/member-remove.js';
const ownerCaller = { sessionEmail: 'own@x.com', users: { 'own@x.com': { email: 'own@x.com', status: 'active' } }, members: { 'own@x.com': { email: 'own@x.com', account_id: 'A', role: 'owner', status: 'active' } }, accounts: { A: { id: 'A', owner_email: 'own@x.com' } } };
const adminCaller = { sessionEmail: 'ad@x.com', users: { 'ad@x.com': { email: 'ad@x.com', status: 'active' } }, members: { 'ad@x.com': { email: 'ad@x.com', account_id: 'A', role: 'admin', status: 'active' } }, accounts: { A: { id: 'A', owner_email: 'own@x.com' } } };
const withMembers = (base, extra) => Object.assign({}, base, { members: Object.assign({}, base.members, extra) });
const jReq = (b) => ({ headers: { get: () => 'sst_session=s' }, json: async () => b });
// member-role: non-admin caller blocked
let r5 = await MROLE.onRequestPost({ request: jReq({ email: 'x@x.com', role: 'admin' }), env: acct3Env({ sessionEmail: 'm@x.com', users: { 'm@x.com': {} }, members: { 'm@x.com': { account_id: 'A', role: 'member', status: 'active' } } }) });
ok(r5.status === 403, 'member-role 403 for non-admin caller');
r5 = await MROLE.onRequestPost({ request: jReq({ email: 'own@x.com', role: 'member' }), env: acct3Env(ownerCaller) });
ok(r5.status === 400 && (await r5.json()).error === 'self', 'member-role 400 on self');
r5 = await MROLE.onRequestPost({ request: jReq({ email: 't@x.com', role: 'owner' }), env: acct3Env(withMembers(ownerCaller, { 't@x.com': { account_id: 'A', role: 'member', status: 'active' } })) });
ok(r5.status === 400 && (await r5.json()).error === 'bad_role', 'member-role rejects setting owner');
r5 = await MROLE.onRequestPost({ request: jReq({ email: 't@x.com', role: 'admin' }), env: acct3Env(withMembers(ownerCaller, { 't@x.com': { account_id: 'B', role: 'member', status: 'active' } })) });
ok(r5.status === 404, 'member-role 404 for other-account target');
r5 = await MROLE.onRequestPost({ request: jReq({ email: 't@x.com', role: 'admin' }), env: acct3Env(withMembers(ownerCaller, { 't@x.com': { account_id: 'A', role: 'member', status: 'active' } })) });
ok(r5.status === 200 && (await r5.json()).role === 'admin', 'member-role owner promotes member to admin');
r5 = await MROLE.onRequestPost({ request: jReq({ email: 't@x.com', role: 'member' }), env: acct3Env(withMembers(adminCaller, { 't@x.com': { account_id: 'A', role: 'admin', status: 'active' } })) });
ok(r5.status === 403, 'member-role admin cannot change an admin');
// member-remove
let r6 = await MREMOVE.onRequestPost({ request: jReq({ email: 'own2@x.com' }), env: acct3Env(withMembers(ownerCaller, { 'own2@x.com': { account_id: 'A', role: 'owner', status: 'active' } })) });
ok(r6.status === 403, 'member-remove 403 removing an owner');
r6 = await MREMOVE.onRequestPost({ request: jReq({ email: 'own@x.com' }), env: acct3Env(ownerCaller) });
ok(r6.status === 400, 'member-remove 400 on self');
r6 = await MREMOVE.onRequestPost({ request: jReq({ email: 't@x.com' }), env: acct3Env(withMembers(ownerCaller, { 't@x.com': { account_id: 'A', role: 'member', status: 'active' } })) });
ok(r6.status === 200 && (await r6.json()).removed === 't@x.com', 'member-remove owner removes member');
r6 = await MREMOVE.onRequestPost({ request: jReq({ email: 't@x.com' }), env: acct3Env(withMembers(adminCaller, { 't@x.com': { account_id: 'A', role: 'admin', status: 'active' } })) });
ok(r6.status === 403, 'member-remove admin cannot remove an admin');
// ---- Self-provisioning: ensureAccountSchema ----
section('accounts self-provision (ensureAccountSchema)');
let schemaThrew = false;
try { await U.ensureAccountSchema({ DB: { prepare: () => ({ run: async () => { throw new Error('no ddl'); } }) } }); } catch (_) { schemaThrew = true; }
ok(schemaThrew, 'ensureAccountSchema fails closed when DDL throws');
const ddl = [];
const recDB = { prepare: (s) => ({ run: async () => { ddl.push(s); } }) };
await U.ensureAccountSchema({ DB: recDB });
const firstCount = ddl.length;
await U.ensureAccountSchema({ DB: recDB });
const joined = ddl.join('|');
ok(/CREATE TABLE IF NOT EXISTS accounts/.test(joined) && /memberships/.test(joined) && /invites/.test(joined), 'ensureAccountSchema creates accounts/memberships/invites');
ok(ddl.length === firstCount && firstCount === 7, 'ensureAccountSchema runs its 7 statements once per DB');

// ---- rb2b ingest (secret gate + field mapping) ----
section('rb2b ingest');
function rbReq(authHeader, body, urlStr) {
  return {
    url: urlStr || 'https://app.saasspendtrack.com/api/rb2b/ingest',
    headers: { get: (k) => (k.toLowerCase() === 'authorization' ? (authHeader || '') : null) },
    text: async () => body,
  };
}
function rbEnv(secret, cap) {
  return { RB2B_INGEST_SECRET: secret, DB: { prepare: (sql) => ({ bind: (...a) => ({
    first: async () => ({ count: 1 }),                       // rateLimit
    run: async () => { if (cap && sql.includes('INSERT INTO rb2b_visitors')) cap.args = a; },
  }) }) } };
}
let rb = await RB2B.onRequestPost({ request: rbReq('Bearer x', '{}'), env: rbEnv(null) });
ok(rb.status === 500, 'rb2b 500 when secret not configured');
rb = await RB2B.onRequestPost({ request: rbReq('Bearer wrong', '{}'), env: rbEnv('s3cret') });
ok(rb.status === 401, 'rb2b 401 on bad secret');
rb = await RB2B.onRequestPost({ request: rbReq('Bearer s3cret', 'not json'), env: rbEnv('s3cret') });
ok(rb.status === 400, 'rb2b 400 on bad json');
const rbCap = {};
rb = await RB2B.onRequestPost({ request: rbReq('Bearer s3cret', JSON.stringify({
  first_name: 'Ada', last_name: 'Lovelace', company_name: 'Analytical', title: 'CTO',
  linkedin_url: 'https://linkedin.com/in/ada' })), env: rbEnv('s3cret', rbCap) });
const rbBody = await rb.json();
ok(rb.status === 200 && rbBody.ok === true, 'rb2b 200 on valid payload');
ok(rbBody.id === 'https://linkedin.com/in/ada', 'rb2b dedups on linkedin url');
ok(rbCap.args && rbCap.args[1] === 'Ada Lovelace' && rbCap.args[2] === 'CTO' && rbCap.args[3] === 'Analytical',
  'rb2b maps name/title/company');
rb = await RB2B.onRequestPost({ request: rbReq(null, '{}', 'https://x/api/rb2b/ingest?key=s3cret'), env: rbEnv('s3cret') });
ok(rb.status === 200, 'rb2b accepts secret via query param');
// ---- accounts / roles (Phase 1 helpers; mocked D1) ----
section('accounts & roles');
ok(U.ROLE_RANK.owner > U.ROLE_RANK.admin && U.ROLE_RANK.admin > U.ROLE_RANK.member, 'role hierarchy owner>admin>member');
ok(U.MAX_MEMBERS === 50, 'member cap is 50');
ok(U.roleAtLeast('admin', 'member') && U.roleAtLeast('owner', 'admin') && U.roleAtLeast('member', 'member'), 'roleAtLeast meets');
ok(!U.roleAtLeast('member', 'admin') && !U.roleAtLeast('admin', 'owner'), 'roleAtLeast blocks lower');
ok(!U.roleAtLeast('bogus', 'member'), 'roleAtLeast unknown role denied');
function roleEnv(sessionEmail, userRow, membershipRow) {
  return { DB: { prepare(sql) { return { bind: () => ({
    first: async () => {
      if (/FROM sessions/i.test(sql)) return sessionEmail ? { email: sessionEmail, expires_at: Date.now() + 1e9 } : null;
      if (/FROM users/i.test(sql)) return userRow;
      if (/FROM memberships/i.test(sql)) return membershipRow;
      if (/COUNT/i.test(sql)) return { c: 1 };
      return null;
    },
    run: async () => {},
  }) }; } } };
}
const rReq = { headers: { get: () => 'sst_session=s' } };
let g = await U.requireRole({ headers: { get: () => '' } }, roleEnv(null), 'member');
ok(g.response && g.response.status === 401, 'requireRole 401 without session');
g = await U.requireRole(rReq, roleEnv('u@x.com', { email: 'u@x.com' }, { account_id: 'A', role: 'member', status: 'active' }), 'admin');
ok(g.response && g.response.status === 403, 'requireRole 403 member needs admin');
g = await U.requireRole(rReq, roleEnv('u@x.com', { email: 'u@x.com' }, { account_id: 'A', role: 'admin', status: 'active' }), 'admin');
ok(!g.response && g.membership.role === 'admin', 'requireRole admin passes admin gate');
g = await U.requireRole(rReq, roleEnv('u@x.com', { email: 'u@x.com' }, { account_id: 'A', role: 'owner', status: 'active' }), 'admin');
ok(!g.response && g.membership.role === 'owner', 'requireRole owner passes admin gate');
g = await U.requireRole(rReq, roleEnv('u@x.com', { email: 'u@x.com' }, { account_id: 'A', role: 'member', status: 'suspended' }), 'member');
ok(g.response && g.response.status === 403, 'requireRole 403 suspended member');
// New user with no membership is lazily made owner of their own account.
g = await U.requireRole(rReq, roleEnv('new@x.com', { email: 'new@x.com' }, null), 'member');
ok(!g.response && g.membership.role === 'owner', 'requireRole lazily provisions owner for new user');

// ---- preset generator endpoint (validation + gating; no network) ----
section('preset generator');
import * as PRESET from '../functions/api/preset/generate.js';
function presetEnv(user, key) {
  let rl = 0;
  return { ANTHROPIC_API_KEY: key, ADMIN_EMAILS: '', DB: { prepare(sql) { return { bind: (...a) => ({
    first: async () => {
      if (/sessions/i.test(sql)) return user ? { email: user.email, expires_at: Date.now() + 1e9 } : null;
      if (/rate/i.test(sql)) return { count: ++rl };
      if (/memberships/i.test(sql)) return user ? { email: user.email, account_id: 'A', role: 'owner', status: 'active' } : null;
      if (/accounts/i.test(sql)) return user ? { id: 'A', owner_email: user.email } : null;
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

// ---- accounts Phase 3: invite / accept / members (mocked; no network) ----
section('accounts phase 3 (invites)');
import * as INVITE from '../functions/api/account/invite.js';
import * as ACCEPT from '../functions/api/account/accept.js';
import * as MEMBERS from '../functions/api/account/members.js';
function acct3Env(o) {
  o = o || {};
  return { ADMIN_EMAILS: o.adminEmails || '', DB: { prepare(sql) { let b;
    return { bind: (...a) => { b = a; return {
      first: async () => {
        if (/FROM sessions/i.test(sql)) return o.sessionEmail ? { email: o.sessionEmail, expires_at: Date.now() + 1e9 } : null;
        if (/FROM users WHERE email/i.test(sql)) return (o.users || {})[b[0]] || null;
        if (/FROM memberships WHERE email/i.test(sql)) return (o.members || {})[b[0]] || null;
        if (/FROM accounts WHERE id/i.test(sql)) return (o.accounts || {})[b[0]] || null;
        if (/COUNT\(\*\) c FROM memberships/i.test(sql)) return { c: o.memberCount || 0 };
        if (/COUNT\(\*\) c FROM invites/i.test(sql)) return { c: o.pendingCount || 0 };
        if (/FROM invites WHERE token_hash/i.test(sql)) return (o.invitesByHash || {})[b[0]] || null;
        if (/UPDATE invites SET used=1/i.test(sql)) { const inv = (o.invitesByHash || {})[b[0]]; if (!inv || inv.used || inv.expires_at <= b[1]) return null; inv.used = 1; return { token_hash: b[0] }; }
        if (/SELECT account_id, status FROM memberships/i.test(sql)) return (o.members || {})[b[0]] || null;
        return null;
      },
      all: async () => {
        if (/FROM memberships WHERE account_id/i.test(sql)) return { results: o.roster || [] };
        if (/FROM invites WHERE account_id/i.test(sql)) return { results: o.pendingList || [] };
        return { results: [] };
      },
      run: async () => {},
    }; }, };
  } } };
}
const admEnv = (over) => acct3Env(Object.assign({
  sessionEmail: 'adm@x.com', users: { 'adm@x.com': { email: 'adm@x.com', status: 'active' } },
  members: { 'adm@x.com': { email: 'adm@x.com', account_id: 'A', role: 'admin', status: 'active' } },
  accounts: { A: { id: 'A', owner_email: 'own@x.com' } }, memberCount: 2, pendingCount: 0,
}, over || {}));
const iReq = (bodyObj) => ({ headers: { get: () => 'sst_session=s' }, json: async () => bodyObj });
// A plain member cannot invite.
let ra3 = await INVITE.onRequestPost({ request: iReq({ email: 'new@x.com' }), env: acct3Env({ sessionEmail: 'm@x.com', users: { 'm@x.com': {} }, members: { 'm@x.com': { account_id: 'A', role: 'member', status: 'active' } } }) });
ok(ra3.status === 403, 'invite 403 when caller is only a member');
// Admin inviting themselves is rejected.
ra3 = await INVITE.onRequestPost({ request: iReq({ email: 'adm@x.com' }), env: admEnv() });
ok(ra3.status === 400 && (await ra3.json()).error === 'self', 'invite 400 on self');
// Email already in another account.
ra3 = await INVITE.onRequestPost({ request: iReq({ email: 'other@x.com' }), env: admEnv({ members: { 'adm@x.com': { account_id: 'A', role: 'admin', status: 'active' }, 'other@x.com': { account_id: 'B', role: 'member', status: 'active' } } }) });
ok(ra3.status === 409 && (await ra3.json()).error === 'other_account', 'invite 409 when email in another account');
// 50-member cap blocks.
ra3 = await INVITE.onRequestPost({ request: iReq({ email: 'new@x.com', role: 'member' }), env: admEnv({ memberCount: 50 }) });
ok(ra3.status === 403 && (await ra3.json()).error === 'member_cap', 'invite 403 at member cap');
// Happy path (no ZEPTOMAIL_TOKEN -> email no-ops, no network).
ra3 = await INVITE.onRequestPost({ request: iReq({ email: 'new@x.com', role: 'admin' }), env: admEnv() });
let jx3 = await ra3.json();
ok(jx3.ok === true && jx3.invited === 'new@x.com' && jx3.role === 'admin', 'invite ok creates invite');
// Accept: no token -> redirect invalid.
ra3 = await ACCEPT.onRequestGet({ request: { url: 'https://app.saasspendtrack.com/api/account/accept' }, env: acct3Env({}) });
ok(ra3.status === 302 && ra3.headers.get('Location').includes('invite=invalid'), 'accept 302 invalid without token');
// Accept: valid single-use invite -> session + redirect ok.
const tok = 'tok-123';
const th = await U.sha256Hex(tok);
ra3 = await ACCEPT.onRequestGet({
  request: { url: 'https://app.saasspendtrack.com/api/account/accept?token=' + tok },
  env: acct3Env({ invitesByHash: { [th]: { account_id: 'A', email: 'inv@x.com', role: 'member', used: 0, expires_at: Date.now() + 1e9, invited_by: 'own@x.com' } }, accounts: { A: { id: 'A', owner_email: 'own@x.com' } }, users: { 'own@x.com': { status: 'active', trial_ends_at: Date.now() + 9e9 } }, memberCount: 1 }),
});
ok(ra3.status === 302 && ra3.headers.get('Location').includes('invite=ok') && !!ra3.headers.get('Set-Cookie'), 'accept 302 ok + session cookie');
// Members list: member sees roster, no manage; admin can manage + sees invites.
ra3 = await MEMBERS.onRequestGet({ request: iReq({}), env: acct3Env({ sessionEmail: 'm@x.com', users: { 'm@x.com': { email: 'm@x.com', status: 'active' } }, members: { 'm@x.com': { account_id: 'A', role: 'member', status: 'active' } }, roster: [{ email: 'm@x.com', role: 'member', status: 'active' }], pendingList: [{ email: 'p@x.com' }] }) });
jx3 = await ra3.json();
ok(jx3.members.length === 1 && jx3.canManage === false && jx3.invites.length === 0, 'members: plain member sees roster, no invites');
ra3 = await MEMBERS.onRequestGet({ request: iReq({}), env: admEnv({ roster: [{ email: 'adm@x.com', role: 'admin', status: 'active' }], pendingList: [{ email: 'p@x.com', role: 'member' }] }) });
jx3 = await ra3.json();
ok(jx3.canManage === true && jx3.invites.length === 1 && jx3.cap === 50, 'members: admin can manage + sees invites + cap 50');
// Degraded path: accounts tables not migrated yet -> roster query throws -> sole-owner + pendingSetup, not a 500.
function acctThrowEnv() {
  return { ADMIN_EMAILS: '', DB: { prepare(sql) { let b;
    return { bind: (...a) => { b = a; return {
      first: async () => {
        if (/FROM sessions/i.test(sql)) return { email: 'own@x.com', expires_at: Date.now() + 1e9 };
        if (/FROM users WHERE email/i.test(sql)) return { email: 'own@x.com', status: 'active' };
        if (/FROM memberships WHERE email/i.test(sql)) throw new Error('no such table: memberships');
        if (/INTO accounts|INTO memberships/i.test(sql)) throw new Error('no such table');
        return null;
      },
      all: async () => { if (/FROM memberships WHERE account_id/i.test(sql)) throw new Error('no such table: memberships'); return { results: [] }; },
      run: async () => { throw new Error('no such table'); },
    }; }, };
  } } };
}
let blockedMissingSchema = false;
try { ra3 = await MEMBERS.onRequestGet({ request: iReq({}), env: acctThrowEnv() }); blockedMissingSchema = ra3.status >= 400; } catch (_) { blockedMissingSchema = true; }
ok(blockedMissingSchema, 'members: missing schema must not imply owner access');
// ---- accounts Phase 2: shared-workspace data keying + /api/me account ----
section('accounts phase 2 (shared workspace)');
import * as ME from '../functions/api/me.js';
function acctEnv(user, membership, account, store) {
  return { DB: { prepare(sql) { let bound;
    return { bind: (...a) => { bound = a; return {
      first: async () => {
        if (/FROM sessions/i.test(sql)) return user ? { email: user.email, expires_at: Date.now() + 1e9 } : null;
        if (/FROM users/i.test(sql)) return user;
        if (/FROM memberships/i.test(sql)) return membership;
        if (/FROM accounts/i.test(sql)) return account;
        if (/FROM app_data/i.test(sql)) return store[bound[0]] != null ? { data: store[bound[0]] } : null;
        return null;
      },
      run: async () => { if (/INTO app_data/i.test(sql)) store[bound[0]] = bound[1]; },
    }; } };
  } } };
}
const p2member = { email: 'member@x.com', status: 'active', trial_ends_at: Date.now() + 9e9 };
const p2owner = { email: 'owner@x.com', status: 'active', trial_ends_at: Date.now() + 9e9 };
const p2acct = { id: 'A', owner_email: 'owner@x.com', name: 'Acme' };
const p2memMember = { email: 'member@x.com', account_id: 'A', role: 'member', status: 'active' };
const p2memOwner = { email: 'owner@x.com', account_id: 'A', role: 'owner', status: 'active' };
const p2req = { headers: { get: () => 'sst_session=s' }, text: async () => JSON.stringify({ hi: 1 }) };
// Member reads the OWNER's app_data row (shared workspace).
let p2store = { 'owner@x.com': JSON.stringify({ shared: true }) };
let p2res = await DATA.onRequestGet({ request: p2req, env: acctEnv(p2member, p2memMember, p2acct, p2store) });
ok((await p2res.json()).data.shared === true, 'member reads owner shared workspace');
// Member WRITES land on the owner's row, not their own email.
p2store = {};
p2res = await DATA.onRequestPut({ request: p2req, env: acctEnv(p2member, p2memMember, p2acct, p2store) });
ok((await p2res.json()).ok === true, 'member put ok');
ok(p2store['owner@x.com'] && !p2store['member@x.com'], 'member write lands on shared owner row');
// Solo user with no account row keys by own email (zero change for existing users).
p2store = { 'solo@x.com': JSON.stringify({ solo: 1 }) };
const solo = { email: 'solo@x.com', status: 'active', trial_ends_at: Date.now() + 9e9 };
const soloMem = { email: 'solo@x.com', account_id: 'S', role: 'owner', status: 'active' };
p2res = await DATA.onRequestGet({ request: p2req, env: acctEnv(solo, soloMem, { id: 'S', owner_email: 'solo@x.com' }, p2store) });
ok((await p2res.json()).data.solo === 1, 'solo owner reads own row unchanged');
// /api/me returns account + role.
p2res = await ME.onRequestGet({ request: p2req, env: acctEnv(p2member, p2memMember, p2acct, {}) });
let meb = await p2res.json();
ok(meb.account && meb.account.id === 'A' && meb.account.role === 'member' && meb.account.isOwner === false, 'me returns account+role (member)');
p2res = await ME.onRequestGet({ request: p2req, env: acctEnv(p2owner, p2memOwner, p2acct, {}) });
ok((await p2res.json()).account.isOwner === true, 'me marks owner isOwner');

// ---- result ----
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
