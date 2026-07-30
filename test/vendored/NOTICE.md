# Vendored test suite — provenance

The test files in this directory are an **unmodified copy** of the test suite
from [big.js](https://github.com/MikeMcl/big.js) (MIT License,
Copyright (c) Michael Mclaughlin — see `LICENCE.md` in this directory):

- `methods/*.js` — the test bodies (47,456 assertions), byte-for-byte identical
- `runner.js`, `test.js` — the original Node runner and helpers, kept for reference
  (fastdecimal uses its own runner, `../run-vendored.mjs`)

Omitted from the copy: the upstream `browser/` directory (HTML-based browser
test runners), which fastdecimal does not use.

These files are vendored deliberately: fastdecimal's correctness claim is
"passes the original big.js test suite as-is". Modifying them would invalidate
that claim, so **do not edit them** — not even formatting.
The only additions are this notice, the `LICENCE.md` copy, and `package.json`
(`{"type": "commonjs"}`, required so Node treats these legacy CJS files
correctly inside an ESM package).

Upstream: https://github.com/MikeMcl/big.js (test/ directory)
