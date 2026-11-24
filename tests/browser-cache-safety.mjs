import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const load = app.slice(app.indexOf('function load() {'), app.indexOf('\nconst PLANS ='));
const save = app.slice(app.indexOf('function save() {'), app.indexOf('\nlet _serverSaveTimer'));
const sync = app.slice(app.indexOf('async function syncFromServer() {'), app.indexOf('\n// -------- math --------'));
assert.ok(load.includes('_legacyBrowserData = parsed'), 'legacy data is preserved for reviewed import');
assert.ok(load.includes('state = { subscriptions: [] }'), 'legacy records are never rendered before authentication');
assert.ok(!load.includes('state = parsed'), 'legacy records must not be auto-hydrated');
assert.ok(!save.includes('localStorage.setItem(STORAGE_KEY'), 'legacy cache must not be overwritten on save');
assert.ok(save.includes('localStorage.setItem(_workspaceDraftKey'), 'local edits use verified workspace-scoped recovery');
assert.ok(!save.includes('localStorage.setItem(UNSYNCED_DRAFT_KEY'), 'old global recovery key must never be overwritten');
assert.ok(save.includes('!_draftRecoveryPending'), 'existing unsynced drafts must never be overwritten');
assert.ok(app.includes('showDraftRecoveryBanner()'), 'existing drafts must offer a recovery workflow');
assert.ok(app.includes("exportButton.textContent = 'Export recovery draft'"), 'recovery draft can be exported');
assert.ok(sync.includes('j.version'), 'server data must have a revision');
assert.ok(sync.includes('_legacyBrowserData'), 'empty workspaces inspect legacy records before onboarding');
assert.ok(!sync.includes('pushServerSave()'), 'hydration must not silently import legacy data');
assert.ok(app.includes('async function offerLegacyImport()'), 'legacy import requires a separate user action');
assert.ok(app.includes("'If-Match': '0'"), 'import is limited to a still-empty workspace');
assert.ok(app.includes('legacyImportCurrencyReviewed = true'), 'currency review is recorded');
assert.ok(app.includes('legacyImportAt = new Date()'), 'import timestamp is recorded');
assert.ok(app.includes('showLegacyImportPrompt()'), 'legacy import requires a visible prompt');
assert.ok(app.includes('workspaceCurrency()'), 'display respects confirmed workspace currency');
assert.ok(save.includes('if (_legacyImportPending) _legacyImportDirty = true'), 'edits during import decision mark the import unsafe');
assert.ok(app.includes('if (_legacyImportDirty) {'), 'import refuses to overwrite interim edits');
assert.ok(sync.includes('_legacyImportDirty = editsAtStart !== _localEditCounter'), 'edits during hydration also block import');
assert.ok(save.includes('!_legacyImportPending'), 'pending import cannot trigger an automatic save');
assert.ok(app.includes('if (!_serverHydrated || _serverSaveBlocked || _legacyImportPending || _draftRecoveryPending) return;'), 'pending import and recovery block server writes');
assert.ok(sync.includes('_legacyImportPending = true'), 'legacy records activate the pending-import gate');
assert.ok(app.includes("startFresh.textContent = 'Start with empty workspace'"), 'user can decline legacy import');
assert.ok(app.includes('localStorage.removeItem(_workspaceDraftKey)'), 'draft deletion is scoped to verified workspace');
assert.ok(sync.includes('setAuthenticatedWorkspace(j.workspaceId)'), 'server must identify workspace before drafts are read or written');
console.log('PASS: legacy browser cache stays read-only, drafts are isolated and server hydration is revisioned');

