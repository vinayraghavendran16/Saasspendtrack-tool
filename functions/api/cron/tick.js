// GET /api/cron/tick?token=CRON_SECRET
// Idempotent cadence runner. Call it hourly (Cloudflare cron worker or any
// scheduler). Each email kind is sent at most once per user via email_log.
import { json, unauthorized, now, DAY, safeEqual } from '../../_shared/util.js';
import { sendEmail, trialNudgeEmail, expiredEmail } from '../../_shared/email.js';

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!env.CRON_SECRET || !safeEqual(token, env.CRON_SECRET)) return unauthorized();

  const payUrl = `${(env.APP_URL || 'https://app.saasspendtrack.com').replace(/\/$/, '')}/#pricing`;
  const t = now();
  const sent = { day3: 0, day6: 0, expired: 0 };

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
        await env.DB.prepare('UPDATE users SET status=? WHERE email=?').bind('expired', u.email).run();
      }
      if (!logged.has('expired')) {
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

    if (daysLeft <= 1 && !logged.has('day6')) {
      const m = trialNudgeEmail('day6', daysLeft, payUrl);
      if ((await sendEmail(env, { to: u.email, subject: m.subject, html: m.html })).ok) {
        await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)')
          .bind(u.email, 'day6', t).run();
        sent.day6++;
      }
    } else if (elapsed >= 3 * DAY && daysLeft >= 2 && !logged.has('day3')) {
      const m = trialNudgeEmail('day3', daysLeft, payUrl);
      if ((await sendEmail(env, { to: u.email, subject: m.subject, html: m.html })).ok) {
        await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)')
          .bind(u.email, 'day3', t).run();
        sent.day3++;
      }
    }
  }

  return json({ ok: true, scanned: results.length, sent });
}
