import assert from 'node:assert/strict';
import { onRequestGet as verify } from '../functions/api/auth/verify.js';
import { onRequestPost as extract } from '../functions/api/extract.js';

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
