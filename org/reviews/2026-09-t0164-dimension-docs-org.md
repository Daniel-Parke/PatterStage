---
summary: T-0164 documentation and organisation current-tree source review
type: review
tags: [review, phase-1, docs, org]
status: reviewed
---

# T-0164 docs and org dimension: current-tree check

Scope: the 22 `docs-*` and 19 `org-*` preliminary IDs in
`org/reviews/2026-09-codebase-review.md`. This is an independent, read-only
classification of repository evidence, not an edit to the central findings
ledger or an implementation approval. Inspected product and documentation
revision: `dev@65670c61a2bfcbece80b456c86b19d967d322f47`.
The checkout was at `292e3467b10dc12a070f027846f0ad98c2ca5fbc` during
inspection. `git diff --name-only 65670c61 HEAD` showed only T-0164 task,
review and test material and `org/claims.json`; no inspected product, docs,
scripts, plan, decision or handover file differed. The additional T-0164 task
record is excluded from task-corpus counts below. Current uncommitted claims
were not used to infer historical lane state.

Method: file and line references below are relative to repository root and
are rerunnable with `rg -n '<quoted term>' <file>` or direct file reads.
`node scripts/tooling/check-doc-links.mjs` exited 0 and reported 91 tracked
documents. No build, Jest suite, EOS renderer, hosted CI, external service,
paid provider or operator data was used. The historical evidence and decision
register were read as provenance; current source and tests govern the verdict.
`live` means at least the qualified current concern remains, `fixed` means the
original defect has a current repair, and `refuted` preserves a rejected
preliminary claim. No assigned security or data-loss defect was established.
Counts: docs 19 live, 2 fixed and 1 refuted; org 12 live, 5 fixed and 2 refuted; 41 IDs.
All proposed net line savings are **unknown** unless separately measured with
new interface, compatibility and test costs. No row authorises deletion.

## Docs

