---
summary: The native Deep Research engine, its plan, search, reason and synthesize loop, and where inference comes from
type: guide
tags: [product, laboratory]
compiled_from: normalised
---

# Deep Research

Native, provider-flexible research under the [Laboratory](LABORATORY.md): submit a question and the engine runs an iterative loop — **plan → (search → visit sources → reason)×rounds → synthesize** — producing a cited report. It depends on no external service (no Odysseus): inference reuses PatterStage's own `callLLM`, and web search is a shared, free/local-first module.

Nav: **Laboratory → Deep Research** (`/laboratory/research`).

## Inference (local or cloud, default Hermes)

The engine ([`engine.ts`](../src/lib/laboratory/deep-research/engine.ts)) calls inference through an injectable `LlmFn` whose default is `callLLM` ([`src/lib/llm.ts`](../src/lib/llm.ts)). `callLLM` already resolves **direct-provider** (a model-registry row with a `baseUrl` + key → a local OpenAI-compatible endpoint like LM Studio/Ollama/vLLM, *or* a cloud provider) vs. the **Hermes gateway** default. So a research run can use:

- the **Hermes agent's default model** (no `modelId`), or
- any **registry model** (`modelId`) — pointing at a **local endpoint** or a **cloud** provider.

## Search (shared, free/local-first)

Search lives in the reusable [`src/lib/search/`](../src/lib/search/) module (also used by Composer's Research stage). Providers implement `SearchProvider`; `resolveSearchProvider()` picks one:

- **DuckDuckGo** — free, zero-config **default** (no key).
- **SearXNG** — fully local/private when you point `PS_SEARXNG_URL` at your own instance.
- Cloud adapters (serper/tavily/brave) slot in later, keyed off the credentials registry.

Configure via `PS_SEARCH_PROVIDER` / `PS_SEARXNG_URL` (see [ENV_REFERENCE.md](ENV_REFERENCE.md)). `visit()` fetches a page and extracts readable text (dependency-free HTML→text, size-capped). The engine tolerates zero search results (it falls back to LLM-only and says so).

## The loop

1. **Plan** — the model proposes sub-questions + an initial `QUERY:`.
2. **Rounds** (budgeted, default 3): **search** the current query → **visit** the top sources → **reason** over the evidence + prior notes; the model emits `NEXT QUERY:` to continue or `DONE` to stop.
3. **Synthesize** — a cited Markdown report from the plan, notes, and deduped sources.

Every step (plan/search/visit/reason/synthesize) is persisted to `research_steps` (schema v19) so the page can replay/stream it. The run is fire-and-forget ([`run-job.ts`](../src/lib/laboratory/deep-research/run-job.ts)); the page streams via SSE (`GET /api/laboratory/research/[id]/events`) with `useApiResource` polling as the fallback. Because the job is fire-and-forget, a crashed/restarted process would leave a run stuck `running` — boot recovery (`failStuckResearchRuns`, wired in [`instrumentation.ts`](../src/instrumentation.ts)) fails standalone runs left running past a deadline so the page doesn't spin forever.

## API

| Method + path | Purpose |
|---|---|
| `GET /api/laboratory/research` | List runs |
| `POST /api/laboratory/research` | Start `{ query, modelId? }` |
| `GET /api/laboratory/research/[id]` | Run + steps |
| `GET /api/laboratory/research/[id]/events` | Live SSE (`{ run, steps }`) |
| `GET /api/laboratory/research/[id]/export` | Standalone interactive HTML report (`Content-Disposition: inline` — opens in the browser; the UI also offers Download) |

Research is also a **Composer node kind** (`research`) — orchestrate it as one stage of a workflow rather than launching a workflow from a report. See [COMPOSER.md](COMPOSER.md).

## Verification

`npm test` covers the IterResearch loop (rounds, budget, LLM-only, failure) and the search module (SearXNG parse, visit extraction, resolver) with injected deps. End-to-end: run a query against (a) the Hermes default and (b) a local-endpoint registry model; confirm a cited report + streamed steps.
