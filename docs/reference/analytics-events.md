---
title: Analytics events
summary: The local ledger PatterStage keeps of what you have done with it, the rule every event follows, every event type it can hold, and how long a row is kept
section: reference
nav: 35
audience: operator
type: reference
tags: [product, analytics]
---
# Analytics events

PatterStage keeps one ledger of what you have done with it: a row per action, in
the `analytics_events` table of the same SQLite database that holds your
missions. This page is all of it. What the ledger is for, the rule every row
obeys, every type of row it can hold, what a row points at, and how long it
lasts.

## What it is for

Three things read it, and nothing else does.

- **[Insights](../guides/insights.md)** charts it: the interactions tile, the
  activity by category, the hour of day clock, the mission success trend and the
  active days tile are all counts over this table. The daily streak reads it
  too, but it is the one that also counts a day on which a run finished, so it
  would survive a prune of this table in part.
- **[Achievements](achievements.md)** are derived from it on every read. Nothing
  about a badge is stored for the sake of showing it, so what you see cannot
  drift out of step with what you did.
- **[Quests](quests.md)** are ticked by it. A quest completes because the ledger
  holds the event, not because you said so.

## It stays on your machine

The rows live in `$PS_DATA_DIR/patterstage.db`, beside everything else
PatterStage owns, and they go into a [backup](../running/backup.md) with the
rest of it. Nothing is sent anywhere: there is no analytics service, no
telemetry and no export. The rows leave the database only to answer a read from
your own console.

Writing one is server-side only. `GET /api/analytics` and its two neighbours
read; there is deliberately no route that accepts an event from a browser,
because a browser that could write this table could forge its own achievements
and quest progress.

## The rule every event follows

**An event is recorded only after the write it describes has succeeded, and only
from the path that did the writing.**

That is what makes the ledger a record of what happened rather than of what was
attempted. A mission dispatch is recorded after the run row exists and the
mission has been moved to dispatched, never before the backend accepted it. A
research run is recorded finished after the terminal row is written, so a write
that throws leaves no event claiming an outcome the table does not hold. A
schedule records a firing only when the dispatch came back ok. A backup is
recorded after the file exists. A script run carries how it went and the exit
code it actually returned, whether you started it yourself or the scheduler
did.

A script that never started is the one place where "after the write succeeded"
needs saying carefully. Nothing ran, so nothing is recorded as a run: a machine
that has no interpreter for that kind of file, or an interpreter that would not
start, is recorded as `script.run_not_started` instead, with the reason. That
keeps `script.run` an honest count of scripts that did run, which matters
because a quest is proved by it.

Recording is best effort and never interferes with the action it describes.
Nothing is written while the console is in read-only mode, and a failed insert
is logged and swallowed rather than raised into the path that was doing the
real work. A missing event is possible. A false one is not.

### The two reads, and why they are recorded on the server

Two types describe a read rather than a write, and they are an exception rather
than a new pattern.

| Type | Recorded when |
|---|---|
| `artifact.opened` | The Artifacts sheet asked for one artifact and its content came back |
| `logs.opened` | The Logs page asked for a log file and its lines came back |

Two quest steps ask you to read your own output, and "did you read it" has no
other honest proof. Every other proof in the product is a write, and swapping
those two steps for writes would have meant asking for something the steps did
not mean.

Both are recorded **after** the lookup that could fail, so a missing artifact or
a rejected file name leaves no trace: a 404 is not somebody reading their own
work. Both are emitted on the server, from the same request the screen already
makes, and not from the browser. A browser that could write these two rows could
also write the quest progress that reads them, which is the whole reason the
ledger has no write route.

One further type describes something rendered rather than written:
`help.opened`, recorded when the Help page has found the guide you asked for and
is about to render it. It follows the same rule, on the server, after the page
is known to exist.

## What a row holds

| Column | What it holds |
|---|---|
| `id` | A generated identifier for the row |
| `event_type` | One of the types in the table below |
| `entity_type` | The kind of thing the event is about, or empty |
| `entity_id` | Which one, or empty |
| `profile` | The agent profile the action ran under, where the action had one |
| `metadata_json` | A small payload: a flag, a count, an exit code, a chapter number, a provider name |
| `created_at` | When it happened, in UTC, set by the database |

No content is copied into a row. Not a prompt, not a reply, not a chapter, not a
report, not a log line and not a key. The payload is flags and identifiers, and
the identifier is the id of a row in your own database, or the name of a file or
a section on your own machine: a script, a backup, a log, a configuration
section, a guide.

