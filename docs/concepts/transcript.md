---
title: Transcript
summary: "The turns inside a session, which is what you read to find out what actually happened"
section: concepts
nav: 130
audience: operator
---

# Transcript

## What it is

Everything that was said inside one [session](session.md), in order: what you
asked, what the agent reasoned, which [tools](tool.md) it called, what those
returned, and what it eventually replied. It is the record of how an answer was
arrived at, not just the answer.

Long ones are handled honestly rather than silently. A transcript with more
messages than the page carries sends the newest and says on screen that it did,
and one whose file is larger than the size limit is refused rather than loaded
half way.

## What it is not

Not [memory](memory.md). A transcript is what happened once; memory is what was
kept for next time. Not a log either: the [Logs](../guides/logs.md) page shows
the server's own output, which is about PatterStage and the agent as programs.
The transcript is about the conversation.

## Where you meet it

Inside a session on the [Sessions](../guides/sessions.md) page.

## The idea behind it

When an agent gets something wrong, the reply almost never tells you why. The
failure is three steps earlier, in a tool that returned an error the agent then
worked around, or a file it never found. Keeping the whole thread, including the
reasoning and the tool results, is the difference between debugging the work and
guessing at it. It is also the only honest way to check that an answer you liked
was arrived at for a reason you would accept.
