---
summary: PatterStage Venture operators guide , the human's manual, launcher library per scale
type: venture
tags: [eos]
compiled_from: kernel/templates/OPERATORS_GUIDE.tpl.md
---

# PatterStage · Operators guide

Audience: the human running this organisation. You are not managing
prompts. You are operating an organisation whose body is this
repository. AI workers are stateless sessions; your launchers below are
deliberately tiny, because all evolving detail lives in versioned
files, so improving the organisation means editing a file once, not
re-teaching forty prompts.

## The mental model in sixty seconds

Work enters through four doors (you, cadences, failures, suggestions)
as typed work orders with a risk tier. Tiers decide gates: automated
checks, then independent VERIFY review, then your approval where the
ladder demands it. Knowledge climbs a ladder from research to guidance
to standard to automated check, so the organisation gets smarter and
cheaper to run every month. Cadences are the heartbeat. Nothing merges
red; nobody approves their own work; everything important is a file.

## One-time setup

1. Confirm the seed: every file the compile report lists is in place,
   `CLAUDE.md` is a byte copy of `AGENTS.md`, the repo has
   `* text=auto eol=lf` in `.gitattributes`, first commit made, private
   remote created.
2. Tooling: git, an agent CLI pointed at `AGENTS.md`, and whatever the
   stack profile in the lock-book names.
3. Accounts and secrets: per the stack profile, credentials in a
   password manager, never in the repo.
4. Answer the open items in `org/QUESTIONS.md`; record the agreed spend
   budget in `org/STATE.md`.
5. Run the Genesis launcher below, once. The organisation takes it from
   there.

## The launcher library (copy-paste)

One role per session, one objective per launcher, never inject new
scope mid-task; new ideas become suggestions or queue items. Run each
from the repo root in a fresh session. Angle brackets mean fill in.


### GENESIS-LITE · session 1, once (PLAN)

```text
Read AGENTS.md and bootstrap per org/START.md. You are a PLAN session.
From the venture brief and the lock-book, produce: the domain model and
architecture sketch the scale warrants, ADRs for every judgement call,
and a complete ordered queue in org/QUEUE.md, foundation items first.
Decide, record, flag: open calls become ADRs or questions. Do not write
production code. Close out per START.
```

### PLAN · design, spec, answer, re-plan

```text
Read AGENTS.md and bootstrap per org/START.md. You are a PLAN session.
Objective: <e.g. "spec the next milestone", "fold answered questions",
"reorder the queue for the deadline">. Produce or update the specs,
ADRs and queue items so WORK can execute and VERIFY can judge with zero
questions. Close out per START.
```

### WORK · the daily default

```text
Read AGENTS.md and bootstrap per org/START.md. You are a WORK session.
Take the top unblocked item in org/QUEUE.md (or continue what STATE.md
names). Follow your charter: short-lived branch, failing tests first
where required, small commits, gates for the tier. Chain into further
items as long as you can. If blocked, file a question or suggestion and
move on. Close out per START.
```

### VERIFY · clear the review queue

```text
Read AGENTS.md and bootstrap per org/START.md. You are a VERIFY
session. Review every item in verification (oldest first) per your
charter: verdict, evidence, merge or return each one. You may not fix
findings yourself. Close out per START.
```

### CADENCE · run whatever is due

```text
Read AGENTS.md and bootstrap per org/START.md. Read org/CADENCE.md and
execute every cadence at or past next_due, in table order, adopting the
role each row names. Update last_run and next_due per row. Close out
per START.
```

### WRAP · end any session cleanly

```text
Wrap up now per org/START.md close-out: bank progress (commit or wip on
the branch, never broken work to main), update org/STATE.md with exact
next actions and the Resume Packet, write your session log, file open
questions and suggestions. Leave the repo resumable by a stranger.
```


## Your operating rhythm

**Daily (ten minutes):** skim `org/STATE.md`, answer `org/QUESTIONS.md`,
launch WORK, approve what waits on you. **Weekly:** the triage part of
CADENCE, and the stakeholder update if one is due. **Monthly:** the
retrospective row of CADENCE; read what it changed.

## Troubleshooting

An agent invented something: stop the session, revert the branch if
needed; the fix is always a better file (spec, standard, ruling), never
a longer argument. Main is red: nothing else merges until it is fixed.
A test looks wrong: it changes only via a ruled decision, never inline.
STATE disagrees with reality: reality wins; fix the file and note it in
the log. Context died mid-task: resume in a fresh session; the files
are the memory. Overwhelmed: lower WIP to one and run only the default
launcher for a week; the files will keep the organisation honest while
you breathe.

## Onboarding a human newcomer

Read: this guide, then the lock-book, then the venture brief, then the
current state file. Then shadow one working session end to end. They
now know more about this organisation than most employees ever learn
about theirs, because it is all written down.
