---
summary: Venture brief for PatterStage, recompiled to the v2 template at the ADR-0008 recompile
type: brief
tags: [eos]
compiled_from: kernel/templates/VENTURE_BRIEF.tpl.md
---

# PatterStage · Venture brief

Business truth, written at Session 0 from the interview and kept
current by the venture. Every fact here is the operator's; the agent
transcribed and challenged, never invented. If this file and reality
disagree, fix this file.

## What it is

PatterStage is a local-first application a single operator installs on their own
machine to control one Hermes AI agent: configure it, commission work, gate the
work that needs judgement, and watch what ran. Founding a governed project from
PatterTech EOS seed packs is the venture's other half, and today it is an
intention rather than a surface: this paragraph used to say the console generated
them, and no page, route or library under `src/` mentions EOS at all. The only
compiler in the tree is `scripts/tooling/eos-compile.mjs`, a Session 0
command-line artefact the application never invokes, which reads its templates
from a separate PatterTech_EOS checkout named by `EOS_ROOT` and pins the scale at
M; `docs/COMPILE_REPORT.md` item 5 already records that it owes a v2 pass or a
retirement note. Nothing else plugs in until someone other than its author has
installed it from scratch and used it for a week: integrating PatterTech's wider
product layers is deliberately deferred, not undecided.

- One line: the local console for one AI agent, and the place a governed project
  is meant to be founded once that compiler is ported.
