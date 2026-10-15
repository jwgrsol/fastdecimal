# Contributing to fastdecimal

Thanks for your interest! Please read this short policy before opening anything.

## Architecture in one minute

```
src/core/            functional core — all arithmetic lives here
                     pure functions over plain {sign, coefficient, scale} values,
                     precision passed as arguments, rounding modes 0–8 (+ EUCLID 9),
                     one function per file with a colocated <fn>.spec.ts
src/core/_internal/  shared helpers, not part of the public API (free to change)
src/big.ts           big.js facade — ONLY the translation layer: big.js grammar,
                     error strings, constructor semantics, DP/RM/NE/PE globals,
                     the 0–3 → core rounding-mode mapping, s/c/e accessors
```

## Core design rules

The functional core (`src/core/`) is governed by the rules below. They are the
contract the facade is built on — read them before changing core semantics.
Legacy-specific behavior (error messages, rounding numbering, grammar) belongs
in the facade, never in the core.

### Principles

1. **Compatibility is a property of observable behavior.** The core does not
   follow legacy code structure. The facade reproduces the legacy library's
   observable surface — return values, error messages, public properties — exactly.
2. **Performance is the reason this library exists.** Every design choice in the
   core is validated by benchmarks. Intuition proposes; measurement decides.
   (Example: rounding by string slicing was expected to win and measured 8×
   slower — a 500-digit BigInt is only ~26 machine words, so a division is
   cheaper than a string conversion.)
3. **Tree-shaking is guaranteed by structure.** One function per export, no
   classes, no module-level side effects.

### Value representation

```ts
interface PlainDecimal {
  sign: 1 | -1 | 0; // 0 only for NaN
  coefficient: bigint | null; // finite: non-negative coefficient · null: NaN / ±Infinity
  scale: number; // value = sign × coefficient × 10^scale
  digits: number; // cached decimal digit count of `coefficient`; 0 = not computed yet
}
```

- **Normal form (invariant):** for finite values, `coefficient === 0n` implies
  `scale === 0`; otherwise `coefficient % 10n !== 0n` (trailing zeros are
  absorbed into `scale`). Equal mathematical values always have identical
  representations.
- **Special values** are encoded with `coefficient: null`, following the
  bignumber.js/decimal.js `c === null` convention:

  | Value     | sign | coefficient | scale |
  | --------- | ---- | ----------- | ----- |
  | NaN       | 0    | null        | 0     |
  | +Infinity | 1    | null        | 0     |
  | −Infinity | −1   | null        | 0     |
  | −0        | −1   | 0n          | 0     |

- **Always create all four fields, in the same order.** This keeps V8 hidden
  classes monomorphic — a measured win in the facade.
- `digits` is a lazily filled cache, not part of value identity. A producer
  sets it only when it knows the count for free; `exponentOf` fills it on first
  demand; `0` means "not computed yet". Finite core values are never mutated
  after creation, so a nonzero `digits` can never go stale.
- The sign lives outside the BigInt because BigInt has no negative zero
  (`-0n === 0n`).
- `scale` is the exponent of the _least_ significant digit, so operands can be
  aligned for arithmetic without knowing their digit counts. The leading-digit
  exponent `e` cannot be read from a BigInt without `toString()`, so it is
  derived only on demand (`exponentOf`).

### Precision as arguments

**Core functions never read global settings.** Every operation that must round
takes its precision as an argument (the Java `BigDecimal` + `MathContext`
model). Translating globals such as `Big.DP`/`Big.RM` into arguments is the
facade's job.

- Exact operations (`add`, `sub`, `mul`, `powInt` for positive exponents, `cmp`,
  `abs`, `neg`) take no precision argument and always return the exact result.
- The decimal-places model and the significant-digits model are **separate
  entry points** (`divToDecimalPlaces`/`roundToDecimalPlaces` vs
  `roundToSignificantDigits`), not one function with a mode flag: call sites
  stay monomorphic, and a facade bundles only the variants it uses.
