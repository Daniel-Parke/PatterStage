---
summary: The approved 2026-09 final-release programme, batches B0 to B19, the eighteen operator decisions, the URL map, the verified defect ledger and the release plan to v1.0.0
type: venture
tags: [plan]
status: approved
approved_by: Daniel Parke (operator), 2026-09-05, at plan approval after five rounds of questions
session: the final-release review session (Fable 5.1, 2026-09-04 to 2026-09-05)
compiled_from: preserved
---

# PatterStage · Final-release programme (v1.0.0-rc to v1.0.0) · approved plan

> Produced by the final-release review: a browser walk of every screen on an
> isolated instance, fifteen read-only mapping agents, four documentation
> audits, adversarial verification of every blocker and major (125 confirmed,
> 3 refuted), and a five-lens design panel scored by three judges. **Approved
> by the operator 2026-09-05.** Sessions read this file from disk; it outranks
> any memory of the conversation that produced it. Task records T-0094 to
> T-0113 are the batches; ADR-0010 is decision 15.
> Precedence: `org/CONSTITUTION.md` > repo governing files > this plan.

## Context

Round-6 remediation (T-0086..T-0093) is complete and pushed. The operator now
wants a final release: every user pathway walked, every screen judged with a
fresh mind, no feature or design concept protected, then one consistent
implementation programme, tested and refined until satisfied, and documentation
rewritten for a brand-new user.

## Decisions taken with the operator (binding)

1. **Audience:** a solo operator running one Hermes on their own machine.
2. **Rec Room / Story Weaver + achievements:** kept as a first-class showcase.
3. **Documentation:** ALL THREE surfaces from ONE source. `docs/` markdown is the
   truth; a small in-repo generator (Node, no new framework) builds a static
   site for GitHub Pages that also opens locally; the same markdown is rendered
   inside the app under a Help/Demo section.
4. **Quests:** a real-action quest system, tracked by the analytics events that
   already exist, layered on the existing achievements, moving a complete novice
   from simple to advanced use. No sandbox state; guided steps point at the
   real screens.
5. **Learning scope:** PatterStage plus the AI ideas a novice meets in it
   (agents, prompts, tools, skills, memory, models, API keys) explained where
   they are met. No general AI course.
6. **Release:** tag v1.0.0-rc after the programme, run a real-Hermes test round
   on this machine (Hermes desktop for Windows is installed; Docker is running),
   fix, then v1.0.0 with a changelog.
7. **Demo** = a screen-by-screen tour inside Help (fresh screenshot, what you
   see, what to do there); Quests are the hands-on half. No seeded demo data.
8. **URLs are renamed now, with redirects** (307, never 308) to match the new
   navigation. The map is in the Programme.
9. **GitHub Pages** via a GitHub Actions workflow to
   `https://daniel-parke.github.io/PatterStage/`; the operator sets the Pages
   source to "GitHub Actions" once the workflow lands on `main`.
10. **The real-Hermes round runs natively on Windows** against the Hermes
    desktop install and `hermes gateway run`; host script scheduling is
    unavailable natively, so PatterStage's own scheduler becomes the fallback
    for scripts (in the programme, not deferred).
11. **Personalities folds into Agents** as an Identity tab; the old route
    redirects; the separate page, nav entry and its API go.
12. **Update / Rebuild / Restart move to Settings → System**; the sidebar
    footer keeps a version line and an "update available" badge.
13. **One status vocabulary, ratified:** Draft · Queued · Running · Waiting for
    you · Completed · Failed · Cancelled; Healthy · Degraded · Not running · Not
    installed; In sync · Out of sync. Sync controls everywhere read "Pull from
    Hermes" / "Push to Hermes"; Models drops Import/Export/Refresh wording.
14. **The agent group is called AGENT** (framework-agnostic; the header shows
    the real name from data).
15. **The governance corpus moves under `org/` with an ADR** written as the
    programme's first commit; root `OPERATORS_GUIDE.md` becomes
    `org/EOS_OPERATORS_GUIDE.md` so the product owns that title.
16. **Profiles are editable** (name, description, via the existing PUT) and
    **the root agent is renameable** (a display name stored in PatterStage,
    never written into Hermes files).
17. **The deploy API is live by default** on a fresh solo install (setup writes
    `PS_ENABLE_DEPLOY_API=true`, matching `.env.example`); one line turns it
    off.
18. **The real-Hermes round uses an API-key provider** the operator configures
    in Hermes and on the Models page themselves; quest 1.2 is proven by
    `credential.added`. The reviewer never enters keys.

Decided by the reviewer with the panel's consensus (stated so they are not
re-opened): no operator XP or level (ADR-0004; quest progress is chains and
steps, achievements stay the prestige currency); quest completion is derived
from server facts and latched as a high-water mark in operator preferences so
retention can never un-complete one; a config field cleared in the UI deletes
the key so Hermes uses its default; the skills catalogue stays shared across
profiles and says so where it is edited; Story Weaver's writing model defaults
to the agent's default model with a selector; the reader keeps its serif faces,
extend/rewrite handlers and brightness; the two Composer starter workflows are
"Research then summarise" and "Draft and review", with "Software Delivery" kept
as the third; quest chapter 7 ships as the single backup quest;
`package.json` moves to 1.0.0-rc.1 at the rc tag and 1.0.0 at release; docs use
lowercase kebab-case slugs (CONTRIBUTING, CODE_OF_CONDUCT and SECURITY stay
uppercase at the top of docs/ for GitHub); the unused surface-class ladder is
deleted rather than codemodded.

## Browser walk — every screen, on the isolated instance (production build, mocks)

Read as text and as a picture at 1280×720. Findings are the reviewer's own,
before the mapping agents' results are merged.

| Screen | What a new user sees | Observations |
|---|---|---|
| Dashboard | Header (agent name, model, clock, ONLINE pill), Subsystems panel, stat pills, Continue work, Launch a Mission (12 templates), Platforms, Errors, Processes, Rec Room level card, Active runs / Missions / Success / Tokens, Mission throughput, Token usage, Mission mix, Run activity, Vitals, Achievements | Very dense: ~14 panels. Achievements/Run activity/Vitals duplicate Insights. "Memory · Not Installed" pill sits beside a Subsystems row that says degraded with a reason: two vocabularies for one fact. Sidebar carries ~22 entries plus Check for Updates / Rebuild / Restart buttons: at 720px tall it scrolls. |
| Sessions | "Session History", ring + stat strip, filters (All/CLI/Cron/Mission/API), Group by mission, Hide API noise, list | Page title differs from nav label ("Session History" vs "Sessions"). Group rows expand to session rows; ref-based clicks off-canvas suggests the list's rows are laid out oddly for assistive tech (worth an a11y check). |
| Session detail | "0 messages · 0.0 KB", mission link, empty-state copy naming `~/.hermes/state.db` | Copy leaks an internal path. With the mock gateway no transcript exists; copy should say what to do, not where bytes are. |
| Memory | Provider config card (host/port/bank) with TWO warnings stacked (guessed default + not answering), search, Recall/Reflect/Add Memory, Memories/Directives/Mental Models tabs | Configuration and browsing on one screen, and `/config/memory` exists too. Two red/orange notices at once on first visit is hostile; a single "Set up memory" path is missing. |
| Logs | "System Logs", line-count picker, Refresh, Delete All, file picker, filter | Calm empty state now correct. "Delete All" enabled on an empty page. Title vs nav label differ. |
| Missions | Quick-load templates, categories, stats strip, list with status filters, New Mission sheet | Dense but coherent. Sheet now leads with Dispatch. Insights strip and list counters show the same counts twice (Total/Active/Done/Failed vs Drafts/Queued/Dispatched/Completed). |
| Composer | RUN/BUILD tabs, seeded "Software Delivery" (16 stages), objective box with examples, runs list | Good structure; the only seeded workflow is a 16-stage engineering pipeline, intimidating for a first run. Needs a small starter workflow. |
| Scripts | "Host shell scripts on a timer", examples | `.sh` only: on Windows (Hermes desktop) this is not runnable without WSL; the page does not say so. |
| Chat | Agent/Fast toggle, conversations, composer | Fine. Duplicate conversation titles after the collision retry are expected. Offline error text is operator-grade. |
| Agents | "Agent Profiles", explanatory paragraph full of file names, performance board, 8 profiles, level card ("520 XP… Capability measurement is not implemented; see ADR-0004"), behaviour files list | The most jargon-heavy screen (SOUL.md, skills.disabled, platform_toolsets, Pull/Push). An ADR reference leaks to the user. Gamified level card inside an ops screen. |
| Skills | "Skills Manager", denylist paragraph, ring "100% ACTIVE", categories | Jargon paragraph; per-profile switcher good. |
| Tools | "Hermes Toolsets", two paragraphs of Hermes internals, 22 chips, reference table | The reference table is useful; the intro copy is not for a novice. Enabled vs disabled chips indistinguishable at a glance. |
| Personalities | List of 8 with SOUL.md previews, "How personalities work" | Overlaps Agents (both edit SOUL.md). Description still says "SOUL.md voice". |
| Config index | 27 section cards in 6 groups; Personalities card says "one-click activation" | Stale copy (activation removed in T-0089). Good grouping. "N fields / configured / +1 advanced" badges are meaningful. |
| Config section (Agent) | Generic form + "Complex fields are read-only in the console" | Honest. Selects show "Select…" with no current value when unset. |
| Models | Registry table, drift banner, defaults, 11 task-default slots, fallback chain | Powerful, dense; the drift banner is good. "Seeds never set model.default" is inside-baseball. |
| Seed | Reseed/Restore/Clean dev data/Restore per agent/template | Two intro paragraphs of jargon ("import-hermes-state", "merge seed"). Actions are clear once read. |
| Insights | Streak/level, interactions, tokens, achievements, spend, charts | Duplicates dashboard widgets. "1day / best 1" streak chip is cryptic. |
| Deep Research | Question, model, search, depth/breadth, presets, runs | Clean. |
| Artifacts | List with kind filter | Minimal, fine. |
| Story Weaver hub | Stats, Create/Library/Characters/Themes, recent stories | Hub says "Failed" for the story; Library counts it as "In Progress (1)". Inconsistent status vocabulary. |
| Create Story | Templates, title, theme, premise, genre/era/mood/setting chips, characters, parameters | Best form in the product; a model for the others. |
| Library / Characters / Themes | Lists and empty states | Fine. |
| Reader | Serif reading mode, chapter nav, Continue/Edit/Chapters | Heading reads "Chapter 1: Chapter 1" (title fallback doubled). |

