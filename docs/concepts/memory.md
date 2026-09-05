---
title: Memory
summary: "What the agent remembers between runs, and the separate service that holds it"
section: concepts
nav: 110
audience: operator
---

# Memory

## What it is

What the agent keeps between conversations. The supported provider is Hindsight,
a separate server that stores facts the agent learned, directives you gave it,
and the mental models it has built, and answers questions about them by meaning
rather than by keyword. PatterStage talks to it over HTTP and browses it for
you.

The connection details live in PatterStage's own database, not in a
configuration file, so pointing the agent at a different memory server is an
edit on a page rather than a file you have to find.

## What it is not

Not a [transcript](transcript.md). A transcript is everything that was said in
one [session](session.md); memory is the much smaller set of things that were
worth keeping and can resurface in a session that has not happened yet. Not
required either: the agent runs perfectly well without one, which is why the
dashboard reports an absent memory provider as degraded rather than down.

## Where you meet it

On the [Memory](../guides/memory.md) page, which lists what is stored, lets you
retain a new fact by hand, and carries the provider panel that points at the
server.

## The idea behind it

An agent whose knowledge ends when the conversation does starts every task as a
stranger. You end up repeating your own context, forever. Keeping memory in its
own store, outside both the transcript and the model, is what lets the agent
grow into your particular install, and it is why the store is something you can
read, edit and delete from rather than an opaque part of the agent.
