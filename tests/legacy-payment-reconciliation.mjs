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
let beforeBatch;
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
    if (beforeBatch) await beforeBatch();
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

const queue = () => db.prepare('SELECT * FROM legacy_payment_reconciliation WHERE payment_id IS NOT NULL ORDER BY payment_id').all();
const reviewRow = id => db.prepare('SELECT * FROM legacy_payment_reconciliation WHERE review_key=?').get(id);
const existing = () => db.prepare('SELECT * FROM users WHERE email=?').get(paidEmail);
const original = existing();
assert.equal((await deliver(captured, {signature: 'wrong'})).status, 401);
assert.equal((await deliver('{bad json')).status, 400);
const malformed = {event: 'payment.captured', notes: 'must never be persisted'};
assert.equal((await deliver(malformed)).status, 422);
assert.equal((await deliver(malformed, {eventId: 'retry-header'})).status, 422);
assert.equal((await deliver({...captured, payload: {payment: {entity: {...payment, amount: '200000'}}}})).status, 422);
assert.equal((await deliver({...orderPaid, payload: {...orderPaid.payload, order: {entity: {id: 'order_Other', status: 'paid'}}}})).status, 422);
assert.deepEqual(queue(), []);
const malformedRows = db.prepare('SELECT * FROM legacy_payment_reconciliation').all();
assert.equal(malformedRows.length, 3);
assert.ok(malformedRows.every(row => row.reason === 'malformed_success' && /^sha256:[a-f0-9]{64}$/.test(row.review_key)));
assert.ok(!JSON.stringify(malformedRows).includes('must never be persisted'));

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
assert.equal(queue()[0].review_key, payment.id);
assert.equal(queue()[0].reason, 'legacy_success');
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
assert.deepEqual((await visible.json()).events.filter(row => row.payment_id).map(row => row.payment_id), [payment.id]);
assert.equal((await (await view(adminToken, '?after=' + payment.id)).json()).events.length, 3);
assert.equal((await (await view(adminToken, '?after=' + malformedRows.map(row => row.review_key).sort().at(-1))).json()).events.length, 0);

for (const [index, alter] of [
  event => {event.payload.payment.entity.amount = 199999;},
  event => {event.payload.payment.entity.currency = 'INR';},
  event => {event.payload.payment.entity.email = 'other@example.invalid';},
  event => {event.payload.payment_link.entity.id = 'plink_Unknown';}
].entries()) {
  const event = structuredClone(linkPaid);
  event.payload.payment.entity.id = 'pay_InvalidLink' + index;
  alter(event);
  assert.equal((await deliver(event)).status, 422);
  assert.equal(reviewRow(event.payload.payment.entity.id).reason, 'link_validation_failed');
}
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 0);
assert.equal((await deliver({event: 'payment.captured', payload: {payment: linkPaid.payload.payment}})).status, 200);
assert.equal((await deliver(linkPaid)).status, 200);
assert.equal(await (await deliver(linkPaid)).text(), 'already processed');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_notification_outbox').get().n, 1);
assert.ok(!(await (await view(adminToken)).json()).events.some(row => row.payment_id === 'pay_LinkFixture'));
assert.deepEqual(existing(), original);

const legacyWith = (id, amount, currency, event = 'payment.captured') =>
  ({event, payload: {payment: {entity: {...payment, id, amount, currency}}}});
assert.equal((await deliver(legacyWith(payment.id, 199999, 'USD'))).status, 200);
const firstConflict = reviewRow(payment.id);
assert.equal(firstConflict.amount, 200000);
assert.equal(firstConflict.conflict_amount, 199999);
assert.ok(firstConflict.conflict_at);
assert.equal((await deliver(legacyWith(payment.id, 199999, 'USD'))).status, 200);
assert.deepEqual(reviewRow(payment.id), firstConflict);
db.prepare('UPDATE legacy_payment_reconciliation SET resolved_at=?, resolution_ref=? WHERE review_key=?')
  .run(Date.now(), 'synthetic-approved-case', payment.id);
assert.equal((await deliver(legacyWith(payment.id, 199999, 'USD'))).status, 200);
assert.equal(reviewRow(payment.id).resolution_ref, 'synthetic-approved-case');
assert.equal((await deliver(legacyWith(payment.id, 200000, 'INR'))).status, 200);
const reopened = reviewRow(payment.id);
assert.equal(reopened.conflict_currency, 'INR');
assert.equal(reopened.resolved_at, null);
assert.equal(reopened.resolution_ref, null);
assert.equal(reopened.review_version, firstConflict.review_version + 1);

arrived = 0;
const conflictingReady = new Promise(resolve => {release = resolve;});
concurrentGate = async () => {
  if (++arrived === 2) release();
  await conflictingReady;
};
const conflictingDeliveries = await Promise.all([
  deliver(legacyWith('pay_ConcurrentConflict', 200000, 'USD')),
  deliver(legacyWith('pay_ConcurrentConflict', 200000, 'INR'))
]);
concurrentGate = undefined;
assert.deepEqual(conflictingDeliveries.map(response => response.status), [200, 200]);
const concurrentConflict = reviewRow('pay_ConcurrentConflict');
assert.deepEqual([concurrentConflict.currency, concurrentConflict.conflict_currency].sort(), ['INR', 'USD']);

assert.equal((await deliver(legacyWith('pay_LinkFixture', 200000, 'INR'))).status, 200);
assert.ok((await (await view(adminToken)).json()).events.some(row => row.payment_id === 'pay_LinkFixture' && row.conflict_currency === 'INR'));
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 1);
assert.equal((await deliver(legacyWith('pay_FutureEvent', 200000, 'USD', 'payment.capture_succeeded'))).status, 200);
assert.equal(reviewRow('pay_FutureEvent').reason, 'unexpected_success');

const late = structuredClone(linkPaid);
late.payload.payment.entity.id = 'pay_LateLink';
const configuredCatalogue = env.RAZORPAY_PAYMENT_CATALOGUE;
delete env.RAZORPAY_PAYMENT_CATALOGUE;
assert.equal((await deliver(late)).status, 200);
assert.equal(reviewRow('pay_LateLink').reason, 'missing_link_catalogue');
env.RAZORPAY_PAYMENT_CATALOGUE = configuredCatalogue;
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 1);

// Inject conflicting signed evidence between the application check and the ledger batch.
const racingLink = structuredClone(linkPaid);
racingLink.payload.payment.entity.id = 'pay_RacingLink';
beforeBatch = async () => {
  assert.equal((await deliver(legacyWith('pay_RacingLink', 199999, 'USD'))).status, 200);
};
assert.equal(await (await deliver(racingLink)).text(), 'accepted for reconciliation');
assert.equal(reviewRow('pay_RacingLink').conflict_amount, 199999);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger').get().n, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_notification_outbox').get().n, 1);
assert.deepEqual(existing(), original);
console.log('PASS: signed reconciliation, malformed event evidence, conflicts, catalogue hold, replay and entitlement preservation');
