---
summary: Release verification after prerelease batches, with reproduced harness defects and bounded user journey evidence
type: venture
tags: [review, release, verification]
status: in-progress
---

# Release verification, 30 September 2026

## Revision and authority

The product under inspection is `dev@c548be18bf2d1ef94d923b51d885a72223ea9422`.
T-0187 is closed. Q-032 permits the already approved structural batches before
release. Merging PR #157, tagging and publishing remain operator actions.
The separate compatibility retirement date is not changed by Q-032.

## Hosted acceptance

Every required job completed successfully on this exact head. Push CI
`36643616502` passed all nine scheduled jobs. PR CI `36643621005` passed all
11 jobs, including full E2E, acceptance, Linux/macOS builds, real Hermes,
Docker and the install harness. Push Gitleaks `36643616541` and PR Gitleaks
`36643620989` passed. The push workflow's conditional E2E skip is not used
as evidence for PR acceptance. No release exists and PR #157 remains open.

Recheck with `gh run view <id> --json headSha,status,conclusion,jobs` and
`gh pr view 157 --json state,headRefOid,baseRefName`.

## HTTP-enabled release matrix: reproduced failure

The full install harness was run with HTTP checks enabled on the clean local
clone `tmp/release-c548be18`. Fresh and Hermes-fixture setup/build completed,
then both failed the anonymous `curl -sf /` readiness probe. The protected
root correctly returns 401. The run was stopped after these identical
failures; this is not a completed release matrix. Logs are preserved in
`tmp/t0187-release-install.log` at lines 622 and 1231. The remaining owned
dashboard container was explicitly removed. An earlier attempt before the
clone finished exited 2 because its Dockerfile was unavailable.

T-0202 repairs the probe without changing application authentication. The
independent oracle exercises the generated Bash with real curl and controlled
HTTP responses. It covers exact health 200, anonymous 401, authenticated 200,
redirects, wrong credentials, a dead launch, an occupied listener, stalled
requests and bounded owned-process cleanup. Linux and the entire HTTP-enabled
release/interactive matrix must pass before this section can be closed.

The initial repair then exposed another harness defect: it required an explicit
data-directory key, although fresh setup uses the supported HOME default. That
isolated fresh run failed after its build; it is not a completed matrix.
Independent default-path cases were committed red in `b023f233`, with four
semantic failures and three passes. The repaired probe now follows the runtime
candidate order, prioritising either database name before an existing directory.
The coordinator's final focused run passed all 21 HTTP cases and the four
unchanged mission-route tests, with normal exit zero. Windows cannot establish
physical separation of differently cased HOME directories; Linux fixtures do.
The full gate and HTTP-enabled matrix remain to run on the finished tree.

At implementation `5be22712`, the complete ten-step gate exited zero with an
unchanged tree SHA-256 of
`40ea360955d97a7c8575601033cc99325f10fe02c336ace0023cc719c232aa73`.
It passed 7,528 Jest tests, eight skips, 355 browser tests and 24 skips.
Independent Linux verification passed 20 semantic fixtures and 278 checks,
with no Linux Jest claim. All eight committed mutants were killed; controls
passed and restoration left a clean tree.

The HTTP-enabled matrix then passed all 11 non-interactive release scenarios.
The first interactive scenario blocked at the professional-catalogue question:
its Expect script answers port and Advanced, then waits for EOF without
answering the catalogue prompt. The verified owned Python process and its
remaining container were stopped. This interrupted result is not 15/15.
T-0202 now includes an independent native-Expect oracle before repairing the
prompt sequence. The application prompts and original QA-file assertions stay.

## Browser evidence and limits

An isolated production app uses port **3997**, its own database and Hermes
home, and the existing managed `t0182-csp` checkout at `64f97bb5`. Product
source is identical to `c548be18`; this was checked with a Git diff. The full
gate uses port **3000**. The separate real-Hermes stack uses app **3999** and
gateway **8651**, bound to loopback under compose project
`ps-release-c548be18`.

At 1440x900 and 390x844, all 23 registered routes returned 200 after actual
HTML sign-in with opaque HttpOnly cookies. All 46 route captures had one main
h1, no horizontal document/main overflow and no JavaScript page errors.
Mission draft creation, expansion and edit retained the instruction; self
sign-out returned 200 and subsequent protected access returned 401. Separate
browser sessions exercised management with a fresh operator credential:
revocation without that credential was refused; confirmed revocation denied
the second browser while the first remained usable; UI self sign-out then
denied the first browser. No token appears in the captures.

