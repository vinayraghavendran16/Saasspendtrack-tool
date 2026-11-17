// Pre-generate renewal guides into /guides/*.json by calling the live backend.
// Run: node scripts/gen-guides.mjs   (writes to ../guides)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'guides');
const ENDPOINT = process.env.RG_ENDPOINT || 'https://app.saasspendtrack.com/api/renewal-guide';
const VENDORS = [
  'ZoomInfo', 'Salesforce', 'HubSpot', 'Outreach', 'Salesloft', 'Gong',
  'Zoom', 'Slack', 'Datadog', 'Snowflake', 'DocuSign', 'Adobe',
];
const slug = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function gen(vendor) {
  const started = Date.now();
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vendor }) });
    const j = await r.json();
    if (!j || !j.ok || !j.guide) { console.log(`✗ ${vendor}: ${(j && (j.message || j.error)) || 'no guide'}`); return null; }
    const rec = { vendor: j.vendor || vendor, slug: slug(vendor), guide: j.guide, sources: j.sources || [], checkedAt: j.checkedAt || new Date().toISOString(), model: j.model || '' };
    writeFileSync(join(OUT, slug(vendor) + '.json'), JSON.stringify(rec, null, 2));
    console.log(`✓ ${vendor}: ${rec.sources.length} sources, ${rec.guide.length} chars (${Math.round((Date.now() - started) / 1000)}s)`);
    return { vendor: rec.vendor, slug: rec.slug, checkedAt: rec.checkedAt, sourceCount: rec.sources.length, chars: rec.guide.length };
  } catch (e) { console.log(`✗ ${vendor}: ${e.message}`); return null; }
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const index = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < VENDORS.length; i += CONCURRENCY) {
    const batch = VENDORS.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(gen));
    results.forEach((r) => { if (r) index.push(r); });
  }
  index.sort((a, b) => a.vendor.localeCompare(b.vendor));
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), guides: index }, null, 2));
  console.log(`\nindex.json written with ${index.length}/${VENDORS.length} guides.`);
}
run();
