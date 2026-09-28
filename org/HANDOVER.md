---
summary: What the consolidation programme did and left behind, how a batch was landed, what is open, and what waits next
type: venture
tags: [handover, consolidation]
updated: 2026-09-28
---

# Handover · PatterStage, 2026-09-28

## Current status, 2026-09-28

T-0164's current-tree reconnaissance is closed at `babf76ac` pending this
record's hosted closure checks. Its linked ledgers account for 265 preliminary
findings, 163 split operator dispositions and all 285 atomic obligations from
107 original coverage bullets. The defensible current dispositions are 244
verified **source observations**, 12 refuted and nine unresolved findings;
25 narrow verified, 215 unresolved and 45 deferred coverage atoms. A source
observation is not a demonstrated user defect or permission to remove a
feature. The independent sceptics and final completeness critic are recorded
in `org/reviews/2026-09-t0164-sceptics.md`.

The unchanged-tree T-0164 gate passed all ten steps in the isolated
`t0158-sweep` worktree: 752 Jest suites (7,322 passed, four skipped), 316
Playwright passes (24 skipped), production build, build purity, Knip,
canary and both censuses. Its tree hash was
`e98ebe32caa4f78b5f846647f1006032bddaa02cf5dfef1661432aa7c6b52b0a`.
All four committed-tree mutants were killed by assertions, and restoration
left the worktree clean. Two earlier gates stopped honestly: first at six
CommonJS lint errors, then at one stale bloom selector oracle. A different
author corrected the closed oracle without changing its nine test names.
The line census records its seven added test lines with a reason.

The controlled app walk used port **3802** for 19 component states at
1440×900 and 390×844; a supplemental 22-route walk used port **3805**.
The CSP probe used port **3804**. All used isolated data. Optional Hindsight
returned 503 without its backend, and the empty-log path returned 404. These
are bounded route and visual checks, not acceptance of every external-provider
journey. T-0165 remains the full Phase 2 plan for separate operator approval.
Q-011 still requires the operator's first release before structural batches;
PR #157 remains the sole promotion PR.

T-0158's opaque browser sessions and managed transport are complete on
`dev@b54701bb` under accepted ADR-0012, ADR-0013 and ADR-0014. The final
isolated ten-step gate exited 0 with an unchanged tree
(`39b54acf61e6d3ae462da066db6025a723ae6dab91023811efc4eb1a15b0d4fb`):
751 Jest suites, 7,319 passing tests and four skips; 314 Playwright passes
and 24 existing skips; design and line censuses held. The committed-tree
sweep killed all 13 mutants by assertion and restored the clean tree. An
independent R3 reviewer approved the final response boundary after red-first
oracles exposed both held cookie responses and a bare Authorization rotation
path. All 174 API method exports are now accounted for: 112 use `route()`, 56
use `guardRoute()`, four are specialised auth lifecycle methods and two are
public health endpoints. A separate real-browser lifecycle walk at 1440x900
and 390x844 passed sign-in, session listing, sign-out and re-entry denial on
local port **3801**, with one h1, no horizontal overflow and no signed-in
console errors. That walk preceded the later response-only route guards;
the final 314-case browser gate passed on `b54701bb`. Screenshot SHA-256 values for sign-in
are `26000F417FB54A16AC967420B20D87420BD69A101EB2918CBF197420AB739048`
and `7A983BC071ED2BED0D7EA93670FB852A85C176CAEA3F982CAA0205FDB1D5B6EF`;
for session management they are
`0CDF0E3C90C42AF685B1C1D6947E1CAF5B544FB18C888254FCCDD5AD44B0ED12`
and `A04C0C117C60CA54D974C8D7945456084AFBB487D0E98AAF4EB82E91904946BD`.
The final gate record is in the managed `t0158-sweep` worktree's `.gate` folder.
At `b54701bb`, push CI `36423013904`, PR CI `36423022563`, push Gitleaks
`36423014068` and PR Gitleaks `36423022551` all completed successfully. Every
PR CI job passed, including full browser acceptance, fresh install/update,
real Hermes, Docker, Linux and macOS. Push CI skips full browser acceptance by
design, but its remaining jobs passed. T-0158's record is closed. The earlier
`a228a708` CI runs also passed, but the independent R3 review then found a
queued-response revocation race, so they are not the closure evidence.

The first hosted attempt at `b73e1c23` failed only the real-Hermes job. Its
test Compose service omitted the origin and explicit network mode required by
`start:network`; the integration never reached the contract assertions. An
independent red-first oracle, then a different-author loopback amendment,
preceded the repair. Both test services now publish fixed test credentials only
on `127.0.0.1`, and the harness uses that same address. The repaired hosted
real-Hermes job passed without relaxing the production startup guard.

The failed intermediate gates remain evidence. A fabricated running Composer
row with no current node could be marked failed by the background tick and
close its test stream. The independent fixture repair uses the genuine quiet
`awaiting_approval` state and preserves all 31 browser case names and
revocation assertions. A separate Windows Playwright worker exited with
`0xC0000409` in one full run and in two parallel focused attempts; there was
no assertion result or faulting-module attribution. The normal parallel final
gate passed. The six diagnostic test lines were held in the committed census
with a written reason; the original five targets were not moved.

T-0164 was the main prerequisite when T-0158 closed. Its current result and
limits are now at the top of this handover. T-0165 is the full Phase 2 plan
after that evidence and requires separate operator approval before structural
execution. PR #157 remains the sole working promotion PR; no release has been
made. Local worktrees with unique or ignored state remain preserved.

## Dated status, 2026-09-27

T-0179 carried PR #233's React 19.2.8 and `@types/react` 19.2.18 proposal
onto `dev@1f8b2aa1` with React DOM also pinned at 19.2.8. Its independent
oracle was red at eight expected assertions out of 24 tests before the
update, then green 29/29 with the prior dependency suites. The three old
suites retained all 21 test names and assertions through an independent
amendment. Only the React, React DOM and React types package records moved
in the current-dev lockfile. The first full gate correctly rejected an
ignored visual helper left in the reused isolated clone because ESLint found
five forbidden imports. Removing only that owned temporary helper and
rerunning the entire unchanged-tree gate gave ten green steps: 735 Jest
suites (7266 passes, four skips) and 283 Playwright passes (24 skips). The
isolated Composer walk at 1440x900 and 390x844 found no missing h1, overflow
or browser console errors; both screenshots are byte-identical to T-0178.
Four committed-tree mutants were killed and restoration left a clean clone.
All four implementation workflows and every required hosted job passed.
PR #233 closed unmerged at its archived exact head, and GitHub removed the
remote source branch. PR #157 is now the only open PR, with `dev` as its
source and `main` as its target. `npm audit --json` still exits 1 with ten
advisories (two low, three moderate, five high). All four T-0179 closure
workflows and every required job passed at `dev@b2be4a64`. T-0158 session
security is active under accepted ADR-0012/0013; its live record now rejects
the old universal proxy-protocol claim and requires a production-bundle
generation proof before source implementation. T-0164/T-0165 reconnaissance
and planning remain open. The old local worktrees with unique or ignored
state remain preserved; remote heads are only `dev` and `main`.