Evidence and image SHA-256 values are retained in the owned checkout's
`tmp/release-userwalk/walk.json` and `session-ui.json`. All 16 controlled
list-read failure/retry journeys passed and their image hashes are in
`tmp/release-userwalk/retry-ui.json`. The phone Composer Runs panel and
Chat Conversations panel must be opened before checking their error banners.
Earlier probes omitted those user actions and failed; those probe failures
are retained rather than presented as application failures.

Optional Hermes and Hindsight services are absent from the native instance.
Their failed requests are recorded; the captures do not prove dispatch or
memory operations. `/api/logs` returns the documented missing-directory 404
on this fresh fixture. Thus these walks do not establish zero console errors
or complete functionality.

The pinned real-Hermes stack passed both
`node tests/integration/runtime/hermes-contract.mjs` and
`node tests/integration/runtime/full-stack-smoke.mjs` with its public test
credentials and deterministic local model server. This exercised real gateway
SSE/output/stop, mission draft/promote/reconcile/cancel, manual schedule run,
analytics and persisted Agent chat. It did not exercise the legacy-database
phase or all browser model/configuration pathways. The raw gateway and the
app's local Hermes configuration live in separate owned volumes.

The real-stack browser walkthrough subsequently passed model validation,
synthetic credential/model creation and default synchronisation at both
widths. Agent and Fast chat each sent a message, received the deterministic
real-gateway reply and retained the transcript after reload at both widths.
All six captures had no JavaScript page errors; hashes are in the owned
checkout's `tmp/release-userwalk/model-chat-ui.json`. These are model/gateway
integration checks, not a paid-provider or tool-approval rehearsal.

Offline Research completed through the real gateway with search disabled,
recording three steps and a persisted report. At both widths, UI validation,
start, streamed completion, timeline, HTML download and standalone report
viewing passed without page errors or horizontal overflow. Dropdown, report
and export hashes are in `research-ui.json`. The first probe selected hidden
timeline text; the successful probe targets rendered Markdown and retains the
earlier failure. This proves the local model path, not web-search quality.

At both widths, manual backup created a non-empty snapshot; shipped-content
merge preserved a custom template; confirmed single-template replacement
created a listed pre-restore snapshot and retained unrelated content. The
first confirmation click sent no replacement request. `restore-ui.json`
records screenshots and hashes. An initial fixture API call lacked Origin
and was refused; another probe expected the wrong response envelope. Both
failures remain in their logs. Only this script's own temporary custom rows
were removed. This is catalogue restoration, not an offline database rollback.

One early chat probe lost its typed input while New Chat completed. A held
creation response then reproduced this at both widths: text entered while
creation was pending became empty when the response arrived. Before/after
image hashes are in `tmp/release-userwalk/new-chat-race.json`. The source
clears input after awaiting conversation creation in `useChatConversations`.
T-0190 must add its regression oracle before repairing the race. The
settled-creation chat journey above does not refute it. Earlier mode/title selectors also matched
multiple legitimate controls; those selector failures are preserved in the
ignored probe logs and do not establish product defects.

The independent interactive oracle was committed red in `e63de259`, after the
coordinator repeated four failures and one pass. The repair answers the current
catalogue, missing-profile and Hindsight prompts. Catalogue seeding is declined
in the profile-copy scenarios so their unchanged QA absence/presence assertions
still test that branch. Setup accepts the catalogue; bootstrap explicitly skips
Hindsight with S. The installer prompts and all 15 scenario identities remain.

All 30 focused tests subsequently passed with normal exit zero. The separate
native Linux Expect companion passed ten cases, including successful controls,
malformed-Tcl classification and catalogue-contamination detection. It exercises
captured Tcl against owned fake effects. A real HTTP-enabled interactive setup
also passed in 108.3 seconds on an explicitly copied harness snapshot. These
results do not replace a clean committed-head full gate and 15-scenario matrix.
The harness's normalised SHA-256 is
`1deb5a3bfb2b7694098d5e0ead2526877d35fd486e48755e3591ee31e1d8971b`.

