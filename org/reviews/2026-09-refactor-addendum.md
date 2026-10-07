---
summary: Dated corrections to the September refactor review and the operator's subsequent rulings
type: review
tags: [review, decisions, refactor]
status: active
---

# PatterStage refactor: evidence and ruling addendum, 2026-09-26

This addendum starts from `dev@1a9447514251cf7aff32b49be796ebe18ba1700c`.
It preserves the preliminary review, the T-0155 recon and the closed task
records as historical evidence. The companion
`2026-09-evidence-ledger.jsonl` maps all **257 surviving and eight refuted**
preliminary findings, plus the **107 original “Not examined” bullets**, to
their source lines. Run `node scripts/tooling/review-ledger.mjs` to verify
identity and disposition coverage. Its `--report` mode prints the populations;
`--write` is for initial generation only and would discard later manual
adjudications.

The 107 bullets are source units, not 107 atomic investigations. Some contain
several questions or overlap another bullet. Each currently says
`pending-decomposition`, with an empty `atomicObligations` list. The original
recon's 33 closed / 34 partial / 31 open / nine excluded and its ten-blocker
claim have no row-to-source mapping. Those totals remain **unverified**. T-0164
will decompose, deduplicate and adjudicate the obligations before deriving new
totals. A source line and an older sceptic verdict establish provenance, not
that a finding still holds on this tree.

## Operator rulings made after the first register

These are Daniel Parke's choices in the refactor-planning conversation on
2026-09-26. They add to Q-009–Q-018. A ruling authorises the direction stated;
it does not by itself accept an ADR, prove implementation or waive a gate.

| ID | Selected ruling | Consequence and owning work |
| --- | --- | --- |
| Q-019 | Upgrade Next to the verified candidate **16.3.6** with the matching `eslint-config-next` before the general Node/dependency batch. | T-0157 remains a focused R2 framework/security batch. Re-check availability and advisories at implementation, then keep the two package versions aligned. Other dependency changes wait. |
| Q-020 | Replace raw-token browser cookies with revocable, opaque sessions. | T-0158 needs an accepted session ADR, an independent oracle, migration, expiry, logout and individual revocation. Bearer clients remain supported. |
| Q-021 | Extend Q-015's different-author, dated closed-oracle amendment procedure to **hooks-04, hooks-05 and critic-06**. | T-0162 fixes those blind gates with planted-violation evidence and named baselines where needed. No rule or coverage floor is reduced. |
| Q-022 | Keep loopback HTTP. Require HTTPS for LAN browser access unless the operator explicitly opts into insecure LAN HTTP. | T-0158 defines `PS_PUBLIC_ORIGIN`, deployment binding and the documented exception. A forwarding header alone is not trusted as the public origin. |
| Q-023 | Strengthen Q-017's C8 plan check **row by row**. | A different author amends only the affected closed oracle. A row changed from missed to met must make that oracle fail even if its old number remains elsewhere in the plan. |
| Q-024 | Prepare instructions for enabling Dependabot alerts and security updates, and secret scanning and push protection. | Enabling the repository controls is an operator action. Perform a redacted full-history scan and resolve findings before treating scanning as green. |
| Q-025 | **Select and Picker remain separate**; give the ten Select uses without a contextual `ariaLabel` an explicit name. | This supersedes the contrary “Picker at size lg” line for components-02 in the earlier detailed register. It confirms Q-016's folded wording. No dropdown migration is authorised. |
| Q-026 | A server restart requires browser sign-in again. | T-0158 invalidates sessions with a process-owned boot generation, including rows restored from a database backup. Bearer clients remain supported. |
| Q-027 | Retain **elapsed run deadlines** and correct the prompt, interface and guides. | Do not implement tool-call-based inactivity for missions. Explain the declared timeout, fallback planning horizon and five-minute reconciliation grace accurately. This is separate from Q-020's browser-session inactivity period. |
| Q-028 | Under `PS_READ_ONLY`, allow only exact authentication lifecycle method/path pairs. | Browser sign-in, activity, self sign-out and revocation can write authentication state; application writes remain refused. Document this precise contract and test each exception and refusal. |

The Q-020 session direction uses a **30-minute inactivity** limit and a
**12-hour absolute** limit. Background polling, prefetch and streams do not renew
activity. The proposed storage and transport details in the approved
prerequisite plan are the draft for T-0158's ADR. The ADR must be accepted
before any protected-set change or recorded standards deviation is made.

## Corrections to current evidence

