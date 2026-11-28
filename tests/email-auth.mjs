import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { sendEmail } from '../functions/_shared/email.js';
import { onRequestPost } from '../functions/api/auth/request.js';

import { authAppUrl } from '../functions/_shared/auth-url.js';
const staleEnv = { APP_URL: 'https://old.saasspendtrack.pages.dev' };
assert.equal(authAppUrl(new Request('https://new.saasspendtrack.pages.dev/api/auth/request'), staleEnv), 'https://new.saasspendtrack.pages.dev');
assert.equal(authAppUrl(new Request('https://b344120a.saasspendtrack-preview-us.pages.dev/api/auth/request'), staleEnv), 'https://b344120a.saasspendtrack-preview-us.pages.dev');
assert.equal(authAppUrl(new Request('https://release-production-integrati.saasspendtrack-preview-us.pages.dev/api/auth/request'), staleEnv), 'https://release-production-integrati.saasspendtrack-preview-us.pages.dev');
assert.equal(authAppUrl(new Request('https://app.saasspendtrack.com/api/auth/request'), {}), 'https://app.saasspendtrack.com');
assert.equal(authAppUrl(new Request('https://app.saasspendtrack.com/api/auth/request'), { APP_URL: 'https://configured-production.example/' }), 'https://configured-production.example');
assert.equal(authAppUrl(new Request('https://evilsaasspendtrack.pages.dev/api/auth/request'), { APP_URL: 'https://configured.example/' }), 'https://configured.example');
assert.equal(authAppUrl(new Request('https://saasspendtrack.pages.dev.attacker.test/api/auth/request'), { APP_URL: 'https://configured.example/' }), 'https://configured.example');
assert.equal(authAppUrl(new Request('https://b344120a.saasspendtrack-preview-us.pages.dev.attacker.test/api/auth/request'), { APP_URL: 'https://configured.example/' }), 'https://configured.example');
assert.equal(authAppUrl(new Request('https://bad..saasspendtrack-preview-us.pages.dev/api/auth/request'), { APP_URL: 'https://configured.example/' }), 'https://configured.example');
assert.equal(authAppUrl(new Request('http://b344120a.saasspendtrack-preview-us.pages.dev/api/auth/request'), { APP_URL: 'https://configured.example/' }), 'https://configured.example');
assert.equal(authAppUrl(new Request('https://saasspendtrack.pages.dev/api/auth/request'), {}), 'https://app.saasspendtrack.com');

