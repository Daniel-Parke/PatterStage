# Changelog

All notable changes to PatterStage are recorded here, in the words of the person
using it rather than the person building it.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The work leading to the 1.0.0 release.

**Three things to do after upgrading.**

1. Open the Agents page and use **Pull all** once. An older version of the
   config reader could drop sections of `config.yaml` and force every profile's
   personality to "technical". One pull repairs the stored copy. Expect a drift
   warning or two on the way through; the pull clears them.
2. Update any bookmarks. Nearly every page has a new address (see below). The old
   ones redirect for this release only.
3. Let the app finish its first boot before using it. Four database changes are
   applied automatically, taking the schema to version 41. Nothing is deleted.

### Added

- **An Automation page.** One list of everything on a timer, missions and host
  scripts together, with what runs next, when each last ran, how that went, and
  a link to the log. The schedules section at the foot of Missions could only
  see PatterStage's own timer, so a script you had put on the machine's crontab
  appeared on Scripts and nowhere else; asking "what runs tonight" meant reading
  two screens and knowing in advance which kind lived where. Every row says
  which scheduler holds it, because a PatterStage schedule can be paused and run
  on demand from here and a host one is managed from Scripts, where its file is.

- **Quests.** A guided route through the product: 32 quests across seven
  chapters, from getting an agent answering to taking your first backup. Progress
  is worked out from the record of what you have done, so work already in that
  record counts. Most of the steps are proved by events this release starts
  recording, so some things you did earlier will need doing once more before they
  tick. Nothing to tick off by hand, and a completed quest stays completed even
  after old activity is trimmed. Find them at **Quests** in the sidebar, with a
  badge on the rail and the next step on the dashboard. Quests you are not
  interested in can be skipped, and the dashboard card can be hidden (there is no
  control to bring the card back yet).
- **Help inside the app, and a documentation site.** Every page header now carries
  a **?** that opens the guide for that exact screen, and pressing `?` anywhere
  does the same. The full set is browsable at **Help**, with search, and unfamiliar
  terms carry a hint you can click. The same pages are published as a static site
  you can open from disk or read online.
- **Backups you can take yourself.** Settings › System has a Backups card that
  snapshots the database on demand. Anything that overwrites or deletes your data,
  such as restoring the seed pack, now takes a snapshot first, and refuses to run
  if it cannot.
- **Settings › System.** One page for how this install is put together: data
  directory, schema version, ports, authentication mode, read-only state and
  version, copyable as a single block for a bug report. Update, rebuild and
  restart live here now.
- **A subsystems panel on the dashboard.** Five rows, always: gateway, memory,
  sync, the agent's config file, and gateway load. Each says what state it is in
  and why, in a sentence you can act on, so a broken config file no longer means
  reading a log to find out.
- **Search across settings.** The Settings index lists every section with the
  fields it holds, and searching narrows it to the sections that actually contain
  the word.
- **Scheduling without a crontab.** PatterStage can now run scheduled scripts on
  its own timer where the host has no crontab (Windows, most containers). Rows
  scheduled this way say "Runs while PatterStage is running" so the trade is
  visible, and the Scripts page says whether a schedule belongs to the host or to
  PatterStage.
- **Cancel controls where runs used to be unstoppable.** Deep research runs can be
  stopped mid-flight, and story generation has a Stop that aborts the request and
  ends the loop rather than letting one more chapter through.
- **A writing-model picker in Story Weaver**, defaulting to the agent's model, plus
  per-story spend now recorded against the same ceiling everything else is held to.
- **Two starter workflows in Composer**, "Research then summarise" and "Draft and
  review", both showing an approval gate doing real work. Workflows can be
  duplicated, and the note you leave when approving or rejecting a stage is shown
  on that stage and passed to the stage that runs again.
- **Session history you can navigate.** A Failed badge with the exit code, a Failed
  filter, search and filters kept in the URL so a view can be shared or reloaded,
  first and last page controls, a page size, plus search inside a transcript,
  expand all, role filters and copy.
- **A schedule card on missions** showing cadence, next run, last run and last
  result, and a plain sentence when a schedule will not fire and why. A mission
  that has run links straight to its sessions.
