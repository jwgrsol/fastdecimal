# fastdecimal

English | [한국어](./README.ko.md)

BigInt-powered drop-in replacement for [big.js](https://github.com/MikeMcl/big.js) — faster on every operand size, smaller, and verified against big.js's own test suite.

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

- **Instance own-property shape.** A big.js instance stores `{s, e, c}` as plain own properties; a fastdecimal instance stores `{s, _coef, _scale}` and derives `c`/`e` via prototype accessors. Property *access* (`x.c`, `x.e = 5`) is fully compatible, but code that enumerates instances directly behaves differently:
  - `{ ...x }`, `Object.assign({}, x)`, `Object.keys(x)`
  - `x.hasOwnProperty('c')` (`false` here, `true` in big.js)
  - deep-equality helpers (e.g. lodash `isEqual`) comparing a fastdecimal instance against a big.js instance
- Internal instance fields (`sign`, `coefficient`, `scale`) are implementation details and may change in any release.
- **Intentional divergence — termination over faithfulness:** upstream big.js can hang forever (a non-converging Newton iteration) on `sqrt` when the result's exponent sits far below `-DP` (e.g. `Big.DP = 3; new Big('9.75e-19').sqrt()`). fastdecimal terminates with a capped estimate instead. Every input on which big.js terminates produces the identical result.

**Before migrating**, check your codebase for instance spreads and `hasOwnProperty('c'|'e')` on Big values — if there are none (the overwhelmingly common case), swapping the import is all you need. Use `x.eq(y)` for value comparison and `x.toJSON()` / `x.toString()` for serialization; these work identically in both libraries.

## Benchmarks

Run `yarn bench` to reproduce the full operation × operand-size matrix against big.js on your machine; results are written to [bench/RESULTS.md](./bench/RESULTS.md). Highlights (Node 24, 500-digit operands): `times` ~870×, `pow` ~1800×, `div` ~440×, `sqrt` ~156× faster. Known trade-off: `round` on operands above ~20 digits runs at 0.4–0.8× of big.js — truncation is nearly free on its digit-array representation, while the BigInt representation must pay for a real division. Every other measured operation is faster, and `round` still exceeds a million calls per second at every size.

## License

[MIT](./LICENSE)