T-0178 carried PR #228's Playwright 1.62.1 proposal onto `dev@e7081b1a`
without merging its stale branch. Its independent oracle was red at eight
expected Playwright version assertions out of 26 tests before implementation,
then green 26/26. The three older strict dependency suites retained all 21
test names and assertions under an independent amendment. Only the three
Playwright package records moved in the current-dev lockfile. Isolated
`npm ci`, matching Chromium install, and the complete unchanged-tree ten-step
gate passed: 734 Jest suites (7263 passes, four skips) and 283 Playwright
passes (24 skips). The Composer walk at 1440x900 and 390x844 had one h1,
no horizontal overflow or browser console errors; screenshot hashes are in
the task record. Three committed-tree mutants were killed and restoration
left a clean clone. All four implementation and all four closure workflows,
including every required hosted job, passed; closure is `dev@ad9dd795`.
PR #228 closed unmerged at its archived exact head, and
GitHub removed its remote source branch. `npm audit --json` still exits 1
with ten advisories (two low, three moderate, five high). PR #233 is the
remaining dependency proposal; it needs a paired React/React DOM update
before closure. PR #157 remains the sole route to `main`. T-0179 opens for
the paired React and React DOM proposal only after those closure verdicts.

T-0177 carried PR #227's Knip 6.34.0 proposal onto `dev@aa20a398`
without merging its stale branch. The independent six-name oracle was red
5/21 against the old version, then green 21/21. Knip 6.34.0 exposed one
pre-existing unused exported type, `LedgerRowPadding`; its exact identity
is recorded with a Q-011 release-gated reason, so the strict ratchet holds
18 findings. The newer transitive Zod generated a different but equivalent
nullable representation in the mission JSON Schema. The canonical schema
and only the corresponding generated-artefact canary digest changed together;
the other three held canary surfaces did not move. The first full gate caught
the 4,800 repeated-test-window cap and schema drift. An independent amendment
shared actual oracle scaffolding, reducing repeated windows from 4,819 to
4,789 and test lines by 19 without changing any of the 21 test names or
assertions. The second gate caught the canary digest. The final unchanged-tree
ten-step gate passed: 733 Jest suites (7258 passes, four skips) and 283
Playwright passes (24 skips). Three committed-tree mutants were killed. All
four implementation-push workflows and every required job passed. PR #227
closed unmerged at its unchanged head; GitHub removed the remote source
branch and local `refs/archive/t0177/` retains the exact commit. PR #157,
#228 and #233 remain open. `npm audit --json` still exits 1 with ten
advisories (two low, three moderate, five high). T-0177 closure
`dev@3190223b` passed PR CI and both Gitleaks workflows. Push CI attempt
1 was cancelled at the 30-minute real-Hermes limit: Docker `RUN npm ci`
stopped producing output before any contract assertion. A targeted rerun of
that job on the unchanged commit passed and made every push job green on
attempt 2. Both attempts are retained; the install stall's root cause is
unresolved. T-0178 opens only after that final outcome.

T-0176 carried PRs #225, #230 and #232 onto `dev@ebba3ba4` with one
regenerated lockfile: xyflow 12.11.6/system 0.0.82, Tailwind PostCSS and
related packages 4.3.3, and lucide 1.41.0. The independent eight-name oracle
was red 3/8 before the update and green 8/8 after it. An independent author
amended three expected ranges in T-0175's closed oracle without changing any
of its seven test names or assertions; the first full gate's Jest failure
remains recorded. The corrected unchanged-tree ten-step gate passed: 732 Jest
suites (7252 passes, four skips) and 283 Playwright passes (24 skips).
The isolated Composer walk at 1440x900 and 390x844 found four seeded nodes,
one h1, no overflow or console errors; screenshot hashes are in the task
record. Three committed-tree mutants were killed. All four implementation
hosted workflows and every required job passed, including full E2E, real
Hermes, macOS and the install harness. The three PRs were closed unmerged at
their unchanged heads; GitHub removed their remote source branches, and
local `refs/archive/t0176/` retains all three exact heads. `npm audit
--json` still exited 1 with eleven advisories (two low, three moderate, six
high), one fewer than T-0175. All four T-0176 task-closure workflows and
every required job passed before T-0177 opened.

T-0175 carried PRs #224, #226 and #229 onto `dev@c6d0e198` through one
current lockfile: React Query/query-core 5.102.8, tsx 4.23.13, and
dagre/graphlib 3.1.1/4.0.5. The independent seven-name oracle was red 3/7
before the update and green 7/7 after it. An isolated `npm ci`, 29 focused
tests and the unchanged-tree ten-step gate passed; the gate ran 731 Jest
suites (7244 passes, four skips) and 283 Playwright tests (24 skips). The
Composer graph walk at 1440x900 and 390x844 found all four seeded nodes,
one h1, no overflow or console errors; screenshot hashes are in the task
record. All three committed-tree mutants were killed. `npm audit --json`
still exits 1 with twelve advisories (two low, four moderate, six high),
the severity totals recorded after T-0157. The implementation push's four
hosted workflows and every required job passed. Each PR was then closed
unmerged at its unchanged head. GitHub removed its remote source branch on
closure; local `refs/archive/t0175/` retains all three exact heads. PR #157
and six unaddressed Dependabot PRs remain open. The task-closure push's push
CI and both Gitleaks runs passed. PR CI attempt 1 failed real-Hermes before
its contract tests because the PatterStage container could not bind port
42069 (`EADDRINUSE`), so its downstream acceptance was red. The same commit's
targeted real-Hermes rerun passed on attempt 2, then acceptance passed, with
all required PR jobs green. Both attempts remain in GitHub's history. The
container bind collision is intermittent and its root cause is unresolved;
investigate the harness if it recurs.

