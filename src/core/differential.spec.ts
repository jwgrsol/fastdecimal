import { describe, expect, it } from 'vitest';
import * as core from './index.ts';
import Big from '../big.ts';

/**
 * Core-vs-facade equivalence (docs/core-contract.md §8.3): seeded random inputs
 * through the core must match the big.ts facade exactly on the overlapping
 * surface. The big.js RM → core RoundingMode mapping is {0→1, 1→4, 2→6, 3→0}.
 */
const RM_MAP = [1, 4, 6, 0] as const;

let state = 0xdec1a1;
function rnd(): number {
  state |= 0; state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randomDecimal(): string {
  const intDigits = 1 + Math.floor(rnd() * 25), fracDigits = Math.floor(rnd() * 25);
  let s = rnd() < 0.5 ? '-' : '';
  for (let i = 0; i < intDigits; i++) s += Math.floor(rnd() * 10);
  if (fracDigits) { s += '.'; for (let i = 0; i < fracDigits; i++) s += Math.floor(rnd() * 10); }
  return s;
}
// Render like big.js's toString: −0 prints as "0"
const str = (x: core.DecimalValue) => core.toString(x, -7, 21, false);

describe('core matches the big.ts facade on seeded random inputs', () => {
  it('2,000 iterations across add/sub/mul/div/cmp/round', () => {
    for (let i = 0; i < 2000; i++) {
      const a = randomDecimal(), b = randomDecimal();
      const da = core.parse(a), db = core.parse(b);
      const ba = new Big(a), bb = new Big(b);
      const bigRm = Math.floor(rnd() * 4) as 0 | 1 | 2 | 3;
      const dp = Math.floor(rnd() * 30);
      Big.RM = bigRm;
      Big.DP = dp;
      const context = `a=${a} b=${b} dp=${dp} rm=${bigRm}`;
      expect(str(core.add(da, db)), `add ${context}`).toBe(ba.plus(bb).toString());
      expect(str(core.sub(da, db)), `sub ${context}`).toBe(ba.minus(bb).toString());
      expect(str(core.mul(da, db)), `mul ${context}`).toBe(ba.times(bb).toString());
      expect(core.cmp(da, db), `cmp ${context}`).toBe(ba.cmp(bb));
      expect(str(core.roundToDecimalPlaces(da, dp, RM_MAP[bigRm])), `round ${context}`)
        .toBe(ba.round(dp, bigRm).toString());
      if (bb.cmp(0) !== 0) {
        expect(str(core.divToDecimalPlaces(da, db, dp, RM_MAP[bigRm])), `div ${context}`)
          .toBe(ba.div(bb).toString());
      }
    }
    Big.DP = 20;
    Big.RM = 1;
  });
});