Cross-cutting, from the walk: (1) three copy registers coexist (novice, operator,
Hermes-internal) and the last two dominate; (2) the same fact is shown in two
vocabularies on several screens; (3) page titles and nav labels disagree in
five places; (4) the dashboard and Insights render the same widgets; (5) no
in-product help of any kind exists; (6) there is no first-run path beyond the
dashboard checklist.

## Review findings — the mapping fan-out (14 areas + 4 documentation audits, read-only)

Twenty agents, 3.4M tokens, 1,163 file reads. Per area: defect counts as the
mapper graded them (verification by the adversarial panel follows; refuted
items are dropped from the programme), the blockers verbatim, the majors, and
the non-fix candidates worth carrying. Full JSON: scratchpad `map-results.json`;
defects `defects.json` (129 blocker/major); candidates `candidates.json` (~230).

### Composer
Defects: 1 blocker, 7 major, 9 minor, 4 polish · candidates: 16
- BLOCKER: Deleting a workflow takes one click and destroys every run of it, with no confirmation — src/components/composer/WorkflowCanvas.tsx
- major: Saving from the Build tab silently blanks the workflow description · Runs-list and run-detail load failures are swallowed (false empty state, eternal spinner) · Read-only mode blocks cancelling a run but not launching one, approving a gate, or deleting a workflow · The SSE events route ignores PS_COMPOSER · The Build tab reports success and failure in identical grey · Unsaved Build-tab work is discarded silently · Gate notes are recorded and never shown
- carry: Build-tab feedback + unsaved guard [refine/M] · legible gate decisions [extend/M] · name the workflow on run rows, separate "waiting on a question" from "at a gate" [refine/S] · server-side run filtering/pagination [extend/M] · edge validation + maxAttempts in the inspector [refine/M] · a second and third seeded workflow + Duplicate [extend/M] · kind-aware palette [refine/S] · Playwright coverage [new/M]

### Models & Seed
Defects: 2 blocker, 7 major, 8 minor, 2 polish · candidates: 15
- BLOCKER: Clearing a task default silently comes back — src/modules/hermes/lib/config-sync.ts
- BLOCKER: Editing a model's name or base URL is undone by the auto-import on the next page load — src/lib/models-repository.ts
- major: Push/pull report success when the server refused to write · Excluding a change in the Export modal can do nothing · The push "diff" is not a diff; the pull preview reads a different source than the pull · No way to rotate an API key · Local providers still demand an API key · "Reseed all" counts the seeded DB, not the shipped pack · Seed actions give no result feedback
- carry: real diff or drop exclusions [refine/M] · credential manager: add/rotate/relabel [extend/M] · Seed page feedback + parity [refine/M] · merge the duplicated Agent-default control [merge/S] · two-way drift remedies [refine/M] · protocol override [extend/S] · first-run path on /config/models [new/M] · retire/re-frame "Refresh Models" [remove/S]

### Agents
Defects: 1 blocker, 10 major, 7 minor, 2 polish · candidates: 21
- BLOCKER: "Clone From: Default (Bob)" does not clone anything — src/app/api/agent/profiles/route.ts:190
- major: Pull failures never say why · A partially-failed "Push all" leaves pre-push state · Every save/sync blanks the page · A failed profile load looks like an empty install, no retry · Unsaved SOUL.md edits discarded silently · The root agent cannot be renamed while the API says to · Profile name/description can never be edited (PUT has no caller) · Files show "missing" while the editor opens them full · syncError/syncedAt computed, stored, never shown · PUT of HERMES.md for a named profile is a silent 200 no-op
- carry: stop blanking on mutation [refine/M] · Edit profile (name, description) [extend/M] · rename the root agent [new/M] · show what drifted, offer both directions [extend/M] · preview before "Import discovered" [refine/S] · MERGE Personalities into Agents [merge/L] · stop telling users to hand-edit config.yaml [extend/M] · a behaviour-file editor worth writing in [overhaul/L]

### Sessions
Defects: 2 blocker, 10 major, 4 minor, 2 polish · candidates: 18
- BLOCKER: Sessions from unknown sources are badged "CLI" and cannot be filtered — src/components/session/SessionCard.tsx
- BLOCKER: A failed session is indistinguishable from a successful one (status/exitCode/error never rendered) — SessionCard.tsx
- major: "Hide API noise" hides only sessions started in the last 60s · `<a>` inside `<a>` on every row, `<a>` inside `<button>` on every group · Transcript failures all render as "Session Not Found" with no retry · Mission grouping computed from the loaded 50-row page (wrong counts, split groups) · Every list request synchronously syncs up to 10,000 rows from state.db · Nothing refreshes, "live" stays live forever · Search/filter/page not in the URL · Transcript opens fully collapsed, no expand-all, no search · Prev/Next-only pagination over 716 pages · Unvirtualised transcript with a 64 MiB ceiling
- carry: failure surfaced (badge, exit code, Failed filter) [extend/S] · state in the URL [refine/S] · readable transcript: expand-all, search, role chips, copy/download [extend/M] · virtualise + cap [refine/M] · group by mission in SQL [overhaul/L] · state.db sync off the read path [refine/M] · jump-to-page, page size, date range [extend/M] · mission → sessions link [extend/S]

### Scripts and Chat
Defects: 2 blocker, 10 major, 6 minor, 4 polish · candidates: 16
- BLOCKER: A scheduled non-.sh script never shows as scheduled, and the bundled scripts are .mjs — src/lib/scripts-manager.ts
- BLOCKER: POST /api/scripts/run is the one host-executing endpoint with no requireAuthenticatedHostWrites() — src/app/api/scripts/run/route.ts
- major: Download exports the ACTIVE conversation under another's title · Fast mode sends no Authorization header · Fast-mode turns counted twice · Non-.sh names get a double extension · .ps1/.bat/.cmd listed and runnable but not schedulable · Unschedule strips .sh only · Failed conversation list/load is silent · Agent mode silently degrades to a raw reply when no runId · Script delete uses window.confirm · CSV export reachable only by hover
- carry: chat sidebar load/error states [refine/M] · tool cards show what the tool was asked [extend/M] · profile picker in Chat, persisted model [extend/M] · keyboard-reachable row actions, rename, search [refine/M] · stream Run-now output [extend/L] · say when scheduling is unavailable on this host [refine/M] · seven-extension copy + .mjs templates [refine/S]

