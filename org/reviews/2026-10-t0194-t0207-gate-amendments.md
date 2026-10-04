---
summary: Independently authored retained-gate amendments and the preserved first red gate
type: review
tags: [testing, evidence, governance]
---

# T0194/T0207 gate amendments, 2026-10-04

The first full gate remains red. Lint and app typing passed; Jest returned 1:
12 failed suites, 42 failed tests, 9009 passed tests and 9 existing skips.
No later gate step executed. The tree stayed unchanged with SHA-256
da43c78270c83738b82ec58a7a6cb5ab36892e3bc8a2c3a0be63f585d7bb406c.
The structured receipt is tmp/t0194-final-gate-1791144096936/gate/summary.json.
No retry, partial run or fixture repair changes that result.

## Amendment 1: three retained Composer fixtures

Reason: accepted private Composer submission and durable terminal cleanup are
absent from the old transport/repository doubles. Supply their exact fixture
seams; keep real terminal persistence and awaited cleanup in the SQLite cases.
The repository-double case represents an absent private receipt.

Author: Banach, session 01a10610-cd11-7cd1-a83c-bbed065d1f98.
Authoriser: Daniel Parke, explicit gate-amendment reply, 2026-10-04.
Independent reviewer: Parfit, session 01a107e1-5ba0-7703-ab13-e23e640dc10b.

| File under tests/unit | Original LF SHA-256 | New LF SHA-256 |
| --- | --- | --- |
| b4-emits-research-composer.test.ts | 3e67291656d5f42fcbd5be4e078447a91bbdee154339b68571814d40c3266dc3 | 933504c31e9411541b2aa45c5591ce6f8b5bf4c09c5c38e250ee69351f679005 |
| a-hil-gate-asks-the-human.test.ts | 045eea381ea7e80aef4ad93af55926e95305920c0e3b1167ccccf9267a6b3603 | 43f62f82016e148b08953eeeb84f6f3e8f6b4541fd1bc342134466191d41416a |
| the-artifact-is-the-work-not-the-critique.test.ts | bca9356beba7bef4d57c7960823dca74d4301615e2a9fdf5c910e020453b0d6d | 4f92161f83c1a4bb071184fec27466ace68285808b4abf94ce5219cbefffdc2c |

The freeze at tmp/t0194-retained-composer-fixture-amendment/freeze.json records
all original/new raw and LF hashes, originals against HEAD, and unique inverse
replacements restoring original bytes. All 44 names, 116 assertions and timeouts
remain. Focused tests pass 44/44 with no skips or runtime errors. Test typing
and scoped lint return 0. Parfit independently verified the hashes, inverse
proof, names and assertion bounds and found no blocking fixture defect.

SQLite refusal assertions, Human gate judgement/approval and artifact selection
remain. Their transport doubles do not prove cancellation races or remote
cleanup; separate queue controls retain those responsibilities. This bounded
review does not grant full-gate, mutation, hosted or batch acceptance.

## Source and documentation repairs

Restore utils.ts's required root-purpose marker and cross-cutting reason.
Remove only two unused type exports in queue-cleanup.ts. The actual compiler
proof tmp/t0194-source-gate-repair-proof.json verifies identical comment-free
emitted JavaScript for both changes. The first proof launch had a wrong relative
compiler path and failed before execution; the corrected producer returned 0.
Add the three accepted ADRs to the public authored index. No check changed.

## Remaining independent amendments

The approved eight remaining fixture changes and separately authorised typing-only
queue oracle amendment are being prepared by Faraday in the second writer lane.
Their identities, focused results and independent review must be recorded before
acceptance. No baseline or rule exemption is authorised by these amendments.
The entire gate must run again from the beginning on an unchanged tree.


## Amendment 2: eight gate fixtures and one typing-only queue dependency

Author: Faraday, session 01a1062b-0f36-7702-885b-476fd150d9bf. Authoriser: Daniel Parke, explicit main proposal and separate queue typing-only proposal replies on 2026-10-04. Independent review is pending.

