---
summary: analytics_events and chat_messages get declared retention windows and an opt-in prune that refuses to delete anything the per-Body progression record has not already captured
type: decision
tags: [arch, data, retention]
status: accepted
compiled_from: normalised
---

# ADR-0009 · Retention for the readings tables

**Status:** ACCEPTED by Daniel Parke (operator), 2026-08-23, given explicitly in
session S-0004 when asked to rule on it.

The first draft of this line read "accepted by Daniel (operator)" before he had
ruled. That was corrected to PROPOSED on review, because a session cannot grant
the acceptance it writes down, and it is recorded here rather than erased: the
acceptance below is real and the earlier one was not.

**Date:** 2026-08-23.
**Depends on:** ADR-0004 (Brain and Body) and migration 031, the per-Body
progression record, which had to land first and did.

## Context

PatterStage keeps everything in one SQLite file. Two of its tables are
append-only, have no expiry column and grow with use rather than with anything a
person chooses to create:

- `analytics_events` (migration 012) records every meaningful interaction. One
  row per mission dispatched, story chapter generated, schedule fired, skill
  toggled, chat message sent.
- `chat_messages` (migration 013) holds conversation turns. User-authored text,
  model output, reasoning and tool calls.

Every other table in the schema has a ceiling somebody controls. Missions,
models, schedules, profiles and stories are created and deleted by hand. `runs`
is bounded by dispatches. These two are not bounded by anything.

The reason that matters more here than it would elsewhere: PatterStage is
installed and self-hosted. These rows sit on machines belonging to people the
operator has never met, whose disks he cannot see and whose consent he cannot
ask for a second time. `chat_messages` in particular is user-authored content on
somebody else's computer.

RUL-ARCH-008 ruled option A with D's seam: one `patterstage.db`, but
`analytics_events` and `chat_messages` are declared the READINGS class, each
naming an owner, a consumer, a retention window and a prune path, with the
physical split designed now so it can be executed if volume ever forces it. The
ruling has stood undischarged since 2026-07-25. This ADR discharges it.

One thing had to happen first, and it did. Every progression number in the
product is derived on read: an agent's achievements come out of
`analytics_events` lifetime counts, and the daily streak comes out of its
distinct active days. Delete those rows and the next read returns smaller
numbers, so an earned achievement silently un-earns itself and no reader can
tell that apart from it never having been earned. WG-ARCH-003 rules that
recorded growth survives the deletion of the history it came from. Migration
031, task T-0016, is that record: an append-only per-profile snapshot of level,
XP and achievements with the inputs and a digest over them, enforced immutable
by two `RAISE(ABORT)` triggers. It landed before this work started, and it is
the precondition that made this work safe to do at all.

A check made before designing the prune, because the task's own instruction was
to stop and report rather than proceed if it failed: progression's level and XP
come from `runs`, which this prune never touches; its achievements come from
`analytics_events`, which this prune does touch, and which migration 031
captures. Nothing progression needs is deleted without being recorded first. The
chat half is cleaner still: the chat achievements count `chat.message_sent`
events in `analytics_events`, not rows in `chat_messages`, so pruning chat
touches no progression input at all.

## Decision

Both tables get a declared, defensible retention window, and a prune that is
opt-in, observable, bounded to the window, and blocked by a runtime interlock on
the progression record.

### 1. The declarations, as data

Migration 032 creates `retention_policy`, one row per readings table, carrying
the owner, the consumer, the enabled flag and the window. The same facts are in
`src/lib/retention/retention-law.ts` as typed constants, in migration 032's
header, and here. That is deliberate duplication of a decision that has to be
legible from the schema, from the code and from the decision record
independently.

| Table | Owner | Consumer | Window | Floor |
|---|---|---|---|---|
| `analytics_events` | `src/lib/analytics/analytics-repository.ts` | `GET /api/analytics` (Insights) and `src/lib/stats/stats-repository.ts` (achievements, streak) | 400 days | 365 days |
| `chat_messages` | `src/lib/chat-repository.ts` | the Chat surface (whole-conversation transcript) and run reconciliation | 365 days | 30 days |

### 2. Why those numbers, and not rounder ones

The rule, applied twice: a window is longer than the longest read any live
consumer performs, with headroom, and never shorter than the floor.

