---
summary: PatterStage Venture lock-book , the machine rulings header and the module contract sections
type: venture
tags: [eos]
supersedes: the v0.1 PROJECT_LOCKIN migration
eos_root: ../PatterTech_EOS
eos_version: v1.0
eos_commit: cc18755
scale: M
stack: none of the three registry profiles fits; see docs/EOS_FEEDBACK.md EOS-FB-004. PatterStage is a local-first Next.js application with an EMBEDDED database (better-sqlite3), no separate backend service and no hosting: the user runs it on their own machine. Pinned as `local-app (authored, pending a registry profile)`
addons: []
compiled: 2026-07-25
rulings:
  - WG-EOS-001 · M · argued · the scale ruling, triggers engaged at Session 0
compiled_from: kernel/templates/LOCKBOOK.tpl.md
---

# PatterStage lock-book

The venture's contract with the EOS. This file wins on specifics; EOS
doctrine wins on principles. The YAML header above is machine-read: the
seed check validates it, the harvest counts its rulings, upgrades diff
against its pins. Rulings rows are one line each,
`WG-ID · ruling · argued|inherited · note`; argued means the triggers
were engaged afresh, inherited means the default was taken without new
argument. Only argued rulings are promotion evidence.

## Identity

- One-word feel: instrument
- Signature motif (promoted everywhere): the lit console in a dark room: a dense operator surface where the only bright things are live state
- Signature animated pieces (the sanctioned exceptions, by name): set at first build, ruled by WG-WEB-011 (C, field-reactive) and WG-WEB-005 (C, full)
- Voice register ruling (WG-VOX-001): in the header; banned list per
  the voice module.

## Narrative brief

The one-paragraph story the design must tell without saying it: what
the visitor should feel, what stays concealed, what escapes anyway.
Name the physics or motifs the brand draws from and how each becomes a
mechanism, not a mood board. This paragraph drives the light budget
(WG-WEB-005), the reactivity ruling (WG-WEB-011) and the imagery ruling
(WG-WEB-012).

A single operator sits at a dark console and watches work they did not do themselves. The surface should feel like an instrument rather than a dashboard: dense, legible at arm's length, and honest about what is happening right now versus what merely finished. What stays concealed is the machinery, the framework, the ports, the seams; what escapes anyway is liveness, because a run in flight must look different from a run that ended. The physics the brand draws from is a field: brightness is not decoration but a readout of energy in the system, so an idle console is dim and a working one is not. That is what makes the light budget a mechanism rather than a mood.

## Tokens

Before a first build exists, design-system slots below take the
sanctioned deferral: `set at first build` plus where the value gets
ruled. The first-build lock-in session replaces every deferral in one
sitting and notes it in the worklog or queue.

- Token home: src/app/globals.css (@theme, Tailwind v4) · Code mirror: src/lib/theme.ts ·
  Styleguide route: set at first build; owed by WG-DEL-003, which rules pixel baselines against a styleguide surface that does not yet exist
- Surface ladder: set at first build. Currently 32 appearance-named primitives (dark-950 and siblings) with no semantic layer, which TOKENS.md forbids by name; the ladder is ruled when the vendored @pattertech/ui lands
- Accents: set at first build. Ruled by WG-WEB-009 (B): one registered module-to-accent map of four entries. Today five accents are applied decoratively and the map does not exist
- Text tiers and measured contrast: set at first build. Measured contrast is owed: the design-lint baseline records sub-12px type as the single largest debt category
- Measures: reading set at first build · wide set at first build · full
  set at first build · block gap set at first build

## QC gates (exact commands)

- Build: npm run lint && npx tsc --noEmit && npm test && npm run build
- Overflow at 375: set at first build; owed by WG-WEB-003, no 375px overflow check exists today
- Page weight: set at first build; owed by WG-WEB-008
- Screenshots: npm run screenshots (Playwright, PORT=3477, CAPTURE_SCREENSHOTS=1)
- Regression smokes: npx playwright test (PLAYWRIGHT_SMOKE unset). CI runs smoke-only today, which WG-DEL-002 rules against

## Structural contracts (things future edits must not break)

- Authentication is enforced ONCE, in src/proxy.ts, and never in a route handler (WG-DRAFT-001, ruled B; design-lint no-auth-in-route-handler makes it a red build). Core never imports a module; module capability is reached through one of three named composition points, src/lib/modules/server.ts, src/lib/frameworks/registry.ts and src/lib/runtime/ (ADR-0005; design-lint core-imports-no-module). AGENTS.md stays within 40 lines and CLAUDE.md is byte-identical (check-agent-files.mjs). The design-lint baseline shrinks and never grows. Every relative link in docs/ resolves (check-doc-links.mjs). Migration history is a record, not a description: historical migrations are never edited, and schema_version is a strictly increasing chain.

## Deviations from doctrine

None, or one entry each: the doctrine deviated from, the trigger that
justifies it, the wargame that argued it (a draft wargame in
docs/EOS_FEEDBACK.md if none exists), and the operator's approval.
Deviations are harvested as contrary rulings.
