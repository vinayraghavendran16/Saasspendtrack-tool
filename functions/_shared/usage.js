import { hmacSha256Hex, normalizeEmail } from './util.js';

const EVENTS = new Set(['login','workspace_created','invite_accepted','subscription_saved','contract_uploaded','extraction_completed','renewal_reviewed','ai_completed','export_completed','trial_converted','onboarding_viewed','pricing_viewed']);

// Call only after a successful authorized action, using server-derived account and actor.
// Analytics failures must not break customer operations.
export async function recordUsage(env, {accountId,email,eventName,eventId}) {
  if (!env.USAGE_HMAC_SECRET || !accountId || !normalizeEmail(email) || !EVENTS.has(eventName)) return false;
  try {
    const actorKey = await hmacSha256Hex(env.USAGE_HMAC_SECRET, JSON.stringify([accountId,normalizeEmail(email)]));
    const id = eventId ? await hmacSha256Hex(env.USAGE_HMAC_SECRET, JSON.stringify([accountId,actorKey,eventName,eventId])) : crypto.randomUUID();
    await env.DB.prepare('INSERT OR IGNORE INTO usage_events(id,account_id,actor_key,event_name,occurred_at) VALUES(?,?,?,?,?)').bind(id,accountId,actorKey,eventName,Date.now()).run();
    return true;
  } catch (_) {
    console.warn('Usage event recording unavailable');
    return false;
  }
}
