---
summary: Proposed independent R2 amendment for the approved default-Node test policy
type: review
tags: [testing, oracle-amendment]
---

# Default-Node configuration pin amendment

Status: proposed; no frozen file changed. T-0195 is ruled R2. Q-015 and the
ORACLE charter require a different author and independent REVIEWER authority.

The approved tests-06 batch changes the single Next-wrapped Jest default from
`jest-environment-jsdom` to `jest-environment-node`. The independent inventory
names33 implicit DOM exceptions. All existing pragmas, worker/coverage settings,
Next transforms and module mappings stay for the initial cohort.

`tests/unit/dependency-hygiene-contract.test.ts` pins the complete executable
Jest configuration to historical SHA256
`3188e6c3935b640ba58aa02c2ebc32913b41ac5ef5eb9dd9b74563942a9a6ba0`.
Its current historicalConfig normalises only the separately accepted Next
environment-registry expression. The Jest default change necessarily violates
that closed pin.

The proposed separate author may reconstruct only the exact single
testEnvironment property value `jest-environment-node` back to its historical
`jest-environment-jsdom` value before printing/hashing Jest configuration.
Keep both historical hashes, all existing names/assertions/timeouts and the
Next normalisation unchanged. Do not normalise any other executable change or
accept arbitrary environment strings, multiple declarations or computed keys.

An independently authored T-0195 behaviour control must hold the actual resolved
Node default and DOM exceptions. The amendment therefore preserves unrelated
configuration integrity while the new oracle holds the separately ruled change.

Before acceptance, demonstrate original-byte reconstruction of the amended
oracle, identical old test names/assertions, the exact authorised Node change
passing, and representative unrelated config mutations still failing. Record
old/new LF hashes, author, reviewer authorisation and date here. The coordinator
must not perform this amendment. No coverage floor, worker count, skip or
timing bound is changed.

## Append-only acceptance entry, 7 October 2026

Review completed at `2026-10-07T08:04:17.972Z` by independent REVIEWER
session `01a11561-9af7-79a3-af99-449e18bec1b8`. This entry completes the
interrupted evidence hand-off. The proposal above is retained as history;
the bounded verdict below supersedes its proposed status for these exact
amendments only.

The entry opened against dirty `dev@1007f576c9ada2c7b307748cdd283e7b4e646430`.
During review, the coordinator committed the additive red regression at
`609ca8d0879f22a742192ee1451669ed220dfccc`. The verification receipt binds
the observed files to that head and the saved 4 October execution evidence.
The reviewer changed only this canonical record and ignored proof receipts.
Lane renewal and task/provenance integration remain coordinator actions.

### Amendment 1: exact configuration pin

- Reason: tests-06 authorises the single Next-wrapped default Node route.
  The canonical Verify's former jsdom-default wording was stale. The
  historical executable-configuration pin must retain all unrelated checks.
- Change: normalise only the single literal identifier property
  `testEnvironment: "jest-environment-node"` to its historical jsdom value
  before printing and hashing. The existing Next normalisation and both
  historical pins remain unchanged.
- File: `tests/unit/dependency-hygiene-contract.test.ts`.
- Original author: Sartre, independent configuration author,
  session `01a10947-2849-7361-bd5d-25a73751268b`.
- Author date: `2026-10-04T23:39:25.694Z`, from `author.json`.
- Authoriser: Parfit, independent R2 REVIEWER,
  session `01a107e1-5ba0-7703-ab13-e23e640dc10b`; exact authorisation
  recorded on T-0195 at `2026-10-04T23:15:31.295777+00:00`.
- Old byte and LF SHA256:
  `c867fe930a8b3c7ffbf89fb35154b1f8604107a95a795bd5d2b0b0793dce80ef`.
- New byte and LF SHA256:
  `c34619b81dc9516d3dca7d9d18bcde14e5ec76803e5ef7c8c538b5f62635b98c`.
- Acceptance date: 7 October 2026. Authority is independent R2 review;
  no human ruling or operator approval is claimed.

