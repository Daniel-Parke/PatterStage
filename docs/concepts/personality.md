---
title: Personality
summary: "The voice and standing instructions a profile writes into SOUL.md"
section: concepts
nav: 70
audience: operator
---

# Personality

## What it is

Who the agent is when it answers: its voice, what it cares about, what it
refuses, how much it explains. It is written as ordinary prose, stored by
PatterStage against a [profile](profile.md), and pushed to the agent as its
identity file. It applies to everything that profile does, in chat and in
missions alike.

## What it is not

Not a [prompt](prompt.md). A prompt is the words for one job and it changes
every time; identity is written once and travels with every run. Not runtime
policy either: which [skills](skill.md) are disabled, which
[toolsets](toolset.md) are on and how many turns the agent may take are
configuration, and they belong in the profile's settings rather than in the
identity text. Writing "you may not use the shell" into a personality asks
politely. Turning the toolset off is the thing that actually stops it.

## Where you meet it

On the [Agents](../guides/agents.md) page, in the Identity tab of the profile it
belongs to. It used to be its own page; folding it into the profile put the
identity beside the tools and the skills that decide what that identity can
actually do.

## The idea behind it

Tone is not a per-message decision. If you have to restate how you want to be
answered in every instruction, you will stop bothering, and the agent's output
will read differently on every screen. Writing it once, per profile, is what
makes the agent recognisably the same thing across chat, missions and workflows.
