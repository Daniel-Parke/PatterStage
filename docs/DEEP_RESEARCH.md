---
summary: The native Deep Research engine, its plan, search, reason and synthesize loop, and where inference comes from
type: guide
tags: [product, laboratory]
compiled_from: normalised
---

# Deep Research

Native, provider-flexible research under the [Laboratory](LABORATORY.md): submit a question and the engine runs an iterative loop, **plan → (search → visit sources → reason)×rounds → synthesize**, producing a cited report. It depends on no external service (no Odysseus): inference reuses PatterStage's own `callLLM`, and web search is a shared, free/local-first module.

Nav: **Laboratory → Deep Research** (`/laboratory/research`).

## Inference (local or cloud, default Hermes)

The engine ([`engine.ts`](../src/lib/laboratory/deep-research/engine.ts)) calls inference through an injectable `LlmFn` whose default is `callLLM` ([`src/lib/llm.ts`](../src/lib/llm.ts)). `callLLM` already resolves **direct-provider** (a model-registry row with a `baseUrl` + key → a local OpenAI-compatible endpoint like LM Studio/Ollama/vLLM, *or* a cloud provider) vs. the **Hermes gateway** default. So a research run can use:

- the **Hermes agent's default model** (no `config.modelId`), or
- any **registry model** (`config.modelId`), pointing at a **local endpoint** or a **cloud** provider.

## Search (shared, free/local-first)

Search lives in the reusable [`src/lib/search/`](../src/lib/search/) module (also used by Composer's Research stage). Providers implement `SearchProvider`; `resolveSearchProvider()` picks one:

- **DuckDuckGo:** free, zero-config **default** (no key).
- **SearXNG:** fully local/private when you point `PS_SEARXNG_URL` at your own instance.
- **None:** "No web (model only)" on the page, `searchProvider: "none"` over the API. A null provider that returns no results, so the run answers from model knowledge alone and says so.
- Cloud adapters (serper/tavily/brave) slot in later, keyed off the credentials registry.

Configure via `PS_SEARCH_PROVIDER` / `PS_SEARXNG_URL` (see [ENV_REFERENCE.md](ENV_REFERENCE.md)). A per-run choice in the config panel overrides the environment; with no choice and `PS_SEARXNG_URL` set, SearXNG is preferred automatically. Choosing SearXNG **without** that URL is not an error, it silently resolves to DuckDuckGo, so set the URL before assuming a run stayed local. `visit()` fetches a page and extracts readable text (dependency-free HTML→text, size-capped). The engine tolerates zero search results (it falls back to LLM-only and says so).

## The loop

1. **Plan:** the model proposes sub-questions + an initial `QUERY:`.
2. **Rounds** (budgeted, default 3): **search** the current query → **visit** the top sources → **reason** over the evidence + prior notes; the model emits `NEXT QUERY:` to continue or `DONE` to stop.
3. **Synthesize:** a cited Markdown report from the plan, notes, and deduped sources.

## Configuring a run, and saving that configuration

Under the question box are four fields: **Model**, **Search** provider, **Depth** (`rounds`, 1 to 8, default 3) and **Breadth** (`resultsPerQuery`, 1 to 12, default 6). A fifth option, `visitsPerRound` (pages actually read per round, default 2), is accepted by the API and carried in a saved preset but has no field on the page.

Any configuration can be saved under a name and reloaded from the **Presets** picker. Presets live in `research_presets`, added together with `research_runs.config_json` by migration `023`, so the options a run used are recorded on the run itself.

## Persistence and recovery

Every step (plan/search/visit/reason/synthesize) is persisted to `research_steps` (schema v19) so the page can replay/stream it. The run is fire-and-forget ([`run-job.ts`](../src/lib/laboratory/deep-research/run-job.ts)); the page streams via SSE (`GET /api/laboratory/research/[id]/events`) with `useApiResource` polling as the fallback. Because the job is fire-and-forget, a crashed/restarted process would leave a run stuck `running`. Boot recovery (`failStuckResearchRuns`, wired in [`instrumentation.ts`](../src/instrumentation.ts)) fails standalone runs left running past a deadline so the page doesn't spin forever.

## API

| Method + path | Purpose |
|---|---|
| `GET /api/laboratory/research` | List runs |
| `POST /api/laboratory/research` | Start `{ query, config? }`. Every option lives inside `config`: `modelId`, `searchProvider`, `rounds`, `resultsPerQuery`, `visitsPerRound`. Both schemas are `.strict()`, so a stray or top-level key (a bare `modelId`, for instance) is a 400 rather than a silently ignored field. |
| `GET /api/laboratory/research/[id]` | Run + steps |
| `GET /api/laboratory/research/[id]/events` | Live SSE (`{ run, steps }`) |
| `GET /api/laboratory/research/[id]/export` | Standalone interactive HTML report (`Content-Disposition: inline`, so it opens in the browser; the UI also offers Download) |
| `GET /api/laboratory/research/presets` | List saved run configurations |
| `POST /api/laboratory/research/presets` | Save one: `{ name, config }` |
| `DELETE /api/laboratory/research/presets?id=` | Delete one (`id` is required, else 400) |

Research is also a **Composer node kind** (`research`). Orchestrate it as one stage of a workflow rather than launching a workflow from a report. See [COMPOSER.md](COMPOSER.md).

## Verification

`npm test` covers the IterResearch loop (rounds, budget, LLM-only, failure) and the search module (SearXNG parse, visit extraction, resolver) with injected deps. End-to-end: run a query against (a) the Hermes default and (b) a local-endpoint registry model; confirm a cited report + streamed steps.

## Stopping a run

A run you no longer want can be stopped from the detail pane: **Stop run**, then
a second click to confirm. It is offered only while the run is pending or
running, so a finished report can never be relabelled.

The row is written by `POST /api/laboratory/research/[id]/cancel` and the job
notices at its next step and bails out, rather than finishing and overwriting
your decision with `completed`. A cancelled run keeps whatever steps it had
reached, records no report, and captures no artifact: half a report is not a
deliverable. Its tokens up to that point are already recorded against it, so
stopping a run does not make what it already spent disappear.