T-0174 carries the paired Pages v5 updates from PRs #235 and #236 onto
`dev@c87e5989`. The operator ruled that manual dispatch may deploy only from
`main`; the job now enforces this. Upload v5 excludes hidden files by default,
so the workflow explicitly includes them after a fail-closed generated-site
check rejects hidden paths except root `.nojekyll` and all symlinks or Windows
junctions. The independently frozen oracle was red 13/14 and is green 14/14.
The isolated Docs build made 75 pages and 559 search rows; GNU tar with the
v5 options retained `.nojekyll`, `index.html` and image assets. The full
ten-step gate passed on the byte-matched unchanged candidate, with 283 browser
passes and 24 skips; all five committed-tree mutants were killed and the tree
was restored clean. All four T-0174 closure-push workflows and every required
job passed. Pages
deployment itself waits for the workflow to reach `main` through the
operator's release process; the `github-pages` environment branch setting
must then be checked. Dependabot automatically closed PRs #235 and #236
unmerged and removed their source branches when the updates appeared on dev.
Their exact former heads are retained under local `refs/archive/t0174/`.

T-0173 is the operator-approved narrow exception to the dev-only push rule.
GitHub's default-branch `main@7b9d6d68` changed only `.github/dependabot.yml`:
the npm version-PR limit moved from 10 to 0 and the GitHub Actions limit was
added as 0. The same Git blob is on `dev` at `3fa0c2f3`. Its independently
authored oracle was red 2/4 before implementation. The final isolated ten-step
gate passed on an unchanged tree (729 Jest suites, 7223 passes and four skips;
283 Playwright passes and 24 skips), and both committed-tree mutants were
killed. The 57 added oracle lines are held by a written line-census reason.
GitHub's first `main` Docker job failed in the old Next Google-font build; its
single-job rerun passed, with both attempts retained. All four T-0173 closure
workflows and every constituent job passed on push and PR before T-0174 opened.
Dependabot alerts and
security updates are currently **disabled in repository settings**; the
version-PR limit does not enable them. The eleven existing Dependabot PRs are
still open, awaiting migration or individual disposition on `dev`. The pause
must be lifted as part of the operator's later release decision.

T-0170 carries PR #234's public liveness contract onto current `dev` without
merging its conflicting old branch: `GET /healthz` answers plain `ok` with
`no-store`, `/api/healthz` answers `{ok:true}`, and unsafe methods retain auth
and read-only checks. Its oracle was red 3/4 before source work; an independent
author preserved those four names and added a read-only case. The final
byte-matched isolated ten-step gate passed with an unchanged tree stamp, 728
Jest suites (7219 passed, 4 skipped) and 283 Playwright passes (24 skipped).
A disposable-data HTTP probe confirmed the response and refusal codes; two
committed-tree mutants were killed. PR #234 remains open for an operator
disposition after its seven-file contract is compared with the landed change.
All four hosted workflows for its closure push at `cf43a4f7` passed: push and
PR CI, plus both Gitleaks runs. PR CI included successful Ubuntu and macOS
builds, full E2E, install harness, real Hermes and acceptance-gate.

T-0171 then audited branch and PR preservation before any removal. Its review
at `org/reviews/2026-09-branch-pr-preservation.md` lists 16 registered
worktrees, two additional sibling validation clones, 15 remote branches and
14 open PRs at the inspected revision. One clone holds a named T-0169 stash
and checkpoint ref; the other has 201 expanded dirty paths. Several linked
worktrees retain distinct files, including all 15 dirty Cursor files. No ref,
checkout or PR was removed. PR #234's seven-file contract is carried on dev
by T-0170; #231's older eslint-config-next version is superseded. Unique
dependency proposals stay open until gated on current dev. The audit is an
evidence-only review, with no application or gate change.

T-0172 used the operator's explicit branch-cleanup ruling to close the two
fully addressed PRs, #234 and #231. Their exact former heads are held under
local `refs/archive/t0172/` non-branch refs. #234's remote head was deleted
with an explicit SHA lease after its PR closed unmerged. #231's Dependabot
head disappeared when its PR closed; no second deletion was issued. Final
remote checks found both heads absent, while `dev@460b3bac` and
`main@9b786b76` remained fixed. Twelve PRs remained open: #157 and eleven
Dependabot proposals. #231 had six optional bundled WASM lockfile records
absent from dev; the same dependencies were already declared under its
unchanged Tailwind parent, and its stated ESLint update was superseded by the
paired 16.3.6 update. The surviving unique version proposals must be gated
on current dev before their source PRs and branches can retire.

ADR-0012 and its independently prompted correction ADR-0013 were accepted by
the operator and filed before T-0158 implementation. The correction records
private-proxy network isolation, token rotation, read-only navigation renewal,
the narrow POST sign-in bypass and token-free onboarding. T-0158 remains next
for the security prerequisite. The operator has put branch and PR consolidation
first. A read-only inventory found 14 open PRs and 16 registered worktrees;
dirty checkouts and detached heads hold distinct working files. The two
oracle commits that `git cherry` marked non-equivalent have byte-identical
changed test blobs on `dev`; neither proves the other dirty files are safe to
discard. The detailed preservation ledger is T-0171. No ref, PR or worktree
has been removed.

T-0169 repaired the Settings `#env` anchor race traced in T-0167's hosted PR
full E2E. A delayed Hermes read expanded the preceding editor after the
initial hash jump and could push the heading out of view. The new browser
oracle failed 0/1 on the original production bundle and passed 10/10 with
two workers after Settings waited for its layout-affecting reads and file
state to settle. A new Jest behaviour oracle holds that readiness guard; its
committed-tree mutant was killed by assertion. The final isolated ten-step
gate passed with an unchanged tree stamp, 727 Jest suites (7214 passed,
4 skipped) and 283 Playwright passes (24 skipped). A separate-data visual
walk at 1440x900 and 390x844 found the heading in view, one h1, no console
errors and no horizontal overflow; screenshots and hashes are in T-0169's
record. All four T-0168 and all four T-0169 hosted workflows completed
success, including macOS, PR full E2E, install and acceptance. The session
ADRs are now accepted; implementation waits behind the branch/PR audit.