The new suite adds 70 counted test lines. Its Python native companion has 354
physical lines outside the historical TypeScript census; the growth reason's
399-line wording is a transcription error, retained with this correction.
Repeated test windows remain 4,794 against the unchanged ceiling of 4,800.

The first complete gate attempt after this repair exited 1 at E2E: one
connection reset and one Windows worker exit `3221226505`, with 353 passes
and 24 skips. Its tree did not change. Each affected spec passed unchanged
alone: four framework-auth tests and 31 session tests. Both isolated results
are partial evidence; the failed full run remains recorded. No assertion,
worker setting, retry policy or coverage floor changed. A new full run is
required before the implementation commit.

The real setup rebuilt the owned test image. The old frozen image was then
unavailable, so an exact-image no-pull attempt exited 125 before tests. The
companion subsequently passed 10/10 on inspected immutable image
`sha256:3ac74fc5fa072e3f28bf05ed2d0fc44d03014a26e4c9db9444e06ec53ac1029d`,
with network disabled, read-only source mounts and owned tmpfs. This missing
image is an infrastructure failure, not a semantic test result.

## Remaining verification defects and dependency limits

The next full gate stopped at Jest with four HTTP-fixture deadline or immediate
owned-cleanup failures under parallel execution. The other 7,529 assertions
passed, with eight skips. The unchanged HTTP suite then passed all 21 tests
alone. An independent author is investigating the instrument under a narrow
REVIEWER-authorised amendment; the failed observations remain binding.

Poincare subsequently froze the timer-only amendment at helper SHA-256
`c53915174248fa014691aaf08b04cd32eaacf47e6197292bf5ee3f2de889e27b`,
with Goodall's independent R2 PASS. Bash timed reads replace repeated external
sleep-process launches. Invalid timer descriptors, EOF and complete or partial
input are infrastructure failures. Watchdog, curl limits, iterations, immediate
ownership observations and all 21 test names/assertions remain unchanged.
Focused and six-worker-loaded Jest each passed 21/21; Linux passed 20/20 and
eight negative controls passed on both platforms. The original historical
harness still failed 11 cases. The all-core saturation and earlier failures
remain recorded; the full gate must still run on the finished tree.

The timer-amended full gate then passed nine steps, including 7,533 Jest passes,
355 browser passes, build purity and design census. It failed at the line
census because the coordinator's earlier `--allow-growth` invocation omitted
`--update-baseline`. The measured 70-line oracle growth was documented but not
persisted. The canonical command now appends that exact reason and holds
138,942 test lines; every other measure is unchanged. No programme target or
repeated-window ceiling changes. The 399-line typo was only in the earlier
command log, not a committed baseline. The failed full result is retained at
`tmp/t0202-timer-gate-final`; all ten steps must repeat.

The complete install matrix exited zero at **15/15**, with HTTP enabled and
all four interactive scenarios included. The run took 1,837.7 seconds on
clean product clone `e63de259` and an external copied controller frozen at
the `1deb5a3b...` hash above. The product source remains `c548be18`; the older
tracked controller in the clone is not executed. The coordinator compared
the product files and controller with the current implementation, recording
the binding in `tmp/t0202-matrix-binding.json`. The complete log is
`tmp/t0202-release-matrix-frozen-controller.log`. This is explicit snapshot
evidence, not a claim that a finished latest-head gate has passed.

The subsequent full gate at unchanged tree `43e70334...` stopped at Jest:
7,531 passes, eight skips and two failures. H04 observed the owned process
alive immediately after probe return; H12 reached the independent watchdog.
The timer amendment did not resolve all load counterexamples. The independent
reviewer is checking production cleanup and fixture observations before any
further frozen-oracle amendment. This failed run is retained at
`tmp/t0202-complete-gate`; it is not replaced by the earlier nine-step pass.

After the install matrix finished, the unchanged full gate repeated without
concurrent install builds. It again failed at H12's watchdog, after 7,532
passing assertions and eight skips. Lint and TypeScript passed. Concurrent
matrix builds therefore do not adequately explain the failure. The complete
result remains `tmp/t0202-quiet-complete-gate`. Independent investigation is
testing only whether the fixture can avoid an extra Git Bash child launch
for each real curl request, retaining every existing bound and observation.

