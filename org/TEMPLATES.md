---
summary: PatterStage Canonical artefact formats , front-matter contracts for orders, decisions, logs and registries
type: venture
tags: [eos]
compiled_from: kernel/templates/org/TEMPLATES.tpl.md
---

# Templates · Canonical artefact formats

Copy exactly; front-matter keys are contracts other sessions and future
automation rely on. Dates ISO (`YYYY-MM-DD`). IDs are allocated by
taking the next number in the relevant directory or file; check before
writing.

## Queue item (a row of `org/QUEUE.md`)

```markdown
### WO-#### · <title>
- type: FEAT|FIX|REFACTOR|PERF|MAINT|HARDEN|COMPLY|RESEARCH|DOCS|OPS|SPIKE
  · tier: T1|T2|T3 · priority: P0|P1|P2|P3 · status: ready|in_progress|
  in_verification|blocked
- acceptance: [ ] checkable criteria, one box each
- done when: <the observable finish line, including the gates>
```

Queue sections: Ready (ordered), Blocked, Done (id, session, date).
Done rows may be pruned a quarter after completion; git keeps history.


## Decision · `org/decisions/ADR-####-<slug>.md`

```markdown
---
id: ADR-0000
title:
status: proposed|accepted|superseded
supersedes: null
superseded_by: null
created:
approved_by: null     # the human, for protected-set changes
review_by:
---
## Context
## Decision
## Alternatives considered
Each with the reason it lost.
## Consequences and trade-offs accepted
## Anti-patterns this guards against
```


## Session log · `org/logs/YYYY-MM/S-####-<role>.md`

```markdown
---
id: S-0000
role: PLAN|WORK|VERIFY|HUMAN
date:
model:
launcher:
items_touched: []
commits: []           # short hashes
spend_estimate:
---
## What happened
5 to 15 lines, past tense, facts.
## Decisions taken (within my authority)
## Filed
Questions, suggestions and orders created.
## Handoff
Exact next action if anything is unfinished.
```