T-0168 repaired the remaining T-0163 bootstrap-oracle path alias. T-0167's
hosted push and PR macOS jobs failed two literal-path event assertions, while
PR full E2E failed one Settings `#env` heading-in-viewport assertion; both
Gitleaks runs and all other substantive push/PR jobs passed. Acceptance was
red downstream of PR full E2E and macOS. The independent T-0168 author kept
all six original credential test names and added a symlinked-TMPDIR test,
which reproduced the macOS failure on Linux before the fixture change. A
native-Linux symlinked-TMPDIR run then passed 23/23 credential tests; its
credential mutant was killed by assertion. The first isolated gate failed
only the line census, which measured 51 added test lines. Baseline commit
`2881c601` records the exact rise and reason; the repeated ten-step gate
passed with an unchanged tree stamp, 726 Jest suites (7213 passed, 4 skipped)
and 282 Playwright passes (24 skipped). Hosted checks for T-0168 completed
success as noted above. The separate Settings anchor layout race is repaired
by T-0169.

T-0167 corrected the independently authored T-0163 credential oracle for
macOS. T-0163's push CI `36309526484` and PR CI `36309529732` failed only
macOS Jest; all other jobs, including PR acceptance, full E2E and both
Gitleaks runs, passed. The product correctly failed closed under injected
chmod denial; the test had treated Darwin as Windows. Commit `776607d2`
extends POSIX assertions to Darwin and retains all 22 test names. Windows and
native Linux focused runs each passed 22/22. The Linux committed-tree mutant
was killed by assertion. The isolated ten-step gate passed with an unchanged
tree stamp, 726 Jest suites (7213 passed, 3 skipped) and 282 Playwright
passes (24 skipped). Hosted checks for the T-0167 closure push remain to be
observed. The browser-session ADR in T-0158 is next after hosted green.

T-0163 closed locally at candidate `b2d95e31`. Independent red-first oracles
proved fresh and existing credential files, Hermes home and backups private
under Linux umask 000, plus a planted staging file or symlink and two backups
within one millisecond. The first independent review found real directory and
staging gaps; the second found those closed with no new material defect. Native
Linux focused Jest passed 22/22 and the committed-tree sweep killed 9/9 by
assertion. The final isolated ten-step gate passed with an unchanged tree stamp:
726 Jest suites (7213 passed, 3 skipped) and 282 Playwright passes (24 skipped).
An earlier final-candidate gate lost its owned web server after 223 Playwright
passes; the first affected spec passed alone and the next unchanged full gate
passed. T-0163 records both runs, the earlier config-mock failure and its fix.
Hosted push and PR jobs failed only the later-corrected macOS oracle as noted
above. T-0164 reconnaissance and T-0165 Phase 2 plan remain open. PR #157
remains open; Q-011 still bars structural cleanup before an operator release.

T-0162 repaired the remaining blind read, write, form-name and Knip gates at
`745337fa`. It finds five hand-read files, four raw-write files, 158 controls
with zero unnamed, and 17 exact unused Knip issues held for Q-011 release
review. A planted unused test helper made the widened Knip gate fail; its
removal restored green. Independent C6/C8 and form-control amendments retained
test identity, as did the separate ModelEditor selector correction. The clean
isolated ten-step gate passed with an unchanged tree stamp, 723 Jest suites
(7191 passed, 3 skipped), and 282 Playwright passes (24 skipped). Seven of
seven committed-tree mutants were killed and restoration left a clean tree.
The ModelEditor modal, provider dropdown and validation state were captured at
1440x900 and 390x844 on a separate-data instance. Six accessible field names
resolved once each, with no console errors or horizontal overflow. T-0162 is
closed; push and PR CI, both Gitleaks runs, hosted acceptance and full E2E all
completed success at its closure push `575b0d66`.

T-0156 repaired the Help Server Component boundary at `5d2c7eb8`. Its red-first
browser oracle failed on 74 non-index guides before the fix and now walks all
75 committed manifest guides, checks the previous icon, and retains a 404 for
an unlisted guide. A separate boundary oracle failed 1/1 against the original
function-valued icon prop. The isolated ten-step gate passed with an unchanged
tree stamp: 720 Jest suites, 7171 passing tests and 3 skips; 282 Playwright
passes and 24 skips. The 1440x900 and 390x844 visual walk found one h1, the
icon, no console error and no horizontal overflow. The committed-tree sweep
killed both mutants by assertion failure. T-0156 push and PR CI, Gitleaks and
hosted acceptance completed success.

T-0161 closure push `2a072836` initially failed only the push CI
`real-hermes-integration` job when Docker's `npm ci` hit an EEXIST cache error
before app tests. The individual job rerun passed, and the same-commit PR CI
completed all jobs, including full E2E and acceptance, successfully. Both
Gitleaks runs passed. The original failed attempt remains part of the record.

T-0161 is done at hosted candidate `9ff2e257`. Production builds leave isolated
SQLite data untouched. Setup/update back up both database names and sidecars
before migration or Hermes import, and the explicit seed fails closed on
missing or partial input. Node backups are owner-only from creation; shell
backups use `umask 077`. Independent review accepted the final root and deploy
corrections. The complete ten-step isolated gate passed with 719 Jest suites,
279 Playwright passes and an unchanged tree stamp. The two Linux Docker update
scenarios passed. A committed-tree sweep at `7beb4ffb` killed 34/34 Windows mutants; an
earlier Linux sweep killed its creation-mode mutant 1/1. The record documents
red-first amendments, census growth and the bounded `closeSync` limitation.
The earlier push `050ad61d` exposed macOS Jest and Ubuntu build-purity failures.
The next push `ce9808cf` exposed Linux/macOS oracle fixture failures; its PR
full E2E and acceptance jobs passed. The fixes retain all test names and the
same behavioural assertions. The latest Linux focused reproduction passed 2/2;
the full isolated gate and 34-mutant sweep passed. Push CI `36298705166`, PR CI
`36298707475` and both Gitleaks runs all completed success. PR full E2E and
acceptance passed. PR #157 remains
open; Q-011 still requires an operator release before structural cleanup.
Next is T-0156 Help boundary repair, then T-0162 and T-0163. The full
reconnaissance and Phase 2 plan are still outstanding and need separate plan
approval before structural execution. EOS renderer `1d20607858a180b12e3da2f1a0ad1192dbb187f9`
renders the derived views.

## Dated status, 2026-09-26