`original.bin` and `inverse.bin` are byte-identical. Removing the exact
saved `insertion.bin` from the amended file recovers those bytes and the
Git original at `d1cfc3de4c5320c4223b71e59c96aab8f960e9fc`. All source
outside `historicalConfig` is identical. All 12 runtime test names and
assertion expressions are retained: 13 test/describe calls, 31 `expect`
sites and zero deadline properties. The identity SHA256 remains
`32c60e486846982dccc2fbb21c4fcedb74b5265c93673eb07a7728a611e6b3b7`.

The 7 October verifier re-executed the saved normalisation property checks.
Historical jsdom and the exact literal Node change reproduce Jest pin
`3188e6c3935b640ba58aa02c2ebc32913b41ac5ef5eb9dd9b74563942a9a6ba0`.
The original oracle rejects the Node change. Next normalisation remains
identical with pin
`e23ed9b1da7b58096fe62681503d75b8eb802c1a024b0c2d52afcaea9a66ab36`.
All 26 representative mutations are rejected. These cover duplicate,
computed, arbitrary and nonliteral environment declarations; unrelated
worker, coverage, mapping, setup, match, ignore, export and property edits;
and an unrelated Next environment expression.

Saved Jest receipts from 4 October were inspected and cross-checked against
their summaries and unchanged test identities. These are saved execution
results, not fresh 7 October Jest runs:

| Saved run | Exit | Passed | Failed | Runtime errors |
| --- | ---: | ---: | ---: | ---: |
| `historical-original` | 0 | 12 | 0 | 0 |
| `node-original-red` | 1 | 11 | 1 | 0 |
| `node-amended` | 0 | 12 | 0 | 0 |
| `duplicate-node` | 1 | 11 | 1 | 0 |
| `computed-literal` | 1 | 11 | 1 | 0 |
| `arbitrary-environment` | 1 | 11 | 1 | 0 |
| `unrelated-worker-count` | 1 | 11 | 1 | 0 |
| `unrelated-module-mapping` | 1 | 11 | 1 | 0 |
| `live-node` | 0 | 12 | 0 | 0 |

Every failing case above is the executable Jest configuration pin's `toBe`
matcher. No case was pending or interrupted. The saved real Next-resolved
configurations differ only in jsdom versus Node after fixture paths are
canonicalised. Recomputed invariant SHA256:
`6113f996e7bb21448497f9c583508a994541e57951c1114375e0c7bcace76247`.
This resolved snapshot comparison does not establish current whole-suite
environment acceptance.

### Amendment 2: leading Node pragma only

- Reason: the independent 12-case harness oracle needs Node globals in its
  own process while it exercises the default and explicit DOM child controls.
- Change: prepend exactly `/** @jest-environment node */` followed by LF.
  No previous source, assertion, name or child configuration changes.
- File: `tests/unit/test-harness-policy.test.ts`.
- Original author: Sartre,
  session `01a10947-2849-7361-bd5d-25a73751268b`.
- Author date: `2026-10-04T23:47:29.925Z`, from `docblock-proof.json`.
- Authoriser: Parfit, independent R2 REVIEWER. The coordinator relayed the
  independent reviewer's exact-scope authority; the operator's 7 October
  resume instruction confirms this provenance correction.
- Old byte and LF SHA256:
  `0c2bdfb4f08d12d6c2b2fe8c7cba69a929c609454ae262badbedea093651ac4b`.
- New byte and LF SHA256:
  `383a0bb8ed5d29ad8ed3bb8233335089e2d00ec990b175a7057387d2df3f8b55`.
- Acceptance date: 7 October 2026, under independent R2 reviewer authority.

`docblock-original.bin` and `docblock-inverse.bin` are byte-identical.
Removing only the exact prefix from the current file recovers the original.
All 12 names, 60 `expect` sites and child configurations remain identical.
Recomputed identity SHA256:
`babd27ab485698bffb7d61b84d950d61b062d31f068db2c0e2ef853bf597f2e2`.
The first docblock resolves to `node`. The saved claims snapshot hash
matches its receipt. Freeze the exact new hash above; the coordinator must
append the task provenance update while retaining the original freeze.

