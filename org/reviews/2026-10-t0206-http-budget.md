# T0206 HTTP budget investigation

Opened at clean dev0f14c77a after its macOS push CI37183971353 failed.
Original evidence: tmp/t0192-closure-macos-failure.log and
tmp/t0192-closure-macos-full.log. Two full-suite failures; isolated20/20pass;
stalled diagnostic21calls, withinDeadline=true, elapsed4.937716459s.
The full failure remains. Mechanism and repair are not established.

T0192's independent implementation acceptance at926a13d3 remains bounded and
its closed record is preserved. Its metadata-head hosted prerequisite is red,
so T0193 is not open. See the oracle brief for measurement, invariants and
required separate-author repair proof. No implementation performed.

The matching PR CI37183974840 subsequently failed the same two case names.
Its C02 failure differs: all21native calls occurred, but the shell completion
list lacked the final native status when supervision expired. C05 again
reported withinDeadline=false. Both macOS full runs had8821passes,2failures
and5skips. Both existing isolated reruns passed20/20. The PR's later stalled
diagnostic recorded21calls, clean ownership and withinDeadline=true, with
6.086316208s total observation time. That total is not the supervised interval.
Preserve tmp/t0192-closure-pr-macos-failure.log and
tmp/t0192-closure-pr-macos-full.log alongside the push receipts. All other
closure-head jobs passed; neither macOS failure has been retried or waived.

## Controlled Windows measurement

Independent author Nash supplied a diagnostic observer that decorates Python
operations without changing the generated shell or frozen fixtures. The first
sandboxed attempt failed with an OSError before observation; retain
`tmp/t0206-phase-observation-1791098473523.json`. The permitted local execution
is `tmp/t0206-phase-observation-1791098793192.json`: before, observed and restored
controls took 3.829, 3.672 and 3.749 seconds respectively. Each retained all 21
native calls and matching bounded predicates/counts. Environment, decorated
objects and frozen file hashes were restored; owned processes had stopped.

The observed case measured 0.008 seconds across 3,472 bridge receive calls,
0.0038 seconds across 21 binary reads, 0.062 seconds of native process creation,
and 2.333 seconds of native communicate calls. Inclusive timings overlap.
The outer communicate interval was 3.427 seconds, not the exact six-second
supervised interval. These Windows results do not establish a macOS cause or
support speculative receive buffering or binary hash caching as its repair.

The coordinator also executed the timestamped candidate directly. Receipt
`tmp/t0206-coordinator-timestamped-observation.json` records exit zero,
3.900/3.691/3.753-second controls, all 21 calls, matching bounded predicates,
unchanged frozen files and restored objects/environment. All owned processes
stopped. Monotonic timestamps are populated for each observation. This remains
a Windows diagnostic, not a macOS load or product-acceptance result.

## Next discriminating measurement

Laplace authorised a narrow concurrent macOS diagnostic in principle: one
before/observed/restored observer sequence alongside the unchanged coverage
command and worker count. Record monotonic intervals, both outcomes and owned
waiting. This adds contention and is not the original failing observation.
Signal handling is best effort; runner termination can prevent final cleanup.
Exact helper and workflow review remain required before execution.

The first workflow contract run passed 49 tests and failed W01 because its
whole-step string equality rejects a diagnostic wrapper around the unchanged
coverage command. Laplace authorised a separate-author Q-015 amendment limited
to that stale equality, retaining its identity and unrelated assertions. Nash
must prove one unchanged executable coverage command, preserved failure exits,
diagnostic failure reporting and owned waiting through controlled shell cases.
No frozen HTTP assertion, deadline, attempt count or worker setting may change.

Nash stopped with 42/42 passing, all 28 old identities retained and 14 added.
Focused lint and test typechecking exited zero. The earlier syntax and
`NODE_ENV` typing failures remain in the local receipts. The amendment proof
is `tmp/t0206-w01-proof.json`. The test's old digest is
`2d114ad550a60aa74cf9ea994b79f616ad322b87b233e44b35998a4c100c0dd5`;
its frozen amended digest is
`d82fa3722b6855ce02e889e0f517b88c1dfab978a1894aa61c59405bedf217fb`.
The author is session `01a10198-6b4f-7593-aa19-e0b3c8facad8`; the independent
reviewer is Laplace, session `01a1019a-65c6-7ae2-aafe-5b79b166c745`.

