# T-0203 independent oracle amendment

## 2026-09-30: preserve the selected Bash on Darwin

- Author: independent ORACLE session `01a0f0cf-033e-7b82-af84-94713bfa5bd7`.
- Authoriser: independent REVIEWER Goodall, under the R2 Q-015 amendment rule.
- Authority: Goodall's exact-proposal authorisation and the committed T-0203
  brief and claim expansion at `d200c707` and `2222fae1`. The operator's general
  programme implementation request provides the wider task scope. This is
  not a new operator approval or ADR decision.
- Proposal: `tmp/t0203-macos-amendment-proposal.md`, LF SHA-256
  `090e28fd1a93ec22f40367babba5e553044029e0b8278f8970071273fb26c01f`.
- Amended file: `tests/helpers/release-install-http-probe.py`.
- Old LF SHA-256:
  `5b36c32e905b51dca3681e3a67db4cd3aa5fca342c7faececf0d166cdd4fbedf`.
- Authorised new LF SHA-256:
  `5a807ccd3ee885890934ceb0b3b23b8072f30a1b5dcc9bd84a30c255d0852de8`.

This provenance entry is written before the helper change. The new hash is
the authorised target, not an execution or verification result.

Reason: Apple Bash 3.2's read builtin accepts only integer timeout arguments.
The existing fixture requires fractional reads, expiry status 142 and dynamic
file descriptors. Its original supervisor PATH would select native Bash for
the timeout child and env shebangs even after Python selects Homebrew Bash.
Primary evidence is Apple's `bash-3.2/builtins/read.def:195-205` and the GNU
Bash 4.0 release announcement's fractional-timeout addition.

- <https://raw.githubusercontent.com/apple-oss-distributions/bash/main/bash-3.2/builtins/read.def>
- <https://lists.gnu.org/archive/html/bug-bash/2009-02/msg00164.html>

Change only SUPERVISOR's initial PATH export to the following authorised block:

```bash
if [[ "$OSTYPE" == darwin* ]]; then
  export PATH="$T0202_ROOT/bin:${BASH%/*}:/usr/bin:/bin:$PATH"
else
  export PATH="$T0202_ROOT/bin:/usr/bin:/bin:$PATH"
fi
```

The non-Darwin export retains its exact original bytes. All other helper bytes,
functions, deadlines, iterations, real curl selection, assertion files and
test identities remain unchanged. This record does not amend the historical
T-0202 record or its existing amendment ledger.

Acceptance limits: exact diff/hash comparison and the unchanged 21 Windows
HTTP/default assertions will be recorded separately after execution. Linux
controls and native macOS interpreter/curl selection, fractional timer and
original-PATH negative controls remain coordinator obligations. Authorisation
alone does not establish fixture success, mutation kills or hosted acceptance.

## 2026-09-30: author verification receipt

After applying the block, a comparison against `git show HEAD:` proved the
entire LF-normalised helper equals the previous helper with only that single
replacement. Its observed LF SHA-256 equals the authorised target above.
The original non-Darwin export and every other LF-normalised byte are retained.

The unchanged Windows HTTP/default suites exited zero: 21 passed, zero failed,
zero skipped and zero suite runtime errors. Command:

```text
npm test -- --runInBand --runTestsByPath tests/unit/release-install-http-smoke.test.ts tests/unit/release-install-http-defaults.test.ts --json --outputFile=tmp/t0203-windows-http.json
```

The independent new oracle's final candidate exited one: three calibration
controls passed, 23 intended matcher failures, one explicitly macOS-scoped
new native case skipped on Windows, zero suite runtime errors. The failures
are 22 missing-script matchers plus the missing macOS workflow step matcher.
No script implementation exists. Command:

```text
npm test -- --runInBand --runTestsByPath tests/unit/release-test-tools.test.ts --json --outputFile=tmp/t0203-oracle-red-ready.json
```

F00 proves the resolved paths point at the instrumented tools and records all
five timeout calls while executing real GNU identity, child status 37, expiry
124, kill-after 137 and real Bash fractional/dynamic-descriptor behaviour.
F01 calibrates the fake Homebrew installation. F02 records two calls per
negative timeout and Bash control, checks their resolved paths and incorrect
semantics, and proves the absent timeout cannot fall back to a host executable.
The launcher removes duplicate case-insensitive PATH keys and restores its
isolated PATH inside the already launched Bash process.