### Application shell + Dashboard
Defects: 5 major, 7 minor, 3 polish · candidates: 18
- major: Rebuild/Restart/Update look enabled but 403 on every production install · A permanently failing /api/monitor is indistinguishable from loading, forever · The Config → Core sidebar group can never auto-expand (four config pages have no active nav state) · The h1 hardcodes "Hermes" · The first-run headline changes its story twice while loading and reverts on a gateway blip
- carry: stop the double-fetch [remove/S] · move gamification to Insights, let the dashboard be an operations board [merge/M] · delete the Rec Room dashboard panel [remove/S] · dashboard on PageHeader [refine/S] · one sidebar tree portalled to the drawer [refine/M] · rework the navigation IA: four sections, a Settings entry, search [overhaul/L] · command palette [new/L] · passive update check, branch picker behind advanced [extend/S]

### Memory and Logs
Defects: 1 blocker, 7 major, 6 minor, 2 polish · candidates: 14
- BLOCKER: "Test connection" on /memory always reports failure (envelope unwrapped one level short) — src/components/memory/MemoryProviderSettings.tsx
- major: Logs auto-scroll and "Latest lines" are dead (ref on a non-scrolling element) · "Press Enter to search" is false · Facts older than 90 days render "No memories yet" under a donut that counts them · A Recall with no match shows the fresh-install state · One proof displays as "Relevance: 100%" · Two controls claim to choose the memory provider from different sources of truth · Save hardcodes type "hindsight" + makeActive
- carry: honest empty states [refine/M] · UNIFY the two provider switches [overhaul/L] · severity strip drives the filter [refine/M] · per-file clear/copy/download [extend/S] · confirm on directive/mental-model delete [refine/S] · /memory usable when the provider is not Hindsight [extend/M] · docs/LOGS.md [new/S]

### Missions
Defects: 1 blocker, 7 major, 12 minor, 5 polish · candidates: 16
- BLOCKER: Cancel and "Remove from queue" can never be confirmed — the armed button is disabled — src/components/missions/MissionEditorPanel.tsx
- major: A failed fetch renders as the first-run empty state · The cron card and cron badge are dead (API never sends the field) · No link from a mission to its session · "Save as Template" can overwrite the last-open template · Category rename/delete fail silently · Opening the template editor destroys an in-progress draft · Scheduled missions: unconfirmed delete, silent failures
- carry: send cronJob + session links, light the panel [extend/M] · separate template editor state from the composer's [overhaul/L] · harden Scheduled missions [refine/M] · show why a due schedule is not firing [extend/M] · insights strip agrees with the board [refine/S] · retire unused REST sub-routes [remove/M] · delete dead missionCounts [remove/S] · copy fixes [refine/S]

### Config
Defects: 6 major, 6 minor, 2 polish · candidates: 18
- major: GET /api/config leaks fallback-provider API keys to the browser · The index cannot see a parse error (a broken file looks like a fresh install) · A section Save is silently reverted by a later Push from Agents · min/max are decorative · No "unset" state · The index omits two sections and prints a count that contradicts what it renders
- carry: CONFIG_SECTIONS as the single source for index + sidebar [merge/M] · explicit unset/default state [refine/M] · search across every field [new/M] · raw config.yaml editor for complex keys [new/M] · diff before save, "changed from default" badge [extend/M] · say when a change takes effect [refine/S] · unsaved-changes guard [refine/S]

### Skills, Tools and Personalities
Defects: 2 blocker, 5 major, 9 minor, 1 polish · candidates: 13
- BLOCKER: Enabling a granular toolset next to hermes-cli does nothing — Save reports success, the buttons turn back off — src/modules/hermes/lib/toolset-normalize.ts
- BLOCKER: The standalone skill viewer crashes for any top-level skill key — src/app/operations/skills/[...path]/page.tsx
- major: Toggling a skill on disk but not in SQLite always fails · No way to re-import the catalogue once non-empty · Advanced-JSON edits silently discarded · Switching profile on Tools discards unsaved changes · Editing a skill from a profile page edits the global catalogue
- carry: FOLD Tools and Personalities into the agent profile; keep Skills top-level [merge/XL] · make the skill viewer the catalogue's destination [overhaul/M] · catalogue sync in the header [extend/M] · no teleporting toggles, bulk enable/disable [refine/L] · meaningful numbers on the strips [refine/S]

### Rec Room / Story Weaver (kept, first-class — operator ruling)
Defects: 2 blocker, 6 major, 8 minor, 3 polish · candidates: 16
- BLOCKER: Story Weaver LLM spend is invisible to the spend feature and the hard stop
- BLOCKER: Opening a story to read it silently starts billed generation with no consent and no stop control
- major: Delete-theme posts the wrong field name · "Chapter Length"/"Chapters to Regenerate" (Edit) and "Chapter Length" (Continue) are dead controls · Premise never rendered · Library/Characters/Themes show an API failure as empty · Save-to-Library checks a field the handler never returns
- carry: explicit, interruptible generation [overhaul/L] · error handling parity [refine/M] · choose the writing model [extend/M] · delete dead API surface [remove/S] · resolve the four-serif fork [remove/S] · Themes ⇄ create-page theme block merge [merge/M] · one accessible chapter rail [merge/S] · reading progress + position memory [extend/M] · an export path [new/M]

### Laboratory (Insights, Deep Research, Artifacts)
Defects: 1 blocker, 9 major, 9 minor, 3 polish · candidates: 18
- BLOCKER: Insights is blind to Deep Research and Composer — src/lib/analytics/event-types.ts
- major: "Active days" ignores the 7/30/90 switch · Two money numbers on one page · A running research run cannot be stopped · Every write on Research and Artifacts can fail silently · Retry on Insights retries the wrong query · Artifact delete is one unconfirmed hard DELETE · Research detail hides everything but the prose · The three pages are the only ones without AppPageShell · The hard stop counts less money than the panel shows
- carry: emit research.* and composer.* events [extend/M] · cancel a research run [extend/M] · run header on research detail [extend/S] · run/preset management [extend/M] · deep-link selection [refine/S] · finish the Artifacts detail [refine/M] · one shell [refine/S] · RE-HOME the section and retire the name "Laboratory" [overhaul/XL] · Spend as its own surface [new/L]

### Install, boot, update and operations
Defects: 2 blocker, 7 major, 5 minor, 1 polish · candidates: 14
- BLOCKER: Every sidebar deploy button 403s on a fresh production install and nothing warns — src/lib/api-auth.ts
- BLOCKER: install.sh "Reinstall" deletes the user's database with one keypress and never says so — scripts/bootstrap/install.sh
- major: "Up to Date" shown when the version check failed · The 20-line failure log tail is computed then thrown away · Nothing in the product tells the user how it is configured (the [config] line is terminal-only) · The first-run checklist omits the model step that makes step 2 fail · A stuck deploy locks the sidebar · OPERATORS_GUIDE.md is not an operators guide for PatterStage · No in-app backup or restore
- carry: boot diagnostics inside the product [new/M] · the missing first-run step: a model the agent can call [extend/S] · browser backup/restore [new/M] · a real OPERATORS_GUIDE.md [overhaul/M] · "how do I keep it running" [extend/M] · delete setup.mjs or make it the one implementation [remove/M] · move PatterStage's logs out of the agent's home [refine/M]

### Design system and cross-cutting UX
Defects: 1 blocker, 8 major, 9 minor, 2 polish · candidates: 15
- BLOCKER: `neon-red` is not a declared token: 13 sites render with no colour, including the global error fallback and every failed tool call — src/components/ui/ErrorBoundary.tsx
- major: `semantic-error` not declared either (Tools error box invisible) · Twelve overlays bypass useDialogA11y (no Escape, focus trap, role) · Sixteen Story Weaver controls set outline-none with no replacement · Twenty controls satisfy the form-control gate by pasting the placeholder into aria-label · Collapsed sidebar has no accessible names · Mobile drawer stays focusable when closed, z-index clash · Six mouse-only bespoke dropdowns · Toast has one slot
- carry: design-lint rule: every colour class must name a declared token [new/S] · form-control gate rejects placeholder-shaped names [extend/M] · six dropdowns onto field/Select [merge/L] · Toast stack [refine/S] · adopt Button + Field Kit or stop claiming them [overhaul/XL] · write down the overlay ladder + feedback rule [new/S] · real responsive below the shell + one narrow-viewport test [extend/M] · retire ErrorBanner [remove/S]