The preliminary review and K0–K7 are committed, but the full recon is not
complete. T-0159 adds a source-linked ledger for 265 findings, 163 split
operator dispositions and 107 historical coverage bullets. The latter are
compound source bullets, not 107 proven investigations. Their current status
remains pending decomposition. The ten new operator choices are Q-019–Q-028 in
`org/QUESTIONS.md` and the dated review addendum. Q-025 preserves Select and
Picker as separate controls; Q-023 requires an independently authored C8
oracle amendment. No structural batch is approved by this status note.

The proposed prerequisite order was T-0160, T-0150, T-0157, T-0161, T-0156,
T-0152, T-0162, T-0163, T-0158, T-0164 and T-0165. The full Phase 2 plan
follows reproducible recon and requires separate operator approval. The phone
sessions path now passes hosted full E2E and acceptance on PR run 36265744171.
That run still failed macOS Jest in the fixture oracle, so CI is not green.
PR #157 remains open, and Q-011
still requires a release before structural cleanup. Use an isolated data
directory for builds until T-0161 removes build-time database writes.

T-0150 moved ahead of T-0160 because the T-0159 push left hosted acceptance
red. The T-0159 PR run reproduced that phone failure on 2026-09-26 (run
`36262946981`: 270 passed, 25 skipped, one failed). T-0150 now prepares one
completed fixture session in Playwright's disposable database before server
boot, checks it from global setup, and points the web server at an isolated
Hermes home. The phone strip assertion is unchanged. The focused phone,
session-list and detail run passed 46 tests with one unrelated skills-detail
skip; hosted acceptance must still be read after T-0150 is pushed.

The T-0150/T-0152 push at 03f93d1a was read on every hosted job. Full E2E,
acceptance, Linux build/test, install, Docker, shell and both boot-smoke jobs
passed. The sole PR failure was macOS Jest: the fixture preparation rejected a
temporary directory whose lexical `/var` parent resolves through macOS's
`/private/var` link. T-0160 includes the narrow real-path correction; hosted
macOS confirmation is pending its push.

The T-0150 candidate exposed a separate real design-census failure: the
no-agent notice's `mx-6` put its card 24 px inside the shared page column on
Profiles, Sessions and Missions. T-0152's three browser oracles failed at
24 px before the fix and passed after removing that margin. The original
`routesWithSplitBlocks` baseline stayed at one. Three dedicated post-fix
census runs read one split, and the last two agreed on every reported measure.
The earlier intermittent Chat split was not reproduced with an isolated
Hermes home and fresh e2e data, so the harness's measure and tolerance remain
unchanged.

T-0160's first runner oracle was committed red at five of seven tests, then the
isolated validation clone passed all nine gate steps at 40bfab86 with 695 Jest
suites, 275 Playwright passes and `treeMoved=false`. A partial census-only run
left the full summary hash unchanged. The committed-tree sweep killed all four
runner mutants with passing controls before and after. Independent review then
found four counterexamples: a symlinked checkout tmp root could permit an
external wipe, a symlinked sweep target could permit an external write, a
thrown `TypeError` could count as a kill, and a missing rerun spec could pass
selection. The reviewer authored a separate amendment, red at four of four in
e9d10d05. All four focused tests passed after guard repairs, but follow-up
review found a runtime `TypeError` could still masquerade as a kill by quoting
`expect(` later in its message. A second independent amendment, e3834858, was
red at one of two and passed with a first-line classifier. A further review
found that even a thrown Error can begin with `expect(`. A controlled Jest JSON
run showed that real matcher failures carry `failureDetails.matcherResult`,
while the impersonating thrown Error has an empty failure detail. A third
independent amendment, 1feea88f, was red at one of ten. The classifier now
requires the structured failed matcher result. The reviewer then showed that
a plain Error can carry forged matcher metadata. A fourth independent oracle,
5dddc234, was red at one of two; an independent fixture-only amendment,
4af356d3, made three earlier fake reports match real Jest JSON without
changing test names or assertions. Kill attribution now correlates the
matcher result with the failure message and matcher stack frame. Five focused
T-0160 suites pass. The latest full gate failed after 183 browser passes when
the web server stopped answering; alignment, settings and navigation specs
all passed when rerun alone, and both full and standalone results are retained.
The next full run exposed two notice timeouts under load. Its Playwright traces
showed that one mocked monitor response left about 146 ms before the old
visibility timeout, and another route had not requested monitor by that
timeout. An independent author amended T-0152's browser oracle in a10cc774
to await the mocked monitor response and then the same notice and one-pixel
alignment assertion. The focused isolated run passed all three cases. The
full gate passed again on the isolated clone: 699 Jest suites, 275 browser
passes, all nine steps exit zero, and its tree hash did not move. The first
committed-tree sweep at d671496b gave one KILLED and three ERROR, so T-0160
remains open. A controlled Jest JSON probe found two real matcher shapes the
classifier excluded: a failed negated assertion reports pass:true, and a
failed toThrow assertion may omit the matcher name. The temporary probe was
removed. Independent amendment a5b53cb3 was red at two of four; all six
focused T-0160 suites passed at 20 tests. The second committed sweep killed
two mutants but still reported two as ERROR. An unmutated nested-callback
Jest probe showed their likely cause: a real matcher stack can start `at toBe`
instead of `at Object.toBe`. The independent 7d25a7e6 oracle was red at two
of three. The classifier now accepts either form while retaining structured
matcher, invocation and message correlation; seven focused suites pass at 23
tests. The final isolated complete gate passed all nine steps on an unchanged
tree: 701 Jest suites, 275 Playwright passes. The committed-tree T-0160 sweep
at 4750b7ce killed all four mutants with passing controls and verified
restoration. T-0160's local record is complete; hosted CI must still be read
after the closure push before the next batch starts.

Hosted PR CI on fa423657 subsequently passed every job, including macOS and
full E2E. The push CI failed one macOS Jest case in the older Models-page
reload suite: after its mock GET gate opened, the button still said
“Re-importing…” at the final wait boundary. The unchanged suite passed alone
on Windows, two of two. T-0166 records the follow-up. An independent author
kept the same two test names and thirteen assertions, tracked the held GET
promises and opened the gate inside async React `act`. The focused amended
suite passes. T-0166's isolated full gate passed all nine steps on an
unchanged tree, with 701 Jest suites and 275 Playwright passes. Its committed
mutation sweep at e4db8cb2 killed the final enabled-button mutant. The local
record is closed; hosted macOS and the other push/PR jobs still need to pass
before T-0157 begins.