The direct-exec candidate was rejected independently on both platforms:
five of seven cases lost required acceptance, launch or HTTP witnesses.
Exec exits the command substitution before its inner `|| true` can recover
preflight curl status 52. No source was changed to fit that instrument.
Goodall's diagnostic shell resolved System32 curl, version 8.21.0 Schannel,
SHA-256
`73d24149ff289afc49ec41f08918ef9faa727d39ad993e929757dc2ddafab805`.
The actual fixture trace subsequently resolved `/mingw64/bin/curl`; the
reviewer's shell therefore does not establish fixture resolution. Poincare's
explicit-System32 comparison passed seven cases but did not improve elapsed
time. This does not establish an alternate-binary improvement. Goodall's Linux
controls found no cleanup counterexample, including the stubborn child;
Windows H12 under the full suite remains unresolved. Evidence:
`tmp/t0202-curl-exec-verdict.json` and
`tmp/t0202-goodall-native-controls.jsonl`; fixture resolution and comparison
are retained in `tmp/t0202-native-curl-windows.json`.

Additional Composer execution correctly refused a model response without a
verdict. With an explicit mock-only PASS verdict, the existing runtime smoke
passed five assessed stages, a HIL acceptance and advancement, then offline
Research completion. A full desktop UI attempt subsequently failed at Validate
because the real gateway returned 429, reporting ten concurrent runs. The
failed run and logs are preserved. Independent read-only investigation must
distinguish active work, fixture state, gateway and adapter causes. Full
workflow completion, rejection and cancellation are not yet validated.

Independent read-only reviewer Rawls (`01a0f018-8f74-7700-8f1c-c1609ac5c177`)
verified the installed gateway image and build revision
`2c174bce2408f5d6810b0f16dbd55cb65cd1c6e3`. Its
`/opt/hermes/gateway/platforms/api_server.py` hashes to
`cda19cfe814b6a7529d07387ebff822cbd867a7bef91d1ab0c1c6f3042bd0e6d`.
Lines 3642–3646 admit by the number of retained event queues, rather than
active tasks. Completion at 3900–3907 removes task/agent references but leaves
the queue. Event consumption at 3985–3987 removes it; the sweep at 4120–4144
expires it after 300 seconds, checking every 60 seconds.

Nine completed smoke runs plus the UI Review completion account for ten
queues within that window. Read-only GET observations at 02:21–02:25 UTC
confirmed all ten completed. The UI Validate submission failed after 12.020
seconds, matching the adapter's existing four attempts with 2/4/6-second
waits. Historical registry membership is reconstructed from source and API
timestamps; individual wire attempts were not captured. Ten active jobs and
an indefinite leak are not established. No service was restarted or cleared.

This is a real polling-path compatibility defect for the pinned Hermes
gateway, not grounds to weaken Composer's completion assertion. Runtime
integration owns the PatterStage side; the queue accounting is upstream.
T-0194's Hermes work must include a focused regression and a compatible,
independently reviewed remedy before release, or explicitly retain the
release blocker. Increasing an arbitrary retry or restarting the fixture is
not a demonstrated fix. Reproduce with the owned PASS model, the runtime
Composer smoke followed within 300 seconds by the full UI workflow probe.

The independent release review found that `real-hermes-itest.sh` seeds a
legacy `control-hub.db` alongside the canonical database left by smoke. The
runtime selects by size, while the fixture's HTTP 200 assertions do not prove
which database served the request. A meaningful legacy migration rehearsal
must identify its database and preserve unique seeded rows. This is a
separate unresolved harness defect, not a claim that data was lost.

A read-only T-0188 preflight reverified two migration bookkeeping
counterexamples against current code and real SQLite. With an isolated,
baseline-derived input at version 14, deleting the empty benchmark table
made its ALTER fail, but `applyBenchmarkConfigMigration` returned and recorded
15. A synthetic mission remained intact. Separately, an empty migration
directory let `applySqlMigration` record 12 from 11 without creating the
analytics table. These prove single-applier gaps, not a genuine historical
install, whole-boot failure or lost user data. T-0188 must classify compatibility
intent before deciding the remedy.

Reproduce with `npx jest --config tmp/t0188-preflight/jest.config.cjs`.
The verified run passed both diagnostic assertions, which explicitly observe
current bad behaviour; these scratch probes are not acceptance oracles.
Evidence: `tmp/t0188-preflight-verified.json`,
`tmp/t0188-missing-benchmark-table.json` and `tmp/t0188-missing-sql-file.json`.
The first probe used a draft status unsupported by the old baseline and failed
before the migration; that fixture error remains in `tmp/t0188-preflight.log`.
Source methods: `src/lib/db/apply-benchmark-config-migration.ts:48` and `:54`,
`src/lib/db/apply-sql.ts:45`, and `src/lib/db/sql-migrations.ts:57`.
No application source or frozen acceptance test was changed by this preflight.

