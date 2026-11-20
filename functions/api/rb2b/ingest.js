// POST /api/rb2b/ingest
// Receives an identified RB2B visitor and stores it for the admin dashboard.
//
// RB2B's free plan has no raw webhook, so the usual wiring is:
//   RB2B  ->  Make.com (official RB2B app) or Zapier  ->  HTTP POST here
// with the shared secret in the Authorization header. A direct webhook on
// RB2B Pro works too. The payload shape varies by bridge, so we map fields
// defensively and keep the raw JSON.
//
// Auth: a shared secret in `Authorization: Bearer <secret>` or `?key=<secret>`,
// compared against RB2B_INGEST_SECRET. No session (the caller is a machine).
import { json, now, safeEqual, sha256Hex, rateLimit } from '../../_shared/util.js';

const MAX_BODY = 100 * 1024; // 100 KB

function presented(request, url) {
  const h = request.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return url.searchParams.get('key') || '';
}

// Pull the first non-empty value for any of the candidate keys (case-insensitive).
function pick(obj, keys) {
  for (const k of keys) {
    for (const actual of Object.keys(obj)) {
      if (actual.toLowerCase() === k.toLowerCase()) {
        const v = obj[actual];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
    }
  }
  return null;
}

// Normalise a timestamp that might be epoch ms, epoch seconds, or an ISO string.
function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  const n = Date.parse(String(v));
  return Number.isNaN(n) ? null : n;
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const secret = env.RB2B_INGEST_SECRET;
  if (!secret) return json({ error: 'ingest not configured' }, 500);
  if (!safeEqual(presented(request, url), secret)) {
    return json({ error: 'bad secret' }, 401);
  }

  // Cheap abuse guard (D1-backed, fails open).
  await rateLimit(env, 'rb2b:ingest', 2000, 3600000);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'payload too large' }, 413);

  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'expected an object' }, 400);
  }

  const first = pick(body, ['first_name', 'firstName', 'first']);
  const last = pick(body, ['last_name', 'lastName', 'last']);
  const name = pick(body, ['name', 'full_name', 'fullName'])
    || [first, last].filter(Boolean).join(' ').trim() || null;
  const title = pick(body, ['title', 'job_title', 'jobTitle', 'position']);
  const company = pick(body, ['company', 'company_name', 'companyName', 'organization']);
  const companyDomain = pick(body, ['company_domain', 'companyDomain', 'domain', 'website']);
  const linkedin = pick(body, ['linkedin_url', 'linkedinUrl', 'linkedin', 'li_url']);
  const email = pick(body, ['business_email', 'email', 'work_email', 'workEmail']);
  const city = pick(body, ['city', 'location_city']);
  const region = pick(body, ['region', 'state', 'location_region']);
  const location = pick(body, ['location']) || [city, region].filter(Boolean).join(', ') || null;
  const lastPage = pick(body, ['last_page', 'lastPage', 'current_url', 'url', 'page', 'landing_page']);
  const pageCountRaw = pick(body, ['page_count', 'pageCount', 'all_time_page_views', 'page_views', 'visits']);
  const pageCount = pageCountRaw == null ? null : parseInt(pageCountRaw, 10) || null;
  const identifiedAt = toMs(pick(body, ['identified_at', 'last_seen', 'lastSeen', 'timestamp', 'seen_at', 'date']))
    || now();

  // Dedup key: prefer a stable identity, fall back to a hash of what we have.
  let id = (linkedin && String(linkedin).trim())
    || (email && String(email).toLowerCase().trim())
    || null;
  if (!id) id = 'h_' + (await sha256Hex([name, company, title].filter(Boolean).join('|') || raw)).slice(0, 24);

  const rawStored = raw.length > 8000 ? raw.slice(0, 8000) : raw;

  try {
    await env.DB.prepare(
      `INSERT INTO rb2b_visitors
         (id, name, title, company, company_domain, linkedin_url, email, location, last_page, page_count, identified_at, raw, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name=COALESCE(excluded.name, name),
         title=COALESCE(excluded.title, title),
         company=COALESCE(excluded.company, company),
         company_domain=COALESCE(excluded.company_domain, company_domain),
         linkedin_url=COALESCE(excluded.linkedin_url, linkedin_url),
         email=COALESCE(excluded.email, email),
         location=COALESCE(excluded.location, location),
         last_page=excluded.last_page,
         page_count=COALESCE(excluded.page_count, page_count),
         identified_at=MAX(excluded.identified_at, identified_at),
         raw=excluded.raw`,
    ).bind(id, name, title, company, companyDomain, linkedin, email, location,
      lastPage, pageCount, identifiedAt, rawStored, now()).run();
  } catch (err) {
    console.error('rb2b ingest failed', err);
    return json({ error: 'could not store visitor' }, 500);
  }

  return json({ ok: true, id });
}