- **Rotating an API key** without losing the models that point at it, and
  providers that need no key are no longer asked for one.
- **Per-file copy and download in Logs**, and a Latest lines control when you have
  scrolled away from the tail.
- **Editing a profile's name and description**, and a display name for the
  built-in agent.

### Changed

- **The keyboard's focus ring is the same everywhere, and instant.** Text
  fields, selects and toggles used to swap the console's ring for a fainter
  one of their own that also lit up on a mouse click. They use the one ring
  now, and no control anywhere removes it. The ring also stops fading in from
  grey: it is there the moment focus lands, however fast you tab.
- **Reduced motion means reduced motion.** With "reduce motion" set in your
  operating system, every animation and transition in PatterStage now stops,
  spinners excepted, because a spinner is how a page says it is still working.
  Before, a short list of names was exempted and twenty-eight animations kept
  running, the logo's flame among them.
- **Tablets get the icon rail.** Between 768 and 1024 pixels wide the sidebar
  is the 64px icon column rather than a hamburger and a drawer, so a screen
  with room for it no longer gets the phone's chrome. The drawer starts below
  768, where it belongs.
- **A failed chat run is an error you can act on.** Where the reply would have
  been, the bubble says the run failed, gives the reason, and offers **Retry**,
  which sends the same prompt again as a new turn. Screen readers announce it.
- **The dashboard says each fact once.** Gateway and Memory were a pill and,
  a panel above, a row with the reason the pill had no room for; Errors was a
  pill and a panel. The row is three pills now - Scheduler, Spend, Processes -
  each wide enough for its second line, the Errors count sits in the Errors
  panel's own header, and the Subsystems panel, now the one place the gateway
  and the memory store are reported, says so with a Retry when the check
  itself fails instead of reading "Checking..." for ever. The board loads as
  a skeleton under its header rather than a spinner in an empty page.

- **Quests is one card level.** A chapter was a card, every quest in it was a
  card, and the badge a quest earns was a bordered tile inside that. The
  chapter is the surface; its quests are rows divided by thin rules, with the
  status word in a column of its own so every title starts at the same edge,
  Go and Skip side by side, and the achievement as a chip.

- **Help names itself.** The front page of the guides is titled Help, the word
  the sidebar and the tab already used, and every guide page carries a HELP
  link back to it beside its own title.

- **Story Weaver is two screens, not five.** The hub was four buttons to the
  other four screens and a row of tiles about them; the library, one click
  further in, was everything the hub showed and every story besides. The
  library is the Story Weaver page now, with the counts in its subtitle and
  the filters under it. Characters and Themes, two pages of lists that only
  the Create screen ever used, are panels on Create: every saved character
  and theme is still there to make, edit, use and delete, and adding a saved
  character to a story is one click on its row where it was a button and a
  picker. The three old addresses send you to where their content went.

- **The reader's chapter dots say what the rest of the product says.** A
  chapter being written pulses the same cyan a running mission does, a
  chapter you have read is green, one written but unread is the orange of
  "waiting for you", and a failed one is the same red as every other
  failure. The dots are large enough to press now. The reader's second,
  black page theme is gone: one warm register, its size and face still yours.

- **Settings is one page.** It was an index of 30 cards leading to 27 pages
  of three or four fields each, so changing two settings in different
  sections cost four navigations. Every section is on the page now, expanded,
  in its group, with its own Save and Reset; a list down the right names them
  all and marks the one you are reading, and the search narrows the page
  rather than a grid of doors. Nothing bookmarked is lost: the old address of
  every section sends you to that section on the new page.

- **One profile picker for the Agent screens, in the header.** Agents chose
  the profile with a column of cards, Skills with a dropdown, Tools with a
  card in the body: three controls for one choice. It is one control now, in
  the same place on all three, and the Agents page lists its profiles as a
  table with push and pull on each row, so the card for the chosen profile
  gets the full width. Two numbers on that page also stopped disagreeing: the
  performance strip now says "dispatched" for what it counts, and the growth
  block no longer prints a memory-facts count that was always zero.