Earlier instrument failures remain in `tmp/t0203-oracle-red.json/.log` and
`tmp/t0203-oracle-red-v3.json/.log`: raw MSYS signal reporting and Git launcher's
host PATH insertion, respectively. Neither is a product failure or mutation
kill. The final controls passed after those driver defects were corrected.
The final TypeScript correction is an explicit `NodeJS.ProcessEnv` annotation;
`npm run typecheck:tests` and focused ESLint both exited zero.

N01 executes only the helper's initial routing block and is intended to prove
modern parent/bare/env-shebang interpreter paths and versions, fractional
expiry and dynamic descriptors, real curl path and before/after binary hash,
native Bash rejection, and the original-PATH negative on hosted macOS. N01
has not executed here. Linux, native macOS and exact-head hosted acceptance
remain coordinator obligations. This receipt is technical evidence, not an
independent acceptance verdict. No commit, implementation or workflow edit
was made by this oracle author.

## 2026-09-30: noisy Homebrew installation stdout regression

- Author: independent clean-context ORACLE session `01a0f0f5-ee39-7c43-a378-f7ec83e3fbb7`.
- Authoriser: independent REVIEWER Goodall, explicit Q-015 authorisation on 2026-09-30.
- Authority: committed `org/briefs/T-0203-noisy-install-oracle.md` and exclusive test/ledger claims at `b13bb2035a076467c8368d484e2070c548cfa488`. The operator explicitly instructed this authorised additive amendment.
- Provenance date: `2026-09-30T06:27:17.576Z`.
- Amended file: `tests/unit/release-test-tools.test.ts`.
- Old LF SHA-256: `6e4382247e521b90e9362a17a4db6eb5fe30b2f35b35ba43e06b9de7d7dcdf0a`.
- Authorised target LF SHA-256: `6ebdcaf032074b24b2ed5acfe5ea4463d378db1c0298618f86a5a29f89bbbffd`.
- Preserved ledger prefix: 5361 bytes, raw SHA-256 `de95ccb43e8abb66daea25a3a46fd933b93455e6f5c162bda8378b1d0de57c24`.

This provenance is appended before the test change. The target hash is the prepared additive candidate, not a test result. Reason: the dependency contract permits Homebrew install progress on stdout, but the frozen installer stub was silent. Add only optional `noisyInstall`, explicit default-off `T0203_NOISY_INSTALL`, one stdout progress line per installed formula, and `P20 macOS install stdout logs do not corrupt resolved tool paths`. P20 first proves exact non-path stdout and normal exit using a separate noisy control fixture. It then uses a fresh noisy fixture to require setup success, exactly one installation of each formula, and unchanged `assertReady` publication/resolution/behaviour assertions. It retains the existing 20,000 ms success-case bound and 15,000 ms process watchdog.

All 27 original expanded identities, complete case calls including bodies/assertions/bounds, and all prior fixture/helper bytes are retained. Removing the four inserted blocks reconstructs the exact frozen input. The suite now has 28 identities. No implementation or workflow is read or edited, and no existing test is skipped or relaxed by the amendment. Native macOS, source repair, integration and the wider gate remain coordinator obligations.

### Bounded red receipt and frozen handoff

One full run of this single 28-identity suite against the current implementation exited normally with status 1: 26 passed, only P20 failed, one unchanged native-macOS N01 platform skip, zero suite runtime errors. Runtime reported by Jest: 33.798 s. Command:

```text
npm test -- --runInBand --runTestsByPath tests/unit/release-test-tools.test.ts --json --outputFile=tmp/t0203-noisy-install-oracle-red.json
```

P20 passed its separate installation control: normal exit 0 and exact stdout lines `==> Installing coreutils` and `==> Installing bash`. In its fresh fixture it then failed the setup-status matcher at `tests/unit/release-test-tools.test.ts:327`: expected 0, received 1. The launcher rejects spawn errors, signals and outer-watchdog expiry before that matcher, so this is an intended normal-exit regression red, not an infrastructure failure. P20 did not reach its later installation/publication matchers. Every original portable identity passed; N01 retains its original platform condition.

