# Control Hub — Code Cleanup & UI/UX Design Review
**Branch:** `chore/code-cleanup-and-design-review`
**Date:** Friday, May 8, 2026
**Reviewer:** Bob (PatterTech CEO)

---

## Part 1: Code Cleanup (Completed)

### Changes Made

| File/Directory | Action | Reason |
|---|---|---|
| `src/lib/missions-repository.ts` | Deleted | Completely superseded by `mission-repository.ts` — zero references remain |
| `src/lib/mission-templates-oss.ts` | Deleted | Templates inlined into `mission-helpers.ts` — import chain simplified |
| `src/lib/memory-providers/types.ts` | Deleted | Types inlined into `memory-providers/index.ts` — holographic.ts needed them too |
| `src/lib/mission-helpers.ts` | Fixed | Removed `mission-templates-oss` import; inlined all 9 TEMPLATES constant |
| `src/lib/memory-providers/index.ts` | Rewritten | All types from `types.ts` inlined; fixed `HERMES_PATHS.config` reference |
| `src/lib/memory-providers/holographic.ts` | Fixed | Import changed from `./types` to `./index` |
| `src/__tests__/oss/templates-oss.test.ts` | Updated | Imports `TEMPLATES` from `mission-helpers`; count updated to 9 |

**Verification:**
- Build: 50 routes, 0 errors
- Tests: 36 suites, 336 tests — all passing

### Scripts Directory Audit

All scripts are legitimate and in active use:
- `install.sh` — Standalone installer (referenced by `scripts/setup.sh`)
- `setup.sh` — Post-clone setup (npm install, build)
- `update.sh` — Pull + build + restart (referenced by Update API route)
- `restart.sh` — Stop + restart server (referenced by Update API route)
- `build.sh` — npm run build wrapper (referenced by Update API route)
- `prebuild-db.mjs` — Pre-build DB migration (referenced in `package.json` prebuild)
- `backup-hermes-config.sh` — Backup utility
- `release.sh` — Release script
- `stop.sh` — Stop script
- `hindsight-server.py` — Hindsight server (referenced by setup-hindsight.sh)
- `setup-hindsight.sh` — Hindsight memory provider setup
- `scripts/profiles/` — Agent profile templates (used by install.sh)

**All scripts are in active use — no cleanup needed.**

### Stale Data Directories

| Directory | Status |
|---|---|
| `data/stories/` | **Already deleted** (prior session) |
| `data/operations/` | **Already deleted** (prior session) |
| `data/recroom/` | **Already deleted** (prior session) |

---

## Part 2: UI/UX Design Review

Reviewed every page a user could navigate to. No JavaScript errors across any page.

---

### Dashboard (`/`)

**Observations:**
- **MISSION/CONTROL** heading is plain text with no visual hierarchy or branding
- Platform status (Telegram/Slack/WhatsApp) shows "Disabled" — this is correct but could visually distinguish disabled from misconfigured
- Dashboard error log section is very text-heavy — the raw log format is hard to scan
- "OPEN TRANSCRIPT" link could be more prominent
- The bottom action bar (Check/Rebuild/Restart/Collapse) floats at page bottom — it's always visible which is useful but may obscure content on shorter viewports
- **Good:** Live clock, compact platform status at a glance, collapsible mission dispatch section

**Priority Issues:**
1. **Error log section is overwhelming** — showing ~10 raw log lines is noisy. Consider: a summary count ("3 errors today"), a severity filter, or collapsed-by-default with expand
2. **MISSION/CONTROL heading** — could use the neon accent treatment or a small logo
3. **No hero metrics card** — the key stats (agents, sessions, cron, memory) could be presented as a row of 4 glowing metric cards

---

### Missions (`/missions`)

**Observations:**
- Template grid shows colour-coded category pills (pink/cyan/green/red/purple/orange)
- Filter tabs (All/Queued/Dispatched/Successful/Failed) provide good quick filtering
- "Edit Templates" button available for each template
- Empty state appears when no missions match filter
- Search box for quick filtering

**Priority Issues:**
1. **Category filter missing** — with 9+ templates across multiple categories, a category filter (e.g. "Engineering", "DevOps", "QA") would help
2. **Template cards are text-heavy** — description + instruction preview is dense; consider showing just the icon, name, and category pill on the card face with expand-on-hover
3. **No visual indicator for template being actively used** — if a template was recently dispatched, it could show a subtle glow or "Recently used" badge

---

### Kanban (`/kanban`)

**Observations:**
- Board selector tabs (All Boards / Sprint Board / Test Board / PatterTech Launch) work well
- WIP limits per column not visible — worth adding
- Cards show clickable areas but no visible priority/status colour coding on the cards themselves
- "Add Column" / "Delete Column" buttons are exposed — risk of accidental deletion; should require confirmation modal

