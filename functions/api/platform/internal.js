import { requirePlatformOwner } from '../../_shared/platform-owner.js';
import { internalBundle } from '../../_shared/platform-internal-bundle.js';

export async function onRequestGet({ request, env }) {
  const gate = await requirePlatformOwner(request, env);
  if (gate.response) return gate.response;
  return new Response(internalBundle, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin'
    }
  });
}
