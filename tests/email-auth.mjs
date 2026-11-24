import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { sendEmail } from '../functions/_shared/email.js';
import { onRequestPost } from '../functions/api/auth/request.js';

import { authAppUrl } from '../functions/_shared/auth-url.js';
const staleEnv = { APP_URL: 'https://old.saasspendtrack.pages.dev' };
assert.equal(authAppUrl(new Request('https://new.saasspendtrack.pages.dev/api/auth/request'), staleEnv), 'https://new.saasspendtrack.pages.dev');
assert.equal(authAppUrl(new Request('https://app.saasspendtrack.com/api/auth/request'), {}), 'https://app.saasspendtrack.com');
assert.equal(authAppUrl(new Request('https://evilsaasspendtrack.pages.dev/api/auth/request'), { APP_URL: 'https://configured.example/' }), 'https://configured.example');
assert.equal(authAppUrl(new Request('https://saasspendtrack.pages.dev/api/auth/request'), {}), 'https://app.saasspendtrack.com');

const originalFetch = globalThis.fetch;
const originalError = console.error;
const logs = [];
const mail = { to: 'recipient@example.com', subject: 'Sign in', html: '<a>private-link-token</a>' };
let calls = [];
console.error = (...args) => logs.push(args);
try {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response('{}', { status: 202 });
  };
  for (const token of ['test-secret', ' test-secret\n', 'Zoho-enczapikey test-secret', ' zoho-enczapikey test-secret ']) {
    assert.deepEqual(await sendEmail({ ZEPTOMAIL_TOKEN: token }, mail), { ok: true });
    const { url, options } = calls.at(-1);
    assert.equal(url, 'https://api.zeptomail.in/v1.1/email');
    assert.equal(options.headers.Authorization, 'Zoho-enczapikey test-secret');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), {
      from: { address: 'hello@saasspendtrack.com', name: 'SaaS Spend Track' },
      to: [{ email_address: { address: mail.to } }],
      reply_to: [{ address: 'hello@saasspendtrack.com', name: 'SaaS Spend Track' }],
      subject: mail.subject, htmlbody: mail.html,
    });
  }
  const count = calls.length;
  for (const token of [undefined, '', '  ', 'Zoho-enczapikey ', 'Zoho-enczapikey Zoho-enczapikey test-secret', 'test\r\nsecret']) {
    assert.equal((await sendEmail({ ZEPTOMAIL_TOKEN: token }, mail)).ok, false);
  }
  assert.equal(calls.length, count, 'invalid secrets must not make network requests');
  await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret', ZEPTOMAIL_URL: 'https://api.zeptomail.com/v1.1/email', FROM_EMAIL: ' sender@example.com ', FROM_NAME: 'Preview', REPLY_TO: ' reply@example.com ' }, mail);
  assert.equal(calls.at(-1).url, 'https://api.zeptomail.com/v1.1/email');
  const payload = JSON.parse(calls.at(-1).options.body);
  assert.deepEqual(payload.from, { address: 'sender@example.com', name: 'Preview' });
  assert.deepEqual(payload.reply_to, [{ address: 'reply@example.com', name: 'Preview' }]);
  for (const status of [401, 403, 429, 500]) {
    globalThis.fetch = async () => new Response('test-secret recipient@example.com private-link-token', { status });
    assert.deepEqual(await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret' }, mail), { ok: false, error: 'provider_rejected', status });
  }
  for (const error of [new Error('private-link-token'), new DOMException('test-secret', 'TimeoutError')]) {
    globalThis.fetch = async () => { throw error; };
    assert.equal((await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret' }, mail)).error, 'transport_error');
  }
  assert.doesNotMatch(JSON.stringify(logs), /test-secret|recipient@example.com|private-link-token/);

  // Exercise the actual auth handler with a D1 stub, including its hashed token.
  const writes = [];
  const DB = { prepare(sql) { return { bind(...args) { return {
    first: async () => sql.includes('rate_limits') ? { count: 1 } : { email: mail.to },
    run: async () => { writes.push({ sql, args }); return {}; },
  }; } }; } };
  for (const status of [202, 500]) {
    let sent;
    globalThis.fetch = async (_, options) => { sent = JSON.parse(options.body); return new Response('{}', { status }); };
    const response = await onRequestPost({ request: new Request('https://preview.example.com/api/auth/request', { method: 'POST', body: JSON.stringify({ email: mail.to }) }), env: { DB, APP_URL: 'https://preview.example.com', ZEPTOMAIL_TOKEN: 'Zoho-enczapikey test-secret' } });
    assert.deepEqual(await response.json(), { ok: true, emailed: status === 202 });
    assert.match(sent.htmlbody, /https:\/\/preview.example.com\/api\/auth\/verify\?token=/);
    assert.match(writes.at(-1).args[0], /^[a-f0-9]{64}$/);
    assert.ok(!sent.htmlbody.includes(writes.at(-1).args[0]), 'database stores a hash, not the emailed token');
  }
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
}

// Execute each actual browser click handler with success and failure responses.
for (const file of ['auth-gate.js', 'index.html', 'admin.html']) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const start = source.indexOf("fetch('/api/auth/request'");
  const end = source.indexOf('\n    });', start);
  assert.ok(start >= 0 && end > start);
  for (const response of [{ ok: true, body: { ok: true, emailed: true } }, { ok: true, body: { ok: true, emailed: false } }, { ok: false, body: { error: 'rate_limited' } }, null]) {
    const body = { innerHTML: '' };
    const btn = { disabled: true, textContent: 'Sending…' };
    const context = { btn, email: 'tester@example.com', esc: s => s, gate: { querySelector: () => body }, document: { getElementById: () => body }, fetch: async () => { if (!response) throw new Error('offline'); return { ok: response.ok, json: async () => response.body }; } };
    await vm.runInNewContext(source.slice(start, end), context);
    if (response?.body.emailed) assert.match(body.innerHTML, /Check your inbox/);
    else { assert.equal(body.innerHTML, ''); assert.equal(btn.disabled, false); assert.match(btn.textContent, /failed/i); }
  }
}
console.log('PASS: email headers, payload, token normalization, safe failures, auth integration and all three sign-in forms');