**`analytics_events`, 400 days, floor 365.** The longest bounded read in the
codebase is 365 days. `maxCountInSingleDay`, `countByTypeAndHour` and
`countByHourAllTypes` each default `sinceDays = 365`; the Insights page offers 7,
30 and 90. So 365 is the point below which a live chart starts showing a smaller
answer than it showed yesterday, and it is the floor. The shipped window is 365
plus five weeks. Five weeks absorbs a laptop that was closed for a month and a
prune that runs late, so a 365-day read is never clipped at its own edge.

The unbounded reads over the same table are the interesting case, and they are
the reason migration 031 exists rather than a reason for a longer window.
`countByType`, `distinctActiveDays`, `distinctProfileCount` and
`distinctEventTypeCount` are lifetime aggregates. No finite window satisfies
them, so they are satisfied by capturing the answer instead of by keeping the
inputs.

**`chat_messages`, 365 days, floor 30.** There is no windowed consumer to derive
a number from: the reader is the transcript, which is unbounded by construction.
So the number is argued rather than measured, and the argument is that a
conversation with no activity for a full year is past any working reuse. It is
also user-authored content, the one class where keeping less is the safer
default rather than the riskier one, which is why the argued number is not
longer. The floor of 30 days exists to catch a mistyped `3`.

The floors are `CHECK` constraints in migration 032, not documentation. Widening
a window is always allowed. Narrowing one past the point where a consumer would
notice is refused by the database.

### 3. Nothing is deleted until somebody asks

`enabled` is seeded `0` for both tables on every install, fresh and existing
alike, with `INSERT OR IGNORE` so a re-run never overwrites a choice already
made.

**What happens to an existing install with five weeks of history when it takes
this upgrade: nothing.** Migration 032 adds two bookkeeping tables and changes no
row of either readings table. There is no first-run prune, no grace period that
expires, no default that switches on later. To delete anything, an operator has
to turn a policy on and then pass `--apply`, which are two separate deliberate
acts on the machine that owns the data.

Fresh installs are seeded disabled too. One rule for everybody is a rule people
can hold in their heads.

### 4. The prune path

`npx tsx scripts/tooling/retention-prune.ts` (also `npm run db:retention`).
Default form prints the policy, the volume, the split threshold and exactly what
a real run would delete, and changes nothing. `--enable` and `--disable` move the
policy. `--apply` is the only form that deletes.

There is no HTTP route and no scheduler wiring. That absence is the design, not
an omission: the one thing in this product that destroys history should not be
reachable by a click or by a timer that fires while nobody is watching. The
logic is `src/lib/retention/`, and every statement is in
`retention-repository.ts`, which is WG-ARCH-002 applied to the feature where a
stray `DELETE` in the wrong layer would be unrecoverable.

### 5. The ordering interlock

The constraint is that nothing may delete a row the progression record has not
already captured, and that the prune must refuse rather than proceed if that
ordering cannot be guaranteed at runtime. It is guaranteed as follows.

The prune captures progression FIRST, with `{ force: true }` so a row is
appended even when the answer has not moved. It then reads
`MAX(captured_at)` from `agent_progression_snapshots` and, per table, checks
that instant against the cutoff it is about to delete behind. Then:

- every deleted row is older than the cutoff, by the `WHERE` clause;
- the cutoff is older than the capture, by the check;
- so every deleted row existed when the capture ran;
- so its contribution is already inside a recorded answer.

The middle line is the one that can fail, and when it fails the table is marked
`refused` and nothing is deleted. It fails on an install where the capture wrote
nothing, which means no agent profiles, hence no rows, hence no watermark, hence
no proof. That install does not prune, and that is correct: refusing to act
without evidence is right even when the evidence would have been trivially
favourable. It also fails if the capture threw, which is treated exactly like
the record not existing.

`force: true` exists because lazy capture is right for the dashboard's
20-second poll and wrong immediately before a deletion. An install whose answer
has not moved in months has a months-old newest row, and the interlock reads that
row's timestamp. Forcing one makes the interlock pass on the strength of a
capture that genuinely just happened.

The capture is injected into `runRetentionPrune` rather than imported, so the
module does not drag the dashboard aggregate behind it and the tests can drive
it. That is not a hole: a caller who injects a capture that does nothing does not
get a prune, because the interlock reads the database for its evidence and not
the callback's return value.

