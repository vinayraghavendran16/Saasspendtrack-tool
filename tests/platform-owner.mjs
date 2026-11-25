import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPlatformOwner } from '../functions/_shared/platform-owner.js';
import { onRequestGet } from '../functions/api/platform/internal.js';

const owner = 'owner@example.com';
const customer = 'customer@example.com';
function env(email, configured = owner) {
  return {
    PLATFORM_OWNER_EMAIL: configured,
    ADMIN_EMAILS: customer,
    DB: { prepare(sql) { return { bind(...args) { return { async first() {
      if (sql.includes('FROM sessions')) return args[0] === 'valid' && email ? {email} : null;
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
  ['sst_session=valid', env(customer), 403],
  ['sst_session=valid', env(owner, ''), 403],
  ['sst_session=valid', env(owner), 200]
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
