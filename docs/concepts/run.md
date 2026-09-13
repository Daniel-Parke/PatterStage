---
title: Run
summary: "One execution of a mission, with its own status, output and token cost"
section: concepts
nav: 150
audience: operator
---

# Run

## What it is

One execution. A row is created the moment work is dispatched, handed to the
agent with an identifier that makes a repeat submission harmless, and then
polled in the background until the agent reports it finished. When it does, the
run is written with its status, its output and the tokens it used.

Everything becomes a run: a [mission](mission.md) dispatch, a chat turn in agent
mode, and each stage of a [workflow](workflow.md).

## What it is not

Not the [mission](mission.md) or workflow that asked for it. Those are the
request and they are kept; the run is the attempt, and there can be several. Not
a [session](session.md) either: the session is the context the run happened
inside. And not something your browser drives. The polling happens in a
scheduler that starts with the server, so closing the tab neither stops the work
nor loses its result.

## Where you meet it

Behind the status of every mission on [Missions](../guides/missions.md), and as
the thing a [session](../guides/sessions.md) was opened for.

## The idea behind it

Somewhere there has to be one durable record that says this exact piece of work
was started once and finished once, even across a restart, a crash or a double
click. That record is the run. It is why a schedule cannot fire the same
occurrence twice, why a mission never sits pretending to be alive after the
server came back, and it is where the token counts live that make
[spend](spend.md) a number rather than a guess.
