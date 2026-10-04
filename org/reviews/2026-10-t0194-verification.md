---
summary: T0194 opening authority, owned validation and qualified queue readiness evidence
type: review
tags: [refactor, verification]
---

# T0194 verification

Inspected opening revision93e425d556f384663fe5715c983d8b0c0c47fd07.
Record ruledR3 before implementation; accepted exact ADR0018 proposal is
preserved. At opening, no protected entry or source implementation existed. Independent
oracle author owns only the named test files. All20findings/14OP/42coverage
rows remain draft until individually evidenced; supplemental work is separate.

Start proof: every11PR/9required push/both Gitleaks jobs passes at that revision.
Snapshot tmp/t0191-hosted-t0206-actual-ready/snapshot-1791129063547.json.
Previous local diagnostic full gate at3d62a0d7 and seven-mutant sweep at9b2d140e
remain separately qualified in the T0206 evidence. They do not prove this batch.

## Completed-queue readiness trace, read-only Franklin

Pinned source inspected: /opt/hermes/gateway/platforms/api_server.py,
hash matched existing pinned release evidence. Admission3566-3568/3642-3646
counts _run_streams capped10, including completed unconsumed queues.
Completion3900-3907 removes task/agent handles but retains queue. Polling
3927-3985 returns status/output/usage without consumption. SSE4120-4153
subscribers consume the same queue and finally remove it, including disconnect.
No separate acknowledgement API. Queue retention is300s from creation,
sweep60s; terminal status retention3600s. The sweep also removes active handles.

PatterStage run-reconcile.ts134-136 persists Composer output/usage and advances;
Composer/Research SSE publishes SQLite snapshots without draining Hermes.
src/app/api/runs/[id]/events/route.ts90 opens an upstream reader per request,
including Composer-backed runs. Chat/mission readers can therefore compete.
Long chat/LLM calls use /v1/chat/completions outside this run registry.
RunSync is registered in every process; scheduler194 does not use the scheduling
lease for reconciliation. Documented one-server deployment still permits
multiple browser readers in that process. No exclusive acknowledgement owner.

Completed queue retention explains10completed→11th429; it does not prove
ten active executions. A terminal-only cleanup after durable persistence and
before successor admission was a candidate at this trace. The later accepted
ADR0019 is recorded below; its implementation is not yet verified. Qualify
ownership, retry recovery and late subscribers before source
edits. Preserve both causal controls, stored output/usage and active cap10.
New upstream API/image or public fan-out/replay policy needs separate authority.

No paid provider calls, dispatch, operator data or unrelated processes used.


## Lib-domains12 foreign implementation qualification

Current Chat MessageBubble.tsx105 renders SimpleMarkdown; its CodeBlock43
copies text directly. No source renderMarkdown/data-code path remains.
The full components-chat-markdown.test.tsx50-76 fixture contains fenced
code with leading/trailing whitespace and newlines, asserts exact clipboard
payload and truthful refusal. It is not a whole-response Copy test.
T0191's m03-exact-code-payload mutant in tests/fixtures/mutants/T-0191.json
trims the fenced payload and causally kills both controls. Existing test
bytes match accepted T0191. See its final-acceptance and component-verification
notes. Banach independently corrects the stale preliminary qualification.
Reuse this foreign implementation; no duplicate rewrite or savings credit.
Focused browser code-Copy passes2/2 at1440x900 and390x844, zero retries/skips,
in tmp/t0194-code-copy-browser.json. The freeze and build binding record
identical Chat/renderer/spec bytes for that owned run. It proves literal
block-scoped payload, pending/settled feedback and no overflow/errors.
The full browser gate on the final candidate remains required. Session Copy
has separate controls and is not interchangeable proof.


## First-cohort independent oracle, red before implementation

