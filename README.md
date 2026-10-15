# fastdecimal

English | [한국어](./README.ko.md)

BigInt-powered drop-in replacement for [big.js](https://github.com/MikeMcl/big.js) — dramatically faster arithmetic at every operand size, with a tree-shakable functional core, verified against big.js's own test suite.

```js
// Drop-in replacement for big.js — swap the import, keep your code
import Big from 'fastdecimal/big';

new Big('0.1').plus('0.2').toString(); // '0.3'
```

```js
// Functional core for new code — tree-shakable, only what you import is bundled
import { parse, add, toString } from 'fastdecimal';

toString(add(parse('0.1'), parse('0.2'))); // '0.3'
```

## The functional core

The root entry point is a set of pure functions over plain values — no classes,
no global settings, fully tree-shakable.

**Pick the right entry point:** if you write formulas by hand, use the
`fastdecimal/big` facade — arithmetic chains read left-to-right
(`price.times(qty).plus(fee)`), which nested function calls cannot match. The
functional core is for the other kind of caller: library authors building on
top of it, code that _generates_ operations (formula evaluators, settlement
engines), and paths where bundle size or per-call overhead dominates. A value
is:

```ts
interface PlainDecimal {
  sign: 1 | -1 | 0; // 0 only for NaN
  coefficient: bigint | null; // finite: non-negative coefficient · null: NaN / ±Infinity
  scale: number; // value = sign × coefficient × 10^scale
}
```

Values are normalized (no trailing zeros in the coefficient; zero has scale 0),
so equal numbers always have identical representations. `−0` is `{ sign: -1,
coefficient: 0n, scale: 0 }`; NaN and ±Infinity are ordinary values that
propagate through arithmetic by IEEE 754 rules — the core never throws on values.

```ts
import { parse, divToDecimalPlaces, toString } from 'fastdecimal';

const price = parse('149.99');
const people = parse('3');
toString(divToDecimalPlaces(price, people, 2, 4)); // '50' per person, HALF_UP
```

| Group                                        | Functions                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Construct                                    | `parse`, `fromParts`, `zero`, `infinity`, `nan`                                                        |
| Exact arithmetic                             | `add`, `sub`, `mul`, `powInt`, `neg`, `abs`, `cmp`                                                     |
| Rounding arithmetic (precision as arguments) | `divToDecimalPlaces`, `sqrtToDecimalPlaces`, `mod`, `roundToDecimalPlaces`, `roundToSignificantDigits` |
| Inspect / render                             | `exponentOf`, `isFinite`, `isNaN`, `isInfinite`, `isZero`, `toString`                                  |

Rounding modes are the bignumber.js/decimal.js numbering:

| #   | Mode                | #   | Mode      | #   | Mode       |
| --- | ------------------- | --- | --------- | --- | ---------- |
| 0   | UP (away from zero) | 3   | FLOOR     | 6   | HALF_EVEN  |
| 1   | DOWN (truncate)     | 4   | HALF_UP   | 7   | HALF_CEIL  |
| 2   | CEIL                | 5   | HALF_DOWN | 8   | HALF_FLOOR |

`mod` additionally accepts `9` (EUCLID: non-negative remainder). The design
rules the core follows — precision as arguments, special-value semantics, purity
— are written down in [CONTRIBUTING.md](./CONTRIBUTING.md#core-design-rules).

## Compatibility

fastdecimal aims for **100% behavioral compatibility** with big.js: same API, same results, same errors. It is not a port of big.js's code — internally it stores values as a BigInt coefficient and a scale, which is where the performance comes from. Compatibility is a property of the observable behavior, not of the implementation.

### In scope — guaranteed identical

- Every method and static property, with the same names, arities, and semantics (`plus`, `div`, `sqrt`, `round`, `toFixed`, …, `DP`, `RM`, `NE`, `PE`, `strict`, `roundDown`–`roundUp`).
- All results, digit for digit, including rounding modes and division at any `DP`.
- The public instance properties `s`, `c`, and `e` — reading **and** writing them behaves exactly as in big.js.
- Errors: the same operations throw, with the same `[big.js]` messages.
- Special values and edge cases: negative zero, `strict` mode (including bigint input), the `Big()` clone-constructor factory with independent settings.
- Verified by running big.js's complete vendored test suite (47,456 assertions, 100% passing) plus differential tests against big.js itself.

### Out of scope — documented non-goals

- **Instance own-property shape.** A big.js instance stores `{s, e, c}` as plain own properties; a fastdecimal instance stores `{sign, coefficient, scale}` and provides `s`/`c`/`e` as prototype accessors. Property _access_ (`x.s`, `x.c`, `x.e = 5`) is fully compatible, but code that enumerates instances directly behaves differently:
  - `{ ...x }`, `Object.assign({}, x)`, `Object.keys(x)`
  - `x.hasOwnProperty('c')` (`false` here, `true` in big.js)
  - deep-equality helpers (e.g. lodash `isEqual`) comparing a fastdecimal instance against a big.js instance
- Internal instance fields (`sign`, `coefficient`, `scale`) are implementation details and may change in any release.
- **Intentional divergence — termination over faithfulness:** upstream big.js can hang forever (a non-converging Newton iteration) on `sqrt` when the result's exponent sits far below `-DP` (e.g. `Big.DP = 3; new Big('9.75e-19').sqrt()`). fastdecimal terminates with a capped estimate instead. Every input on which big.js terminates produces the identical result.

**Before migrating**, check your codebase for instance spreads and `hasOwnProperty('c'|'e')` on Big values — if there are none (the overwhelmingly common case), swapping the import is all you need. Use `x.eq(y)` for value comparison and `x.toJSON()` / `x.toString()` for serialization; these work identically in both libraries.

## Benchmarks

Run `yarn bench` to reproduce the full operation × operand-size matrix against big.js on your machine; results are written to [bench/RESULTS.md](./bench/RESULTS.md). The matrix measures three ways — upstream big.js, the functional core called directly, and the facade — so the wrapper's overhead is always visible. `node bench/bundle-size.mjs` measures real bundled sizes: importing a single core function is ~0.5 KB gzipped, the full core ~2.3 KB (smaller than big.js's ~2.9 KB), while the all-or-nothing `fastdecimal/big` facade is ~3.6 KB — larger than big.js itself, the documented price of the translation layer. Highlights (Node 24, 500-digit operands): `times` ~870×, `pow` ~1800×, `div` ~440×, `sqrt` ~156× faster. Known trade-off: `round` on operands above ~20 digits runs at 0.4–0.8× of big.js — truncation is nearly free on its digit-array representation, while the BigInt representation must pay for a real division. Every other measured operation is faster, and `round` still exceeds a million calls per second at every size.

## Real-world validation

Beyond the vendored suite, fastdecimal has been validated as a drop-in `big.js`
replacement inside real projects (measured 2026-08, Apple M3, Node 24 — package-
manager-level substitution, zero source changes in the target projects):

- **Uniswap SDK monorepo** (`@uniswap/sdk-core` + dependents): the full
  workspace test run — ~2,580 tests including `toformat` prototype extension and
  rounding-mode mapping paths — produced **zero regressions** versus upstream
  big.js (the only failures were pre-existing, environment-dependent, and
  identical under both libraries).
- **Ghostfolio** (open-source wealth management, big.js in its portfolio
  calculation engine): all calculator specs pass unchanged, and the
  `computeSnapshot` hot path over a synthetic large portfolio (5,000–10,000
  activities, 10–12 years of daily data) ran **1.67–1.83× faster** end-to-end.
  CPU profiling attributes the gain to arithmetic: big.js's `div` alone was 24%
  of total CPU; fastdecimal's division path measures under 1%.

## License

[MIT](./LICENSE)