| ID | Status | Current evidence | Qualification | Ruling / owner |
| --- | --- | --- | --- | --- |
| docs-01 | fixed | `docs/reference/api.md:66`, `docs/running/cross-platform.md:94`, `docs/running/env-reference.md:15,116-117`, `docs/running/migration.md:213` now point to lowercase targets; the 91-document link check exits 0. | Six broken targets are repaired. `scripts/tooling/check-doc-links.mjs:93` still uses case-insensitive-on-NTFS `existsSync`, so exact-case detection remains a separate gate gap. | Link repair landed; exact-case gate is executor work under the recorded docs-01 ruling. |
| docs-02 | fixed | `scripts/tooling/check-doc-links.mjs:53-67` now gets tracked Markdown outside `docs/`; repaired links are at `TRADEMARK.md:27` and `branding/guidelines/COLORS.md:16`. Link check exits 0. | Untracked new Markdown is outside the git-based walk. This does not reclassify legal or brand content as freely editable. | Earlier operator ruling covered brand/legal path edits; repair present. |
| docs-03 | live | `CHANGELOG.md:22` says schema 41; `src/lib/db-schema.ts:35` declares migration head 43. `CHANGELOG.md:166` says three pills after earlier six-pill prose. | The wrong schema claim has grown. Editorial deletion estimate is not verified. | Operator controls release narrative; executor can correct ruled factual errors. |
| docs-04 | live | `CHANGELOG.md:20` says redirects are for this release only; `rg -n 'temporary\(' next.config.ts` finds 26 literal call sites, not the total redirect entries, and `next.config.ts:136` generates Settings redirects. | `org/QUESTIONS.md:129` settles the date: all 52 redirects stay through v1.0.0 and retire with the legacy aliases in the first release after it. Current code still carries them; no retirement has occurred. | Operator's release timing is ruled; docs-04 is the follow-through task record under app-15a, not a fresh timing question (`org/reviews/2026-09-decision-register.md:1972,3088`). |
| docs-05 | live | `docs/contributing/repo-guide.md:25,33` says nine lint steps against twelve at `package.json:18`; `repo-guide.md:108` lists a retired route layout; `:211-215` paraphrases the design-kit rule. | Correct the factual count and tree description in the executor's free band, preserving the mechanics in the gate bullets (`org/reviews/2026-09-decision-register.md:3111`). Separately, the accepted ADR-0003 token rule conflicts with tokens minted in `src/app/globals.css` under the approved overhaul; a factual interim box does not itself supersede an ADR. | docs-05b factual repair is executor work. docs-05a is ruled to a superseding ADR before changing the governing token rule (`org/reviews/2026-09-decision-register.md:2671-2684`). |
| docs-06 | live | `docs/CONTRIBUTING.md:31,62,67` says nine gates and names a removed `(main)` route group; `docs/contributing/testing.md:166,182` says twelve and discusses zero required checks. | Repository text does not verify live GitHub branch-protection settings. | Executor for code/tree facts; operator for protection settings. |
| docs-07 | live | `docs/guides/missions.md:74` says Schedules moved to Automation; `:127-135` still describes the list on this page. `docs/reference/runtime-architecture.md:72` repeats the old location. | These are current prose contradictions, not evidence that schedules themselves are missing. | Executor. |
| docs-08 | live | `rg -n '<!-- generated:' docs` finds only two fences; `scripts/docs/lib.mjs:55-65` declares nine IDs. | Seven extractors have no fence. The settled scope adopts `lint-steps` and adds `env-table` beside, not in place of, curated environment tables; the other five go. `schema-head` cannot repair `CHANGELOG.md:22` because that file is outside the docs walk. Net saving remains unmeasured. | Operator ruled adopt lint-steps and env-table, delete achievements, config-sections, seed-manifests, api-routes and schema-head (`org/reviews/2026-09-decision-register.md:2686-2701`); implementation pending. |
| docs-09 | live | `docs/running/data-storage.md:58-59` names a removed page path; `docs/reference/catalog-and-profiles.md:83` names an absent endpoint. `docs/README.md:93-94` omits refusal types emitted by `scripts/docs/lib.mjs:714-777`. | A broad prose gate needs tombstone, glob and example exclusions; its cost and false-positive rate are unverified. | Executor for factual fixes; new gate needs a bounded design. |
| docs-10 | live | `docs/reference/runtime-architecture.md:72,130-132,178` retains old navigation and a second merged-page opening. | Consolidation is editorial. Claimed line saving is unknown. | Executor. |
| docs-11 | live | Separate walks remain at `scripts/docs/check.mts:41`, `scripts/docs/extract.ts:379`, `scripts/docs/build-site.mjs:83` and `scripts/tooling/check-derived-views.mjs:147`. | Historical “five docs walks” is no longer exact: the link checker now lists tracked Markdown through git. A shared reader must preserve each consumer's scope. | Executor subject to the recorded link-gate ruling. |
| docs-12 | live | `scripts/docs/build-site.mjs:282,317` writes separate site and app search JSON; `scripts/docs/lib.mjs:45-52` lists six refusal codes although the checker emits eight at `:681-777`. | `public/help/search.json` serves the app and must stay. The separate `site/search.json` was never published; `renderFragment` is still called as an identity and its fragment contract tests must be re-pointed, not simply deleted. Net saving is unmeasured. | docs-12a stop writing site output and docs-12b remove the identity/update refusal list are executor free-band decisions (`org/reviews/2026-09-decision-register.md:3091-3092`); implementation pending. |
| docs-13 | live | `docs/start-here/tour.md:3` promises a picture of every screen; the page embeds six images, beginning at `:30`. | `rg --files docs/images -g '*.png'` finds 21 PNGs, but PNG count does not establish the number of screens the tour must cover. | Executor editorial scope. |
| docs-14 | live | Regex `\[[A-Z][A-Z0-9_]+\.md\]\([^)]+\)` over `docs/**/*.md` and `README.md` gives 61 occurrences; example `docs/reference/api.md:66`. | Uppercase link text may be a legacy label while its lowercase target works. This is naming consistency, not link failure. | Executor. |
| docs-15 | live | `docs/running/data-storage.md:80` says “Seed page”; `docs/reference/spend.md:32` says “Laboratory”. | Some terms can be historical data or module names. Classify each use before changing it. | Executor. |
| docs-16 | live | `README.md:55-86` repeats WSL2 install steps and links `docs/start-here/install.md:28-38`; `README.md:126-131` repeats a sentence at `docs/README.md:83-84`. | The approved release plan fixes README's four-command/front-page shape (`org/plans/2026-09-final-release.md:784-786`). Keep the token warning and commands; reduce the inline WSL2 steps to one link and remove only the duplicate docs/README sentence. Net saving unknown. | Operator ruled commands, token warning and one-line WSL link (`org/reviews/2026-09-decision-register.md:2718-2731`); implementation pending. |
| docs-17 | live | `docs/SUPPORT.md:26` is a short support-policy page; `docs/start-here/getting-help.md:67` explicitly calls it the short version. `.github/ISSUE_TEMPLATE/config.yml:7-9` links the SUPPORT filename. | The overlap is real, but the filename and URL serve GitHub and a pinned docs list. Cut SUPPORT to a pointer, keep its filename and slug, and move it out of Start Here; the derived manifest must be regenerated, not hand-edited. | Operator ruled pointer plus filename retention and Start Here removal (`org/reviews/2026-09-decision-register.md:2733-2746`); implementation pending. |
| docs-18 | live | `rg --files docs/images -g '*.png'` finds 21 PNGs totalling 2,947,070 bytes; `tests/e2e/screenshots.spec.ts:128` is opt-in; `scripts/docs/check.mts:179` checks existence, not visual freshness. | Last image commit is `8c61d674` on 2026-09-10. Age alone does not prove staleness. The check has no warning tier and shallow CI checkouts cannot support a history-based warning. | Operator ruled release-point recapture, lossless compression and a content-hash staleness warning (`org/reviews/2026-09-decision-register.md:2748-2760`); implementation and current visual freshness remain unverified. |
| docs-19 | live | A read-only front-matter/H1 scan finds 47 of 75 docs pages with EOS keys and 10 title/H1 text differences; example `docs/contributing/design-tokens.md:11`. `scripts/docs/lib.mjs:43` ignores EOS keys. | ADR-0010 and `org/COMPILE_REPORT.md` indicate EOS use of metadata (`org/reviews/2026-09-decision-register.md:2762-2774`). The title/H1 mismatch is a separate executor naming issue, not proof that EOS keys should go. External EOS indexing remains unverified. | Operator ruled docs-19a: leave EOS keys as they are; docs-19b: align confirmed H1 mismatches without adding a new failing gate (`org/reviews/2026-09-decision-register.md:3115`). |
| docs-20 | live | `scripts/docs/lib.mjs:456,458,523` renders rail and page `<h1>` plus search results without a live announcement. | Source proves markup, not a tested assistive-technology failure or formal WCAG breach. The built site was not regenerated. | Executor accessibility review and fix. |
| docs-21 | live | `scripts/tooling/line-census.mjs:389-391` now counts `src`, `tests` and `scripts`, not `docs`. | Historical claim that scripts were uncounted is fixed by `scriptsLines`; docs remain outside the ratchet. No deletion credit follows. | Executor; a new census key requires a ruled closed-oracle amendment. |
| docs-22 | refuted | `branding/assets/README.md:10` describes assets “as they are added”; `TRADEMARK.md:26` links that directory. | The preliminary deletion claim fails: the placeholder preserves the reserved asset path, and folding it would require changing trademark text for no demonstrated benefit. | Operator ruled leave the placeholder and legal pointer as they are (`org/reviews/2026-09-decision-register.md:2214-2225`); no removal owner. |

