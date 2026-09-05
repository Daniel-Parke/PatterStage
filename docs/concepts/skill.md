---
title: Skill
summary: "A written procedure the agent can follow, kept in the catalogue and enabled per profile"
section: concepts
nav: 80
audience: operator
---

# Skill

## What it is

A written instruction the agent can load when it is relevant: a procedure, a
house style, a checklist, the way you want a particular kind of job done. Each
one is a document with a name and a category. PatterStage's database holds the
catalogue and pushes it into the agent's skills directory on disk, and each
[profile](profile.md) can deny individual skills it should not read.

## What it is not

Not a [tool](tool.md). A skill is knowledge and a tool is a capability: turning
a skill off removes text the agent would have read, not power it would have
used. Not a mission template either. A template is a starting point for work
that you fill in; a skill is guidance the agent picks up on its own, without you
naming it.

## Where you meet it

On the [Skills](../guides/skills.md) page, which lists the catalogue and lets
you read, edit and toggle each one.

## The idea behind it

Everything you know about how your work should be done has to live somewhere. It
cannot go in the model, which is fixed, and pasting it into every
[prompt](prompt.md) means maintaining it in a hundred places. A skill is that
knowledge held once, in a file you can read, versioned with the rest of your
install, and loaded by the agent when the job calls for it.