## Every event type

Forty-three types, listed in the order the Insights chart stacks their
categories.

| Type | What it records | Category |
|---|---|---|
| `mission.dispatched` | A mission was sent to the agent and its run row was written | Missions |
| `mission.completed` | A dispatched run was found finished, successfully | Missions |
| `mission.failed` | A dispatched run was found finished, unsuccessfully | Missions |
| `mission.cancelled` | You cancelled a mission, and the local record was finalised | Missions |
| `template.saved` | A mission template was created or updated | Missions |
| `composer.run_started` | A workflow run row was written | Workflows |
| `composer.run_completed` | A workflow run reached the end of its graph | Workflows |
| `composer.run_failed` | A workflow run ended badly, or a gate was rejected (the payload says which) | Workflows |
| `composer.gate_approved` | You approved a gate and the run moved on | Workflows |
| `composer.workflow_saved` | A workflow was created or replaced | Workflows |
| `artifact.saved` | You saved a workflow stage's output to the registry by hand. The ones the product captures for you, mission output and research reports, are not recorded here | Workflows |
| `artifact.opened` | An artifact was read back, with its content | Workflows |
| `story.created` | A story was started in the Rec Room | Stories |
| `story.chapter_generated` | A chapter was written and saved onto the story | Stories |
| `story.completed` | A saved chapter left none outstanding, so the story is finished | Stories |
| `research.started` | A research run was created | Research |
| `research.completed` | A research run finished and its report was written | Research |
| `research.failed` | A research run ended badly. Either it threw and wrote no report, or every search failed and the report it did write is flagged as ungrounded (the payload says which) | Research |
| `research.cancelled` | You stopped a research run that was still in flight | Research |
| `session.started` | A session was opened for a dispatched mission | Sessions |
| `session.closed` | That session was closed when its run reached a terminal state | Sessions |
| `schedule.created` | A schedule was saved | Automation |
| `schedule.fired` | A schedule came due and its dispatch succeeded | Automation |
| `script.saved` | A host script file was created or replaced | Automation |
| `script.run` | A host script ran, by your hand or on its timer. The payload carries how it went and the exit code it returned | Automation |
| `script.run_not_started` | A host script could not be started at all: nothing on the machine runs that kind of file, or the interpreter would not start. Nothing ran, so this is not recorded as a run | Automation |
| `script.scheduled` | A script was given a system cron entry | Automation |
| `logs.opened` | A log file's lines were handed back to the Logs page | Automation |
| `skill.toggled` | A skill was enabled or disabled for a profile | Config |
| `personality.changed` | A profile's personality was saved and pushed to the agent | Config |
| `model.configured` | A default model was set for one task type | Config |
| `model.added` | A model was added to the registry | Config |
| `credential.added` | An API key credential was stored | Config |
| `profile.created` | An agent profile was created | Config |
| `profile.pushed` | A profile, or all of them, was pushed to the agent on disk | Config |
| `profile.pulled` | A profile, or all of them, was pulled from disk into the database | Config |
| `toolset.saved` | A profile's toolsets were saved | Config |
| `config.saved` | One section of the agent's configuration was written | Config |
| `memory.configured` | The memory provider was configured | Config |
| `memory.retained` | A fact was written into a memory bank | Config |
| `backup.taken` | A database backup file was written | Config |
| `chat.message_sent` | A chat turn was sent | Chat |
| `help.opened` | The Help page rendered a guide | Help |

The nine categories are the ones the Insights charts colour and label: Missions,
Workflows, Stories, Research, Sessions, Automation, Config, Chat and Help. The
Composer is folded into Workflows with the artifacts it produces, and the two
reads are categorised where the thing being read lives.

### Which types count toward Completionist

The Completionist achievement asks you to trigger every event type, and it is
measured against a curated list rather than against the whole taxonomy. The
four failures are outside it, because a failure is recorded and charted but is
never something to collect. So is `research.cancelled`: the list still treats it
as a type nothing records, which stopped being true when the cancel button began
recording one. Cancelling a research run is charted like any other event; it is
not one of the types this achievement asks for.

