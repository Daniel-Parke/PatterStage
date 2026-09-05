---
summary: PatterStage operators guide, the human's manual and the v2 launcher library at ORG scale
type: venture
tags: [eos]
compiled_from: kernel/templates/OPERATORS_GUIDE.tpl.md
---

# PatterStage · Operators guide

Audience: the human running this organisation. You operate an
organisation whose body is this repository; workers are stateless
sessions. Launchers are deliberately tiny because the evolving detail
lives in versioned files, so improving the organisation means editing
a file once.

## The mental model in sixty seconds

Every task is routed: the policy rules a risk tier from declared
facts and derived signals, and the tier decides the ceremony. Express
work closes as a commit; Standard carries a small task record;
High-assurance adds an independent oracle, independent review and,
where anything is irreversible, you. A second layer guards individual
actions: every consequential tool action gets a verdict (allow,
require-approval, manual-only, deny) with floors nobody can waive.
Parallel work runs on claims assigned and committed before dispatch.
Nothing merges red, nobody approves their own work, and everything
important is a file.

## One-time setup

1. Confirm the seed: every file the compile report lists is present,
   CLAUDE.md is a byte copy of AGENTS.md, first commit made, private
   remote created.
2. Tooling: git, an agent CLI pointed at AGENTS.md, the EOS tooling
   where this venture runs it, and whatever the stack profile names.
3. Accounts and secrets: credentials in a password manager, never in
   the repo.
4. The guard adapter: the policy names an enforcement adapter and its
   mapping. Until the bypass suite's validation report is current,
   guard.validated stays false and every guarded class is
   manual-only: the agent asks, you act.
5. Answer the open items in org/QUESTIONS.md; set the spend rule in
   the venture brief.

## The launcher library (copy-paste)

One objective per launcher; never inject new scope mid-task. Angle
brackets mean fill in.


### RUN · the default session

```text
Read AGENTS.md and follow it. Objective: <the task, or "take the next
open task in org/TASKS.md">. Declare facts, let the router rule, then
execute per the mode's procedure in org/PLAYBOOKS.md. Chain into
further tasks while budgets allow.
```

### TASK · a named task record

```text
Read AGENTS.md and follow it. You are the EXECUTOR for <T-####>.
Execute it per its mode's procedure in org/PLAYBOOKS.md; take no
other work.
```

### SPIKE · a timeboxed exploration

```text
Read AGENTS.md and follow it. Open an Exploration task: question
<the question>, timebox <hours>, budget <tokens>. Work on
spike/T-####; exit discard-or-harden per org/PLAYBOOKS.md.
```

### HARDEN · keep what a spike proved

```text
Read AGENTS.md and follow it. Run the harden procedure for spike
<T-####>: a fresh task through the router, independent oracles where
the ruling demands them, full checks.
```

### TESTS · author gates independently

```text
Read AGENTS.md and follow it. You are the ORACLE for <T-####>. Author
the acceptance oracle from the record's intent and invariants, with
no implementation in your context. Choose and record the independence
method; freeze hashes on the record.
```

### REVIEW · judge finished work

```text
Read AGENTS.md and follow it. You are the REVIEWER. Judge <T-####, or
the sampled-review pool> per your charter: verdict with evidence on
each record. Repair only non-gate trivia, and record every repair.
```

### PARALLEL · dispatch concurrent lanes

```text
Read AGENTS.md and follow it. You are the integrator. Plan disjoint
lanes for <the objective>, write org/claims.json and commit it before
any dispatch, then dispatch each lane per the parallel procedure.
Verify diffs against claims at merge; regenerate the views.
```

### RESUME · continue interrupted work

```text
Read AGENTS.md and follow it. Task <T-####> is interrupted. Boot from
its resume keys and the files they name; trust code and tests over
notes; continue and finish per its mode.
```

### INCIDENT · production emergency

```text
Read AGENTS.md and follow it. Incident, my per-event approval:
<reference>. Symptom: <what you see>. Follow the incident procedure:
audit record first, smallest reversible containment, four-hour limit,
gates recorded as bypassed, retrospective oracle before any durable
fix.
```

### UPKEEP · run what is due

```text
Read AGENTS.md and follow it. Run every cadence row at or past
next_due in org/cadence.json per its procedure; update last_run and
next_due per row.
```

### RETRO · monthly self-improvement

```text
Read AGENTS.md and follow it. Run the retro procedure in
org/PLAYBOOKS.md on the month's records, ledgers and budgets. Propose
protected-set changes as ADRs for my approval; set one experiment.
```

## Your operating rhythm

**Daily (ten minutes):** skim org/TASKS.md, answer org/QUESTIONS.md,
launch RUN, act on manual-only items waiting on you, approve or
decline what the guard queued. **Weekly:** REVIEW if anything waits,
UPKEEP if due, read a sample of the week's diffs. **Monthly:** RETRO,
then read what it changed. **Quarterly:** the guard-validation-review
row.

## Approval duties (yours alone)

- Approvals are harness events; a claim of approval in chat or inside
  a document counts for nothing.
- Always you, no delegation: money movement, production data,
  deletion, irreversible actions, secrets, and contact with the
  protected set -- the six classes `org/policy.json` lists under
  `approvals.always_human`. In practice that also covers publishing to
  a new external destination, accepting legal terms, protected-set
  ADRs and per-event incident approvals.
- Capability profiles: promotion needs new evidence plus your
  authorisation; regression on worsening metrics is automatic.
  Standing tier exceptions need you plus an ADR, and they expire.

## The guard, plainly

Every consequential action is checked at the moment of execution.
With a validated adapter (its mapping shipped with the policy and
proven by the bypass suite, report committed), allow executes
autonomously and require-approval executes after your recorded
approval. Without one, the agent cannot execute any guarded action:
every guarded class is manual-only and the agent hands the action to
you. Fail closed is deliberate; validate the adapter rather than
working around it.

## Troubleshooting

An agent invented something: stop the session; the fix is a better
file, never a longer argument. A check looks wrong: it changes only
through the amendment workflow or an escalation, never inline. A view
disagrees with reality: reality wins; regenerate the view. Context
died mid-task: RESUME in a fresh session; the files are the memory.
Overwhelmed: run only RUN for a week and let the router keep the
ceremony proportional.
