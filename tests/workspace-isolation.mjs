import assert from 'node:assert/strict';
import { onRequestGet, onRequestPut } from '../functions/api/data.js';

// Exercise real endpoint guards with two distinct workspaces and a shared D1 mock.
const users = {
  'a@example.com': { email: 'a@example.com', status: 'active', trial_ends_at: Date.now() + 86400000 },
  'b@example.com': { email: 'b@example.com', status: 'active', trial_ends_at: Date.now() + 86400000 },
  'removed@example.com': { email: 'removed@example.com', status: 'active', trial_ends_at: Date.now() + 86400000 },
};
const members = {
  'a@example.com': { email: 'a@example.com', account_id: 'A', role: 'owner', status: 'active' },
  'b@example.com': { email: 'b@example.com', account_id: 'B', role: 'owner', status: 'active' },
  'removed@example.com': { email: 'removed@example.com', account_id: 'A', role: 'member', status: 'suspended' },
};
const accounts = {
  A: { id: 'A', owner_email: 'a@example.com' },
  B: { id: 'B', owner_email: 'b@example.com' },
};
const data = new Map();
let failAccountLookup = false;
let failMembershipLookup = false;
const env = { DB: {
  prepare(sql) {
    let args = [];
    const bound = {
      async first() {
        if (/FROM sessions/i.test(sql)) return { email: args[0], expires_at: Date.now() + 10000 };
        if (/FROM users WHERE email/i.test(sql)) return users[args[0]] || null;
        if (/FROM memberships WHERE email/i.test(sql)) {
          if (failMembershipLookup) throw new Error('D1 unavailable');
          return members[args[0]] || null;
        }
        if (/FROM accounts WHERE id/i.test(sql)) {
          if (failAccountLookup) return null;
          return accounts[args[0]] || null;
        }
        if (/SELECT data, version FROM app_data/i.test(sql)) return data.get(args[0]) || null;
        if (/INSERT OR IGNORE INTO app_data/i.test(sql)) {
          if (data.has(args[0])) return null;
          data.set(args[0], { data: args[1], version: 1 });
          return { version: 1 };
        }
        if (/UPDATE app_data SET/i.test(sql)) {
          const old = data.get(args[2]);
          if (!old || old.version !== args[3]) return null;
          const newVersion = old.version + 1;
          data.set(args[2], { data: args[0], version: newVersion });
          return { version: newVersion };
        }
        return null;
      },
      async run() { return { success: true }; },
    };
    return { bind(...a) { args = a; return bound; }, run: bound.run };
  },
} };
function req(email, method = 'GET', body, version = 0) {
  const headers = { Cookie: 'sst_session=' + email };
  if (version !== null) headers['If-Match'] = String(version);
  return new Request('https://app.example.com/api/data', {
    method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function put(email, payload, version = 0) { return onRequestPut({ request: req(email, 'PUT', payload, version), env }); }
async function get(email) { return onRequestGet({ request: req(email), env }); }

assert.equal((await put('a@example.com', { vendor: 'Alpha secret' })).status, 200);
assert.equal((await put('b@example.com', { vendor: 'Beta secret' })).status, 200);
assert.deepEqual((await (await get('a@example.com')).json()).data, { vendor: 'Alpha secret' });
assert.equal((await (await get('a@example.com')).json()).version, 1);
assert.equal((await put('a@example.com', { vendor: 'stale writer' })).status, 409);
assert.equal((await (await get('a@example.com')).json()).data.vendor, 'Alpha secret');
assert.equal((await put('a@example.com', { vendor: 'updated Alpha' }, 1)).status, 200);
assert.equal((await (await get('a@example.com')).json()).version, 2);
assert.equal((await put('a@example.com', { vendor: 'outdated Alpha' }, 1)).status, 409);
assert.equal((await put('a@example.com', { vendor: 'missing revision' }, null)).status, 428);
assert.equal((await (await get('a@example.com')).json()).data.vendor, 'updated Alpha');
assert.deepEqual((await (await get('b@example.com')).json()).data, { vendor: 'Beta secret' });
assert.equal(data.size, 2);
assert.equal((await get('removed@example.com')).status, 403);
assert.equal((await put('removed@example.com', { vendor: 'attack' })).status, 403);

failAccountLookup = true;
assert.equal((await get('a@example.com')).status, 403);
assert.equal((await put('a@example.com', { vendor: 'attack' })).status, 403);
failAccountLookup = false;

failMembershipLookup = true;
await assert.rejects(() => get('a@example.com'), /D1 unavailable/);
await assert.rejects(() => put('a@example.com', { vendor: 'attack' }), /D1 unavailable/);
assert.equal(data.size, 2);
console.log('PASS: workspace isolation, suspended member denial, and fail-closed account resolution');