### Story Weaver real-model walkthrough, 2026-09-30

The coordinator walked the isolated production stack `ps-release-c548be18`
at 1440×900 and 390×844. Each browser created a named three-chapter story,
verified chapter one was written while two chapters stayed pending, opened
the story bible, explicitly wrote chapters two and three, and verified the
completed story after reload and on the library shelf. Deletion required two
clicks; the first left the persisted story intact. Self sign-out then returned
200 and protected navigation returned 401. The corrected instrument exited
zero with 14 recorded journey outcomes and 12 hashed screenshots. Every
capture had one h1, no document overflow and no browser page errors. The
coordinator also visually inspected the phone reader and desktop bible.

Evidence: `tmp/release-story-ui-corrected.log` and
`tmp/release-story-walk-1790742667347/result.json`. The first instrument tried
to click a native option and timed out before story creation; that failure is
retained in `tmp/release-story-ui.log`. The corrected instrument uses the
native select operation and retains all journey assertions. The actual model
reply is the existing deterministic fixture text, so creation exercises the
documented fallback arc. This is functional persistence evidence, not story
quality, paid-provider output, Stop, Retry, rewrite or continuation acceptance.
The stack's application product remains `c548be18`; no application source or
frozen oracle was edited for this walkthrough.

Saved-library checks also passed at both widths. An empty name disabled each
save. Newly saved themes and characters survived reload, their editors loaded
the persisted fields, edits appeared in the library, and reuse copied the
theme premise and added the character to the cast. The character's add action
then disabled itself and read `In the story`. Both deletions required visible
confirmation and removed only the uniquely named fixture rows. Evidence:
`tmp/release-story-library-ui.log` and
`tmp/release-story-library-1790742897770/result.json`, exit zero, 12 recorded
outcomes and eight hashed screenshots. All captures had one h1, no document
overflow and no browser page errors. No model call was required for this
library lifecycle. It does not prove every character field, failed-save
recovery or duplicate-name handling.

### Independently accepted HTTP curl transport, 2026-09-30

The timer-only fixture remained red under ordinary full-suite execution.
Direct exec was refused because it bypasses caller error recovery. Explicit
System32 curl showed no improvement and was a different binary from the actual
fixture. Independent ORACLE Poincare instead authored a standard-library,
fixture-owned local transport for the same real curl selected at the actual
Bash call site. Its native environment and argument mapping are captured once
after configuration. The existing six-second watchdog, request scaling,
iteration counts, cleanup checks and all 21 names/assertions remain.

Goodall authorised the exact final helper `5b36c32e…` and bridge `fe32217d…`
under Q-015. The coordinator expanded the two disjoint writing claims before
the tracked amendment. Author Windows Jest passed 21/21; Linux process
controls passed 20/20, with complete, clean per-case audits. Failure controls
prove that missing max-time reaches a real stalled request and triggers the
watchdog, malformed protocol and launch errors remain infrastructure errors,
and only owned curl children are reaped. Five supported argument/environment
variants match native recorder output. Real 496-byte bodies are discarded.

Coordinator Windows assurance repeated exit zero. The first Linux repeat used
Docker's default `/tmp` tmpfs, which `/proc/mounts` proved was `noexec`; no
owned server launched and no watchdog witness occurred. The failed reports
remain `tmp/t0202-coordinator-rpc-linux.json` and `-linux-negative.json`.
The unchanged repeat with executable owned tmpfs passed all 20 cases, negative
controls and complete audits, exit zero:
`tmp/t0202-coordinator-rpc-linux-exec.json`. This correction changes test
configuration, not product code or mutation interpretation.

Full proposal, hashes and limits:
`tmp/t0202-rpc-assurance/finished-proposal.md`. The helper grows from 354 to
386 physical lines; its new bridge has 277, a net 309 Python lines outside the
historical TypeScript census. Supported transport is the fixture's small text
output and validated arguments, not arbitrary binary output or changing
environments between calls. This is independent instrument acceptance. A
new complete gate and clean committed twelve-mutant sweep remain required.

