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

The rules the core must obey are written down in **`docs/core-contract.md`** —
read it before changing core semantics. Legacy-specific behavior (error
messages, rounding numbering, grammar) belongs in the facade, never in the core.

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
