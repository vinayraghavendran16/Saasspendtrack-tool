import assert from 'node:assert/strict';
import { onRequestGet as verify } from '../functions/api/auth/verify.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequestGet as me } from '../functions/api/me.js';
import { onRequestGet as readWorkspace } from '../functions/api/data.js';
import { getUserFromSession, sha256Hex } from '../functions/_shared/util.js';

const token = 'test-token';
const hash = await sha256Hex(token);
let used = false;
const sessions = new Map();
const db = { prepare(sql) { return { bind(...args) { return {
  async first() {
    if (sql.startsWith('UPDATE login_tokens')) {
      if (args[0] !== hash || used) return null;
      used = true;
      return { email: 'tester@example.com' };
    }
    if (sql.includes('FROM sessions')) return sessions.get(args[0]) || null;
    if (sql.includes('FROM users')) return { email: args[0] };
    if (sql.includes('email_log')) return { kind: 'welcome' };
    return null;
  },
  async run() {
    if (sql.startsWith('INSERT INTO sessions')) sessions.set(args[0], { email: args[1] });
    if (sql.startsWith('DELETE FROM sessions')) args.forEach(id => sessions.delete(id));
    return {};
  },
}; } }; } };
const ctx = { request: new Request('https://example.com/api/auth/verify?token=' + token), env: { DB: db } };
const results = await Promise.all([verify(ctx), verify(ctx)]);
assert.equal(sessions.size, 1);
assert.equal(results.filter(r => r.headers.has('set-cookie')).length, 1);
const redeemed = results.find(r => r.headers.has('set-cookie'));
const cookie = redeemed.headers.get('set-cookie').split(';')[0];
const request = new Request('https://example.com/api/auth/logout', {
  method: 'POST', headers: { Cookie: cookie },
});
assert.equal((await getUserFromSession(request, ctx.env)).email, 'tester@example.com');
const signedOut = await logout({ request, env: ctx.env });
assert.equal(signedOut.status, 200);
assert.match(signedOut.headers.get('set-cookie'), /Max-Age=0/i);
const replayRequest = new Request('https://example.com/api/me', { headers: { Cookie: cookie } });
assert.deepEqual(await (await me({ request: replayRequest, env: ctx.env })).json(), { authenticated: false });
assert.equal((await readWorkspace({ request: replayRequest, env: ctx.env })).status, 401);
const replay = await verify(ctx);
assert.match(replay.headers.get('location'), /auth=expired$/);
assert.equal(replay.headers.get('set-cookie'), null);
assert.equal(sessions.size, 0);
console.log('PASS: single-use login token and server-side logout reject replay');

import { onRequestPost as extract } from '../functions/api/extract.js';
import { onRequestGet as accept } from '../functions/api/account/accept.js';
// A valid member without an AI opt-in must never send document data to Anthropic.
let externalCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { externalCalls++; throw new Error('unexpected external call'); };
const consentDb = {
  prepare(sql) { return { bind() { return {
    async first() {
      if (sql.includes('FROM sessions')) return { email: 'member@example.com' };
      if (sql.includes('FROM users')) return { email: 'member@example.com', status: 'active', trial_ends_at: Date.now() + 60000 };
      if (sql.includes('FROM memberships')) return { email: 'member@example.com', account_id: 'account-1', role: 'member', status: 'active' };
      if (sql.includes('FROM accounts')) return { id: 'account-1', owner_email: 'member@example.com' };
      if (sql.includes('workspace_ai_settings')) return null;
      return null;
    },
    async run() { return {}; },
  }; } }; },
};
const consentResponse = await extract({
  request: new Request('https://example.com/api/extract', { method: 'POST', headers: { Cookie: 'sst_session='+'a'.repeat(64) }, body: JSON.stringify({ text: 'confidential document contents should never be sent' }) }),
  env: { DB: consentDb, ANTHROPIC_API_KEY: 'not-a-real-key' },
});
assert.equal(consentResponse.status, 403);
assert.equal((await consentResponse.json()).error, 'ai_consent_required');
assert.equal(externalCalls, 0);
globalThis.fetch = originalFetch;
console.log('PASS: AI extraction denied without workspace opt-in');

import { onRequestPost as ask } from '../functions/api/ask.js';
import { onRequestPost as preset } from '../functions/api/preset/generate.js';
globalThis.fetch = async () => { externalCalls++; throw new Error('unexpected external call'); };
try {
  for (const [handler, route, payload] of [[ask,'ask',{question:'spend?',snapshot:{private:true}}],[preset,'preset/generate',{url:'https://example.com'}]]) {
    const response = await handler({request:new Request('https://example.com/api/'+route,{method:'POST',headers:{Cookie:'sst_session='+'a'.repeat(64)},body:JSON.stringify(payload)}),env:{DB:consentDb,ANTHROPIC_API_KEY:'not-a-real-key'}});
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,'ai_consent_required');
  }
  assert.equal(externalCalls,0);
} finally { globalThis.fetch = originalFetch; }
console.log('PASS: AI assistant and preset generation denied without workspace opt-in');
