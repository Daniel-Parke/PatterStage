# T-0191 component verification

Opened 3 October 2026 at dev `39d7a8956d597175f553c558012f9a25738cafe1`, ruled R2. Implementation and independent oracle execution have not started. The draft disposition ledger accounts for every assigned finding, split decision and coverage obligation; pending rows are not completed work.

The opening retains the confirmed responsive repairs, truthful Story progress, owned cancellation feedback, readable Mission metadata and chapter-start positioning. Public adapters stay unless a measured full-cohort reduction supports their ruled replacement. No paid provider calls, schema changes or compatibility retirement are authorised here. New implementation follows a frozen independent red oracle. Original tests, protected/history files and fixed targets have a captured preservation baseline at `tmp/t0191-preservation-baseline-20261003.json`.

Personal production baseline at accepted source revision `08bd39cf`, identical source/tests to the opening: `tmp/t0190-green-validation/tmp/t0190-personal-1791028989606/walk.json`. Six controlled cases at 1440x900 and 390x844 show no Stop for isolated edit/continue and a covered Stop during supported generation-plus-edit overlap. Normal activation times out in both overlap cases. This is defect evidence, not six passing product journeys. The phone screenshot was visually inspected; keyboard evidence remains pending. Owned port 3998 stopped, tree stamp unchanged. No real provider calls were made.

## Independent prerequisite verdict

The following is the independent review by Laplace, session `01a1019a-65c6-7ae2-aafe-5b79b166c745`, copied without changing its findings. Its clean-tree observation predates this task opening. The original failed attempt is retained; the later unchanged workflow pass does not establish a repair. T-0195 owns investigation. Historical test amendments below remain unauthored and require their separate author and recorded before/after proof.

# Independent closure prerequisite and historical amendment verdict

Date: 2026-10-03. Independent R2 REVIEWER in this session; no source or gate authorship. This report is the only file written for this request. No source, tests, CI, task records or canonical ledgers were modified. No tests or jobs were executed by the reviewer. GitHub access was read-only.

## 1. T-0190 closure prerequisite: PASS

**The hosted closure prerequisite is satisfied at `39d7a8956d597175f553c558012f9a25738cafe1`. T-0191 may proceed through its authorised opening and independent oracle process.** This supplements the accepted implementation verdict for `08bd39cfc4d95bd8b8a5c4367ddfdacdab8f1a4d`; it does not expand that verdict into release, merge, deployment or whole-product acceptance.

The previously conditional verification is now observed. Original push attempt 1 remains failed; attempt 2 passes. Root cause remains unresolved. No repair or scheduling-overhead cause is established. T-0195 must retain explicit investigation ownership when the coordinator canonicalises this disposition.

### Exact run, attempt, job and step verification

Inspected snapshot: `tmp/t0190-hosted-closure-rerun/snapshot-1791029119234.json`, observed `2026-10-03T12:05:19.233Z`. I parsed all four referenced raw receipts and compared their run IDs, head, event, status, conclusion, job counts and each job's ID/name/status/conclusion against the snapshot. There were no mismatches.

The raw receipts omit attempt numbers. Independent GitHub API queries supplied those numbers and matched every saved job and every step's number, name, status and conclusion against the corresponding attempt-specific jobs endpoint. All jobs identify the exact closure SHA. CI uses `.github/workflows/ci.yml`; scans use `.github/workflows/gitleaks.yml`.

| Workflow / event | Run | Attempt | Observed result |
| --- | --- | --- | --- |
| CI / PR | 37074426705 | 1 | Completed/success, 11 of 11 jobs successful |
| CI / push | 37074421302 | 2 | Completed/success, all nine applicable jobs successful; two event-inapplicable skips |
| Gitleaks / PR | 37074426694 | 1 | Completed/success, scan job 111061018150 successful |
| Gitleaks / push | 37074421300 | 1 | Completed/success, scan job 111061000999 successful |

The PR acceptance job is `111063900297`; PR macOS is `111061018604`. The new push macOS job is **111197456223**, started `2026-10-03T11:55:22Z`, completed `2026-10-03T12:04:42Z`, run attempt **2**. Its coverage step 11, isolated context suite step 14, production build step 16 and database-purity step 17 all completed successfully. Prerequisites, dependency installation, isolated migration, lint, API path check, TypeScript and all diagnostic steps also succeeded. Its only skipped step was the unused checkout retry. Across successful CI jobs, the only non-success step conclusions were unused checkout retries; scan steps all succeeded.

The macOS attempt-2 log reports **8,279 passed, five skipped, 8,284 total tests; 823 passed suites, one skipped, 824 total**. The isolated context suite separately reports **20 passed, 20 total**. The main workload itself passed; acceptance is not inferred from that isolated result. Existing skips are not counted as passes.

