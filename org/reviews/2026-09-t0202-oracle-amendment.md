---
type: venture
summary: Dated T-0202 oracle amendment limited to Linux HTTP log-path relocation, with unchanged assertions and observed platform results
tags: [eos, testing, oracle-amendment]
date: 2026-09-30
author: 01a0ef6e-78e7-7290-9aac-e9af8a73ebcb
authoriser: Goodall
authoriser_id: 01a0ef6e-780c-77e2-9377-b20014518524
original_oracle_author_id: 01a0ef7c-4f50-7ce3-88ba-5b8029ea0672
authority: Q-015, exact amendment authorised by the operator on 2026-09-30
reason: Global /tmp/ relocation rewrote the Linux tempfile workspace itself and prevented actual cases from launching
old_helper_sha256: c2fa52345a6aa07f8369f8dd21114c404e5c1d765ad009556bab58e2380ac3d9
new_helper_sha256: bb8a75c57f8d8434c4e4777e7aff9cfa6dadded0959ca7f4e7ea186da5a18b25
unchanged_suite_sha256: f5601e1420d246be1edca594e4ff0028ccb970ed235255f36cc33dff74ae35fc
hash_normalisation: UTF-8 file bytes with CRLF converted to LF
---

# T-0202 dated oracle amendment

Goodall authorised this exact one-line instrument amendment under Q-015.
The amendment author is a different session from both the implementation owner
and the original oracle author. This new record is append-only. The parent
coordinator stages these two files; this session made no commit.

At `tests/helpers/release-install-http-probe.py:200`, the global
`script.replace("/tmp/", f"{shell_path(fixture)}/scratch/")` became
`script.replace("/tmp/ch-http-smoke.log", f"{shell_path(fixture)}/scratch/ch-http-smoke.log")`.
Only the generated server log path is relocated. Linux workspace paths remain
intact. No other helper logic, assertion, test identity or application/harness
source was changed by this author.

The helper diff contains exactly one removed line and one added line. The
TypeScript suite has no diff against frozen red commit `10881bca`; its entire
normalised SHA-256 remains the value in the frontmatter. All 14 names, the
successful control and all assertions are preserved.

## Validation

