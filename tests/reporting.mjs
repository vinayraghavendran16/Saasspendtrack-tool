import assert from 'node:assert/strict';
import {financialReport} from '../functions/_shared/financial-report.js';
import {csvCell} from '../functions/_shared/report-csv.js';
const rows=financialReport([{effective_date:'2026-04-01',currency:'USD',kind:'invoice',amount_minor:100},{effective_date:'2026-04-02',currency:'USD',kind:'credit',amount_minor:20},{effective_date:'2026-04-02',currency:'USD',kind:'budget',amount_minor:90}],{start:'2026-04-01',end:'2026-06-30',grain:'quarter',fiscalStartMonth:4});
assert.deepEqual(rows,[{bucket:'FY2026-Q1',currency:'USD',actualMinor:'80',budgetMinor:'90',varianceMinor:'-10'}]);
assert.equal(csvCell('=1+1'),'"\'=1+1"');
assert.equal(csvCell('a"b'),'"a""b"');
console.log('3 reporting assertions passed');