**Priority Issues:**
1. **Card detail modal** — need to open a card to evaluate this; not reviewed in snapshot
2. **Column header actions exposed** — "Delete Column" visible without clicking, risk of accidental deletion; suggest moving to column kebab menu
3. **No WIP limits shown** — Kanban best practice is visible WIP limits on column headers

---

### Teams (`/orchestration/teams`)

**Observations:**
- Clean, minimal list of teams
- "New Team" button, each team has Board + View Members links
- **Appears functional but minimal** — not enough content to fully evaluate

**Priority Issues:**
1. **No team cards with stats** — could show member count, open tasks, last activity
2. **No team creation UX visible** — need to click New Team to see the form

---

### Cron (`/cron`)

**Observations:**
- Clean empty state with "No cron jobs" and "Create Job" CTA
- "Pause all" button — sensible default state
- Search + "New Job" button present

**Priority Issues:**
1. **No jobs to review — need populated state to evaluate** — design seems clean for empty state
2. **Job creation form** — need to create a job to review the form UX

---

### Sessions (`/sessions`)

**Observations:**
- Very long list of sessions — pagination needed for 1000+ sessions
- Session rows show: timestamp, relative time ("49m ago"), size, source type (cli/cron)
- Mixed format: some sessions show "Session — May 8, 2026 19:27" and others show "20260508 152456 f48826" — inconsistency in naming format
- **No pagination controls** visible — likely all sessions load at once which will be slow

**Priority Issues:**
1. **Inconsistent session naming** — some sessions named as "Session — May 8, 2026 19:27" others as "20260508 152456 f48826" — should be consistent
2. **No pagination** — 1000+ sessions will cause long scroll; needs load-more or pagination
3. **Session size shown but no date column** — relative time only, absolute date only on hover

---

### Memory (`/memory`)

**Observations:**
- Holographic memory page with semantic search
- "Memories / Directives / Mental Models" tabs
- "Recall" and "Reflect" buttons present
- Friendly Redis error handling was added in previous session

**Priority Issues:**
1. **Semantic search box has no search button** — user presses Enter; unclear if query fires on Enter or button
2. **No fact count visible** — dashboard shows "0 facts" but this page doesn't show a count

---

### Skills (`/skills`)

**Observations:**
- Category accordion with count badges (e.g. "autonomous-ai-agents 6/6")
- Per-skill: name, description, View button
- Profile selector dropdown (Bob, .Retired, Devops, Qa)
- Search box
- Some categories show "0/N" (disabled) e.g. "apple 0/4", "email 0/1" — these are visually greyed/disabled

**Priority Issues:**
1. **Skill cards are very plain** — just name and `name:` label, no description text, no icon; could be much richer
2. **Category accordion is text-heavy** — large count numbers dominate the labels; consider compact pills
3. **No skill enable/disable toggle visible in list** — only "View" button; toggling requires navigation

---

### Personalities (`/personalities`)

**Observations:**
- 15 personalities listed (catgirl, concise, creative, helpful, hype, kawaii, noir, philosopher, pirate, shakespeare, surfer, teacher, technical, uwu)
- Each has: Copy prompt, Activate, Edit, Delete buttons
- "HOW PERSONALITIES WORK" section at bottom with explanatory text
- No active personality highlighted/differentiated

**Priority Issues:**
1. **No active personality highlighted** — currently active personality should have a visual indicator (glowing border, checkmark badge, or distinct colour)
2. **Copy prompt + Activate + Edit + Delete** — 4 buttons per card is too many; consolidate (e.g. kebab menu for secondary actions)
3. **Personality cards could show a preview** of the personality tone or a sample response

---

### Gateway (`/gateway`)

**Observations:**
- Platform status (Telegram, Discord, Slack, WhatsApp) with Connected / Not configured states
- Recent gateway log entries with INFO/WARNING/ERROR colour coding
- Refresh button
- **Clean and functional**

**Priority Issues:**
1. **Discord connected but other platforms not configured** — should distinguish "Not configured" from "Disabled" vs "Error"
2. **Log entries show raw level names** — INFO/WARNING/ERROR could use colour-coded pills

---

### Logs (`/logs`)

**Observations:**
- Multiple log files selectable (agent.log, errors.log, gateway.log, etc.)
- Line count selector (100/200/500/1000)
- Log entries are monospace, dense, coloured by level
- Filter button present

**Priority Issues:**
1. **Log viewer is very plain** — monospace wall of text; consider syntax colouring for timestamps/levels
2. **No auto-refresh** — logs don't update unless user manually refreshes
3. **errors.log is 364KB** — opening it should warn about size or paginate

---

### Config (`/config`)

