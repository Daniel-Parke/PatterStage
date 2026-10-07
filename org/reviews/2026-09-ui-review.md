---
summary: The post-overhaul UI review the operator asked for, every documented route walked at 1440 and 390 on the finished tree, with every improvement found, ranked, and the debt the programme left named
type: review
tags: [review, design]
status: complete
compiled_from: preserved
---

# PatterStage · UI review after the overhaul · 2026-09-08

> The operator asked for a full review of the UI once the programme was done,
> naming any and all improvements, with licence to redesign key elements as
> long as function is kept or improved (fewer clicks, not more). This is that
> review. Method, then findings ranked, then the debt the programme itself
> recorded. Evidence: the final walk of U16 (T-0130), every one of the 21
> documented routes at 1440x900 and 390x844 on the tree at 5879e337, the
> census at that tree, and the gates' own logs. Where a finding names a number,
> the number was measured, not estimated.

## What the programme delivered, in one table

| Measure | Before (U0) | After (U16) |
|---|---:|---:|
| Rail vs page contrast / divider | 1.06:1 / 1.26:1 | 1.47:1 / 4.40:1 |
| Screens whose h1 shares its content's left edge | 2 of 23 | 21 of 21 |
| Distinct content widths | 8 | 1 |
| Controls under 24x24 | 85 | 0 |
| Bare `outline-none` | 46 | 0 |
| Animations running under reduced motion | 28 | 0 |
| Filter groups with no ARIA state | 13 | 0 |
| Status colour maps | 22 | 1 |
| Dashboard API requests on load (endpoints fetched twice) | 22 (4) | 17 (0) |
| Distinct card chromes / button chromes | 108 / 89 | 64 / 57 |
| Control borders below 3:1 | 320 | 102 |
| `src/` lines | 105,975 | 105,942 |
| Tests | 6,090 | 6,802 |

The four causes the reconnaissance named are answered by construction and
gated. What did not happen: the line count did not fall, the mono share as the
census counts nodes rose (0.63 to 0.68), and the variety counts moved by a
third to a half rather than to their targets. The plan's closing
(`org/plans/2026-09-ui-overhaul.md`) reads every row against its target.

## Findings, ranked

Priority is by what an operator meets: P1 is a screen that does not work at
a width the product claims; P2 is a screen that tells the operator something
untrue or twice; P3 is a click or a read that could be shorter; P4 is polish.
Each names the route, the width it was seen at, and the fix.

### P1 · The phone header crushes its title on every screen with wide actions

**Seen on** `/work/chat`, `/work/scripts`, `/agent/skills` at 390. The h1
reads "(", "Scr…", and the subtitle wraps one word per line ("Talk / to /
your / Hermes / agent") because the header's actions (Agent · Fast · New
Chat; New script · Refresh; the profile picker) sit on the title's row and
take its width. On `/agent/profiles` and `/agent/models` the same header
wraps its actions UNDER the title, which is right; the difference is only
whether the actions happen to be wide enough to force the wrap. The gates
did not see this: nothing overflows `main`, the words are simply crushed
inside it.

**Fix.** In `PageHeader`, below `sm` the actions slot takes its own full row
(`basis-full`) unconditionally, and the title block keeps the 16rem floor
the component already describes. One component, every screen. Add the
assertion to `tests/e2e/phone.spec.ts`: at 390 the h1's box is at least
12rem wide on every route. Effort: small.

### P1 · Chat does not stack on a phone

**Seen on** `/work/chat` at 390. The conversation list keeps its 240px
column, leaving the transcript about 100px: a failed-run alert renders one
word per line, the composer's send button is a sliver, and the gateway
banner is a card wider than the space it floats in.

**Fix.** Below `lg`, the conversation list is a Dialog sheet opened from a
"Conversations (1)" button in the header, and the transcript takes the
width. This is the split-pane the records have carried since T-0124
(Composer, Research and Logs are the same shape and Logs already stacks);
building it once as a `SplitPane` primitive answers four screens. Effort:
medium; the largest single improvement available on a phone.

### P1 · Banners with an action squeeze their sentence on a phone

