---
title: Gate
summary: "A stage in a workflow that waits for you, so a long chain cannot run past a decision"
section: concepts
nav: 180
audience: operator
---

# Gate

## What it is

A stage in a [workflow](workflow.md) that stops and waits for you. When a run
reaches one it goes no further until you accept it or reject it, and you can
leave a note with the decision. A stage that judges its own work can be a gate
too, and its verdict is advice: a fail is shown to you with the work rather than
ending the run, because the point of the gate is that the decision is yours.

The note is not decoration. It is recorded against the run, shown on the stage
where it was taken, and carried into the next stage the engine dispatches, so a
rejection arrives at the work being redone with your reason attached. A decision
taken with no note clears any previous one, so a stale note never follows a run
around.

## What it is not

Not the Gateway gate row on the dashboard, which is an admission limit on
requests to the agent and asks you nothing. Not the [spend](spend.md) hard stop
either: that pauses unattended work when a number is passed, and no human
decision is involved. And not a permission check on a single tool call, which is
the approval prompt you meet in [Chat](../guides/chat.md).

## Where you meet it

On the [Composer](../guides/composer.md) page, both as a property you set on a
stage when building, and as a prompt on the live board when a run reaches one.

## The idea behind it

Automation you cannot interrupt is automation you cannot trust with anything
that matters. A gate is the place where a person is deliberately put back in the
loop: before a plan is acted on, before something is published, before a change
goes out. It is written into the workflow rather than left to whoever is
watching, because the point is that it happens even when nobody is.