The amendment author's Windows command was:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/release-install-http-smoke.test.ts --no-cache
```

Observed result: exit 0, one suite passed, 14 tests passed, zero snapshots,
27.169 seconds. The amended helper also passed Python `compile()` without
writing bytecode. No fixture credential was disclosed.

The final Linux run used disposable owned container
`ps-t0202-oracle-review-01a0ef6e-78e7`, existing image `47d80115ce62`,
`--rm --init --pull=never --network=none --read-only`, executable temporary
storage `--tmpfs /tmp:rw,exec,nosuid,nodev`, and only two read-only bind mounts:
the amended helper and the current install harness under `/review/tests/`.
No production data, volume, credential or application service was mounted or
launched. The container entry point was `/opt/hermes/.venv/bin/python3`.

The Python wrapper invoked the equivalent of this command in `/review`:

```bash
PYTHONDONTWRITEBYTECODE=1 T0202_BASH=/usr/bin/bash python3 tests/helpers/release-install-http-probe.py
```

The wrapper parsed all 14 observations and asserted expected acceptance,
launch counts, owned cleanup, deadline completion, decoy preservation, signal
ownership, request bounds and absence of credential leakage. It exited 1 with
18 failed checks across nine cases, in 59.184 seconds. The raw helper's JSON
generation succeeding is not an assertion pass. Linux Jest was not run.

| Preserved frozen test name | Linux accepted | ownedStopped / withinDeadline |
| --- | --- | --- |
| F00 fixture control launches, serves 200/401/200 and stops only its owned process | true | true / true |
| H01 accepts public health 200, anonymous 401 and authenticated 200 with owned cleanup | true | true / true |
| H02 rejects a credential refused by the server | false | false / false |
| H03 rejects anonymous protected access returning 200 | false | false / false |
| H04 rejects public health 204 | false | false / false |
| H05 rejects public health 503 | false | false / false |
| H06 rejects a public health redirect | false | false / false |
| H07 rejects an anonymous protected redirect | false | false / false |
| H08 rejects an authenticated protected redirect | false | false / false |
| H09 rejects authenticated protected access returning 403 | false | false / false |
| H10 rejects a dead launch | false | true / true |
| H11 rejects an occupied listener and preserves the unrelated process | false | true / true |
| H12 bounds stalled HTTP requests and cleans up without the fixture watchdog | false | false / false |
| H13 bounds cleanup of a launched process that ignores TERM | true | true / true |

All 14 acceptance outcomes match their expected values. Five cases satisfy the
checked Linux invariants. Nine negative cases hit the fixture watchdog and fail
the two cleanup/deadline observations. Every case preserved the decoy, recorded
only owned signals and reported both credential-leak fields false. Every case
launched once except occupied-listener, which correctly launched zero times.
The same nine failures occurred in an earlier amended-helper Linux run in an
existing container, taking 59.150 seconds.

A redacted diagnostic for wrong-credential recorded watchdog status 124,
no signal entries, and an owned child alive at the observation point. The
helper exports its own Bash `kill()` shim, including a bare `return` in its
`-0` branch. Its behaviour inside a nonzero EXIT trap is a candidate instrument
compatibility issue. These fixture results do not establish a product cleanup
defect. No further frozen-helper amendment or product change is made here.
The all-green Linux proof requested by the operator was not obtained.

## Invalid results and limits

The original `tmp/t0202-linux-probe.json` result predates this amendment.
Its successful control and zero launches in the actual cases exposed the
global `/tmp/` rewrite. It is an invalid instrument result, not a semantic
product failure or a mutation kill.

An initial disposable-container attempt omitted `exec` from the temporary
mount. Both fixture launchers failed to execute; all actual launch counts were
zero and the positive controls failed. Its 25.116-second result is also invalid
for behavioural acceptance. The final executable-mount run above supersedes it.

The fixture accelerates sleeps and curl timeouts and uses an external watchdog.
These observations do not prove the unscaled 75-second production harness,
the full release matrix, hosted CI or real application behaviour. Assertions
were not weakened to make Linux green.

## Role boundary

This record covers the authorised instrument amendment and its validation.
The author did not implement the harness repair. The operator reported
Goodall's acceptance of the scoped implementation and then explicitly ended
further implementation review in this session. No implementation acceptance is
claimed by this amendment record. The full Jest run, full gate, mutation sweep
and release matrix remain the coordinator's work.

## Provenance correction, 2026-09-30

The specific amendment authoriser was independent REVIEWER Goodall
(`01a0ef6e-780c-77e2-9377-b20014518524`) under Q-015. The coordinator relayed
Goodall's ruling. There was no additional operator approval specific to this
amendment on 2026-09-30. The earlier frontmatter wording, "exact amendment
authorised by the operator on 2026-09-30", overstates the authority and is
superseded by this correction. The earlier entry remains as ledger history;
no prior text has been edited.

## Second exact amendment, 2026-09-30

- Author: `01a0ef6e-78e7-7290-9aac-e9af8a73ebcb`.
- Authoriser: independent REVIEWER Goodall,
  `01a0ef6e-780c-77e2-9377-b20014518524`, under Q-015.
- Authority: Goodall's specific ruling relayed by the coordinator; no additional
  operator approval specific to this amendment is claimed.
- Old helper SHA-256: `bb8a75c57f8d8434c4e4777e7aff9cfa6dadded0959ca7f4e7ea186da5a18b25`.
- New helper SHA-256: `d5bb88e8fd2fabfde3691ecb0446112952d6e55afecef42c6b2a9f40a238599e`.
- Unchanged suite SHA-256: `f5601e1420d246be1edca594e4ff0028ccb970ed235255f36cc33dff74ae35fc`.
- Hash normalisation: UTF-8 file bytes with CRLF converted to LF.

Reason: in a nonzero Linux EXIT trap, the kill shim's bare `return` inherited
that trap's status instead of reporting the successful builtin liveness check.
The fixture falsely considered its live child absent and waited without sending
TERM. Goodall independently reproduced native builtin, stock shim and explicit
status behaviour in `tmp/t0202-review-cleanup-debug.json` and `.ps1`.
The earlier nine Linux cleanup/deadline failures were an instrument defect.

The only helper change replaces
`if [[ "$1" == -0 ]]; then builtin kill "$@"; return; fi`
with
`if [[ "$1" == -0 ]]; then builtin kill "$@"; return "$?"; fi`.
Reversing this single replacement reconstructs the recorded old normalised hash.
Python syntax passed without bytecode output. All 14 frozen test names, the
control and every TypeScript assertion remain unchanged. The harness was not
edited. No default-path cases were added and no commit was made.

The Windows rerun used the same focused Jest command recorded above. Observed:
exit 0, one suite passed, 14 tests passed, zero snapshots, 28.921 seconds.

The Linux rerun used the same disposable owned container, image `47d80115ce62`,
executable `/tmp` tmpfs, isolated network and two read-only test mounts recorded
above. The Python wrapper mirrored all frozen Jest assertions over the helper's
14 JSON observations. Observed: exit 0, 14 cases, zero semantic failures,
11.610 seconds. Linux Jest itself was not run.

Control, healthy and stubborn returned `accepted=true`; every adverse case
returned `accepted=false`. Every case reported `ownedStopped=true`,
`withinDeadline=true`, `decoySurvived=true` and `signalsOwned=true`. Both
credential-leak fields were false in every case. Request bounds, exact response
expectations and the occupied-listener control also passed. Every case launched
once except occupied-listener, which correctly launched zero times.

This successful rerun supersedes the earlier Linux validation limitation for
these 14 instrumented cases. Earlier entries remain unchanged as ledger history.
The scaled-fixture and release-evidence limits still apply. This entry records
only the independently authorised instrument amendment and its validation.

## Suite teardown amendment, 2026-09-30

- Author: independent ORACLE `01a0efb3-e5c7-7811-ad99-a4e58e4342f6`.
- Authoriser: independent REVIEWER Goodall,
  `01a0ef6e-780c-77e2-9377-b20014518524`, under Q-015.
- Authority: explicit Goodall ruling relayed by the coordinator on 2026-09-30.
- Starting HEAD: `3455d94cf4eb34c2aac03e21326be745e03b3535`.
- File: `tests/unit/missions-delete-null-check.test.ts`.
- Old SHA-256: `c767a9892bc0132faae3de2483936258401a8c2335cd1ddc08ddca341577c5b6`.
- New SHA-256: `c7c82db9bed6ed30b9f95bae35a1b5b777e395fe72afe1c5658f81d6661157d8`.
- Hash normalisation: UTF-8 file bytes with CRLF converted to LF.

Reason: the coordinator's full Jest handle diagnostic identified one remaining
SyncScheduler interval started by this suite's POST route. The authorised
`afterAll` calls the existing `getSyncScheduler().stop()` API. Suite-level cleanup
preserves the initialised sync layer during all four tests; `afterEach` would
change subsequent POST lifecycle behaviour. All four names, assertions and mocks
are byte-identical after removing this single additive block. No source change,
route mock or forced Jest exit was introduced.

Validation command on Windows:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/missions-delete-null-check.test.ts --detectOpenHandles --no-cache --json --outputFile=tmp/t0202-defaults-oracle-teardown.json
```

