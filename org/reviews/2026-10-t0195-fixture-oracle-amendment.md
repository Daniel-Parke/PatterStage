---
summary: Narrow R2 proposal to consolidate two frozen census fixtures below the unchanged duplication ceiling
type: review
tags: [testing, oracle-amendment]
---

# T-0195 shared capture fixture proposal

The candidate has 4,812 repeated test-window lines. The committed closing
oracle ceiling remains 4,800. Both new lifecycle cases duplicate the same
owned Git, environment and process setup. This proposal removes that actual
duplication; it does not change the ceiling, format the detector away or
weaken either case.

An independent author other than Sartre or Mill may move only the shared
fixture into `tests/helpers/comment-census-fixture.ts` and adapt the two
consumers: `test-comment-census-history.test.ts` and
`test-comment-census-pending-capture.test.ts`. Keep their two test names,
every behaviour assertion, timeouts, source/HEAD/baseline preservation,
environment isolation, process failure handling and Git checks. The other
13 frozen controls are excluded. The production checker is excluded.

Before adoption, preserve originals, record old/new LF hashes and author and
authoriser, prove identical runtime names and passing original/new controls,
and execute the same HEAD-recapture and overwrite mutants with ordinary
matcher failures. Measure net lines and repeated windows. The coordinator
must not amend either frozen case. R2 independent REVIEWER authorisation
under Q-015 precedes the amendment; whole-batch acceptance remains pending.


## Append-only amendment entry: shared capture fixture, 7 October 2026

Reason: remove the actual repeated Git/environment/process fixture from the
two frozen capture lifecycle tests. The unchanged census reported 4,812
repeated test-window lines, above the fixed C4 ceiling of 4,800. No detector,
ceiling or baseline amendment is part of this change.

Author: independent ORACLE session `01a1156f-7c0f-7bf0-a078-806432b01ebb`, lane
`T-0195-fixture-oracle-author`, separate from the coordinator, Sartre and Mill.
Authoriser: Gauss, independent REVIEWER, 7 October 2026, under Q-015, as
explicitly relayed by the operator in this session before any source edits.
This entry records authorised authorship and observed proofs. Different-author
review by Gauss and whole-batch acceptance remain pending; no self-approval.
Proof completed at `2026-10-07T08:24:19.332Z` on root HEAD
`db48bb19b263562a091c0592165d2dc7c40e0f08`, using Node `v24.21.0` from the pinned build runtime.

Only `tests/helpers/comment-census-fixture.ts` (new), the two consumers
below and this amendment receipt are authored. The helper returns one held
fixture object. It preserves the existing helper/baseline paths, exact
`tmp/t0195-history-` and `tmp/t0195-pending-capture-` prefixes, the
checkout/home/temp/data/Hermes directories, environment allowlist, Git
configuration and status checks, process error/signal/null-status handling,
respective lifecycle error labels, and 30,000 ms child-process deadlines.
Both case deadlines remain 30,000 ms. The lifecycle test bodies retain every
behaviour assertion, capture reason and source/HEAD/baseline witness. Only
fixture identifier references and imports change outside the extracted setup.

### Frozen hashes and original byte provenance

The byte SHA256 and LF SHA256 are equal for each original and amendment.

| File | Old SHA256 | New SHA256 |
| --- | --- | --- |
| `tests/unit/test-comment-census-history.test.ts` | `76bad628f5f75455e634f35df46ecfb694e2216675d8d9966b48c3613c1b9542` | `0ab598c5fddf93f31f6666e713e446813b1ca7650cc194e97442241e6bffbb9c` |
| `tests/unit/test-comment-census-pending-capture.test.ts` | `e554e76c044c44e7744048255d2465217babce9a363dabadab185d358d0b2580` | `2a87f709b7fc148fa64c1dc119b3c6d13c624fff47ccfac8111f48ed86bdfe1c` |
| `tests/helpers/comment-census-fixture.ts` | New file | `ffdbc340fa31d5ad8f1c8e72eac0152dd6369948647d478e91e70198a26802f8` |

Original history bytes match Git
`609ca8d0879f22a742192ee1451669ed220dfccc`; original pending-capture
bytes match Git `db48bb19b263562a091c0592165d2dc7c40e0f08`.
Original filesystem bytes, corresponding Git bytes and inverse-reconstructed
bytes are retained in `tmp/t0195-fixture-amendment-20261007/originals/`.
The exact inversion recipe in `inverse.json` reconstructs both original
files byte for byte from their amended source. Specialising the actual shared
helper for each lifecycle reconstructs each original extracted setup exactly.
These properties were executed and checked, rather than inferred from a diff.