Faraday authors20new gateway Stop/deadline controls and independently amends
one obsolete Q027 roundtrip assertion.31cases:17pass14causal matcherfail,
zero runtime errors/skips. Four held waits remain pending after Stop; caller
links remain1after success and3after terminal failure. Held delays/attempts,
zero/precedence/submission arithmetic stay green. Separate existing controls
17/17pass. Proof: tmp/t0194-first-cohorts-freeze.json and
tmp/t0194-first-cohorts-red-final.json. Banach independently accepts the freeze.
All implementation and existing control bytes match93e425afterLFnormalisation.

Roundtrip amendment: operator-authoriser isQ027's explicit deadline/guidance
ruling and approved programme. Faraday changes only the obsolete inactivity
expectation to Elapsed run deadline:30minutes and records the amendment comment.
All11names and other assertions remain. OldLFhash:
4d47b150186cb696bc65864d642a7b3aac129ce1b99285cc55021bda1a764ac3;
newLFhash52866b3dd2d6e2c023fb73bf8331e31a844df724a8b86bbe9022eef4cfa1aed8.
Reversing that exact insertion/change reconstructs originalbytes. Other frozen
deadline/reconcile/Stop suites are untouched. This entry preserves the original
amendment provenance; it is not authority for any future amendment.

New frozen LFhashes:
retry-stop98c4f37356f0130b8499e5ae7863ddaeaf6c6f11e3b6d3f65edfbf8694993574;
guidance2e11d97dee246755c8d7316e09c3349a9676286189b80862676164ea1fa1bab2.
Test-specific types and focusedESLint pass. No source/protected implementation
existed at freeze. Later queue/ownership/parity cohorts require their own
independent controls before applicable edits. Fullbatchgate/sweep/closure pending.

## First-cohort implementation check

The frozen 31 cases now pass, with zero skips or runtime errors, in
`tmp/t0194-first-cohort-green.json`. All names and LF hashes remain unchanged.
The existing Stop and deadline suites pass 13 cases in
`tmp/t0194-held-controls-green.json`; test-specific TypeScript exits zero.
These focused checks do not replace the full gate.

Gateway retries retain their four delay schedules and three-attempt limit.
An aborted wait clears its timer and listener and throws the existing stopped
error without exposing `signal.reason`. The gateway releases its caller link
on success and terminal failure. Direct-provider behaviour is unchanged.
The prompt uses the existing `declaredTimeoutMinutes` selection and grace
constant. The Runtime card and guide describe submission-based elapsed time,
zero suppressing the declared deadline and scope fallback, and the undeclared
safety cap applying only when the backend is unreachable. No deadline or
reconciliation arithmetic changes.

Independent reviewer Banach returns a bounded PASS for this cohort, including
unchanged deadline/reconciler bytes and frozen test identities. The gateway
repair adds 20 net source lines; it is a defect fix, not a reduction claim.
Ownership, queue admission, remaining dispositions, visual walk, full gate,
mutation and hosted acceptance remain outstanding.

## Hermes ownership cohort

Faraday's independent ten-case ownership oracle was committed red at seven
matcher failures and three passes in `916e2d7f`, with no runtime errors.
LF hash: `6919e755e447a056e41a2ace99498875a661199edc1fe85ae162f46c24cc3392`.
The env parser and root-agent repository now live in `src/modules/hermes/lib/`.
No core forwarding shim remains. The explicit caller allowlist rewrote 41
files under source, scripts and tests, excluding org and frozen new oracles.
The old alias and written path spellings were found and replaced; searches
found no remaining old caller, join-segment, relative or regex-literal spelling.
The new oracle deliberately retains old paths to assert their absence.

The accepted ADR-0018 protected entry reproduces the exact approved Decision
section. Settings field/section metadata and ADR-0005 stay unchanged. Only
commentary changed in design-lint; both predicate hashes remain exact.
The ownership oracle and initial controls pass 51/51 in
`tmp/t0194-ownership-green.json`. All 23 affected existing unit suites pass
306/306 before and after in separate owned data directories, with identical
test-name sets: `tmp/t0194-move-identity/identity.json`. Test TypeScript exits
zero and design-lint retains its existing debt baseline with no new violation.

