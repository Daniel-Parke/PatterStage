# Page Route Architecture Restructure Plan

> **Status:** *Plan only — awaiting explicit approval. No changes made.*
> **Scope:** Restructuring page routes to match sidebar categories. Does NOT touch API routes, backend logic, or feature implementation.
> **Decisions confirmed:** Main stays flat at root (route groups only); `/config/` URLs kept as-is; **NO redirects, no backward compatibility** (local-only app).

---

## A. Current State — The Inconsistencies

After auditing all files under `src/app/`, the sidebar config, internal links, and E2E test routes:

### Five Specific Problems

| # | Problem | Details |
|---|---|---|
| 1 | **Teams is the only Orchestration page under its category directory** | `/orchestration/teams` exists correctly, but Cron, Missions, and Kanban are flat at root (`/cron`, `/missions`, `/kanban`). Same sidebar category, different URL patterns. |
| 2 | **Operations pages scattered across three different URL patterns** | Agents/Tools live under `/agent/` prefix, Skills is flat at `/skills`, Personalities is flat at `/personalities`. Same sidebar category, no URL consistency. |
| 3 | **`/agent/agents` is redundant** | Reads as "agent agents" — the directory name already names the entity. This is a legacy artifact from a multi-agent framework that was removed. |
| 4 | **No shared layout possible** | Pages in the same category can't share a `layout.tsx` because they're scattered across different directory branches. Future breadcrumbs, sub-nav, or category-scoped logic would need duplication. |
| 5 | **No correspondence between sidebar tree and file tree** | The sidebar groups pages under Main / Orchestration / Operations / Settings, but the file system under `app/` doesn't reflect this at all. Next.js best practice says filesystem should mirror the sidebar one-to-one. |

### Current File Layout — What Exists Now

```
src/app/
├── page.tsx                          ▸ / → Dashboard (Main)
├── layout.tsx                        ▸ Root layout
│
├── sessions/page.tsx                 ▸ /sessions (Main)
├── sessions/[id]/page.tsx            ▸ /sessions/[id] (Main)
├── memory/page.tsx                   ▸ /memory (Main)
├── gateway/page.tsx                  ▸ /gateway (Main)
├── logs/page.tsx                     ▸ /logs (Main)
│
├── cron/page.tsx                     ▸ /cron (Orchestration) ← flat, wrong
├── missions/page.tsx                 ▸ /missions (Orchestration) ← flat, wrong
├── kanban/page.tsx                   ▸ /kanban (Orchestration) ← flat, wrong
├── orchestration/teams/page.tsx      ▸ /orchestration/teams (Orchestration) ← correct (only one)
│
├── agent/agents/page.tsx             ▸ /agent/agents (Operations) ← redundant /agent/
├── agent/tools/page.tsx              ▸ /agent/tools (Operations) ← wrong prefix
├── skills/page.tsx                   ▸ /skills (Operations) ← flat, wrong
├── skills/[...path]/page.tsx         ▸ /skills/* (Operations) ← flat, wrong
├── personalities/page.tsx            ▸ /personalities (Operations) ← flat, wrong
│
├── recroom/story-weaver/page.tsx     ▸ /recroom/story-weaver (Rec Room) ← correct
├── recroom/story-weaver/layout.tsx
├── recroom/story-weaver/library/page.tsx
├── recroom/story-weaver/create/page.tsx
├── recroom/story-weaver/characters/page.tsx
├── recroom/story-weaver/themes/page.tsx
├── recroom/story-weaver/[id]/page.tsx
│
├── config/page.tsx                   ▸ /config (Settings) ← correct
├── config/models/page.tsx            ▸ /config/models (Settings) ← correct
├── config/[section]/page.tsx         ▸ /config/{section} (Settings) ← correct
│
└── api/                              ▸ UNCHANGED — no changes to API routes
```

---

## B. Research Foundation

Three sources confirm the approach:

1. **Next.js Official Docs — Project Organization**: "Group routes by feature or category using folders inside `app/`. The URL path directly maps to the folder structure."
2. **Vercel Blog — App Router Routing Patterns**: "For multi-section apps with a sidebar, `/orchestration/cron` is more intuitive than `/cron` alone because context is preserved. Avoid deep nesting beyond 3-4 levels."
3. **Lee Robinson (VP DevEx, Vercel)**: "The file system should mirror the sidebar structure one-to-one."

