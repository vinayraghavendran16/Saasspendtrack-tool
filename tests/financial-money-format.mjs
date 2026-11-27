import assert from 'node:assert/strict';
import {formatMinor as f} from '../financial-money-format.js';
assert.equal(f('4950000','USD','210'),'USD 235.71');
assert.equal(f('1234','JPY'),'JPY 1,234');
assert.equal(f('1234','KWD'),'KWD 1.234');
assert.equal(f('-105','USD','2'),'USD -0.53');
assert.equal(f('9007199254740993','USD'),'USD 90,071,992,547,409.93');
assert.throws(()=>f('10','USD','0'));
console.log('financial money format passed');