### 6. Chat is pruned by conversation, never by message

Deleting messages older than a cutoff out of a live conversation leaves a
transcript that begins in the middle, which is worse than either keeping it or
dropping it. So the unit is a conversation whose last activity is before the
cutoff. Every message it holds is older than that, so nothing newer than the
window is ever touched, and the window claim survives the change of granularity.
The messages go by `ON DELETE CASCADE`, and the delete then counts orphans and
throws if it finds any, rolling the transaction back: a conversation row deleted
without its messages is a corrupted transcript, not a partial success.

### 7. Deletion is observable

Every `--apply` invocation writes one row per table into
`retention_prune_runs`: the outcome, the window, the exact cutoff string, rows
matched, rows deleted, the progression watermark it verified against and a
sentence of detail. Refusals and disabled tables are recorded too, because "it
ran and declined" is exactly what an operator needs when the disk is still full.
The table is append-only, enforced by two triggers, for the same reason
migration 031's is: an audit of deletions that can itself be edited is not an
audit. Dry runs log to stdout and write nothing, so the table's growth is tied
to actual deletions rather than to how often somebody looked.

### 8. The split, designed and not shipped

RUL-ARCH-008 asks for the physical split to be written now. It is written, in
migration 032's header and here, and it is deliberately NOT shipped as an inert
numbered `.sql`. `docs/MIGRATION.md` is explicit that a migration nothing calls
does nothing on any install forever, so an unwired file is a trap rather than a
plan.

- **Trigger.** `analytics_events` past 1,000,000 rows or `chat_messages` past
  250,000, whichever comes first, with retention already enabled. Retention is
  the cheap answer and has to be tried first; a table over the line with the
  prune switched off has not proved that volume forced anything. The numbers sit
  where the lifetime aggregates start to hurt: `countByType` is an unindexed
  `GROUP BY` over the whole table on every dashboard poll, and a million rows of
  that on the small always-on machines this product targets is where a
  20-second poll stops being free. `chat_messages` gets a quarter of the count
  because its rows are one to three orders of magnitude larger, so a comparable
  number of bytes arrives sooner.
- **Observable.** `readRetentionStatus()` evaluates the trigger against live row
  counts and the prune command prints it, so the condition announces itself
  rather than waiting to be remembered.
- **Move.** Both tables, their indexes and the policy pair into
  `patterstage-readings.db`, attached with `ATTACH DATABASE` and addressed as
  `readings.analytics_events`.
- **Seam.** Already in place. Every statement against either table is inside a
  repository file, so the change is the connection module and the two
  repositories, not the callers.
- **Cost.** Cross-database joins and one more file to back up. Nothing joins
  these tables to the records core today, which is why the split is cheap enough
  to defer and cheap enough to keep designed.

## Alternatives considered

- **No retention, keep everything forever.** The status quo, and it is what
  WG-ARCH-008 was ruled against. Two tables that grow with use and have no
  ceiling on machines nobody can inspect is a defect that surfaces as a full disk
  on somebody else's computer, at which point the answer is "delete the database",
  which loses everything rather than the oldest 10 percent. Lost because
  unbounded growth is a decision too, and it is a worse one taken by default.
- **Prune on upgrade, with a default window switched on.** Bounds both tables
  immediately with no operator action, which is the version that actually gets
  used. Lost on the first sentence of the design constraint: somebody with five
  weeks of history must not lose it because they ran an update. An upgrade that
  deletes data the operator did not ask to delete is the exact failure mode this
  ADR exists to prevent, and "it was in the release notes" is not consent.
- **Prune by row age inside a conversation, rather than by conversation.** The
  obvious symmetry with `analytics_events`, and one `DELETE` instead of a
  grouped subquery. Lost because a transcript that starts mid-conversation is a
  worse artefact than either of the honest outcomes, and because the model's own
  context reads it as a complete conversation that began with an answer to
  nothing.
- **A hard-coded window with only an on/off switch.** Fewer knobs, and on an R3
  change fewer knobs is a real argument. Lost because an operator who cannot
  widen or shorten the window will instead write their own `DELETE`, or delete
  the database, and both are worse than a window with a floor the schema
  enforces. The floor is what protects the consumers; the knob only chooses how
  much more than the floor to keep.
