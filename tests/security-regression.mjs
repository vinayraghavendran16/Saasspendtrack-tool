import assert from 'node:assert/strict';
import { onRequestGet as verify } from '../functions/api/auth/verify.js';

const token = 'test-token';
const { sha256Hex } = await import('../functions/_shared/util.js');
const hash = await sha256Hex(token);
let used = false;
let sessions = 0;
const db = { prepare(sql) { return { bind(...args) { return {
  async first() {
    if (sql.startsWith('UPDATE login_tokens')) {
      if (args[0] !== hash || used) return null;
      used = true;
      return { email: 'tester@example.com' };
    }
    if (sql.includes('email_log')) return { kind: 'welcome' };
    return null;
  },
  async run() {
    if (sql.startsWith('INSERT INTO sessions')) sessions++;
    return {};
  },
}; } }; } };
const ctx = { request: new Request('https://example.com/api/auth/verify?token=' + token), env: { DB: db } };
const results = await Promise.all([verify(ctx), verify(ctx)]);
assert.equal(sessions, 1);
assert.equal(results.filter(r => r.headers.has('set-cookie')).length, 1);
console.log('PASS: single-use login token');

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
  request: new Request('https://example.com/api/extract', { method: 'POST', headers: { Cookie: 'sst_session=s' }, body: JSON.stringify({ text: 'confidential document contents should never be sent' }) }),
  env: { DB: consentDb, ANTHROPIC_API_KEY: 'not-a-real-key' },
});
assert.equal(consentResponse.status, 403);
assert.equal((await consentResponse.json()).error, 'ai_consent_required');
assert.equal(externalCalls, 0);
globalThis.fetch = originalFetch;
console.log('PASS: AI extraction denied without workspace opt-in');