- Red receipt: `tmp/t0203-noisy-install-oracle-red.json`, raw SHA-256 `5e6318c372d7e42429cd405e61578c425ee03cf0ad1aa7f2f7183f043896ff22`.
- Observed frozen suite LF SHA-256: `6ebdcaf032074b24b2ed5acfe5ea4463d378db1c0298618f86a5a29f89bbbffd`.
- Identity/diff/prefix proof: `tmp/t0203-noisy-install-oracle-freeze.json`, includes all original and amended name/call hashes and the exact preserved ledger prefix length/hash.
- Static checks: focused ESLint and `git diff --check` exited 0; TypeScript parsing found zero syntax diagnostics. All 27 original case call hashes are identical. The test diff consists of four insertion blocks, 14 added lines, zero removed lines.

The original ledger prefix remains byte-identical: raw SHA-256 `de95ccb43e8abb66daea25a3a46fd933b93455e6f5c162bda8378b1d0de57c24`, LF SHA-256 `de95ccb43e8abb66daea25a3a46fd933b93455e6f5c162bda8378b1d0de57c24`, 5361 bytes. This section is solely an additive amendment and receipt.

Independent ORACLE freeze handed off with the hashes above; author writes cease here. Coordinator owns source stdout repair, integration, claims release and the wider gate. No source, workflow, claim, task or historical record was edited by this author. No commit was made. Native macOS and hosted acceptance remain unproved by this Windows run.

## 2026-09-30: specific amendment authority clarification

Dated clarification: `2026-09-30T06:30:59.956Z`. The earlier sentence "The operator explicitly instructed this authorised additive amendment." is superseded by this authority clarification. The specific P20 amendment authority is independent REVIEWER Goodall's R2 Q-015 authorisation and the coordinator's committed `org/briefs/T-0203-noisy-install-oracle.md` and exclusive claims at `b13bb2035a076467c8368d484e2070c548cfa488`, under the operator's general programme implementation request. No new specific operator ruling, human answer for P20 or ADR acceptance occurred or is claimed.

All prior ledger bytes are preserved. This clarification changes authority attribution only. The frozen test and red receipt retain their recorded hashes and outcomes. The independent ORACLE handoff remains frozen; author writes cease after this clarification.

## 2026-09-30: finite normal-expiry grace and delayed-TERM regression

- Author: independent clean-context ORACLE Euler `01a0f0f5-ee39-7c43-a378-f7ec83e3fbb7`.
- Authoriser: independent R2 REVIEWER Goodall `01a0ef6e-780c-77e2-9377-b20014518524`, Q-015.
- Specific authority: committed `org/briefs/T-0203-expiry-oracle.md` and exclusive two-path claims at `e53233fb73fb830557b95ca7c442f9fd70982750`, under the general operator programme implementation request. No new specific operator ruling or ADR acceptance.
- Date: `2026-09-30T07:17:31.013Z`.
- Old suite LF SHA-256: `6ebdcaf032074b24b2ed5acfe5ea4463d378db1c0298618f86a5a29f89bbbffd`.
- Authorised candidate LF SHA-256: `5842b5a4f1a5943c6076ac283fcfb1b6c4abd612dcb87ec64ed5ee679d53122a`.
- Preserved ledger prefix: 10729 bytes, raw SHA-256 `46d4e066dd950931795e9b0fbc50cf53726b1a5f78b428e2f21fb73c3a3f9228`.

Provenance is appended before the suite change. Reason: the loaded full gate observed F00 expiry 137 instead of 124; the isolated frozen suite passed. Scheduling dependence is a supported explanation, not proof of the precise KILL recipient or delay. Change only F00 normal-expiry kill grace from 0.2 to 2 seconds; retain 0.2-second expiry, sleep 2, exact 124, resistant-child 137, child 37 and fractional-read 142. All 28 original names and every other complete case call and bound are preserved.

Add P21 with a default-off delayedTerm fixture flag. Only the ordinary timeout invocation with kill-after, 0.2-second expiry and sleep 2 is instrumented. The instrument invokes the real discovered GNU timeout with the supplied grace, using --foreground to keep the controller outside child KILL delivery. Its sole monitored child is real Bash; delayed cleanup uses a 0.6-second builtin read on an owned FIFO and creates no sleeper child. The child records READY before TERM handling and CLEAN only after finite cleanup. GNU reaps its monitored child; the controller waits for GNU. An unconditional EXIT cleanup also signals/waits any still-owned GNU process, checks the temporary path boundary, removes the owned directory, and records reaping/cleanup witnesses. Startup, witness or watchdog failures are never accepted as red. No retries, skips, worker/scheduling changes or bound relaxations occur.