### Executed controls and measured reduction

Before and after, the two actual root tests both pass: 2/2 cases, 2/2 suites,
exit 0, zero runtime-error suites, no pending or interrupted cases. Their
unchanged full runtime identities and executed assertion counts are:

- `refuses baseline recapture after working deletion when HEAD already contains the initial capture`: 16 assertions before and after.
- `refuses baseline recapture before the initial capture is committed`: 10 assertions before and after.

The observed total is 26 assertions. The helper's existence and Git status
matchers still execute in each case. No additional cases were added. The
original 13 primary controls are untouched.

Both negative controls run only against owned checker copies with the actual
amended consumer bytes, actual owned working directories, the unchanged root
Jest configuration, and owned home/temp/PS_DATA_DIR/HERMES_HOME environments:

- HEAD guard expression replaced with literal `false`: exit 1, 1/1 ordinary `toEqual` matcher failure, zero runtime-error suites. Owned mutant LF SHA256 `367172ca4f3c16ab4288c279a13e28dad0755e4e677fe0fbaaef1f31bf9147e1`.
- One exact `flag: 'wx'` replaced with `flag: 'w'`: exit 1, 1/1 ordinary `toEqual` matcher failure, zero runtime-error suites. Owned mutant LF SHA256 `a016a80164211bb6ee3b91243a8c439415ff7bd0b567894b4af4776bac1129bd`.

The HEAD mutant reports `refused: false` and `recreated: true`, with
unchanged HEAD. The overwrite mutant reports `refused: false` and
`baselineUnchanged: false`, with `sourceUnchanged: true` and unchanged
HEAD. Each execution selects exactly its one intended case. No root
implementation mutation occurred. Root checker byte/LF SHA256 remains
`13acba79408d82a9114272f0771a9460d463b076b53d93546717aaa649b04f1e`.

The existing `scripts/tooling/line-census.mjs --report` reports:

| Measure | Before | After | Net change |
| --- | ---: | ---: | ---: |
| Total test lines | 155012 | 154991 | -21 |
| Repeated test-window lines | 4812 | 4768 | -44 |
| Lines across the two consumers and new helper | 117 | 96 | -21 |

The measured 4,768 repeated lines are 32 below the unchanged 4,800 ceiling.
The shared helper is included in the census. Every other census measure is
unchanged. The pre-existing working baseline's held rise to 4,812 is preserved;
this author did not edit any baseline, task, configuration or excluded file.
Focused ESLint and the repository's test TypeScript check both exit 0.

### Retained receipts and verification boundary

All proof files are ignored under
`tmp/t0195-fixture-amendment-20261007/`. `before.json`, `after.json`,
`inverse.json`, `before-census.json`, `after-census.json`,
`before-green.results.json`, `after-green.results.json`,
`head-guard-mutant-red.results.json` and
`overwrite-mutant-red.results.json` hold the counts, identities, hashes,
ordinary matcher details and dates. Matching stdout/stderr logs and the
owned checker/test copies remain available. `proof-manifest.json` holds
their hashes. `prove.cjs`, `extract.cjs`, `after.cjs` and
`receipt.cjs` preserve the executed proof procedure.

The initial sandbox invocation failed before test execution on owned-temp
`realpath` access; `sandbox-attempt.*.log` preserves that failure. The
successful controls used approved filesystem access. Earlier owned-copy
preparation/configuration failures are not counted as test evidence. The
successful mutation receipts contain zero runtime-error suites. No zero-test
selection is counted as success.

Before/after root hashes identify only the two consumers and the new helper
as changed before this receipt append. The primary controls, root checker,
configuration, task, census implementation and baseline retain their original
bytes. No commit or broader gate was run by this author. The coordinator may
integrate after the independent review and complete its required full gate.

## Provenance correction, 7 October 2026

The phrase "relayed by the operator" in the amendment entry is inaccurate.
Gauss gave R2 REVIEWER authority; the coordinator relayed that authority to
the separate author. There was no additional human ruling for this R2
amendment. Original receipts and hashes remain preserved. Gauss subsequently
adopted the exact receipt at SHA-256
`3ec3d098fefeddb75bab0a222b12113b84635e07d8ce4ee893027bf77f03d998`.
That adoption covers the two cases and shared fixture only. Whole-batch
gate, sweep and hosted acceptance remain separate obligations.
