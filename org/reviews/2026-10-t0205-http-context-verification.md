# T-0205 independent HTTP context oracle

Author and lane: `T-0205-oracle`. Date: 2026-10-01 UTC.
Baseline: `803ad732d51b7dbd32d9ee872d3fe8a9a0c8aec2`.
Status: authored and frozen for coordinator hand-off; no implementation acceptance.
Router ruling: R1. Task and operator require stricter independent R2 acceptance.

## Independence and ownership

The author read START, the task, brief, ORACLE charter, lane claims and existing
HTTP fixture interfaces. The author did not inspect Harness source, proposed
implementation, ignored prototype or repository mutants. Harness was executed
only through the existing fixture's public `run_case` interface. The observer
decorates the shell writer. Probe instrumentation prepends identity and blindly
relocates temporary paths; it does not extract or retain generated shell source.
The existing native curl bridge, stdlib listener, registration, mapping and
supervisor remain. No existing tracked file was amended, staged or committed.

Independence methods: fresh-context contract authorship, private differential
reference and targeted private fault calibrations. The private reference is a
calibration target, not a proposed production replacement. Normal acceptance
does not select it. Private Jest plumbing can select it only for labelled runs.

Owned candidate paths:

- `tests/unit/release-install-http-context.test.ts`
- `tests/helpers/release-install-http-context-probe.py`
- `org/reviews/2026-10-t0205-http-context-verification.md`

The coordinator must copy the frozen provenance into the task record. This lane
has no task-record claim. Receipts and private controls are ignored under
`tmp/t0205-oracle`; they are not repository mutants or tracked acceptance inputs.

## Contract choices

Each curl entry records `$$` and `BASHPID`. Both must match the probe identity;
PID uniqueness is not required. Stalled readiness must retain 21 native calls:
one preflight plus 20 readiness attempts. The launch marker is written by the
child, so a readiness entry can precede that marker. Startup exit 52 and timeout
exit 28 are allowed. At least one timeout and actual stalled listener arrivals
are required. Arrivals are recorded before a response, not completed responses.

Post-native fault controls alter only returned status bytes or the returned
function exit after a real request. Native exits and injected returned exits
are separate fields. Fault controls never stand for actual server responses.
The complete status stream is checked, including suffixes, extra lines, partial
values and NUL bytes. One or several trailing newlines preserve the former
command-substitution semantics. Empty output and a closed producer stream fail
closed. A failed request's successful-looking status must not survive a later
empty capture.

C12 is explicitly stronger verifier behaviour. A curl function returning 28
with forged `200` cannot qualify a request as HTTP success. The original
caller's `|| true` capture semantics are not evidence that this fault is safe.
The genuine original red recorded native exit 0, injected function exit 28 and
`accepted: true`. Native timeout/absence reporting must still retain non-zero
curl exits and `000` semantics. The operator reports separate R2 reviewer
authority for this narrow Q015 strengthening before implementation. This oracle
does not amend that authority or the existing task record.

The supervisor explicitly overrides inherited TMPDIR with fixture-owned scratch
before native environment registration. C20 separately unsets TMPDIR and runs
real native requests with the owned adaptation of the `/tmp` fallback. Blind
relocation covers `${TMPDIR:-/tmp}` as well as literal `/tmp/` paths. Paths already
relocated by the existing fixture are protected, including on Linux.

Scratch observation requires successful real mktemp creation, distinct existing
regular non-symlink files, requested ownership scope, POSIX mode 600, creation
before launch and removal before fixture teardown. GNU `stat -c '%a'` is tried
first; BSD `stat -f '%Lp'` is the fallback. Windows POSIX mode observations do
not certify NTFS access-control lists. Refusing the scratch creation utility is
a labelled fault control and must stop before launching the owned server.

## Exact frozen test names and original red

Every full Jest name has prefix `T-0205 independent HTTP context oracle `.
There are 20 tests over 18 fixture scenarios. The table gives the exact suffix
and the first observed original matcher outcome, not an inferred failure.

