# Runtime architecture

How PatterStage executes and schedules agent work after the runtime rewrite. The short version: **Hermes is a remote HTTP service**, PatterStage owns orchestration and scheduling, and a single adapter is the only seam to the backend.

## Layers

```
API routes  (RESTful, Zod, ApiResponse<T>)
    │
Orchestration core  src/lib/orchestration/
    │   dispatch.ts        mission → runtime.submitRun() → runs + session rows
    │   run-reconcile.ts   poll runtime.getRun() for non-terminal runs (RunSync)
    │   scheduler/         BackgroundScheduler · tick.ts · (next-run math)
    │
Runtime adapter  src/lib/runtime/
    │   AgentRuntime (types.ts) — the one seam: submit/poll/stream/stop/approve + discovery
    │   HermesRuntime — typed client over the Hermes API Server
    │
Hermes API Server  :8642  (API_SERVER_ENABLED=true, bearer auth)
```

## The runtime adapter (`src/lib/runtime/`)

`AgentRuntime` is framework-agnostic — nothing Hermes-specific leaks through it. `HermesRuntime` maps it to the API Server:

| AgentRuntime method | Hermes endpoint |
|---|---|
| `submitRun` | `POST /v1/runs` (Idempotency-Key = our run id) |
| `getRun` | `GET /v1/runs/{id}` |
| `streamRunEvents` | `GET /v1/runs/{id}/events` (SSE) |
| `stopRun` | `POST /v1/runs/{id}/stop` |
| `health` / `capabilities` | `GET /health/detailed` · `/v1/capabilities` |
| `listModels/Skills/Toolsets` | `GET /v1/models` · `/v1/skills` · `/v1/toolsets` |
| `createSession` | `POST /api/sessions` |

Auth: `Authorization: Bearer ${API_SERVER_KEY}` (resolved in `runtime/secrets.ts`). Endpoints are resolved per profile in `runtime/endpoint-registry.ts` (each Hermes profile is its own gateway process/port; Phase-1 default resolves all to the configured gateway). Swap in another backend by implementing `AgentRuntime` and changing the `runtime` binding in `runtime/index.ts` — nothing above the seam changes.

## Mission runs (no bash)

A dispatch is one HTTP **run**:

1. `dispatchMissionRun(missionId)` inserts a `runs` row (id = Idempotency-Key), pre-registers a session, and calls `runtime.submitRun()`.
2. `RunSync` (on the background tick) polls `runtime.getRun()` for `started` runs and writes terminal state to the run + mission + session rows. A 404 from the backend means the run is gone → failed.
3. Cancellation is `runtime.stopRun()` — no pid files, signals, or `pkill`.

The whole app routes through this: the missions god-route and the queue both call `dispatchMissionNow`, which delegates to `dispatchMissionRun`.

## PatterStage-owned scheduler

The timer lives in PatterStage, not the agent.

- A `schedules` row holds the canonical schedule, `next_run_at`, `catch_up_policy`, and repeat count.
- `BackgroundScheduler` is started by `src/instrumentation.ts` at server boot, so it ticks **independent of HTTP traffic** (an idle host still fires schedules). It reuses the outage-hardened `SyncScheduler` loop and a `meta`-table ownership lease.
- The tick (`scheduler/tick.ts`) selects due rows, claims each occurrence with a deterministic run id (PK guard → exactly-once under double-tick), dispatches via the runtime, and advances `next_run_at` using the dependency-free cron/interval math in `src/lib/schedule/next-run.ts`.
- Restart-safe: due work is recomputed from `next_run_at`, never an in-memory timer.

Manage via `/api/schedules` or **Orchestration → Schedules**.

## Data model

- `runs` — one agent execution (id, backend run_id, mission_id, schedule_id, status, output, usage, timestamps).
- `schedules` — CH-owned recurring definitions (next_run_at drives firing).
- `agent_profiles.{gateway_host,gateway_port,api_key_ref}` — per-profile gateway endpoints.

## Testing the whole stack