- Inherently inexact operations (`divToDecimalPlaces`, `sqrtToDecimalPlaces`)
  require the precision argument; there is no default.

### Rounding modes

The core uses the 0–8 numbering shared by bignumber.js and decimal.js (see the
table in the README). big.js's 0–3 is a different numbering; the big.js facade
maps it (`{0→1, 1→4, 2→6, 3→0}`).

- Rounding primitives must be **sign-aware**: the CEIL/FLOOR family (2, 3, 7, 8)
  changes direction with the sign of the value. `src/core/_internal/roundUp.ts`
  implements this.
- `mod(x, y, mode)` takes bignumber.js's `MODULO_MODE` numbering: 0–8 above plus
  `9` (EUCLID, always non-negative remainder).

### Special values

- The core **propagates** NaN and ±Infinity as values, by IEEE 754 rules
  (`∞ + (−∞) = NaN`, `0 × ∞ = NaN`, `x ÷ 0 = ±∞`, …); decimal.js's behavior is
  the reference.
- The core **never throws because of a value.** Throw policy belongs to the
  facade: the big.js facade validates at its boundary and throws big.js's own
  messages before a special value can reach the core.
- The core throws only on programmer errors (an unparseable string, a wrong
  argument type or range), with neutral messages. **Legacy error strings
  (`[big.js] …`) exist only in the facade.**

### Purity

- Every core function is pure: inputs are never mutated, results are new objects.
- The only permitted internal state is caching that callers cannot observe
  (the `pow10` table, the `digits` field).
- The core never touches randomness or the clock. Anything that needs them must
  receive them as an argument.

### Facade boundary

- **Zero-conversion principle:** a facade instance carries
  `sign`/`coefficient`/`scale`/`digits` as own fields, so it structurally _is_ a
  `PlainDecimal` and flows into core functions without wrapping. Wrapping is
  prototype attachment only.
