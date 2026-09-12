---
summary: PatterStage product map, the domain model, contracts, dependency graph and per-journey acceptance conditions Genesis fills
type: venture
tags: [eos]
compiled_from: kernel/templates/PRODUCT_MAP.tpl.md
---

# PatterStage · Product map

The whole shape of the thing, written before any lane starts building.
Filled in the venture repo during the Genesis phase, by one session, from
the venture brief and the lock-book. Work packages are cut from this file
and acceptance conditions are written from it, so a section that is wrong
here is wrong everywhere downstream.

Until Genesis runs this file is a blank form and every section is draft.
That is a legitimate state, not a defect.

## Reading the markers

Every section heading below ends in one of three words.

- **draft**: still being worked out, may change without notice.
- **settled**: agreed. Changing it costs a decision and a note on every
  work package that cites it.
- **stale**: the build has moved past it. Fix it or delete it before the
  next package is cut.

A lane that finds reality disagreeing with a settled section flips that
section to draft and records the disagreement on its package.

## Domain model · draft

The nouns this venture is about, in the operator's own language. Per
noun: what it means, what it must not be confused with, and the rules
that hold true about it whatever the code does.

## Components · draft

| component | what it is responsible for | when it is the wrong home |
| --- | --- | --- |

## Containers · draft

The deployable units. One row per thing that gets started, shipped or
scheduled on its own.

| container | runtime | components inside | boundary it crosses |
| --- | --- | --- | --- |

## Contracts · draft

What each component promises and what it needs from others. This is the
table work packages consume, so write every row in terms a lane can build
against without reading another lane's code.

| component | provides | consumes | shape (schema, type, endpoint) |
| --- | --- | --- | --- |

## Dependency graph · draft

Which component needs which. Name cycles rather than hiding them, and
state the order a build would take if it ran one thing at a time.

Name the hub files as well: the files many components touch. Hub files
are reserved to the integrator and never appear inside a lane's ownership
boundary.

## Integration points · draft

Everything outside the venture's own code: services, data feeds,
payments, auth, storage, anything with an account behind it.

| integration | trusted for | behaviour when it is down | where credentials live |
| --- | --- | --- | --- |

## Journeys and acceptance conditions · draft

One block per user journey. The walk-through in plain steps, then the
conditions that decide whether it works. A condition is observable from
outside: an input, an action, a result someone can see. The acceptance
spine is written from these conditions and from nothing else, so a
condition phrased as an implementation detail has to be rewritten.

### J1 · name the journey

- Walk-through, one line per step:
- Acceptance conditions, one id each:
  - A1.1
- Out of scope for this journey:

## Risks · draft

| risk | what it costs if real | earliest signal | who watches |
| --- | --- | --- | --- |

## Cross-cutting decisions · draft

Decisions that touch more than one component and are settled here, before
lanes diverge: identity, error shape, time and timezone, money and
rounding, id format, logging, versioning. Every row names where the
decision is recorded, so a lane can read the reasoning and not just the
outcome.

| decision | ruling | recorded in |
| --- | --- | --- |
|  |  | org/decisions/ADR-NNNN |

## Open decisions · draft

Still open. Each carries an owner and the date it starts blocking work.
An open decision with nobody's name against it is a risk, so move it into
the risk table instead.

| question | owner | what it blocks | needed by |
| --- | --- | --- | --- |