**Scope correction:** attempt 2 reran the entire push workflow, not only macOS. The attempt-specific endpoint contains 11 new job IDs: nine executed jobs and two event-inapplicable skips. Thus there was one additional workflow attempt containing one complete macOS rerun, plus reruns of the other applicable jobs. This is broader unchanged verification, with no omitted required work; it does not invalidate the closure prerequisite. Canonical prose must not claim that only macOS was rerun.

Push full E2E and acceptance-gate are skipped by the existing event predicates in `.github/workflows/ci.yml`; both succeeded on the PR. A green push conclusion alone would not have established that PR evidence, which was checked separately.

Read-only sources: [push attempt 2](https://github.com/Daniel-Parke/PatterStage/actions/runs/37074421302/attempts/2), [macOS job](https://github.com/Daniel-Parke/PatterStage/actions/runs/37074421302/job/111197456223), [PR CI](https://github.com/Daniel-Parke/PatterStage/actions/runs/37074426705), [PR scan](https://github.com/Daniel-Parke/PatterStage/actions/runs/37074426694), [push scan](https://github.com/Daniel-Parke/PatterStage/actions/runs/37074421300).

### Failed attempt retained, not reclassified

`tmp/t0190-closure-failure-attempt1/run.json` identifies run 37074421302, attempt 1, exact closure SHA, push event, CI workflow and completed/failure. The preserved `jobs.json` matches the live attempt-1 job identities, attempts, heads, names, status, conclusions and complete step records. Original macOS job **111061001594** failed coverage step 11; its isolated context suite succeeded, while production build and database-purity steps were skipped. Those missing original checks were actually executed successfully in attempt 2.

`qualification.json` preserves C02's missing final completed exit (20 versus 21 native statuses), C05's false `withinDeadline`, the shared stalled observation, original **two failed / 8,277 passed / five skipped** totals, coverage exit 1, and the subsequent isolated **20/20** pass. These findings agree with the original log independently inspected during the preceding triage. Its recorded full-log SHA256 is provenance supplied by that qualification; I did not recompute that full-log hash in this request.

The later green result does not erase the first failure, prove scheduling overhead, or prove that an intermittent defect cannot recur. The prior private Windows timing receipt remains diagnostic only. This verdict does not claim native macOS local reproduction.

T-0195 handoff: preserve both attempts, the shared-observation distinction, all timing/cleanup requirements and exact evidence references; investigate cause without silent retry, deadline growth, coverage reduction or skips. The 21 native calls, inner six-second watchdog, 0.2-second kill grace and outer/RPC 25-second limits remain unchanged. An eventual closed-oracle amendment still requires independent dated authority. This report records the disposition for canonicalisation, not a claim that T-0195 has already been updated. No T-0206 is needed for the completed verification.

### Source and evidence integrity

HEAD remains the exact closure SHA and the tracked checkout is clean. The accepted implementation-to-closure diff consists only of the eight organisation metadata/review files identified in the preceding triage. Git tree/blob identities match between the two commits:

| Surface | Identical Git object |
| --- | --- |
| src | ee9e1bfdec2ebc740b4832ed01045917123973ea |
| tests | d24574764d88046ddbddcfac4f9b64535814298c |
| scripts | 020c836e276421201979d1bf842d949a4b7b79ec |
| .github | 2ed27a11ce0fc54f80c27fd46824f8ccab629d47 |
| package.json | bc9c2b0ae8fe1d3cfda272c16467efcb3fcccfc3 |
| package-lock.json | e7f6f20f65468b51e7eadab20eb3e5aa009f0535 |

Both hosted attempts identify that same closure commit. This establishes unchanged checked-in source/gates/workflow, not identical hosted-machine scheduling or infrastructure.

SHA256 of inspected saved evidence:

- Snapshot: `c46454be59e343c37ad8daec3bb67de94d9afb9880972f85234a8c38ad19b07c`.
- Failed-attempt run.json: `8986e4a61d02f3373be9bb41c1786dc65a2a2f174fe8780a494a80c869e4f5ca`.
- Failed-attempt jobs.json: `c1fcdbdb423b4dabb5db12a550e907312687ecb7e3ca9e9e470859cf97fe6d28`.
- Failed-attempt qualification.json: `205b15f7d8a69f5096052f15d45d6145191d245c4ae24313326897ee43115f95`.

## 2. T-0191 narrow historical amendment: AUTHORISED SCOPE, execution pending

**The specified amendment is supported by existing rulings and Q-015. No new operator decision is needed within this exact scope.** This is pre-authoring authority, not acceptance of an unwritten amendment, a control run, or T-0191 implementation. The coordinator must record the dated authority and exact claims at T-0191 opening before the fresh ORACLE author starts.

Authority inspected:

- `org/QUESTIONS.md:152-153`, Q-015: a closed-programme oracle changes only by a dated amendment for the ruled item, authored by a different session from the implementer. Constitution Part II Article 4 and the REVIEWER charter preserve that separation.
- `org/reviews/2026-09-decision-register.md:2187-2199`, critic-09: the operator selected deletion of only the four unused RGB mirrors on 2026-09-12, including correction of the stale U0 call-site comment and U2 alias comment. This does not authorise deleting synthetic token fixtures or altering executable assertions.
- The same register at line 3090, components-16: explicitly delete unused compact/mode component behaviour and tests covering only that deleted code. This is a ruled removal of an unused feature, not permission to suppress failures for retained behaviour.

Permitted historical edits:

1. `tests/unit/u0-the-gate-sees-what-it-claims.test.ts`: only the relevant stale explanatory comments. Preserve every test identity, parameter row, assertion and executable token, including the synthetic `--ps-rgb-neon-purple` fixture. A lexer fixture need not correspond to a live stylesheet token.
2. `tests/unit/u2-the-contrast-gate-refuses.test.ts`: only the relevant stale alias commentary. Preserve every test identity, parameter row, assertion, helper and fixture, including the actual alias-resolution control.
3. `tests/unit/components/schedule/SchedulePicker.test.tsx`: remove only the complete test blocks named **"compact mode renders just the preset dropdown (no custom builder)"** and **"compact mode opens dropdown and selecting a preset calls onChange"**. Preserve all other test names, bodies and assertions. There are currently 20 literal `it` identities in this file, so these removals leave the other 18 unchanged. No skip/todo substitution or unrelated cleanup is authorised.

The current source still has the compact branch and discarded mode prop. The two located production JSX callers, MissionCreateForm and ScheduleScriptModal, omit both props. The two proposed removals specifically exercise compact behaviour. The deletion must accompany the authorised production removal; it must not leave retained compact behaviour untested as a separate final state. Retained preset selection, custom builder, advanced-draft validation, Escape/Enter handling, disabled state, error display and stored schedule controls remain mandatory.

Ownership qualification: `org/plans/2026-09-refactor-ownership.json` currently assigns critic-09 to **T-0182** and components-16 to **T-0191**. Record the residual two comment corrections explicitly as a T-0191 carry-over at opening, citing critic-09 and this narrow authority. Do not silently rewrite historical ownership or imply a broader transfer of token/gate changes. The operator's current request supplies authority for this narrow carry-over.

Required amendment evidence before implementation acceptance:

- A fresh ORACLE session distinct from the implementation author, with identity and exact claims recorded; the final acceptance reviewer must also remain independent of source and gate authorship.
- Original Git blobs plus raw and consistently LF-normalised hashes, full expanded test-name sets including parameterised names, and an unmodified baseline control run with its exit result. The present source inspection is not that control run.
- An append-only dated amendment citing Q-015, components-16 and critic-09, exact deleted identities and comment-only boundaries; retain the original provenance and prior results. Comments must not introduce pragmas or directives that change execution, linting or coverage.
- After amendment, demonstrate identical U0/U2 executable content and name sets; SchedulePicker's name-set delta must be exactly the two listed identities, with all other bodies/assertions unchanged. Record control results and any failures honestly. New T-0191 behavioural oracles and normal whole-gate verification remain separate obligations.

Original baseline observed here, for comparison with the author's later capture (raw SHA256 may differ solely with checkout line endings):

| File | Git blob at closure | Raw SHA256 |
| --- | --- | --- |
| u0-the-gate-sees-what-it-claims.test.ts | 9848c47e2273de1d2ec76444443fef584072f310 | 5b4dd7e15f2aff7d67e2e7146324b10d7373214caf3cac668b988052984960e0 |
| u2-the-contrast-gate-refuses.test.ts | b1d0d16afed0b466e52f97e2a69cad6252336130 | b8809558343cdef6cc206ff58e9c8fec34d9f818fc6fe48f28de681cbe06b71a |
| components/schedule/SchedulePicker.test.tsx | 731b74502523a7a4e50cb0010d8ad08478177804 | adfd2deafc5d46bfa67f39a64e6899afdb794c415cf603f9cbca55872156ac30 |

No authority is granted to alter other historical assertions, synthetic fixtures, test counts beyond the two explicit removals, deadlines, runners, CI or coverage floors. Any wider required amendment returns for independent disposition before editing. This reviewer has evaluated scope only and has not authored replacement tests or comments.
