---
summary: Narrow independent amendments exposed by the first complete gate
type: review
tags: [testing, governance]
---

# T0194/T0207 gate amendment proposal

Status: authorised by Daniel Parke on 2026-10-04. Independent amendments must
retain the exact bounds below. Implementation acceptance remains pending.

The unchanged full gate at57aad470 plus the recorded source overlay passed
lint/typecheck, then stopped at Jest:42 failures,9009 passes,9 existing skips,
12 failed suites. Tree hashes match before/after. Receipt:
tmp/t0194-final-gate-1791144096936/gate/summary.json. The run is red, not accepted.

The following narrow changes adapt retained gates to already accepted designs.
Different authors implement them and record original/new hashes, exact retained
test names/assertions, author, authoriser and date. No timeout or coverage floor
changes, deletion, skip, broad scan exception or production fallback is allowed.

| Files | Exact permitted change |
| --- | --- |
| b4-emits-research-composer.test.ts | Supply the missing empty private-receipt seam for its repository doubles; retain29 names/80 assertions and SQLite refusal behaviour. |
| a-hil-gate-asks-the-human.test.ts; the-artifact-is-the-work-not-the-critique.test.ts | Supply the accepted private Composer transport receipt; use real terminal persistence and awaited cleanup at fixture settlement. Retain15 names/36 assertions and gate/artifact semantics. |
| t0163-bootstrap-credentials.test.ts | Update the synthetic supported Node version and guard-command recogniser. Keep restrictive creation/existing-file/umask/secret-disclosure assertions. T0207's separate13 controls preserve unsupported-version refusal. |
| release-jest-worker-budget.test.ts | Copy the new pure env module required by the fixture's real next.config.ts. Keep every worker-budget assertion, name and deadline. |
| dependency-hygiene-contract.test.ts | For next.config.ts only, reconstruct the original inline alias expression and omit its new env import before the existing printer/hash comparison. Require that exact recognised import/call shape. Keep both original expected hashes and every unrelated config statement. The independent14-case cohort separately proves alias semantics/purity. |
| t0175-dependency-proposals.test.ts; t0176-visual-dependency-proposals.test.ts; t0177-knip-proposal.test.ts | Add exactly the accepted Undici8.11.2 dependency to their exhaustive expectations. Every previous dependency range, lockfile and scan assertion remains. No generic future-dependency exemption. |
| k3-a-closed-record-keeps-its-spelling.test.ts | Permit only the two accepted Hermes module destinations in the move-map precondition and form aliases from src/ correctly, including @/modules/hermes/. Retain all historical-record and protected-path checks. Add an anti-vacuity control if needed; never rewrite a closed record. |
| subsystems-route-and-panel.test.tsx | Isolate the route's unexercised sync import in its existing mocked summary fixture so jsdom does not load the server transport. Keep every response and panel assertion. No universal Web-API shim. |

All paths above are under tests/unit/. Independent reviewers must reject any
amendment that hides a real product failure or changes the named contracts.
The original failing run remains; after focused green checks the entire gate
runs again from the beginning. No partial success replaces full-gate evidence.

Separate implementation fixes need no oracle amendment: restore the required
root-purpose comment, add accepted ADR0018/19/20 to the public index, and address
newly exposed unused exports without loosening Knip. This proposal does not
authorise any baseline growth or a change to protected governance.

Authority requirement: org/roles/ORACLE.md says a non-implementer authors an
amendment, authorised by a REVIEWER atR2 and by the operator atR3. The K3 oracle
is R3 and this joint landing is R3, so operator authorisation is requested.
