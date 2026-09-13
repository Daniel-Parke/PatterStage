---
title: Achievements
summary: Every achievement PatterStage can award, what earns it, its target, and why a Rec Room badge never reaches an agent's record
section: reference
nav: 27
audience: operator
type: reference
tags: [product, analytics]
compiled_from: authored
---

# Achievements

An achievement is a fact about what you have done, shown as a badge. There are
forty of them. Each one names a number the server already holds, missions
completed, chapters generated, events in the ledger, rows in a table, and a
target for it. When the number reaches the target the badge unlocks.

None of them can be claimed, ticked or granted. There is no form, no button and
no way for a browser to write the counts they read, so a badge you have is a
badge you earned.

## Where you see them

- **The dashboard**, in the progress row under the pills: your streak, the top
  agent's level, **Achievements** as unlocked out of total, the next automation
  due, and the door to [Quests](../guides/quests.md). The count is a link to
  Insights.
- **[Insights](../guides/insights.md)** at `/results/insights`, at the foot of
  the page: the trophy case. It shows your points, a tally per rarity, the
  rarest badges you have earned and the ones you are closest to earning.
  **Show all** expands it into the whole catalogue, rarest first, with **All**,
  **Unlocked** and **Locked** filters. Hovering a badge names it, says what
  unlocks it and shows how far along you are.
- **A toast, on any screen.** The app shell watches the same reading the
  dashboard polls and congratulates you the moment something unlocks. The first
  reading after a page load only takes note of what you already have, so
  reloading never replays badges you earned last week, and each badge announces
  itself once.
- **The Quests page.** Four quests name the achievement they earn, and the row
  shows that badge beside the step.

## The catalogue

Forty achievements. Scope is explained below the table, and so are rarity and
points.

| Achievement | What earns it | Target | Scope | Rarity | Points |
|---|---|---:|---|---|---:|
| First Contact | Complete your first mission | 1 | Agent | Common | 10 |
| Field Agent | Complete 10 missions | 10 | Agent | Rare | 25 |
| Veteran | Complete 100 missions | 100 | Agent | Epic | 50 |
| Legend | Complete 500 missions | 500 | Agent | Legendary | 100 |
| Dispatcher | Dispatch 50 mission runs | 50 | Agent | Rare | 25 |
| Blitz | Dispatch 5 missions in a single day | 5 | Agent | Rare | 25 |
| Resilient | Weather 10 failed missions | 10 | Agent | Rare | 25 |
| Storyteller | Weave your first story | 1 | Rec Room | Common | 10 |
| Novelist | Weave 10 stories | 10 | Rec Room | Rare | 25 |
| Saga Weaver | Complete 5 stories | 5 | Rec Room | Epic | 50 |
| Wordsmith | Generate 25 chapters | 25 | Rec Room | Epic | 50 |
| Epic Scribe | Generate 100 chapters | 100 | Rec Room | Legendary | 100 |
| Operator | Start 25 agent sessions | 25 | Agent | Rare | 25 |
| Marathon | Start 250 agent sessions | 250 | Agent | Legendary | 100 |
| Automator | Run a scheduled mission or script | 1 | Agent | Common | 10 |
| Scriptsmith | Automate 5 scripts on a timer | 5 | Agent | Rare | 25 |
| Clockwork | Create 5 schedules | 5 | Agent | Rare | 25 |
| Set & Forget | Fire 50 scheduled runs | 50 | Agent | Epic | 50 |
| Cron Lord | Fire 500 scheduled runs | 500 | Agent | Legendary | 100 |
| Tinkerer | Toggle 10 skills | 10 | Agent | Rare | 25 |
| Skill Architect | Toggle 50 skills | 50 | Agent | Epic | 50 |
| Shapeshifter | Change personality 5 times | 5 | Agent | Rare | 25 |
| Model Mechanic | Configure models 10 times | 10 | Agent | Rare | 25 |
| First Words | Send your first chat message | 1 | Agent | Common | 10 |
| Conversationalist | Send 100 chat messages | 100 | Agent | Rare | 25 |
| Chatterbox | Send 1,000 chat messages | 1,000 | Agent | Epic | 50 |
| Token Baron | Burn 1M tokens | 1,000,000 | Agent | Epic | 50 |
| Token Tycoon | Burn 10M tokens | 10,000,000 | Agent | Legendary | 100 |
| On A Roll | Maintain a 7-day streak | 7 | Agent | Rare | 25 |
| Unstoppable | Maintain a 30-day streak | 30 | Agent | Epic | 50 |
| Centurion | Maintain a 100-day streak | 100 | Agent | Legendary | 100 |
| Night Owl | Finish a run between midnight and 5am | 1 | Agent | Common | 10 |
| Early Bird | Finish a run between 5am and 9am | 1 | Agent | Common | 10 |
| Polyglot | Use 3 different agent profiles | 3 | Agent | Rare | 25 |
| Renaissance | Trigger 8 different event types | 8 | Agent | Epic | 50 |
| Completionist | Trigger all 38 core event types | 38 | Agent | Legendary | 100 |
| First Hour | Finish chapter 1: Get running | 5 | Agent | Rare | 25 |
| Agent Shaper | Finish chapter 3: Shape your agent | 8 | Agent | Epic | 50 |
| Clockmaker | Finish chapter 4: Automate and watch | 6 | Agent | Epic | 50 |
| Curriculum | Finish every quest | 32 | Rec Room | Legendary | 100 |

Five of those targets are counted rather than written down, so they cannot go
stale. **Completionist** counts the curated list of event types the product can
record today, which is thirty-eight: the taxonomy is longer, but the three
failure events are never something to collect, and anything nothing emits yet is
left out. The three chapter chains and **Curriculum** count the quest catalogue,
so a chapter that gains a step raises its own target instead of handing you a
chapter you have not finished.

