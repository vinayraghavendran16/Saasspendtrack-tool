// Pin authentication to the requested preview deployment, even when its
// inherited APP_URL names an older preview. Only this project's preview hosts
// qualify; production and other hosts continue to use the configured app URL.
export function authAppUrl(request, env) {
  const url = new URL(request.url);
  const hostname = url.hostname;
  const validHostname = hostname.length <= 253
    && hostname.split('.').every((label) => label.length > 0
      && label.length <= 63
      && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
  const trustedPreviewHost = [
    '.saasspendtrack.pages.dev',
    '.saasspendtrack-preview-us.pages.dev',
  ].some((suffix) => hostname.endsWith(suffix) && hostname.length > suffix.length);

  if (url.protocol === 'https:' && !url.username && !url.password && !url.port
    && validHostname && trustedPreviewHost) {
    return url.origin;
  }
  return (env.APP_URL || 'https://app.saasspendtrack.com').replace(/\/$/, '');
}
