import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const handlers = {};
const origin = 'https://preview.example.com';
const deleted = [], writes = [];
let claimed = false, network = 0;
const response = { ok: true, redirected: false, type: 'basic', headers: { get: () => 'image/png' }, clone() { return this; } };
const cache = { match: async () => undefined, put: async (req) => writes.push(req.url) };
runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), {
  URL, Set,
  self: { location: { origin }, addEventListener: (name, fn) => handlers[name] = fn, skipWaiting: async () => {}, clients: { claim: async () => { claimed = true; } } },
  caches: { keys: async () => ['sst-v1-2026-11-15', 'sst-static-v2-2026-11-26', 'unrelated'], delete: async key => deleted.push(key), open: async () => cache },
  fetch: async () => { network++; return response; }
});
let activation;
handlers.activate({ waitUntil: p => activation = p });
await activation;
assert.deepEqual(deleted, ['sst-v1-2026-11-15']);
assert.equal(claimed, true);
function dispatch(path, method = 'GET', mode = 'cors') {
  let result;
  handlers.fetch({ request: { url: new URL(path, origin).href, method, mode }, respondWith: p => result = p });
  return result;
}
for (const path of ['/api/me', '/api/data', '/api/auth/verify?token=test', '/api/workspace/ai-consent', '/?auth=ok', '/', '/index.html', '/auth-gate.js', '/icon.svg?v=1', 'https://other.example/icon.svg']) {
  assert.equal(dispatch(path), undefined, path + ' must bypass worker');
}
assert.equal(dispatch('/icon.svg', 'POST'), undefined);
assert.equal(dispatch('/icon.svg', 'GET', 'navigate'), undefined);
assert.equal(network, 0);
await dispatch('/icon-192.png');
assert.equal(network, 1);
assert.deepEqual(writes, [origin + '/icon-192.png']);
response.redirected = true;
await dispatch('/icon-512.png');
assert.equal(writes.length, 1);
const gate = readFileSync(new URL('../auth-gate.js', import.meta.url), 'utf8');
assert.match(gate, /fetch\('\/api\/me', \{ cache: 'no-store', credentials: 'same-origin'/);
const verify = readFileSync(new URL('../functions/api/auth/verify.js', import.meta.url), 'utf8');
assert.match(verify, /'Cache-Control': 'no-store'/);
console.log('PASS: service worker bypasses sensitive requests, purges old caches and caches only approved assets; auth requests and redirects disable caching');