Provenance repair: the raw `docblock-proof.json` authoriser text says
`relayed explicitly by operator in this chat`. That relay attribution is
incorrect. The coordinator relayed Parfit's independent REVIEWER authority.
Retain the original raw receipt unchanged and record this correction beside
it. Neither the raw wording nor this correction constitutes an operator
approval or human ruling. Retained raw receipt SHA256:
`4333d31779638867491eef6518d529f4a4dd849670c99f388698ddee46847fbc`.

### Additive freeze: committed-baseline recapture control

Parfit's independent R2 authorisation in the oracle brief permits Sartre's
additional ordinary matcher regression before the coordinator implements
the HEAD-existence guard. This is an additive control. The existing initial
capture, overwrite and normal HEAD checking questions remain live.

- File: `tests/unit/test-comment-census-history.test.ts`.
- Author: Sartre, original independent author session
  `01a10947-2849-7361-bd5d-25a73751268b`, per the resumed authorship hand-off.
- Authorisation: Parfit, independent R2 REVIEWER; exact scope is recorded in
  `org/briefs/T-0195-oracle.md`. No separate authorisation timestamp is
  invented for this addition.
- Exact single test name:
  `refuses baseline recapture after working deletion when HEAD already contains the initial capture`.
- Frozen byte and LF SHA256:
  `76bad628f5f75455e634f35df46ecfb694e2216675d8d9966b48c3613c1b9542`.
- Saved red execution start: `2026-10-04T23:50:09.957Z`.
- Independent freeze/acceptance date: 7 October 2026.
- Coordinator red commit observed during review:
  `609ca8d0879f22a742192ee1451669ed220dfccc`, containing this file only.

The current and committed source bytes match the saved fixture and the
saved red run's source-map content. `history-red.results.json` records
one executed invocation, one failed case, zero passes, zero pending cases,
zero runtime-error suites and no interruption. The sole failure is `toEqual`:
the producer allowed recapture (`refused: false`) and recreated the deleted
working file (`recreated: true`). The expected result is refusal without
recreation. Both actual and expected fixture HEAD are
`a3582f41fa433b366567c5aa1d5f87c723b265b9`.

Before that matcher, the test establishes successful initial capture, a
baseline committed in the owned fixture, a new planted essay, normal check
refusal against HEAD, absence of the deleted working baseline, preservation
of the committed baseline bytes and preservation of the essay. Thus the red
is the recapture defect, not a missing module or a normal-check bypass.
The separate helper-absent control also executes one matcher failure with
zero runtime-error suites. Its evidence is distinct from the defect red.

Preserved red helper LF SHA256:
`a580bcfcb67108acdb417a35aa5ce7aab8d521fd4e6291a8a127d17d16544047`.
The helper has since changed in the coordinator's lane. This review does
not rerun or accept that repair; the saved red remains bound to the saved
helper bytes. The coordinator must validate the unchanged frozen regression
after the guard and complete the required wider gates.

### Bounded verdict and proof locations

**PASS-WITH-REPAIRS** for the exact configuration-pin amendment, the
prefix-only oracle amendment and the additive executed-red history control.
The repair is the truthful relay attribution recorded above. No gate was
repaired or weakened by this reviewer. This verdict accepts the amended
oracle evidence and additive freeze only. It does not accept the helper
implementation, all T-0195 work, hosted checks, product or release readiness.

All original receipts and original/inverse bytes are retained in
`tmp/t0195-config-oracle-proof/`. Relevant proofs are `author.json`,
`proof.json`, `jest-proof.json`, `jest-live-proof.json`, `resolved-proof.json`,
`docblock-proof.json`, `history-red.results.json`, `helper-absent.results.json`
and their saved byte fixtures. The history red receipt SHA256 is
`72d2ac461aca68f90ac5fc834e411529cf7e285ac031a32cf91939e157349e51`.