A zero-dependency **mock Hermes API Server** (`mock-hermes/server.mjs`) implements the contract (runs/sessions/chat/discovery/health) so the platform runs end-to-end with no real agent or API keys.

```bash
docker compose up --build           # PatterStage + mock Hermes
PS_URL=http://localhost:42069 node tests/integration/runtime/full-stack-smoke.mjs
# or locally:
npm run mock-hermes &               # :8642
HERMES_GATEWAY_URL=http://127.0.0.1:8642 API_SERVER_KEY=dev npm start
npm run test:e2e-runtime
```

### Real-Hermes integration gate (validated)

`docker-compose.real-hermes.yml` runs PatterStage against the **actual Hermes Agent** (official `nousresearch/hermes-agent` image, API server enabled) pointed at a deterministic **mock LLM** (`mock-llm/`) — real Hermes machinery, no API keys/cost. Swap the mock for a real local model via `HERMES_LLM_BASE_URL`.

```bash
npm run test:e2e-hermes      # build stack, run contract + smoke against REAL Hermes, tear down
```

`tests/integration/runtime/hermes-contract.mjs` asserts the exact API shapes `HermesRuntime` depends on. **Confirmed against Hermes 0.16** — and the four shapes the docs got wrong (now handled + tested):

| Contract point | Real shape |
|---|---|
| `POST /v1/runs` | `{run_id, status:"started"}` |
| `GET /v1/runs/{id}` | `{status: started→running→completed, output, usage:{input_tokens,output_tokens,total_tokens}, session_id}` |
| SSE `/v1/runs/{id}/events` | `data:`-only lines; event name in **`data.event`** (`message.delta`, `reasoning.available`, `run.completed`) |
| `GET /v1/skills` · `/v1/toolsets` | `{object:"list", data:[…]}` (**nested**, not a bare array) |
| `POST /api/sessions` | `{object:"hermes.session", session:{id,…}}` (**nested**) |
| `POST /v1/runs/{id}/stop` | `{status:"stopping"}` · auth: `Bearer`, 401 without |

For a **production real Hermes**: enable the API server (`setup.sh` writes `API_SERVER_ENABLED=true` + a shared `API_SERVER_KEY` into `~/.hermes/.env`), run `hermes gateway`, and point `HERMES_GATEWAY_URL` at it.

## Composer rides the same substrate

[Composer](COMPOSER.md) (the graph orchestrator) reuses this layer rather than adding a second one. Each Composer **stage** is an ordinary agent run (linked via `runs.composer_node_run_id`); a `ComposerTickSource` joins `RunSync` + `ScheduleTickSource` on the `BackgroundScheduler` (gated by the ownership lease + the `composer` flag); and `reconcileOne` is **polymorphic** — it branches on `composer_node_run_id` to finalize a stage (parse its verdict, merge context) and advance the graph, otherwise it finalizes a mission. This is why we did **not** adopt LangGraph: it would bolt a second durable/checkpoint model onto the restart-safe, single-flight, idempotent substrate we already hardened. We added only the graph control-flow layer.

## Live updates: polling + SSE

Durable state is always the DB; **polling is authoritative** (it drives reconcile and survives reconnect/restart/multi-tab). **SSE is the live-richness layer** (`src/lib/sse/event-stream.ts` + `useEventStream`): because PatterStage can run multiple processes, the stream bridges via the shared DB — it polls a snapshot of the authoritative rows and pushes deltas, closing on a terminal snapshot or disconnect. If SSE drops, `useApiResource` polling keeps the view correct. Used by Composer (`…/runs/[id]/events`) and Deep Research (`…/research/[id]/events`).

## What was removed

The bash mission backend (`backends/hermes.ts`), the `agent-backend/` interface, status.json/pid polling (`MissionSync`), the stdout session-id parsing, and the legacy Hermes `jobs.json` cron bridge (+ the **Cron** page) are all gone. Recurring work uses **Missions** scheduling (the PatterStage `schedules` scheduler).
