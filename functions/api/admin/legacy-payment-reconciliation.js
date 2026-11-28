import { isReconciliationPaymentId } from '../../_shared/legacy-payment-reconciliation.js';
import { json, requireAdmin } from '../../_shared/util.js';

const headers = {'Cache-Control': 'private, no-store', Vary: 'Cookie'};
const pageSize = 100;

export async function onRequestGet({request, env}) {
  try {
    const gate = await requireAdmin(request, env);
    if (gate.response) return json({error: 'unauthorized'}, gate.response.status, headers);

    const after = new URL(request.url).searchParams.get('after') ?? '';
    if (after && !isReconciliationPaymentId(after)) return json({error: 'invalid_cursor'}, 400, headers);
    const result = await env.DB.prepare(`SELECT q.payment_id, q.event_type, q.amount, q.currency, q.received_at
      FROM legacy_payment_reconciliation q
      WHERE q.payment_id > ? AND q.resolved_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM payment_ledger p WHERE p.payment_id = q.payment_id)
        AND NOT EXISTS (SELECT 1 FROM legacy_payment_ids p WHERE p.payment_id = q.payment_id)
      ORDER BY q.payment_id LIMIT ?`).bind(after, pageSize + 1).all();
    if (!result.success) return json({error: 'reconciliation_unavailable'}, 503, headers);
    const events = result.results.slice(0, pageSize);
    const next = result.results.length > pageSize ? events.at(-1).payment_id : null;
    return json({events, next}, 200, headers);
  } catch {
    return json({error: 'reconciliation_unavailable'}, 503, headers);
  }
}