Observed: actual process exit 0, one suite passed, four tests passed, zero pending
tests, zero snapshots, 1.473 seconds. Structured JSON reports `openHandles: []`.
The command returned normally without `--forceExit`; the accompanying log is
`tmp/t0202-defaults-oracle-teardown.log`. This focused result does not establish
the coordinator's separate full-gate outcome. No commit was made.

## Default-install oracle extension, 2026-09-30

- Author: independent ORACLE `01a0efb3-e5c7-7811-ad99-a4e58e4342f6`.
- Authoriser: independent REVIEWER Goodall,
  `01a0ef6e-780c-77e2-9377-b20014518524`, under Q-015.
- Authority: Goodall's default-fixture ruling relayed by the coordinator on
  2026-09-30; this extension starts after the preceding shim author's hand-off.
- Starting HEAD: `3455d94cf4eb34c2aac03e21326be745e03b3535`.
- Old helper SHA-256: `d5bb88e8fd2fabfde3691ecb0446112952d6e55afecef42c6b2a9f40a238599e`.
- New helper SHA-256: `f1c569875985e2a62f1e90b149f166fb394224e9e33f043cf0683ff2886c4523`.
- New suite: `tests/unit/release-install-http-defaults.test.ts`, previously absent.
- New suite SHA-256: `a09b0d4cc31c852764850d5367e424ad1772f5d8731ec25e46de5637488388a4`.
- Unchanged original suite SHA-256:
  `f5601e1420d246be1edca594e4ff0028ccb970ed235255f36cc33dff74ae35fc`.
