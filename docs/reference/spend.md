---
title: Spend
summary: Provider spend in PatterStage, how it is estimated, the optional budget, and the hard stop that is off until you turn it on
section: reference
nav: 30
audience: operator
concepts: [spend, model]
type: guide
tags: [product, spend]
compiled_from: normalised
---
# PatterStage - Provider spend

LLM provider spend is the only thing in PatterStage that costs money. Everything else runs on your own machine. This page is what the product knows about that spend, what it will tell you, and the two switches you own.

The short version: **spend is always visible, a budget is optional, a budget only warns, and stopping work is a separate switch that ships off.** If you never open this page, nothing about your install changes.

## Where to find it

**Results > Insights**, in the Provider spend panel near the top. It is on screen by default. There is nothing to enable.

## What it shows

Three period totals, always: today, this week, this month. Calendar periods, in UTC, not rolling windows. A person who budgets forty dollars a month means the month, and wants it to reset on the first.

Under them, the same period split by the four things that spend tokens:

| Source | What it is | Recorded? |
|---|---|---|
| Agent runs | A mission dispatched by you, a schedule or the queue | Yes |
| Composer stages | One node of a Composer workflow, executed as a run | Yes, since T-0058 |
| Deep Research | A research run from the Laboratory | Yes, since schema 34 |
| Story Weaver | A chapter, outline or edit written in the Rec Room | Yes, since schema 40 |

### Deep Research runs from before the upgrade are still not counted

Deep Research used to drive the model directly and throw the token counts away, so nothing in the database recorded them. Migration `034` added the token columns and the engine now sums the usage of every call it makes, so a research run is priced exactly like an agent run or a Composer stage.

Runs that finished **before** that upgrade keep NULL token columns, and they stay out of the totals. That is deliberate. Their cost is genuinely unknown, and folding them in at zero would take a real cost and report it as free, which is the whole thing this section used to warn about. The panel counts them separately and says so, and the note disappears on its own as those runs age out of the period you are looking at.

One case still records nothing: a run that **crashes mid-way**. The engine throws before it can return a total, so the tokens it burned are unknowable and the run is recorded as unmeasured rather than as free.

### Story Weaver chapters written before the upgrade are not counted

Story Weaver drove the model directly and created no run row at all, so the whole
feature spent money off the books: a fifteen-chapter novel could cost more than
every mission on the install and the panel would show none of it. Migration `040`
gave a run row a `spend_source`, and Story Weaver now records one per call, the
same way an agent run does.

Chapters written **before** that upgrade left no row to count and stay absent.
There is nothing to fold in: unlike a research run with NULL token columns, no
record of them exists.

### It is an estimate, not an invoice

The figures come from token counts already recorded against each run, priced against a small static rate table (`src/lib/analytics/model-cost.ts`). That table holds fifteen model families. There are hundreds, and anything it does not recognise is priced at a fallback of $1.00 per million input tokens and $3.00 per million output tokens.

**The panel says which figures are which.** A period whose money was priced at the fallback is marked "estimated", or "part estimated" where only some of it was. Hovering that mark gives *that* period's own explanation: how much of its own total was a guess, the models it has no price for, and your provider's billing page to check the figure against. The same sentence is printed in full under the source list for the period your budget covers, and it names that period. Three tiles share one screen, the week can hold spend the month does not (an ISO week opens on a Monday, so early in most months it reaches back past the month boundary), and a dollar figure that does not say which window it covers is not an answer. On an install running a model the table does not know, that sentence covers the whole figure, which is the honest reading of it.

Guessing a price for an unrecognised model would be worse than the fallback: it would be wrong and believed. If you want a real number for your own model, add its rate to that table.

Two more consequences worth knowing:

- A run with **no model recorded** (every Composer stage, which has no mission to carry the model) is priced at that same fallback rather than at zero. Unknown must never read as free. Those rows are marked estimated too, and the sentence counts them rather than naming a model they never had.
- **True only since T-0058 (2026-08-30).** Before it, this sentence described an intention rather than the product. Composer stages recorded no usage at all: the reconciler dropped the gateway's token counts on the way to the database, and the spend read requires `usage_json IS NOT NULL`, so the whole source was EXCLUDED and the Composer row showed `$0.00`. Not a conservative estimate; nothing. Composer runs that finished before that fix stay absent rather than being reported as unmeasured, which is a known gap and narrower than the research one described above.
- Rates change and the table is static, so even a recognised model is an estimate. Treat the number as the right order of magnitude, and your provider's dashboard as the truth.

Runs of every status are counted, not just successful ones. A run that failed after burning tokens still cost you money.

## The budget, which is optional

There is no budget on a fresh install, and nothing asks you to set one. An install with no figure shows its spend and warns about nothing, however much has been spent.

If you want one: open **Set a budget** under the panel, choose a period, type a number of US dollars, and save. Clearing the field removes the budget entirely and puts you back where you started.

**A figure on its own only warns.** You get a meter, a quiet nudge at 80 percent, and a plain sentence when you pass it. Nothing is blocked. That is the default and it is deliberate.

## The hard stop, which is off

Beside the figure is a checkbox. Turning it on means: when the figure is passed, **unattended dispatch pauses**.

Unattended means the three things that dispatch work with nobody watching:

- a schedule falling due,
- the queued-mission drain,
- a Composer workflow advancing on the background tick.

They pause. They do not fail, cancel or drop anything. A schedule keeps its place and fires on the first tick after the period rolls over or you raise the figure.

**Attended use is never blocked.** Clicking dispatch on a mission, running a schedule now, approving a Composer gate, starting a Deep Research run: all of these work identically whether the budget is unset, breached or armed. A human clicking dispatch is answering for the spend himself.

You cannot arm the stop without a figure. The interface refuses it and so does the database, because a stop with no ceiling would refuse every unattended dispatch forever with no number anybody could raise.

### The stop and the panel now count the same rows

They used to not. The panel totalled every source; the guard that pauses
unattended dispatch read recorded run usage only, and never opened the research
table at all. On an install that spent most of its money on Deep Research the
panel could show the meter full and print the over-budget sentence while
unattended dispatch carried on, because the number the guard measured was
smaller than the number on screen.

Both now price one window through one helper, `recordedSpendSince` in
[`spend-window.ts`](../../src/lib/spend/spend-window.ts), so a source added to the
panel is a source the ceiling holds. A unit test asserts the two totals are
equal across every source, which is what stops the two drifting apart again.

### One case where it stops without a breach

If the hard stop is armed and the spend cannot be measured at all, because the database read failed, unattended dispatch pauses and says so. The reasoning is short: you asked for a ceiling, the system cannot show it is under the ceiling, and spending real money on an unprovable assumption is the expensive mistake. A delayed run is the cheap one, and you can dispatch by hand.

A failure to read the budget itself does the opposite and allows dispatch, because there is no evidence a stop was ever armed and almost no install has one.

## Where the setting lives

In your database, in the `spend_policy` table, added by migration `033`. It is a user setting, so it sits with your data rather than in a file you have to edit. See [MIGRATION.md](../running/migration.md).

## API

| Route | What it does |
|---|---|
| `GET /api/spend` | The full summary: three periods, four sources each, your policy, and the verdict. |
| `PUT /api/spend` | Set `limitUsd` (a positive number, or `null` to remove it), `period` (`day`, `week` or `month`), or `hardStop` (boolean). |

Clearing `limitUsd` disarms the stop in the same write, so the forbidden pair never exists.
