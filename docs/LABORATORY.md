---
summary: The Laboratory section: Insights, Deep Research and Artifacts, and how they fit together
type: guide
tags: [product, laboratory]
compiled_from: normalised
---

# Laboratory

The **Laboratory** sidebar section is PatterStage's home for measuring and improving how you use your agent. It groups the analysis + experimentation tools:

| Page | URL | What it does |
|---|---|---|
| **Insights** | `/laboratory/insights` | Interaction analytics, provider spend, and the gamification layer (streak, achievements, activity). See [ANALYTICS.md](ANALYTICS.md). |
| **Deep Research** | `/laboratory/research` | Native, provider-flexible iterative web research → cited report. See [DEEP_RESEARCH.md](DEEP_RESEARCH.md). |
| **Artifacts** | `/laboratory/artifacts` | Every deliverable a Deep Research run, a Composer workflow or a mission produced, auto-captured, plus anything you saved by hand. Collected to view and download. |

There is no operator **level** on Insights. [ADR-0004](../org/decisions/ADR-0004-brain-and-body.md)
ruled that a level belongs to a Body (an agent profile) rather than to the person
clicking, so levels are per-agent and live on Operations → Agents
(`/operations/agents`) and on each agent's card on the dashboard.

Insights moved here from the top-level nav; the old URL (`/insights`) **308-redirects** to `/laboratory/insights`, so existing bookmarks keep working (`next.config.ts`).

There is no Benchmarks page. The benchmark subsystem was deleted in `4935ac31`, and `/benchmarks` no longer redirects: it 404s, which is the honest answer. A permanent redirect into a missing page is worse than no redirect, because browsers cache a 308 indefinitely.

## How it fits the bigger picture

- **Deep Research** is the evidence gatherer: it plans, searches, reasons and synthesizes into a cited report. It does **not** launch workflows. The arrow runs the other way: **[Composer](COMPOSER.md)** (the graph orchestrator) has a `research` node kind, so a research run is one stage of a workflow rather than the thing that starts one. A report page therefore offers copy, download and standalone HTML export, and no "launch as Composer" action.
- **Artifacts** is where the output lands, from research, Composer and missions alike, so a finished run leaves something you can open rather than a log you have to scroll.
- **Insights** is the gamified feedback loop that keeps the whole thing rewarding to use, and the one place provider spend is reported (see [SPEND.md](SPEND.md)).

Together they make PatterStage a place to experiment with your agent and keep getting more out of it as the AI landscape changes.
