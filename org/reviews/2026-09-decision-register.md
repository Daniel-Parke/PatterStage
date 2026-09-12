---
summary: Every decision the 2026-09 codebase review leaves to the operator, re-verified read-only at ce4ac1fd, with the options, their consequences, a recommendation and the ruling
type: review
tags: [review, decisions, refactor]
status: ruled
---

# PatterStage · Decision register (2026-09-12)

> The companion to `org/reviews/2026-09-codebase-review.md` (the index) and
> `org/reviews/2026-09-codebase-review-evidence.md` (the evidence). This page is the
> decision queue: what only the operator can rule, what each option costs, what is
> recommended and why, and the ruling once it is given.
>
> **How it was made.** Every one of the review's 110 operator-decision findings was
> re-verified read-only against `ce4ac1fd` by seven verifiers over disjoint themes,
> each challenged by an adversarial sceptic that went back to the tree, then swept by a
> completeness critic. Findings that hid two decisions were split (`-a`, `-b`), which is
> why 121 entries carry 110 finding ids. The critic added the decisions no theme owned.
>
> **Ruled on 2026-09-12.** The operator adopted option (A) for all eight questions, and
> with them every item's recommended option, saying: correct any of them and I will unwind
> that one. So each entry below carries its ruling, and a reversal is a one-line edit here
> plus the batch that acts on it.
>
> Two rulings bind every later batch and were taken first, because the programme could not
> move without them: a closed programme's oracle changes only by a dated amendment its
> implementer does not author (Q-015), and public contract means routes, npm scripts, env
> vars, config keys and documented exports, not any exported symbol (Q-010).

## The eight questions

Each question groups items whose answers stand or fall together. Option (A) is the recommendation in every case.

### Q-009 · CI, landing gates and the PR queue

Is CI the binding gate from now on?

(A) Yes (recommended):
- make dev CI green first, in batch 0;
- each batch waits for its pushed commit's CI before the next starts;
- add the in-repo `npm run gate` runner;
- the census becomes a CI step and the design census a runner step;
- main requires checks with enforce_admins on and reviews set to 0;
- the operator installs the hook once;
- CI trims (tsc, macOS, prebuild) only after a green run;
- land Node 24 with a minimum of 22, the safe Dependabot bumps and the Pages action pair;
- close PR #234.

(B) Green first, but the local gate stays authoritative: no per-batch CI wait, and protection unchanged.

(C) Green first, and protection is enforced on dev too: every batch lands by PR.

**Items:** `POLICY-ci-green`, `tooling-01`, `tests-02a`, `tests-02b`, `tooling-30a`, `tooling-30b`, `POLICY-solo-protection`, `docs-06a`, `org-12c`, `tests-18a`, `tests-20`, `tooling-15a`, `tooling-31`, `tooling-20b`, `tooling-25`, `tooling-04`, `POLICY-dependabot`, `POLICY-dependabot-actions`, `PR-234-healthz`

**Why these together:** Every one of these assumes CI can go green and then binds merges. Required checks, CI trims, the Node bump and Dependabot all depend on that answer (ADR-0006:42, :70).

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

### Q-010 · Governance as written

Does the programme follow the governance as written?

(A) Yes (recommended):
- ADR-0011 ratifies T-0144's four protected lines, and the closed records' original text is restored;
- codemods walk only their claimed paths;
- two writing lanes;
- R2 work runs high-assurance;
- internal exports are not public contract;
- new task records get a shape check;
- the mutation sweep becomes an in-repo script;
- views render from the pinned EOS checkout;
- the landing procedure moves into PLAYBOOKS;
- cadences and sampled review run;
- eos-compile.mjs is retired;
- the Cursor rescue is completed, then the operator removes the worktree.

(B) Amend governance to match practice by ADR: ratify all of T-0144's edits, raise the lane cap, allow standard mode at R2, read public-contract literally, suspend cadences.

(C) Revert T-0144 entirely and keep the literal readings.

**Items:** `org-01a`, `org-01b`, `POLICY-lanes`, `org-02`, `org-03a`, `org-03b`, `POLICY-public-contract-scope`, `org-04`, `POLICY-renderer`, `org-06`, `org-05`, `org-11`, `tooling-12b`, `org-12a`, `org-12b`

**Why these together:** Each item either keeps the written policy (policy.json, EXECUTOR.md, PLAYBOOKS.md, ADR-0010) or amends it to fit practice. Their tier and lane consequences compound, so the answers must be consistent.

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

### Q-011 · Release order and the first post-1.0 removal release

When does v1.0.0 ship relative to this programme, and what does it keep?

(A) Recommended:
- after batch 0, the security defects and the build-before-backup fix, cut rc.1 and v1.0.0, then run the structural batches;
- keep the CH_ and CONTROL_HUB_ names, AGENT_HOME, x-ch-* headers, ch-* shims, ch.sessions.* keys and the 52 redirects through v1.0.0, with a boot warning;
- retire them together in the first post-1.0 release, with a tripwire for the security aliases, keeping control-hub.db discovery and ps-relocate;
- keep setup.mjs and the log location, as the plan deferred;
- fix CHANGELOG contradictions now and do the editorial pass at rc.1.

(B) Run the whole programme first, then release, with the retirements after 1.0.

(C) Retire the legacy names and redirects before v1.0.0.

**Items:** `POLICY-release-order`, `POLICY-aliases`, `cross-cutting-04a`, `cross-cutting-04b`, `critic-05b`, `app-21`, `hooks-25`, `lib-domains-14a`, `tooling-11a`, `tooling-11d`, `critic-08`, `app-15a`, `docs-04`, `docs-03b`, `tooling-03`, `lib-domains-13b`

**Why these together:** Every item is dated to v1.0.0 or rc.1 (CHANGELOG.md:19-20, ch-deploy.sh:3, plan :814-829). They share one release note, one canary bless and the install-harness scenarios.

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

### Q-012 · Security posture

How are the security findings handled?

(A) Recommended:
- record the remaining risks as ASVS 4.0.3 exclusions in one ADR: per-caller sign-in throttle keys (plus a boot warning for a short PS_AUTH_TOKEN), and the sign-in URL printed only on the start that creates the token;
- forbid framing everywhere;
- document that the request signature does not cover the body, and that setting it disables the deploy buttons;
- read-only mode: proxy only, with the host-side routes keeping their own guard;
- one on/off vocabulary for boolean env vars;
- add RUL-SEC-002's pre-commit scan and deny list.

(B) Close the gaps in code instead: a wrapper server that owns the peer address, never print the token, sign the body, check read-only on every write.

(C) Keep today's behaviour and record an exclusion for each finding.

**Items:** `POLICY-asvs-exclusions`, `critic-02`, `critic-03a`, `critic-04`, `critic-05a`, `app-06`, `cross-cutting-03a`, `RUL-SEC-002-precommit`

**Why these together:** All of these are measured against RUL-SEC-002 and RUL-SEC-003, and share one exclusion vehicle. Choosing mitigation over recording shifts every item together.

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

### Q-013 · Shipped surface: delete the dead, label the documented

Which shipped surface goes, and which stays?

(A) Recommended rule: delete what is dead, uncallable or undocumented; keep and label what is documented, ruled or holds data.
- Delete: the bench-gateway harness and its npm script, hindsight-rederive.sh, the five ch-* shims and the .sh hardware twins, the pnpm settings, ts-jest, the four unused rgb tokens, and the deploy-only Windows branches (with a clear refusal on win32).
- Keep: the four uncalled documented routes (labelled, plus a caller gate), migrate-to-runtime, the benchmark tables and sync_registry, the seed toolset YAML (with a drift test), the Story Weaver fonts, MODULE_ACCENTS, the four declared APIs, the theme.ts token mirror, the composer flag, the <hermes_mission> envelope, storage and seed key names, the Compose volume names, install.ps1 (link fixed) and the npm script names.

(B) Keep everything, including the dead items.

(C) Also remove the uncalled documented routes, empty tables, fonts and flag.

**Items:** `app-01a`, `app-01b`, `app-01c`, `app-01d`, `app-01h`, `tooling-02`, `tests-18b`, `tooling-23`, `tooling-12a`, `tooling-12c`, `tooling-10a`, `tooling-10b`, `tooling-11b`, `tooling-24a`, `tooling-24b`, `lib-data-08`, `lib-data-09b`, `critic-07`, `critic-09`, `app-22`, `docs-22`, `lib-domains-05b`, `lib-domains-05c`, `hooks-15b`, `tooling-17`, `cross-cutting-22`, `cross-cutting-07`, `lib-domains-13a`, `cross-cutting-21b`, `cross-cutting-23b`

**Why these together:** Every recommendation applies the same rule, the guardrail that nothing documented is removed without a ruling. If the operator rejects the rule, all of these move together.

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

### Q-014 · Database, build and boot lifecycle

How do builds, migrations and boot treat the database?

(A) Recommended:
- the build touches no database, which ends the automatic Hermes key and model import at build time;
- the unreachable baseline-rebuild path goes;
- migrations converge in one pass and fail loudly;
- duplicate error rows are hidden at read;
- boot runs its sweeps first, then fails fast;
- the deploy runner keeps file-wins .env.local loading but strips quotes;
- server logs use one closed tag list, with [auth] and [config] kept.

(B) Keep prebuild but take the backup before the build, keep the rebuild path, keep the convergence loops.

(C) Status quo.

**Items:** `tooling-13`, `lib-data-20`, `lib-data-05`, `lib-data-06`, `lib-data-01`, `lib-data-10b`, `app-16`, `cross-cutting-08`, `cross-cutting-11`

**Why these together:** They chain on the same files (prebuild-db.mjs, upgrade.ts, db/index.ts, instrumentation.ts and the install-harness fixture), and each later step assumes the earlier ruling.

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

### Q-015 · Tests, lint and closed oracles

How do test and lint policy change?

(A) Recommended:
- closed oracles change only by a dated amendment from a separate session;
- turn off no-require-imports for tests, keeping the specific reasons as comments;
- re-anchor c8 to its closing numbers;
- the raw-control rule is fixed and its hits baselined;
- the try/catch census is widened, and 500 bodies are unchanged;
- tests: provenance headers get a ratchet only, new suites are named by subject, no directory move, source-text suites are classified once, no merges, e2e overlaps are folded (the navigation matrix stays);
- the doc-link check is widened, then folded into docs:check;
- knip is widened, and what it finds is fixed;
- the react-hooks rules stay off with truthful comments.

(B) Closed oracles are frozen; keep the per-line disables; burn gaps down before fixing gates.

(C) Rename and move the tests into domain folders, and retire record pins.

**Items:** `POLICY-closed-oracles`, `cross-cutting-06`, `org-12d`, `tests-05`, `tooling-08`, `org-15`, `tests-10`, `components-01`, `app-04a`, `app-04b`, `tests-04`, `tests-07`, `cross-cutting-23a`, `tests-08`, `tests-09a`, `tests-09b`, `tests-12`, `tests-14`, `docs-02`, `docs-11a`, `tooling-16`, `tooling-28a`

**Why these together:** Nearly every gate fix here amends c6, c8, u15 or u16 or changes test identity, so the ruling on closed oracles and test identity decides all of them.

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

### Q-016 · Product structure: UI, renderers, modules and docs

How far does the product structure converge?

(A) Converge (recommended):
- UI: Field labels and track switches on Settings, Memory and Composer; Select to Picker only if the overhaul's two-primitive decision is set aside; chat renders through SimpleMarkdown with a Copy button per code block;
- the missions board reads through the cache, with errors shown in place;
- keep both write paths, keep the schedule picker's 500 limit, keep local timestamps;
- Laboratory waits under ADR-0005, keeping its table names; the hermes module owns agent_root; config-schema is a recorded exception;
- a superseding ADR records globals.css as the token source;
- docs: lint-steps and env-table fences, a shorter README and SUPPORT page, screenshots at release points, EOS keys left as they are.

(B) Defect-only: fix names, Copy, links and contradictions in place, with no restyle, move or renderer swap, and defer the ADR questions.

(C) As (A), but Picker replaces Select everywhere at 40px.

**Items:** `components-02`, `components-11`, `components-12`, `components-30`, `cross-cutting-14b`, `lib-domains-12`, `hooks-01`, `hooks-02`, `hooks-03`, `hooks-23`, `cross-cutting-23c`, `cross-cutting-24`, `lib-domains-01a`, `lib-domains-01b`, `lib-domains-02`, `lib-domains-03`, `docs-05a`, `docs-08`, `docs-16`, `docs-17`, `docs-18`, `docs-19a`

**Why these together:** Each is a choice between visible convergence on the UI overhaul's primitives and ADRs (ui-overhaul.md:229-232, ADR-0003, ADR-0005) and defect-only fixes. The renderer and module rulings share files and census runs.

**Ruling:** (A), the recommended option, adopted whole — Daniel Parke (operator), 2026-09-12.

## The order the rulings imply

```
1. Rule the frame first: POLICY-release-order, POLICY-ci-green, POLICY-solo-protection with tooling-30a, POLICY-public-contract-scope, POLICY-closed-oracles, POLICY-lanes and org-03b. They set the tier, review cost and lane count of every later batch.

2. Batch 0 (CI green):
   - Fix the 6 case-broken doc links (the link half of docs-01).
   - Fix the macOS docs:check import at scripts/docs/extract.ts:93.
   - Update the full-stack smoke contract: dispatch through POST /api/missions, and check cancel.accepted.
   - Then observe the Ubuntu steps that have been skipped since 2026-09-05: docs build, canary, knip, tsc, coverage, build. Fix or baseline what they surface.

3. Governance procedure:
   - org-06 (move the procedure into PLAYBOOKS), then the per-batch CI wait, org-01b's walk list and tooling-01's runner.
   - The ADR-0011 cycle for org-01a, then the history restore.
   - org-12a (rescue the two untracked files, then the operator removes the worktree and branch).
   - org-12c upkeep, with views rendered through POLICY-renderer; org-12b cadences.

4. Repository queue, after green:
   - PR-234 closed.
   - POLICY-dependabot refreshed from its PR heads. Land knip before tooling-16 widens knip, and the React pair only as a group.
   - POLICY-dependabot-actions.
   - tooling-20a (composite action), then tooling-04 (Node).

5. Security lane:
   - critic-05c, then critic-05a's docs.
   - app-06, then test:ps-read-only-cases.
   - POLICY-asvs-exclusions ADR, then critic-02 with critic-02s.
   - Boot lane on src/instrumentation.ts, in this order: critic-03a, critic-03b, the POLICY-aliases warning, app-16, cross-cutting-11.
   - critic-04 with cross-cutting-22's next.config.ts deletion under one canary bless.
   - critic-01, critic-14, tooling-05, then tooling-29 with RUL-SEC-002-precommit after tooling-30b.

6. Data safety:
   - tooling-13, with the install-harness fixture swap and critic-08's scenario edits in one commit.
   - lib-data-20.
   - lib-data-05, deleting hermes-registry-import.mjs if it is now uncalled.
   - lib-data-06, then lib-data-01, then lib-data-10a/10b.

7. Release, if POLICY-release-order's first option is ruled: docs-03a/b, then T-0113 (rc.1, then v1.0.0).

8. Test and lint policy:
   - The cross-cutting-06 override in one commit.
   - tests-09b's classification table before any move batch.
   - components-01, hooks-04 (Story Weaver writes onto useMutation after app-03's load move), hooks-05, app-04a/b and org-15, each with a dated oracle amendment.

9. CI trims, only after a green run of the unchanged jobs: tests-20 with tooling-15a, then tooling-31, tooling-20b, tooling-25, and tests-02a's census step.

10. Env and docs checkers:
   - cross-cutting-03b, then lib-domains-14b, then docs-08.
   - The docs-01 checker change, then docs-02 and tooling-19, then docs-11a with a link-only input. org-03a and docs-11a serialize the u16 count.

11. Components:
   - hooks-15a, then components-12, then components-11, then components-02, all after tests-09b.
   - components-30 is ruled before lib-domains-12 and cross-cutting-14a.
   - critic-06 lands with components-03.

12. Removals:
   - tooling-02 (absorbs tests-18b).
   - tooling-10b before tooling-10a.
   - tooling-11c, tooling-12a, org-11, critic-09, and lib-data-09a with the other dead-code rows.

13. Post-1.0 removal release:
   - The x-ps and PS_ tests are already in.
   - cross-cutting-04a (tripwire), 04b, app-21, hooks-25, tooling-11a, lib-domains-14a's ch-deploy.status and app-15a.
   - One CHANGELOG 'Removed' section and one canary bless.
   - tooling-11d waits for ~/control-hub discovery to retire.
```

## Conflicts the critic settled

- **critic-05b, cross-cutting-04b, critic-05c, test:x-ps-signature-coverage** — The same change is drafted twice. - critic-05b (theme B, batch dead-code) and cross-cutting-04b (theme C, batch security-defects) both retire the aliases at src/lib/api/api-auth.ts:44-47. Re-read: :44 reads PS_ then CH_REQUEST_SIGNING_SECRET, and :46-47 accept x-ch-ts and x-ch-signature. - critic-05c and test:x-ps-signature-coverage are the same test row. The only signing tests use CH_ and x-ch-* (api-auth.test.ts:13, :24, :30, :36, :40).
  - Resolution: - Keep cross-cutting-04b as the entry, in the post-1.0 removal release. critic-05b folds into it. - Keep critic-05c as the one test row (R0, pre-release). test:x-ps-signature-coverage folds into it. - Count the removal once.
- **app-06, test:ps-read-only-cases, cross-cutting-04a** — test:ps-read-only-cases switches api-auth.test.ts:77, :86 and :96 to PS_READ_ONLY. - Those lines sit inside the requireNotReadOnly describe block (:53-101), which also saves and restores CH_READ_ONLY at :54-57 and deletes it at :61 and :66. - app-06's recommended option deletes requireNotReadOnly and that whole block.
  - Resolution: - Land app-06 first. The test row then shrinks to record-event.test.ts:47, and boot-says-how-it-is-configured.test.ts:49-53 stays as the alias test. - If app-06 is ruled 'leave the split', the row must also switch :54-57, :61 and :66.
- **critic-08, tooling-13** — Both entries edit the same function: seed_ch_data_rich in tests/integration/test_full_install_update_process.py:459-479. - It runs `npm run prebuild` (:473) and copies data/patterstage.db under the legacy name control-hub.db (:478-479). - Its callers are seed_both (:487), scenario_dashboard (:990), scenario_update_preserves_user_data (:1130) and scenario_update_runs_seed_catalog (:1180). - critic-08 moves dashboard and both to PS_ names. tooling-13 removes the prebuild database the fixture copies.
  - Resolution: Make it one harness commit inside the tooling-13 batch (R2): - Build the fixture with `PS_DATA_DIR=<tmp> npm run db:migrate`, parameterised by the target file name. - critic-08's scenario edits and its ci.yml:361 addition ride in the same commit. - critic-08 therefore depends on tooling-13.
- **org-12d, cross-cutting-06, tests-05, tooling-08** — Three counts and two opposite recommendations for the same directives. - Counts: 116 next-line directives in 89 files (org-12d, tooling-08); 284 in tests/unit (tests-05); 285 in 258 files (cross-cutting-06). - Recommendations: org-12d keeps the per-line directives; cross-cutting-06 adds a tests-scoped override. - org-12d's option 3 (jest.requireActual) is not behaviour-neutral. The rule matches only a bare require() call (eslint-plugin dist/rules/no-require-imports.js:80), but my node scan found that 5 of the 116 next-line requires load a module the same file jest.mocks: b6-keyless-providers.test.tsx:73 and :75, stories-api-actions.test.ts:29, stories-continue-outline-count.test.ts:25 and stories-timeout-retry.test.ts:26. At those sites requireActual would return the real module instead of the mock.
  - Resolution: - Ask one question, under cross-cutting-06, with the count 285 in 258 files (169 of them file-level disables). - Recommended: the override, with the specific reasons kept as plain comments, all in one commit. - org-12d's 'keep' is the fallback if the operator declines the override. - Drop org-12d's option 3. tests-05 and tooling-08 fold in.
- **hooks-04, app-03, hooks-03** — - hooks-04's fix converts Story Weaver's bare fetch writes to runWrite. - app-03 keeps their inline errors and AbortController, and baselines them, because runWrite toasts and takes no signal. - design-lint.mjs:519-522 sanctions both runWrite and useMutation spans, and its law text (:503) assigns useMutation to hooks that own query keys.
  - Resolution: - After app-03 moves the story load onto useApiResource, the page owns that query key. - Convert its writes to useMutation: errors show inline through mutation.error, and mutationFn closes over the AbortController. - That satisfies the widened rule with no baseline and no change to hooks-03's two-way convention. - The c6:57 amendment follows POLICY-closed-oracles.
- **tooling-13, lib-data-20, lib-data-05** — - scripts/tooling/hermes-registry-import.mjs is called only by prebuild-db.mjs:10 and :126 and by upgrade.ts:255 (git grep). - tooling-13 option 1 plus lib-data-05's removal leave it with no caller, yet no entry deletes it. - knip.json lists scripts/**/*.{ts,mjs} as entries, so lint:knip will never report it. - lib-data-20 plans to move columnExists into it.
  - Resolution: - The batch that removes the last caller deletes hermes-registry-import.mjs in the same commit. - lib-data-20 then drops the helpers rather than moving them. - tooling-13's removes line already covers the lost behaviour.
- **components-30, cross-cutting-14b, lib-domains-12, cross-cutting-14a** — Three entries disagree about chat's renderer. - components-30 moves chat onto SimpleMarkdown (src/components/skills/SimpleMarkdown.tsx), which deletes renderMarkdown. - cross-cutting-14b keeps three renderers, and lib-domains-12 adds about 15 lines to renderMarkdown. - cross-cutting-14a unifies escapers, including chat-utils.ts:81.  F2's condition that the move 'adds a link-injection path' is overstated: react-dom 19.2.7's client bundle carries 'React has blocked a javascript: URL as a security precaution.' (grep of react-dom-client.production.js).
  - Resolution: Rule components-30 first (question batch Q8). - If chat moves: lib-domains-12 becomes CodeBlock's Copy, cross-cutting-14b becomes 'two renderers', and 14a covers the deep-research and report escapers only. The scheme allowlist stays as defence in depth with its test. - If chat does not move: lib-domains-12 fixes renderMarkdown in place and 14b stands.
- **org-11, tooling-12b** — Opposite recommendations for the same file, scripts/tooling/eos-compile.mjs: org-11 retires it, tooling-12b keeps it and makes it require EOS_ROOT. - b15-corpus-moves-under-org.test.ts:137-148 has two its that read the file. - ADR-0010:44, :48, :104 and :146 name it. - docs-11a already accepts that the immutable ADR-0010 (:110, :131) keeps naming a deleted check-doc-links.mjs.
  - Resolution: - Make it one ruling, in question batch Q2. - Recommend retiring it (org-11), for consistency with docs-11a's precedent. The two b15 its go with it. - tooling-12b's EOS_ROOT edit applies only if retirement is refused.
- **org-15, app-04a, tooling-22, tests-04, tests-02a** — org-15 keeps two c8 checks live, and three other entries break them. - Kept live: c8-the-programme-is-closed.test.ts:80 (the key set must equal AT_C0's) and :88 (met targets; routesWithTryCatch TARGET is 13 at c8:43). - app-04a widens routesWithTryCatch from 13 to 18. - tooling-22 and tests-04's band add census keys. - tests-02a deletes the closed c2, c4, c5 and c6 ceilings.
  - Resolution: Settle it under POLICY-closed-oracles: - org-15's re-anchor compares only C8's own keys. - A met-target hold applies only to measures whose definition is unchanged. - Each amendment is dated and authored by a non-implementer (CONSTITUTION.md:40-41).
- **cross-cutting-23a, tests-07, cross-cutting-23c, hooks-23** — Two duplicates and one contradiction. - cross-cutting-23a and tests-07 are the same finding: 220 batch-named test files, counted as 118 references by stem or 117 record paths. - cross-cutting-23c recommends no moves for the three non-hook modules (`ls src/hooks`: chat-local-message.ts, missions-page-types.ts, success-message-for-dispatch.ts). - hooks-23's recommended option ('Keep 500') performs those same moves.
  - Resolution: - tests-07 carries the naming rule for new suites, and cross-cutting-23a folds into it. - hooks-23 keeps the 500 limit and makes no moves, per 23c's rule: the moves edit 13 test files for navigation alone.
- **tooling-02, tests-18b, tooling-23** — All three remove `npm run test:e2e-bench-gateway` (package.json: bash tests/scripts/bench-gateway-itest.sh). - tests-18b adds '-29 on top of tooling-02', double counting the same lines. - tests-18b's corrected file list drops baseline-fix-verify.mjs, poll-pair.mjs and poll-run.mjs, which tooling-02 deletes.
  - Resolution: - tooling-02 is the entry: 8 files plus the npm script. - tests-18b and tooling-23's removal line become notes on it.
- **POLICY-ci-green, app-01e, app-01f, tests-18a** — POLICY-ci-green calls the real-hermes smoke's cause unknown and floors the fix at R2, as a Docker change. At least two of its failures are stale test contracts.  1. Cancel: full-stack-smoke.mjs (last changed 47b59b01, 2026-08-22) checks `cancel.data?.data?.cancelled` at :150. 91134b70 (T-0095, 04:43) made cancel answer `{ mission, cancel }` (cancel/route.ts:4-10). That commit sits between the last green run d84b7528 (04:09) and the first red one f82db9dd (04:49), per `git log d84b7528..f82db9dd`.  2. Dispatch: the smoke POSTs /api/missions/${id}/dispatch at :96 and :148. That route was documented (api.md:74 at 0d7ae16a^). T-0129 deleted it on 2026-09-07 (0d7ae16a) as a signed-off orphan route with 'zero callers' (ui-overhaul.md:640, :694). `git ls-files src/app/api/missions` has no dispatch route.
  - Resolution: - Batch 0 updates the smoke: dispatch through POST /api/missions with action dispatch, as step 7 already does at :156, and assert cancel.accepted. - That is tests/integration only, so R1. Edit docker or compose files only if assertions stay red afterwards. - app-01h's caller gate must count tests/integration callers, the walk U15 missed.
- **POLICY-ci-green, tests-20, tooling-15a, tooling-31, tooling-20b, tests-02a** — These entries edit CI jobs whose later steps have not run since 2026-09-05. - build-test-ubuntu fails at ESLint (ci.yml:79-80). The steps after it (docs build :86, canary :92, knip :94-95, tsc :97-98, test:coverage :99-100, build :101-102) carry no `if:`, so they are skipped. - tooling-31 would drop macOS lint while it is the step that fails (docs:check). - `gh run list` shows ce4ac1fd failed at 2026-09-10T18:58Z.
  - Resolution: - Every CI trim and addition depends on POLICY-ci-green, plus one observed green run of the unchanged job. - Removing a step whose current result is unknown counts as skipping a check.
- **tooling-30a, docs-06a, POLICY-solo-protection, org-12c** — - docs-06a rewords CONTRIBUTING.md:85 to say no checks are required, while tooling-30a recommends requiring them. - main's enforce_admins is false and CODEOWNERS:1-6 names only @Daniel-Parke, so required checks would bind nobody who can merge. - PR #157 has been BLOCKED with REVIEW_REQUIRED since 2026-06-04 (gh pr view).
  - Resolution: - Rule POLICY-solo-protection together with tooling-30a. - docs-06a then describes whatever setting results. - T-0004 closes only when a check actually binds the release merge.
- **critic-04, cross-cutting-22, app-15a, app-21, lib-domains-14b** — The output canary hashes next.config.ts (output-canary.mjs:29 and :359-364; golden appConfig at output-canary.golden.json:10). - cross-cutting-22 declines to delete next.config.ts:27-29 to avoid a re-bless. - critic-04's recommended headers() entry forces a re-bless anyway. - app-15a and app-21 (post-1.0) and the alias read at next.config.ts:9 force more.
  - Resolution: - Land cross-cutting-22's 3-line deletion in critic-04's commit, under one canary:bless with a written reason. - The post-1.0 edits share one bless in the removal release.
- **cross-cutting-03b, docs-08** — Two drift checks for the env docs, reading different sources. - cross-cutting-03b: a parity test between a code registry and env-reference.md. - docs-08: the env-table fence, whose extractor reads .env.example (scripts/docs/extract.ts:275-287).
  - Resolution: - Land cross-cutting-03b first. - docs-08 then adopts only the lint-steps fence. The env-table extractor either goes or reads the env.ts registry, so there is one source of truth.
- **docs-02, tooling-19, docs-11a, docs-01** — - docs-02 and tooling-19 widen check-doc-links.mjs to root and branding markdown. - docs-11a deletes that script and folds the check into docs:check, which refuses any page missing REQUIRED_KEYS title, summary, section and nav (scripts/docs/lib.mjs:35). Root documents have no front matter. - docs-01's six link fixes are also batch 0's.
  - Resolution: - Order: docs-01 (in batch 0), then docs-02 and tooling-19, then docs-11a. - docs-11a must add a link-only input for markdown that is not a page, or check-doc-links stays for root docs.
- **hooks-15a, components-11** — - hooks-15a edits SearchInput in src/components/ui/Input.tsx (:17, :26, :48, :72-73), which components-11 moves into ui/field before deleting the file. - hooks-15a's Select.tsx is src/components/ui/Select.tsx (InlineSelect :32, focusColorMap :48, pragma :59), not field/Select.tsx, so it does not clash with components-02.
  - Resolution: Land hooks-15a before components-11, or have components-11 drop focusBorder and accentColor as part of the move.
- **lib-domains-11a, lib-domains-14b** — Both entries route the inline alias reads at update-handlers/shared.ts:27 and run-deadline.ts:23. git grep finds five such sites in all; the other three are next.config.ts:9, pull/route.ts:52 and agent-runtime.ts:31.
  - Resolution: - lib-domains-14b owns all five, inside cross-cutting-03b. - lib-domains-11a keeps only its formatter and decodeEntities work.
- **critic-03a, critic-03b, POLICY-aliases, cross-cutting-04a, app-16, cross-cutting-11, critic-02** — Seven entries edit the boot sequence or boot output on the sensitive src/instrumentation.ts path: - the [auth] print at :28-33 (critic-03a) - a boot chmod (critic-03b) - the alias boot warning (POLICY-aliases) - the tripwire (cross-cutting-04a) - the step order (app-16) - serverLog tags that keep [auth] byte-identical (cross-cutting-11) - the optional short-token warning (critic-02)  cross-cutting-04a left open whether throwing in register() stops startup. It does: next/dist/server/lib/start-server.js:428 calls process.exit(1).
  - Resolution: - One boot lane, in this order: critic-03a, critic-03b, the POLICY-aliases warning, app-16, then cross-cutting-11. cross-cutting-11 keeps critic-03a's new [auth] text. - The tripwire lands in the post-1.0 removal release.
- **components-02, components-11** — The operator-approved UI overhaul (ui-overhaul.md:5-6, approved 2026-09-06; decisions at :229-232) names: - Field as the only label; - 'Select (the accessible listbox)' and 'Picker (one component replacing the Profile/Skill/Toolset/Timeout/MissionTime selectors)' as separate primitives; - 'one 38px control height'.  components-02 deletes Select in favour of Picker at 40px without citing that binding decision.  That plan supersedes the final-release plan's post-1.0 deferral of 'Button/Field-Kit adoption' (final-release.md:819), so components-11 and 12 are consistent with it.
  - Resolution: - components-02's question must cite the overhaul decision. Its 'Picker at size lg' option also departs from the 38px rule. - If the operator keeps the decision, components-02 reduces to naming the 10 unnamed Selects.
- **POLICY-dependabot, POLICY-dependabot-actions, org-12a** — - POLICY-dependabot counts ten npm branches from stale local refs. - gh pr list shows 12 Dependabot PRs. #235 and #236 are GitHub Actions major bumps that no entry covers. - The npm PR heads have moved on: #227 is now knip 6.16.1→6.34.0, not 6.32.2.
  - Resolution: - Refresh the facts from the PR heads (`gh pr view <n> --json files`) before that batch. - The actions pair becomes its own added entry.
- **org-03a, docs-11a, tooling-01, docs-06b, tests-20** — - org-03a adds a lint-chain step (12 to 13) and docs-11a removes one (12 to 11). Each edits testing.md:164 and CONTRIBUTING.md:31, and u16-the-docs-describe-the-system.test.ts:107-116 asserts the count as a word. - tooling-01 replaces CONTRIBUTING.md:20-35, where docs-06b and tests-20 also edit lines.
  - Resolution: - Serialize the commits. Each one updates the count word u16 checks. - Land tooling-01 first, so the CONTRIBUTING edits in docs-06b and tests-20 shrink to the runner pointer.
- **org-01a, critic-02, critic-03a, POLICY-aliases, docs-05a, lib-domains-03, POLICY-asvs-exclusions** — Six recommended ADRs, and only org-01a picks a number (ADR-0011). - `ls org/decisions` shows ADR-0001 to ADR-0010. - docs/adr/README.md:27-35 has no ADR-0010 row. - Each ADR is R3 and needs its own ORACLE session, competing for two lanes.
  - Resolution: - Number the ADRs in ruling order. - POLICY-asvs-exclusions merges the critic-02 and critic-03a exclusions into one ADR. - The missing ADR-0010 row lands with the first new ADR.
- **POLICY-renderer, org-01b, org-05, tooling-15a, org-06** — - POLICY-renderer depends on org-06, and org-01b puts its walk list 'into the batch procedure (org-06)', but no theme drafted org-06. - Meanwhile POLICY-ci-green, tooling-15a (HANDOVER.md:84) and tooling-01 each edit the procedure in HANDOVER.md:69-110, which org-05 treats as a transient note.
  - Resolution: The added entry org-06 lands first. Every later procedure step goes into the new PLAYBOOKS section.
- **org-03b, POLICY-lanes, POLICY-public-contract-scope** — Together these three rulings multiply review work: - org-03b makes every R2 batch high-assurance, with an independent review. - POLICY-lanes caps concurrent writers at two. - On the literal policy.json:15 reading, about ten small dead-code and UI batches become R2.
  - Resolution: Rule POLICY-public-contract-scope before any batch is sized.
- **critic-06, components-03** — The same unnamed house-primitive set, 16 to 22 sites, appears as a gate fix (critic-06) and as a naming fix (components-03).
  - Resolution: One components batch. The gate change lands with the naming fixes, so the gate is green at merge.

## Items the operator rules

### Theme A · Governance, process and the landing discipline

1. Rule on CI first. Dev CI has failed on every push since f82db9dd (2026-09-05T03:49Z): 61 push runs, 55 failed and 6 cancelled; the last green was d84b7528.
- Both lint failures (6 case-broken doc links on Ubuntu; docs:check module resolution on macOS) date from 41ddb25b (T-0109).
- The real-hermes smoke has failed since f82db9dd.
- About 50 records, T-0095 to T-0145, landed on red CI. That includes the whole UI overhaul and consolidation, while HANDOVER.md:29 says green.
- Ubuntu stops at lint step 2, so steps 3 to 12 have not run on Linux since then.
Rule POLICY-ci-green first: tooling-30a, tests-02a and org-12c's handling of T-0004 all assume CI can go green.

2. Ownership changes. Six draft entries were marked operator_needed, but their recommended option restates a binding rule or keeps the status quo, so they are the executor's free band: org-01b, org-02, org-05, POLICY-renderer, tests-10, tests-02b. Only their non-recommended options would need a ruling.

Fourteen items stay with the operator: POLICY-ci-green, org-01a, POLICY-lanes, org-03b, tooling-01, org-04, org-11, org-12a, org-12b, org-12d, org-15, tests-02a, tooling-30a, tooling-30b. org-03a and org-12c were already free band.

One ADR-0011 can carry org-01a, plus POLICY-lanes if the cap is raised. It is the only recommended edit to the protected set in this theme; separately, org-12a's worktree and branch deletion is the operator's always_human action.

3. Corrections to the draft:
- T-0144 rewrote 50 org files outside its claims and the protected set, not 51.
- The split restore is 47 files and 90 line pairs: T-0055 is a live proposed record and keeps its new path.
- ui-recon.md:1112 keeps four old aliases on one line.
- The EOS router still floors src/lib/api/* at public-contract R2 through its 'api/' marker (router.py:174, :273-274). policy.json's sensitive list is the only auth-surface signal for the moved auth files, not the only R2 signal.
- The Cursor worktree has 13 modified and 2 untracked paths, and the 13 are already in ../patterstage-cursor-worktree-rescue-2026-08-22.patch. The branch is merged into dev, and the draft's local-commit quarantine would have forced the -D that T-0003 forbids.
- The EOS drift 727bee44..1d20607 also changed checks/seed.py.
- High-assurance at R2 needs an independent reviewer, not just a verdict field.
- The gate runner cannot read CI for a commit that does not exist yet.
- A prepare script is R2 by the EOS install-script detector.
- The review's 'CI mention in T-0138' was a regex hit on 'workflow' in T-0137.

4. Constraints the next plan inherits:
- testLines has 648 lines of headroom under c8:84-86.
- routesWithTryCatch has none under c8:88-92, which the draft missed.
- Staying at two lanes still requires the WG-SWARM-001 ruling, a partition, committed claims, a view render and a journal. GRAPH_BUILD's docs/PARTITION.md path would be swept into the docs manifest (check-derived-views.mjs:175-195).
- If org-03b holds, every R2 batch (any sensitive path, schema or public contract) runs high-assurance with an independent review.

5. Branch protection. main and dev both require a reviewed PR, but enforce_admins is off, and every dev commit is a direct push using the admin bypass. Required checks bind only non-admin merges, so the working discipline has to be 'never bypass red'. The pre-push hook passes any commit whose subject starts with 'Merge'. T-0003's end state has also regressed: 12 open Dependabot PRs plus #234 against dev.

6. Read-only limits, each with the command that would settle it:
- The design census's CI minutes and Linux agreement: a dispatch run of `npm run build && npm run census`.
- Whether docs:check also fails on Linux: CI after the link fix.
- The real-hermes smoke's root cause: `npm run test:e2e-hermes` with Docker.
- Whether the repeated-window census measures agree on an LF checkout: one CI run of census:lines.
- Whether jest.requireActual clears no-require-imports: `npx eslint` on one converted suite.
- Admin direct-push behaviour was not exercised, because testing it needs a push.
- docs-01 (another theme), which tests-02a depends on, was not re-read.
gh was authenticated as the repo owner, so CI results and protection settings were read directly.

7. Several review findings each hid more than one decision and are split into a/b (and c/d) entries: tests-02, tooling-30, org-01, org-03 and org-12. POLICY-ci-green, POLICY-lanes and POLICY-renderer are cross-cutting entries drawn out of tooling-01, org-02 and org-04. All twelve requested ids have entries.

#### POLICY-ci-green · Dev CI has been red on every push since 2026-09-05, while every batch from T-0095 to T-0145 reported a green local gate

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · theme A
- **Batch:** governance-discipline-gates
- **Now:** Not a review finding; found while re-verifying tooling-01, org-04 and tooling-30.
  
  `gh run list --workflow ci.yml --branch dev --event push --limit 120`:
  - Last success: d84b7528 (run 33941077625, 2026-09-05T03:09Z).
  - First red: f82db9dd (run 33942927459, 03:49Z, the T-0095 chore), not 06218799. It failed only real-hermes-integration (`gh run view --json jobs`).
  - Since then, 61 push runs through HEAD ce4ac1fd: 55 failed, 6 cancelled, 0 succeeded.
  - From e3332f00 (the T-0109 chore, run 33986489257), build-test-ubuntu and build-test-macos fail as well. All ten runs sampled after it fail the same three jobs: 8fd7e7b1, 704c2e4d, 3e2c42da, 92bb20db, 6a89418a, 0bd8a8c9, 06c558ad, e1b7b59c, 7d83d4fd, 809cdad7.
  
  At HEAD (run 34517560173, `gh run view --log-failed`):
  - build-test-ubuntu fails in its ESLint step, at lint step 2 (check-doc-links), with 6 broken links: docs/reference/api.md:60 -> SPEND.md, running/cross-platform.md:94 -> DEPLOY.md, running/env-reference.md:15, :113 and :114, and running/migration.md:213. `git ls-files docs` has only lowercase targets (reference/spend.md, running/deploy.md, running/migration.md).
  - build-test-macos passes doc-links (its filesystem is case-insensitive) and fails step 3, docs:check: 'Failed to resolve module specifier ../../src/lib/analytics/event-types.ts'. The file is tracked, and scripts/docs/extract.ts:93 imports it without the extension. Ubuntu never reaches step 3, so whether Linux also fails it is unknown.
  - real-hermes-integration: 'SMOKE FAILED (9 assertion(s))', starting with 'dispatch returned runId (none)'.
  
  Both lint failures date from 41ddb25b (T-0109, 2026-09-05): `git log -S'(SPEND.md)'` points there, and extract.ts does not exist at d84b7528.
  
  The records say otherwise: HANDOVER.md:29 says 'dev is pushed and green', and T-0144.verification says 'lint 0'. No record from T-0135 to T-0145 mentions a CI run; T-0137's one regex match is 'saved workflow' in a composer-spec note.
- **Question:** Must the next programme make dev CI green first, and must each later batch wait for its pushed commit's CI to pass before the next batch starts?
- **Options:**
  - **Green first, then per batch** — Batch 0 fixes the three HEAD failures:
    - the 6 case-broken links in 4 docs files (6 lines, express-sized, R0);
    - the macOS docs:check resolution in scripts/docs (R1; the cause cannot be reproduced on Windows);
    - the real-hermes smoke (9 assertions, cause unknown; R2 if it touches docker-compose.real-hermes.yml or docker/).
    Once the links are fixed, Ubuntu may surface later lint steps it has not reached since 2026-09-05. The landing procedure gains a last step: the pushed commit's CI is green before the next batch dispatches. The slowest push job at the last green run (install-harness) took 531 s, so each batch waits about 9 minutes. HANDOVER.md:29's 'green' is corrected. Nothing is removed. About +10 procedure lines plus the fixes.
  - **Green first, no per-batch wait** — Same batch 0. CI is read only at programme close, so red can pile up between batches again, as it did across about 50 records from T-0095 to T-0145. R0 to R2 for the fixes.
  - **Local gate suffices** — No change, and three failing jobs stay red indefinitely. The guardrail against skipping a failing check does not allow that, so this option is not compliant. Linux-only defects such as case-broken links keep escaping the Windows gate, and tooling-30a's required checks would block release PR #157.
- **Recommended:** Green first, then per batch — Six days and 61 red pushes went unnoticed because no step of the landing discipline reads CI. The Ubuntu failure is a case-sensitivity defect that a Windows gate cannot see. The failures predate C0, so a local-only discipline would never have caught them.
- **Sceptic:** Re-ran gh run list and gh run view on HEAD, the first red run, the last green run and ten runs in between. - First red run: f82db9dd at 03:49Z, not 06218799. - Run count: 61 push runs (55 failed, 6 cancelled), not 'more than 40'. - Span: from T-0095, not just C0 to C8. Both lint failures trace to 41ddb25b (T-0109). - The '1 CI mention in T-0138' was a regex hit on the word 'workflow' in T-0137. Added: the per-batch wait (about 9 minutes), that Ubuntu has run no lint step after step 2 since 2026-09-05, and that option 3 breaks the failing-check guardrail.
- **Ruling:** Green first, then per batch, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-01a · T-0144 edited the protected set and rewrote 50 other org files outside its claims, under an R2 ruling that mentions none of it

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R3 · **needs an ADR** · theme A
- **Batch:** governance-discipline-gates
- **Now:** `git show --numstat --format= <c> -- org` over T-0144's four commits:
  - cdf95b10: 55 org files (+145/-149).
  - 809cdad7: 3 files (STATE.md, TASKS.md, and T-0144.json created).
  - 63bbc937 and a05ceaa1: none.
  
  What kind of change. A read-only node script applied scripts/tooling/lib-moves.json (65 entries) to `git show cdf95b10~1:<file>`. It reproduces 49 of the 55 files byte for byte. Of the other 6:
  - HANDOVER.md (51 lines differ) and plans/2026-09-consolidation.md (45) have prose changes, and both are in T-0144's claims.
  - Four files are only partly rewritten, each with one old line left: T-0048:36 and T-0055:21 (@/lib/api-auth), T-0101:69 (@/lib/chat-utils), and reviews/2026-09-ui-recon.md:1112, which still holds four old aliases.
  
  The 55 files by class:
  - Protected (3 files, 4 lines): policy.json:34-35 (api-auth.ts and auth-token.ts moved under src/lib/api/), ADR-0009:90 (chat-repository), ADR-0010:102 (theme).
  - In claims (2): HANDOVER.md, the consolidation plan.
  - Everything else (50):
    - 40 task records: 39 done and T-0055 proposed, T-0008 to T-0140, 68 line pairs. Fields changed: claims in 37, intent 5, rollback 3, invariants 3, notes 2, four others 1 each.
    - 3 Session-0 artefacts: CORRECTIVE_RAW 4, WALK_RAW 4, fills 1.
    - 1 dated EOS_FEEDBACK.md entry (hunk at :99).
    - 4 closed plans and reviews: ui-overhaul 1, consolidation-recon 1, real-hermes-round 5, ui-recon 6.
    - 2 living docs: LOCKBOOK 2, final-release 5.
  
  Old lib-root spellings still in org/: 12 aliases on 8 lines in 6 files. T-0049 (:3, :35) and T-0115 (:42, :43) were never touched.
  
  The ruling. T-0144.json is mode standard, tier_ruled R2, with one reason: size-threshold at R2, where policy.json:19 sets R1.
  - `grep -c -i -E 'policy\.json|ADR-0009|ADR-0010|protected|approval|operator' org/tasks/T-0144.json` gives 0, and the commit body mentions no policy or ADR.
  - CONSTITUTION.md:79-81: amendments need an accepted ADR first, and accepted ADRs are immutable.
  - ADR-0010:118-122: 'the only protected-set edit', and records are historical and not rewritten.
  
  If policy.json were reverted:
  - src/lib/api-auth.ts and auth-token.ts do not exist (ls), and `git grep path_patterns -- scripts src tests` finds nothing.
  - The EOS router treats paths:sensitive as a diagnostic only (router.py:149-155), and its paths:auth detector does not match 'api-auth' or 'auth-token' (router.py:161-164, 195-198, 275-277).
  - But router.py:174 and :273-274 fire public-api-delta on any path containing 'api/', which reaches public-contract R2 (router.py:77-78).
  So a routed ruling would still be R2, but for the wrong reason. The sensitive list is the only auth-surface signal for those two files.
  
  Would a restore break anything? No:
  - c7-the-lib-root.test.ts:93 walks only src, tests, scripts and docs.
  - b15-corpus-moves-under-org.test.ts:16-18 excludes org/.
  - check-derived-views.mjs:45-51 and taskops.py:438-441 read only id, mode, tier_ruled, status and owner_session, and none of those changed.
- **Question:** What happens to T-0144's unsanctioned org edits: ratify all of them by a new ADR, revert all of them, or ratify the protected lines and restore the closed records' original text?
- **Options:**
  - **Ratify all by one ADR** — ADR-0011, accepted by the operator, sanctions the 4 protected path lines and records the rewrite of the 50 other org files as an exception. Nothing is restored: 4 records stay partly rewritten, and T-0049 and T-0115 keep old spellings. docs/adr/README.md gains a row; it also still lacks ADR-0010 (rows :27-35). No tests change. R3: operator approval recorded, oracle by a separate ORACLE session. About +40 lines.
  - **Revert everything** — The cdf95b10~1 text comes back in 53 files. That is a second edit to two accepted ADRs, which CONSTITUTION.md:80-81 makes immutable, so it needs its own ADR. policy.json's sensitive list again names two missing files. The moved auth files lose their auth-surface signal, while an EOS-routed ruling still says R2 through public-contract. No tests break. R3 twice, net 0.
  - **Split: ADR ratifies protected, restore history** — ADR-0011 sanctions policy.json:34-35 and the ADR-0009:90 and ADR-0010:102 lines, and names the restore as the reversal, so the accepted ADRs get no further edit.
    
    A separate standard R1 task (180 diff lines, over the express limit) restores the cdf95b10~1 text of 47 files, 90 line pairs, net 0:
    - 39 done task records;
    - 3 Session-0 artefacts;
    - the EOS_FEEDBACK dated line;
    - 4 closed plan and review files.
    
    Files that keep the new paths:
    - T-0055 (proposed, still live): restoring it would point a future task at the missing src/lib/api-schemas.ts.
    - LOCKBOOK, final-release, HANDOVER and the consolidation plan.
    
    No suite or derived view changes. R3 for the ADR, R1 for the restore, about +40 lines.
- **Recommended:** Split: ADR ratifies protected, restore history — Reverting policy.json takes the auth-surface reason off the two moved auth files, and restoring ADR text is another edit to accepted ADRs. Restoring the done records reinstates ADR-0010 section 3, with no test or view cost. T-0055 stays because it is a live record.
- **Sceptic:** Re-ran numstat over all four commits, a read-only lib-moves reproduction (49 of 55 exact), a status and field diff over the 40 records, and an old-spelling scan of org/. Corrections: - 'Ratify all' covers 50 other org files, not 51. - ui-recon keeps four old aliases on one line, not one. - The remaining old spellings are 12 aliases on 8 lines, not '8 hits'. - router.py:174 and :273-274 still floor src/lib/api/* at public-contract R2, so the sensitive list is the only auth-surface signal, not the only R2 signal. - T-0055 is proposed, so the split restores 47 files and 90 line pairs, not 48 and 91. Also confirmed that taskops.py:438-441 projects none of the changed fields.
- **Ruling:** Split: ADR ratifies protected, restore history, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-lanes · How many writing agents the programme may run at once

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme A
- **Batch:** governance-discipline-gates
- **Now:** The cap:
  - policy.json:125 sets max_lanes 2, and :126 claim_expiry_hours 24.
  - org/claims.json has `"lanes": []`, and its note holds the cap 'until a run record exists to argue it higher'. `git log --oneline -- org/claims.json` shows one commit, 2f93e6b2.
  
  What any lane, even two, requires:
  - GRAPH_BUILD.md:29-32: lanes apply 'Only when more than one session may write at once', with the WG-SWARM-001 fork recorded before dispatch.
  - GRAPH_BUILD.md:55-60: a partition at docs/PARTITION.md, and org/claims.json committed before dispatch.
  - GRAPH_BUILD.md:62-68: wider than two needs a policy amendment. :70-72: nothing enforces this.
  - PLAYBOOKS.md:71-75: claims first; 'Dispatch lanes to worktrees or subagents'. :84-88: raising the cap takes an amendment. :101-102: a session that cannot reach the EOS checkout does not run wide. :103-105: journal the run.
  - EOS kernel/schemas/claims.schema.json:5: claims are committed to the integration branch before dispatch. :67 names 'harness-dispatched subagent lanes'. kernel/templates/org/policy.tpl.json:101 defaults the cap to 2.
  - STATE.md:13-15 renders active claims, so a claim change needs a view render.
  
  Other texts:
  - START.md:29-30 and EXECUTOR.md:55-56 define the parallel lane.
  - CONSTITUTION.md has no lane text (grep parallel|lane|claim exits 1).
  - docs/PARTITION.md does not exist (ls).
  
  Collision: check-derived-views.mjs:175-195 parses front matter for every docs/*.md and re-derives docs/manifest.json, so a partition file at the compiled docs/ path would need docs front matter and would be published.
- **Question:** For this programme, do we stay within two concurrent writing agents, run under GRAPH_BUILD's partition and claims method, or does the operator accept an ADR that raises the cap for this programme?
- **Options:**
  - **Work within two lanes** — At most two writers at once. Each wide batch still follows GRAPH_BUILD:
    - the WG-SWARM-001 fork recorded;
    - a partition file;
    - org/claims.json committed to dev before dispatch, with claims expiring after 24 h;
    - STATE.md re-rendered through the EOS checkout (POLICY-renderer);
    - a run journal.
    The compiled docs/PARTITION.md path would be published by the docs manifest. Filing the partition under org/ instead is a small deviation worth an EOS_FEEDBACK friction entry.
    
    Read-only reviewers and sceptics are unlimited, and a dated GRAPH_BUILD.md note says so (about +6 lines). Wide batches such as C5's ten-agent pass take longer. No protected edit, no tests change. R1.
  - **ADR raises the cap for this programme** — A new ADR sets parallelism.max_lanes (for example 6) in org/policy.json for the programme's duration. Every fan-out still needs the fork ruling, a partition, committed claims and a journal, scaled to the lane count. R3 with operator approval recorded and a separate ORACLE session: about +45 ADR lines and 1 policy line, plus per-batch claims and partition files.
  - **Declare subagent fan-out not a lane** — This contradicts PLAYBOOKS.md:73 and EOS claims.schema.json:67, so it is a recorded deviation from a standard: an ADR plus an EOS_FEEDBACK entry, R3, about +30 lines.
- **Recommended:** Work within two lanes — There is no run record to justify a higher cap: T-0141 to T-0145 journal no lanes, and there is no partition file. The policy stays intact, and read-only fan-out is unaffected.
- **Sceptic:** Re-read policy.json:124-127, claims.json and its log, GRAPH_BUILD.md:27-72 and :151-157, PLAYBOOKS.md:69-105, EXECUTOR.md, START.md, and EOS claims.schema.json:5 and :67. The citations hold. The two-lane option was understated: it still requires the fork ruling, a partition, committed claims, a view render and a journal. Added the collision between docs/PARTITION.md and the docs manifest (check-derived-views.mjs:175-195).
- **Ruling:** Work within two lanes, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-03b · 53 standard-mode records carry tier R2, while EXECUTOR.md and policy.json tie R2 to high-assurance

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme A
- **Batch:** governance-discipline-gates · **after:** org-03a
- **Now:** - EXECUTOR.md:35 reads 'Standard (R1, the default)', and :41 'High-assurance (R2)'.
  - policy.json:86 gives standard the stop condition 'gate-time recomputation rules above R1'.
  - policy.json:100-105: high-assurance needs task-record, oracle-provenance, rollback-plan and review-verdict artefacts, with verification 'independent-review'.
  - The node -e count gives standard R2 = 53, including T-0143, T-0144 and T-0145.
  - EXECUTOR.md:41-48 lets the R2 oracle be written in the same session, before the implementation.
  - T-0144 already carries invariants, verification and mutation, but no rollback or oracle_provenance.
- **Question:** May a standard-mode task carry tier R2, or must R2 work run in high-assurance mode, as EXECUTOR.md and policy.json already say?
- **Options:**
  - **R2 runs high-assurance** — The documented rule is kept. Each R2 batch carries:
    - invariants;
    - a rollback plan;
    - oracle provenance (the oracle may still be written first in the same session, EXECUTOR.md:41-48);
    - an independent review verdict (policy.json:102-104). That means a separate reviewer pass per R2 batch, not just a field in the record.
    R2 covers any batch on a sensitive path (src/lib/db*, src/lib/api/api-auth.ts, .github/workflows/, docker*) and schema-change or public-contract work. org-03a's check enforces mode/tier coherence for new records. No protected edit. R1 for the check.
  - **Allow standard at R2 by ADR** — EXECUTOR.md and policy.json:86 are amended to permit standard mode at R2 under named conditions, which ratifies the 53 past records. This is the escalation band 'weakening any check'. R3 with an ADR, about +30 lines.
  - **Leave unenforced** — The status quo is recorded in EOS_FEEDBACK as a known deviation. Future R2 batches repeat the mismatch, and org-03a enforces structure only.
- **Recommended:** R2 runs high-assurance — It is the documented standard in two protected files and a stop condition at policy.json:86. The last programme already wrote invariants and oracles first, so the real added cost is a rollback plan and an independent reviewer per R2 batch. The operator should weigh that cost against option 2.
- **Sceptic:** Re-read EXECUTOR.md:30-57 and policy.json:78-111, and re-counted 53 standard R2 records. Corrected the cost claim: high-assurance needs independent review (policy.json:104), which is a separate reviewer session, not only a verdict line. Named which batches fall at R2.
- **Ruling:** R2 runs high-assurance, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-01 · No in-repo command runs the whole gate by exit code, and the written gate lists disagree

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme A
- **Batch:** governance-discipline-gates
- **Now:** - `node -e` shows 48 package.json scripts, none named gate, and a lint chain of 12 commands.
  - HANDOVER.md:81-88 runs 9 commands, including `npx jest`, census and census:lines. CI runs `npm run test:coverage` instead (ci.yml:100, :154).
  - CONTRIBUTING.md:22-28 lists 7 commands (both `npm test` and test:coverage), and :31 says 'nine gates'.
  - pull_request_template.md:18-23 lists 6.
  - testing.md:164 says 'twelve', which u16:107-116 enforces.
  - check-derived-views.mjs:117-122 prints an out-of-repo `python -c` taskops command.
  - design-census.spec.ts:74 skips without RUN_CENSUS, and playwright.config.ts:81 sets reuseExistingServer to !CI.
  - `git ls-files | grep -i -E 'sweep|mutant|codemod|taskops|gate\.(sh|mjs|py)'` returns only session-orphan-sweep.ts and 3 unit tests.
  - HANDOVER.md:81-98 runs the gate before the feat commit exists.
  - Dev CI has been red for 61 push runs (POLICY-ci-green), while HANDOVER.md:29 says green.
- **Question:** Add `npm run gate` (scripts/tooling/gate.mjs reading one ordered step list), and point CONTRIBUTING.md and the PR template at it instead of their own lists?
- **Options:**
  - **Runner plus one step list** — gate.mjs:
    - frees the known ports, reusing killByPort from scripts/tooling/_platform.mjs so Windows keeps working;
    - stamps the tree before and after (git status --porcelain, write-tree);
    - runs HANDOVER's nine steps by exit code with durations, picking one jest step (test:coverage, as CI runs it).
    It cannot read CI, because the gate runs before the commit exists; reading CI is POLICY-ci-green's post-push step.
    
    `npm run gate` is a new command. CONTRIBUTING.md:20-35 and the PR template :18-23 point at it, and CONTRIBUTING's stale 'nine gates' goes. No existing script is removed. It is tested against a fixture step list, not ci.yml text (tooling-32). A full run includes build, Playwright and the design census, so it takes minutes. About +200 lines and -15 doc lines, R1.
  - **Runner that CI also calls** — As above, and the ci.yml steps call the runner's named steps, so the lists cannot drift. This edits .github/workflows/ci.yml, a sensitive path: R2, about +220 lines.
  - **No runner, fix the lists** — CONTRIBUTING.md's 'nine' becomes 'twelve', the duplicate `npm test` goes, and the PR template is aligned. The discipline stays manual and depends on the session. About ±10 lines, R0.
- **Recommended:** Runner plus one step list — The three written lists disagree, and the practised gate reported green for six days while CI was red. The reproducible part belongs in the repo, and CI wiring can follow as a separate R2 change.
- **Removes:** The command lists in CONTRIBUTING.md:22-28 and pull_request_template.md:18-23, replaced by `npm run gate`. No npm script is removed.
- **Sceptic:** Re-counted the 48 scripts, the 12-step chain, CONTRIBUTING's 7 commands and 'nine gates', the PR template's 6, u16:107-116 and the ls-files grep. All hold. Removed the claim that the runner reads the pushed commit's CI: HANDOVER.md:81-98 runs the gate before commit. Added the npx jest versus test:coverage choice, and the port-kill primitive the runner needs on Windows.
- **Ruling:** Runner plus one step list, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-04 · The mutation sweep exists only in session scratchpads and cannot be re-run from a record

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme A
- **Batch:** governance-discipline-gates
- **Now:** - `git ls-files | grep -i -E 'sweep|mutant|codemod|taskops|gate\.(sh|mjs|py)'` finds no sweep. HANDOVER.md:90-92 prescribes `sweep.py mutants.json`.
  - `grep -l -i scratchpad org/tasks/*.json` gives 17 records: T-0038, T-0057, T-0094 to T-0099, T-0102, T-0107, T-0108, T-0110, T-0111, T-0122, T-0142, T-0143, T-0144.
  - T-0144.mutation is prose, with no anchors or replacements.
  - Oracle-first holds (node over `git log --format=%s dev`): every T-0114 to T-0145 has a test commit, and the 7 without 'oracle' or 'red at' are T-0118 to T-0124.
  - CI runs check-derived-views through npm run lint (ci.yml:80, :149), and `grep -n -i census .github/workflows/ci.yml` exits 1.
  - LOCKBOOK.md:8 pins EOS 727bee44. The checkout HEAD 1d20607 is 6 commits past it, and `git diff --stat 727bee44..HEAD -- tools/eos` shows checks/seed.py (+110) and cli.py (+95) changed; taskops.py did not.
  - line-census.mjs:45 counts only .ts/.tsx/.css/.mjs.
  - `git ls-files tests` top-level folders: __mocks__, e2e, fixtures, helpers, integration, scripts, unit.
- **Question:** Should the mutation sweep become an in-repo node script, with each batch's mutants committed as data, so the landing step can be re-run without a session scratchpad?
- **Options:**
  - **Script, mutants as test data under tests/** — scripts/tooling/mutation-sweep.mjs reads one mutant file per task (file, anchor, replacement, suite expected to fail), for example tests/fixtures/mutants/T-####.json inside the existing fixtures folder. It runs against a clean checkout of HEAD, which needs a git worktree per sweep and a jest run per mutant; runtime is unmeasured. An optional `npm run mutation` is a new command.
    - JSON is outside the census (line-census.mjs:45) and outside c7's .ts|.tsx|.mjs|.js|.md walk (c7:99).
    - Anchors quote source text, so a later move codemod must rewrite them too.
    About +150 script and +40 fixture test lines, R1, no ADR.
  - **Script, mutants under org/mutants/** — Same script, but a new org/ folder revisits ADR-0010's placement of the governance corpus (org-19's reasoning), so an ADR is needed. R3, about +190 lines.
  - **Keep out of repo, record verbatim** — No script. The procedure requires each record's mutation field to list every mutant's file, anchor and replacement, so a run can be reproduced by hand. About +5 doc lines, R0. Records grow further past TEMPLATES.md:21's 40-line budget.
- **Recommended:** Script, mutants as test data under tests/ — The sweep found T-0144's survivor (a05ceaa1), yet it exists only in scratchpads. Data beside the tests, in the existing fixtures scheme, keeps records within budget and needs no ADR.
- **Sceptic:** Re-ran the ls-files grep, the scratchpad grep (17 records), the oracle-first check (T-0118 to T-0124 lack the words) and the EOS diff. Corrected the EOS drift: checks/seed.py also changed in 727bee44..HEAD, not only cli.py. Moved mutant data into the existing tests/fixtures scheme, and added the worktree-per-sweep and anchor-rewrite costs.
- **Ruling:** Script, mutants as test data under tests/, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-renderer · The task views are rendered only by taskops in a sibling EOS checkout

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme A
- **Batch:** governance-discipline-gates · **after:** org-06
- **Now:** The in-repo checker:
  - check-derived-views.mjs does not compute TASKS.md. :19-25 refuse to re-derive it.
  - :44-51 and :95-107 compare five projected columns.
  - :117-122 print `python -c "from tools.eos import taskops; print(taskops.render_views('.'))"`.
  - Only its docs/manifest.json half re-derives, by importing the real generator (:136-139, :187-193).
  
  The renderer, ../PatterTech_EOS/tools/eos/taskops.py:
  - 620 lines, last changed 563c85b (2026-08-16).
  - _tasks_view :421 (the row at :438-441 is id/mode/tier_ruled/status/owner_session), _state_view :447, strip_machine_facts :517, build_views :538, render_views :598.
  - Top-level imports are the standard library and .findings. gitfacts is imported lazily at :585.
  - build_views' docstring (:541-544) keeps one implementation for writer and checker.
  - EOS check E011 (checks/structural.py:893) compares 'byte-for-byte up to the state view's machine-facts' (:903).
  - taskops, findings and gitfacts total 857 lines (wc -l).
  
  Licences: the EOS is Apache-2.0 (LICENSE; README.md:34, :56), and so is PatterStage (LICENSE, NOTICE, package.json license).
  
  Estate rules: GOVERNANCE.md:337-339 (the integrator alone runs generators) and :391-393 (ventures pin the EOS commit). The wrong-root friction is filed twice, at EOS_FEEDBACK.md:143 (2026-08-26) and :209 (2026-08-22). ADR-0003:41-46 is the copy-in vendoring precedent.
  
  CI has no setup-python step. install-harness uses the runner's stdlib python3 (ci.yml:352-353, :361). The local EOS checkout is 6 commits past LOCKBOOK.md:8's pin, with taskops.py unchanged in that range.
- **Question:** How are org/TASKS.md and org/STATE.md regenerated from now on: the pinned EOS checkout, a vendored copy of taskops, a JS port, or only after asking the estate?
- **Options:**
  - **Keep the pinned checkout, document it** — The exact python -c command goes into the in-repo landing procedure (org-06), and each record names the EOS commit its views were rendered with. Today that commit is 1d20607, not the pin, but the view code is unchanged in that range, so recording the real commit is honest without a checkout. Windows works through python and PYTHONPATH. A session without ../PatterTech_EOS cannot render, which PLAYBOOKS.md:101-102 already accepts. 0 script lines, about +10 doc lines, R0.
  - **Vendor taskops by copy-in** — The three modules (857 lines) are copied into the repo with PROVENANCE.md and a drift test, as ADR-0003:41-46 did for the kit. If npm run lint then calls Python, every Windows contributor needs Python for lint, although GitHub runners already have python3. A new dependency and a new precedent means an ADR (R3) plus an EOS_FEEDBACK entry.
  - **Port to check-derived-views --write** — About +150 JS lines re-implement _tasks_view and _state_view. That is the second implementation check-derived-views.mjs:19-21 and taskops.py:541-544 warn against, and it must stay byte-identical, or E011 (structural.py:903) flags drift. A recorded deviation, so an ADR (R3).
  - **Ask the estate first** — A third EOS_FEEDBACK entry, cross-referencing :143 and :209, asks for a venture-callable renderer. The current workaround stays until it lands. About +10 lines, R0.
- **Recommended:** Keep the pinned checkout, document it — The estate fix is already requested twice. Vendoring or porting creates a second copy that E011 compares byte for byte, while documenting the command removes the session dependence at no risk.
- **Sceptic:** Re-read taskops.py:421-444, 538-548 and 585, structural.py:893 and :903, both LICENSE files, GOVERNANCE.md:337-339 and :391-393, ADR-0003:41-46, EOS_FEEDBACK.md:143 and :209, and ci.yml:352-361. Corrections: - gitfacts is imported lazily, not at the top. - CI has no setup-python step; the real vendoring cost is Python on every Windows lint run, not a ci.yml edit. - Ownership moved to false, because the recommended option changes nothing.
- **Ruling:** Keep the pinned checkout, document it, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-11 · eos-compile.mjs is a 248-line script that refuses to run and is still pinned by b15

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R1 · theme A
- **Batch:** dead-code
- **Now:** The script:
  - `wc -l scripts/tooling/eos-compile.mjs` gives 248.
  - :24 reads `process.env.EOS_ROOT || "C:/Users/Daniel/Documents/Coding/Github/PatterTech_EOS"`.
  - :141-177 refuse, ending with process.exit(1) at :177.
  - `grep -n eos package.json` finds nothing, so there is no npm script.
  
  Who names it:
  - `git grep -l eos-compile` hits COMPILE_REPORT.md, EOS_FEEDBACK.md, VENTURE_BRIEF.md, ADR-0010, T-0057, T-0109, b15-corpus-moves-under-org.test.ts:138-150 (two its) and b15-docs-pipeline-is-wired.test.ts:5 (a comment).
  - `grep -rn eos-compile` over ../PatterTech_EOS finds nothing, so no estate check reads it.
  - COMPILE_REPORT.md:179-182 calls it a Session 0 artefact, and :563-565 says it needs 'a v2 pass or a retirement note'.
  - ADR-0010:104-105 names its comments and HAND_WRITTEN list. :106-109 makes its refusal the guard until the estate moves the SCALE_MATRIX rows.
  - The EOS_FEEDBACK entry ADR-0010 promised was never filed: no 2026-09 entries, and the SCALE_MATRIX mentions sit at :44, :184 and :257 inside other entries.
  - VENTURE_BRIEF.md:23-27 describes the script as present, and :26 cites the stale path docs/COMPILE_REPORT.md.
  - line-census.mjs:50-51 walks src and tests only.
- **Question:** Retire scripts/tooling/eos-compile.mjs with the retirement note COMPILE_REPORT item 5 asks for, or keep it as ADR-0010's guard until the estate answers?
- **Options:**
  - **Retire with note and feedback entry** — The retirement batch:
    - deletes the script (-248);
    - deletes b15-corpus's two its at :138-150 (-13; removing named it() blocks changes the suite's identity);
    - rewords b15-docs-pipeline:5;
    - writes the retirement note at COMPILE_REPORT item 5, which :563-565 invites;
    - points VENTURE_BRIEF.md:23-27 at the note and fixes :26's path;
    - files the SCALE_MATRIX EOS_FEEDBACK entry ADR-0010:106-107 promised.
    ADR-0010 keeps its text. With no compile left, nothing can write to the old paths. About -255 lines (13 of them census-counted), R1.
  - **Keep until the estate rules** — File the missing EOS_FEEDBACK entry now (about +10 lines), and keep the script and its tests until the estate moves the matrix rows. The dead script stays.
  - **Keep indefinitely** — Status quo. COMPILE_REPORT item 5 stays open, and VENTURE_BRIEF keeps describing a compiler that refuses to run.
- **Recommended:** Retire with note and feedback entry — The script refuses to run, has no npm entry and nothing in the estate reads it, and COMPILE_REPORT.md:563-565 explicitly allows a retirement note. Deleting it keeps the guard's purpose, because nothing can compile to the old paths.
- **Removes:** scripts/tooling/eos-compile.mjs (run as `node scripts/tooling/eos-compile.mjs`, no npm script; described in COMPILE_REPORT.md:179-182 and :563-565, VENTURE_BRIEF.md:23-27 and ADR-0010:104-109) and b15-corpus-moves-under-org.test.ts:138-150's two its.
- **Sceptic:** Re-ran wc, sed :24 and :170-177, git grep -l (9 files) and an EOS-wide grep (no hits). Re-read COMPILE_REPORT.md:179-182 and :563-565, VENTURE_BRIEF.md:20-28 and ADR-0010:95-109. The recommendation stands. Added: removing the two its changes suite identity, VENTURE_BRIEF.md:26's stale path gets fixed in passing, and the test its now appear in 'removes'.
- **Ruling:** Retire with note and feedback entry, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-12a · T-0003 waits on the operator over a dirty Cursor worktree whose tracked changes are already rescued

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R3 · theme A
- **Batch:** org
- **Now:** T-0003 (node -e):
  - high-assurance, R3, active.
  - Its intent says the Cursor worktree is dirty, and that 'git worktree remove and the follow-on git branch -d cursor/f7b69026 wait on his decision and --force stays forbidden'.
  
  The worktree:
  - `git worktree list` shows C:/Users/Daniel/.cursor/worktrees/hermes-control-hub/flkr at 1d8eb52f (2026-05-09).
  - `git -C <worktree> --no-optional-locks status --porcelain` gives 15 entries: 13 modified, and 2 untracked (src/components/ui/ElectricPlasmaBorder.tsx, tests/unit/theme-accent-surfaces.test.ts).
  - The 13 modified files are already saved outside the repo in ../patterstage-cursor-worktree-rescue-2026-08-22.patch: 35,180 bytes, with 13 `diff --git` headers naming the same paths and no new-file entries. org/logs/2026-08/S-0003-execution.md:90-95 records the rescue. Only the 2 untracked files are unsaved.
  - `git merge-base --is-ancestor 1d8eb52f dev` exits 0, so the branch is merged, and `git branch -d` needs no force today.
  
  T-0003's end state ('dev, main and nothing unsanctioned') has regressed: `gh pr list` shows 12 open Dependabot PRs (#224-#233 from 2026-08-26, #235-#236 from 2026-09-09) and #234 feature/healthz-liveness-endpoint, all against dev, besides #157.
  
  Rules that apply:
  - policy.json:135 puts deletion under always_human.
  - PLAYBOOKS.md:73-75 forbids deleting quarantined work without operator authority.
  - STATE.md:19 says 'Nothing waits on the operator'.
- **Question:** How are the Cursor worktree's changes preserved before the operator removes it: finish the existing out-of-repo rescue, commit them to the branch, or leave the worktree in place?
- **Options:**
  - **Complete the rescue, then operator removes** — Copy the 2 untracked files next to the 2026-08-22 patch, outside the repo, as S-0003 did for the 13 modified files. The operator then runs git worktree remove and git branch -d cursor/f7b69026, which is merged, so no force is needed. Nothing is lost. T-0003 moves on to its end-state check, which must also handle 13 open PRs. R3 (deletion is always_human), 0 repo lines.
  - **Operator inspects, then removes** — The operator reviews the worktree and removes it. The 13 modified files survive in the patch, but the 2 untracked files are lost unless copied first. R3.
  - **Quarantine by local commit** — Commit the 15 entries on cursor/f7b69026, without pushing. The branch then holds an unmerged commit, so `git branch -d` refuses and only `-D` would remove it. T-0003 forbids that, so its end state cannot be reached without another ruling. It also duplicates the patch. R3.
  - **Leave it, flag it** — Set T-0003 to blocked so STATE.md lists it (org-12c). The worktree stays, and the 2 untracked files remain exposed to a Cursor cleanup. R0 record edit and a view render.
- **Recommended:** Complete the rescue, then operator removes — The 2026-08-22 rescue already holds 13 of the 15 changes, so copying the 2 untracked files loses nothing. The branch is merged, so deleting it needs no force, whereas a local commit would rule out a no-force deletion. The changes predate C7 (src/lib/theme.ts is now src/lib/ui/theme.ts), so adopting them would be rework either way.
- **Removes:** The Cursor worktree .../hermes-control-hub/flkr and the merged local branch cursor/f7b69026, removed by the operator after the 2 untracked files are copied beside the rescue patch.
- **Sceptic:** Re-ran git worktree list, the porcelain status (13 modified plus 2 untracked, not 15 modified), merge-base (merged) and gh pr list. Found the existing rescue patch and its log entry (S-0003-execution.md:90-95), plus 13 new open PRs. The draft's recommended local-commit quarantine would have unmerged the branch and forced the -D that T-0003 forbids, so the recommendation changed to finishing the out-of-repo rescue.
- **Ruling:** Complete the rescue, then operator removes, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-12b · No cadence or sampled review has ever run

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R1 · theme A
- **Batch:** org
- **Now:** - `node -e` over org/cadence.json shows 5 rows, all with last_run null. upkeep was due 2026-09-05.
  - STATE.md:25 still lists that date, and :27 renders 'None' for stakeholder-update.
  - capability-profile.json evidence.sampled_review has n 0 and pass_rate null.
  - REVIEWER.md:39-41 sets a sampled pool, 'default one in five'.
  - The procedures exist: PLAYBOOKS.md:127 (#upkeep), :136 (#retro), :161 (#restore-test).
- **Question:** Are the five cadences and the one-in-five sampled review run from now on, or retired?
- **Options:**
  - **Run them** — The next programme's first org batch is an upkeep pass (PLAYBOOKS.md:127), and cadence rows get last_run dates. One in five standard tasks enters sampled review (REVIEWER.md:39-41). Each sample is a separate reviewer pass, with results recorded in capability-profile.json. About 0 net lines, R0 to R1.
  - **Retire or suspend by ADR** — Suspend some cadences and the sampled review. REVIEWER.md is protected, so this takes an ADR and R3. It removes cadence rows and PLAYBOOKS sections (documented procedure).
  - **Leave as is** — STATE.md keeps listing a passed due date, the capability profile stays unevaluable, and the documented procedure goes on being skipped without a ruling.
- **Recommended:** Run them — They are documented, not dead, and the upkeep pass is what clears org-12c's stale state.
- **Sceptic:** Re-ran node over cadence.json and capability-profile.json, and re-read STATE.md, REVIEWER.md:37-42 and the PLAYBOOKS section headings. The evidence holds. The operator_needed reason was made precise: running as written is free, skipping or suspending needs a ruling. Added the per-sample reviewer cost.
- **Ruling:** Run them, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-12d · 116 per-line no-require-imports disables in tests await an eslint policy call

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R0 · theme A
- **Batch:** tests
- **Now:** - HANDOVER.md:132-136 asks the operator about a tests-scoped override, saying it would free 'about a hundred' lines.
  - `git grep -c 'eslint-disable-next-line @typescript-eslint/no-require-imports' -- tests` gives 116 lines in 89 files.
  - Each disable carries its reason on the line, for example tests/helpers/mocks.tsx:313 ('inside a jest.mock factory...') and a-custom-fallback-keeps-its-name.test.ts:32.
  - `git grep no-require-imports -- tests/unit eslint.config.*`, excluding the disables, finds no test that pins the rule.
- **Question:** Turn off @typescript-eslint/no-require-imports for tests/** to free the 116 per-line disables, or keep the disables?
- **Options:**
  - **Keep per-line disables** — Status quo. The 116 lines stay in testLines, and each future factory adoption adds one more. R0.
  - **Tests-scoped override** — The eslint config disables the rule for tests/**, freeing about 116 test lines in 89 files. Any require() in tests stops being flagged, which weakens a check. R1.
  - **Remove the need** — Swap each factory's require() for jest.requireActual(). The rule should not flag a member call, but that is unverified here; `npx eslint` on one converted suite, then jest on it, would confirm. That drops the 116 disables without weakening the rule and moves testLines toward target. It touches 89 files, which must be checked against the 126 suites that assert on source text (tests-09). About -116 lines, R1.
- **Recommended:** Keep per-line disables — The guardrail forbids weakening checks, each disable states its reason where it applies, and the saving is census lines, not behaviour. The requireActual swap is the only non-weakening way to recover the lines, and it can ride along with a test-shrink batch that touches those files anyway.
- **Sceptic:** Re-ran git grep -c (116 lines in 89 files), read two disables with their reasons, and found no test pinning the rule. Replaced option 3's vague 'rework the factories' with a concrete non-weakening variant (jest.requireActual), marked unverified, with the command that would verify it.
- **Ruling:** Keep per-line disables, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-15 · The C8 suite ties jest to the closed plan's closing numbers through the live census baseline

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme A
- **Batch:** tests
- **Now:** In c8-the-programme-is-closed.test.ts:
  - :111-125 reads line-census.baseline.json and requires each MISSED key, with its committed number, in the plan's '## What the programme did' section.
  - :94-97 fails once a missed measure meets its target.
  - :88-92 fails if any met measure rises above its target.
  - :84-86 fails if a measure rises above AT_C0.
  - :80-82 fails if a measure is added or removed.
  - :127-130 requires 'status: done'.
  - :104-110 calls the coupling deliberate.
  
  The census now. The baseline (measuredAt 2026-09-10) and `node scripts/tooling/line-census.mjs --report` agree, so live equals baseline:
  - srcLines 100,881 (2,881 above target).
  - testLines 121,114, only 648 below AT_C0's 121,762.
  - srcRepeatedWindowLines 1,000, testRepeatedWindowLines 4,343.
  - oneImporterComponents 103 (8 above target).
  - routesWithTryCatch 13, against target 13, so there is no headroom under :88-92. repeatedTypeShapeFiles is 2 against 3.
  Check mode exits 0 in 1.7 s with '12 measures held'. The script writes only under --update-baseline (:286). c8 costs 4,256 ms per jest run (perf cache f25d3351).
- **Question:** Before the next programme lowers the line-census baseline, may c8's checks against the live baseline (:111-125) and its 'missed really missed' check (:94-97) be re-anchored to numbers frozen at C8, so the closed plan is never edited again?
- **Options:**
  - **Re-anchor to C8** — The C8 closing numbers are frozen in the test. :111-125 compares the plan to the frozen numbers, and :94-97 becomes 'MISSED equals what the plan recorded at C8'. :80-86, :88-92 and :127-130 stay live, so two limits still bind the next programme: 648 lines of testLines headroom (:84-86), and no route may add its own try/catch (:88-92). About -15 test lines, R1.
  - **Leave coupled** — Every --update-baseline that lowers one of the five missed measures turns c8 red until the closed plan's closing numbers are edited, so every shrink batch edits a closed record by design. :88-92 also fails any batch that adds one route with its own catch.
  - **Retire the live checks** — Delete :84-97 and :111-125, keeping :80-82 and :127-130. The C0 ratchet and the met-target holds then live only in the census baseline, which nothing gates today (tests-02a). About -40 lines, and a weaker check.
- **Recommended:** Re-anchor to C8 — It keeps what c8 proves about the closed programme without forcing edits to a closed record whenever the census falls. The two holds that stay live (:84-86 and :88-92) are real constraints the next plan must budget for, or rule on separately.
- **Removes:** c8:94-97's live 'missed really missed' check and :111-125's live baseline read, replaced by comparisons against frozen C8 numbers.
- **Sceptic:** Re-read the whole c8 suite and the baseline, and ran line-census in check and report modes (read-only: it writes only at :286; exit 0; live equals baseline). Added the :88-92 met-target hold the draft left out, where routesWithTryCatch has zero headroom. Corrected c8's jest cost to 4.3 s, and recorded the removal in 'removes'.
- **Ruling:** Re-anchor to C8, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-02a · No gate holds the line-census baseline, while seven suites run the census against looser numbers

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · theme A
- **Batch:** tooling-ci · **after:** POLICY-ci-green, docs-01
- **Now:** Where the census runs, and does not:
  - package.json's lint chain (node -e) has 12 commands and no line-census. `grep -n -i census .github/workflows/ci.yml` exits 1.
  - line-census.mjs:296-298 exits 1 on a rise, and it writes only under --update-baseline (:286).
  - At HEAD, check mode exits 0 in 1.7 s locally.
  
  Suites that spawn it (git grep):
  - Against the real tree: c2:99 (ceiling at :101, <=3), c3:137, c4:223 (:225-226, <=40 and <=4800), c5:63 (:65, <=60), c6:95 (ceiling at :40, 105), c7:60 (the exact lib-root list), c8:69 (<= AT_C0).
  - c0 runs it only against fixture trees (c0:25, :53).
  
  Cost:
  - Jest perf cache f25d3351 (mtime 2026-09-11 12:05, 728 entries): c0-c8 take 33,347 ms of 340,959 (c7 5,487, c4 4,448, c0 4,386, c8 4,256, c6 4,135, c5 4,031, c2 3,785, c3 2,534, c1 285). The review said 28,401 of 334,112.
  - Last green CI (run 33941077625): build-test-ubuntu's ESLint step took 60 s, unit tests 85 s, and the whole job 318 s.
  
  Other facts:
  - testing.md:166 says 'Two censuses ratchet, outside that chain'.
  - line-census.mjs:45 counts .ts/.tsx/.css/.mjs and :53 splits on newline, so the line counts do not depend on line endings. Windows working trees are CRLF (core.autocrlf true; .gitattributes normalises the repository to LF). Whether the repeated-window measures agree on a Linux LF checkout is unmeasured.
- **Question:** Hold the line-census baseline with a blocking CI step, by adding it to npm run lint, or leave it manual?
- **Options:**
  - **CI step, outside the chain** — `npm run census:lines` becomes a named step after ESLint in build-test-ubuntu: about +3 lines in .github/workflows/ci.yml and about 2 s of CI time. testing.md:166 stays true; the step is added to :162's list. Local lint is unchanged.
    - The loose ceilings in c2, c4, c5 and c6 can then go, but deleting those it() blocks changes suite identity. c6's reads.files check, c7's exact list and c0's fixtures stay; c8 per org-15.
    - The first CI run shows whether the window measures match the Windows-written baseline. A mismatch needs a re-baseline with a written reason.
    R2 (sensitive path). The step reports into a job that stays red until POLICY-ci-green's batch 0 lands.
  - **Append to npm run lint** — Lint blocks both locally and in CI (ci.yml:80, :149), with no workflow edit. Every commit that adds test lines needs --allow-growth with a reason before lint passes. u16:107-116 and testing.md:164 go from twelve to thirteen, :166 is rewritten, and CONTRIBUTING.md:31 changes. R1, net about -35 if the ceilings go.
  - **Stay manual** — The baseline holds only in the hand-run landing gate. A PR from any other route can grow src or tests unchecked, and the ceilings stay.
- **Recommended:** CI step, outside the chain — It enforces the baseline on every push and PR for about 2 s of CI, keeps the documented 'outside the chain' behaviour, and avoids forcing --allow-growth on every local lint run.
- **Removes:** If the step lands, optionally the loose census ceilings at c2:101, c4:225-226, c5:65 and c6:40 (it() blocks whose work the CI step takes over).
- **Sceptic:** Re-ran git grep for the spawns and ceilings, recomputed the jest perf-cache sums (they match), ran line-census in check mode and read its extension filter and line split. - Corrected the count to seven suites against the real tree, since c0 uses fixtures. - Added the unmeasured Linux-versus-Windows risk for the window measures, and that deleting the ceilings changes suite identity. - docs-01's scope, from another theme, was not re-read in this pass.
- **Ruling:** CI step, outside the chain, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-30a · Branch protection on main requires zero checks, and admins bypass it

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme A
- **Batch:** tooling-ci
- **Now:** `gh api repos/Daniel-Parke/PatterStage/branches/main/protection`:
  - required_status_checks strict true, but contexts [] and checks [].
  - 1 approving review, code-owner review and last-push approval required.
  - enforce_admins false; force pushes and deletions off.
  - The rulesets endpoint returns [].
  
  Ownership and dev:
  - .github/CODEOWNERS lists only @Daniel-Parke (`*`, /src/, /docs/, /scripts/, /tools/).
  - dev protection is the same, minus code-owner review.
  - ce4ac1fd's only associated PR is #157 (dev to main, open since 2026-06-04), so dev commits land by direct push with the admin bypass.
  
  The checks in ci.yml:
  - ci.yml:29-34 triggers on push and PR for main and dev.
  - acceptance-gate (ci.yml:429-441) runs `if: always() && (dispatch || PR to main)`, needs e2e-full, install-harness and real-hermes-integration, and fails unless all three succeed. So it cannot pass as skipped on a PR to main.
  - Its check name is 'acceptance-gate (full suite + install journey + real Hermes)' (ci.yml:430).
  
  The documents:
  - ci.yml:422-425 and testing.md:180 say zero required checks, while CONTRIBUTING.md:85 says 'the real gate (PR + checks)'.
  - T-0004's intent names install-harness as its remaining operator half, and ci.yml:422-425 re-aims that half at acceptance-gate, which contains install-harness.
  - Dev CI has been red since 2026-09-05, and real-hermes-integration is failing, so acceptance-gate would be red on #157 today.
- **Question:** Make acceptance-gate and build-test-ubuntu required status checks on main now?
- **Options:**
  - **Require checks now** — Both become required on main, entered under their displayed check names (acceptance-gate's is the long name at ci.yml:430). PR #157 cannot merge for a non-admin until dev CI is green, and today real-hermes-integration keeps acceptance-gate red. Admins, including the operator token agent sessions push with, still bypass while enforce_admins is off. T-0004 can close, since acceptance-gate contains install-harness, and CONTRIBUTING.md:85 becomes true. No repo diff; an operator setting.
  - **Require after dev is green** — The same settings, applied once POLICY-ci-green's fixes land. T-0004 stays blocked until then.
  - **Keep zero required checks** — CONTRIBUTING.md:85 is corrected to say the checks only report (R0). T-0004 closes as won't-do, which drops WO-0011's remaining half and the aim testing.md:180 documents, and acceptance-gate keeps blocking nothing.
- **Recommended:** Require checks now — Nothing red should reach main. The release already waits on the operator (HANDOVER.md:154-157), and requiring the checks closes a gap open since 2026-07-26 at no repository cost.
- **Sceptic:** Re-ran gh api for main and dev protection and for rulesets, the commit's associated PRs and gh pr list, and read CODEOWNERS and ci.yml:29-34 and :405-441. The core facts hold. Added: - required checks match on display name; - acceptance-gate uses always(), so it cannot pass skipped; - it contains T-0004's install-harness half; - it is red on #157 today; - CODEOWNERS has more lines than `*`.
- **Ruling:** Require checks now, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-30b · The pre-push hook that blocks direct pushes to main is not installed

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme A
- **Batch:** tooling-ci
- **Now:** - `git config --get core.hooksPath` exits 1, and .git/hooks holds only samples.
  - scripts/git-hooks/pre-push:1-23 (bash) blocks pushes to main, but lets through any commit whose subject starts with 'Merge' or 'merge' (:8).
  - CONTRIBUTING.md:84 calls the hook optional, installed with `git config core.hooksPath scripts/git-hooks`.
  - package.json has no prepare script (node -e).
  - Dockerfile:7-8 copies package.json and the lockfile, then runs `npm ci` with no .git, so an unguarded prepare would fail there.
  - The EOS router matches a package.json 'prepare' key (router.py:184, :309) and feeds install-script into ci-stateful-infra at R2 (router.py:79-83).
  - enforce_admins is false on main (gh api), so GitHub's PR rule does not stop an admin push, and HANDOVER.md:98's `git push origin dev` pushes from sessions with the operator's credentials. That is GitHub's documented classic-protection behaviour; it was not exercised, because testing it needs a push.
- **Question:** Install the pre-push hook in the operator's clones, add an install-time prepare script, or leave it opt-in?
- **Options:**
  - **Operator installs it once** — The operator runs `git config core.hooksPath scripts/git-hooks` in each clone, and the landing procedure checks that it is set. The hook runs under Git Bash on Windows. It guards against mistakes, not deliberate bypass, because a 'Merge...' subject passes (pre-push:8). 0 repo lines, R0.
  - **Guarded prepare script** — A package.json `prepare` sets hooksPath only when .git exists and CI is unset: about +1 to 3 lines. It silently changes every contributor's git config on npm install, and must be shown harmless in the Dockerfile deps stage and the install-harness containers. R2, not R1: the EOS router's install-script detector (router.py:184, :309) floors a manifest that gains prepare at ci-stateful-infra.
  - **Leave opt-in** — Status quo. A mistaken `git push origin main` from an agent session succeeds through the admin bypass.
- **Recommended:** Operator installs it once — It closes the easiest route to a mistaken main push at zero repo cost, without the prepare script's install-time risk and R2 floor.
- **Sceptic:** Re-ran git config and ls .git/hooks, and read the hook, Dockerfile:1-12 and router.py:79-83, :184 and :309. Corrections: - The prepare-script option is R2, not R1, through the EOS install-script detector. - The hook passes any 'Merge' subject, so it is not the barrier the draft described. - The admin-push claim is documented GitHub behaviour, not something re-run here.
- **Ruling:** Operator installs it once, as recommended — Daniel Parke (operator), 2026-09-12.

### Theme B · Security rulings and the Node runtime

1. Id coverage.
- critic-02, critic-04, app-06 and tooling-04 have entries under their own ids.
- critic-03 is split: entry critic-03a (the boot line) and verified row critic-03b (file modes).
- critic-05 is split: entries critic-05a (body signing) and critic-05b (header aliases), and verified row critic-05c (x-ps-* tests).
- critic-02's sessions-limiter part is verified row critic-02s.
- No entry carries the bare id critic-03 or critic-05. A checker matching exact ids must map the suffixes.

2. One policy question settles several entries.
RUL-SEC-003 (org/RULINGS.json:322, decision :327) sets ASVS level 1 on every surface and level 2 on the provider-key and session-auth paths, 'with exclusions recorded per surface'.
- critic-02 and critic-03a keep a narrowed deviation, so they need an exclusion record.
- critic-04 meets the bar unless the operator chooses to leave framing allowed.

The repo names no ASVS version (`git grep -niE asvs` finds only :327). The clause numbers cited are ASVS 4.0.3, from outside the repo. org/policy.json:131 puts 'recorded deviation from a standard' and 'new public contract' in the durable band. So each exclusion is an ADR in the protected org/decisions/, and writing it is R3. If the operator first rules where exclusions are recorded, critic-02 and critic-03a can be ruled together.

3. Recommendations changed in this pass.
- **critic-05a** moves to documenting the gap: anyone able to replay already holds the token, and the token alone saves and runs host scripts with no signature.
- **app-06** moves to 'host-side routes keep theirs', following proxy.ts:58-63.
- **critic-02** keeps its recommendation, gains a fourth option (a wrapper server, the only thing that closes the lockout) and states the remaining risk for short PS_AUTH_TOKEN values.
- critic-03a, critic-04, critic-05b and tooling-04 keep their recommendations, with corrected consequences and reasons.

4. Ordering.
- critic-05c (R0, tests) lands before critic-05b, and before critic-05a if the operator picks a format change.
- The CH_ retirement ruling (cross-cutting-04 and tooling-11; index :332 and :158) settles critic-05b.
- critic-02s follows critic-02's ruling on which header it keys on.
- tooling-04 edits scripts/bootstrap/setup.mjs, which tooling-03 would delete, and cites the bench-gateway image, which tooling-02 would delete. Sequence it after those rulings or accept the extra edit.

5. Lanes (max_lanes 2).
- Lane A, the auth files:
  - critic-02 and critic-02s (auth-throttle.ts, sessions-api-guard.ts, instrumentation.ts if the warning lands)
  - critic-03a (instrumentation.ts, auth-token.ts, proxy.ts)
  - critic-03b (boot chmod, db/index.ts, ps-deploy.mjs)
  - critic-05b and app-06 (both edit api-auth.ts)
- Lane B:
  - critic-05c, then critic-05a's doc lines
  - critic-01, critic-14, tooling-05 and tooling-29
  - then tooling-04 (CI and Docker; its docker-image job also exercises tooling-05)

6. Rows that need no ruling: critic-01 (R1), critic-14 (R1), critic-02s (R2 if it exports a count), critic-03b (R2), critic-05c (R0), tooling-05 (R1) and tooling-29 (R1).

7. New observations from this pass, not in the review:
- **Stale throttle comment.** auth-throttle.ts:33-35 says loopback collapses to 'local'. It never does under next start: Next fills X-Forwarded-For with the peer address (node_modules/next/dist/server/base-server.js:577) before the proxy runs (:938).
- **Env token has no minimum length.** PS_AUTH_TOKEN is accepted as-is (auth-token.ts:66-67), so rotating the header defeats the sign-in throttle for a short container token.
- **The boot line echoes an env token too.** instrumentation.ts:28-33 prints whatever ensureAuthToken returns, including PS_AUTH_TOKEN (auth-token.ts:90-91).
- **Signing secret turns off the deploy buttons.** With PS_REQUEST_SIGNING_SECRET set, the in-app Update, Rebuild and Restart get 401 (useVersionFooter.ts:224-227, api-auth.ts:48-49), and docs/running/env-reference.md:70 does not say so.
- **The signature adds little.** A token holder can already save and run host scripts (src/app/api/scripts/[name]/route.ts:2-4, scripts/run/route.ts:2-3), so the /api/update signature guards nothing the token does not already grant. Whether to keep the feature at all would be a separate removal ruling; it is not proposed here.
- **Tests pin both ways on route guards.** b6-backup-route.test.ts:190-198 and :272-290, b3-operator-prefs.test.ts:110-114 and missions-read-only-reads.test.ts:103-117 pin the route-level read-only refusal. b6-credentials-rotate-route.test.ts:331-333 pins its absence on another route.
- **Two missed Node 20 sites.** tooling-04's minimum also lives at scripts/bootstrap/setup.mjs:84-86 and docs/running/deploy.md:101.
- **More data-directory creators.** critic-03b: PS_DATA_DIR is also created by setup.sh:149-157 and auth-token.ts:95-97, and database backups are copied at src/lib/db/upgrade.ts:300-302.
- **Docker context exposure is local only.** tooling-05: CI builds from a fresh checkout that holds only data/seed.
- **RUL-SEC-002 has no tracked implementation.** There is no staged pre-commit scan and no credential-file deny list. It is outside this theme's findings but belongs beside tooling-29.

8. Not re-run, because read-only rules prevent it:
- the reviewer's xff-lockout script (critic-02 was re-derived from Next's source instead);
- the gitleaks count for tooling-29, and the CI action's scan range;
- docker builds for tooling-05;
- the full gate on Node 22 and 24 for tooling-04 (npm ci, lint, jest, next build, and the docker-image and install-harness jobs);
- whether better-sqlite3 has prebuilt linux-x64 binaries for 22 and 24, which needs the network;
- whether next.config headers() reach responses the proxy builds itself, which needs a running server;
- whether the hex IPv4-mapped form reaches loopback on a deploy host, which needs a listener.

9. Other notes:
- A script-src Content-Security-Policy is a separate, heavier step (Next nonces and a build) and is not part of critic-04.
- The Node support dates come from the published schedule, not the repo.

#### critic-02 · The sign-in throttle trusts the X-Forwarded-For header a caller sends, so a remote caller can hold the operator at 429

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · **needs an ADR** · theme B
- **Batch:** security-defects
- **Now:** Re-derived from the code at ce4ac1fd. The reviewer's scratch lockout script is not in the tree, and recreating it would write a file.
  - Key: src/lib/api/auth-throttle.ts:37-46 uses the first X-Forwarded-For entry, then x-real-ip, then 'local'.
  - Next fills the header before the proxy runs.
    - resolve-routes.js:357-364 marks the request middlewareInvoke and calls the render server's requestHandler.
    - Inside base-server.js handleRequestImpl (:529), line 577 runs `req.headers['x-forwarded-for'] ??= ...socket.remoteAddress`, and the middleware branch comes later at :938 (next 16.2.9, confirmed with node -e).
    - So a header the caller sends is kept. The comment at auth-throttle.ts:33-35, 'Loopback collapses to "local"', is false under next start: a loopback operator is keyed on its socket address.
  - Penalty: src/proxy.ts:253-260 answers 429 before the token is read at :262, and records nothing. auth-throttle.ts:72-80 re-arms min(2^(n-6), 15) seconds on each failure after the fifth, so one wrong token per window holds a key.
  - Reach:
    - package.json:17 start is `next start` (all interfaces, proxy.ts:9-11) and :24 start:network is `next start -H 0.0.0.0`.
    - The Docker image sets HOSTNAME=0.0.0.0 (Dockerfile:83) and runs start:network (:87).
    - scripts/tooling/ps-deploy.mjs:322 spawns next start -H host.
  - The ruling: proxy.ts:246 cites T-0083 ruling 2, and org/tasks/T-0083.json:3 names operator rulings 2 and 3. Invariant I5 at :35 reads 'One client cannot throttle another, and the record map is bounded -- x-forwarded-for is attacker-controlled'. Tests pin per-client keys at tests/unit/failed-auth-costs-something.test.ts:232-240 and pruning at :276-295.
  - Real impact, minted token: it is randomBytes(32) (src/lib/api/auth-token.ts:93), so rotating the header cannot make guessing feasible.
  - Real impact, env token: PS_AUTH_TOKEN wins and is taken as-is with no minimum length (auth-token.ts:66-67). It is documented for containers (docs/SECURITY.md:71, docs/running/env-reference.md:59), and the real-Hermes rig sets a fixed word token (docker-compose.real-hermes.yml:59). For a short token, rotating the header removes the throttle entirely.
  - The live harm: a targeted lockout. Send the operator's key ('127.0.0.1', '::1' or '::ffff:127.0.0.1') with wrong tokens.
  - Behind a proxy: docs/running/deploy.md:95 and :152 recommend 'a reverse proxy' without naming one. Whether the first entry stays caller-controlled depends on that proxy; one that appends, such as nginx's $proxy_add_x_forwarded_for, keeps it (outside the repo).
  - No doc describes the auth throttle: `git grep -niE 'throttl|429|too many failed' -- docs README.md ops` hits only the sessions limiter.
  - Standard: RUL-SEC-003 (org/RULINGS.json:322, decision :327) sets level 2 on session-auth. The repo names no ASVS version; `git grep -niE asvs` finds only :327. ASVS 4.0.3 V2.2.1 (level 1, outside the repo) asks for resistance to lockout and a cap on failures per account.
- **Question:** Should the sign-in throttle keep telling callers apart by the X-Forwarded-For header they send (the ruled design, which lets anyone who can reach the port lock you out 15 seconds at a time, and lets a caller dodge the throttle by changing the header), or change how it identifies callers?
- **Options:**
  - **Keep per-caller keys and record the gap** — No change for the operator or users.
    - Record: log the spoofing and rotation gap as a session-auth exclusion under RUL-SEC-003. That is a recorded deviation, so an ADR (org/policy.json:131).
    - Code: correct the false 'Loopback collapses to local' comment at auth-throttle.ts:33-35. Optionally warn at boot when PS_AUTH_TOKEN is short; it removes nothing and touches instrumentation.ts (R2).
    - Tests: add a case to failed-auth-costs-something.test.ts that pins the spoofed-header lockout as a known limit.
    - Docs: a paragraph in docs/SECURITY.md, which says nothing about the throttle today.
    - Sessions limiter: it switches to authClientKey and gains a prune (critic-02s).
    
    Residual risk: anyone who names the operator's key (for example 127.0.0.1) holds it out in 15 s windows, and a short PS_AUTH_TOKEN can be guessed at full speed by rotating the header. Removes nothing. Tier R2 (auth surface). About +20 lines, +10 with the warning.
  - **Trust the header only behind a named proxy** — A new env var (for example PS_TRUSTED_PROXY_HOPS).
    - When set, the throttle keys on the entry the proxy appended, counted from the right, not the first.
    - When unset, every direct caller shares one bucket. That closes rotation, but any failing caller makes everyone wait up to 15 s, so direct installs lose I5.
    - Docs: a new row in docs/running/env-reference.md and a SECURITY.md paragraph.
    - Tests: the per-client case at failed-auth-costs-something.test.ts:232-240 is rewritten to run with the var set.
    - Governance: T-0083 ruling 2 must be amended, and the env var is a new public contract, so an ADR.
    - The sessions limiter, documented 'per client' at env-reference.md:104 and docs/guides/sessions.md:209, either follows the same key or keeps its own.
    
    Tier R2. About +35 lines.
  - **One shared bucket, ignore the header** — Delete the header lookup from auth-throttle.ts, so every failure counts against everyone.
    - It closes rotation, which matters for a short PS_AUTH_TOKEN.
    - It removes per-caller isolation (I5). The case at :232-240 is deleted or inverted under a new ruling.
    - The lockout is made untargeted, not closed: anyone who can reach the port holds everyone out with one wrong token per window, without knowing the operator's address.
    - The sessions limiter is documented 'per client' (env-reference.md:104, sessions.md:209, docs/running/limitations.md:191). It keeps its own key, or those docs change.
    
    Tier R2. About -10 lines.
  - **Take the peer address from a wrapper server** — A small Node server script owns the socket. It overwrites x-forwarded-for with the peer address (or appends it behind a named proxy), then hands the request to Next's request handler.
    - This is the only option that closes both the targeted lockout and rotation on a directly reachable install while keeping I5.
    - It changes:
      - what `npm start` and `npm run start:network` run (package.json:17, :24);
      - the deploy runner's direct next start (scripts/tooling/ps-deploy.mjs:322);
      - the image's start path (Dockerfile:87 via start:network);
      - the install harness's direct start (tests/integration/test_full_install_update_process.py:867).
    - It leaves Next's standard `next start` path. What that costs cannot be checked read-only.
    - Governance: T-0083 ruling 2 must be amended, and the start scripts become a new public contract, so an ADR.
    
    Tier R2 (Dockerfile path, auth surface). About +40 lines plus doc edits.
- **Recommended:** Keep per-caller keys and record the gap — Next fills X-Forwarded-For only when the caller did not (base-server.js:577). So no key the proxy can see both separates callers and resists spoofing. Only a wrapper server closes the lockout, and it changes two npm scripts and the deploy start path. A shared bucket trades a targeted lockout for one anyone can trigger. Per-caller keys keep I5 for honest callers, the lockout is capped at 15 s windows, and rotation is harmless against a minted 256-bit token. The residual risk for a short PS_AUTH_TOKEN is better met by recording it and warning at boot than by removing isolation.
- **Sceptic:** Checked: re-traced Next's call path (resolve-routes.js:357-364 into base-server.js handleRequestImpl, where the header is filled at :577 before the middleware branch at :938). Read auth-throttle.ts, proxy.ts:228-324, the T-0083 test file and auth-token.ts. The mechanism, the ruling and the operator flag stand. Changed: 1. 'A 256-bit token makes rotation harmless' holds only for a minted token. PS_AUTH_TOKEN takes any string (auth-token.ts:66-67), so rotation defeats the throttle for a short container token; options 1 and 3 now say so. 2. 'No option closes the lockout' was wrong: a wrapper server that owns the socket can. Added it as a fourth option with its cost to two npm scripts, ps-deploy.mjs:322 and Dockerfile:87. 3. The auth-throttle.ts:33-35 comment claiming loopback collapses to 'local' is false under next start; correcting it is now part of option 1. 4. The docs recommend 'a reverse proxy' without naming one, so the claim about an appending proxy is scoped. 5. Test line ranges corrected to :232-240 and :276-295. The recommendation is kept, with a reason that now rests on the evidence rather than line count.
- **Ruling:** Keep per-caller keys and record the gap, as recommended — Daniel Parke (operator), 2026-09-12.

#### critic-03a · The boot log prints the full sign-in URL, token included, on every start

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · **needs an ADR** · theme B
- **Batch:** security-defects
- **Now:** - The line: src/instrumentation.ts:28-33 prints `[auth] Open PatterStage at http://127.0.0.1:${port}/?${TOKEN_QUERY_PARAM}=${token}` on every boot while auth is on.
  - It prints an env-supplied token too: ensureAuthToken returns readAuthToken() first (src/lib/api/auth-token.ts:90-91), which returns PS_AUTH_TOKEN when it is set (:66-67).
  - What it exposes: that raw token is also the value of the one-year ps_session cookie (src/proxy.ts:285-289), and docs/SECURITY.md:65 calls it root on the host.
  - Promised at every start:
    - src/proxy.ts:173 and :201
    - docs/SECURITY.md:58 ('at every start')
    - docs/running/troubleshooting.md:27 ('restarting the server prints the full URL')
    - ops/runbooks/deploy.md:38-41
  - Promised on first boot only:
    - README.md:69-73
    - docs/start-here/install.md:75-80
    - docs/start-here/first-hour.md:100-101
    - docs/contributing/repo-guide.md:69-70
    - scripts/bootstrap/setup.sh:316-317
  - Where it lands:
    - ps-runtime.log under HERMES_HOME/logs (scripts/tooling/ps-deploy.mjs:70-79). It is emptied at each deploy start (:315); :322 spawns next start, and scripts/tooling/_platform.mjs:17-20 sends a detached child's output to the log file it is given. The Logs page reads getAgentWorkspace().logs (src/app/api/logs/route.ts:33): the Hermes root + /logs (src/modules/hermes/lib/agent-runtime.ts:14-16, paths.ts:45), which defaults to the same directory. The page sits behind the token.
    - `docker logs`, since the image's CMD is start:network (Dockerfile:87).
    - The repo ships no PatterStage service unit. install.sh:354 and :394 mention systemd only for Hindsight's native install.
  - Nothing parses the line: `git grep -nE 'Open PatterStage at|ensureAuthToken' -- tests` finds nothing.
    - The harnesses take the token from env or the file: playwright.config.ts:93, tests/scripts/docker-deploy-api-smoke.sh:51, tests/integration/test_full_install_update_process.py:537.
    - tests/unit/proxy-auth.test.ts:205-208 pins that the 401 page never shows the token.
    - :202 pins the word 'restart' on the local 401 page. The delete-and-restart sentence at proxy.ts:203 also satisfies it.
  - Standard: RUL-SEC-003 (org/RULINGS.json:327) sets level 2 on session-auth. ASVS 4.0.3 V7.1.1 (level 2, outside the repo) allows session tokens in logs only in hashed form.
  - The file-permission half needs no ruling; it is verified row critic-03b.
- **Question:** Should the server keep writing the full sign-in URL, token included, into its log every time it starts?
- **Options:**
  - **Keep printing it on every start** — No code change beyond critic-03b, which makes the log file readable only by its owner. docker logs, any service manager log the operator sets up, and a pasted log still carry a root-equivalent token. A session-auth logging exclusion is recorded under RUL-SEC-003, which is an ADR (org/policy.json:131). Removes nothing. About 0 lines plus the exclusion record.
  - **Print it only on the start that creates the token** — - Code: ensureAuthToken (auth-token.ts:89, an exported signature) reports whether it just created the file. instrumentation.ts prints the URL only then; later starts print the file path and a `cat` hint.
    - Env token: one supplied through PS_AUTH_TOKEN is not echoed at all. That is a change, because it is echoed today.
    - Still works: every first-boot promise (README.md:69-73, install.md:75-80, first-hour.md:100-101, repo-guide.md:69-70, setup.sh:316-317).
    - Changes:
      - The every-start wording at proxy.ts:173 and :201, SECURITY.md:58, troubleshooting.md:27 and ops/runbooks/deploy.md:38-41 becomes 'read the token file, or delete it and restart'.
      - The remote 401 hint 'read the sign-in URL off that server's log' (proxy.ts:189) holds only for the first start.
    - Docker: a container recreated on a kept volume (docker-compose.yml:29) prints no URL. The operator reads the token file with `docker exec`, as tests/scripts/docker-deploy-api-smoke.sh:51 already does.
    - Tests: a new unit case for created versus existing token. proxy-auth.test.ts:202 keeps passing while proxy.ts:203 stays.
    
    A narrower exclusion still covers the one start that prints it. Tier R2 (instrumentation.ts, auth-token.ts, proxy.ts, ops/runbooks/). About +15 code lines and about 8 doc lines in 7 files.
  - **Never print the token** — - Code: instrumentation.ts prints the token file path and a sign-in URL with a placeholder instead of the token.
    - Installer: setup.sh:316-317 runs before the first boot mints the file (it says 'The server mints one on first boot'). The installer would have to mint the 0600 file itself, duplicating ensureAuthToken in shell, or tell the user to `cat` the file after the first start.
    - First-run docs: README.md:69-73, install.md:75-80, first-hour.md:100-101 and repo-guide.md:69-70 become 'read the file'.
    - Remote operators: proxy.ts:189's hint loses the log route, so they must read the file on the host.
    - Meets the ASVS logging rule, so no exclusion is needed.
    
    Tier R2 (also scripts/bootstrap/). About +10 code lines and about 20 doc lines in 10 files.
- **Recommended:** Print it only on the start that creates the token — It keeps every first-run step the docs promise, and it stops container logs and pasted logs collecting a fresh copy of a year-long, root-equivalent token on every restart. The only recovery step that changes is one the local 401 page already gives: read the token file (proxy.ts:186-188), or delete it and restart (:203). Never printing would also break the installer's own first-run message, which runs before the token exists.
- **Removes:** The documented reprint of the sign-in URL on every restart: src/proxy.ts:173 and :201, docs/SECURITY.md:58, docs/running/troubleshooting.md:27 and ops/runbooks/deploy.md:38-41. Also the boot echo of a token supplied through PS_AUTH_TOKEN (instrumentation.ts:28-33 via auth-token.ts:66-67 and :90-91). The first-run URL stays.
- **Sceptic:** Checked: read instrumentation.ts and auth-token.ts:66-107. Found every doc and script line that promises the [auth] line with git grep. Read ps-deploy.mjs:70-80 and :315-322, followed the Logs page root through agent-runtime.ts:14-16, and grepped tests for pins. The finding, the ownership and the recommendation stand. Changed: 1. The promises split into five every-start places and five first-boot places. Option 2 touches only the every-start set, so its doc cost fell to about 8 lines in 7 files. 2. Option 2's 'a PS_AUTH_TOKEN token is never echoed' removes current behaviour, because the env token is printed today (auth-token.ts:66-67, :90-91). It is now in removes. 3. Option 3 said setup.sh:316-317 could read the file. It cannot: setup runs before the first boot mints it. 4. The repo ships no PatterStage systemd unit; the systemd mentions are Hindsight's. 5. Added the Docker case, where a recreated container on a kept volume prints no URL, and noted that proxy-auth.test.ts:202 keeps passing.
- **Ruling:** Print it only on the start that creates the token, as recommended — Daniel Parke (operator), 2026-09-12.

#### critic-04 · No response forbids framing, so a page on another port of the same host can frame the signed-in app

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme B
- **Batch:** security-defects
- **Now:** - No framing header anywhere: `git grep -nIE 'X-Frame-Options|frame-ancestors|Content-Security-Policy'` prints nothing (exit 1). next.config.ts:69 has only `async redirects()`.
  - Cookie and origin check: src/proxy.ts:287 sets sameSite 'lax', and isSameOrigin at :215-217 accepts Sec-Fetch-Site same-origin, which clicks inside a same-origin frame send.
  - HTML sinks: `git grep -n dangerouslySetInnerHTML -- src | wc -l` gives 9.
  - No embedding use:
    - A case-insensitive `git grep -nIiE 'iframe|frameElement|window\.top|window\.parent' -- src docs scripts public README.md ops` hits only src/app/help/[[...slug]]/page.tsx:80 ('Not an iframe') and src/hooks/useDialogA11y.ts:42, where iframe is an entry in a focusable-element selector list.
    - A grep for Home Assistant, Homarr, Dashy, Heimdall and Organizr hits only docs/guides/tools.md:62, which is Hermes' toolset, not embedding.
  - Test pins: tests/unit/b3-old-paths-redirect.test.ts:8 imports next.config and asserts only redirects (:49, :54, :71). None of the five suites that name next.config mention headers, so a headers() entry breaks no pin.
  - Standard: the repo names no ASVS version (only org/RULINGS.json:327). RUL-SEC-003 sets level 1 everywhere and level 2 on the provider-key path, whose credential controls a frame could click. ASVS 4.0.3 V14.4.7 (outside the repo) puts anti-framing at level 1.
  - Not checked: whether next.config headers() also reach responses the proxy builds itself (the 401 page, 429, redirects). That needs a running server; the signed-in pages are what matter.
- **Question:** Should every PatterStage page refuse to be shown inside a frame on another web page?
- **Options:**
  - **Forbid framing everywhere** — - A headers() entry in next.config.ts sends X-Frame-Options: DENY and Content-Security-Policy: frame-ancestors 'none' on every path.
    - No PatterStage page frames another of its own (no iframe in src), so DENY loses nothing that SAMEORIGIN would keep.
    - Add a unit test on the headers() list, in the style of b3-old-paths-redirect.test.ts:8, and a line in docs/SECURITY.md.
    
    Removes the undocumented ability to embed PatterStage in another page. Tier R1 (R2 if done in src/proxy.ts instead). About +25 lines including the test.
  - **Allow only origins the operator lists** — The same headers, but frame-ancestors is built from a new env var (for example PS_FRAME_ANCESTORS, default 'none'). X-Frame-Options is dropped when the var is set, because it cannot express a list. Adds a docs/running/env-reference.md row. The env var is a new public contract, so it needs an ADR. Tier R2. About +35 lines.
  - **Leave framing allowed** — No change. SameSite=Lax is decided by site, not port. A page served on another port of the same host or IP counts as same-site, receives the cookie inside a frame, and can trick clicks on the deploy, script and credential controls. A cross-site frame gets no Lax cookie. A per-surface exclusion from RUL-SEC-003 is recorded, which is an ADR. 0 lines.
- **Recommended:** Forbid framing everywhere — No code, test or document embeds PatterStage, so DENY removes nothing documented. Refusing to be framed is a level 1 item in ASVS 4.0.3, and the credential controls sit on a surface RUL-SEC-003 already holds to level 2. The bar applies whatever level a later ASVS version assigns. If the operator does frame it at home, the allow-list option is the fallback.
- **Removes:** Undocumented: showing PatterStage inside an iframe on another page.
- **Sceptic:** Checked: re-ran the header grep (exit 1), next.config.ts:69, the sink count (9), a case-insensitive iframe grep, and the five suites that import next.config. The finding, options and recommendation stand. Changed: 1. Ownership is thin. The recommended option meets an already-ruled bar and removes nothing documented, so the operator is asked for a fact; only leaving framing allowed truly needs them. The reason now says so. 2. The 'level 1' argument depended on an ASVS version the repo never names, so the reason now also rests on the level 2 provider-key surface. 3. The iframe grep also hits useDialogA11y.ts:42, which is a selector list, not embedding. 4. No test pins next.config's shape beyond redirects. 5. Whether next.config headers reach responses the proxy builds is unverified read-only.
- **Ruling:** Forbid framing everywhere, as recommended — Daniel Parke (operator), 2026-09-12.

#### critic-05a · The optional deploy signature leaves out the request body, so a captured signed request can be replayed with another action or branch

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme B
- **Batch:** security-defects
- **Now:** - What is signed: src/lib/api/api-auth.ts:55 signs `${request.method}:${request.nextUrl.pathname}:${ts}`, accepted within ±5 min (:51-53), with no nonce.
  - One caller: `git grep -n requireSignedRequest -- src tests` finds only src/app/api/update/route.ts:102 in src.
    - :105-107 then parse the body and read action.
    - src/lib/update-handlers/deploy-actions.ts:56-57 (rebuild) and :96-99 (update) run sanitizeGitBranch and verifyDeployBranchOnOrigin on body.branch.
  - Documented format: docs/reference/api.md:261 ('over METHOD:path:ts'). docs/running/env-reference.md:70 names the headers and the window but not the format.
  - No signer in the repo: the draft's grep (`createHmac|x-ps-signature` over scripts, src/hooks, src/components, src/lib, tests/integration, tests/scripts, ops and docs) returns the two doc lines plus api-auth.ts:1, :47 and :56, which is the verifier itself. Nothing creates a signature.
  - The app's own buttons cannot sign: src/hooks/useVersionFooter.ts:224-227 posts with only Content-Type, and src/components/system/DeployControls.tsx:7 says that hook owns every call. With the secret set, Update, Rebuild and Restart answer 401 'Missing signature headers' (api-auth.ts:48-49). env-reference.md:70 does not say so.
  - What a replay buys: the replayer must already hold the bearer token or cookie (src/proxy.ts:296-313). With it they can already save a script and run it, with no signature:
    - PUT /api/scripts/[name] upserts contents (src/app/api/scripts/[name]/route.ts:2-4, :33).
    - POST /api/scripts/run runs one (src/app/api/scripts/run/route.ts:2-3, :29).
    - proxy.ts:52-56 and docs/SECURITY.md:65 treat the token as a shell on the host.
- **Question:** Should the optional PS_REQUEST_SIGNING_SECRET signature also cover the request body (the action and branch), even though that changes the documented format any existing signing script uses, or should the docs just say what it does not cover?
- **Options:**
  - **Sign the body too** — - The signed string becomes METHOD:path:ts:sha256(body). The route reads the body text once, verifies it, then parses it; update/route.ts:106 reads request.json() today.
    - docs/reference/api.md:261 and env-reference.md:70 are updated, and a replay-with-changed-body test lands after critic-05c.
    - An outside script that signs the old way gets 401 'Invalid signature' until it is updated.
    - The in-app buttons still cannot sign.
    - The new format is a new public contract, so an ADR (org/policy.json:131).
    
    Removes the METHOD:path:ts format. Tier R2 (api-auth.ts). About +12 lines.
  - **Keep the format and document the gap** — Two sentences in docs/reference/api.md:261 and docs/running/env-reference.md:70.
    - First: the signature does not cover the body, so someone holding the token and a captured request can switch the action, or the branch to another one already on origin, within five minutes.
    - Second: the in-app Update, Rebuild and Restart buttons do not sign, so setting the secret turns them off.
    
    Removes nothing. Tier R0 (docs, 2 files). About +3 lines.
  - **Accept both formats for a transition** — Verify the body-hash format when a version header is present (for example x-ps-signature-version: 2), otherwise the old one. A later ruling retires the old format. The new header is a new public contract, so an ADR. Needs critic-05c first. Tier R2. About +20 lines.
- **Recommended:** Keep the format and document the gap — The gap helps only someone who already holds the token. With the token they can save and run a host script without any signature (scripts/[name]/route.ts:2-4, scripts/run/route.ts:2-3). Signing the body would break any outside signer to guard against a caller who has no need of /api/update. What is wrong today is the docs: they read as if the signature covers the request, and they do not say the secret turns off the app's own deploy buttons.
- **Sceptic:** Checked: read api-auth.ts:43-63, the single requireSignedRequest caller, deploy-actions.ts, api.md:261, env-reference.md:70, useVersionFooter.ts:224-227, and the scripts write and run routes. The gap and the in-app buttons observation stand. Changed: 1. The draft's grep, said to return 'only those two doc lines', also returns api-auth.ts:1, :47 and :56. 2. env-reference.md:70 does not document the payload format; only api.md:261 does. 3. The recommendation moves to documenting the gap. Anyone able to replay already holds the token, and the token alone can save and run a host script (proxy.ts:52-56), so changing a documented contract buys nothing. 4. Option 1 is a new public contract under policy.json:131 and needs an ADR. 5. Tier floor, removes and depends_on now follow the docs-only recommendation. If the operator picks option 1 or 3, it depends on critic-05c, tiers R2 and needs an ADR.
- **Ruling:** Keep the format and document the gap, as recommended — Daniel Parke (operator), 2026-09-12.

#### critic-05b · The x-ch-ts and x-ch-signature header aliases and CH_REQUEST_SIGNING_SECRET

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme B
- **Batch:** dead-code · **after:** critic-05c, cross-cutting-04
- **Now:** - The aliases: src/lib/api/api-auth.ts:44 reads readEnv('PS_REQUEST_SIGNING_SECRET', 'CH_REQUEST_SIGNING_SECRET'), and :46-47 fall back to x-ch-ts and x-ch-signature.
  - Docs:
    - `git grep -nE 'CH_REQUEST_SIGNING|x-ch-' -- docs README.md ops scripts src tests` finds only api-auth.ts and tests/unit/api-auth.test.ts, so no doc names the headers.
    - The env alias is still covered by the general promise at docs/running/env-reference.md:15 that legacy CH_ names are read as fallbacks.
  - Tests: tests/unit/api-auth.test.ts uses only CH_REQUEST_SIGNING_SECRET and x-ch-* (:13, :24, :30, :36, :40). `git grep -nE 'x-ps-ts|x-ps-signature|PS_REQUEST_SIGNING_SECRET' -- tests` finds nothing (exit 1). Retiring the aliases first would delete the only signature coverage.
  - Where the ruling sits: the CH_ alias retirement belongs to cross-cutting-04 and tooling-11 (org/reviews/2026-09-codebase-review.md:332 and :158).
- **Question:** When the CH_ environment aliases are retired, do the x-ch-ts and x-ch-signature request headers go with them?
- **Options:**
  - **Retire with the CH_ aliases** — - In the same change as cross-cutting-04, drop the CH_REQUEST_SIGNING_SECRET argument (api-auth.ts:44) and the two header fallbacks (:46-47): 3 lines edited, net 0.
    - Once critic-05c's x-ps-* cases exist, the CH_ cases at api-auth.test.ts:13-43 are removed.
    - A client still sending x-ch-* gets 401 'Missing signature headers'.
    - Docs: no doc names the headers. The env alias leaves with cross-cutting-04's edit of env-reference.md:15.
    
    Tier R2 (api-auth.ts).
  - **Keep the header aliases after the env aliases go** — The CH_REQUEST_SIGNING_SECRET fallback still goes with cross-cutting-04, but api-auth.ts:46-47 keep accepting x-ch-*. That leaves an undocumented legacy spelling without its env-var twin, and it needs a comment saying why it stays. 0 lines.
- **Recommended:** Retire with the CH_ aliases — The headers are undocumented and come from the same rename as the CH_ env aliases, so a separate ruling for two header names costs more than it saves. The x-ps-* tests land first, so no coverage is lost.
- **Removes:** The CH_REQUEST_SIGNING_SECRET env alias, covered by the general CH_ fallback promise at docs/running/env-reference.md:15, and the x-ch-ts and x-ch-signature request headers (undocumented).
- **Sceptic:** Checked: read api-auth.ts:44-47, ran git grep for CH_REQUEST_SIGNING and x-ch- across docs, src, scripts and tests, grepped tests for the x-ps-* spellings (exit 1), and read index lines :158 and :332. The ownership, recommendation and dependencies stand. Changed: 1. The env alias is documented through env-reference.md:15's general promise that CH_ names are still read, so 'the docs never named them' holds only for the headers. 2. The source change is 3 edited lines, net 0, not -2.
- **Ruling:** Retire with the CH_ aliases, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-06 · Route-level read-only checks guard 17 write handlers the proxy already refuses, and 69 others have none

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme B
- **Batch:** app-routes
- **Now:** - The proxy: src/proxy.ts:238 computes readOnlyRefusal and returns it on all three auth paths (:241, :303, :323). The matcher at :329 skips only _next/static, _next/image and favicon.ico.
  - requireNotReadOnly: `git grep -l 'requireNotReadOnly(' -- src/app/api | wc -l` gives 9 files, one call each. It is defined at src/lib/api/api-auth.ts:83.
  - isReadOnly() on writes, 8 sites:
    - admin/sessions/backfill-status:48
    - cron/hardware:37, :48 and :59
    - scripts/[name]:37 and :54
    - scripts/run:21
    - sessions:94
  - The other isReadOnly() hits are the three documented GET skips (agent/profiles/[id]/toolsets:27, sessions:58 and stats:29; docs/reference/api.md:255) and a comment at missions/route.ts:90.
  - Write handlers: 86 in 67 route files.
    - 57 go through route() (49 files).
    - 26 are plain `export async function` (21 files).
    - 3 are memory/route.ts:85-87's shared unsupportedWriteHandler.
    - 13 of the write files never call route().
  - Contradictions in the tree:
    - cron/hardware/route.ts:24-26 says 'No route in this directory carries either check (T-0048)' above the checks at :37, :48 and :59.
    - The sessions/route.ts:95 message has no remedy, unlike read-only.ts:43-48.
    - tools/route.ts:34-35 puts a guard in front of a 405.
  - Prior statements:
    - api-auth.ts:68-69 calls a route-level call 'redundant'.
    - org/tasks/T-0048.json:37 keeps requireNotReadOnly for endpoints 'not simply a write'. It sits in the task's deferred list; it is not an operator ruling.
    - The counter-precedent: proxy.ts:58-63 and docs/reference/api.md:259 keep the host-write guard on the routes as well, 'so a harness that bypasses the proxy is still not a hole'.
  - Nothing reaches a handler without the proxy: `git grep 'from "@/app/api/' -- src scripts` finds one type import (src/hooks/useLogs.ts:13), and no file says 'use server'.
  - Tests: 20 unit suites set PS_READ_ONLY and name app/api.
    - Several call handlers directly and pin the route-level refusal. tests/unit/b6-backup-route.test.ts:190-198 pins the exact sentence 'PatterStage is in read-only mode: database backups (unset PS_READ_ONLY to allow writes).'. b3-operator-prefs.test.ts:110-114 and missions-read-only-reads.test.ts:103-117 (POST /api/missions and /cancel) pin a 503.
    - b6-backup-route.test.ts:272-290 reads the route's source and asserts its POST contains at least one guard call.
    - The opposite way, b6-credentials-rotate-route.test.ts:331-333 asserts that credentials/[id] contains none.
    - api-auth.test.ts:53-100 tests requireNotReadOnly, and 6 suites mock it by name.
  - requireAuthenticatedHostWrites (7 call sites) is out of scope.
- **Question:** Should read-only mode be enforced only by the proxy, should the routes that run things on the host keep a second check of their own, or should every write handler check it itself?
- **Options:**
  - **Proxy only** — - Delete the 17 route-level checks (9 requireNotReadOnly calls and 8 isReadOnly() write guards), and requireNotReadOnly itself (api-auth.ts:83, an exported function).
    - Keep the three documented GET skips and the 7 requireAuthenticatedHostWrites calls, and correct the cron/hardware header.
    - Tests: the direct-handler pins at b6-backup-route.test.ts:190-198 and :272-290, b3-operator-prefs.test.ts:110-114 and missions-read-only-reads.test.ts:103-117 are rewritten as proxy() assertions; the ruling must name them. api-auth.test.ts:53-100 and 6 dead mock keys are deleted.
    - Over HTTP nothing changes. A direct handler call, or a harness that skips the proxy, also loses the refusal on the host-side script and crontab routes. That is the case proxy.ts:58-63 deliberately guards for auth-none.
    
    Tier R2 (api-auth.ts). About -45 source lines; test lines roughly even across up to 20 suites.
  - **Proxy only, host-side routes keep theirs** — - Delete the 11 checks outside HOST_SIDE_EFFECT_PREFIXES (proxy.ts:65): the 9 requireNotReadOnly calls, backfill-status:48 and sessions:94. Delete requireNotReadOnly itself once it is unused.
    - Keep the 6 on cron/hardware and the scripts routes, beside their requireAuthenticatedHostWrites calls, and rewrite the cron/hardware header to say both are deliberate.
    - Tests: the same backup, prefs and missions pins move, because those routes are not host-side. api-auth.test.ts:53-100 goes with the function.
    - Over HTTP nothing changes. The three routes whose writes run on the host keep a guard that holds without the proxy, and keep their resource-specific 503 wording.
    
    Tier R2 (api-auth.ts). About -30 source lines.
  - **Check on every write** — - Add a route() option that refuses writes under read-only by default. The 57 wrapped handlers get it through the wrapper.
    - The 26 plain handlers in 21 files, and memory's 3 shared handlers, get manual checks or are converted.
    - check-read-only-guards.mjs is extended to require the check on every write, which is a lint-policy change.
    - b6-credentials-rotate-route.test.ts:331-333 is inverted.
    
    Tier R2 (shared api-route interface). About +80 lines.
  - **Leave the split, fix the contradictions** — - Correct the cron/hardware header.
    - Give sessions/route.ts:95 the remedy through readOnlyMessage().
    - Remove the guard in front of the 405 at tools/route.ts:34-35. tools-auth.test.ts asserts no 503, and method-not-allowed-says-allow.test.ts:30 mocks the guard to null.
    
    The 17-of-86 split stays. Tier R1. About -3 lines.
- **Recommended:** Proxy only, host-side routes keep theirs — The tree states two rules: one read-only boundary (T-0048, api-auth.ts:68-69, api.md:255), and a second guard on the routes whose writes run on the host (proxy.ts:58-63, api.md:259). This option honours both. It deletes the 11 checks that cannot fire over HTTP and keeps the 6 that match the host-write guard beside them, so it weakens less of what policy.json:132 escalates. Its test cost is about the same as deleting all 17, because the pinned suites (backup, prefs, missions) cover routes both options change.
- **Sceptic:** Checked: re-ran every count (9 files; 8 write guards plus 3 GET skips; 86 writes) and split the writes by route() use. Read the contradiction sites, T-0048.json:37, check-read-only-guards.mjs and the 503 assertions in the 20 suites. The counts and contradictions stand. Changed: 1. 'The 23 route files that do not use route()' was wrong: there are 26 plain handlers in 21 files, 13 files with no route() at all, plus memory's 3 shared handlers. 2. Hidden test cost: b6-backup-route.test.ts:190-198 and :272-290, b3-operator-prefs.test.ts:110-114 and missions-read-only-reads.test.ts:103-117 pin the route-level refusal and must be rewritten under the ruling. b6-credentials-rotate-route.test.ts:331-333 pins the opposite. 3. Ownership now rests on policy.json:132 ('weakening any check'); T-0048.json:37 is a deferral note, not a ruling. 4. The recommendation moves to 'host-side routes keep theirs'. It matches proxy.ts:58-63's stated reason for a second guard, deletes 11 checks instead of 17, and costs about the same in tests. The draft had named that precedent and then recommended against it without saying why.
- **Ruling:** Proxy only, host-side routes keep theirs, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-04 · Node 20 is past end-of-life but still pinned in CI, Docker, engines and the install checks

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme B
- **Batch:** tooling-ci
- **Now:** - This machine: `node -v` prints v24.15.0.
  - Pins, 13 in all:
    - `grep -n node-version .github/workflows/*.yml` finds '20' at ci.yml:71, 140, 188, 208, 268 and 407, and docs-pages.yml:14.
    - `git grep -nE 'FROM node:'` finds node:20-bookworm-slim at Dockerfile:2, 10 and 23, docker/TestHarness.dockerfile:3, mock-hermes/Dockerfile:5 and mock-llm/Dockerfile:3.
  - package.json: engines node '>=20' (:6-7) and @types/node ^20.19.43 (:79). .github/dependabot.yml:14-16 ignores @types/node majors ('Stay aligned with CI Node 20').
  - The minimum appears in more places than the draft listed. `git grep -nIiE 'node(\.js)? ?(v)?20\b|node 20|>= ?20\b|node20|setup_20'` (reviews and lockfile excluded) finds:
    - README.md:28 ('What CI builds against, and what engines.node requires')
    - docs/start-here/install.md:21
    - docs/running/deploy.md:101, not in the draft
    - docs/contributing/testing.md:162
    - scripts/bootstrap/install.sh:32, 85, 141 and 143-145
    - scripts/bootstrap/setup.sh:12, 43 and 46-48
    - scripts/bootstrap/setup.mjs:84-86, not in the draft, with its own `major < 20` check
    - org/plans/2026-08-consolidation.md:160 and org/tasks/T-0007.json:3, which are records and are not edited.
  - Install harness: it has no node setup step (ci.yml:352) and runs in node:20 containers from docker/TestHarness.dockerfile:3. The Python harness's node calls (:564, :755, :780, :867) use that image's Node.
  - better-sqlite3 12.11.1:
    - Its engines field is '20.x || 22.x || 23.x || 24.x || 25.x || 26.x', and it installs with `prebuild-install || node-gyp rebuild --release`.
    - `node -e` opened an in-memory database on v24.15.0 (ABI 137).
    - Dockerfile:4-6 and :12-14 install python3, make and g++, so a source build works if no prebuilt binary is found.
    - Whether prebuilt linux-x64 binaries exist for 22 and 24 cannot be checked offline.
  - Other engines, read with node -e over node_modules: next 16.2.9 '>=20.9.0', jest 30.3.0 '^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0', knip 6.16.1 '^20.19.0 || >=22.12.0', eslint 9.39.4 '^18.18.0 || ^20.9.0 || >=21.1.0', @playwright/test 1.61.0 '>=18'. None excludes 22 or 24.
  - No Node-20-only code: `git grep -nE "assert ?\{ ?type|from ['\"]punycode['\"]|require\(['\"]punycode|url\.parse\(|new Buffer\("` over src, scripts, tests, the three mock servers and test-harness finds nothing (exit 1).
  - Node 22 in the repo: the only one is the Hermes image the bench-gateway harness builds on (test-harness/bench-gateway.Dockerfile:11, :16), which tooling-02 proposes to delete. test-harness/hermes-seed.Dockerfile:5 is alpine, and no doc says Hermes brings Node to a host.
  - The support dates come from the published Node schedule, not the repo.
- **Question:** Which Node.js version should PatterStage build on, and which should it require as the minimum, now that Node 20 is out of support?
- **Options:**
  - **Build on 24, require 22 or newer** — - Pins: the 7 workflow pins and 6 FROM lines move to 24.
    - Minimum: engines '>=22' and @types/node ^22, which rewrites package-lock.json through npm install. install.sh, setup.sh and setup.mjs refuse anything below 22; setup.mjs drops out if tooling-03 deletes it first.
    - Docs: README.md:28, install.md:21, deploy.md:101, testing.md:162 and the dependabot comment.
    - CI: a Node 22 leg is added to one job, so README.md:28's 'what CI builds against' stays true. That means more CI minutes and more workflow config (R2).
    
    Removes support for Node 20 hosts. The minimum must rise again before 22's support ends on 2027-04-30. Tier R2. About +8 net lines, about 25 edited in 15 files plus the lockfile.
  - **Node 24 everywhere, require 24** — The same pin moves, but engines '>=24', @types/node ^24, installer checks below 24, and docs saying 24. CI, Docker and the operator's machine all match, with support until 2028-04-30 and no extra CI leg. Removes support for Node 20 and Node 22 hosts; the repo cannot show whether any install runs 22. Tier R2. About 0 net lines, about 25 edited in 15 files plus the lockfile.
  - **Node 22 everywhere, require 22** — Pins and minimum move to 22. Removes Node 20 support. CI and Docker still differ from the operator's v24.15.0, and a second migration is due by 2027-04-30. Tier R2. About 0 net lines, about 25 edited in 15 files plus the lockfile.
  - **Stay on Node 20** — No change. CI, the production image and the install harness keep building on a runtime with no security fixes since 2026-04-30, and CI keeps testing a different runtime from the one the operator develops on. 0 lines.
- **Recommended:** Build on 24, require 22 or newer — Every dependency declares both 22 and 24, better-sqlite3 already loads on 24 here, and nothing in the tree needs Node 20 (the syntax grep is empty). Building on 24 matches the operator's own runtime and has the longest support. A minimum of 22 removes only the version that is actually out of support, and the 22 leg keeps README's promise true. The draft's reason, hosts whose Node came with Hermes, has no support in the repo, since the only Node 22 is a test-harness image. If the operator knows no install runs 22, 'Node 24 everywhere' is simpler: no extra CI leg and no second minimum bump in 2027.
- **Removes:** Documented support for Node.js 20: engines '>=20' (package.json:6-7), README.md:28, docs/start-here/install.md:21, docs/running/deploy.md:101, and the 20+ checks in scripts/bootstrap/install.sh, setup.sh and setup.mjs.
- **Sceptic:** Checked: re-ran both pin greps (13) and a wider Node 20 grep, read the dependency engines with node -e, loaded better-sqlite3 on v24.15.0, ran the Node-20-only syntax grep, and read the Hermes Dockerfiles. The pins, ownership, tier and recommended option stand. Changed: 1. Two more minimum sites, scripts/bootstrap/setup.mjs:84-86 and docs/running/deploy.md:101, are now in the consequences and removes. setup.mjs also interacts with tooling-03. 2. jest's engines string was truncated. 3. The reason 'hosts whose Node came with Hermes' had no support: the only Node 22 is the bench-gateway harness image, which tooling-02 would delete. The why and option 2's consequence are rewritten. 4. Moving @types/node rewrites the lockfile through npm install, and the edit count is 15 files plus the lockfile.
- **Ruling:** Build on 24, require 22 or newer, as recommended — Daniel Parke (operator), 2026-09-12.

### Theme C · Legacy rename aliases, platform scripts and env handling

1. POLICY-aliases settles most of the theme. Items that follow it: cross-cutting-04a/b, app-21, hooks-25, critic-08 and tooling-11a. lib-domains-14a keeps file-name discovery longer, and tooling-11d follows 14a.
2. No release has shipped: `git tag -l` is empty and package.json is 0.1.0. origin/main (2026-06-02) is still Control Hub; the PatterStage names exist only on dev, since 2026-06-20.
3. Installs follow dev (scripts/bootstrap/install.sh:45 on both branches). Main's runner is sourced into memory: it resets, builds, runs db:migrate and restarts (origin/main:scripts/lib/ch-deploy-impl.sh:394-469), with no rename step and no re-exec. So a main-era install boots new code on an unmigrated .env.local. If aliases dropped at v1.0.0, a manually set CH_ENABLE_DEPLOY_API would also stop opening the in-app Update that runs renameMigrate.
4. renameMigrate rewrites only ^CH_ (ps-deploy.mjs:230-231). CONTROL_HUB_DATA_DIR (on main's .env.example), CONTROL_HUB_LLM_API and AGENT_HOME never migrate for anyone, so the warning and the tripwire must name them.
5. Two aliases fail open when dropped: CH_READ_ONLY and CH_REQUEST_SIGNING_SECRET.
6. setup copies hardware scripts only when absent (setup.sh:158-165; main: origin/main setup.sh:139-144), and crontab lines must use those copies. Repo-side deletions of shims, .sh twins and shell alias chains therefore reach fresh installs only, and installed copies keep working. This refutes tooling-11a's 'warn now' reason and tooling-10b's crontab reason.
7. Build ordering defeats the automatic DB rename if legacy discovery is removed. On a main-era default install (INSTALL_DIR ~/control-hub), prebuild-db.mjs opens patterstage.db in the data dir during the build (ps-deploy.mjs:416), before renameMigrate (:421), which then refuses (:210). That is why lib-domains-14a keeps discovery.
8. cross-cutting-08's recommendation is reversed. The deploy runner inherits the app's already-loaded env (deploy-spawn.ts:41) and passes it to next start (ps-deploy.mjs:323), so its file-wins rule is what applies .env.local edits on in-app Restart. Plausible defect: _env-local.mjs keeps quote characters and hands them to the restarted server.
9. Possible defect outside this theme (unverifiable read-only): @next/env sets __NEXT_PROCESSED_ENV in the server's process.env, and a child next start that inherits it skips .env files. Non-whitelisted keys edited in .env.local (e.g. HERMES_GATEWAY_URL) may therefore not apply after in-app Restart. Verify by editing one and clicking Restart.
10. ps-rename-migrate.sh is a function library whose sourcer is gone; running it does nothing. It is dead code, not a user command.
11. The _platform.mjs Windows branches belong to development: they serve test:restart-recovery and boot-smoke. Only ps-deploy.mjs:181,192,361 and ps-system-report.mjs:22 are deploy-only.
12. The release plan is operator-approved (header :5-6). Its post-1.0 deferrals of 'deleting setup.mjs or setup.sh' (:828) and 'moving logs out of the agent's home' (:827) are rulings.
13. Doc drift found:
   - data-storage.md:58-59 cite a dead page path.
   - data-storage.md:117-119 wrongly says only the ps.sessions.* keys had predecessors (main's ch-last-mission-category was dropped in 01227cbe).
   - data-storage.md:31 and deploy.md:39 describe ps-rename-migrate.sh as usable.
   - install.ps1 names a missing docs path.
14. Count corrections:
   - Root alias lines are 8 (total 264), and there are 13 env aliases.
   - control-hub.db appears in 9 test files.
   - app-21's main file count is 6.
   - Batch-test references are 118 by stem, 63 by full filename.
15. Test prerequisites before any retirement are verified rows: x-ps signing coverage, and moving four read-only tests to PS_ while keeping boot-says:49-53 as the alias test. critic-08 adds update_preserves_user_data to CI.
16. Unverifiable read-only:
   - `gh release list`.
   - Real install counts.
   - Whether setup.sh runs under Git Bash.
   - Whether throwing in instrumentation register() stops next start.
   - `python3 tests/integration/test_full_install_update_process.py --profile smoke --skip-http --scenarios update_preserves_user_data` (needs Docker).
   - The quote and __NEXT_PROCESSED_ENV restart behaviours (need a running server).
   - The jest impact of moving readEnv (`npx jest` writes cache).

#### POLICY-aliases · Retirement policy for pre-rename Control Hub names

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · **needs an ADR** · theme C
- **Batch:** closing
- **Now:** `git tag -l` is empty and package.json is 0.1.0 on both branches. origin/main 9b786b76 (2026-06-02) is the merge-base and 737 commits behind (`git rev-list --count origin/main..HEAD`). It is still Control Hub: origin/main:src/lib/paths.ts:15 reads CH_DATA_DIR||CONTROL_HUB_DATA_DIR, and origin/main:src/lib/api-auth.ts:36-39 reads CH_REQUEST_SIGNING_SECRET and x-ch-*. The PS_ names landed 2026-06-20 (a2c8a690, 0a370f71, 4e60055b, 5a233d55). Installs track dev: BRANCH defaults to dev at scripts/bootstrap/install.sh:45 on both branches (not a root install.sh), and so do update-handlers/shared.ts:27 and ps-deploy.mjs:477. Main's old runner is sourced into memory and never re-execs. origin/main:scripts/lib/ch-deploy-impl.sh:394 resets, :411 builds, :417 runs db:migrate and :467-469 restarts, with no rename step. renameMigrate exists only on dev (ps-deploy.mjs:207-240, called at :421) and rewrites only ^CH_ (:230-231). The regex re-run gives src 31, scripts 75, tests 124 (29 files), docs 21, test-harness 5 and root 8 (5 files, including docker-compose.yml:9 CH_URL), for 264 lines. Documented at env-reference.md:15,29,30,80,98,105,142, migration.md:32-62,217 and data-storage.md:108-113. CHANGELOG.md has a single heading, [Unreleased] (:9). No alias deprecation warning exists: instrumentation.ts prints only [config] (:45) and [paths] (:55).
- **Question:** When should PatterStage stop accepting its pre-rename Control Hub names (CH_ and CONTROL_HUB_ env vars, AGENT_HOME, x-ch-* headers, the ch-deploy.status fallback, the ch.sessions.* browser keys, ch-deploy.sh and ch-backup.sh)? File-name discovery is ruled separately in lib-domains-14a.
- **Options:**
  - **Retire before v1.0.0** — The whole list goes in this programme, with a CHANGELOG 'Removed' note and rewrites of env-reference.md, migration.md and data-storage.md. A subset of the 29 test files changes, plus the CI install scenarios. A main-era install updates straight to v1.0.0 through its old runner, which never migrates .env.local, and then boots with its CH_ keys unread. CH_READ_ONLY stops refusing writes. CH_REQUEST_SIGNING_SECRET stops signing (api-auth.ts:45: unset passes). A manually set CH_ENABLE_DEPLOY_API (main's gate, origin/main route.ts:26) no longer opens Update under next start (api-auth.ts:26), so the update that would run renameMigrate must come from the CLI. A non-default CH_DATA_DIR shows an empty app. It also breaks the 'Removed after v1.0' promise at ch-deploy.sh:3. R2, about -200.
  - **Keep through v1.0.0 with a boot warning, retire in the next release** — Nothing is removed now. Add a boot line naming each legacy name that supplied a winning value, and the release that drops it; it can sit beside the [config]/[paths] lines (instrumentation.ts is sensitive). Add a CHANGELOG 'Deprecated' entry and a deprecated-aliases table in env-reference.md. The warning must also name CONTROL_HUB_DATA_DIR, CONTROL_HUB_LLM_API and AGENT_HOME, which renameMigrate never rewrites. Land the test prerequisites. The removal comes after v1.0.0. R2, about +40 now.
  - **Keep indefinitely** — All 264 lines stay. Reword ch-deploy.sh:3, migration.md:34 and data-storage.md:108 to say the names are permanent. R1, about +5.
- **Recommended:** Keep through v1.0.0 with a boot warning, retire in the next release — No release has shipped. A main-era install reaches the first PS_ release through an old runner that never migrates .env.local. Two aliases fail open when dropped, and a third can lock the in-app Update that would migrate them. Three names are never migrated at all.
- **Removes:** Nothing in this programme. After v1.0.0: 13 env aliases, AGENT_HOME, x-ch-ts/x-ch-signature, the ch-deploy.status fallback, the ch.sessions.* migration, ch-deploy.sh and ch-backup.sh. The 13 aliases are the 11 names read in src/scripts, CONTROL_HUB_PORT (setup-hindsight.sh:424) and CH_ALLOWED_DEV_ORIGINS (next.config.ts:9). Documented at env-reference.md:15, migration.md:32-62 and data-storage.md:108-113. control-hub.db and ~/control-hub/data discovery follow lib-domains-14a.
- **Sceptic:** Re-ran the regex: root is 8 lines, not 7, so the total is 264. Corrected the install.sh path to scripts/bootstrap/install.sh:45 and the ps-deploy line to :477. The alias count is 13, not 12. Traced main's runner (ch-deploy-impl.sh:394-469) to confirm it has no rename step and no re-exec. Added two hidden costs: the CH_ENABLE_DEPLOY_API lockout, and that renameMigrate rewrites only ^CH_ (ps-deploy.mjs:230-231), so CONTROL_HUB_* and AGENT_HOME are never migrated. Moved file-name discovery out of 'removes' so it no longer contradicts lib-domains-14a. The recommendation stands.
- **Ruling:** Keep through v1.0.0 with a boot warning, retire in the next release, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-04a · Retire the CH_/CONTROL_HUB_ env aliases and AGENT_HOME

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme C
- **Batch:** closing · **after:** POLICY-aliases, critic-08, test:ps-read-only-cases, cross-cutting-08
- **Now:** `grep -rnoE 'process\.env\.(CH|CONTROL_HUB)_[A-Z_]+|"(CH|CONTROL_HUB)_[A-Z_]+"' src scripts` gives 11 names: CH_DATA_DIR 13, CONTROL_HUB_DATA_DIR 12, the rest 1 each. setup-hindsight.sh:424 reads CONTROL_HUB_PORT with no PS_ input. The readEnv aliases are paths.ts:76,119,137,145, api-auth.ts:22 and read-only.ts:32. Raw || reads are at run-deadline.ts:23, update-handlers/shared.ts:27 and agent-runtime.ts:31. AGENT_HOME is read at agent-runtime.ts:15, home.ts:19, profile-paths.ts:63, ps-deploy.mjs:71 and discover-agents.mjs:21. Ten shell data-dir chains read the aliases, e.g. setup.sh:70,148, ps-db-backup.sh:17 and ps-env.sh:89-99. The loader bridges are _env-local.mjs:32-35 and ps-dotenv-local.sh:26-31. `git grep -l -w <name> origin/main --` finds every name on main except CH_RUN_MAX_MINUTES (bef00ba7, 2026-06-19). Five test lines set CH_READ_ONLY to a value: api-auth.test.ts:77,86,96, boot-says-how-it-is-configured.test.ts:51 and record-event.test.ts:47. boot-says:49-53 is the explicit alias test (T-0053 cites it). missions-read-only-reads.test.ts:60-67 sets both keys. paths-resolver.test.ts:11-55 asserts the chain. setup.sh:158-165 copies hardware scripts only when absent, so installed data-dir copies keep their own alias chains.
- **Question:** When the env aliases are retired, should a leftover CH_, CONTROL_HUB_ or AGENT_HOME variable be ignored silently, or should boot name it and refuse to start for the security ones?
- **Options:**
  - **Retire and ignore leftovers** — Removes the reads, the loader bridge and the .env.example:43 line. CONTROL_HUB_PORT needs a PS_WEB_PORT or PORT input. A leftover CH_READ_ONLY=1 silently turns an install writable. CONTROL_HUB_DATA_DIR, CONTROL_HUB_LLM_API and AGENT_HOME survive renameMigrate, so even migrated installs can lose them. Data-dir script copies keep reading CH_DATA_DIR regardless. Tests and 3 doc pages change. R2, about -150.
  - **Retire with a tripwire** — Same removals, plus a boot check (about 15 lines and a test) that lists any set CH_*, CONTROL_HUB_* or AGENT_HOME with its replacement. It refuses to start when CH_READ_ONLY or CH_REQUEST_SIGNING_SECRET is set without its PS_ twin. The check sees only the app's env, not crontab or shell-script env. Whether throwing from instrumentation register() actually stops next start is unverified. R2, about -135.
  - **Do not retire (POLICY option C)** — No change.
- **Recommended:** Retire with a tripwire — read-only.ts:28 calls CH_READ_ONLY load-bearing, and dropping it silently fails open. The three never-migrated names are the likeliest leftovers on a migrated install.
- **Removes:** CH_DATA_DIR, CONTROL_HUB_DATA_DIR, CH_SCRIPTS_DIR, CH_HARDWARE_LOG_DIR, CH_ENABLE_DEPLOY_API, CH_READ_ONLY, CH_UPDATE_GIT_BRANCH, CH_RUN_MAX_MINUTES, CONTROL_HUB_LLM_API, CONTROL_HUB_PORT, AGENT_HOME, and the documented CH_ to PS_ .env.local bridge (migration.md:46; env-reference.md:15,29,30,80,98). Fresh installs only for the shell chains.
- **Sceptic:** Re-ran the name grep, the main-branch presence check and the test grep. All draft numbers hold. Added that renameMigrate never rewrites CONTROL_HUB_* or AGENT_HOME. Added that installed data-dir script copies are never refreshed (setup.sh:158-165), so shell-side retirement reaches fresh installs only. Added that the tripwire cannot see crontab env and that its refuse-to-start mechanism is unverified; verify with `next start` and CH_READ_ONLY=1 set, which a read-only session cannot run. Also named the explicit alias test and the both-keys loop. Renamed the test prerequisite id to match the new verified row.
- **Ruling:** Retire with a tripwire, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-04b · x-ch-* signing headers and CH_REQUEST_SIGNING_SECRET

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme C
- **Batch:** security-defects · **after:** POLICY-aliases, test:x-ps-signature-coverage, cross-cutting-04a
- **Now:** api-auth.ts:44 reads PS_REQUEST_SIGNING_SECRET then CH_REQUEST_SIGNING_SECRET, :45 returns null when unset, and :46-47 accept x-ps-* or x-ch-*. `git grep -n -E 'x-ps-(ts|signature)' -- tests` and `git grep -l PS_REQUEST_SIGNING_SECRET -- tests` both exit 1. The only signing tests (api-auth.test.ts:23-42) use the CH_ secret and x-ch-* headers. `git grep -n -E 'x-ch-(ts|signature)'` outside api-auth.ts and its test finds nothing, so no in-repo client sends them. origin/main:src/lib/api-auth.ts:36-39 knew only x-ch-*. The docs (api.md:261, env-reference.md:70) name only x-ps-*.
- **Question:** When the aliases retire, should POST /api/update stop accepting x-ch-ts/x-ch-signature and CH_REQUEST_SIGNING_SECRET?
- **Options:**
  - **Retire with the aliases** — When a secret is set, a client sending x-ch-* gets 401 'Missing signature headers', which fails closed. The secret alias is covered by the 04a tripwire. api-auth.test.ts:23-42 moves to PS_. R2, about -3 later.
  - **Keep both aliases indefinitely** — Two header fallbacks and the secret alias stay. R0.
- **Recommended:** Retire with the aliases — The header aliases fail closed and loudly, and no in-repo client uses them. The secret alias fails open, which the tripwire covers.
- **Removes:** The x-ch-ts and x-ch-signature request headers and the CH_REQUEST_SIGNING_SECRET env var on POST /api/update.
- **Sceptic:** Confirmed both empty test greps and :45's unset-passes branch; added that no in-repo client sends x-ch-*. Dropped the 'Retire without new tests' option: it only existed to be ruled out. Moved the test addition into its own verified row at R0, since tests/unit is not a sensitive path. Only the header removal needs the operator.
- **Ruling:** Retire with the aliases, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-21 · CH_ALLOWED_DEV_ORIGINS and CH_PULL_RECONCILE_DISK

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · theme C
- **Batch:** closing · **after:** POLICY-aliases, cross-cutting-04a
- **Now:** next.config.ts:7-9 and pull/route.ts:52. `git grep -nE '\bCH_[A-Z_]+' -- src next.config.ts | wc -l` gives 16. On main, CH_ALLOWED_DEV_ORIGINS is in 6 files, not 5 (`git grep -l -w CH_ALLOWED_DEV_ORIGINS origin/main --`): .env.example, docs/DEPLOY.md, next.config.ts, setup.sh, ch-env.sh and ch-port.sh. CH_PULL_RECONCILE_DISK is in 1. Main's setup wrote CH_ALLOWED_DEV_ORIGINS into every .env.local (origin/main:scripts/lib/ch-port.sh:124) and told users to run `npm run dev` (origin/main:scripts/bootstrap/setup.sh:288). env-reference.md:105 documents CH_PULL_RECONCILE_DISK; no dev doc names CH_ALLOWED_DEV_ORIGINS. No test sets either (`git grep` on tests exits 1). renameMigrate converts both to PS_ (ps-deploy.mjs:230-231). That allowedDevOrigins only affects next dev is Next.js behaviour; config-shared.d.ts:891 only declares the key.
- **Question:** Should the two app-level aliases retire on the POLICY-aliases date with the rest?
- **Options:**
  - **Retire with the rest** — Drop both fallbacks, the env-reference.md:105 alias text and add one CHANGELOG line. Every main-era install still on `npm run dev` that has not had a ps-deploy update loses HMR from LAN origins; this is the default for main-era setups, not an edge case. R2 (documented env var, public contract), -3.
  - **Retire now, ahead of policy** — Same change before v1.0.0, while main-era installs cannot yet have migrated, plus a second deprecation notice. R2, -3.
  - **Keep** — No change.
- **Recommended:** Retire with the rest — Same population and same migration as the other aliases, so one release note covers them.
- **Removes:** CH_ALLOWED_DEV_ORIGINS and CH_PULL_RECONCILE_DISK (env-reference.md:105).
- **Sceptic:** Re-ran the 16-line grep and the main-branch file lists. CH_ALLOWED_DEV_ORIGINS was on 6 main files, not 5. Main's setup wrote it into every .env.local, so the LAN-HMR loss is common, not rare. Stated the R2 basis (documented env var). The dev-only claim for allowedDevOrigins comes from Next docs and is not proven in the tree.
- **Ruling:** Retire with the rest, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-14a · On-disk legacy discovery: control-hub.db and ~/control-hub/data (ch-deploy.status split out)

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme C
- **Batch:** data-layer · **after:** POLICY-aliases, critic-08
- **Now:** src: paths.ts:33, :45 (~/control-hub/data candidate) and :100-104 (a lone legacy DB wins; when both exist, the larger wins). Scripts: prebuild-db.mjs:20-23; ps-deploy.mjs:34, :47, :57 and :208; ps-db-backup.mjs:19,24; ps-disk-report.mjs:13; ps-log-rotate.mjs:16; discover-agents.mjs:17; setup.mjs:59; hermes-registry-import.mjs:294; migrate-to-runtime.mjs:34-35; plus ten shell chains. The draft missed the six .mjs ~/control-hub/data probes. crontab-store.ts:62 maps ps- and ch-. deploy-status.ts:25,35-40 hold the ch-deploy.status fallback, needed only while a main-era first update (old runner) is in flight. Tests: `git grep -l 'control-hub\.db' -- tests` gives 9 files, not about 10 unit suites: 6 unit suites (b6-backup-route, b6-database-backup, catalog-seed, db-upgrade.integration, paths-resolver, u1-shared-mock-factories), tests/helpers/mocks.tsx, the install harness and real-hermes-itest.sh. 16 test files mention control-hub at all. Main's INSTALL_DIR default is ~/control-hub (origin/main:scripts/bootstrap/install.sh:44), so the repo data/ is the data dir. prebuild-db.mjs:23,31 would open a new patterstage.db there during the build (ps-deploy.mjs:416), before renameMigrate (:421), which refuses once both exist (:210). Documented at migration.md:39,45,217 and data-storage.md:27-36,112.
- **Question:** Should the control-hub.db and ~/control-hub/data fallbacks outlive the env aliases, with ch-deploy.status retiring with the aliases?
- **Options:**
  - **Retire with the env aliases** — On a main-era default install, the build's prebuild opens an empty patterstage.db beside control-hub.db before renameMigrate runs; the rename then refuses and the app shows an empty install until the user moves the file by hand. 9 test files and 3 docs change. R2 (prebuild-db.mjs), about -60.
  - **Keep file-name discovery, retire ch-deploy.status with the aliases** — The DB and directory fallbacks stay as documented, and shadowedDataWarning (paths.ts, printed via [paths]) names control-hub.db when it is the file in use. The deploy-status.ts:25-40 fallback goes on the POLICY date. R1, about -5 net.
  - **Retire, but refuse to boot on a lone control-hub.db** — Boot stops with 'run ps-deploy update or rename the file'. prebuild-db.mjs must also stop creating a DB beside a legacy one, or the refusal never triggers. R2, about -45.
- **Recommended:** Keep file-name discovery, retire ch-deploy.status with the aliases — Only this fallback makes data look lost when removed, and the build ordering (prebuild before rename) defeats the automatic migration. data-storage.md:108-112 documents it as load-bearing.
- **Removes:** The ch-deploy.status read fallback (deploy-status.ts:25-40), on the POLICY date.
- **Sceptic:** Re-grepped every control-hub probe: the draft missed six .mjs data-dir probes. The test count is 9 files, not about 10 unit suites. Proved the empty-DB mechanism from main's INSTALL_DIR, prebuild-db.mjs:23,31 and ps-deploy.mjs:416/421/210. Split ch-deploy.status out, since it is only a first-update bridge. Moved the boot warning into paths.ts's existing [paths] output so the keep option stays out of the sensitive instrumentation.ts.
- **Ruling:** Keep file-name discovery, retire ch-deploy.status with the aliases, as recommended — Daniel Parke (operator), 2026-09-12.

#### hooks-25 · useStoredBool ch.sessions.* to ps.sessions.* migration

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme C
- **Batch:** client-hooks · **after:** POLICY-aliases
- **Now:** useStoredBool.ts:26-32 (legacyKey), :40-47 (branch), :53 (dep). The only caller is src/app/results/sessions/page.tsx:44-48,96-97. `git log -S legacyKey -- src/hooks/useStoredBool.ts` gives 74863ce3 (2026-06-23). useStoredBool.test.ts:94 and :107 cover the migration. origin/main:src/app/(main)/sessions/page.tsx:88-89 used the ch.sessions.* keys. The migration is documented at data-storage.md:64-67, not 65-67. data-storage.md:58-59 still cite the dead path src/app/(main)/sessions/page.tsx. Precedent: 01227cbe (2026-06-21) renamed main's 'ch-last-mission-category' (origin/main:src/hooks/useMissionsPage.ts:26) with no migration.
- **Question:** Should the one-time browser migration of the two Sessions toggles be removed when the other aliases retire?
- **Options:**
  - **Remove with the aliases** — Drop legacyKey, the branch, 2 constants, 2 test cases and data-storage.md:64-67. A browser that has not opened Sessions since the rename sees the defaults ('Group by mission' on, 'Hide API noise' off) once. R1, about -45.
  - **Remove now** — Same change in this programme, regardless of POLICY. R1, about -45.
  - **Keep indefinitely** — About 16 lines stay. R0.
- **Recommended:** Remove with the aliases — The loss is two display toggles resetting once; the rename already dropped a ch- key without migration; one release note then covers every pre-rename name.
- **Removes:** The documented ch.sessions.groupByMission/hideApiNoise migration (data-storage.md:64-67) and useStoredBool's legacyKey parameter.
- **Sceptic:** Re-read the hook, the caller, the tests and main's page. Corrected the doc line range to :64-67, flagged the stale path at :58-59, and added the 01227cbe precedent. The recommendation stands.
- **Ruling:** Remove with the aliases, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-21b · Unify browser storage key prefixes

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R0 · theme C
- **Batch:** client-hooks
- **Now:** Keys today: ps.sessions.* (sessions/page.tsx:45,47), ps-last-mission-category (mission-composer-utils.ts:11), patterstage.selected-profile (useSelectedProfile.ts:28), story-weaver-draft (page.tsx:53) and story-weaver-reader-settings (ReaderSettings.tsx:51). New: origin/main:src/hooks/useMissionsPage.ts:26 used 'ch-last-mission-category'. 01227cbe (2026-06-21) renamed it without migration (`git log -S ps-last-mission-category --reverse`), so data-storage.md:117-119 is wrong, and data-storage.md:58-59 cite a dead path. mission-composer-utils exports plain functions (:35, :45).
- **Question:** Should browser storage keys be renamed onto one 'ps.' prefix, or keep their current names with a convention for new keys only?
- **Options:**
  - **Keep keys, set the convention for new keys** — No stored value moves. The doc corrections ship as a verified row. R0, about +3.
  - **Rename with legacyKey migration** — Adds a new useStoredValue<T>, migrates profile, reader settings and draft, and changes callers of the two plain functions, with a test per migration. Each migration adds a legacy key that later needs its own retirement ruling. R1, about +40.
  - **Rename without migration** — The last profile, reader font/theme, last category and any unsaved story draft reset once for every user. R1, about +4.
- **Recommended:** Keep keys, set the convention for new keys — A rename buys naming only, and each migration creates another legacy key to retire.
- **Sceptic:** Confirmed main's key and dated the unmigrated rename to 01227cbe. Found the second doc error (the dead path at :58-59). Split both doc corrections into the verified row docs:data-storage-browser-keys, since they need no ruling.
- **Ruling:** Keep keys, set the convention for new keys, as recommended — Daniel Parke (operator), 2026-09-12.

#### critic-08 · CI install test and the legacy data-dir names

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme C
- **Batch:** tests · **after:** POLICY-aliases
- **Now:** `grep -c` on test_full_install_update_process.py gives CH_DATA_DIR 11, PS_DATA_DIR 3 and control-hub 12, unchanged. The smoke set is fresh, hermes, dashboard, both and update (:90-95; ci.yml:361, job timeout 45 at :328). dashboard (:984-998) and both (:1000-1019) seed via precreate_env_local_ch_data_dir (:452-457) and seed_ch_data_rich (:459-479), and call run_setup with CH_DATA_DIR at :992/:1009. fresh (:958) and update (:1020-1069) use no legacy names. assert_rename_migrated (:714-727) runs only in update_preserves_user_data (:1122-1160). That scenario seeds CH_DATA_DIR and control-hub.db itself (:1130-1137), is release-only (:97-110) and is a valid --scenarios id (:1516). So CI runs renameMigrate in 'update' but never asserts its effect. CI triggers on push and PR to main and dev (ci.yml:29-34).
- **Question:** Should the dashboard and both scenarios move to PS_DATA_DIR and patterstage.db, with update_preserves_user_data added to CI smoke for as long as the aliases are supported?
- **Options:**
  - **Move to PS_ and add the upgrade scenario to smoke** — dashboard/both prove the PS_ path with existing data. update_preserves_user_data joins ci.yml:361; it still seeds CH_DATA_DIR, so legacy setup coverage stays, and it adds the migration assertion. Its runtime inside the 45-minute job is unmeasured. R2, about +10.
  - **Move to PS_ only** — CI loses its only CH_DATA_DIR setup coverage while the alias is supported; this weakens a passing check, which the guardrail rules out. R1, about 0.
  - **Leave until retirement** — CI keeps proving setup honours CH_DATA_DIR, never the PS_ path with existing data or the migration. 0.
- **Recommended:** Move to PS_ and add the upgrade scenario to smoke — The migration protects main-era installs, no gate asserts it today, and the added scenario keeps legacy coverage while dashboard/both gain PS_ coverage.
- **Sceptic:** Mapped every scenario body. The counts are unchanged, so reverified is confirmed rather than moved. Found that the added scenario itself seeds the legacy names, which strengthens option A, and that it is a valid --scenarios id. Flagged option B as weakening a check. Whether it passes under --skip-http in CI cannot be checked read-only: `python3 tests/integration/test_full_install_update_process.py --profile smoke --skip-http --scenarios update_preserves_user_data` needs Docker.
- **Ruling:** Move to PS_ and add the upgrade scenario to smoke, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-11a · ch-deploy.sh and ch-backup.sh entry-point shims

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme C
- **Batch:** tooling-ci · **after:** POLICY-aliases
- **Now:** scripts/application/ch-deploy.sh is 5 lines: :3 says 'Removed after v1.0' and :4 warns. scripts/hardware/ch-backup.sh is 4 lines with no warning. Both were real scripts on main (`git ls-tree -r --name-only origin/main`). References: migration.md:41 and ps-deploy.sh:11; ch-backup.sh is a string fixture in join-crontab-lines.test.ts:57,71, scripts-manager.test.ts:30-33 and scripts-write-validation.test.ts:18-20. Main's setup copied scripts/hardware/*.sh into the data dir (origin/main:scripts/bootstrap/setup.sh:139-144). Main's only cron preset was ch-backup.sh (origin/main:src/lib/hardware-cron.ts:10). Crontab lines must invoke data-dir copies (host-scheduling.md:14), and setup never overwrites (setup.sh:158-165). So main-era crons run main's real ch-backup.sh copy, not the repo shim. ch-deploy.sh is not copied. A main-era first in-app update spawns the main version still on disk (origin/main route.ts:31), so deleting it does not break that update.
- **Question:** Should the two shims be deleted on the POLICY-aliases date, with no interim edit?
- **Options:**
  - **Delete on the POLICY date, no interim warning** — Anyone who habitually runs the repo's ch-deploy.sh, or has a user crontab pointing at the repo path, gets 'No such file'. Data-dir copies of ch-backup.sh are unaffected. migration.md:41 and ps-deploy.sh:11 are edited; the 3 test fixtures are optional. R2, -9.
  - **Warn in ch-backup.sh now, delete on the POLICY date** — The warning reaches almost nobody: cron runs data-dir copies that setup never refreshes. R0 now (+1), R2 later.
  - **Delete now** — Contradicts ch-deploy.sh:3 while the package is at 0.1.0. R2, -9.
  - **Keep** — No change.
- **Recommended:** Delete on the POLICY date, no interim warning — ch-deploy.sh already promises removal after v1.0 and already warns. A warning in the repo copy of ch-backup.sh cannot reach the data-dir copies that cron actually runs.
- **Removes:** scripts/application/ch-deploy.sh and scripts/hardware/ch-backup.sh from the repo (migration.md:41). Installed data-dir copies remain.
- **Sceptic:** Refuted the draft's reason for warning now. Main's setup copied ch-backup.sh into the data dir, crontab lines must use data-dir copies, and setup never refreshes them, so the repo shim is not what cron runs. Changed the recommendation to delete on the POLICY date with no interim edit. Dropped the tooling-10b dependency: the only overlap is the 'six shims' count in host-scheduling.md:14.
- **Ruling:** Delete on the POLICY date, no interim warning, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-11b · ch_data / ch_hermes Compose volume names

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R2 · theme C
- **Batch:** tooling-ci
- **Now:** docker-compose.yml has ch_data at :29 and :46 and PS_DATA_DIR /data/ch at :23. docker-compose.real-hermes.yml has ch_data/ch_hermes at :53, :66-67 and :71-72, and docker-compose.bench-gateway.yml at :23, :34-35 and :38-39. Dockerfile:71-75 creates /data/ch. origin/main:docker-compose.yml:11-19 already had ch_data and CH_DATA_DIR /data/ch. The volumes are documented at docs/reference/runtime-architecture.md:85,182 and deploy.md:114-119. deploy.md:105-112 calls the container a testing tool, and running it yourself 'unsupported rather than forbidden'.
- **Question:** Should the Compose volumes and the /data/ch mount keep their pre-rename names so existing Compose users keep their data?
- **Options:**
  - **Keep names, add a why-comment** — No data moves. R2 (docker-compose*.yml), +3.
  - **Rename with a manual copy step** — Existing users start on an empty volume unless they copy it; deploy.md gains the step. The two test-harness compose files change too. R2, about +10.
- **Recommended:** Keep names, add a why-comment — The names are internal to test-oriented Compose files, and changing them orphans data for no user-facing gain.
- **Sceptic:** Re-grepped all three compose files and the Dockerfile. Added the /data/ch mount, the Dockerfile lines and deploy.md's statement that Compose is a testing tool, which lowers the stakes but does not change the recommendation.
- **Ruling:** Keep names, add a why-comment, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-11d · ps-relocate.sh (~/control-hub to ~/patterstage)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme C
- **Batch:** closing · **after:** POLICY-aliases, lib-domains-14a
- **Now:** scripts/maintenance/ps-relocate.sh is 71 lines (`wc -l`). It is documented at migration.md:59-62 and data-storage.md:32, named in ps-deploy.sh:12, and tells users to restart with ps-deploy.sh (:67). It is the only guided move out of the ~/control-hub layout that lib-domains-14a keeps discovering.
- **Question:** Should the documented relocation tool stay for as long as ~/control-hub discovery stays, and go with it?
- **Options:**
  - **Keep while discovery stays, delete with it** — Pre-rename users keep a guided move for as long as the legacy layout is still read. R1, -71 later.
  - **Delete with the env aliases** — If 14a keeps discovery, the legacy layout keeps working with no guided way out. R1, -71.
  - **Delete now** — Users must move directories and fix .env.local by hand. R1, -71.
- **Recommended:** Keep while discovery stays, delete with it — It is the documented way out of the legacy layout, so its life should match the life of that layout's support.
- **Removes:** scripts/maintenance/ps-relocate.sh (migration.md:59), when ~/control-hub discovery retires.
- **Sceptic:** Facts re-verified. Tied the deletion to lib-domains-14a instead of the env-alias date, because 14a now recommends keeping file-name discovery longer.
- **Ruling:** Keep while discovery stays, delete with it, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-10a · Five hardware scripts ship as both .sh and .mjs

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme C
- **Batch:** tooling-ci · **after:** tooling-10b
- **Now:** `git ls-files scripts/hardware | xargs wc -l`: .sh 51+35+37+41+34=198, .mjs 80+59+30+62+36=267. setup.sh:158-165 copies every .sh and .mjs, only when absent, and Dockerfile:46 copies scripts into the image. Outside their shims, the .sh twins are named only in b6-database-backup.test.ts (a comment) and b13-scripts-page-names-and-unschedule.test.tsx (a fixture). HARDWARE_CRON_UI_PRESETS (hardware-cron.ts:16-22) has only 3 test importers. cross-platform.md:114 says to schedule the Node versions; host-scheduling.md:14 and cross-platform.md:117-119 list the pairs. Neither twin existed on main. They arrived on dev in bef00ba7 (2026-06-19), so dev-tracking installs since then have the .sh copies in PS_DATA_DIR/scripts. Three of the .sh files carry shell alias chains (ps-db-backup.sh:17, ps-disk-report.sh:14, ps-log-rotate.sh:16).
- **Question:** Should the five bash hardware scripts be deleted so only their Node versions ship?
- **Options:**
  - **Delete the .sh, keep .mjs** — Fresh installs and images stop listing the .sh files. Existing data-dir copies and any crontab lines naming them keep working, because setup never deletes. Two docs change, the test edits are optional, and 3 of the 10 shell alias chains 04a would edit disappear. R1, about -198.
  - **Delete the .mjs, keep .sh** — Contradicts cross-platform.md:114 and gives native-Windows dev nothing runnable. R1, -267.
  - **Keep both** — No change.
- **Recommended:** Delete the .sh, keep .mjs — The docs already point users at the Node versions, and installed copies survive, so only fresh installs lose the bash twins.
- **Removes:** scripts/hardware/ps-{db-backup,disk-report,health-check,log-rotate,system-report}.sh, for fresh installs and images only (host-scheduling.md:14, cross-platform.md:117-119).
- **Sceptic:** Re-ran wc and the reference greps. The draft's reason 'no main-era install received either twin' does not hold given that installs track dev: dev installs since 2026-06-19 have the copies. Rewrote the reason around setup never deleting, and added the Dockerfile copy and the alias-chain overlap with 04a.
- **Ruling:** Delete the .sh, keep .mjs, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-10b · Five ch-* hardware shims that never reached main

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme C
- **Batch:** dead-code
- **Now:** ch-{db-backup,disk-report,health-check,log-rotate,system-report}.sh are 4-line forwards. `git grep -l <name>.sh -- ':!org'` returns nothing for all five. `git log --diff-filter=A` shows them added in bef00ba7 (2026-06-19) as real scripts: `git show bef00ba7:scripts/hardware/ch-disk-report.sh | wc -l` gives 35, and ch-db-backup.sh gives 49. They became shims in 4e60055b (2026-06-20). None exists on origin/main. host-scheduling.md:14 and cross-platform.md:117 document 'six pre-rename ch-*.sh shims'. setup.sh:158-165 copies them into PS_DATA_DIR/scripts, where the Scripts page lists them.
- **Question:** Should the five shims, names dev carried as real scripts for one day, be deleted now instead of waiting for the alias policy?
- **Options:**
  - **Delete now** — Five files go, and 'six' becomes 'one' in two docs. Data-dir copies, and any crontab line a dev-era user created from the Scripts page, keep working, because the copies forward to data-dir ps-*.sh copies that also survive. R1, -20.
  - **Wait for POLICY-aliases** — No change now. If tooling-10a lands first, fresh installs would receive shims that forward to missing files.
- **Recommended:** Delete now — No release, reference or installed copy depends on the repo files, and they must go before the twins they forward to.
- **Removes:** scripts/hardware/ch-{db-backup,disk-report,health-check,log-rotate,system-report}.sh from the repo.
- **Sceptic:** Confirmed the history and the real-script sizes at bef00ba7. Refuted 'no fresh-install crontab can name them': setup copies them and the Scripts page lists them. Nothing installed breaks, because the data-dir copies survive. The recommendation stands with that reason.
- **Ruling:** Delete now, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-03 · setup.mjs (and env-local.mjs) have no caller

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · theme C
- **Batch:** dead-code
- **Now:** install.ps1:1-22 only prints. setup.mjs:5 still says 'run by install.ps1'. Both were created in 46917eba (2026-06-20), and install.ps1 became a stub in 942068c2 (2026-06-21). `git grep -n 'setup\.mjs' -- ':!org'` finds only deploy.md:37, host-scheduling.md:14, env-local.mjs:2,4, tests/scripts/README.md:27, run-shell-custom-tests.sh:423-485 (CI job shell-custom-scripts, ci.yml:53) and b1-deploy-api-flag.test.ts:100-124 (a source-text read at :124). `wc -l`: setup.mjs 169, setup.sh 327, env-local.mjs 76. What moved is the plan. org/plans/2026-09-final-release.md:225 lists it as a carry candidate, but :828 puts 'deleting setup.mjs or setup.sh' under '## Deliberately deferred (post-1.0)' (:814). The plan header (:5-6) says status approved, approved_by Daniel Parke (operator), 2026-09-05. setup.mjs:20 shares _platform.mjs with ps-deploy.mjs.
- **Question:** Should setup.mjs and its env-local.mjs writer be deleted now, even though the approved release plan defers that choice past 1.0?
- **Options:**
  - **Delete now** — Removes a documented Node setup, the b1 test block and the CI shell-test block (checks deleted together with the code they test), and edits two docs. Overrides an approved deferral. R2, about -310.
  - **Keep until post-1.0 as planned, fix setup.mjs:5** — Drop the 'run by install.ps1' claim. R2, 1 line.
  - **Make setup.mjs the one setup** — install.sh, the CI install harness and docs switch, and setup.sh's interactive prompts must be ported. R2, large.
- **Recommended:** Keep until post-1.0 as planned, fix setup.mjs:5 — The operator-approved plan already defers this (:814, :828), and the evidence shows no defect beyond the stale comment.
- **Sceptic:** Confirmed the references and line counts. Cited the plan header's approved_by to show the deferral is an operator ruling; the setup line is :828, not :827-828. Dropped the Windows argument from the reason: the guardrail says Windows dev has Git Bash, and nothing on the dev box calls setup.mjs. Added the file's creation and stub history.
- **Ruling:** Keep until post-1.0 as planned, fix setup.mjs:5, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-24a · install.ps1 signpost and its broken link

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R2 · theme C
- **Batch:** tooling-ci
- **Now:** install.ps1:1-22 prints WSL2 steps, and :4 and :22 name docs/CROSS_PLATFORM.md, which does not exist (`ls` fails; the page is docs/running/cross-platform.md). It was created as a real installer in 46917eba (2026-06-20) and stubbed in 942068c2 (2026-06-21, Linux-first). It is described at cross-platform.md:72 and limitations.md:74-76 as a pointer to the WSL2 steps. `grep -n install.ps1 README.md knip.json` is empty.
- **Question:** Should install.ps1 stay as a signpost to WSL2 with its path fixed, or be deleted?
- **Options:**
  - **Keep, fix the path** — Lines :4 and :22 point at docs/running/cross-platform.md. R2, 2 lines.
  - **Delete** — A Windows user running it gets 'not recognized'; cross-platform.md:72, limitations.md:75 and setup.mjs:5 are edited. R2, -22.
- **Recommended:** Keep, fix the path — It costs nothing at runtime, it is the file a Windows user tries first, and the dead path is its only defect.
- **Sceptic:** Re-read install.ps1, checked that the path is missing and the README/knip greps are empty, and corrected the limitations line range to :74-76. Added the creation commit. Nothing refuted.
- **Ruling:** Keep, fix the path, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-24b · Windows branches: development (keep) vs deploy runner (ruling)

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme C
- **Batch:** tooling-ci
- **Now:** `git grep -c -E 'isWindows|win32' -- scripts` gives setup.mjs 3, ps-system-report.mjs 1, _platform.mjs 3, prebuild-db.mjs 1 and ps-deploy.mjs 4; src has 12 in 5 files. Development side (keep): prebuild-db.mjs:140, platform.ts:13-207, host-scheduler.ts:37, path-security.ts:36, useQuestHost.ts:69, the cross-env scripts (package.json:28-31), and, moved here from the draft's deploy column, _platform.mjs:52 (taskkill in killPid) and :69 (netstat in pidsOnPort). Those two are imported by tests/integration/runtime/restart-recovery.mjs:77 (npm run test:restart-recovery) and tests/scripts/boot-smoke.mjs (CI matrix ubuntu/macos, ci.yml:173). Deploy only: ps-deploy.mjs:181,192,361 and ps-system-report.mjs:22 (tasklist). setup.mjs's 3 stay while tooling-03 defers it. hardware-cron.ts:16-22 has no surface, and its 3 importers are tests. deploy-spawn.ts:41 spawns ps-deploy.mjs on every OS, and the route is open when NODE_ENV is not production (api-auth.ts:26). ps-deploy update resets to origin/<branch> (ps-deploy.mjs:460). The 'Linux-first ruling' is commit 942068c2 plus cross-platform.md:31 and limitations.md:74-76, not an ADR. Comments still claim every OS (update-handlers/shared.ts:20, ps-deploy.sh:10).
- **Question:** Should the native-Windows branches in the deploy runner and system-report script go, with Update/Rebuild/Restart refusing clearly on win32, while every development and test-harness branch (including _platform.mjs) stays?
- **Options:**
  - **Remove deploy-only branches, refuse clearly on win32** — On native Windows, Update, Rebuild and Restart return 'needs Linux or WSL2' instead of running git reset --hard on a dev checkout. ps-system-report.mjs prints no process list there. The two 'every OS' comments are corrected. npm run dev, npm run build and test:restart-recovery are untouched. R1, about -15.
  - **Keep them** — About 15 untested lines stay, and the buttons keep working (and resetting the checkout) on native Windows. R0.
  - **Also remove the _platform.mjs branches** — npm run test:restart-recovery loses tree kill on native-Windows dev, which breaks the Windows development guardrail. R1, about -30.
- **Recommended:** Remove deploy-only branches, refuse clearly on win32 — limitations.md:74-76 already calls deploy Unix-only. On a native-Windows dev box the button would hard-reset the working tree, so a clear refusal is safer and leaves the dev loop alone.
- **Removes:** In-app Update/Rebuild/Restart on a native-Windows server (documented unsupported at limitations.md:74-76), and the Windows process list in ps-system-report.mjs.
- **Sceptic:** Re-ran both win32 counts. Refuted the draft's placement of _platform.mjs:52,69 in the deploy column: they serve two test harnesses, one of them an npm script a Windows developer runs. Reduced the net to about -15. Added the git-reset hazard on a dev checkout and the two stale 'every OS' comments. Named 942068c2 as the ruling rather than an ADR. Dropped the tooling-03 dependency, since setup.mjs stays.
- **Ruling:** Remove deploy-only branches, refuse clearly on win32, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-08 · .env.local precedence and quote rules for Node loaders

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme C
- **Batch:** tooling-ci
- **Now:** A node -e extraction from 'function loadEnvLocal' to the first '^}' gives four identical 20-line bodies (ensure-hermes-model-sync, import-hermes-state, migrate-db, seed-catalog; md5 4957b31f3e86 here, where the review's extraction gave 207b867b9b11) and a 19-line retention-prune variant. All end `if (!process.env[key]) process.env[key] = val;`. _env-local.mjs:31 lets the file win, keeps quotes, whitelists names (:8, no CONTROL_HUB_DATA_DIR) and bridges CH_ (:32-35); ps-dotenv-local.sh:19-31 behaves the same. @next/env 16.2.9 processEnv takes a file key only when the initial env lacks it, strips quotes, and assigns loaded keys into process.env. The TS scripts read PS_DATA_DIR 9 times, CH_DATA_DIR 4 and CONTROL_HUB_DATA_DIR 3. ps-deploy.mjs:474 loads file-wins, and migrateDb passes PS_DATA_DIR explicitly (:258). The loader is load-bearing: deploy-spawn.ts:41 starts the runner with the app's env inherited, which already holds the .env.local values Next loaded, and ps-deploy.mjs:323 restarts next start with {...process.env}. So the runner's file-wins rule is what makes .env.local edits reach the restarted server. ps-deploy.sh just execs node (:17). Writers never quote (env-local.mjs:62). No doc states a precedence.
- **Question:** Should the Node loaders keep two documented rules (in-process scripts: shell wins like Next; deploy runner: file wins), with quotes stripped everywhere, or be forced onto one rule?
- **Options:**
  - **Two documented rules, strip quotes, dedupe the TS copies** — The five TS copies share one module (tooling-09) and stay shell-wins. _env-local.mjs keeps file-wins but strips quotes, so a hand-quoted value no longer reaches the restarted server with literal quote characters. The whitelist gains CONTROL_HUB_DATA_DIR while aliases are supported. The precedence is documented in env-reference.md. R2 (migrate-db.ts), about -80.
  - **Follow Next.js everywhere: shell wins** — The runner inherits the running app's loaded values as if they were shell values. After an operator edits .env.local and clicks Restart or Update, the new server keeps the old PS_/HERMES_HOME values. R2, about -85.
  - **Follow ps-deploy everywhere: file wins, quotes kept** — db:migrate, db:seed and db:retention start overriding a shell PS_DATA_DIR, keep quote characters, and ignore CONTROL_HUB_DATA_DIR in .env.local. R2, about -90.
  - **Deduplicate the TS copies only** — No behaviour change, and the quote defect stays (tooling-09). R2, about -72.
- **Recommended:** Two documented rules, strip quotes, dedupe the TS copies — The runner must re-read .env.local because it inherits an already-loaded environment, while in-process scripts should match the server. The one real defect is the kept quotes.
- **Sceptic:** Reversed the recommendation. Traced the spawn chain: deploy-spawn.ts:41 has no env, @next/env assigns .env.local into process.env, and ps-deploy.mjs:323 spreads process.env. Under shell-wins, in-app Restart would stop applying .env.local edits. The draft's 'migrates a different database' is also inaccurate: the restarted server serves what the runner migrated. Found the quote defect (plausible; verify by quoting PS_DATA_DIR in .env.local and clicking Restart on a running instance, which needs a server). The md5 value depends on the extraction; the identity holds.
- **Ruling:** Two documented rules, strip quotes, dedupe the TS copies, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-03a · One on/off vocabulary for boolean env vars

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R2 · theme C
- **Batch:** lib-domains
- **Now:** read-only.ts:33 accepts 1/true. api-auth.ts:24-26 accepts 1/true/yes and 0/false/no, and anything else falls to the NODE_ENV default. feature-flags.ts:15 treats 0/false/no/off as falsy. boot-diagnostics.ts:46-47 checks 0/false. pull/route.ts:52 accepts '1' only. Docs: env-reference.md:62 (PS_READ_ONLY `1`), :68 (0/false/no), :86 (0/false/no/off), :105 (`1`). proxy.ts:238 enforces read-only through isReadOnly(), so a change in read-only.ts reaches the proxy without editing proxy.ts. No test sets these vars to yes/on/off (`git grep` empty). Fail-open today: PS_ENABLE_DEPLOY_API=off leaves the route open under npm run dev, and PS_READ_ONLY=yes or on allows writes.
- **Question:** Should every on/off env var accept the same words (1/true/yes/on and 0/false/no/off), keeping each variable's default?
- **Options:**
  - **One vocabulary, defaults unchanged** — PS_READ_ONLY=yes starts refusing writes. PS_ENABLE_DEPLOY_API=off closes the route under npm run dev, and =on opens it in production. PS_PULL_RECONCILE_DISK=true starts reconciling. Documented values keep their meaning. Four doc rows and the tests change. R2 (api-auth.ts), about +20.
  - **Keep per-variable words, document them** — No behaviour change; only the cross-cutting-01 boot line is fixed. R1, about +6.
- **Recommended:** One vocabulary, defaults unchanged — Every documented value keeps its meaning, and two undocumented spellings fail open today on security gates.
- **Sceptic:** Re-read each reader and doc row. Added the PS_ENABLE_DEPLOY_API=off fail-open in dev, confirmed the proxy goes through isReadOnly(), and confirmed no test pins the words. The recommendation stands.
- **Ruling:** One vocabulary, defaults unchanged, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-13a · The <hermes_mission> prompt envelope

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme C
- **Batch:** lib-domains
- **Now:** build-mission-prompt.ts:199 wraps prompts in <hermes_mission>, :267 recognises stored rows by the tag, and :4 documents it. `git grep -l hermes_mission -- tests/unit | wc -l` gives 11. Documented at docs/guides/missions.md:204. The hermes-outside-adapter pattern (design-lint.mjs:263, /getActiveHermesPaths|getAgentLlmEndpoints|HERMES_HOME|\.hermes\//) does not match it.
- **Question:** Should the mission prompt envelope be renamed from <hermes_mission> to a neutral <mission>, while still reading old stored prompts?
- **Options:**
  - **Keep <hermes_mission>** — No change; record it as an accepted term. R0.
  - **Rename, accept both on read** — New prompts carry <mission>, with an unmeasured effect on agent output; 11 suites and missions.md:204 change. R1, about +2.
- **Recommended:** Keep <hermes_mission> — It changes what every agent receives, with no way to measure the effect here, for a name users see only in the AI preview.
- **Sceptic:** Re-grepped the tag lines, the suite count, the doc line and the lint pattern. All hold.
- **Ruling:** Keep <hermes_mission>, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-13b · PatterStage's own logs under ~/.hermes/logs

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme C
- **Batch:** lib-domains
- **Now:** deploy.md:65,67 document ~/.hermes/logs/ps-deploy.status and the ps-update/ps-build/ps-restart/ps-runtime logs. ps-deploy-status.sh:4 uses the same path; its :2 comment names the deleted ps-deploy-impl.sh. deploy-spawn.ts:88-89 and :107-108 carry lint pragmas with reasons. limitations.md:154-157 admits the placement. The approved plan (header :5-6) lists 'moving PatterStage's logs out of the agent's home' at :827, under 'Deliberately deferred (post-1.0)' (:814).
- **Question:** Should PatterStage's deploy logs and status file move into its own data directory in this programme, despite the approved plan deferring it past 1.0?
- **Options:**
  - **Keep deferred** — The limitation stays documented. 0.
  - **Move now, read the old status file during one update** — deploy.md:65-67 is rewritten, and log watchers must follow the new paths. R1, about +20.
- **Recommended:** Keep deferred — The operator-approved plan already rules it post-1.0, and the evidence shows no defect beyond the documented limitation.
- **Sceptic:** Re-read the doc lines, pragmas, limitation and plan; the plan header confirms operator approval. Noted the stale comment at ps-deploy-status.sh:2 in passing.
- **Ruling:** Keep deferred, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-23a · Batch-named test files

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme C
- **Batch:** tests
- **Now:** `git ls-files tests` gives 712 test files, 220 of them batch-named (b 147, c 9, u 64), and there are 11 PascalCase .ts files. Reference counts depend on the pattern. The review's 118 reproduces when matching by stem: `git ls-files tests | grep -E '/[buc][0-9]+-' | sed 's#.*/##; s#\.(test|spec)\.(ts|tsx)$##' | git grep -nF -f - -- <dir>` gives org 60, tests 45, src 8, docs 4, scripts 1. The draft's 63 comes from full filenames: org 25, tests 30, src 4, docs 3, scripts 1. Stem references such as `jest b6-backup-route` also break on rename, so 118 is the cost. ADR-0010 section 3 keeps historical task records unrewritten.
- **Question:** Should existing batch-named tests keep their names, with subject-first names required for new tests only?
- **Options:**
  - **Rule for new tests only** — No renames. R0, +3 docs.
  - **Rename all 220** — 58 non-org reference lines edited; 60 org lines stay stale. R1, large diff.
- **Recommended:** Rule for new tests only — Renames break org references that cannot be rewritten and change nothing a user sees.
- **Sceptic:** Re-ran both counts via stdin patterns. The draft's 'moved to 63' used full filenames; by stem the review's 118 reproduces and is the relevant cost, so reverified is confirmed. Changed operator_needed to true because the rule is test policy.
- **Ruling:** Rule for new tests only, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-23b · Pre-rename seed_key values (ch.cat., ch.tool., ch.tpl., ch.prof.)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme C
- **Batch:** data-layer
- **Now:** `git grep -c 'ch\.cat\.' -- src` gives the SQL seed 8, mission-category-repository.ts 8 (:302-309) and catalog-seed.ts 1. catalog-seed.ts:164 and :222 build ch.tool. and ch.tpl. keys. ch.prof. lives in data/seed/profiles/manifest.json (7) and tests (profiles-api 3, profiles-repository 5). data-storage.md:114 documents all of them as intentional because the unique seed_key would need a migration.
- **Question:** Should the ch.* seed keys stored in every database stay as documented?
- **Options:**
  - **Keep** — No change. R0.
  - **Rewrite with a migration** — A new numbered migration and a seed-pack edit; merge-seeding must match both prefixes. A unique-column rewrite that collides would drop or skip rows, which puts it at R3 destructive-migration rather than R2. About +40.
- **Recommended:** Keep — The keys are never shown to users, are documented as intentional, and rewriting a unique column risks collisions on existing databases.
- **Sceptic:** Re-counted. Added ch.prof.* in the seed pack and tests, and raised the rewrite option's tier to a possible R3 because the column is unique.
- **Ruling:** Keep, as recommended — Daniel Parke (operator), 2026-09-12.

### Theme D

1. **One ruling on closed-programme oracles settles most blind-gate fixes in this theme.**
   - c6-the-page-layer.test.ts:57 requires every C6 design-lint rule to read zero.
   - c6:104-105 require the census read list to be empty.
   - c6:39 caps C6 pragmas at 12, and all 12 are used.
   - c8:81 freezes the census key set, and c8:88-91 fail any met measure above its target.

   Each of these either waits for a full burn-down or amends C6 or C8 with a written reason: components-01 (104 hits in 43 files), hooks-04 (4 files, 18 sites), hooks-05 (4 or 5 hooks), app-04a (13 to 18 files, 11 catches), tooling-22 (a new key), and tests-04's optional band. Decide once whether a gate fix may amend a closed oracle for the one rule or key it fixes.

2. **One lint ruling covers three findings.** cross-cutting-06, tests-05 and tooling-08 count the same directives: 285 lines in 258 files under tests/ (169 file-level, 116 next-line), plus jest.config.js:1.
   - ESLint reports unused disable directives as warnings, and lint runs `--max-warnings 0`. So the override and every deletion must land in one commit.
   - A reason worth keeping must become a plain comment, not a kept directive.
   - Rule it before tests-01, tests-11 and tests-24 add more factory adoptions.

3. **Other groupings.**
   - tests-20 and tooling-15a are one decision (drop the separate tsc CI step). tooling-31 depends on it.
   - tooling-15b, tests-23 and tooling-18 all fix the same two tsconfig.tests.json lines; count that fix once.
   - docs-01, docs-02 and tooling-19 are one checker change (an exact-case check plus a root and branding walk), surfacing 6 + 3 links.
   - tests-13 and tooling-16 share the test-helper export list, which is 16 by grep.
   - cross-cutting-22 feeds tooling-16.

4. **Hidden costs found in this pass.**
   - Deleting next.config.ts:27-29 changes the output canary's appConfig hash (output-canary.mjs:357-364, golden :10), so it needs `canary:bless` in the same commit. The recommendation now keeps that block.
   - b6-cleared-defaults-stay-cleared.test.ts runs under the node environment on purpose, so jsdom should be declared rather than switched to the jsdom environment.
   - Folding b19 into phone.spec moves it into Playwright's phone project, which has hasTouch on and does not run in smoke.
   - b2-focus-is-visible.test.ts:56-58 already holds no-bare-outline-none at zero, so u8's whole-tree walk is a duplicate lock. u9 and u6 are the only locks for their own rules.
   - The memory/hindsight catch (route.ts:101) cannot adopt a shared helper without changing its body.

5. **Recommendation and ownership changes.**
   - tooling-28a: now keep both rules off and fix the comments. preserve-manual-memoization reports React Compiler diagnostics ('Compilation Skipped'), and no compiler is installed.
   - tooling-20a: moved to the executor band at R2. It keeps the WG-DEL-004 retry and removes nothing.
   - tooling-23: five unreferenced scripts, not four. test:full-install-hermes is cited only by an org plan and stays.

6. **What each blind gate would surface today.**
   - components-01: 104
   - critic-06: 16 to 22 (136 uses)
   - hooks-04: 4 files, 18 sites
   - hooks-05: 4 or 5
   - docs-01: 6
   - docs-02 and tooling-19: 3
   - app-04a: 5 more files (11 catches), 13 to 18
   - tooling-28a: 42 if both rules are re-enabled (39 + 3)
   - tests-13 and tooling-16: about 16 test-helper exports

7. **Check CI first.** docs-01's uppercase links were introduced in 41ddb25b (2026-09-05) in all four files, and check-doc-links fails them on Linux. So build-test-ubuntu's lint step may have been red on dev since then. Run `gh run list --branch dev --workflow CI` before anything else.

8. **Dependabot.**
   - Ten branches exist, and dependabot.yml:9 caps open npm pull requests at 10. Pull request state is unverified.
   - Every branch predates dev's lockfile rewrite (26,886 lines down to 13,481) and needs a rebase.
   - The multi branch pairs react 19.2.8 with react-dom 19.2.7, which react-dom's client refuses at load (error 527, :15917-15928).
   - Land the knip bump before tooling-16 widens knip.
   - Expect the Playwright bump to move the design census and screenshots.

9. **Register conventions.**
   - tier_floor and removes carry the recommended option.
   - needs_adr is false throughout: nothing touches the protected set.
   - Split ids: tests-09a/b, tests-18a/b, tooling-15a/b, tooling-20a/b, tooling-28a/b, app-04a/b.
   - Every required id has an entry: tests-04, tests-05, tooling-08, cross-cutting-06, tests-07, tests-08, tests-09 (a/b), tests-12, tests-14, tests-18 (a/b), tests-20, components-01, app-04 (a/b), docs-02, tooling-16, tooling-28 (a/b), cross-cutting-22, tooling-15 (a/b), tooling-17, tooling-20 (a/b), tooling-23, tooling-31, tooling-25.
   - POLICY-dependabot is added.

10. **Read-only methods used.**
    - git grep, ls-files, rev-list, diff and show.
    - `node scripts/tooling/line-census.mjs --report`, which exits at :258-260 before its write at :286.
    - design-lint's RULES and violationsIn, patched in memory only.
    - The ESLint API with cache and fix off: rule counts, isPathIgnored and calculateConfigForFile.
    - A TypeScript AST probe, node probes for brace-matched catches, exact-case links, unused exports and comment counts.
    - `npm config get registry` for the pnpm warnings.

    Not re-run: knip on a widened config, `npx playwright test --list` (ci.yml:237's '98'), jest, next build, docker, and GitHub pull request or CI state.

#### cross-cutting-06 · 285 require-import lint directives in tests could be one eslint override

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** tests
- **Now:** `git grep -hF no-require-imports -- tests | wc -l` = 285, `git grep -lF` = 258 files. 169 are file-level `/*` and 116 are `eslint-disable-next-line`. tests/unit holds 284; the 285th is tests/helpers/mocks.tsx:313. Outside tests: jest.config.js:1, plus src/lib/db/upgrade.ts:313, which stays. 146 lines carry a '-- reason', 48 of them file-level. Exact boilerplate strings account for 89 ('jest.mock factories are hoisted above imports' x75, '...; require is the hoisting-safe form' x7, 'hoisting-safe inside jest.mock' x7), about 92 with 'same' x2 and the mocks.tsx one; there are about 47 distinct reasons. 4 file-level blocks span lines (the b16-concept-hint-a11y, b16-help-link-on-every-header, b16-help-page-renders and b16-help-slug-resolver suites, each at :2). A grep for a second rule on a directive line returns 0. eslint.config.mjs:25-40 is one global rules block. `git grep -l eslint.config -- tests` is empty. ESLint 9.39.4's calculateConfigForFile gives the rule [2] for tests and jest.config.js, and linterOptions.reportUnusedDisableDirectives = 1 (warn); package.json:18 runs eslint with --max-warnings 0.
- **Question:** Should @typescript-eslint/no-require-imports be turned off for test files by one scoped block in eslint.config.mjs, so the 285 disable comments in tests/ can be deleted?
- **Options:**
  - **Override, delete all 285** — One files block for tests/**/*.{ts,tsx} and jest.config.js (about +6 lines). The 285 directives and jest.config.js:1 go, and the 4 multi-line blocks need a hand edit. The config block and every deletion must land in one commit: unused disable directives warn, and lint runs --max-warnings 0. The rule stays on in src and scripts. No test or doc pins the config. R1, 259 files, net about -280.
  - **Override, keep the unique reasons** — The same block, in the same single commit. The ~89-92 boilerplate directives are deleted. The ~54-57 lines with a specific reason become plain comments, not directives, because a kept directive would warn as unused: the computed scripts/docs/lib.mjs path, better-sqlite3 not being newable, modules not yet written. R1, net about -230.
  - **Keep per-site directives** — No change. Every later factory adoption (tests-01, tests-11, tests-24) pays one directive, which shrinks those findings' nets.
- **Recommended:** Override, keep the unique reasons — Every site already suppresses the rule, so nothing in tests loses enforcement. The specific reasons record real constraints, which plan decision 2 keeps; the boilerplate records nothing.
- **Sceptic:** Re-ran every count. 285/258/169/116/284/146/48 and the 4 multi-line blocks all reproduce, and no directive names a second rule. Corrected the boilerplate count to 89 exact strings (about 92 with near-duplicates) and the distinct reasons to about 47. Added a hidden cost: with reportUnusedDisableDirectives = warn and --max-warnings 0, the override and the deletions cannot be staged, and a kept reason must become a plain comment. T-0115's record already met unused-directive reports. The operator ownership stands.
- **Ruling:** Override, keep the unique reasons, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-04 · A sixth of the unit corpus is comment, mostly batch provenance headers

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** tests
- **Now:** A read-only node count over the 684 tests/unit suites, not counting the trailing newline as a line, gives 114,805 lines: 18,450 comment and 15,050 blank. Counting that newline, as the draft did, gives 115,489 and 15,734. 9,849 comment lines sit before the first code line in 669 suites; 9,389 once the exact one-line node docblocks and bare file-level require disables are removed. 374 suites cite T-0\d{3}, and 338 carry the exact line `/** @jest-environment node */`. commentEssays walks tsFiles(src) only (line-census.mjs:213-222). Applying its rule (at least 60 lines, at least 40% comment) to tests/**/*.{ts,tsx} gives 15 files, led by u7-the-rail.test.tsx (100 of 218), tests/helpers/baseline-db.ts (83 of 149) and tests/e2e/screenshots.spec.ts (78 of 164). A new census key would edit c0's MEASURES (c0-the-line-census.test.ts:27-40) and trip c8:81's key-equality check. Plan decisions 1 and 2 are at org/plans/2026-09-consolidation.md:301-304.
- **Question:** What may a unit-test header comment keep: everything it has now, or only the subject and the defect the suite pins?
- **Options:**
  - **Trim to subject and defect** — About 600 suites get comment-only edits, with identity proven by a stripped-code diff as in C5. Narrative is deleted only where the cited org/tasks record already holds it; no record is edited. A tests comment band either edits c0 MEASURES and c8:81 (a closed oracle) or lives in a separate census. R1, net roughly -3,000, before the ~500-line overlap with cross-cutting-06 and tests-06.
  - **Ratchet only** — No header text is deleted. A separate measure or tests band (15 files today) stops the share growing, with the same c0/c8 caveat. R1, net about +10.
  - **Leave as is** — No change. The 18,450 comment lines stay and can grow.
- **Recommended:** Ratchet only — Much of the header text names the defect a suite pins, which plan decision 2 keeps, and none of it can move into historical records. A ratchet stops growth without that loss, and a header can be trimmed whenever its suite is edited for another reason.
- **Sceptic:** Re-counted with node. The review's 114,805 lines and 15,050 blank reproduce exactly when the trailing newline is not counted as a line; the draft's 115,489 and 15,734 count it. 18,450 comment, 9,849 leading lines in 669 suites and 374 T-ids reproduce. The exact one-line docblock is 338 in tests/unit; 339 is the tests-wide git grep. The band's 15 files and top three reproduce. The leading figure without pragmas is 9,389 by my definition, against the draft's 9,145. The recommendation stands.
- **Ruling:** Ratchet only, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-07 · 217 unit suites and 3 e2e specs are named after the batch that wrote them

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme D
- **Batch:** tests · **after:** tests-08
- **Now:** `git ls-files tests/unit | sed 's#^tests/unit/##' | grep -v / | grep -c -E '^(u|b|c)[0-9]+[a-z]?-'` = 217 (b 144, u 64, c 9), 48,792 lines. 3 of 28 e2e specs are batch-named: b16-help-deep-link, b19-a-title-survives-a-phone and b3-old-paths-redirect. Record citations: 117 tests/unit paths in 65 org/tasks records, and 28 in 10 docs, plans, reviews and HANDOVER files. Source comments naming batch suites: src/proxy.ts:102 (b3-titles-from-registry) and src/lib/db/backup.ts:54 (b6-database-backup), both sensitive; config-sections.ts:14, script-ext.ts:12, globals.css:130, event-types.ts:13 (the glob b4-emits-*), scripts/docs/extract.ts:21, design-tokens.md:86 and :180, testing.md:209. The other three src/lib/db* citations (db-schema.ts:27, apply-composer-rejected-migration.ts:27, apply-neutral-column-names.ts:23) name run-migrations-upgrade.integration.test.ts, which is not batch-named. Suites named by constant: c4-the-test-harnesses.test.ts:34 and :36 (SELF, ORACLES), u1-shared-mock-factories.test.ts:51 (SELF).
- **Question:** Should the 220 batch-named test files be renamed after their subject, given that records citing the old names could only be resolved through a map?
- **Options:**
  - **Rename with a map, alongside tests-08** — Each file moves once. describe and it titles are kept, with identity proven through jest's JSON reporter. A committed old-to-new map keeps the 117 record citations resolvable. Edits src/proxy.ts:102 and src/lib/db/backup.ts:54 (R2), the c4 and u1 name constants, design-tokens.md and testing.md. Net about +220 map lines, ~0 code.
  - **Name new suites by subject only** — Existing names stay, and testing.md gains a naming rule for new suites. No citation goes stale. The C-oracle convention of batch names ends for future programmes. R0, net about +3.
  - **Keep batch naming** — No change. Finding a suite by subject stays a grep.
- **Recommended:** Name new suites by subject only — A rename buys only findability, and pays for it with identity proof, R2 edits and a 220-entry map. A rule for new suites stops the pattern at no cost.
- **Sceptic:** Re-ran the prefix count and split, the e2e list, and the 117/65 and 28/10 citation counts, and read every cited source line. Added that the other sensitive src/lib/db* citations name a suite that is not batch-named, so a rename alone reaches only proxy.ts and backup.ts at R2. Fixed the c4 and u1 constant line numbers. depends_on tests-08 applies only to the rename option.
- **Ruling:** Name new suites by subject only, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-08 · 684 unit suites in one directory: a domain layout, and what the move costs

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R0 · theme D
- **Batch:** tests
- **Now:** `git ls-files tests/unit | wc -l` = 684, 3 of them nested (components/schedule/SchedulePicker.test.tsx, db/apply-cron-schedule-canonicalisation.test.ts, schedule/presets.test.ts). '../helpers/' appears 471 times in 275 suites. `__dirname, ".."` joins: 121 in 112 suites. '../../' literals: 39 by `git grep -ho '\.\./\.\./' -- tests/unit | wc -l` (the review had 36). c4-the-test-harnesses.test.ts:39 and u1-shared-mock-factories.test.ts:54 call readdirSync(UNIT) without recursing. 29 src and scripts files cite tests/unit/ paths (`git grep -l`), five of them sensitive: src/proxy.ts, src/lib/db-schema.ts, src/lib/db/backup.ts, src/lib/db/apply-composer-rejected-migration.ts, src/lib/db/apply-neutral-column-names.ts. Suite paths are cited in 6 docs files, 15 lines: testing.md:46,50,51,209,238 (plus generic tests/unit/ at :19 and :242), design-tokens.md:86,115,180, output-canary.md:19,128, SECURITY.md:102, repo-guide.md:167, migration.md:68,93,190. 4 org/plans and org/reviews files also cite them.
- **Question:** Should tests/unit's 684 suites move from one flat directory into domain folders?
- **Options:**
  - **Alias, then move by map** — Add a @tests/* alias (jest moduleNameMapper and tsconfig paths), rewrite the 471 helper spellings, 121 __dirname joins and 39 '../../' literals, and make the c4 and u1 scans recursive. Then move all 684 files into about a dozen folders by a committed map. Edits src/proxy.ts and four src/lib/db* files (R2), 6 docs files and the plan/review citations, with a per-suite identity proof. Net about +5 code lines plus a ~690-line map.
  - **Alias only** — Helper imports and root joins stop depending on directory depth. No file moves and no citation goes stale. R1, ~275 files, net about 0.
  - **Leave flat** — No change. Findability relies on file names (tests-07).
- **Recommended:** Leave flat — No gate or defect depends on the layout, yet the move touches every suite, five sensitive files and 117 record citations for findability alone. The alias does nothing until a move happens.
- **Sceptic:** Re-ran each count. 684, the 3 nested suites, 471/275, 121/112, the 29 citing files and the 5 sensitive ones reproduce. The '../../' count is 39 (both occurrence and line counts), not 36. The docs that cite suites are 6 files, not 8, with 4 more org plans and reviews files. The recommendation stands.
- **Ruling:** Leave flat, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-09a · Three suites re-run design-lint rules over the whole src tree (split from tests-09)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme D
- **Batch:** tests
- **Now:** u9-no-dangling-variant.test.ts:79-89, u6-colour-that-is-there.test.ts:115-122 and u8-the-focus-ring.test.ts:81-90 walk src through violationsIn and expect no hit. scripts/tooling/design-lint.baseline.json has only the key '__growth__'. SCAN_DIRS is ['src','docs'] (design-lint.mjs:125), and package.json:18 runs design-lint. planBaselineWrite (design-lint.mjs:740) accepts growth with a reason of at least MIN_REASON_LENGTH (12) characters. no-bare-outline-none already has a second lock: b2-focus-is-visible.test.ts:56-58 runs scanTree() and expects no key for that rule. `git grep -l` finds no other test holding no-dangling-variant or no-template-literal-tailwind, so u9 and u6 are the only locks for those two rules.
- **Question:** May the jest tests that repeat design-lint's no-dangling-variant, no-template-literal-tailwind and no-bare-outline-none rules over all of src be deleted?
- **Options:**
  - **Delete all three** — The 3 it() blocks and their walkers go (~-35 lines). no-dangling-variant and no-template-literal-tailwind can then take a written growth like any other rule; no-bare-outline-none stays locked by b2. R1.
  - **Delete only u8's walk** — b2-focus-is-visible.test.ts:56-58 already holds no-bare-outline-none at zero, so nothing is lost (~-13 lines). One it() name leaves the identity set. R1.
  - **Move the lock into design-lint, then delete** — A no-growth flag makes planBaselineWrite refuse --allow-growth for the three rules (+~8 lines, one u2 fixture). R1, net about -25.
  - **Keep them** — No change, and test identity is kept.
- **Recommended:** Keep them — Two of the three are the only guarantee that their rules stay at zero, and the third saves about 13 lines against an identity change. Nothing justifies adding a lint mechanism.
- **Sceptic:** Read all three blocks, the baseline keys and design-lint.mjs:697-748. The draft said these tests are the only thing stopping the three rules being baselined; that is false for no-bare-outline-none, which b2-focus-is-visible.test.ts:56-58 also holds at zero. Added a 'delete only u8's walk' option. The recommendation stands.
- **Ruling:** Keep them, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-09b · 126 suites assert on source text (split from tests-09)

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme D
- **Batch:** tests
- **Now:** `git git grep -l readFileSync -- tests/unit | wc -l` = 183. 129 of those name a src path by a grep heuristic; the review's classifier gave 126 suites and 23,438 lines. 19 suites mention design-lint.mjs. The 93 mixed suites were counted, not classified (the tests dimension's 'Not examined' section).
- **Question:** Should the source-text suites be classified once, and may later batches replace a component's source pin with a render or handler test even though test names change?
- **Options:**
  - **Classify and convert as batches go** — A one-time table sorts the suites into whole-tree lint repeats, component pins and genuine static contracts. A batch that touches a component swaps its pin for a behaviour test, proving identity by mapping assertions rather than names. R1 per batch.
  - **Classify only** — A table in the programme plan tells each batch which suites it will turn red. No test changes. About +130 plan lines. R0.
  - **Leave unclassified** — Batches find source pins when those suites go red.
- **Recommended:** Classify only — Moving code usually edits source-text suites, so knowing which ones is cheap and lowers every batch's cost. Converting pins changes test identity and is better ruled batch by batch.
- **Sceptic:** Re-ran the readFileSync (183), src-path (129) and design-lint.mjs (19) counts. 126 is the review's own classifier and was not re-run.
- **Ruling:** Classify only, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-14 · Seven e2e specs each visit all 21 documented routes; several overlaps can fold

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** tests
- **Now:** Route loops: design-invariants.spec.ts:67, hit-targets.spec.ts:25, loading.spec.ts:36, motion.spec.ts:25, rail-no-scroll.spec.ts:20, phone.spec.ts:136, and navigation-matrix.spec.ts:5 through APP_MATRIX_ROUTES = documentedRoutes() (app-routes.ts:30). design-census.spec.ts:89-93 runs only under RUN_CENSUS. hit-targets:32 and motion:34 sleep 1.5 s per route. b19-a-title-survives-a-phone.spec.ts loops 7 SCREENS (:44) and checks height > 8 (:60); phone.spec.ts:50 sets TITLE_FLOOR = 192. Duplicate pairs: missions-flows.spec.ts:85 with schedule-picker.spec.ts:11 (schedule-picker also asserts that Dispatch opens by default and that a frequency button shows), and missions-compose.spec.ts:35 with missions-flows.spec.ts:92 (flows also creates the category). features.spec.ts has 7 tests that only load a page and assert its heading: :4, :44, :68 (which also checks the app shell), :78, :93, :132, :145. :11 asserts the quick-template region. playwright.config.ts:40-56: phone.spec.ts runs only in the 'phone' project (390x844, hasTouch true, absent in smoke), while b19 runs in 'chromium' with a 390 viewport. The matrix is documented at testing.md:71 and :75-81 and at pull_request_template.md:24, and agents.spec.ts:10 names it. No unit test or doc names hit-targets, b19, features, missions-compose or schedule-picker by file.
- **Question:** Which overlapping e2e specs may be folded: only those whose removal takes nothing documented, or also the documented navigation-matrix spec?
- **Options:**
  - **Full fold** — hit-targets folds into design-invariants and navigation-matrix into rail-no-scroll, so navigation-matrix.spec.ts and APP_MATRIX_ROUTES go. b19 folds into phone.spec and so runs with hasTouch. schedule-picker is kept over flows' schedule test, and flows' category test over compose's. The 7 heading tests' names move into loading, where they are asserted with the APIs held. Edits testing.md:71 and :75-81, the PR template:24 and agents.spec.ts:10. 49 fewer navigations and 31.5 s less sleep. R1, net about -180.
  - **Fold what nothing documents** — As above, but navigation-matrix.spec.ts and app-routes.ts stay. 28 fewer navigations and 31.5 s less sleep. R1, net about -130.
  - **Keep all specs** — No change.
- **Recommended:** Fold what nothing documents — It takes the overlaps that lose no assertion, and the sleep savings, while keeping the documented matrix, which costs one navigation and three assertions per route.
- **Sceptic:** Re-grepped every loop, sleep and test line and read the duplicate bodies. There are 7 heading-only tests in features.spec.ts, not 8: :11 checks the quick-template region, and :68 also checks the app shell. Folding b19 into phone.spec moves it into the phone project, which adds hasTouch and is excluded from smoke. That consequence was missing. No unit test pins these spec names. The recommendation stands.
- **Ruling:** Fold what nothing documents, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-18a · composer-smoke and restart-recovery run in no CI job, and two comments are confirmed wrong (split from tests-18)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme D
- **Batch:** tooling-ci
- **Now:** test:smoke-composer (package.json:54) and test:restart-recovery (:55) have no match in .github (`git grep -c`). real-hermes-integration (ci.yml:396-409) runs test:e2e-hermes, which runs hermes-contract.mjs and full-stack-smoke.mjs (real-hermes-itest.sh:39, :44). mock-hermes appears in .github only in the ci.yml:388 comment. docker-compose.real-hermes.yml defines mock-llm, hermes-seed, hermes and patterstage. ci.yml:387-388 cites a 'fast mock-hermes smoke' that no job runs. testing.md:158 says 'Neither runner is wired into CI', yet the same line says real-hermes-integration drives full-stack-smoke.mjs. ci.yml:236-237's '5 of the suite's 98 tests' cannot be checked read-only; it needs `npx playwright test --list`. The testing.md:111-114 table lists only full-stack-smoke and composer-smoke. restart-recovery.mjs is 327 lines and once found a real defect (run-reconcile-404-grace.test.ts:19).
- **Question:** Should composer-smoke.mjs and restart-recovery.mjs get a CI job, or be documented as manual runners?
- **Options:**
  - **Add a CI job** — A new job starts mock-hermes and a PS_AUTH_MODE=none server, runs both runners and fixes the comments. Costs CI minutes on every run. R2, about +35 lines.
  - **Document as manual** — restart-recovery joins the testing.md:111-114 table, and testing.md:158 and ci.yml:387-388 are corrected. ci.yml:237 is corrected only after `npx playwright test --list` gives the real count. R2 by path for the ci.yml comments, net about +3.
  - **Leave** — The comments keep misdescribing what CI runs.
- **Recommended:** Document as manual — The cheapest truthful fix corrects what the docs claim. Wiring the runners adds a stateful job nobody has measured, and it can follow the gate runner in tooling-01.
- **Sceptic:** Re-ran the .github greps, read ci.yml:234-238 and :385-409, real-hermes-itest.sh:1-50, testing.md:100-170 and the compose services. The draft called three comments stale; only two are confirmed. ci.yml:237's '98' is unverifiable read-only, so that edit waits for a measured count.
- **Ruling:** Document as manual, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-18b · test:e2e-bench-gateway runs a harness for deleted routes (split from tests-18)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme D
- **Batch:** dead-code · **after:** tooling-02
- **Now:** package.json:57 maps test:e2e-bench-gateway to tests/scripts/bench-gateway-itest.sh (28 lines), which brings up docker-compose.bench-gateway.yml (:8) and runs test-harness/bench-gateway-e2e.mjs, which calls /api/benchmarks/* (:58, :67, :81, :95). `git grep -n -F test:e2e-bench-gateway` outside the lockfile finds only package.json:57, org included. The bench-gateway files are docker-compose.bench-gateway.yml, test-harness/bench-gateway-e2e.mjs, bench-gateway-entrypoint.sh and bench-gateway.Dockerfile. baseline-fix-verify.mjs is a separate unreferenced orphan. src/lib/db/apply-bench-gateways-migration.ts is a schema migration and is out of scope. 4935ac31 (2026-07-25) deleted the benchmark subsystem.
- **Question:** Should the npm script test:e2e-bench-gateway be removed with the benchmark-gateway harness that tooling-02 proposes deleting?
- **Options:**
  - **Remove with tooling-02** — package.json:57 and bench-gateway-itest.sh go in tooling-02's commit, so `npm run test:e2e-bench-gateway` stops existing. No doc names it. R2 (docker-compose.bench-gateway.yml), net about -29 on top of tooling-02.
  - **Keep until tooling-02 is ruled** — No change. The command keeps driving routes that answer 404 by decision.
- **Recommended:** Remove with tooling-02 — Nothing documents or calls the command, and the routes it drives were deleted by decision.
- **Removes:** npm run test:e2e-bench-gateway
- **Sceptic:** Re-ran the script-name grep, the bench-gateway file list, the harness's /api/benchmarks calls and 4935ac31. Corrected the file list: bench-gateway-entrypoint.sh was missing, baseline-fix-verify.mjs is not a bench-gateway file, and the bench_gateways migration stays. The ruling stands.
- **Ruling:** Remove with tooling-02, as recommended — Daniel Parke (operator), 2026-09-12.

#### tests-20 · CI type-checks src twice in each build job

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R2 · theme D
- **Batch:** tooling-ci
- **Now:** tsconfig.tests.json:25 includes next-env.d.ts, tests/** and src/**. package.json:18 ends lint with typecheck:tests (:22 `tsc --noEmit -p tsconfig.tests.json`). ci.yml:97-98 and :151-152 run `npx tsc --noEmit -p tsconfig.json`, and :102 and :162 run npm run build in the same jobs; next.config.ts sets no typescript key. `git ls-files '*.ts' '*.mts' '*.tsx'` outside src, tests, scripts and tmp gives next.config.ts and playwright.config.ts. The step is documented at testing.md:162, docs/CONTRIBUTING.md:25 and pull_request_template.md:19, and HANDOVER.md:84 runs `npx tsc --noEmit`. The only test that reads ci.yml text is b15-docs-pipeline-is-wired.test.ts:196 (docs:build).
- **Question:** Should the separate 'TypeScript (tsc --noEmit)' step be dropped from both CI build jobs, once typecheck:tests also covers next.config.ts and playwright.config.ts?
- **Options:**
  - **Drop the step, widen typecheck:tests** — tsconfig.tests.json's include gains the two root configs, and ci.yml:97-98 and :151-152 go. testing.md:162, CONTRIBUTING.md:25, the PR template:19 and HANDOVER.md:84 are updated. CI coverage is unchanged, because next build checks the same tsconfig.json program in the same job, including the default moduleDetection that tsconfig.tests.json forces. Only fail-fast ordering is lost. R2, net about -3.
  - **Widen typecheck:tests, keep the step** — The two root configs gain checking in local lint, and CI is unchanged. R0, net +1.
  - **Leave** — src stays type-checked three times in each build job.
- **Recommended:** Drop the step, widen typecheck:tests — typecheck:tests already checks all of src, and next build re-checks the full tsconfig.json program in the same job, so the step adds nothing but ordering.
- **Removes:** The CI step 'TypeScript (tsc --noEmit)' in build-test-ubuntu and build-test-macos, and the `npx tsc --noEmit -p tsconfig.json` line in docs/CONTRIBUTING.md and in the PR template checklist
- **Sceptic:** Read both tsconfigs, ci.yml:95-162, CONTRIBUTING.md:18-32 and the PR template, and grepped every tsc mention and every ci.yml pin in tests. Checked one possible gap: tsconfig.tests.json forces moduleDetection, so it does not check exactly what tsconfig.json checks. next build in the same job covers that difference.
- **Ruling:** Drop the step, widen typecheck:tests, as recommended — Daniel Parke (operator), 2026-09-12.

#### components-01 · The raw-control lint cannot see an opening tag that ends its line; 83 raw controls in components are invisible to it

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R1 · theme D
- **Batch:** governance-discipline-gates
- **Now:** design-lint.mjs:429-436: pattern /<(?:button|input|select|textarea)(?=[\s/>])/, with files() excluding src/components/ui/ and src/kit/. scanTree (:642) splits on /\r?\n/. Probe: design-lint's own RULES and violationsIn imported in memory (the CLI is guarded at :881-883). As shipped the rule finds 0. With the lookahead extended by |$ it finds 104 hits in 43 files: src/components 83 in 33 (models 21, missions 16, memory 14, schedule 12, session 7, dashboard 4, others 9), src/app 20 in 9 (work 10, results 9, agent 1) and src/modules/rec-room 1. A raw git grep over the same scope gives 105 (88 <button, 14 <input, 3 <textarea); one hit is excused by a pragma. c6-the-page-layer.test.ts:57 requires every C6 rule, this one included (:33), to read zero. c6:39 caps C6 pragmas at 12, and the tree has 12 (6 no-inline-card-chrome, 4 no-raw-control-outside-ui, 2 no-raw-write-outside-the-helper). The u2-the-token-layer.test.ts fixtures at :365-369 and :427-431 stay valid.
- **Question:** When the raw-control rule is fixed to see a tag at the end of a line, should its 104 existing hits be held in a written baseline, which changes c6's zero check for this rule, or converted to primitives before the fix merges?
- **Options:**
  - **Fix now, baseline with a reason** — The lookahead gains |$ (+1 line, plus one end-of-line fixture in u2). The design-lint baseline records 43 per-file counts under --allow-growth, and c6:57's check for this rule becomes 'no higher than the baseline'. New raw controls are refused immediately, and the burn-down runs through the component and app batches. R1, net about +60.
  - **Convert first, fix at zero** — The 104 controls become primitives first, and the fix then merges with c6 unchanged. The gate stays blind meanwhile, and with 12 of 12 C6 pragmas used every site must convert. R1.
  - **Leave the rule blind** — The reported 0 stands, and component batches are refereed by a gate that cannot see raw controls.
- **Recommended:** Fix now, baseline with a reason — The batches that convert these controls should be refereed by a gate that can see them, and a written baseline is the sanctioned way to hold existing hits. The c6 change is one assertion and leaves the gate stronger.
- **Sceptic:** Re-ran the in-memory probe: shipped 0, patched 104 in 43 files, with the same per-directory split. Re-ran the raw grep (105) and the pragma counts (12 against a ceiling of 12), and read c6:20-70 and the u2 fixtures. The only addition is the end-of-line u2 fixture.
- **Ruling:** Fix now, baseline with a reason, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-04a · The try/catch census is blind to hand-rolled log-and-500 catches (census part, split from app-04)

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** governance-discipline-gates
- **Now:** line-census.mjs:96-100 counts a route only if its code calls serverErrorFromCatch. `node scripts/tooling/line-census.mjs --report` (which exits at :258-260, before the write at :286) gives routesWithTryCatch 13, equal to the baseline. A brace-matched probe over 99 route files finds 11 catches that call logApiError, answer 500 and do not call serverErrorFromCatch, in 6 files: sync x2 (:56, :107), update x2 (:85, :132), mission-categories x4 (:62, :88, :122, :167), admin/sessions/backfill-status x1 (:73, 'Backfill failed'), models/fallbacks x1 (:129, a file already counted), and memory/hindsight x1 (:101), which answers 503 for a connection error and 500 otherwise, with the message at top level and in the envelope. Widening therefore moves the measure from 13 to 18 files, or to 17 if a catch that may answer 503 is excluded. Pins: c0-the-line-census.test.ts:32 (MEASURES) and :119; c8-the-programme-is-closed.test.ts:43 (TARGET 13), :88-91 ('met' check) and :81 (key equality); c1-one-route-body.test.ts:106 (literalCatch).
- **Question:** Should the census count every route catch that logs and answers 500, which raises routesWithTryCatch from 13 to 18 and needs c8's closed-programme check amended?
- **Options:**
  - **Widen the same measure** — The census matches the log-and-500 shape, and its baseline rises from 13 to 18 (17 if the 503-capable hindsight catch is excluded) under --allow-growth. c8's TARGET for this key is amended, or the key leaves c8's met list. R1, net about +5.
  - **Add a separate measure** — A new key counts the 11 hand-rolled catches, and routesWithTryCatch keeps its meaning. c0's MEASURES and c8:81 change. R1, net about +8.
  - **Leave the measure** — The 11 catches stay invisible to the census.
- **Recommended:** Widen the same measure — The measure is meant to count route bodies that keep their own try, and matching a helper name undercounts them. Both options edit c8 anyway.
- **Sceptic:** Re-ran the census report and my own catch probe, read every catch body, and grepped the c0, c8 and c1 lines. The draft missed memory/hindsight/route.ts:101, so the total is 11 catches in 6 files and the widened measure reads 18, or 17 by the stricter definition, not 17. The c8 met check is at :88-91.
- **Ruling:** Widen the same measure, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-04b · Converting hand-rolled catches changes some 500 bodies (response part, split from app-04)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** app-routes · **after:** app-04a
- **Now:** sync/route.ts:107-113 answers `{ error: 'Failed to trigger sync: ' + String(error) }`. mission-categories/route.ts:62-66 answers serverError(toError(error).message || 'Failed to load categories'), and :122-125 falls back to 'Update failed'. The POST catch (:88-94) and DELETE catch (:167-173) inspect the message to answer conflict or forbidden, so they keep their own try. update/route.ts:85-88 and :132-135 already answer fixed sentences. memory/hindsight/route.ts:101-122 translates the error (memoryFailureMessage), answers 503 or 500, and repeats the message in `data`, so no shared helper reproduces that body. Pins: mission-categories-route.test.ts:201 ('Failed to load categories'), deploy-action-fallback.test.ts:20 and :64 ('Update failed').
- **Question:** May sync POST and mission-categories GET and PUT stop putting the thrown error text in their 500 bodies?
- **Options:**
  - **Fixed sentences through route()** — Three handlers answer a fixed sentence, so clients stop seeing the thrown text (it is still logged), and the pinned tests are edited. The hindsight and mission-categories POST/DELETE catches stay hand-rolled. R2 (public contract), net about -30.
  - **Keep the text, use serverErrorFromError** — Bodies are unchanged, the three catches use the shared helper, and sync GET and update GET/POST move to route() with their existing sentences. The hindsight catch stays as it is. R1, net about -15.
  - **Leave** — The hand-rolled catches stay.
- **Recommended:** Keep the text, use serverErrorFromError — It removes the hand-rolled shape without changing any observable response, and the pinned sentences stay.
- **Sceptic:** Read each catch body and re-grepped the pins. Added the memory/hindsight catch: its two-level, 503-aware body cannot move to a shared helper without a contract change, so it stays hand-rolled and a widened census counts it permanently. The recommendation stands.
- **Ruling:** Keep the text, use serverErrorFromError, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-02 · Root documents are outside the link gate, and C7 broke two of their three links

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R1 · theme D
- **Batch:** docs
- **Now:** check-doc-links.mjs:21 sets DOCS to docs, and :39 walks only that directory. An exact-case scan of the 16 tracked .md files outside docs/, org/ and data/seed/ (node over git ls-files) finds exactly 3 broken links: TRADEMARK.md:27 -> src/lib/theme.ts, and branding/guidelines/COLORS.md:16 -> ../../docs/design-tokens.md and ../../src/lib/theme.ts. The targets now live at src/lib/ui/theme.ts and docs/contributing/design-tokens.md (`ls`). C7 broke the two theme.ts links and B15 (41ddb25b) the design-tokens one. docs-pages.yml:15-17 runs npm ci, docs:check and docs:build, not check-doc-links.
- **Question:** May the three broken links in TRADEMARK.md and branding/guidelines/COLORS.md be corrected to the files' current paths when the link gate is widened to root and branding markdown?
- **Options:**
  - **Widen and fix the paths** — The checker walks tracked .md files minus org/ and data/seed/, 16 more files. The three links point at src/lib/ui/theme.ts and docs/contributing/design-tokens.md, with no legal wording changed. Lint stays green. R1, net about +4.
  - **Widen, exempt the legal files** — The other 13 files are checked, while TRADEMARK.md and branding/ stay broken and unchecked. R1, net about +6.
  - **Leave root docs unchecked** — The 3 broken links stay, and tooling-19 does not land.
- **Recommended:** Widen and fix the paths — The edits are path-only, and they make the documents' 'canonical implementation' pointers true without touching their terms.
- **Sceptic:** Re-ran an independent exact-case scan of all 91 tracked md files in scope: the same 3 links outside docs/ and the 6 case-only links inside it. Ran ls on both new targets and read check-doc-links.mjs:15-60 and docs-pages.yml.
- **Ruling:** Widen and fix the paths, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-16 · knip is green partly because its config hides test-harness orphans, a dead devDependency and unlisted dependencies

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** governance-discipline-gates · **after:** cross-cutting-22, tooling-02, POLICY-dependabot
- **Now:** knip.json:2 points $schema at knip@5; node_modules/knip is 6.16.1. The project globs (knip.json:11-17) cover src, scripts and the mock servers, and entry adds only tests/integration/runtime/*.mjs (:9). ignoreDependencies lists ts-jest, tailwindcss, @jest/globals and jsdom (:18-23). A read-only probe for exports with no importer anywhere in tests, src, scripts or the root configs finds 16 in tests/helpers and tests/e2e/lib: census-analysis.ts 8 (Rgba, Rgb, round2, BorderRecord, TextRecord, BoxRecord, GeometryRecord, LOWER_IS_BETTER), api-test-helpers.ts 3 (expectJsonResponse, setupFsMocks, setupRouteMocks), baseline-db.ts 1 (MigrationApplier), fetch-map.ts 1 (FetchMapOptions), mocks.tsx 2 (MockNextRequest, RecordedResponse) and story.tsx 1 (StoryFixture). baseline-fix-verify.mjs, poll-pair.mjs and poll-run.mjs have no reference in any tracked file outside org. The exact widened knip output cannot be produced read-only; it needs a widened knip.json and `npm run lint:knip`. origin/dependabot/npm_and_yarn/dev/knip-6.32.2 bumps knip (engines ^20.19.0 || >=22.12.0).
- **Question:** Should knip's project and entry be widened to tests/, test-harness/ and the root configs, taking the new findings (about 16 test-helper exports and three harness orphans) as their own batch?
- **Options:**
  - **Widen and fix what it surfaces** — entry and project gain tests/**, test-harness/**, jest.config.js and playwright.config.ts, with jest and Playwright entry detection. Dead exports are deleted, including tests-13's three with read-only-is-testable.test.ts:99-102 repointed, and the harness orphans go with tooling-02. lint:knip is green in the same batch. R1, net about -90 to -150.
  - **Widen with a written ignore list** — Today's findings go into ignoreExports and ignoreFiles with reasons and are burned down later. R1, net about +20.
  - **Keep the scope** — knip stays blind to tests and harness code.
- **Recommended:** Widen and fix what it surfaces — The known findings are few and dead, so fixing them costs less than keeping an ignore list, and the gate then covers the code where the orphans live.
- **Sceptic:** Re-ran the knip version, knip.json, the harness reference scan and my own export probe. My first probe was broken by backslash collapse and was re-run without backslashes. Corrected the export count to 16: census-analysis.ts has 8, including Rgb, and knip's exports check reports an export used only inside its own file. Added the read-only-is-testable repoint that tests-13's deletions need.
- **Ruling:** Widen and fix what it surfaces, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-28a · Two react-hooks rules are off globally on a justification that is no longer true (split from tooling-28)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme D
- **Batch:** tooling-ci
- **Now:** eslint.config.mjs:31-33 turns react-hooks/set-state-in-effect off, citing CardDetailModal, which no other tracked file names (`git grep -l`). :34-38 turn preserve-manual-memoization off, citing 'React Compiler (babel preset) in CI'. babel-plugin-react-compiler is only next's optional peer (package-lock.json:10336, :10348) and is not installed (`ls node_modules`). eslint-plugin-react-hooks is 7.0.1. ESLint API, cache and fix off, both rules at error over src (789 files): set-state-in-effect 39 in 29 files, preserve-manual-memoization 3 in 1 file (src/app/results/sessions/[id]/page.tsx:54, :67, :88). The memoization messages read 'Compilation Skipped: Existing memoization could not be preserved', a React Compiler diagnostic. set-state-in-effect reads 'Calling setState synchronously within an effect can trigger cascading renders' (e.g. DirectoryPickerModal.tsx:53).
- **Question:** Should the two globally disabled react-hooks rules be re-enabled (42 violations today), or stay off with a truthful reason?
- **Options:**
  - **Re-enable both** — The 39 set-state-in-effect sites in 29 components and the 3 memoization sites are rewritten, or excused with a reasoned eslint-disable-next-line, in one batch under --max-warnings 0. Rewriting effects carries behaviour risk. R1, net roughly -40 to +40.
  - **Re-enable the memoization rule only** — 3 useMemo/useCallback sites in one page are reshaped so a compiler that is not installed could preserve them; set-state-in-effect stays off with a true reason. R1, net about +3.
  - **Keep both off, fix the comments** — eslint.config.mjs:31-38 say what is true: no React Compiler is installed, so the memoization diagnostic has no runtime effect, and set-state-in-effect has 39 sites left for component batches to take with their own ruling. R0, net about -2.
- **Recommended:** Keep both off, fix the comments — The memoization rule reports what React Compiler could not preserve, and no compiler is installed, so its three hits change nothing at runtime. set-state-in-effect flags a real pattern, but its 39 sites need behaviour review in component batches. A truthful comment is the only change the evidence supports now.
- **Sceptic:** Re-ran the ESLint API measurement (39/29 and 3/1 reproduce) and read the rule messages. The draft recommended re-enabling the memoization rule because it had the fewest sites, but its messages are compiler diagnostics ('Compilation Skipped') and the compiler is absent, so re-enabling it buys nothing. I changed the recommendation to fixing the comments at R0 and left set-state-in-effect to the component batches.
- **Ruling:** Keep both off, fix the comments, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-22 · Dependency and knip hygiene: misplaced @types, unused ts-jest hidden by a knip ignore, undeclared test imports, redundant Next option

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** tooling-ci
- **Now:** package.json:62 lists @types/js-yaml under dependencies. ts-jest (package.json:91) is referenced only at knip.json:19 (`git grep -n ts-jest`, lockfile excluded). @jest/globals is imported only at tests/unit/dashboard-helpers-unit.test.ts:5 and is hidden by knip.json:21. `require("jsdom")` at b6-cleared-defaults-stay-cleared.test.ts:617 is hidden by knip.json:22. That suite is `@jest-environment node` on purpose: its :2 reason says better-sqlite3 is not newable under the jest transform and the hook harness loads react-dom after the DOM globals exist. jsdom 26.1.0 is already hoisted (package-lock.json:9379). knip.json:2's schema is knip@5, against 6.16.1 installed. next.config.ts:27-29 sets experimental.optimizePackageImports ['lucide-react'], which Next 16.2.9 always merges (node_modules/next/dist/server/config.js:984-988). The output canary hashes next.config.ts through normaliseModuleSource, which only collapses whitespace and trailing commas (output-canary.mjs:217-229, :357-364; golden appConfig at output-canary.golden.json:10). No install omits devDependencies: Dockerfile:8 runs `npm ci` before NODE_ENV=production at :25, and setup.sh:194 runs `npm install`. Every ignoreBinaries entry has a user in scripts, src or package.json by grep.
- **Question:** May ts-jest and the redundant experimental.optimizePackageImports key be removed with the other dependency-hygiene fixes, re-blessing the output canary in the same commit?
- **Options:**
  - **All fixes, declare jsdom, re-bless canary** — ts-jest and its ignore go, and @types/js-yaml moves to devDependencies. dashboard-helpers-unit.test.ts:5 drops the @jest/globals import in favour of jest's globals. jsdom becomes a declared devDependency (already installed) so its ignore goes. The schema moves to knip@6, and next.config.ts:27-29 are deleted with `npm run canary:bless` in the same commit, because canary:check fails otherwise. The lockfile regenerates. R1, net about -6 plus lockfile and golden.
  - **All fixes except next.config.ts** — As above, but the experimental block stays, so there is no canary re-bless. R1, net about -3 plus lockfile.
  - **Replace the jsdom require with the jsdom environment** — Switches b6-cleared-defaults-stay-cleared to a jsdom environment, which its own reason says breaks the better-sqlite3 half. Needs a per-suite identity proof and may not be possible. R1.
  - **Leave** — knip stays green by ignoring what it would report.
- **Recommended:** All fixes except next.config.ts — Nothing imports ts-jest, and declaring jsdom is a like-for-like fix for a suite that builds its own DOM by design. The redundant Next option saves three lines, and deleting it costs a canary re-bless of the URL-contract surface, so it is not worth doing now.
- **Sceptic:** Re-ran every grep, read the b6 suite header and :610-622, the Dockerfile, Next's config.js and the canary normaliser and golden. Found two hidden costs the draft missed. Deleting next.config.ts:27-29 changes the canary's appConfig hash, so a re-bless is needed. And the jsdom require cannot simply become the jsdom environment, because the suite runs under node on purpose. I changed the recommendation to declaring jsdom and keeping the Next option, and restated the operator reason.
- **Ruling:** All fixes except next.config.ts, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-17 · pnpm configuration beside an npm lockfile makes every npm command warn

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme D
- **Batch:** tooling-ci
- **Now:** `npm config get registry` prints three `npm warn Unknown project config` lines: packageManager, approve-builds, shamefully-hoist. .npmrc:1, :2 and :12 set them, and :3-11 is the hoisting comment. package.json:95-102 holds pnpm.onlyBuiltDependencies. node_modules/.pnpm is absent and node_modules/.package-lock.json is present. .gitignore:48-52 and :70-73 both list pnpm-lock.yaml, pnpm-workspace.yaml, a.out and !/.npmrc. Dockerfile:8 and ci.yml:76, :145, :213 and :273 run npm ci. `git git grep -n -i pnpm` outside the lockfile and org finds only .gitignore, .npmrc and package.json. No test, src, script or doc mentions .npmrc.
- **Question:** Should the repository standardise on npm by deleting the pnpm settings in .npmrc and package.json and the duplicated .gitignore lines?
- **Options:**
  - **Standardise on npm** — .npmrc (12 lines), package.json:95-102 and the duplicated .gitignore lines go, and the npm warnings stop. pnpm users lose onlyBuiltDependencies and shamefully-hoist, which no doc mentions. Windows development is unaffected, since npm already ignores the keys. R0, 3 files, net about -25.
  - **Keep pnpm settings, document both** — A docs note on pnpm is added and the warnings continue. R0, net about +5.
  - **Leave** — Every npm command keeps warning, and npm says the keys stop working in its next major version.
- **Recommended:** Standardise on npm — CI, Docker and the local install all use npm, npm already ignores the keys, and no document promises pnpm support.
- **Removes:** pnpm-only install settings (.npmrc packageManager, approve-builds and shamefully-hoist; package.json pnpm.onlyBuiltDependencies), which no document mentions
- **Sceptic:** Reproduced the three warnings with `npm config get registry`, read .npmrc, .gitignore:40-80 and package.json, and grepped pnpm and .npmrc across the tree. Nothing pins the file.
- **Ruling:** Standardise on npm, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-23 · npm script names overlap and some have no users

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** tooling-ci · **after:** tooling-02, tests-18a, tests-18b
- **Now:** package.json:10-57 holds 48 scripts. Five have no reference outside package.json, the lockfile and org (`git grep -l -w -F` per script): dev:network, test:watch, test:full-install-hermes (cited only at org/plans/2026-09-final-release.md:808), test:restart-recovery and test:e2e-bench-gateway. One reference each: lint:design, canary:snapshot, canary:assert, canary:move-neutral, discover-hermes, test:smoke-composer, test:full-install-release and test:docker-deploy-smoke. test:e2e-runtime has more (testing.md:113, runtime-architecture.md:90 and :182). ci.yml:110 runs `npm run canary -- --out`, the same command as canary:snapshot (package.json:46). Suites pinning script text: b15-docs-pipeline-is-wired.test.ts:62-92, u16-the-docs-describe-the-system.test.ts:107-112, b2-copy.test.ts:67-68, icon-buttons-are-named.test.ts:127-129, c0-the-line-census.test.ts:66.
- **Question:** Should npm scripts be renamed to one naming scheme?
- **Options:**
  - **Adopt one scheme** — For example test:e2e-runtime becomes smoke:runtime, test:smoke-composer smoke:composer, test:e2e-hermes itest:hermes and lint:design census:design, and canary:snapshot folds into canary. The old names stop working. Edits ci.yml:409, up to 5 pinned suites and at least 4 docs. R2 (ci.yml), net about -3.
  - **Keep names, remove only what is dead** — test:e2e-bench-gateway goes with tooling-02 (tests-18b), and test:restart-recovery is documented under tests-18a. dev:network, test:watch and test:full-install-hermes stay: the first two are conventional conveniences, and the third is the release-profile harness an org plan names. R1, net -1.
  - **Keep all 48** — No change.
- **Recommended:** Keep names, remove only what is dead — Renames save about three lines but remove documented commands that people and CI call, and the one dead script is already covered by tooling-02.
- **Removes:** npm run test:e2e-bench-gateway (through tooling-02)
- **Sceptic:** Re-ran a per-script reference loop over all 48 scripts. test:full-install-hermes has no reference at all outside an org plan, so five scripts are unreferenced, not four. Also added test:docker-deploy-smoke to the one-reference list, moved test:e2e-runtime off it, and added the c0:66 pin. The recommendation stands.
- **Ruling:** Keep names, remove only what is dead, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-31 · build-test-macos repeats the full Ubuntu gate for a platform ruled dev-tier

- **Re-verified:** moved · sceptic: upheld · **tier floor:** R2 · theme D
- **Batch:** tooling-ci · **after:** tests-20
- **Now:** build-test-macos (ci.yml:124-162) runs prebuild (:146-147), lint (:148-149), the forbid-hermes-paths action (:150), tsc (:151-152), test:coverage (:153-154) and build (:155-162). boot-smoke also runs on macos-latest (:167-190). The tier table is at docs/running/cross-platform.md:30 (not :29): macOS is 'Best-effort developer environment (Unix); built + unit-tested in CI.' testing.md:162 lists 'build-test-macos (build + test)'. macOS runners use a case-insensitive filesystem by default, so check-doc-links' existsSync (check-doc-links.mjs:54) is weaker there than on Ubuntu.
- **Question:** Should the macOS CI job drop its platform-independent steps, or be cut further to install, build and boot-smoke?
- **Options:**
  - **Drop lint, grep gate, tsc and explicit prebuild** — ci.yml:146-152 go. Unit tests with coverage and the build stay, so cross-platform.md:30 stays true. No unit test reads prebuild output, but jest on macOS without prebuild is unmeasured. R2, net -7.
  - **Install, build and boot-smoke only** — Also drops test:coverage on macOS. cross-platform.md:30 and testing.md:162 change the documented tier to 'built in CI'. R2, net about -9 plus doc edits.
  - **Keep as is** — macOS repeats every Ubuntu check.
- **Recommended:** Drop lint, grep gate, tsc and explicit prebuild — It keeps the documented 'built + unit-tested' tier and removes steps whose result cannot differ from Ubuntu's, or is weaker on a case-insensitive filesystem.
- **Sceptic:** Read ci.yml:124-190 and cross-platform.md:24-34 (the tier row is at :30) and checked which tests read public/help. Added that dropping prebuild before jest looks safe but is unmeasured.
- **Ruling:** Drop lint, grep gate, tsc and explicit prebuild, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-25 · Of three compose files, one is exercised in CI, one only in docs, one is dead

- **Re-verified:** moved · sceptic: upheld · **tier floor:** R2 · theme D
- **Batch:** tooling-ci
- **Now:** `git grep -n 'docker compose' -- .github tests/scripts` finds real-hermes-itest.sh:9 and bench-gateway-itest.sh:8. The first uses docker-compose.real-hermes.yml and runs through test:e2e-hermes in real-hermes-integration (ci.yml:396-409). docker-image builds only the Dockerfile (ci.yml:378; the review said :377). docker-compose.yml (patterstage at :16, mock-hermes at :34-42) has no env_file, so validating it needs no .env. It is documented at docs/running/deploy.md:31 and :115-119 and at docs/reference/runtime-architecture.md:85 and :182, and exercised nowhere. docker-compose.bench-gateway.yml belongs to tooling-02.
- **Question:** Should CI validate docker-compose.yml, the documented try-it path, so it cannot rot unseen?
- **Options:**
  - **Validate the file** — `docker compose -f docker-compose.yml config -q` runs in the docker-image job. It catches YAML and schema breakage, not runtime faults. R2, +2 lines.
  - **Bring the stack up** — CI runs compose up, probes /api/health, then compose down. It catches runtime faults, at several CI minutes per run. R2 (ci-stateful-infra), about +15 lines.
  - **Docs-only** — No change; docker-compose.yml can break without any signal.
- **Recommended:** Validate the file — It is the cheapest check that keeps a documented entry point parseable, and the docker-image job already builds the Dockerfile the compose file uses.
- **Sceptic:** Re-ran the compose grep and read docker-compose.yml, the deploy.md and runtime-architecture.md hits and ci.yml:363-409. Corrected the deploy.md range to :115-119 and noted there is no env_file dependency.
- **Ruling:** Validate the file, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-dependabot · Ten dependabot updates target dev from a stale base

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme D
- **Batch:** tooling-ci
- **Now:** `git branch -r` lists 10 origin/dependabot/npm_and_yarn/dev/ branches, each 1 commit ahead. Nine are 424 behind origin/dev (ce4ac1fd, merge-base 43d16c30, 2026-08-26); tsx-4.23.12 is 351 behind (4e5b2c92, 2026-08-30). Package diffs (`git diff origin/dev...<branch> -- package.json`), all minor or patch: dagre ^3.1.1, eslint-config-next 16.3.2 (branch lockfile @next/eslint-plugin-next 16.3.2 while next stays 16.2.9), knip ^6.32.2 (engines ^20.19.0 || >=22.12.0), lucide-react ^1.33.0, multi-9b1536b8cd with react 19.2.8 and @types/react ^19.2.18 (branch lockfile keeps react-dom 19.2.7), @playwright/test ^1.62.1, @tailwindcss/postcss ^4.3.3 (lockfile tailwindcss 4.3.3, within package.json's ^4.3.1), react-query ^5.102.2, tsx ^4.23.12, xyflow ^12.11.3. node_modules/react-dom/cjs/react-dom-client.production.js:15917-15928 throws error 527 when React.version !== '19.2.7'. dev's package-lock.json still resolves every old version. Both merge-base lockfiles are 26,886 lines, and dev's is now 13,481 (41ddb25b -13,443/+107; 0d7ae16a -69), so every branch needs a rebase. .github/dependabot.yml:9 sets open-pull-requests-limit 10. Pull request state and newer upstream versions were not queried, since that needs the network.
- **Question:** What happens to the ten dependabot updates on dev: land the safe ones as their own gated batch, close them all until after the Node upgrade, or fold them into the Node upgrade batch?
- **Options:**
  - **Land the safe ones, close the React pair** — Rebase and land dagre, xyflow, react-query, lucide-react, tsx and @tailwindcss/postcss as one batch through the full gate. knip and Playwright land as separate steps, because they can move lint:knip findings and the design census and screenshots. eslint-config-next lands only with a matching next bump, or waits. Close multi (react without react-dom) and add dependabot groups for react with react-dom and next with eslint-config-next in .github/dependabot.yml (not a workflow file). R1, net about +10 plus lockfile.
  - **Close all ten, reopen after the Node upgrade** — No dependency changes now. After tooling-04, dependabot proposes current versions again. The slots free at once while the safe bumps wait. Net 0.
  - **Fold into the Node upgrade batch** — One lockfile regeneration and one full gate at R2 through tooling-04's workflow and Dockerfile edits. A failure mixes a runtime change with ten library changes, so bisecting costs more.
- **Recommended:** Land the safe ones, close the React pair — None is a major, and six are patch or minor bumps the gate can check in isolation. The React pair is a proven load-time throw that grouping prevents, and waiting keeps every slot occupied.
- **Sceptic:** Re-ran the ahead/behind counts, merge-bases, package diffs, branch lockfile versions, knip engines, lockfile line counts and dev's resolved versions, and read react-dom's guard at :15917-15928. Two corrections. tailwindcss 4.3.3 satisfies ^4.3.1, so that is not a skew. The eslint-config-next and next mismatch has no demonstrated failure, so I no longer call it a hazard. I dropped the claim that 'next itself' cannot open, because it needs the network, and renamed the option to match.
- **Ruling:** Land the safe ones, close the React pair, as recommended — Daniel Parke (operator), 2026-09-12.

### Theme E

All 18 requested ids have entries: app-01 (a to h), app-15 (a, b), docs-04, tooling-02, tooling-12 (a to c), lib-data-05, lib-data-08, lib-data-09 (a, b), critic-07, critic-09, app-22, components-16, docs-22, docs-12 (a, b), lib-domains-05 (a to c), hooks-15 (a, b), tooling-13 and lib-data-20. Following the draft, executor rows stay in entries with operator_needed false, so verified is empty.

1. Routes: four documented routes have no caller, not five. They are backfill-status, agents/progression, memory and missions/[id]. Three routes the review or the draft called uncalled are reached by the runtime smokes:
- missions/[id]/cancel (full-stack-smoke.mjs:149)
- runs/[id] (full-stack-smoke.mjs:106, :215; the draft missed this one)
- runs/reconcile (composer-smoke.mjs:110, :136; full-stack-smoke.mjs:105, :214)

If the operator keeps the plan's rule (consolidation.md:305-306), all four uncalled routes are 'keep and label'. For missions/[id], T-0074 (status proposed) still leaves the REST shape to an ADR. A literal caller gate (app-01h) would fail today on 5 of 99 routes: the four, plus /api/models/sync/pull, which useModelActions.ts:89 calls as `/api/models/sync/${action}`. Any route removal must delete its api.md row in the same commit, or b1-api-md-matches-the-route-tree fails. Separately, full-stack-smoke.mjs:150 checks data.cancelled, but the handler answers { mission, cancel } (cancel.ts:47-49), so that check is probably stale. Confirming it needs npm run test:e2e-runtime.

2. Redirects: 52 entries in all, 22 literals, 27 generated and 3 Story Weaver; 26 counts lines, not entries.
- Where the old URLs come from: 18 were pages on origin/main and 34 were dev-only, and install.sh:45 defaults installs to dev.
- What removing redirects() does: 25 old URLs 404. The 27 /agent/settings/<section> URLs still reach their anchor through a client-side replace in src/app/agent/settings/[section]/page.tsx:76-80. That changes both the removal and the partial-removal consequences.
- Test pins: config-section-redirect.test.ts is T-0038's resolver oracle, not a redirect pin, and the real test cost is about 220 lines, not 350.
- docs-04: its operator question duplicated app-15a, so the 'leave the date open' option now sits in app-15a.
- /orchestration/cron: its removal is documented at migration.md:188 (page deleted in bef00ba7), so the missing redirect may be deliberate. Only the CHANGELOG line is missing.

3. tooling-13 is the decision that matters most in this theme, and its evidence changed. prebuild spawns seed-catalog.ts, which opens getDb() (catalog-seed.ts:277; index.ts:90-103), so every successful build migrates {repo}/data to head. On a default install that directory is the live data dir (install.sh:44, setup.sh:148, paths.ts:41-67). The build runs before the backup (setup.sh:214 vs :245; ps-deploy.mjs:416 vs :423), so the documented backup-first order (migration.md:180) does not hold today on the default layout. The unlink of a DB below v3 (prebuild-db.mjs:62-70) and the key copy (hermes-registry-import.mjs:255-272) act on that same live file.

import-hermes-state.ts covers only profiles, root and skills. Removing the build's DB work therefore also removes the automatic Hermes key and model import, and that needs its own ruling. I added 'back up before building' as a fallback option, and lib-data-20 follows mechanically.

hermes-registry-import.mjs (313 lines) is called only by prebuild-db.mjs:10 and :126 and by the unreachable upgrade.ts:255 spawn. If tooling-13's 'no database' option and lib-data-05's 'remove' option both land, it has no caller and needs a ruling with them. Two further dependencies:
- The install-harness job, required by ci.yml:432-441, copies the prebuild DB as its fixture (test_full_install_update_process.py:473-479), so the fixture swap must land in the same change.
- The premise that next build needs no DB cannot be checked read-only; it needs PS_DATA_DIR=$(mktemp -d) npx next build on a tree without data/patterstage.db.

4. lib-data-05 turns on one operator fact: does any install last updated before 2026-05-19 still exist? The squash 31804e8b and a02c0e15 are both on origin/main, with 319 earlier main commits, and the operator's own data/ shows the last real rebuilds at 2026-05-21T18:23-18:31Z. The draft missed that testing.md:51 also documents the fallback, and that the in-app Update path (ps-deploy.mjs) never prints the rebuild warning.

5. Tier reading for five dead-code entries (lib-data-09a, components-16, docs-12b, lib-domains-05a, hooks-15a). Each removes an export or prop, so each is R2 on the literal public-contract reading ('exported interface delta'), which derived:public-api-delta would test but cannot be run read-only. If the operator reads public-contract as only the documented HTTP and CLI surface, they drop to R0 or R1.

6. Ownership changes. app-01f, docs-04 and docs-12a are now operator_needed false: app-01f has callers, docs-04 duplicates app-15a, and site/search.json was never published. tooling-12a stays with the operator, but with a corrected reason: its target, Hindsight, is still supported, and ps-watchdog is only a comment. Consequence corrections also landed in:
- app-01b: readAgentProgressionHistory is T-0016's immutability-proof reader.
- app-15b: the e2e row changes, not b3 unit :34.
- lib-data-09b: db-baseline.test.ts reads the immutable baseline, so a drop leaves it alone.
- critic-09: the rgb mirrors are documented as a family; the recommendation stands.
- docs-12b: re-point the fragment contract tests, do not delete them.
- hooks-15a: ColorEntry types nine maps.
- tooling-12c: setup.mjs has no caller.

7. Where the recommendations land. Removal is recommended for tooling-02, tooling-12a, lib-data-05, tooling-13 (conditional), lib-data-20, lib-data-09a, components-16, docs-12a, docs-12b, lib-domains-05a, hooks-15a and the four rgb mirrors in critic-09. Keep is recommended for:
- the documented routes, and the smoke-called routes
- the redirects until the release after 1.0.0
- lib-data-08 (ADR-0004:140-142, data-storage.md:115) and the sync_registry table
- the seed YAML (drift test instead) and the Story Weaver fonts
- branding/assets, MODULE_ACCENTS, the four declared APIs (limitations.md:89-92 documents the framework seam) and the theme.ts token mirror (about 33 lines)
- eos-compile.mjs and migrate-to-runtime.mjs

8. Most of the theme's line savings sit outside the census, which walks only src and tests (line-census.mjs:50-51). Outside it are critic-07's 1,158 YAML lines, the tooling-02 and tooling-12 files, next.config.ts and the prebuild scripts.

A method note on the route scan: my first scan run was invalid because the shell collapsed its regex escapes. The rerun used character classes built with String.fromCharCode, and only that rerun is cited.

#### app-01a · POST /api/admin/sessions/backfill-status: keep or remove

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** app-routes
- **Now:** wc -l src/app/api/admin/sessions/backfill-status/route.ts = 93. git grep -n -F 'admin/sessions/backfill-status' -- . ':!org/reviews' finds docs/reference/api.md:94, the route's own lines, a comment at src/lib/sessions/session-orphan-sweep.ts:100 and the historical org/tasks/T-0049.json:25. A literal caller scan finds no caller. The scan was a node -e over git ls-files for src, scripts, tests/integration, tests/e2e, mock-* and test-harness, with comment lines dropped. api.md:94 says 'See MISSIONS.md', but grep -n -i 'backfill|orphan' docs/guides/missions.md finds nothing. tests/unit/b1-api-md-matches-the-route-tree.test.ts:1-6 holds the api.md rows and the route.ts files equal in both directions.
- **Question:** Keep POST /api/admin/sessions/backfill-status, the documented manual sweep of stuck sessions that nothing in the repo calls, or remove it before v1.0.0?
- **Options:**
  - **Keep and label as operator API** — The api.md:94 description gains 'operator action, no UI caller'. b1-api-md-matches-the-route-tree reads only the first cell, so it stays green. The route goes on the app-01h allowlist with that reason. Nothing is removed and no tests change. R0, about +1 line.
  - **Remove before v1.0.0** — Deletes the 93-line route and, in the same commit, the api.md:94 row; otherwise b1-api-md-matches-the-route-tree fails. Also deletes the session-orphan-sweep.ts:100 comment. A caller gets 404 and loses the only on-demand, dry-run-first sweep; the 15s sync still runs. No other test changes. R2 public-contract, about -95.
- **Recommended:** Keep and label as operator API — It is a documented operator tool with a dry-run default (api.md:94). The consolidation plan's rule is not to shorten the documented API surface (org/plans/2026-09-consolidation.md:305-306), and removal saves 93 lines at an R2 floor.
- **Sceptic:** Re-ran wc, the whole-repo git grep and a literal caller scan: no caller. Added that the b1-api-md-matches-the-route-tree pin forces the api.md row out in the same commit as any removal. Also added that api.md:94's MISSIONS.md cross-reference says nothing about the sweep. Recommendation unchanged.
- **Ruling:** Keep and label as operator API, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-01b · GET /api/agents/progression: keep or remove

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme E
- **Batch:** app-routes
- **Now:** wc -l = 51. The literal caller scan finds no caller in src, scripts, tests/integration or tests/e2e. git grep -n -F 'agents/progression' hits api.md:56, a comment at src/lib/stats/agent-progression.ts:246, unit suites and historical tasks. readAgentProgressionHistory (agent-progression-repository.ts:144) has one src caller, route.ts:48. It is also the reader in tests/unit/agent-progression-immutability.test.ts:29 and :121-182, T-0016's proof that snapshots are immutable. readLatestAgentProgressionSnapshots is also used at agent-progression.ts:220, and snapshots are written at :240. Unit pins: agent-progression-route.test.ts (178 lines; imports GET at :38) and the-numbers-are-measured.test.ts:67. org/tasks/T-0016.json:3 records the route as 'a NEW public HTTP contract'. T-0081.json:53 proved a live fix through it.
- **Question:** Keep GET /api/agents/progression, the documented and only HTTP reader of each agent's recorded growth history, even though no screen calls it yet?
- **Options:**
  - **Keep and label** — api.md:56 is marked 'no UI caller yet' and the route is allowlisted in app-01h. R0.
  - **Remove before v1.0.0** — Deletes the 51-line route, the api.md:56 row (b1-api-md-matches-the-route-tree), agent-progression-route.test.ts (178 lines) and the progressionGet cases in the-numbers-are-measured.test.ts. readAgentProgressionHistory must stay, test-only, or agent-progression-immutability.test.ts:121-182, T-0016's data-safety proof, is rewritten. Snapshots keep being written (agent-progression.ts:240) with no HTTP way to read a profile's trail. R2 public-contract, about -51 src and -200 test lines.
- **Recommended:** Keep and label — It is the only way to read the per-profile history the append-only snapshots table exists to keep (route.ts:48). T-0016 shipped it as a public contract. Removing it leaves write-only data and a repository function kept alive only by a test.
- **Sceptic:** The draft's removal option deleted readAgentProgressionHistory as 'left with no caller'. git grep -w shows it is the reader in agent-progression-immutability.test.ts, T-0016's immutability proof, so deleting it would rewrite a data-safety check. Added T-0016.json:3 (a public HTTP contract) and T-0081.json:53 (live verification through the route). Measured the route suite at 178 lines. Recommendation unchanged.
- **Ruling:** Keep and label, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-01c · /api/memory status route: keep or remove

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** app-routes
- **Now:** wc -l = 87. The literal caller scan finds no caller. git grep -n -E "/api/memory([\"'`?]|$)" finds docs/reference/api.md:66 and tests/unit/api-routes-complex.test.ts:209 (describe). It also finds tests/unit/memory-unsupported-write.test.ts:47 (a 61-line file), tests/unit/read-only-actually-reads.test.ts:228, a comment at src/lib/memory/memory-providers/registry.ts:31 and the historical org/tasks/T-0057.json:62. The Memory UI reads /api/memory/config instead (src/components/memory/MemoryProviderSettings.tsx:116, :151, :175). b1-api-md-matches-the-route-tree pins the api.md row.
- **Question:** Keep /api/memory, a documented provider-status GET whose POST, PUT and DELETE always answer 400, which no screen calls, or remove it?
- **Options:**
  - **Keep and label** — api.md:66 is marked 'status endpoint, no UI caller' and the route is allowlisted in app-01h. R0.
  - **Remove before v1.0.0** — Deletes the 87-line route and the api.md:66 row. Edits api-routes-complex.test.ts (describe at :209) and deletes memory-unsupported-write.test.ts (61 lines). Drops '/api/memory' from read-only-actually-reads.test.ts:228 and the registry.ts:31 comment. A monitor polling it gets 404. R2 public-contract, about -87 src and -90 test lines.
- **Recommended:** Keep and label — It is a documented status endpoint an external monitor can poll. Its 400s are a tested, deliberate refusal (memory-unsupported-write.test.ts, and T-0057.json:62 re-checked them by hand). The plan keeps the documented surface (consolidation.md:305-306).
- **Sceptic:** Re-ran the grep and the literal scan: no caller. Measured memory-unsupported-write.test.ts at 61 lines and added the api.md pin and the historical T-0057 check. Nothing else changed.
- **Ruling:** Keep and label, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-01d · GET /api/missions/[id] REST twin: keep or remove

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** app-routes
- **Now:** wc -l = 22. The literal caller scan finds no caller. git grep -n -F 'api/missions/${' -- tests scripts src mock-hermes test-harness, filtered to drop /dispatch, /cancel and /run, returns nothing; the smoke only uses the sub-routes (full-stack-smoke.mjs:96, :148-149). api.md:71 documents it 'for REST symmetry ... The list endpoint also accepts ?id='. Pinned by tests/unit/missions-read-only-reads.test.ts:87-93. org/tasks/T-0074.json has status 'proposed' (node -e). It leaves to an ADR 'whether the five verbs become resources (POST /api/missions, PATCH /api/missions/[id], ... DELETE /api/missions/[id])' (:24). No ADR cites T-0074 yet: git grep over org/decisions and docs/adr is empty.
- **Question:** Keep GET /api/missions/[id], a documented 22-line REST twin of GET /api/missions?id= that nothing calls, or remove it before v1.0.0?
- **Options:**
  - **Keep and label** — api.md:71 already calls it REST symmetry, and the route is allowlisted in app-01h. R0.
  - **Remove before v1.0.0** — Deletes the route, the api.md:71 row (b1-api-md-matches-the-route-tree) and the missions-read-only-reads.test.ts:87-93 case; external GETs get 404. It pre-empts T-0074's open ADR question, which lists PATCH and DELETE /api/missions/[id] as candidate resources. After v1.0.0 the same removal is a breaking change under the semantic versioning CHANGELOG.md:7 adopts. R2 public-contract, about -30 lines.
- **Recommended:** Keep and label — The whole saving is 22 lines. api.md documents the route as deliberate REST symmetry, the plan's rule is not to shorten the documented surface, and T-0074 (proposed) still has to decide whether missions become REST resources.
- **Sceptic:** Re-ran git grep and the literal scan: no caller. Added the open T-0074 record, whose ADR question covers /api/missions/[id]; removing the GET now would pre-empt that decision. Recommendation unchanged.
- **Ruling:** Keep and label, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-15a · When the 52 old-URL redirects are removed

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · theme E
- **Batch:** app-routes
- **Now:** Counts hold; line numbers moved. npx tsx -e prints settingsSectionIds().length = 27. next.config.ts has 22 literal redirects (:72-95), a 27-entry spread (:101) and 3 Story Weaver entries (:105-107): 52 in all. grep -c 'temporary(' = 26 counts lines, not entries. The comment is :54-68 (the 307 rationale is :59-65), redirects() is :69-109, and :3 imports settingsSectionIds. git tag --list | wc -l = 0; package.json:3 is 0.1.0. origin/main (9b786b76, an ancestor of HEAD) had pages for 18 of the old sources (git ls-tree); the other 34 were dev-only, and scripts/bootstrap/install.sh:45 defaults BRANCH to dev. The redirects landed in 539f3c1a and 028e91f5 (2026-09-05) and 90193adc (2026-09-07). CHANGELOG.md:19-20 and :295-296 say 'for this release only'. What removal breaks: 25 sources have no page at HEAD, so they 404 (ls src/app; ls src/app/agent has no personalities; u12:62-68 asserts no library, characters or themes page). The 27 /agent/settings/<id> sources do not 404: src/app/agent/settings/[section]/page.tsx:76-80 router.replaces a valid id to /agent/settings#<id>. Pins: b3-old-paths-redirect.test.ts (74), tests/e2e/b3-old-paths-redirect.spec.ts (52 lines, 24 rows, read without following at :40-44), u11-old-section-paths.test.ts:25-37, u12-five-entries-become-two.test.ts:52-60 and b9-tools-and-skills-routes.test.ts:173-180 (reads next.config.ts text). The canary appConfig carries the redirects (output-canary.mjs:29-30, golden.json:10). tests/unit/config-section-redirect.test.ts is not a pin: it is T-0038's oracle for resolveSectionRedirect (imports config-schema only, :22-27), which the [section] page keeps using. Side note: origin/main had src/app/orchestration/cron/page.tsx, deleted on dev in bef00ba7 (2026-06-19). docs/running/migration.md:188 records the Cron page's removal, but there is no redirect and no CHANGELOG line; that may be deliberate, as with /benchmarks (next.config.ts:59-65).
- **Question:** When should the 52 temporary redirects from the old page addresses go: in the first release after v1.0.0 as the CHANGELOG promises, never, at a date left open, or partly now?
- **Options:**
  - **Remove in the first release after v1.0.0** — Nothing changes now. In the release after 1.0.0, delete redirects(), its comment and the settingsSectionIds import (next.config.ts:3, :54-109), both b3 suites, the u11:25-37 and u12:52-60 cases, and the b9:173-180 case. Re-bless the canary appConfig golden and add a CHANGELOG 'Removed' line. 25 old URLs then 404. The 27 /agent/settings/<id> URLs still land on their anchor through the [section] page's client-side replace. RETIRED_PATHS (scripts/docs/lib.mjs:72-82) stays as a docs guard. R2, about -220 lines including tests (estimate).
  - **Keep them permanently** — Reword CHANGELOG.md:19-20 and :295-296. About 57 config lines and 180 test lines stay; no URL ever breaks. R0.
  - **Leave the date open** — Reword the CHANGELOG to 'for at least this release' (docs-04's middle option). No task, and the removal date stays undecided. R0, net 0.
  - **Remove the 34 dev-only entries now** — The 27 section entries can go without a 404, because the [section] page still redirects client-side. The 7 others (/agent/personalities, /orchestration/composer, /orchestration/scripts, /laboratory/research, /laboratory/artifacts, /laboratory/insights, /insights) 404 on dev-branch installs (install.sh:45). The same suites are edited twice, now and after 1.0.0. R2, about -45 now.
- **Recommended:** Remove in the first release after v1.0.0 — That is the promise already written into the 1.0.0 upgrade notes (CHANGELOG.md:19-20, :295-296). The D13 ruling (org/plans/2026-08-consolidation.md:381) makes 1.0.0 the one release at programme end, so 'this release' is 1.0.0. A partial removal now breaks dev-branch installs, because the installer defaults to dev.
- **Removes:** In the first release after v1.0.0: 25 old page URLs will 404. They are /orchestration/chat, /orchestration/missions, /orchestration/composer, /orchestration/scripts, /laboratory/research, /laboratory/artifacts, /laboratory/insights, /sessions, /sessions/:id, /insights, /logs, /operations/agents, /operations/skills, /operations/skills/:path*, /operations/tools, /operations/personalities, /agent/personalities, /memory, /config, /config/models, /config/seed, /config/:section, /recroom/story-weaver/library, /recroom/story-weaver/characters and /recroom/story-weaver/themes. The 27 /agent/settings/<section> URLs lose their 307 but still reach their anchor client-side. The CHANGELOG-documented redirect behaviour goes too.
- **Sceptic:** Read the [section] page. After removal the 27 section URLs degrade to a client-side hop (page.tsx:76-80) rather than a 404, which changes the removal and partial-removal consequences. config-section-redirect.test.ts imports only config-schema, so it is T-0038's resolver oracle, not a redirect pin; dropped it and re-estimated the removal at about -220, not -350. D13 at consolidation.md:381 rules on the interim security release; it supports only '1.0.0 is this release'. 028e91f5 is dated 2026-09-05. Folded docs-04's 'leave the date open' in as an option. Softened the cron note: migration.md:188 records that page's removal.
- **Ruling:** Remove in the first release after v1.0.0, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-02 · Delete the benchmark-gateway harness and npm run test:e2e-bench-gateway

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R2 · theme E
- **Batch:** dead-code
- **Now:** wc -l over the 8 files gives 39+28+59+17+127+51+23+23 = 367. Outside those files, git grep -n -E 'bench-gateway|baseline-fix-verify|poll-pair|poll-run' -- . ':!org/reviews' hits only package.json:57 and the unrelated src/lib/db/apply-bench-gateways-migration.ts:2 and src/lib/db/index.ts:65. No doc, CI step, test or org task names the script. The harness calls /api/benchmarks/* (bench-gateway-e2e.mjs:58,67,81,95; baseline-fix-verify.mjs:22,29,35; poll-pair.mjs:8; poll-run.mjs:8), and ls src/app/api | grep -i bench is empty. bench-gateway.Dockerfile:7 names src/lib/runtime/gateway-manager.ts, which ls says does not exist. git show -s 4935ac31 gives 2026-07-25 'feat!: delete the benchmark subsystem'. git ls-files test-harness shows hermes-home/ and hermes-seed.Dockerfile, which docker-compose.real-hermes.yml:21 still uses.
- **Question:** Delete the benchmark-gateway harness and its npm script test:e2e-bench-gateway, which cannot pass because the routes it drives were deleted on 2026-07-25?
- **Options:**
  - **Delete all eight files and the script** — Removes the CLI command npm run test:e2e-bench-gateway (package.json:57), docker-compose.bench-gateway.yml, tests/scripts/bench-gateway-itest.sh and five test-harness files. test-harness/hermes-seed.Dockerfile and hermes-home/ stay. No tests or docs change. R2 (docker-compose*.yml is sensitive), -368 lines.
  - **Keep** — A command that cannot pass and 367 lines remain. R0.
- **Recommended:** Delete all eight files and the script — Every request targets /api/benchmarks/*, which 4935ac31 removed, and the Dockerfile names a missing file. The command is dead, undocumented and uncalled.
- **Removes:** npm script test:e2e-bench-gateway; docker-compose.bench-gateway.yml; tests/scripts/bench-gateway-itest.sh; test-harness/bench-gateway.Dockerfile, bench-gateway-entrypoint.sh, bench-gateway-e2e.mjs, baseline-fix-verify.mjs, poll-pair.mjs, poll-run.mjs
- **Sceptic:** Re-ran wc, the reference grep, the /api/benchmarks hits, ls of the missing gateway-manager.ts and git show 4935ac31. All hold. The review also listed baseline-fix-verify.mjs:18; that line is a health poll, not a benchmarks call.
- **Ruling:** Delete all eight files and the script, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-12a · Delete scripts/maintenance/hindsight-rederive.sh

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme E
- **Batch:** dead-code
- **Now:** wc -l = 235. git grep -l -F hindsight-rederive -- . ':!org/reviews' returns only the file. Its header (:3) calls it a 'One-time cleanup for the Hindsight corpus'. It snapshots the hermes bank to hermes_archive (:7), then 'Wipes the hermes bank and re-seeds it' (:15-16); :30 dates it 2026-06-13, and git log --diff-filter=A gives ac69ba85 (2026-06-14). It runs LIVE by default: DRY_RUN=false at :39, --dry-run is opt-in at :40, and :201 sends curl -X DELETE to the bank with no prompt. ps-watchdog appears only in a prerequisite comment (:21); the script never invokes it. No watchdog has been in the tree since scripts/hardware/ch-watchdog.sh was deleted in 84a03784 (2026-05-22), and git log -S ps-watchdog shows only the 4e60055b rename. Hindsight is still a supported provider (docs/guides/memory.md:98 at 127.0.0.1:9177; src/app/api/memory/hindsight/route.ts:5). Not an npm script and not in docs.
- **Question:** Delete hindsight-rederive.sh, a one-time Hindsight memory-bank wipe-and-reseed from June 2026 that nothing references and that runs live by default?
- **Options:**
  - **Delete** — Removes the 235-line script; no tests or docs change, and the procedure stays in git history (ac69ba85). R1, -235.
  - **Keep** — A script that deletes the hermes bank by default, with no prompt, stays runnable against a live Hindsight. R0.
- **Recommended:** Delete — Its own header says it is one-time and nothing references it. It deletes the bank by default (:39, :201), and git history keeps the procedure if the corpus flood recurs.
- **Removes:** scripts/maintenance/hindsight-rederive.sh (undocumented hand-run maintenance script)
- **Sceptic:** The draft said the script 'depends on ps-watchdog, which no longer exists'. ps-watchdog is only named in a comment (:21), and no watchdog has been in the tree since 84a03784. The script targets a subsystem that is still supported, so it is not dead the way tooling-02 is. Added that it is live by default with no prompt (:39, :201), after a snapshot. Rewrote the operator reason, since an undocumented non-npm script is not guardrail-protected. Recommendation unchanged.
- **Ruling:** Delete, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-12b · eos-compile.mjs: require EOS_ROOT, keep the file

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** tooling-ci
- **Now:** wc -l = 248. :24 is `const EOS = process.env.EOS_ROOT || "C:/Users/Daniel/Documents/Coding/Github/PatterTech_EOS"`. That path appears nowhere else outside org/ (git grep -F PatterTech_EOS). :141-160 explains why the parse is left unrepaired, and :162-177 refuses to run on a zero-row matrix. git grep -l eos-compile finds org/decisions/ADR-0010-governance-corpus-lives-under-org.md (:44, :48, :104, :146, protected), org/COMPILE_REPORT.md, org/EOS_FEEDBACK.md, org/VENTURE_BRIEF.md, the historical T-0057.json and T-0109.json, tests/unit/b15-corpus-moves-under-org.test.ts:138-149 and a comment at b15-docs-pipeline-is-wired.test.ts:5. grep -n eos package.json is empty. ADR-0010:146-150 rejected repairing it as 'an estate decision about seed ancestry'.
- **Question:** Keep eos-compile.mjs, the estate compiler that deliberately refuses to run, but make it require EOS_ROOT instead of defaulting to a personal Windows path? Or delete it?
- **Options:**
  - **Keep and require EOS_ROOT** — Line 24 exits with a message when EOS_ROOT is unset. No test or doc edits: the b15 assertions at :142-149 read other strings. Its docs/ paths are not 'fixed' (lines 141-160 explain that a repair regenerates 32 files). It is not an npm script, so on Windows the operator just sets EOS_ROOT in the shell. R0, about +2.
  - **Delete** — ADR-0010 keeps naming a missing file at :44, :48 and :104 (amending it is R3). b15-corpus-moves-under-org.test.ts:138-149 is edited, and the org/ ancestry documents dangle. R1 for the delete, R3 to fix the ADR; -248.
  - **Keep as is** — A personal absolute path stays as the default. R0.
- **Recommended:** Keep and require EOS_ROOT — The protected ADR-0010 cites the file and leaves repairing it to the estate, so deleting it leaves the record pointing at nothing. Dropping the personal default is the only safe tidy.
- **Sceptic:** Re-read :24, :141-177, the ADR-0010 lines and the b15 assertions. b15-docs-pipeline-is-wired.test.ts only mentions the file in a comment (:5), so the delete option edits one suite, not two. Recommendation unchanged.
- **Ruling:** Keep and require EOS_ROOT, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-12c · migrate-to-runtime.mjs: keep for pre-runtime installs or retire

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme E
- **Batch:** tooling-ci
- **Now:** wc -l = 125. The header (:3-8) says it converts legacy Hermes-cron missions into schedules and fails missions left 'dispatched' with no runs row. It is dry-run by default and idempotent. Live callers: scripts/lib/ps-migrate.sh:69, which setup.sh:245 runs through ps_migrate_run, and scripts/tooling/ps-deploy.mjs:261, the in-app Update and Rebuild. scripts/bootstrap/setup.mjs:152 also calls it, but setup.mjs itself has no caller. install.ps1 is a Write-Host stub, and git grep 'setup\.mjs' across scripts, install.ps1, package.json and .github finds only comments in env-local.mjs (tooling-03). With PS_DATA_DIR unset it opens ~/patterstage/data, falling back to control-hub.db (:26-37). Documented at docs/running/migration.md:180.
- **Question:** Keep migrate-to-runtime.mjs running on every setup and deploy migration for installs that predate the runtime core, or retire those installs and delete it?
- **Options:**
  - **Keep** — No change. R0.
  - **Retire pre-runtime installs** — Deletes the script, the legacy-data step at ps-migrate.sh:68-71, the call at ps-deploy.mjs:261 and the documented step at migration.md:180. setup.mjs:152 goes too, unless tooling-03 has already deleted setup.mjs. A pre-runtime install that updates later keeps unconverted cron-backed missions. R1 if tooling-03 lands first, otherwise R2 (scripts/bootstrap is sensitive); about -135.
- **Recommended:** Keep — It runs idempotently at no cost, and only the operator can say that no install with Hermes-cron missions remains.
- **Sceptic:** The draft said every migration runs it, including through setup.mjs, but setup.mjs has no caller. The live paths are ps-migrate.sh:69 (via setup.sh:245) and ps-deploy.mjs:261. The retire option's tier depends on whether tooling-03 has removed setup.mjs. Recommendation unchanged.
- **Ruling:** Keep, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-data-05 · Baseline-rebuild fallback that cannot trigger: remove or make real

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme E
- **Batch:** data-layer
- **Now:** src/lib/db/upgrade.ts:19 sets BASELINE_SCHEMA_VERSION = 3, and :284-287 returns version > BASELINE + 100. git show a02c0e15 -- src/lib/db/upgrade.ts changes BASELINE from 2 to 3 and `!== BASELINE_SCHEMA_VERSION` to `> BASELINE_SCHEMA_VERSION + 100`. The head is 42 (src/lib/db-schema.ts:35). The old chain wrote file numbers: 31804e8b:src/lib/db.ts:160 is setSchemaVersion(database, num), and 31804e8b^'s migrations end at 032. Both 31804e8b and a02c0e15 are on origin/main (git merge-base --is-ancestor), and git log --oneline --before=2026-05-19 origin/main | wc -l = 319. The call is at src/lib/db/index.ts:194-203. The operator's data/ holds 8 control-hub.db.pre-baseline-* files; node -e on their stamps gives 2026-05-21T18:23:02Z to 18:31:14Z. runHermesRegistryImport (upgrade.ts:254) runs only from rebuildToBaseline (:352). The promise is documented at docs/running/migration.md:192-196 and :203, backup.md:57, data-storage.md:82 and :98, api.md:102, and docs/contributing/testing.md:51 (which describes rebuildToBaseline). The WARNING prints only on the ps-migrate path (scripts/lib/ps-migrate.sh:38-43, :51, :73-79). The in-app Update in ps-deploy.mjs has no such count (grep -n -i baseline is empty). backup.ts:78, :120 and :141 list pre-baseline files, and b6-backup-route.test.ts:106-107 and b6-database-backup.test.ts:11, :170-179 and :228-233 test that listing. Only db-upgrade.integration.test.ts (126 lines) imports rebuildToBaseline; migrate-v2-to-v3.test.ts:7 and legacy-column-repair-migration.test.ts:15 import the TS parity step instead. upgrade.ts is 353 lines. A main install last updated before 2026-05-19 holds an old-chain DB, which the new chain reads as vN; neither the current code nor removal detects it.
- **Question:** Remove the baseline-rebuild fallback that can no longer trigger, together with the migration guide's promise of it, or rebuild it so it really catches databases too old to upgrade?
- **Options:**
  - **Remove, keep listing old backups** — Deletes the rebuild and export code in upgrade.ts, the index.ts:194-203 branch with its _bootstrapped reset, and db-upgrade.integration.test.ts. Removes the ps-migrate.sh REBUILD warning (:51, :73-79) and its header sentence (:41-43). Removes the migration.md section 'If a database can't be migrated in place' (:192-196, the :203 row) and the testing.md:51 bullet. backup.md:57 is reworded to 'left by an older version'. backup.ts and api.md:102 stay, so existing pre-baseline files are still listed and the b6 backup tests are unchanged. test_full_install_update_process.py:516 only excludes such files from a checksum and can stay. R2 (src/lib/db*), about -380.
  - **Make it real** — Detect a pre-baseline shape (for example version <= 32 without agent_root), back up, rebuild, and add the WARNING to ps-deploy.mjs, which lacks it (ps-migrate.sh already prints one). Replace importMissionRow with importRows plus defaults. Add a test on an old-chain fixture. R2, about -60.
  - **Keep as is** — The docs keep promising a fallback that cannot run. R0.
- **Recommended:** Remove, keep listing old backups — The path cannot fire for any database either chain wrote, so the documented fallback is false today. Choose 'Make it real' only if the operator knows of a main install not updated since 2026-05-19.
- **Removes:** Documented behaviour: the automatic baseline rebuild with a patterstage.db.pre-baseline-<ts> backup for a database too old to upgrade (docs/running/migration.md:192-196 and :203; docs/contributing/testing.md:51; backup.md:57 wording), and ps-migrate.sh's 'A baseline REBUILD occurred' warning
- **Sceptic:** Re-derived the condition, the BASELINE 2-to-3 change in a02c0e15, the old-chain setSchemaVersion(num), both commits on main, the 319 count and the backup timestamps. Added a doc the draft missed (testing.md:51) and the fact that the in-app Update path (ps-deploy.mjs) never prints the rebuild warning, which bears on 'make it real'. Narrowed the test impact: only db-upgrade.integration.test.ts imports rebuildToBaseline.
- **Ruling:** Remove, keep listing old backups, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-data-08 · Three empty benchmark tables: keep, stop creating, or drop

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** data-layer
- **Now:** 014_benchmarks.sql, 015_benchmark_config.sql and 017_bench_gateways.sql exist. Their appliers run at src/lib/db/index.ts:224-234, and grep -c bench 001_baseline.sql = 0. git grep -n -w for the three tables across src, scripts, tests and docs (migrations excluded) finds comments (apply-bench-gateways-migration.ts:4,12; apply-benchmark-config-migration.ts:12; stats/agent-experience.ts:37; runtime/endpoint-registry.ts:18) and the ALTER at apply-bench-gateways-migration.ts:39. It also finds test assertions at run-migrations-upgrade.integration.test.ts:75-88 and :208, and docs/running/data-storage.md:115, which says 'the tables stay permanently empty'. ADR-0004-brain-and-body.md:140-142 (protected) says they 'remain as permanently empty tables in every database'. migration.md:85-86: shipped .sql files are immutable, and schema_version only increases with each gate claimed once.
- **Question:** Leave the three empty benchmark tables in every database as ADR-0004 recorded, stop creating them for new installs, or drop them everywhere?
- **Options:**
  - **Keep as recorded** — No change. R0, 0 lines.
  - **Stop creating them for new installs** — Appliers 014, 015 and 017 bump the version without DDL on a DB that lacks the tables. Existing DBs keep them, so fresh and upgraded schemas differ by three tables. Flips run-migrations-upgrade.integration.test.ts:75-88 (also the v14 footgun guard, which needs a replacement table) and :208, and rewrites data-storage.md:115. Contradicts ADR-0004:140-142, so it needs a superseding ADR. R2 schema-change plus an ADR, net about 0.
  - **Drop everywhere via a new migration** — Adds a DROP migration (043, unless another programme change claims it first, since each gate is claimed once) and raises MIGRATION_HEAD_SCHEMA_VERSION. Any rows recorded before 4935ac31 (2026-07-25) are lost. Same test and doc edits, plus a superseding ADR. R3 destructive-migration, about +12.
- **Recommended:** Keep as recorded — The tables cost nothing at runtime and removing them saves no lines (the drop is +12). Both change options reverse a consequence ADR-0004 records and data-storage.md:115 documents.
- **Sceptic:** Re-ran the grep and read ADR-0004:135-145, data-storage.md:115 and the two test sites. Added that the drop migration's number must be coordinated with other schema changes in the programme. Nothing else changed.
- **Ruling:** Keep as recorded, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-data-09b · Drop the sync_registry table itself

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme E
- **Batch:** data-layer · **after:** lib-data-09a, lib-data-05
- **Now:** The table is created in src/lib/db/migrations/001_baseline.sql (git grep -l -w sync_registry -- src/lib/db/migrations). It is listed in upgrade.ts:62 PRESERVE_TABLES and docs/running/migration.md:196. tests/unit/db-baseline.test.ts:8 reads 001_baseline.sql and :24 lists the tables that file creates. No other test names the table (git grep -w). No reader (see lib-data-09a).
- **Question:** Drop the sync_registry table with a new migration once its writers are gone, or leave the empty table?
- **Options:**
  - **Leave the table** — No change. R0.
  - **Drop via a new migration** — A new numbered migration, its chain entry and a head bump. Edits upgrade.ts:62 (unless lib-data-05 has removed upgrade.ts) and migration.md:196. db-baseline.test.ts is unchanged, because it reads the immutable baseline, which still creates the table. Existing status rows are lost. R3 destructive-migration, about +10.
- **Recommended:** Leave the table — An unread table costs nothing, and dropping it is an R3 migration with no user benefit.
- **Sceptic:** The draft's drop option edited db-baseline.test.ts:24. That suite reads 001_baseline.sql (:8), which is immutable (migration.md:85) and keeps creating the table, so a drop migration leaves it alone. Recommendation unchanged.
- **Ruling:** Leave the table, as recommended — Daniel Parke (operator), 2026-09-12.

#### critic-07 · Rendered platform_toolsets lists in the seed configs: drift test or derive

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme E
- **Batch:** tests
- **Now:** The awk count gives data/seed/agent-root/config.yaml 185, data/seed/profiles/baseline/config.yaml 1, and 162 for each of the six other profiles: 1,158 in all. node -e with js-yaml over directories only (profiles/ also holds manifest.json) prints 'ids 22 lists 50 identical 50'. The key counts are agent-root 8, the six profiles 7 each and baseline 0; data/seed/profiles/baseline/config.yaml:6 is `platform_toolsets: {}`. git grep render-seed-platform-toolsets hits only data/seed/README.md:23; the renderer is 62 lines. The loader (src/modules/hermes/lib/seed-profile-toolsets.ts:25-35) returns {} for a missing file. It is called at profile-sync-shared.ts:146 and profiles-repository.ts:121, :184 and :222. catalog-seed.ts reads only whether the root config exists (:430), never its toolsets. scripts/bootstrap/install.sh:99 and :121 point operators at data/seed/profiles/. scripts/lib/ps-hermes-profile-templates.sh:65-78 copies SOUL.md, AGENTS.md and auth.json, and copies config.yaml only from $HERMES_HOME (:60). Pins: tests/unit/seed-pack-shipped.test.ts:35-40 and config-yaml-round-trips.test.ts:47-54. The canary seedPack golden hashes every file in data/seed (output-canary.mjs:32-35, golden.json:13). scripts/tooling/line-census.mjs:50-51 walks only src and tests.
- **Question:** Keep the committed platform_toolsets lists in the seed configs and add a test that they match full-toolset-ids.json (option b), or derive them at runtime and delete the rendered blocks (option a)?
- **Options:**
  - **(b) Add a drift assertion** — seed-pack-shipped.test.ts compares every list with full-toolset-ids.json. Nothing shipped changes, and the renderer's output becomes checked. R0, about +12.
  - **(a) Derive at runtime** — loadSeedPlatformToolsets fills every platform with the 22 ids when a seed has no block. It must encode 8 root keys against 7 profile keys, and keep baseline's explicit {} as empty. Deletes the 8 rendered blocks and render-seed-platform-toolsets.mjs (62 lines); a hand-copied config.yaml no longer carries toolsets. Edits seed-pack-shipped.test.ts:40, config-yaml-round-trips.test.ts:47-54 and data/seed/README.md:23, and re-blesses the canary seedPack golden. R2, about -1,185 lines, almost all data/seed YAML.
  - **Keep as is** — The lists can drift unseen, and the renderer runs nowhere. R0.
- **Recommended:** (b) Add a drift assertion — The lists are identical today (50 of 50). Option (a) changes seed files the installer points operators at, and its saving sits in data/seed, outside the line census.
- **Sceptic:** Re-ran the awk counts and the js-yaml comparison: 1,158 lines, 50 of 50 identical, 8 against 7 keys. Corrected two paths: baseline lives at data/seed/profiles/baseline/config.yaml:6, and the census walk is line-census.mjs:50-51. Added that catalog-seed never reads the toolsets, so the runtime fallback loader is the only consumer option (a) must change. Recommendation unchanged.
- **Ruling:** (b) Add a drift assertion, as recommended — Daniel Parke (operator), 2026-09-12.

#### critic-09 · Unused globals.css tokens: delete all or only the four rgb mirrors

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme E
- **Batch:** dead-code
- **Now:** grep -n src/app/globals.css: cherenkov-400 :26, cherenkov-500 :27, dark-800 :46 (plus a comment at :98), ps-duration-fast :364, ps-duration :365, ps-rgb-neon-{purple,green,pink,orange} :367-370, and .animate-spin-slow at :521 and :609-615. A per-token git grep over src, tests, scripts, docs and branding (globals.css excluded) finds no consumer. No token name is built dynamically: the only `${` constructions are `--color-neon-${c}` in src/components/viz/colors.ts:7,11. The one TSX use of the rgb-mirror form is WorkflowRunCanvas.tsx:76, which names neon-cyan. The rgb mirrors are documented as a family, not by name: docs/contributing/repo-guide.md:190 names `--ps-rgb-neon-*`, and design-tokens.md:357-359 and :472-473 say to mirror each GLOW_RGBS glow triplet as a --ps-rgb-*. GLOW_RGBS (src/lib/ui/theme.ts:217-221) has 8 entries, globals.css:366-371 mirrors 5 neon colours plus cherenkov-glow, and red, blue and yellow already have no mirror. lockbook-tokens.test.ts:207-228 checks each declared mirror's format, not the set. Pins: u2-the-token-layer.test.ts:251-252, u16-the-docs-describe-the-system.test.ts:59, tests/e2e/motion.spec.ts:22 and u14-the-ring-paints-and-motion-stops.test.ts:140. Named in docs: design-tokens.md:32 (ramp 100 to 500), :42 (dark-800), :232-233 (durations) and :423 (spin-slow). Stale counts: u0-the-gate-sees-what-it-claims.test.ts:80-83 and scripts/tooling/design-lint.mjs:235-236 both say 'four live call sites'. Stale alias: u2-the-contrast-gate-refuses.test.ts:96-97 says well is still dark-800, which lockbook-tokens.test.ts:120 says is gone. Comments that also name dark-800: derive-surface-ladder.mjs:9 and u4-surfaces-and-edges.test.ts:103. branding/guidelines/COLORS.md:27-28 lists #008bd1 and #0071c2, the 400 and 500 values, with #0071c2 the 'anchor'. TRADEMARK.md:27 reserves that palette.
- **Question:** Delete all nine unused tokens and the unused slow-spinner class, or delete only the four rgb mirrors that no doc names individually and keep what the design docs and brand palette name?
- **Options:**
  - **Delete the four rgb mirrors only** — Removes --ps-rgb-neon-{purple,green,pink,orange} (globals.css:367-370). Corrects the stale counts in u0:80-83 and design-lint.mjs:235-236 and the stale alias comment in u2-the-contrast-gate-refuses.test.ts:96-97. The documented mirror rule (design-tokens.md:357-359, :473) still holds, because cyan and cherenkov-glow stay mirrored, and lockbook-tokens.test.ts stays green. Keeps cherenkov-400/500, dark-800, both durations and .animate-spin-slow; no docs change. R0, about -6.
  - **Delete all ten** — Also removes cherenkov-400/500 (the brand scale), dark-800, the durations, and .animate-spin-slow with its keyframes and reduced-motion override. Edits design-tokens.md:32, :42, :232-233 and :423, u2-the-token-layer.test.ts:251-252, u16:59, motion.spec.ts:22 and u14:140. Leaves historical comments naming dark-800. R1, about -26.
  - **Delete the four mirrors, adopt the durations** — As the first option, plus the house transition uses --ps-duration-fast and --ps-duration so the documented tokens paint; visible transition timing changes. R1, net about 0.
- **Recommended:** Delete the four rgb mirrors only — cherenkov-400/500 are named brand values (COLORS.md:27-28, TRADEMARK.md:27, design-tokens.md:32), and the durations, dark-800 and the slow spinner are named in design-tokens.md. The four rgb mirrors are covered only by a pattern rule that stays true without them, and nothing paints them.
- **Sceptic:** The draft called the rgb triplets 'the undocumented four'. repo-guide.md:190 and design-tokens.md:357-359 and :473 document the --ps-rgb-* mirrors as a family, so rewrote the why around 'no doc names them and the rule holds without them'. Confirmed lockbook-tokens.test.ts:207-228 checks format, not membership, so deleting four stays green. Added the same stale 'four live call sites' count in design-lint.mjs:235-236 (only WorkflowRunCanvas.tsx:76 uses the form in TSX) and the extra dark-800 comment mentions. Recommendation unchanged.
- **Ruling:** Delete the four rgb mirrors only, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-22 · Story Weaver's four vendored serif fonts: keep or delete

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** components
- **Now:** ls -l src/app/fonts: Literata 52,496, EBGaramond 44,336, Lora 37,788 and Merriweather 97,548 bytes, 232,168 in all; Inter and JetBrainsMono are house fonts. src/app/recroom/story-weaver/layout.tsx is 52 lines, with the 'may be deleted' passage at :8-12. src/modules/rec-room/components/ReaderSettings.tsx:29 defaults fontFamily to 'EB Garamond'. FONTS at :34-40 lists the four serifs and Inter. The reader's choice is saved in localStorage under 'story-weaver-reader-settings' (:51, :62 loadSettings), and normaliseSettings keeps any string fontFamily (:74). The regenerator entries are at scripts/tooling/vendor-fonts.mjs:35-40. Tests use DEFAULT_SETTINGS without naming a font: b2-overlays-are-dialogs.test.tsx:17 and :117, and u12-the-reader-register.test.tsx:82 and :96. git grep of the font names across tests and docs finds nothing. org/LOCKBOOK.md:308-309 says WG-WEB-010, the house trio, 'is a type ruling and this sitting did not touch it'.
- **Question:** Keep Story Weaver's four serif reading fonts (a reader setting, 232 KB of vendored files), or delete them to hold the app to the house font trio?
- **Options:**
  - **Keep and record the ruling** — Cut the 'may be deleted' paragraph (layout.tsx:8-12) and record the keep under WG-WEB-010 in org/LOCKBOOK.md, which is neither protected nor derived. R0, about -5.
  - **Delete** — Removes the four woff2 files, story-weaver/layout.tsx, the four FONTS entries and the vendor-fonts.mjs entries. The default becomes Inter, which FONTS keeps. normaliseSettings (:74) must map a saved 'Lora' and the like to the default. The b2 and u12 renders keep passing, since they assert no font name. Readers lose the choice of typeface. R1, about -58 lines and -232 KB.
- **Recommended:** Keep and record the ruling — It is a working reader setting whose choices are saved in users' browsers. The fonts are scoped to the Story Weaver layout segment, and the house-trio ruling explicitly left this untouched.
- **Sceptic:** Re-ran ls and read the layout, ReaderSettings and LOCKBOOK. Added that FONTS already carries Inter, so deletion has a ready default, and that no test or doc names a serif face. Recommendation unchanged.
- **Ruling:** Keep and record the ruling, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-22 · branding/assets placeholder README: leave or fold

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** docs
- **Now:** git ls-files branding lists LICENSE.md, README.md, assets/README.md and guidelines/COLORS.md, with no asset files. branding/assets/README.md:10 says assets 'live here as they are added', and branding/README.md:10 says the same. TRADEMARK.md:26 links branding/assets/. REBRANDING.md:16 tells forks to remove branding/. grep -c branding docs/manifest.json = 0, so the file is not a docs page. org/COMPILE_REPORT.md:325 lists it as seed ancestry (historical).
- **Question:** Leave branding/assets/ holding only its placeholder README until real assets exist, or fold it into branding/README.md and change TRADEMARK.md's reserved-assets wording?
- **Options:**
  - **Leave as is** — No change. R0.
  - **Fold and reword** — Deleting branding/assets/README.md removes the directory from git, so TRADEMARK.md:26 must be reworded to name branding/. No docs manifest regeneration is needed. R0, -12 lines, but it changes legal text.
- **Recommended:** Leave as is — 12 lines do not justify changing trademark text that reserves that location.
- **Sceptic:** Re-ran git ls-files and read TRADEMARK.md:22-30. The draft cited docs/CONTRIBUTING.md:92 as naming branding/; that line is about the Apache licence, so dropped it. Confirmed no manifest entry. Recommendation unchanged.
- **Ruling:** Leave as is, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-05b · MODULE_ACCENTS: ruled artefact with no reader yet

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme E
- **Batch:** lib-domains
- **Now:** src/lib/modules/registry.ts:190 defines it, and git grep -n -w MODULE_ACCENTS -- src scripts shows only the definition. org/LOCKBOOK.md:112-114 records WG-WEB-009 (B): 'the map exists, in src/lib/modules/registry.ts'. :304-308 says surfaces do not yet obey it and the repaint 'has no queue item yet'. It is read by tests/unit/lockbook-tokens.test.ts:34, :164, :168, :172, :181 and :186. b3-registry-regroup.test.ts names it only in a comment (:13).
- **Question:** Keep MODULE_ACCENTS, the module-to-accent map a lock-book ruling requires but no screen reads yet, or delete it?
- **Options:**
  - **Keep** — No change. R0.
  - **Delete** — Contradicts LOCKBOOK.md:112-114 and edits lockbook-tokens.test.ts (the import at :34 and the five assertions from :164 to :186); b3-registry-regroup.test.ts only loses a comment. R1, about -25 src and -25 test lines.
- **Recommended:** Keep — It is a ruled lock-in artefact whose consumer, the repaint to the map, is pending rather than abandoned (LOCKBOOK.md:307-308).
- **Sceptic:** The draft said b3-registry-regroup.test.ts reads the map; it only mentions it in a comment (:13). lockbook-tokens.test.ts has six sites, not three. Recommendation unchanged.
- **Ruling:** Keep, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-05c · Four declared APIs reached only by tests

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme E
- **Batch:** lib-domains
- **Now:** isKeylessProvider is at src/modules/hermes/lib/providers.ts:95, with @public at :92 ('for server-side callers'). helpIsBuilt is at src/lib/help/help-source.ts:108, with @public at :104. listFrameworks (src/lib/frameworks/repository.ts:44) and updateFramework (:70) are the frameworks table's only list and update functions; reads go through getActiveFrameworkConfig (:59; used at frameworks/registry.ts:14 and session-repository.ts:214). No route or UI calls either: git grep -i framework -- src/app finds only /api/monitor's getActiveFramework. docs/running/limitations.md:89-92 documents that 'The code has a seam for a second one'. Each of the four has one caller, a test file: b6-keyless-providers.test.tsx, b16-help-source-refuses-a-traversal.test.ts or frameworks-repository.test.ts.
- **Question:** Keep isKeylessProvider, helpIsBuilt, listFrameworks and updateFramework, though only tests call them? Two are declared API and two are the frameworks table's only list and update functions. Or delete them?
- **Options:**
  - **Keep** — No change. R0.
  - **Delete** — Removes the four functions and their tests: the frameworks-repository.test.ts cases, b6-keyless-providers.test.tsx and the b16 case. Switching the active framework then needs SQL, against the seam limitations.md:89-92 documents. R2 exported interface, about -35 src lines (estimate) plus tests.
- **Recommended:** Keep — Two carry an explicit @public intent for server-side callers. The other two are the only list and update path of the framework seam limitations.md documents. Together they are about 35 lines.
- **Sceptic:** Confirmed both @public tags and the single test caller of each. Checked that no route or UI reaches the frameworks functions. Added limitations.md:89-92, which documents the seam they serve and gives 'Keep' a documented basis beyond line count.
- **Ruling:** Keep, as recommended — Daniel Parke (operator), 2026-09-12.

#### hooks-15b · theme.ts token mirror (surfaceClasses, edgeClasses, measureClasses)

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme E
- **Batch:** components
- **Now:** theme.ts:28 surfaceClasses, :43 edgeClasses and :100 measureClasses have no reader outside theme.ts (git grep -n -w). The header at :20-24 says the lock-book 'names two homes for a token, globals.css @theme and this file'. tests/unit/lockbook-tokens.test.ts:35 imports all three, and :82, :94 and :146 check each class names a declared token. org/LOCKBOOK.md:80-85 records 'Token home: src/app/globals.css ... Code mirror: src/lib/ui/theme.ts', held to it by that test. Measured by sed: header :20-25, surfaceClasses :27-33, edgeClasses :35-47 and measureClasses :99-105, about 33 lines.
- **Question:** Keep the token mirror in theme.ts (surfaceClasses, edgeClasses, measureClasses) that the lock-book names but no component reads, or delete it?
- **Options:**
  - **Keep** — No change. R0.
  - **Delete** — Rewrites the token-home line at LOCKBOOK.md:80-85. lockbook-tokens.test.ts loses the :35 import and the :82, :94 and :146 blocks and reads the CSS only. R1, about -33 theme.ts lines plus test lines.
- **Recommended:** Keep — The lock-book records theme.ts as the tokens' code mirror, and a test holds it to the CSS. Deleting it rewrites a recorded arrangement to save about 33 lines.
- **Sceptic:** Measured the saving the review left unmeasured: about 33 theme.ts lines (sed -n 20,47p and 99,105p). Confirmed the three names have no src reader and that the theme.ts header and LOCKBOOK.md:80-85 record the arrangement. Recommendation unchanged.
- **Ruling:** Keep, as recommended — Daniel Parke (operator), 2026-09-12.

#### tooling-13 · What prebuild should do to a database

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · theme E
- **Batch:** tooling-ci
- **Now:** package.json:12 prebuild = prebuild-db.mjs && build-site --help-only. ci.yml runs npm run prebuild at :78, :147, :224 and :284, then npm run build, which runs it again, at :102, :162, :226 and :286. prebuild-db.mjs:18 hard-codes join(ROOT,'data') and ignores PS_DATA_DIR. :62-70 unlinks the DB and its -wal and -shm with no backup when schema_version < 3; BASELINE was 2 until a02c0e15 (git show). :89 runs the .mjs parity step, which returns early at >=3 (db-schema-ensure.mjs:139-143), so its error-swallowing .sql loop (:146-161) never runs from prebuild. :96-123 applies src/lib/db/seeds/*.sql. :125-129 importHermesRegistry copies provider api_key values from $HERMES_HOME/.env into credentials (hermes-registry-import.mjs:93-96, :255-272). :133-142 spawns seed-catalog.ts with PS_DATA_DIR={repo}/data and, on win32, a shell. seed-catalog.ts:46-47 calls runCatalogSeed, which calls ensureDb() (catalog-seed.ts:277), and getDb() runs migrations to convergence on first open (src/lib/db/index.ts:90-103). So a successful prebuild takes {repo}/data's DB to head (42), not v3. On a default install that DB is the live one: install.sh:44 puts the repo at ~/patterstage, setup.sh:148 defaults PS_DATA_ROOT to ~/patterstage/data, and paths.ts:41-67 resolves the same path. So the build migrates the live DB before the backup, at setup.sh:214 (build) before :245 (ps_migrate_run backs up), and at ps-deploy.mjs:416 (build) before :423 (migrateDb, backupDb at :257). That contradicts the documented order 'backup → schema migration → legacy-data migration' (docs/running/migration.md:180). After the build, setup.sh:245-286 and ps-deploy.mjs:423-428 run db:migrate, migrate-to-runtime, import-hermes-state.ts, seed-catalog --merge and ensure-hermes-model-sync.ts. None imports Hermes models or keys into the DB. import-hermes-state.ts:3 covers profiles, root and skills, and ensure-hermes-model-sync.ts:3 pushes DB to config.yaml. The Models page's user-initiated sync does read ~/.hermes/.env (src/app/agent/models/page.tsx:231, api/models/import/route.ts:13, config-import.ts:201); whether it writes credentials was not checked. The Docker runner copies only data/seed (Dockerfile:21 builds, :54 copies), so no image ships the DB. The local .next/prerender-manifest.json (2026-09-10) lists only /_global-error and /favicon.ico, and layout.tsx:48-49 awaits headers(). Proving the build needs no DB is unverifiable-readonly: PS_DATA_DIR=$(mktemp -d) npx next build on a tree without data/patterstage.db. Other consumers: test_full_install_update_process.py:473-479 runs npm run prebuild and copies data/patterstage.db as the legacy control-hub.db fixture, in the install-harness job (ci.yml:323, :361) that the final gate requires (:432-441). Docs describe prebuild at testing.md:53 and :64-66, env-reference.md:40-43, CONTRIBUTING.md:80 and deploy.md:40. CONTRIBUTING.md:80 is already stale, because E2E uses its own wiped PS_DATA_DIR (playwright.config.ts:77-79, :93). The pin is b15-docs-pipeline-is-wired.test.ts:86. Comments that assume a shipped prebuilt DB: apply-sql.ts:40-42, apply-composer-node-cancelled-migration.ts:59-60, apply-composer-rejected-migration.ts:72-73 and b6-models-origin.test.ts:386-390.
- **Question:** Should npm run build stop creating, migrating and seeding a database, leaving that to the backup-first migrate and seed steps that setup and deploy already run after the build?
- **Options:**
  - **Build touches no database** — prebuild becomes build-site --help-only. Deletes prebuild-db.mjs (147 lines) and db-schema-ensure.mjs (167), moving columnExists and tableExists into hermes-registry-import.mjs only if that script keeps a caller (see theme note 3). The live DB is no longer migrated before its backup, and the pre-backup unlink of a DB below v3 goes. Removes the documented 'npm run prebuild writes {repo}/data/patterstage.db' (testing.md:53, :64-66; env-reference.md:40-43; CONTRIBUTING.md:80; deploy.md:40). Also removes the build-time copy of Hermes models and provider keys into the DB, leaving the Models page sync as the import path. Edits b15-docs-pipeline-is-wired.test.ts:86. The install harness must build its fixture another way, for example PS_DATA_DIR=data npm run db:migrate, or the cp at :478-479 fails the required install-harness job. The four prebuilt-DB comments go stale. org/policy.json:40-42 keeps sensitive entries that match nothing; editing it is R3, and leaving it is harmless. CI's duplicate prebuild disappears. Windows keeps working: the win32 shell flag leaves with the file it served. R2 (R3 if the operator reads the key-copy removal as key-material), about -300.
  - **Keep prebuild, back up before building** — setup.sh and ps-deploy.mjs take the database backup before npm run build rather than after. prebuild keeps creating, migrating, seeding and importing keys, and all documented behaviour stays. The unlink and the swallowed loop remain, but a backup precedes them. CI still runs prebuild twice. R2 (scripts/bootstrap is sensitive), about +10.
  - **Build runs migrate-db.ts instead of the .mjs step** — prebuild spawns tsx scripts/tooling/migrate-db.ts in place of :59-94, and db-schema-ensure.mjs goes. The schema outcome is unchanged, because seed-catalog's getDb() already takes the DB to head. The live DB is still migrated before its backup on default installs. R2, about -150.
  - **Harden in place** — Back up instead of unlinking (prebuild-db.mjs:62-70). Stopping the swallowed .sql errors changes nothing reachable, since that loop never runs from prebuild. Seed-catalog still migrates the live DB before its backup. R2, about +10.
  - **Keep as is** — CI runs prebuild twice per job. On a default install, a build migrates the live DB, and can unlink one below v3, before any backup. R0.
- **Recommended:** Build touches no database — Everything prebuild does to the database is re-run after the build by setup.sh and ps-deploy.mjs, behind a backup, and no image ships the file. On a default install the file prebuild migrates first is the live database, which breaks the backup-first order migration.md:180 promises. Land it only after three things. First, a build on an empty PS_DATA_DIR with no data/ proves next build needs no DB. Second, the operator accepts losing the automatic Hermes key and model import, or asks for importHermesRegistry to move after the backup. Third, the harness fixture swap lands in the same change. If the operator wants the documented prebuild DB kept, 'back up before building' is the fallback.
- **Removes:** Documented behaviour that npm run prebuild and npm run build create, migrate and seed {repo}/data/patterstage.db (docs/contributing/testing.md:53 and :64-66; docs/running/env-reference.md:40-43; docs/CONTRIBUTING.md:80; docs/running/deploy.md:40). The automatic build-time import of Hermes models and provider API keys into the credentials table. scripts/tooling/prebuild-db.mjs. scripts/tooling/db-schema-ensure.mjs.
- **Sceptic:** Traced the spawn chain from prebuild-db.mjs:133 through seed-catalog.ts:46-47 and catalog-seed.ts:277 to getDb (index.ts:90-103). A successful prebuild migrates {repo}/data to head, so option consequences written around a v3 build DB were wrong. On the default layout (install.sh:44, setup.sh:148) that is the live DB, migrated before the backup (setup.sh:214 vs :245; ps-deploy.mjs:416 vs :423, not :429). Added a 'back up before building' option. Checked the draft's open question: import-hermes-state.ts covers only profiles, root and skills, so option 1 also drops the automatic key and model import; that removal now needs a ruling. Also added the install-harness dependency on the prebuild DB (:473-479, required job) and corrected the line numbers.
- **Ruling:** Build touches no database, as recommended — Daniel Parke (operator), 2026-09-12.

### Theme F1

1. Coverage. All 23 requested ids have entries (lib-data-10, cross-cutting-14, lib-domains-01 and lib-domains-11 are each split a/b), plus 3 verified rows. Sceptic verdicts: 9 upheld, 18 corrected, 0 refuted. Some sub-claims were refuted inside corrected entries: lib-data-13's 'rows before 2026-08-30 differ', app-18's 'custom zod messages keep the sentence', hooks-01's 'banner-only' for templates and detail, and app-03's surfaces count.

2. Ownership principle and the flips. operator_needed is true when the question can only be settled by the operator. That means one of: a removal of a guarded item (feature, route, URL, npm script, config key, env var, documented behaviour), deletion, the protected set, a lint or test policy or ruled convention, or the operator's own tooling (cross-cutting-11's watchdog). It is false when the recommended option needs no ruling and the question is not itself reserved. On that basis four entries flipped to false:
- lib-data-01: migration.md:87 and apply-sql.ts:4-8 already require failing loudly, and T-0129 folded 17 stanzas at R1.
- lib-data-13: no known stored row changes its displayed total.
- hooks-10: no documented cadence, and the gating pattern already exists on the sessions page (free band, policy.json:130).
- lib-domains-11a: undocumented display text, the same standard applied to lib-data-11.
app-18 was also set to false, because its corrected recommendation changes no 400 body.

3. Policy choices that settle several entries at once:
- (a) 'A polled read failure is shown in place, not as a toast' settles hooks-01 and hooks-02. The board must then add a templates banner and a detail error state.
- (b) 'Documented 400 sentences are public contract, and zodErrorResponse cannot carry them' settles app-18 and the cronPushError part of hooks-19.
- (c) 'One five-character escapeHtml, with proxy.ts left out' settles cross-cutting-14a and lib-domains-11b at R1.
- (d) The ADR-0005 rulings belong in one sitting: lib-domains-01a/01b, 02 and 03. Precedents: agent_profiles ruled to hermes with no rename, recorded in the ADR (:229-240), and rec-room's subject-prefixed tables. ADR-0005 is immutable once accepted (CONSTITUTION.md:80-81), durable decisions need a short ADR (CONSTITUTION.md:46-48, policy.json:131), and any ADR lands in org/decisions, so it is R3. That is why both real options in lib-domains-03 are R3.
- (e) cross-cutting-07 'keep the flag' keeps cross-cutting-01's fix meaningful.

4. Sequencing on sensitive paths, with max_lanes 2:
- Migration lane (src/lib/db, R2): lib-data-05, then 06, then 01, then 02/04. lib-data-01 no longer waits on a ruling.
- app-16 then cross-cutting-11 share src/instrumentation.ts. cross-cutting-11 also edits src/lib/db/index.ts:375 and apply-cron-schedule-canonicalisation.ts:145, so it must not run beside the migration lane.
- cross-cutting-01 and 02 edit adjacent lines of boot-diagnostics.ts (:46-48): one commit.

5. Claims that moved on re-run:
- lib-data-10: errors24h has no reader. dedupErrors merges all duplicates, not only consecutive ones. The harm is the Errors panel, against dashboard.md:158-160.
- lib-data-13: every writer since before 80c422dc stored a total, and older rows are outside the 90/91-day windows. getRun also feeds GET /api/runs/[id].
- app-16: a register() throw ends in process.exit(1) (start-server.js:424-428); the sweeps are race-free (30-minute cutoff).
- app-18: helper counts are 24/24/3; api.md:35 is a URL-key check.
- hooks-19: 8 files, so R1, not R0.
- cross-cutting-24: the 'e2e clock pinned to UTC' comment has no pin in the repo.
- lib-domains-01: 13 importers (8 app, exempt; 5 core).
- lib-domains-12: the MessageBubble pragma cites a renderMarkdown test that does not exist.

6. Nothing was run. Unverifiable-readonly, with the command that would settle each:
- Schema equivalence for lib-data-01/06: a scratch tsx probe of runMigrations on :memory:, then npx jest u15-one-driver-for-sql-migrations run-migrations-upgrade.
- Duplicate row counts for lib-data-10b: the GROUP BY query on a live install.
- The chat Copy jsdom repro.
- The widened design-lint count for app-03: node scripts/tooling/design-lint.mjs on a branch.
- Every jest or e2e outcome.
The output canary's surfaces (appConfig, generatedArtefacts, httpSurface, seedPack; output-canary.mjs:102) exclude migrations, so no re-bless is expected from the data-layer entries.

#### lib-data-06 · One migration pass instead of the convergence loops

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R2 · theme F1
- **Batch:** data-layer · **after:** lib-data-05
- **Now:** index.ts:188-191 returns after the baseline. getDb loops at :107-114 (comment :99-106). migrate-db.ts:101-106 loops again after getDb() at :86, and the '(0 -> 30)' comment at :84 is stale. docs/running/migration.md:69 documents multi-pass convergence. run-migrations-upgrade.integration.test.ts:183 names the test, :193 expects 3 after one pass, and :197-205 replicate the loop. git grep -l 'ensureDb()' -- src = 36. The rebuild branch at index.ts:194-205 reopens _db (:202) and returns un-migrated, and db-upgrade.integration.test.ts:108 expects BASELINE after a rebuild. runMigrations( appears in 4 suites (b14-runs-spend-source-migration, b6-models-origin, legacy-column-repair-migration, run-migrations-upgrade); only :193 pins the stop at baseline. That one pass reaches an identical schema is unverifiable-readonly (scratch tsx probe on :memory:).
- **Question:** Should a fresh database reach the current schema in one migration pass, replacing the documented 'converges over several passes' loop?
- **Options:**
  - **One pass** — Drops the return after the baseline and deletes both loops. One boot and one db:migrate still end at the head, and the 'schema_version after: N' output is unchanged. Rewrites migration.md:69 and the :183-205 test to assert that one pass reaches MIGRATION_HEAD_SCHEMA_VERSION; check the other 3 runMigrations suites on a branch. Needs the rebuild branch gone (lib-data-05) or one re-run kept after it. R2. About -26.
  - **Keep loops, fix comments** — Deletes only migrate-db.ts:101-106 (getDb has already converged) and the stale :84 comment. R2 (scripts/tooling/migrate-db.ts). About -12.
  - **Leave** — No change. 0.
- **Recommended:** One pass — The loop exists only to work around the early return. Take it once lib-data-05 has ruled; if 05 keeps the rebuild branch, take 'Keep loops, fix comments'.
- **Removes:** The multi-pass convergence description at docs/running/migration.md:69 (the mechanism only; the outcome is unchanged).
- **Sceptic:** Re-read index.ts, migrate-db.ts and the test with grep -n. Corrected line anchors: the loop is at migrate-db.ts:101-106 with getDb at :86, the rebuild branch at index.ts:194-205, and the test's expected 3 at :193. Added the other three runMigrations suites and the db-upgrade :108 coupling. Ownership and recommendation stand.
- **Ruling:** One pass, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-data-10b · Duplicate error rows already in users' databases

- **Re-verified:** unverifiable-readonly · sceptic: upheld · **tier floor:** R1 · theme F1
- **Batch:** data-layer · **after:** lib-data-10a
- **Now:** Rows are capped at 500 and ordered by timestamp (sync-repository.ts:112-129). Existing copies of the latest lines stay in the ten-row window until newer distinct errors displace them, while ''-timestamp rows sort last and are pruned first. Measuring the duplicates needs SELECT source, timestamp, message, COUNT(*) FROM error_log_entries GROUP BY 1,2,3 HAVING COUNT(*)>1 against a live install.
- **Question:** What should happen to the duplicate error rows already stored in existing databases?
- **Options:**
  - **Hide at read** — readRecentErrorLogEntries returns one row per (source, timestamp, message) using GROUP BY and MIN(id). Nothing is deleted, the panel is right at once, and dedupErrors' (xN) then counts genuine repeats. R1. About +3.
  - **Let them age out** — No change. Copies drop out as newer distinct errors displace them, which on a quiet install may be never. R0. 0.
  - **Delete copies** — A one-off DELETE keeping MIN(id) per key, run as a migration row. Data deletion. R3. About +10.
- **Recommended:** Hide at read — The panel is correct immediately and nothing is deleted.
- **Sceptic:** Re-read the read and prune statements. Softened 'age out' (a quiet install may never displace the copies) and noted that the recommended option itself needs no ruling.
- **Ruling:** Hide at read, as recommended — Daniel Parke (operator), 2026-09-12.

#### hooks-01 · Missions board reads four endpoints by hand beside the cache

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F1
- **Batch:** client-hooks
- **Now:** useMissionsApi.ts:10-28 reads /api/missions?limit=200, /api/templates, /api/missions?id= and /api/mission-categories by hand. useMissionsData.ts:193 awaits loadCategories, :215 toasts a templates failure, :230 toasts a detail failure, and :258-264 polls every 15_000. useDashboard.ts:96,124-133 read the same three list endpoints, with staleTime Infinity for templates and categories. apiQueryKey is [endpoint] (useApiResource.ts:56-58), so the board's reads would share the dashboard's cache entries. src has 4 invalidateQueries calls (Sidebar.tsx:161, useOperatorPrefs.ts:63, useSchedules.ts:35, useScripts.ts:72), none for these keys. The cache envelope is private (useApiResource.ts:61-64). b10-category-write-failures.test.tsx:48-51 injects fetchCategories. Only missions (useMissionsData.ts:71,184-191) and categories (useMissionCategories.ts:27,36-45) have a banner state. Templates and mission detail have none; :226-229 says 'The detail panel has no error state, so the toast is the user-facing surface'. No test pins the three messages; git grep tests finds only a comment at mission-categories-route.test.ts:188.
- **Question:** Should the missions board read its lists through the shared cache, so a failed poll shows an error in place instead of a toast?
- **Options:**
  - **Move to cache** — The four reads go through useApiResource: lists with refetchInterval 15_000, detail keyed on the expanded id. useMissionsApi.ts is deleted, and the board's refetches refresh the dashboard's cached templates and categories. Missions and categories failures become banner-only. Templates and detail have no banner, so they need a new banner and a detail error state (about +15), or their failures go silent. Needs a setQueryData helper for the optimistic cancel and a b10 suite rewrite. R1. About -75.
  - **Keep hand reads, dedupe toasts** — Toast only when a read goes from ok to failed; this is hooks-02's fix alone. R1. About +8.
  - **Leave** — No change. 0.
- **Recommended:** Move to cache — It ends the stale dashboard cache after board writes and fixes hooks-02, provided templates and detail gain an error surface.
- **Removes:** The per-poll error toasts for categories, templates and mission detail on /work/missions (documented in a code comment at useMissionCategories.ts:38-39); a banner or error state replaces each.
- **Sceptic:** Re-read useMissionsApi, useMissionsData, useMissionCategories, useDashboard and useApiResource, and grepped tests. Refuted 'read failures become banner-only': templates and detail have no banner, and detail's comment calls the toast its only surface. Added the cost of those surfaces (net about -75, not -90) and confirmed that the cache keys match the dashboard's.
- **Ruling:** Move to cache, as recommended — Daniel Parke (operator), 2026-09-12.

#### hooks-02 · A failing board read raises a new persistent alert every 15 seconds

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F1
- **Batch:** client-hooks · **after:** hooks-01
- **Now:** loadCategories toasts on every failure (useMissionCategories.ts:37-45) and runs on every 15 s tick (useMissionsData.ts:193, :258-264). The same tick toasts templates (:215) and detail (:230), so up to 3 error toasts per tick. Error toasts never auto-dismiss (Toast.tsx:96) and use role=alert with aria-live=assertive (:114-115). pushToast has no dedupe and evicts the oldest error once every slot holds one (FeedbackProvider.tsx:52-58). The dashboard's polled reads raise no toast (useDashboard.ts:83-113). Templates and detail have no banner (see hooks-01). No test pins the behaviour.
- **Question:** When a polled read on the missions board keeps failing, should the operator get an in-place error only, one toast when it first fails, or a new alert every tick as now?
- **Options:**
  - **Banner only** — Matches the dashboard. Delivered by hooks-01, which must add a templates banner and a detail error state. R1. About +15 inside hooks-01.
  - **Banner plus one toast** — A toast only on the ok-to-failed transition (templates and detail keep the toast as their only surface), or pushToast skips a message already on the stack (that affects every page). R1. About +8.
  - **Leave** — Screen readers announce up to three assertive alerts every tick. 0.
- **Recommended:** Banner only — It matches the dashboard and ends a repeating assertive announcement. If hooks-01 is declined, take 'Banner plus one toast'.
- **Removes:** The repeating 'Failed to load ...' error toasts on /work/missions (documented only in a code comment).
- **Sceptic:** Re-read Toast.tsx, FeedbackProvider.tsx and the three toast sites. Corrected the zero-cost claim: banner-only needs new error surfaces for templates and detail. Added the three-per-tick count.
- **Ruling:** Banner only, as recommended — Daniel Parke (operator), 2026-09-12.

#### hooks-03 · runWrite and useMutation as two sanctioned write paths

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R1 · theme F1
- **Batch:** client-hooks
- **Now:** grep -rnE '\brunWrite\s*(<[^(]*>)?\(' src, excluding api-write.ts: 57 calls in 30 files. useMutation( appears 7 times in 4 files (Sidebar.tsx, useOperatorPrefs.ts, useSchedules.ts, useScripts.ts). Both ways are pinned at repo-guide.md:163-164 and :168-172, api-write.ts:10-12 and c3-one-way-to-write.test.ts:12-14, and were decided in T-0138 (org/plans/2026-09-consolidation.md:135-141). runWrite always toasts a failure (api-write.ts:131) and requires a successMessage (:52). Sidebar.tsx:149-153 is silent on purpose, and AutomationList.tsx:156-157 reports inline.
- **Question:** Should useMutation stop being the second sanctioned way to write, re-opening the T-0138 convention, to save about 10 lines?
- **Options:**
  - **Keep both ways** — No change. 0.
  - **One useWrite hook** — useWrite over runWrite, with an invalidates list, a busy key and a quiet mode; the 7 useMutation sites and two reload wrappers move onto it. Rewrites repo-guide.md:163-172, design-lint's law text, the c3 test and the api-write.ts header, and needs a decision on Sidebar's silence. R1. About -10.
- **Recommended:** Keep both ways — About -10 lines does not justify re-opening a pinned T-0138 decision, and Sidebar's deliberate silence would need a new mode.
- **Sceptic:** Re-ran both counts (57/30, 7/4) and read every cited line. Corrected anchors only: repo-guide.md:163-164 and :168-172, and consolidation.md:135-141.
- **Ruling:** Keep both ways, as recommended — Daniel Parke (operator), 2026-09-12.

#### app-16 · Boot steps in instrumentation.ts that can abort startup

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R2 · theme F1
- **Batch:** app-routes
- **Now:** Try blocks at instrumentation.ts:20-37, 43-48, 52-58, 77-83 and 89-95; bare calls at :61-62, :65-66 and :71-72. ensureCatalogSeededOnce catches everything itself (catalog-seed.ts:345-356), so it cannot skip the sweeps. Throws can still come from ensureSyncLayer (sync/index.ts:37-61: register and the SERVER_MODULES syncSources loop, then start, all unguarded), from ensureBackgroundScheduler (BackgroundScheduler.ts:193-200) and from the three dynamic imports. Next 16.2.9 rethrows a register() throw (instrumentation-globals.external.js:61-68) from prepareImpl (next-server.js:568-573). start-server.js awaits getRequestHandlers at :393, and its catch calls process.exit(1) (:424-428), so today the process exits with code 1 after binding the port; under a restart policy or watchdog that becomes a restart loop. Both sweeps touch only rows older than 30 minutes (research-repository.ts:221-230, chat-repository.ts:338-346), so running them first cannot fail a run the scheduler's immediate tick starts (SyncScheduler.ts:120-127). Subsystems shows no cycle when none ran (subsystems.ts:145-155). Suites naming instrumentation: boot-says-how-it-is-configured.test.ts and u15-nothing-lives-only-for-its-test.test.ts.
- **Question:** If the sync layer or background scheduler fails at boot, should PatterStage exit (as now) or start without it and log a warning?
- **Options:**
  - **Fail fast, sweeps first** — Keep the throw, but move the two recovery sweeps ahead of the ensure* calls so a later throw cannot skip them. A scheduler or sync failure still exits the process with code 1, a restart loop under a supervisor, with the error in the log. R2. About 0.
  - **Log and carry on** — A step(name, fn) wrapper logs one [boot] warning and continues. Pages are served with no scheduler or sync: scheduled missions never fire, and the subsystems panel shows no sync cycle. R2. About -14.
  - **Leave** — No change; a throw also skips both sweeps. 0.
- **Recommended:** Fail fast, sweeps first — The file header says the idle-host scheduler is why register() exists (instrumentation.ts:4-9). A server that starts but silently never fires schedules is worse than one that visibly refuses to start.
- **Sceptic:** Read instrumentation.ts, catalog-seed, sync/index, BackgroundScheduler, both sweeps and Next's start-server.js. Confirmed that the throw ends in process.exit(1), and added the restart-loop consequence. Confirmed that the sweeps' 30-minute cutoff makes 'sweeps first' race-free.
- **Ruling:** Fail fast, sweeps first, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-07 · The composer feature flag and its 12 copied guards

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F1
- **Batch:** app-routes
- **Now:** git grep -c 'isFeatureEnabled("composer")' -- src/app/api/composer gives 12 guards in 8 files, each returning serviceUnavailable('Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.') (e.g. runs/route.ts:39-41). The flag files total 126 lines, and 14 test files jest.mock the flag modules. PS_COMPOSER is set in no shipped config (git grep over .env.example, docker-compose*.yml, Dockerfile, docker, install.ps1 and scripts/bootstrap exits 1). ADR-0005:46 lists 'enabled | A feature flag, so a module can ship dark', carried by the FeatureFlag field at modules/types.ts:49,67 and the Composer nav link at registry.ts:45. Pages already have requireFeatureOr404 (feature-flags-guard.ts:15-17). Documented at env-reference.md:86, api.md:105 and :128, guides/composer.md:157 and :224, guides/quests.md:58 and :173, reference/quests.md:125,127, and troubleshooting.md:143. The SSE-route guard was added on purpose (org/plans/2026-09-final-release.md:426, D5).
- **Question:** Keep PS_COMPOSER as the switch that turns Composer off, or remove the feature flag?
- **Options:**
  - **Keep, one-line guards** — A composerOff() helper beside requireFeatureOr404 in feature-flags-guard.ts (feature-flags.ts must stay free of next imports, guard header :4-5) turns the 12 guards into one line each, with the 503 text byte-identical. Flag, route and docs unchanged. R1. About -18.
  - **Remove the flag** — Removes PS_COMPOSER, GET /api/feature-flags, the documented 503 and 404 behaviour, the quests 5.1/5.2 'switched off' copy, 14 mocking suites and 9 doc sites. R2 public-contract with an operator ruling. The FeatureFlag type and nav field can remain with no flags; retiring ADR-0005:46's 'enabled' mechanism too needs a superseding ADR (R3). About -550.
  - **Leave** — No change. 0.
- **Recommended:** Keep, one-line guards — The flag is documented in nine places and ADR-0005 names the mechanism, and the evidence shows no case that it is dead or harmful.
- **Sceptic:** Re-ran the guard, line and mock counts and the shipped-config grep, and read ADR-0005:40-57, registry.ts and feature-flags-guard.ts. Added the two missed doc sites (composer.md:157, quests.md:58) and the existing guard file as the helper's home. Corrected option B's tier: R2 plus a ruling, and R3 only if the ADR mechanism is also retired.
- **Ruling:** Keep, one-line guards, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-11 · Server log tag spellings and silent failure paths

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R2 · theme F1
- **Batch:** lib-domains · **after:** app-16
- **Now:** git grep -nE '\bconsole\.(log|info|warn|error|debug)\(' -- src ':!src/app/api' = 32 lines. Minus api-logger.ts (1) and script-templates.ts (3) leaves 28 in 12 files. Minus the app/error.tsx client boundary and the retention-prune.ts:184 CLI printer leaves 26 in 10 files. Tags seen include [auth], [config], [paths], [scheduler], [chat], [deep-research], [seed], [syncHermesSessionsToDb], [syncDefaultsToHermesConfig], [finalizeRootConfigOnDisk], [listSessions] and 'catalog-seed:'. Four silent .catch(() => {}): composer/dispatch.ts:76 and :140, run-reconcile.ts:158 and :282. [auth] is documented at install.md:75-80, first-hour.md:100 and troubleshooting.md:27, and echoed by scripts/bootstrap/setup.sh:317. [config] appears in no doc. No script, runbook, docker file or test matches any other tag. session-sync.ts:102-105 mentions an operator's watchdog reading this output. Sensitive files in the sweep: src/instrumentation.ts (7 calls), src/lib/db/index.ts:375 and src/lib/db/apply-cron-schedule-canonicalisation.ts:145.
- **Question:** May server log lines outside the API routes move to one closed tag list (for example 'catalog-seed:' becoming '[seed]'), keeping the [auth] and [config] lines byte-identical?
- **Options:**
  - **Closed tag list, keep [auth]/[config]** — A serverLog(tag) helper converts the 26 calls and logs the two dropped Composer advances (dispatch.ts:76,140). [auth] and [config] stay byte-identical. Other stdout tags change, which warrants a release-notes line. R2 (instrumentation.ts and src/lib/db). About +12.
  - **Only the silent paths** — Log the 4 silent catches and leave tags unchanged. R1. About +6.
  - **Leave** — No change. 0.
- **Recommended:** Closed tag list, keep [auth]/[config] — Only [auth] is documented and it stays; the other spellings are unpinned and name functions rather than subsystems.
- **Removes:** Today's undocumented log tag spellings, such as 'catalog-seed:' and '[syncHermesSessionsToDb]'.
- **Sceptic:** Re-ran the console grep per file, extracted the tag literals, and grepped docs, scripts, ops, docker and tests for tags. Corrected '(3)' to 4 excluded lines. Added that the sweep also edits two src/lib/db files (sensitive), and that [config] is undocumented while setup.sh echoes [auth].
- **Ruling:** Closed tag list, keep [auth]/[config], as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-14b · Chat and skill pages through one markdown renderer

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F1
- **Batch:** lib-domains · **after:** lib-domains-12
- **Now:** Three renderers. Chat's renderMarkdown (chat-utils.ts:94-106) handles fences, inline code, bold, italic and line breaks, and is imported only by MessageBubble.tsx:27. The deep-research renderer has no table support (grep 'table\|GFM' on markdown.ts returns nothing). SimpleMarkdown renders GFM tables (SimpleMarkdown.tsx:11,17,160) and is imported only by agent/skills/[...path]/page.tsx:19. markdown-it is a devDependency only (package.json:88; node -e prints dep false, dev true). No test covers chat's output: only identity mocks at chat-page-toast.test.tsx:124 and u14-a-failed-run-is-an-error.test.tsx:25. MessageBubble.tsx:114's design-lint pragma cites tests/unit/chat-utils-*, and only chat-utils-sanitise-filename.test.ts exists.
- **Question:** Should chat messages and skill pages render through one shared markdown renderer?
- **Options:**
  - **Keep three** — lib-domains-12 fixes chat's Copy in place; nothing else renders differently. 0.
  - **Research renderer** — Chat starts rendering headings, lists, _x_ italics and [n] citation links (#dr-src-n). Skill pages lose GFM tables unless table support is added. R1. About -10 plus the table work.
  - **markdown-it at runtime** — markdown-it moves into dependencies. policy.json:131 makes a 'new dependency' durable, and CONSTITUTION.md:46-48 requires a short ADR (org/decisions, so R3). policy.json:130 lists 'dependencies already installed' as free band, so whether promoting a devDependency counts as new is itself part of the ruling. Chat and skills would render full markdown into innerHTML sinks that need a sanitising configuration. Not measured.
- **Recommended:** Keep three — The research renderer cannot draw the tables skill pages show, and chat's only defect is fixed by lib-domains-12.
- **Sceptic:** Re-ran the importer, dependency and test greps and read policy.json and CONSTITUTION.md. Replaced 'needs an ADR' with the actual governance chain and its ambiguity. Added the pragma that cites tests that do not exist.
- **Ruling:** Keep three, as recommended — Daniel Parke (operator), 2026-09-12.

#### cross-cutting-24 · Timestamp display: local time vs fixed UTC

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R1 · theme F1
- **Batch:** components
- **Now:** git grep -ohE 'toLocale(String|TimeString|DateString)\(' -- src gives 17, 4 and 2 calls in 16 files. Only 8 are timestamps: restore/page.tsx:232,348, settings/system/page.tsx:190, skills/[...path]/page.tsx:102, chat/MessageBubble.tsx:185, SubsystemsPanel.tsx:71, QuestRow.tsx:73 and ui/Toast.tsx:167; the rest format counts. AutomationList.tsx:71-75 shows fixed UTC with 'Z', with a comment saying a list must read the same on two machines and that the e2e clock is pinned to UTC. No such pin exists in playwright.config.ts, tests/e2e or .github/workflows (git grep for TZ, timezoneId or UTC finds nothing), so the claim rests on the CI runner's default zone. b6-restore-page.test.tsx:605 pins toLocaleString. automation.md has no time-zone wording.
- **Question:** Should timestamps across the console follow one policy, local time with a zone label or UTC, instead of local on most screens and UTC on the schedule list?
- **Options:**
  - **Leave as is** — Local time for the viewer's own actions and status; UTC with 'Z' on schedules, for the reason at AutomationList.tsx:72-73. 0.
  - **Local everywhere** — The schedule list shows local time and the comment is reversed. With no zone pinned in the repo, any e2e expectation of formatWhen output would depend on the runner's zone, so a pin is needed. R1. About +10.
  - **UTC everywhere** — All 8 sites show UTC, including 'Done at' and toast times; b6-restore-page.test.tsx:605 changes. R1. About +10.
- **Recommended:** Leave as is — Only 8 sites are timestamps, two of them show the viewer's own just-completed action, where local time is right, and the UTC exception has a written reason.
- **Sceptic:** Re-ran both greps, read AutomationList and the b6 pin, and searched for a UTC pin. Corrected 'e2e specs pinned to UTC': no pin is in the repo, so the Local option needs one added rather than changed.
- **Ruling:** Leave as is, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-01a · Move Laboratory (Deep Research) into src/modules under ADR-0005

- **Re-verified:** moved · sceptic: upheld · **tier floor:** R2 · theme F1
- **Batch:** lib-domains · **after:** lib-domains-01b
- **Now:** ADR-0005 is accepted (org/decisions/ADR-0005-product-modules.md:5,11). Rule 1 is at :50, rule 2 at :53, and rule 4 at :56 names laboratory; :94 says 'a module is migrated when it is next worked on'. The owner ruled on 'the four that were his' at :229. ls src/modules shows hermes and rec-room. deep-research is 8 files and 1,391 lines. search is 408 lines, imported only by deep-research engine.ts:12, search.ts:8 and types.ts:91; 3 suites mock deep-research/search (b14-research-cancel, b4-emits-research-composer, research-gather-is-persisted). git grep -l lib/laboratory -- src gives 13 files: 8 under src/app (exempt from core-imports-no-module, design-lint.mjs:308) and 5 core files: ResearchReport.tsx:20,26,27, useDeepResearch.ts:9, instrumentation.ts:78, composer/dispatch.ts:15-17 and composer/engine.ts:19. No rule is crossed today (pattern @/modules/, design-lint.mjs:313). After a move, the 5 core importers break rule 1, or move with the module. ServerModule (src/lib/modules/server.ts) has no research capability today.
- **Question:** Is this programme the time to carry out ADR-0005's move of Laboratory into src/modules, or does it wait until Deep Research is next worked on?
- **Options:**
  - **Move now** — deep-research, search, ResearchReport and useDeepResearch move into src/modules/laboratory. New ServerModule capabilities cover Composer's research node (create, run, lookup) and the boot sweep. The search.ts re-export is deleted, 3 mocks are repointed, and lib-moves.json records five spellings. URLs /api/laboratory/research/* and /work/research are unchanged. R2 (instrumentation.ts). About +10.
  - **Wait for feature work** — Record in the programme plan that the move is pending under ADR-0005:94, naming the five core importers. No code change. R0. 0.
  - **Amend ADR, keep in core** — A superseding ADR drops laboratory from rule 4. R3. About 0.
- **Recommended:** Wait for feature work — The ADR itself says modules move when next worked on. The move costs about +10 lines with no user-visible gain, and it needs two new capabilities and a table ruling first.
- **Sceptic:** Re-read the ADR lines and the core-imports-no-module predicate, and re-ran the importer and mock greps (13 = 8 app + 5 core). Everything reproduces. The tier_floor records the move itself; the recommended option is R0.
- **Ruling:** Wait for feature work, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-01b · Who owns the Deep Research tables

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R1 · theme F1
- **Batch:** lib-domains
- **Now:** research_runs and research_steps are created at 019_deep_research.sql:12 and :30, and 034_research_usage.sql extends them. Rule 2 at ADR-0005:53 reads 'A module owns its own tables, prefixed'. Precedents: agent_profiles was ruled to hermes with no rename, recorded inside the ADR itself (:231-240). Rec-room's tables are stories (001_baseline.sql:217), story_characters and story_themes (029_recroom_library.sql:17,36): a subject prefix, not the module id.
- **Question:** If Laboratory becomes a module, does it own research_runs and research_steps under their current names?
- **Options:**
  - **Own, keep names** — Record the ruling in the programme plan without editing ADR-0005 (accepted ADRs are immutable, CONSTITUTION.md:80-81). This is weaker than the precedent, which lives in the ADR; a superseding ADR note would match it at R3. research_ is a subject prefix like rec-room's story_. No migration. R1. 0.
  - **Own, rename with laboratory_ prefix** — A rename migration plus every SQL site and test that names the tables. A schema change on existing databases. R2. Not measured.
  - **Stay core tables** — The module reads core tables through a repository seam, which contradicts rule 2. R1. 0.
- **Recommended:** Own, keep names — It follows both existing precedents and needs no migration.
- **Sceptic:** Re-grepped the CREATE TABLE lines and read ADR-0005:53 and :229-240. Added that the precedent was recorded inside the ADR, so a plan-only record is weaker; the operator may want a superseding note (R3).
- **Ruling:** Own, keep names, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-02 · agent_root repository ownership

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R1 · theme F1
- **Batch:** lib-domains
- **Now:** git grep -lE 'agents/agent-root-repository"' -- src finds 15 importers: 12 under src/modules/hermes and 3 app routes (agent/profiles, agent/root, skills/[name]/toggle). src/app is exempt from core-imports-no-module (design-lint.mjs:308), so a move creates no violation. 22 files in tests/ and scripts/ name the path. The header reads 'Bob / default agent at HERMES_HOME root' (agent-root-repository.ts:2). lib-moves.json:3 records C7's move to src/lib/agents. ADR-0005:231-240 rules on agent_profiles only.
- **Question:** Does the hermes module own the agent_root table, as it already owns agent_profiles?
- **Options:**
  - **Hermes owns it** — The repository moves into src/modules/hermes/lib through lib-moves.json (five spellings, 22 test/script files), and one shared column type is declared inside the module. Core keeps agents/roster.ts. No URL or schema change. R1. About -8.
  - **Core owns it** — Record that agent_root is core, as PatterStage's own record of its root agent. No move. R0. 0.
- **Recommended:** Hermes owns it — Its content columns mirror Hermes files, the reason given for agent_profiles, and every non-route importer already lives in the module.
- **Sceptic:** Re-ran the importer grep (15 = 12 + 3), the tests/scripts count (22) and the lint predicate. All reproduce.
- **Ruling:** Hermes owns it, as recommended — Daniel Parke (operator), 2026-09-12.

#### lib-domains-03 · The Hermes config.yaml Settings field table in core

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R3 · **needs an ADR** · theme F1
- **Batch:** lib-domains
- **Now:** config-schema.ts is 608 lines, with CONSTANT CONFIG_SECTIONS from :68: tirith_enabled at :159, camofox at :242, HERMES.md at :384 and :389, and fileKeyForFilePath returning 'hermes' at :517. It has 7 src importers (2 settings pages, api/config route, 3 components/config files, useSettingsEditor.ts) and 13 unit suites. hermes-outside-adapter matches only getActiveHermesPaths|getAgentLlmEndpoints|HERMES_HOME|.hermes/ (design-lint.mjs:253-263). ADR-0005:316-317 claims 'No core file knows the Hermes filesystem or protocol', and :325-329 lists what the claim does not cover (app/ imports, the /config/hermes_md route, the 'hermes' file key). ADR-0005:294-297 names exactly three composition points: modules/server.ts, frameworks/registry.ts and src/lib/runtime/. The sections are read client-side, so they cannot come through server.ts. module-registry-stays-pure forbids lucide imports in src/lib/modules/ (design-lint.mjs:~280-282). env-file.ts has two importers, both in the module (config-import.ts, hermes-env-sync.ts).
- **Question:** Is the Settings field table (Hermes config.yaml keys such as tirith_enabled and camofox) Hermes protocol knowledge that belongs in the hermes module, or a recorded exception to ADR-0005's boundary claim?
- **Options:**
  - **Recorded exception** — A superseding ADR note lists it beside the hermes_md exception (ADR-0005 is immutable, CONSTITUTION.md:80-81), mirrored in design-lint's hermes-outside-adapter comment. No code move; env-file.ts moves into the module. A recorded deviation is durable (policy.json:131) and the ADR lands in org/decisions. R3. About 0.
  - **Move to module** — CONFIG_SECTIONS becomes pure data with icon-name strings in src/modules/hermes. It is exposed to client Settings through a new module-declaration field outside the ADR's three named composition points, a precedent-setting pattern that also needs an ADR. 7 importers and 13 suites change; URLs and config keys do not. R3. About +5.
  - **Leave unstated** — No record; the ADR's claim stays wider than the code. 0.
- **Recommended:** Recorded exception — Both real options need an ADR. The move adds a new composition path for +5 lines with no user-visible change, while the ADR already lists the adjacent hermes_md section as an exception.
- **Sceptic:** Re-grepped the config-schema lines and counts, and read ADR-0005:294-297 and :314-329, the lint predicates, CONSTITUTION.md:46-48 and :80-81, and policy.json:131. Corrected 'Move to module' from R1 to R3: its new composition path is a durable, ADR-level decision. Noted that the ADR names only three composition points.
- **Ruling:** Recorded exception, as recommended — Daniel Parke (operator), 2026-09-12.

### Theme F2 · Components and documentation

1. One ruling covers most of the components entries.
   - If the operator rules that the Field Kit look wins over local looks, that settles components-02 (Picker size), components-11 (Field label restyle), components-12 (track switches) and the restyle half of components-03.
   - They can then land as one components batch with one census run.
   - Correct counts: 22 field dropdowns in 16 files, 10 of them unnamed. 16 files render <Field>, not 41; 41 files import the field barrel.
   - The census binds a port, so the executor runs it (`npm run census`). A rise needs --allow-growth with a reason, a fall needs --update-baseline.

2. Order and hidden edits within the components batch.
   - components-12 goes first: ui/Input.tsx cannot be deleted until the toggles have a home.
   - components-02 and components-11 go in the same lane, because ui/Input.tsx:10 and :345-373 import FieldSelect.
   - NativeSelect stays in field/Select.tsx until components-13 (SpendPanel.tsx:30 imports it by path).
   - Per components-33, list the suites pinned to each file first:
     - model-select-dropdown-source-pattern: header and describe name only; its source reads pin ModelSelectDropdown's callers.
     - the e2e missions-runtime comments.
     - the b6, b7 and field-kit imports.
     - b2-confirm-button and viz-chrome-tokens: they pin native confirm( and raw colours in WorkflowCanvas, not the Toggle.
   - Doc edits: design-tokens.md:365-368 and :399 must change for components-02, keeping `Picker` and 'ui/field' for u16:64-95.
   - design-lint.baseline.json's growth ledger is keyed rule::file, so moving InlineToggle's classes into field/Toggle.tsx may register as growth. Check with `node scripts/tooling/design-lint.mjs --report` (not run here).
   - Visible changes stale these screenshots: composer.png, settings.png, memory.png, models.png, and chat.png if components-30 lands. Tie them to docs-18.
   - components-30: chat content is model output, so SimpleMarkdown's link href (SimpleMarkdown.tsx:89-91) needs a scheme allowlist and test before chat uses it. Rule it with cross-cutting-14(b). markdown-it is already a devDependency; whether promoting it to runtime needs an ADR is the router's call (policy.json:130-131).

3. Tier caveat.
   - org/policy.json:15 puts public-contract ("exported interface delta") at R2, fed by "derived:public-api-delta".
   - No script computes that signal (`git grep public-api-delta` finds only policy.json).
   - Whether deleting exported components (field Select, ui/Input.tsx) counts is the router's call. This register treats them as internal (R1).

4. CHANGELOG is not append-only.
   - CONSTITUTION.md:52-55 limits append-only history to decisions, tier exceptions, oracle amendments, incident audits and deviation logs.
   - AGENTS.md:28-29 covers derived files and ledgers only.
   - No test or script reads CHANGELOG.
   - Only [Unreleased] exists (0 tags).
   - The approved release plan (org/plans/2026-09-final-release.md:338) schedules the release-note write at rc.1.
   - Any edit keeps the pre-042 custom-fallback instruction (CHANGELOG.md:385-390) that org/HANDOVER.md:130-131 relies on.
   - The third superseded pair is the Settings-index wording (:62-64, :507-508) against 'Settings is one page' (:200-206), not 'the subsystems bullets'.
   - docs-03a's count is wrong as well as the version: five migrations (038-042) since T-0086, and origin/main is at 006.

5. Gate-count drift does not need docs-08.
   - testing.md:164 already names all twelve steps, and u16:107-116 holds it to package.json.
   - So docs-05b and docs-06b point there now (the dependencies on docs-08 are removed). A lint-steps fence, if adopted, can replace the link later.
   - docs-11a must edit testing.md:164 in the same change, and depends on docs-01's exact-case fixes.
   - Accepted ADR-0010:110-113 names check-doc-links.mjs and relies on links from docs/ into org/ being checked. A folded refusal must resolve paths outside docs/, and the immutable ADR will keep naming the deleted script.

6. docs-08 recommendation changed.
   - A schema-head fence has no docs page to guard: migration.md:68 removed the number on purpose, schema.md never had it, and CHANGELOG.md:22 is outside the walk (extract.ts:34, :392).
   - env-table cannot replace env-reference.md's curated tables (21 documented variables are absent from .env.example). As an added table it surfaces 9 .env.example variables the page never mentions.
   - Recommended: adopt lint-steps and env-table and delete the other five. The departure goes in a new task record; T-0109 is not rewritten.

7. Ownership changes from the draft.
   - docs-06a becomes executor free band. The protection setting is recorded (LOCKBOOK.md:275-280, gh api reading 2026-08-22) and re-readable with a read-only gh api call. Making acceptance-gate required is the operator's existing WO-0011 half.
   - docs-05a's recommendation moves from "ADR-0003 still governs" to a superseding ADR (R3, needs_adr). T-0116 minted tokens in globals.css on 2026-09-07 under the operator-approved overhaul's decision 1 (org/plans/2026-09-ui-overhaul.md:83-86), and LOCKBOOK.md:109-111 records the question as open. The executor can reword the box to state those facts at R0 meanwhile.
   - docs-19b's refusal is flagged as a lint-policy addition. The site, Help and search already use the title (lib.mjs:494-505, :523, :590), so only GitHub shows the mismatch.

8. Five findings were split, because each held two decisions: docs-03, docs-05, docs-06, docs-11 and docs-19.
   - After this pass, the operator rulings are docs-03b, docs-05a, docs-08, docs-11a, docs-16, docs-17, docs-18 and docs-19a, plus the four components entries (02, 11, 12, 30).
   - components-31, docs-03a, docs-05b, docs-06a, docs-06b, docs-11b and docs-19b are executor free band.

9. Knock-on effects the executor must handle.
   - docs/manifest.json is derived: regenerate it with `npm run docs:build -- --manifest-only` for docs-17, and for docs-19a if keys go.
   - Docs edits must keep these suites green:
     - b15-corpus-moves-under-org:167-178 (pins the docs/ top-level files, SUPPORT.md included)
     - b17-quest-integrity:339-340 (docs/README.md must link quests.md)
     - u13-help-names-itself:31
     - u16:100-104 (the repo guide's data-layer rule)
     - u16:64-95 (design-tokens.md's primitive list and Form inputs section)
   - Every page needs section and nav (lib.mjs:35).

10. Not verifiable in a read-only session:
   - pixel parity and the census (`npm run census`)
   - the design-lint effect of moving classes (`node scripts/tooling/design-lint.mjs --report`)
   - jest and playwright runs
   - screenshot freshness (`npm run screenshots`)
   - today's branch protection (`gh api repos/Daniel-Parke/PatterStage/branches/main/protection`)
   - whether estate EOS tooling outside the repo indexes docs/
   - whether React 19.2.7 neutralises javascript: hrefs without an allowlist
   - GenerateOverlay announcement frequency under aria-busy (manual screen-reader check)

#### components-02 · Field-kit Select duplicates Picker, the more accessible dropdown

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F2
- **Batch:** components
- **Now:** `git grep -n -E 'import .*\bSelect\b.*from "@/components/ui/field"' -- src` = 16 files. They hold 22 <Select>/<FieldSelect> tags, and a read-only node scan finds 10 of them with no ariaLabel: artifacts/page.tsx:120, work/composer/page.tsx:371, work/research/page.tsx:225,233,263, ComposerRunForm.tsx:145,148 and WorkflowCanvas.tsx:436,644,653. `git grep -l 'ui/Picker"' -- src tests` = AgentRuntimeDefaultsCard, MissionCreateForm, SkillsPicker and ProfilePicker, plus u11-the-picker.test.tsx. Every Picker caller passes size="lg" (AgentRuntimeDefaultsCard.tsx:117,127,147; MissionCreateForm.tsx:257; SkillsPicker.tsx:37). field/Select.tsx is 150 lines: the custom Select at :21-135 and NativeSelect at :144-150, which SpendPanel.tsx:30 imports by file path. The Select trigger is px-3 py-2 text-body (:97), and text-body is 14px on a 21px line (globals.css:192-193), so it is about 39px. Picker's HEIGHT map is lg h-10 (40px) and md h-8 (32px) (Picker.tsx:78-82). Select closes on a document mousedown (:42-49). Picker has aria-controls (:235), aria-activedescendant (:289, :301), Home/End/Tab (:180-202) and useDismissable (:127). Visible differences the draft missed: Picker puts a hint on a second line (:337) where Select keeps it inline (:126), so ModelSelectDropdown's provider/modelId hints go two-line. Picker's panel is POPOVER_PANEL min-w-56 (:278), and the chosen label is tinted (:336). Picker moves focus into the list on open (:140-142). A value missing from the options shows as raw text (:225), where Select shows the placeholder (:99). Pins: in model-select-dropdown-source-pattern.test.tsx, the source-read cases (:74-86) only check that DefaultsGrid and BulkAuxiliaryUpdater import ModelSelectDropdown. Its behaviour cases use button and option roles, which Picker also renders (Picker.tsx:230-234, :298, :322), and its header (:4-7) names the Field Kit Select. tests/e2e/missions-runtime.spec.ts:74-83 names ui/field/Select in comments only. docs/contributing/design-tokens.md:365-368 lists `Select` (the accessible listbox) in the Field Kit, and :399 says Select sits on Popover, but field/Select.tsx imports no Popover. u16-the-docs-describe-the-system.test.ts:64-95 pins `Picker` and 'ui/field' in that page. design-lint.baseline.json's growth ledger names field/Select.tsx at :247, :614, :804 and :861.
- **Question:** When the 22 field-kit dropdowns switch to Picker, which trigger size should they take, or should nothing change?
- **Options:**
  - **Picker at size lg** — All 22 switch to Picker. ariaLabel becomes the required label, and the 10 unnamed dropdowns gain one. Keyboard users gain Home, End and Tab-to-close, and screen readers hear the active option. Triggers go from about 39px to 40px, the size every existing Picker caller uses. Visible changes: hints move to a second line, the chosen option is tinted, the panel is at least min-w-56, and a value missing from the options shows as raw text instead of the placeholder. The custom Select leaves field/Select.tsx and field/index.ts; NativeSelect stays in that file until components-13. Edit the model-select test's header and describe name, the e2e comments, and design-tokens.md:365-368 and :399, keeping `Picker` and 'ui/field' for u16. Run `npm run census` and record any rise with --allow-growth and a reason. Sequence it with components-11, because ui/Input.tsx's Select wrapper imports FieldSelect (ui/Input.tsx:10, :345-373). No feature removed. R1. About -110 lines.
  - **Picker with a new size matching field Input** — Same as lg, plus a fourth HEIGHT key for a 39px trigger (+3 lines). That buys 1px over lg, and Picker gains a size only these screens use. The other visible differences remain. R1. About -105 lines.
  - **Picker at default md** — Same removal, but triggers shrink to 32px beside 39px inputs, a visible misalignment wherever a dropdown sits next to an input. R1. About -110 lines.
  - **Keep both dropdowns** — No change. The 22 dropdowns keep a listbox with no activedescendant, no Home/End and a hand-rolled outside-click listener, and 10 stay unnamed unless each gets an ariaLabel. 0 lines.
- **Recommended:** Picker at size lg — Picker is the more accessible control. lg is what every existing Picker caller passes and is within 1px of today's trigger, so no new variant is needed. The other visible differences (two-line hints, panel width, raw-value display) come with every Picker option, and only the census run shows how they move the measures.
- **Sceptic:** I re-ran the import grep (16 files) and counted tags: 22, with 10 unnamed. That confirms the 10, but the draft's '16 screens' conflates files with dropdowns. I read Select.tsx and Picker.tsx in full and found five visible or behavioural differences the draft omitted: two-line hints (:337), panel min-w-56 (:278), tinted chosen label (:336), focus moving into the list (:140-142) and raw-value display (:225). I measured the trigger heights from the text-body token: about 39px against lg 40px and md 32px. 'Repoint the model-select test' was overstated: its source-read cases pin ModelSelectDropdown's callers, not Select, so only the header and describe name change. Added the hidden doc edits in design-tokens.md:365-368 and :399, which u16 pins, and the design-lint ledger rows. The recommendation stands.
- **Ruling:** Picker at size lg, as recommended — Daniel Parke (operator), 2026-09-12.

#### components-11 · ui/Input.tsx's labelled wrappers re-implement Field without the label link

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F2
- **Batch:** components · **after:** components-12
- **Now:** ui/Input.tsx is 375 lines. `git grep -n 'from "@/components/ui/Input"' -- src tests` = 12 src files and 3 tests. The src files: SearchInput in 6; InlineToggle in 4 (LogTerminal, FallbackChainList, SkillRow, SpendPanel); ConfigField.tsx:24 (Toggle, Select, NumberInput, TextInput); MemoryProviderSettings.tsx:27 (Select). The tests: b6-config-field-unset-and-range:40, b7-memory-empty-states:31 and field-kit.test.tsx:11. field-kit.test.tsx names Input.tsx only in its header (:3) and has no readFileSync. The labels at ui/Input.tsx:101 (TextInput) and :196 (NumberInput) have no htmlFor, so ConfigField's text and number settings are unnamed. The :365 Select label is named through ariaLabel={label} (:368). Field (Field.tsx:66-69) renders an htmlFor-linked label, 'block text-micro font-medium uppercase tracking-wider text-ps-text-muted', and clones an id onto a single child (:47-52). Input.tsx's labels are 'text-body font-medium text-ps-text-secondary'. Correction: 41 files import from the field barrel, but only 16 render <Field> (`git grep -l '<Field\b' -- src` = 16). MemoryProviderSettings already renders Field labels for Host, Port and Bank (:285-302) beside ui/Input's Select at :272, so that screen shows both label styles today. ConfigField feeds SettingsSection, so every label on the one-page Settings screen restyles. docs/guides/settings.md and memory.md use settings.png and memory.png. Field's cloned id reaches neither field Select nor Picker, since neither takes an id, so a <Field> around a dropdown links to nothing and the name still comes from ariaLabel or label.
- **Question:** Should Settings and the Memory provider settings use the shared Field label, which names their unnamed text and number inputs but restyles every label there to small uppercase?
- **Options:**
  - **Adopt Field as it is** — ConfigField and MemoryProviderSettings render TextInput and the Select wrapper as <Field label><Input/Select/></Field>. NumberInput, which has real null and clamp behaviour, and SearchInput move into ui/field, and labels link to their inputs. ui/Input.tsx is deleted once the toggles have moved (components-12). Settings and Memory labels then match the 16 files that already use Field, and the Memory screen stops mixing two label styles. Every text and number setting gets an accessible name; a dropdown inside Field keeps its name through ariaLabel, not the label link. Repoint the 3 suites' imports, fix field-kit.test.tsx's header, run the census and recapture settings.png and memory.png (docs-18). No feature removed. R1. About -45 lines.
  - **Field with a body-text label variant** — Same fix and deletion, but Field gains a label-style prop (+~5 lines) so these screens keep today's look. The product keeps two label styles, and the Memory screen still mixes them unless its Host, Port and Bank fields also take the variant. R1. About -40 lines.
  - **Name the inputs in place only** — Add id/htmlFor to TextInput and NumberInput in ui/Input.tsx (+~6 lines). No restyle and no consolidation, so two input families and the mixed Memory screen remain. R0.
- **Recommended:** Adopt Field as it is — The Field Kit is meant to be the one form vocabulary (design-tokens.md:365-368). 16 files already render its label, and the Memory screen already mixes the two styles, so a variant would keep the drift. Naming the inputs is a defect fix under every option and needs no ruling.
- **Sceptic:** I re-ran the importer grep (12 src files, 3 tests) and read the label lines at :101, :196, :365 and :368 and Field.tsx:47-69. The draft's '41 importers already show its label' is wrong: 41 files import the barrel, but only 16 render <Field>. I added that MemoryProviderSettings already mixes both label styles (:272 against :285-302), which strengthens the recommendation. Added that the restyle reaches the whole Settings page through SettingsSection, which stales settings.png and memory.png. Added that Field's cloned id cannot reach a dropdown, so the link there is nominal. The options and recommendation are otherwise upheld.
- **Ruling:** Adopt Field as it is, as recommended — Daniel Parke (operator), 2026-09-12.

#### components-12 · Three switches: the field-kit pill Toggle has one consumer

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F2
- **Batch:** components
- **Now:** src/components/ui/field/Toggle.tsx is 41 lines: a role=switch pill with a dot and props label, checked, onChange, disabled and hint (:8-21). Its only consumer is WorkflowCanvas.tsx:42, used at :674-676 (HIL gate, Start, End) inside a `flex flex-wrap gap-2` row (:673). InlineToggle (ui/Input.tsx:288-341) is a 44x24 button around a 36x20 track, with 4 importers: LogTerminal, FallbackChainList, SkillRow and SpendPanel. The labelled Toggle (ui/Input.tsx:234-273) takes value, onChange, description and color, has no disabled prop, and renders a full-width `flex items-center justify-between py-2` row (:252) with the label on the left. It feeds ConfigField.tsx:24. `git grep -n Toggle -- tests/unit/field-kit.test.tsx` has no hits. The two suites that read WorkflowCanvas pin other things: b2-confirm-button.test.tsx:143-150 asserts there is no native confirm(, and viz-chrome-tokens.test.ts:110-131 asserts there is no raw colour literal. docs/guides/composer.md:106-107 ('Three toggles') and :146-148 ('Turn on HIL gate') hold for either look, and the guide's shot is composer.png. design-lint.baseline.json's growth ledger is keyed rule::file and names field/Toggle.tsx (:248, :615, :805) and ui/Input.tsx (:249, :385, :616, :806). org/tasks/T-0062.json:36 cites field/Toggle.tsx:23; it is historical and not rewritten.
- **Question:** Should the Composer stage inspector's HIL gate, Start and End pill chips become the labelled track switches used on Settings, Skills and Spend?
- **Options:**
  - **Track switches everywhere** — InlineToggle and its labelled wrapper move into ui/field/Toggle.tsx in place of the pill, and the 4 InlineToggle importers and ConfigField repoint. The three inspector call sites rename checked to value. Because the labelled wrapper is a full-width justify-between row, the chips' wrapping row becomes three stacked rows in the w-72 inspector card. role=switch and the labels are unchanged, so composer.md stays true. design-lint may count the moved track classes as growth under field/Toggle.tsx: check with `node scripts/tooling/design-lint.mjs --report` and record any rise with a reason. Recapture composer.png if its shot shows the inspector. R1. About -38 lines.
  - **Keep the pill as a variant of one Toggle** — One Toggle file with a chip variant. No visible change, but two looks survive under one name. R1. About -15 lines.
  - **Leave as is** — Three switch implementations remain. 0 lines.
- **Recommended:** Track switches everywhere — The pill has one consumer, and the documented behaviour (three toggles with those labels) is unchanged. Consolidating also gives components-11 a home for the toggles before ui/Input.tsx goes. The layout change is confined to one inspector card.
- **Sceptic:** I read field/Toggle.tsx, ui/Input.tsx:225-341 and WorkflowCanvas.tsx:665-682. The draft said only that the controls 'look like' the other switches. In fact the prop APIs differ (checked vs value; the labelled wrapper has no disabled), and the labelled wrapper is a justify-between row, so the change is a layout change: chips become stacked rows. The two WorkflowCanvas suites the draft said to check pin native confirm( and raw colours, not the Toggle, so the risk is low. Added the rule::file design-lint ledger, since moving classes can count as growth on the new path, and the composer.png screenshot. The recommendation stands.
- **Ruling:** Track switches everywhere, as recommended — Daniel Parke (operator), 2026-09-12.

#### components-30 · Two markdown renderers: SimpleMarkdown (JSX) for skills, renderMarkdown (HTML string) for chat

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F2
- **Batch:** components · **after:** cross-cutting-14
- **Now:** SimpleMarkdown.tsx is 363 lines with one src importer, app/agent/skills/[...path]/page.tsx, plus tests/unit/simple-markdown.test.tsx. It renders tables (:163), h1-h3 (:279, :290, :301) and links (:81-97). A link becomes `href={match[2]}` with target=_blank and no scheme check. renderMarkdown (chat-utils.ts:94-109) escapes the whole message (:81-89), then substitutes code blocks with a Copy button, inline code, bold, italic and line breaks; it renders no links. MessageBubble.tsx:114-115 injects it through dangerouslySetInnerHTML under a design-lint pragma. useChatPage.ts:108-119 adds a document click listener for Copy, and COPY_BTN_* is used only there and in chat-utils (`git grep COPY_BTN -- src`). docs/guides/chat.md:64 documents the hover Copy button. The pragma cites tests/unit/chat-utils-*, but only chat-utils-sanitise-filename.test.ts exists, and both chat suites that touch renderMarkdown mock it to identity (chat-page-toast.test.tsx:124-127, u14-a-failed-run-is-an-error.test.tsx:25). No test covers its escaping. u14 also reads useChatPage.ts for `handleRetry: send.handleRetry` (:83), which survives. The research renderer, which also shows untrusted content, has tests/unit/research-sources-href-scheme.test.ts. cross-cutting-14(b) (evidence :2194-2201) asks whether chat and skills should render through the deep-research renderer, which has no GFM tables. markdown-it ^15.0.1 is a devDependency today (package.json). policy.json:130-131 puts 'dependencies already installed' in the free band and 'new dependency' in the durable band.
- **Question:** Should chat replies render through the skill pages' markdown renderer, so lists, tables, headings and links show formatted in chat?
- **Options:**
  - **Chat uses SimpleMarkdown** — Chat renders lists, tables, headings and links. Code blocks get a CodeBlock component that owns its hover Copy button, so chat.md:64 stays true. Chat content is model output, so first add an http/https/mailto/relative allowlist to SimpleMarkdown's link href, with a test like research-sources-href-scheme (+10 to +15 lines); skill pages gain the same guard. Removed: renderMarkdown's HTML string, one dangerouslySetInnerHTML sink (MessageBubble.tsx:115) with its pragma, the COPY_BTN exports and the document click delegation (useChatPage.ts:108-119). Update the renderMarkdown and COPY_BTN mocks in chat-page-toast and u14, and add chat cases to simple-markdown.test. Re-render cost while streaming is unmeasured and must be checked. R1. About -10 to -15 lines.
  - **Keep both renderers** — Chat keeps showing raw '-', '#' and link syntax, and the escaped HTML sink stays with no test of its escaping. 0 lines.
  - **One renderer for chat, skills and research** — Rule this under cross-cutting-14(b). The deep-research renderer has no GFM tables, so skill pages would lose tables unless it is extended. markdown-it is already installed as a devDependency. Whether promoting it to a runtime dependency counts as a new dependency needing an ADR is the router's call under policy.json:130-131. Larger, R1 or higher.
- **Recommended:** Chat uses SimpleMarkdown — Chat's renderer handles five constructs, so common model output such as lists and headings shows as raw markdown. SimpleMarkdown is already in the tree, keeps the documented hover Copy, and removes a raw-HTML sink and a document-level listener. The link-scheme guard is a condition, not an option: without it the change adds a link-injection path the current renderer does not have. Rule it together with cross-cutting-14(b).
- **Sceptic:** I re-read SimpleMarkdown's link code (:81-97), chat-utils.ts:75-109, MessageBubble.tsx:105-120 and useChatPage.ts:108-119, and grepped the tests. Hidden cost: SimpleMarkdown puts the markdown target straight into href. Today's chat renderer emits no links, so moving untrusted chat output onto it needs a scheme allowlist and test; the net shrinks accordingly. Whether React 19.2.7 neutralises javascript: URLs by itself was not verified. The draft's option 2 called the HTML sink 'tested', but both chat suites mock renderMarkdown and no chat-utils escaping test exists. The draft also said markdown-it 'would need an ADR', but it is already a devDependency and policy.json:130 makes that ambiguous, so I left it to the router. The recommendation stands with the guard as a condition.
- **Ruling:** Chat uses SimpleMarkdown, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-03b · CHANGELOG Unreleased reads as an engineering diary and contradicts itself

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme F2
- **Batch:** docs · **after:** docs-03a
- **Now:** Re-run: `wc -l -c CHANGELOG.md` = 555 lines, 35,790 bytes; `grep -c '^- '` = 124; `git tag | wc -l` = 0. The only release heading is `## [Unreleased]` at :9, with Added at :24, Changed :93, Security :368, Fixed :379 and Removed :538. Superseded pairs: :307-311 'Six status pills (gateway, memory, scheduler, spend, processes, errors)' against :164-171 'The row is three pills now - Scheduler, Spend, Processes'. src/app/page.tsx:325/333/341 renders those three. :62-64 ('The Settings index lists every section') and :507-508 ('The Settings index says when config.yaml cannot be read') against :200-206 'Settings is one page. It was an index of 30 cards'. Duplicate: :54-57 (update, rebuild and restart live in Settings › System) against :301-306 (moved out of the sidebar into Settings › System). Nothing governing makes CHANGELOG append-only. CONSTITUTION.md:52-55 limits append-only history to decisions, tier exceptions, oracle amendments, incident audits and deviation logs. AGENTS.md:28-29 forbids hand-editing derived files and append-only ledgers. `git grep -i changelog` over org/ (excluding reviews and tasks) finds no such rule. ADR-0010:116-124 protects task records, not CHANGELOG. org/plans/2026-09-final-release.md:338 (plan approved 2026-09-05, :6) schedules 'CHANGELOG.md written from the task records (T-0086 onward) in user language' at the v1.0.0-rc.1 tag, and :791 repeats it. org/HANDOVER.md:130-131 relies on the CHANGELOG telling users to re-add pre-042 custom fallbacks; that instruction is CHANGELOG.md:385-390 and must survive.
- **Question:** Should the Unreleased section be fixed now only where it contradicts itself, leaving the full 1.0.0 rewrite to the rc.1 step the plan already schedules, or be rewritten now?
- **Options:**
  - **Fix contradictions now, editorial pass at rc.1** — Merge each superseded pair into its end-state wording: six pills into the three-pills bullet, the Settings-index bullets into 'Settings is one page', and the two update/rebuild/restart bullets into one. Apply docs-03a. Diary voice and code-level bullets stay until the rc.1 step (plan:338). No released history is touched, because nothing is tagged. R0. About -30 lines.
  - **Rewrite Unreleased now as the 1.0.0 note** — About 8 pairs merged, about 10 code-level bullets dropped (their task records hold them), backstory trimmed across the 55 Changed bullets, and one list style. Keep the three upgrade steps and the pre-042 custom-fallback instruction (:385-390, relied on by HANDOVER.md:130-131). No tests to change. Pre-empts the rc.1 step's own pass. R1. About -150 lines.
  - **Leave until rc.1** — Readers of dev keep seeing 'Six status pills', an index-based Settings description and a duplicated bullet until the release step. 0 lines now.
- **Recommended:** Fix contradictions now, editorial pass at rc.1 — A bullet that contradicts the shipped dashboard or Settings page is a defect today, while cutting bullets is a voice call the approved release plan already assigns to the rc.1 step. No governing file makes CHANGELOG append-only and no released section exists, so either path is allowed.
- **Removes:** The superseded 'Six status pills' sentence (CHANGELOG.md:307-311), the index-based Settings wording (:62-64, :507-508) and one of the two duplicate update/rebuild/restart bullets (:54-57 or :301-306). Each is merged into its end-state bullet (:164-171, :200-206).
- **Sceptic:** I re-ran wc, grep -c and git tag, and read :1-30, :50-66, :160-175, :196-210, :295-315, :383-392 and :500-512 plus the governance lines. The draft's third pair, 'the subsystems bullets', was mislabelled. The real third pair is the Settings-index wording (:62-64, :507-508) against 'Settings is one page' (:200-206); the subsystems panel bullets do not conflict. I added it to the consequences and removes, and cited the fallback instruction's line (:385-390). Ownership note: the recommended option itself is free band, and only the rewrite-now choice needs the operator.
- **Ruling:** Fix contradictions now, editorial pass at rc.1, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-05a · Repository guide restates ADR-0003's design-kit rule, which the 2026-09 overhaul already overtook

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R3 · **needs an ADR** · theme F2
- **Batch:** docs
- **Now:** docs/contributing/repo-guide.md:211-215 is the box '**Being replaced.** The estate's design system is `@pattertech/ui` ... Do not add tokens; the rebuild vendors the shared kit.' ADR-0003 (status accepted, :5, :11) says at :67-68 'PatterStage stops minting design tokens immediately. Any new token is a change to the shared kit, not to globals.css.' The tree has since minted tokens in globals.css: the z scale at globals.css:351-357 arrived in be43f15a (2026-09-07, 'the four scales that never existed, T-0116'). That work followed decision 1 of the operator-approved UI overhaul plan (org/plans/2026-09-ui-overhaul.md:6, approved 2026-09-06; :83-86 'Full freedom inside that identity, including rebuilding the token layer'). The plan does not mention ADR-0003 (`git grep ADR-0003 -- org/plans` finds nothing). src/kit/ holds only BloomField.tsx and PROVENANCE.md (`ls src/kit`), so Part 1's copy-in model is used for a component, but no kit tokens were vendored. org/LOCKBOOK.md:109-111 records as open 'whether the ladder is re-minted in the vendored @pattertech/ui when it lands or stays here'. docs/contributing/design-tokens.md:13-15 names globals.css as the one source, and docs/adr/README.md:29 lists ADR-0003 as accepted. CONSTITUTION.md:80-81: accepted ADRs are immutable, and reversal is a new superseding ADR.
- **Question:** The 2026-09 overhaul rebuilt the token layer in globals.css, which ADR-0003 says PatterStage stops doing. Is ADR-0003's token rule superseded, or does it still govern with the overhaul's tokens recorded as a deviation?
- **Options:**
  - **Token rule superseded: write a superseding ADR** — A new ADR supersedes ADR-0003's token consequence (:67-68) and records globals.css as PatterStage's token source. Part 1's copy-in for components (src/kit) and Part 2 can stand. ADR-0003 gets its sanctioned superseded_by stamp (CONSTITUTION.md:77-78). The repo-guide box becomes a pointer to design-tokens.md, and docs/adr/README.md:29-50 is updated. R3: an accepted ADR, recorded operator approval, and an oracle from a separate ORACLE session. The docs edits are R0 once it is accepted.
  - **ADR-0003 still governs: record the overhaul's tokens as a deviation** — The box cites ADR-0003 instead of paraphrasing it. The tokens T-0116 minted in globals.css are recorded as a deviation. policy.json:131 puts 'recorded deviation from a standard' in the durable band, so it takes a short ADR, and deviation logs are append-only (CONSTITUTION.md:52-55). design-tokens.md:13-15 then says globals.css is interim until the kit lands, and any new token is a kit change. u16 pins that page's primitive list, not its source sentence. R3 if the record is an ADR in org/decisions/; the docs edits are R0 to R1.
  - **Rule later; the box states the facts now** — An R0 rewrite of repo-guide.md:211-215 says ADR-0003 is accepted, the 2026-09 overhaul minted tokens in globals.css (T-0116), and LOCKBOOK.md:109-111 holds the question open, with a link to design-tokens.md. Nothing governing changes, and the conflict stays on record as open. About 0 net lines.
  - **Cite ADR-0003 as governing, with no deviation record** — The guide would tell contributors not to add tokens while design-tokens.md, which u16 holds, describes the tokens the overhaul added. The docs keep contradicting each other. R0. Not advised.
- **Recommended:** Token rule superseded: write a superseding ADR — The operator approved rebuilding the token layer (overhaul decision 1), and the tree did it in globals.css, so the ADR's token rule is already overtaken in fact. CONSTITUTION.md:80-81 allows only a superseding ADR to bring the record back into line. Until that ADR is accepted, the executor can apply the 'box states the facts' wording at R0. The draft's 'still governs; cite it' would have the guide cite a rule the tree broke on 2026-09-07.
- **Sceptic:** I read repo-guide.md:205-220, ADR-0003:1-75, design-tokens.md:1-20, the overhaul plan's front matter and decision 1, LOCKBOOK.md:104-113 and globals.css:351-357, and ran `git log -S'--z-'` and `ls src/kit`. The draft missed that T-0116 already minted tokens in globals.css under an operator-approved plan, and that LOCKBOOK records the question as open. That makes 'ADR-0003 still governs; cite it' indefensible as the default. I rewrote the options to cover supersede, deviation, an interim factual box and the rejected cite-only path, and changed the recommendation, needs_adr (true) and tier floor (R3).
- **Ruling:** Token rule superseded: write a superseding ADR, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-08 · Seven of nine generated-block extractors fence nothing while the same facts are hand-typed

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F2
- **Batch:** docs
- **Now:** `grep -rn '<!-- generated:' docs` finds two fences: analytics-events.md:184 (event-types) and quests.md:49 (quests). scripts/docs/lib.mjs:55-65 GENERATED_BLOCK_IDS lists nine, under a 'The nine facts' comment (:54). extract.ts line ranges: achievementsBlock :74-85 (12 lines), lintStepsBlock :101-109, configSectionsBlock :111-121 (11), seedManifestsBlock :123-149 (27), HTTP_METHODS plus apiRoutesBlock :151-189 (39), schemaHeadBlock :191-212 (22), an orphan JSDoc at :214-218 (questsBlock's own starts at :219) and envTableBlock :275-317 (43). The switch is at :326-350, and its error text says 'The nine' (:349). Only check.mts:29/:173 and the docs:generate script call generateBlock. tests/unit/b15-generated-blocks.test.ts:76-91 pins the nine, its fixtures use api-routes and env-table (:63-72, :97-149), and :162-187 names the lazily imported sources. org/tasks/T-0109.json says 'no docs page carries a fence yet, so B18 inserts the markers where it wants the facts.' Plan decision 3 is at org/plans/2026-09-final-release.md:306 and :697-700. Where each unused fact stands: the lint count is hand-typed and wrong at CONTRIBUTING.md:31 and repo-guide.md:25/:33, while testing.md:164 is held by u16. No docs page types the schema head: schema.md has none, and migration.md:68 removed it on purpose. Its one wrong copy, CHANGELOG.md:22, is outside the docs walk (extract.ts:34, :392). Env table (read-only node scan): .env.example has 18 variables. env-reference.md's tables document 21 that .env.example lacks, for example PS_AUTH_TOKEN, PS_AUTH_MODE and HERMES_GATEWAY_URL. Nine .env.example variables appear nowhere in env-reference.md: HINDSIGHT_BACKUP_DIR, _BANK, _RETENTION_DAYS, _LIMIT, PS_ALLOWED_DEV_ORIGINS, PS_SOCAT_RELAY, PS_SOCAT_RELAY_PORT, PS_NEXT_BIND_HOST and PS_SOCAT_BIND.
- **Question:** For the seven generated-fact extractors no docs page uses, which should a page adopt and which should be deleted?
- **Options:**
  - **Adopt lint-steps and env-table; delete the other five** — Fence lint-steps once in testing.md, below the u16-held sentence, and point CONTRIBUTING.md and repo-guide.md at it. Add env-table to env-reference.md as a generated table of .env.example beside the curated tables. It surfaces the 9 variables the page never mentions, while the 21 documented variables .env.example lacks stay hand-written. Delete achievements, config-sections, seed-manifests, api-routes and schema-head (about 111 lines plus 10 switch lines), and the orphan JSDoc. Shrink GENERATED_BLOCK_IDS and the b15 list, reword the 'nine' comments (lib.mjs:54, extract.ts:322-323 and :349, b15:76-77 and :168-175), and move the b15 fixtures off api-routes. The b1 api.md test stays. Record the departure in the new task's record; T-0109 is historical and not rewritten. R1. About -110 lines in scripts, plus about 35 generated lines in docs.
  - **Adopt lint-steps, schema-head and env-table; delete four** — As above, but schema-head stays and schema.md gains a generated head line it does not carry today. migration.md cannot take it without reversing :68. Fixes nothing in CHANGELOG, which is outside the walk. R1. About -90 lines.
  - **Delete all seven unused extractors** — About -150 lines. The lint count stays hand-typed (the drift docs-05 and docs-06 found), and the 9 undocumented .env.example variables stay unnoticed. Departs from decision 3 for 7 of 9 facts. R1.
  - **Adopt all nine** — Fences on the achievements, config, seed and API pages too. api.md's table needs its hand-written Purpose column split out (b1 test), and env-table still cannot replace the curated tables. Full adherence to decision 3. R1. About +40 lines.
  - **Leave the adoption unfinished** — Extractors and tests stay and fence nothing, and the hand-typed counts keep drifting. 0 lines.
- **Recommended:** Adopt lint-steps and env-table; delete the other five — lint-steps has proven drift in docs/, and env-table would surface nine variables the reference page never mentions. schema-head has no docs page to guard, since its only wrong copy is in CHANGELOG outside the walk, and the other four have no page asking for them.
- **Removes:** The planned generated fences for achievements, config sections, seed manifests, API routes and schema head (plan decision 3, org/plans/2026-09-final-release.md:306 and :697-700). No published page content goes.
- **Sceptic:** I re-ran the fence grep and read lib.mjs:30-70, extract.ts:70-350, the b15 test and T-0109; every line range holds. Two errors in the draft's recommendation. First, it justified schema-head with the CHANGELOG:22 drift, which its own note says a fence cannot fix, and no docs page states the head. Second, it treated env-table as a drop-in for env-reference.md, but a node scan shows .env.example and the page disagree both ways (21 and 9 variables), so the fence can only add a table. I recast the options and recommended adopting lint-steps and env-table. I also listed the 'nine' comments and titles to edit, and replaced 'record in the task record' with a new record, since T-0109 is not rewritten.
- **Ruling:** Adopt lint-steps and env-table; delete the other five, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-11a · Fold check-doc-links into docs:check so the Pages publish path checks links

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F2
- **Batch:** docs · **after:** docs-01
- **Now:** package.json:18 lint step 2 is `node scripts/tooling/check-doc-links.mjs`, a step inside lint rather than its own npm script. The script is 76 lines, walks docs/ only (:21), unsorted (:24-31), and tests targets with existsSync (:54). .github/workflows/docs-pages.yml publishes on push to main (:3) and runs only docs:check and docs:build (:16-17). ci.yml:29-34 runs lint, and so the link check, on every push and PR to main and dev, but branch protection requires no checks (LOCKBOOK.md:275-280), so a red link check does not block a merge. u16-the-docs-describe-the-system.test.ts:107-116 requires testing.md to say 'chains <N> gates', with N equal to the lint length, and to name check-icon-button-names and check-form-control-names; removing a step forces testing.md:164 to say eleven. The gate is also named at repo-guide.md:38 and CONTRIBUTING.md:31-32. Accepted ADR-0010:110-113 names `check-doc-links.mjs` as the gate that keeps links from docs/ into org/ checked. The ADR cannot be edited (CONSTITUTION.md:80-81), so a folded check must still resolve targets outside docs/. Comments and a test title also name the script: build-site.mjs:150, check-derived-views.mjs:162, b15-corpus-moves-under-org.test.ts:13 and b17-quest-integrity.test.ts:339. checkDocs is pure over injected input (lib.mjs:670-674) and emits 8 codes, while REFUSAL_CODES (lib.mjs:45-52) and RefusalCode (lib.d.mts:59-65) list 6 (docs-12).
- **Question:** Should the separate doc-link gate be folded into docs:check as a broken-link refusal, so the GitHub Pages publish job also checks links?
- **Options:**
  - **Fold into docs:check** — check-doc-links.mjs and its lint step go (12 steps to 11), and every relative link is still checked, now inside docs:check, so the Pages job checks links without a workflow edit. checkDocs gains an injected exact-case file-exists function that resolves any repo path (docs-01), so docs-to-org links stay checked as ADR-0010:110-113 relies on. Root documents (docs-02) would need a separate input, because docs:check refuses any page without front matter (lib.mjs:35). Add the code to REFUSAL_CODES, RefusalCode and b15-docs-check-refusals. Edit testing.md:164 to eleven (u16 enforces), repo-guide.md:38, CONTRIBUTING.md:31-32 and the four comments; ADR-0010 keeps naming the old script. R1. About -50 lines.
  - **Keep the gate, add it to the Pages workflow** — One step added to .github/workflows/docs-pages.yml, a sensitive path (R2). The lint chain and docs are unchanged. About +1 line.
  - **Keep as is** — CI still reports a broken link on the push or PR, but nothing requires that check before a merge, and the publish job does not re-check links. 0 lines.
- **Recommended:** Fold into docs:check — It keeps the documented behaviour (every link checked, including links into org/), closes the publish-path gap at R1 rather than R2, and is where docs-01's exact-case fix belongs.
- **Removes:** `node scripts/tooling/check-doc-links.mjs` as a separate step of `npm run lint`. No npm script is removed; the check moves into `npm run docs:check`. testing.md:164's documented 'twelve gates' becomes eleven.
- **Sceptic:** I read check-doc-links.mjs in full, both workflows' triggers, u16:107-116, and grepped every reference to the script. Hidden costs the draft missed: accepted ADR-0010:110-113 names the script and relies on docs-to-org links being checked, so the fold must resolve paths outside docs/, and the immutable ADR will name a deleted file. Four comments and a test title name it. Root docs cannot simply join the pages walk. The draft's 'keep as is' consequence overstated the gap: CI does run the check but cannot block a merge. I also noted that no npm script is removed. The recommendation stands.
- **Ruling:** Fold into docs:check, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-16 · README repeats the install page and the start-here index

- **Re-verified:** moved · sceptic: corrected · **tier floor:** R0 · theme F2
- **Batch:** docs
- **Now:** A read-only node shingle scan (front matter and generated fences stripped, 12-word shingles) finds README.md with 1,199 shingles. It shares 141 with docs/start-here/install.md, 44 with start-here/index.md and 3 with docs/README.md; the review had 121 of 1,124, with a different tokeniser. README.md:55-63 is the WSL block, which install.md:28-38 also carries ('## Windows: set up WSL2 first', `wsl --install -d Ubuntu`, the reboot and localhost note). :65-83 is the token section, a security notice, and :85-86 already links install.md as the longer version. :114-116 separately says Windows runs under WSL2. :126-131 'AGENTS.md and CLAUDE.md are not for you' is repeated at docs/README.md:83-84. The operator-approved release plan fixes README's shape at org/plans/2026-09-final-release.md:784-786: 'what it is, one hero screenshot, four commands, where the docs are, "AGENTS.md and CLAUDE.md are for AI coding sessions, not for you"' (plan approved 2026-09-05, :6). No test reads root README.md. docs/README.md is read by b15-corpus-moves-under-org.test.ts:152-157, b17-quest-integrity.test.ts:339-340 (must link quests.md) and u13-help-names-itself.test.tsx:31.
- **Question:** Should the GitHub front-page README keep the four install commands and the token warning, with the Windows WSL2 steps reduced to a one-line link to the install page?
- **Options:**
  - **Commands, token warning, one-line WSL link** — README.md:55-63 becomes one line ('On Windows, set up WSL2 first: see installing'); the full steps stay at install.md:28-38, and :114-116 still says Windows runs under WSL2. The token warning stays, a departure from plan :784-786 the operator confirms here. Drop the duplicate sentence at docs/README.md:83-84 and keep README's, as the plan asks; none of the docs/README.md pins are affected. Windows readers are one click from the wsl command. R0. About -12 lines.
  - **Keep README as is** — 141 shared shingles with install.md keep drifting together. 0 lines.
  - **Also move the token section to a link** — Matches plan :784-786 exactly, but the first-run 401 explanation leaves the front page even though the printed token URL is the only way in. R0. About -30 lines. Not advised.
- **Recommended:** Commands, token warning, one-line WSL link — Windows setup stays discoverable from the front page and fully documented in install.md. The token warning is a security notice that belongs where readers first run the server, which justifies the one departure from the planned README shape.
- **Removes:** README.md's inline WSL2 install steps (:55-63), still documented at docs/start-here/install.md:28-38, and the duplicate AGENTS.md/CLAUDE.md sentence at docs/README.md:83-84 (README.md:126-131 keeps it).
- **Sceptic:** I re-ran the shingle scan and got the draft's figures exactly (141/1,199, 44, 3), so 'moved' holds as a method change. install.md's WSL section is :28-38, not :28-33. The draft missed that the approved release plan (:784-786) already records README's shape. That makes the token section, not the WSL block, the part needing the operator's confirmation, so I added it to the reason and consequences. README :114-116 keeps the WSL2 statement either way.
- **Ruling:** Commands, token warning, one-line WSL link, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-17 · SUPPORT.md and start-here/getting-help.md are two start-here pages for one question

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R0 · theme F2
- **Batch:** docs
- **Now:** docs/SUPPORT.md is 36 lines with front matter section start-here, nav 60 (:4-5). getting-help.md is start-here, nav 50 (:4-5), and its :67 says '[Support](../SUPPORT.md) is the short policy version of this page'. The read-only node scan finds 3 shared twelve-word shingles out of SUPPORT.md's 214. SUPPORT.md:24 and :26 use retired labels. getting-help.md:35-38 already routes agent-loop, tool and gateway questions to Hermes upstream, which is SUPPORT.md's 'Hermes Agent vs this repo' section (:15-20). GitHub uses the file: .github/ISSUE_TEMPLATE/config.yml:7-9 links blob/main/docs/SUPPORT.md as the 'Support' contact link. b15-corpus-moves-under-org.test.ts:167-178 pins the docs/ top-level list, SUPPORT.md included. docs/manifest.json:59-64 and :723 carry slug 'support' under Start Here; the manifest is derived and regenerated with `npm run docs:build -- --manifest-only`. Every page needs section and nav (REQUIRED_KEYS, lib.mjs:35). The other top-level policy pages sit in running (SECURITY.md, nav 90) and contributing (CONTRIBUTING.md nav 10, CODE_OF_CONDUCT.md nav 80).
- **Question:** Should docs/SUPPORT.md keep its filename but shrink to a short pointer (getting help, Hermes vs this repo, security, code of conduct) and leave the Start Here reading order?
- **Options:**
  - **Cut to a pointer, keep filename, leave start-here order** — About 10 lines. The issue-template link, GitHub detection and the b15 file-list test are unaffected. The page moves to another section, for example contributing beside CODE_OF_CONDUCT.md, and takes a nav slot there. docs/manifest.json is regenerated, not hand-edited, and the slug stays 'support'. getting-help.md:67's wording is updated. Start Here loses one entry. R0. About -22 lines.
  - **Cut to a pointer, stay in start-here** — Same cut, reading order unchanged; regenerate the manifest for the new summary. R0. About -20 lines.
  - **Keep as is, relabel links only** — Two start-here pages keep answering one question; fix the :24 and :26 labels under docs-14. 0 net.
- **Recommended:** Cut to a pointer, keep filename, leave start-here order — getting-help.md already carries the substance, including the Hermes split, so the policy page only needs to route. Keeping the filename preserves the GitHub contact link and the pinned docs/ file list.
- **Removes:** SUPPORT.md's long-form wording and its place in the Start Here reading order (nav 60). The file and its docs/SUPPORT.md URL stay.
- **Sceptic:** I read SUPPORT.md in full, getting-help.md :1-8, :34-42 and :62-70, the issue-template config, manifest.json:50-66 and the other top-level pages' front matter. Small corrections: the required-key rule is lib.mjs:35 (REQUIRED_KEYS), not :36. The Hermes routing is getting-help.md:35-38. I named the sections the sibling policy pages already use, so the executor has a concrete destination, and noted the manifest slug does not change. The recommendation stands.
- **Ruling:** Cut to a pointer, keep filename, leave start-here order, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-18 · Each screenshot recapture adds history weight, and nothing notices stale shots

- **Re-verified:** confirmed · sceptic: corrected · **tier floor:** R1 · theme F2
- **Batch:** docs
- **Now:** `ls docs/images/*.png | wc -l` = 21 and `cat docs/images/*.png | wc -c` = 2,947,070. `git log --format=%h -- docs/images | wc -l` = 24, the last being 8c61d674 (2026-09-10, T-0143). `git rev-list --objects --all -- docs/images | awk '$2 ~ /^docs\/images\//' | cut -d' ' -f1 | git cat-file --batch-check` = 347 blobs, 47,456,951 bytes. `git log --oneline 8c61d674..HEAD` = 11 commits, 3 of them touching src/app, src/components or src/modules, and `git diff --stat` over those trees = 221 files changed. .gitignore:66-67 ignores /site/ and /public/help/. package.json:29 defines screenshots as `cross-env PORT=3477 CAPTURE_SCREENSHOTS=1 playwright test screenshots.spec.ts`. Costs the draft missed: checkDocs has refusals only (lib.mjs:45-52), so a warning is a new output kind. Every actions/checkout@v5 step in ci.yml and docs-pages.yml sets no fetch-depth (`grep -n fetch-depth` finds none), so CI and the Pages job have shallow clones with no history for a commit-based staleness check. Whether today's 21 shots are stale is unverifiable-readonly, because `npm run screenshots` binds a port and writes PNGs.
- **Question:** Should documentation screenshots be recaptured at release points, losslessly compressed first, with a docs:check warning when a guide's screen changed after its shot, instead of after every UI batch?
- **Options:**
  - **Release points, compress, warn on staleness** — Guides can show pre-batch UI between releases. At capture, a small generated file beside docs/images records a hash of each guide's screen: route source, and docs:check warns when the hash no longer matches. That is a new warning tier and about 30 lines of tooling. A commit-id record would not work in CI or the Pages job without adding fetch-depth to .github/workflows/ (R2). A full recapture adds at most about 3 MB. A PNG optimiser added as a devDependency is a new dependency (policy.json:131, durable band, so a short ADR); a manual external tool is not. R1 with the hash approach.
  - **Recapture per UI batch (today)** — Shots stay current, at up to about 3 MB of history per full recapture. 0 lines.
  - **Release points, no warning** — Least history growth, but stale shots go unnoticed between releases. 0 lines.
- **Recommended:** Release points, compress, warn on staleness — The measured cost is 45.3 MiB across 347 blobs, and 3 UI commits have already landed since the last capture. A content-hash warning makes drift visible without git history, instead of relying on how often shots are recaptured. Reclaiming existing history would need a destructive rewrite (R3), which is not proposed.
- **Sceptic:** I re-ran the PNG count and bytes, the commit counts and the diff stat. The first blob recount returned nothing because rev-list output was piped to batch-check with paths attached; cutting the sha column reproduced 347 blobs and 47,456,951 bytes. Two hidden costs: checkDocs has no warning tier, and the CI and Pages checkouts are shallow, so 'files changed after the recorded capture commit' cannot run there without an R2 workflow edit. I replaced the mechanism with a content hash to keep R1. The recommendation stands.
- **Ruling:** Release points, compress, warn on staleness, as recommended — Daniel Parke (operator), 2026-09-12.

#### docs-19a · EOS front-matter keys sit on 47 of 75 docs pages

- **Re-verified:** confirmed · sceptic: upheld · **tier floor:** R0 · theme F2
- **Batch:** docs
- **Now:** `git ls-files 'docs/*.md' | wc -l` = 75. Of those, `xargs grep -l` finds '^type:' on 47, '^tags:' on 47, '^compiled_from:' on 29 and '^audience:' on 74. scripts/docs/lib.mjs:38-43 IGNORED_KEYS = type, tags, compiled_from, status, approved_by, session, with the comment 'front matter that another toolchain reads'. The only in-repo writer outside scripts/docs is scripts/tooling/eos-compile.mjs, which writes compiled_from at :127; `git grep -l -E 'compiled_from|\btags:' -- scripts ':!scripts/docs'` returns only that file. In-repo signs that EOS reads these keys: ADR-0010:121-122 says `type` and `tags` front matter 'is how the EOS identifies them regardless of path', and org/COMPILE_REPORT.md lists 45 docs/ rows, most marked normalised, so the EOS compile pass processed docs pages. Whether estate EOS tooling outside this repo (eos_check.py, named in check-agent-files and repo-guide.md:37) indexes docs/ today is unverifiable-readonly.
- **Question:** Should the EOS keys (type, tags, compiled_from) be removed from docs pages, added to the 28 pages without them, or left as they are?
- **Options:**
  - **Leave as they are** — docs:check keeps ignoring them. No change. 0 lines.
  - **Remove from docs pages** — About 123 key lines across 47 pages. IGNORED_KEYS keeps them for the root legal and branding docs, or loses them if docs:check should refuse them. Any external EOS index of docs/ loses its metadata. Regenerate the manifest if it carries them. R1.
  - **Add to the remaining pages** — About +84 lines of uniform metadata, useful only if an EOS tool reads docs/. R1.
- **Recommended:** Leave as they are — The pipeline records that another toolchain reads the keys, ADR-0010 says EOS identifies files by them, and COMPILE_REPORT shows the EOS compile touched docs/. They cost nothing at runtime. Revisit once the operator confirms the EOS index scope.
- **Sceptic:** I re-ran all four key counts and the page count (75), read IGNORED_KEYS and eos-compile.mjs:120-130, :150-160 and :195-202, and re-ran the scripts grep. Everything reproduces. I added two in-repo signs that EOS reads these keys (ADR-0010:121-122 and COMPILE_REPORT's 45 docs/ rows), which support the 'leave' recommendation.
- **Ruling:** Leave as they are, as recommended — Daniel Parke (operator), 2026-09-12.

### Decisions the critic added

No theme owned these; each was verified against the tree the same way.

#### POLICY-release-order · Is v1.0.0 cut before this programme's structural batches, or after them?

- **Re-verified:** confirmed · **tier floor:** R0
- **Batch:** closing · **after:** POLICY-ci-green
- **Now:** Release state:
  - `git tag | wc -l` = 0, and package.json's version is 0.1.0 (node -e).
  - T-0113 (node -e) is in_progress, standard R2, owner unassigned. Its intent is B19: tag v1.0.0-rc.1 on dev, the real-Hermes round, v1.0.0, dev merged to main through the gated release PR (ADR-0006), Pages, and the README hero and images recaptured.
  - PR #157 (dev to main) has been open since 2026-06-04; `gh pr view 157` shows BLOCKED, REVIEW_REQUIRED.
  - HANDOVER.md:154-157: 'The v1.0.0 tag waits on the operator after the programmes'.
  
  Register entries keyed to the release:
  - 'first release after v1.0.0': POLICY-aliases, cross-cutting-04a/b, critic-05b, app-21, hooks-25, lib-domains-14a, tooling-11a/11d, critic-08, app-15a and docs-04.
  - 'at rc.1': docs-03b.
  - 'release points': docs-18.
  - The plan's post-1.0 deferrals (org/plans/2026-09-final-release.md:814-829): tooling-03 and lib-domains-13b.
  
  ADR-0006:42 and :70 say done means merged to a green dev, and that dev CI must be watched. dev CI is red at ce4ac1fd (`gh run list`: failure at 2026-09-10T18:58Z), so rc.1 cannot be cut from dev today.
- **Question:** Is v1.0.0 cut after the CI, security and data-safety batches but before the structural refactors, after the whole programme, or straight after CI is green?
- **Options:**
  - **Green, fix defects, release, then refactor** — Before rc.1:
    - batch 0 (CI green, including the smoke contract fix);
    - the security defects (critic-01, 02s, 03a, 03b, 04, 14, tooling-05, tooling-29);
    - the tooling-13 data-ordering fix, at least its 'back up before building' option;
    - the alias boot warning (POLICY-aliases);
    - the CHANGELOG contradiction fixes (docs-03a/b).
    
    Then T-0113 cuts rc.1 and v1.0.0.
    
    After the tag, on dev: moves, UI convergence, removals and the DB lifecycle rework. The first post-1.0 release carries the alias and redirect retirements. Nothing is removed by this ruling.
  - **Whole programme, then release** — Every batch lands before rc.1, so the release waits for every R2 batch under two lanes and org-03b's independent review. The post-1.0 retirements slip to a later release, and rc.1's walk and screenshots run once at the end.
  - **Release straight after green** — Only batch 0 precedes rc.1. The known lockout, token-logging, framing, SSRF and build-before-backup defects ship in 1.0.0 as known issues.
- **Recommended:** Green, fix defects, release, then refactor — The release has waited on #157 since 2026-06-04, and four promises in the tree are dated to it. dev cannot be released red. Shipping known security and data-ordering defects is avoidable at small cost, while structural refactors add release risk with no user benefit.
- **Ruling:** Green, fix defects, release, then refactor, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-closed-oracles · How a later batch may amend a closed programme's oracle suite

- **Re-verified:** confirmed · **tier floor:** R1
- **Batch:** governance-discipline-gates
- **Now:** The rules:
  - CONSTITUTION.md:40-41: 'gate amendments are append-only and authored by a non-implementer'.
  - CONSTITUTION.md:52-55: oracle amendments are append-only history.
  
  The only precedent: u15-one-driver-for-sql-migrations.test.ts:31-32, 'Amended 2026-09-10 (T-0140)'.
  
  Closed assertions that recommended register items must change:
  - c6-the-page-layer.test.ts:57 ('%s reads zero on the tree'): components-01, hooks-04.
  - c6:39 (PRAGMA_CEILING 12) and :104-105 (reads.files empty, handRolledReadHooks 0): hooks-05.
  - c8-the-programme-is-closed.test.ts:80 (the key set): tooling-22.
  - c8:88 (met targets; routesWithTryCatch TARGET 13 at :43): app-04a.
  - c8:94 and :111: org-15.
  - u15:35: lib-data-01.
  - u16-the-docs-describe-the-system.test.ts:107-116 (lint count): org-03a and docs-11a.
  - The c2, c4, c5 and c6 census ceilings: tests-02a.
  
  No register entry says how a batch may amend one.
- **Question:** When a gate fix or refactor turns a closed programme's oracle red, how may that oracle change?
- **Options:**
  - **Dated amendment by a separate session** — A batch may change only the assertion its ruled item touches, and only to a written baseline or a re-anchored number.
    - No it() block is deleted without that item's own ruling.
    - Each change carries a dated 'Amended YYYY-MM-DD (T-####)' comment, as u15:31-32 does.
    - A session other than the implementer authors it (CONSTITUTION.md:40-41).
    
    This settles the c6, c8, u15 and u16 edits in components-01, hooks-04/05, app-04a, tooling-22, org-15, lib-data-01, org-03a and docs-11a. R1 per amendment.
  - **Frozen: burn down first** — Closed oracles never change, so each gate fix waits for a full burn-down:
    - components-01 converts 104 raw controls first;
    - hooks-04 converts 18 writes first;
    - hooks-05 converts 5 hooks first.
    app-04a and tooling-22 need a separate census, and org-15's coupling stays. The blind gates stay blind until then.
  - **Retire into a record checker** — The c0 to c8 and u* record assertions move into a script, and about 30 suites lose their test identity. R1 to R2.
- **Recommended:** Dated amendment by a separate session — It matches the only precedent in the tree and the constitution's rule on who authors an amendment, and it lets blind-gate fixes land with a gate that can see.
- **Ruling:** Dated amendment by a separate session, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-public-contract-scope · Whether deleting an internal exported symbol counts as public-contract (R2)

- **Re-verified:** confirmed · **tier floor:** R0
- **Batch:** governance-discipline-gates
- **Now:** The written factor and the detector disagree:
  - policy.json:15: public-contract is 'public API surface or exported interface delta', sourced from derived:public-api-delta, tier floor R2.
  - The EOS router computes that signal from path substrings only: router.py:77-78 (the factor), :174 (`_PUBLIC_API_MARKERS = ("api/", "public/", "openapi", ".d.ts")`) and :273-274 (the substring test).
  - Precedent: T-0007.json:3 proposed R2 public-contract for deleting 38 exported symbols, also noting the sweep reached src/app/api.
  
  Register rows whose tier depends on the reading:
  - lib-data-09a, components-16, docs-12b, lib-domains-05a and hooks-15a ('R2 if exported-interface deltas count');
  - critic-02s;
  - components-02/11/12, which F2 note 3 reads as R1.
  
  Under org-03b every R2 batch runs high-assurance with an independent review, and POLICY-lanes allows two writers.
- **Question:** Does deleting or changing an exported TypeScript symbol that nothing outside the repository imports count as a public-contract (R2) change?
- **Options:**
  - **No: routes, CLI, env, config and documented exports only** — The programme plan records this reading: public-contract means a path the router's markers match (router.py:174), or any documented HTTP route, npm script, env var, config key or @public-tagged export.
    - Internal exports are tiered by size and path, so the five dead-code rows and critic-02s fall to R0 or R1 unless they touch a sensitive path.
    - An EOS_FEEDBACK friction entry notes the prose/detector mismatch.
    - No policy edit. R0, about +10 lines.
  - **Yes: any exported symbol** — About ten small batches become R2. Each is high-assurance with an independent review (if org-03b holds) and counts against the two-lane cap.
  - **Amend policy.json:15 by ADR** — The summary is rewritten to match the router. R3, with operator approval recorded and an oracle from a separate ORACLE session, about +30 lines.
- **Recommended:** No: routes, CLI, env, config and documented exports only — The router, which the policy itself names as the source, already reads it this way. Internal exports have no consumer outside the repo, and R2 review of dead-code deletions would dominate the programme's review budget.
- **Ruling:** No: routes, CLI, env, config and documented exports only, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-solo-protection · Branch protection that its only maintainer can meet only by admin bypass

- **Re-verified:** confirmed · **tier floor:** R0
- **Batch:** tooling-ci · **after:** POLICY-ci-green, tooling-30a
- **Now:** Settings (read-only gh api):
  - main: 1 approving review, code-owner review, last-push approval, contexts [], enforce_admins false.
  - dev: 1 approving review, contexts [], enforce_admins false.
  
  Who can meet them:
  - .github/CODEOWNERS:1-6 names only @Daniel-Parke.
  - `gh pr view 157`: author Daniel-Parke, reviewDecision REVIEW_REQUIRED, mergeStateStatus BLOCKED.
  - HANDOVER.md:98 lands every batch with `git push origin dev`.
  - ADR-0006:2: main moves only through gated release PRs.
  
  GitHub does not let a PR author approve their own PR (documented GitHub behaviour, outside the repo, not exercised). So both review rules can be met only through the admin bypass, and tooling-30a's required checks would bind no one while enforce_admins is off.
- **Question:** How should main and dev protection work when the one maintainer is also the only code owner?
- **Options:**
  - **Checks bind, reviews match reality** — main:
    - acceptance-gate and build-test-ubuntu become required checks (tooling-30a);
    - enforce_admins goes on;
    - required approving reviews go to 0 and code-owner review goes off.
    PR #157 then merges only when green, admin included, but reviews are no longer enforced on main.
    
    dev: keeps direct pushes, and its review requirement is removed so the setting states the practice. The per-batch CI wait (POLICY-ci-green) is the dev gate.
    
    Operator settings only; 0 repo lines.
  - **Add checks, keep reviews and bypass** — tooling-30a as drafted. The admin still bypasses both rules, so nothing binds mechanically, and 'never merge red' lives only in the written procedure.
  - **Enforce admins, keep reviews** — #157 can never merge unless a second GitHub account approves it.
- **Recommended:** Checks bind, reviews match reality — A rule nobody can satisfy trains bypass. Turning enforce_admins on is the only way the checks bind the release merge, and that deadlocks unless required reviews drop to 0.
- **Removes:** The required approving review on dev and main, a setting the only maintainer cannot satisfy for his own PRs.
- **Ruling:** Checks bind, reviews match reality, as recommended — Daniel Parke (operator), 2026-09-12.

#### PR-234-healthz · Open PR #234 adds unauthenticated /healthz routes that duplicate /api/health

- **Re-verified:** confirmed · **tier floor:** R0
- **Batch:** tooling-ci
- **Now:** The PR:
  - `gh pr view 234`: OPEN, feature/healthz-liveness-endpoint into dev, by Daniel-Parke, created 2026-08-31.
  - 7 files, +117/-5: docs/API.md, docs/TESTING.md, src/app/api/healthz/route.ts, src/app/healthz/route.ts, src/proxy.ts, tests/unit/healthz-liveness.test.ts and tests/unit/proxy-auth.test.ts.
  - Its commits merge 'dev' from the old hermes-control-hub remote.
  
  Against dev:
  - `git ls-files docs/API.md docs/TESTING.md` returns nothing: the pages moved to docs/reference/api.md and docs/contributing/testing.md.
  - src/app/api/health/route.ts already exists.
  - src/proxy.ts:49 is `PUBLIC_PATHS = new Set(["/api/health"])`.
  - docs/reference/api.md:25 and :104 call /api/health 'the one unauthenticated route'.
  
  No theme drafted it. org-12a notes that T-0003's end state ('nothing unsanctioned') has regressed.
- **Question:** Close PR #234 as a duplicate of /api/health, or rebase and land it?
- **Options:**
  - **Close, keep /api/health** — Close the PR with a note pointing at /api/health. api.md:25 stays true. No repo change. R0.
  - **Rebase and land** — Rebase onto dev: the doc paths and proxy.ts have both changed since. Add api.md rows (b1-api-md-matches-the-route-tree) and re-bless the canary's httpSurface. Reword api.md:25 and :104 to name two public routes. R2 (proxy.ts, public contract), about +120 lines.
  - **Leave open until after 1.0** — The branch keeps drifting from dev and keeps counting against T-0003's end state.
- **Recommended:** Close, keep /api/health — It duplicates the documented probe route, and the branch predates C0 to C8 and targets doc paths that no longer exist.
- **Removes:** The unmerged /healthz and /api/healthz liveness routes proposed in PR #234; nothing on dev is removed.
- **Ruling:** Close, keep /api/health, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-dependabot-actions · Two GitHub Actions major bumps for the Pages workflow have no entry

- **Re-verified:** confirmed · **tier floor:** R2
- **Batch:** tooling-ci · **after:** POLICY-ci-green
- **Now:** - `gh pr list`: #235 bumps actions/upload-pages-artifact 3 to 5 and #236 bumps actions/deploy-pages 4 to 5, both opened 2026-09-09 against dev.
  - .github/workflows/docs-pages.yml uses upload-pages-artifact@v3 at :18 and deploy-pages@v4 at :21.
  - .github/dependabot.yml has a github-actions ecosystem entry targeting dev.
  - POLICY-dependabot covers only the ten npm branches, read from stale local refs. The PR heads have moved: #227 is now knip 6.16.1 to 6.34.0.
  - docs-pages.yml is not on origin/main (docs-12a), so it has never run.
- **Question:** Land the Pages workflow's two action major bumps now as a pair, or hold them?
- **Options:**
  - **Land the pair after batch 0** — One dev commit updates both actions, since they are a matched pair. They are first exercised at T-0113's Pages step. R2, 2 lines.
  - **Close until the release** — The first Pages run uses v3 and v4, and Dependabot reopens the bumps later.
  - **Fold into POLICY-dependabot's batch** — One dependency batch covering all 12 PRs, refreshed from their current heads first.
- **Recommended:** Land the pair after batch 0 — The workflow has never run, so neither version is proven. Landing the pair now means the first run uses current majors, and it clears the queue.
- **Ruling:** Land the pair after batch 0, as recommended — Daniel Parke (operator), 2026-09-12.

#### POLICY-asvs-exclusions · Where RUL-SEC-003's per-surface ASVS exclusions are recorded, and against which version

- **Re-verified:** confirmed · **tier floor:** R3 · **needs an ADR**
- **Batch:** security-defects
- **Now:** The ruling:
  - RUL-SEC-003 (org/RULINGS.json:322-332) sets 'ASVS level 1 ... level 2 on ... the session-auth path, with exclusions recorded per surface', and its departures array is empty.
  - `git grep -n -i asvs` finds only :327, so no ASVS version is named anywhere.
  
  Possible vehicles:
  - node -e over RULINGS.json: 15 rulings, 2 with departures. RUL-ARCH-003 records a scoped departure with a written reason.
  - CONSTITUTION.md:46-48: durable decisions take a short ADR, and policy.json:131 lists 'recorded deviation from a standard' as durable.
  
  Who needs it: critic-02 and critic-03a each carry needs_adr for an exclusion, and critic-04's option 3 would add a third.
- **Question:** Record the ASVS exclusions in one ADR (naming ASVS 4.0.3), in the ruling's departures list only, or in one ADR per exclusion?
- **Options:**
  - **One ADR, departures point to it** — One short ADR names ASVS 4.0.3, the version whose clauses the register cites. It lists critic-02's lockout and short-token residual, and critic-03a's first-start print. RUL-SEC-003's departures array points at it. One R3 cycle instead of two.
  - **Departures only** — Each exclusion goes into RUL-SEC-003's departures, following RUL-ARCH-003. This treats an exclusion as executing the ruling's own clause rather than deviating from a standard. R1, but it rests on a narrow reading of policy.json:131.
  - **One ADR per exclusion** — critic-02 and critic-03a each carry their own ADR: two R3 cycles, each with its own ORACLE session.
- **Recommended:** One ADR, departures point to it — It halves the R3 cost, names the version the repo never states, and keeps the durable-band rule intact.
- **Ruling:** One ADR, departures point to it, as recommended — Daniel Parke (operator), 2026-09-12.

#### RUL-SEC-002-precommit · Accepted ruling RUL-SEC-002 has no pre-commit scan and no deny list

- **Re-verified:** confirmed · **tier floor:** R1
- **Batch:** security-defects · **after:** tooling-29, tooling-30b
- **Now:** The ruling: RUL-SEC-002 (org/RULINGS.json:307-313, accepted 2026-08-23) requires 'a staged pre-commit secret scan and a push-path scan, with the credential files and secret environment variables named explicitly in the deny list', and says a bypass must leave an audit record.
  
  In the tree:
  - `ls scripts/git-hooks` shows only pre-push.
  - .gitleaks.toml:1-8 holds only a tests/ path allowlist, with no deny list.
  - .github/workflows/gitleaks.yml:3-17 scans pushes and PRs to main and dev, which is the push-path half.
  
  Neighbouring entries: tooling-29 (verified) replaces the allowlist only, and tooling-30b leaves hooks opt-in.
- **Question:** Implement RUL-SEC-002's pre-commit scan and deny list, or record the CI scan as its only implementation?
- **Options:**
  - **Hook plus deny list** — - scripts/git-hooks/pre-commit runs `gitleaks protect --staged` in bash, so it works under Git Bash. If gitleaks is missing, it fails with install instructions.
    - .gitleaks.toml gains explicit rules for .env, .env.local, config.yaml and data/auth-token, and for key-name variables, beside tooling-29's regex allowlist.
    - The hook runs once core.hooksPath is set (tooling-30b).
    - `--no-verify` leaves no audit record, so that clause is recorded as a departure.
    R1, about +40 lines.
  - **Deny list only** — Add the deny list, keep the CI scan as the gate, and record the pre-commit half as a departure. R1, about +15 lines.
  - **Leave** — Two of the accepted ruling's three clauses stay unimplemented.
- **Recommended:** Hook plus deny list — Agents commit to a public repo while long-lived keys sit in .env, which is the ruling's own stated reason. The cost is one local binary the operator installs once.
- **Ruling:** Hook plus deny list, as recommended — Daniel Parke (operator), 2026-09-12.

#### org-06 · Move the practised landing procedure into PLAYBOOKS.md before other entries edit it

- **Re-verified:** confirmed · **tier floor:** R0
- **Batch:** org
- **Now:** The finding: org-06 is in the review (evidence :2416-2421) but is not an operator id. There are two landing procedures: PLAYBOOKS.md '## standard' (:30) and HANDOVER.md:69 'How a batch is landed (the discipline, verbatim from practice)'. PLAYBOOKS already has a venture-authored section ('## restore-test', :161).
  
  Entries that depend on it, with no entry of their own:
  - POLICY-renderer: depends_on org-06.
  - org-01b: puts its walk list 'into the batch procedure (org-06)'.
  - org-05: its fold option.
  - POLICY-ci-green: adds a landing step to HANDOVER.md:81-98.
  - tooling-15a: edits HANDOVER.md:84.
  
  The push step is HANDOVER.md:98.
- **Question:** Move the landing procedure into a 'PatterStage batch' section of PLAYBOOKS.md before any ruled step edits it?
- **Options:**
  - **Move first** — A new PLAYBOOKS section after '## standard' carries HANDOVER's steps plus the ruled additions: the CI wait, the walk list, the gate runner and the renderer command. HANDOVER.md:69-110 becomes a pointer. R0, about -4 lines.
  - **Edit HANDOVER in place** — Each ruled step edits a note that org-05 replaces at the next programme's start.
- **Recommended:** Move first — Three entries already depend on it, and editing a note that is due to be replaced wastes the work.
- **Ruling:** Move first, as recommended — Daniel Parke (operator), 2026-09-12.

## Decisions the executor takes, and the reason

These are the free band (`org/policy.json:130`): naming, decomposition, test structure, patterns already in the tree, file placement. They are recorded here so the record is complete, and they follow their parent question's ruling.

- **org-01b** — Walk list in the procedure. The oracle's walk list already excluded org/; only the scratch codemod did not. The cheap control is the codemod's walk list. A guard can follow if the breach recurs. (Executor's free band. The recommended walk list restates rules that already bind, so no ruling is needed. The operator's part is the edit that already landed (org-01a). Option 3 would keep rewriting closed records against ADR-0010 section 3, so it is not a compliant choice.)
- **org-02** — Dated lesson, no sanction. GRAPH_BUILD.md:153-156 and PLAYBOOKS.md:103-105 ask for run evidence, and none was journalled. A lesson is the only account the estate will see, and it needs no protected edit. (A dated lesson is an append-only venture entry and needs no ruling. The only operator path, a retrospective sanction, exists only inside POLICY-lanes' cap-raising ADR, so the ruling belongs there.)
- **org-03a** — Check new records only. It catches the errors the last programme made without touching history, and it reads policy.json, as check-derived-views.mjs:19-21 advises. (Executor's free band. A structural check follows a pattern already in the tree (check-derived-views.mjs and its fixture suite), enforces a documented template, and removes nothing. Only the mode/tier rule needs a ruling, which is org-03b.)
- **org-05** — Transient note. Only one plan line points at the file, and org-06 and org-12c already move its lasting parts. The 550-line budget is for task boots. (The recommended in-file corrections are free. Naming HANDOVER in START.md's boot, or deleting the file, would change documented behaviour and need a ruling, but neither is recommended.)
- **org-12c** — Upkeep pass as specified. Three records wait on the operator while the derived view says none does, and the renderer flags only blocked statuses (COMPILE_REPORT.md:163-164). (Integrator upkeep: the statuses and folds follow facts already on record. T-0004's end follows tooling-30a's ruling, and T-0003's follows org-12a's.)
- **tests-10** — Keep, settle c8 under org-15. Only c8 forces edits to a closed record. The other pins block nothing, and retiring them drops a documented gate for a small saving. (Keeping the pins is the status quo and blocks nothing, and c8's live coupling is ruled under org-15. Only retiring or moving the pins would change a documented gate, and neither is recommended.)
- **tests-02b** — Stay in the batch gate. The census is sensitive to load, needs a production build and a browser, and its baseline has never been read on Linux. The runner removes the session dependence, and CI can be revisited after one measured run. (The recommended option keeps the documented manual ratchet (testing.md:166) and makes it a step of tooling-01's runner, which is ruled there. Only the CI options, which edit a sensitive path and change documented behaviour, would need a ruling.)
- **lib-domains-14b** — Do it inside cross-cutting-03b's env.ts. 03b moves readEnv out of paths.ts, and next.config.ts should not pull in paths.ts's load-time discovery. (Uses a pattern already in the tree, with no documented behaviour change.)
- **cross-cutting-21a** — Guard the four calls. It is the concrete defect, and fixing it changes no stored value. (A defect fix using a pattern already in the tree; no key changes.)
- **tooling-11c** — Delete now. Nothing sources it, invoking it does nothing, and the doc that names it describes behaviour it cannot deliver. (Dead library code. Running it is a no-op, so no user command, npm script or working documented behaviour is removed; data-storage.md:31's claim is already false.)
- **cross-cutting-03b** — Build env.ts, table and parity test, re-export readEnv from paths.ts. Alias retirement and the boolean vocabulary then edit one table, and a re-export avoids test churn. (Module placement and a parity test; no variable or default changes. R2 only because api-auth.ts and auth-token.ts import readEnv.)
- **lib-domains-13c** — Import CHAT_DEFAULT_MODEL only. The field and file renames mostly edit tests for no user-visible gain. (Naming inside the executor's free band.)
- **cross-cutting-23c** — Rule only. The gain is navigational, and the move edits 13 test files. (File placement.)
- **tests-05** — Settle with cross-cutting-06. It is the same set of lines, counted over one narrower directory. (It counts the same directives as cross-cutting-06, so the ruling there settles this finding.)
- **tooling-08** — Settle with cross-cutting-06. It is the same override, undercounted by more than half. (It counts the same directives as cross-cutting-06, so the ruling there settles this finding.)
- **tests-12** — Rule it out entirely. The only positive case is a two-consumer duplicate worth about 15 lines, which the programme's lesson says does not pay. (Ruling merges out keeps plan decision 11 as the operator set it; only the optional u1+c4 merge would reverse it.)
- **tooling-15a** — Follow tests-20. One list of gate steps that matches CI is also what tooling-01's gate runner needs. (Settled by the tests-20 ruling; the HANDOVER gate list follows CI.)
- **tooling-15b** — Tidy, keep Next's includes. Next manages those includes itself, and nothing supports the claim that stale stubs cause trouble. (Removing a dead exclude and correcting two comments changes no behaviour.)
- **tooling-28b** — Ignore both. It is build output nobody edits, and a local lint should not depend on whether docs:build has run. (Ignoring gitignored build output does not change which source is linted.)
- **tooling-20a** — Composite action. Four consumers of an eight-line block pay for a small action, the pattern already exists in .github/actions, and the ruled retry is kept. (Moving the npm-ci retry into a composite action keeps the quarantined retry exactly as ruled and removes nothing. Only the header's pointer moves, so this is executor work at the R2 path floor, not a ruling.)
- **tooling-20b** — Drop the two e2e steps. Those two repeat exactly and back to back. The other two would need a measured run first. (Dropping a step that immediately repeats itself changes nothing a user or the gate sees. The R2 path floor governs the process.)
- **app-01e** — Keep. It has a live caller and is the REST door onto the one cancel handler (route.ts:4-10). (It has a caller in an npm-script smoke, so no removal is proposed; confirming it stays is the executor's call.)
- **app-01f** — Keep, optionally reword the hook comment. It has a live caller in an npm-script smoke and is the documented single-run read. (The runtime smoke polls it, so no removal is proposed; confirming it stays is the executor's call.)
- **app-01g** — Keep. It has live callers, and the reconcile library documents the smokes' dependence on it. (Four smoke callers; nothing to rule.)
- **app-01h** — Add the gate. The consolidation plan assumed the remaining routes had callers (consolidation.md:305-306), yet four documented routes have none, and two review passes each missed a directory of callers. A gate with written reasons turns each keep into a recorded decision. (A test-only gate with a reasoned allowlist follows u15's entry-list pattern, and the allowlist reasons come from the app-01a to app-01d rulings. If the operator reads a new gate as test policy, it moves to them.)
- **app-15b** — Leave two hops. The chain lives for one release and already lands correctly. Collapsing it costs a golden re-bless and an e2e edit to save one round trip. (No URL is removed; only the number of 307s a bookmark receives changes, for the one release the redirects live.)
- **docs-04** — Task record (if app-15a rules removal after v1.0.0). The promise is already in the 1.0.0 upgrade notes, and a task record is the only thing that makes it happen. TASKS.md is derived, so the record goes under org/tasks. (The choice between keeping the promise and rewording it is app-15a's ruling, which now carries all three positions. Once that is ruled, the record or the rewording is mechanical; asking separately invites two answers to one question.)
- **lib-data-09a** — Delete the writers. One source writes and nothing reads; SyncScheduler already holds the status /api/sync reports. (Nothing reads the rows, so no user sees a change; removing two internal writers is dead-code free band.)
- **components-16** — Delete. No production caller passes compact or mode, and the mode prop is already discarded at :76. (Internal component props with no production caller and no docs. The deleted tests cover only deleted code, which does not weaken a check.)
- **docs-12a** — Stop writing it. No page or script reads site/search.json, and origin/main has never carried the Pages workflow, so nothing published is lost. (The file has never been published and is undocumented, so no public URL or documented behaviour is removed; a one-line build tidy is the executor's free band.)
- **docs-12b** — Do both. The function is an identity, and the declared list disagrees with the codes the checker actually emits. (Internal docs tooling. Fragments stay byte-identical because the function returns its input, and the pinned count is corrected, not weakened.)
- **lib-domains-05a** — Delete and add a report-only knip exports run. None has a src or scripts caller, a doc or an API tag. knip cannot see them, because its jest plugin makes tests entries. (Internal helpers with no docs, no @public tag and no user-visible effect; deleting their tests removes coverage of deleted code only. A report-only script adds no gate; wiring it into lint would be a lint-policy change for the operator.)
- **hooks-15a** — Delete. Every map entry is an empty string, so the props and helpers change no output. (No rendered class changes, because every entry is an empty string; internal props and helpers are the executor's free band.)
- **lib-data-20** — Follow tooling-13 and delete the twin. Its only live part from prebuild is guarded DDL the baseline already satisfies, and the TS twin reruns it seconds later through seed-catalog's getDb(). (No separate decision: once tooling-13 rules on what prebuild does, removing the twin is mechanical.)
- **lib-data-01** — Fold 11, fail loudly. It follows the written rule (migration.md:87) and the no-try seeds already in 022/027, and it keeps u15's invariant. It changes behaviour only for a database that is already broken. (The recommended option applies a rule that migration.md:87 and apply-sql.ts:4-8 already state. T-0129 (org/TASKS.md:144, R1) folded 17 stanzas without a ruling. src/lib/db sets the R2 tier floor, which is not an ownership test. Only 'Fold all 13' (it relaxes the pinned u15:41 invariant) or 'Fold, keep swallowing' would need the operator.)
- **lib-data-10a** — Code check. It restores documented behaviour with no schema change and no deletion. (The recommended fix restores documented behaviour (dashboard.md:158) with no schema change, and no screen shows the 24h figure. Only the index variant is a durable decision.)
- **lib-data-11** — One rule. Today a 'changeme' token shows as disabled in the Platforms panel and as connected in the process label beside it. (Unpinned, undocumented label text that becomes consistent with the Platforms panel on the same screen.)
- **lib-data-13** — Input+output everywhere. It matches normaliseUsage's fallback (usage-shape.ts:44-47), so parsing agrees with writing. (No known stored row changes its displayed total, so this is a free-band consolidation onto normaliseUsage's own rule.)
- **hooks-10** — Keep list polls. The polls fire only in a focused tab, no cost has been measured, and gating would make new runs appear late. (No documented cadence changes. Gating on a live run is a pattern already in the tree (sessions page), which policy.json:130 lists as free band, and the recommended option changes nothing visible.)
- **hooks-19** — Keep field and client append. Two to four more lines do not pay for an API body change. (The recommended option keeps the /api/missions body unchanged, and the parser merge is a lib move in the executor's band.)
- **hooks-23** — Keep 500. Saving one request is not worth hiding missions from the schedule form on a large install. (The moves are file placement. The only behaviour change (limit 200) is not recommended and can simply be skipped.)
- **app-18** — Keep sentences, convert the rest. The shared helper cannot carry a custom sentence, the documented body is a public contract, and the other options save few lines. (The recommended option changes no 400 body. Only the options that change the documented body or the shared helper's body are public-contract changes.)
- **cross-cutting-14a** — One helper, not proxy. Output and anchors stay the same, and leaving proxy.ts's four-character copy avoids an R2 lane for four lines. (Rendered output and anchors are identical, and leaving proxy.ts's copy alone keeps the change at R1.)
- **cross-cutting-16** — UUID ids. Nothing reads the old shape, the sanitiser accepts hyphens, and uuid() is the house id helper. (Only new ids change shape, and nothing parses the old format. The rest is a sweep onto helpers already in the tree.)
- **lib-domains-11a** — Days past 24h. Mission runs already read this way, and no test or doc pins the hours form. (Undocumented and unpinned display text, made consistent with mission run durations. The same standard left lib-data-11's label change in the executor's band.)
- **lib-domains-11b** — Escape it. Same visible output with one escape set, as cross-cutting-14a recommends. (Settled by cross-cutting-14a; output is identical.)
- **lib-domains-12** — Fix in place. It delivers what chat.md:64 promises without changing how ordinary chat text renders, and gives the innerHTML sink's pragma the test it claims. (The in-place fix restores documented behaviour; only a renderer swap (cross-cutting-14b) would need the operator.)
- **components-31** — fieldset and legend, keep the radio list. It names the group without changing how the documented control looks, and the button conversions follow the tree's own primitive rule. SegmentedControl adds a visual change for no functional gain. (Both group options keep the documented labels and use patterns already in the tree (policy.json:130 free band). The row buttons growing from about 22px to 26px meets the rule that an icon-only control is never under 24x24 (design-tokens.md primitive table) and needs no ruling. The executor takes the fieldset option.)
- **docs-03a** — Drop the count and the number. No gate covers CHANGELOG.md, both figures are already wrong, and the baseline they count from is ambiguous. migration.md:68 records the same lesson. (It corrects two factual errors in an upgrade instruction. No release content or voice choice is involved.)
- **docs-05b** — Fix count, add three bullets. The bullets carry mechanics a command list cannot. Pointing the count at testing.md:164, which u16 keeps equal to package.json, stops it drifting without waiting for docs-08's ruling. (Correcting stale descriptions of the tree is executor free band. The governance question (ADR-0003) is split out as docs-05a.)
- **docs-06a** — Re-read the setting, then fix CONTRIBUTING.md. The 2026-08-22 reading supports testing.md:180, and a read-only re-check before the edit keeps the doc honest if the setting has changed since. Under-claiming protection is the safer error. (The fact is recorded in the repo (LOCKBOOK.md:275-280) and readable with a read-only `gh api` call, so correcting the doc is executor free band. Making acceptance-gate a required check is the operator's existing WO-0011 half (LOCKBOOK.md:280), not a new decision.)
- **docs-06b** — Point, don't restate. The count is already wrong in two of three places, and only testing.md's is held by a test. (Stale-fact corrections and link relabels are executor free band.)
- **docs-11b** — Shared lazy helper. The duplication is real, and the constraints (sort order, path form, lazy import) are design inputs the helper can meet, not blockers. (Extracting a shared helper and importing a type is decomposition inside tooling, which is executor free band. The user-visible part is split out as docs-11a.)
- **docs-19b** — Match H1 to title only. The mismatch shows only on GitHub, because the site, Help and search already use the title. So the ten edits are worth making, but a new failing gate is not justified by this evidence. (Aligning headings with titles is naming, which is executor free band. Adding a new failing docs:check refusal would be a lint-policy addition, so it is listed as an option that needs a ruling. host-scheduling.md's heading suggests the page is narrower than its title; the executor should note that rather than guess.)

## Verified, no ruling needed

Findings re-verified in passing that need no decision: the fix is the executor's, and none of them removes anything.

- **critic-01** [confirmed, R1, theme B] — - The guard's verdict: `node --input-type=module -e` importing ./src/lib/search/url-guard.ts returns ok true from both checkUrlShape and checkUrlSafe for http://[::ffff:127.0.0.1]:8642/, http://[::ffff:169.254.169.254]/, http://[::127.0.0.1]/ and http://[64:ff9b::a9fe:a9fe]/. It refuses http://127.0.0.1/ and http://[::1]/. The run uses Node 24 type stripping, writes nothing, and prints only a MODU
  - Fix: In isPrivateIpv6, expand the address and decode any embedded IPv4 from ::ffff:0:0/96 (hex or dotted), ::/96 (IPv4-compatible), 64:ff9b::/96 and 2002::/16, then run isPrivateIpv4 on it. Alternatively, build one node:net BlockList holding the private v4 ranges plus those v6 prefixes. Add the four URL-form cases to search-url-guard.test.ts through checkUrlSafe, not isPrivateIpv6, so the test sees what the parser produces. About +20 lines in 2 files, no export change.
- **critic-14** [confirmed, R1, theme B] — - The test: src/lib/fs/path-security.ts:23 returns true only if `rel !== "" && !rel.startsWith("..") && !rel.includes("..")`, inside isPathUnderRoot (:18-24).   - Its only use is resolveAllowedWorkspacePath at :50.   - resolveSkillDirUnderRoot has its own prefix test (:128-131) and is unaffected. - Re-derived with node -e (path.posix):   - /home/d/a..b gives false and /home/d/..foo gives false, bo
  - Fix: Replace the substring test with rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel), using sep and isAbsolute from path. isAbsolute also stops a path on another drive passing on a Windows dev box. Add accept cases for a..b and ..foo, and refuse cases for ../x and another drive (win32 only). About +3 source and +12 test lines, no export change.
- **critic-02s** [confirmed, R2, theme B] — - The map: src/lib/sessions/sessions-api-guard.ts:14 is `const windowHits = new Map<string, number[]>()`. - Duplicate key logic: the private getSessionsApiClientKey (:43-52) repeats authClientKey (auth-throttle.ts:37-46), whose comment at :33-35 calls it 'The same derivation the sessions limiter uses'. - No prune: :61-67 delete a key only when that same key comes back with no hits in the window. N
  - Fix: Replace the private getSessionsApiClientKey with authClientKey from @/lib/api/auth-throttle (-9 lines, no export change). On each call, drop entries whose newest hit is older than RATE_WINDOW_MS, as auth-throttle's prune does (+6). To test that the map shrinks after a window, export a count as auth-throttle does (+15 with the test). That new export is an exported-interface delta, which org/tasks/T-0007.json:3 classed as public-contract, so the floor is R2 unless the count stays unexported. Which header the key uses follows the critic-02 ruling; land it in the same batch.
- **critic-03b** [confirmed, R2, theme B] — - Log files opened without a mode: scripts/tooling/ps-deploy.mjs:124 and :186 (`openSync(logFile(base), 'a')`), :315 (`writeFileSync(RUNTIME_LOG(), '')`), and scripts/tooling/_platform.mjs:19 (`openSync(logFile, 'a')`). - Database opened without a mode: src/lib/db/index.ts:94 (`new Database(DB_PATH)`), plus a second open after a baseline rebuild at :198. - Database backups: copied beside the datab
  - Fix: - Logs: pass mode 0o600 at ps-deploy.mjs:124, :186 and :315 and _platform.mjs:19, and chmodSync files that already exist, since a mode applies only when a file is created. - Data directory: at boot, chmodSync PS_DATA_DIR to 0o700. That covers a directory made by setup.sh:149-157 or auth-token.ts:95-97 without editing setup.sh. - Database: chmodSync it to 0o600 after the opens at index.ts:94 and :198, and chmod existing .pre-baseline-* copies once. copyFileSync copies the source file's mode for new copies; that is libuv behaviour, not visible in the repo. SQLite creates the -wal and -shm files with the database's mode. - Test: add a unit test that checks the modes, skipped on win32. chmod does nothing on Windows, so Windows development keeps working. - Redacting ps_token= in the logs route stays optional.  About +20 lines.
- **critic-05c** [confirmed, R0, theme B] — - `git grep -nE "CH_REQUEST_SIGNING|x-ch-"` shows tests/unit/api-auth.test.ts uses only CH_REQUEST_SIGNING_SECRET and x-ch-* (:13, :24, :30, :36, :40). - `git grep -nE 'x-ps-ts|x-ps-signature|PS_REQUEST_SIGNING_SECRET' -- tests` returns nothing (exit 1). - requireSignedRequest is stubbed in tests/helpers/api-test-helpers.ts:115-120, tests/unit/b1-deploy-api-flag.test.ts:47, b1-host-writes-need-a-t
  - Fix: In tests/unit/api-auth.test.ts, add cases that use PS_REQUEST_SIGNING_SECRET with x-ps-ts and x-ps-signature, mirroring :24-43: a valid signature is accepted, and a tampered one or an expired timestamp is refused. Tests only, 1 file, about +30 lines. It must land before critic-05b, and before critic-05a if the operator picks a format change.
- **tooling-05** [moved, R1, theme B] — - Missing excludes: .dockerignore:1-19 has no entry for data, tmp, site, public/help, org, .claude or .swc. test-results and playwright-report are already excluded (:13-14). - What gets copied: Dockerfile:16 runs `COPY . .` in the builder stage; :54 copies only data/seed into the final image. - `ls data` shows:   - auth-token   - control-hub.db with its -shm and -wal files   - 8 control-hub.db.pre
  - Fix: Add /data/* followed by !/data/seed/, then /tmp, /site, /public/help, /org, .claude and .swc to .dockerignore. Keep docs/ in the build context: prebuild's build-site --help-only reads it, and the root-anchored `*.md` rule leaves nested docs in. build-site.mjs:50-52 says org/ is not published, and prebuild-db.mjs:26-28 recreates data/. The docker-image CI job (docker build plus tests/scripts/docker-deploy-api-smoke.sh) confirms the result, but it builds from a fresh checkout, so check a local `docker build` context too. Neither can be run read-only. About +8 lines.
- **tooling-29** [confirmed, R1, theme B] — - Config: .gitleaks.toml:3-7 is `[allowlist]` with `paths = ['''tests/''']`, and has no other rules, regexes or stopwords. - Workflow: .github/workflows/gitleaks.yml:3-7 runs on push and pull_request to main and dev only, with fetch-depth 0 (:15) and gitleaks/gitleaks-action@v3 (:16). - Scope: `git ls-files tests | wc -l` gives 740 files skipped. - Suppressed count: unverifiable read-only. `comman
  - Fix: First run gitleaks locally over the full history with the paths allowlist removed, and list what it finds. Replace the paths allowlist with regexes or stopwords matching the fake key shapes the tests use, so tests/ is scanned like the rest of the tree. Any historical fixture finding that cannot be matched narrowly goes into a gitleaks baseline file with a written reason, never a wider allowlist. About +10 lines in .gitleaks.toml; the workflow is unchanged.
  - Surfaces: Unmeasured: gitleaks is not installed and the run needs a scratch config. - Upper-bound proxy at HEAD: key-shaped fake strings on 70 lines in 25 tests/unit files (command in now). gitleaks' rules also weigh entropy and keywords, so fewer may flag. - Older commits may hold more. - Whether the CI action scans the full history or only the pushed or PR range on push and pull_request events is the action's own behaviour and is not in the repo. Measure with a local full-history run before changing the allowlist.
- **test:x-ps-signature-coverage** [confirmed, R0, theme C] — `git grep -n -E 'x-ps-(ts|signature)' -- tests` and `git grep -l PS_REQUEST_SIGNING_SECRET -- tests` both exit 1. api-auth.test.ts:23-42 tests only CH_REQUEST_SIGNING_SECRET with x-ch-* headers, while api-auth.ts:44-47 prefers PS_ and x-ps-*.
  - Fix: Add two cases to tests/unit/api-auth.test.ts that set PS_REQUEST_SIGNING_SECRET and send x-ps-ts/x-ps-signature over METHOD:path:ts: a valid signature returns null, a bad one returns 401. Keep the x-ch cases while the aliases are supported.
- **test:ps-read-only-cases** [confirmed, R0, theme C] — `git grep -n -E 'CH_READ_ONLY *= *"' -- tests` gives api-auth.test.ts:77,86,96, boot-says-how-it-is-configured.test.ts:51 and record-event.test.ts:47. boot-says:49-53 is the named alias test ('honours the legacy CH_ alias'). missions-read-only-reads.test.ts:60-67 sets both keys.
  - Fix: Switch api-auth.test.ts:77,86,96 and record-event.test.ts:47 to PS_READ_ONLY. Leave boot-says:49-53 and the paths-resolver alias cases, which are the alias coverage, until the POLICY retirement, when they are deleted under that ruling.
- **docs:data-storage-browser-keys** [confirmed, R0, theme C] — data-storage.md:58-59 cite src/app/(main)/sessions/page.tsx, which no longer exists (`git ls-files | grep sessions/page.tsx` gives src/app/results/sessions/page.tsx). data-storage.md:117-119 says only the two ps.sessions.* toggles had a ch.* predecessor, but origin/main:src/hooks/useMissionsPage.ts:26 used 'ch-last-mission-category', renamed without migration in 01227cbe.
  - Fix: Point :58-59 at src/app/results/sessions/page.tsx. Reword :117-119 to say ps-last-mission-category replaced main's ch-last-mission-category on 2026-06-21 without migration, so that preference reset once. docs/manifest.json is derived: regenerate it, never hand-edit.
- **hooks-04** [confirmed, R1, theme D] — no-raw-write-outside-the-helper (design-lint.mjs:500-530) matches only apiFetch, safeApiCall and safeApiCallData calls that carry a method. It covers src/components, src/app (not api), src/modules and src/hooks, and its fileTest returns one line per file. `line-census.mjs --report` gives writes.count 0. A span probe finds bare fetch POSTs at story-weaver/[id]/page.tsx:98, 115, 133, 162, 269, 301, 
  - Fix: Match fetch( with a method in the rule. Add an explicit client-module list under src/lib (chat-utils.ts; not the server importers or api-write.ts). Move the two story reads onto useApiResource's body option, then convert the 16 writes to runWrite.
  - Surfaces: 4 files, since the rule reports once per file, covering 18 sites: story-weaver/[id]/page.tsx 9, story-weaver/create/page.tsx 1, hooks/useVersionFooter.ts 1, lib/chat/chat-utils.ts 7. c6-the-page-layer.test.ts:57 requires this rule to read zero, and the C6 pragma ceiling (c6:39) is used 12 of 12. So the fix lands with the conversions, or with a baseline and a c6 amendment (the same ruling as components-01).
- **hooks-05** [confirmed, R1, theme D] — The census (line-census.mjs:107-146) follows an effect only through same-file functions to safeApiCall, safeApiCallData or apiFetch. `line-census.mjs --report` gives handRolledReadHooks 0 and reads.files []. Missed reads: useMissionsData.ts:243-252, effect -> fetchData (:154) -> fetchMissions and fetchTemplates (destructured, :59-60) and loadCategories (:110). useChatSend.ts:109-117, effect -> fet
  - Fix: In the census, follow callees bound by destructuring or imported from src/hooks and src/lib, one level deep, and count platform fetch. Add src/hooks/*.ts to the lint rule's and u15's file filters (u15-reads-go-through-the-hook.test.tsx:164-165 keeps .tsx only). Hold the hits by name until hooks-01, hooks-09 and the chat read move land.
  - Surfaces: 4 files at one level across files (useMissionsData.ts, useChatSend.ts, useHindsightCrudTab.ts, useHindsightMemories.ts), or 5 with platform fetch counted (adding story-weaver/[id]/page.tsx). handRolledReadHooks would rise from 0 to 4 or 5. c6-the-page-layer.test.ts:104-105 require reads.files to be empty and the count to be 0, so the closed C6 oracle goes red unless the reads convert first or a ruled amendment holds them.
- **critic-06** [confirmed, R1, theme D] — check-form-control-names.mjs:48 sets CONTROL_TAGS to input, textarea and select, matched by exact tag text at :178. check-icon-button-names.mjs:110-112 accepts 'button' and 'Button'. ui/Input.tsx:196 renders a <label> without htmlFor, and :200-210 an unnamed FieldInput. ui/field/Select.tsx:34 makes ariaLabel optional. ui/AutoTextarea.tsx:64 falls back to the placeholder as aria-label, which the ga
  - Fix: Either teach the gate the house primitives that render a control (Select, InlineSelect, NativeSelect, Input/FieldInput, NumberInput, Textarea, AutoTextarea, SearchInput, Picker), counting ariaLabel and a wired label as names and Field as a labelling wrapper, or make label-or-ariaLabel a required union so tsc refuses an unnamed use. Land it with components-03.
  - Surfaces: A TypeScript AST probe over tracked src .tsx finds 136 house-primitive uses; 22 have no name prop, no id, no spread and no <label> or <Field> ancestor. MissionCreateForm.tsx: 5 AutoTextarea (:517, :528, :700, :711, :722). TemplateEditorModal.tsx: 3 (:241, :253, :265). ModelEditor.tsx: 6 Input (:292, :314, :332, :347, :376, :388), inside FieldRow, whose labelling was not resolved, so these may be false positives. One each at results/artifacts/page.tsx:120, work/composer/page.tsx:371, work/research/page.tsx:265, ChatModelSelector.tsx:51, HindsightBrowser.tsx:86, SessionFilterBar.tsx:50. ui/Input.tsx:105 and :200. That is 16 to 22, consistent with components-03's 18 to 19.
- **docs-01** [confirmed, R1, theme D] — An exact-case scan (node over git ls-files, all 75 tracked docs/*.md files) finds 6 case-only mismatches: docs/reference/api.md:60 -> SPEND.md (tracked spend.md); cross-platform.md:94 -> DEPLOY.md; env-reference.md:15 -> MIGRATION.md#..., :113 -> DEPLOY.md and :114 -> MIGRATION.md; migration.md:213 -> DEPLOY.md. check-doc-links.mjs:54 uses existsSync, which ignores case on NTFS and default APFS. c
  - Fix: Point the six links at the lowercase files, and make check-doc-links require an exact-case name by reading the parent directory, so Windows and macOS fail the way Linux does. Combine with the tooling-19 walk.
  - Surfaces: 6, all in docs/: api.md 1, cross-platform.md 1, env-reference.md 3, migration.md 1. None in the 16 root and branding files.
- **tooling-19** [confirmed, R1, theme D] — check-doc-links.mjs:21 sets `const DOCS = join(ROOT, "docs")`, and :39 loops over walk(DOCS) only. 16 tracked .md files sit outside docs/, org/ and data/seed/: .github x3, AGENTS.md, CHANGELOG.md, CLAUDE.md, README.md, REBRANDING.md, TRADEMARK.md, branding x4, ops/runbooks/deploy.md, src/kit/PROVENANCE.md and tests/scripts/README.md. docs-pages.yml:15-17 runs npm ci, docs:check and docs:build, nev
  - Fix: Walk `git ls-files '*.md'` minus org/ and data/seed/, and fix the three links (docs-02 rules on the legal files). Adding check-doc-links to docs-pages.yml is a separate R2 workflow change, only if the operator wants the publish path gated.
  - Surfaces: 3 broken links: TRADEMARK.md:27 -> src/lib/theme.ts, and branding/guidelines/COLORS.md:16 -> ../../docs/design-tokens.md and ../../src/lib/theme.ts.
- **tooling-22** [confirmed, R1, theme D] — line-census.mjs:50-51 walks only src and tests. `git ls-files scripts mock-hermes mock-hindsight mock-llm test-harness docker ops .github | xargs cat | wc -l` = 15,498. The 44 scripts files ending .js, .ts, .mjs, .cjs or .mts (excluding .d.mts) hold 8,743 lines, 1,988 of them comment-start lines (22.7%). Excluding .mts gives 43 files, 8,543 and 1,932. c8-the-programme-is-closed.test.ts:81 requires
  - Fix: Add a scriptsLines measure (optionally scriptsRepeatedWindowLines), either as a separate tooling census or as census keys, with c0's MEASURES (:27-40) and c8:81 updated in the same commit. Then run a C5-style comment pass over scripts/tooling that keeps comments naming a defect.
  - Surfaces: No existing violation: a new measure starts at its own baseline, about 8,743 scripts lines today. A key in line-census turns c8:81 red, so either the closed C8 oracle is amended or the measure lives in its own census.
- **tests-13** [confirmed, R1, theme D] — tests/helpers/api-test-helpers.ts exports mockRequest (:8, 9 user files), expectJsonResponse (:27, 0), setupFsMocks (:36, 0) and setupRouteMocks (:53, 0), counted by `git grep -lw` over tests and docs. knip.json:11-17 has no tests glob. read-only-is-testable.test.ts:37 points HELPERS at the file, and :99-102 require it to contain requireActual('@/lib/api/api-auth'), which only setupRouteMocks does
  - Fix: Delete the three dead exports, and in the same commit repoint read-only-is-testable.test.ts:99-102 at the tests-01 factory. Keep mockRequest, or move it to mocks.tsx. Point the sidebar test at allModuleRoutes(). Add tests/helpers/** and tests/e2e/lib/** to knip with jest entry detection (tooling-16), and update testing.md:214.
  - Surfaces: A grep probe (an export imported by no other tracked file) over tests/helpers and tests/e2e/lib gives 16 unused exports: census-analysis.ts 8 (Rgba, Rgb, round2, BorderRecord, TextRecord, BoxRecord, GeometryRecord, LOWER_IS_BETTER), api-test-helpers.ts 3, baseline-db.ts 1, fetch-map.ts 1, mocks.tsx 2, story.tsx 1. The exact knip count needs a widened knip.json and `npm run lint:knip`, which cannot run read-only.
- **cross-cutting-01** [confirmed, R0, theme F1] — boot-diagnostics.ts:46-47 treats only '0' and 'false' as off. feature-flags.ts:15 FALSY is 0/false/no/off, and env-reference.md:86 documents all four. git grep PS_COMPOSER on boot-says-how-it-is-configured.test.ts exits 1. So with PS_COMPOSER=off or no, the routes answer 503 and the page 404s while the [config] line prints composer=on.
  - Fix: Replace boot-diagnostics.ts:46-47 with const composer = onOff(isFeatureEnabled('composer')), imported from @/lib/feature-flags. That file has no imports (feature-flags.ts:1-40), so it is safe on the boot path. Add PS_COMPOSER=off and PS_COMPOSER=no cases to the boot test. Land it in the same commit as cross-cutting-02, which edits the next line (:48). If cross-cutting-07 option B is ever chosen, this line goes with the flag.
- **cross-cutting-02** [confirmed, R1, theme F1] — runtime-status.ts:33 (DEFAULT_GATEWAY_URL) and :77, and boot-diagnostics.ts:48, read only HERMES_GATEWAY_URL. getAgentLlmEndpoints (agent-runtime.ts:28-44) also derives the base from PS_LLM_API or CONTROL_HUB_LLM_API when it contains /v1/chat/completions; HERMES_GATEWAY_URL still wins. The wrong value shows as the Gateway row at settings/system/page.tsx:138 and as gateway= on the boot line. b3-run
  - Fix: Have both reporters call getAgentGateway().baseUrl from @/lib/runtime/gateway. src/lib/runtime/ is exempt from core-imports-no-module (design-lint.mjs:311), core already imports it (gateway-client.ts:5, llm.ts:6), and it reads only env through agent-runtime.ts (imports: os, home, paths), so no route plumbing or instrumentation.ts edit is needed. The boot line keeps 'default' when the base equals http://127.0.0.1:8642. Delete DEFAULT_GATEWAY_URL. Add unit cases with only PS_LLM_API=http://host:port/v1/chat/completions set. Make the ':62' default case also delete PS_LLM_API and CONTROL_HUB_LLM_API, so a developer shell that sets them cannot turn it red. Land it with cross-cutting-01.
- **app-03** [confirmed, R1, theme F1] — grep -n 'fetch(' on story-weaver/[id]/page.tsx hits lines 98, 115, 133, 162, 269, 301, 333, 374 and 408; create/page.tsx has one at :469. Every one carries method: 'POST'. loadStory returns on !d.data (:104) and swallows errors at :126, so a 500 or network failure renders ReaderNotFound (:434). no-raw-fetch-in-component (design-lint.mjs:468) matches only apiFetch/safeApiCall/safeApiCallData with n
  - Fix: Load the story through useApiResource({ body: { action: 'load', storyId } }) with LoadErrorBanner on failure, and do the same for the 'spend' POST read at :133. Keep the write calls' inline setError UX: runWrite toasts and has no signal option, and Stop needs the AbortController. Add bare fetch( to both rules' call patterns. Fix or baseline, with a written reason, what the write rule then surfaces: the 8 Story Weaver writes that keep inline errors and the footer POST, which hooks-04/hooks-09 own.
  - Surfaces: Derived from the rule predicates, not from a run. The widened write rule would flag 11: the 10 Story Weaver POSTs ([id]/page.tsx 9, create/page.tsx:469; load :98 and spend :133 are reads sent as POST, and sync-titles :115 runs inside the load) plus src/hooks/useVersionFooter.ts:224. The widened read rule would flag 0: every Story Weaver call has a method, and load and spend run through callbacks rather than inline in an effect. script-templates.ts:59 (a .ts file with no method) and useVersionFooter.ts:342 (in src/hooks, no method) fall outside both. The earlier '11 including a script-templates false positive' was a bare grep count. The exact figure needs node scripts/tooling/design-lint.mjs run on a branch with the widened pattern.
- **components-03** [confirmed, R1, theme F2] — A read-only node scan over `git ls-files src/components` .tsx files (regex /<label\b([^>]*)>([\s\S]*?)<\/label>/, no htmlFor and no control tag in the body) gives 45 labels, 27 orphans. The orphans are at ConfigField:68,86; LogFilePicker:46; CategoryCombobox:103; CategoryManagerModal:103; MissionComposerLayout:8; TemplateEditorModal:213,225,238,250,262,289,324,371,388; BulkAuxiliaryUpdater:89; Fal
  - Fix: Name-only fixes need no ruling. AutoTextarea forwards id and aria-describedby. The 8 AutoTextarea sites and the 6 ModelEditor Inputs get an id linked by htmlFor, or an ariaLabel. SchedulePicker:308 gets htmlFor, and ConfigField:68 and :86, which have no control, become <p>. ui/Input.tsx:101, :196 and :365 disappear if components-11's 'Adopt Field' lands, so fix them there rather than twice. Replacing FieldRow and ComposerFieldLabel with Field restyles labels, so that part follows the components-11 ruling. critic-06 should land alongside so the lint chain holds the fix.
- **components-note-bot-icon** [confirmed, R0, theme F2] — TemplateEditorModal.tsx:30-49 TEMPLATE_ICONS offers "Bot" (:47), and the modal's own ICON_MAP includes Bot (:70). TemplateCard.tsx imports and maps its lucide icons at :3-21 with no Bot (grep for Bot in the file finds nothing), and :45 is `iconMap[icon] || Zap`. TemplatePill.tsx:25-34 passes `t.icon ?? "Zap"` to <TemplateCard compact>, rendered by DispatchStrip.tsx:98 and :125 (imported :20) and M
  - Fix: Immediate: add Bot to TemplateCard's import and iconMap (2 lines, R0). Durable: land with components-15, one template-icons module that exports the full map and the editor's pick list, so the editor and the pill cannot disagree again.
- **critic-note-aria-live** [confirmed, R0, theme F2] — src/modules/rec-room/components/GenerateOverlay.tsx:53-67 runs setInterval every 300 ms (:65), with Math.random noise (:63) feeding setProgress (:64). :84 is the wrapper `role="status" aria-live="polite" aria-busy={phase === "generating"}`, and :107 renders `{Math.round(progress)}%` inside it. The :80-82 comment still says 'the Stop control that B14 adds will make it one'. Stop landed in the reade
  - Fix: Take the number out of the live region: mark the % text and bar aria-hidden, use an indeterminate indicator with no invented value, or label the figure as an estimate. Announce only phase changes (generating, then ready). Reword the :80-82 comment to say Stop lives in ReaderHeader and the overlay has no control. Two to six lines. R0.

## Coverage

1. Coverage. All 110 ids have entries once suffixes are mapped. A mechanical exact-id check must map:
- critic-03 to critic-03a plus the critic-03b row;
- critic-05 to critic-05a and 05b plus the 05c row;
- tests-02, tooling-30, org-01, org-03, org-12, tests-09, tests-18, app-04, tooling-15, tooling-20, tooling-28, app-15, tooling-12, lib-data-09, docs-12, lib-domains-05, hooks-15, lib-data-10, cross-cutting-04, tooling-11, lib-domains-14, cross-cutting-21, tooling-24, tooling-10, cross-cutting-03, lib-domains-13, cross-cutting-23, cross-cutting-14, lib-domains-01, lib-domains-11, docs-03, docs-05, docs-06, docs-11 and docs-19 to their a/b/c/d entries.

Free-band entries not named in the question batches follow their parent's ruling: tests-02b, org-01b, org-02, org-03a, lib-domains-14b, cross-cutting-21a, tooling-11c, cross-cutting-03b, lib-domains-13c, tooling-15b, tooling-28b, tooling-20a, app-01e/f/g, app-15b, lib-data-09a, components-16, docs-12a/b, lib-domains-05a, hooks-15a, lib-data-10a, lib-data-11, lib-data-13, hooks-10, hooks-19, app-18, cross-cutting-14a, cross-cutting-16, lib-domains-11a/b, components-31, docs-03a, docs-05b, docs-06b, docs-11b and docs-19b.

2. Evidence that changes existing entries:
- **Real-hermes smoke:** the first red run is explained by 91134b70 (T-0095), which changed the cancel envelope, and the later dispatch failure by 0d7ae16a (T-0129), which deleted the documented POST /api/missions/[id]/dispatch that full-stack-smoke.mjs:96 and :148 still call. POLICY-ci-green's real-hermes fix is probably R1 (tests/integration), not R2.
- **UI overhaul plan:** ui-overhaul.md:229-232 supersedes the final-release plan's post-1.0 deferral of Field-Kit/Button adoption, but binds Select and Picker as separate primitives at 38px.
- **Router:** router.py:174 detects public-api-delta by path substring only.
- **Next.js:** start-server.js:428 exits on a register() throw, which answers cross-cutting-04a's open question.
- **React:** react-dom 19.2.7 blocks javascript: URLs, which lowers components-30's condition.
- **knip:** knip.json lists scripts/** as entries, so an orphaned script is never reported.
- **Dependabot:** 12 PRs are open (10 npm, 2 github-actions), and the npm heads have moved past the local refs.
- **Branch protection:** dev requires 1 review with no checks and enforce_admins false. CODEOWNERS names only @Daniel-Parke, and #157 is REVIEW_REQUIRED and BLOCKED.

3. Read-only commands used:
- git: grep, log (including -S and --diff-filter), show, ls-files, branch -r, tag, rev-parse.
- node -e over task records, RULINGS.json and package.json, plus a scan of the require directives.
- sed, grep and cat over files, including the sibling EOS router.py.
- gh read-only calls: pr view 157 and 234, pr list, api branches/main/protection and dev/protection, run list.
Nothing was written.

4. Unverifiable read-only, with the command that would settle each:
- Whether fixing the two smoke contracts clears all 9 real-hermes assertions: `npm run test:e2e-hermes` with Docker.
- Whether GitHub's self-approval ban applies to #157: documented GitHub behaviour, not exercised.
- Whether actions v5 (upload-pages-artifact, deploy-pages) is compatible: a Pages run from main.
- Whether a pre-commit gitleaks run works on Windows: `gitleaks protect --staged` locally.
- Whether next build needs no database (tooling-13): `PS_DATA_DIR=$(mktemp -d) npx next build` on a tree without data/patterstage.db.
- The current contents of PR #234 and the Dependabot PRs beyond their file lists: `gh pr diff <n>`.

5. ADR load. Recommended rulings still need about five R3 ADR cycles: ADR-0011 for org-01a, the ASVS exclusions, POLICY-aliases, docs-05a and lib-domains-03. Under POLICY-lanes and CONSTITUTION.md:40-41, each needs an ORACLE session separate from the implementer. Rule POLICY-public-contract-scope and POLICY-closed-oracles before sizing any batch.

