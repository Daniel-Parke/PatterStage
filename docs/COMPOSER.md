# Composer

Composer is PatterStage's **graph orchestrator**: it runs a methodical, multi-stage workflow where each stage is an agent run, stages are connected by **conditional + looping edges**, and selected stages pause at **human-in-the-loop (HIL) gates**. It is separate from [Missions](MISSIONS.md) — Missions stay simple (single/recurring "cron for AI agents"); Composer is for orchestrated processes like "feature request → … → PR".

It ships behind a flag: set `PS_COMPOSER=1` (see [ENV_REFERENCE.md](ENV_REFERENCE.md)) and restart. Nav: **Orchestration → Composer**.

## Why a custom engine (not LangGraph/Temporal)

PatterStage already owns a hardened, restart-safe, single-flight, idempotent execution substrate — the `BackgroundScheduler` + the `runs` table + `reconcile` + the ownership lease — which already dispatches minutes-long external Hermes runs and self-heals. A Composer stage **is** exactly that. Adopting LangGraph would bolt a *second* durable state model (its checkpointer) onto the one we already hardened, plus a LangChain dependency, on a self-hostable SQLite app. So Composer adds only the **graph control-flow layer** we lacked, on the substrate we own: one durable model, no heavy dependency, maintainable for the long term.

## Model

A **workflow** is a reusable graph definition; a **run** is one execution; a **node-run** is one stage execution (= one agent run). Tables (schema v21, [`021_composer.sql`](../src/lib/db/migrations/021_composer.sql)):

- `composer_workflows` — definition (name, key, version).
- `composer_nodes` — stages: `kind` (review/validate/research/plan/implement/test/…), `gate` (`hil` | `auto`), `is_start`, `is_terminal`.
- `composer_edges` — transitions: `condition` (`always` | `on_pass` | `on_fail` | `on_approve` | `on_reject`). A **loop** is simply an edge back to an earlier node (e.g. `on_fail`).
- `composer_runs` — execution state: `status`, `current_node_id`, `context_json` (accumulating outputs).
- `composer_node_runs` — one per stage execution: `attempt` (increments on loop re-entry), `run_id` (→ `runs`), `output`, `verdict_json`.
- `composer_approvals` — HIL decisions (accept/reject/review/add_feature).

`runs.composer_node_run_id` links an agent run back to its stage so [reconcile](RUNTIME_ARCHITECTURE.md) can branch.

The default **"Software Delivery"** workflow is seeded on boot ([`schema.ts`](../src/lib/composer/schema.ts)): review → validate → research → hypothesise → plan **(HIL)** → build-tests → implement → test → documentation → PR **(HIL)** → unit/integration/acceptance → final-assessment → update-PR **(HIL)** → done, with `on_fail` loop-backs (test→implement, final-assessment→implement, plan→review-on-reject).

## Engine

The engine ([`engine.ts`](../src/lib/composer/engine.ts)) advances a run one step at a time, driven by the `ComposerTick` (a `SyncSource` on the BackgroundScheduler) and by reconcile (after each stage's agent run goes terminal):

1. **Start** the current node → `dispatchComposerNode` builds a stage prompt ([`stage-prompt.ts`](../src/lib/composer/stage-prompt.ts), kind-specific + accumulated context + any loop-back failure reasons) and submits an agent run.
2. **Reconcile** finalizes the stage-run, parses a **verdict** (`VERDICT: PASS|FAIL` + reasons/suggestions, [`verdict.ts`](../src/lib/composer/verdict.ts)) for assessing stages, and merges output into the run's context.
3. **Route**: auto gate → follow `on_pass`/`on_fail`; HIL gate → set `awaiting_approval` and wait. A `fail`/`reject` with no recovery edge fails the run; reaching a terminal node completes it. **Loop-backs** dispatch the target node with a fresh `attempt` and the prior failure injected into the prompt.

Single-flight (one stage in flight per run), idempotent run ids (`cn_<nodeRunId>`), and the scheduler ownership lease make it restart-safe and exactly-once.

## API

All gated by `PS_COMPOSER`.

| Method + path | Purpose |
|---|---|
| `GET /api/composer/workflows` | List workflow definitions |
| `GET /api/composer/runs` | List runs |
| `POST /api/composer/runs` | Start a run `{ workflowId \| workflowKey, input }` |
| `GET /api/composer/runs/[id]` | Run + node-runs + workflow graph |
| `GET /api/composer/runs/[id]/events` | Live SSE (`{ run, nodeRuns }`) — see [RUNTIME_ARCHITECTURE.md](RUNTIME_ARCHITECTURE.md) |
| `POST /api/composer/runs/[id]/nodes/[nodeId]/approve` | Resolve a HIL gate `{ action, note? }` |

The **DeepResearch → Composer** handoff (`POST /api/laboratory/research/[id]/launch`) seeds a Software Delivery run from a completed research report — see [DEEP_RESEARCH.md](DEEP_RESEARCH.md).

## Verification

`npx tsc --noEmit && npm run lint && npm test && npm run build`. The engine test ([`composer-engine.test.ts`](../tests/unit/composer-engine.test.ts)) walks a PASS path, a HIL accept, and a FAIL loop-back. With a live Hermes + `PS_COMPOSER=1`, launch the seeded workflow from a feature request and watch the live pipeline, approve/reject a gate, and force a FAIL to see the loop-back.
