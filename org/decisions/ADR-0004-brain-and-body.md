---
summary: The LLM is the Brain and the framework configuration is the Body; progression measures the Body, never the Brain
type: decision
tags: [product, arch]
status: accepted
compiled_from: preserved
---

# ADR-0004 · Brain and Body

**Status:** accepted by Daniel, 2026-07-25.
**Date:** 2026-07-25.

## Context

The industry calls a single framework running one loop "multiple agents", and
then talks about those agents as if they learn, improve and have ability. That
anthropomorphism is not harmless here: it makes PatterStage unable to say what any
of its own numbers mean.

The concrete symptom is the progression system. Today one global operator "level"
is fed by mission counts, settings changes and, literally, the number of
interactive-fiction stories written (`src/lib/stats/derive.ts`, `m.stories *
XP.perStory`). It rises when the operator fiddles. It says nothing about anything.

The benchmark harness already stumbled onto the right distinction without naming
it: it runs a "brain-only baseline" against the full agent to isolate what the
framework adds over the raw model.

## Decision

Two nouns, one meaning each, used everywhere in code, UI and docs.

**The Brain** is the LLM. Its ability is a property of the model and its vendor:
Opus 5 is more capable than a 7B local model, and no amount of use makes a Brain
better. A Brain is *selected*, not *grown*.

**The Body** is everything PatterStage owns around it: the agent profile, its
system prompt and personality, enabled skills, tools and toolsets, memory,
credentials, model routing and fallbacks, and the workflows it can run. A Body is
*built up over time* by the operator, and that accumulation is real.

From which:

1. **Progression measures the Body. Never the Brain.** Swapping in a stronger
   model must not raise a level. It should raise *throughput*, which is a
   different, separately reported thing.
2. **Progression is per-Body, not per-operator.** Each agent profile carries its
   own record. The single global operator level is wrong and goes.
3. **Three honest inputs**, per the owner's ruling, all attributable to the Body:
   - *Work done*: runs completed, missions succeeded, stages passed, time active.
   - *Capability gained*: benchmark movement **with the Brain held constant**, so
     the delta reflects the Body. A benchmark run that changed model is not
     evidence of learning and must not be counted as such.
     **DEFERRED, 2026-07-25, and see the amendment below: this input has no
     implementation. Progression ships on two of three.**
   - *Equipment acquired*: memory facts retained, skills enabled, tools wired,
     workflows authored.
4. **Every displayed number names its subject.** A figure describes the Brain, the
   Body, or the pairing. A rating that silently blends them, as today's Agent
   Rating blends wall-clock latency into a capability score, is a defect.
5. **No creative-tool activity feeds agent progression.** Writing fiction in the
   Rec Room is not the Body learning anything. Rec Room may keep its own separate
   progression if that is fun; it does not touch the agent's record.

## Amendment, 2026-07-25: the capability axis has no implementation

Accepted by Daniel the same day this ADR was, after the benchmark subsystem was
investigated rather than assumed. **Progression ships on two of its three inputs.
Do not read decision 3 above as describing working software.**

Two measurements decided it.

**Nobody had ever run it.** `benchmark_runs = 0` in every database on the machine,
including the live one at schema v29 carrying `runs=22`, `sessions=35`,
`missions=16`, `skills=178` and five weeks of real history. Not cleanup: the run
row is inserted before execution starts and nothing deletes from that table. No
`__bench_` profile was ever written to disk. `runner.ts` was 0 of 188 lines
covered.

**And the content could not have served this ADR anyway.** All 94 items span eight
closed-book domains: maths, reasoning, logic, instruction-following, consistency,
safety, honesty, needle-retrieval. Not one requires a tool, a skill, a file, the
web, or memory. Yet 522 lines of ephemeral-profile and spawned-gateway machinery
existed solely to make the skills/tools/memory toggles genuinely apply.

Skills, tools and memory cannot change the answer to "What is 15% of 240?" So the
delta this ADR asks for -- movement with the Brain held constant, so the change
reflects the Body -- was **zero by construction**. One suite file even claimed its
items "discriminate between a bare model and a configured agent". They could not.

