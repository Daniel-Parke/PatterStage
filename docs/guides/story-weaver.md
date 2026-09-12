---
title: Story Weaver
summary: "The Rec Room's long-form writer: your shelf of stories, what state each is in, and the way in to a new one"
section: guides
nav: 170
audience: operator
screen: /recroom/story-weaver
concepts: [spend]
type: guide
tags: [product, rec-room, stories]
shots: [docs/images/story-weaver.png]
---

# Story Weaver

Your bookshelf: every story you have started, what state each one is in, the
way back into reading one, and the way in to a new one. This is the Story
Weaver entry in the sidebar; the only other Story Weaver screen is
[Create a story](./story-create.md).

## What you see

![Story Weaver screen](../images/story-weaver.png)

The header reads **Story Weaver**, and under it one line counts the shelf: how
many stories you have, how many are completed, and how many words have been
written across all of them. While the list is still loading, those three read
as dashes rather than zeros. On the right of the header is **New story**, which
goes to Create.

Under the header, three filters in one control: **All**, **Completed** and
**Waiting for you**, each with its count. One is always on and decides which
stories the list shows. The arrow keys move between them.

Each story is a row. Its title, set in the reader's serif, is the link that
opens it. Under the title, in small type: the genre (or "General" if none was
set), the chapters finished out of the chapters planned, the word count, an
estimated reading time, and how long ago the story last changed. On the right
are the story's status word, a **Read** button and a bin. An unfinished story
carries a thin progress bar filled to the share of its chapters that are
written, and the first two lines of the premise sit under the title when there
is one.

The status word is one of the product's own: **Completed**, **Running** while a
chapter is being written, **Waiting for you** when the story is between
chapters, or **Failed**.

With no stories at all, the list is replaced by **Your bookshelf is empty** and
a **Create a story** button. Under a filter that matches nothing, it reads "No
stories are completed" or "No stories are waiting for you" instead, with no
button. If the list cannot be read, a banner takes its place with the reason and
a **Retry**. The empty shelf is never shown over an error, so a failed read
never looks like an empty shelf.

## Typical use

**Start a story**

1. Press **New story**.
2. Fill in the premise, the cast, the shape of the story and the model that
   writes it, then start it. That screen is covered in
   [Create a story](./story-create.md).
3. Creating it takes a few minutes and shows a progress overlay. The plan, the
   chapter list and the whole of chapter one are written in that one step.
4. You land in the reader with chapter one ready to read and the rest pending.

**Pick up a story you left unfinished**

1. Choose **Waiting for you**. What is left is every story that is not
   finished, each with its progress bar.
2. Press its title. The reader opens at chapter one.
3. The chapter list down the left (a **Chapters** sheet on a phone) gets you
   back to where you were. A chapter you have read has a green dot and a tick;
   one written but not yet read is orange; one still to write is dim and
   cannot be opened.
4. In the reader's header, **Write chapter 4** (or whichever is next) writes
   exactly one more chapter. **Keep writing** works through the remaining
   chapters one after another until they are done or you press **Stop**. The
   dot for a chapter being written pulses cyan while it is written.

**Reread a finished story, or take it further**

1. Choose **Completed** and open a story.
2. Read it with the arrows at the foot of the page, or jump about with the
   chapter dots or the chapter list.
3. On a chapter you want changed, press **Edit**, describe what should be
   different, choose how long the chapter should be and how many chapters to
   regenerate, then press **Edit chapter**. That chapter is rewritten, and the
   chapters after it, up to the count you chose, are emptied back to unwritten.
   The count includes the chapter you edited, so the default of three empties
   the two after it. Write them again with **Write chapter N** or **Keep
   writing** so they still follow on.
4. On a story whose chapters are all written, **Continue** asks for a
   direction, how many more chapters you want and how long they should be. It
   plans them and adds them to the end as chapters still to write.

**Get rid of a story**

1. Press the bin on its row. It changes to read **Delete?**.
2. Press it again to confirm. The row leaves the shelf at once. Leave it alone
   for a few seconds and it disarms itself, so a stray first click does
   nothing. There is no undo in the interface.

## Notes

- **Writing costs money.** Everything else in PatterStage runs on your machine;
  the chapters are written by a model at your provider, so each one is billed.
  One chapter is more than one call: the chapter itself, a short call to give it
  a title, and another to update the running summary that keeps later chapters
  consistent. Creating a story costs about the same, since the plan and the
  first chapter come back from one call and the first summary from a second.
  See [spend](../concepts/spend.md).
