// Pricing checks: node tests/pricing.test.mjs
import assert from 'node:assert/strict';
import { quote, fromPrice, FROM, LOWEST_FROM, retailFromCost, costFor } from '../flow/pricing.js';

const p = (style, family, w, h, lining) => quote({ style, family, width: w, height: h, lining }).price;

// From prices (24 x 24), computed from the formula.
assert.equal(FROM.roller, 209); assert.equal(FROM.roman, 259); assert.equal(FROM.woven, 269); assert.equal(FROM.zebra, 239);
assert.equal(LOWEST_FROM, 209);
// Typical window, 36 x 60.
assert.equal(p('roller', 'Daylight Weave', 36, 60), 229);
assert.equal(p('roman', 'Raw Linen', 36, 60), 329);   // 9.25 * 15 sq ft = 138.75 cost -> 319.13 -> 329
assert.equal(p('roman', 'Natural Reed', 36, 60), 399);
assert.equal(p('zebra', 'Twin Light', 36, 60), 259);
// Lining +10% on Romans; folds don't change price (not an input).
assert.equal(p('roman', 'Raw Linen', 36, 60, true), retailFromCost(138.75 * 1.1));
// Rounding: always ends in 9 and never below cost * 2.3.
for (const [s, f] of [['roller', 'x'], ['roman', 'Raw Linen'], ['roman', 'Natural Reed'], ['zebra', 'x']])
  for (let w = 12; w <= 96; w += 7) for (let h = 12; h <= 120; h += 11) {
    const q = p(s, f, w, h), c = costFor({ style: s, family: f, width: w, height: h });
    assert.equal(q % 10, 9); assert.ok(q >= c * 2.3, `${s} ${w}x${h}`); assert.ok(q >= 149);
  }
// Limits.
assert.equal(quote({ style: 'roller', width: 97, height: 60 }).outOfRange, true);
assert.equal(quote({ style: 'roller', width: 36, height: 121 }).outOfRange, true);
assert.equal(quote({ style: 'roller', width: 11, height: 60 }).outOfRange, true);
assert.equal(quote({ style: 'zebra', width: 36, height: 60 }).estimate, true);
console.log('pricing ok', FROM, { roller: p('roller', '', 36, 60), roman: p('roman', 'Raw Linen', 36, 60), woven: p('roman', 'Natural Reed', 36, 60), zebra: p('zebra', '', 36, 60) });
