import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPreviewAssets } from '../scripts/build-preview-us.mjs';

const output = await mkdtemp(path.join(os.tmpdir(), 'sst-preview-us-test-'));
try {
  const result = await buildPreviewAssets({ output });
  const files = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative);
      else files.push(relative);
    }
  }
  await walk(output);
  assert.deepEqual(files.sort(), result.staticAssets);
  for (const excluded of ['admin.html', 'app.js', 'bundle.py', 'docs', 'functions', 'migrations', 'package.json', 'scripts', 'tests', 'wrangler.preview-us.toml']) {
    assert.equal(files.some((file) => file === excluded || file.startsWith(`${excluded}/`)), false, `excluded path shipped: ${excluded}`);
  }
  assert.ok(result.functionFiles.includes('functions/api/data.js'));
  assert.ok(result.functionFiles.includes('functions/api/auth/request.js'));
  assert.ok(result.functionFiles.every((file) => file.startsWith('functions/')));
  const checkoutAssets = ['checkout-sandbox.html','checkout-sandbox-entry.js','checkout-sandbox.js','checkout-controller.js'];
  for (const asset of checkoutAssets) assert.ok(!files.includes(asset), 'default build leaked '+asset);
  const optedIn = await buildPreviewAssets({output,includeCheckout:true});
  assert.deepEqual(optedIn.staticAssets,[...files,...checkoutAssets].sort());
  for (const asset of checkoutAssets) assert.ok((await readdir(output)).includes(asset));
  console.log('PASS: checkout assets require explicit opt-in');
  console.log(`PASS: explicit static allowlist contains ${files.length} assets; ${result.functionFiles.length} Pages Function files remain discoverable from the repository root.`);
} finally {
  await rm(output, { recursive: true, force: true });
}
