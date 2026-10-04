---
summary: Independent classification of two evidence hashes detected by hosted secret scanning
type: review
tags: [refactor, security, verification]
---

# T-0192 secret-scan findings

The first hosted candidate, `0705653877e89110ae1a01eb9ccd9d17d699bf53`,
failed both secret-scan workflows. Preserve PR run 37176065983 and push run
37176062927 as failed runs. The initial full-history step found two matches;
the later action scan and planted-secret control did not run on that candidate.

The unchanged, digest-pinned Gitleaks 8.30.1 container reproduced both findings
with default rules and `--redact=100`. Its repository mount was read-only and
network access was disabled. The structured local report is
`tmp/t0192-secret-scan/redacted.json`. Local history included 1,894
scanner-reported commits; hosted history included 1,840. These different ref
scopes are not interchangeable whole-history coverage claims.

Independent reviewer Laplace inspected both introducing-revision entries in
`reconciliation.evidenceSha256` without printing their candidate values:

- Line 2056 is the SHA-256 of `docs/reference/api.md`. It reproduces from
  both the referenced file and its introducing-commit Git blob.
- Line 2080 is the SHA-256 of the owned, untracked Jest receipt
  `tmp/t0192-final-api-docs.json`, which records 13 passed tests and no failures.

Both are proven non-secret evidence digests. The permitted correction adds
only these historical fingerprints to the existing exact exception list:

```text
0705653877e89110ae1a01eb9ccd9d17d699bf53:org/reviews/2026-10-t0192-dispositions.json:generic-api-key:2056
0705653877e89110ae1a01eb9ccd9d17d699bf53:org/reviews/2026-10-t0192-dispositions.json:generic-api-key:2080
```

The original ten entries, scanner version, default rules, history selection
and canary remain unchanged. Q-015 permits a different author to amend the
closed oracle's exact count from ten to twelve and add explicit membership
assertions for these two reviewed findings. All three test identities and
existing assertions remain. This is a coordinator transcription of Laplace's
independent classification and amendment authority, not an operator ruling.

The independent amendment by Nash preserves all three identities. Its SHA-256
changed from `f603b56bcee0301ba7140b54ba0f7b3c7123832740d6cdcd0bce40ebf3886fde`
to `c72bdaf72c1f0e3200b6f4c3b2d688366e20a654476e727ee58fab83195369d4`.
Laplace accepted the exact bytes. Commit `4e991581` records the causal red:
one failure and two passes before the two exceptions were added. Receipt:
`tmp/t0192-scan-oracle-1791087278792/receipt.json`.

After adding the two exceptions, both scanner contract suites passed all
seven tests. The pinned full-history scanner exited zero over 1,895
scanner-reported commits and produced an empty structured report at
`tmp/t0192-secret-scan/corrected.json`. The unchanged canary passed its clean
control and rejected its planted history secret. Original rules and all ten
earlier exceptions remain unchanged. Fresh exact-head hosted acceptance is
still required.

## Separate hosted runtime failure

The first candidate also failed `build-test-ubuntu` and `build-test-macos`.
Both failures comprised the same 23 cases in `tooling-env-contract.test.ts`.
CI used Node 20.20.2. The isolated harness relied on native TypeScript loading
and `node:module.registerHooks`, which that runtime does not provide. Other
849 suites passed on each platform. The PR's other nine jobs passed, including
full browser acceptance. No hosted failure was retried or hidden.

Under Q-015, Nash independently corrected the fixture execution mechanism.
Copied TypeScript is transpiled to ESM with the existing compiler. An ESM
loader substitutes an owned boundary module which observes environment state
in the application thread. A separate CommonJS interception retains the eager
`createRequire` control. Application modules remain absent, paths remain
confined and database construction remains forbidden. No production code,
CI Node version, timeout, skip, test input or assertion changed.

This proves ordering before application-module evaluation, not necessarily
before ESM resolution. The CommonJS interception uses an internal Node API;
cross-version execution evidence remains necessary. All 48 identities and
all six negative controls remain. Node 24 passed 48/48 before and after;
the same corrected file passed 48/48 on checksum-verified Node 20.20.2.
Focused lint and test type checks passed. Receipts are under
`tmp/t0192-portable-oracle-1791087657841/`; original failed hosted logs are
`tmp/t0192-ubuntu-failure.log` and `tmp/t0192-macos-failure.log`.

The stopped-author candidate SHA-256 is
`305b347b4129de22c793d768fcb8b9e5ad83135eabacf9bbf0dc25ddd2024588`.
Laplace accepted those exact bytes after inspecting both runtime reports.
The subsequent full coordinator gate passed all ten stages with 8,819 unit
and 497 browser passes, the existing nine unit and 24 browser skips, both
database-purity controls and both censuses. Receipt:
`tmp/t0192-coordinator-gate-1791088201270/gate/summary.json`.
Its before/after tree stamp is identical:
`3cf31330a49f62edda2ed962de84081e6b4269ba6a21129cacd9376181aa7979`.
The census records 56 additional test lines with a written reason; production
counts, repeated windows and fixed targets are unchanged. A fresh committed
sweep and exact-head hosted results remain required.