**Seen on** `/agent/profiles` (drift banner: "Profile drift — database and
Hermes disk differ" in a 150px column beside "Push all to Hermes"),
`/agent/memory` (the health banner beside Retry), `/agent/models` (two "Pull
from Hermes" beside two one-line reasons). The sentence is what the banner
is for; the button took its room.

**Fix.** `LoadErrorBanner` and the drift banners wrap their action under the
sentence below `sm` (`flex-wrap`, action `basis-full sm:basis-auto`). Effort:
small; three files or one if the banners share a shell.

### P2 · The dashboard says ONLINE beside "Gateway · Not running"

**Seen on** `/` at both widths. The header's green dot reads ONLINE while the
Subsystems panel's first row reads "Gateway · Not running". Both are true
(the dot is PatterStage's own server; the row is the agent's gateway), and
put beside each other they contradict. Decision 10's sibling rule, "a fact
is said once, where it is best said" (T-0127), applies: the dot says a fact
nobody doubts (the page rendered) in the place the gateway's state should
be.

**Fix.** The header dot follows the gateway row's status word and tone, or
goes: the Subsystems panel already says it in a sentence. Effort: small.

### P2 · Two "Push all" controls sixty pixels apart

**Seen on** `/agent/profiles`. The drift banner carries "Push all to Hermes";
the sync bar under it carries "Push all" and "Pull all". Same action, two
buttons, and the banner's one is the more prominent though the bar's is the
canonical one. **Fix.** The banner states the drift and names the bar's
action ("use Push all below"), or the bar's Push all moves into the banner
when drift exists. Effort: small.

### P2 · The header subtitle is prose set in mono, on every screen

**Seen on** every route. `PageHeader` renders its subtitle as
`font-mono text-micro`. Decision 10 (mono for machine words, Inter for
prose) puts "Talk to your Hermes agent — tools, memory, live runs" and
"Deliverables your agents produced — reports, run outputs, saved snippets"
in Inter. This is also the single largest contributor to the mono share the
census counts (21 subtitles on 21 routes), and it is why the phone crush
above wraps so badly: mono at 12px has no hyphenation and long words.

**Fix.** Subtitle in Inter `text-body` on `ps-text-muted`, with any count
inside it in `font-mono tabular-nums` (the pending-count mark already does
this). Re-read the census: mono share should fall by two to three points.
Effort: small, one component; check the 390 header afterwards.

### P2 · Skills says "Active" beside a switch that says active

**Seen on** `/agent/skills`. Every one of 78 rows carries the word "Active"
in green, then the toggle, then Edit, then View. The word restates the
toggle's state; on a phone it costs the row a line. **Fix.** The word is the
toggle's accessible label, not a column; keep the green tone on the switch.
Effort: small.

### P2 · The chat failure toast repeats the alert and covers the composer

**Seen on** `/work/chat` (recorded at T-0128). When a run fails, the bubble
is the alert with the reason and Retry, and the toast at the foot of the
screen says the same sentence over the composer. **Fix.** `useChatSend` does
not toast a failure the transcript already shows; and the toast stack's
resting place moves above the composer on the chat screen. Effort: small.

### P2 · The gateway-offline notice floats as a card in the transcript

**Seen on** `/work/chat`. "Gateway Offline" renders as a centred card
between the header and the first message, 60% of the column wide, at 1440;
at 390 it is wider than the column. A standing state belongs in a banner,
full width, at the top of the transcript, and the composer should say why it
is disabled rather than accept a message and toast. **Fix.** One
`LoadErrorBanner` row above the transcript, composer disabled with the
reason as its placeholder. Effort: small.

### P3 · Missions puts the board 500px below the templates

**Seen on** `/work/missions` at 1440 (900px at 390). The Quick Load Template
section (heading, blurb, eight-way segmented control, eight category
accordions) sits above the status filter and the board, so on the busiest
screen the missions themselves start below the fold, and on an empty board
the operator scrolls past templates to read "No missions yet". **Fix.** When
the board has missions, the template section is a collapsed Disclosure ("12
templates") that opens on demand; when the board is empty, the empty state
carries "New Mission" and "Load a template" so the first action is one click
from the top. Effort: medium; needs the `Disclosure` primitive the records
have owed since T-0126.

### P3 · Empty pages keep their one action in the header

**Seen on** `/work/automation`, `/results/artifacts`. Automation's empty
state is a sentence with 700px of ground under it; the one thing to do,
"Schedule a mission", is in the section header. Story Weaver's empty shelf
does this right: the action is in the empty state. **Fix.** `EmptyState`
takes an `action` slot and both pages use it. Effort: small.

### P3 · The Settings section nav is a clipped horizontal strip on a phone

**Seen on** `/agent/settings` at 390. The sticky section list becomes one
row that runs off the right edge ("Agent Settings · Display Settings ·
Memory Setting…") with no scroll affordance. **Fix.** Below `lg` the nav is a
`Select` ("Jump to section") in the sticky bar. Effort: small.

### P3 · The sessions stat strip takes a whole phone screen

**Seen on** `/results/sessions` at 390. The donut, the MESSAGES tile and the
ACTIVE ring stack vertically to about 350px before the search field. **Fix.**
Below `sm` the strip is one row of three numbers (48 sessions · 1.3k
messages · 0 active); the rings are for the desk. Effort: small.

### P3 · Logs' header actions wrap onto three rows on a phone

**Seen on** `/results/logs` at 390. The help link sits alone on a row, then
the refresh toggle with the line count and Refresh, then Delete All. **Fix.**
The auto-refresh toggle and line count belong to the terminal's own toolbar,
not the page header; the header keeps Refresh and Delete All. Effort: small.

### P3 · Composer's submit reads "Review…"

**Seen on** `/work/composer`. The primary button under the form says
"Review…", which reads as "open a review" rather than "start this workflow";
the helper text beside it says "to enable the run". **Fix.** Name the action
("Run workflow") and let the dialog that follows be the review. Effort:
trivial.

### P3 · Composer still ships 524 KB of its own JavaScript

**Measured** on the final walk: 524 KB of route scripts at 1440, against 546
KB before the programme and a target of 160. U9 put the canvas behind
`next/dynamic`, which defers it but still loads it on this route, and the
Run tab does not need the canvas at all. **Fix.** Load the canvas only when
the Build tab is opened; the Run tab is a form and a list. Effort: small to
medium; measurable in the walk.

### P4 · Polish, each a line

- The rail footer's version line truncates the commit ("v0.1.0 ·…") at
  224px; show the version alone in the rail and the commit on Settings ›
  System, where it already is.
- Logs' terminal header draws three coloured dots (a window-chrome
  decoration); the product's own convention is no decoration that is not
  information.
- Research's Search / Depth / Breadth row leaves Breadth alone on a second
  row at 390; a two-column grid for the two numbers reads better.
- The Story Weaver title input uses a serif face for its placeholder alone;
  either the whole field is the reader's register or none of it is.
- The dashboard's "Launch a Mission · 12 templates" strip is cut at the fold
  at 900px tall; its first row of pills is the only one visible. Consider six
  templates and "more".
- Models' drift banner carries a "Pull from Hermes" per drift line; one
  action for the banner reads as one decision.

## Fewer clicks: what the walk timed

- Dashboard to a running mission: unchanged and fast (dispatch strip, one
  click, `role=status` at ~90ms). Kept.
- Dashboard to the latest transcript: one click ("open transcript"). Kept.
- Anything to Help for that screen: one click (the header's `?`). Kept.
- Settings: 27 pages became one; a field is search, then scroll. Two
  interactions from anywhere.
- Rec Room: five entries became two; a character or theme is on the create
  page. Kept.
- The one regression in clicks the programme introduced: none found. The
  one it left: Missions' first action on an empty board is a scroll and a
  click, where it could be a click (P3 above).

## The debt the programme recorded, consolidated

From the seventeen task records' `deferred` fields, deduplicated and in the
order a next programme would take them:

1. **The page layer.** 128 of 201 components have exactly one importer; 222
   inline card chromes in 87 files, 24 raw controls in 16 files, 77 raw
   palette hits in 34 files and 20 arbitrary z values in 15 files, all held
   in `design-lint`'s baseline and only able to fall. The primitive set
   exists; the pages have not all been moved onto it.
2. **Three primitives owed:** `Disclosure` (Missions' templates, the Errors
   panel's long messages, CharacterCard rows), `Chip` and `Slider` (five
   named raw-control gaps in Rec Room), and the `SplitPane` above.
3. **The Artifacts preview pane** (planned in U10, not built): an artifact is
   still opened rather than previewed.
4. **Charts:** two charts stroke `ps-viz-axis` at 1.27:1; `/results/insights`
   CLS 0.054 against a 0.02 target; the Activity chart has no dates on its
   axis.
5. **The data layer's tail:** the on-demand API reads in click handlers
   (profiles' file view, skills' content, scripts' content) could move onto
   `useApiResource` with `enabled`, so they cache too.
6. **Seven `ui/` files below the three-caller rule**, named in
   `design-tokens.md`.
7. **The census's mono share** counts text nodes; a character-weighted
   reading is the one the plan set its target on.
8. **The test corpus:** 139 exports used only by tests (knip with its Jest
   plugin off), a question for a test-corpus programme, not a UI one.

## What I would do next, in order

1. P1 ×3 (the phone header, the chat pane, the banners): one small batch,
   one primitive (`SplitPane`), and `phone.spec.ts` gains the h1-width
   assertion so it cannot come back. The product then works at 390 on every
   screen rather than on eighteen.
2. P2 ×6 (the ONLINE dot, the two Push alls, the mono subtitle, Skills'
   word, the chat toast, the offline notice): one batch of truthfulness and
   register fixes, each a line or a component, and the subtitle change is
   the one most likely to move the census's mono share.
3. P3 (Missions' board, the empty-state action, the phone Settings nav, the
   phone stat strip, Logs' toolbar, Composer's label and JavaScript): the
   `Disclosure` primitive lands here.
4. Then the page-layer deletion programme, which is where the line count
   the overhaul did not move actually lives.

The release actions (the v1.0.0 tag and what follows it) remain the
operator's, and nothing in this review blocks them: every finding is a
refinement of a product whose gates are green.