| File under tests/unit | Original LF SHA-256 | New LF SHA-256 |
| --- | --- | --- |
| t0163-bootstrap-credentials.test.ts | 174196b79960ad9ec7b01f22cc4733cef36e69e53bcb8a6846152de7606f6cf3 | 57bfa85f77a6a63600b500dcaa465aa7153960b659dbe38d2ced2d5c86a0763a |
| release-jest-worker-budget.test.ts | fe674903ca731864a9096e65a7e04dda95f7d8770ef2740ea8c6cf51497721eb | a2e5ba781216c850a1e561349a702b0f99914ad8af317b7a8b1e09beca90e485 |
| dependency-hygiene-contract.test.ts | 100e0bbcd70bee2799b1c29df2b0a4836662c98aa5b6a02f0579e9dcfdb56874 | c867fe930a8b3c7ffbf89fb35154b1f8604107a95a795bd5d2b0b0793dce80ef |
| t0175-dependency-proposals.test.ts | b42bd421c59b25ba4da9369592c79e52b9627de9ecc2f02ca4206730383fe217 | ebcea96241e7e1b5be8b220cfbe4f8a083b34b8d51864e17c5ec11433558f1ea |
| t0176-visual-dependency-proposals.test.ts | d2ad8ecc926a81895adbc9d78b1f913da1c13e5b36489f0e9bb19d43ebadd8d1 | cd74cefc4c726d5fdf7b2f795db145575e7b009bb0244a8039c6248958464b9e |
| t0177-knip-proposal.test.ts | 999d124e7653172347a696a2621996d90c43cf0b032ffd17713b36056d855d62 | 45d7448c4e3120bc1dd857c8f903929698af98db0a2547fc59e07424eef7b8b8 |
| k3-a-closed-record-keeps-its-spelling.test.ts | 23a94321bcee6f2e335a56c1000f36ff5f8830fe74f3824bfae401f4c62fb389 | 4248e246ecb037d1c42a02e95a3990daf833c2df835eac53164a641c69bd01d5 |
| subsystems-route-and-panel.test.tsx | 54cb3468e6030e7720e859b9f0c83128be56464edec6564b097862dd205d25df | 4a3487db0e40a3e71603c1ab18a7807930f0d48b9cf3f45c02a1231084c35be5 |
| lib-domain-queue-admission.test.ts | c23633042114d02858820c3e96920e948089da2844a5217683c1029307ef8527 | 7dba48b2bd55a3b0302a99f564d290f3e89be5177964f8724061cf88732dfc21 |

The freeze at tmp/t0194-independent-gate-amendments-20261004/freeze.json retains exact names, assertion expressions/counts and deadlines. Focused checks pass 90 tests, with zero failures/runtime errors and one existing skip. Test typing, scoped ESLint, Knip and diff checks return 0. These results do not establish a full gate.

Both original executable config hashes remain; only the recognised exact env import/call is inversely reconstructed. The K3 precondition admits only the two named Hermes destinations and adds positive alias detection assertions, preserving every historical/protected check. Dependency tables add exactly Undici 8.11.2. Node fixture adaptation preserves credential permission/refusal/no-disclosure assertions. The jsdom route fixture doubles only its unrelated sync import.

The separately authorised queue amendment adds one type import and replaces the existing claim signature with typeof. Actual compiler-emitted JavaScript, all 30 names, behavioural assertions, fixture bodies and deadlines are unchanged. No dynamic loader or claim assertion is replaced. Knip sees a genuine existing dependency; no scan exemption or artificial caller was added.


## Independent amendment review and candidate preparation

Parfit verifies all nine second-amendment originals against HEAD, inverse changes restoring original bytes, retained assertion/time bounds, exact two Hermes paths and both executable config hashes. The queue type amendment matches the explicit operator extension and emits identical JavaScript. Bounded PASS; no overall batch acceptance. Windows bootstrap evidence does not execute the POSIX-only refusal/mode branches, and the existing symlink skip remains.

The coordinator reruns the unchanged C7 suite after restoring the source marker: 9/9 pass, no skips, in tmp/t0194-root-comment-green.json. Both mutation manifests still have exactly one anchor per entry (18 T0194, 8 T0207); this is applicability, not a kill report. Canonical task validation/view rendering and document manifest generation pass. The line producer records the explicit fixture/comment growth reason; current counts are source 102409, tests 154322, repeated source 655, repeated tests 4826 and one-importer components 103. Programme targets remain fixed.

## Second complete attempt and remaining C4 failure