### HTTP API surface (99 routes)
Defects: 1 blocker, 6 major, 8 minor, 2 polish · candidates: 15
- BLOCKER: PS_AUTH_MODE=none leaves script EXECUTION and deploy/restart wide open — src/app/api/scripts/run/route.ts
- major: PS_READ_ONLY does not stop three GET handlers from writing · Three sync endpoints answer 200 with success=false · GET /api/logs?lines=0 returns the whole file, ?lines=-5 skips · SSE events never abort upstream on client disconnect · Two implementations of "cancel a mission" · docs/API.md asserts an invariant nothing enforces
- carry: build gate pinning docs/API.md to the route tree [new/M] · payload sibling on the error factories [refine/M] · list-bounds + total on every list route [extend/M] · events onto sseStream [merge/M] · one cancel/dispatch entry point [remove/M] · four dead routes [remove/S] · status-and-limits section in API.md [extend/S] · OpenAPI from Zod [new/XL — deferred]

### Documentation (four audits)
Verdicts: **rewrite** README.md's role, docs/README.md, USER_WALKTHROUGH_GUIDE.md (160 KB, 10 stale claims), MIGRATION.md · **update** API.md, RUNTIME_ARCHITECTURE.md, REPO_GUIDE.md, CONTRIBUTING.md, TESTING.md, COMPOSER.md, CATALOG_AND_PROFILES.md, DEPLOY.md (7 stale), CROSS_PLATFORM.md, ENV_REFERENCE.md, SECURITY.md, MEMORY.md, LOCKBOOK.md, docs/images (7 stale PNGs) · **merge** CHAT.md → guide + architecture, TOOLS_AND_MISSIONS.md → CATALOG_AND_PROFILES, HERMES_CONFIG_INTEGRATION → ENV_REFERENCE, ANALYTICS → INSIGHTS + internals, PLATFORM_VISION → RUNTIME_ARCHITECTURE, schema/CHANGELOG → SCHEMA_VERSIONING · **archive out of the user set** OPERATORS_GUIDE.md (it is an EOS operator guide), PRODUCT_MAP, UX_AUDIT, QA_NOTES, QA_ROUND_6_BRIEF, VENTURE_BRIEF, ACCEPTANCE_SPINE, COMPILE_REPORT, EOS_FEEDBACK, RULINGS.json, eos-session0/*, genesis/*, REBRANDING.md · **keep** LABORATORY, DEEP_RESEARCH, OUTPUT_CANARY, design-tokens, DATA_STORAGE, SYSTEM-CRON, SPEND, SUPPORT, CODE_OF_CONDUCT, AGENTS.md/CLAUDE.md (with a "not for you" line in README), adr/README, SCHEMA_VERSIONING.
Gaps all four name: no Start Here / first-hour path; no Concepts/glossary (mission vs run vs schedule, profile vs personality, skill vs toolset); no troubleshooting; schedules mis-signposted ("Orchestration → Schedules" never existed); nothing explains what Hermes is and what degrades without it; the governance corpus (EOS vocabulary) sits in front of a new reader.
Converged structure: README (what it is, hero screenshot, install in four commands, "AGENTS.md/CLAUDE.md are for AI coding sessions, not you") → docs/START_HERE (the first hour: install Hermes, boot, the ?ps_token link, read Subsystems, one mission end to end, its transcript and artifact) → docs/CONCEPTS (the twelve nouns) → one guide per sidebar screen (What you see / Typical use / Notes) → Running it (deploy, env, data, backup, cross-platform, security, troubleshooting) → Reference (API, schema) → Contributing (repo guide, testing, canary, design tokens) → governance lives under org/ with one line pointing at it.

## Review findings — adversarial verification and the design panel

142 agents. Every blocker/major defect got a skeptic reading the code with
instructions to refute it, and a second opinion whenever the first was not a
clean confirm (134 verifications over 129 claims).

**Verdicts:** 125 confirmed, 3 refuted, 1 uncertain. **Corrected severities
for a solo operator:** 11 blockers, 67 majors, 44 minors, 5 polish, 2
not-a-defect. The three refuted claims (dropped): Composer read-only gaps
(D4); chat silently degrading to a raw reply when no runId (D50); no way to
re-import the skills catalogue (D83). Uncertain (kept as minor): profile-scoped
skill edits changing the global catalogue (D86).

**The eleven confirmed blockers:** D1 Composer delete with no confirm destroys
every run · D41 a scheduled non-.sh script never shows as scheduled and the
bundled scripts are .mjs · D43 conversation download exports the ACTIVE
conversation under another's title · D44 fast-mode chat sends no Authorization
header · D58 Memory "Test connection" always fails (envelope unwrapped one level
short) · D66 mission Cancel / Remove-from-queue can never be confirmed (armed
button disabled) · D76 a Config section Save is silently reverted by a later
Push from Agents · D80 enabling a granular toolset beside hermes-cli does
nothing while Save reports success · D104 the spend hard stop counts less money
than the panel shows · D106 install.sh "Reinstall" deletes the database on one
keypress · D125 three sync endpoints answer 200 with success=false. Verdicts,
corrected severities and one-line fix sketches per id: scratchpad
`verified.json`; titles/areas: `defects.json`.

**Design panel:** five lens proposals (information architecture; the complete
novice; feature overhauls; documentation as a product; consistency and finish),
each scored by three judges (a day-one operator, a maintainer, an
accessibility/consistency reviewer). Scores were close (29–34 of 40) and the
judges converged on the same grafts: five verb-first navigation groups derived
from the registry with URLs unchanged; Quests and Help as home entries; the
config tree and deploy buttons off the rail into a Settings index with a System
page; the registry as the single source of every page's name, enforced by the
navigation matrix; security items landed first (host-write guard on script
run and update, recursive secret masking in GET /api/config, read-only guards
on the three writing GETs); a Toast stack, declared-token gate and dialog
contract landed before the overhauls that need them; quests as chains proven
by real analytics events; **no** global operator level (ADR-0004 rules it
out — progress is chains/steps, achievements stay the prestige currency); one
markdown implementation shared by the site and the app (not three). Proposals
in full: scratchpad `proposals.json`; judges: `judges.json`.

## Programme — fixed parts (independent of the panel's synthesis)

### Discipline (unchanged from rounds 3–6, applied to every batch)
Oracle first: the failing tests committed alone and measured red. Implementation
gated **by exit code**: `npm run lint` (agent-files, doc-links, derived-views,
read-only guards, icon-button names, form-control names, design-lint, contrast,
coverage floors, eslint, typecheck:tests), `npx tsc --noEmit`, `npm test`,
`npm run lint:knip`, `npm run canary:check` (httpSurface changes reviewed as a
diff of the diagnostics route list against a baseline report from the
committed tree, then blessed), `npm run build`. Mutation sweep against the
committed tree; every survivor killed by a sharper oracle or recorded as
equivalent. Playwright before and after every batch (baseline 91 passed, 8
skipped). A browser walk on the isolated instance (`PS_DATA_DIR`/`HERMES_HOME`
under the scratchpad, mocks on 8747/9277, production build on 3939) for
anything visual. A task record `org/tasks/T-00xx.json` per batch, views
rendered, pushed to `dev`. Scripts go to the scratchpad via the Write tool and
run from there (the shell's heredoc parser is unreliable here).

### Documentation pipeline (decision 3)
- **Source:** `docs/**/*.md` with YAML front matter (`title`, `nav` order,
  `section`, `screen` = the route the page documents, `summary`). One manifest
  `docs/manifest.json` generated from front matter at build, never hand-edited
  (derived file: add to `check-derived-views`).
- **Generator:** `scripts/docs/build-site.mjs` — Node, `markdown-it` +
  `gray-matter` (two devDependencies, no framework): renders each page into a
  single HTML template (product dark theme from `docs/design-tokens.md`
  variables, sidebar from the manifest, previous/next, a heading index for
  client-side search built at build time as `search.json`, relative links so
  the output opens from `file://` and under the GitHub Pages base path).
  Output `site/` (git-ignored). `npm run docs:build`, `npm run docs:serve`
  (a static server on a free port), `npm run docs:check` (every relative link
  and image resolves; every `screen:` route exists in the registry; every
  registry route has a doc — this is the doc-coverage gate).
- **Screenshots:** extend `tests/e2e/screenshots.spec.ts` (already exists,
  `npm run screenshots`, `CAPTURE_SCREENSHOTS=1`) to capture every documented
  screen against the isolated instance with seeded demo data, into
  `docs/images/<route>.png`; the docs build fails on a referenced image that
  is missing. Re-captured at release.
- **Publish:** `.github/workflows/docs.yml` — on push to `main`, build the site
  and deploy to GitHub Pages (`actions/upload-pages-artifact` +
  `actions/deploy-pages`), base path `/PatterStage/`.
- **In-app:** the same `site/` output is copied into `public/help/` at
  `npm run build` (prebuild step) and served by the app at `/help/*`; the Help
  section's React shell embeds it in an iframe with the app chrome, and every
  page's header gets a `?` that deep-links to its own guide (`screen:` in front
  matter → route → `/help/<slug>`). No second copy of any prose.

