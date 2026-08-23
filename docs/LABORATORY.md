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
| **Insights** | `/laboratory/insights` | Interaction analytics + the gamification layer (level, streak, achievements, activity). See [ANALYTICS.md](ANALYTICS.md). |
| **Deep Research** | `/laboratory/research` | Native, provider-flexible iterative web research → cited report. See [DEEP_RESEARCH.md](DEEP_RESEARCH.md). |
| **Artifacts** | `/laboratory/artifacts` | Every deliverable a Deep Research run or a Composer workflow produced, collected to view and download. |

Insights moved here from the top-level nav; the old URL (`/insights`) **308-redirects** to `/laboratory/insights`, so existing bookmarks keep working (`next.config.ts`).

There is no Benchmarks page. The benchmark subsystem was deleted in `4935ac31`, and `/benchmarks` no longer redirects: it 404s, which is the honest answer. A permanent redirect into a missing page is worse than no redirect, because browsers cache a 308 indefinitely.

## How it fits the bigger picture

- **Deep Research** is the planning brain: it gathers and synthesizes evidence, and can hand off to **[Composer](COMPOSER.md)** (the graph orchestrator) to turn a research brief into an executed, multi-stage workflow.
- **Artifacts** is where the output of both lands, so a finished run leaves something you can open rather than a log you have to scroll.
- **Insights** is the gamified feedback loop that keeps the whole thing rewarding to use.

Together they make PatterStage a place to experiment with your agent and keep getting more out of it as the AI landscape changes.
