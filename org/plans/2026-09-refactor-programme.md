---
summary: Proposed Phase 2 refactor programme after itemised T-0164 reconnaissance
type: venture
tags: [plan, refactor, consolidation]
status: approved
---

# PatterStage refactor programme, proposed 28 September 2026

**Approved by the operator on 28 September 2026 for prerelease execution.**
This plan completes T-0165's planning prerequisite; approval does not authorise
PR #157's merge or a release. Q-011 still requires
the operator's rc.1 and v1.0.0 release before structural work. T-0180 to
T-0187 are proposed prerelease security, defect and compatibility batches. If a red-first
oracle refutes a source-level candidate, its batch records the refutation and
does not manufacture a fix.

The evidence is [T-0164's current-tree recon](../reviews/2026-09-t0164-refactor-recon.md),
its [finding](../reviews/2026-09-t0164-findings.jsonl) and
[atomic coverage](../reviews/2026-09-t0164-coverage.jsonl) ledgers, and the
[focused defect docket](../reviews/2026-09-t0164-defects.md). The
[machine-readable batch register](2026-09-refactor-programme.json) fixes each
batch's claims, authority, dependencies, invariants, rollback and exact Verify
line. The [ownership map](2026-09-refactor-ownership.json) accounts for all
265 finding IDs, 163 split decision IDs and 285 atomic proof IDs; its
[generator](2026-09-refactor-ownership.mjs) is reproducible from the
T-0164 ledgers. A planned assignment means *reverify and adjudicate*, not
automatic removal. Each source-level observation retains its qualification.

## Context and authority

The former C0-C8 consolidation is closed. Its five original target misses
remain historical. T-0164 found 265 preliminary IDs: 244 verified **source
observations**, 12 refuted and nine unresolved, with 163 split operator
dispositions. Of 285 atomic coverage obligations under the 107 original gap
bullets, 25 narrow facts are verified, 215 are unresolved and 45 were
deferred in the read-only recon. The plan assigns 248 local proofs and keeps
only 12 genuinely external or operator-owned proofs deferred. A verified
source shape does not establish a user defect or a net saving. T-0164's
independent sceptics and completeness critic corrected the itemised record.

The decisions binding this programme are:

1. **Q-009 and Q-010:** CI is binding after every dev push. Use the whole
   ten-step gate by exit code, an unchanged tree, at most two writing lanes
   with claims, and an independent R2 review. Public contract covers routes,
   npm commands, environment variables, config keys and documented exports.
2. **Q-011:** Ship rc.1 and v1.0.0 after security and build lifecycle repair,
   before structural cleanup. Legacy aliases and 52 redirects remain through
   1.0; retire them together in the first post-1.0 release. The operator owns
   the real-install migration rehearsal, Docker matrix, tag and merge.
3. **Q-012, Q-019 to Q-024 and ADR-0012 to ADR-0014:** Preserve opaque,
   revocable browser sessions, managed transport, origin checks and read-only
   lifecycle exceptions. Keep the accepted bounded signature and throttle
   gaps visible. Repair the ineffective secret scan and conditional log
   symlink boundary. A strict CSP needs a built-app design and R3 approval.
4. **Q-013 and Q-014:** Remove only individually ruled dead internals. Keep
   documented routes, public npm names except the expressly ruled dead
   `test:e2e-bench-gateway` command, data tables and user data. Build is
   database-free; backup precedes migration; migrations converge or fail.
5. **Q-015, Q-017 and Q-023:** Preserve test identities and coverage floors;
   a closed oracle changes only by a dated, different-author amendment. The
   closing arithmetic is row by row, with every miss named.
6. **Q-016, Q-025 and Q-027:** Keep Select and Picker separate, name the
   unnamed controls, preserve elapsed run deadlines, move Missions reads
   through the shared cache, render chat via SimpleMarkdown with Copy, and
   keep Laboratory within ADR-0005 before relocation.
7. **Q-029 and Q-030:** Dependabot version PRs stay paused until release;
   security updates and repository alert settings remain operator actions.
   Pages deployment accepts only `main`. No batch silently changes these
   external settings.

No feature, route, URL, CLI command, config key, environment variable or
documented behaviour is removed without its item ruling. The five dev-only
`ch-*` hardware shims have a specific pre-1.0 deletion ruling; `ch-backup.sh`
and `ch-deploy.sh` remain until the first post-1.0 release. Compose volume
names and `/data/ch` remain to preserve installed data. No protected file
changes without an accepted ADR. Historical task records, append-only ledgers
and derived views are never hand-edited. Windows 11 and Git Bash development
remain supported while Linux is the deployment target.

## Measures, fixed once

The [measure contract](2026-09-refactor-measures.json) reads the **committed**
line-census baseline at `babf76ac` and the **committed** scope baseline file
at `ec04895f` (whose measured source revision is `2d6468ce`). The targets
below are modest net reductions supported by named convergences after new
interfaces and red-first tests. They do not use the overlapping 12,800-line
estimate. Targets do not move during execution; the
[closing oracle](../../scripts/tooling/refactor-closing-oracle.mjs) reads the
first commit that added the measure file, not the working copy or a live
rolling baseline.

| Measure | Frozen baseline | Fixed target |
| --- | ---: | ---: |
| Source lines | 102,141 | ≤100,000 |
| Test lines | 133,754 | ≤132,000 |
| Repeated source-window lines | 1,012 | ≤950 |
| Repeated test-window lines | 4,786 | ≤4,600 |
| One-importer components | 104 | ≤100 |
| Live tooling lines | 30,025 | ≤29,500 |
| Live documentation lines | 11,164 | ≤10,900 |
| Live organisation lines | 6,225 | ≤6,200 |

These are **programme goals, not measured savings forecasts**. T-0164 did
not establish a net saving for each proposed fold. The operator can approve
the goals knowing a closing miss will be reported rather than hidden. The
opportunity-and-cost evidence that informed each ceiling is:

| Measure | Candidate opportunity now evidenced | New cost or uncertainty before a net claim |
| --- | --- | --- |
| Source lines, goal −2,141 | 18 remaining route try/catch files, five hand-rolled reads, named data wrappers and large page handler lists | New interfaces, transaction guards and accessibility fixes can add lines; every batch measures its actual net. |
| Test lines, goal −1,754 | 14 inline DB-mock suites and 101 likely source-assertion suites among 126 candidates | Behavioural replacements and red-first oracles can cost more than removed source assertions. Test names and floors win over the target. |
| Repeated source windows, goal −62 | T-0164 identified hook return/consumer restatements and route envelopes in the 1,012 counted lines | Interface declarations at two ends are not always removable; two-consumer folds need a measured gain. |
| Repeated test windows, goal −186 | Shared fixture and request-mock shapes within 4,786 counted lines | A helper can add indirection; no suite merge is justified by subject alone. |
| One-importer components, goal −4 | Census lists 104 one-importer components | The four to fold are selected only after accessibility and net-line checks, not by importer count alone. |
| Live tooling, goal −525 | The ruled bench-gateway files alone hold 179 lines; sh/mjs twins and CI setup duplicates are named | Replacement oracles, Windows compatibility and public npm aliases add cost. |
| Live docs, goal −264 | Root/running duplication and stale paths are identified by docs-01/02/04/08 | Canonical security and migration instructions cannot be shortened merely to meet a line goal. |
| Live org, goal −25 | Live handover and process notes repeat the landing sequence | Protected, historical and generated text is excluded; new governance evidence can raise live lines. |

The original five commitments remain 100,983→98,000 source lines,
124,351→116,000 test lines, 1,000→600 repeated source-window lines,
4,345→2,500 repeated test-window lines and 103→95 one-importer components.
They are reported separately, not silently replaced. The scope census
excludes protected files, historical tasks/plans/reviews, derived views,
operational claims and tooling ledgers from reduction incentives. At the
frozen scope revision these separate categories measured 2,452 protected,
29,517 historical and 1,022 generated lines. Every batch records a measured
net change; a census rise requires the existing explicit growth reason and
does not alter these targets.

## Landing contract

For each approved batch, first create its sequential task record with ruled
tier and claimed files. Commit its behavioural oracle red before the source
change. A structural assertion must be narrow; closed-oracle amendments use
another author. Agents use disjoint file ownership and prove before/after
test-name identity. The coordinator runs the oracle, TypeScript, the full
Jest corpus and relevant browser journeys. Visual work is walked on isolated
data at 1440×900 and 390×844 with console, horizontal overflow, `h1` and
screenshot hashes recorded. Run all ten gate steps by exit code on an
unchanged tree, commit, sweep the committed tree, repair survivors with their
own test commit, close the record, render views from pinned EOS, push only
`dev`, and observe **every** hosted push and PR job before the next batch.
Stop after three materially distinct falsified hypotheses without reduced
uncertainty, per START. If an assigned proof is genuinely external, record
its owner and defer it explicitly rather than claiming it passed.

The accepted org-11 retirement expressly removes two `b15-corpus` test cases
whose only subject is the refused EOS compiler. T-0187 records their names,
the item ruling and the test-count change; it does not present that deletion
as an identity-preserving move. Its EOS feedback is appended through the
repository's ledger procedure, not by rewriting earlier entries.

The proposed tier in the batch register is a floor, not a self-approval. The
router records the actual verdict and reasons when its task record opens.
R2 uses high-assurance and an independent review; T-0182 and T-0200 propose
R3 because security policy and public compatibility change. A batch touching
the protected set first obtains its specific accepted ADR. Every move checks
alias, written path, joined path segments, relative import and regex literal.

## Proposed batches

The register supplies exact file claims, rollback and full Verify text. The
following ordered rows show the gate each batch must meet. The chain keeps
each batch independently revertible and waits for hosted CI between pushes.
T-0188 and every later structural batch also depend on the operator's v1.0.0
release. T-0200 is the first post-1.0 compatibility-retirement unit.

| Task | Scope and dependency | Exact acceptance focus |
| --- | --- | --- |
| T-0180 | Strict Gitleaks history and CI, prerelease | A planted secret fails; all historic candidates and scanned refs are accounted for. |
| T-0181 | Log symlink and path/URL guard proof, after T-0180 | Linux sentinel is unchanged after refused GET/DELETE; normal in-root use and Windows guard checks pass. |
| T-0182 | Built-app CSP and transport, R3, after T-0181 | Framework and product journeys work at both widths with zero policy violations; an injected inline script is blocked. |
| T-0183 | Mission queue reservation and cancellation | Overlapping ticks submit once; late acknowledgement cannot undo cancellation; elapsed deadlines survive. |
| T-0184 | Mission cron transition, schedule and category atomicity | Queued-to-cron state, invalid nonblank cron and file-write failure preserve a coherent state. |
| T-0185 | Mission prompt, model input and older links | CDATA round-trips, malformed modelId returns 4xx without write, and mission 201 opens by deep link. |
| T-0186 | Hindsight rederive safety and Story Weaver failed saves | The ruled destructive script cannot run live by default; failed saves leave state unsaved and show feedback. |
| T-0187 | Legacy-name warning and individually ruled prerelease shim retirement | Supported old names still boot with one token-free warning; the five dev-only hardware shims and refused EOS compiler retire with their item-specific evidence. |
| **Operator gate** | rc.1 and v1.0.0 after prerelease repair and real-install rehearsal | Operator checks release checklist, CI, migration backup and Docker matrix; no agent tags or merges. |
| T-0188 | Migration and table driver, after release | Fresh, old and damaged v15 fixtures converge or fail loudly without version advancement or data loss. |
| T-0189 | Data parsing, transactions and column traces | Malformed JSON and injected failure do not create partial rows; proposed column changes have reader/writer/migration proof. |
| T-0190 | Client reads, writes and composition roots | Missions uses cache and shows read errors; mutation invalidation and read-only refusal survive. |
| T-0191 | Components, accessibility and primitives | Select/Picker stay distinct; named controls and desktop/phone states pass; folds save net lines. |
| T-0192 | API route envelopes and validation | Public URL/method matrix and malformed-body responses pass with exact auth and read-only refusals. |
| T-0193 | Large page hooks and visible state | Composer, Missions and Story Weaver retain URL state, dialogs, focus and responsive layout. |
| T-0194 | Library domains and Hermes module | ADR-0005 and five path spellings hold; moved tests retain names and Knip/TypeScript pass. |
| T-0195 | Test harness and source-assertion repair | Test names and floors remain, source assertions get behavioural replacements where feasible, and flake reruns are honest. |
| T-0196 | Tooling and CI consolidation | Both platforms, Docker, install/update and planted lint defects pass; Compose volume names keep existing data. |
| T-0197 | Running, root and CHANGELOG documentation | Canonical commands, manifest, links and live-doc scope pass; protected token-rule edit remains ADR-gated. |
| T-0198 | Live organisation guidance | Claims, task rendering and protected-write refusal pass; protected/history/generated scopes remain separate. |
| T-0199 | Ruled dead internals, after release | Every removed path has a caller inventory and item ruling; the dead benchmark npm command and unreachable baseline rebuild leave while old backup listings, routes and data remain. |
| T-0200 | Legacy alias and redirect retirement, R3 | 1.0 keeps supported aliases; first post-1.0 candidate retires them together with boot tripwire, all claimed readers and migration preservation. |
| T-0201 | Row-by-row close | Eight fixed targets, every miss and final 265 finding, 163 split-decision and 285 atom dispositions are reported; all CI jobs green. |

## Deliberate non-actions and unresolved proof

Refuted preliminary IDs stay refuted, including critic-10, critic-15,
tooling-06, tooling-26, tooling-27, lib-data-22, org-10 and org-13. T-0164
also refuted tooling-03, lib-data-20, app-01 and docs-22 as originally
proposed. The separate app-01h caller gate remains planned for four
documented operator routes, with API reference labels and without removing
those routes. The explicit keep outcomes app-23, app-24, tooling-33,
lib-data-18 and org-19 remain. The accepted body-omitting signature and
bounded throttle gap are documented limits, not silent implementation tasks.
Two-consumer duplicate folds and subject-only suite merges are not planned
without a measured net benefit. An empty or all-null SQLite column is not
evidence for a drop. The 126 source-reading suites are candidates; the
classify-only ruling still controls, and the 253 bindingless catches are not
bulk-removed.

The ownership map gives 248 atomic proofs a future batch: the original 215
unresolved local obligations plus 33 that the read-only recon had deferred
despite a runnable isolated proof. Twelve genuinely external, historical or
operator-owned atoms retain their exact nextProof and a deferred disposition.
Their eventual closure
needs a reason and owner, not a fabricated pass. T-0164's strict Gitleaks
control found ten redacted default-rule candidates while the repository
config found zero; expired historical alerts and the 1,651-versus-1,666
patch-count discrepancy remain open. The built-image licence inventory,
historic SQLite compatibility and optional Hindsight backend are also
unproven. T-0180, T-0189 and T-0196 own the local work; external or operator
proof is named in the coverage ledger.

T-0200's register claims the 63 files found by the current tracked-source
`CH_|CONTROL_HUB_|AGENT_HOME|x-ch-|ch.sessions.` inventory across `src/`,
`scripts/` and `next.config.ts`. Its oracle checks that file set. At batch
opening, refresh the inventory and claim any newly added readers. Historical
`control-hub.db` discovery, `ps-relocate.sh`, Compose names and installed
data-dir copies are explicit preservation exceptions, not blanket removals.

## Risks and closing rule

The highest risks are an undiscovered real-install migration variant, a
security rule that reads zero, a route or old alias used outside static
callers, a source-text suite that breaks after a valid move, and a browser
state that depends on an absent Hermes or Hindsight backend. Red-first
oracles, real-install rehearsal, route matrix, test-name identity and
isolated built-app walks are the controls. A local green gate is bounded
evidence; every hosted job is observed separately. Repository security
settings, branch protection, PR #157 merge and release remain operator
actions.

At T-0201, run the closing oracle on a clean committed tree. It requires a
committed `org/plans/2026-09-refactor-final-dispositions.json` with unique
final status, reason, evidence and owner for all 265 findings, 163 split
decisions and 285 atomic proofs. For **each**
measure, state the frozen baseline, fixed target, final count and delta. Name
every miss and explain it in the plan's closing section, with its number.
Mark every preliminary finding, split decision and atomic obligation done, ruled out or
deferred with an evidence reference and reason. Do not rewrite targets,
protected history, or the source ledgers to make a result green.
