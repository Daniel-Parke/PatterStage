# Composer

Composer is PatterStage's **graph orchestrator**: it runs a methodical, multi-stage workflow where each stage is an agent run, stages are connected by **conditional + looping edges**, and selected stages pause at **human-in-the-loop (HIL) gates**. It is separate from [Missions](MISSIONS.md) — Missions stay simple (single/recurring "cron for AI agents"); Composer is for orchestrated processes like "feature request → … → PR".

It is **on by default**; set `PS_COMPOSER=0` (see [ENV_REFERENCE.md](ENV_REFERENCE.md)) and restart to disable it (the sidebar link hides and the page 404s). Nav: **Orchestration → Composer**.

## Why a custom engine (not LangGraph/Temporal)

PatterStage already owns a hardened, restart-safe, single-flight, idempotent execution substrate — the `BackgroundScheduler` + the `runs` table + `reconcile` + the ownership lease — which already dispatches minutes-long external Hermes runs and self-heals. A Composer stage **is** exactly that. Adopting LangGraph would bolt a *second* durable state model (its checkpointer) onto the one we already hardened, plus a LangChain dependency, on a self-hostable SQLite app. So Composer adds only the **graph control-flow layer** we lacked, on the substrate we own: one durable model, no heavy dependency, maintainable for the long term.

## Model

A **workflow** is a reusable graph definition; a **run** is one execution; a **node-run** is one stage execution (= one agent run). Tables (schema v21, [`021_composer.sql`](../src/lib/db/migrations/021_composer.sql)):

- `composer_workflows` — definition (name, key, version).
- `composer_nodes` — stages: `kind` (review/validate/`research`/`group`/plan/implement/test/…), `gate` (`hil` | `auto`), `is_start`, `is_terminal`, `config_json` (per-kind config + the canvas position under `_ui:{x,y}`).
- `composer_edges` — transitions: `condition` (`always` | `on_pass` | `on_fail` | `on_approve` | `on_reject` | a custom **`on_<outcome>`** branch label). A **loop** is simply an edge back to an earlier node (e.g. `on_fail`).
- `composer_runs` — execution state: `status`, `current_node_id`, `context_json`, and `parent_node_run_id` (set when a `group` node spawned this run as a nested sub-workflow — schema v26).
- `composer_node_runs` — one per stage execution: `attempt` (increments on loop re-entry), `run_id` (→ `runs`), `output`, `verdict_json`.
- `composer_approvals` — HIL decisions (accept/reject/review/add_feature).

`runs.composer_node_run_id` links an agent run back to its stage so [reconcile](RUNTIME_ARCHITECTURE.md) can branch. Two stage kinds run something other than an agent: a **`research`** node drives a [Deep Research](DEEP_RESEARCH.md) run (linked via `research_runs.composer_node_run_id`, schema v25), and a **`group`** node runs a referenced sub-workflow as a nested `composer_run` (linked via `composer_runs.parent_node_run_id`, schema v26) — both settled by the engine when their linked run terminates.

**Conditional branching:** a stage can emit `OUTCOME: <label>` in its output; the engine then follows an `on_<label>` edge if one exists (else falls back to `on_pass`/`on_fail`). This lets a node fan out to >2 paths (e.g. a triage stage → `on_implement_fix` / `on_further_research` / `on_write_report`).

**Interactive clarification:** instead of dead-ending on a too-vague objective, an assessing stage can emit `OUTCOME: needs_clarification` + a `QUESTION:` line. The engine pauses the run (reusing the `awaiting_approval` state + a `__clarify` context marker — no extra status/migration) and the Run UI asks the question; the answer (`POST …/clarify`) enriches the objective and re-runs the asking stage (bounded by the per-node attempt cap). This is Anthropic's "interactive discussion to clarify the task".

The default **"Software Delivery"** workflow is seeded on boot ([`schema.ts`](../src/lib/composer/schema.ts)): review → validate → research → hypothesise → plan **(HIL)** → build-tests → implement → test → documentation → PR **(HIL)** → unit/integration/acceptance → final-assessment → update-PR **(HIL)** → done, with `on_fail` loop-backs (test→implement, final-assessment→implement, plan→review-on-reject) and `on_fail` **forward-recovery** on the best-effort enrichment stages (research→hypothesise, hypothesise→plan) so a transient search/LLM blip doesn't dead-end the run. The forward-recovery edges are back-filled idempotently into older seeded workflows ([`seed.ts`](../src/lib/composer/seed.ts)).

## Engine

