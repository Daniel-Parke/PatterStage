---
title: Missions
summary: How missions are stored, dispatched and cancelled, and how the stored prompt is built
section: guides
nav: 30
audience: operator
screen: /work/missions
concepts: [mission, run, schedule]
type: guide
tags: [product, missions, schedules]
compiled_from: authored
shots: [docs/images/missions.png]
---
# Missions

Missions is where you write a job for the agent, decide when it should run, and read what came back.

## What you see

![Missions screen](../images/missions.png)

**The header.** The page title, a refresh icon that reloads the board by hand,
and **New Mission**, which opens the composer. If no agent is installed on this
machine, an orange notice sits under the header and says so. You can still write
and save missions, but nothing will actually run until the agent is there.

**The summary strip.** Appears once you have at least one mission. A ring
showing the mix of states, count tiles for Total, Running, Completed and Failed,
and a success percentage worked out from finished missions only. It is counted
from every mission on the board, so it does not narrow when you filter or
search; the column counts beside it do.

**Quick load template.** Your templates as clickable pills, grouped into
category accordions. Clicking one fills the composer and opens it; nothing is
dispatched. On the right of that row are **Manage categories** and
**Edit Templates**. Filter pills for template categories appear only when your
templates span more than one category. The whole section hides while the
composer is open.

**Filters.** A row of category pills (All missions, then one per category with a
count), a status filter (All, Draft, Queued, Running, Completed, Failed), and a
search box.

**The board.** Five columns in that order. Each card carries a status dot, the
mission's name, its category, and a labelled duration: "Queued 3m 20s",
"Running 2h 14m", "Completed 5m 12s ago"; seconds are dropped only above an
hour. A running mission's dot pulses. One that
has passed its timeout turns orange and picks up a warning triangle. Each column
header shows a count; Completed and Failed show their five most recent rows with
a **Show all** link when there are more. If the board cannot load, a banner with
a Retry appears in place of the list, so a failed read never looks like an empty
install.

**The detail panel.** Clicking a card expands it underneath the row. At the top,
a grid of facts: Agent, Model, Provider, Scope, Timeout, how long the mission has
been running or how long ago it finished, Category, Cadence ("One-shot" unless
the mission has a schedule) and how many skills are attached. Then
**Full Template Details**, which shows and hides the stored prompt; the Goals, if
any; a Schedule card with the next and last run, the last result, and a line
telling you when the schedule will not fire at all (paused, used up, or nothing
scheduled next); a timing note saying how long is left before the timeout bites;
the live output while the mission is running; the Result; and, on a failed
mission, the agent's own error text.

The panel's buttons are Copy prompt, Duplicate, View sessions (only when the
mission has produced one), Edit (Edit draft on a draft, Re-dispatch on a finished
mission), Cancel or Remove from queue while it is still live, and a bin icon.
Cancel and delete both ask a second time before they act.

**Schedules are not here.** They used to be a section at the foot of this
page, listing everything on PatterStage's own timer. That list could not see a
script scheduled into the host's own crontab, so it looked complete and was
not; it now lives on [Automation](automation.md) together with those, which is
one list of everything on a clock. This page keeps dispatch. A mission you are
writing can still go straight onto a timer from the composer's **Schedule**
dispatch mode, and it appears there.

**The composer.** A panel that slides in from the right, titled New Mission,
Edit Mission, or Re-Dispatch with the mission's name. At the top: Category,
Mission Name, Instruction, and Goals, one per line. Then four numbered steps.

1. **Dispatch**, open by default: Save, Queue, Run now, Schedule. Choosing
   Schedule reveals a cadence picker with presets, a custom day-and-time builder
   and a raw cron box, and it previews the next three fire times.
2. **Mission parameters**: working directories (with a folder browser, and a
   branch selector when the folder is a git repository), references, recommended
   agent skills, recommended Hermes toolsets, additional context, output format
   and constraints.
3. **Runtime**: model, agent profile, mission scope, and timeout, which is an
   inactivity kill switch rather than a total run length.
4. **Assembled agent prompt**: the prompt as it will be stored, with a Human and
   AI toggle and a copy button. The Human view mirrors your form fields; the AI
   view is what the agent is actually sent.

The footer holds the submit button, a **Save as template** button once the
instruction has text, and Cancel. On a new mission or a draft the submit label
follows the dispatch mode you picked (Save draft, Queue mission, Dispatch now,
Schedule mission). Re-dispatching reads Re-Dispatch Now and editing a running
mission reads Update Mission, whatever mode is selected; on a queued mission,
Save reads Move to drafts and Queue reads Update queue. The submit button is
disabled until the mission has a name and an instruction, and, on a new mission,
until the Dispatch step is open, since being open is how you acknowledge the run
mode. Hovering says which of the three is missing.

## Typical use

### Write a mission and run it now

1. Click **New Mission**.
2. Give it a name and write the Instruction. Add goals, one per line, if you
   want the agent working to a checklist.
3. In **Dispatch**, choose **Run now**. Open **Runtime** first if this job needs
   a particular agent profile rather than your default.
4. Click **Dispatch now**. The composer closes, and the new mission appears on
   the board in Running with its panel already open, streaming the agent's
   output as it arrives.

### Put a mission on a repeat

