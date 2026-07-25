---
summary: The LLM is the Brain and the framework configuration is the Body; progression measures the Body, never the Brain
type: decision
tags: [product, arch]
status: accepted
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
   - *Equipment acquired*: memory facts retained, skills enabled, tools wired,
     workflows authored.
4. **Every displayed number names its subject.** A figure describes the Brain, the
   Body, or the pairing. A rating that silently blends them, as today's Agent
   Rating blends wall-clock latency into a capability score, is a defect.
5. **No creative-tool activity feeds agent progression.** Writing fiction in the
   Rec Room is not the Body learning anything. Rec Room may keep its own separate
   progression if that is fun; it does not touch the agent's record.

## Consequences

- `src/lib/stats/derive.ts` and `stats-repository.ts` are rebuilt around a
  per-profile record. The dashboard stops querying the `stories` table.
- The benchmark rating splits: a capability score (Body, Brain fixed) and
  operational columns (latency, cost, tokens) reported alongside, never blended.
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
