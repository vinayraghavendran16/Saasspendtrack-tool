// GET /api/cron/tick?token=CRON_SECRET
// Idempotent cadence runner. Call it hourly (Cloudflare cron worker or any
// scheduler). Each email kind is sent at most once per user via email_log.
import { json, unauthorized, now, DAY, safeEqual } from '../../_shared/util.js';
import { sendEmail, nudgeEmail, expiredEmail } from '../../_shared/email.js';

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!env.CRON_SECRET || !safeEqual(token, env.CRON_SECRET)) return unauthorized();

  // Keep external cadence delivery disabled until durable claims are deployed.
  const cadenceEnabled = env.TRIAL_CADENCE_ENABLED === 'true';
  const appUrl = (env.APP_URL || 'https://app.saasspendtrack.com').replace(/\/$/, '');
  const payUrl = `${appUrl}/#pricing`;
  const t = now();
  const sent = { day2: 0, day4: 0, day6: 0, expired: 0 };

  // Users still on a trial track (cap the batch so a run stays quick).
  const { results = [] } = await env.DB.prepare(
    "SELECT * FROM users WHERE status IN ('trial','expired') AND (paid_at IS NULL) LIMIT 500",
  ).all();

  for (const u of results) {
    const logged = new Set(
      ((await env.DB.prepare('SELECT kind FROM email_log WHERE email=?').bind(u.email).all())
        .results || []).map((r) => r.kind),
    );

    if (t >= u.trial_ends_at) {
      if (u.status !== 'expired') {
        const changed = await env.DB.prepare("UPDATE users SET status=? WHERE email=? AND status='trial' AND paid_at IS NULL AND trial_ends_at<=?").bind('expired', u.email,t).run();
        if(changed.meta?.changes!==1) continue;
      }
      if (cadenceEnabled && !logged.has('expired')) {
        const m = expiredEmail(payUrl);
        if ((await sendEmail(env, { to: u.email, subject: m.subject, html: m.html })).ok) {
          await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)')
            .bind(u.email, 'expired', t).run();
          sent.expired++;
        }
      }
      continue;
    }

    const daysLeft = Math.ceil((u.trial_ends_at - t) / DAY);
    const elapsed = t - u.created_at;

    // Priority order: imminent expiry first, then earlier nudges. One per run.
    let kind = null;
    if (daysLeft <= 1 && !logged.has('day6')) kind = 'day6';
    else if (elapsed >= 4 * DAY && daysLeft >= 2 && !logged.has('day4')) kind = 'day4';
    else if (elapsed >= 2 * DAY && daysLeft >= 3 && !logged.has('day2')) kind = 'day2';
    if (!kind || !cadenceEnabled) continue;

    const m = nudgeEmail(kind, payUrl, appUrl);
    if ((await sendEmail(env, { to: u.email, subject: m.subject, html: m.html })).ok) {
      await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)')
        .bind(u.email, kind, t).run();
      sent[kind]++;
    }
  }

  // Bound deletion work per tick. Missing analytics schema must not interrupt mail.
  let usagePurged = null;
  if (env.USAGE_RETENTION_ENABLED === 'true') try {
    const result = await env.DB.prepare(
      'DELETE FROM usage_events WHERE id IN (SELECT id FROM usage_events WHERE occurred_at < ? ORDER BY occurred_at LIMIT 5000)'
    ).bind(t - 90 * DAY).run();
    usagePurged = result.meta?.changes ?? null;
  } catch (_) { console.warn('Usage retention cleanup unavailable'); }
  return json({ ok: true, scanned: results.length, sent, usagePurged });
}
