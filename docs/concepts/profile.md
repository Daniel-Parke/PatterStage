---
title: Profile
summary: "A named set of behaviour files and enabled tools, so one agent can work several ways"
section: concepts
nav: 60
audience: operator
---

# Profile

## What it is

A named configuration of the agent: a short slug, a display name, the behaviour
files that tell it who it is, the [toolsets](toolset.md) it may use, the
[skills](skill.md) it is denied, and the gateway it dispatches to. Every
[mission](mission.md) and every chat turn runs under exactly one profile.

PatterStage's database holds them and pushes them out to the agent's own home
directory on disk. Pulling brings edits you made on disk back in. One profile is
the root agent, which owns the install's own identity files.

## What it is not

Not a user account. PatterStage has one operator and no accounts; a profile is a
costume for the agent, not a person. Not a [personality](personality.md) either:
the identity text is one file inside a profile, alongside its tools and its
policy.

## Where you meet it

On the [Agents](../guides/agents.md) page, which lists every profile, shows
whether each has drifted from what is on disk, and pushes or pulls one at a
time.

## The idea behind it

One agent, several jobs, and the jobs want different powers. A researcher wants
web search and no shell; a maintenance agent wants the opposite. Without
profiles, the only way to have both is two installs. With them, choosing which
agent you are asking is a field on the mission, and the answer to "why was this
one allowed to do that" is a single row you can read.
