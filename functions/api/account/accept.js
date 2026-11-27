import { sessionStorageId } from '../../_shared/session-token.js';
import { recordUsage } from '../../_shared/usage.js';
import { authAppUrl } from '../../_shared/auth-url.js';
// GET /api/account/accept?token=...
// Accept a single-use invite with an atomic D1 batch. No session cookie is
// issued unless both the membership and token redemption were committed.
import {
  sha256Hex, randomToken, now, SESSION_DAYS, sessionCookie,
  normalizeEmail, countAccountMembers, MAX_MEMBERS,
} from '../../_shared/util.js';

function redirect(location, cookie) {
  const headers = { Location: location, 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const appUrl = authAppUrl(request, env);
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return redirect(`${appUrl}/?invite=invalid`);

  const tokenHash = await sha256Hex(token);
  const t = now();
  const inv = await env.DB.prepare('SELECT * FROM invites WHERE token_hash=?').bind(tokenHash).first();
  if (!inv || inv.used || inv.expires_at <= t) return redirect(`${appUrl}/?invite=expired`);
  const email = normalizeEmail(inv.email);
  if (!email || !['member', 'admin'].includes(inv.role)) return redirect(`${appUrl}/?invite=invalid`);

  // One account per member: refuse reassignment, and do not downgrade owners.
  const existing = await env.DB.prepare('SELECT * FROM memberships WHERE email=?').bind(email).first();
  if (existing && existing.account_id !== inv.account_id) return redirect(`${appUrl}/?invite=other_account`);
  if (existing && existing.role === 'owner') return redirect(`${appUrl}/?invite=invalid`);
  // Suspended members being reactivated consume a seat, unlike active members.
  if (!existing || existing.status !== 'active') {
    const count = await countAccountMembers(env, inv.account_id);
    if (count >= MAX_MEMBERS) return redirect(`${appUrl}/?invite=full`);
  }

  // Never fabricate a fresh trial if an invited account has no valid owner.
  const account = await env.DB.prepare('SELECT * FROM accounts WHERE id=?')
    .bind(inv.account_id).first();
  if (!account || !normalizeEmail(account.owner_email)) return redirect(`${appUrl}/?invite=invalid`);
  const owner = await env.DB.prepare('SELECT * FROM users WHERE email=?')
    .bind(normalizeEmail(account.owner_email)).first();
  if (!owner) return redirect(`${appUrl}/?invite=invalid`);

  const sid = randomToken(32);
  const storedSid = await sessionStorageId(sid);
  try {
    // D1.batch executes sequentially inside one transaction. The second
    // statement uses SQLite changes() to make a failed concurrent redemption
    // a NOT NULL constraint error, rolling back the entire batch.
    // The final statement similarly rolls back if membership activation was
    // blocked by a cross-account conflict or the seat cap.
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE invites SET used=1 WHERE token_hash=? AND used=0 AND expires_at>?
          AND EXISTS (SELECT 1 FROM memberships AS actor
            WHERE actor.email=invites.invited_by AND actor.account_id=invites.account_id
              AND actor.status='active'
              AND (actor.role='owner' OR (actor.role='admin' AND invites.role='member')))
          AND EXISTS (SELECT 1 FROM accounts a JOIN memberships m
            ON m.email=a.owner_email AND m.account_id=a.id
            WHERE a.id=invites.account_id AND m.status='active' AND m.role='owner')
          RETURNING token_hash`,
      ).bind(tokenHash, t),
      env.DB.prepare(
        `INSERT INTO sessions (id, email, created_at, expires_at)
         VALUES (?,?,?,CASE WHEN changes()=1 THEN ? ELSE NULL END)`,
      ).bind(storedSid, email, t, t + SESSION_DAYS * 86400000),
      env.DB.prepare(
        'INSERT OR IGNORE INTO users (email, created_at, trial_ends_at, status, plan) VALUES (?,?,?,?,?)',
      ).bind(email, t, t, 'expired', null),
      env.DB.prepare(
        `INSERT INTO memberships (email, account_id, role, status, invited_by, created_at)
         SELECT ?,?,?, 'active', ?,?
         WHERE (SELECT COUNT(*) FROM memberships WHERE account_id=? AND status='active') < ?
            OR EXISTS (SELECT 1 FROM memberships WHERE email=? AND account_id=? AND status='active')
         ON CONFLICT(email) DO UPDATE SET
           role=excluded.role, status='active'
         WHERE memberships.account_id=excluded.account_id AND memberships.role!='owner'`,
      ).bind(email, inv.account_id, inv.role, inv.invited_by, t,
        inv.account_id, MAX_MEMBERS, email, inv.account_id),
      env.DB.prepare(
        `UPDATE sessions SET expires_at=CASE WHEN EXISTS (
           SELECT 1 FROM memberships WHERE email=? AND account_id=? AND status='active' AND role=?
         ) THEN expires_at ELSE NULL END WHERE id=?`,
      ).bind(email, inv.account_id, inv.role, storedSid),
    ]);
    if (!results[0]?.results?.length) return redirect(`${appUrl}/?invite=expired`);
  } catch (_) {
    // A failed transaction does not consume the token. Concurrent replays
    // may find it already consumed by the winning transaction.
    const latest = await env.DB.prepare('SELECT used FROM invites WHERE token_hash=?')
      .bind(tokenHash).first().catch(() => null);
    return redirect(`${appUrl}/?invite=${latest?.used ? 'expired' : 'error'}`);
  }

  await recordUsage(env, {accountId:inv.account_id,email,eventName:'invite_accepted',eventId:tokenHash});
  await recordUsage(env, {accountId:inv.account_id,email,eventName:'login',eventId:randomToken(32)});
  return redirect(`${appUrl}/?invite=ok`, sessionCookie(sid));
}
