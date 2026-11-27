import assert from 'node:assert/strict';
import {sessionStorageId} from '../functions/_shared/session-token.js';
const tokens=new Map(), sessions=new Map();
for(const [i,email] of ['a@example.com','b@example.com','removed@example.com','member@example.com','owner@example.com','admin@example.com'].entries()){const token=(i+1).toString(16).padStart(64,'0');tokens.set(email,token);sessions.set(await sessionStorageId(token),email);}
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
        if (/FROM sessions/i.test(sql)) return { email: sessions.get(args[0]), expires_at: Date.now() + 10000 };
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
  const headers = { Cookie: 'sst_session=' + tokens.get(email) };
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
assert.equal((await (await get('a@example.com')).json()).workspaceId, 'A');
assert.equal((await (await get('b@example.com')).json()).workspaceId, 'B');
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
assert.notEqual((await (await get('a@example.com')).json()).workspaceId, (await (await get('b@example.com')).json()).workspaceId);
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

failMembershipLookup = false;
for (const payload of [[], 'invalid', {subscriptions:null}, {invoices:[null]}, {employees:[42]}, {settings:[]}]) {
  assert.equal((await put('a@example.com', payload, 2)).status,400);
}
assert.equal((await put('a@example.com', {note:'€'.repeat(510000)},2)).status,413);
assert.equal((await (await get('a@example.com')).json()).version,2);
assert.equal((await (await get('a@example.com')).json()).data.vendor,'updated Alpha');
const original = data.get('a@example.com');
for (const row of [{data:'',version:2},{data:'null',version:2},{data:'[]',version:2},{data:'{}',version:0}]) {
  data.set('a@example.com',row);
  assert.equal((await get('a@example.com')).status,503);
}
data.set('a@example.com',original);
console.log('PASS: invalid snapshots, UTF-8 size limits and corrupt saved rows fail closed');

const eur = {
  settings: { currency: 'EUR' },
  subscriptions: [{ id: 's1', cost: 1200, currency: 'eur' }],
  invoices: [{ id: 'i1', amount: 1200 }],
};
assert.equal((await put('a@example.com', eur, 2)).status, 200);
assert.deepEqual((await (await get('a@example.com')).json()).data, eur);

for (const payload of [
  { ...eur, invoices: [{ amount: 20, currency: 'USD' }] },
  { ...eur, subscriptions: [{ cost: 20, currency: 123 }] },
  { settings: { currency: 'ZZZ' } },
]) {
  const response = await put('a@example.com', payload, 3);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_currency');
}
for (const settings of [{ currency: 'USD' }, {}]) {
  const response = await put('a@example.com', { settings, subscriptions: [] }, 3);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, 'currency_locked');
}
assert.deepEqual((await (await get('a@example.com')).json()).data, eur);
assert.equal((await put('b@example.com', { subscriptions: [{ cost: 20 }] }, 1)).status, 200);
assert.equal((await put('b@example.com', { settings: { currency: 'EUR' } }, 2)).status, 422);
assert.equal((await put('b@example.com', { settings: { currency: 'USD' } }, 2)).status, 200);
console.log('PASS: currency consistency and existing workspace currency protection');

const mixed = {
  subscriptions: [{ id: 's1', currency: 'EUR', cost: 100 }],
  invoices: [{ id: 'i1', currency: 'USD', amount: 120 }],
};
data.set('a@example.com', { data: JSON.stringify(mixed), version: 4 });
const review = await (await get('a@example.com')).json();
assert.equal(review.needsCurrencyReview, true);
assert.equal(review.version, 4);
assert.deepEqual(review.data, mixed);
assert.equal((await (await get('b@example.com')).json()).needsCurrencyReview, undefined);
console.log('PASS: older mixed-currency snapshots are flagged and preserved for review');

async function correct(email, overrides = {}, version = 4) {
  const request = req(email, 'PUT', {
    workspaceId: 'A', currency: 'EUR', confirmed: true, ...overrides,
  }, version);
  request.headers.set('X-Workspace-Action', 'correct-currency');
  return onRequestPut({ request, env });
}

assert.equal(review.canCorrectCurrency, true);
assert.equal((await put('a@example.com', { subscriptions: [] }, 4)).status, 422);
assert.equal((await correct('a@example.com', { confirmed: false })).status, 400);
assert.equal((await correct('a@example.com', { currency: 'ZZZ' })).status, 400);
assert.equal((await correct('a@example.com', { workspaceId: 'B' })).status, 400);
assert.equal((await correct('a@example.com', {}, 3)).status, 409);
users['member@example.com'] = { email: 'member@example.com', status: 'active' };
members['member@example.com'] = { email: 'member@example.com', account_id: 'A', role: 'member', status: 'active' };
assert.equal((await (await get('member@example.com')).json()).canCorrectCurrency, false);
assert.equal((await correct('member@example.com')).status, 403);
assert.deepEqual((await (await get('a@example.com')).json()).data, mixed);

const [first, second] = await Promise.all([
  correct('a@example.com', { subscriptions: [] }),
  correct('a@example.com', { subscriptions: [] }),
]);
assert.deepEqual([first.status, second.status].sort(), [200, 409]);
const corrected = await (await get('a@example.com')).json();
assert.equal(corrected.version, 5);
assert.equal(corrected.needsCurrencyReview, undefined);
assert.deepEqual(corrected.data, {
  settings: { currency: 'EUR' },
  subscriptions: mixed.subscriptions,
  invoices: [{ ...mixed.invoices[0], currency: 'EUR' }],
});
assert.equal((await correct('a@example.com', {}, 5)).status, 409);
console.log('PASS: currency correction requires owner confirmation and a current revision, and preserves amounts');


// Synthetic concurrency stress: real handler logic, in-memory D1 mock.
// This is not a deployed latency or database capacity benchmark.
const stressStart = performance.now();
const stressResults = await Promise.all(Array.from({length:100},(_,i)=>
  put('a@example.com',{...corrected.data,stressMarker:i},5)));
assert.equal(stressResults.filter(r=>r.status===200).length,1);
assert.equal(stressResults.filter(r=>r.status===409).length,99);
const final = await (await get('a@example.com')).json();
assert.equal(final.version,6);
assert.ok(Number.isInteger(final.data.stressMarker));
const other = await (await get('b@example.com')).json();
assert.equal(other.version,3);
assert.equal(other.data.stressMarker,undefined);
console.log('PASS: 100 competing synthetic writes, exactly one winner, foreign workspace unchanged; mock elapsed '+Math.round(performance.now()-stressStart)+' ms');
