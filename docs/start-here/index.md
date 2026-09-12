---
title: What PatterStage is
summary: "A control plane for one AI agent on your own machine: what it does, what it needs, and what it is not"
section: start-here
nav: 10
audience: operator
concepts: [agent]
---

# What PatterStage is

PatterStage is a web control plane for an AI agent that runs on your own
machine. The agent is [Hermes](https://hermes-agent.nousresearch.com/docs/getting-started/installation),
installed separately; PatterStage is the screen you steer it from. You give it
work, it hands that work to the agent, and it keeps the record: what ran, when,
what the agent said, what it produced, and what it cost.

It is built for one person running one install. There are no accounts, no
tenants and no service in the middle. The database is a SQLite file in your home
directory, the agent is a process on the same box, and the only thing that
leaves the machine is the call to whichever model provider you configured.

## What you can do with it

- **Give the agent a job.** A [mission](../concepts/mission.md) is one piece of
  work with an instruction, some context and a shape for the answer. Send it
  now, queue it, or attach a [schedule](../concepts/schedule.md) and let it
  repeat. See [Missions](../guides/missions.md).
- **Talk to it.** [Chat](../guides/chat.md) is the same agent with the same
  tools, one turn at a time, with its reasoning and tool calls visible as they
  happen.
- **Chain several steps together.** [Composer](../guides/composer.md) runs a
  graph of stages where each stage is an agent run, edges can loop backwards,
  and chosen stages stop and wait for your decision at a
  [gate](../concepts/gate.md).
- **Read what happened.** Every run leaves a
  [transcript](../concepts/transcript.md) in
  [Sessions](../guides/sessions.md), and a completed mission's output is kept as
  an [artifact](../concepts/artifact.md) in
  [Artifacts](../guides/artifacts.md).
- **Shape the agent.** [Profiles](../concepts/profile.md), the
  [skills](../concepts/skill.md) it can load, the [tools](../concepts/tool.md)
  it may use, the [models](../concepts/model.md) it calls, and its long-term
  [memory](../concepts/memory.md) are all editable from the
  [Agent](../guides/agents.md) section.
- **Run things on the host.** [Scripts](../guides/scripts.md) puts your own
  shell or Node scripts on a timer, with no agent involved at all.

## What it is not

It is not the agent. PatterStage on its own can boot, show you its screens and
tell you what is missing, but nothing will run until Hermes is installed or a
gateway is reachable. It is not a hosted product, so nobody else can see your
data and nobody else is keeping a backup. And it is not a model: the model is
something you choose and pay a provider for.

## What it costs

The only thing that costs money is the provider call. PatterStage totals what
your runs spent for today, this week and this month on the
[Insights](../guides/insights.md) page. A budget is optional and only warns; the
switch that actually pauses unattended work ships turned off. The full rules are
in [spend](../reference/spend.md).

## Where to go next

1. [Installing](install.md), which covers Linux, macOS and Windows under WSL2.
2. [The first hour](first-hour.md): boot, sign in, check the subsystems, and get
   one mission all the way through to its transcript and its artifact.
3. [Concepts](../concepts/agent.md), when a screen uses a word you have not met.
4. [Getting help](getting-help.md) when something is wrong.
