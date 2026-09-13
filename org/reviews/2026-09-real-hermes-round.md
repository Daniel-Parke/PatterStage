# The real-Hermes round

PatterStage driven end to end against a real Hermes agent on MiniMax M3, on the
operator's own machine, as the last check before a 1.0.0 tag. Seven chapters of the
quest ledger were driven by seven testers working in parallel against one isolated
instance: its own database, its own copy of the agent home, a real API server on
8642, and real money.

This is the record of what that found. It is deliberately in two halves, because a
release needs both: what the product demonstrably does, and what still hurts.

## The headline

**It works.** A mission dispatched from the browser reached a real agent, ran, and
came back with the right answer in about nine seconds. Chat answered in three. The
quest ledger ticked itself from events the server had already recorded, with nothing
to mark off by hand. The Subsystems panel told the truth about a memory provider that
was genuinely unreachable, naming the address it had tried.

**And it had a blocker.** The starter workflow the quest ledger points a newcomer at
reported success without doing the one thing it is named for. That is fixed, with the
fix proved on a live run, and it is the single most valuable thing this round bought.

## By the numbers

| | |
|---|---|
| Chapters driven | 7 of 7 |
| Findings confirmed | 105 |
| Findings refuted on review | 5 |
| Blockers | 1 |
| Majors | 27 |
| Minors | 59 |
| Polish | 18 |
| Things that worked well, recorded | 61 |

Five reported problems were refuted on review rather than fixed. That number matters:
a round that confirms everything it is told is not reviewing anything.

## What the product proved it can do

Recorded because a release needs to know its own value, and because these are the
things a change must not break.

**The dashboard answers 'what do I do first' before you ask** (Getting running). START HERE is the top card on /, above everything else: 'CHAPTER 1 · GET RUNNING / Add a model / Add a model on the Models page, so the agent has something to think with' with a Go button that lands on the right page (NextQuestCard.tsx:75 uses quest.screen as the href). It is live, not static: once I finished 1.1-1.3 it had moved itself on to 'CHAPTER 2 · MISSIONS / Watch it fire' by the next page load. For a newcomer this is the single best thing in the product.

**Quests tick from facts the server already recorded, and they tick fast** (Getting running). The Quests page says it plainly: 'Each ticks itself when the product records you doing it, so there is nothing here to mark off by hand.' 1.1 and 1.2 were true in /api/stats by the time the page had finished re-rendering; 1.3 within seconds of the reply landing. Nothing to self-certify, which is the right design.

**Chat works first time and is genuinely quick** (Getting running). Agent mode: message in at 11:23:42, reply persisted at 11:23:45, about 3 seconds for a real agent run against MiniMax M3. Fast mode: about 2 seconds. Both worked with an empty PatterStage model registry, i.e. it did not need me to configure anything first.

**The Agent/Fast toggle explains itself in place instead of in docs** (Getting running). Empty state changes with the mode: 'Agent mode: the assistant can use tools and remembers this conversation.' vs 'Fast mode: a quick raw-model reply with no tools.' That is exactly the sentence a newcomer needs at the moment they are deciding which button to press.

**ConceptHint is a real inline glossary and it works** (Getting running). Clicking the underlined word 'prompt' on the chat empty state opened 'Prompt, The text you hand the agent, and the standing text it always carries with it' plus 'Read more about Prompt'. Twenty concepts are backed by docs/concepts/*.md and the same words appear as TEACHES chips on each quest. This is how you teach vocabulary without a tutorial.

**The reply is shown as an answer, with the thinking folded away** (Getting running). The agent's 'ready' rendered as the message body with a collapsed 'REASONING' chip above it, not a wall of chain-of-thought.

**Secrets are handled honestly on both ends** (Getting running). Before you paste anything the field says 'Stored plain text in the registry and synced to ~/.hermes/.env so Hermes can read it', that is a disclosure most products skip. And the key never comes back out: GET /api/credentials returns only keyHint 'test...real'.

**The Models page notices when PatterStage and Hermes disagree, and offers the fix** (Getting running). On arrival: 'Model config drift, database and Hermes disk differ / Primary model drift: DB has "none", Hermes has "minimax/MiniMax-M3"' with a 'Pull from Hermes' button. After I added my model it grew a new, correct row: 'Model "hermes-agent" (minimax) is in PatterStage but not pushed to Hermes / Make it the agent default to push it'. The banner tracked my change without a refresh.

**The Subsystems panel names the address that failed rather than just a colour** (Getting running). 'Memory Degraded, hindsight: could not reach http://127.0.0.1:9177: fetch failed'. That is a line you can act on.

**Feedback after the create was immediate and complete: a 'Model saved' toast, the MODELS table row, the header count moving to '1 model in registry · 1 credential', and the Credentials panel appearing with its rotate/delete controls, all without a manual refresh** (Getting running). 

**The end-to-end mission loop against a real agent is solid** (Missions). Four dispatches, four correct outcomes, no flakiness: template dispatch, scheduled dispatch, plain dispatch, cancelled dispatch. Runs took 14-20s and the board's poll kept up with all of them.

**Cancel genuinely stops the work** (Missions). The card was streaming the lighthouse story when I hit Cancel; 3.4s later the run row was `cancelled`, the session carried exitCode 143 (SIGTERM), and total output tokens for the day stayed at 98 - the story was never finished. That is the difference between stopping work and marking a row, and PatterStage does the former.

**The live run stream inside the mission card is the best thing on the page** (Missions). Within two seconds of dispatch the card auto-expanded and showed prose arriving token by token with an event counter ('live run - 91 events'). It is the thing that makes a dispatch feel like it is actually happening.

**The composer's Schedule dispatch mode is a genuinely good scheduling UI: a plain-English dropdown ('Every 5 minutes'), the cron it compiles to shown underneath ('*/5 * * * *'), and the next THREE fire times previewed ('Sun, Sep 6, 12:40  12:45  12:50')** (Missions). Nobody has to know cron to use it.

