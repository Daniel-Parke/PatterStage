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

**Draft fix, for the harvest to judge.** The corpus has a hole where its own scale
rule points. `WALK_ORDER.md` prescribes the remedy for a fork with no wargame: file
a draft using the wargame template, with the venture's ruling as its first worked
entry. That draft is below as **WG-DRAFT-001**, and PatterStage records it in the
lock-book under that id until the harvest assigns a real module number.

---

### WG-DRAFT-001: Where is authentication enforced, and what proves a route cannot be added without it?

> Drafted by PatterStage at Session 0 because the `auth` trigger names no wargame.
> Module: probably architecture (it is a structural question, not a devops one).
> Tags: `arch auth security`.

**The question.** A venture with auth has to decide not whether to authenticate
but *where the decision lives*. The choice is invisible while the surface is small
and becomes irreversible once it is not: every route added after the pattern is set
inherits it silently, including the ones added by an agent at 2am.

**It depends on**

- Whether routes are added by hand, by an agent, or by a generator.
- Whether the framework offers a single interception point that cannot be bypassed.
- Whether a route with no explicit check is safe (deny by default) or exposed
  (allow by default).
- Whether the venture can afford a test per route, or needs a structural guarantee.

**Options**

- **A. Per-route checks.** Each handler calls a guard. Honest and local; a reader
  sees the check where the work happens. Fails open: a route with no call is a
  public route, and nothing distinguishes "deliberately public" from "forgotten".
- **B. One interception point.** A single middleware, proxy or filter authenticates
  every request before dispatch, with an explicit allowlist for the public few.
  Fails closed. Costs one choke point that must not be bypassable, and a reader of
  a handler cannot see that it is protected.
- **C. Typed route constructor.** Routes cannot be declared except through a
  factory that takes an auth policy as a required argument, so an unprotected route
  is a compile error. Strongest guarantee; costs a framework-shaped abstraction and
  fights any router that discovers routes from the filesystem.

**Decision rule.** Any venture whose routes are added by agents, or whose framework
discovers routes from the filesystem: **B**, with the public allowlist named in one
place and a lint rule forbidding auth logic inside handlers. A venture with a small
fixed route set added only by hand may take A if every route has a test asserting
its status when unauthenticated. Take C only where the router is already
constructor-based; do not reshape a filesystem router to reach it. Never mix A and
B: a per-route check inside a B system teaches readers that routes without one are
unprotected by choice, which is how the forgotten route becomes invisible.

**Default.** B.

**Worked ruling: PatterStage (2026-07, argued).** **B.** Next.js discovers routes
from the filesystem and agents add them, so the rule's first clause fires twice
over. Enforced in `src/proxy.ts` (Next 16 renamed `middleware` to `proxy`), which
authenticates every request, fails closed when no token is configured, checks
same-origin on cookie writes, and enforces read-only by HTTP method.
`/api/health` is the sole allowlisted path.

The prohibition is real rather than aspirational: `design-lint`'s
`no-auth-in-route-handler` rule fails the build on `readAuthToken`, `tokenMatches`
or `ps_session` appearing anywhere under `src/app/api/`, and `CLAUDE.md` carries
the matching standing instruction.

This venture is the reason the wargame is worth writing. Before 2026-07 PatterStage
was A in form and nothing in substance: `requireAuth()` was a misnamed read-only
flag check, 114 call sites believed they were authenticated, and the result was an
unauthenticated remote-code-execution chain reachable from the LAN (fixed in
`7004f2c`). The failure mode was not a missing check in one route; it was that **A
gives you no way to tell the difference between a route that is deliberately public
and one where somebody forgot.**

## EOS-FB-003 · A walk cannot be audited later, because the trigger set is never recorded

**Hit at:** phase C, by the audit.

**What happened.** `WALK_ORDER.md` distinguishes `argued` from `inherited` and
states that *"any wargame a trigger names must be argued, not inherited"*, and that
inherited rulings never count as promotion evidence.

That rule is only checkable against the venture's trigger set. But no seed file
records the trigger set in the vocabulary the rule uses. `VENTURE_BRIEF.tpl.md` has
a triggers slot (double-brace TRIGGERS) in prose; the lock-book records rulings, not triggers. So a
later reader cannot verify that an `inherited` ruling was legitimately inherited.

**Cost to this venture:** the audit found exactly one inherited ruling
(WG-WEB-014) and could only challenge it by re-deriving the trigger set by hand
from the wargame's tags. That re-derivation is what caught it: four separate
triggers name it, so it should have been argued.

**Draft fix.** The lock-book header gains a `triggers:` list in the same vocabulary
as the wargame index tags, written at phase B and immutable thereafter. `eos_check`
can then mechanically assert the rule the doctrine already states: no wargame whose
tags intersect the trigger set is marked inherited.

## Corrections to this file's own walk (second corrective pass)

Recorded rather than silently fixed, because a feedback file that quietly repairs
itself is no more checkable than the walk it is criticising.

**The 20-ruling stop condition was crossed by eleven, and the walk continued.**
`WALK_ORDER.md` says stop and re-run WG-EOS-001. Session 0 did re-run it, found
neither diagnosis applied (EOS-FB-001), and the operator ruled: proceed and file
the defect. That is a **deliberate deviation from a stop condition**, not an
oversight, and it belongs in the lock-book's deviations section as well as here.

**Three factual errors in the first corrective pass, found by its own verifier and
confirmed by measurement.** None moved a ruling; all three degraded checkability,
which is the property the whole exercise depends on:

- WG-WEB-014 claimed `docs/images/insights.png` is "126 KB, the largest of the
  seven". Measured: it is 87,869 bytes and fifth by size. The 126 KB file is
  `skills-manager.png`, which **is** cited (`docs/USER_WALKTHROUGH_GUIDE.md:381`).
  The load-bearing claim survives unchanged: `insights.png` is referenced by no
  document, only by the generator that produces it.
