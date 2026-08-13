# Security Policy

## Supported versions

Only the latest published version receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/jwgrsol/fastdecimal/security/advisories/new)
rather than opening a public issue. Reports are acknowledged within a week.

## Supply-chain posture

- Zero runtime dependencies; no install scripts (`postinstall` etc.).
- Releases are published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
  so every version is attested to a public commit and workflow run.
- Correctness is anchored to big.js's own vendored test suite (47,456
  assertions) plus differential testing against upstream — see CI.
