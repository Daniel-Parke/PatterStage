---
summary: PatterStage acceptance spine, the journey walk-through as a suite skeleton that starts failing and goes green journey by journey
type: venture
tags: [eos]
compiled_from: kernel/templates/ACCEPTANCE_SPINE.tpl.md
---

# PatterStage · Acceptance spine

The journey walk-through from the product map, written as an executable
suite before the build starts. Every check fails on day one. The build
turns them green one journey at a time, and the count of green journeys
is what progress means here.

The spine is written from the product map and its acceptance conditions,
never from implementation code, and never by the session that will write
that implementation. That is the whole point of it: checks written from
the code they judge caught 14 per cent of faults where independently
written ones caught 25 per cent (EV-0007).

Until Genesis runs this file is a blank form.

## Where the suite lives

This file is the manifest and the rules. The executable checks live where
the stack profile puts tests. Name the path here once and keep the two in
step.

- Suite path:
- Command that runs it:

## The expected-fail marking

Every check in the spine starts marked expected-fail, in a way a machine
can see. The marker has to do two things: make an unbuilt condition fail
the suite loudly rather than skip quietly, and be findable by a plain
text search so a checker can count what is still outstanding.

- Marker used, named by the stack profile:
- How a checker finds it:

A skip is not an expected-fail. A skipped check reports as passing and
that is how a spine stops meaning anything.

## The manifest

One row per acceptance condition in the product map. A condition with no
row is a gap; a row with no condition is invention.

| journey | condition id | check id | state | package |
| --- | --- | --- | --- | --- |
| J1 | A1.1 |  | expected-fail | WP-NN |

State is `expected-fail` or `green`. Nothing else.

## Going green

A journey goes green when every condition under it is green at once.
Flip the rows, note the date below, and move on.

| journey | went green | by package |
| --- | --- | --- |

A journey that goes green and later goes red is a regression, and it is
fixed rather than re-planned. A condition that turns out to be wrong goes
back to the product map first: the map changes, then the spine, then the
code.

## The floor

- A spine check is never weakened, skipped or deleted to make the suite
  pass. A check believed wrong is raised as a question, with the
  reasoning on record.
- A condition that cannot be written as an observable check goes back to
  the map to be rewritten. It does not get dropped quietly.

## Independence record

- Authored by:
- Held the implementation in context at the time: no
- Reviewed by:

The author of the spine must not be the session holding the
implementation. Where that cannot be arranged, record who did what here
and treat the spine as unverified until an independent session reviews
it.

## Before it blocks

A spine that gates a merge is checked for strength before it is trusted:
run mutation testing over the modules it covers and record the score.
A suite that survives its own mutants is not yet an oracle.

- Mutation run, date and score:
