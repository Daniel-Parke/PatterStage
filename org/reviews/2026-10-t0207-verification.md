---
summary: Source-bound research DNS repair evidence and remaining acceptance work
type: review
tags: [security, testing, runtime]
---

# T0207 verification

Status: active. ADR0020 design accepted; implementation acceptance remains open.

## Independent controls and source repair

The owned DNS-rebinding probe records public admission followed by private
transport resolution and one forbidden listener hit. It accesses no operator
database or service. The independent 19-case oracle was committed in fa17377a:
ten passing controls, nine executed matcher failures, zero runtime errors.
Parfit independently reviewed its frozen bytes, causal reds and bounded limits.

The repair validates every returned address, refuses invalid/mixed results and
URL credentials, and supplies a fresh Undici Agent lookup snapshot per hop.
Original URL, Host and default HTTPS verification remain. One twelve-second
controller covers admission, redirects and response reading. Admission races
abort and removes its listener; response cancellation and dispatcher destruction
run in nested finally blocks. The native resolver may finish after cancellation,
but that result cannot authorise a connection.

The first combined run failed 14 DNS cases; it remains recorded in
`tmp/t0194-t0207-repair-green.json`. The subsequent reverse-order selection passed
20/20 in `tmp/t0194-t0207-repair-repeat.json`. The forced original order reproduced
the failure in `tmp/t0207-queue-first-control.json`; neither repeat is substituted
for the original failure.

The ordered trace and independent in-memory Jest resolver probe identify the
fixture defect: a virtual Undici mock misses the installed module ID after the
preceding cancellation import chain primes Jest's shared resolver cache. The
trace reaches production lookup without the owned fixture connector. Faraday independently applied the operator-authorised installed-module mock
correction and owned-connection fence. The fenced original fails 14 cases
before unowned connections; the amended fixture passes 20/20 in both orders.
All 19 original test names, 128 assertion expressions and deadlines remain.
The amendment is committed in 11c2588c and independently reviewed by Parfit.
Evidence: tmp/t0207-resolution-amendment/freeze.json.

## Runtime and dependency contract

Faraday's independent 13-case runtime oracle was committed in ac1efbd0:
seven matcher failures and six positive controls. After implementation all 13
pass in `tmp/t0207-runtime-green.json`, with actual exit zero. Version simulation
proves installer decisions before side effects, not application compatibility.

Package and lockfile require Node >=22.19.0. CI and all Docker stages use Node24.
The three bootstrap guards refuse older versions; Windows, Git Bash and existing
installation paths remain. Documentation states the minimum and build target.
The official Node22.19 Windows archive checksum was checked before extraction
into the owned runtime directory. The actual Node22.19 runtime passes all19 owned transport controls in
`tmp/t0207-node22-transport.json`, with observed exit zero. This is transport
qualification, not a full minimum-version application matrix.

Undici8.11.2 is an exact direct runtime dependency. The lockfile adds only that
package and the new root engine requirement; npm removed 16 local install
artefacts without deleting any other lockfile entries. Existing SQLite controls
ran successfully under pinned Node24.21. The distributed dependency includes
its MIT licence; Docker copies node_modules. Final image/licence tracing remains
part of broader acceptance.

The actual npm audit exits one and reports 15 vulnerable package records:
two low, three moderate, ten high, zero critical. Undici is not a named record.
`tmp/t0207-audit.json` preserves the raw report, including existing npm-config
warnings. The remaining records concern Babel, humanfs, Next ESLint/plugin
transitives, baseline-browser-mapping, brace-expansion/braces, browserslist,
esbuild, fast-glob, js-yaml, micromatch, minimatch, postcss and ws. T0196 must
reverify and resolve or explicitly account for them. Do not apply the suggested
Next ESLint downgrade as an automatic fix.

## Required acceptance

Complete unchanged-tree gate, committed causal mutation sweep, independent R3
verdict and every required hosted job remain outstanding. Scalar/family lookup
and native dual-stack branches currently have source inspection rather than
owned-listener behavioural proof. The operator approved the exact joint implementation landing on2026-10-04;
separate records, sweeps, R3 review and all hosted checks remain required. No release acceptance is claimed.

## Historical diagnostic safety

The original observed evidence and probeSha256 remain unchanged. The checked-in
diagnostic now refuses before loading transport if either source differs from
the original measured LF hashes. This prevents the obsolete fixture from
dialling a newly pinned public address. The current-source refusal control
passes with zero connection attempts in tmp/t0207-diagnostic-refusal.json.
The diagnostic's current bytes differ from the historical probeSha256; that
hash binds the original execution, not this safety guard. Use the independent
19-case owned transport oracle for current-source regression evidence.


## Committed implementation and complete gate

Joint operator-authorised implementation commit: `8daba39805eec79f2a32043a946ec17b1c9a748c`. All183 overlay paths matched the isolated gate candidate byte for byte before staging; protected changes were limited to accepted ADR0018/0019/0020. Historical task records were excluded.

Full gate4 `tmp/t0194-final-gate-1791149030291/gate/summary.json` exited0 with all10 steps green and identical before/after stamp `974c88039e0d6a00b204f35b6dd7bcbd6483b1c2c06d111a8231e32e6ae0ee84`. Lint, typecheck, Jest coverage, Knip, canary, Turbopack build, database-free build checks, browser acceptance and both censuses passed. Jest:865 suites/9051 tests passed,2 existing skipped suites/9 existing skipped cases. Browser:513 passed/24 existing skipped, configured retries0. Build-purity:2/2 passed. No operator repository data was used.

Earlier failed gates remain evidence: gate1 had42 failing unit cases; gate2 exceeded the unchanged C4 repeated-window ceiling; gate3 rejected an isolated dependency junction. Independent fixture repair and a net-saving helper fold resolved the first two. Real owned dependency materialisation resolved the third without production configuration changes. The build-only probe was partial and never replaced the full gate.

The full parallel Jest run still warns that a worker required forceful shutdown. The separate112-case serial open-handle diagnostic is clean and does not explain that warning. T0195 owns the uncertainty. Build-purity emits Node DEP0190. Route census observes offline owned Hindsight/gateway services, so it does not establish service availability. No whole-product or release acceptance.

Committed T0207 sweep `tmp/t0194-committed-sweeps-1791150413350/summary.json` exits0:8/8 killed through executed matcher failures,0 runtime errors. Original and restored32-case controls pass. All mutation files restore bytes/modes and tree is clean at8daba398. Structured per-run reports are retained for independent causal review.