### Release plan (decision 6)
1. All batches merged to `dev`; full gate; Playwright; browser walk of every
   screen on the isolated instance; docs built and `docs:check` green.
2. Tag `v1.0.0-rc.1` on `dev`; CHANGELOG.md written from the task records
   (T-0086 onward) in user language.
3. **Real-Hermes round on this machine.** Facts gathered read-only: Hermes
   Agent v0.17.0 is installed (`hermes.exe` on PATH, home
   `%LOCALAPPDATA%\hermes` with config.yaml, SOUL.md, memories, logs;
   `~/.hermes` also exists with logs and profiles); its API server is served by
   `hermes gateway run` (foreground); `hermes status` shows no model, no
   provider and no API keys. The round therefore needs the operator to
   configure a provider and key first (the reviewer never enters keys); then
   PatterStage points `HERMES_GATEWAY_URL` at the running gateway and the
   round-6 brief's "Confirm these still work" list plus the new quests chain
   are driven end to end in the Browser pane. Docker is used for the deploy
   smoke (`npm run test:docker-deploy-smoke`) and the install profiles
   (`npm run test:full-install*`).
4. Fix, re-tag rc.2 if needed, then `v1.0.0`; merge `dev` → `main`; the docs
   workflow publishes the site; README's hero screenshot and the seven
   `docs/images` are the freshly captured ones.

## The navigation and URL map the release ships (decisions 8, 11, 12, 14)

`src/lib/modules/registry.ts` is the single source for the rail, page titles,
`document.title`, the e2e route matrix, Help deep-links and quest hrefs. Each
NavLink gains `order`; the config sections move into a React-free
`src/lib/config-sections.ts` that the registry derives routes from. Old paths
answer **307** from `next.config.ts` `redirects()` for one release; the API
(`/api/*`) is untouched. The rail must not scroll at 1280×720 (Playwright
assertion).

| Group | Label | New route | Old route |
|---|---|---|---|
| — | Dashboard | `/` | `/` |
| WORK | Chat | `/work/chat` | `/orchestration/chat` |
| WORK | Missions | `/work/missions` | `/orchestration/missions` |
| WORK | Composer (flag) | `/work/composer` | `/orchestration/composer` |
| WORK | Research | `/work/research` | `/laboratory/research` |
| WORK | Scripts | `/work/scripts` | `/orchestration/scripts` |
| RESULTS | Sessions | `/results/sessions`, `/results/sessions/[id]` | `/sessions`, `/sessions/[id]` |
| RESULTS | Artifacts | `/results/artifacts` | `/laboratory/artifacts` |
| RESULTS | Insights | `/results/insights` | `/laboratory/insights` |
| RESULTS | Logs | `/results/logs` | `/logs` |
| AGENT | Agents | `/agent/profiles` (tabs: Identity · Files · Tools link · Skills link) | `/operations/agents`; `/operations/personalities` → `/agent/profiles?tab=identity` |
| AGENT | Skills | `/agent/skills`, `/agent/skills/[...path]` | `/operations/skills` |
| AGENT | Tools | `/agent/tools` | `/operations/tools` |
| AGENT | Memory | `/agent/memory` | `/memory` |
| AGENT | Models | `/agent/models` | `/config/models` |
| AGENT | Settings | `/agent/settings` (index), `/agent/settings/[section]`, `/agent/settings/restore` (was Seed), `/agent/settings/system` (new) | `/config`, `/config/[section]`, `/config/seed` |
| REC ROOM | Story Weaver | `/recroom/story-weaver/*` (unchanged) | — |
| utility rows | Quests, Help | `/quests`, `/help/[[...slug]]` (new) | — |

Module ids (`core`, `hermes`, `laboratory`, `rec-room`) and `MODULE_ACCENTS`
stay, because `tests/unit/module-registry.test.ts` and
`tests/unit/lockbook-tokens.test.ts` pin them; only sections, labels and hrefs
change. The Laboratory section label is retired. Footer: one row — version ·
branch behind an Advanced disclosure · an "update available" badge.

## Programme — batches

Twenty batches, executed in order; each is one task record, one oracle-first
commit, one implementation commit, one sweep, one push. Effort is S/M/L/XL.
Defect ids refer to `defects.json`; the fix sketches in `verified.json` are
the starting point for each. Where a batch touches a screen the docs describe,
the guide for that screen is finished in B18 against the final state.

### B0 — Scaffolding and baselines [S]
- The ADR for decision 15 (governance corpus → `org/`), committed first; the
  moves themselves happen in B15 so `check-doc-links` stays green throughout.
- Full gate + Playwright on the current head recorded as the baseline (91/8);
  canary snapshot as the blessing baseline; the isolated instance re-walked
  and its screenshots kept as the "before" set.
- Migration numbers reserved once: **038** `operator_prefs` (B3), **039**
  `models.origin` + last-imported columns (B6), **040** `runs.story_id` +
  `runs.spend_source` (B14), **041** `schedules.kind` + `script_name` (B13);
  `MIGRATION_HEAD_SCHEMA_VERSION` moves 37→41 in that order and nowhere else.
- Task records T-0094… opened, one per batch; the three refuted defects
  recorded as dropped in the first.
- Verify: gate green at baseline by exit code; numbers in the record.

### B1 — Security and truth [M] · depends B0
- D42/D123 `requireAuthenticatedHostWrites()` first in POST `/api/scripts/run`
  and POST `/api/update`; the host-side-effect paths listed in `src/proxy.ts`'s
  `PS_AUTH_MODE=none` branch so no route can forget again.
- D74 recursive masking of any `api_key` in GET `/api/config` (covers
  `fallback_providers[]`).
- D124 the three writing GETs (`stats`, `toolsets`, `sessions`) skip their
  writes under `PS_READ_ONLY` with the pragma; API.md's "every route" sentence
  softened.
- D44 fast-mode chat sends `Authorization: Bearer` like the other gateway
  callers; D45 the duplicate `recordEvent` deleted.
- D5 `PS_COMPOSER` 503 guard on the composer SSE route.
- D125/D19/D11/D20 one failure shape for every sync endpoint: `answerSingle` /
  `answerBatch` lifted into `profile-sync-shared.ts`; pull, import, models
  push/pull routed through them; `runSyncAction` gains `checkSuccess`.
- D128 the second mission-cancel implementation deleted; D127 the events
  route aborts upstream on client disconnect.
- D53/D105/D107/D108/D111 `isDeployApiEnabled` exported; GET `/api/update`
  returns `deployEnabled`; setup writes `PS_ENABLE_DEPLOY_API=true` (decision
  17); the footer is honest before the click; a fourth version-check state
  "unknown" never paints green; the 20-line failure tail is shown; a stuck
  deploy releases the UI.
- D106 `install.sh` Reinstall moves the database to a stamped backup and
  requires a typed confirmation.
- D114/D115 `--color-neon-red` declared (same value as `semantic-danger`);
  the 15 colourless sites fixed; a design-lint rule `token-must-exist` lands
  with them at a zero baseline.
- D129 API.md gains its three missing routes and a unit test that globs every
  `route.ts` and asserts a row.
- Verify: oracle route tests for each guard and envelope; Playwright unchanged.

### B2 — Shell primitives [L] · depends B1
- D122 Toast becomes a stack (cap 3, an error is never evicted by a success)
  owned by a shell-level feedback provider in `layout.tsx` that also owns
  `useAchievementUnlocks` (later the quest tracker).
