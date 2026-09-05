---
title: Session
summary: "One conversation with the agent, however it was started"
section: concepts
nav: 120
audience: operator
---

# Session

## What it is

One continuous piece of agent work with its own thread of context. A mission
dispatch opens one, a chat conversation is one, and so are a command-line
conversation, a scheduled run and a call made through the API. The row records
where it came from, which [profile](profile.md) it ran under, when it started
and ended, and whether it is still live.

PatterStage registers the session at the moment it dispatches, and closes it
when the work reaches a terminal state, so the two never drift apart for long.

## What it is not

Not a login session. There are no accounts here; nothing about this is about
who you are. Not a [run](run.md) either: a run is one execution, and a chat
session can contain dozens of them. And it is not the
[transcript](transcript.md), which is the content inside it.

## Where you meet it

On the [Sessions](../guides/sessions.md) page, which lists them all and can
group them under the mission that started them.

## The idea behind it

Work needs a container, or you are left with a pile of individual model calls
and no way to ask what the agent was doing at three in the morning. A session is
that container: it carries the continuity the agent needs to remember the last
turn, and it gives you one thing to open when you want to know what happened
rather than what was concluded.