- Harness executed for these red observations, SHA-256:
  `99cee7ad1526a0feb1b786d008562a1ec12cda84661993bec4a763a1e4c2baa4`.
- Hash normalisation: UTF-8 file bytes with CRLF converted to LF.

Reason: the existing harness rejects a supported fresh default installation
before launch because no explicit data setting exists. The coordinator recorded
that refusal in `tmp/t0202-release-install-matrix.log:625`. This extension freezes
new semantic expectations before the coordinator implements a fallback. The
independence method is separate-session oracle-first authoring from the brief and
the existing runtime discovery contract, with differential HTTP response controls.
The helper executes the current harness through its existing interception; this
author does not change the harness or any application source.

Each new fixture has an owned HOME, no data environment keys, and `.env.local`
containing only PORT. Fresh credentials reside at
`HOME/patterstage/data/auth-token`. The uppercase cases create a real populated
SQLite database, covering both supported names. On Linux, an existing lowercase
directory contains no database and has a separate stale token. Selecting that
token would produce an authenticated 401. Valid HTTP cases require 200/401/200,
one owned launch, bounded requests and cleanup, preserved decoy processes, and
no credential in output or generated scripts. Leak checks include every new
fixture credential. The original control script, 14 identities and TypeScript
assertions remain unchanged; invoking the helper with no arguments still runs
only those 14 cases.

The wrong-default-token case requires an actual authenticated request returning
401. A pre-launch configuration rejection therefore fails its matcher. Two
independent default controls launch outside the harness's guard and prove actual
200/401/200 and 200/401/401 sequences using real curl and the token files. Their
`accepted=true` means successful fixture execution, including the deliberately
refused wrong-token request; it is not application acceptance of that token.

Windows NTFS aliases `PatterStage` and `patterstage` in these fixtures. Windows
does not claim physical separation or a second stale token. Both uppercase cases
assert the observed alias qualification, and D06 exercises the runtime resolver
with logically distinct candidate paths. Linux independently asserts physical
separation, distinct stale credentials and absence of a lowercase database.
No assertion was skipped or weakened to make either platform green.

### Frozen names and results

| New test name | Windows Jest | Linux assertion wrapper |
| --- | --- | --- |
| D00 default fixture control serves 200/401/200 from its owned HOME | pass | pass |
| D01 accepts a fresh default install with only PORT and a file token | red | red |
| D02 prefers uppercase patterstage.db over a stale lowercase token | red | red |
| D03 prefers uppercase control-hub.db over a stale lowercase token | red | red |
| D04 rejects the wrong default file token after a real authenticated request | red | red |
| D05 default fixture wrong-token control serves 200/401/401 | pass | pass |
| D06 runtime discovery selects a populated uppercase path over an existing empty lowercase path | pass | not run in Linux wrapper |

