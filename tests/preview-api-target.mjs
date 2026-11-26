import assert from 'node:assert/strict';
import { parseUsPreviewUrl } from '../scripts/preview-api-target.mjs';

for (const value of [
  'https://saasspendtrack-preview-us.pages.dev/',
  'https://63477a2c.saasspendtrack-preview-us.pages.dev/',
  'https://release-production-integrati.saasspendtrack-preview-us.pages.dev/',
]) {
  assert.equal(parseUsPreviewUrl(value).origin + '/', value);
}

for (const value of [
  'https://app.saasspendtrack.com/',
  'https://abc123.saasspendtrack.pages.dev/',
  'https://evil-saasspendtrack-preview-us.pages.dev.attacker.test/',
  'https://bad..saasspendtrack-preview-us.pages.dev/',
  'https://nested.63477a2c.saasspendtrack-preview-us.pages.dev/',
  'http://63477a2c.saasspendtrack-preview-us.pages.dev/',
  'https://user@63477a2c.saasspendtrack-preview-us.pages.dev/',
  'https://63477a2c.saasspendtrack-preview-us.pages.dev:8443/',
  'https://63477a2c.saasspendtrack-preview-us.pages.dev/private',
]) {
  assert.throws(() => parseUsPreviewUrl(value), TypeError, `must reject ${value}`);
}

console.log('PASS: live API smoke target accepts only the isolated US Preview HTTPS origin');
