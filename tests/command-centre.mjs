import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function extract(start, next) {
  const a = html.indexOf(start);
  const b = html.indexOf(next, a + start.length);
  assert.ok(a !== -1 && b > a, 'Cannot locate ' + start);
  return html.slice(a, b);
}
const demoFn = extract('function isDemoMode() {', 'function ccPresetBoxHtml() {');
const renderFn = extract('function renderCommandCentre() {', '/* Empty-workspace guidance:');
const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
const state = { subscriptions: [], invoices: [], employees: [], settings: {} };
const ctx = {
  state,
  document: { getElementById: id => id === 'cc-root' ? root : null },
  ccSteps: () => [{ id: 'individual', icon: '📄', title: 'Load individual contracts', desc: 'Import contracts safely', cta: 'Upload', done: false, act: () => {} }],
  workspace: () => ({}),
  escapeHtml: v => String(v),
  ccPresetBoxHtml: () => '<div id="cc-preset-box">' + (runInNewContext('isDemoMode()', ctx) ? 'demo' : 'real') + '</div>',
  wireCcPresetBox: () => {},
  Set, Math,
};
runInNewContext(demoFn + '\n' + renderFn, ctx);

function mode({ preset = 'acme', subs = [], invoices = [] } = {}) {
  state.settings = preset ? { activePreset: preset } : {};
  state.subscriptions = subs;
  state.invoices = invoices;
  return runInNewContext('isDemoMode()', ctx);
}
assert.equal(mode(), false, 'an empty workspace is not demo data');
assert.equal(mode({ subs: [{ fromPreset: true }] }), true, 'marked preset data is demo');
assert.equal(mode({ subs: [{ fromPreset: true }], invoices: [{ fromPreset: true }] }), true);
assert.equal(mode({ subs: [{ fromPreset: true }, { name: 'real vendor' }] }), false, 'mixed data is real');
assert.equal(mode({ subs: [{ name: 'real vendor' }] }), false);
assert.equal(mode({ subs: [{ fromPreset: true }], invoices: [{}] }), false, 'real invoice blocks demo');
assert.equal(mode({ preset: '', subs: [{ fromPreset: true }] }), false, 'missing marker blocks demo');

state.settings = {};
state.subscriptions = [{ name: 'Real SaaS contract', cost: 100, cycle: 'monthly' }];
state.invoices = [];
runInNewContext('renderCommandCentre()', ctx);
assert.match(root.innerHTML, /Command Centre/);
assert.match(root.innerHTML, /Bring in your contracts/);
assert.match(root.innerHTML, /Load individual contracts/);
assert.match(root.innerHTML, /cc-preset-box/);
assert.match(html, /state\.subscriptions = sample\.subs \|\| sample\.subscriptions \|\| \[\];/, 'Acme loader uses sample.subs');
console.log('PASS: Command Centre renders and demo detection fails closed for real/mixed data');