- **T-0158's universal TLS-proxy assertion is refuted.** The earlier direct
  `NextRequest` probe omitted Next's normal server metadata path. An isolated
  probe through installed Next 16.2.9's `attachRequestMeta`, `NextRequest` and
  `proxy` observed `Secure=true` when `X-Forwarded-Proto: https` was supplied;
  plain HTTP and `Forwarded` alone gave `Secure=false`. This does not prove a
  real proxy deployment. The raw-token cookie, one-year lifetime, lack of
  individual revocation and caller-header trust still require T-0158.
- **T-0157's audit count moved.** A fresh `npm audit --json --ignore-scripts`
  returned exit 1 with **14 findings: one critical, eight high, three
  moderate, two low**. Next and `eslint-config-next` remain at 16.2.9 at the
  reviewed commit. npm reported 16.3.6 as the non-major Next fix candidate.
  Re-run the audit and vendor advisory checks when changing the lockfile.
- **The hosted gate is not green on the review commit.** Push run
  `34750055628` passed but skipped `e2e-full` and `acceptance-gate`. PR run
  `34750058444` failed both: the sessions strip assertion in
  `tests/e2e/phone.spec.ts` timed out because the isolated runner had no
  sessions fixture. T-0150 owns this defect. PR #157 is open and no release
  exists, so Q-011's release order still applies.
- **The gate and sweep have three more blind spots.** `gate.mjs` hashes Git
  status and diffs but misses changed bytes at an existing untracked path;
  unknown or intersecting `--only`/`--from` selectors can execute zero steps
  and exit success. `mutation-sweep.mjs` accepts an unknown `--only` mutant ID
  as zero successes, and can label a Jest launch or configuration failure
  `KILLED` without a passing control. Isolated probes established these
  behaviours without running the real gate or mutating a tracked file.
- **The two mechanical test inventories are narrower than the old prose.** A
  TypeScript AST inventory counts 241 bindingless catches at HEAD (239 at
  `ce4ac1fd`) and 124 candidate source-reading unit suites. Neither number
  classifies behaviour. The historical 126/33/93 source-suite split is not
  reproducible from its original detector. T-0164 must classify the 241 and
  124 semantically; tests-09b authorises classification only.
- **SQLite occupancy is not dead-data proof.** A read-only sample of the
  existing local database found 48 tables, 522 columns, 17 empty tables and
  36 all-null columns among populated tables. The sample shows occupancy at
  one instant. T-0164 must trace writers, readers, migrations and recovery
  before proposing any removal.

## Independently checked Missions extension

All 30 files under `src/lib/missions` were read at this commit and eight
reported defects were challenged by an independent sceptic using source
inspection and bounded in-memory probes. Their status here is **confirmed
source-level** unless qualified; no real backend or browser journey ran.

| Area | Current evidence and limit |
| --- | --- |
| Dispatch and cancellation | Overlapping queue calls can issue two submission attempts with different idempotency keys before a reservation exists; late acknowledgement can overwrite cancellation. Two paid backend runs were **not** observed. |
| Queue to cron | Promoting an already queued mission to cron can retain `queuedForRun=true`; the queue can select it before its schedule. An ordinary unqueued draft does not acquire the flag. |
| Rejected schedule | A nonblank invalid schedule can return 400 after changing the mission name, schedule and result. Blank schedules are rejected earlier. |
| Categories | Counting **already includes** `catalog_templates`, refuting that part of the original claim. Deletion does not reassign their rows; conflicting legacy category text can reassign a template with a different canonical ID; file-write failure can be swallowed. |
| Prompt parser | A literal `<task><![CDATA[...]]></task>` sequence inside context can corrupt a reconstructed instruction. An ordinary nested `<task>example</task>` round-tripped correctly. |
| Mission timing | Prompt and guides promise tool-call-reset inactivity while the reconciler uses elapsed time plus five minutes' grace. Q-027 selects corrected wording. |
| Malformed model input | `modelId:42` throws before validation; a stubbed route wrapper mapped it to 500. A live HTTP journey was not run. |
| Deep link | A valid mission older than the newest 200 can be labelled “no longer exists” because resolution searches only the limited list. A browser journey was not run. |

These findings need focused records and behaviour oracles. There is no measured
net-line saving for the proposed Missions consolidations.

## T-0159 census account

The evidence checker and oracle add 194 script lines and 103 test lines against
the committed line-census baseline. The baseline holds those two measured rises
with a T-0159 reason. This is evidence-accounting growth, not a change to the
five original structural reduction targets.