- Who it serves: **both, equally** (the operator's word). A public open-source
  control plane for anyone running Hermes locally, AND PatterTech's own estate
  console. Neither audience is the junior partner.
- Why now: no external deadline and no agreement. The operator's words: "There are
  no agreements or deadlines, these are all MY/PatterTech's projects." The pull is
  the EOS going public in the coming weeks, which is self-imposed.

## The challenge record (anti-sycophancy, mandatory)

- Restated and corrected: **restated and corrected.** Two restatements were
  offered. The first was rejected in effect rather than in words: adopting the
  strictly smaller version reshaped the scope, so the restatement was re-cut and
  the narrower version confirmed verbatim. The confirmed text is the "What it is"
  paragraph above, whose seed-pack sentence was later corrected against the code.
  The scope the operator adopted is unchanged and is quoted verbatim below; only a
  capability the console never had was demoted to the intention it always was.

- The three cheapest ways this dies: accepted as written. These are the cheapest,
  not the most dramatic, and they are the risk register at birth:

  1. **Nobody but you ever installs it.** The .exe never ships, clone-and-run is
     too high a bar. *Requires nothing at all to go wrong.*
  2. **The integration layer eats the product.** Each product adds a seam; a sole
     dev's budget goes to connectors. *Requires only that you succeed.*
  3. **Local-first quietly stops being true.** One feature needs an API, that API
     needs an account. *Requires one unnoticed decision.*

  Adopting the smaller version re-ranked these: death 1 is now the sharpest,
  because "someone other than the author installs it" became the gate on
  everything else.

- The strictly smaller version, and the verdict on it (adopted or
  rejected, in the operator's words): **ADOPTED.** The operator's words: *"I adopt
  it, that's the right call."*

  > PatterStage ships as exactly two things: the operator console for one local
  > Hermes agent, and the EOS seed-pack generator. Nothing else integrates (no
  > MCP, no PatterStudio bridge, no API-accessed products) until one person who is
  > not the author has installed it from scratch and used it for a week.

  The cost was stated before adoption and is accepted: the thing the operator is
  most excited about, products plugging in, is explicitly not this venture's next
  move, and the module seam built in 2026-07 carries only Hermes and Rec Room
  until the gate is met.

## Scale and triggers

Ruled by WG-EOS-001 into the lock-book header. Triggers present at
Session 0: **server state** (SQLite, migrated forward by a versioned chain whose
current head is `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts`; this
line used to pin a version number and it rotted), **auth** (single-operator
bearer token in `src/proxy.ts`), **standing ops** (Docker image, `ps-deploy`
update path, backups), **web surface**, **written surfaces**, and a **years**
lifespan. Triggers absent, each ruled rather than assumed: no money, no personal
or regulated data, no second decision-holder, one surface rather than a
multi-surface estate. The rescale conditions to watch: money
arriving, personal data appearing, a second human joining, ops burden
growing. Each is carried here with what the operator said about it, because a
venture that lives will eventually trip one:

- **Money arriving.** The operator raised this himself: "later we may use a
  license/subscription based approach to use free/full versions". Money under this
  venture's name forces a re-rule that day, not a quiet continuation.
- **Personal or regulated data appearing.** Today the design is local-only, so the
  operator holds nothing on anyone's behalf. A hosted or multi-tenant surface
  changes this immediately.
- **A second human holding decisions.** Sole operator today.
- **Ops burden growing.** PatterTech hosts nothing today; the user deploys on
  their own machine.

## Venture facts

The same answers again, as the names `kernel/PREDICATES.md` gives them,
one per line. Prose above is for the operator; this block is what
`python -m tools.eos activate --brief` reads to work out which packs a
venture loads, so the walk is computed rather than matched by eye.

Only venture facts belong here: the ones `kernel/PREDICATES.md` settles
with an interview question number. A task fact like `edits_source` is
about a piece of work and is not knowable yet, so it is settled per task
from the record and the diff, not here.

Nothing is inferred. A fact goes in because an answer put it there, and
a fact nobody asked about is left out rather than guessed.

> **OPERATOR INPUT REQUIRED. This block is empty on purpose and the
> recompile did not fill it.** Session 0 ran against the v1 kernel, which had
> no predicate vocabulary, so no interview answer exists to copy in. The prose
> above states several facts this block would name, and inferring the block
> from that prose is exactly what the paragraph above forbids, so it was not
> done. What is wanted: one predicate name per line, no punctuation and no
> commentary, taken from the rows of `kernel/PREDICATES.md` whose "settled by"
> column holds an interview question number, which are the 67 venture facts.
> Each line goes in because the answer to that question was yes. Rows whose
> column reads `task`, `always`, `operator` or `pressure` do not belong here.
> Until the block is filled, `python -m tools.eos activate --brief` reads this
> venture as declaring no facts, which is the honest reading: no answers have
> been recorded, rather than all answers being no.

```facts
# Empty. Awaiting the operator's interview answers; see the note above.
# One predicate name per line, from kernel/PREDICATES.md.
```

## Material workstreams

The parts of this venture somebody has to sit down and build, one line
each, in the operator's words. Not a plan and not an estimate. Three to
eight lines is the usual shape. Genesis cuts its research packets and
work packages from this list, so a venture that cannot name its
workstreams is not ready for a blueprint.

> **OPERATOR INPUT REQUIRED. This section is empty on purpose and the
> recompile did not fill it.** The v2 template adds it and Session 0 never
> asked for it, so there are no operator words to carry. What is wanted: three
> to eight lines, one per part of PatterStage somebody has to sit down and
> build, in the operator's own words rather than the agent's. Not the task
> records under `org/tasks/`, which are the work already scoped, and not a
> plan or an estimate. Those records could be summarised into a list
> that looks like this section and would not be it: those are work, and this
> is the shape of the venture the work serves. Until it is filled, Genesis has
> nothing to cut a research packet or a work package from, which is the
> template's own stated consequence.

## Constraints

- Time: no external deadline. Self-imposed pull from the EOS going public.
- Money and spend rule: the operator's words: *"No spend without my approval,
  and ideally we will be local first with minimal dependencies."* No standing
  budget. Nothing is bought, subscribed to, or committed to without him.
- People and approvals: sole operator, holds every decision. 52 stars and 11
  public forks are a constraint on breaking changes, not a second
  decision-holder.
- Agreements in force (contracts, heads of terms): none. All PatterTech's own
  projects.

## Success in ninety days

The operator's words: *"the application being fully functional, being able to run
high level projects from start to finish, and incorporate a clean refined platform
of PatterTech products, either locally or via API access."*

Read against the adopted smaller version, the third clause is the deferred half.
The ninety-day test is therefore the first two: **fully functional, and able to run
a high-level project from start to finish**, plus the adoption's own gate: that
someone other than the author has installed it from scratch and used it for a week.

## Out of scope (explicit)

- **Other products' user interfaces.** ADR-0001: PatterStage hosts *work*, not
  *surfaces*. No iframes, no micro-frontends, no shared database. Every other
  product keeps its own front door and is one link away.
- **Integrations, for now.** No MCP client, no PatterStudio bridge, no
  API-accessed products until the adoption gate above is met.
- **Anything requiring an account or network to work.** Local-first is a
  constraint, not a preference; death 3 is the risk of losing it by accident.
- **Capability measurement.** ADR-0004, amended: the benchmark subsystem was
  deleted after measurement showed it had never been run and its content could not
  measure what the ADR needed. Agent progression ships on two of three inputs.
