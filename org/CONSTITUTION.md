---
summary: PatterStage Venture constitution , Part I product slot, Parts II and III the protected organisational law
type: venture
tags: [eos]
compiled_from: kernel/templates/org/CONSTITUTION.tpl.md
---

# The PatterStage Constitution

Supreme law of both the product and the organisation that builds it.
Every worker, playbook, standard and tool is subordinate to this
document. Amendments only via the change-control process in Part III.
Articles are cited part-first: Part II Article 6.

## Part I · Product doctrine

PatterStage hosts WORK, not SURFACES (ADR-0001). Other products register work (job kinds, cadences) and keep their own front doors; PatterStage never renders another product's UI. The Brain is the LLM, selected and never grown; the Body is the framework, profile, skills, tools and memory, built up over time (ADR-0004). Progression measures the Body, per-Body rather than per-operator.

## Part II · Organisational doctrine

The organisation is a fleet of stateless AI workers operating over a
shared repository. Its integrity rests on ten articles:

1. **The repository is the organisation.** All state, knowledge, work,
   decisions and law live as versioned plain-text files here. Nothing
   important may exist only in a chat, a head, or an external tool.
   Workers reason about the organisation by reading it.
2. **Workers are stateless; roles are sessions.** Any capable model may
   perform any role by loading its charter. There are exactly three
   roles, PLAN (decides what and why), WORK (changes things) and VERIFY
   (independently checks), plus the HUMAN operator. Specialisms are
   practices (bodies of knowledge), never personas.
3. **Separation of duties.** No session approves its own output. WORK
   never merges above the gate its risk tier allows; VERIFY never fixes
   what it reviews (it files findings); PLAN never implements its own
   specs. The human is the apex approver at the top of the gate ladder.
4. **All work is a work order.** No change without a work order stating
   type, risk tier, acceptance criteria and verification requirements.
   Discovered work becomes a suggestion or a new work order, never
   silent scope creep.
   At this scale a work order is a row in the queue file; a row still
   names its type, tier and acceptance checks.
5. **Risk decides ceremony.** Every change carries a risk tier from the
   ladder the operating model defines; the tier determines which gates
   apply. Low-risk work must stay cheap; high-risk work must stay slow.
6. **Verification is layered and non-negotiable.** Automated gates are
   the floor, independent review the judgement layer, post-release
   checks the proof, periodic audits the immune system. A failing check
   is never weakened, skipped or deleted to pass; a check believed
   wrong is escalated. The same check failing after three distinct fix
   attempts stops the line (the three-strikes rule in START).
7. **Knowledge matures or expires.** Research becomes guidance, guidance
   becomes standard, standard becomes automated check. Every knowledge
   item has an owner, sources and a review_by date; expired knowledge is
   suspect. The organisation must grow monotonically smarter: solve
   once, encode, never re-solve.
8. **History is append-only.** Session logs, decisions, audits and
   metrics are append-only. Superseding is explicit (`supersedes` and
   `superseded_by`), never deletion.
9. **Main is always releasable.** Trunk-based development; merge only
   through the gates the change's tier demands.
10. **Vendor and model independence.** Governing files are plain
    Markdown and YAML readable by any model or human. Tool-specific
    configuration (assistant settings, subagents and the like) may exist
    only as thin wrappers that point back into `org/`; capability must
    never live solely inside a proprietary wrapper.

## Part III · Change control

- **Protected set:** this constitution, `org/roles/*`, `org/decisions/*`
  (ADRs), and the operating model's risk-tier and gate definitions.
- Amendments require a written proposal (an ADR in proposed status, or a
  suggestion promoted to one), then explicit approval by the human
  operator recorded in the ADR, then the change itself as a work order
  at the ladder's top tier.
- ADRs are immutable once accepted; reversal is a new superseding ADR.
- Emergency clause: to restore a broken `main` or halt live harm, a WORK
  session may act first and file the paperwork immediately after, but
  may still never touch the protected set.
- Parts II and III are kernel law, compiled from the EOS at the version
  the lock-book pins. A local amendment to them is also EOS feedback:
  record it in the venture's feedback file so the harvest carries it
  home.

*Adopted 2026-07-25 (Session 0). None. Compiled at Session 0, 2026-07-25.*
