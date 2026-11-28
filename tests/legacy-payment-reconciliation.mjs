import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPost as webhook} from '../functions/api/razorpay/webhook.js';
import {onRequestGet as admin} from '../functions/api/admin/legacy-payment-reconciliation.js';
import {sessionStorageId} from '../functions/_shared/session-token.js';

const db = new DatabaseSync(':memory:');
for (const file of ['schema.sql', 'migrations/009_payment_ledger.sql', 'migrations/014_legacy_payment_replay.sql',
  'migrations/015_payment_notification_outbox.sql', 'migrations/033_legacy_payment_reconciliation.sql']) {
  db.exec(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
}
const stamp = Date.now();
const paidEmail = 'paid@example.invalid';
const adminEmail = 'ops@example.invalid';
db.prepare(`INSERT INTO users(email,created_at,trial_ends_at,status,plan,paid_at,rp_payment_id,amount_paid,currency)
  VALUES(?,?,?,'active','annual-usd',?,'pay_PaidFixture',200000,'USD')`).run(paidEmail, stamp, stamp, stamp);
db.prepare('INSERT INTO users(email,created_at,trial_ends_at) VALUES(?,?,?)').run(adminEmail, stamp, stamp);
const adminToken = 'a'.repeat(64);
const memberToken = 'b'.repeat(64);
for (const [token, email] of [[adminToken, adminEmail], [memberToken, paidEmail]]) {
  db.prepare('INSERT INTO sessions(id,email,created_at,expires_at) VALUES(?,?,?,?)')
    .run(await sessionStorageId(token), email, stamp, stamp + 3600000);
}

let writeFailure;
let concurrentGate;
const D1 = {
  prepare(sql) {
    return {bind(...params) {
      const execute = () => db.prepare(sql).run(...params);
      return {
        execute,
        first: async () => db.prepare(sql).get(...params),
        all: async () => ({success: true, results: db.prepare(sql).all(...params)}),
        async run() {
          if (concurrentGate) await concurrentGate();
          if (writeFailure === 'throw') throw new Error('protected fixture DB failure');
          if (writeFailure === 'result') return {success: false};
          return {success: true, meta: execute()};
        }
      };
    }};
  },
  async batch(statements) {
    db.exec('BEGIN');
    try {
      for (const statement of statements) statement.execute();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
};

const secret = 'test-only-signing-secret';
const linkId = 'plink_Fixture';
const env = {DB: D1, ADMIN_EMAILS: adminEmail, RAZORPAY_WEBHOOK_SECRET: secret,
  RAZORPAY_PAYMENT_CATALOGUE: JSON.stringify([{linkId, amount: 200000, currency: 'USD', tier: 'standard'}])};
const payment = {id: 'pay_LegacyFixture', order_id: 'order_LegacyFixture', status: 'captured',
  captured: true, amount: 200000, currency: 'USD', email: paidEmail, contact: 'must not be stored'};
const captured = {event: 'payment.captured', payload: {payment: {entity: payment}}};
const orderPaid = {event: 'order.paid', payload: {...captured.payload,
  order: {entity: {id: payment.order_id, status: 'paid'}}}};
const linkPaid = {event: 'payment_link.paid', payload: {
  payment: {entity: {...payment, id: 'pay_LinkFixture', email: 'new@example.invalid'}},
  payment_link: {entity: {id: linkId, status: 'paid', amount: 200000, amount_paid: 200000,
    currency: 'USD', customer: {email: 'new@example.invalid'}}}
}};

async function deliver(event, {signature, eventId = 'header-fixture'} = {}) {
  const body = typeof event === 'string' ? event : JSON.stringify(event);
  signature ??= createHmac('sha256', secret).update(body).digest('hex');
  const request = new Request('https://example.invalid/api/razorpay/webhook', {
    method: 'POST', body, headers: {'X-Razorpay-Signature': signature, 'X-Razorpay-Event-Id': eventId}
  });
  return webhook({request, env});
}

function view(token, query = '') {
  const request = new Request('https://example.invalid/api/admin/legacy-payment-reconciliation' + query,
    token ? {headers: {Cookie: 'sst_session=' + token}} : {});
  return admin({request, env});
}

const queue = () => db.prepare('SELECT * FROM legacy_payment_reconciliation ORDER BY payment_id').all();
const existing = () => db.prepare('SELECT * FROM users WHERE email=?').get(paidEmail);
const original = existing();
assert.equal((await deliver(captured, {signature: 'wrong'})).status, 401);
assert.equal((await deliver('{bad json')).status, 400);
assert.equal((await deliver({event: 'payment.captured'})).status, 422);
assert.equal((await deliver({...captured, payload: {payment: {entity: {...payment, amount: '200000'}}}})).status, 422);
assert.equal((await deliver({...orderPaid, payload: {...orderPaid.payload, order: {entity: {id: 'order_Other', status: 'paid'}}}})).status, 422);
assert.deepEqual(queue(), []);

for (const mode of ['throw', 'result']) {
  writeFailure = mode;
  assert.equal((await deliver(captured)).status, 503);
  assert.deepEqual(queue(), []);
}
writeFailure = undefined;

// Release both in-flight handlers to the actual uniqueness-constrained SQLite write.
let arrived = 0;
let release;
const ready = new Promise(resolve => {release = resolve;});
concurrentGate = async () => {
  if (++arrived === 2) release();
  await ready;
};
const concurrent = await Promise.all([deliver(captured), deliver(orderPaid, {eventId: 'other-header'})]);
concurrentGate = undefined;
assert.deepEqual(concurrent.map(response => response.status), [200, 200]);
assert.equal((await deliver(captured, {eventId: 'different-header'})).status, 200);
assert.equal(queue().length, 1);
assert.deepEqual(Object.keys(queue()[0]), ['payment_id', 'event_type', 'amount', 'currency', 'received_at', 'resolved_at']);
assert.ok(!JSON.stringify(queue()).includes(paidEmail));
assert.deepEqual(existing(), original);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 0);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_notification_outbox').get().n, 0);

assert.equal((await view()).status, 401);
assert.equal((await view(memberToken)).status, 401);
assert.equal((await view(adminToken, '?after=invalid')).status, 400);
const visible = await view(adminToken);
assert.equal(visible.status, 200);
assert.equal(visible.headers.get('Cache-Control'), 'no-store');
assert.deepEqual((await visible.json()).events.map(row => row.payment_id), [payment.id]);
assert.deepEqual((await (await view(adminToken, '?after=' + payment.id)).json()).events, []);

for (const alter of [
  event => {event.payload.payment.entity.amount = 199999;},
  event => {event.payload.payment.entity.currency = 'INR';},
  event => {event.payload.payment.entity.email = 'other@example.invalid';},
  event => {event.payload.payment_link.entity.id = 'plink_Unknown';}
]) {
  const event = structuredClone(linkPaid);
  alter(event);
  assert.equal((await deliver(event)).status, 422);
}
assert.equal(queue().length, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 0);
assert.equal((await deliver({event: 'payment.captured', payload: {payment: linkPaid.payload.payment}})).status, 200);
assert.equal((await deliver(linkPaid)).status, 200);
assert.equal(await (await deliver(linkPaid)).text(), 'already processed');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_notification_outbox').get().n, 1);
assert.deepEqual((await (await view(adminToken)).json()).events.map(row => row.payment_id), [payment.id]);
assert.deepEqual(existing(), original);
console.log('PASS: durable signed legacy reconciliation, atomic deduplication, retryable failures, admin access and entitlement preservation');