- **Skills shows skills.** The page opened with a strip saying the same
  number five times and twenty closed category rows; not one skill name was
  on screen. A skill is one line now, and while the catalogue is small enough
  to show in full every category starts open, so the first screen is a list
  of skills. Large catalogues still start folded. An Inactive half with
  nothing in it is no longer drawn.

- **The models table fits a narrower window.** Below about 1280px its last
  column, the one with edit and delete, used to sit off the right edge with
  nothing to say so. The rows stack as labelled cards instead. The
  task-default descriptions wrap onto two lines rather than losing their
  ends to an ellipsis, and the page no longer carries a back arrow to a
  Settings parent it never had.

- **The Memory search row is one height**, and the "Press Enter to search"
  line under the box is gone; Enter searches, and the Recall button beside
  it says so.

- **The session list is half as tall.** A row was two lines and 77px; it is one
  line and 46px, so you see twice as many at once. Nothing was dropped to get
  there - the profile, the model, the size, the message count, the source and
  the age are all still on the row, in columns that line up down the list
  instead of wrapping. Narrow the window and they give way from the left, least
  useful first; the source and the age are what you scan by, so they stay
  longest.

- **The insights strips stop saying everything twice.** Every one of them drew
  a ring and then repeated the ring's own slices as tiles beside it. The ring
  names its own slices now, and a tile is kept only where it says something the
  ring cannot - how many lines were read, how many categories, how many
  credentials. The Logs strip has no tiles at all, because its ring, its centre
  and its gauge already say everything there is.

- **The run-duration histogram's labels are readable.** They were drawn inside
  a chart that stretches to fill its card, which squashed every character to
  little more than half its width. The chart is ordinary text and bars now, so
  the labels are the same size as the rest of the page whatever width the card
  happens to be.

- **The mission board no longer hides its last column.** Five columns each with
  a fixed minimum width were wider than the space available at every window
  size, and the row scrolled sideways silently, so Failed - the column you go
  looking for - was the half off the edge. The board wraps onto more rows
  instead, and nothing is hidden.

- **The mission filters say what they are.** Status and category are proper
  groups now, announced to a screen reader with the chosen one marked, and the
  status filter carries the counts that used to sit in four tiles above the
  board restating the columns below it. The whole filter bar is one tab stop
  rather than eleven.

- **Filter chips look like buttons.** The session filters were bare words until
  you chose one. They carry an outline at rest now.

- **A disabled button can be read.** Disabled controls were dimmed to the point
  of near invisibility; they keep their shape and take a quieter colour instead.

- **Almost every page has moved.** The sidebar is now five groups, named after
  what you are doing rather than after the subsystem behind it:

  | Group | Pages |
  | --- | --- |
  | Home | Dashboard, Quests, Help |
  | Work | Chat, Missions, Composer, Research, Scripts |
  | Results | Sessions, Artifacts, Insights, Logs |
  | Agent | Agents, Skills, Tools, Memory, Models, Settings |
  | Rec Room | Story Weaver |

  The full map of old address to new: `/orchestration/chat` to `/work/chat`,
  `/orchestration/missions` to `/work/missions`, `/orchestration/composer` to
  `/work/composer`, `/orchestration/scripts` to `/work/scripts`,
  `/laboratory/research` to `/work/research`, `/sessions` to `/results/sessions`,
  `/laboratory/artifacts` to `/results/artifacts`, `/laboratory/insights` and
  `/insights` to `/results/insights`, `/logs` to `/results/logs`,
  `/operations/agents` to `/agent/profiles`, `/operations/skills` to
  `/agent/skills`, `/operations/tools` to `/agent/tools`, `/memory` to
  `/agent/memory`, `/config/models` to `/agent/models`, `/config/seed` to
  `/agent/settings/restore`, and `/config` and its sections to `/agent/settings`.
  Every old address answers a temporary redirect, query string intact, **for this
  release only**. Page titles, browser tab titles and the sidebar now all take
  their wording from one place, so they can no longer disagree.