Hosted push and PR CI for 11d11212 subsequently passed every job, including
push macOS coverage and PR acceptance. T-0157 is now active under Q-019.
Its four-case framework-pair oracle was committed red in 2794ae27, then
`next` and `eslint-config-next` were installed together at 16.3.6. The local
audit fell from 15 advisories including one critical to 12 with no critical;
root PostCSS remains high and belongs to the later dependency batch. The
output canary has not moved. The local gate result is recorded below; hosted
CI remains pending this batch's closure push.

T-0157's isolated full gate later passed all nine steps under 16.3.6: 702
Jest suites, 279 browser passes, and no tree movement. A temporary isolated
production server returned 200 for health, 401 for anonymous protected reads
and writes, and 503 for an authenticated write under PS_READ_ONLY; each
response carried DENY and frame-ancestors 'none'. Both committed version
mutants were killed. An independent R2 reviewer found the lockfile scope
sound but required a rollback plan and separately authored acceptance oracle
before close. The rollback plan is recorded. The independent black-box oracle
passed four of four focused and in the complete gate. The original version
oracle's authorship deviation remains recorded, rather than represented as
compliant red-first independence. The sweep at e6a77b6b killed both mutants
with passing controls and restoration. Independent R2 follow-up found no
local blocker to closure. Hosted push and PR jobs remain to be checked.

All four hosted workflows for the T-0157 closure push at 8d336c4d later
completed successfully: push and PR CI, and push and PR Gitleaks. T-0161 is
now active at R2. A direct `npx next build`, with an empty isolated
`PS_DATA_DIR` and no npm prebuild, still created a schema-version-42 SQLite
database and its WAL sidecars. The package prebuild independently opens and
seeds repository data. Both paths need correction. The update paths also
continue after a backup failure, so the backup-before-migration invariant
needs a failure case, not just a happy-path ordering check.

This page is the one to read before touching the tree. It says where the
work stands, what was learned landing it, what is still open, and the exact
steps a batch goes through. Everything it names is on disk; nothing lives in
a chat.

## The K programme (from 2026-09-12)

The consolidation programme is closed. What runs now is the refactor and
clean-up programme, K0 to K19, from task T-0146, after the codebase review of
2026-09-11.

**Read these three first.**

1. `org/reviews/2026-09-decision-register.md`. Every decision the review left to
   the operator, re-verified read-only at `ce4ac1fd`, with each option's
   consequence, a recommendation and the ruling. Ruled on 2026-09-12: the
   operator adopted option (A) for all eight questions and, with them, every
   item's recommended option, saying "correct any of them and I will unwind that
   one".
2. `org/reviews/2026-09-codebase-review.md`, the review index, and its evidence
   companion.
3. `org/QUESTIONS.md`, Q-009 to Q-016, folded with their answers.

**Two rulings bind every batch.** A closed programme's oracle changes only by a
dated amendment its implementer does not author, for the one rule or key the
ruled item fixes (Q-015). Public contract means routes, npm scripts, env vars,
config keys and documented exports, not any exported TypeScript symbol (Q-010).

**What the verification found that the review had not.** `dev` CI had failed on
every push since 2026-09-05: 61 runs, 55 failed, 6 cancelled, last green
`d84b7528`. About fifty records from T-0095 to T-0145 landed on red CI while
this page said green, because no step of the landing discipline read CI. The
line below that said "dev is pushed and green" was true of the local gate and
false of CI, and that is the whole lesson.

**So the procedure gained a last step:** after the push, the pushed commit's CI
is read and must be green before the next batch starts.

## Read in this order

1. `CLAUDE.md` (the never-rules), then `org/START.md` (boot by mode).
2. `org/plans/2026-09-consolidation.md`: the programme, batches C0 to C8,
   the census that referees it, and the corrections each batch wrote into
   its row.
3. The last task record, `org/tasks/T-0145.json`, and `org/TASKS.md` (the
   derived live view) for the rest.
4. `docs/contributing/testing.md` ("Shared test doubles") and
   `docs/contributing/repo-guide.md` (the read and write rules) for the
   conventions the last batches introduced.

## Where the programme stands

`dev` is pushed, and every job was green on `7457c579` (2026-09-12; see the K
programme above). Every batch below has a task record, an oracle committed red
first, a gate by exit code, a mutation sweep against the committed tree, and a
chore commit carrying the record and the derived views.

| Batch | Record | What it did | Landed |
| --- | --- | --- | --- |
| C0 the line census | T-0135 | `npm run census:lines`, twelve measures, shrink-only | yes |
| C1 one route body | T-0136 | `route()` wrapper over 115 handlers; 13 routes keep their own catch with a reason | yes |
| C2 one type each | T-0137 | MissionDraftFields, ModelIdentity/ModelRow/ApiModel, syncSuccess/syncFailure | yes |
| C3 one way to write | T-0138 | `runWrite` in `src/lib/api/api-write.ts`; four helpers and toastFromResult deleted; Story Weaver reads on `useApiResource`; census reads by AST; lint rule `no-raw-write-outside-the-helper` | yes |
| (fix) Models page keeps its body | T-0139 | a reload no longer swaps the page for a spinner; found by C3's walk | yes |
| (fix) custom fallback identity | T-0140 | migration 042 (head is 42): a custom fallback keeps its typed name, provider, model id | yes |
| C4 the test harnesses | T-0141 | fifteen factories in `tests/helpers`; 130 suites adopted by six agents with per-file identity; census counts dbSingletonMock as a factory | yes |
| C5 comments that narrate | T-0142 | narration cut file by file (two passes, ten agents); code proved unchanged by a stripped-code diff | yes |
| C6 the page layer | T-0143 | eight agents over disjoint file groups: six design-lint rules to zero (the whole baseline, 369 to 0), the eleven effect reads onto `useApiResource`, 27 one-importer folds, two pages that swapped their body on reload fixed | yes |
| C7 the lib root | T-0144 | 65 of the 71 root files into fifteen domains, by codemod, with every import rewritten; six stay, each saying in its own header why it belongs to no domain | yes |
| C8 closing | T-0145 | the last duplication taken by five agents, then the census read against every target, the five misses recorded with their numbers, and the plan marked done | yes |

The plan's remaining ids moved by two for the fixes taken in between; the
plan header says so.

### The K batches, so far

