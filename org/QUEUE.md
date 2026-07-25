---
summary: PatterStage M-scale queue , the single work file, rows per the templates contract
type: venture
tags: [eos]
compiled_from: kernel/templates/org/QUEUE.tpl.md
---

# QUEUE

The organisation's work, ordered. A session takes the top unblocked
item whose status is ready, sets it in progress with its session id,
and moves it to Done at close. WIP is 1. Row shape per
`org/TEMPLATES.md`; every row names its type, tier, priority, status,
acceptance checks and done-when. Operator-independent work rides above
anything waiting on an answer.

## Ready

### WO-0001 · Run Genesis-lite
- type: DOCS · tier: T2 · priority: P1 · status: ready
- acceptance: [ ] domain model and architecture sketch written ·
  [ ] ADRs for every judgement call · [ ] this queue rebuilt, ordered,
  foundation items first
- done when: the GENESIS-LITE launcher's outputs are complete and a
  cold WORK session can take the new top item with zero questions.

## Blocked

- (none)

## Done

- (none)
