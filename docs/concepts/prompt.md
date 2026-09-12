---
title: Prompt
summary: "The text you hand the agent, and the standing text it always carries with it"
section: concepts
nav: 20
audience: operator
---

# Prompt

## What it is

The words you give the agent for one piece of work. In [Chat](../guides/chat.md)
that is simply what you type. On the [Missions](../guides/missions.md) page it
is structured: an instruction, the context it needs, the goals, the output
format and any constraints, filled in as separate fields. PatterStage assembles
those fields into one stored prompt and that document, not your form, is what
the agent receives.

## What it is not

Not the agent's [personality](personality.md). Identity text lives with the
profile and applies to everything that profile ever does; a prompt applies to
one mission or one turn. It is also not a setting on a [model](model.md):
changing the model does not change the words, and rewriting the words does not
change the model.

## Where you meet it

In the mission composer on [Missions](../guides/missions.md), where a toggle
shows you either the human form or the exact document the agent will be sent,
and in the message box on [Chat](../guides/chat.md).

## The idea behind it

An agent begins each piece of work knowing nothing about what you meant. Writing
that intent down as an object rather than typing it fresh each time is what makes
work repeatable: a stored prompt can be edited, re-dispatched, put on a
[schedule](schedule.md), or saved as a template for the next time. The separate
fields exist for the same reason. A prompt that names its output format and its
constraints is one you can judge the answer against afterwards.
