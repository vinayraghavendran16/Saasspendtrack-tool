// Live API smoke test: disposable preview accounts only. Never use production sessions.
// Set PREVIEW_URL to the isolated US Preview, PREVIEW_OWNER_A_COOKIE,
// PREVIEW_OWNER_B_COOKIE and PREVIEW_TEST_CONFIRM=disposable-empty-workspaces.
// Confirm PREVIEW_DB_VERIFIED=sst-preview-us. Cookies stay local; never print them.
import assert from 'node:assert/strict';
import { parseUsPreviewUrl } from './preview-api-target.mjs';
const url = parseUsPreviewUrl(process.env.PREVIEW_URL || 'https://invalid.example');
assert.equal(process.env.PREVIEW_TEST_CONFIRM, 'disposable-empty-workspaces');
assert.equal(process.env.PREVIEW_DB_VERIFIED, 'sst-preview-us', 'Independently verify the isolated US preview DB binding before running');
// Use fresh empty disposable accounts, not the existing nonempty E2E fixtures.
const a = process.env.PREVIEW_OWNER_A_COOKIE;
const b = process.env.PREVIEW_OWNER_B_COOKIE;
assert.ok(a && b && a !== b, 'Two distinct disposable sessions required');
async function call(cookie, path, method='GET', body, version) {
  const headers = { accept: 'application/json', origin: url.origin };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (version !== undefined) headers['If-Match'] = String(version);
  const r = await fetch(url.origin + path, { method, headers, redirect:'error', signal:AbortSignal.timeout(15000), body:body === undefined ? undefined : JSON.stringify(body) });
  return { status:r.status, body:await r.json() };
}
function check(r, status) { assert.equal(r.status,status); return r.body; }
async function run() {
  // Cloudflare Access may intercept requests without its own session.
  const access = process.env.PREVIEW_ACCESS_COOKIE;
  assert.ok(access && /^CF_Authorization=[^;\s]+$/.test(access), 'Dedicated Access-only session required');
  check(await call(access,'/api/data'),401);
  const first = check(await call(a,'/api/data'),200);
  const second = check(await call(b,'/api/data'),200);
  assert.ok(first.workspaceId && second.workspaceId && first.workspaceId !== second.workspaceId, 'Separate workspaces required');
  assert.ok(first.empty === true && first.version === 0 && second.empty === true && second.version === 0, 'Refusing to modify nonempty workspaces');
  const consentA = check(await call(a,'/api/ai/consent'),200);
  const consentB = check(await call(b,'/api/ai/consent'),200);
  assert.ok(consentA.canManage && consentB.canManage && !consentA.enabled && !consentB.enabled && consentA.canEnable === false && consentB.canEnable === false, 'Fresh owner/admin sessions required');
  console.log('PASS: unauthenticated access denied; distinct empty workspaces; AI disabled');
  const sample = { subscriptions:[], settings:{previewSmokeMarker:crypto.randomUUID()} };
  check(await call(a,'/api/data','PUT',sample),428);
  const saved = check(await call(a,'/api/data','PUT',sample,0),200);
  assert.equal(saved.version,1);
  const read = check(await call(a,'/api/data'),200);
  assert.equal(read.version,1);
  assert.deepEqual(read.data,sample);
  check(await call(a,'/api/data','PUT',sample,0),409);
  const candidates = ['A','B'].map(writer => ({...sample,settings:{...sample.settings,writer}}));
  const race = await Promise.all(candidates.map(candidate => call(a,'/api/data','PUT',candidate,1)));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const winner = race.findIndex(r=>r.status===200);
  assert.equal(race[winner].body.version,2);
  const final = check(await call(a,'/api/data'),200);
  assert.equal(final.version,2);
  assert.deepEqual(final.data,candidates[winner]);
  assert.equal(check(await call(b,'/api/data'),200).empty,true);
  console.log('PASS: persistence, missing precondition, stale writes, tenant isolation');

  const eur = {
    settings: { ...final.data.settings, currency: 'EUR' },
    subscriptions: [{ id: 'preview-subscription', name: 'Preview fixture', cost: 1200, cycle: 'yearly', currency: 'EUR' }],
    invoices: [{ id: 'preview-invoice', subId: 'preview-subscription', amount: 1200, currency: 'EUR' }],
  };
  const savedCurrency = check(await call(a, '/api/data', 'PUT', eur, final.version), 200);
  assert.equal(savedCurrency.version, final.version + 1);
  const mixed = { ...eur, invoices: [{ ...eur.invoices[0], currency: 'USD' }] };
  assert.equal(check(await call(a, '/api/data', 'PUT', mixed, savedCurrency.version), 400).error, 'invalid_currency');
  const relabelled = {
    settings: { ...eur.settings, currency: 'USD' },
    subscriptions: [{ ...eur.subscriptions[0], currency: 'USD' }],
    invoices: [{ ...eur.invoices[0], currency: 'USD' }],
  };
  assert.equal(check(await call(a, '/api/data', 'PUT', relabelled, savedCurrency.version), 422).error, 'currency_locked');
  const afterCurrencyChecks = check(await call(a, '/api/data'), 200);
  assert.equal(afterCurrencyChecks.version, savedCurrency.version);
  assert.deepEqual(afterCurrencyChecks.data, eur);
  assert.equal(afterCurrencyChecks.needsCurrencyReview, undefined);
  assert.equal(check(await call(b, '/api/data'), 200).empty, true);
  console.log('PASS: currency round-trip, mixed-currency rejection, and unchanged saved amounts and version');

  // Read-only consent checks: never mutate AI settings during US Preview validation.
  for (const cookie of [a,b]) {
    const policy = check(await call(cookie,'/api/ai/consent'),200);
    assert.equal(policy.enabled,false);
    assert.equal(policy.canEnable,false);
  }
  console.log('PASS: effective AI policy disabled; no consent mutations');
  check(await call(a,'/api/auth/logout','POST'),200);
  check(await call(a,'/api/data'),401);
  console.log('PASS: logout invalidates session');
  console.log('API smoke complete. Synthetic state remains in workspace A. Browser, audit rows, binding and backup checks remain separate.');
}
run().catch(() => { console.error('FAIL: preview smoke did not complete; inspect locally without exposing credentials or response bodies.'); process.exitCode=1; });
