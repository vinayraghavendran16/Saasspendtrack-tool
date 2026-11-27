import {json} from './util.js';
import {ProviderError} from './razorpay-provider.js';

const statuses = new Map([
  ['invalid_checkout', 409],
  ['checkout_expired', 409],
  ['reconciliation_required', 409],
  ['provider_link_not_found_manual_review', 409],
  ['multiple_provider_links_manual_review', 409],
  ['provider_reference_mismatch', 409],
  ['provider_amount_currency_mismatch', 409],
  ['provider_customer_mismatch', 409],
  ['provider_url_invalid_manual_review', 409],
  ['provider_invalid_json', 502],
  ['provider_response_invalid', 502],
  ['provider_validation_failed', 502],
  ['provider_unsupported_currency', 502],
  ['provider_timeout', 504]
]);

export function checkoutFailure(operation, stage, correlationId, error) {
  const code = error instanceof ProviderError ? error.message
    : stage === 'database_persist' ? 'database_persistence_failure'
    : 'checkout_storage_unavailable';
  console.error(JSON.stringify({event: 'checkout_failure', operation, stage, correlationId, code}));
  return json({error: code, correlationId}, statuses.get(code) ?? 503);
}