**The impossible-cron refusal is exemplary error copy** (Missions). POST /api/schedules with `0 0 30 2 *` answers: 'Schedule "0 0 30 2 *" can never fire: it names a date that does not exist, or a field outside its range. Check the day-of-month against the month.' It names the input, says what is wrong, and tells you where to look.

**'No models registered - Hermes default will be used' in the composer's Runtime section** (Missions). An empty picker that explains itself instead of looking broken.

**The disabled Dispatch button carries `title="Enter a Mission Name before submitting."` and the same sentence in red above the footer, so a dead-looking button says why it is dead** (Missions). 

**'Save as template' is not rendered at all until the instruction has text, rather than sitting there disabled or silently doing nothing** (Missions). Good restraint.

**One cancel writes one consistent record across three tables (mission, run, session) synchronously, so the board never flashed 'Failed' before settling on 'Cancelled'** (Missions). cancel-finalise.ts exists precisely for that and it shows.

**The seeded template catalogue is real content, not lorem: 12 templates across 8 categories with instruction, goals, output format, constraints, suggested skills and toolsets already filled in** (Missions). 

**Every write is real, and fast** (Shaping the agent). SOUL.md edit, skill toggle, toolset save, settings save and profile push each landed in the Hermes home on disk within a second, and I verified all five files by hand. Nothing was staged-but-not-applied, nothing needed a second 'now sync it' step. For a control plane over a filesystem agent that is the whole value proposition and it holds up.

**The covered-toolset rendering on /agent/tools is exactly right, and better than the brief asked for** (Shaping the agent). The 15 granular toolsets covered by the enabled Hermes CLI bundle render disabled=true AND aria-pressed="true", each carrying title="Included in Hermes CLI. Turn that bundle off to choose this one on its own.", plus a prose line under the grid naming all 15: 'Terminal, File, Web, Browser, Skills, Cron, Memory, Code execution, Delegation, Image generation, Vision, Clarify, Todo, Session search, Messaging are included in Hermes CLI. Turn that bundle off to choose them on their own.' Pressed, disabled, and the reason given twice.

**The pull failure message is the best error in the product** (Shaping the agent). I corrupted hermes/profiles/swe/config.yaml and pulled: 'Pull from Hermes failed for swe: config.yaml did not parse (missed comma between flow collection entries (5:1)) - refusing to rebuild from a corrupt source Repair config.yaml by hand, then Pull again.' It names the profile, the file, the parser error with line:col, what it refused to do, why, and what to do next. That is a model for the rest of the product.

**The Memory surface's diagnosis (as opposed to its actions) is honest and specific** (Shaping the agent). Banner: 'No memory provider is answering at the host and port configured above. PatterStage works without one; memory stays empty until a provider is running.' Empty state: 'Memory is not connected - Nothing answered at the endpoint above.' Test connection: 'could not reach http://127.0.0.1:9177: fetch failed'. Saving the endpoint while it is down says 'Saved - endpoint updated.' next to the failure, rather than pretending the save fixed it. It tells you memory is optional instead of treating a missing provider as a broken install.

**Save feedback on the Tools surface is exemplary: a persistent header line 'Saved at 12:26 PM: Toolsets saved and pushed to Hermes' plus a toast, so the confirmation is still there when you look back** (Shaping the agent). The drift banner then counts down honestly (6 profiles drifted -> 5) as you push them.

**config.yaml writes take a timestamped backup every time, as the Settings hub promises ('27 sections of config.yaml, edited with a backup each time')** (Shaping the agent). Two .bak files appeared in hermes/backups/ for my two writes, and the pull-refusal path even offers to restore the latest parseable backup by name.

