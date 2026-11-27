// V1: generic server-side CLM proxy is disabled pending outbound integration security review.
export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: false, error: "feature_unavailable", message: "Direct CLM API sync is not available in this release. Use contract upload or CSV import." }), {
    status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
export async function onRequestOptions() {
  return new Response(null, { status: 405, headers: { "Cache-Control": "no-store" } });
}
