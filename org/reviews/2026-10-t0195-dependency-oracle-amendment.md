---
summary: Exact historical dependency-pin additions required by the approved Node test harness
type: review
tags: [testing, oracle-amendment]
---

# T-0195 development dependency pin amendment proposal

The first unchanged-tree full gate passes lint and typechecking, then stops
at three ordinary dependency-map matcher failures:9,067 other cases pass,
nine existing skips remain. Receipt:
`tmp/t0195-full-gate-1791361888563/gate/summary.json`. The worker teardown
warning remains unresolved; it is not an additional passing assurance.

The approved default-Node configuration and its independent docblock oracle
need direct development declarations of `jest-environment-node`30.3.0 and
`jest-docblock`30.2.0. Both versions were already installed and resolved.
The npm producer adds only these two root-map entries in package.json and
package-lock.json. No installed package version or runtime dependency changes.
The unchanged Knip scope previously reported the missing direct declarations.

The three historical acceptance files below hold complete direct maps and
therefore correctly report these unrecorded additions. Each original task
T0175,T0176,T0177 is ruled R3. Preserve their records and originals. Under
Q015, a different author must perform the amendment, with operator authority
where the R3 charter applies.

| File | Exact amendment |
| --- | --- |
| tests/unit/t0175-dependency-proposals.test.ts | Add two exact entries to the expected development map only. |
| tests/unit/t0176-visual-dependency-proposals.test.ts | Add the same two exact entries to the expected development map only. |
| tests/unit/t0177-knip-proposal.test.ts | Add the same two exact entries to the expected development map only. |

The inserted entries are `"jest-docblock": "30.2.0"` and
`"jest-environment-node": "30.3.0"`. Keep every existing range, expected
runtime map, root lock agreement, resolved-version assertion, test name,
timeout, coverage floor and source contract. Do not filter either new key
out of the actual maps or normalise arbitrary versions. The new exact pins
must fail if either declaration drifts.

Before adoption: record old/new LF hashes, preserve originals and byte-exact
inverse; prove all historical names/assertions unchanged apart from the two
new expected entries per file; run the affected dependency cohort and exact
new-key drift mutants, with ordinary matcher failures and zero infrastructure
errors. A separate reviewer adopts the amendment. Then rerun the complete
gate on the finished unchanged tree, followed by committed sweep and hosted
checks. This proposal is not authority to change any other dependency or gate.

## Operator ruling, 7 October 2026

The operator selected “Authorise the six exact additions (recommended)” in
the interactive approval for this exact proposal. A separate author may now
perform only those six expected-map additions. All stated preservation and
independent verification requirements remain. This does not authorise other
dependency changes, gate weakening, historical task edits or releases.

## Amendment author receipt, 7 October 2026

Date: 2026-10-07T08:46:50.279Z. Author: Codex separate oracle-amendment author, operator-dispatched 7 October 2026. Author session: 01a1158a-4c7a-72d1-bbac-cad61c7f299c.
Authoriser: operator, recorded above under “Operator ruling, 7 October 2026”, and the direct operator dispatch for this lane. This session authors only the historical expected-map amendment; independent adoption remains pending.

Reason: the approved harness requires the two already resolved direct development declarations. Scope: exactly six literal expected-map additions across T-0175, T-0176 and T-0177. Each expected map adds `"jest-docblock": "30.2.0"` and `"jest-environment-node": "30.3.0"`. Existing pins, actual maps, filters, runtime assertions, names and timeouts are unchanged. No implementation, package, baseline, task record or other lane file was edited by this author. No commit or full gate was run.

| File | Old LF SHA-256 | New LF SHA-256 | Original name declarations / expect calls / matcher calls |
| --- | --- | --- | --- |
| tests/unit/t0175-dependency-proposals.test.ts | ebcea96241e7e1b5be8b220cfbe4f8a083b34b8d51864e17c5ec11433558f1ea | 7f2e6f41f0ed63491ca62e05da126f9ddc3c479bfca694e07ed78dfdcf576521 | 8 / 15 / 15 |
| tests/unit/t0176-visual-dependency-proposals.test.ts | cd74cefc4c726d5fdf7b2f795db145575e7b009bb0244a8039c6248958464b9e | 4312e0f0f3636776973d4a0e505efb1170a64a79cbd3d371441ab4991311f1b6 | 9 / 19 / 19 |
| tests/unit/t0177-knip-proposal.test.ts | 45d7448c4e3120bc1dd857c8f903929698af98db0a2547fc59e07424eef7b8b8 | 9654904647f89b70ba1dcff5aef27dc17b4061e24746b760b10e10fb0f8a66eb | 7 / 15 / 15 |

Before editing, byte originals were preserved under `tmp/t0195-dependency-amendment-proof/originals/`. Removing only the two additions in each file recovers its original bytes exactly. Parsed ASTs are identical after removing those additions; each added property is independently checked to belong to the development-map `toEqual` expected object. The patch has six added lines and zero removed lines. Full original names and counts are in `amendment.json`.

Validation ran on v24.21.0, using the pinned tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe. The actual working root and unchanged root Jest configuration executed all three dependency files: 21 passed, zero failed, zero skipped, zero runtime errors, exit 0, including the native Knip JSON baseline assertion. Child environment is allowlisted Windows infrastructure with owned PS_DATA_DIR, HERMES_HOME, home and temp; no operator provider variables were forwarded.

The owned-copy positive control executes four existing range tests: 4 passed, exit 0. For each new key, changing only its direct range to `0.0.0` in owned manifest and root-lock copies yields exactly three ordinary `toEqual` matcher failures and one unchanged production-map pass, exit 1. Both mutant runs have zero runtime errors. The 17 remaining cases are explicitly deselected only in these bounded controls, with the full 21-case live cohort separately observed. The existing `readDependencyOracleFiles` helper is mocked only by the owned proof setup to read those copies; root test source and package files are never mutated during proof. Root byte hashes before and after proof agree.

The first sandbox launch failed before test execution with `EPERM ... realpath ... temp`; it is retained as infrastructure evidence in `sandbox-infrastructure.stderr.log`. The explicit approved execution completed the proofs above. This failure is not counted as oracle red.

Proofs: `tmp/t0195-dependency-amendment-proof/amendment.json`, `runs.json`, `root-preservation.json`, the four `*.results.json` reports and corresponding logs. Reviewable patch: `tmp/t0195-dependency-amendment-proof/six-additions.patch`. Proof producers are retained in the same owned directory.

The earlier full-gate red (three expected-map failures with 9,067 other passes) and the 15 new controls are coordinator evidence described in the proposal/operator dispatch, not rerun by this amendment lane. This receipt provides bounded amendment authorship evidence only. Separate reviewer adoption, full gate, committed sweep and hosted acceptance remain outside this lane.