The coordinator's isolated original-workflow comparison exited one with 11
expected failures and 31 passes: W01 lacked the explicit diagnostic shell;
the ten W03 cases lacked observer execution or diagnostic failure handling.
The four W02 negative-command controls and unrelated historical checks passed.
Receipt: `tmp/t0206-original-workflow-red.json`. An earlier incorrectly rooted
invocation tested the new workflow and passed 42; despite its filename,
`tmp/t0206-old-ci-red.json` is not red evidence. Neither result is discarded.

The candidate historical line measure increases by 91 test lines for these
independent workflow controls, with its written reason in the generated census
baseline. The diagnostic Python helper is outside that historical measure's
extension set; it must remain visible in the wider final scope inventory.
Source and tooling counts and all fixed targets are unchanged. No repair of
the macOS deadline failure has yet been made or accepted.

Laplace accepted the exact diagnostic freeze and integration on 2026-10-04,
including the classified original-workflow red, matching 42-case identities
and all preserved old assertions. This permits measurement only. The complete
gate, committed negative controls and hosted diagnostic remain outstanding;
T-0206 stays active and T-0193 stays unopened.

Oracle commit `81600d9d` normalises the observer's mixed CRLF endings to LF.
Its reviewed Windows digest is
`5df60fd8f6c59216107b9634eea615d7b86311871cccfb36a510c2704110364f`;
the committed LF digest is
`31d4a11ec9785c6e68d4d6a372f7e1c8f6c77c23ea0094aed686e1eb82cc7100`.
Replacing CRLF with LF in the reviewed bytes exactly reproduces the committed
blob. The native Windows receipt remains bound to its original raw digest;
hosted execution uses the LF form. No Python source token changes.

## Verified diagnostic checkpoint

Diagnostic candidate `89e7f7b4` passed the full gate in
`tmp/t0206-coordinator-gate-1791100095423/gate/summary.json`: all ten stages
exited zero on one unchanged tree, with 8,833 unit passes, 499 browser passes,
the existing nine unit and 24 browser skips, both build-purity controls and
both censuses. This verifies the diagnostic integration; the original macOS
deadline failure remains unresolved.

The model switch interrupted sweep `1791101625705` after two mutant reports
and while the third workflow mutation was applied. It has no completed sweep
or restored-control verdict. The coordinator confirmed that its owned runner
was absent, matched the remaining edit to the exact manifest replacement,
and restored only that recognised mutant. Preserve the incomplete receipts.

Fresh sweep `tmp/t0206-diagnostic-sweep-1791102883823/summary.json` completed
against the committed candidate: all three workflow mutants were detected,
42 controls passed before and after, identities matched, and the workflow
was restored byte for byte with a clean final checkout. The intended failures
were loss of coverage-exit precedence, loss of observer waiting/exit propagation,
and ignored diagnostic-report errors. Independent final qualification and
hosted measurement remain separate prerequisites; this task stays active.

Independent reviewer Banach, session `01a10610-cd11-7cd1-a83c-bbed065d1f98`,
qualified diagnostic push readiness on 2026-10-04 at `89e7f7b4`. It verified
42 matching controls, zero runtime/setup failures, the actual wrong exit
values for all three mutants, source hashes, exact restoration and the full
gate. This additive checkpoint changes prose, task timestamps and live claims
only; executable candidate bytes remain unchanged. T-0206 remains active,
with the macOS cause unresolved and T-0193 unopened.

## Hosted measurement and independent selector correction, 2026-10-04

At55e31ce4, both macOS full coverage jobs passed with unchanged settings.
PR37189723576 still failed its full browser job:498passed,24skipped,1failed.
The failing Missions create test selected both the header and empty-state
New Mission actions. The acceptance aggregator correctly refused that run.
Push37189719917 and both Gitleaks runs passed. Snapshot:
tmp/t0191-hosted-t0206-resume/snapshot-1791104811461.json.

