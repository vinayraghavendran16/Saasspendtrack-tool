export function parseUsPreviewUrl(value) {
  const url = new URL(value);
  const labels = url.hostname.split('.');
  const isProjectHost = url.hostname === 'saasspendtrack-preview-us.pages.dev';
  const isDeploymentHost = labels.length === 4
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(labels[0])
    && labels.slice(1).join('.') === 'saasspendtrack-preview-us.pages.dev';

  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !(isProjectHost || isDeploymentHost)
    || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('Only the isolated US Preview Pages origin is allowed');
  }
  return url;
}
