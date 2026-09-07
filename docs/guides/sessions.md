---
title: Sessions
summary: "Every conversation the agent has had, filtered, searched and read back"
section: guides
nav: 70
audience: operator
screen: /results/sessions
concepts: [session, transcript, run]
type: guide
tags: [sessions, transcripts, history]
shots: [docs/images/sessions.png]
---

# Sessions

Every conversation the agent has had on this machine, whatever started it,
newest first and readable in full.

## What you see

![Sessions screen](../images/sessions.png)

At the top, the page name and a count of the sessions the current filter
matches. If no agent is installed yet, an orange notice sits under the heading
saying that recording sessions needs one, because an empty list would otherwise
look like "you have not run anything" rather than "nothing here can produce a
transcript".

Below that, a strip of figures. A ring on the left splits the sessions by what
started them (CLI, Mission, Cron, API, and Other for anything else) with the
total in the middle, and a legend beside it naming each source and its count.
Then one tile, **Messages**, and a second ring showing how many of the matching
sessions are still running. Every figure counts the whole matching set, not the
page you happen to be looking at, and the strip is hidden entirely when there is
nothing to count.

The tiles used to repeat the ring: Active, Total and CLI were the ring's own
segments and its centre, printed a second time beside it. The ring names them
itself now, and the tile is what neither picture carries.

Then the controls:

- A search box, **Search sessions by title, ID, profile, or mission id**. It
  searches the whole history, not just the rows on screen.
- A filter row: **All**, then one button for each source that actually appears
  in your history (CLI, Cron, Mission, API, Chat, Subagent, TUI, and any other
  value printed as it stands), and a red **Failed** button.
- A view row: **Group by mission**, on by default, and **Hide API noise**, off
  by default, followed by a small legend showing that a pulsing green dot means
  live.

Under the controls, a line saying how much you are looking at, such as
"Showing 12 entries of 341 total", with "API noise hidden" appended when that
toggle is on. Then the list itself, one panel with a divider between records.

A session row is one line. From the left: a pulsing green dot if it is still
running, the session's title, a red **Failed** badge when it ended badly
carrying the exit code where there is one, and a green **mission** badge when a
mission produced it. Then the columns, right-aligned so they line up down the
list: the profile it ran under, the model, the transcript size in KB, a message
count such as "42 msgs", a coloured source badge, and when it started (a live
session counts up instead, "3m 12s ago"). A chevron closes every row at the same
place.

Narrow the window and the columns give way from the left, least useful first:
the profile goes, then the model, then the size, then the message count. The
source and the age are what you scan a list of sessions by, so they are the last
to leave. Nothing is dropped that was not there to be dropped - the row used to
stack the same facts on a second line, which made it 77px tall and the list
3,621px of scroll.

The mission badge opens that mission's panel on the [Missions](./missions.md)
board; anywhere else on the row opens the transcript.

With **Group by mission** on, sessions sharing a mission collapse into a single
green row: the layers icon, the newest session's title, "4 on this page", "2
active" when some are still running, the span from first to last, the first
eight characters of the mission id, and an **↗ Mission** link. Clicking the row
expands it into the individual session rows.

At the foot, paging appears once there is more than one page, with a page size
of 25, 50 or 100. When nothing matches you get **No sessions found**, which says
"Try a different filter" if a filter is on and "No recorded sessions yet" if not.
If the list cannot be loaded at all, a banner says so and offers **Retry**.

### Inside a session

Opening a row gives you the transcript. The header has a **SESSIONS** arrow back
to the list, the session's title, and a subtitle with the model, the message
count and the size. On the right: **↗ Mission** when a mission started it,
**Expand all** (which becomes **Collapse all**), **Copy transcript**, a
**⟳ Refresh** button that appears only while the session is still running, and
one button per role with its count, such as "42 assistant". Clicking a role
button filters the transcript to that role; double-clicking jumps to the next
message of that role; a **clear** button appears while a role filter is on.

A failed session opens with a red panel naming the failure, the exit code and
the error text. If the transcript was long enough to be capped, a line says the
most recent messages are the ones shown. Below that, a **Search this transcript**
box, and a count of how many messages are showing when either narrowing is in
force.

Messages are collapsed cards labelled USER, ASSISTANT, TOOL or SYSTEM, each
showing the first line as a summary and, for long ones, their size. Expanding a
card shows the full text with a copy button, and any tool calls the message made
with the arguments it passed.

## Typical use

**Read what a mission actually did.**

1. On the [Missions](./missions.md) board, open the mission and press
   **View sessions**, the link that appears once the mission has produced one.
   You land here with the list already narrowed to that mission's sessions.
   (Pasting the mission id into the search box gets you to much the same place.)
