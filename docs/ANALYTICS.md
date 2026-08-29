---
summary: How PatterStage logs interactions, turns them into achievements and surfaces them on the Insights page
type: reference
tags: [product, analytics]
compiled_from: normalised
---

# PatterStage: Analytics & Achievements

How PatterStage logs meaningful interactions, turns them into achievements, and
surfaces them on the **Insights** page (`/insights`). Added in Phase Q3.

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

`mission.dispatched` · `mission.completed` · `mission.failed` ·
`story.created` · `story.chapter_generated` · `story.completed` ·
`session.started` · `session.closed` · `skill.toggled` · `personality.changed` ·
`schedule.created` · `schedule.fired` · `chat.message_sent` · `model.configured`

## 2. Emitting events

One helper: **`recordEvent(type, { entityType, entityId, profile, metadata })`**
(`src/lib/analytics/record-event.ts`). It is best-effort and side-effect-only:

- **never throws** into the caller's hot path (the whole body is wrapped, including
  `JSON.stringify` on a bad `metadata`),
- **no-ops in read-only mode** (`isReadOnly()`, from `src/lib/read-only.ts`),
- logs failures via `logApiError` rather than surfacing them.

Emit **after** the action succeeds. Mission terminal events are emitted from
`run-reconcile.ts`'s live terminal transition (`finalizeAndRecord`), **not** the
idempotent `finalizeMissionForRun` (which also runs on boot recovery). Otherwise
a restart would double-count. Call sites: `orchestration/dispatch.ts`,
`orchestration/run-reconcile.ts`, `orchestration/scheduler/tick.ts`, and the
`schedules` / `skills/[name]/toggle` / `agent/personality` / `orchestration/chat`
/ `stories` / `models/defaults` routes.

## 3. The API (`/api/analytics`)

Read-only: events are server-emitted, so there is **no POST** (a client must not
be able to forge achievement progress).

- `GET /api/analytics` → `{ analytics: { totals, last30, activeDays, generatedAt } }`
  (per-type counts all-time + last 30 days + distinct active days).
- `GET /api/analytics/timeseries?type=&days=&bucket=day` → gap-filled daily
  counts. `days` is clamped **1–365** (`analyticsTimeseriesQuerySchema`), bounding
  the only request value that reaches a SQL interval. `type` is the event-type enum.

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

## 5. Insights page (`/insights`)

`src/app/(main)/insights/page.tsx` composes `useStats` + `useAnalytics` +
`useAnalyticsTimeseries`: a level/streak + headline-metric strip, a 30-day
activity area chart, a per-category breakdown ring (the 14 types folded into 6
categories), the 91-day run-activity heatmap, and the full achievement grid.
Built entirely on the existing `src/components/viz/` primitives.
