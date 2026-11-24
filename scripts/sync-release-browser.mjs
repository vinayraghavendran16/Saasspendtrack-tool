// Sync security-critical sections without rebuilding unrelated inline-only UI.
import { readFileSync, writeFileSync } from 'node:fs';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const path = new URL('../index.html', import.meta.url);
let html = readFileSync(path, 'utf8');
const marker = '// SaaS Spend Track - vanilla JS app with localStorage persistence.';
const math = '// -------- math --------';
html = html.slice(0, html.indexOf(marker)) + app.slice(0, app.indexOf(math)) + html.slice(html.indexOf(math));
const moneyStart = html.includes('function workspaceCurrency()') ? 'function workspaceCurrency()' : 'function formatMoney(n)';
html = html.slice(0, html.indexOf(moneyStart)) + app.slice(app.indexOf('function workspaceCurrency()'), app.indexOf('function parseDate(s)')) + html.slice(html.indexOf('function parseDate(s)'));
html = html.replace('if (!state.subscriptions.length && !state.settings.seededOnce) seed({ silent: true });', '// New workspaces start empty; sample data requires explicit action.');
const ai = '// Workspace AI processing: explicit opt-in';
if (!html.includes(ai)) {
  const end = html.indexOf('</script>', html.indexOf(marker));
  html = html.slice(0, end) + '\n' + app.slice(app.indexOf(ai)) + '\n' + html.slice(end);
}
writeFileSync(path, html);
