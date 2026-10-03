# T-0202 independent HTTP fixture investigation

The first interactive-repair gate passed all 7,533 Jest assertions, then failed
two E2E cases under load. Each unchanged E2E spec passed alone. The next full
gate failed four assertions in the frozen HTTP fixture: H04/H06 ownedStopped,
H05/H12 withinDeadline. Its 7,529 other assertions passed; the full gate is red.
Keep both logs and all failed observations. The harness source hash remains
1deb5a3bfb2b7694098d5e0ead2526877d35fd486e48755e3591ee31e1d8971b.

Read T-0202's R2 record and ORACLE charter. Own only a new appended amendment
entry and tests/helpers/release-install-http-probe.py if the independent
REVIEWER authorises a concrete instrument repair under Q-015. No other writes,
commits, baseline edits or product changes. The coordinator owns the harness,
record, claims and full gate. At most two writing lanes.

First inspect/reproduce the existing helper's actual failure evidence and
separate scheduling/launch overhead from a production cleanup or deadline bug.
The helper scales explicit curl/sleep times and uses real Git Bash/curl on
Windows. Do not simply increase a failing watchdog, reduce retry coverage,
remove ownership assertions, skip cases or change concurrency to make it pass.
Obtain Goodall's independent authorisation before a frozen-file amendment.
Report any production defect to the coordinator instead of masking it.

Preserve all 14 HTTP names, seven default names and their assertions. Prove
successful controls, credential secrecy, valid HTTP failures, stalled requests,
TERM refusal and unowned-listener survival. Preserve Linux and Git Bash
behaviour. Keep launch/configuration/invalid-fixture errors distinct from
semantic failures. Repeat targeted controls and diagnostic loaded evidence;
the coordinator separately repeats the complete gate and committed sweep.

## Second investigation: curl launch protocol

The timer-only amendment still fails H12 under the normal full Jest corpus,
even after install builds finish. Direct exec was rejected because it bypasses
the caller's error recovery. Explicit native curl selection showed no elapsed
improvement; actual fixture resolution differs from the reviewer's shell.

Poincare's ignored Python-owned curl bridge prototype passed the unchanged
21 assertions and 20 Linux process cases. Its Windows control discarded real
496-byte response bodies. These prove feasibility only. No tracked amendment
is authorised yet. Complete these specific obligations before seeking Q-015
acceptance: the missing-max-time mutant reaches the stalled server and fails
the existing watchdog; invalid protocol and launch failures remain infrastructure
errors; cancellation reaps only owned curl children; argument/environment mapping
matches the real Bash invocation; per-case evidence accounts for every fixture
without the shared audit write race. Preserve the earlier failed discovery runs.

The author may write ignored prototypes and diagnostics. The tracked write set,
if the independent reviewer authorises the finished design, is only the frozen
HTTP helper, a specifically named curl bridge helper and appended amendment
entries. The coordinator must expand claims before that write starts. Keep the
production harness and all 21 test names/assertions unchanged. No watchdog,
iteration, worker, retry or coverage change is permitted. The coordinator then
performs an independent pass, the complete gate and the committed-tree sweep.

Goodall authorised the exact final candidate under Q-015 on 2026-09-30:
HTTP helper `5b36c32e905b51dca3681e3a67db4cd3aa5fca342c7faececf0d166cdd4fbedf`
and new `tests/helpers/release-install-http-curl-bridge.py` at
`fe32217daf2d684aa6a913fb3de2109d1554c67616051fed1b27d0db8d208ee1`.
The claims file now assigns Poincare these two files and appended ledger
entries only. Coordinator Windows assurance and Linux 20-case, negative and
audit controls passed. The first coordinator Linux tmpfs used `noexec` and
prevented the fake executables from launching; that configuration failure is
retained. The final design adds 309 physical Python lines outside the historic
TypeScript line measure. All frozen assertions and production source survive.
Instrument acceptance does not establish full-gate reliability.
