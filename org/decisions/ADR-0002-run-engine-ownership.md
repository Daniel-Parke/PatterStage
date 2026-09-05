---
summary: PatterStage keeps its run engine; the estate's shared asset is the contract, not the implementation
type: decision
tags: [arch, delivery]
status: accepted
compiled_from: preserved
---

# ADR-0002 · Run-engine ownership

**Status:** accepted by Daniel, 2026-07-25. Supersedes
`PatterTech_EOS/estate/repos.yaml` lines 88-90 on adoption.
**Date:** 2026-07-25.

## Context

The estate manifest records that PatterStage "does not own the shared run engine
(it will consume PatterStack's run engine, semantics-first)".

Measured against the code, that line describes an intention, not a thing:

- There is no `patter-run` package, no run port in `config/patter-ports.toml`, and
  no HTTP surface. `PatterStudio/platform/orchestration` is **371 lines** of
  in-process LangGraph used by one Python product.
- PatterStage's engine is ~3.6k lines with 309 test files: a deterministic
  occurrence-id claim, restart safety recomputed from `next_run_at`, catch-up
  policy, idempotency keys to the backend, and a polymorphic reconcile driving both
  plain runs and Composer node-runs off one substrate.
- The convergence has already happened, and it runs **out of** PatterStage:
  `platform/agents/.../runtime/types.py:10` says "Ported from PatterStage's
  control-plane design"; `runtime/hermes.py:10` says "Ported from PatterStage's
  HermesRuntime.ts"; `orchestration/nodes.py:9-13` says the routing semantics "are
  Composer's, ported as the contract".
- The gate that was supposed to enforce convergence is open on both sides:
  PatterStudio ships `tests/fixtures/agentruntime-wire.json` asserting that
  "PatterStage's CI consumes the same file", and PatterStage contains no reference
  to it.

There is also a hard constraint the manifest line does not account for:
PatterStage is a public Apache-2.0 Node application that strangers install.
It cannot take a runtime dependency on a private Python fabric.

## Decision

**PatterStage keeps and hardens its run engine. The estate's shared asset is the
*contract*, not the implementation.**

1. The node/verdict/outcome/gate semantics and the run/agent-event shapes are
   published as **versioned JSON Schema** in the shared contracts package.
   TypeScript and Python each implement it.
2. `patter-run`, if and when it is built, is built to that contract.
3. PatterStage adopts `agentruntime-wire.json` as a merge gate, closing the
   convergence gate from its own side without waiting for the other.
4. PatterStage's engine must earn this by fixing what the audit found: global
   single-flight replaced by per-workspace lanes, a real lock instead of a
   check-then-act, the second unleased dispatch loop removed, and watchdogs on
   every run kind.

## Consequences

- Two implementations of one contract is accepted duplication, and is cheaper than
  one implementation that cannot be used by half the estate.
- "We keep reinventing the same processes" is answered at the level where the
  reinvention actually hurts — the semantics — rather than by forcing one runtime
  into two languages.
- The manifest line must change on adoption, or the two repos stay silently
  divergent, which is the current and worst state.

## Alternatives rejected

- **Consume PatterStack's engine as written.** It does not exist as a service, it
  is Python, and it would make the public product depend on a private repo.
- **Extract PatterStage's engine into the shared fabric.** Premature: the estate
  has one consumer of it. The twin-mode rule in the platform vision says a layer is
  promoted only when a second out-of-process consumer exists.