**Observations:**
- Section cards: Personalities, Toolsets, then CORE/INFRASTRUCTURE/SECURITY/VOICE/AUTOMATION/INTEGRATIONS
- Each card shows field count and has a brief description
- Clean two-column grid layout

**Priority Issues:**
1. **"Personalities Manage personality presets..."** description text is awkwardly truncated or wrapped — needs text truncation with title tooltip
2. **Section headers (CORE, INFRASTRUCTURE, etc.) are plain H2s** — could use a subtle divider or icon to group them visually
3. **Some sections show "+1 complex" or "+8 complex"** — "complex" is unclear jargon; should say "advanced settings" or similar

---

### Agent Profiles (`/agent/agents`)

**Observations:**
- 5 agent cards shown as generic clickable elements
- "New Agent" button
- No content visible in snapshot beyond clickable cards

**Priority Issues:**
1. **Agent cards show no information** — need to open to see what data is displayed; likely needs richer card design
2. **Empty state design not seen** — would expect ghost state for new users

---

### Tools (`/agent/tools`)

**Observations:**
- Core Tools (4/4) — all enabled
- Platform Tools (1/7) — 1 enabled, others disabled with Enable buttons
- Register Tool button

**Priority Issues:**
1. **Tool list is plain** — name + Enable/Disable button only; no description or category
2. **No tool details panel** — clicking a tool should show description, parameters, etc.

---

### Story Weaver (`/recroom/story-weaver`)

**Observations:**
- Landing page shows stats: 1 story, 1 complete, 0 in progress, 6 chapters, 18,436 words
- Recent stories list with "Create", "Library", "Characters", "Themes" buttons
- Has sub-navigation: Library, Create, Characters, Themes

**Priority Issues:**
1. **Stats look like raw numbers** — could use a richer dashboard card treatment
2. **Story cards are minimal** — need to see what data they display

---

### Story Weaver Library (`/recroom/story-weaver/library`)

**Observations:**
- Story cards with Continue / Read / Delete actions
- **Not reviewed in detail — snapshot not captured**

---

### Story Weaver Create (`/recroom/story-weaver/create`)

**Observations:**
- Multi-step form visible
- **Not reviewed in detail — snapshot not captured**

---

## Summary of Priority Issues

### High Priority (Impact: User Experience)

| # | Page | Issue | Solution |
|---|---|---|---|
| 1 | Sessions | No pagination for 1000+ sessions | Add load-more or paginated pagination controls |
| 2 | Sessions | Inconsistent session naming format | Normalise all session titles to "Session — MMM DD, YYYY HH:MM" |
| 3 | Personalities | No active personality highlighted | Add glowing border/checkmark to currently active personality card |
| 4 | Kanban | Delete Column exposed without confirmation | Move to kebab menu or add confirmation modal |
| 5 | Dashboard | Raw error log section is overwhelming | Add severity filter, collapsible sections, or error count summary |

### Medium Priority (Polish & Visual)

| # | Page | Issue | Solution |
|---|---|---|---|
| 6 | Dashboard | MISSION/CONTROL heading has no visual branding | Add neon accent treatment or subtle logo |
| 7 | Skills | Skill cards are plain text only | Add description snippet, icon, and category pill |
| 8 | Personalities | 4 action buttons per card | Consolidate to icon buttons + kebab menu |
| 9 | Config | "Complex" jargon unclear | Replace with "advanced settings" |
| 10 | Logs | No auto-refresh | Add live tail mode or auto-refresh toggle |
| 11 | Missions | No category filter | Add Engineering/DevOps/QA category filter |
| 12 | Missions | Template cards are text-heavy | Show icon+name on card face, expand on hover |
| 13 | Memory | Semantic search UX unclear | Add search button or clarify Enter-to-search |
| 14 | Skills | Profile selector shows duplicated profiles (Bob appears twice in dropdown) | Deduplicate profile list |

### Lower Priority (Nice to Have)

| # | Page | Issue | Solution |
|---|---|---|---|
| 15 | Dashboard | Bottom action bar (Check/Rebuild/Restart) may obscure content | Consider floating card or sticky sidebar positioning |
| 16 | Config | Section descriptions truncate awkwardly | Add CSS text-overflow ellipsis with title tooltip |
| 17 | Gateway | Platform status needs 3-way distinction | Differentiate Not Configured / Disabled / Error states visually |
| 18 | Kanban | WIP limits not visible | Add WIP limit indicator to column headers |
| 19 | Personalities | No personality tone preview | Show a sample response snippet |

---

## Build & Test Status

```
Build:  50 routes, 0 errors
Tests:  36 suites, 336 tests — all passing
Branch: chore/code-cleanup-and-design-review
Commit: 51486e1 — "chore: remove 3 unused source files and fix memory-providers/types.ts split"
```

---

*Prepared by Bob — PatterTech CEO*