### T-0202 local close, 2026-09-30

The subsequent complete gate exited zero at all ten steps on the unchanged
tree `c8087803f89c05e462417f6feaea3baaa12234fb8c0bf497884282d62f06bdb1`:
7,533 Jest assertions passed with eight existing skips, 355 browser tests
passed with 24 existing skips, both build-purity controls passed, and lint,
TypeScript, Knip, canary, build and both censuses passed. Full evidence remains
`tmp/t0202-rpc-full-gate/summary.json`; earlier failed gates are not overwritten.
The accepted instrument was committed separately as `5249123f`, followed by
implementation `1f556c4909afcaac168704ed8b79bc5204e5fab6`.

The clean committed sweep exited zero, killed all twelve mutants through
structured assertion failures, passed controls before and after, and restored
a clean Git tree. No survivor, ineffective/not-applied mutant or infrastructure
kill occurred. Evidence: `tmp/t0202-final-twelve-mutants.log`. The complete real
install matrix remains the explicitly byte-bound 15-scenario snapshot already
recorded, with final executed controller hash `1deb…`. Local closure does not
establish exact-head hosted acceptance or completion of every user pathway.
Hosted push and PR jobs are required after the closure push before T-0188.

T-0202's first full Jest run reported 7,521 passes and eight skips, but did not
exit. A diagnostic rerun found exactly one open interval: the real sync
scheduler started by `missions-delete-null-check.test.ts`. Both owned runs
were stopped after the report; neither is a successful gate. An independent
REVIEWER authorised `afterAll` teardown using the existing scheduler stop API,
with all four tests and their assertions preserved. No `--forceExit` is used.

The corrected log-path and explicit-status kill shim subsequently passed all
14 cases on Windows and Linux. Both changes and the earlier invalid Linux
results remain in the append-only T-0202 amendment record. The HTTP-enabled
matrix's first rerun then stopped after fresh setup/build because the probe
required an explicit data directory. Fresh setup supports HOME/patterstage/data
without that key. An additional independent red-first oracle precedes the
fallback repair; this 0/1 result is not a completed 15-scenario matrix.

The Python harness also removes a container from tracking without requiring
successful removal, and its signal handler cleans up then returns. These
source observations require focused failure-path tests. The interrupted
matrix does not establish their exact causal effect.

The live `npm audit --json` exited 1 with **10 advisories: two low, three
moderate and five high; zero critical**. This matches the previously recorded
T-0179 findings. A Docker install printed nine advisories; different audit
responses are not interchangeable. The live response is preserved in
`tmp/release-dependency-audit.json`. Node/dependency work remains assigned to
T-0196/T-0197, including the already ruled Node 24 build and Node 22 minimum.
No dependency has been updated by this verification pass.

The coordinator also completed an offline database recovery rehearsal, using
`tmp/release-offline-restore.mjs`. A live online backup contained four existing
mission fixtures and passed SQLite integrity checks. In a disposable stopped
copy, a committed deletion and deliberately retained WAL/SHM files formed the
adverse state. Copying the snapshot back and removing those sidecars restored
the exact snapshot hash and all four mission IDs. This executes the documented
procedure's equivalent file operations; it does not claim a shell-command or
Hermes/Hindsight recovery test.

The restored production app on temporary owned port **4001** returned all
four missions through the application API. It rejected the old snapshot's
browser secret despite retaining the same operator token, proving restart
generation rejection in this built app. Fresh sign-in and self sign-out worked
under `PS_READ_ONLY=1`, while an application backup write returned 503.
The first run passed 19 checks, exit zero. A follow-up strengthened the cleanup
proof and passed all **21 checks**: original-session DELETE returned 200 and
subsequent access returned 401; the owned restored listener was confirmed
stopped. The result and server log remain in
`tmp/release-offline-restore-1790739154531`; the complete runner output is
`tmp/release-offline-restore-confirmed.log`. The earlier result remains in
`tmp/release-offline-restore.log`. The operator's repository data was not used.

Real Hindsight, complete Composer and Story Weaver execution, web-search
Research and every model/credential/profile/script lifecycle
remain narrower than the user's requested complete pathway validation.
The structural batches and final walkthrough must close those gaps or name
their specific unavailable external dependency. A passing route walk is not
substituted for those journeys.
