---
title: Toolset
summary: "A named bundle of tools, which is what you actually switch on and off"
section: concepts
nav: 100
audience: operator
---

# Toolset

## What it is

A named bundle of [tools](tool.md) that the agent exposes as one switch: a
filesystem bundle, a web bundle, and so on. A [profile](profile.md) stores a
list of toolsets rather than a list of individual tools, and that list is pushed
into the agent's configuration.

Some bundles already contain others. Where that is true the contained toolset is
shown pressed and not clickable, because enabling it separately is exactly what
the save would strip out again, and a switch that turns itself off is worse than
no switch.

## What it is not

Not a per-call permission. A toolset says what is available; the approval prompt
in [Chat](../guides/chat.md) is what stops one particular call before it runs.
Not a promise about a mission either: a mission can suggest toolsets, but those
are hints written into the prompt. What the agent may actually use comes from
the profile it runs under, and nowhere else.

## Where you meet it

On the [Tools](../guides/tools.md) page, per profile, and as the recommended
toolsets field in the mission composer on
[Missions](../guides/missions.md).

## The idea behind it

There are too many individual tools for a list of them to be a decision anyone
makes carefully. Grouping them into a handful of bundles turns "which of forty
capabilities" into "should this agent be able to touch the disk", which is a
question with an answer.
