---
summary: The UI/UX review and the value work, plus the governance rulings the operator gave in session
type: venture
tags: [eos]
compiled_from: authored
id: S-0004
role: EXECUTOR
date: 2026-08-24
model: claude-opus-5 orchestrating claude-opus-5 subagents
launcher: the operator, asking for a visual review of every screen and every remaining task
items_touched: [T-0021, T-0024, T-0028, T-0029, T-0030]
spend_estimate: ~4M tokens across roughly 15 subagents
---

## What happened

The operator ruled on the outstanding governance first: ADR-0009 accepted, the
four WG-SEC rulings ruled (002, 003 and 004 as drafted, 001 re-ruled and
softened so it says plainly that two of the three legs together is ordinary and
permitted), and the compile-report rubric signed H1 to H5 with what each was
signed against. He also widened the mandate: nothing is sacred if a change can
be proved better.

The visual review found a serious defect before it found anything cosmetic.
`npm run dev` was completely dead: every page painted its server markup, sat on
a spinner and issued zero API calls, with nothing in the browser console to say
why. Next 16 treats 127.0.0.1 and localhost as different origins and blocks
cross-origin dev resources, which kills the HMR socket, and in Next 16 that
takes hydration with it. The app's own auth banner prints the 127.0.0.1 URL, so
the product handed the user the one address that breaks it. Production was
always fine, which is why the e2e suite never caught it. My first diagnosis
blamed the auth proxy and I changed proxy.ts before testing it; that was wrong,
made no difference, and was reverted.

Then the readability work, measured on the running app rather than argued:
2,316 sub-12px text elements and 2,377 WCAG AA failures, both driven to zero.
The four text tiers are derived, not chosen, because white/45 is exactly the AA
floor on this background, and a contrast gate re-derives them on every lint.
neon-purple was the one accent whose token had to change: it failed AA as text
even at full opacity, so no opacity rule could have rescued it.

Four parallel agents then took performance, half-built features, onboarding and
observability, and three more took the bloom field, the token lock-in and spend
visibility. Every batch was reviewed by an agent that wrote none of it.

## Decisions taken (within my authority)

The tier ladder values and the codemod's icon exemption. Filing discovered work
as tasks rather than fixing it inline. Respecting the branch protection that
refused a force-push to fix a commit message, and resetting rather than working
around it.

## What review caught, which is the part worth keeping

Two rejects, both real. The token lock-in broke `npm run build`: a glob written
inside a CSS comment closed the comment, and because globals.css is the only
stylesheet the layout imports, nothing in it shipped. Every other gate stayed
green over it, including that task's own test, which read the CSS as text. A
test that reads its subject as a string cannot tell you the subject is valid.
The spend work failed lint:knip, a CI gate its author had not run.

Review also caught a security regression in work I had approved: the new 401
page returned the resolved absolute token path to unauthenticated callers,
which under start:network hands a stranger the OS username and install layout.
It is now loopback-only, and the decision is recorded in docs/SECURITY.md
rather than left decided by a test.

Chasing the bloom field's own acceptance turned up the largest finding of the
session. All six RGB mirror tokens held comma lists while every consumer wrote
the slash-alpha form, which is invalid CSS, so eighteen paint rules rendered
nothing: every text-glow, every glow box-shadow, scanlines, grid-bg and
GlowSurface. The lock-book's motif is that the only bright things are live
state, so the entire liveness signal was invisible and a running session looked
exactly like a finished one. Six declarations fixed it, verified in a real
browser rather than by reasoning.

## Filed

T-0030 (Deep Research records no token usage, so its spend cannot be computed
from what exists; reported as unrecorded rather than as a confident zero).
T-0021 rewritten against the operator's warn-by-default ruling before being
built, as its own record required.

## Handoff

PR https://github.com/Daniel-Parke/PatterStage/pull/157 is green on 22 checks
and is the operator's to merge. Three tasks stay open: T-0003 and T-0004 are
his own halves, and T-0030 is honest discovered work.

Still his alone: merge the PR, add acceptance-gate to branch protection (which
still requires zero checks, so every gate reports and none blocks), pause
Dependabot, and dispose of the Cursor worktree, whose uncommitted UI
experiments are preserved to a patch file rather than deleted.