Both Darwin phase reports completed before/observed/restored controls with
21native calls, matching bounded predicates/counts and exact restoration.
The measured native communicate intervals were4.048s(PR) and2.994s(push);
outer communicate5.889s and4.278s. Neither is an exact watchdog measurement.
Reports:tmp/t0206-hosted-pr-phases/t0206-http-phases.json and matching push
directory. Independent sceptic Franklin01a1062c-ad31-77c2-8ff2-71c41ee9b5d6
finds the cause unproved: parent wait includes native work and scheduling.
Small recv/read/spawn totals do not justify buffering or hash-cache changes.
The old full failures remain failed. No timing repair or closure is claimed.

Under Q-015 and the operator's current prerequisite-fix authority, independent
author Faraday01a1062b-0f36-7702-885b-476fd150d9bf amended only the exact
New Mission locator in tests/e2e/features.spec.ts to scope it to header.
All12test names, all assertions and unrelated executable bytes are unchanged.
LF SHA256 original4aa8df098abe27041b6c69b792356a35ca583376fd2afd979ee137299162eefc;
amendedb7268c96f470097b8e7769be854599666f275bd11b23334eabc415211355b9ee.
Hosted strict-selector failure supplies the red. Isolated built-app controls
at port3999 passed12/12, zero skips or retries:
tmp/t0206-selector-check-1791105135032/runner.json and run.log.
The full gate and hosted exact-head acceptance follow; task remains active.

The corrected tree passed all ten full-gate stages with unchanged stamps
b9325eb5a77f70388df0cad7eec317ac2a8f69ea242b1397b0c5f6a2a31db4d2. Receipt:tmp/t0206-coordinator-gate-1791105254756/gate/summary.json.
8,833unit/499browser passes; nineunit/24browser historical skips remain.
Q-035 now permits T-0193 after exact-head hosted green while this task stays
active. Independent Franklin source review preserves all12identities and
assertions; final qualification and committed sweep follow.

Franklin independently qualified the selector correction for commit after
observing the complete ten-stage gate and unchanged executable hashes.
Post-commit mutation and exact-head hosted checks remain required. This is
bounded amendment acceptance, not a timing repair or T-0206 closure.

Committed sweep64ed3aca detected all three intended workflow mutants with
42passing controls before and after, zero infrastructure failures and exact
restoration. Receipt:tmp/t0206-diagnostic-sweep-1791106980809/summary.json.
The executable workflow hash remainsbeb3dd48d3ec3631a08d9fc23216086d44dd46537a198f16ef65af983ba57cf2.
Q-035 and this verification checkpoint add metadata only after the gate;
the independently frozen selector and diagnostic executable bytes are unchanged.


## Closure-head recurrence, 2026-10-04

T0193 product/implementation070f24ea was independently accepted with every
required hosted job passing. Closure4a9bc63e changes metadata only. Its PR
CI37206142400 fails the existing macOS C02/C05 checks;10other required jobs
pass, including full browser and install/update acceptance. PushCI37206138381
has all9required jobs passing; both Gitleaks jobs pass. No retry was requested.
Snapshot:tmp/t0191-hosted-t0193-closure/snapshot-1791121711408.json.
Failure log:tmp/t0193-closure-macos-failure.log. T0194 remains unopened.

C02 now reaches21native calls/statuses but only20shell completion records;
the final28 is missing. C05 reads the same stalled observation and reports
withinDeadline=false after its scratch predicates pass. These are two
assertion symptoms of one watchdog expiry, not two proven cleanup defects.
Native status is recorded before bridge transmission; eventual native
completion does not establish completion before the watchdog.

Downloaded separate observer artifact:
tmp/t0206-closure-failed-phases/t0206-http-phases.json.
All three samples have21matching completions andwithinDeadline=true.
Observed native communication totals3.886s, outer communication5.470s;
restored whole duration6.382s includes unsupervised preparation/cleanup.
Banach independently finds the cause still unresolved. The smallest useful
next probe captures the actual oracle invocation, not another separate sample.
See org/briefs/T-0206-actual-oracle.md. No timer/concurrency/assertion change or
performance repair is claimed. Old reds remain red.


