// Pure policy helper; wire into webhook only after provider catalogue verification.
export function validatePaidLink(event, catalogue) {
  if (event?.event !== 'payment_link.paid') return null;
  const link = event.payload?.payment_link?.entity;
  const payment = event.payload?.payment?.entity;
  if (!link || !payment || !Array.isArray(catalogue)) return null;
  const matches = catalogue.filter(p => p && p.linkId === link.id);
  if (matches.length !== 1) return null;
  const plan = matches[0];
  if (typeof plan.linkId !== 'string' || !plan.linkId.startsWith('plink_') ||
      !Number.isSafeInteger(plan.amount) || plan.amount <= 0 ||
      !/^[A-Z]{3}$/.test(plan.currency || '') ||
      !['founding','standard'].includes(plan.tier)) return null;
  if (link.status !== 'paid' || payment.status !== 'captured' ||
      link.currency !== plan.currency || payment.currency !== plan.currency ||
      link.amount !== plan.amount || link.amount_paid !== plan.amount ||
      payment.amount !== plan.amount ||
      typeof payment.id !== 'string' || !payment.id.startsWith('pay_')) return null;
  return { tier: plan.tier, paymentId: payment.id, linkId: link.id, amount: plan.amount, currency: plan.currency };
}
