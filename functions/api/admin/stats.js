// GET /api/admin/stats  - owner-only metrics for the admin command centre.
// Auth: must be signed in with an email listed in ADMIN_EMAILS.
import { json, now, DAY, requireAdmin } from '../../_shared/util.js';
import { workEmailPipeline } from '../../_shared/work-email-pipeline.js';

// Admin/owner emails are excluded from the funnel so your own testing
// doesn't inflate trial numbers.
function adminSet(env) {
  return new Set(String(env.ADMIN_EMAILS || '')
    .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean));
}

const INR_PRICE = 300000;   // ₹3,00,000 / year
const USD_PRICE = 3499;     // $3,499 / year

export async function onRequestGet({ request, env }) {
  const gate = await requireAdmin(request, env);
  if (gate.response) return gate.response;

  const usdInr = Number(env.USD_INR || 86);
  const t = now();

  const admins = adminSet(env);
  const users = ((await env.DB.prepare('SELECT * FROM users').all()).results || [])
    .filter((u) => !admins.has(String(u.email || '').trim().toLowerCase()));
  const emailRows = (await env.DB.prepare(
    'SELECT kind, COUNT(*) c FROM email_log GROUP BY kind',
  ).all()).results || [];

  // Effective status (lazily treats a lapsed trial as expired for the counts).
  const eff = (u) => {
    if (u.status === 'active') return 'active';
    if (u.status === 'trial' && t < u.trial_ends_at) return 'trial';
    return 'expired';
  };

  // Annual value of a paid user, in INR.
  const inrValue = (u) => {
    if (u.amount_paid != null && u.currency) {
      const major = u.amount_paid / 100; // paise/cents -> major unit
      return u.currency === 'USD' ? major * usdInr : major;
    }
    return u.plan === 'annual-usd' ? USD_PRICE * usdInr : INR_PRICE;
  };

  let activeTrials = 0, expiredUnpaid = 0, paid = 0;
  let revenueINR = 0;
  const byDay = {}; // signups per day, last 14 days
  const horizon = t - 14 * DAY;

  for (const u of users) {
    const s = eff(u);
    if (s === 'trial') activeTrials++;
    else if (s === 'expired') expiredUnpaid++;
    else if (s === 'active') { paid++; revenueINR += inrValue(u); }

    if (u.created_at >= horizon) {
      const d = new Date(u.created_at).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + 1;
    }
  }

  const totalTrials = users.length;
  const decided = paid + expiredUnpaid;
  const conversionPct = decided ? +(100 * paid / decided).toFixed(1) : 0;
  const trialChurnPct = decided ? +(100 * expiredUnpaid / decided).toFixed(1) : 0;

  // Build a contiguous 14-day signup series.
  const signups = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(t - i * DAY).toISOString().slice(0, 10);
    signups.push({ date: d, count: byDay[d] || 0 });
  }

  const emails = {};
  for (const r of emailRows) emails[r.kind] = r.c;

  // Recent accounts for the table.
  const recent = [...users]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 100)
    .map((u) => ({
      email: u.email,
      status: eff(u),
      plan: u.plan || null,
      createdAt: u.created_at,
      trialEndsAt: u.trial_ends_at,
      daysLeft: Math.max(0, Math.ceil((u.trial_ends_at - t) / DAY)),
      amountINR: eff(u) === 'active' ? Math.round(inrValue(u)) : 0,
      paidAt: u.paid_at || null,
    }));

  return json({
    workEmailPipeline: workEmailPipeline(users, { nowMs:t, annualListPriceINR:INR_PRICE, excludedEmails:env.PIPELINE_EXCLUDED_EMAILS, excludedDomains:env.PIPELINE_EXCLUDED_DOMAINS }),
    generatedAt: t,
    usdInr,
    totals: {
      totalTrials,
      activeTrials,
      expiredUnpaid,
      paid,
      conversionPct,
      trialChurnPct,
      revenueINR: Math.round(revenueINR),   // realised ARR (annual plans)
      arrINR: Math.round(revenueINR),        // same, all plans are annual
      pipelineINR: activeTrials * INR_PRICE, // in-trial, if all convert
    },
    // Opens/replies are not tracked yet (needs ZeptoMail open tracking + a
    // webhook); we report what was actually sent.
    emailsSent: emails,
    signups,
    recent,
  });
}
