---
summary: PatterStage Compile report , the seed's ancestry proof and the rubric sign-off record
type: venture
tags: [eos]
compiled_from: kernel/templates/COMPILE_REPORT.tpl.md
---

# Compile report · PatterStage

Proof that this seed was compiled, not authored. Written by the
Session 0 compiler; validated by `eos_check.py --seed`; signed by the
operator against the human rubric items. A seed file that cannot be
traced to a row below is a compile failure.

## Seed identity

- venture: PatterStage
- scale: M · add-ons: ops-runbook, restore-test
- eos_version: v1.0 · eos_commit: cc18755
- compiled: 2026-07-25 · compiler session: session-0-2026-07-25

## Ancestry

One row per compiled file. Source is the kernel template path, `byte
copy of AGENTS.md` for CLAUDE.md, or `authored` for trigger add-ons
written at Session 0 from doctrine (name the doctrine). Reseeds add two
row kinds: `normalised` (pre-EOS venture files that gained front-matter
only, content untouched) and `preserved` (venture content the compile
did not touch).

| file | source | slots filled | fences pruned |
| --- | --- | --- | --- |
| AGENTS.md | kernel/templates/AGENTS.tpl.md | 3 | 3 |

Deferral fills (`set at first build`, COMPILE.md) count as fills and
are listed here by slot, with where each gets ruled.

## Distillations

Standards or notes distilled into the seed from the doctrine the
rulings cite, each with the ruling that pulled it in. None is a valid
answer at S.

## Deviations from the matrix

None expected. Anything here blocks the gate until ruled.

## Check results

Paste the `eos_check.py --seed` summary line and date. All auto items
green before the human items are judged.

## Sign-off (human rubric items)

- [ ] H1 cold-start test · - [ ] H2 brief reads true · - [ ] H3
  rulings honest · - [ ] H4 voice holds · - [ ] H5 operator can run it
- Signed: Daniel Parke · date: set at phase E, by the operator