A few rows measure something more precise than their sentence:

- **Automator** says run, and reads the PatterStage schedules that are currently
  enabled. It unlocks when the first one is armed, not when it first fires.
- **Scriptsmith** measures enabled host scripts, and the dashboard aggregate
  does not count them: host scripts live in the system crontab rather than in
  the database, so the number it reads is always zero and the badge cannot be
  earned on this release.
- **On A Roll**, **Unstoppable** and **Centurion** read your longest streak
  ever, not the streak you are on. Breaking a streak never takes one back off.
- **Night Owl** and **Early Bird** read the hour a run finished, in UTC, so on a
  machine far from that offset they can unlock at a surprising local hour.
- **Renaissance** counts distinct event types you have ever triggered, from the
  whole taxonomy. **Completionist** counts against the curated list instead,
  which is why the two numbers are not comparable.
- **Resilient** counts failed missions. Nothing about it is a penalty: the point
  is that you kept going.

## Rarity and points

Every achievement carries a rarity, and rarity sets its points.

| Rarity | Points each | How many |
|---|---:|---:|
| Common | 10 | 6 |
| Rare | 25 | 15 |
| Epic | 50 | 11 |
| Legendary | 100 | 8 |

That is 1,785 points on the board. The trophy case shows what you have earned of
it, and sorts by rarity, then points, then name, which is why a Legendary you
earned this morning sits above a Common you earned first.

## What scope means

Every achievement belongs to one of two records.

**Agent** describes the agent: work it completed, capability it gained,
equipment it accumulated. Thirty-four of the forty are this.

**Rec Room** is creative work you did for your own pleasure in the Rec Room. Six
are this: the five story badges, and Curriculum.

The difference is not decoration. The record PatterStage keeps of an agent's
growth carries the agent-scoped achievements only, and the Rec Room ones are
filtered out before the row is written, so a story badge never lands in an
agent's record. A story is you having fun, not an agent learning anything.

An agent's level is a separate matter, and no achievement of either scope feeds
it. It is built from what the agent was run through and what it was given: runs
completed, tokens, active days, skills and toolsets. So the scope filter says
nothing about a level, and one thing does cross over. Generating a chapter
spends provider tokens, and that spend is written down as a completed run with
no profile on it, which the root agent counts as its own. An evening in the Rec
Room moves that agent's level even though it never touches its achievements.

Nothing is hidden by this. Rec Room badges are counted in the same total, shown
in the same trophy case, and worth the same points as any other. What they do
not do is feed an agent's record.

Curriculum sits in the Rec Room for the same reason, even though finishing every
quest is not play. Chapter 6 of the quest programme is the Rec Room, so an
agent-scoped Curriculum would let a story written for fun move an agent's record
by the back door.

## The quest chains

Four achievements are earned by finishing a chapter of the quest programme
rather than by any single act.

| Achievement | Chapter | Steps it needs |
|---|---|---:|
| First Hour | 1. Get running | 5 |
| Agent Shaper | 3. Shape your agent | 8 |
| Clockmaker | 4. Automate and watch | 6 |
| Curriculum | Every chapter | 32 |

Chapters 2, 5 and 7 have no chain achievement of their own. Their steps still
count towards Curriculum.

A chain reads the same proofs the quests read, the event in the ledger or the
row in the table, rather than the quest's own tick on the Quests page. Two
things follow from that:

- **Skipping does not count.** A skipped quest keeps the Quests page honest
  about what you still mean to do, and it proves nothing, so its chapter's chain
  stays locked until the step is genuinely done. Quest 1.2, adding a credential,
  is the one most people skip, because a keyless local provider needs none, and
  First Hour waits for it anyway.
- **A chain is not latched.** A completed quest stays completed for good, because
  the moment it was first seen done is written into your preferences.
  Achievements have no such latch: they are worked out fresh from history every
  time.

[Quests](../guides/quests.md) is the guide to the page itself. The full list of
all thirty-two steps, with the proof and the screen for each and the achievement
it earns, is in the [quests reference](quests.md).

## There is no operator level

You do not have a level, an experience bar or a score. There is nothing to grind
and no number that says how good an operator you are.

What you have is two things. **Progress**, which is chapters and steps: how many
of the thirty-two quests you have done, chapter by chapter, on the Quests page.
And **achievements**, which are the standing record of what you have done at
all. The achievement named Operator is a badge for starting twenty-five
sessions, not a rank.

Levels do exist in PatterStage, and they belong to agents rather than to you. An
agent's level grows out of what it has been run through and what it has been
given, and it is shown on that agent's own page. It is not yours, and it is not
a total of the two.

## How the numbers move

- **Achievements are worked out fresh on every reading**, from the same query
  the dashboard already makes. Nothing about a badge is stored for the sake of
  showing it, so what you see cannot drift out of step with what you did.
- **A count can fall.** Nothing deletes an interaction event on its own. The
  prune is a command you type, and it ships disabled: you have to turn the
  policy on for `analytics_events`, whose window is 400 days, and then run the
  apply form before anything is removed. If you ever do, a measurement taken
  from that history gets smaller, and a badge can read as locked again on the
  live page. The [analytics events](analytics-events.md) reference has the
  commands.
- **The earlier answer survives that.** PatterStage appends a row per agent
  recording its level and its agent-scoped achievements whenever the answer
  moves, and takes one deliberately just before a prune deletes anything. Rows
  are never rewritten, so the record still says the badge was earned. That is
  the high-water mark, and it is the reason the record is kept at all.
- **Those rows name their subject.** Achievements are worked out once for the
  whole install rather than per agent, and every stored row says so, so a row
  can never be read as a claim that one agent earned them by itself.
