---
title: Model
summary: "The language model that does the reasoning, and why PatterStage keeps a registry of them"
section: concepts
nav: 30
audience: operator
---

# Model

## What it is

The large language model the agent actually calls. PatterStage keeps a registry
of them: each entry has a name you chose, its [provider](provider.md), the
provider's own model identifier, optionally a base URL and a context length, and
the [API key](api-key.md) to use. That registry is the source of truth for what
this install may run on, and it is mirrored into the agent's configuration.

Entries can be marked as the default for a particular job: the agent itself,
summarising, vision, title generation and so on.

## What it is not

Not the [provider](provider.md), which is the service serving it, and not the
[agent](agent.md), which is the loop around it. It is also not carried on a
mission: a mission records which model it expected for reporting, but the run is
submitted without one, and the profile's own configuration decides what answers.

## Where you meet it

The [Models](../guides/models.md) page, which is also where an install with no
model at all is fixed. Nothing dispatches successfully until one is configured.

## The idea behind it

Models change every few months, cost different amounts, and some of them run on
your own hardware for nothing. Naming the model as its own object, separate from
the work, means switching to a cheaper or a local one is a row you edit rather
than a rewrite of every mission you have ever saved. It is also where token
usage gets its price, which is how [spend](spend.md) is estimated at all.
