---
title: Automation
summary: "Everything on a timer, in one list: which missions and scripts run next, when they last ran, and how that went"
section: guides
nav: 55
audience: operator
screen: /work/automation
concepts: [schedule]
type: guide
tags: [product, ops]
shots: [docs/images/automation.png]
---

# Automation

One list of everything PatterStage will run without being asked. A mission on a
timer and a host script on a timer are the same kind of promise: something
happens at a time you chose, whether or not you are watching. So they share one
page, one set of columns, and one answer to "what runs tonight".

They used to be in two places. The schedules section at the foot of
[Missions](missions.md) listed PatterStage's own table, which holds recurring
missions and scripts alike, so it looked complete. It was not: a script put on
the **host's** crontab lives only in that crontab, so it showed on
[Scripts](scripts.md) and nowhere else. Answering one question meant reading two
screens and knowing in advance which kind lived where.

## What you see

A header with the count of what is active and what is paused, a **Schedule a
mission** button that opens the form, and the list.

Each row carries six things:

| Column | What it says |
| --- | --- |
| Kind | **Mission** or **Script**: what this row fires |
| Name | The [schedule](../concepts/schedule.md)'s own name, or its clock if it has none |
| Owner | **PatterStage** or **Host**: which scheduler holds it |
| Clock | The cron expression, or the `every 30m` shorthand |
| Next | When it fires next, or `paused` |
| Last | When it last ran, how it ended, and a link to that run's log |

**Owner** is not decoration. A PatterStage row can be paused, run on demand and
deleted from here, because PatterStage owns the timer. A host row is an entry in
the machine's own crontab: PatterStage reports it and will not edit someone
else's crontab from a list, so that row says *manage on Scripts*, where the file
it belongs to is.

**Last** is a time, an outcome and a link, because a status on its own is a claim
you cannot check. A row that has never fired says `never run` rather than showing
an outcome from nothing.

## Typical use

### Put a saved mission on a timer

**Schedule a mission**, pick the mission, give it a name you will recognise in a
list, and set the clock: a cron expression, or the `every 30m` shorthand. The
presets cover the common ones. Choose a catch-up policy, and create it.

### Schedule something new

A mission you are writing now goes on a clock from the composer's **Schedule**
dispatch mode, in the same pass. A script goes on one from its row on
[Scripts](scripts.md), which is where the file is. Both then appear here.

### Check what happened overnight

Read down the **Last** column. Each row says when it ran and how it ended, and
links to that run's log, so a failure is one click from its output rather than a
word you have to go and corroborate.

### Pause something without deleting it

**Pause** on a PatterStage row stops it firing and keeps everything else: the
clock, the name, the history. It reads `paused` in the **Next** column until you
resume it. A host row has no pause: a crontab entry is there or it is not, so
that one is unscheduled from Scripts.

## Notes

- **Catch-up** decides what happens to a firing that was missed because
  PatterStage was not running. **Fire once** runs it now, once, however many
  were missed. That is the default, because a nightly digest you did not get is
  usually still wanted. **Skip** treats the missed firings as gone, which is
  right for anything whose value was the timing rather than the work.
- **Next run** is blank for a host row. The host's crontab decides when that
  fires and does not tell PatterStage in advance, so the page says so rather
  than guessing.
- **A row that names nothing it can find**, a mission that was deleted for
  instance, is shown in orange rather than hidden, so you can see it and
  delete it. A schedule that cannot fire is worth knowing about.
- Dispatching a mission by hand is on [Missions](missions.md); writing and
  running a script by hand is on [Scripts](scripts.md). This page is only the
  clocks.