P21 requires strict 137 with 0.2-second grace and strict 124 with 2-second grace before testing prerequisite preparation. The preparation boundary must invoke the ordinary-expiry probe, retain owned cleanup witnesses and succeed with clean 124; unchanged installed/assertReady assertions follow. Existing fixture defaults, product and T-0202 deadlines remain unchanged. This test has the existing 20,000 ms case bound and 15,000 ms spawn watchdog. The two timing margins require calibration; finite timers do not guarantee progress under arbitrary starvation.

### 2026-09-30: preliminary instrument correction before red freeze

Date: `2026-09-30T07:25:02.220Z`. The first candidate `5842b5a4f1a5943c6076ac283fcfb1b6c4abd612dcb87ec64ed5ee679d53122a` and `tmp/t0203-expiry-instrument-first.json` are retained as a rejected calibration. P21 expected old-grace 137 but observed 124 before reaching preparation. That result is an instrument failure, not accepted source red or an accepted freeze. The installed actual GNU coreutils is 8.32; its foreground mode reports the short-grace forced termination as 124. No status assertion is weakened or normalised.

Within the same Goodall R2 Q-015 scope, change only the unfrozen delayed-TERM fixture control and new P21 witnesses. Remove --foreground. The controller explicitly waits/reaps its owned GNU process. GNU process-group escalation kills its monitored Bash child; after short-grace GNU death that child is adopted/reaped by the platform, not directly waited by the controller. The unconditional cleanup reads the owned child PID, sends KILL if necessary, and checks disappearance with at most 40 builtin waits of 0.05 seconds. A still-present child yields infrastructure status 90. These are lifecycle observation waits, not retries of either expiry probe. The private FIFO uses no child sleeper. Both owned temporary path boundary and removal are checked. P21 requires REAPED_GNU, REAPED_CHILD and CLEANUP witnesses; REAPED_CHILD means the owned PID is absent, not a direct wait by its original grandparent.

Isolated calibration of this corrected fixture observed actual old-grace 137 with READY/TERM and repaired-grace 124 with READY/TERM/CLEAN; both observed reaping and cleanup witnesses. Preparation has not yet been counted as red for this candidate. The previous preliminary --foreground ownership description and target hash are superseded only for this candidate; all earlier ledger bytes remain preserved.

- Author: Euler `01a0f0f5-ee39-7c43-a378-f7ec83e3fbb7`. Authoriser: Goodall `01a0ef6e-780c-77e2-9377-b20014518524`, R2 Q-015, committed expiry brief/claims at `e53233fb73fb830557b95ca7c442f9fd70982750`. No additional scope or new operator ruling.
- Frozen original suite LF SHA-256: `6ebdcaf032074b24b2ed5acfe5ea4463d378db1c0298618f86a5a29f89bbbffd`.
- Corrected candidate LF SHA-256: `3c1a991807d12cfe58bbdb83c6c321919211f38c9aea9bba17f4dd6e9033489c`.
- Entire prefix preserved for this append: 13554 bytes, raw SHA-256 `19dea9732d10c3933da97e61faf60981a2a5ed01a881406920b3a6beaab4edcc`.
- All 28 original identities retained. Every other original case call is exact; F00 differs only in approved normal-expiry grace 0.2 to 2. Existing 15,000 ms process and 20,000 ms case bounds remain intact.

### 2026-09-30: accepted expiry regression red and frozen handoff

Date: `2026-09-30T07:30:34.273Z`. The corrected default-process-group candidate is the accepted red oracle. The first foreground candidate and its expected-137/actual-124 receipt remain rejected instrument evidence. GNU's primary bug discussion reports older foreground mode returning 124 even with KILL: <https://lists.gnu.org/archive/html/bug-coreutils/2021-10/msg00049.html>. Installed actual GNU timeout identifies as coreutils 8.32. The corrected control uses default GNU process grouping, its parent outside that group, a builtin delayed read with no child sleeper, explicit owned-process wait/absence witnesses, unconditional cleanup and unchanged watchdogs.

One focused F00/P21 run exited normally 1 in 6.918 s: F00 passed; P21 passed actual-GNU old-grace 137/repaired-grace 124, all their event/reaping/cleanup witnesses, and preparation invocation/cleanup witnesses. P21 then failed only `state.prepare()` success at line 418, expected 0, received 1. Zero runtime errors. The 27 remaining identities were excluded by the command filter, not new skip code. Command:

```text
npm test -- --runInBand --runTestsByPath tests/unit/release-test-tools.test.ts --testNamePattern="F00 |P21 " --json --outputFile=tmp/t0203-expiry-oracle-red.json
```

- Accepted receipt: `tmp/t0203-expiry-oracle-red.json`, raw SHA-256 `36044aa20b9948391058605063338ee0f60f84404fa13783c1e236d4082a9e90`.
- Rejected instrument receipt: `tmp/t0203-expiry-instrument-first.json`, raw SHA-256 `84139103978442b5a2c59bfa622c7ccd6a071134b67a0b3f2ddb87bae6dc77b2`, never accepted as source red.
- Old suite LF SHA-256: `6ebdcaf032074b24b2ed5acfe5ea4463d378db1c0298618f86a5a29f89bbbffd`.
- Frozen new suite LF SHA-256: `3c1a991807d12cfe58bbdb83c6c321919211f38c9aea9bba17f4dd6e9033489c`.
- Complete preceding prefix retained: 16261 bytes, raw SHA-256 `fe6e93b13b4984ec96ea8c2cc5879a694f409812cd8c9effe531132b9b587798`. Original amendment prefix of 10,729 bytes also remains exact.
- Proof: `tmp/t0203-expiry-oracle-freeze.json`. Removing the new control/flag/env/P21 blocks and reversing only F00's approved literal reconstructs the exact old suite. All 28 names remain; every other complete case call/assertion/bound is exact. The suite has 29 identities. Focused ESLint and TypeScript parsing passed.

Author: independent clean-context Euler `01a0f0f5-ee39-7c43-a378-f7ec83e3fbb7`. Specific authority: R2 REVIEWER Goodall `01a0ef6e-780c-77e2-9377-b20014518524`, Q-015, committed expiry brief/claims at `e53233fb73fb830557b95ca7c442f9fd70982750`. No new operator ruling or extra authority. Source SHA-256 `b444b665e2e2649bca93a31410f9cf148565fb46acfa5fb22f5f9dc608f89a59` is coordinator/task attestation only; the implementation was not read or independently hashed. No source/workflow/T-0202 edits by this author.

Ownership limit: the controller directly waits GNU; after short-grace GNU death, the platform reaps its monitored child and the controller verifies that owned PID is absent. No direct grandparent wait is claimed. Arbitrary starvation, exact historical load cause, native macOS and broader gate acceptance remain unproved. Coordinator owns source repair, integration, claims release and broader gates. Accepted red handed off; author writes cease after this freeze.


## 2026-09-30: portable controls and honest infrastructure classification

Date: 2026-09-30T07:50:21.276Z. Author: fresh clean-context ORACLE Popper
`01a0f13e-503d-7033-a808-3cf55c2c5e72`, different from original author
Beauvoir and expiry-regression author Euler. Authoriser: independent R2
REVIEWER Goodall `01a0ef6e-780c-77e2-9377-b20014518524`, Q-015.
Specific authority: committed portable brief and exclusive two-lane claims
at `ee66f84ec8d7c5f1f630c9a979c4b92bf20e0d5a`. No additional operator ruling is claimed.

This entry precedes every tracked test/harness change. Target hashes are
prospective authorised amendment bytes, not test execution results.

- Frozen input main LF SHA-256: `3c1a991807d12cfe58bbdb83c6c321919211f38c9aea9bba17f4dd6e9033489c`.
- Complete preceding ledger prefix: 19585 bytes, raw SHA-256
  `b1d461c89d45c18bb5aadd93e2d7a20ef7f4da1fc7adbf98ff59adb53a58d17b`.
- Exact input snapshots and prospective identity proof:
  `tmp/t0203-portable-oracle/input-main.ts`, `input-ledger.md` and
  `prospective-proof.json` in that directory.

Authorised targets, LF SHA-256:

- `tests/unit/release-test-tools.test.ts`: `2d114ad550a60aa74cf9ea994b79f616ad322b87b233e44b35998a4c100c0dd5`.
- `tests/unit/release-test-tools-native.test.ts`: `3f6493615f88d036e11e8b4b92dc2e81ac0c66a2636f9892149d6a049fc45951`.
- `tests/helpers/release-test-tools-harness.ts`: `1fdd357a330f6fce7d1b1341b7959711c9ce4b8f2f35e228962b2ed77940a41e`.