- **Personalities is now the Identity tab on the Agents page.** A personality
  belongs to a profile, so it is edited on that profile's own card rather than on a
  separate page. Both old addresses land on the tab.
- **Update, rebuild and restart moved out of the sidebar** into Settings › System.
  The sidebar keeps a version line and shows a badge when an update is available.
  Those controls now tell the truth before you click: if the deploy route is
  switched off they say so and stay disabled, a version check that failed reads as
  a warning rather than "up to date", and a deploy that never finishes releases
  the buttons instead of spinning forever.
- **The dashboard is now an operations board.** Six status pills (gateway, memory,
  scheduler, spend, processes, errors), each a link to the page that answers in
  full, the live panels, and one progress line. The charts, the mission mix and the
  trophy case moved to **Insights**, which is the history page. The clock, the Rec
  Room card and the Command Center block are gone.
- **Nothing on the dashboard reads green until it has been read.** A check that has
  not answered says "Checking", one that failed says "Unknown", and a panel nobody
  has read never reports "Healthy".
- **One vocabulary for states.** Draft, Queued, Running, Waiting for you,
  Completed, Failed, Cancelled; Healthy, Degraded, Not running, Not installed; In
  sync, Out of sync. Every status badge takes its word from one place, so the same
  mission no longer reads "Successful" on one screen and "Finished" on another,
  and one screen no longer says "ok" and "Healthy" about the same thing.
- **Destructive actions are two clicks in place**, on the button itself, instead of
  a browser confirmation box. Deleting a script, a scheduled mission, a story theme,
  an artifact, a memory or a workflow all work this way, and the armed button stays
  clickable.
- **A list that failed to load now says so, with a Retry.** Nine pages used to show
  their "nothing here yet" state when the read had in fact failed, which read as
  data loss. The empty state now appears only after a read that succeeded.
- **A saturated gateway is refused rather than left hanging.** Requests to the
  agent gateway are admitted a few at a time per endpoint; beyond that they queue
  briefly and are then refused with a message naming the endpoint and the counts.
  One slow endpoint can no longer starve the rest, and recovery is immediate when
  the gateway catches up.
- **Every list is bounded and newest first.** Missions, artifacts, models,
  schedules, chats, runs and research all honour a limit, and a nonsense limit is
  clamped rather than returning everything or erroring.
- **The Tools grid understands bundles.** A toolset already provided by an enabled
  bundle shows as on and says which bundle provides it, instead of offering a
  switch that does nothing. Hand-edited advanced JSON is now kept as the payload
  until you save or discard it, and the page says the grid is out of play while it
  stands.
- **Models are never imported behind your back.** Opening the Models page reads;
  it no longer writes. Re-importing from config is an explicit button, and an
  import keeps any name or address you edited yourself and says which fields it
  kept.
- **The Seed page is now Restore**, and it counts what the shipped pack actually
  contains rather than describing it, then shows what each restore did.
- **Memory has one provider switch.** The Memory page owns it; the matching field
  in Settings is read-only and points there. Saving also updates the agent's own
  config file to agree. The two stacked first-visit warnings became one "Set up
  memory" card carrying the address that fixes it, an empty result now says which
  kind of empty it is, and the number beside a fact is labelled as its proof count
  rather than a relevance percentage it never was.
- **Chat, Composer and Research errors surface where they happen** instead of a
  spinner that never stops or a refetch over the top of the failure.
- **Sync controls on Tools and Models read "Pull from Hermes" and "Push to
  Hermes"**, and a sync answer now says what actually happened per target rather
  than a bare success.
- **Keyboard and screen-reader use across the app.** A skip link before the
  sidebar, one visible focus ring, dialogs that trap focus, close on Escape and
  return focus to what opened them, a mobile drawer that is inert while closed, and
  51 controls that had a placeholder where their name should be now carry a real
  name.
- **Notifications stack.** Up to three at a time, and a success can no longer evict
  an error you have not read.
- **The sidebar remembers whether you collapsed it.**
- **Installing over an existing install** now backs the database up and asks you to
  type a confirmation before it moves your data aside, and says where it put it.

### Security