2. Open the newest row. The transcript is the whole thread: your instruction,
   the agent's replies, every tool it called and what each returned.
3. To see only the tool work, click the **tool** role button in the header.
   Double-click it to jump from one tool call to the next.

**Chase a failure.**

1. Press **Failed** in the filter row. The list narrows to sessions that ended
   badly, each row showing its exit code in the badge.
2. Open one. The red panel at the top of the transcript repeats the exit code
   and the error, and the last few messages before it are usually where the work
   went wrong.
3. Use **Copy transcript** if you want the thread somewhere else. It copies the
   messages currently shown, so filtering to a role or searching first copies
   only those.

**Watch something that is still running.**

1. A live session has a pulsing green dot and an elapsed time that counts up.
   While anything on the page is live, the list re-reads itself every ten
   seconds.
2. Open it. The header offers **⟳ Refresh**, and the page keeps polling on the
   same interval, so new messages arrive without a reload. A session that has
   started but not yet written anything says so instead of showing an empty
   transcript.

## Notes

The list is everything, not only what you started from this console. Sessions
from missions, from chat, from schedules, from the command line and from direct
API calls all land in the same place, which is the point of the page.

**Grouping is per page.** "4 on this page" means exactly that: a mission with
more sessions than fit in one page of results shows the rest when you page on or
raise the page size.

**Hide API noise is deliberately narrow.** It hides only API sessions that
stayed under a kilobyte and lived less than a minute, the chatter that a busy
integration produces. Nothing longer or larger is ever hidden by it. This toggle
and the grouping toggle are remembered in this browser.

**Search matches the title, the session id, the profile and the mission id**,
and runs over your whole history rather than the page on screen. It does not
search inside messages. That search lives in the transcript itself, and it looks
at message text and tool names.

**The view lives in the address bar.** Your search, source, failed filter,
mission and page are all in the URL, so a narrowed list can be bookmarked or
sent to yourself, and coming back to it returns the same view rather than the
default one.

**Long transcripts are handled honestly.** A very long one sends the most recent
messages and says on screen that it did. A transcript file over the size ceiling
is refused with "Transcript too large to display" rather than loaded half way,
and each other failure gets its own heading, with a Retry: an invalid link, a
session that is not there, and too many requests in a minute do not all claim
the session was not found.

**Nothing here changes anything.** The page reads; it does not delete, edit or
re-run. There is no cost to opening a transcript, because nothing is sent to a
[model](../concepts/model.md) to show it. The session list is stored in the
PatterStage database, so it travels with a [backup](../running/backup.md) and
comes back with a restore. The transcripts themselves are read from the agent's
own home, or from mission output files sitting beside the database, and a
snapshot covers neither, so a restore brings the list back rather than the text.
The backup guide sets out the three stores and which one it takes.

Related reading: [session](../concepts/session.md) and
[transcript](../concepts/transcript.md) for the two ideas behind this screen,
[Artifacts](./artifacts.md) for the files a session produced rather than the
conversation that produced them, and [Logs](logs.md) for the server's own
output, which is a different record entirely.

<details>
<summary>Under the hood</summary>

The list is `GET /api/sessions` and one transcript is `GET /api/sessions/<id>`.
The list request syncs Hermes' own `state.db` from the agent workspace into the
PatterStage database before answering, debounced to at most once every 30
seconds, with a shorter inline sync so a session you are currently in shows a
fresh message count. Under `PS_READ_ONLY` the sync is skipped and the list is
served from what was already stored.

Both surfaces poll every 10 seconds while something is live, and not at all
otherwise.

Limits, all with defaults you can override in the environment:

| Variable | Default | What it caps |
|---|---|---|
| `MAX_SESSION_MESSAGES` | 2000 | Messages one transcript response carries. Over it, the newest are sent and the page says so. |
| `MAX_SESSION_FILE_BYTES` | 64 MB | Transcript file size. Over it, the request is refused with 413. |
| `SESSIONS_API_RATE_LIMIT_MAX` | 120 | Session requests per client per minute. Over it, 429. |

The "API noise" rule is `source = 'api'` and under 1024 bytes and a duration of
60 seconds or less, applied in SQL so the rows, the count and the tiles all
describe the same set.

URL parameters on this page: `search`, `source`, `status=failed`, `missionId`,
`page` (1-based) and `size`. Defaults are left out of the query string. The two
view toggles are browser storage, under `ps.sessions.groupByMission` and
`ps.sessions.hideApiNoise`.

</details>
