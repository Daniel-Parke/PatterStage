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

One early chat probe lost its typed input while New Chat completed. A held
creation response then reproduced this at both widths: text entered while
creation was pending became empty when the response arrived. Before/after
image hashes are in `tmp/release-userwalk/new-chat-race.json`. The source
clears input after awaiting conversation creation in `useChatConversations`.
T-0190 must add its regression oracle before repairing the race. The
settled-creation chat journey above does not refute it. Earlier mode/title selectors also matched
multiple legitimate controls; those selector failures are preserved in the
ignored probe logs and do not establish product defects.

## Remaining verification defects and dependency limits

The independent release review found that `real-hermes-itest.sh` seeds a
legacy `control-hub.db` alongside the canonical database left by smoke. The
runtime selects by size, while the fixture's HTTP 200 assertions do not prove
which database served the request. A meaningful legacy migration rehearsal
must identify its database and preserve unique seeded rows. This is a
separate unresolved harness defect, not a claim that data was lost.

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

Real Hindsight, complete Composer and Story Weaver execution, Research runs,
restore merge/replace and every model/credential/profile/script lifecycle
remain narrower than the user's requested complete pathway validation.
The structural batches and final walkthrough must close those gaps or name
their specific unavailable external dependency. A passing route walk is not
substituted for those journeys.