The second gate remains red in tmp/t0194-final-gate-1791146026762/gate/summary.json.
Lint/typecheck pass; Jest returns1 with one failed suite/test, 9050 passed tests
and nine existing skips. C4 requires at most4800 repeated test-window lines;
the candidate measures4826. This fixed assertion stays unchanged. Before/after
tree SHA-256 matches5423ebe42b5ec8e27f94ceb54313fe4f2498c788a7ab6bb60d1536d921aee8a7.
No later gate stage executes. A true shared-fixture reduction is proposed;
in-memory measurements are hypotheses until the actual producer runs.

The parallel coverage run reports a worker teardown warning. Faraday's separate
owned serial --detectOpenHandles diagnostic passes112/112: queue30, confirmation18,
invalid cancellation1, DNS19 and retained Composer44. It reports no open handles
or warnings and leaves fixture bytes unchanged. Receipt:
tmp/t0194-teardown-diagnostic/receipt.json. No retry, forceExit or timeout change
is used. This focused result does not explain the parallel warning or justify
an arbitrary timer change. T0195 retains that investigation.


## Amendment 3: shared retained Composer fixture

Author: Banach, session 01a10610-cd11-7cd1-a83c-bbed065d1f98, 2026-10-04. Authoriser: Daniel Parke, existing exact transport/terminal-settlement amendment approval. Independent Parfit confirms that this unchanged extraction fits that ruling. Only the two authorised suites and new private tests/helpers/composer-legacy-fixture.ts change.

| File under tests/unit | Original LF SHA-256 | New LF SHA-256 |
| --- | --- | --- |
| a-hil-gate-asks-the-human.test.ts | 43f62f82016e148b08953eeeb84f6f3e8f6b4541fd1bc342134466191d41416a | 538794d76b7608470d7ee9792670209f392e737c6142c31fec93634adeb30006 |
| the-artifact-is-the-work-not-the-critique.test.ts | 4f92161f83c1a4bb071184fec27466ace68285808b4abf94ce5219cbefffdc2c | f1cc51802ef52956903695280723df96c582858f335cc254b0d5969db4febe99 |

New helper LF SHA-256: 1b303b14b256a82e2348153eada03152f9c3e271ab709afc113f14699918fc6f; the helper did not exist before.

The freeze at tmp/t0194-composer-fixture-fold/freeze.json records helper absence before, its new hash, exact inverse recovery, all15 names/36 source and emitted assertion expressions and unchanged deadlines. Real persistence/cleanup and fresh transport doubles remain; lazy production dependencies preserve mock order. Actual39/39 pass includes both suites and the unchanged C4 check. Test typing, scoped lint and Knip return0. The initial missing-import failure and two Knip failures are retained in initial receipts, then fixed before this green run.

Actual repeated test-window lines fall4826 to4768; total test lines fall154322 to154313, including the helper. Byte cost falls94. This rare two-consumer fold has a measured net saving. C4 cap4800, coverage floors and all programme targets remain unchanged. The baseline producer holds the fall without a growth exception. Independent final review and full gate remain required.

Both Parfit and Faraday independently pass this exact final three-file fold:
current hashes match the freeze, inverse recovery matches the originals,
production dependencies remain lazy and real terminal settlement is retained.
Their bounded verdicts grant no overall batch acceptance.

## Third full attempt: dependency topology refusal

The third full gate passes lint, app typing, coverage/Jest (9051 passed tests,
nine existing skips), Knip and canary, then fails build. Turbopack rejects the
owned validation node_modules junction pointing outside its filesystem root.
Tree SHA-256 remains6b171dad0846101607eaa67784e921c65af78b5f74b63b8b7b7afc868b89f74b.
Receipt: tmp/t0194-final-gate-1791148104217/gate/summary.json. The parallel worker
warning persists; no leak fix or complete gate is claimed.

The coordinator archives only that owned junction object under ignored tmp,
preserves the shared source, and copies dependencies into a real owned directory.
Robocopy returns1 (successful copy), with matching Next/Undici/better-sqlite3
manifests and native-addon hashes. Receipt: tmp/t0194-validation-deps-copy.json.
No production build configuration, bundler, source or operator data changes.

The isolated build-only probe then returns0 in45.1 seconds at
tmp/t0194-isolated-build-probe-1791148730773/gate/partial/summary.partial.json.
It is partial evidence and cannot replace a full gate. Every gate step must
run again on the unchanged candidate with its owned dependencies.