<!-- generated:event-types -->
| Event type | Counts toward Completionist |
|---|---|
| `mission.dispatched` | yes |
| `mission.completed` | yes |
| `mission.failed` | no |
| `story.created` | yes |
| `story.chapter_generated` | yes |
| `story.completed` | yes |
| `session.started` | yes |
| `session.closed` | yes |
| `skill.toggled` | yes |
| `personality.changed` | yes |
| `schedule.created` | yes |
| `schedule.fired` | yes |
| `chat.message_sent` | yes |
| `model.configured` | yes |
| `research.started` | yes |
| `research.completed` | yes |
| `research.failed` | no |
| `research.cancelled` | no |
| `composer.run_started` | yes |
| `composer.run_completed` | yes |
| `composer.run_failed` | no |
| `composer.gate_approved` | yes |
| `composer.workflow_saved` | yes |
| `profile.created` | yes |
| `profile.pushed` | yes |
| `profile.pulled` | yes |
| `toolset.saved` | yes |
| `config.saved` | yes |
| `memory.configured` | yes |
| `memory.retained` | yes |
| `template.saved` | yes |
| `mission.cancelled` | yes |
| `script.saved` | yes |
| `script.run` | yes |
| `script.run_not_started` | no |
| `script.scheduled` | yes |
| `artifact.saved` | yes |
| `backup.taken` | yes |
| `credential.added` | yes |
| `model.added` | yes |
| `help.opened` | yes |
| `artifact.opened` | yes |
| `logs.opened` | yes |
<!-- /generated:event-types -->

## What an event points at

`entity_type` names the kind of thing, and `entity_id` names which one.

| Entity type | What `entity_id` names |
|---|---|
| `mission` | A mission |
| `run` | A run. Declared, and no event uses it today |
| `story` | A story in the Rec Room |
| `session` | A session |
| `skill` | A skill, by name |
| `personality` | The profile whose personality was saved |
| `schedule` | A schedule |
| `chat` | A conversation |
| `model` | A model in the registry, or the task type whose default was cleared |
| `research` | A research run |
| `composer_run` | One run of a workflow |
| `workflow` | A saved workflow |
| `profile` | An agent profile, by slug, or `all` when the action covered every one |
| `toolset` | The profile whose toolsets were saved |
| `config` | The configuration section that was written |
| `memory` | The memory bank a fact was written into, or the memory provider that was configured |
| `template` | A mission template |
| `script` | A host script, by file name |
| `artifact` | An artifact in the registry |
| `log` | A log file, by its own name |
| `backup` | A backup file, by name |
| `credential` | A stored credential |
| `help` | The guide that was rendered, by slug |

Most of these name a row in a table. Five do not: `log`, `script` and `backup`
name a file on your own machine, `config` names a section of the agent's
configuration, and `help` names a page of these docs.

## How long a row is kept

**Nothing deletes an event on its own.** There is no timer, no scheduler wiring
and no HTTP route that prunes this table. The only thing that removes a row from
it is a command you type on the machine that owns the database.

The declared window for `analytics_events` is **400 days**, and it ships
**disabled** on every install, fresh and upgraded alike. An upgrade deletes
nothing, and a policy you have already set is never overwritten by a later one.

```bash
npm run db:retention                                 # status and dry run
npm run db:retention -- --enable analytics_events    # turn the policy on
npm run db:retention -- --apply                      # the only form that deletes
```

The first form prints the policy, how many rows there are, and exactly what a
real run would remove, and it is the form to reach for first. It deletes
nothing. It does write one thing before it measures anything: a progression row
per agent profile, on purpose, so that the preview reports the same refusal or
the same go-ahead that `--apply` would.

Four things about the window are worth knowing before you touch it.

- **365 days is a floor the database enforces.** The longest read any live
  consumer performs is a year, so a shorter window would make a chart show a
  smaller answer today than it showed yesterday. Widening is always allowed;
  narrowing past the floor is refused by a constraint, not by a warning.
- **400 is the floor plus five weeks.** The headroom covers a machine that was
  switched off for a month and a prune that runs late, so a year long read is
  never clipped at its edge.
- **A prune records your growth before it removes anything.** Achievements and
  levels are lifetime totals that no window can recompute, so the per agent
  progression record is captured first, and the prune refuses to delete behind a
  capture it cannot prove happened.
- **Every applied run is recorded.** One row per table, in an append only table
  of its own, including the runs that deleted nothing and the runs that refused.

Quest completions are not at risk either way. The moment a quest was first seen
done is written into your preferences as a high water mark, so a prune cannot
take one back off you.

The deletion is permanent and the prune takes no backup of its own. Take
[a backup](../running/backup.md) before you apply one.
