---
summary: PatterStage Operating model , work types, risk tiers and gates, knowledge lifecycle, cadences, humans
type: venture
tags: [eos]
compiled_from: kernel/templates/org/OPERATING_MODEL.tpl.md
---

# The Operating Model

How the organisation runs. One document, deliberately: a solo operator
should be able to hold the whole machine in their head. Sections: work,
risk and verification, prioritisation, parallel execution, knowledge,
cadences, metrics, humans.

## 1 · Work

### 1.1 Work types

Every work order declares exactly one type; the type sets its Definition
of Done emphasis.

| Type | Goal | Success looks like |
| --- | --- | --- |
| FEAT | New capability | Acceptance tests pass; docs updated |
| FIX | Defect removal | Failing repro test written first, now green; root cause logged |
| REFACTOR | Structure improvement | Behaviour identical (tests unchanged and green); measurable simplification |
| PERF | Speed or efficiency | Baseline measured, target met, regression guard added |
| MAINT | Hygiene (deps, cleanup, rot) | Sweep checklist complete; nothing behavioural changed |
| HARDEN | Security or resilience | Named threat mitigated; control verified; registry updated |
| COMPLY | Regulatory obligation | Registry obligation moves gap to met, with evidence |
| RESEARCH | Answer a question | Research note with sources, confidence, recommendation |
| DOCS | Knowledge and documentation | Accurate, linked, lifecycle front-matter present |
| OPS | Operational or infra action | Runbook followed or updated; system state verified |
| SPIKE | Timeboxed experiment | Question answered; code discarded or converted to orders |


### 1.2 The work order

A work order is a row in `org/QUEUE.md`: id, title, type, risk tier,
status, acceptance checks and a done-when line, per the formats in
`org/TEMPLATES.md`. The queue is ordered; the top unblocked item is
next.

Intake, the only four doors:

1. **Human intent**: the operator asks for something; PLAN drafts the
   orders.
2. **Cadence findings**: audits, reviews and registry gaps become
   orders.
3. **Verification failures and incidents**: CI, VERIFY findings and
   production alerts become FIX or OPS orders.
4. **Worker suggestions**: any session may file a suggestion; triage
   promotes, merges or declines with reasons. This is the sanctioned
   outlet for "while I was in there I noticed"; acting on it directly
   is scope creep and forbidden.

### 1.3 Definition of Done (universal baseline)

All acceptance boxes checked. Required tests written first where the
type demands, all green locally and in CI. Lint and types clean.
Migrations additive and reversible with schema docs updated. Security
checklist for the change addressed. Affected docs and knowledge updated
in the same order. Gates for the tier passed. Merged to a green `main`.
`org/STATE.md` and the session log updated.

## 2 · Risk and verification

### 2.1 Risk tiers

| Tier | Meaning | Examples | Gates |
| --- | --- | --- | --- |
| T1 | Trivial, reversible | copy, comments, internal docs | G1 |
| T2 | Standard change | typical feature or fix in one surface | G1 + G2 |
| T3 | Sensitive or irreversible | schema, auth, money, personal data, public surfaces, infra, the protected set, data deletion | G1 + G2 + G3, ADR where the constitution demands one |

PLAN assigns the tier at triage; VERIFY may raise it, never lower it.
When in doubt, the higher tier applies.

### 2.2 Gates

- **G1, automated.** The CI pipeline the stack profile defines: lint,
  typecheck, unit and integration suites against real services,
  contract-drift checks, build, secret scan, dependency audit. G1 is
  the floor for everything, including docs.
- **G2, independent review.** A separate VERIFY session (never the
  authoring session) reviews the diff against the order, the spec, the
  constitution and the relevant standards; verdict recorded on the
  order.
- **G3, human approval.** The operator approves in writing before merge
  or execution.

Iron rules: no session merges its own T2-or-above work. Gate results
are recorded on the order. A red gate is never bypassed (Part II
Article 6), and the three-strikes rule in `org/START.md` stops the line
after three distinct failed fix attempts on the same check.

## 3 · Prioritisation

Simple by design: P0 (drop everything: broken main, live harm, legal
deadline), P1 (current milestone critical path), P2 (valuable, not
blocking), P3 (someday). Within a priority the order is explicit in the
queue, set by PLAN at triage; WORK sessions take from the top unless
their launcher names an item. Tie-breaking heuristic, judgement not
formula: compliance deadlines and risk burn-down beat features;
unblocking beats everything of equal value; smallest first among
equals.

## 4 · One session at a time

WIP is 1. Each session works on a short-lived branch off `main` and
merges through its gates before the next session starts. The
`active_session` line in `org/STATE.md` is the claim: check it at
session start, clear it at close, treat a stale claim older than a day
as abandoned.

## 5 · Knowledge

Knowledge lives small at this scale: decisions in `org/decisions/`
(ADRs), rulings and contracts in the lock-book, everything else in the
venture brief or the queue. Research conclusions carry sources and a
`review_by` date wherever they land; expired items are suspect (Part II
Article 7). If recurring instructions or thresholds start accumulating,
that is the rescale trigger talking.

## 6 · Cadences (the heartbeat)

Continuous improvement is mechanised as recurring sessions defined in
`org/CADENCE.md` (schedule, procedure, role, last_run, next_due). The
operator launches whatever is due. Every cadence, whatever the
discipline, runs the same loop: review current state, compare against
registry and standards, identify gaps, file and prioritise orders,
implement separately, verify, update the registry and knowledge, adjust
the checks.

## 7 · Metrics

No scoreboard at this scale. The retrospective cadence reads the queue,
the logs and git directly; if a number starts mattering enough to
track, note it in `org/STATE.md` or rescale.

## 8 · Humans

The operator's contract, expanded in the operators guide: launch due
sessions, answer `org/QUESTIONS.md`, approve top-tier gates and
releases, review VERIFY verdicts on sampled work, own accounts, spend
and legal signatures. Everything else is the organisation's job. Budget
guardrail: agent spend is logged per session (estimates acceptable);
triage pauses P2 and P3 work if monthly spend exceeds the figure set in
`org/STATE.md`.

*Anti-patterns this model exists to prevent:* persona proliferation
(specialists as chat characters instead of practices), orchestration
theatre (frameworks before verification bandwidth exists), memory
sprawl (knowledge in chats and vendor tools instead of the repo),
silent scope creep, self-approval, prompt-rot (detail in prompts
instead of procedures), derived-state drift (generated indexes treated
as truth), and big-bang documentation written once and trusted forever.