- **Script execution and updates now require authentication.** With
  authentication turned off, `POST /api/scripts/run`, saving a script, writing a
  crontab line and `POST /api/update` were reachable by anything that could reach
  the port. They are refused twice now, at the proxy and at the route. Turning
  authentication off is not the same as opening the host, and ordinary reads and
  writes are unaffected.
- **API keys are no longer sent to the browser in plaintext.** `GET /api/config`
  masks every `api_key` at any depth, including inside fallback provider lists.

### Fixed

- **Tab inside the phone's navigation drawer** could land on the hidden
  collapse control and seem to escape behind the backdrop; it stays on what is
  drawn.
- **Six screens no longer run past the edge of a phone.** Missions' template
  picker, the Memory tabs, and the header actions on Tools, Profiles, Logs and
  Models all wrap now instead of pushing the page 40 to 600 pixels out of
  sight with no scrollbar to say so.
- **Every control is at least 24 pixels tall**: Manage categories and Edit
  Templates on Missions, the two "where is it stored" disclosures on Profiles,
  and the budget line on Insights were between 16 and 21.
- **Three headers no longer read "0" while loading.** Models, Sessions and
  Artifacts said "0 models", "0 recorded sessions" and "0 artifacts" before
  their data arrived.
- **The agent's `config.yaml` no longer corrupts itself.** A rebuild could emit the
  same top-level key twice, misread the toolsets list, and never read the
  personality at all, and the damaged text was then copied back into the database,
  so one bad write became permanent and whole sections (model, auxiliary, memory,
  plugins) disappeared over following cycles. Config is now rebuilt as a whole
  object, nothing is written without parsing first, a file that will not parse is
  refused rather than laundered, and every refusal names the most recent backup
  that still parses. This is what the "Pull all" step above repairs.
- **Read-only mode no longer writes.** Three pages performed a write while merely
  being read.
- **Creating a story no longer fails with an empty error.** A one-word mood, an
  odd title or an unexpected field now gives a clear message instead of a blank
  500, and every request that fails now returns a reason.
- **A story interrupted by a restart is marked failed with the reason**, rather
  than sitting on "generating" forever. The same is true of a chapter that was
  being written.
- **Opening a half-finished story no longer starts writing on its own.** Chapters
  are written when you ask, one at a time or continuously, and a stop is not
  counted as a failure.
- **"Clone from: Default" now clones.** New profiles were being created from
  boilerplate rather than from the profile named.
- **A very large mission timeout no longer wedges the queue.** A timeout of a
  billion minutes did not exceed the safety cap, it replaced it, so a mission whose
  backend had vanished never timed out and held the one-at-a-time gate forever.
  Timeouts are now whole minutes from 1 to 4320.
- **A mission schedule that can never fire is refused before the mission is
  created**, rather than after, so a rejected schedule no longer leaves a stranded
  draft behind.
- **Choosing Schedule no longer starts a run there and then.** Putting a mission
  on a timer wrote the schedule and immediately dispatched a run, which on a paid
  provider is money nobody asked to spend. The mission now waits for the first
  time on its cadence, and **Run** on its row in Schedules still fires one by hand.
- **A schedule says what it runs.** A row showed its own name and its cadence and
  nothing else, so two schedules over two different missions were impossible to
  tell apart. Each row now says whether it runs a mission or a script and names
  it. The section is called Schedules, because it has been listing scripts as
  well as missions since scripts could be put on PatterStage's own timer.
- **Cancelling a finished mission is a success**, not an error in the log.
- **A chat no longer loses its session** when its title collides with an existing
  one. The name is retried with a suffix, and if it still cannot be created the
  log says so instead of silently continuing without one.
- **Deleting a Composer workflow no longer takes its run history silently.** The
  delete is refused, naming the workflow and how many runs would go with it, and
  goes ahead only when you confirm.
- **A Composer workflow's description survives a save.** It could be lost on the
  next write.