- **That cost is counted with everything else.** It appears on
  [Insights](./insights.md) as the **Story Weaver** line in the provider spend
  panel, next to Agent runs, Composer stages and Deep Research, and it counts
  towards a budget you have set there like any other spend. A budget only
  warns, and even the hard stop pauses unattended work rather than a click, so
  nothing here will ever refuse to write a chapter you have asked for. The
  reader shows what a story has cost so far beside its chapter dots.
- **Nothing is written unless you ask for it.** Opening a story does not start a
  chapter. Writing stops when you click **Stop**, and stopping stops the call at
  the provider rather than letting a chapter you will not read finish and bill.
  Closing the tab mid-chapter has the same effect.
- **The status words are the ones used everywhere else in the product.** A story
  is Running while it is being created, Waiting for you once it has chapters
  left to write, Completed when every chapter is done, and Failed when
  generation broke. A story counts as completed here once every one of its
  chapters is written, whether or not it was ever marked finished. The third
  filter holds everything that is not finished, so a story showing **Running**
  or **Failed** turns up under **Waiting for you** as well.
- **The chapter dots use the same colours as the rest of the product.** Cyan
  and pulsing is being written, green is written and read, orange is written
  and waiting for you to read it, red is failed, and a dim dot is a chapter
  still to write. The same dots appear in the reader's header and at the foot
  of the page, and each is a button that opens its chapter once it is written.
- **The reader has its own register.** The page you read is the one place in
  PatterStage that is not the console's dark blue: a warm near-black page,
  warm off-white ink, and a serif. Under **Aa** in the reader's header you can
  change the size, the line spacing and the face; the reader's bars and its
  chapter list are the console's own.
- **A restart is not resumable.** If PatterStage stops while a chapter is being
  written, that chapter is marked Failed on the next start with the reason
  "Generation was interrupted by a restart. Retry to continue." Nothing is lost
  except that chapter, the story keeps its Waiting for you word, and the reader
  offers a retry for the chapter. A story interrupted while it was still being
  created is marked Failed itself, with the same reason.
- **Characters and themes are reusable, stories are not.** A saved character
  sheet or a saved theme can be dropped into any new story; both libraries live
  on [Create a story](./story-create.md). A story itself is a one-off.
- **Writing feeds your record but not your agents.** Starting a story, writing a
  chapter and finishing a story are recorded, they complete the Rec Room quests
  on [Quests](./quests.md), and they unlock Rec Room achievements. They
  deliberately do not earn an agent any experience, because writing fiction is
  not the agent's work.
- **The list is read once, when you open the screen.** A story being written in
  another tab keeps whatever status it had when this page loaded, so leave and
  come back to see it move on. There is no search and no sort: stories are
  listed newest first, by when they were created. Reading time is an estimate
  at about 250 words a minute, never rounded below one minute.
- **Stories are local.** They live in the same database as everything else on
  your machine, and they are included in a [backup](../running/backup.md).
  Deleting hides a story from the shelf; a backup taken before the deletion
  still holds it.

<details>
<summary>Under the hood</summary>

Every action on this screen is a POST to `/api/stories` with an `action` field:
`list` on load and after a Retry, `delete` for the bin. A bare GET on that path
is refused on purpose, with a message saying so.

Stories are rows in the `stories` table in the SQLite database, created in the
baseline migration and listed by creation time, newest first. Deleting sets
`deleted_at` rather than removing the row, and the list query skips deleted
rows, so a deleted story is gone from the interface but the text is still in
the database file until you replace it, and a backup taken afterwards still
contains it.

The counts in the subtitle and on the filters are computed in the browser from
the list response, not read from a stored total, so they cannot drift from the
stories themselves. The status mapping lives in
`src/modules/rec-room/lib/story-status-labels.ts`: `generating` reads Running,
`active` reads Waiting for you, `complete` reads Completed, `failed` reads
Failed, and a row with no status at all is treated as waiting for you.

Model calls made for a story are recorded with the spend source `story`, which
is what the Insights panel labels Story Weaver. The model is whichever one was
chosen on the create screen, stored as `modelId` in the story's config; blank
means the agent's default [model](../concepts/model.md). The three events that
record the work are `story.created`, `story.chapter_generated` and
`story.completed`.

Story Weaver used to be five screens. `/recroom/story-weaver/library`,
`/recroom/story-weaver/characters` and `/recroom/story-weaver/themes` still
answer, with a redirect to this page and to the two panels on Create.

</details>