// Verify the artifact actually served by Pages, not just the source module.
const deployed = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = '// SaaS Spend Track - vanilla JS app with localStorage persistence.';
const end = '// -------- math --------';
assert.equal(deployed.slice(deployed.indexOf(start), deployed.indexOf(end)), app.slice(0, app.indexOf(end)), 'deployed storage must match the tested source');
assert.ok(!deployed.includes('if (!state.subscriptions.length && !state.settings.seededOnce) seed({ silent: true });'), 'no automatic sample injection in deployed artifact');
assert.ok(deployed.includes(app.slice(app.indexOf('// Workspace AI processing: explicit opt-in'))), 'deployed artifact includes consent disclosure and controls');
assert.ok(deployed.includes(app.slice(app.indexOf('function workspaceCurrency()'), app.indexOf('function parseDate(s)'))), 'deployed base currency formatting matches source');
console.log('PASS: deployed browser storage, currency and AI consent parity');
for (const name of ['ensureWorkspace', 'markComplete', 'markViewed']) {
  const begin = deployed.indexOf('function ' + name + '(');
  const body = deployed.slice(begin, deployed.indexOf('\n}', begin) + 2);
  assert.ok(!body.includes('save();'), name + ' must not write during rendering or hydration');
}
assert.ok(!deployed.includes('ob().tourSeen = true;\n  try { save(); }'), 'onboarding boot does not race hydration');
console.log('PASS: rendering and onboarding do not schedule implicit cloud saves');
assert.ok(app.includes("document.querySelector('main') || document.body"), 'recovery/import controls remain outside replaceable view contents');
assert.ok(app.includes('imported.settings.display = { ...imported.settings.display, currency: code }'), 'reviewed legacy currency sets deployed display preference');
assert.ok(app.includes('if (!item.currency) item.currency = code;'), 'unlabeled legacy amounts retain reviewed source currency');

assert.ok(app.includes('I confirm that ALL monetary records originally use'), 'import requires explicit single-currency confirmation');
assert.ok(!app.includes('Subscription billing-period amounts total:'), 'import must not sum incompatible billing periods');

const legacyImport = app.slice(app.indexOf('async function offerLegacyImport()'), app.indexOf('function showLegacyImportPrompt()'));
const legacyPrompt = app.slice(app.indexOf('function showLegacyImportPrompt()'), app.indexOf('async function syncFromServer()'));
assert.ok(legacyImport.includes('|| _draftRecoveryPending || _serverSaveBlocked) return;'), 'import cannot bypass draft recovery');
assert.ok(legacyPrompt.includes('if (_draftRecoveryPending || _serverSaveBlocked || !_legacyImportPending) return;'), 'start fresh cannot bypass recovery');
assert.ok(!legacyPrompt.includes('localStorage.removeItem'), 'legacy decisions must never delete recovery drafts');
assert.ok(app.includes('if (_legacyImportPending && _serverHydrated && _serverVersion === 0) showLegacyImportPrompt();'), 'legacy review resumes only after explicit recovery discard');

const { runInNewContext } = await import('node:vm');
const formatterStart = deployed.indexOf('function patchFormatters()');
const formatterEnd = deployed.indexOf('\n}', formatterStart) + 2;
const monthlyPatchStart = deployed.indexOf("if (typeof window.monthlyCost === 'function' && !window.monthlyCost._p50)");
const monthlyPatchEnd = deployed.indexOf('\n}', monthlyPatchStart) + 2;
const mathStart = deployed.indexOf('function monthlyCost(sub)');
const mathEnd = deployed.indexOf('function parseDate(s)', mathStart);
const cycleDefinition = deployed.match(/^const CYCLE_MONTHS = .*;$/m)[0];

const finance = {};
finance.window = finance;
runInNewContext([
  cycleDefinition,
  'const state = { settings: { currency: "EUR" } };',
  'let origFormatMoney, origFormatMoneyShort;',
  'const ss = () => ({ currency: "GBP" });',
  'const convert = () => { throw new Error("unexpected display FX"); };',
  'const toUSD = () => { throw new Error("unexpected source FX"); };',
  deployed.slice(mathStart, mathEnd),
  deployed.slice(formatterStart, formatterEnd),
  'patchFormatters();',
  deployed.slice(monthlyPatchStart, monthlyPatchEnd),
].join('\n'), finance);

for (const [cycle, cost, annual] of [
  ['weekly', 100, 5200],
  ['monthly', 100, 1200],
  ['quarterly', 300, 1200],
  ['yearly', 1200, 1200],
]) {
  assert.ok(Math.abs(finance.monthlyCost({ cycle, cost, currency: 'EUR' }) * 12 - annual) < 0.000001);
}
const contract = { cycle: 'yearly', cost: 1200, currency: 'EUR', licenses: 10, assigned: 7, utilized: 6 };
assert.equal(finance.consumption(contract).unusedCostMonthly, 40);
assert.equal(finance.consumption({ ...contract, active: false }).unusedCostMonthly, 0);
assert.equal(finance.formatMoney(finance.monthlyCost(contract)), '€100.00');
assert.equal(finance.formatMoneyShort(1200), 'EUR 1.2k');
console.log('PASS: deployed recurring spend, seat waste and stated-currency formatting without FX');
