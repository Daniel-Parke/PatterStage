---
title: Artifact
summary: "A deliverable the agent produced, collected in one place to read and download"
section: concepts
nav: 190
audience: operator
---

# Artifact

## What it is

Something a [run](run.md) produced, kept in its own registry so it outlives the
conversation it came out of. Each one records a name, a description, what kind
of work made it, the run it came from, and the content itself.

They arrive from several places. A [mission](mission.md) that completes with
output has that output captured automatically. A Deep Research run saves its
report. A [workflow](workflow.md) stage saves what it produced, and you can save
one by hand.

## What it is not

Not a file on your disk. Artifacts are stored as text inside PatterStage's
database, which is why they are covered by a database backup and why the
registry can show them all in one list. Not a [transcript](transcript.md)
either: the transcript is the whole conversation, and the artifact is the part
of it that was worth keeping.

## Where you meet it

On the [Artifacts](../guides/artifacts.md) page, which lists every one with its
source, and from the stage or run that produced it.

## The idea behind it

The output of an agent run is usually buried at the bottom of a long transcript,
in a session you will not remember the name of. If the thing you actually wanted
has no home of its own, the work quietly stops being reusable. Giving the
deliverable its own record, with a link back to the run that made it, is what
turns a pile of finished runs into something you can go back to.
