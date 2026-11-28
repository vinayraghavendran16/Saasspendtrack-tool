import { authAppUrl } from '../../_shared/auth-url.js';
// POST /api/account/invite  { email, role }
// Owner/Admin invites a teammate into their account. Enforces the 50-member cap
// (active members + pending invites), one-account-per-member, and rate limits.
// Sends a single-use magic-link invite. On hitting the cap, alerts the operator.
import {
  json, badRequest, normalizeEmail, randomToken, sha256Hex, now, DAY,
  rateLimit, requireRole, getMembership, countAccountMembers, countPendingInvites, workspaceMemberCap,
} from '../../_shared/util.js';
import { sendEmail, inviteEmail, memberCapEmail } from '../../_shared/email.js';

export async function onRequestPost({ request, env }) {
  const gate = await requireRole(request, env, 'admin');
  if (gate.response) return gate.response;
  const { user, membership } = gate;
  const accountId = membership.account_id;

  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }
  const email = normalizeEmail(body.email);
  if (!email) return badRequest('valid email required');
  // Only member or admin can be invited; a second owner is never provisioned here.
  let role = (body.role || 'member').toString();
  if (role !== 'member' && role !== 'admin') role = 'member';
  if (email === normalizeEmail(user.email)) {
    return json({ ok: false, error: 'self', message: 'That is your own email.' }, 400);
  }

  const rl = await rateLimit(env, 'invite:' + accountId, 30, 3600000, { failClosed: true });
  if (!rl.ok) return json({ ok: false, error: 'rate_limited', message: 'Too many invites. Try again shortly.' }, 429);

  // One account per member.
  const existing = await getMembership(env, email);
  if (existing) {
    if (existing.account_id === accountId) return json({ ok: true, already: true, message: 'Already a member of this workspace.' });
    return json({ ok: false, error: 'other_account', message: 'That email already belongs to another workspace.' }, 409);
  }

  // 50-member cap: active members + pending invites.
  const memberLimit = await workspaceMemberCap(env, accountId);
  const used = memberLimit === null ? 0 :
    await countAccountMembers(env, accountId) + await countPendingInvites(env, accountId);
  if (memberLimit !== null && used >= memberLimit) {
    const notify = (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean)[0];
    const cap = memberCapEmail(accountId, user.email);
    try { if (notify) await sendEmail(env, { to: notify, subject: cap.subject, html: cap.html }); } catch (_) {}
    return json({ ok: false, error: 'member_cap', message: `This workspace is at the ${memberLimit}-member limit. Contact us to raise it.` }, 403);
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const t = now();
  // Re-check the seat cap in the INSERT itself. Concurrent requests can both
  // pass the earlier user-friendly count check; only the serialized SQL write
  // may reserve the last available pending-invitation slot.
  const inserted = await env.DB.prepare(
    `INSERT INTO invites (token_hash, account_id, email, role, invited_by, expires_at, used, created_at)
     SELECT ?,?,?,?,?,?,0,?
     WHERE (SELECT COUNT(*) FROM memberships WHERE account_id=? AND status='active')
         + (SELECT COUNT(*) FROM invites WHERE account_id=? AND used=0 AND expires_at>?) < ?
     RETURNING token_hash`,
  ).bind(tokenHash, accountId, email, role, user.email, t + 7 * DAY, t,
    accountId, accountId, t, memberLimit ?? Number.MAX_SAFE_INTEGER).first();
  if (!inserted) {
    return json({ ok: false, error: 'member_cap', message: 'This workspace has no available seats. Contact us to raise the limit.' }, 403);
  }

  const appUrl = authAppUrl(request, env);
  const link = `${appUrl}/api/account/accept?token=${token}`;
  const mail = inviteEmail(link, user.email);
  const sent = await sendEmail(env, { to: email, subject: mail.subject, html: mail.html });

  return json({ ok: true, invited: email, role, emailed: sent.ok !== false });
}
