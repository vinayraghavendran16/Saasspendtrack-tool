import { authAppUrl } from '../../_shared/auth-url.js';
// GET /api/account/accept?token=...
// Validates a single-use invite, joins the invitee to the account, ensures a
// user row (inheriting the owner's entitlement so they can use the app), creates
// a session, and redirects into the app. Mirrors auth/verify.js.
import {
  sha256Hex, randomToken, now, DAY, SESSION_DAYS, TRIAL_DAYS, sessionCookie,
  normalizeEmail, countAccountMembers, MAX_MEMBERS,
} from '../../_shared/util.js';

function redirect(location, cookie) {
  const headers = { Location: location };
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

  // One account per member: refuse if they already belong elsewhere.
  const existing = await env.DB.prepare('SELECT * FROM memberships WHERE email=?').bind(email).first();
  if (existing && existing.account_id !== inv.account_id) {
    return redirect(`${appUrl}/?invite=other_account`);
  }
  // Cap re-check at accept time (invites could have outpaced the cap).
  if (!existing) {
    const count = await countAccountMembers(env, inv.account_id);
    if (count >= MAX_MEMBERS) return redirect(`${appUrl}/?invite=full`);
  }

  // Redeem exactly once even when multiple requests arrive simultaneously.
  const redeemed = await env.DB.prepare(
    'UPDATE invites SET used=1 WHERE token_hash=? AND used=0 AND expires_at>? RETURNING token_hash',
  ).bind(tokenHash, t).first();
  if (!redeemed) return redirect(`${appUrl}/?invite=expired`);

  // Ensure a user row so the member is entitled - inherit the owner's plan/status.
  const u = await env.DB.prepare('SELECT email FROM users WHERE email=?').bind(email).first();
  if (!u) {
    const account = await env.DB.prepare('SELECT * FROM accounts WHERE id=?').bind(inv.account_id).first();
    const ownerUser = account
      ? await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(account.owner_email).first()
      : null;
    const status = (ownerUser && ownerUser.status) || 'trial';
    const trialEnds = (ownerUser && ownerUser.trial_ends_at) || (t + TRIAL_DAYS * DAY);
    const plan = (ownerUser && ownerUser.plan) || null;
    await env.DB.prepare('INSERT OR IGNORE INTO users (email, created_at, trial_ends_at, status, plan) VALUES (?,?,?,?,?)')
      .bind(email, t, trialEnds, status, plan).run();
  }

  // Create or activate the membership.
  await env.DB.prepare(
    `INSERT INTO memberships (email, account_id, role, status, invited_by, created_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(email) DO UPDATE SET role=excluded.role, status='active' WHERE memberships.account_id=excluded.account_id`,
  ).bind(email, inv.account_id, inv.role, 'active', inv.invited_by, t).run();

  // A conflicting membership must never be silently reassigned to this account.
  const confirmed = await env.DB.prepare('SELECT account_id, status FROM memberships WHERE email=?').bind(email).first();
  if (!confirmed || confirmed.account_id !== inv.account_id || confirmed.status !== 'active') {
    return redirect(`${appUrl}/?invite=other_account`);
  }

  // Sign them in.
  const sid = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (id, email, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(sid, email, t, t + SESSION_DAYS * DAY).run();

  return redirect(`${appUrl}/?invite=ok`, sessionCookie(sid));
}
