---
summary: How PatterStage logs interactions, turns them into achievements and surfaces them on the Insights page
type: reference
tags: [product, analytics]
compiled_from: normalised
---

# PatterStage: Analytics & Achievements

How PatterStage logs meaningful interactions, turns them into achievements, and
surfaces them on the **Insights** page (`/laboratory/insights`). The old
top-level `/insights` survives only as a 308 redirect for existing bookmarks
(`next.config.ts`); there is no page at that path. Added in Phase Q3.

## 1. The event log (`analytics_events`)

An append-only table written by the server whenever something noteworthy happens.

| column | notes |
|--------|-------|
| `id` | uuid |
| `event_type` | one of the taxonomy below (validated in TypeScript, **no SQL CHECK**) |
| `entity_type` | `mission` / `run` / `story` / `session` / `skill` / `personality` / `schedule` / `chat` / `model` (nullable) |
| `entity_id` | the related row id (nullable) |
| `profile` | agent profile, for per-profile breakdowns (nullable) |
| `metadata_json` | small JSON payload, e.g. `{ "enabled": true }` (nullable) |
| `created_at` | ISO, defaults to `datetime('now')` |

Indexes: `event_type`, `created_at`, and the composite `(event_type, created_at)`
for the windowed counts. Migration **v12** (`012_analytics_events.sql` +
`apply-analytics-events-migration.ts`, wired last in `runMigrations()`). There is
deliberately **no `CHECK` on `event_type`**: new types ship as code, so a CHECK
would force a migration per type and reject forward-compatible writes from newer
code against an older DB. The taxonomy is enforced at the TypeScript boundary
(`recordEvent` only accepts an `AnalyticsEventType`).

**Retention (v32, [ADR-0009](../org/decisions/ADR-0009-retention-for-the-readings-tables.md)).**
This table has a declared window of **400 days**, with a schema-enforced floor of
365 because that is the longest read any consumer on this page performs. The
prune ships **disabled** on every install and is a command an operator runs by
hand (`npm run db:retention`); nothing on this page or anywhere else deletes an
event on its own. The lifetime aggregates below (`countByType`,
`distinctActiveDays`, the breadth counts) are the reason the prune first captures
an `agent_progression_snapshots` row and refuses to run if it cannot: no finite
window can satisfy a lifetime count, so the answer is recorded instead of the
inputs being kept.

### Taxonomy (`src/lib/analytics/event-types.ts`)

Forty types in nine categories (`src/lib/analytics/categories.ts`). The
taxonomy was extended once for the release (T-0098) so Insights can see
Research and the Composer and so the quests have a ledger to read.

| Category | Types |
|---|---|
| Missions | `mission.dispatched` · `mission.completed` · `mission.failed` · `mission.cancelled` · `template.saved` |
| Workflows | `composer.run_started` · `composer.run_completed` · `composer.run_failed` · `composer.gate_approved` · `composer.workflow_saved` · `artifact.saved` |
| Stories | `story.created` · `story.chapter_generated` · `story.completed` |
| Research | `research.started` · `research.completed` · `research.failed` · `research.cancelled` |
| Sessions | `session.started` · `session.closed` |
| Automation | `schedule.created` · `schedule.fired` · `script.saved` · `script.run` · `script.scheduled` |
| Config | `skill.toggled` · `personality.changed` · `model.configured` · `model.added` · `credential.added` · `profile.created` · `profile.pushed` · `profile.pulled` · `toolset.saved` · `config.saved` · `memory.configured` · `memory.retained` · `backup.taken` |
| Chat | `chat.message_sent` |
| Help | `help.opened` |

Two types have no emitter yet and arrive with their feature:
`research.cancelled` (the Research cancel, B14) and `help.opened` (the Help
section, B16). `backup.taken` joined them in B6, when `POST /api/backup`
began writing one. The **Completionist** achievement is measured against
`COMPLETIONIST_EVENT_TYPES`, the curated list of every type an operator can
trigger by doing something: those two are not on it until they can be, and the
three failure types never are.

## 2. Emitting events

One helper: **`recordEvent(type, { entityType, entityId, profile, metadata })`**
(`src/lib/analytics/record-event.ts`). It is best-effort and side-effect-only:

- **never throws** into the caller's hot path (the whole body is wrapped, including
  `JSON.stringify` on a bad `metadata`),
- **no-ops in read-only mode** (`isReadOnly()`, from `src/lib/read-only.ts`),
- logs failures via `logApiError` rather than surfacing them.

