---
summary: Defects PatterStage found in the EOS during Session 0, banked for the PB-E02 harvest
type: feedback
tags: [eos]
---

# EOS_FEEDBACK · PatterStage

Defects and gaps this venture found in the EOS itself. Banked here rather than
worked around, per INCEPTION.md. The harvest (PB-E02) decides what becomes
doctrine.

Each entry states what was hit, the evidence, and what it cost. None of these are
complaints about PatterStage's own code; those belong in the lock-book.

## EOS-FB-001 · The walk budget alarm is unreachable for any web venture with server state

**Hit at:** phase C, building the walk.

**What happened.** PatterStage's trigger set activates all six wargame modules, so
the walk is 31 phase-C rulings (33 including the two phase-B EOS rulings).
`WALK_ORDER.md` sets an alarm at twenty: *"A walk running past twenty rulings means
the trigger set is wrong (too broad) or the venture is bigger than its scale
ruling; stop and re-run WG-EOS-001 before continuing."*

Session 0 stopped and re-ran WG-EOS-001. **Neither diagnosis fits.**

- *Trigger set too broad?* No. PatterStage genuinely is a web app, genuinely has
  architecture decisions, CI, a deploy with server state, and written surfaces. No
  module can be dropped honestly.
- *Venture bigger than its scale ruling?* No. Every L trigger is silent: no money,
  no personal or regulated data, no second decision-holder, one surface.

**The arithmetic.** Three wargames always walk (WG-EOS-001, WG-EOS-002, WG-VOX-001).
Any web surface walks the whole web module: **17**. Any venture with server state
triggers the architecture module's eight: **25**, before delivery or devops are
counted. And server state is exactly what forces scale to at least M under
WG-EOS-001's own decision rule.

**Why the remedy makes it worse.** The alarm's only prescribed action is to re-rule
scale. Re-ruling can only move up, to L, which pulls in more modules and more
rulings. The remedy amplifies the fault it diagnoses.

**The document predicts this against itself.** `WALK_ORDER.md` states that a venture
with any web surface runs "twelve to eighteen" rulings at **S**, then that "M and L
add the modules their triggers pull in", with the alarm at twenty. An M web venture
is expected by the same paragraph to exceed the alarm.

**Draft fix, for the harvest to judge.** The budget is measured against the wrong
unit. A venture does not choose rulings, it triggers modules; the module is what
gets pulled in wholesale. Proposed replacement:

> Budget per module, not per venture. A module walked in one sitting is the unit.
> The alarm fires when a venture triggers more than four modules, which is the real
> signal that the trigger set or the scale is wrong. A venture triggering six
> modules walks them in six sittings, in canonical order, and the walk is complete
> when the last module is ruled.

This keeps the alarm's purpose (catching a venture that is bigger than it claims)
while removing the false positive that every M web venture is guaranteed to trip.
It also matches how the walk is actually runnable: canonical order is already
defined module by module.

**Cost to this venture:** Session 0 could not proceed without either ignoring a
stop condition or taking a scale ruling it had just argued against. The operator
ruled: proceed at 31, file the defect, draft the fix.

## EOS-FB-002 · `auth` is a recorded trigger that names no wargame

**Hit at:** phase C, after the walk, by the audit.

**What happened.** `auth` is one of the trigger tags `WALK_ORDER.md` names in its
own worked example (*"the domains and trigger tags the interview surfaced (for
example `web`, `auth`, `money`, `pii`, `motion`, `hosting`)"*), and WG-EOS-001's
decision rule treats auth as a scale-forcing trigger on equal footing with server
state.

But **no wargame in the corpus carries the `auth` tag.** Grepping
`doctrine/WARGAME_INDEX.md` for it returns nothing across all 33 rows.

So a trigger that can force a venture's scale from S to M pulls in zero rulings.
PatterStage has authentication as its single most security-critical subsystem (the
2026-07 review found the app had none at all, and the fix is now enforced in one
place, `src/proxy.ts`), and the walk had nothing to say about it.

**What this costs.** Session enforcement, credential storage at rest, the read-only
mode, CSRF posture and the fail-closed default were all decided in this repo with
no doctrine to argue against. They may be right; nothing checked.

**Draft fix, for the harvest to judge.** Either an auth wargame exists and the
index is stale, or the corpus has a hole where its own scale rule points. If the
latter, the first question is the one PatterStage had to answer alone: *where is
authentication enforced, and what proves a route cannot be added without it?*

## EOS-FB-003 · A walk cannot be audited later, because the trigger set is never recorded

**Hit at:** phase C, by the audit.

**What happened.** `WALK_ORDER.md` distinguishes `argued` from `inherited` and
states that *"any wargame a trigger names must be argued, not inherited"*, and that
inherited rulings never count as promotion evidence.

That rule is only checkable against the venture's trigger set. But no seed file
records the trigger set in the vocabulary the rule uses. `VENTURE_BRIEF.tpl.md` has
a `{{TRIGGERS}}` slot in prose; the lock-book records rulings, not triggers. So a
later reader cannot verify that an `inherited` ruling was legitimately inherited.

**Cost to this venture:** the audit found exactly one inherited ruling
(WG-WEB-014) and could only challenge it by re-deriving the trigger set by hand
from the wargame's tags. That re-derivation is what caught it: four separate
triggers name it, so it should have been argued.

**Draft fix.** The lock-book header gains a `triggers:` list in the same vocabulary
as the wargame index tags, written at phase B and immutable thereafter. `eos_check`
can then mechanically assert the rule the doctrine already states: no wargame whose
tags intersect the trigger set is marked inherited.