| Batch | Record | What it did | Landed |
| --- | --- | --- | --- |
| K0 the rulings | T-0146 | the decision register rendered from the verification journal, 121 entries with a ruling each; Q-009 to Q-016 folded | yes |
| K1 CI green | T-0147 | six case-broken doc links, extract.ts's lazy imports as file URLs, the smoke's deleted route; plus a suite missing `navigator` and a census report cut at the macOS pipe buffer. First green CI since 2026-09-05, 63 pushes earlier | yes |
| K2/K3 the discipline | T-0148, T-0149 | ADR-0011 ratifies T-0144's protected-set edits and restores 47 closed records; `npm run gate` (nine steps, by exit code, tree-stamped) and `npm run sweep` (mutants as committed data, four outcomes) | yes |
| K4 the security set | T-0151 | the six review findings that needed no operator ruling: the URL guard's IPv6 expansion, the workspace guard's path test, one client-key derivation with an observable prune, file modes at every writer of operator data plus the copies already on disk, the x-ps-\* signing cases, and the Docker build context | yes |
| K5 the ruled security items | T-0153 | critic-04 forbids framing on every response with a body; app-06 leaves read-only to the proxy and keeps the six host-side guards; critic-05a documents the signature's body gap | yes |
| K6 the gates see | T-0154 | the raw-control rule 0 to 104; routesWithTryCatch 13 to 18; the link gate 75 documents to 91 with three stale links repointed; scriptsLines, a new measure over the tooling; three uncalled test helpers gone. Four more blind gates deferred, each named with what it waits on | yes |
| (raised) e2e sessions seeding | T-0150 | proposed: `e2e-full` needs sessions only a Hermes-equipped machine has | no |
| (raised) the census reads twice | T-0152 | proposed: `routesWithSplitBlocks` read 1, then 2, then 1 on one unchanged tree | no |

**Three lines the next session should not have to learn the hard way.**

*Run the sweep, and read a survivor properly.* K4's sweep found two holes that
the gate, an independent review and a careful reading had all passed over: a
count with a floor loose enough to survive deleting the thing it guarded, and a
`.dockerignore` test that a commented-out rule still satisfied. K5's found three
more, and all three were the MUTANTS being wrong, not the oracle. A survivor is a
defect in one or the other, and saying which is the work.

*Do not amend your own frozen oracle.* K5's implementer did, on the one case
guarding the premise its ruling rested on, and the independent reviewer caught
it. The fix was to change the product prose so the oracle had nothing to amend
for. Q-015 sends an amendment to a session that is not you, and
`org/policy.json:107-111` makes it a stop condition.

*Never hand npm an argument with a newline in it.* npm re-spawns through
`cmd.exe /d /s /c`, which truncates any argument at its first newline. That is
`npx` and `npm run -- <arg>` alike, and it takes positionals as well as `-e`.
Measured here, three ways:

    node -e '<print argv>' $'X\nY'                 ->  ["X\nY"]   intact
    npx tsx -e '<print argv>' $'X\nY'              ->  ["X"]      TRUNCATED
    ./node_modules/.bin/tsx -e '<print argv>' $'X\nY'  ->  ["X\nY"]   intact

So node is innocent, tsx is innocent, and the Windows argv boundary is innocent:
a live process on this machine carries a 1,291-character `--eval` with thirty
newlines in it. It is npm's shell hop, and it fails SILENTLY at exit 0. On
2026-09-12 a session lost three hours to the blocking variant — the script was
cut to nothing, so node fell into a stdin REPL and waited forever — but the
quiet variant is worse: when the first line happens to be a complete statement
you get a partial run, exit 0, and an answer you will believe.

The repo already had the rule and it was not being followed:
`scripts/tooling/ps-deploy.mjs:205` says `node --import tsx <script.ts> [args]
→ argv-safe, no npm/npx/shell`. Ad-hoc probes go in a temp `.mjs`, or through
that form. This is the same lesson as "patch scripts go through the Write tool,
never a bash heredoc", one layer down.

**Phase 0 is done.** K0 to K6: the rulings, CI green, the discipline in the
repo, the security set, and the gates that can see. What follows is Phase 1, the
full recon (`org/reviews/2026-09-refactor-recon.md`), then Phase 2's plan, which
**the operator approves before any Phase 3 batch starts**.

Read the recon's brief in the plan before starting it, and note why the gates
came first: the recon and the plan are measured by them, so a census that could
not see `scripts/` would have set the next plan's targets against numbers that
were not true.

**One ruling is worth asking for.** T-0154's notes record it: `hooks-04`,
`hooks-05` and `critic-06` are blind gates deferred here not because of the
dependency this record first gave, but because none of the three has a ruled
entry in the register at all, and Q-015 permits amending a closed oracle only
for the one rule a RULED item fixes. `hooks-04` is the one to put to the
operator: register `:3144` says its fix may land "with a baseline and a c6
amendment (the same ruling as components-01)", and K6 already amends c6 and
already opens a design-lint baseline.

## The census, now against the plan's targets

| Measure | Plan start | Now | Target |
| --- | --- | --- | --- |
| src lines | 107,123 | 100,881 | ≤ 98,000 (missed by 2,881) |
| tests lines | 121,651 | 121,114 | ≤ 116,000 (missed by 5,114) |
| src lines in a repeated window | 1,416 | 1,000 | ≤ 600 (missed by 400) |
| tests lines in a repeated window | 6,028 | 4,343 | ≤ 2,500 (missed by 1,843) |
| routes with their own try/catch | 82 | 13 | ≤ 13 (met, corrected at C1) |
| hand-rolled reads (by AST since C3) | 5 (regex) | 0 | 0 (met) |
| named hooks writing on their own | 4 | 0 | 0 (met) |
| repeated type shapes | 23 | 2 | 3 (met) |
| one-importer components | 130 | 103 | ≤ 95 (missed by 8) |
| lib root files | 71 | 6 | ≤ 12 (met) |
| comment essays | 107 | 9 | ≤ 60 (met) |
| suites mocking db inline | 100 | 14 | ≤ 20 (met) |
| design-lint debt (all rules) | 350 | 0 | 0 (met) |
| jest | 6,860 | 6,920 (684 suites) | unchanged by a test batch |

## How a batch is landed (the discipline, verbatim from practice)

1. Write the oracle suite first, run it red, commit it red:
   `test: the CN oracle, red at X of Y, T-01xx`.
