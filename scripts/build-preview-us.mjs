import { cp, lstat, mkdir, mkdtemp, readdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_ASSETS = [
  '_headers',
  '_redirects',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'icon.svg',
  'index.html',
  'manifest.webmanifest',
  'sw.js',
];

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

async function requireRegularFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular, non-symlink asset: ${file}`);
}

export async function buildPreviewAssets({ root = ROOT, output, includeCheckout = false } = {}) {
  const sourceRoot = path.resolve(root);
  const outputDir = path.resolve(output ?? await mkdtemp(path.join(os.tmpdir(), 'sst-preview-us-assets-')));
  if (![os.tmpdir(), '/private/tmp'].some((parent) => isWithin(parent, outputDir))) {
    throw new Error('Preview output must be created under the system temporary directory.');
  }
  if (isWithin(sourceRoot, outputDir) || outputDir === sourceRoot) throw new Error('Preview output must be outside the repository.');

  const guideIndex = JSON.parse(await readFile(path.join(sourceRoot, 'guides/index.json'), 'utf8'));
  if (!Array.isArray(guideIndex.guides)) throw new Error('guides/index.json must contain a guides array.');
  const slugs = [...new Set(guideIndex.guides.map(({ slug }) => slug))];
  if (slugs.some((slug) => typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug))) {
    throw new Error('Guide index contains an unsafe slug.');
  }
  const checkoutAssets = includeCheckout === true ? ['checkout-sandbox.html','checkout-sandbox-entry.js','checkout-sandbox.js','checkout-controller.js'] : [];
  const allowlist = [...ROOT_ASSETS, ...checkoutAssets, 'guides/index.json', ...slugs.map((slug) => `guides/${slug}.json`)];
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const relative of allowlist) {
    const source = path.join(sourceRoot, relative);
    await requireRegularFile(source);
    const destination = path.join(outputDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
  }

  const functionFiles = [];
  async function visitFunctions(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in Pages Functions: ${relative}`);
      if (entry.isDirectory()) await visitFunctions(path.join(dir, entry.name), relative);
      else if (entry.isFile() && entry.name.endsWith('.js')) functionFiles.push(relative);
      else if (!entry.isFile()) throw new Error(`Unexpected Pages Functions entry: ${relative}`);
    }
  }
  await visitFunctions(path.join(sourceRoot, 'functions'));
  if (!functionFiles.includes('api/data.js') || !functionFiles.includes('api/auth/request.js')) {
    throw new Error('Required Pages Function routes are missing.');
  }

  return {
    outputDir,
    staticAssets: allowlist.sort(),
    functionFiles: functionFiles.map((name) => `functions/${name}`).sort(),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf('--out');
  const output = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  if (outIndex >= 0 && (!output || output.startsWith('--'))) throw new Error('Usage: node scripts/build-preview-us.mjs [--out /tmp/path]');
  const result = await buildPreviewAssets({ output, includeCheckout: process.argv.includes('--include-checkout') });
  console.log(JSON.stringify(result, null, 2));
}