- **Every kind of script is listed, run and scheduled the same way.** The rule for
  what counts as a script was written out five times, and three of those copies
  disagreed with the other two: the backup script the installer sets up
  (`ps-db-backup.mjs`) really was in the crontab and reported "not scheduled"
  forever; `.ps1`, `.bat` and `.cmd` had a Schedule button that refused every
  time; and unscheduling anything that was not a `.sh` file failed with a
  not-found. All seven kinds (`.sh`, `.mjs`, `.cjs`, `.js`, `.ps1`, `.bat`,
  `.cmd`) now work end to end, and saving from the editor no longer adds a second
  extension to the file name.
- **A script that could not start no longer reports an exit code it never had.**
  A missing interpreter, or one the machine refused to start, was reported as
  "exited non-zero, check Logs", and the log it sent you to had nothing in it.
  Run now says the script did not start and why, the reason is written into the
  log as well, and only a script that really ran and failed sends you to the
  output.
- **The Scripts page remembers how the last run went.** The answer used to
  appear once, in a message, and was then gone, so nothing on screen could tell
  you whether last night's backup worked. Each row now says "ran", "failed" with
  the exit code, or "did not start", and how long ago that was. Runs PatterStage
  starts are recorded either way, including the ones its own timer fires, which
  previously left no trace at all when they failed. A run the machine's own
  crontab fires is still invisible to PatterStage, and the row falls back to the
  log's timestamp for it.
- **The skill viewer no longer crashes on top-level skills.** Two routes were
  sending two different shapes; there is one now, and the thinnest payload renders
  as a page.
- **Memory "Test connection" believes a healthy store.** It was reading only one
  level of the response and reporting a working store as a failure. Saving now
  keeps the provider you loaded rather than falling back.
- **Downloading a chat exports the conversation whose button you pressed**, not the
  one that happened to be open, and a read that was refused is reported as a
  failure rather than as an empty transcript.
- **Saving settings survives a push.** A save followed by "Push to Hermes" could
  revert the save. Clearing a default now clears it and stays cleared, "not set" is
  a state with its own Clear control, and minimum and maximum values are enforced
  on the server as well as in the browser.
- **The Settings index says when `config.yaml` cannot be read**, instead of showing
  an empty tree that looks like a fresh install.
- **The log pane scrolls, at every width.** Auto-scroll and the "latest lines"
  control could not work because the page was scrolling instead of the pane.
- **Deleting a story theme works**, and rows are removed from the screen only once
  the delete succeeded. "Save to library" reports the real answer, and a chapter
  heading no longer prints its number twice.
- **The chapter length and "chapters to regenerate" controls are read.** They had
  no effect.
- **Fresh installs no longer show a red alert on Logs** for the normal state of
  having written no logs yet.
- **The "no local install" banner no longer appears beside a working gateway.**
  With no local install and a reachable gateway, the dashboard says the agent runs
  through the gateway, at its address.
- **The data-directory warning at boot stays quiet** when you have actually set the
  data directory.
- **Mission statistics no longer overlap at 1280 pixels wide**, and the New Mission
  form no longer states a requirement before you have typed anything, contradicts
  its own hint, or hides the dispatch mode below the fold.
- **Session rows are valid to click and to tab through.** Links were nested inside
  links, and a transcript that failed to load said "Session not found" whatever the
  real reason was. A session with no transcript now says how it ended instead of
  claiming it does not exist.
- **"Hide API noise" describes one set.** It now filters on how long a session ran
  rather than a rule the rows, the count and the tiles each read differently.
- **A rejected request that names a method now says which methods are allowed**,
  and approving a Composer gate takes "accept" or "reject" with the others rejected
  by name instead of quietly routing to the wrong decision.
- **Failures during category rename, scheduled-mission delete, pause and run-now
  are shown** instead of the page reloading over them.

### Removed

- **The Personalities page**, its sidebar entry and its API. Editing a
  personality happens on the Agents page's Identity tab.
- **The "activate personality" control**, which changed nothing when clicked, and
  the "not implemented" sentence on the agent level card.
- **The Command Center block, the live clock and the Rec Room card** from the
  dashboard, along with the charts and trophy case, which moved to Insights.
- **Browser confirmation dialogs.** Every destructive action confirms in place.
- **The duplicate mission-cancel implementation**, which was a second answer to a
  settled question.