## Actual-invocation oracle, red before implementation

Independent Faraday controls:52cases,33pass19matcherfail,zero skips/runtime
errors; structured receipt tmp/t0206-actual-oracle-red-strengthened.json.
The42original release-tool names/assertions reconstruct the committed source
after removing only the additive Q015 amendment. Ten new synthetic controls
cover disabled delegation, actual callback decoration, partial failure,
redaction/source binding,21real bridge receive/validation intervals with
synthetic native execution, malformed/missing/partial receipts, failed oracle
outcome qualification and interrupted native communication restoration.
Eleven existing-control failures are only new workflow/environment assertions.
Eight new-control failures expose missing capabilities; validator rejection
behaviour remains unproved until green. Types, ESLint and diff checks pass.

Banach initially found two gaps (decorator could manufacture events away from
the callback; receiver/validation not exercised). Before implementation the
author strengthened the same52names; Banach independently accepts the exact
red freeze. No helper or workflow implementation existed at freeze.

- `tests/unit/release-http-actual-observer.test.ts` LF SHA256 `7aade66cc03fc1e477bf4fcbdbb481339f8f826d4cd7359851d120577e5f734b`.
- `tests/unit/release-test-tools.test.ts` LF SHA256 `8f07fcf7dcd40344199d7387c99ad6d5a7f93bc4145bf73b49ed96c2eb2844f0`.
- `tests/helpers/release-http-phase-observer.py` LF SHA256 `31d4a11ec9785c6e68d4d6a372f7e1c8f6c77c23ea0094aed686e1eb82cc7100`.
- `tests/helpers/release-install-http-context-probe.py` LF SHA256 `7c88d3f7c8fc54ae7116b189d32905208e0bc77bc5228f74d85b85d671d6794a`.

Existing task-stored phase-observer hash is the prior raw CRLF digest; the
current LF baseline above is its documented normalisation, not a source edit.
The oracle commit is red by design. This is observability acceptance only;
all original timing failures and T0206 final verification remain open.


## Actual recording implementation, focused verification

The frozen 52 names now pass: 42 existing tooling controls and 10 new
actual-entrypoint controls. Existing HTTP context/default suites pass 27/27
with recording enabled on an owned Windows instance. The receipt binds the
current sources, preserves all 21 native/status/completion/returned counts,
and reports object restoration and owned process cleanup. Standalone
before/observed/restored controls remain separate from actual invocation.

Native Linux disabled/enabled controls also agree on selected predicates,
21 calls/statuses/completions/returned exits and the original deadline and
cleanup. Repository is read-only in an owned container; /tmp is executable
because the fixture launches temporary helper files. Linux receipt:
tmp/t0206-linux-actual-exec.json, final JSON line, SHA256
af079081938821b98651b74a18e76850f1e853598be0a40e9dad392c71abec35.
Windows receipt: tmp/t0206-owned-actual-1791124154633/actual/
stalled-21332-c5ad3b0297a84e71b3246f30d7a5c3b9.json, SHA256
25d3d96964715cf998e756070942c8910a875b011ef6197dc0770377132505ad.

Failed validation attempts are retained: first workflow integration added
mkdir outside the hermetic PATH (10 launch errors, not mutation kills);
the helper already owns directory creation, so the duplicate was removed.
The final 42 tooling controls pass. Linux first used an invalid --cases
argument, then non-executable tmpfs caused a one-request launch failure;
tmp/t0206-linux-actual.json preserves that fully observed failed workload.
These attempts establish no workload acceptance or causal timing result.

Diagnostic measurementComplete means correlated evidence was captured. It
does not require passing outcome flags or 21 requests. Workload acceptance
remains in the unchanged HTTP tests. No timeout, retry, concurrency, bridge,
shell, installer, frozen assertion or application source changed.

The line-census test increase is 301 lines for the independently authored
10-control oracle and additive workflow assertions. This is an explicit
verification cost, not claimed product reduction. Historical targets stay
unchanged. Full gate, clean committed mutation sweep and hosted capture
remain required before this diagnostic checkpoint is accepted. T0206 stays
active, the old macOS failures remain unexplained, and T0194 stays unopened.