Reason and scope: P21's direct actual-GNU status/event/call-log calibration
and preparation READY/TERM plus reaping/cleanup lifecycle assertions are
retained exactly, but a failure in either instrument section throws a fresh
ordinary infrastructure Error without matcherResult or nested matcher cause.
The GNU controller, actual 137/124 values, expiry 0.2, grace 0.2/2, sleep 2,
event sequences, ownership/absence checks and all bounds are unchanged.
P21 clears both calibration call and event logs before state.prepare(); its
same preparation-command condition now examines only fresh calls. Script
existence, preparation invocation, result status, complete prepared events,
installation and publication checks remain semantic matchers. Valid old-grace
137 still reaches the intended preparation-success failure.

N01 moves as an exact complete case call into its native suite, retaining the
same describe title, full name, callback bytes, assertions, Darwin condition
and 20,000 ms bound. Only the equivalent original launcher/discovery/cleanup
and supporting constants move to the shared helper, with exports added.
Whole-gate tool discovery, selected Bash, isolated PATH handling, launch
errors, 15,000 ms watchdog, 1,048,576-byte cap and owned temporary cleanup are
unchanged. No whole fake Homebrew fixture is copied. All 29 names occur once
across the two suites; portable registers 28 with zero skips. Every non-P21
complete case call, including approved F00 grace 2, is byte-identical in LF.

No implementation script or workflow has been read. No implementation,
frozen GNU HTTP fixture, runner, worker, metric, baseline, threshold or
historical-record change is made by this author. Execution evidence follows
as a separate append; native macOS and wider hosted acceptance remain open.

### Preliminary harness extraction correction before red freeze

Date: 2026-09-30T07:52:03.715Z. The first target omitted exports on the
original typed tools and roots declarations. The first portable run therefore
failed fixture initialisation before calibration; its receipt
`tmp/t0203-portable-oracle/red.json` is rejected instrument evidence, never
source red. Add only export to those two moved declarations. All original
harness statements, cases, bounds and the authorised amendment scope remain
unchanged. This entry precedes the correction.

- Previous prospective helper LF SHA-256: `1fdd357a330f6fce7d1b1341b7959711c9ce4b8f2f35e228962b2ed77940a41e`.
- Corrected target helper LF SHA-256: `e2660a75362260ab09625127173f61d7832e5a6f38b568ff75e828c773c02af7`.
- Entire preceding prefix: 22828 bytes, raw SHA-256 `f9b58540472041284b78382656d32a06ef6e503ad5c4e7bfbaa39b2ae18a45c7`.

Popper authors this correction under the same committed Goodall Q-015
portable brief/claims. No frozen handoff has yet occurred.

### 2026-10-01: portable amendment final evidence and frozen handoff

Date: `2026-10-01T13:52:04.190Z`. Fresh independent clean-context ORACLE
Pasteur `01a0f7b7-61b3-7d90-812e-1bcf2344aefe` completes provenance for
Popper's existing amendment bytes. Goodall's R2 Q-015 scope remains the
authority for the amendment. Fresh independent REVIEWER Schrodinger
`01a0f7b7-f68a-79b2-ba74-81cdddf2f3ef` returned PASS and authorised only
this final evidence/freeze append, conditional on the hashes and prefix below.
The operator relayed that authority and instructed the append. The renewed
ORACLE claim names Pasteur and expires `2026-10-02T13:45:32Z`. No further
test, harness, implementation or scope change is authorised or made here.

Frozen files, LF SHA-256, independently checked immediately before this append:

- `tests/unit/release-test-tools.test.ts`: `2d114ad550a60aa74cf9ea994b79f616ad322b87b233e44b35998a4c100c0dd5`.
- `tests/unit/release-test-tools-native.test.ts`: `3f6493615f88d036e11e8b4b92dc2e81ac0c66a2636f9892149d6a049fc45951`.
- `tests/helpers/release-test-tools-harness.ts`: `e2660a75362260ab09625127173f61d7832e5a6f38b568ff75e828c773c02af7`.
- Frozen input main LF SHA-256: `3c1a991807d12cfe58bbdb83c6c321919211f38c9aea9bba17f4dd6e9033489c`.
- Complete preceding ledger prefix: 23846 bytes, raw SHA-256 `0543bf1237f67d75e7b212c4ee0527ce4ec781e2578a764a07b3e1cda9ad9a0f`.
- Original input-ledger prefix: 19585 bytes, raw SHA-256 `b1d461c89d45c18bb5aadd93e2d7a20ef7f4da1fc7adbf98ff59adb53a58d17b`.

