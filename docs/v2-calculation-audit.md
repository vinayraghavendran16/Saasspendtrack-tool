# Calculation audit
Source: V2 base index.html blob 07c1fc3e24c3f72d8fc4881db94632f57502562e.
- annualCost delegates to monthlyCost times 12. rptAnnual multiplies monthly by 12 but treats every other cycle as annual. Quarterly 300 yields 1200 versus 300. Confirmed conflict in this snapshot; check frozen V1 before runtime fix.
- monthlySpendOf delegates to monthlyCost but its fallback supports only yearly and quarterly explicitly; eliminate fallback after parity.
- consumption uses utilized seats; buildSavings uses assigned seats, skips zero assigned via truthiness. Distinguish unassigned from unused and unknown; do not sum both.
- buildSavings labels full annual renewal exposure as savings; exposure is not a realized benefit. Category overlap is a candidate, not proven substitutability.
- spendForVendor estimates historical windows from current run rate. Label estimates, never call them actual spend.
- workspaceCurrency formats a selected currency; formatting is not FX conversion. currencyGroup separates original currencies in review.
No runtime changes. Add golden fixtures and compare all consumers before replacement.
