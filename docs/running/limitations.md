---
title: Limitations
summary: "What PatterStage does not do, stated up front: one operator, one platform tier, one agent framework, the caps on the lists, and the features held back"
section: running
nav: 85
audience: operator
type: guide
tags: [product, ops]
compiled_from: authored
---
# Limitations

Every product has edges. These are ours, written down so you meet them here
rather than halfway through an evening's work. Each one is a fact about the
code as it stands, not a complaint about it, and several are deliberate
choices that buy something elsewhere.

## It is built for one operator

PatterStage is a control plane for one person on one machine. There is no
account system, and adding one is not a setting.

- **Authentication is a single shared secret.** One token is minted on first
  boot and every request presents it. There are no users, no roles and no
  per-person permissions. Two people holding the token are the same caller as
  far as the product is concerned. See [security](../SECURITY.md).
- **The token is equivalent to a shell on the box.** It grants mission
  dispatch, the script editor and the deploy actions, and the agent's own
  toolset includes terminal access. Handing someone read access means handing
  them everything.
- **The audit trail records what happened, not who did it.** Each line is a
  timestamp, an action, a resource and whether it succeeded
  ([`src/lib/api/audit-log.ts`](../../src/lib/api/audit-log.ts)). With one operator
  that is the whole answer. With two it is not, and the file will not tell you
  which of you it was.
- **Console preferences are install wide.** The collapsed rail, the dispatch
  strip, the quests you have completed or skipped and the last help page read
  live in one table keyed by preference name, with no owner column
  (`operator_prefs`). Open the console in a second browser and you are looking
  at the same state, not your own copy.
- **Progression is recorded per agent profile, and achievements once for the
  whole install.** Neither is per person, so neither divides between two people
  driving the same agent.

The consequence worth planning around: do not put PatterStage on a shared
machine and hand the URL round a team. Run one install per person, or reach a
single install over SSH port forwarding. Both start scripts bind every
interface, so the token is what protects the port, not the bind address.

## Platform tiers, and what native Windows cannot do

Linux is the supported and tested target. macOS is a best-effort developer
environment. On Windows, run under WSL2 (Ubuntu), which is a Linux environment
and therefore the fully supported path. The full ruling is in
[platforms](cross-platform.md).

The dev server incidentally starts on native Windows, because the OS seam
carries thin Windows fallbacks, and it is worth knowing exactly what you lose
if you try:

- **No host scheduler.** Scheduling a host script uses the user crontab on
  Linux and macOS, and those rows fire whether PatterStage is running or not.
  Native Windows has no crontab and there is no Task Scheduler backend, so the
  Schedule button writes a PatterStage schedule row instead and PatterStage's
  own timer runs it. The honest cost, which the Scripts page states on the row
  and in the modal, is that it only fires while PatterStage is running. The
  answer comes from `hostSchedulerAvailability()` in
  [`src/lib/host/host-scheduler.ts`](../../src/lib/host/host-scheduler.ts) and travels in
  the API response as `scheduler: { available, reason }`.
- **The bundled shell scripts need a shell.** Setup copies every `.sh` and
  `.mjs` from the hardware directory into your data directory, so the Scripts
  page lists both. The Node versions run anywhere; the bash siblings, and the
  Hindsight backup script, need bash.
- **Install, deploy and self-update are Unix programs.** The bootstrap and
  deploy paths are bash and Node written against Unix; the PowerShell installer
  is a pointer to the WSL2 steps, not a second installer.
- **Nothing tests it.** Continuous integration builds and tests on Ubuntu and
  macOS. There is no Windows job, so a Windows-only regression has nothing
  watching for it.

There is also no packaged desktop application, no installer bundle and no
hosted version. You clone a repository and run a script.
See [installing](../start-here/install.md).

## It needs an agent, and something for the agent to call

PatterStage drives an agent. It does not contain one.

- **Hermes is the only agent framework implemented.** The code has a seam for
  a second one, and there is no second one behind it: the framework registry
  resolves every value to the Hermes adapter, and the workspace port resolves
  through the Hermes paths.
- **The console starts fine with no agent installed, and says so.** Missions,
  Sessions and Profiles carry a notice reading that the agent is not installed
  and that you can configure PatterStage now but nothing will actually run.
  That is the true state: you can write missions, build profiles, edit skills
  and read the documentation, and none of it will execute.
- **A model provider is a separate requirement.** Work either goes through the
  Hermes gateway or directly to a provider using a model row and its stored
  credential. With neither, the features that call a model on their own behalf
  cannot run at all: Story Weaver, deep research and anything else driving a
  model directly. Adding a model means adding a credential, which means a
  provider account and its costs.
- **Long-term memory is one implementation.** The provider layer is pluggable
  and Hindsight is the only client that ships. Selecting a type with no client
  gives you a provider that refuses honestly and names the type it cannot
  serve, rather than one quietly talking to a different backend. Hindsight
  itself is a separate service with its own Postgres and server to install.
