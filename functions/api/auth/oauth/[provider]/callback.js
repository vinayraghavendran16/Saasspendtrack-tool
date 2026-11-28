import { authAppUrl } from '../../../../_shared/auth-url.js';
import { clearOAuthBrowser, consumeOAuthAttempt, oauthRedirect, providerConfig } from '../../../../_shared/oauth.js';
import { validateIdToken } from '../../../../_shared/oidc.js';
import { sessionStorageId } from '../../../../_shared/session-token.js';
import { DAY, SESSION_DAYS, getAccountContext, getUserFromSession, json, now, parseCookies, randomToken, sessionCookie } from '../../../../_shared/util.js';

export async function onRequestGet({request, env, params}) {
  const provider = params.provider;
  const config = providerConfig(env, provider);
  if (env.OAUTH_ENABLED !== 'true' || !config) return json({error: 'oauth_unavailable'}, 404);
  const url = new URL(request.url);
  const origin = authAppUrl(request, env);
  if (url.origin !== origin) return json({error: 'invalid_origin'}, 403);
  const finish = status => oauthRedirect(origin + '/?auth=' + status, clearOAuthBrowser);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  try {
    const linking = state.startsWith('link.');
    const user = linking ? await getUserFromSession(request, env) : null;
    if (linking && (!user || !await getAccountContext(env, user))) return finish('oauth_error');
    const attempt = await consumeOAuthAttempt(request, env, provider, state);
    if (!attempt || !code || code.length > 4096 || url.searchParams.has('error')) return finish('oauth_error');
    const response = await fetch(config.token, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({grant_type: 'authorization_code', code, client_id: config.clientId,
        client_secret: config.secret, redirect_uri: attempt.redirect_uri, code_verifier: attempt.pkce_verifier})
    });
    if (!response.ok) return finish('oauth_error');
    const tokens = await response.json();
    const identity = await validateIdToken(tokens.id_token, provider, config.clientId, attempt.nonce);
    const {issuer, subject} = identity;
    const t = now();
    if (linking) {
      const sessionId = await sessionStorageId(parseCookies(request).sst_session);
      const result = await env.DB.prepare(`INSERT INTO oauth_identities (provider,issuer,subject,email,created_at)
        SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE id=? AND email=? AND expires_at>?)
        ON CONFLICT(provider,issuer,subject) DO NOTHING`)
        .bind(provider, issuer, subject, user.email, t, sessionId, user.email, t).run();
      if (!result.success) return finish('oauth_error');
    }
    const linked = await env.DB.prepare('SELECT email FROM oauth_identities WHERE provider=? AND issuer=? AND subject=?')
      .bind(provider, issuer, subject).first();
    if (linking) return finish(linked?.email === user.email ? 'oauth_linked' : 'oauth_conflict');
    if (!linked) return finish('oauth_unlinked');
    const accountUser = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(linked.email).first();
    if (!accountUser || !await getAccountContext(env, accountUser)) return finish('oauth_error');
    const sid = randomToken();
    const result = await env.DB.prepare('INSERT INTO sessions (id,email,created_at,expires_at) VALUES (?,?,?,?)')
      .bind(await sessionStorageId(sid), accountUser.email, t, t + SESSION_DAYS * DAY).run();
    if (!result.success) return finish('oauth_error');
    const redirect = oauthRedirect(origin + '/?auth=ok', sessionCookie(sid));
    redirect.headers.append('Set-Cookie', clearOAuthBrowser);
    return redirect;
  } catch {
    return finish('oauth_error');
  }
}
