---
summary: PatterStage work package form, the objective, contracts, ownership boundary, context packet and acceptance conditions a build lane receives
type: venture
tags: [eos]
compiled_from: kernel/templates/WORK_PACKAGE.tpl.md
---

# WP-NN · name the package

One package per file. Copy this form to `docs/packages/WP-NN.md`, once
per package, and cut every package from the product map rather than from
a conversation. The package is the only thing the session doing the work
receives, so anything missing here is missing from the work.

Until Genesis runs this file is a blank form.

## Objective

What this package is for, in two or three sentences. Say what exists at
the end that does not exist now.

## Why it matters

One line. The part of a journey this unblocks, or the risk it retires.
A package with no answer here is not worth cutting.

## Contract consumed

What this package depends on and treats as given, quoted from the product
map's contracts table. If it is not in the map, it is not given.

## Contract provided

What this package promises to everything downstream, quoted from the same
table. Other packages are written against this wording, so it changes
only by changing the map first.

## Files owned

The paths this package may create or modify, listed exactly. Ownership is
disjoint by construction: no path appears in two packages.

Hub files are reserved to the integrator and are never listed here. If
the work needs a hub file changed, describe the change and hand it to the
integrator instead of making it.

## Context packet

The exact files to read before starting, and nothing else. State the line
budget for the packet and keep to it; a packet that does not fit is a
sign the package is too big.

| file | why it is in the packet |
| --- | --- |

Budget: NN lines total.

## Tools and limits

The commands and tools this package expects to use, and anything it must
not run. Say where the boundary is rather than leaving the session to
guess it.

## Confirmed and uncertain

Two short lists. What is already decided and can be relied on, and what
is still open at the time of writing. Naming the uncertain things stops
the session from inventing an answer and calling it a decision.

## Acceptance conditions

The condition ids from the product map that this package must satisfy,
copied with their wording. Conditions come from the map, never from the
code being written, and this package does not get to reword them.

| condition id | what it says | how it is observed |
| --- | --- | --- |

## Dependencies

Other packages this one needs finished first, by id, and what each one
must have produced. Say plainly whether this package can start before
they land.

## Output format

What the finished work looks like when it is handed back: the files, the
commit shape, what runs and passes, and what the session reports.

## Definition of done

A short checklist. Every acceptance condition observed passing, the
contract provided matching the map, the ownership boundary not crossed,
and any deviation from the map written back onto the map.

## Suggested execution mode

The mode this package is expected to run in and why.

If the suggestion is to run this package alongside others, say what makes
that safe: disjoint ownership, no shared contract in flight, and no
dependency still open. Running wide is justified per package and never
assumed.
