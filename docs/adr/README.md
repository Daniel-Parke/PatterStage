---
title: Decisions
summary: Public pointer to the ADR home, which is org/decisions/ since the ADR-0008 cutover
section: contributing
nav: 70
audience: contributor
type: venture
tags: [process, governance]
compiled_from: authored
---
# Decisions

Architecture decision records for PatterStage live in
[`org/decisions/`](../../org/decisions/). A decision recorded there wins over
anything you infer from the code.

This file stays behind as a public pointer. `docs/` is the front door a reader
arrives at, and a moved home with no forwarding address is how a decision stops
being findable. The move itself is ADR-0008, which supersedes ADR-0007.

`proposed` means drafted and argued but **not yet approved**. Only Daniel accepts a
decision, and acceptance is recorded by changing `status` to `accepted` in the file
itself. Do not build on a proposed ADR without saying that is what you are doing.

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-0001](../../org/decisions/ADR-0001-patterstage-hosts-work-not-surfaces.md) | PatterStage hosts work, not surfaces | accepted |
| [ADR-0002](../../org/decisions/ADR-0002-run-engine-ownership.md) | PatterStage keeps its run engine; the shared asset is the contract | accepted |
| [ADR-0003](../../org/decisions/ADR-0003-shared-kit-distribution.md) | One shared repo for agnostic layers; vendor the design kit by copy-in first | accepted |
| [ADR-0004](../../org/decisions/ADR-0004-brain-and-body.md) | The LLM is the Brain, the framework is the Body; progression measures the Body | accepted |
| [ADR-0005](../../org/decisions/ADR-0005-product-modules.md) | Product surfaces plug in through one ProductModule seam; Rec Room proves it | accepted |
| [ADR-0006](../../org/decisions/ADR-0006-dev-is-the-integration-trunk.md) | dev is the integration trunk; done means merged to green dev; main moves via gated release PRs | accepted |
| [ADR-0007](../../org/decisions/ADR-0007-adr-home-is-docs-adr.md) | docs/adr/ is the single ADR home; org/decisions/ holds a pointer | superseded |
| [ADR-0008](../../org/decisions/ADR-0008-adopt-the-v2-eos.md) | Adopt the v2 EOS by recompile at ORG scale; ADRs move to org/decisions/ | accepted |
| [ADR-0009](../../org/decisions/ADR-0009-retention-for-the-readings-tables.md) | Retention windows for analytics_events and chat_messages, with an opt-in prune that refuses to delete anything the progression record has not captured | accepted |

## Relationship to the EOS

PatterStage ran EOS Session 0 on 2026-07-25 and recompiled to the v2 kernel at ORG
scale under ADR-0008. The seed lives in `org/LOCKBOOK.md`, `org/RULINGS.json` and
`org/`. These ADRs use the EOS `decision` type and its front-matter schema, and the
constitution's protected set names `org/decisions/` directly, so the path in the law
and the path on disk are now the same path.

Two of them reach beyond this repo and need a decision in
`PatterTech_EOS/org/decisions/` by an estate session, because they change files in
the estate's protected set:

- **ADR-0002** supersedes the run-engine line in the estate manifest.
- **ADR-0003** part 2 moves `@pattertech/ui` out of PatterStudio and cancels the
  planned `PatterTech_WebKit` repo.
