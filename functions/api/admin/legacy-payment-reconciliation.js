import { isReconciliationCursor } from '../../_shared/legacy-payment-reconciliation.js';
import { json, requireAdmin } from '../../_shared/util.js';

const headers = {Vary: 'Cookie'};
const pageSize = 100;

export async function onRequestGet({request, env}) {
  try {
    const gate = await requireAdmin(request, env);
    if (gate.response) return json({error: 'unauthorized'}, gate.response.status, headers);

    const after = new URL(request.url).searchParams.get('after') ?? '';
    if (after && !isReconciliationCursor(after)) return json({error: 'invalid_cursor'}, 400, headers);
    const result = await env.DB.prepare(`SELECT q.review_key, q.payment_id, q.event_type, q.reason, q.amount, q.currency, q.received_at,
        q.conflict_amount, q.conflict_currency, q.conflict_at, q.review_version
      FROM legacy_payment_reconciliation q
      WHERE q.review_key > ? AND q.resolved_at IS NULL
        AND (q.conflict_at IS NOT NULL OR q.reason IN ('unexpected_success', 'link_validation_failed') OR (
          NOT EXISTS (SELECT 1 FROM payment_ledger p
            WHERE p.payment_id = q.payment_id AND p.amount = q.amount AND p.currency = q.currency)
          AND NOT EXISTS (SELECT 1 FROM legacy_payment_ids p WHERE p.payment_id = q.payment_id)
        ))
      ORDER BY q.review_key LIMIT ?`).bind(after, pageSize + 1).all();
    if (!result.success) return json({error: 'reconciliation_unavailable'}, 503, headers);
    const events = result.results.slice(0, pageSize);
    const next = result.results.length > pageSize ? events.at(-1).review_key : null;
    return json({events, next}, 200, headers);
  } catch {
    return json({error: 'reconciliation_unavailable'}, 503, headers);
  }
}
