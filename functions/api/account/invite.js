import { authAppUrl } from '../../_shared/auth-url.js';
// POST /api/account/invite  { email, role }
// Owner/Admin invites a teammate into their account. Enforces the 50-member cap
// (active members + pending invites), one-account-per-member, and rate limits.
// Sends a single-use magic-link invite. On hitting the cap, alerts the operator.
import {
  json, badRequest, normalizeEmail, randomToken, sha256Hex, now, DAY,
  rateLimit, requireRole, getMembership, countAccountMembers, countPendingInvites, MAX_MEMBERS,
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
  const used = (await countAccountMembers(env, accountId)) + (await countPendingInvites(env, accountId));
  if (used >= MAX_MEMBERS) {
    const notify = (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean)[0];
    const cap = memberCapEmail(accountId, user.email);
    try { if (notify) await sendEmail(env, { to: notify, subject: cap.subject, html: cap.html }); } catch (_) {}
    return json({ ok: false, error: 'member_cap', message: `This workspace is at the ${MAX_MEMBERS}-member limit. Contact us to raise it.` }, 403);
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const t = now();
  await env.DB.prepare(
    'INSERT INTO invites (token_hash, account_id, email, role, invited_by, expires_at, used, created_at) VALUES (?,?,?,?,?,?,0,?)',
  ).bind(tokenHash, accountId, email, role, user.email, t + 7 * DAY, t).run();

  const appUrl = authAppUrl(request, env);
  const link = `${appUrl}/api/account/accept?token=${token}`;
  const mail = inviteEmail(link, user.email);
  const sent = await sendEmail(env, { to: email, subject: mail.subject, html: mail.html });

  return json({ ok: true, invited: email, role, emailed: sent.ok !== false });
}
