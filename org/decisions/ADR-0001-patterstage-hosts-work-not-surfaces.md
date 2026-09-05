---
summary: PatterStage is the estate's operator console; it hosts other products' work, never their user interfaces
type: decision
tags: [arch, product]
status: accepted
compiled_from: preserved
---

# ADR-0001 · PatterStage hosts work, not surfaces

**Status:** accepted by Daniel, 2026-07-25.
**Date:** 2026-07-25.

## Context

The owner's direction is that "PatterStage will be the main orchestration UI for
our PatterTech ecosystem, and the MVP/V1 we have now is meant to support the
addition of our other products (e.g. PatterStudio, PatterTech_EOS)".

Read as *PatterStage renders other products' UIs*, that is forbidden by an
accepted, owner-signed decision in the estate:

> `PatterStudio/docs/adr/0014-patterstudio-three-surfaces-no-hub.md` deleted the
> hub concept. Its four stated reasons: the hub was ~15% of the app, it duplicated
> navigation one level up, it "framed everything we shipped as the beginning of a
> platform rather than a product", and it "pulled design effort toward an operator
> console nobody asked for".

The adopted platform vision states three separate times that no product sits above
the others as a hub, and the one sanctioned shell surface belongs to PatterOS and
is explicitly deferred ("fabric now, consumer OS later", `adr/0012`).

Relocating the hub into PatterStage does not evade ADR 0014. It moves it into the
one repo that has users.

## Decision

**PatterStage hosts WORK, not SURFACES.**

- Other products register **work** with PatterStage: job kinds, MCP tools,
  cadences, schedules.
- PatterStage never renders another product's UI. No iframes, no micro-frontends,
  no shared database, no cross-repo code imports.
- Every product surface PatterStage references is an external **link**.
- PatterStage owns the verbs — **found, commission, gate, watch** — over the
  estate's nouns: Organisation → Venture → Project.

The EOS surface is not an exception to this rule. Governing engineering work is
PatterStage's own domain, not another product's interface wearing its chrome.

## Answering ADR 0014's four objections

| 0014's objection | Why it does not apply here |
|---|---|
| The hub was ~15% of the app | Work-hosting *is* the app, not a section of it. The console has no second navigation layer to duplicate. |
| It duplicated navigation one level up | There is no navigation to duplicate: a product appears as a row with liveness and an outbound link, never as a nested tree of its pages. |
| It framed a product as the start of a platform | PatterStage already is orchestration infrastructure — it owns the scheduler and the run engine. This ADR narrows its remit rather than widening it. |
| It pulled design effort toward an operator console nobody asked for | An operator console is precisely what PatterStage is for, and the estate manifest already assigns it that role. 0014 rejected a console inside a *document factory*. |

## Consequences

- The estate manifest (`PatterTech_EOS/estate/repos.yaml`) needs PatterStage's
  `owns` list widened from the agent control plane to the estate operator console.
- Integration planes are fixed by this decision: MCP for capability, typed HTTP for
  state, git-as-data for the EOS. Anything else needs a new ADR.
- Surfaces that are not orchestration lose their claim on the roadmap.
- A second product must be addable without editing a hardcoded navigation array,
  which today it cannot be. That is the work this ADR authorises.

## Alternatives rejected

- **Iframe / micro-frontend host.** Two design systems, two motion budgets and two
  accessibility postures in one viewport; PatterStage has no user model, and
  PatterStudio's byte-stable render is explicitly required to stay out of a shell
  webview.
- **Stay a Hermes-only control plane.** Honest and shippable, and the correct
  answer if the estate role is abandoned. It caps the product at "admin panel for
  one agent runtime" — which the estate manifest already refuses to say.
