const providers = new Set(['zeptomail','resend','invalid']);
const outcomes = new Set(['accepted','no_token','invalid_token_format','invalid_provider_endpoint','invalid_email_provider','provider_redirect','provider_rejected','timeout','redirect_rejected','timeout_unsupported','transport_error','unknown_failure']);

export function summarizeEmailHealth(rows) {
  if (!Array.isArray(rows) || rows.length > 100) throw new Error('invalid_health_rows');
  const result = new Map();
  for (const row of rows) {
    if (!providers.has(row?.provider) || !outcomes.has(row?.outcome) || !Number.isSafeInteger(row?.count) || row.count < 0) throw new Error('invalid_health_row');
    const item = result.get(row.provider) || {provider:row.provider,attempts:0,accepted:0,failures:0};
    item.attempts += row.count;
    if (!Number.isSafeInteger(item.attempts)) throw new Error('invalid_health_total');
    if (row.outcome === 'accepted') item.accepted += row.count;
    else item.failures += row.count;
    result.set(row.provider,item);
  }
  return [...result.values()].map(item=>({...item,acceptanceRate:item.attempts ? item.accepted/item.attempts : null,deliveryVerified:false}));
}