### Independent compile correction

First full gate stopped at lint exit2: test-specific TypeScript TS2741
required NODE_ENV in ProcessEnv. The previous app typecheck had not compiled
this test configuration. Banach independently added NODE_ENV="test" to the
isolated test harness. This is one runtime environment value; no control
consumes it. Faraday independently removes that exact insertion and recovers
the frozen bytes, preserving all52names and assertions. Actual test-specific
typecheck passes on Node24.19;10new controls pass. The full gate uses pinned
Node24.21 and must rerun all stages. No assertion or deadline was relaxed.
Amended oracle LF SHA256:
c5e80eb53dbb92a00f138618f9871e374b0a31e555bc454f7b281a4fde82bc73.
The first red receipt remains tmp/t0206-coordinator-gate-1791124875497/gate/summary.json.


## Independently verified diagnostic checkpoint

Implementation3d62a0d7 passes the full unchanged gate at
tmp/t0206-coordinator-gate-1791125479799/gate/summary.json:
10stages all exit0,8902unit/9existing skips,511browser/24existing skips,
2build-purity controls and both censuses. The production Turbopack build
took846.4s; previous753.2s. Resource samples support memory pressure as a
possible contributor, not a proven compiler defect. No alternate build or
check relaxation was used. Gate stamp before/after:
0d196d3f0809fe99112df6091992b32b01afa6941919ff2f8c057fd749b1f366.
Content/mode proof covers2697paths:
tmp/t0206-actual-gate-content-binding.json. Text CRLF normalisation is
explicit; the actual validation tree's raw gate stamp was separately held.

The second attempt was interrupted deliberately after noticing that the
growth allowance had been checked without --update-baseline. Only verified
owned descendants were stopped; no pass is claimed for that run. Receipt:
tmp/t0206-coordinator-gate-1791125308264/interrupted.json. The final full
gate includes the persisted301line oracle growth reason and unchanged targets.

The first sweep's generic runner printed7kills, but the coordinator's
stronger causal check rejected invalid-receipt: two controls had individual
fixture infrastructure failures after a validation guard was removed. It
is not accepted as a seven-kill sweep. All52original/restored controls passed,
and exact restoration held. Receipts retained under
tmp/t0206-actual-sweep-1791127313944. Commit9b2d140e changes only that
mutant's definition to return before validation; no implementation or oracle
assertion changed. The full gate above is attributed to3d62a0d7, not silently
relabeled as a full run at this subsequent manifest-only commit.

Corrected committed sweep at9b2d140e:
tmp/t0206-actual-sweep-1791127587574/summary.json. Seven intended matcher
kills, zero individual or suite infrastructure failures,52original/restored
controls, exact bytes/modes and test identities retained. Banach's bounded
review accepts the diagnostic checkpoint only. T0206 remains active: original
macOS timing cause unproved; no repair, whole-product or release acceptance.
Current-head hosted jobs must be observed after push. T0194 stays unopened;
accepted ADR0018 has not been added to the protected decisions directory.


## Separate base-fixture H12 failure, closure6dc4ce15

Push CI37242011425 Macjob111552448308 has one failed case: release-install-http-smoke H12, withinDeadline at32/96.9058 pass/five existing skips; every other applicable push job passes. PR macOS passes. Actual log tmp/t0194-closure-macos-failure.log and snapshot tmp/t0194-hosted-1791155151553/snapshot.json remain evidence. The helper derives withinDeadline from124/137 supervisor statuses; this run does not capture the exact status or native/parent timing. Earlier cleanup/ownership assertions passed, but later assertions were not reached. Do not label the whole case clean.

The context-only actual observer does not capture this base run_case callback. Parfit assigns this separate signature to T0206; no common cause with C02/C05 or repair is proved. A minimal next diagnostic must observe that same callback once, under different-author Q015/R2 controls and REVIEWER authorisation, keeping workload,21 curl calls, six-second watchdog, grace, all outer/lifecycle bounds and coverage concurrency. No retry or timing repair is authorised by this evidence.