1. Write the mission, or open a draft you saved earlier.
2. In **Dispatch**, choose **Schedule** and pick a cadence. The picker shows the
   next three times it would fire, so you can check it before committing.
3. Click **Schedule mission**. Nothing runs yet: the schedule appears in
   **Schedules** at the foot of the page, and the first run happens at the next
   time on the cadence. The mission itself waits in **Draft** until then, with
   its cadence and next run in its panel.
4. From that list you can pause it, resume it, fire it once by hand with
   **Run**, or delete it. Deleting the schedule leaves the mission itself alone.

To put a mission you already have on a timer without going through the composer,
use **Schedule a mission** in that same section: pick the mission, type a cadence
or take one of the presets, and choose whether a missed occurrence should fire
once late or be skipped.

### Stop one, or send it again

1. Expand a running mission and click **Cancel**, then **Confirm**. The agent's
   run is stopped and the card reads Cancelled.
2. To repeat a mission that already finished, expand it and click
   **Re-dispatch**. The composer opens with its fields filled in, and submitting
   creates a new mission and dispatches it. The original record stays on the
   board so you can still read what it did.

## Notes

- The board refreshes itself every 15 seconds while the tab is visible, and
  pauses while it is hidden. The refresh icon in the header forces a reload.
- **Save** and **Queue** are not the same thing. A saved mission is a draft and
  sits there until you come back to it. A queued mission is waiting to be picked
  up on its own.
- Only one mission runs at a time. Queued missions and scheduled missions both
  wait for the running one to finish, which is why a queued mission can sit
  there for a while. **Run now** is your own deliberate act and is not held back
  by that rule, so it can start alongside something else.
- If you have set a hard spend stop and reached it, unattended dispatch stops:
  queued missions stay queued and schedules pause rather than skipping their
  turn, and both resume when the period rolls over or you raise the figure. See
  [spend](../concepts/spend.md).
- Cancelling is recorded as your own action, not as a fault. The row reads
  Cancelled with the note "Stopped by the operator", and is not painted in the
  failure colour.
- The model you pick is recorded against the mission and its
  [session](../concepts/session.md), but what actually answers is decided by the
  agent profile's own configuration. If you need a different model for real,
  change it on the profile rather than only here.
- Recommended skills and toolsets are hints written into the prompt. What the
  agent is genuinely allowed to use comes from its profile, so recommending a
  toolset the profile does not have will not grant it. See
  [Tools](./tools.md) and [Skills](./skills.md).
- Timeout is an inactivity kill switch, not a budget for the whole job. Mission
  scope is a planning hint to the agent about how much work to take on.
- Built-in templates cannot be edited or deleted; only the ones you save can.
  **Save as template** overwrites an existing template of the same name, and
  asks twice before it does.
- Deleting a category asks where its missions and templates should go first,
  either to another category or to none. Deleting a mission also removes any
  schedule attached to it, and cannot be undone.
- A mission is a single stage with no branches and no approval gates. If the job
  needs several stages that check each other, that is
  [Composer](./composer.md). If you want a shell script on a timer rather than
  an agent, that is [Scripts](./scripts.md).
- Everything a mission produced is on the sessions screen, and **View sessions**
  in the detail panel opens it filtered to that mission. See
  [Sessions](./sessions.md), and [mission](../concepts/mission.md) for how a
  mission relates to a [run](../concepts/run.md) and a
  [schedule](../concepts/schedule.md).

<details>
<summary>Under the hood</summary>

Missions live in SQLite, in the `missions` table, and the database is the single
source of truth. The board's five columns are two fields: a draft is
`status=queued` with `queued_for_run=0`, a queued mission is the same status
with `queued_for_run=1`, and Running, Completed and Failed are the `dispatched`,
`successful` and `failed` statuses. A cancellation is stored as `failed` with
the result "Cancelled by user"; the run row carries the honest `cancelled`
status, which is what the board reads to print the word.

The composer sends raw fields and the server assembles the stored prompt as XML
under `<hermes_mission>`, which is what the AI view of the preview shows. The
personality behind the profile (SOUL and AGENTS files) comes from Hermes under
`~/.hermes` and is not part of this prompt.

Every write goes to `POST /api/missions` with an `action`: `dispatch` for a new
mission, `promote` for a draft or queued mission you are re-submitting, `update`
for one that is running, plus `cancel` and `delete`. The dispatch modes map to
`dispatchMode: "save" | "queue" | "now" | "cron"`. Recurring missions are rows
in the `schedules` table, with PatterStage owning the timer: the scheduler tick
recomputes from `next_run_at` rather than an in-memory timer, so it survives a
restart, and a deterministic run id makes each occurrence fire exactly once.
The agent's own `jobs.json` cron is not used. Cancelling calls the Hermes API
server's stop endpoint over HTTP, with no signals or pid files, and finalises
the local mission, run and session rows even if that call fails.

Custom templates are one JSON file each under the templates folder in your data
directory; built-in templates come from the catalogue in the database, which is
why they are read-only. Categories are the `mission_categories` table, seeded
with eight entries by `npm run db:seed`.

If the composer says "No categories loaded", the database is behind the code.
Run `npm run db:migrate` on the host, check that `PS_DATA_DIR` in `.env.local`
matches where the server keeps its data, and restart PatterStage; `npm run build`
alone does not migrate a live database. See
[Data storage](../running/data-storage.md).

</details>