The line census currently reports growth from new controls, defect fixes and
lint commentary. No baseline or target has been changed at this checkpoint.
Record the measured reason after the remaining cohorts settle. Full gate,
mutation, visual guidance walk and exact-head hosted acceptance remain pending.

## Owned Runtime walk and queue decision

The coordinator personally walked the disposable development instance on
loopback port 3999 at 1440x900 and 390x844. Sign-in, New Mission, Runtime,
zero timeout, positive 30-minute timeout, Human/AI prompt preview and Cancel
worked. Zero keeps the planning scope without a declared Safety deadline;
positive timeout generates the submission-based deadline and grace wording.
Both widths have one h1, no document/dialog horizontal overflow and no browser
warning/error logs. Screenshots are in `tmp/t0194-ui-proof/`; fixture and source
binding are in `tmp/t0194-ui-preview-1791131655133/source-binding.json`.
No dispatch, paid provider or operator data was used. The tab is closed,
viewport restored and only the owned preview process tree was stopped.
The saved images were inspected and their actual JPEG encoding, dimensions
and SHA-256 values recorded in `tmp/t0194-ui-proof/image-metadata.json`.
The `.png` filenames contain JPEG screenshots; do not infer encoding from
the extension. The phone image shows the AI prompt and 30-minute control.

The first optional Webpack development attempt could not resolve fs through
instrumentation's SQLite import. Its isolated process was stopped. The normal
Turbopack development path then served the walk without that error. This is
not a production build or a repair of the Webpack diagnostic. The owned
validation checkout's development output must be rebuilt for production;
the older production bundle must not be reused or described as current.

Daniel Parke accepted the exact ADR-0019 Composer-only queue proposal on
2026-10-04. Banach checked its bounded retry/30-day unresolved disposition.
The generic Composer stream contract change and retention policy are now
authorised; source implementation still requires its independent red oracle.

## Measured helper cohort

Faraday's seven-case oracle was committed red at four structural matcher
failures and three behavioural passes in `53960c11`; zero runtime errors.
LF hash: `2114347a062420632fc3d4093ec4a9eea61a40ea7ba5a68f37c39a6433ae28ff`.
The four folds share fresh deploy defaults, whole-graph Composer insertion,
Research's identical four-character escaper and XML attribute formatting.
Public single-node/edge insert functions and distinct parsing/duration contracts
remain. Nine suites pass 77/77 with zero skips/runtime errors in
`tmp/t0194-helper-parity-green.json`. All 70 existing names and eight file hashes
remain exact, checked in `tmp/t0194-helper-identity.json`.

Banach independently verifies 28 fewer production lines and 1,367 fewer
comment-free printer bytes. Prompt printer size falls from 8,706 to 8,566 bytes.
Including the 95-line independent oracle, the cohort adds 67 total lines.
This is production consolidation, not a total-tree reduction or performance
claim. A TypeScript failure exposed the distinction between input WorkflowDef
and parsed defaults; the private helper now uses the schema's parsed return
type. Test TypeScript and focused ESLint then exit zero. Full acceptance remains
the batch gate, committed sweep, independent review and hosted jobs.

## Current obsolete and audit cohorts

The absence oracle committed in a30bdfdb was red at 11/11, then green after
the explicit nine-source-file removal of eleven unused helpers and an orphaned
type. The source receipt records 106 removed lines. The independently reviewed
17 obsolete test retirements retain all 134 other test names. Six mixed cases
and three platform mock cleanups preserve their behaviour; 195/195 pass in
tmp/t0194-obsolete-amended-green.json. The name-set and file hashes are in
tmp/t0194-obsolete-amendments-freeze.json.