### Key Heuristics Applied

| Heuristic | Decision |
|---|---|
| Max URL depth ≤ 3 segments | Our deepest becomes `/operations/skills/[...path]` — exactly 3 |
| Category namespacing | Each sidebar category gets its own directory branch |
| Shared layouts | Category directories can hold `layout.tsx` for future use |
| Route groups for organization-only | `(main)/` groups files without changing URLs |

---

## C. Proposed Target Structure

### New File Layout

```
src/app/
├── page.tsx                          ▸ / → Dashboard (unchanged, stays at root)
├── layout.tsx                        ▸ Root layout (unchanged)
│
├── (main)/                            ▸ Route group — NO URL impact
│   ├── sessions/page.tsx              ▸ /sessions (url unchanged)
│   ├── sessions/[id]/page.tsx         ▸ /sessions/[id] (url unchanged)
│   ├── memory/page.tsx                ▸ /memory (url unchanged)
│   ├── gateway/page.tsx               ▸ /gateway (url unchanged)
│   └── logs/page.tsx                  ▸ /logs (url unchanged)
│
├── orchestration/                     ▸ NEW category directory
│   ├── cron/page.tsx                  ▸ /orchestration/cron (was /cron)
│   ├── missions/page.tsx              ▸ /orchestration/missions (was /missions)
│   ├── kanban/page.tsx                ▸ /orchestration/kanban (was /kanban)
│   └── teams/page.tsx                 ▸ /orchestration/teams (unchanged)
│
├── operations/                        ▸ NEW category directory
│   ├── agents/page.tsx                ▸ /operations/agents (was /agent/agents)
│   ├── tools/page.tsx                 ▸ /operations/tools (was /agent/tools)
│   ├── skills/page.tsx                ▸ /operations/skills (was /skills)
│   ├── skills/[...path]/page.tsx      ▸ /operations/skills/* (was /skills/*)
│   └── personalities/page.tsx         ▸ /operations/personalities (was /personalities)
│
├── recroom/                           ▸ UNCHANGED
│   └── story-weaver/...
│
├── config/                            ▸ UNCHANGED
│   ├── page.tsx                       ▸ /config
│   ├── models/page.tsx                ▸ /config/models
│   └── [section]/page.tsx             ▸ /config/{section}
│
└── api/                               ▸ UNCHANGED
```

### URL Change Matrix — All 9 Breaking Changes

| Old URL | New URL | Reason |
|---|---|---|
| `/cron` | `/orchestration/cron` | Belongs to Orchestration category |
| `/missions` | `/orchestration/missions` | Belongs to Orchestration category |
| `/kanban` | `/orchestration/kanban` | Belongs to Orchestration category |
| `/agent/agents` | `/operations/agents` | Belongs to Operations category; removes `/agent/` prefix |
| `/agent/tools` | `/operations/tools` | Belongs to Operations category; removes `/agent/` prefix |
| `/skills` | `/operations/skills` | Belongs to Operations category |
| `/skills/*` | `/operations/skills/*` | Belongs to Operations category |
| `/personalities` | `/operations/personalities` | Belongs to Operations category |

**No redirects will be added.** This is a local app. Users access it via the sidebar.

### What Stays Unchanged

| Category | Pages | URLs |
|---|---|---|
| **Main** | Dashboard, Sessions, Memory, Gateway, Logs | All unchanged |
| **Settings** | Config hub, Models, all config sections | All unchanged |
| **Rec Room** | Story Weaver + all sub-pages | All unchanged |
| **API routes** | All `/api/*` endpoints | All unchanged |
| **Components** | Everything in `src/components/` | All unchanged |
| **Library code** | Everything in `src/lib/` | All unchanged |
| **Root layout** | `layout.tsx` | Unchanged |

---

## D. Detailed File Operations

### D1. Directories to Create

