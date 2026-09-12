---
summary: The consolidation programme executed end to end, plus the v2 EOS adoption; the release PR is green and waiting on the operator
type: venture
tags: [eos]
compiled_from: authored
id: S-0003
role: EXECUTOR
date: 2026-08-23
model: claude-opus-5 orchestrating claude-opus-5 and claude-fable-5 subagents
launcher: the operator's consolidation master prompt, then "work through ALL tasks"
items_touched: [T-0001, T-0002, T-0005, T-0006, T-0007, T-0008, T-0009, T-0010, T-0011, T-0012, T-0013, T-0014, T-0015, T-0016, T-0017, T-0018, T-0019, T-0020, T-0022, T-0023, T-0025, T-0029]
spend_estimate: ~9M tokens across roughly 60 subagents
---

## What happened

The programme ran phase by phase, each phase executed by agents holding one task
and reviewed by an agent that had written none of it. Phase 0 turned a
four-week-red CI green; every one of the three failing jobs was the same defect,
the S1 authentication boundary meeting harnesses written before it existed. Phase
0b reduced fifteen branches to two. Then the operator redirected the programme to
adopt the rebuilt PatterTech EOS first, which landed as ADR-0008: a recompile at
ORG scale, the pin repaired, thirty-one rulings migrated into a structured
record, the queue converted to task records, and PatterStage registered with the
estate for the first time. Phases 1 through 7 followed under the new machinery.

The numbers at close: `sql-outside-repository` 57 sites to zero,
`hermes-outside-adapter` 21 crossings to zero, `src/lib` 109 top-level files to
65 in six domains, every one of eighteen god files inside the 400-line ceiling,
the design-lint baseline 918 to 825 having never once grown, tests 2,285 to
2,485, and knip from three of eight checks to all eight clean. Three checks that
had never run anywhere now run: the full 97-test Playwright suite, all five
install scenarios, and a real-Hermes contract run.

## Decisions taken (within my authority)

Sequencing inside each phase, the disjoint-file split that let four executors
work one tree at once, and the choice to file discovered work as tasks rather
than fix it inline (T-0029 came from an audit, not a failure). Where a reviewer
rejected, the remediation was made and re-reviewed rather than argued with.

## What the reviews caught, because this is the part worth keeping

Reviewers rejected six times and were right every time. The v2 cutover shipped a
router pointing at a file that did not exist and three compile-report claims that
were not true of the tree. The output canary shipped a regex that could never
match inside a goldened surface, and then a golden that hashed raw bytes so it
could never survive crossing from a Windows checkout to a Linux runner. Phase 4
attributed a crontab-injection split to a sessions-page commit. The retention
prune was rejected on a red knip gate, not on data safety, all five of whose
questions passed under mutation. And ADR-0009 shipped recording an operator
acceptance no session can grant, corrected to proposed.

Twelve independent perturbations were run across the batches, planting
violations, lowering floors, stripping database triggers and inverting wire
precedence, to establish that the new gates bite rather than decorate.

Three diagnoses that had defeated earlier attempts were settled by evidence
rather than theory: docker-image was never a port bug but a readiness probe
hitting a path that now 401s; the install harness's update scenario failed
because `docker cp` preserves the source uid on Linux and git refuses a repo with
dubious ownership, degrading that refusal into a misleading not-a-git-directory
message; and e2e-full failed because the harness deleted the database it had just
seeded, invisible on Windows because SQLite holds the handles and the wipe fails.

## Filed

T-0029 (the config write that bypasses its one writer). Q-004 through Q-008
answered or promoted. ADR-0006 and ADR-0008 accepted, ADR-0007 superseded,
ADR-0009 proposed and awaiting signature.

## Handoff

The release PR is https://github.com/Daniel-Parke/PatterStage/pull/157, dev to
main, green on every check including the acceptance gate. It is the operator's to
merge; a session merging its own work to the release branch is the thing the
constitution exists to prevent.

Four things need the operator and nobody else: sign ADR-0009; sign the compile
report rubric, including the four WG-SEC rulings marked in-file as drafted rather
than ruled; add `acceptance-gate` to branch protection, which currently requires
zero checks so every gate above merely reports; and pause Dependabot until the
release, per ruling D14.

Open by choice, not by omission: T-0021 (spend visibility) wants its acceptance
rewritten against the 2026-07-26 warn-by-default ruling before anyone starts it,
T-0024 (the bloom field) is design work outside this programme, and T-0028 (the
first-build token lock-in) is a sitting only the operator can hold.

One artefact sits outside the repo: the Cursor worktree held uncommitted UI
experiments against the pre-rename layout, preserved to
`../patterstage-cursor-worktree-rescue-2026-08-22.patch` rather than deleted. The
worktree itself is still there and still dirty; WO-0028's own rule said stop and
hand the listing to the operator rather than force a removal, and that is what
happened.
