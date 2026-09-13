---
title: Spend
summary: "What the models cost, how PatterStage estimates it, and the ceiling you can put on it"
section: concepts
nav: 200
audience: operator
---

# Spend

## What it is

What your work has cost at the model [provider](provider.md). Token counts are
recorded against each [run](run.md) as it finishes, priced against a small rate
table, and totalled for today, this week and this month, split by the kinds
of work that spend: agent runs, workflow stages, research and story writing.

It is the only thing in PatterStage that costs money. Everything else runs on
your own machine, which is why one panel can honestly claim to be the whole
bill.

## What it is not

Not an invoice. The rate table is static, it holds only the model families
PatterStage knows, and rates change anyway. Anything it does not recognise is
priced at a declared fallback, and the panel marks those figures as estimated
rather than passing a guess off as a price. Treat the number as the right order
of magnitude and your provider's own dashboard as the truth.
Not a limit either: a budget is optional, and on its own it only warns. The
switch that actually pauses work is separate, ships turned off, and pauses only
unattended dispatch. Anything a person clicks still runs, on the grounds that
someone clicking dispatch is answering for the cost themselves.

## Where you meet it

In the provider spend panel on [Insights](../guides/insights.md), which is the
only place money is reported. The full rules, including what happens when the
spend cannot be measured at all, are in [the spend reference](../reference/spend.md).

## The idea behind it

A local-first control plane has exactly one metered dependency, and the failure
worth designing against is a bill that arrives as a surprise. So the number is
on screen without being asked for, a budget is a thing you may set rather than
must, and anything that could not be measured is reported as unmeasured rather
than as free.