```
mkdir -p src/app/(main)/sessions/[id]
mkdir -p src/app/(main)/memory
mkdir -p src/app/(main)/gateway
mkdir -p src/app/(main)/logs
mkdir -p src/app/orchestration/cron
mkdir -p src/app/orchestration/missions
mkdir -p src/app/orchestration/kanban
mkdir -p src/app/operations/agents
mkdir -p src/app/operations/tools
mkdir -p src/app/operations/skills/[...path]
mkdir -p src/app/operations/personalities
```

**Total: 14 new directories**

### D2. Files to Move (Copy + Verify + Delete)

**Main pages → `(main)/` route group:**

| From | To |
|---|---|
| `src/app/sessions/page.tsx` | `src/app/(main)/sessions/page.tsx` |
| `src/app/sessions/[id]/page.tsx` | `src/app/(main)/sessions/[id]/page.tsx` |
| `src/app/memory/page.tsx` | `src/app/(main)/memory/page.tsx` |
| `src/app/gateway/page.tsx` | `src/app/(main)/gateway/page.tsx` |
| `src/app/logs/page.tsx` | `src/app/(main)/logs/page.tsx` |

**Orchestration pages → `orchestration/`:**

| From | To |
|---|---|
| `src/app/cron/page.tsx` | `src/app/orchestration/cron/page.tsx` |
| `src/app/missions/page.tsx` | `src/app/orchestration/missions/page.tsx` |
| `src/app/kanban/page.tsx` | `src/app/orchestration/kanban/page.tsx` |

**Operations pages → `operations/`:**

| From | To |
|---|---|
| `src/app/agent/agents/page.tsx` | `src/app/operations/agents/page.tsx` |
| `src/app/agent/tools/page.tsx` | `src/app/operations/tools/page.tsx` |
| `src/app/skills/page.tsx` | `src/app/operations/skills/page.tsx` |
| `src/app/skills/[...path]/page.tsx` | `src/app/operations/skills/[...path]/page.tsx` |
| `src/app/personalities/page.tsx` | `src/app/operations/personalities/page.tsx` |

**Total: 12 files moved** (no content changes to the page files themselves)

### D3. Directories to Delete

```
rm -rf src/app/cron/
rm -rf src/app/missions/
rm -rf src/app/kanban/
rm -rf src/app/agent/
rm -rf src/app/skills/
rm -rf src/app/personalities/
rm -rf src/app/sessions/
rm -rf src/app/memory/
rm -rf src/app/gateway/
rm -rf src/app/logs/
```

**Total: 10 directories deleted** (all empty of non-page files)

### D4. `sidebar-config.ts` — Update 7 Href Values

**File:** `src/components/layout/sidebar-config.ts`

| Line | Section | Old Value | New Value |
|---|---|---|---|
| 55 | Orchestration > Cron | `href: "/cron"` | `href: "/orchestration/cron"` |
| 56 | Orchestration > Missions | `href: "/missions"` | `href: "/orchestration/missions"` |
| 57 | Orchestration > Kanban | `href: "/kanban"` | `href: "/orchestration/kanban"` |
| 64 | Operations > Agents | `href: "/agent/agents"` | `href: "/operations/agents"` |
| 66 | Operations > Tools | `href: "/agent/tools"` | `href: "/operations/tools"` |
| 67 | Operations > Skills | `href: "/skills"` | `href: "/operations/skills"` |
| 68 | Operations > Personalities | `href: "/personalities"` | `href: "/operations/personalities"` |

**Note:** Teams link (`/orchestration/teams`), all Main links, all Config links, and all Rec Room links stay unchanged.

### D5. Internal `<Link>` References — Update 6 Href Values

These are hardcoded `<Link href="...">` references in page components that point to old URLs.

| # | File | Line ~ | Current Code | Change To |
|---|---|---|---|---|
| 1 | `src/app/page.tsx` | ~398 | `href="/missions"` | `href="/orchestration/missions"` |
| 2 | `src/app/page.tsx` | ~518 | `href="/missions"` | `href="/orchestration/missions"` |
| 3 | `src/app/page.tsx` | ~573 | `href="/cron"` | `href="/orchestration/cron"` |
| 4 | `src/app/config/page.tsx` | ~149 | `href="/agent/tools"` | `href="/operations/tools"` |
| 5 | `src/app/orchestration/teams/page.tsx` | ~374 | `href="/kanban?team="` | `href="/orchestration/kanban?team="` |
| 6 | `src/app/missions/page.tsx` | ~1708 | `href="/cron"` | `href="/orchestration/cron"` |