## Org

| ID | Status | Current evidence | Qualification | Ruling / owner |
| --- | --- | --- | --- | --- |
| org-01 | fixed | `org/decisions/ADR-0011-t-0144-unsanctioned-org-edits.md:10-14,59-66` ratifies four protected lines and restores closed history; `org/tasks/T-0149.json:62` records mutation proof. | The original R2 breach remains a historical fact. `T-0149.json:79` records six kept/closed-document directions outside the K3 oracle. | Operator accepted ADR-0011; remedy present. |
| org-02 | fixed | `org/policy.json:125` retains a two-writing-lane cap; `org/PLAYBOOKS.md:71-73` requires committed claims. `git show 65670c61:org/claims.json` shows no active lane at the inspected revision. | Past ten-agent fan-out cannot be undone. The separate current working claims file changed during coordination and was excluded. Automatic lane enforcement remains absent. | Operator ruled two lanes; coordinator owns future claims. |
| org-03 | live | `scripts/tooling/check-derived-views.mjs:19-25` checks five projected columns, not task reasons or schema; `org/TEMPLATES.md:17-21` states the required shape. | Historical records must not be rewritten. `org/QUESTIONS.md:123` now rules R2/high-assurance mode; a bounded new-record structure check remains absent. | Operator ruled mode; executor owns new-record check. |
| org-04 | fixed | `package.json:34-35` exposes `gate` and `sweep`; `scripts/tooling/gate.mjs:1-21` specifies exit-code/tree checks; `scripts/tooling/mutation-sweep.mjs:83-104` validates mutant input. | Original “nothing in repo enforces any step” is false. `rg -n 'census:lines|npm run sweep' .github/workflows/ci.yml` finds no CI census or sweep step. | Runner/sweep ruling implemented; CI integration remains owner work. |
| org-05 | live | `org/HANDOVER.md:754` says C7/C8 remain while `:786` says closed. The handover has grown, so historic line positions and size numbers have drifted. | The 121,651 and 121,762 C0 figures represent different measurement points and must not be collapsed. Boot inclusion is a separate decision. | Executor for contradictions; operator if boot contract changes. |
| org-06 | live | `org/PLAYBOOKS.md:30-41` has a short standard procedure; `org/HANDOVER.md:698-748` has the practised batch procedure. | Handover now uses the runner, but authoritative procedure location remains split. Net saving unknown. | Executor within recorded procedure ruling. |
| org-07 | live | Living stale mentions remain at `org/LOCKBOOK.md:27,53`, `org/QUESTIONS.md:25` and `org/TESTING.md:85`. | `org/LOCKBOOK.md:15` is a machine-read seed pin, not an ordinary stale link. Historical mentions and code spans need explicit exclusions. | Executor for living prose; EOS/operator for seed-contract change. |
| org-08 | live | `org/plans/2026-09-consolidation.md:5,32` says `done` and C6-C8 remain. | The two C0 numbers refer to plan start and first committed baseline; neither was disproved. | Executor editorial correction. |
| org-09 | live | `org/plans/2026-08-consolidation.md:5` and `org/plans/2026-09-final-release.md:5` remain approved. `git ls-files 'org/reviews/*.md'` lists 26 tracked reviews; five lack front matter: `2026-09-real-hermes-round.md`, three `2026-09-t0158-*-brief.md` files and `QA_ROUND_6_BRIEF.md`. `org/reviews/2026-09-ui-recon.md:1-4` has front matter but no status key. | “Closed plans still approved” overstates the case: T-0003 and T-0113 remain open. Distinguish missing front matter from missing status, and exclude untracked T-0164 lane files from the tracked-review count. | Executor for review metadata; task/release owner for plan status. |
| org-10 | refuted | Required seed forms remain under `org/genesis/`; `org/genesis/WORK_PACKAGE.md:92` is an acceptance form; `scripts/tooling/line-census.mjs:389-391` excludes `org/`. | Blank forms are sanctioned seed state. No deletion or census saving. | Existing EOS seed contract; no action. |
| org-11 | live | `scripts/tooling/eos-compile.mjs:24` retains a personal-path fallback; `:165-177` refuses a zero-row matrix; `tests/unit/b15-corpus-moves-under-org.test.ts:138-147` pins the script. | Refusal is conditional on the external matrix. EOS was not run and its current matrix was not verified. `scriptsLines` changes the older census accounting. The script is still present, so the settled retirement has not landed. | Operator already ruled retirement with a COMPILE_REPORT note and EOS feedback entry, including removal of the two script-pinning test cases (`org/reviews/2026-09-decision-register.md:636-669`); executor implementation pending. |
| org-12 | live | `org/tasks/T-0003.json`, `T-0004.json` and `T-0113.json` remain active/in progress; `org/STATE.md:19` says nothing waits on the operator. `org/QUESTIONS.md:210` calls done T-0025 “proposed”. | Do not close T-0004 as superseded: branch-protection acceptance remains distinct. External worktree and GitHub settings were not inspected. | Operator for refs/settings/cadence; executor for question and view upkeep. |
| org-13 | refuted | `org/policy.json:137-140` intentionally pairs `mapping_ref` with `validated: false`. | An absent, unvalidated mapping is sanctioned. Nulling the reference would change the seed shape. | Existing EOS ruling; no action. |
| org-14 | fixed | `docs/adr/README.md:36` lists ADR-0010; `org/tasks/T-0149.json:62` records a mutant removing that row being killed. | Current index and oracle address the omission. | Executor implementation complete. |
| org-15 | fixed | `tests/unit/c8-the-programme-is-closed.test.ts:94-115` freezes `AT_C8`; `:353-363` compares historical misses with it. | Live baseline growth accounting remains and `org/tasks/T-0149.json:88` records a separate residual concern. Jest was not run in this review. | Operator's closed-oracle amendment ruling implemented; residual ratchet issue remains owner work. |
| org-16 | live | Read-only task JSON scan, excluding post-revision T-0164: **177 records, 113 over 40 lines, 284 top-level keys, 240 used once**. `org/TEMPLATES.md:21` sets the budget. | Historic 145/96 and corrected 145/93 counts have drifted. No basis for a 40% byte saving; schema extensions need EOS coordination. | Executor for inventory; EOS/operator for schema change. |
| org-17 | live | `org/TASKS.md:10` and `org/STATE.md:10,27,34` retain the wrong-root command, `None`, and a lagging commit fact. `scripts/tooling/check-derived-views.mjs:119-122` gives the root-bound render command. | `org/HANDOVER.md:721` now includes that working command, but derived headers and STATE rendering remain. | EOS renderer owner; integrator must not hand-edit derived views. |
| org-18 | live | `org/START.md:20-23` requires a generated context packet. `rg -n -i 'context.?pack' scripts src package.json` finds no generator. | Policy budget and blank Genesis form do not instantiate a packet. | Executor/EOS documentation owner. |
| org-19 | live | `scripts/tooling/line-census.mjs:389-391` excludes `org/`; `tests/unit/c0-the-line-census.test.ts:144` and `tests/unit/u16-the-docs-describe-the-system.test.ts:120` read fixed plan paths. | This is a sound do-not-move constraint, not a deletion task. Moving records saves zero census lines and breaks readers. | ADR-0010 placement stands; operator/ADR if changed. |

## Reproduction and limits

The 61 uppercase link labels can be reproduced with a global match of
`\[[A-Z][A-Z0-9_]+\.md\]\([^)]+\)` over tracked docs Markdown plus README.
For task counts, enumerate `org/tasks/T-*.json` at `65670c61`, count newline
delimiters per file, parse each JSON object's top-level keys, and exclude
`T-0164.json`, which exists only in the later local T-0164 commit. The docs
front-matter check enumerated 75 `docs/**/*.md` pages, counted pages with any
of `type`, `tags`, `compiled_from`, `status`, `approved_by` or `session`, and
compared front-matter `title` with the first Markdown H1; it found 47 and 10.
These scans are inventory evidence, not a claim that every mismatch is wrong.

Unverified: assistive-technology behaviour of the built docs site, image
freshness, live branch protection and hosted CI, current EOS seed validation,
external worktree state, and a build or Jest rerun. The file/line and direct
script evidence above is sufficient for the stated source-level dispositions,
but the separate T-0164 sceptic should challenge these qualifications before
the coordinator updates any central ledger.