New ignored verification files:
`tmp/t0195-config-oracle-proof/review-acceptance-20261007.cjs` and
`tmp/t0195-config-oracle-proof/review-acceptance-20261007.json`.
The verifier exited 0 on 7 October. It recomputed bytes, inverses, identities,
26 mutation properties, resolved-snapshot equivalence and saved execution
receipt consistency without changing original evidence or source files.
The JSON receipt records hashes for every retained original proof and has
SHA256 `d7620b13981668685c6628c6498516d88a6827d80fbfa6016f1bfb93f9e2fa82`.

## Additive authoring entry: pending capture, 7 October 2026

The operator extended this sidecar's scope to one separate capture-once
control. The renewed second-lane claim includes only the new test and this
record. The author switched to ORACLE for this addition. The completed
REVIEWER verdict above applies to Sartre's earlier work only; independent
acceptance of this author's new test remains for a different reviewer.

- File: `tests/unit/test-comment-census-pending-capture.test.ts`.
- Exact single case:
  `refuses baseline recapture before the initial capture is committed`.
- Author session: `01a11561-9af7-79a3-af99-449e18bec1b8`.
- Authoring proof date: `2026-10-07T08:08:58.130Z`.
- Byte and LF SHA256 freeze:
  `e554e76c044c44e7744048255d2465217babce9a363dabadab185d358d0b2580`.
- Authority: the operator's explicit 7 October additive-test instruction
  within the existing R2 capture-once contract. This records authorship and
  the freeze, not self-acceptance or whole-implementation approval.

The fixture commits initial source only. It captures the baseline once,
proves that HEAD contains no baseline, plants an essay and retries capture
without any intervening Git commit. Capture must refuse while preserving
the original baseline bytes, both source files and HEAD. This observes the
pending-capture lifecycle that the committed-baseline HEAD guard cannot
substitute for. All existing frozen controls remain unchanged.

Two exact one-case executions completed using owned data and explicit
working directories. The live main configuration selected and passed the
case: exit 0, one pass, zero failures and zero runtime errors. The owned
helper copy changes exactly one `flag: 'wx'` to `flag: 'w'`; that execution
exited 1 with one ordinary `toEqual` matcher failure, zero passes and zero
runtime errors. The mutant allowed recapture and changed the baseline bytes.
Source bytes and HEAD remained equal to their expected values. Neither
execution was pending or interrupted. The live helper and test bytes were
unchanged throughout the proof.

Live helper LF SHA256:
`13acba79408d82a9114272f0771a9460d463b076b53d93546717aaa649b04f1e`.
Owned mutated helper LF SHA256:
`a016a80164211bb6ee3b91243a8c439415ff7bd0b567894b4af4776bac1129bd`.
The production helper was not changed by this author. This proof does not
claim that the committed nine-entry mutation sweep or full gate has run.

Proofs in `tmp/t0195-config-oracle-proof/`:
`pending-capture-proof-20261007.cjs`, `pending-capture-proof-20261007.json`,
`pending-capture-live-green.results.json`,
`pending-capture-w-mutant-red.results.json` and their stdout/stderr logs.
The first sandbox attempt failed before test execution because access to
the owned temporary directory was denied. Its logs are retained as
`pending-capture-sandbox-attempt.*.log`; it is not counted as test evidence.
The successful controls ran outside that filesystem sandbox. No zero-test
selection is claimed as success.

The author committed only the new test at
`db48bb19b263562a091c0592165d2dc7c40e0f08` after observing both controls.
The commit message records green 1/1, matcher red 1/1, zero runtime errors,
the freeze and the different-reviewer acceptance boundary. This canonical
record remains available to the coordinator for its separate record commit.
The pending-capture JSON receipt SHA256 is
`2679ef5d4e6f36bb7dd644fa6280ed72f6855f11572ccf6a56be8c2684c3edf2`.
The green result SHA256 is
`de348ad8ced3bbade69af02311ec049650a4508ecc9ef3b81da3a9a8539340af`;
the mutant-red result SHA256 is
`c7033e5cdec55de68871736cd815af519a1618659d6850e34bb117ddb62ed9d6`.
