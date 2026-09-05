---
title: Workflow
summary: "Several agent runs wired together, with edges that decide what happens next"
section: concepts
nav: 170
audience: operator
---

# Workflow

## What it is

A graph of stages, where each stage is an agent [run](run.md) and the stages are
joined by edges that can be conditional. A stage can pass or fail, and the edge
followed depends on which. An edge may point backwards, which is how a workflow
sends failed work back to be redone rather than giving up.

You build one on a canvas: drag stages in, connect them, and mark the ones that
should stop for a human [gate](gate.md). Running it creates a separate record,
so the shape and the execution are two different things, and one workflow can be
run many times.

## What it is not

Not a [mission](mission.md), which is a single stage with no branching. Not a
host script either: every stage here is the agent doing work, not a program on
your machine.

## Where you meet it

On the [Composer](../guides/composer.md) page, which has a build tab for the
canvas and a run tab that shows the same board lighting up as a run moves
through it.

## The idea behind it

Real work is rarely one prompt. It is draft, then review, and if the review
fails, draft again with the reason. Expressing that as a graph rather than one
enormous instruction gives you three things a single prompt cannot: each stage
is judged on its own, a failure sends work backwards instead of forwards, and
loops are bounded, so an agent that keeps failing the same check stops with a
readable error rather than running all night.
