# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-08-13

Initial release.

### Added

- Functional core (`fastdecimal`): tree-shakable, dependency-free decimal
  arithmetic on a BigInt coefficient + scale representation — `parse`, `add`,
  `sub`, `mul`, `divToDecimalPlaces`, `mod`, `powInt`, `sqrtToDecimalPlaces`,
  `roundToDecimalPlaces`, `roundToSignificantDigits`, `cmp`, `abs`, `neg`,
  `exponentOf`, `toString`, predicates, and special-value constants.
- big.js-compatible facade (`fastdecimal/big`): drop-in `Big` class with the
  full big.js API — methods, static settings (`DP`/`RM`/`NE`/`PE`/`strict`),
  rounding-mode constants, `s`/`c`/`e` accessors (read and write), the clone
  constructor factory, and identical error messages.
- Verified against big.js's complete vendored test suite (47,456 assertions,
  100% passing) plus a randomized differential suite against upstream big.js.
- Dual ESM/CJS build with type definitions; Node.js >= 18.