The engine ([`engine.ts`](../src/lib/composer/engine.ts)) advances a run one step at a time, driven by the `ComposerTick` (a `SyncSource` on the BackgroundScheduler) and by reconcile (after each stage's agent run goes terminal):

1. **Start** the current node → `dispatchComposerNode` builds a stage prompt ([`stage-prompt.ts`](../src/lib/composer/stage-prompt.ts), kind-specific + accumulated context + any loop-back failure reasons) and submits an agent run.
2. **Reconcile** finalizes the stage-run, parses a **verdict** (`VERDICT: PASS|FAIL` + reasons/suggestions, [`verdict.ts`](../src/lib/composer/verdict.ts)) for assessing stages, and merges output into the run's context.
3. **Route**: auto gate → follow `on_pass`/`on_fail`; HIL gate → set `awaiting_approval` and wait. A `fail`/`reject` with no recovery edge fails the run with a **readable error** (the stage label + its verdict reasons, e.g. `"Review failed: the goal is too vague"`) rather than an opaque code; reaching a terminal node completes it. **Loop-backs** dispatch the target node with a fresh `attempt` and the prior failure injected into the prompt.

Single-flight (one stage in flight per run), idempotent run ids (`cn_<nodeRunId>`), and the scheduler ownership lease make it restart-safe and exactly-once. **Loop guardrails** bound cycles (best practice — "maximum iteration limits by default"): a per-node attempt cap (default 5, overridable per node via `config.maxAttempts`) and a per-run total-step backstop stop a runaway loop gracefully with a readable error instead of running forever.

`research`/`group` stages create no agent `runs` row; the engine settles them in-process (`settleResearchNode` / `settleGroupNode`) from their linked run, with the `ComposerTick` as the cross-restart backstop. `group` nesting is guarded against recursion (a workflow referencing an ancestor in its run chain) and a depth cap.

## Building workflows (the node canvas)

The **Build** tab on the Composer page is a drag-and-drop node editor ([`WorkflowCanvas.tsx`](../src/components/composer/WorkflowCanvas.tsx), [react-flow](https://reactflow.dev)): drag stage kinds from the palette onto the board, drag handle → handle to connect them, and click a node/edge to edit just its details in the inspector (kind, HIL gate, start/terminal, a `research` query or a `group`'s sub-workflow). The whole graph is saved atomically; node positions persist in `config._ui`, and [dagre](https://github.com/dagrejs/dagre) auto-lays-out workflows that have none. Pure converters in [`canvas-graph.ts`](../src/lib/composer/canvas-graph.ts) map the DB graph ↔ the canvas. The **Run** tab renders the same board in read-only "live" mode ([`WorkflowRunCanvas.tsx`](../src/components/composer/WorkflowRunCanvas.tsx)) — nodes light up by status, the active pathway electrifies, and HIL gates prompt in-canvas. **Click any stage** for a side-panel ([`ComposerNodeRunDetail.tsx`](../src/components/composer/ComposerNodeRunDetail.tsx)) with its verdict (pass + reasons + suggestions), error, and raw output.

Each workflow declares its own **input contract** on the start node's `config.inputSpec` (`{ objectiveLabel, objectiveHint, examples[] }`, authored in the start-node inspector) — so the Run form is self-describing (its own objective label + hint + click-to-fill examples + a description/stage preview) instead of a hardcoded "Feature request" box. `getInputSpec(graph)` ([`schema.ts`](../src/lib/composer/schema.ts)) reads it with a generic fallback; the seeded contract is back-filled into older installs by [`seed.ts`](../src/lib/composer/seed.ts).

> react-flow needs a measured viewport; both canvases are loaded client-only via `next/dynamic({ ssr: false })`.

## API

All gated by `PS_COMPOSER` (on by default; `PS_COMPOSER=0` makes them return `503`).

| Method + path | Purpose |
|---|---|
| `GET /api/composer/workflows` · `POST` | List / create a workflow (whole-graph def) |
| `GET/PUT/DELETE /api/composer/workflows/[id]` | Read graph / replace whole graph / delete (blocked while a run is active) |
| `GET /api/composer/runs` | List runs |
| `POST /api/composer/runs` | Start a run `{ workflowId \| workflowKey, input }` |
| `GET /api/composer/runs/[id]` | Run + node-runs + workflow graph |
| `GET /api/composer/runs/[id]/events` | Live SSE (`{ run, nodeRuns }`) — see [RUNTIME_ARCHITECTURE.md](RUNTIME_ARCHITECTURE.md) |
| `POST /api/composer/runs/[id]/nodes/[nodeId]/approve` | Resolve a HIL gate `{ action: accept\|reject, note? }` |
| `POST /api/composer/runs/[id]/clarify` | Answer a stage's clarification question `{ answer }` |

Deep Research is a Composer **node kind** (`research`), not a separate launcher — orchestrate research as one stage of a workflow. See [DEEP_RESEARCH.md](DEEP_RESEARCH.md).

## Verification

`npx tsc --noEmit && npm run lint && npm test && npm run build`. Engine/graph tests: [`composer-engine.test.ts`](../tests/unit/composer-engine.test.ts) (PASS path, HIL accept, FAIL loop-back), [`composer-builder.test.ts`](../tests/unit/composer-builder.test.ts) (whole-graph save + `OUTCOME` branch routing), [`composer-research-node.test.ts`](../tests/unit/composer-research-node.test.ts) and [`composer-group-node.test.ts`](../tests/unit/composer-group-node.test.ts) (research/group settle + recursion guard), and [`composer-canvas-graph.test.ts`](../tests/unit/composer-canvas-graph.test.ts) (canvas ↔ def converters). With a live Hermes + `PS_COMPOSER=1`, build a workflow on the canvas, launch it, watch the live board, approve/reject a gate, and force a FAIL to see the loop-back.
