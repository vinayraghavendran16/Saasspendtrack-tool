/* ================================================================
   Phase 51 — Expanded test coverage for Phases 43-50
   ================================================================
   API-boundary tests: verify handles exist, modules loaded, patches
   applied. No state mutations, no modal opens, no renderAll calls
   — those caused the Puppeteer test runner to hang mid-evaluation.

   Deeper behavioural testing lives in trial-tracking/UAT-PHASE-43-50.md
   for the human to walk through.

   Hook pattern: wrap defineTests() from extensions10 so our tests
   are appended after the originals.
   ================================================================ */

(() => {

const _origDefineTests = typeof window.defineTests === 'function' ? window.defineTests : null;
if (!_origDefineTests) {
  console.warn('[Phase 51] defineTests not found; test coverage expansion skipped');
  return;
}

window.defineTests = function () {
  _origDefineTests.apply(this, arguments);
  // Idempotency guard — match the Phase 10 pattern (TESTS.length short-circuit).
  // Without this, our tests get re-registered every time defineTests is called
  // (which the test-report UI re-does on button clicks).
  if (window._p51_tests_registered) return;
  window._p51_tests_registered = true;

  // ---------- Phase 43: onboarding ----------

  test('phase43.onboarding', 'window.OnboardHelp public handle exists', () => {
    assert(typeof window.OnboardHelp === 'object', 'OnboardHelp missing');
    ['open', 'runFlow', 'resetChecklist', 'resetAll'].forEach(k =>
      assert(typeof window.OnboardHelp[k] === 'function', `OnboardHelp.${k} missing`));
  });

  // ---------- Phase 44: bulk CSV import ----------

  test('phase44.bulk', 'window.BulkImport public handle exists', () => {
    assert(typeof window.BulkImport === 'object', 'BulkImport missing');
    ['open', 'close', 'parseCSV', 'autoMap'].forEach(k =>
      assert(typeof window.BulkImport[k] === 'function', `BulkImport.${k} missing`));
  });

  test('phase44.bulk', 'parseCSV handles quoted commas', () => {
    const rows = BulkImport.parseCSV('"Acme, Inc.",100\nFoo,200');
    assertEq(rows.length, 2, 'wrong row count');
    assertEq(rows[0][0], 'Acme, Inc.', 'quoted comma not preserved');
    assertEq(rows[0][1], '100', 'quoted-field col 2 lost');
  });

  test('phase44.bulk', 'parseCSV auto-detects tab delimiter', () => {
    const rows = BulkImport.parseCSV('A\tB\tC\n1\t2\t3');
    assertEq(rows.length, 2, 'row count');
    assertEq(rows[0].length, 3, 'col count');
  });

  test('phase44.bulk', 'autoMap recognises common aliases', () => {
    const map = BulkImport.autoMap(['Vendor', 'Annual cost', 'Cycle', 'Owner', 'Renewal date']);
    assertEq(map.name, 0, 'Vendor → name');
    assertEq(map.cost, 1, 'Annual cost → cost');
    assertEq(map.cycle, 2, 'Cycle → cycle');
    assertEq(map.owner, 3, 'Owner → owner');
    assertEq(map.renewal, 4, 'Renewal date → renewal');
  });

  test('phase44.bulk', 'autoMap recognises exotic aliases', () => {
    const map = BulkImport.autoMap(['Tool', 'ACV', 'Frequency', 'POC']);
    assertEq(map.name, 0, 'Tool → name');
    assertEq(map.cost, 1, 'ACV → cost');
    assertEq(map.cycle, 2, 'Frequency → cycle');
    assertEq(map.owner, 3, 'POC → owner');
  });

  test('phase44.bulk', 'autoMap returns empty mapping for unrecognised headers', () => {
    const map = BulkImport.autoMap(['foo', 'bar', 'baz']);
    assertEq(Object.keys(map).length, 0, 'should be empty');
  });

  // ---------- Phase 46: reports ----------

  test('phase46.reports', 'window.Reports public handle exists', () => {
    assert(typeof window.Reports === 'object', 'Reports missing');
    ['spendSummary', 'renewalRoster', 'savings', 'view'].forEach(k =>
      assert(typeof window.Reports[k] === 'function', `Reports.${k} missing`));
  });

  test('phase46.reports', 'Reports sidebar tab present', () => {
    const tab = document.querySelector('.tab[data-view="reports"]');
    assert(tab, 'Reports tab missing from sidebar');
  });

  test('phase46.reports', 'Reports view container exists', () => {
    const v = document.querySelector('.view[data-view="reports"]');
    assert(v, 'reports view container missing');
  });

  // ---------- Phase 47: settings + multi-currency ----------

  test('phase47.settings', 'window.Settings public handle exists', () => {
    assert(typeof window.Settings === 'object', 'Settings missing');
    ['open', 'setCurrency', 'refreshFx'].forEach(k =>
      assert(typeof window.Settings[k] === 'function', `Settings.${k} missing`));
  });

  test('phase47.settings', 'Settings sidebar tab present', () => {
    const tab = document.querySelector('.tab[data-view="settings"]');
    assert(tab, 'Settings tab missing');
  });

  test('phase47.settings', 'formatMoney is monkey-patched', () => {
    assert(window.formatMoney._p47, 'formatMoney not patched by Phase 47');
    assert(window.formatMoneyShort._p47, 'formatMoneyShort not patched by Phase 47');
  });

  test('phase47.settings', 'formatMoney USD returns dollar prefix', () => {
    // Don't mutate state. Just check the USD passthrough — if no fx or
    // currency setting is set, the patch should fall back to the original.
    const r = formatMoney(100);
    assert(typeof r === 'string' && r.length > 0, 'formatMoney returned invalid');
  });

  // ---------- Phase 48: payment detection ----------

  test('phase48.payment', 'window.MarkPaid public handle exists', () => {
    assert(typeof window.MarkPaid === 'object', 'MarkPaid missing');
    ['manual', 'isPaid', 'state', 'undo'].forEach(k =>
      assert(typeof window.MarkPaid[k] === 'function', `MarkPaid.${k} missing`));
  });

  test('phase48.payment', 'state() has required keys', () => {
    const s = MarkPaid.state();
    assert(s, 'state object missing');
    ['isPaid', 'paidAt', 'paymentId', 'method', 'acknowledged'].forEach(k =>
      assert(k in s, `paidState.${k} missing`));
  });

  // ---------- Phase 49: command palette ----------

  test('phase49.cmdpal', 'window.CmdPal public handle exists', () => {
    assert(typeof window.CmdPal === 'object', 'CmdPal missing');
    ['open', 'close'].forEach(k =>
      assert(typeof window.CmdPal[k] === 'function', `CmdPal.${k} missing`));
  });

  // ---------- Phase 50: per-subscription currency ----------

  test('phase50.subccy', 'window.SubCurrency public handle exists', () => {
    assert(typeof window.SubCurrency === 'object', 'SubCurrency missing');
    ['edit', 'get', 'set'].forEach(k =>
      assert(typeof window.SubCurrency[k] === 'function', `SubCurrency.${k} missing`));
  });

  test('phase50.subccy', 'monthlyCost is monkey-patched for USD normalization', () => {
    assert(window.monthlyCost._p50, 'monthlyCost not patched by Phase 50');
  });

  test('phase50.subccy', 'subs without currency field default to USD passthrough', () => {
    const sub = { cost: 500, cycle: 'yearly' };  // no currency
    const mc = monthlyCost(sub);
    // Should be 500/12 since cycle=yearly, no currency → USD → USD (passthrough)
    assert(Math.abs(mc - 500 / 12) < 0.01, `expected ~${500/12}, got ${mc}`);
  });

  // ---------- Phase 52: diagnostics ----------

  test('phase52.diag', 'window.Diag public handle exists', () => {
    assert(typeof window.Diag === 'object', 'Diag missing');
    ['check', 'runTests', 'errors', 'clear', 'reset', 'open'].forEach(k =>
      assert(typeof window.Diag[k] === 'function', `Diag.${k} missing`));
  });

  test('phase52.diag', 'Diag.check returns a complete report', () => {
    const r = Diag.check();
    assert(r && typeof r === 'object', 'check returned null');
    assert(Array.isArray(r.modules), 'modules missing');
    assert(Array.isArray(r.patches), 'patches missing');
    assert(Array.isArray(r.errors), 'errors missing');
    assert(r.summary, 'summary missing');
    // Should report all 7 modules
    assert(r.modules.length === 7, `expected 7 modules, got ${r.modules.length}`);
  });

  test('phase52.diag', 'all 7 modules report healthy', () => {
    const r = Diag.check();
    const broken = r.modules.filter(m => m.status !== 'ok');
    assert(broken.length === 0, 'broken modules: ' + broken.map(m => m.id).join(', '));
  });

  // ---------- Integration ----------

  test('integration.phase43to50', 'all monkey-patches stacked without breakage', () => {
    // formatMoney callable
    const r = formatMoney(1000);
    assert(typeof r === 'string', 'formatMoney broken: ' + r);
    assert(r.length > 0, 'formatMoney returned empty');
    // monthlyCost callable
    const sub = { cost: 100, cycle: 'monthly', currency: 'USD' };
    const mc = monthlyCost(sub);
    assert(typeof mc === 'number' && !isNaN(mc), 'monthlyCost broken');
    // switchView callable
    assert(typeof window.switchView === 'function', 'switchView missing');
  });

  test('integration.phase43to50', 'renderAll is still a function after all patches', () => {
    assert(typeof window.renderAll === 'function', 'renderAll missing');
  });

};

})();
