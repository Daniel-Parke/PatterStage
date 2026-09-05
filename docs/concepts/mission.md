---
title: Mission
summary: "A stored piece of work you can dispatch, schedule and repeat"
section: concepts
nav: 140
audience: operator
---

# Mission

## What it is

One piece of work you are giving the agent, saved as a record: the
[prompt](prompt.md) fields, the [profile](profile.md) it runs under, a category,
and how it should be dispatched. You can save it as a draft, put it in the
queue, run it immediately, or attach a [schedule](schedule.md) so it repeats.

Because it is a record rather than an action, it survives the run. A mission you
saved last month can be edited and sent again, and a mission that failed is
still there to read.

## What it is not

Not a [run](run.md). The mission is the request and it is kept; a run is one
attempt at carrying it out. Not a [workflow](workflow.md) either: a mission is a
single stage with no branches, no loops and no gates. If the job needs several
stages that check each other, that is Composer's job, and missions stay
deliberately simple.

## Where you meet it

On the [Missions](../guides/missions.md) page, on a board whose columns are
drafts, queued, dispatched, completed and failed.

## The idea behind it

Cron for agents. Most of what people actually want from an agent is a small,
repeatable job: check this every morning, summarise that when it changes. Making
that job an object with a name, a category and a history means you can look at
last week's version, see whether it worked, and change one line rather than
retyping your intent into a chat box every time.
