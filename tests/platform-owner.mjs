import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPlatformOwner } from '../functions/_shared/platform-owner.js';
import { onRequestGet } from '../functions/api/platform/internal.js';

import {sessionStorageId} from '../functions/_shared/session-token.js';
const validToken='a'.repeat(64);
const storedToken=await sessionStorageId(validToken);
const owner = 'owner@example.com';
const customer = 'customer@example.com';
function env(email, configured = owner) {
  return {
    PLATFORM_OWNER_EMAIL: configured,
    ADMIN_EMAILS: customer,
    DB: { prepare(sql) { return { bind(...args) { return { async first() {
      if (sql.includes('FROM sessions')) return args[0] === storedToken && email ? {email} : null;
      if (sql.includes('FROM users')) return {email, role:'owner', status:'trial'};
      throw new Error('Unexpected query');
    } }; } }; } }
  };
}
const req = (cookie = '') => new Request('https://example.com/api/platform/internal', {headers:{cookie}});
assert.equal(isPlatformOwner(env(owner), {email:' OWNER@example.com '}), true);
assert.equal(isPlatformOwner(env(customer), {email:customer, role:'owner'}), false);
assert.equal(isPlatformOwner(env(owner, ''), {email:owner}), false);
assert.equal(isPlatformOwner(env(owner, 'invalid'), {email:owner}), false);
for (const [cookie, e, status] of [
  ['', env(owner), 401],
  ['sst_session=invalid', env(owner), 401],
  ['sst_session='+validToken, env(customer), 403],
  ['sst_session='+validToken, env(owner, ''), 403],
  ['sst_session='+validToken, env(owner), 200]
]) {
  const response = await onRequestGet({request:req(cookie),env:e});
  assert.equal(response.status,status);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const body = await response.text();
  if (status === 200) {
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.match(body, /function ensureQaView/);
  } else assert.doesNotMatch(body, /function ensureQaView/);
}
const html = readFileSync(new URL('../index.html', import.meta.url),'utf8');
assert.doesNotMatch(html, /function ensure(?:Qa|Changelog|Onepager)View\s*\(/);
assert.match(html, /me\.platformOwner !== true/);
const ignore = readFileSync(new URL('../.assetsignore',import.meta.url),'utf8');
for (const entry of ['extensions*.js','index.src.html','functions/','tests/','docs/']) assert.ok(ignore.split(/\r?\n/).includes(entry));
console.log('Platform owner authorization and static source regression checks passed');

 
// Owner entitlement is independent of payment records and trial expiry.
const { resolveEntitlement, resolveWorkspaceEntitlement } = await import('../functions/_shared/util.js');
const expiredOwner = {email:owner,status:'expired',trial_ends_at:1};
const noDb = {PLATFORM_OWNER_EMAIL:owner,DB:{prepare(){throw new Error('Owner entitlement must not query or mutate billing');}}};
for (const status of ['trial','expired','active']) {
  const ent = await resolveEntitlement(noDb,{...expiredOwner,status});
  assert.equal(ent.entitled,true);
  assert.equal(ent.plan,'platform_owner');
  assert.equal(ent.trialEndsAt,null);
  assert.equal(ent.paidUntil,null);
}
for (const configured of ['', 'invalid', customer]) {
  const ent = await resolveEntitlement({...noDb,PLATFORM_OWNER_EMAIL:configured},expiredOwner);
  assert.equal(ent.entitled,false);
}
assert.equal(await resolveEntitlement(noDb,null),null);
assert.equal((await resolveEntitlement(noDb,{...expiredOwner,email:customer})).entitled,false);
const ctx = {ownerEmail:owner,membership:{status:'active',role:'owner'}};
assert.equal((await resolveWorkspaceEntitlement(noDb,expiredOwner,ctx)).entitled,true);
assert.equal(await resolveWorkspaceEntitlement(noDb,expiredOwner,{...ctx,membership:{status:'removed'}}),null);
console.log('Platform owner lifetime entitlement regression checks passed');

const {onRequestGet: emailHealth} = await import('../functions/api/admin/email-health.js');
for (const [cookie,e,status] of [
  ['',env(owner),401],
  ['sst_session=invalid',env(owner),401],
  ['sst_session='+validToken,env(customer),403],
  ['sst_session='+validToken,env(owner,''),403],
  ['sst_session='+validToken,env(owner),200],
  ['sst_session='+validToken,{...env(owner),EMAIL_PROVIDER:'resend',EMAIL_HEALTH:{writeDataPoint(){}},RESEND_API_KEY:'private-secret'},200],
  ['sst_session='+validToken,{...env(owner),EMAIL_PROVIDER:'private-secret'},200]
]) {
  const response = await emailHealth({request:req(cookie),env:e});
  assert.equal(response.status,status);
  assert.match(response.headers.get('cache-control'),/no-store/);
  const body = await response.text();
  assert.doesNotMatch(body,/private-secret/);
  if(status===200) {
    const data=JSON.parse(body);
    assert.equal(data.metricsAvailable,false);
    assert.equal(data.deliveryVerified,false);
    assert.equal(data.provider,e.EMAIL_PROVIDER==='resend'?'resend':e.EMAIL_PROVIDER?'invalid':'zeptomail');
    assert.equal(data.aggregationConfigured,Boolean(e.EMAIL_HEALTH));
  }
}
