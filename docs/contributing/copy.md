---
title: Copy
summary: The copy law for the product's screens, three registers, one status vocabulary, and the words that never reach a user
section: contributing
nav: 60
audience: contributor
type: guide
tags: [product, design, docs]
compiled_from: authored
---
# Copy

How the product speaks. The review that produced the final-release programme
found three registers of copy coexisting on the screens (novice, operator and
Hermes-internal) with the last two dominating, an architecture decision cited
on the Agents page, work-group ids in tooltips and task ids in toasts. This
page says which register each surface speaks, which words a status may use,
and what never appears in user copy. `npm run lint:copy` measures the debt;
it becomes a gate once the documentation batch has cleared the tree.

## The three registers

**Novice.** The default for every screen a person reaches from the rail. It
assumes the reader has installed the product and knows what they want to do,
not how the product does it. Concepts are named in the product's own words
(an agent, a mission, a profile, memory) and explained where they are first
met, by the hint beside the term, not by a paragraph above the form. File
names, environment variables and paths do not appear in this register unless
the reader is about to type one.

**Operator.** For the surfaces where the reader is configuring or repairing
the install: Settings and its sections, Models, Memory's provider card, Logs,
Restore, System. Environment variables, file names and commands are allowed
here because they are the subject, and each is shown as the thing to type,
in a code span, once.

**Internal.** For the maintainer: comments, task records, ADRs, the org
folder, this documentation's contributing section. It is never rendered on a
screen. A sentence that only a maintainer can act on belongs in a comment
above the line that renders the sentence a user can act on.

## Rules

- **No governance id in user copy.** ADR-0004, WG-ARCH-003, RUL-WEB-001 and
  T-0089 are the maintainer's addresses. A user cannot open ADR-0004, so "see
  ADR-0004" on a screen is a sentence with no reader. Put the id in a code
  comment beside the copy.
- **Sentence case** for headings, labels, buttons and titles. "Check for
  updates", not "Check for Updates"; "Story themes", not "Story Themes".
  Proper nouns keep their capitals: Hermes, PatterStage, Hindsight.
- **One status vocabulary** (decision 13, held by `src/lib/status-labels.ts`
  and its tests): Draft, Queued, Running, Waiting for you, Completed, Failed,
  Cancelled; Healthy, Degraded, Not running, Not installed; In sync, Out of
  sync. A screen that needs another word for a state has found a state the
  vocabulary is missing, which is a decision, not a label.
- **Sync controls read "Pull from Hermes" and "Push to Hermes"** everywhere.
  Not import, export, refresh or sync, which described the same two acts in
  four ways across three pages.
- **Say what happened, then what to do.** An error names the thing that
  failed and the next action: "Could not load missions. Retry", not "Error".
  A success names the thing: "Pushed 3 profiles to Hermes", not "Success".
- **Placeholders are examples, not labels.** A field's name is its label or
  its `aria-label`; the placeholder shows what a value looks like. The two are
  never the same string (the form-control gate refuses it).
- **No em dashes** in copy. A full stop, a comma or a colon does the work.
- **Name the product's things by the product's words.** A person configures
  an agent's personality, not a SOUL.md; the file name belongs in the
  operator register beside the control that edits it.

## Where each surface sits

| Surface | Register |
|---|---|
| Dashboard, Chat, Missions, Composer, Research, Sessions, Artifacts, Insights, Agents, Skills, Tools, Memory browsing, Quests, Help, Rec Room | novice |
| Settings and every section, Models, the memory provider card, Logs, Restore, System, the install and update flows | operator |
| Comments, `org/`, task records, ADRs, `docs/contributing/` | internal |

## Measuring it

```bash
npm run lint:copy
```

Prints every governance id found in user copy under `src/app`, `src/components`
and `src/modules`, by file, and exits 0. `node scripts/tooling/copy-lint.mjs
--check` exits 1 on any hit; it joins `npm run lint` when the sweep in the
documentation batch has cleared the tree.