- **The spend budget warns; it does not police you.** A budget figure is
  optional and the shipped state is no figure at all. Setting one warns. The
  hard stop is a second switch, off until you turn it on, and it governs
  unattended work only: a dispatch you make yourself is never blocked, because
  you are answering for the spend as you click. Budget windows are UTC calendar
  days, weeks and months, so "today" starts at UTC midnight and not yours.
  See [spend](../reference/spend.md).

## Held back for a later release

These are known gaps with no date attached. They are listed because a gap you
know about is a smaller problem than one you discover.

- **There is no keyboard command palette.** No shortcut opens a search-and-jump
  box. You navigate with the rail.
- **A transcript is capped and rendered whole.** A session answer carries the
  newest 2000 messages and the page says when older ones were left behind. Those
  messages render one at a time with no virtualisation, so a very long
  transcript is a heavy page. A transcript file over 64 MiB is refused outright
  with a 413. Both ceilings are adjustable: see `MAX_SESSION_MESSAGES` and
  `MAX_SESSION_FILE_BYTES` in the [environment reference](env-reference.md).
- **Listing sessions still syncs on the read.** Loading the list pulls the
  agent's session state into the database as part of answering, debounced to at
  most once every thirty seconds. In read-only mode the writes are skipped and
  the list is served from what is already stored.
- **Log search is client side.** The Logs page fetches a tail of 100, 200, 500
  or 1000 lines, and the filter box searches the lines it already has. Nothing
  searches the whole file on the server, so a match older than the tail you
  fetched will not be found.
- **Run now waits for the script to finish.** Running a host script on demand
  blocks until it exits, with a ten minute timeout and an eight megabyte output
  buffer, then writes the output to the script's log for you to read. Output
  does not stream while it runs.
- **Configuration is edited by section.** There is no raw editor for the agent's
  configuration file in the console. What you get is the section forms.
- **Composer keeps no version history**, and its run list is not paginated on
  the server.
- **Story Weaver has no export and does not remember your reading position.**
- **Spend has no page of its own.** The figures appear beside the work that
  produced them.
- **The in-app help is not public.** Every route except the health endpoint
  requires the token, the help section included. The same pages are published as
  a static site from `docs/`, so link that rather than your install.
- **There is no OpenAPI description of the HTTP API.** The
  [API reference](../reference/api.md) is written, not generated from a schema.
- **PatterStage writes its own deploy logs into the agent's home directory**
  (`~/.hermes/logs`), rather than keeping them with its own data. They are
  listed in the console like any other log, but a clean separation of the two
  installs is not there yet.
- **Only a desktop viewport is covered by the browser tests.** The shell has a
  compact header for narrow screens, and the end-to-end suite runs one desktop
  project, so small-screen behaviour is not proven by a gate.

## Scale, and what the lists actually hold

The data store is one SQLite file on your machine, opened by one server
process. That is the right shape for a single-operator console and it is not a
shape that scales sideways: there is no second node, no shared database and no
horizontal anything.

Read routes bound what they return, so a long history makes a list stop
growing rather than make the database work harder:

| List | Default | Maximum |
|---|---|---|
| Missions, models, schedules, artifacts | 200 | 500 |
| Chat conversations | 100 | 500 |
| Composer runs, research runs | 50 | 500 |
| Sessions | 50 | 100 |

Sessions is the only one of these with an offset, so it is the only list that
pages through history rather than showing a window onto the newest rows. The
others answer with the newest and stop; the older rows are still in the
database, and reaching them means asking with a higher limit up to the maximum.

Lists that hold what you authored rather than what has accumulated, such as the
skills catalogue, the template list and the running agent processes, return
everything they have. They grow with your own work, not with elapsed time.

Two other ceilings are worth knowing:

- Reads of the sessions API are rate limited to 120 per client per rolling
  minute, and the 121st is answered with a 429. Normal browsing stays well
  inside that; a script polling the list in a loop will not. The ceiling is
  `SESSIONS_API_RATE_LIMIT_MAX` in the
  [environment reference](env-reference.md).
- Nothing prunes your history by default. Both retention policies ship off, on
  fresh installs and on upgrades alike, and the prune is a command you type on
  the machine that owns the data. There is no HTTP route for it and no
  scheduler wiring, deliberately, so history grows until you decide otherwise.
  See [upgrades and migrations](migration.md).

## Upgrades go forward only

- **The schema version strictly increases.** There is no downgrade path and no
  reverse migration. Going back to an older version means restoring the
  automatic pre-migration backup taken before the schema moved.
- **The update action discards local commits.** It resets the checkout hard to
  the remote branch, so the application directory has to be a deploy checkout
  and not somewhere you keep work.
- **Restart kills whatever is listening on the configured port.** A wrong port
  value kills an unrelated process, so set it deliberately.

The details, and the backups that make each of these survivable, are in
[deploying](deploy.md) and [backup and restore](backup.md).

## If you have hit one of these

[Troubleshooting](troubleshooting.md) is organised by symptom, and several of
its entries are the product working exactly as described above.