**The SOUL.md editor gets the small things right: an 'Unsaved' badge next to the filename the moment you type, Save enabled only when dirty, Reset and Close beside it, a 'SOUL.md saved' toast, and the profile card in the left list updating from 'Never pushed' to 'Last pushed just now' in the same tick** (Shaping the agent). 

**The save → run → read-output loop is fast and honest** (Automate and watch). PUT /api/scripts/<name> returns {created:true}, POST /api/scripts/run returns the real exit code ({exitCode:0, ok:true} / {exitCode:1, ok:false}), and the per-script log opens in one click with the run separator and both streams: '===== run 2026-09-06T11:20:32.374Z =====\nchecking the backup directory\nls: cannot access ...: No such file or directory'.

**The failure toast is honest and points somewhere: 'fail-demo.sh exited non-zero, check Logs' in red, not a generic 'something went wrong'** (Automate and watch). 

**The Schedule modal meets the host limitation head-on instead of hiding it: 'No host scheduler on native Windows** (Automate and watch). PatterStage runs script schedules itself, while PatterStage is running.', printed verbatim above a cron picker that previews the next three fire times ('Mon, Sep 7, 03:00 …'). And it is not a decoration: saving created a real schedules row with a correct nextRunAt, the Scripts row then reads '0 3 * * * · Runs while PatterStage is running', and src/lib/orchestration/scheduler/tick.ts:68 fireScriptSchedule genuinely execs the script. Unschedule worked and the row went back to 'not scheduled'.

**The Quests page handles an impossible quest properly: 4.3 renders 'UNAVAILABLE ON THIS HOST' with a reason sentence and a Skip button, and the 'Go' button is withheld** (Automate and watch). That is exactly the right shape for a control the host cannot honour.

**The Logs screen is genuinely good once a file exists** (Automate and watch). Header 'agent.log · 12 lines · 959 B · written 9s ago', a left sidebar grouping files under CORE with size, age and a green live dot, a stat strip (12 LINES / 1 ERROR / 1 WARNING / 10 INFO / 92% CLEAN), newest-line-first terminal with Time/Level/Message columns and per-level colouring, plus Filter lines, Copy, Download and a 5s auto-refresh toggle. Nothing about it needed explaining.

**Artifact reading is one click and complete: the sheet showed the full markdown ('FIRST REAL MISSION · mission · text/markdown · 39 B') with Download .md, and the 5.2 KB research report rendered in full** (Automate and watch). The read event is recorded on the route that actually serves the content, so the quest measures the real thing rather than a page visit.

**Input validation on the script editor names the rule instead of just refusing: saving a file called 'my check' produced 'Invalid script name (letters, digits, -, _,** (Automate and watch). and one of .sh, .mjs, .cjs, .js, .ps1, .bat or .cmd)'.

**The scripts list tolerates the world changing underneath it: after I deleted a script file from disk outside the app, the next refresh simply dropped the row** (Automate and watch). 

**Deep Research's live view is the best waiting experience in the product** (Multi-stage work). While running it showed 'Model: Agent default · Search: duckduckgo · Depth: 1 rounds · Breadth: 1 results/query · Duration: running · Tokens: not recorded', a 'Stop run' button, SOURCES filling in as they were found, and a RESEARCH TIMELINE with PLAN / SEARCH / READ steps naming the actual query issued ('RFC 4180 CSV specification') and the URL read. At no point did I wonder whether it was alive or what it was doing.

**The research report is genuinely good and, more importantly, honest about its own gaps** (Multi-stage work). It opened with '**Incomplete evidence.** 1 of 2 pages could not be read. This report was written from less than it set out to gather, so treat its coverage as partial.' Every claim carried a [1]-style citation, and the finished view has In brief, an 'On this page' nav, Copy / View report / Download.

**That honesty propagated** (Multi-stage work). The Composer review stage independently picked it up and wrote it into its own risk list: 'The research report is flagged \"Incomplete evidence\", 1 of 2 source pages could not be read. So a claim may rely on only one source.' A quality signal actually travelling between stages is the multi-stage pitch working.

**Insights → PROVIDER SPEND is real and in money, not just tokens: '$0.51 TODAY', broken down 'Agent runs 5 runs · $0.08 / Composer stages 2 runs · $0.04 / Deep Research 3 runs · $0.22 / Story Weaver 8 runs · $0.18', plus a 'Set a budget (optional)' affordance** (Multi-stage work). For a product spending someone else's money, this page is a real asset.

**The Composer live canvas: stages light up with per-stage status, a 'running for 1:09' timer, and 'Cancel run' that arms to 'Confirm cancel?' before firing** (Multi-stage work). The run list label 'Waiting for you · at a gate' is exactly the right words in exactly the right place.

**The gate note is not thrown away** (Multi-stage work). My note 'Looks right to me, carry on.' came back in the stage drawer under a 'Gate decisions' heading as 'Accepted / Looks right to me, carry on.', the decision and its reason are kept together.