| Exact suffix | Original outcome |
| --- | --- |
| C01 healthy native curl entries share the probe shell and BASHPID | `toBe`: entry BASHPID differs |
| C02 stalled readiness retains 21 native calls and distinguishes pre-launch entries | `toBe`: entry BASHPID differs; count 21 holds |
| C03 scratch is exclusive private and removed after success | `toBeGreaterThan`: zero scratch files |
| C04 scratch is exclusive private and removed after HTTP refusal | `toBeGreaterThan`: zero scratch files |
| C05 scratch is exclusive private and removed after stalled readiness | `toBeGreaterThan`: zero scratch files |
| C06 scratch utility refusal occurs before launch and preserves the decoy | `toBeGreaterThan`: zero scratch utility attempts |
| C07 post-native malformed suffix status fails closed | `toBeGreaterThan`: refusal holds; zero scratch files |
| C08 post-native second-line status fails closed | `toBeGreaterThan`: refusal holds; zero scratch files |
| C09 post-native partial status fails closed | `toBeGreaterThan`: refusal holds; zero scratch files |
| C10 post-native NUL status fails closed | `toBe`: accepted true instead of false |
| C11 post-native empty status fails closed | `toBeGreaterThan`: refusal holds; zero scratch files |
| C12 post-native successful-looking status preserves a failing curl exit | `toBe`: accepted true instead of false |
| C13 post-native closed status stream fails closed | `toBeGreaterThan`: refusal holds; zero scratch files |
| C14 per-call capture clears a prior successful-looking status | `toBe`: accepted true instead of false |
| C15 status capture preserves one trailing newline | `toBe`: acceptance holds; entry BASHPID differs |
| C16 status capture preserves multiple trailing newlines | `toBe`: acceptance holds; entry BASHPID differs |
| C17 refused credential and public health remain actual server refusals | `toBe`: refusals hold; entry BASHPID differs |
| C18 occupied listener retains real 200 401 200 controls and survives refusal | Pass |
| C19 TERM-resistant owned child stops without changing successful probe exit | `toBe`: successful cleanup holds; entry BASHPID differs |
| C20 unset TMPDIR uses owned fallback scratch and completes native HTTP | `toBe`: acceptance holds; entry BASHPID differs |

## Executed evidence

Runtime: the operator-selected Node v24.21.0 at
`tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe`; Python 3.14.4;
Windows Git Bash with real selected Git native curl.

Final original run: Jest exit 1, 19 matcher failures, one pass. Fixture exit 0;
no spawn error or signal. Stalled metadata recorded 21 native calls, 19 listener
arrivals and exits `[52, 52, 28, ...]`. All helper scenarios stayed inside the
unchanged watchdog; timing failures were not counted as intended red.

Final private positive: Jest exit 0, 20/20 tests passed. All 18 scenarios had
zero bridge errors and cancellations, stopped owned curl/IPC/listener, and no
watchdog expiry. The longest scenario took 3.571 seconds rounded upward. Its
stalled control retained 21 native calls and 18 listener arrivals. These counts
deliberately differ from completed server responses.

Seven private fault variants produced ten selected matcher failures. Every
selected test failed by a matcher, with Jest exit 1 and fixture exit 0:

| Private variant | Selected tests | Matcher failures |
| --- | --- | --- |
| Subshell curl entry | C01 | 1 |
| First-line-only parser | C08, C10 | 2 |
| Masked curl exit | C12 | 1 |
| Retained previous status on empty output | C14 | 1 |
| Leaked scratch | C03, C04, C05 | 3 |
| Public POSIX scratch mode | C03 | 1 |
| Dropped readiness attempt | C02 | 1 |

Focused ESLint exited 0. Focused TypeScript checking exited 0 with ES2022,
Node16 resolution and Node/Jest types. Python AST parsing passed. No whole Jest
run, complete gate, historical HTTP/default suite rerun or hosted job ran here.

Primary receipts:

- `tmp/t0205-oracle/original-red-final-jest.json`
- `tmp/t0205-oracle/original-red-final-observations.json`
- `tmp/t0205-oracle/original-red-final-infrastructure.json`
- `tmp/t0205-oracle/positive-final-jest.json`
- `tmp/t0205-oracle/positive-final-observations.json`
- `tmp/t0205-oracle/positive-final-infrastructure.json`
- `tmp/t0205-oracle/calibrations.json` and each named variant's raw Jest,
  observation, infrastructure and console receipts