### D6. E2E Test Routes — Update `tests/e2e/app-routes.ts`

**File:** `tests/e2e/app-routes.ts` — replace old route strings:

```typescript
export const APP_NAV_ROUTES: readonly string[] = [
  "/",
  "/orchestration/cron",        // was /cron
  "/orchestration/missions",    // was /missions
  "/orchestration/kanban",      // was /kanban
  "/orchestration/teams",       // unchanged
  "/operations/agents",         // was /agent/agents
  "/operations/tools",          // was /agent/tools
  "/operations/skills",         // was /skills
  "/operations/personalities",  // was /personalities
  "/config",
  "/config/agent",
  "/config/approvals",
  // ... all config sections unchanged ...
  "/gateway",                   // unchanged
  "/logs",                      // unchanged
  "/memory",                    // unchanged
  "/sessions",                  // unchanged
  "/skills",                    // REMOVED (moved to /operations/skills)
  "/recroom/story-weaver",
  "/recroom/story-weaver/characters",
  "/recroom/story-weaver/create",
  "/recroom/story-weaver/library",
  "/recroom/story-weaver/themes",
];
```

**Note:** The `/skills` entry is removed from the matrix since it has moved (it's now tested via `/operations/skills`). The config sections list is unchanged.

### D7. `next.config.ts` — No Changes

Since there are **no redirects**, `next.config.ts` requires zero modifications. It stays exactly as-is.

---

## E. Execution Order

Each step is sequential — the next step only begins when the previous one completes.

**Step 1:** Create all 14 new directories (mkdir -p for each target path)

**Step 2:** Copy files — 12 page files to their new locations (cp src from → src to)

**Step 3:** Verify files exist at new locations (stat or ls each)

**Step 4:** Delete the 10 old source directories (rm -rf)

**Step 5:** Update `sidebar-config.ts` — replace 7 href values using patch

**Step 6:** Update internal `<Link>` references — 6 patches across 4 files

**Step 7:** Update `tests/e2e/app-routes.ts` — replace old route strings

**Step 8:** Run `npm run build` to verify no TypeScript errors

**Step 9:** Run `npx playwright test tests/e2e/navigation-matrix.spec.ts` to verify all routes load

**Step 10:** Git commit — one clean commit on a feature branch

---

## F. Files Changed Summary

| File | What changes | Type |
|---|---|---|
| `src/components/layout/sidebar-config.ts` | 7 href values updated | Content patch |
| `src/app/page.tsx` | 3 `<Link>` hrefs updated | Content patch |
| `src/app/config/page.tsx` | 1 `<Link>` href updated | Content patch |
| `src/app/orchestration/teams/page.tsx` | 1 `<Link>` href updated | Content patch |
| `src/app/missions/page.tsx` | 1 `<Link>` href updated | Content patch |
| `tests/e2e/app-routes.ts` | Route strings replaced | Content rewrite |
| `next.config.ts` | **No changes** | N/A |

**Files physically relocated:** 12 (pure copy + delete, no content change)
**Files with content patches:** 6 (sidebar config + 4 pages + test routes)
**Directories created:** 14
**Directories deleted:** 10

---

## G. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Old bookmarks break** | Certain (9 URLs) | Acceptable — local app, no redirects planned. Users navigate via sidebar. |
| **Internal link missed** | Low | Cross-referenced against search_files grep across entire `src/` — 6 links found |
| **Build fails after moves** | Very low | All page files use `@/` path aliases, not relative imports — moving files doesn't break imports |
| **Skills catch-all `[...path]` breaks** | Very low | Next.js supports catch-all routes at any depth — `/operations/skills/[...path]` is valid |
| **Dynamic route conflict** | None | No `[section]` in same dir as static routes where conflict could occur |

---

Say **"implement this plan"** or **"yes please"** when you're ready for me to execute.
