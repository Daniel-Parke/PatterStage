---
summary: PatterStage lens contract form, the eight parts agreed before an external source is studied and the provenance every lesson carries
type: venture
tags: [eos]
compiled_from: kernel/templates/LENS.tpl.md
---

# LENS-NNNN · name the source

The contract for studying something we did not build. Copy this form to
`docs/lenses/LENS-NNNN.md`, once per study, and agree it with the
operator before the study begins. One source may carry several lenses;
each one is its own contract and its own file.

This is a record of what was decided and why. It is not legal advice, and
filling it in is not a finding that a study is lawful. Where a part
cannot be filled in truthfully, the study does not start.

- Agreed by:
- Date:
- Findings land in:

## 1. The artefact and how it was acquired

Exactly what is being studied, pinned so a reader can get the same thing:
a repository at a commit, a product at a version, a binary, a site on a
date, a game build. Then how it came into our hands: bought, licensed,
downloaded from a public repository under a named licence, a free trial,
a publicly available build.

Acquisition is recorded because it decides everything after it. Material
obtained through a leak, a breach or a false pretence is out, and no
later care repairs it.

- Artefact and version:
- Acquisition channel and date:

## 2. Governing terms and jurisdiction

The licence, terms of service or end-user agreement attached to what was
acquired, quoted where it matters. Say whether it restricts study,
testing or reverse engineering, and whether it names a governing law.
Whether such a restriction binds us varies by jurisdiction, so record the
answer rather than assuming one. If the terms are unclear, stop and put
it to the operator.

- Terms and where they are published:
- Restrictions on study or reverse engineering:
- Governing law named:

## 3. Lenses in

The named aspects being studied, and nothing outside the list. Pick from
behaviour in use, interface shapes, architecture, mechanics and
economies, idioms and conventions, visual grammar, published process
history. Write down why each one is being studied.

Escalation runs least intrusive first, and each step is only taken when
the one before it has been exhausted:

1. Use the thing and observe it.
2. Published documentation.
3. Published tests and public interfaces.
4. Reading source, where the terms in part 2 permit reading it.
5. Decompiling, or getting past a technical protection measure. Never,
   unless a lawful basis is written down here first and the operator
   approves it in the room.

- Aspects in scope:
- Escalation reached:

## 4. Lenses out

Exclusions. These four are on every lens contract and are not negotiable
per study:

- No verbatim code or asset carriage.
- No expressive text: prose, dialogue, documentation wording, names.
- No reproduction of the source's own overall look, the thing that makes
  a person recognise whose product it is.
- No tainted material: nothing leaked, breached or obtained under a false
  pretence, ever.

Add the exclusions specific to this study beneath them.

- Also out of scope:

## 5. The abstraction gate

What may be carried away, and at what level. Ideas, methods and
mechanics; forms dictated by efficiency or fixed by an external
constraint such as hardware, an interoperability requirement or an
industry standard; and material already in the public domain. All of it
re-expressed in our own words, as a functional description of what a
thing does, never as a copy of how the source said it.

The test to apply to every finding before it is written down: could
somebody who had never seen the source arrive at this wording from the
description alone. If not, it has not been abstracted yet.

## 6. Separation

The study session is the only session that reads the raw source. If the
source is fetched live, freeze a copy first and study the frozen copy.

Build lanes receive the lesson and never the source. They do not get the
repository, the binary, the transcript or the screenshots. If a build
lane needs to see the source to proceed, that is a sign the lesson is not
finished.

- Study session:
- What the build lanes receive:

## 7. The provenance record on every lesson

No lesson leaves this study without all of it:

| field | what it holds |
| --- | --- |
| source | identity and version, from part 1 |
| acquisition | channel and date, from part 1 |
| terms | the licence or agreement, from part 2 |
| lens | this contract's id |
| extracted | what was taken, and at what level of abstraction |
| destination | where the lesson landed |
| verification | what was done to check it is true, not just observed |
| limits | applicability conditions and counter-evidence |

Where actual code is carried under a licence that permits it, it also
carries SPDX snippet tags and a REUSE file header, so the licence travels
with the lines rather than with a memory of them.

## 8. Contradiction control

Every lesson names its evidence class: observed, sourced fact,
interpretation, inference, recommendation. A lesson that disagrees with
something we already hold names the thing it disagrees with, by id, at
the moment it is written. Contradictions found at intake are cheap.
Contradictions found after adoption are not.

- Existing material this study touches:
- Disagreements found:
