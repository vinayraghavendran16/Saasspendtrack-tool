// GET /api/cron/tick?token=CRON_SECRET
// Idempotent cadence runner. Call it hourly (Cloudflare cron worker or any
// scheduler). Durable claims suppress repeat provider attempts; acceptance is not inbox delivery.
import { json, unauthorized, now, DAY, safeEqual } from '../../_shared/util.js';
import { claimTrialDelivery, finishTrialDelivery } from '../../_shared/trial-delivery-claims.js';
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
  async function deliver(email,kind,m){
    const id=await claimTrialDelivery(env.DB,email,kind,now());
    if(!id)return;
    const outcome=await sendEmail(env,{to:email,subject:m.subject,html:m.html});
    if(!await finishTrialDelivery(env.DB,email,kind,id,outcome.ok===true,now()))throw Error('delivery_claim_changed');
    if(outcome.ok===true){
      await env.DB.prepare('INSERT OR IGNORE INTO email_log (email, kind, sent_at) VALUES (?,?,?)').bind(email,kind,now()).run();
      sent[kind]++;
    }
  }

  // Users still on a trial track (cap the batch so a run stays quick).
  const { results = [] } = await env.DB.prepare(
    cadenceEnabled
      ? "SELECT * FROM users WHERE paid_at IS NULL AND (status='trial' OR (status='expired' AND NOT EXISTS(SELECT 1 FROM email_log l WHERE l.email=users.email AND l.kind='expired') AND NOT EXISTS(SELECT 1 FROM trial_delivery_claims c WHERE c.email=users.email AND c.kind='expired'))) ORDER BY CASE WHEN status='trial' THEN 0 ELSE 1 END, trial_ends_at, email LIMIT 500"
      : "SELECT * FROM users WHERE status='trial' AND paid_at IS NULL AND trial_ends_at<=? ORDER BY trial_ends_at,email LIMIT 500",
  ).bind(...(cadenceEnabled?[]:[t])).all();

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
        await deliver(u.email,'expired',m);
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
    await deliver(u.email,kind,m);
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
