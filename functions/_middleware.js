// Enforce same-origin browser mutations across the API surface.
const SERVER_TO_SERVER = new Set([
  '/api/razorpay/webhook',
  '/api/rb2b/ingest',
  '/api/cron/payment-notifications',
]);
export async function onRequest({ request, next }) {
  const method = request.method.toUpperCase();
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/') && ['POST','PUT','PATCH','DELETE'].includes(method) && !SERVER_TO_SERVER.has(path)) {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== new URL(request.url).origin) {
      return new Response(JSON.stringify({ error: 'invalid_origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' },
      });
    }
  }
  return next();
}