- Legacy derived properties (big.js's `c`/`e`, and `s` over `sign`) are
  prototype accessors on the facade, computed lazily. The core does not know
  they exist. The facade's property setters are the only mutation sites in the
  codebase, and they reset `digits`.
- Everything legacy-specific — input grammar, error strings, constructor
  semantics, global settings, rounding-mode numbering — lives in `src/big.ts`.
  If a change under `src/core/` mentions big.js, it is probably in the wrong layer.

### Module structure and naming

```
src/core/            one function per file, with a colocated <fn>.spec.ts
src/core/_internal/  helpers not exposed through the exports map (pow10, strip, roundUp, digitCount)
src/big.ts           the big.js facade
```

- Descriptive full-word names (`sign`, `coefficient`, `scale`, `decimalPlaces`,
  `roundingMode`); the only sanctioned abbreviations are the operation names
  listed under Code style.
- Fields of the core's plain objects carry no underscore prefix — they are a
  public data structure. Underscore-prefixed fields are reserved for private
  storage inside stateful facade instances.

### Verification gates

Every change must pass all four (commands under Tests below):

1. **Facade:** the vendored upstream big.js suite at 100%.
2. **Core:** the per-function specs, exercised directly, without going through
   the facade.
3. **Differential:** seeded random inputs compared against upstream big.js as a
   devDependency, plus the core-vs-facade equivalence spec. This layer catches
   what the upstream suite does not cover — it is how the `strict` + `bigint`
   incompatibility was found.
4. **No performance regression:** the full `bench/run.mjs` matrix. Facade
   overhead over the core must stay below measurable.

### Non-goals and reserved decisions

- Reproducing big.js's instance own-property shape is a non-goal (see the
  README's Compatibility section).
- The representation-induced disadvantage on `round` is accepted: decimal-places
  rounding costs at least one BigInt division, so 0.4–0.8× of big.js above
  ~20 digits is the documented price of the representation.
- A Number fast path for coefficients below 2^53 (Java's `intCompact` pattern)
  is reserved for a later minor version. The representation keeps it possible —
  `coefficient` stays a `bigint`, and the fast path would be an internal detail
  of each operation — but it is not part of the current core.
- decimal.js-light compatibility is not planned: truncating arithmetic and a
  different `e` semantics make it a separate semantic system.

### Why these choices

| Decision           | Choice                                 | Reason                                                                                       |
| ------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Coefficient        | binary BigInt, not decimal limbs       | A JS loop cannot beat native BigInt; decimal-limb designs are competitors in JS, not options |
| Specials           | `coefficient: null`, `sign: 0` for NaN | Matches the bignumber.js/decimal.js convention and keeps a fixed object shape                |
| Precision          | per-operation arguments                | A global context can be reproduced on top of arguments; the reverse is impossible            |
| DP vs SD rounding  | separate entry points                  | Monomorphism and tree-shaking; a facade bundles only what it needs                           |
| Rounding numbering | bignumber.js/decimal.js 0–8 + EUCLID 9 | Two libraries already share it; only big.js needs a mapping                                  |
| Errors             | neutral in the core, legacy in facades | Error messages are observable surface, so they are the facade's responsibility               |

## Issues — very welcome

Bug reports are the lifeblood of a correctness-critical library. If you find
**any** case where fastdecimal's output differs from big.js — a value, a string
representation, the sign of zero, an error message — please open an issue with:

- the input(s) and the operation
- expected output (what big.js returns) vs actual output
- your Node/browser version

Every confirmed report becomes a permanent regression test.

## The correctness spec

fastdecimal's specification is **behavioral equality with big.js** — including
string output, negative zero, exponent-notation boundaries (`NE`/`PE`), and
error messages. "Mathematically nicer" behavior that diverges from big.js is a
bug here, not an improvement.

The only exceptions are the **documented intentional divergences** listed in
the README's Compatibility section (currently: fastdecimal terminates, with a
capped estimate, on `sqrt` inputs where upstream big.js hangs forever). Adding
a new divergence requires an issue, maintainer sign-off, and a README entry —
a PR alone is not enough.

## Tests — four layers, all must stay green

```sh
yarn test          # runs the first three in order:
                   #   1. test/run-vendored.mjs  — big.js's own suite, 47,456 asserts, must be 100%
                   #   2. vitest                 — per-function core specs + test/core-vs-facade.spec.ts
                   #   3. test/differential.mjs  — fixed cases + seeded fuzzing vs upstream big.js
yarn typecheck
yarn build
yarn check:exports # attw + publint
```

- **Every core function file must have a colocated spec** (`src/core/foo.ts` →
  `src/core/foo.spec.ts`). PRs adding a core function without one will not be merged.
- Cross-cutting tests (comparing layers, checking artifacts) live under `test/`,
  named by what they verify.
- **`test/vendored/` is immutable.** It is a byte-for-byte copy of the upstream
  big.js test suite and serves as the compatibility proof. PRs touching it will
  be declined (see `test/vendored/NOTICE.md`).

## Pull requests — accepted conservatively

This library does financial arithmetic; every merged line carries a correctness
responsibility. Current policy:

- Small, focused PRs with tests are welcome. PRs without tests will not be merged.
- Every line is reviewed by the maintainer before merging. Large rewrites or
  drive-by refactors will likely be declined — open an issue first to discuss.
- Performance claims must come with `yarn bench` numbers (before/after on the
  same machine). Intuition has repeatedly lost to measurement in this codebase.

## Code style

- TypeScript, comments and identifiers in English.
- Full-word names everywhere (`coefficient`, `decimalPlaces`, `roundingMode`);
  the only sanctioned abbreviations are the operation names shared with
  `Math.*` and the decimal-library lineage (`add`, `sub`, `mul`, `div`, `cmp`,
  `neg`, `abs`, `mod`, `sqrt`, `pow`).
- Hot paths avoid allocation and megamorphic call sites; when in doubt, benchmark.
