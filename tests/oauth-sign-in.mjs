import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet as providers} from '../functions/api/auth/oauth/providers.js';
import {onRequestGet as start, onRequestPost as connect} from '../functions/api/auth/oauth/[provider]/start.js';
import {onRequestGet as callback} from '../functions/api/auth/oauth/[provider]/callback.js';
import {pkceChallenge} from '../functions/_shared/oauth.js';
import {validateIdToken} from '../functions/_shared/oidc.js';
import {sessionStorageId} from '../functions/_shared/session-token.js';
import {workspaceMemberCap} from '../functions/_shared/util.js';

const db = new DatabaseSync(':memory:');
for (const file of ['schema.sql', 'migrations/003_oauth_identity.sql']) {
  db.exec(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
}
const DB = {prepare(sql) {
  const make = (...params) => {
    const statement = db.prepare(sql);
    const bindings = sql.includes('?1') ? [{1: params[0], 2: params[1], 3: params[2]}] : params;
    return {first: async () => statement.get(...bindings), run: async () => {
      const meta = statement.run(...bindings);
      return {success: true, meta};
    }};
  };
  return {...make(), bind: make};
}};
const origin = 'https://app.example.invalid';
const env = {DB, APP_URL: origin, OAUTH_ENABLED: 'true', GOOGLE_OAUTH_CLIENT_ID: 'google-client',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-fixture', MICROSOFT_OAUTH_CLIENT_ID: 'microsoft-client',
  MICROSOFT_OAUTH_CLIENT_SECRET: 'microsoft-fixture', PLATFORM_OWNER_EMAIL: 'owner@example.invalid'};
const owner = 'owner@example.invalid';
const other = 'other@example.invalid';
const ownerSession = 'a'.repeat(64);
const otherSession = 'b'.repeat(64);
const now = Date.now();
for (const [email, account, token] of [[owner, 'a', ownerSession], [other, 'b', otherSession]]) {
  db.prepare('INSERT INTO users(email,created_at,trial_ends_at) VALUES(?,?,?)').run(email, now, now);
  db.prepare('INSERT INTO accounts(id,owner_email,created_at) VALUES(?,?,?)').run(account, email, now);
  db.prepare("INSERT INTO memberships(email,account_id,role,status,created_at) VALUES(?,?,'owner','active',?)").run(email, account, now);
  db.prepare('INSERT INTO sessions(id,email,created_at,expires_at) VALUES(?,?,?,?)')
    .run(await sessionStorageId(token), email, now, now + 100000);
}
assert.equal(await workspaceMemberCap(env, 'a'), null);
assert.equal(await workspaceMemberCap(env, 'b'), 50);
db.exec("UPDATE memberships SET status='suspended' WHERE account_id='a'");
assert.equal(await workspaceMemberCap(env, 'a'), 50);
db.exec("UPDATE memberships SET status='active' WHERE account_id='a'");

const {publicKey, privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'test-key', alg: 'RS256', use: 'sig'};
const tenant = '12345678-1234-1234-1234-123456789012';
let current, claimPatch, badSignature, jwksRedirect, revokeLinkSession;
function jwt(provider, nonce, patch = {}) {
  const issuer = provider === 'google' ? 'https://accounts.google.com' : 'https://login.microsoftonline.com/' + tenant + '/v2.0';
  const t = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = encode({alg: 'RS256', kid: jwk.kid}) + '.' + encode({iss: issuer, aud: provider + '-client',
    sub: 'stable-subject', nonce, iat: t, exp: t + 300, email: owner, email_verified: true,
    ...(provider === 'microsoft' ? {tid: tenant, ver: '2.0'} : {}), ...patch});
  return unsigned + '.' + (badSignature ? Buffer.alloc(256) : sign('RSA-SHA256', Buffer.from(unsigned), privateKey)).toString('base64url');
}
const originalFetch = globalThis.fetch;
let exchanges = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(options.redirect, 'manual');
  if (options.method === 'POST') {
    exchanges++;
    assert.equal(options.body.get('redirect_uri'), current.params.get('redirect_uri'));
    assert.equal(await pkceChallenge(options.body.get('code_verifier')), current.params.get('code_challenge'));
    if (revokeLinkSession) db.prepare('DELETE FROM sessions WHERE id=?').run(await sessionStorageId(otherSession));
    return Response.json({id_token: jwt(current.provider, current.params.get('nonce'), claimPatch)});
  }
  assert.ok(['https://www.googleapis.com/oauth2/v3/certs', 'https://login.microsoftonline.com/' + tenant + '/discovery/v2.0/keys'].includes(url));
  return jwksRedirect ? Response.redirect('https://example.invalid/keys') : Response.json({keys: [jwk]});
};
async function begin(provider, token) {
  const request = new Request(origin + '/api/auth/oauth/' + provider + '/start', token ?
    {method: 'POST', headers: {Origin: origin, Cookie: 'sst_session=' + token}} : {});
  const response = await (token ? connect : start)({request, env, params: {provider}});
  assert.equal(response.status, 302);
  const params = new URL(response.headers.get('Location')).searchParams;
  assert.equal(params.get('redirect_uri'), origin + '/api/auth/oauth/' + provider + '/callback');
  assert.equal(params.get('code_challenge_method'), 'S256');
  return {params, provider, cookie: response.headers.get('Set-Cookie').split(';')[0]};
}
async function finish(attempt, token, browserCookie = attempt.cookie) {
  current = attempt;
  const {provider, params} = attempt;
  const request = new Request(origin + '/api/auth/oauth/' + provider + '/callback?code=fixture&state=' + encodeURIComponent(params.get('state')), {
    headers: {Cookie: browserCookie + (token ? '; sst_session=' + token : '')}
  });
  return callback({request, env, params: {provider}});
}
const outcome = response => new URL(response.headers.get('Location')).searchParams.get('auth');
const contexts = () => db.prepare('SELECT provider,email FROM oauth_identities ORDER BY provider').all().map(row => [row.provider,row.email]);
try {
  assert.deepEqual(await providers({env: {...env, OAUTH_ENABLED:'false'}}).json(), {providers: []});
  assert.deepEqual(await providers({env}).json(), {providers: ['google', 'microsoft']});
  const badOrigin = new Request(origin + '/api/auth/oauth/google/start', {method:'POST', headers:{Origin:'https://example.invalid'}});
  assert.equal((await connect({request:badOrigin,env,params:{provider:'google'}})).status, 403);
  const anonymous = await begin('google');
  assert.equal(outcome(await finish(anonymous)), 'oauth_unlinked');
  assert.equal(outcome(await finish(anonymous)), 'oauth_error');
  assert.deepEqual(contexts(), []);
  const link = await begin('google', ownerSession);
  const before = exchanges;
  assert.equal(outcome(await finish(link, otherSession)), 'oauth_error');
  assert.equal(exchanges, before);
  assert.equal(outcome(await finish(link, ownerSession)), 'oauth_linked');
  assert.equal(outcome(await finish(await begin('google', otherSession), otherSession)), 'oauth_conflict');
  assert.deepEqual(contexts(), [['google',owner]]);
  const signedIn = await finish(await begin('google'));
  assert.equal(outcome(signedIn), 'ok');
  assert.ok(signedIn.headers.getSetCookie().some(cookie => /^sst_session=[a-f0-9]{64};/.test(cookie)));
  badSignature = true;
  assert.equal(outcome(await finish(await begin('google'))), 'oauth_error');
  badSignature = false;
  for (const patch of [{nonce: 'wrong'}, {aud: 'wrong'}, {iss: 'https://other.invalid'}, {exp: 1}]) {
    claimPatch = patch;
    assert.equal(outcome(await finish(await begin('google'))), 'oauth_error');
  }
  claimPatch = undefined;
  jwksRedirect = true;
  assert.equal(outcome(await finish(await begin('google'))), 'oauth_error');
  jwksRedirect = false;
  assert.equal((await validateIdToken(jwt('microsoft', 'nonce'), 'microsoft', 'microsoft-client', 'nonce')).issuer,
    'https://login.microsoftonline.com/' + tenant + '/v2.0');
  await assert.rejects(validateIdToken(jwt('microsoft', 'nonce', {ver:'1.0'}), 'microsoft', 'microsoft-client', 'nonce'), /invalid_issuer/);
  const revoked = await begin('microsoft', otherSession);
  revokeLinkSession = true;
  assert.equal(outcome(await finish(revoked, otherSession)), 'oauth_conflict');
  assert.deepEqual(contexts(), [['google',owner]]);
  revokeLinkSession = false;
  assert.equal(outcome(await finish(await begin('microsoft', ownerSession), ownerSession)), 'oauth_linked');
  assert.equal(outcome(await finish(await begin('microsoft'))), 'ok');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('PASS: verified OAuth signatures, issuer, audience, nonce, PKCE, replay, explicit linking and owner workspace boundaries');