- `tmp/t0205-oracle/eslint.txt`, `typecheck.txt`, `tested-source-hashes.json`
- `tmp/t0205-oracle/freeze.json`, containing all three candidate LF hashes,
  exact full names, receipt hashes and calibration provenance

Run ordinary acceptance with the specified Node executable and
`node_modules/jest/bin/jest.js --runInBand --runTestsByPath
tests/unit/release-install-http-context.test.ts`. Private receipt plumbing adds
`--setupFiles ./tmp/t0205-oracle/capture.cjs --json --outputFile <new-receipt>`.
Preserve the original frozen receipts when rerunning.

## Freeze and limits

LF-normalised SHA-256 values tested in the final runs:

| Candidate | SHA-256 |
| --- | --- |
| tests/unit/release-install-http-context.test.ts | `3c07258e650ddba6aa515d2f7aeb4bba19b19d85e3de2f0ebdccfd306f471e24` |
| tests/helpers/release-install-http-context-probe.py | `7614c63f07b32bd0385304a3dcabb75d836598d85f78723a98e5f22a502aca85` |

The ledger hash is recorded externally in `freeze.json` to avoid self-reference.
The three-file freeze is the author hand-off. No oracle edits follow it.
Any later amendment needs a different authorised author and retained originals.

This lane does not prove production performance, the historical full-gate cause,
Linux/macOS runtime behaviour, Windows system-curl portability, NTFS ACLs,
whole-tree acceptance or hosted CI. The GNU/BSD stat fallback and Linux path
adapter were authored but not run on those operating systems. C20 is a real
Windows native control with fixture path adaptation, not an actual Linux `/tmp`
run. C13 closes the status producer stream; it does not inject a filesystem
permission failure into the reader. Scratch removal errors preserving a
pre-existing failure status require the coordinator's lifecycle verification;
the leak calibration proves deletion sensitivity, not that error policy.
Distinct real mktemp-created files are observed, not a concurrent symlink race
or a broad proof that every unrelated filesystem object survives.

All historical 14 HTTP and seven default tests, portable/native controls,
production deadline 75 seconds, readiness attempts 20, supervisor 6 seconds,
kill grace 0.2 seconds, accelerated curl bound 0.1 seconds and RPC/outer bounds
25 seconds remain untouched. This Jest suite's aggregate fixture timeout is not
a replacement for those per-scenario bounds.

The separately authorised T-0202 m7 retarget is pending the implementation's
new call syntax and a manifest claim. No manifest or mutant was inspected or
changed during independent authorship. Retargeting must preserve m7's exact
`echo "$AUTH_TOKEN"` fault, id, reason, tests and all other mutants, and must
record a dated old/new hash amendment after this freeze.

## Attribution clarification after freeze

Amendment date: 2026-10-01 UTC. Author: `T-0205-oracle`.
Authority for this attribution-only clarification: the user's explicit request
after the original freeze at 2026-10-01T21:33:00.786Z.

The earlier sentence, "The operator reports separate R2 reviewer authority",
misattributes the coordinator's report to the human operator. The actual
authoriser is **Schrodinger `01a0f7b7-f68a-79b2-ba74-81cdddf2f3ef`**, the
independent R2 REVIEWER under Q015. The coordinator conveyed that verdict.
`org/tasks/T-0205.json` records the authoriser in `amendment_authority.authoriser`.
The verdict grants narrow authority after independent oracle freeze and intended
red; it is not final acceptance. This paragraph supersedes only the earlier
attribution. Behavioural requirements, test names and evidence are unchanged.

The original ledger LF SHA-256 is
`d4f7bea9a7d4fdf2ba73d3301814291c02a203aa7b3471356242d4d31be402b5`.
The original text and `tmp/t0205-oracle/freeze.json` remain preserved. The original
ledger also has a byte-preserving copy at
`tmp/t0205-oracle/ledger-original-freeze.md`. The dated old/new ledger hashes and
renewed three-file freeze are in
`tmp/t0205-oracle/freeze-attribution-amendment.json`. No behavioural oracle or
helper amendment occurred. Author writes cease after that receipt is saved.