- D66/D51 `ConfirmButton` on `useTwoStepConfirm` (never disabled while armed);
  design-lint `no-native-confirm`; the five `window.confirm` sites replaced.
- D116 file-level design-lint `overlay-uses-dialog-a11y`; the nine bypassing
  overlays onto `useDialogA11y` (role, aria-modal, Escape, focus trap, return
  focus).
- D117 one global `:focus-visible` outline token and a skip link; the sixteen
  bare `outline-none` sites fixed; rule `no-bare-outline-none`.
- D118/D119/D120 the form-control gate rejects a placeholder-shaped name; the
  icon-button gate sees collapsed sidebar links; the mobile drawer is `inert`
  when closed and above the header.
- Decision 13 `src/lib/status-labels.ts`: typed exhaustive label maps for
  mission, session, story, composer run, subsystem, sync; `StatusBadge` and the
  Story Weaver hub/library consume it first.
- Read contract: `LoadErrorBanner` gains a compact variant and `onRetry`;
  `ErrorBanner` retired; `EmptyState` only after a successful read; the nine
  false-empty pages (Composer runs, Missions, Agents, Library, Characters,
  Themes, Research, Artifacts, Chat sidebar) fixed here.
- `docs/COPY.md` written (three registers; no ADR/WG/T-00xx words in user
  copy; sentence case; push/pull vocabulary); `copy-lint.mjs` ships in
  `--report` mode.
- Verify: oracles per primitive; a11y fixtures per overlay; Playwright +1
  drawer spec.

### B3 — Registry regroup, URL renames, Settings → System, operator prefs [L] · depends B2
- The map above: folders moved under `src/app/{work,results,agent}`; registry
  regrouped with `order`; `redirects()` in `next.config.ts` (307) for every
  old path; `ConfigGroupSection` deleted (D55); Laboratory label retired;
  deploy buttons off the rail (decision 12); Quests and Help rows added with
  placeholder pages so the orphan walk stays green.
- Titles from the registry: `PageHeader`/`PageTitle`/`document.title` resolved
  by `labelFor(pathname)`; the seven typed mismatches deleted; the dashboard on
  `PageHeader` with the framework name from data (D56).
- **038** `operator_prefs` (key, value_json, updated_at) + repository + PUT
  `/api/prefs` with a Zod allow-list (sidebar.collapsed, dispatchStrip.open,
  quests.completedAt, quests.skipped, guide.hidden, help.lastSlug);
  `requireNotReadOnly`.
- D109 GET `/api/status/runtime` (auth mode, deploy API, read-only, composer
  flag, data dir, DB path, HERMES_HOME, port, schema version, git hash, app
  version) and the `/agent/settings/system` page: "This install" card with
  "Copy for a bug report", the update/rebuild/restart controls, backups card
  placeholder (filled in B6).
- The Settings index derives its grid from `config-sections.ts` (D79 count
  fixed; Models, HERMES.md, Environment, Restore defaults, System cards
  present) and gains a field search across every section.
- Sidebar rendered once and portalled into the drawer; collapse persisted.
- Canary: httpSurface changes wholesale (page routes renamed) — reviewed as a
  diff of the diagnostics route list and blessed once.
- Verify: module-registry tests (grouping, order, uniqueness, no orphan),
  redirect tests for every old path, nav-labels-equal-titles test, prefs
  route tests, runtime route test, migration 038 test; Playwright
  navigation-matrix regenerates from the registry; a no-scroll rail
  assertion.

### B4 — Analytics taxonomy extended once [M] · depends B1
- Append to `ANALYTICS_EVENT_TYPES`: `research.started`, `research.completed`,
  `research.failed`, `research.cancelled`, `composer.run_started`,
  `composer.run_completed`, `composer.run_failed`, `composer.gate_approved`,
  `composer.workflow_saved`, `profile.created`, `profile.pushed`,
  `profile.pulled`, `toolset.saved`, `config.saved`, `memory.configured`,
  `memory.retained`, `template.saved`, `mission.cancelled`, `script.saved`,
  `script.run`, `script.scheduled`, `artifact.saved`, `backup.taken`,
  `credential.added`, `model.added`, `help.opened`; categories updated
  (Research; Composer folded into Workflows).
- Emitted only after the write succeeds and only from POST/PUT/DELETE paths.
- `personality.changed` re-homed to the write path the Identity tab uses
  (D-uncertain 86 noted); Completionist reads a curated list; `RawMetrics`
  gains per-type counters and the store facts the quest evaluator reads.
- Verify: one emit-site test per type; categories exhaustiveness compiles.

### B5 — Dashboard as an operations board; Insights as the history page [M] · depends B3, B4
- `CommandCenter` cut to a Progress line (streak, top agent level, achievements
  count, next automation, Quests link); the Rec Room panel and LiveClock
  removed; six pills (Gateway, Memory, Scheduler → System, Spend → Insights,
  Processes from the agents query, Errors); the hero tiles, throughput, mix,
  run-activity and trophy case live on Insights only.
- D54/D57 a failing `/api/monitor` renders "Couldn't read monitor data — Retry",
  never skeletons forever, never a green pill on an unread panel; the first-run
  panel is stable against partial facts.
- D110 fourth first-run step "Give your agent a model"; D96/D97/D100 Insights
  range switch drives every tile, one money number, Retry retries every query.
- Verify: dashboard render test with a rejecting fetch; first-run-steps tests;
  Insights tests; screenshots recaptured.

### B6 — Models, credentials, restore, config [L] · depends B3, B4
- **039** `models.origin` ('import'|'user') + last-imported name/base_url; no
  write on page load (the mount-time import deleted); edits survive re-import
  (D10); "Re-import from config" is explicit; drift banner gains per-line Pull
  / Push (decision 13 wording).
- D9 cleared defaults stay cleared (removal round-trips through
  `syncDefaultsToHermesConfig`).
- D12/D13 the diff route is a real diff; the Export modal cannot silently do
  nothing.
- D14 PATCH `/api/credentials/[id]` (rotate) + "Rotate key" per row; D15
  keyless providers need no key.
- D16/D17 Restore page (was Seed): counts the shipped pack, shows results,
  empty states, novice copy with the mechanics behind a disclosure.
- D113 GET/POST `/api/backup` (list `.bak`s, take a `better-sqlite3` backup);
  a Backups card on Settings → System with the verbatim restore command;
  destructive restore actions snapshot first.
- D76 (blocker) PUT `/api/config` refreshes `agent_root.config_yaml` when it
  wrote the root file, and preserved sections join the semantic compare so a
  Push cannot revert a Save; D75 the Settings index shows the parse error;
  D77 min/max enforced both ends; D78 an explicit unset state with "Clear"
  deleting the key.
- Verify: oracles per defect; mutation sweep on models-repository and
  config-sync; browser walk of Models and Settings.

### B7 — Memory and Logs [M] · depends B6
- D58 (blocker) Test connection reads the real envelope; D65 Save keeps the
  loaded row's type and label.
- D64 one provider switch: the DB row is the truth, `config.yaml
  memory.provider` is written on Save (decision, stated above); the `/agent/
  settings/memory` field renders read-only pointing at Memory; the two stacked
  first-visit warnings collapse into one "Set up memory" card.