Pasteur independently compared the saved input, current files and prospective
proof using TypeScript syntax trees and read-only test registration. The exact
29-name union occurs once: 28 portable cases and N01 in the native suite.
Every non-P21 complete case call and other describe statement remains exact
after LF normalisation. N01's complete case/callback, Darwin condition and
20000 ms bound remain exact. Shared helper statements match the original
statements with exports added; discovery, isolated PATH, launch errors,
15000 ms watchdog, 1048576-byte output cap and owned cleanup remain unchanged.
The fixture and GNU controller statements are unchanged. No duplicate whole
Homebrew fixture was introduced. The saved census reports 4794 repeated test
window lines against the unchanged 4800 maximum; no census was rerun here.

All 11 P21 assertion token streams survive, with only the authorised removal
of the calibration-call slice after clearing both call and event logs.
Old-grace 137, new-grace 124, expiry 0.2, grace 0.2/2, sleep 2 and lifecycle
conditions remain exact. An initial read-only comparison flagged wrapper
indentation; the corrected token comparison passed without editing files.
The saved 12 synthetic classification controls agree with their expected
outcomes: eight infrastructure failures have neither matcherResult nor cause;
missing source, omitted preparation probe and valid old source retain semantic
matcher failures; valid new source passes. Those controls are classification
evidence only, not actual GNU or native acceptance.

Popper's saved actual portable red contains 27 passes, one intended P21 setup
status matcher failure (expected 0, actual 1 at line 375), zero skips and zero
suite runtime errors, in 41.655 s. The coordinator independently reproduced
the same 28-case result on 1 October in 35.846 s and attested normal exit 1
on unchanged implementation. Pasteur inspected both receipts; no GNU rerun
or fresh execution by Pasteur is claimed.

- Author red: `tmp/t0203-portable-oracle/red-final.json`, raw SHA-256 `d9f0880448e38e899c7b2f854917709719f12fef8cc8c8f38e3cd8c12ffff327`.
- Author log: `tmp/t0203-portable-oracle/red-final.log`, raw SHA-256 `db0cdd157920130a82e51cdb0fa2090362069bb3c493bc9fd10549fc45c7d43d`.
- Coordinator red: `tmp/t0203-portable-coordinator-red-20261001.json`, raw SHA-256 `09befbf1f3ea64bc7919c99a87089e881f38f0466340680c74bd7c2bc695a409`.
- Coordinator log: `tmp/t0203-portable-coordinator-red-20261001.log`, raw SHA-256 `e09493add3e03034a19443ec053dd3af99cde5241440afb2925658707121a750`.
- Classification controls: `tmp/t0203-portable-oracle/classification-controls.json`, raw SHA-256 `bb0e27245942de5f6bba27c6485a7ade840fc7331005f4fdf3041f932cc383f2`.
- Input/candidate proof: `tmp/t0203-portable-oracle/prospective-proof.json`, raw SHA-256 `f1aa7a3a7b30670820e31a7d6ea9657e5e4ce70c855ce08cd7c49da6f4d4e0a9`; its initial helper target is superseded by the preserved export-correction entry above.

Initial failed extraction receipt `tmp/t0203-portable-oracle/red.json`
(raw SHA-256 `ebf89d96753a24146b81f778f4e34b375a4928952583d40eb8ed6c2724dfe4fc`)
remains rejected instrument evidence. Euler's earlier rejected foreground
receipt and every previous ledger byte remain preserved. The saved Windows
native receipt records N01 skipped under its unchanged platform condition;
it establishes no native macOS acceptance.

Implementation SHA-256 `b444b665e2e2649bca93a31410f9cf148565fb46acfa5fb22f5f9dc608f89a59`
is task/coordinator/REVIEWER attestation only. Pasteur did not read or hash
implementation scripts or workflow. This handoff freezes the existing three
files and appends provenance only; no commit was made. Author writes cease
after this append and read-only prefix/hash verification. Coordinator owns
source repair, records, claims release and the whole gate. Final implementation
review, full-gate, mutation, native macOS and exact-head hosted acceptance
remain open. No gate or acceptance condition is waived.

Attribution correction dated 2026-10-01: the non-human coordinator, not the operator, relayed independent REVIEWER Schrodinger's specific Q-015 continuation authority and instructed the final freeze append.
The operator authorised programme continuation generally; this correction claims no additional human decision, and the specific continuation authority remains REVIEWER Schrodinger's PASS.
