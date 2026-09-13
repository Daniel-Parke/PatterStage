---
title: Schedule
summary: "A mission or script on a timer, and who is holding the clock"
section: concepts
nav: 160
audience: operator
---

# Schedule

## What it is

A record that says when something should happen again: the recurrence itself,
the next time it is due, what to do about occurrences that were missed while the
machine was off, and how many times to repeat. There are two kinds, a recurring
[mission](mission.md) and a [script](../guides/scripts.md) on a timer.

PatterStage owns the timer. It runs inside the server process and recomputes
what is due from the stored next-run time rather than from a timer held in
memory, so a restart neither loses an occurrence nor fires one twice.

## What it is not

Not your machine's crontab. Host scripts on Linux and macOS are installed as
real crontab lines and fire whether PatterStage is running or not, which is the
whole reason to use them. A PatterStage schedule only fires while PatterStage is
up. Where a host scheduler is not available the Scripts page writes a
PatterStage schedule instead and tells you which of the two it wrote, so the
weaker guarantee is met before it is relied on.

## Where you meet it

In the schedules section of [Missions](../guides/missions.md), and on the
[Scripts](../guides/scripts.md) page for host scripts.

## The idea behind it

Unattended work is the point of an agent, and unattended work needs an owner for
the clock. Keeping the clock here rather than in the agent means the schedule,
the [run](run.md) it produced and the transcript that came out of it are all one
chain of records. It is also why the [spend](spend.md) hard stop can pause
schedules without cancelling them: they are rows, not fired timers, and a paused
one simply fires on the next tick after the ceiling is raised.