**Composer deep-links properly: ?workflow=<id>&runId=<id> is written back with history.replaceState, so a reload lands on the same run and a link to a run works** (Multi-stage work). 

**The API's refusal messages are unusually well written** (Multi-stage work). src/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route.ts answers a bad verb with 'action must be \"accept\" or \"reject\" (got ...). To approve a gate, send \"accept\".' and a stale gate click with 'This run has already completed, so the gate can no longer be decided.', it says what to do, not just what went wrong.

**The Artifacts grid is clean and scannable: kind badge (COMPOSER / RESEARCH / MISSION), format, size, and age on every card, with an 'All kinds' filter** (Multi-stage work). 

**EXPLICIT GENERATION IS GENUINELY SOLVED** (Rec Room). Opening a half-written story to read it bills nothing. I loaded the reader fresh and sat on it for 30 seconds with two pending chapters: spend stayed at exactly 2 runs / $0.04484 and both chapters stayed `pending`. The source shows this was fixed on purpose (`writing` state 'NEVER true on mount', T-0108/D88) and the fix holds against the real provider.

**THE TWO-TIER WRITE CONTROLS ARE EXCELLENT** (Rec Room). The header offers 'Write chapter 2' (one chapter, once) beside 'Keep writing (2 chapters left)' (the loop), with the pending count in the label. There is no ambiguity about whether you are buying one thing or several, and the count tells you the size of the bill you are authorising. This is better than most paid-generation UI.

**STOP WORKS ON THE NORMAL GENERATE PATH, AND IS FAST** (Rec Room). Clicking Stop mid-chapter reverted the header to 'Write chapter 2' / 'Keep writing' within a second, and the abort really reached the provider, no spend row was written at all.

**PER-SOURCE SPEND ATTRIBUTION IS TRUSTWORTHY** (Rec Room). Story Weaver spend was isolated to the cent even while three other agents were burning `agent`, `composer` and `research` on the same instance. Run counts, input/output tokens and dollars all line up with the number of LLM calls the handlers make.

**THE SPEND CONSOLE IS HONEST ABOUT WHAT IT CANNOT SEE** (Rec Room). `GET /api/spend` returns an `unmeasured` array with a plain sentence ('1 Deep Research run in this period recorded no token usage, so its cost is not counted in the totals above'), and the Insights panel shows the same. A spend page that admits its own blind spots is rare.

**THE COUNTERS ARE CONSISTENT WITH THE DATABASE** (Rec Room). Landing showed 3 chapters / 4,911 words; the DB has 1269+1390+2252 = 4911. 'WAITING FOR YOU' went 1 -> 0 the moment the story completed, and the library card picked up the green 'Completed' badge.

**QUEST FEEDBACK IS PROMPT AND VISIBLE** (Rec Room). Quest-complete toasts appeared in-app and /api/stats reflected each tick immediately; chapter 6 went 0/3 to 3/3 with no reload needed.

**THE OUTPUT IS ACTUALLY GOOD** (Rec Room). Three chapters of coherent prose with continuity of names, tense and established facts across chapters, and generated chapter titles that read like chapter titles ('The Bottle', 'Estrid at the slip', 'The Long Crossing Home'). Chapter generation ran 60-90s, create ~25s, well inside patience.

**Backup is a real online snapshot, not a file copy, and it matters here** (Keeping it healthy). The live DB was 737 KB with a 4.1 MB uncheckpointed WAL beside it. POST /api/backup produced a 770 KB self-contained file; I opened it read-only and it held the exact committed state as of the snapshot instant (4 analytics_events, 1 run / 1 mission / 1 session), all of which was sitting in the WAL. A naive `cp` would have lost nearly everything. `snapshotDatabase` uses better-sqlite3's `db.backup()`, and a second backup taken later left no `-wal`/`-shm` sidecars, so the header's promise of "one self-contained file" holds.

**The event is written after the file exists, never before** (Keeping it healthy). `POST /api/backup` calls `recordEvent("backup.taken", ...)` only once `snapshotDatabase` has returned a stat-verified file, with an audit line on both success and failure. The quest tick is therefore evidence of a write, not of a click.

**Panel spend and guard spend agree by construction, and I verified the number independently** (Keeping it healthy). Both `getSpendSummary` and `checkUnattendedSpend` call the same `recordedSpendSince(periodStart(period, now))`. I recomputed the month total by hand from the ledger rows ($0.016295 agent + $0.017842 composer + $0.044840 story + $0.065458 research) = $0.144435, which matched `periods[month].totalUsd` and `budgetSpentUsd` to the cent, and `totalUsd === budgetSpentUsd` was exactly true on every read. Setting a $0.10 warn-only budget produced "$0.14 of the $0.10 you set for this month is spent. Nothing has been stopped: your hard stop is off." - the same figure the guard's refusal would quote. The comment at spend-window.ts names the exact past divergence (T-0108/D104) this fixed.

