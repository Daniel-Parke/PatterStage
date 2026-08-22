---
summary: The Laboratory section: Insights, Benchmarks and Deep Research, and how they fit together
type: guide
tags: [product, laboratory]
compiled_from: normalised
---

# Laboratory

The **Laboratory** sidebar section is PatterStage's home for measuring and improving how you use your agent. It groups the analysis + experimentation tools:

| Page | URL | What it does |
|---|---|---|
| **Insights** | `/laboratory/insights` | Interaction analytics + the gamification layer (level, streak, achievements, activity). See [ANALYTICS.md](ANALYTICS.md). |
| **Benchmarks** | `/laboratory/benchmarks` | Benchmark your agent (its LLM + skills/tools/memory) and earn a JRPG stat card / Agent Rating. |
| **Deep Research** | `/laboratory/research` | Native, provider-flexible iterative web research → cited report. See [DEEP_RESEARCH.md](DEEP_RESEARCH.md). |

Insights and Benchmarks moved here from the top-level nav; the old URLs (`/insights`, `/benchmarks`) **308-redirect** to `/laboratory/*`, so existing bookmarks keep working (`next.config.ts`).

## How it fits the bigger picture

- **Benchmarks** tell you which models/skills/frameworks actually work better — reliable comparisons, not vibes.
- **Deep Research** is the planning brain: it gathers and synthesizes evidence, and can hand off to **[Composer](COMPOSER.md)** (the graph orchestrator) to turn a research brief into an executed, multi-stage workflow.
- **Insights** is the gamified feedback loop that keeps the whole thing rewarding to use.

Together they make PatterStage a place to experiment with your agent and keep getting more out of it as the AI landscape changes.
