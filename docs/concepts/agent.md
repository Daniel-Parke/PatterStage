---
title: Agent
summary: "The thing that does the work: a program that reads a goal, decides on steps, and uses tools to take them"
section: concepts
nav: 10
audience: operator
---

# Agent

## What it is

An agent is a program that takes an instruction written in ordinary words,
decides what to do about it, uses tools to do it, and reports back. It runs in a
loop: think, act, look at the result, think again, until the work is done or it
gives up.

PatterStage does not contain one. The agent here is Hermes, installed separately
on the same machine, and PatterStage talks to it over HTTP through a single
adapter. Everything you dispatch ends up as a request to that agent.

## What it is not

Not a [model](model.md). A model answers one question at a time and forgets;
an agent calls a model repeatedly, keeps the thread, and can act between the
calls. Not a [profile](profile.md) either: one install has many profiles and
still only one agent behind them.

## Where you meet it

On the [Agents](../guides/agents.md) page, where its profiles are configured,
and on the [dashboard](../guides/dashboard.md), whose Subsystems panel says
whether the agent is reachable and, when it is not, why.

## The idea behind it

The noun exists to separate the thing that does the work from the thing you
steer it with. PatterStage owns the database, the timer and the history; the
agent owns the loop. That seam is why the agent can be swapped, or run on a
different machine entirely, without any of your missions, schedules or
transcripts moving. It is also why an install with no agent shows you a
checklist rather than an error: nothing is broken, the other half is simply not
there yet.
