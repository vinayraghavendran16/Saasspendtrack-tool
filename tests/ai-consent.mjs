import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/ai/consent.js';

// Consent changes must be explicit, role-gated, and recorded in the audit log.
const users = new Map([
  ['owner@example.com', { email: 'owner@example.com', status: 'active', trial_ends_at: Date.now() + 86400000 }],
  ['member@example.com', { email: 'member@example.com', status: 'active', trial_ends_at: Date.now() + 86400000 }],
]);
const members = new Map([
  ['owner@example.com', { email: 'owner@example.com', account_id: 'one', role: 'owner', status: 'active' }],
  ['member@example.com', { email: 'member@example.com', account_id: 'one', role: 'member', status: 'active' }],
]);
const settings = new Map(), events = [];
const env = { DB: {
  prepare(sql) {
    let args = [];
    const bound = {
      async first() {
        if (/FROM sessions/i.test(sql)) return { email: args[0] };
        if (/FROM users WHERE email/i.test(sql)) return users.get(args[0]) || null;
        if (/FROM memberships WHERE email/i.test(sql)) return members.get(args[0]) || null;
        if (/FROM workspace_ai_settings/i.test(sql)) return settings.get(args[0]) || null;
        return null;
      },
      async run() {
        if (/INSERT INTO workspace_ai_settings/i.test(sql)) settings.set(args[0], { enabled: args[1], consent_version: args[2], changed_at: args[4] });
        if (/INSERT INTO workspace_ai_consent_events/i.test(sql)) events.push({ account: args[1], actor: args[2], enabled: args[3] });
        return { success: true };
      },
    };
    return { bind(...a) { args = a; return bound; }, run: bound.run };
  },
  async batch(stmts) { for (const stmt of stmts) await stmt.run(); },
} };
function req(email, method, body) {
  return new Request('https://example.com/api/ai/consent', {
    method,
    headers: { Cookie: 'sst_session=' + email, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function get(email) { return onRequestGet({ request: req(email, 'GET'), env }); }
async function post(email, body) { return onRequestPost({ request: req(email, 'POST', body), env }); }
const version = 'workspace-ai-v2';
const ownerInitial = await (await get('owner@example.com')).json();
assert.equal(ownerInitial.enabled, false);
assert.equal(ownerInitial.canManage, true);
const memberInitial = await (await get('member@example.com')).json();
assert.equal(memberInitial.enabled, false);
assert.equal(memberInitial.canManage, false);
assert.equal((await post('member@example.com', { enabled: true, consentVersion: version })).status, 403);
assert.equal((await post('owner@example.com', { enabled: true })).status, 400);
assert.equal((await post('owner@example.com', { enabled: true, consentVersion: 'wrong' })).status, 400);
assert.equal(settings.size, 0);
assert.equal((await post('owner@example.com', { enabled: true, consentVersion: version })).status, 200);
const memberEnabled = await (await get('member@example.com')).json();
assert.equal(memberEnabled.enabled, true);
assert.equal(memberEnabled.canManage, false);
assert.equal((await post('owner@example.com', { enabled: false, consentVersion: version })).status, 200);
assert.equal((await (await get('member@example.com')).json()).enabled, false);
assert.equal(events.length, 2);
assert.deepEqual(events.map(e => e.enabled), [1, 0]);
assert.ok(events.every(e => e.actor === 'owner@example.com' && e.account === 'one'));
console.log('PASS: default-off workspace AI consent, role gate, explicit opt-in, revocation, audit trail');