**It is honest about money it cannot measure** (Keeping it healthy). While the Deep Research run still had NULL token columns, the panel returned `unrecordedResearchRuns: 1` and the sentence "1 Deep Research run in this period recorded no token usage, so its cost is not counted in the totals above." When that run reconciled minutes later, the count went to 0 and the sentence disappeared. NULL was never folded in as zero. This is the single best behaviour I saw all chapter.

**The Dashboard is a genuinely good health screen** (Keeping it healthy). The Subsystems panel gives five rows with a state AND a reason: "Gateway / Healthy / reachable at http://127.0.0.1:8642", "Memory / Degraded / hindsight: could not reach http://127.0.0.1:9177: fetch failed", "Sync / Healthy / last cycle clean at ...", "config.yaml / Healthy / present and parses", "Gateway gate / Healthy / 39 admitted, 0 refused". Beside it, tiles for Gateway, Memory, Scheduler ("Ticking - last tick 5s ago"), Spend, Processes, Errors. A degraded subsystem is named, dated and explained rather than shown as a red dot.

**Insights shows real activity, not decoration** (Keeping it healthy). Run-duration histogram with real buckets, mission mix by status, activity heatmap, and a PROVIDER SPEND card whose per-source breakdown (Agent 1 run $0.02 / Composer 1 run $0.02 / Deep Research 1 run $0.07 / Story Weaver 2 runs $0.04) matched /api/spend line for line.

**"Copy for a bug report" works and carries no secret** (Keeping it healthy). Seven clean lines: version, commit, auth/deploy/read-only/composer flags, schema/port/node/platform, and the three paths plus the gateway URL. It says `auth=token`, never the token. The copy fires a toast ("Copied. Paste it into the bug report.") with a spelled-out fallback if the clipboard is unreachable.

**Disabled controls say why they are disabled** (Keeping it healthy). The Updates card's three greyed buttons sit under "Deploy API is off (PS_ENABLE_DEPLOY_API=false in .env.local). Turn it on and restart to update from here." - the env var, the file, and the next action, in one sentence.

**Empty-state errors are written for a newcomer** (Keeping it healthy). GET /api/logs on a fresh install: "No logs directory found. The agent has not written any logs yet - this is normal on a fresh install, and the directory appears the first time it runs." That is a non-event described as a non-event.

## What must be fixed

### Blocker

**Starter workflow "Research then summarise" never runs its final stage; approving the gate completes the run with no summary** (Multi-stage work)

src/lib/composer/engine.ts:341-347, applyNext short-circuits any `target?.isTerminal` node to `status: "completed"` without dispatching it (resolveNext does the same at engine.ts:238). src/lib/composer/schema.ts:374 makes the deliverable stage terminal: `{ key: "write", label: "Write the summary", kind: "documentation", gate: "auto", isTerminal: true }`, unlike the other two seeds whose terminals are inert `done` markers (schema.ts:295, schema.ts:407). Reproduced live: GET /api/composer/runs/e9c47878 returns status `completed`, currentNodeId = the write node, exactly two nodeRuns (research, gate), and context keys ['research','gate','__gateNote'], no 'write'. Three things make this worse than a seed typo: (a) schema.ts:405 carries a comment proving the author already knew the trap ("Not the terminal node: resolveNext answers 'complete' for a terminal node BEFORE it reads an edge") and applied it correctly to Draft-and-review two workflows over; (b) tests/unit/b12-starter-workflows.test.ts:111 asserts `byKey.get("write")!.isTerminal).toBe(true)`, the suite locks the defect in and no test runs the workflow end to end; (c) docs/guides/composer.md:127 tells the user "Accept sends the work on to the next stage", and quests 5.1 ("start to finish") and 5.2 ("let it carry on", src/lib/quests/quest-defs.ts) are both unachievable on the workflow the ledger points a newcomer at. The flagship feature reports success for skipping its only deliverable.

_Fix:_ Two changes. Now: in src/lib/composer/schema.ts, drop isTerminal from `write` and append `{ key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true }` plus a `write -> done` edge, matching DEFAULT_DRAFT_REVIEW_WORKFLOW; update tests/unit/b12-starter-workflows.test.ts:111 to assert isTerminal === false and add a test that drives the workflow past an approved gate and asserts a 'write' nodeRun and context key exist. Durable: the Build tab's "End" toggle (WorkflowCanvas.tsx:646) lets any operator recreate this on their own stage with no warning, so either dispatch a terminal node and complete after it finishes, or make validateCanvas reject a terminal node whose kind is not an inert marker.

### Major

Ordered by chapter. Each was confirmed against the source by a second reader before
it reached this list.

