---
title: Tool
summary: "One capability the agent can invoke: read a file, search the web, run a command"
section: concepts
nav: 90
audience: operator
---

# Tool

## What it is

Something the agent can do rather than say: read a file, run a command, search
the web, call an API. Tools belong to the agent runtime, which is what actually
executes them. PatterStage decides which are available to each
[profile](profile.md), stores that decision, and mirrors it into the agent's
configuration.

The agent's own toolset includes terminal access on the machine it runs on. That
is the point of it, and it is also why the token that opens this control plane
is worth treating as root on the host.

## What it is not

Not a [skill](skill.md), which is knowledge rather than capability. Not a host
script either: the [Scripts](../guides/scripts.md) page runs your own programs
on a timer with no agent involved at all, and nothing there is a tool the agent
can reach for.

## Where you meet it

On the [Tools](../guides/tools.md) page, where the toolsets available to each
profile are switched on and off, and in [Chat](../guides/chat.md), where a tool
call appears as a card in the conversation and can pause for your approval
before it runs.

## The idea behind it

An agent with a model and no tools can only produce text. The moment it can act,
the interesting question becomes which actions, and the honest answer has to be
per profile rather than per install. That is what lets one install hold an agent
allowed to touch your filesystem and another that is not, without you having to
trust a sentence in a prompt to hold the line.