Faraday's audit oracle has 23 cases and LF SHA-256
5a98bb45d27e3ca01d7f2d3997548bfcdf1ec10a2e4aab0c52f19cd0649f95fe.
It was committed red at 15 matcher failures and 8 passes in 4d697485, with no
runtime errors. Both stalled cron children emitted the ready marker before
their two-second bound, so launch failures are not classified as rejection.
tmp/t0194-audit-freeze.json retains the structured red evidence.

All 23 pass in tmp/t0194-audit-green.json after six library repairs. Clearing a
non-owner model cannot clear another model's slot. Hindsight builders retain
literal protocol keys, including zero priority and false activation. Skill
grouping uses buckets without inherited keys. Cron expansion validates integer
steps and bounded ranges before iteration. Stats retains script schedule kinds;
Stats and Analytics compare parsed instants rather than unlike timestamp text.
The latter accepts both existing SQLite and ISO forms without rewriting data.
Parsed timestamp predicates prioritise correct mixed-format boundaries; they
cannot use the raw-text timestamp index for a range seek. No migration or
performance improvement is claimed.

Five existing model/analytics/schedule suites pass 60/60 in
tmp/t0194-core-existing-green.json. Test TypeScript and focused six-source ESLint
exit zero. A subsequent one-line invalid-field early return prevents the cron
date search from needlessly scanning its horizon; the final audit and held
next-run controls then pass 33/33 in tmp/t0194-audit-final-green.json.
These checks do not substitute for the unchanged whole gate, clean committed
mutation sweep, independent R3 verdict or hosted acceptance.

The itemised source-suite classification records 137 unique candidates at
a30bdfdb: 111 source assertions/scans, 18 SQL/data fixtures, 2 generated runtime
receipts and 6 metadata/tree contracts. The additional 86 candidates in the
broader named-reader scope remain unclassified. Historical scope counts are
preserved. Candidate counts are never labelled confirmed source assertions.

## Final implementation cohorts before the gate

Queue admission, confirmation, invalid-receipt cancellation, engine and spend
controls pass60/60 in tmp/t0194-queue-60-green.json. The earlier incorrect
early-publication attempt remains a recorded failure; it was corrected before
this run. The malformed receipt case committed red1/1 in a8515f73 and now
proves local cancellation persists without selecting an untrusted Stop target.
Independent legacy reconciliation fixture adaptation preserves19 names and22
assertions; all95 related controls pass. The fixture cannot establish production
transport behaviour; separate owned queue controls qualify that boundary.

Three type-only folds remove49 production lines and966 emitted-printer bytes.
All three comment-free JavaScript outputs are identical, recorded in
tmp/t0194-type-fold-proof.json. Client optional/null shapes remain distinct.

Banach's final14-case oracle was committed red13/14 in57aad470, then passes14/14
in tmp/t0194-remaining-rulings-green.json. Eight new/held suites pass83/83 in
tmp/t0194-remaining-held-green.json. The pure alias registry matches all13
documented groups. Five restored-initialiser AST hashes prove caller parsing,
defaults and raw whitespace precedence remain unchanged. Paths keeps its exact
readEnv export identity and directory discovery. Day/hour elapsed formatting
and canonical Chat-default ownership satisfy their existing rulings. Parfit
independently reviewed these bounded controls and implementation.

Only output-canary surfaces.appConfig was refreshed from the actual producer
after the five caller parity proofs. New digest:
985bce3dcbddd29d2480297cf2f9cb512eaa8fb5400489a615e94ca23353a7e4.
Generated artefacts, HTTP surface and seed pack retain their original digests.
The source-normalising canary observes the changed import/expression even
though its origin-selection behaviour is held. No canary check changed.

Eight explicitly claimed comment files correct obsolete paths/descriptions and
misattached repository prose. No protected/history/derived bulk rewrite occurs.
T0207 has separate verification and independent frozen security controls.
Full unchanged gate, committed sweeps and hosted acceptance remain pending.