- WG-ARCH-005 claimed `generate:schema-json` "appears in exactly two places in the
  whole tree". It appears in six. The substantive claim survives: none of the six
  is a CI step or a test, so the committed JSON schemas can lag their Zod source
  silently.
- Reference slips: 49 `CREATE TABLE` statements, not 45; `install.ps1` is 22 lines
  at the repository root, not 23 under `scripts/bootstrap/`; the registry entry is
  titled `Hermes` (`Operations` is a nav-group label); `docs/images/` totals 688 KB.

**One contradiction the pass introduced and this one closes.** The reconciliation
ruled WG-WEB-011 to C, which decides the bloom tier, but WG-WEB-005 was left
carrying an open fork offering three options of which that ruling had already
killed two. WG-WEB-005 is amended to full C and its fork withdrawn: a fork whose
options have been eliminated by a prerequisite ruling is not a decision the
operator should be asked to make.

## EOS-FB-004 · No stack profile covers a local-first app with an embedded database

**Hit at:** phase D preparation, filling the lock-book's `stack:` pin.

**What happened.** `registry/stacks/` offers exactly three profiles, and PatterStage
matches none of them:

| profile | what it is | why it does not fit |
|---|---|---|
| 01 `web-static` | Next.js static export, for marketing and editorial sites | PatterStage has server state, auth, and 100 API routes |
| 02 `fastapi-postgres` | FastAPI on Postgres, for APIs and services | no Python, no Postgres, no separate service |
| 03 `fullstack-app` | Next.js front on a FastAPI back, one typed seam, Postgres underneath | the front half fits; there is no back half, and the database is embedded |

PatterStage is a Next.js application with an **embedded** database
(better-sqlite3, a file under the user's data directory), **no separate backend
service**, and **no hosting** at all: the user runs it on their own machine.

**Why this is a gap and not a mis-fit.** Every existing profile assumes a deployed
service with a network boundary between a front end and a data store. The whole
class of local-first, single-binary-ish applications is unrepresented, and that
class is not exotic: it is what a desktop tool, a CLI with a web UI, or any
sovereignty-first product looks like.

The pins a stack profile is supposed to supply (the contract seam, the gate set,
the deploy shape) either do not apply or invert. There is no seam between front and
back because there is no back. The deploy target is the user's machine, so the
"hosting" pin is the install path instead. The gate set is closer to profile 03's
than to 01's, but its Postgres and Alembic rows are dead.

**Cost to this venture.** The `stack:` pin in the lock-book header cannot be filled
honestly from the registry. Session 0 either names a profile that is wrong in its
load-bearing half, or leaves the pin unfilled and fails the seed check.

**Draft fix, for the harvest.** A fourth profile, `STACK-local-app`: a Next.js (or
equivalent) application with an embedded database, distributed as a repository plus
an install script or a packaged binary, deployed by the user rather than to a
server. Its distinguishing pins are the install path, the migration story for a
database the maintainer never sees, and backup and restore as a **user** duty
rather than an ops duty.

This matters beyond PatterStage. The operator's stated reason for wanting a
seed-pack generator was that *"our users will have many more projects and use cases
than ourselves which may not be covered in our PatterTech_EOS yet"*. This is the
first concrete instance of exactly that, found by the estate's own second venture
rather than by a stranger.

## EOS-FB-005 · The seed check walks the whole repository, including node_modules

**Hit at:** phase E, the first `eos_check.py --seed` run.

**What happened.** `python tools/eos_check.py --seed <venture>` reported **1137
errors**. Filtering out `node_modules/` leaves **64**. So **94% of the output was
about vendored dependencies** the venture did not write and cannot fix.

```
1137 errors total
1073 in node_modules/       (94%)
  63 E002 no front-matter   (mostly the app's own pre-existing docs)
   1 E008 unfilled slot     (a real finding, and ours)
```

**Two separate defects, and the second is the interesting one.**

**1. It walks `node_modules/`.** Mechanical, and cheap to fix: the walker needs the
same skip list every other tool in this repo already has. Until then the check's
output is unusable on any venture with a JavaScript dependency tree, which is every
web venture the EOS is meant to serve.

**2. It does not distinguish a SEED file from a REPO file.** This one is a design
question, not a bug. `E002` fired on 63 markdown files: the app's own documentation
(`docs/API.md`, `docs/TESTING.md`, `docs/DEPLOY.md`), its branding assets, its
`README.md`, its `TRADEMARK.md`, and the seed-pack content under `data/seed/` which
is *deliberately* front-matter-free because it is copied verbatim into an agent's
own directory.

`--seed` is documented as checking a *compiled seed*. `SCALE_MATRIX.md` states
exactly which 18 files that is at scale M. But the check tests every `.md` in the
tree, so a venture is penalised for having documentation that predates its Session 0
and for shipping template content that must not carry front-matter.

**What it costs.** The one genuine finding in 1137 lines was a slot-syntax
violation of ours in this very file, and it took a filtered grep to see it. A gate
whose signal-to-noise is 1:1136 does not get run twice.

**Draft fix.** `--seed` should check the matrix's file list and nothing else,
deriving it from `SCALE_MATRIX.md` the way a compiler does, plus the add-on files
the lock-book's `addons:` names. A separate `--repo` mode already exists for
whole-tree conventions; that is where a front-matter sweep belongs, with a skip
list and an opt-out for directories that ship verbatim content.

**Credit where due:** the one real error it found was real. `COMPILE.md` says a
compiled file must contain no slot syntax "anywhere, including inside code spans",
and this file had quoted a template slot as prose. The rule is right and the check
caught it.