Emit **after** the action succeeds, and only from a write path: an event is a
claim that the table holds the outcome, so a write that throws leaves no event.
Mission terminal events are emitted from `run-reconcile.ts`'s live terminal
transition (`finalizeAndRecord`), **not** the idempotent `finalizeMissionForRun`
(which also runs on boot recovery). Otherwise a restart would double-count.
Call sites, as of T-0098: `src/lib/orchestration/dispatch.ts`,
`run-reconcile.ts`, `chat-dispatch.ts`, `scheduler/tick.ts`,
`src/lib/composer/engine.ts` (every terminal status of a Composer run),
`src/lib/laboratory/deep-research/run-job.ts` (a research run's outcome),
`src/lib/missions/mission-handlers/cancel.ts` (both cancel doors),
`src/lib/templates-handlers/{create,update}.ts`,
`src/lib/hardware-cron-handlers/create.ts`; the `schedules`,
`skills/[name]/toggle`, `agent/personality`, `agent/files/[key]` (SOUL.md),
`agent/profiles` (create), `agent/profiles/sync/{push,pull}`,
`agent/profiles/[id]/toolsets`, `config`, `memory/config`, `memory/hindsight`
(retain), `orchestration/chat`, `models`, `models/defaults`, `credentials`,
`artifacts`, `scripts/[name]`, `scripts/run`, `laboratory/research`,
`composer/runs`, `composer/runs/[id]/nodes/[nodeId]/approve` and
`composer/workflows` routes; and, for the `story.*` types,
`src/modules/rec-room/handlers/create.ts` and `generate.ts`, which the `stories`
route delegates to rather than emitting itself. `tests/unit/b4-emits-*.test.ts`
hold every one of the T-0098 sites to "after the write, never before it".

## 3. The API (`/api/analytics`)

Read-only: events are server-emitted, so there is **no POST** (a client must not
be able to forge achievement progress).

- `GET /api/analytics` → `{ analytics: { totals, last30, activeDays, generatedAt } }`
  (per-type counts all-time + last 30 days + distinct active days).
- `GET /api/analytics/timeseries?type=&days=&bucket=day` → gap-filled daily
  counts. `days` is clamped **1-365** (`analyticsTimeseriesQuerySchema`), bounding
  the only request value that reaches a SQL interval. `type` is the event-type enum.
- `GET /api/analytics/insights?days=N` → `{ insights: { days, hourOfDay,
  categorySeries, categoryDaily, durationBuckets, modelUsage, topMissions,
  successTrend, generatedAt } }`, the composed bundle that feeds most of the page's cards
  (`src/lib/analytics/insights-bundle.ts`). Note that `days` here is coerced
  (`Number(...)`, default 30 on a non-finite value) rather than Zod-clamped like
  `timeseries`.

The aggregations live in `src/lib/analytics/analytics-repository.ts` (all reads
defensive → zeros on an empty/pre-v12 DB).

## 4. Achievements

Still **derived live** (no persistence) in `src/lib/stats/derive.ts`:
`ACHIEVEMENT_DEFS` (≈36 across missions / stories / sessions / automation /
skills+config / chat / tokens / streaks / time-of-day / breadth, with tiered
ladders) → `evaluateAchievements(RawMetrics)`. `getDashboardStats()`
(`stats-repository.ts`) builds `RawMetrics` from the existing tables **plus** the
event aggregations (`countByType` + the specialised queries), and folds event
active-days into the streak so chat/story-only days keep a streak alive.

Adding an achievement: append a def (`{ id, name, description, icon, color,
target, measure }`), add any new `RawMetrics` field it needs (+ populate it in
`getDashboardStats`), and register the lucide `icon` in
`AchievementBadge.ICONS`. The catalogue-integrity test asserts every icon is
registered (no silent `Medal` fallback) and colours are valid neon accents.

**Unlock UX:** `useAchievementUnlocks` diffs the unlocked set across `useStats`
polls (first poll seeds silently, per-id dedup) and fires a toast. `CommandCenter`
is the sole owner of that toast; the Insights grid is read-only.

## 5. Insights page (`/laboratory/insights`)

`src/app/laboratory/insights/page.tsx` composes five hooks: `useStats`,
`useAnalytics`, `useAnalyticsTimeseries`, `useInsights` (the
`/api/analytics/insights` bundle) and `useSpend`. A 7/30/90-day range switch in
the page header drives the first four; spend does not follow it, because a budget
is a calendar month rather than a rolling window.

Top to bottom:

- a **streak flame** and four headline tiles (Interactions, Active days, Tokens,
  Achievements). There is no level here: [ADR-0004](../org/decisions/ADR-0004-brain-and-body.md)
  moved the level onto the agent profile, so `AgentLevelBadge` renders on
  `/operations/agents` and per-agent on `CommandCenter`, and the global operator
  `LevelBadge` that once stood here no longer exists,
- the **provider spend panel** (`SpendPanel`, see [SPEND.md](SPEND.md)), the only
  money on the page and the only place it is reported,
- a **stacked activity-by-category area** over the selected range, falling back to
  a plain area chart when the bundle is empty, beside the all-time **category
  breakdown ring** (the 40 event types folded into 9 categories),
- an **hour-of-day radial clock**, a **run-duration histogram** and a **mission
  success trend** (completed vs failed per day),
- **tokens by model** (tokens only; the spend panel is the one money number on
  the page), **top missions**, and the all-time **mission mix** donut that
  moved here from the dashboard (T-0099). The first two aggregate
  `runs` INNER JOINed to `missions`, because the model dimension lives on the
  mission, so a run without one (a Composer stage run, which carries a
  `composer_node_run_id` and no `mission_id`) is absent from them. That is a
  known chart hole, not a money hole: `src/lib/spend/spend-repository.ts` LEFT
  JOINs on purpose so the spend panel counts those runs,
- the **91-day run-activity heatmap**, from `stats.runActivity` rather than the
  range switch,
- the **achievement showcase**: a compact trophy case that expands to the full
  grid.

Built entirely on the existing `src/components/viz/` primitives.

An "Est. spend" tile used to sit in the headline strip. It was removed with the
spend panel's arrival (T-0021): it summed `insights.modelUsage`, so it inherited
the missing-Composer hole above, and it was drawn over the 7/30/90 switch, which
is not a period anyone budgets in. Two spend numbers on one page, one of them
quietly incomplete, is worse than one.