Windows command, with `PYTHONDONTWRITEBYTECODE=1` inherited by the helper:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/release-install-http-defaults.test.ts --no-cache --json --outputFile=tmp/t0202-defaults-oracle-red.json
```

Observed: actual process exit 1, four failures, three passes, zero pending tests,
zero runtime-error suites, 4.893 seconds. Each failure contains a structured
`matcherResult`: D01-D03 use `toBe` because `accepted` is false; D04 uses `toEqual`
because the request list is empty. These are semantic failures. The log is
`tmp/t0202-defaults-oracle-red.log`.

The original Windows command changes only `--runTestsByPath` to
`tests/unit/release-install-http-smoke.test.ts` and `--outputFile` to
`tmp/t0202-defaults-oracle-original-green.json`. Observed: actual process exit 0,
14 passes, zero pending tests, 28.659 seconds. All 14 original assertions remain
green with the extended helper. The suite's recorded hash is unchanged.

Linux used disposable owned container `ps-t0202-defaults-01a0efb3-e5c7`, existing
image `47d80115ce62603fa0cab8af2b8d1816c5e800fbae851f7e66608435cfbb76f7`,
and Python entry point `/opt/hermes/.venv/bin/python3 -`. The `docker run` flags
were `--rm --init --pull=never --network=none --read-only`,
`--tmpfs /tmp:rw,exec,nosuid,nodev`, `--workdir /review`,
`--env PYTHONDONTWRITEBYTECODE=1` and `-i`. Two read-only bind mounts supplied
only the current helper and harness at their corresponding `/review/tests/`
paths. A Python wrapper supplied on stdin imported the helper, ran all original
14 cases and all six default cases with `/usr/bin/bash`, and asserted the
corresponding acceptance, response, ownership, bound, secrecy and fixture
metadata conditions. It recorded failed checks and observations in
`tmp/t0202-defaults-oracle-linux.json`; stderr is in the matching `.log`.

Observed: actual Docker process exit 1, 14.630 seconds. All 14 original cases
passed, with zero failures. Six new HTTP cases yielded two passes and four
semantic failures. Both uppercase fixtures reported `physicalCaseDistinct=true`,
`staleTokenDistinct=true` and `lowerHasDatabase=false`. The same four actual
harness cases produced no HTTP requests and no launch. Both independent
default controls recorded their complete required real HTTP sequences and owned
cleanup. Linux Jest and the D06 TypeScript resolver test were not run.

### Instrument error and other checks

The first Windows extension attempt failed during fixture cleanup because a
SQLite connection remained open. A Python connection context commits but does
not close the handle. The helper now explicitly closes and commits its owned
fixture connections. The initial result is preserved at
`tmp/t0202-defaults-oracle-infrastructure-error.json` and `.log`; its seven setup
failures are invalid red evidence. The successful structured red run above
supersedes it. No failing semantic assertion was removed.

Python `compile()` passed without writing bytecode. Targeted ESLint for the new
suite and the authorised teardown passed with exit 0. Test TypeScript via
`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tests.json` passed
with exit 0. `node scripts/tooling/line-census.mjs --report` exited 0 and recorded
`testRepeatedWindowLines=4794`, unchanged and below the fixed C4 ceiling of 4800.
Counted TypeScript test lines increased from 138764 to 138872. The normal census
comparison reports that expected growth as exit 1 until the coordinator updates
the baseline with its reason. This author does not edit that coordinator-owned
file. The report is `tmp/t0202-defaults-oracle-census.json`.

This entry is appended to the existing ledger. It records a frozen red oracle
and bounded controlled-listener evidence, not a fallback implementation, full
Jest run, release matrix or hosted acceptance. No commit was made.

## Interactive oracle extension, 2026-09-30

- Author: independent ORACLE Kuhn, `01a0efe4-18ed-7f61-a92b-52d5837d1359`.
- Authoriser: independent REVIEWER Goodall,
  `01a0ef6e-780c-77e2-9377-b20014518524`, under Q-015.
- Authority: Goodall explicitly authorised the revised portable/native scope and
  precise choices; the parent coordinator relayed that ruling on 2026-09-30.
  This is scope authorisation, not final implementation acceptance.
- Starting and frozen implementation HEAD:
  `5be227125a5ea0e4a5b43533c14a482d8061609a`.
- New suite: `tests/unit/release-install-interactive.test.ts`, old hash absent,
  frozen SHA-256 `3ddbf20d8abdfbd685325bbeabe30573b6905873d605ed99bc12dda8948557ad`.
- New helper: `tests/helpers/release-install-interactive-probe.py`, old hash absent,
  frozen SHA-256 `d5c0590c0f3c94e54b2d41905e9e8b09034868d7c889ad5b44e6dcd3399aaa0f`.
- Unchanged harness SHA-256:
  `0fd3d085f1541873eed95f8682ca98513886e629c69eb81b62bcb9b3cfc697c0`.
- Prior ledger prefix SHA-256:
  `3035a70890637a28b49d0b37e7705e31eef1f6a01fcaa43727792367701b8ee0`.
- Hash normalisation: UTF-8 file bytes with CRLF converted to LF.

Reason: the HTTP-enabled real release matrix passed its 11 non-interactive
scenarios, then setup waited at an unanswered catalogue prompt. This independent
session captures Tcl by calling all four actual Harness scenario methods with
preparation and unrelated path/HTTP methods stubbed. The actual QA shell
assertions are captured unchanged. The independent fixture contract comes from
the task, brief and literal current installer prompts. No repair implementation
was authored or observed. Only the two new oracle files and this appended entry
were written; no harness, installer, application, claim, task or baseline edit and
no commit was made by this author.

Goodall approved these ordered choices. Port uses Enter and Advanced uses `n`:

| Scenario | Catalogue | Other choices |
| --- | --- | --- |
| `setup_interactive` | `y` | none |
| `install_in_repo_interactive_profiles_no` | `n` | missing profiles `n` |
| `install_in_repo_interactive_profiles_yes` | `n` | missing profiles `y` |
| `install_bootstrap_interactive` | `y` | Hermes `n`, profiles `n`, Hindsight `s` |

Live source verification found setup.sh:282's catalogue prompt, install.sh:123's
`Copy missing bundled profile files to Hermes now? [y/N]:`, and install.sh:397's
`Choice [d/n/s]:`. The old in-repo profile and Hindsight Tcl patterns are stale.
At the current Hindsight prompt, `n` requests native installation; `s` preserves
the existing skip intent. Goodall explicitly authorised that semantic correction.
The installer was not changed. Source hashes at verification:
setup.sh `9969f25e478cc3d2d91e62dc153f0e81eb82d330b21ac6f2c8ae585bec4b2355`;
install.sh `70a052d67d5acc28cad2bff8da134a685cbc288e9183fd8e1b7521ea0ec5fafc`.

### Frozen portable red and HTTP preservation

Default Jest calls the helper with Python standard-library tooling only. It
asserts the ordered expect/send protocol emitted by the actual methods, the
preserved QA assertions, one captured finally-cleanup call, and all 15 identities.
This is generated-protocol assurance. It does not execute Tcl or prove installer
completion. No Docker/Expect dependency, skip, new dependency or CI change was
added to default Jest. Host inspection found Python 3.14.4 and no Expect or Tclsh.

| Frozen portable name | Result |
| --- | --- |
| I00 emitted setup protocol answers the catalogue after port and Advanced | red |
| I01 emitted profiles-no protocol declines catalogue and missing profiles | red |
| I02 emitted profiles-yes protocol declines catalogue and accepts missing profiles | red |
| I03 emitted bootstrap protocol accepts catalogue and skips optional installs | red |
| I04 capture preserves all 15 release identities without a native unit-test dependency | pass |

The combined focused Jest run exited 1: 26 tests, 22 passes, four failures, zero
pending tests and zero runtime-error suites, 40.196 seconds. The 14 original HTTP
cases and seven default cases all passed. Structured results and log are
`tmp/t0202-interactive-oracle-red.json` and `.log`. Each new failure has a
structured matcherResult for missing expect/send operations (`toHaveLength`).
The final focused portable rerun exited 1 with four failures, one pass and zero
pending/runtime-error cases, 0.526 seconds, recorded in
`tmp/t0202-interactive-oracle-protocol-red.json` and `.log`.

All frozen HTTP files remain unchanged:

- Original suite SHA-256:
  `f5601e1420d246be1edca594e4ff0028ccb970ed235255f36cc33dff74ae35fc`.
- Defaults suite SHA-256:
  `a09b0d4cc31c852764850d5367e424ad1772f5d8731ec25e46de5637488388a4`.
- HTTP helper SHA-256:
  `f1c569875985e2a62f1e90b149f166fb394224e9e33f043cf0683ff2886c4523`.

### Separate native Expect red

The companion runs `python3 /oracle/probe.py --native --assert` in the existing
image `patterstage-fulltest:latest`, inspected without pulling and then addressed
by immutable image ID:
`sha256:aff42dcc8f30c278fdcf5d2321fcb4263ff229a626b778814ed5f90e9cd11da4`.
Observed versions: native Expect 5.45.4, Tcl 8.6.13, Python 3.11.2
(`[GCC 12.2.0]`, build May 12 2026 05:17:27), GNU Bash 5.2.15(1)-release,
Linux amd64. The container flags are `--rm --init --pull=never --network=none
--read-only --tmpfs /tmp:rw,exec,nosuid,nodev`, with bytecode disabled and exactly
two read-only bind mounts: the new helper at `/oracle/probe.py` and unchanged
harness at `/oracle/harness.py`. No application, operator data, network, download
or additional image/dependency is used.

Only the captured Tcl spawn command is substituted to run a deterministic owned
installer. Actual expect/send/timeout/exit commands remain intact. The fake emits
literal current prompts, records each answer, uses single-character terminal
input for Hindsight, and models catalogue/profile QA-file effects. Four independent
complete Tcl drivers must succeed with correct ordered answers, effects, QA
assertions and owned cleanup before actual-driver evidence is collected.

Final native result: actual Docker exit 1, ten cases, six passes, four semantic
failures and zero infrastructure errors. The four `control:<scenario>` cases,
`malformed-control`, and `catalogue-contamination-control` pass. Each actual
scenario launches once, answers port/Advanced (and bootstrap Hermes), then stalls
at `catalogue`, classified `missing-answer`, with `completed=false`. The four-second
fixture watchdog stops only the recorded owned installer/Expect processes. Every
case reports ownedStopped, decoySurvived, signalsOwned and withinDeadline true.
Aggregate native case duration: 16.328 seconds. JSON and stderr are preserved at
`tmp/t0202-interactive-oracle-native-final.json` and `.log`; the JSON binds the
executed helper/harness hashes and original captured-driver hashes.

The malformed control has exit 1, zero launches, no watchdog and classification
`tcl-error`. The adverse catalogue control completes but creates QA files, so the
preserved profiles-no absence assertion fails as required. These controls keep
instrument errors and catalogue/profile conflation separate from valid timeout
counterexamples. Missing tools or failed successful controls exit 2, never pass.

Two earlier attempts are invalid behavioural evidence: the preliminary Docker
unit run failed before any control because its Tcl preflight passed the filename
incorrectly; an intermediate native rerun hit a cleanup race after the owned
child exited. Those results are retained in
`tmp/t0202-interactive-oracle-preliminary.json` and
`tmp/t0202-interactive-oracle-native-red.log`. The final helper corrects the
preflight and tolerates an already-exited owned child. No semantic assertion was
weakened. The successful final native result supersedes both instrument failures.

### Identity, checks and limits

The captured exact release identity set is:

```text
fresh, hermes, dashboard, both, update, restart, rebuild, install_bootstrap,
install_in_repo, update_preserves_user_data, update_runs_seed_catalog,
setup_interactive, install_in_repo_interactive_profiles_no,
install_in_repo_interactive_profiles_yes, install_bootstrap_interactive
```

Python syntax via compile(), targeted ESLint and test TypeScript exited zero.
The census report exited zero: testRepeatedWindowLines remains 4794, below the
fixed ceiling 4800; counted test lines are 138942, a 70-line increase over the
preceding extension. The report is `tmp/t0202-interactive-oracle-census.json`.
This author did not edit the baseline or claim normal baseline comparison passed.

Native evidence covers captured scenario dialogue with independent owned fake
installer effects. It does not prove actual installation, catalogue SQLite
contents, real application HTTP behaviour, production duration/cleanup, hosted
CI or full Jest. Actual native drivers stop at catalogue, so the later stale
profile/Hindsight patterns are established by source inspection and portable
contract assertions, not reached in these red executions. The existing QA
absence/presence assertions and all scenario identities remain intact. The
coordinator must commit this authorised red oracle before source repair, then
rerun native proof, the unchanged full gate, mutation sweep and all 15 real
HTTP-enabled installation scenarios. No release acceptance is claimed here.