const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalInfo = console.info;
const logs = [];
const mail = { to: 'recipient@example.com', subject: 'Sign in', html: '<a>private-link-token</a>' };
let calls = [];
console.error = (...args) => logs.push(args);
console.info = (...args) => logs.push(args);
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
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), {
      from: { address: 'hello@saasspendtrack.com', name: 'SaaS Spend Track' },
      to: [{ email_address: { address: mail.to } }],
      reply_to: [{ address: 'hello@saasspendtrack.com', name: 'SaaS Spend Track' }],
      subject: mail.subject, htmlbody: mail.html,
    });
  }
  assert.ok(logs.some(([message, flags]) => message === 'ZeptoMail token normalized' && flags.authorizationPrefixRemoved === true && flags.outerWhitespaceRemoved === false));
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
  // Misconfigured endpoints must never receive credentials or authentication links.
  const beforeInvalidEndpoints = calls.length;
  for (const url of ['http://api.zeptomail.in/v1.1/email', 'https://api.zeptomail.in.attacker.example/v1.1/email', 'https://api.zeptomail.in/v1.1/email?unexpected=1', 'https://attacker.example/v1.1/email']) {
    assert.deepEqual(await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret', ZEPTOMAIL_URL: url }, mail), { ok: false, error: 'invalid_provider_endpoint' });
  }
  assert.equal(calls.length, beforeInvalidEndpoints);
  for (const url of ['https://cpaas.zoho.in/v1.1/email', 'https://cpaas.zoho.com/v1.1/email']) {
    assert.deepEqual(await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret', ZEPTOMAIL_URL: url }, mail), { ok: true });
    assert.equal(calls.at(-1).url, url);
  }
  for (const status of [401, 403, 429, 500]) {
    globalThis.fetch = async () => new Response('test-secret recipient@example.com private-link-token', { status });
    assert.deepEqual(await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret' }, mail), { ok: false, error: 'provider_rejected', status });
  }
  for (const [location, destination] of [
    ['https://cpaas.zoho.in/v1.1/email?token=private-link-token', 'https://cpaas.zoho.in/v1.1/email'],
    ['https://api.zeptomail.in/private-link-token', 'https://api.zeptomail.in/[other-path]'],
    ['https://evil.example/private-link-token', 'unrecognized'],
  ]) {
    let requests = 0;
    globalThis.fetch = async () => { requests++; return new Response('', { status: 302, headers: { Location: location } }); };
    assert.deepEqual(await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret' }, mail), { ok: false, error: 'provider_redirect', status: 302, destination });
    assert.equal(requests, 1, 'redirect must not trigger another request');
  }
  for (const error of [new Error('private-link-token'), new DOMException('test-secret', 'TimeoutError')]) {
    globalThis.fetch = async () => { throw error; };
    assert.equal((await sendEmail({ ZEPTOMAIL_TOKEN: 'test-secret' }, mail)).error, error.name === 'TimeoutError' ? 'timeout' : 'transport_error');
  }
  // Explicit provider selection: never fall back to another provider.
  const resendEnv = { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'test-secret', ZEPTOMAIL_TOKEN: 'unused-secret' };
  let resendCalls = [];
  globalThis.fetch = async (url, options) => { resendCalls.push({url, options}); return new Response('{}', {status: 202}); };
  assert.deepEqual(await sendEmail(resendEnv, mail), {ok: true});
  assert.equal(resendCalls[0].url, 'https://api.resend.com/emails');
  assert.equal(resendCalls[0].options.headers.Authorization, 'Bearer test-secret');
  assert.equal(resendCalls[0].options.redirect, 'manual');
  assert.ok(resendCalls[0].options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(resendCalls[0].options.body), {from: 'hello@saasspendtrack.com', to: [mail.to], reply_to: 'hello@saasspendtrack.com', subject: mail.subject, html: mail.html});
  for (const env of [{EMAIL_PROVIDER:'resend'}, {EMAIL_PROVIDER:'resend', RESEND_API_KEY:'bad key'}, {EMAIL_PROVIDER:'unknown'}]) {
    assert.equal((await sendEmail(env, mail)).ok, false);
  }
  assert.equal(resendCalls.length, 1);
  for (const status of [302, 401, 429, 500]) {
    let attempts = 0;
    globalThis.fetch = async () => { attempts++; return new Response('test-secret private-link-token', {status}); };
    assert.deepEqual(await sendEmail(resendEnv, mail), {ok:false, error:status===302?'provider_redirect':'provider_rejected', status});
    assert.equal(attempts, 1);
  }
  for (const error of [new DOMException('test-secret','TimeoutError'), new Error('private-link-token')]) {
    let attempts = 0;
    globalThis.fetch = async () => { attempts++; throw error; };
    assert.equal((await sendEmail(resendEnv, mail)).error, error.name==='TimeoutError'?'timeout':'transport_error');
    assert.equal(attempts, 1);
  }
  const health = logs.filter(([name]) => name === 'email_provider_health').map(([,data]) => data);
  for (const provider of ['zeptomail','resend']) {
    for (const outcome of ['accepted','provider_rejected','timeout','transport_error','provider_redirect']) {
      assert.ok(health.some(x => x.provider === provider && x.outcome === outcome), provider + ':' + outcome);
    }
  }
  assert.ok(health.some(x => x.provider === 'invalid' && x.outcome === 'invalid_email_provider'));
  for (const event of health) assert.deepEqual(Object.keys(event).sort(), ['outcome','provider']);
  assert.doesNotMatch(JSON.stringify(logs), /test-secret|recipient@example.com|private-link-token/);

  // Exercise the actual auth handler with a D1 stub, including its hashed token.
  const writes = [];
  const DB = { prepare(sql) { return { bind(...args) { return {
    first: async () => sql.includes('rate_limits') ? { count: 1 } : { email: mail.to },
    run: async () => { writes.push({ sql, args }); return {}; },
  }; } }; } };
  for (const { origin, appUrl, status } of [
    { origin: 'https://b344120a.saasspendtrack-preview-us.pages.dev', appUrl: 'https://saasspendtrack-preview-us.pages.dev', status: 202 },
    { origin: 'https://branch.saasspendtrack.pages.dev', appUrl: 'https://old.saasspendtrack.pages.dev', status: 202 },
    { origin: 'https://app.saasspendtrack.com', appUrl: 'https://app.saasspendtrack.com', status: 500 },
  ]) {
    let sent;
    globalThis.fetch = async (_, options) => { sent = JSON.parse(options.body); return new Response('{}', { status }); };
    const response = await onRequestPost({ request: new Request(origin + '/api/auth/request', { method: 'POST', body: JSON.stringify({ email: mail.to }) }), env: { DB, APP_URL: appUrl, ZEPTOMAIL_TOKEN: 'Zoho-enczapikey test-secret' } });
    assert.deepEqual(await response.json(), { ok: true, emailed: status === 202 });
    const expectedOrigin = origin.includes('.saasspendtrack-preview-us.pages.dev') || origin.includes('.saasspendtrack.pages.dev') ? origin : appUrl;
    assert.ok(sent.htmlbody.includes(expectedOrigin + '/api/auth/verify?token='), 'magic link must use the allowed current host or configured production URL');
    assert.match(writes.at(-1).args[0], /^[a-f0-9]{64}$/);
    assert.ok(!sent.htmlbody.includes(writes.at(-1).args[0]), 'database stores a hash, not the emailed token');
  }

  const { onRequestGet: verifyLogin } = await import('../functions/api/auth/verify.js');
  const verifyDB = { prepare(sql) { return { bind() { return {
    first: async () => sql.includes('UPDATE login_tokens') ? { email: mail.to } : null,
    run: async () => ({}),
  }; } }; } };
  const expectedRoot = (origin, appUrl) => (
    origin.includes('.saasspendtrack-preview-us.pages.dev') || origin.includes('.saasspendtrack.pages.dev')
      ? origin + '/?auth=ok'
      : appUrl + '/?auth=ok'
  );
  for (const { origin, appUrl } of [
    { origin: 'https://b344120a.saasspendtrack-preview-us.pages.dev', appUrl: 'https://saasspendtrack-preview-us.pages.dev' },
    { origin: 'https://branch.saasspendtrack.pages.dev', appUrl: 'https://old.saasspendtrack.pages.dev' },
    { origin: 'https://app.saasspendtrack.com', appUrl: 'https://app.saasspendtrack.com' },
  ]) {
    const response = await verifyLogin({ request: new Request(origin + '/api/auth/verify?token=synthetic'), env: { DB: verifyDB, APP_URL: appUrl } });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), expectedRoot(origin, appUrl), 'post-auth redirect must return to the originating preview or configured production app');
  }
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  console.info = originalInfo;
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

// Invitation cookies and redirects must remain on the same preview host.
const { onRequestGet: acceptInvite } = await import('../functions/api/account/accept.js');
for (const origin of ['https://abc123.saasspendtrack.pages.dev', 'https://app.saasspendtrack.com']) {
  const response = await acceptInvite({ request: new Request(origin + '/api/account/accept'), env: { APP_URL: 'https://configured.example.com' } });
  assert.equal(response.headers.get('Location'), (origin.includes('.pages.dev') ? origin : 'https://configured.example.com') + '/?invite=invalid');
}
console.log('PASS: invitation redirects preserve preview cookie origin and production APP_URL');
