import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('admin.html', 'utf8');

test('recent account fields are HTML escaped', () => {
  assert.match(html, /esc\(r\.email\)/);
  assert.match(html, /esc\(r\.status\)/);
  assert.match(html, /esc\(r\.plan\s*\|\|\s*['"]–['"]\)/);
});

test('work-email metrics use textContent', () => {
  for (const id of [
    'm-work-trials',
    'm-work-verified',
    'm-work-value',
    'work-pipeline-note'
  ]) {
    assert.ok(
      html.includes(`getElementById('${id}').textContent`),
      `${id} must use textContent`
    );
  }
});
