// Pin authentication to the requested preview deployment, even when its
// inherited APP_URL names an older preview. Only this project's preview hosts
// qualify; production and other hosts continue to use the configured app URL.
export function authAppUrl(request, env) {
  const url = new URL(request.url);
  if (url.protocol === 'https:' && url.hostname.endsWith('.saasspendtrack.pages.dev')) {
    return url.origin;
  }
  return (env.APP_URL || 'https://app.saasspendtrack.com').replace(/\/$/, '');
}