- **Chat's "Model not ready for chat" banner fires on a working install** (Getting running)  
  src/hooks/useGatewayHealth.ts:134 `setAgentDefaultModelSet(registryOk && diskOk)` (registryOk built at :124 from GET /api/models/defaults). Reproduced live: /api/models/defaults -> {"agent":null}, /api/config -> model.default "MiniMax-M3" => false && true = false, so gateway-banner-states.ts:61 pushes "model-missing". The defect is sharper than reported: registryOk is not merely one of two require

- **Eight user-facing strings route to sections that do not exist ("Operations → …", "Config → Models")** (Getting running)  
  NAV_SECTIONS is ["Home","Work","Results","Agent","Rec Room"] (src/lib/modules/types.ts:32) and there is no src/app/operations. Six "Operations →" sites as reported: src/app/agent/models/page.tsx:164, src/components/chat/GatewayBanner.tsx:103, src/components/ui/ToolsetSelector.tsx:115, src/components/skills/SkillsDenylistNote.tsx:14, src/app/agent/settings/[section]/page.tsx:384 and :501 (those two

- **Quest 1.2 "Add a credential" lands on a page with no way to add one** (Getting running)  
  quest-defs.ts:204-211 sets screen "/agent/models" for 1.2. src/components/models/CredentialsPanel.tsx:56 `if (credentials.length === 0) return null;` and it is rendered in exactly one place (src/app/agent/models/page.tsx:184), grep confirms no other credentials UI anywhere, and no credentials section under /agent/settings. With zero credentials the word appears only in the page subtitle (page.tsx

- **Three screens give three different answers to "do I have a model?"** (Getting running)  
  Three unlabelled registers, verified live. Dashboard: src/lib/dashboard/dashboard-model-subtitle.ts:49-50 returns bare "MiniMax-M3 · minimax" straight from config.yaml. Models page: src/app/agent/models/page.tsx:127 subtitle "0 models in registry" from the SQLite registry. Chat: the conjunction, finding 1. The START HERE card compounds it, src/components/dashboard/NextQuestCard.tsx:72 renders que

- **`every 0m` is accepted and creates an unbounded paid-run loop** (Missions)  
  src/lib/schedule/parse-schedule.ts:75, the interval regex captures `(\d+)` with no lower bound, so "every 0m" parses as {kind:"interval", minutes:0}. src/lib/schedule/next-run.ts:157 returns `from + 0`; next-run.ts:185 (`scheduleCanEverFire`) returns true for everything non-cron; src/app/api/schedules/route.ts:29 only asserts `z.string().min(1)`. Reproduced live: POST returned 201 with `nextRunAt

- **The composer's "Schedule" mode fires a run immediately, and the screen says the opposite** (Missions)  
  src/lib/missions/mission-handlers/dispatch.ts:192, `await dispatchMissionNow(...)` runs unconditionally inside the cron branch. Reproduced the screen state (without pressing the button): with mode Schedule the panel reads `Every 5 minutes`, `Cron: */5 * * * *`, `Next: Sun, Sep 6, 12:50  12:55  13:00` and the footer button reads `Schedule mission`. Nothing on that screen mentions an immediate run,

- **A scheduled row never says which mission it runs** (Missions)  
  src/components/missions/ScheduledMissions.tsx:196, the row title is `s.name || s.scheduleDisplay || s.schedule` and the second line is cadence + next + lastStatus; missionId is never rendered. Reproduced: a schedule created for mission "Template run - capital" with no name renders titled literally `0 3 * * *`, with `0 3 * * * · next 14h 12m` beneath, next to a live Run button. One nuance the repo

- **Script schedules appear under "Scheduled MISSIONS" with nothing to say they are scripts** (Missions)  
  src/components/missions/ScheduledMissions.tsx:193 maps every row from useSchedules() with no `kind` filter and no badge, under a heading that says missions and an empty state that says "No recurring missions yet" (:186). Reproduced: a `kind:"script"` row for hello.sh renders as `Hello / 0 4 * * * · next 15h 12m`, identical in shape to the mission row beside it. Worse than reported: the row's Run b

- **Quest 3.7 can never be shown as blocked, and the dashboard recommends it while the same screen says memory is unreachable** (Shaping the agent)  
  src/hooks/useQuestHost.ts:53 computes availability as `row.state !== "down"`, but the memory row in src/lib/status/subsystems.ts can only ever emit "ok" or "degraded" (lines 106 and 108, both failure paths return "degraded"). So `up("memory")` is permanently true, `questAvailable` (src/lib/quests/quest-defs.ts:534) always passes, the blocked branch in src/components/quests/QuestRow.tsx:120-126 is

- **Storing a memory with no provider shows a toast reading only "HTTP 500", the server's real message is thrown away** (Shaping the agent)  
  Both halves reproduce. Live: POST /api/memory/hindsight {"action":"retain"} → 500 with body {"data":{"available":false,"error":"fetch failed: connect ECONNREFUSED 127.0.0.1:9177"}}. src/lib/api-fetch.ts:193 reads a TOP-LEVEL `json.error`, which is the house convention everywhere else (src/lib/api-response.ts:30,40,78 all return `{ error }` at top level), but src/lib/memory/hindsight-route-helper

- **The "N skills" count on every profile card is wrong by two orders of magnitude and moves in a misleading direction** (Shaping the agent)  
  src/modules/hermes/lib/profile-counts.ts:32-40 computes `countSkills() - disabledSkillsFromJson(...).length`. countSkills() (src/lib/skills-repository.ts:119-124) is `SELECT COUNT(*) FROM skills`, the SQLite catalog only, 4 rows here, while /api/skills (src/app/api/skills/route.ts:40-73) unions that with scanDiskSkillsCatalog() and returns 78. The subtrahend is the profile's raw denylist, which 

- **Three profile pickers that do not talk to each other** (Shaping the agent)  
  Each surface holds its own state and defaults to the root agent: src/app/agent/skills/page.tsx:60 `useState("default")`, src/app/agent/tools/page.tsx:42 `useState("default")`, src/app/agent/profiles/page.tsx:57 its own selectedProfileId. No useSearchParams, no localStorage, no shared context anywhere in those three files, nothing carries a selection across a navigation, and the seeded install has

- **Settings never says which agent it is editing, and quietly edits a different one from the rest of the chapter** (Shaping the agent)  
  src/app/api/config/route.ts has no profile parameter at all; the PUT writes to `getAgentWorkspace().config` (:193), which resolves to the single active HERMES_HOME root (src/modules/hermes/lib/agent-runtime.ts:14-17). The hub subtitle (src/app/agent/settings/page.tsx:149) names the section count and the backup but not the scope, and there is no picker on the hub or a section page, while every nei

- **Navigation instructions point at an "Operations" menu that does not exist** (Shaping the agent)  
  NAV_SECTIONS is ["Home", "Work", "Results", "Agent", "Rec Room"] (src/lib/modules/types.ts:32), there is no Operations. Eight user-facing strings still name it: src/app/agent/models/page.tsx:164, src/app/agent/settings/[section]/page.tsx:384 and :501, src/components/chat/GatewayBanner.tsx:103, src/components/skills/SkillsDenylistNote.tsx:14, src/components/ui/ToolsetSelector.tsx:115, src/app/api/

- **The Tools surface has no unsaved indicator, and its counters change before you save** (Shaping the agent)  
  src/app/agent/tools/page.tsx:309 gates Save on `savingToolsets || loadingToolsets` only, never on dirtiness, the button looks identical before and after an edit. The page computes `toolsetsDirty` at :242 but spends it only on the in-page profile-switch guard (:246-250); there is no beforeunload handler anywhere in src/, so a rail navigation discards the edit with no prompt. The header count (:278

- **A script that did not run is toasted as 'exited non-zero, check Logs'** (Automate and watch)  
  src/app/api/scripts/run/route.ts:33 collapses BOTH exitCode===null cases (script missing, and no interpreter) into a 404, and src/app/work/scripts/page.tsx:120 keys the toast on `res.ok && res.data?.data?.ok !== false`, so any non-2xx renders line 121's 'exited non-zero, check Logs'. safeApiCall (src/lib/api-fetch.ts:242-262) catches ApiError and RESOLVES {ok:false}, so react-query's onSuccess f

- **Nothing durable records whether a script run succeeded** (Automate and watch)  
  Reproduced verbatim: data/logs/silent-fail.log is exactly '\n===== run 2026-09-06T11:29:26.191Z =====\n'. src/lib/scripts-manager.ts:255 appends only stdout+stderr, never the exit code; ScriptFile (scripts-manager.ts:52-64) carries no status, and ScriptRow.tsx:59 prints `last run ${timeAgo(s.lastRun)}` off the LOG FILE's mtime (scripts-manager.ts:226), byte-identical for a clean run and a failure

- **A reviewer FAIL kills the run without ever asking the human, on a stage badged HIL** (Multi-stage work)  
  src/lib/composer/engine.ts:457-459, `const stageFailed = current.status === "failed" || current.verdict?.pass === false;` then `if (node.gate === "hil" && !stageFailed)`. resolveNext then routes on_fail (engine.ts:243) and the seeded gate has only on_approve/on_reject edges (schema.ts:377-380), so it dead-ends at `{ kind: "fail" }` (engine.ts:260-266). Reproduced live: run 10c152d8 is status `fai

- **The gate asks for a decision while showing nothing to decide on, and the evidence drawer covers the gate** (Multi-stage work)  
  src/components/composer/ComposerGatePrompt.tsx takes only `nodeLabel`, `busy`, `onAction`, no output, no verdict, no reasons reach it, and src/app/work/composer/page.tsx:447-452 passes nothing more. The evidence lives in ComposerNodeRunDetail, rendered inside src/components/ui/Sheet.tsx, which is `role="dialog" aria-modal="true"` with a full-viewport backdrop at z-[60] and a panel up to 56rem at 

- **The auto-captured artifact is the reviewer's critique memo, named and described as the run's output** (Multi-stage work)  
  src/lib/composer/engine.ts:346, `captureComposerArtifact(composerRunId, fromNodeRun)` on the terminal short-circuit, where fromNodeRun is whatever stage last completed. With the write stage skipped that is the gate. Verified live: artifact 0f4ffe18 has sourceNodeId 28b91072 (the gate's nodeRun id), name "Give a short overview of what a CSV file is.", description "Composer run output", and content

- **Stop is inert during a Retry, the billed generation runs to completion** (Rec Room)  
  src/app/recroom/story-weaver/[id]/page.tsx:182-199, `retryChapter` fetches with no `signal` and never assigns `abortRef.current`, while `generateNext` (line 111-112) does. `stopWriting` (line 148-151) is `abortRef.current?.abort()`, and `abortRef.current` is null (generateNext's `finally` at line 138 nulls it). It still sets `generating` true (line 187), so ReaderHeader.tsx:79 renders the enabled

- **After Stop the reader shows stale state, 'Write chapter 2' actually writes chapter 3** (Rec Room)  
  src/app/recroom/story-weaver/[id]/page.tsx:129-134, the AbortError branch does `setWriting(false); return;` with no `loadStory()`, so client state keeps the stopped chapter as `pending`. The server has already written `failed` (src/modules/rec-room/handlers/generate.ts:151-158). The next click resolves against the SERVER's list: generate.ts:34 `findIndex(c => c.status === "pending")` skips the fa

- **`writing` is never cleared on success, so a Retry silently resumes the whole auto-write loop (NOT REPORTED)** (Rec Room)  
  src/app/recroom/story-weaver/[id]/page.tsx, `setWriting(false)` appears only at line 132 (abort) and line 149 (Stop). The success path never clears it. So after a 'Keep writing' run ends, either because all chapters are written, or because the failure ceiling at line 171 paused it, `writing` stays true. Two consequences. (a) The header keeps rendering Stop with nothing in flight (ReaderHeader.t

- **Nothing anywhere tells you what a story costs, before or after** (Rec Room)  
  A grep over all of src/app/recroom/ and src/modules/rec-room/ for cost/spend/usd/price/token returns nothing but the `maxTokens` arguments in the handlers, there is no cost surface in the Rec Room at all. Meanwhile every call is tagged `spend: { source: "story", storyId }` (generate.ts:76/89/127, create.ts:72/107/150, edit.ts:61/96/181) and src/lib/runs-repository.ts:132-149 writes `story_id` on 

- **Story creation is an unclosable, uncancellable modal with an invented progress bar** (Rec Room)  
  src/app/recroom/story-weaver/create/page.tsx:311-328, `handleCreate`'s fetch has no AbortController and no signal, so there is nothing to cancel even if a control existed. GenerateOverlay.tsx has no close button, is deliberately not a dialog (its own comment at lines 77-80 says so, and names the missing Stop: 'the Stop control that B14 adds will make it one'), so Escape does nothing. The percenta

- **Insights shows three different token totals at once, none of them scoped** (Keeping it healthy)  
  Reproduced live at one instant: headline tile 241,399 (src/app/results/insights/page.tsx:214, stats.runs.totalTokens, from `SELECT status, usage_json ... FROM runs WHERE submitted_at >= -91 days`, src/lib/stats/stats-repository.ts:184, every run row, no Deep Research, and a silent 91-day window under a label that carries no range while the tile beside it says 'Active days (30d)'); 'Tokens by mode

- **The spend tooltip claims "published per-model rates" when every figure on this install is the fallback rate** (Keeping it healthy)  
  src/components/spend/SpendPanel.tsx:101 asserts 'Prices are the published per-model rates'. Verified against the live DB: both missions have model_id NULL, and all research_runs have model_id NULL, so rateForModel(null) returns DEFAULT_RATE at src/lib/analytics/model-cost.ts:36,41 for every one of the four sources; Composer and Story rows are documented as always NULL-modelled (src/lib/spend/spend

## Recorded, not blocking

59 minor and 18 polish findings are held in the round's own data rather than listed
here. They are real and they are written down; none of them stops a release.

## Two things worth knowing that are not defects

**An agent run costs about seventeen thousand input tokens before it reads your
prompt.** A four-hundred-character mission produced 16,262 input tokens against 11
output. That is Hermes assembling its own system prompt, tools and skills server
side, not PatterStage padding anything, but it is the shape of the bill and an
operator should know it.

**The agent writes to the host.** A Composer run asked for a summary and the agent
wrote `csv-summary.md` into the operator's home directory. That is what an agent with
tools is for, and Hermes executes them on its own host by design. It is still a thing
to have said out loud before someone meets it by surprise.

