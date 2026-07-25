---
summary: Venture brief for PatterStage, written at Session 0 from the operator's own words
type: brief
tags: [eos]
---

# PatterStage · Venture brief

Business truth, written at Session 0 from the interview and kept current by the
venture. Every fact here is the operator's; the agent transcribed and challenged,
never invented. If this file and reality disagree, fix this file.

## What it is

PatterStage is a local-first application a single operator installs on their own
machine to control one Hermes AI agent: configure it, commission work, gate the
work that needs judgement, and watch what ran. It also generates PatterTech EOS
seed packs, so a user can found a governed project from the same console. Nothing
else plugs in until someone other than its author has installed it from scratch
and used it for a week: integrating PatterTech's wider product layers is
deliberately deferred, not undecided.

- One line: the local console for one AI agent, and the place a governed project
  is founded.
- Who it serves: **both, equally** (the operator's word). A public open-source
  control plane for anyone running Hermes locally, AND PatterTech's own estate
  console. Neither audience is the junior partner.
- Why now: no external deadline and no agreement. The operator's words: "There are
  no agreements or deadlines, these are all MY/PatterTech's projects." The pull is
  the EOS going public in the coming weeks, which is self-imposed.

## The challenge record (anti-sycophancy, mandatory)

**Restated and corrected.** Two restatements were offered. The first was rejected
in effect rather than in words: adopting the strictly smaller version reshaped the
scope, so the restatement was re-cut and the narrower version confirmed verbatim.
The confirmed text is the "What it is" paragraph above.

**The three cheapest ways this dies.** Accepted as written. These are the cheapest,
not the most dramatic, and they are the risk register at birth:

1. **Nobody but you ever installs it.** The .exe never ships, clone-and-run is too
   high a bar. *Requires nothing at all to go wrong.*
2. **The integration layer eats the product.** Each product adds a seam; a sole
   dev's budget goes to connectors. *Requires only that you succeed.*
3. **Local-first quietly stops being true.** One feature needs an API, that API
   needs an account. *Requires one unnoticed decision.*

Adopting the smaller version re-ranked these: death 1 is now the sharpest, because
"someone other than the author installs it" became the gate on everything else.

**The strictly smaller version: ADOPTED.** The operator's words: *"I adopt it,
that's the right call."*

> PatterStage ships as exactly two things: the operator console for one local
> Hermes agent, and the EOS seed-pack generator. Nothing else integrates (no MCP,
> no PatterStudio bridge, no API-accessed products) until one person who is not
> the author has installed it from scratch and used it for a week.

The cost was stated before adoption and is accepted: the thing the operator is
most excited about, products plugging in, is explicitly not this venture's next
move, and the module seam built in 2026-07 carries only Hermes and Rec Room until
the gate is met.

## Scale and triggers

Ruled **M** by WG-EOS-001 into the lock-book header.

Triggers present at Session 0: **server state** (SQLite, schema v30), **auth**
(single-operator bearer token in `src/proxy.ts`), **standing ops** (Docker image,
`ps-deploy` update path, backups), **web surface**, **written surfaces**, and a
**years** lifespan.

Triggers absent, each ruled rather than assumed: no money, no personal or
regulated data, no second decision-holder, one surface rather than a multi-surface
estate.

**Rescale conditions to watch.** Lifespan does not force a scale by itself, but a
venture that lives will eventually trip one, so these are mandatory here:

- **Money arriving.** The operator raised this himself: "later we may use a
  license/subscription based approach to use free/full versions". Money under this
  venture's name trips L. That day forces a re-rule, not a quiet continuation.
- **Personal or regulated data appearing.** Today the design is local-only, so the
  operator holds nothing on anyone's behalf. A hosted or multi-tenant surface
  changes this immediately.
- **A second human holding decisions.** Sole operator today.
- **Ops burden growing.** PatterTech hosts nothing today; the user deploys on their
  own machine.

## Constraints

- **Time:** no external deadline. Self-imposed pull from the EOS going public.
- **Money and spend rule:** the operator's words: *"No spend without my approval,
  and ideally we will be local first with minimal dependencies."* No standing
  budget. Nothing is bought, subscribed to, or committed to without him.
- **People and approvals:** sole operator, holds every decision. 52 stars and 11
  public forks are a constraint on breaking changes, not a second decision-holder.
- **Agreements in force:** none. All PatterTech's own projects.

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

## Open questions

Recorded, not guessed. An unanswered question is a recorded question.

1. **How the product layers link together.** The operator's words: *"I am honestly
   really confused how I should link all of these together... I have a lot of
   different product layers and applications, and I really want to deploy/release
   them in the most effective way for myself (a sole dev with AI) to maintain
   them."* This is the venture's central open question and the reason death 2 is
   cheap. The adopted smaller version defers it deliberately: it is answered with
   evidence about what users reach for, not in advance. Tracked in
   `org/QUESTIONS.md`.
2. **The licence is contradictory in public.** `LICENSE`, `package.json`, `README`
   and `NOTICE` all say Apache-2.0; GitHub's repository metadata reports MIT. The
   two differ materially on patent grant and attribution, and 11 forks already
   exist under whichever a reader believed. Unresolved at Session 0.
3. **The GitHub repository description is stale.** It still leads with
   "benchmarking", which was deleted in 2026-07.
