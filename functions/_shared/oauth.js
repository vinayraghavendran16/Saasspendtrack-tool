import { randomToken, sha256Hex, now, parseCookies } from './util.js';
import { authAppUrl } from './auth-url.js';

export function providerConfig(env, provider) {
  if (provider === 'google' && env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID, secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile'
  };
  if (provider === 'microsoft' && env.MICROSOFT_OAUTH_CLIENT_ID && env.MICROSOFT_OAUTH_CLIENT_SECRET) return {
    clientId: env.MICROSOFT_OAUTH_CLIENT_ID, secret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email profile'
  };
  return null;
}
export async function pkceChallenge(verifier) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function oauthRedirect(location, cookie) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}
export async function beginOAuth(request, env, provider) {
  const config = providerConfig(env, provider);
  if (!config || env.OAUTH_ENABLED !== 'true') throw new Error('oauth_unavailable');
  const origin = authAppUrl(request, env);
  if (new URL(request.url).origin !== origin) throw new Error('origin_mismatch');
  const redirectUri = origin + '/api/auth/oauth/callback?provider=' + provider;
  const state = randomToken(), browser = randomToken(), nonce = randomToken(), verifier = randomToken();
  const t = now();
  await env.DB.prepare('INSERT INTO oauth_attempts (state_hash, provider, browser_hash, nonce, pkce_verifier, redirect_uri, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(await sha256Hex(state), provider, await sha256Hex(browser), nonce, verifier, redirectUri, t + 600000, t).run();
  const url = new URL(config.authorize);
  url.search = new URLSearchParams({client_id:config.clientId, redirect_uri:redirectUri, response_type:'code', scope:config.scope, state, nonce, code_challenge:await pkceChallenge(verifier), code_challenge_method:'S256'}).toString();
  return oauthRedirect(url.toString(), 'sst_oauth_browser=' + browser + '; Path=/api/auth/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
}
export async function consumeOAuthAttempt(request, env, provider, state) {
  const browser = parseCookies(request).sst_oauth_browser;
  if (!/^[a-f0-9]{64}$/.test(state || '') || !/^[a-f0-9]{64}$/.test(browser || '')) return null;
  const origin = authAppUrl(request, env);
  if (new URL(request.url).origin !== origin) return null;
  const redirectUri = origin + '/api/auth/oauth/callback?provider=' + provider;
  return env.DB.prepare('DELETE FROM oauth_attempts WHERE state_hash=? AND provider=? AND browser_hash=? AND redirect_uri=? AND expires_at>? RETURNING *')
    .bind(await sha256Hex(state), provider, await sha256Hex(browser), redirectUri, now()).first();
}