That is why the code was deleted rather than fixed: the machinery and the content
were mismatched, and the content is the half that has to be rewritten. Keeping
6.5k lines as a placeholder for content that must be replaced is the expensive
option.

**What the capability axis needs, when someone builds it:** items that FAIL without
a tool, a skill, or a memory fact. A task that cannot be answered from the model's
weights is the only kind whose movement means the Body improved. That is new
content plus a much smaller runner, and it is not scheduled.

Two defects are recorded so a rebuild does not reproduce them. The judge defaulted
to `getDefaultModel("agent")`, so absent explicit configuration a model graded its
own output, on 14 items. And per-repeat spread was never reported, so a run with
one repeat sat on the same leaderboard as a run with ten. The lifted grader in
`src/lib/llm-judge.ts` requires an explicit judge model with no fallback, which
closes the first.

Four mechanisms were lifted into core before the delete, because each solved a
problem the product still has and the harness was the only place it was solved:

| lifted to | what it was solving |
|---|---|
| `runtime/run-trajectory.ts` | the only record of what an agent DID, not what it output |
| `HermesRuntime.submitRun` | a 429 is "come back", and every real caller was treating it as failure |
| `llm-judge.ts` | grading by an independent model, with calibrated anchors |
| `llm-output.ts` | reading a final answer, not the model's deliberation |

The last two fixed live defects on the way past: Composer was reading verdicts out
of `<think>` blocks, and Deep Research marked a total search outage `completed`.

## Consequences

- `src/lib/stats/derive.ts` and `stats-repository.ts` are rebuilt around a
  per-profile record. The dashboard stops querying the `stories` table.
- ~~The benchmark rating splits: a capability score (Body, Brain fixed) and
  operational columns (latency, cost, tokens) reported alongside, never blended.~~
  **Superseded by the amendment: there is no rating to split.** The latency-blend
  defect this line was written to fix had in fact already been fixed in `5d3268c`
  before the subsystem was deleted, so the review finding that prompted it was
  stale when quoted.
- The dashboard hero and the Agents page show the agent's **level** and the signals
  behind it (`AgentLevelBadge`, `AgentGrowthPanel`), each row a thing the agent did
  or was given. Decision 4 above is satisfiable there in a way it never was for the
  six-axis stat card, whose axes came from hand-picked domain weights with no
  stated basis.
- `agent-experience.ts` loses its `perBenchmark: 30` XP term. It read
  `benchmark_runs` through a helper that try/catches to zero, so leaving it would
  have kept every Agent Level computing with a silently missing input.
- Migrations 014, 015 and 017 stay, annotated as vestigial. `schema_version` is a
  strictly increasing chain, so `benchmark_runs`, `benchmark_item_results` and
  `bench_gateways` remain as permanently empty tables in every database. A
  schema-history tax on the decision, not a sign the feature is returning.
- **What the owner loses, stated plainly:** there is now no way in the product to
  compare two models, or two agent configurations, on a fixed task set. Nothing
  else does head-to-head evaluation. The question "did adding those 12 skills
  help?" is unanswerable until a Body-sensitive suite exists -- though it was
  equally unanswerable before, because the suite was closed-book.
- `agent-experience.ts` levels stay as a concept but are re-derived from the three
  inputs above and attached to a profile.
- The vocabulary is binding in the UI. "Agent" alone is ambiguous and should be
  avoided where Brain or Body is meant.
- This gives the progression system something true to say, which is what makes it
  worth keeping: it shows the operator the value of the work they have put into a
  setup, separately from the model they happen to be renting.

## Alternatives rejected

- **Delete progression.** It was the reviewer's recommendation and the owner
  overruled it, correctly: the accumulated investment in a Body is real, currently
  invisible, and worth showing. The fault was in what was measured, not in
  measuring.
- **Keep one operator-level.** It cannot answer "which of my agents is the most
  developed", which is the only question the feature is good for.
