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

## Remaining verification defects and dependency limits

The independent release review found that `real-hermes-itest.sh` seeds a
legacy `control-hub.db` alongside the canonical database left by smoke. The
runtime selects by size, while the fixture's HTTP 200 assertions do not prove
which database served the request. A meaningful legacy migration rehearsal
must identify its database and preserve unique seeded rows. This is a
separate unresolved harness defect, not a claim that data was lost.

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