- **A scheduled prune, wired into the existing scheduler.** Retention that
  requires a human to remember it is retention that does not happen, which is a
  fair criticism of what was built. Lost for now on the R3 posture: the first
  version of the only irreversible operation in the product should run when
  somebody is watching it. Automating it is a later decision with this ADR's
  interlock and record already in place, and it should be taken on evidence from
  installs that have run the manual form.
- **Gate the interlock only on `analytics_events`.** Technically sufficient:
  `chat_messages` feeds no progression input, so the check is redundant there.
  Lost because one rule with no exceptions is easier to hold and easier to prove
  than two rules with a reason, and the redundant check costs nothing since the
  capture has already run.
- **Ship the split migration now as an unwired `.sql`.** A literal reading of
  "the split written now as the migration that fires if volume forces it". Lost
  against `docs/MIGRATION.md`'s own rule: nothing scans the migrations directory,
  so an unwired file does nothing on any install forever while looking exactly
  like something that would. The design is recorded instead, with an observable
  trigger.

## Consequences and trade-offs accepted

- **Retention does not happen by itself.** Both policies ship off and the prune
  is a manual command, so an install whose operator never runs it is exactly as
  unbounded as it was before. That is the price of never surprising anybody, and
  it is paid knowingly. The counter-argument is real and is recorded above.
- **An install with no agent profiles cannot prune.** No profiles means no
  progression rows, means no watermark, means no proof, means refusal. It is the
  safe subset, and it is stated in the refusal message rather than hidden.
- **Some live numbers on screen will fall after a prune, and that is not a bug
  the interlock covers.** The interlock protects what migration 031 records:
  level, XP and the agent-scoped achievements, including their measured values.
  It does not protect the lifetime aggregates that are only ever computed on
  read. The Insights page's all-time totals per event type will drop, and the
  dashboard's `longestStreak` can fall, because both are recomputed from the rows
  that went. The streak-derived achievements (`on-a-roll`, `unstoppable`,
  `centurion`) keep their high-water mark in the record and do not un-earn, which
  is the guarantee WG-ARCH-003 actually asks for, but the raw streak number
  beside them is a live count and will read lower. An operator who enables
  retention should expect that, and it is one more reason the default is off.
- **Every invocation appends a progression row per profile, previews included.**
  The forced capture is the cost of the interlock, and the preview forces too,
  which is a deliberate choice against a cheaper one. Forcing only on `--apply`
  would leave a preview on a long-quiet install reporting `refused` for a run
  that `--apply` would in fact complete, and a false alarm on the command that
  exists to predict a deletion is worth more than the rows it saves. The rows are
  small, honest and append-only by design: a daily preview for a year on a
  three-profile install adds roughly a thousand of them.
- **The prune scans rather than seeks.** Every comparison goes through SQLite's
  `datetime()`, because `analytics_events.created_at` is written by a column
  default in SQLite's format while `chat_messages.created_at` is an ISO-8601
  string from JavaScript, and those two do not compare correctly as strings
  within a day. Normalising costs the index on `created_at`. A maintenance
  command an operator invokes by hand can afford a scan; a boundary that is right
  only on most days cannot. An unparseable timestamp yields NULL, the comparison
  is NULL rather than true, and the row is kept.
- **The record itself is unbounded, technically.** `retention_prune_runs` is
  append-only and never pruned. A daily prune of both tables writes about 730
  rows a year, so it is not a table that needs a policy of its own, and giving
  the audit of deletions an expiry would have been the joke this ADR could not
  afford.
- **Widening the readings class costs a migration.** `retention_policy` has a
  `CHECK` restricting `table_name` to the two declared tables. Adding a third is
  a decision, and it should cost a migration rather than an `INSERT`.

## Anti-patterns this guards against

A retention window chosen because it was a round number, with the reasoning
reconstructed afterwards by whoever has to defend the data loss. An upgrade that
deletes a stranger's history and calls it a default. A prune that runs, deletes
and leaves nothing behind to say it ran, so the only evidence is the absence.
A `DELETE` whose boundary is asserted in a comment rather than proved against
rows planted either side of it. Deleting the inputs to a number before anything
has recorded the number, so growth quietly un-happens and the record cannot tell
that apart from it never having happened. And a deferred architectural decision
with no observable trigger, which is a decision nobody ever revisits.