- D60/D61/D62/D63 Enter runs Recall; three distinguishable empty states ("no
  memories yet" / "nothing matched" / "N older than 90 days — show them");
  "proof count" not "relevance %".
- D59 log auto-scroll and "Latest lines" reattached; "Delete All" disabled on
  an empty page; confirm on directive and mental-model delete; per-file
  copy/download.
- Verify: component tests with the real double envelope; browser walk against
  mock-hindsight (Test connection green, Save round-trips).

### B8 — Agents [M] · depends B4, B6
- D18 (blocker) Clone From: Default actually clones the root files.
- D21/D22 silent refetch after the first load; error card + Retry; empty
  state only on a successful empty read.
- D23 discard guard (inline confirm) on select, open file and close.
- Decision 16: Edit profile (name, description) wired to the existing PUT;
  root agent display name in PatterStage (D24/D25).
- D26/D27/D28 "missing" never shown for a file the editor opens; `syncError`
  and "Last pushed …" rendered; PUT of HERMES.md for a named profile answers
  400.
- The explanatory paragraph rewritten in the novice register (file names and
  the ADR reference behind a disclosure); the level card's "capability not
  implemented" sentence removed.
- Verify: route and page tests per defect; mutation sweep on the clone branch
  and the guard.

### B9 — Skills, Tools, and the Personalities fold [L] · depends B8
- D80 (blocker) the Tools grid is bundle-aware: a granular toolset covered by
  an enabled `hermes-*` bundle renders pressed-and-disabled with the reason;
  normalisation dedupes only on the write path; enabled vs disabled chips are
  visibly different; unsaved changes guarded on profile switch (D84); the
  advanced-JSON edits are not discarded (D82-adv).
- D81 the skill viewer tolerates the thinner payload and becomes the
  catalogue's destination; D82 toggling a disk-only skill works; "Re-import
  from Hermes" in the Skills header; sharing across profiles stated where the
  edit happens.
- Decision 11: Personalities becomes the Identity tab on `/agent/profiles`
  (SOUL.md preview + editor, writing through the same patch path);
  `/operations/personalities` 307s; the page, nav entry, `/api/personalities`
  and the caller-less PUT `/api/agent/personality` go.
- Verify: toolset-normalize tests; page tests; redirect test; the Shapeshifter
  oracle (editing on the Identity tab records `personality.changed`).

### B10 — Missions [M] · depends B2, B4
- D66 (blocker, primitive from B2) Cancel and Remove-from-queue confirmable;
  D73 per-row two-step confirm on scheduled-mission delete, failures surfaced;
  D71 category rename/delete failures surfaced.
- D67 a failed fetch renders an error + Retry, never the first-run state.
- D68/D69 the API sends the schedule (renamed from `cronJob`) and `sessionId`;
  the panel card and badge light up; "View sessions" links into
  `/results/sessions?missionId=`; D-major "why isn't it firing" line on the
  schedule card.
- D70/D72 the template editor gets its own draft state; Save-as-Template
  cannot overwrite the last-open template; the insights strip agrees with the
  board (one count set, decision 13 labels).
- Verify: hook and route tests; Playwright missions specs.

### B11 — Sessions [L] · depends B2, B10
- D29/D30 (blockers) source vocabulary from the API's `bySource` with an
  unknown-source fallback; a Failed badge with exit code on rows, error on the
  transcript, a Failed filter.
- D31 API noise is duration-based in SQL; D35 a guard on the inline state.db
  sync; D36 refetch while anything is live + Refresh on a running transcript.
- D32 valid interactive nesting (stretched-link rows); D33 a status-aware error
  + Retry instead of "Session Not Found"; D37 search/filter/page in the URL;
  D38 expand-all, in-transcript search, role chips, copy transcript; D39
  First/Last + page size; D40 payload cap with a truncated flag (virtualisation
  deferred).
- D34 the group card says "N on this page" (SQL group-by deferred).
- Verify: filter tests, card tests, URL-state test, a jsdom nesting test;
  Playwright sessions spec.

### B12 — Composer [M] · depends B2, B4
- D1 (blocker) DELETE answers 409 with the run count unless
  `?discardRunHistory=1`; the UI confirms naming the workflow and count.
- D2 description round-trips (input beside the name; schema optional +
  COALESCE); D3 runs-list and detail errors rendered; D6 success/failure tone;
  D7 unsaved Build-tab work guarded; D8 gate notes shown and fed back into the
  retried stage's context.
- Two starter workflows seeded ("Research then summarise": research → gate →
  write; "Draft and review": draft → review), Duplicate, workflow name on run
  rows, "waiting on a question" vs "at a gate"; `composer.*` events (B4).
- Verify: route and canvas tests; a new composer Playwright spec against
  mock-hermes.

### B13 — Scripts and Chat [M] · depends B2, B4
- D41 (blocker)/D46/D47/D48 one `SCRIPT_EXT_RE` in `src/lib/scripts/
  script-ext.ts` used everywhere; seven extensions end to end; `.mjs`
  templates; no double extensions.
- Decision 10: GET `/api/scripts` returns `scheduler: {available, reason}`;
  where no crontab exists (native Windows) **041** adds `schedules.kind
  ('mission'|'script')` + `script_name` so PatterStage's own tick runs scripts
  ("Runs while PatterStage is running" on the row); the Schedule modal writes
  that row when the host scheduler is unavailable.
- D43 (blocker) download exports the clicked conversation; D52 the CSV export
  is reachable by keyboard; D49 conversation list/load errors surfaced; D51
  `ConfirmButton` on script delete with a scheduled-job warning.
- Verify: schedule-map and extension tests; the fallback scheduler test with a
  stubbed win32; download-handler test; native Windows browser walk.

### B14 — Story Weaver and Research [L] · depends B2, B4, B5
- D88 (blocker) no generation on mount; "Write chapter N" / "Keep writing"
  with a Stop that aborts before the next call (`LLMOptions.signal`).
- D87/D104 (blockers) **040** `runs.story_id` + `runs.spend_source`; story
  usage recorded from `callLLM`; SPEND_SOURCES gains 'story'; the hard stop
  and the panel share one "recorded spend in this window" helper.
- A writing-model selector over the registry (agent default preselected);
  D89 theme delete field name; D90/D91 the length/count controls honoured or
  removed; D92 premise on the wire; D93 error states on Library, Characters,
  Themes; D94 Save-to-Library reads the real response; the hub and library use
  the ratified status words ("Failed" is "Failed" everywhere); the reader's
  doubled "Chapter 1: Chapter 1" heading fixed.
- Research: D98 cancel (route + run-job bail-out); D99 write errors surfaced;
  D101 confirmed artifact delete; D102 a run header (model, provider, depth,
  duration, tokens); D103 the three pages on `AppPageShell`.
- Verify: spend-parity test (summary total == guard total across all sources);
  reader tests; edit handler tests; cancel test; create-page response-gate
  tests.

### B15 — Docs pipeline, re-tier, Start Here and Concepts [XL] · depends B3, B4
- Decision 15 moves (with the ADR from B0): the corpus to `org/`
  (`org/LOCKBOOK.md`, `org/RULINGS.json`, `org/genesis/`, `org/logs/…`),
  `OPERATORS_GUIDE.md` → `org/EOS_OPERATORS_GUIDE.md`, inbound references
  updated in the same commit; `docs/README.md` becomes the six-tier reading
  path with one pointer to `org/`.
- Re-tier `docs/` into `start-here/`, `concepts/`, `guides/` (one per registry
  route), `running/`, `reference/`, `contributing/`; kebab-case slugs; front
  matter (`title`, `summary`, `section`, `nav`, `audience`, `screen`,
  `concepts`, `shots`); `docs/manifest.json` generated and held by
  `check-derived-views`.
- `scripts/docs/build-site.mjs` (markdown-it + gray-matter) → `site/` (relative
  links, dark theme from the token variables, manifest sidebar, prev/next,
  `search.json`, `.nojekyll`) and `public/help/{fragments,manifest.json,
  concepts.json,search.json}` (git-ignored, produced by `prebuild`/`predev`);
  `scripts/docs/serve.mjs`; `scripts/docs/extract.ts` for generated blocks
  between `<!-- generated:… -->` markers (achievements, event types, lint
  steps, config sections, seed manifests, API routes via the canary walk,
  schema head, quest defs, the env table from `.env.example`);
  `scripts/docs/check.mts` (a registry route without a guide, a `screen:` not
  in the registry, a missing image, an undefined concept id, a stale generated
  block, a leftover old group name) joins `npm run lint`.
- `.github/workflows/docs-pages.yml` (decision 9): on push to `main`, build
  and deploy to Pages under `/PatterStage/`; a CI docs-build step in `ci.yml`.
- Written here: `start-here/` (what it is; Windows/WSL2/Linux/macOS install per
  decision 10; the first hour; quests; getting help) and `concepts/` (agent,
  prompt, model/provider/API key, profile vs personality, skill vs tool vs
  toolset, memory, session vs transcript, mission vs run vs schedule, workflow
  and gate, artifact, spend) — each entry: what it is, what it is not, where
  you meet it, the idea behind it.
- Verify: `docs:check` fixtures red then green; build output opens from
  `file://`; fragments/manifest/concepts exist for every page.

### B16 — In-app Help [M] · depends B15
- `src/app/help/[[...slug]]/page.tsx` (server component) renders the fragment
  and manifest inside `AppPageShell` + `PageHeader` with `HelpNav` (rail
  order), `HelpSearch`, prev/next — no iframe; `/help*` stays behind the
  cookie.
- `HelpLink` (?) on every `PageHeader`, resolved automatically from the
  pathname via the manifest's `screen:`; `docs:check` proves every registry
  route resolves.
- `ConceptHint` popover (keyboard-focusable, Escape, `aria-describedby`) fed by
  `concepts.json`, used where a term is first met (Chat: agent/prompt;
  Missions: mission/run/schedule; Agents: profile/personality; Skills/Tools:
  skill vs toolset; Memory; Models: model/provider/API key; Composer:
  workflow/gate; Research: artifact).
- Decision 7: the Demo is the tour — one page per screen under `start-here/
  tour/` with the screenshot, "what you see", "what to do here" — rendered in
  Help; `help.opened` recorded.
- Verify: resolver tests for every route; render test; ConceptHint a11y test;
  a Playwright spec that presses ? on Missions and lands on its guide.

### B17 — Quests [L] · depends B4, B5, B12, B13, B14, B16
- `src/lib/quests/quest-defs.ts` (content as data: id, chapter, title, action
  sentence, proof = event type + target or store fact, screen href from the
  registry, teaches = concept ids, requires = gateway | memory | composer |
  host-scheduler, earns = achievement id) and a pure `evaluateQuests()` run
  inside `getDashboardStats()` after `evaluateAchievements`, so the dashboard
  card, the `/quests` page, the rail badge `[n/N]` and the toast all read the
  existing stats poll at zero extra requests.
- Completion latched as `completedAt` in `operator_prefs` (written from the
  stats reader beside the progression snapshots, skipped under read-only with
  the pragma) so retention cannot un-complete a quest; the first evaluation
  seeds silently (no toasts for past actions); Skip and "hide the guide" via
  PUT `/api/prefs`; `requires` renders "unavailable on this host — here is
  why" cards (script scheduling on native Windows reads exactly that until
  B13's fallback exists, then completes through it).
- Chapters shipped: **1 Get running** (add a model; add a credential or pick a
  keyless provider; first chat message; first mission dispatched; see it
  finish — these ARE the first-run checklist; `FirstRunPanel` is replaced by
  the NextQuest card on the same data) · **2 Missions** (from a template; save
  a template; schedule one; watch it fire; cancel one) · **3 Shape your agent**
  (second profile; give it a personality; toggle a skill; save a toolset; save
  a settings section; connect memory; retain a fact; push to Hermes) ·
  **4 Automate and watch** (save a script; run it; schedule it; read a session
  transcript; read its artifact; read the logs) · **5 Multi-stage work**
  (run the starter workflow; approve a gate; run Deep Research; save an
  artifact) · **6 Rec Room** (create a story; write a chapter; finish a story)
  · **7 Keep it healthy** (take a backup). Each quest names what it teaches
  and earns the matching existing achievement where one exists; new chain
  achievements (First Hour, Agent Shaper, Clockmaker, Curriculum) are added to
  `ACHIEVEMENT_DEFS`. No operator XP/level.
- `/quests` page: chapter accordions, progress ring, Teaches chips on
  `ConceptHint`, Earns chips on `AchievementBadge`, Skip, Go; QuestTracker in
  the shell feedback provider toasts a completion on any page.
- `docs/quests.md` carries a generated block from the defs.
- Verify: quest-derive tests per proof from fixtures; the latch survives a
  metrics reset; integrity test (every screen is a registry route, every
  earns/teaches id exists, every proof event is in the taxonomy); a Playwright
  spec that dispatches a mission and sees quest 1.4 tick.

### B18 — Docs content, README, screenshots [XL] · depends B15, B16, B17
- The 160 KB walkthrough split into one guide per registry route (What you see
  / Typical use / Notes; internals behind a disclosure; the new titles and
  routes; corrections the maps recorded), merging CHAT, TOOLS_AND_MISSIONS,
  COMPOSER, MISSIONS, MEMORY, DEEP_RESEARCH, LABORATORY, CATALOG_AND_PROFILES;
  a guide for Logs and Sessions (new); `running/` (operating, configuration
  from `.env.example`, platforms incl. the native-Windows boundary, security,
  backup and upgrade, troubleshooting symptom-first, limitations);
  `reference/` (API with the generated inventory, data storage, schema,
  analytics events, achievements, quests); `contributing/` (repo guide,
  testing, canary, design tokens, COPY.md).
- README as the front door: what it is, one hero screenshot, four commands,
  where the docs are, "AGENTS.md and CLAUDE.md are for AI coding sessions, not
  for you".
- Screenshots: `tests/e2e/screenshots.spec.ts` driven by each guide's `shots`
  against the isolated mock instance with `seed-demo.mjs` creating content
  through the public API, `page.clock` fixed, tokens and paths masked, one PNG
  per guide; the build fails on a missing referenced image.
- `CHANGELOG.md` from T-0086 onward in user language.
- Verify: `docs:check`, `check-doc-links`, `copy-lint --report` on quoted UI
  strings, `npm run screenshots` produces every PNG, the site opens from
  `file://` and under `/PatterStage/`; one novice read of Start Here through
  chapter 1 by the operator.

### B19 — Release [L] · depends B18
1. Full gate, Playwright, mutation survivors reconciled, browser walk of every
   screen at 1280×720 and 390×844 on the isolated instance; docs built;
   `package.json` → 1.0.0-rc.1; tag `v1.0.0-rc.1` on `dev`.
2. Real-Hermes round on this machine, natively (decisions 10, 18): the operator
   configures the API-key provider in Hermes and on the Models page; `hermes
   gateway run`; PatterStage points `HERMES_GATEWAY_URL` at it; the quest
   ledger chapters 1–7 driven end to end in the Browser pane (chapter 4's
   script scheduling completes through the fallback scheduler), then the
   round-6 "Confirm these still work" list; Docker: `test:docker-deploy-smoke`,
   `test:full-install`, `test:full-install-release`,
   `test:full-install-hermes`. Every finding is a defect with the same
   verify-then-fix loop; rc.2 if any blocker.
3. Tag `v1.0.0`, merge `dev` → `main`; `docs-pages.yml` publishes; the
   operator enables Pages (source: GitHub Actions); README hero and
   `docs/images` are the freshly captured set.

## Deliberately deferred (post-1.0)
Tools folded into Agents as a tab (kept top-level and deep-linked in 1.0);
Themes folded into Create; the Ctrl/Cmd-K command palette; Sessions tier 2
(SQL group-by-mission aggregate, virtualised transcript, state.db sync fully
off the read path); Composer node versioning and server-side run pagination;
the six bespoke dropdowns onto one listbox and Button/Field-Kit adoption; the
full raw-red repaint and MODULE_ACCENTS on the nav; copy-lint as a hard gate
with the full 25-screen sweep; a second Playwright project at 390×844 over the
whole matrix; operator-scoped achievements; story export and reading-position
memory; a raw config.yaml editor and per-section Zod schemas; a native Task
Scheduler backend for Scripts; streaming Run-now output; server-side log
search; OpenAPI from Zod; the envelope contract test over all 99 routes;
list-bounds on the remaining list routes; a dedicated Spend page; a public
unauthenticated /help; moving PatterStage's logs out of the agent's home;
deleting `setup.mjs` or `setup.sh`; the 40-item dead-code list (one deletion
per commit, each with its own oracle).

## Verification (how the whole programme is proven)
- **Per batch:** the discipline above, by exit code; a task record with the
  mutation result and the proof.
- **Cross-batch invariants held by gates:** registry = titles = document.title
  (navigation matrix); every registry route has a guide, a screenshot and a ?
  that resolves (`docs:check`); every colour class names a declared token;
  no native `confirm`; every overlay on the dialog contract; no placeholder
  as a name; every list read has an error state before an empty state
  (`no-raw-fetch-outside-lib` + the nine-page spec); the generated blocks in
  the docs are current; `org/TASKS.md` and `docs/manifest.json` match their
  sources.
- **End to end on the isolated instance** before the tag: the 27+3 screens
  walked; the quest ledger completed against mock-hermes/mock-hindsight/
  mock-llm; the docs site opened from `file://`.
- **End to end on a real Hermes, natively on this machine:** the same ledger,
  the round-6 confirm list, the Docker profiles.
- **The novice read:** the operator reads Start Here and completes chapter 1
  from the published site without asking anything; anything they had to ask
  is a defect.
