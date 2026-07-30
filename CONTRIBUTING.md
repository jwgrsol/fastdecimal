# Contributing to fastdecimal

Thanks for your interest! Please read this short policy before opening anything.

## Issues — very welcome

Bug reports are the lifeblood of a correctness-critical library. If you find
**any** case where fastdecimal's output differs from big.js — a value, a string
representation, the sign of zero, an error message — please open an issue with:

- the input(s) and the operation
- expected output (what big.js returns) vs actual output
- your Node/browser version

Every confirmed report becomes a permanent regression test.

## Pull requests — accepted conservatively

This library does financial arithmetic; every merged line carries a correctness
responsibility. Current policy:

- Small, focused PRs with tests are welcome. PRs without tests will not be merged.
- Every line is reviewed by the maintainer before merging. Large rewrites or
  drive-by refactors will likely be declined — open an issue first to discuss.
- **`test/vendored/` is immutable.** It is a byte-for-byte copy of the upstream
  big.js test suite and serves as the compatibility proof. PRs touching it will
  be declined (see `test/vendored/NOTICE.md`).

## The correctness spec

fastdecimal's specification is **behavioral equality with big.js** — including
string output, negative zero, exponent-notation boundaries (`NE`/`PE`), and
error messages. "Mathematically nicer" behavior that diverges from big.js is a
bug here, not an improvement.

Checks that must stay green:

```sh
yarn test            # 47,456 vendored big.js tests — must be 100%
yarn typecheck
yarn build
yarn check:exports   # attw + publint
```

## Code style

- TypeScript, comments and identifiers in English.
- Hot paths avoid allocation and megamorphic call sites; when in doubt, benchmark
  (see `../decimal-lab/bench/` in the research repo for the methodology).