2. Implement. Patch scripts go through the Write tool, never a bash heredoc
   (heredocs on this box strip a backslash level; a `\b` became a backspace
   byte once).
3. Walk anything visual on the isolated instance:
   `PS_AUTH_TOKEN=u14walk PS_DATA_DIR=<a scratch dir> CH_DATA_DIR=<the same dir> PORT=3939 nohup npx next start -p 3939`
   (any empty directory outside the repo; the instance seeds it),
   visit `/?ps_token=u14walk` first, drive it with a Playwright script, stop
   the port. `npm run build` first if src changed.
4. The gate, by exit code, on the finished tree, with nothing edited while
   it runs: `npm run gate`. The runner frees the ports, clears `.next/dev`,
   stamps the tree before and after, runs the nine steps in order to their
   own logs, stops at the first red one and writes `.gate/summary.json`.
   The step list lives in `scripts/tooling/gate.mjs`, and
   `npm run gate -- --list` prints it, so no document restates it and none
   can drift from it. A Playwright spec that fails only under the gate's
   load is re-run with `npm run gate -- --rerun-alone <spec>`, and both
   results go on the record.
5. `git add -A` and the feat commit, with the gate's numbers in the message.
6. The mutation sweep against the COMMITTED tree:
   `npm run sweep -- tests/fixtures/mutants/T-01xx.json`. The mutants are
   committed beside the tests as data, so anyone can re-run the sweep. It
   refuses a dirty tree, and it reports NOT-APPLIED for an anchor it could
   not place exactly once and INEFFECTIVE for a no-op or comment-only edit,
   neither of which is a kill. A survivor gets the test it asks for as its
   own commit, then the sweep is re-run.
7. The record: `org/tasks/T-01xx.json` (intent, tier and reasons, claims,
   invariants, commits, verification with the numbers, mutation, deviation),
   then the views, from this repository's root with the EOS checkout on the
   path:

   ```
   PYTHONPATH=../PatterTech_EOS python -c "from tools.eos import taskops; print(taskops.render_views('.'))"
   ```

   then `node scripts/tooling/check-derived-views.mjs`,
   `node scripts/docs/build-site.mjs --manifest-only`, the chore commit,
   `git push origin dev`. The record names the EOS commit its views were
   rendered with.

8. **Read the pushed commit's CI, and do not start the next batch until it
   is green.** `gh run list --branch dev --limit 1`, then
   `gh run view <id> --log-failed` on anything red. This step exists because
   its absence cost six days: `dev` failed on all 61 pushes from 2026-09-05
   while about fifty records reported a green local gate, and two of the
   three causes could not be seen from Windows at all.
8. The line census: `--update-baseline` after a fall; a rise only with
   `--allow-growth "<reason>"`, and the reason is what the file keeps. The
   design-lint baseline works the same way. The output canary is
   re-blessed (`npm run canary:bless`) only for an intended change such as
   a new migration file, in the same commit.

Agents: a batch that touches many files in the same way is split into
disjoint file groups, one background agent each, with a written brief the
agent reads from disk; each agent runs its files before and after, proves
identity (test names through jest's JSON reporter, or the stripped-code
diff for a comment batch), and reports a table. The coordinator runs the
identity oracle, the census and the gate over the whole tree afterwards.

## Open items (none blocking)

- **C7, C8** remain; C7's starting notes are below.
- **Twelve design-lint pragmas** excuse the six C6 rules, each with its
  reason on the line (react-flow nodes, a code block inside rendered HTML,
  a range slider, a two-line list row, the chat composer's ref-focused
  textarea, a POST that reads, a debounced autosave, a warning callout, a
  pill that is a link). Three would go with small primitive changes:
  `Card` taking `role`/`style`/`data-*`, `Textarea` taking a `ref`, a
  warning tone on `LoadErrorBanner`.
- **The useGatewayHealth probes** lost their per-call 3s/5s abort deadlines
  when they moved onto `useApiResource` (apiFetch's default timeout applies).
- **Two design census measures rose**, with the reason written into the
  baseline: mono share 0.67 to 0.68 (the shared Button and Badge are mono by
  decision 10, and the batch adopted them widely) and decorative borders
  below 3:1 691 to 714 (Card's hairline rung is 1.63:1 on purpose). The
  measure that is a target, control borders below 3:1, fell 102 to 82.
- **Rows added as custom fallbacks before migration 042** read "Custom";
  their identity was never stored and cannot be recovered. The CHANGELOG
  says to add them again.
- **An eslint policy call** for the operator: every one-line factory
  adoption in tests pays an `eslint-disable-next-line
  @typescript-eslint/no-require-imports` for the hoisting-safe `require`
  inside `jest.mock`. A tests-scoped override of that rule would free about
  a hundred such lines. Not done, because it is a lint-policy change.
- **Two e2e specs flake only under the gate's load**: the composer spec's
  read after a save (now retries once on ECONNRESET, T-0139) and the help
  deep-link `?` shortcut on Missions (a two-second navigation window).
  Both pass alone every time; the record of each gate says so.
- **T-0140's fallback rows** on the isolated instance's data dir are walk
  artefacts, not product data.

## The programme is closed. What is next

The consolidation programme (C0 to C8, T-0135 to T-0145) is done and the plan
is marked done, with its own account of what met its target and what did not
in `org/plans/2026-09-consolidation.md` under "What the programme did". The
five misses are named there with their numbers and the reason each one is a
number rather than a failure.

Nothing in the programme is outstanding. What waits, in the operator's order:

1. **The v1.0.0 release.** The release actions have always been the
   operator's: the migration script on a copy of a real install, the Docker
   matrix, the tag. The checklist is in `docs/running/migration.md` and
   `org/plans/2026-09-final-release.md`. Nothing since has changed that order.
2. **The open items below**, none of which blocks a release.
3. **If another consolidation batch is wanted**, the honest remaining targets
   are the two line counts, and the census `--report` says where they are:
   `srcDup.byFile` and `testDup.byFile` name the files, `essays` the
   comment-heavy ones. The largest single item left is the missions page's
   handler lists, which are a prop-drilling shape rather than copied code, so
   the fix is a context or a hook object rather than a fold.

## Release

The v1.0.0 tag waits on the operator after the programmes; the release
actions (the migration script on a copy of a real install, the Docker
matrix, the tag) are in `docs/running/migration.md`'s release checklist and
`org/plans/2026-09-final-release.md`. Nothing here changes that order.
