// GET /api/rb2b/list  — owner-only list of identified RB2B visitors.
// Auth: signed in with an email in ADMIN_EMAILS (same gate as the stats page).
import { json, now, DAY, requireAdmin } from '../../_shared/util.js';

export async function onRequestGet({ request, env }) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;

  const t = now();
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      `SELECT id, name, title, company, company_domain, linkedin_url, email,
              location, last_page, page_count, identified_at
         FROM rb2b_visitors
        ORDER BY identified_at DESC
        LIMIT 200`,
    ).all()).results || [];
  } catch (err) {
    // Table may not exist yet (migration not run) — report empty, not a 500.
    console.error('rb2b list failed', err);
    return json({ visitors: [], total: 0, last7: 0, note: 'rb2b table not migrated yet' });
  }

  const horizon = t - 7 * DAY;
  const last7 = rows.filter((r) => (r.identified_at || 0) >= horizon).length;

  const visitors = rows.map((r) => ({
    name: r.name || null,
    title: r.title || null,
    company: r.company || null,
    companyDomain: r.company_domain || null,
    linkedin: r.linkedin_url || null,
    email: r.email || null,
    location: r.location || null,
    lastPage: r.last_page || null,
    pageCount: r.page_count || null,
    identifiedAt: r.identified_at || null,
  }));

  return json({ generatedAt: t, total: rows.length, last7, visitors });
}
