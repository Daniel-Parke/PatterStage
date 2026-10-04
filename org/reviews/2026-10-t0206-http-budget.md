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
