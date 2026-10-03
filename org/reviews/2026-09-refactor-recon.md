---
summary: What two swarms of read-only agents measured that the 2026-09-11 review could not, which of its numbers moved, and which of its eleven "Not examined" lists are actually closed
type: review
tags: [review, recon, refactor, phase-1]
status: done
---

# PatterStage · Refactor reconnaissance (2026-09-13)

> Phase 1 of the refactor and clean-up programme, task T-0155. It follows the
> codebase review of 2026-09-11
> (`org/reviews/2026-09-codebase-review.md` and its evidence companion), which
> was read-only by rule and says so eleven times. Phase 2's plan reads this
> document, and **the operator approves that plan**, so a number here that is a
> guess becomes a target nobody can hit.
>
> Measured on `dev` at `8496ee9f`, after Phase 0 (K0 to K6, T-0146 to T-0154)
> closed with every CI job green on `a0983620`.

## The headline

**Phase 1 is not finished, and this document says which parts.** Two passes ran:
eleven dimensions, then seven more over what the first left open, each finding
put to a sceptic told to default to *refuted*, each pass closed by a
completeness critic. 232 findings survived a sceptic across the two.

The review's eleven "Not examined" lists hold **107 discrete items** — a number
neither the review nor this batch's own record ever stated. Adjudicated across
both passes, to the standard that a claim needs a re-runnable command or a
`file:line` or it is not closed:

| | Items |
|---|---:|
| Closed | 33 |
| Partially closed | 34 |
| Still open | 31 |
| Not worth closing | 9 |

**Ten of the thirty-one open items block Phase 2. Twenty-one do not.** The
blockers cluster in three places: unread product code sitting behind booked
estimates, the absent pixel oracle under six ruled component folds, and
test-side arithmetic that cannot be reproduced.

The first pass's critic reported 49/27/24/7. That count cannot be checked,
because until this document existed there was no artefact — the recon's output
lived in a workflow result in a temp directory. The 33/34/31/9 above is written
out item by item and can be argued with. That difference is the single best
argument for why this file exists.

## Four things that outrank the refactor

Each was found by the recon, and each was then re-measured by hand before being
written here. Each has a record; none is scheduled, because three of the four
need a ruling.

### A critical CVE, live on the branch installs track (T-0157)

`npm audit` on the installed tree: **15 vulnerabilities — 1 critical, 8 high, 4
moderate, 2 low.**

`next` is pinned at **16.2.9** (`package.json:69`), inside the affected range.
The fix is **16.3.5**, which npm reports as `isSemVerMajor: false`. The same bump
clears `postcss` (arbitrary file read via `sourceMappingURL`) and `sharp`
(libvips and libheif CVEs), both high, because both reach the tree through
`next`. Among the eleven advisories on `next`: **middleware/proxy bypass in App
Router** and **SSRF in Server Actions** — and `src/proxy.ts` is this
application's entire authentication and read-only boundary.

Nothing alerted, and the reason is measured:

```
gh api repos/Daniel-Parke/PatterStage --jq .security_and_analysis
  dependabot_security_updates      disabled
  secret_scanning                  disabled
  secret_scanning_push_protection  disabled
visibility                         public
gh api .../dependabot/alerts       403 "Dependabot alerts are disabled"
```

`install.sh:45` tracks `dev`. Q10 rules the dependency batch to land after Node
24 and rules that `eslint-config-next` lands with a `next` bump, so acting now
reorders a ruling: **the ordering is the operator's call.**

Adjacent, and unresolved: the gitleaks workflow has fired twice reporting
`leaks found: 1`, and the SARIF for both runs has expired, so what it found is
no longer readable.

### The in-app Help is broken on every guide (T-0156)

Measured on an isolated instance, authenticated through the token exchange:
`/help` renders at 200; `/help/running/deploy`, `/help/reference/api`,
`/help/contributing/testing` and `/help/running/troubleshooting` all answer
**500**. The server log names it exactly:

> Functions cannot be passed directly to Client Components … `render: function ChevronLeft`

A lucide icon crossing the RSC boundary at `src/app/help/[[...slug]]/page.tsx`.
The recon's sweep puts it at 74 of 75 guide URLs.

**No gate can see this**, because `tests/e2e/app-routes.ts` does not list
`/help`. The same error is present in passing e2e logs from 2026-09-12, where it
was read and set aside as pre-existing noise. It was pre-existing. It was not
noise.

### The session cookie has no Secure flag on the documented deployment (T-0158)

The review had *read* this and explicitly declined to assess it. Assessed:

```
plain http, no proxy header      nextUrl.protocol=http:   -> secure=false  correct
behind a TLS-terminating proxy   nextUrl.protocol=http:   -> secure=false  MISMATCH
behind a proxy, Forwarded hdr    nextUrl.protocol=http:   -> secure=false  MISMATCH
direct https                     nextUrl.protocol=https:  -> secure=true   correct
```

`src/proxy.ts:290` decides `secure` from `nextUrl.protocol`, which follows
neither `x-forwarded-proto` nor `Forwarded`. `docs/running/deploy.md:152` tells
operators to *"use a reverse proxy with automatic certificates"* — exactly the
shape that terminates TLS upstream. The cookie value is the **raw token**, not a
session id; `maxAge` is one year; and `git grep -nE 'cookies\.delete|maxAge: 0|signout|logout' -- src`
returns nothing, so revoking one browser means rotating the credential for every
Bearer client at once. `docs/SECURITY.md:66` calls that token "root on the host".

Not CSRF-exploitable: `httpOnly` is set, `sameSite` is lax, and the same-origin
check covers cookie-authenticated writes. The exposure is clear-text transit and
no revocation.

### The Hermes key file is world-readable

`scripts/bootstrap/setup.sh:120-129` creates `$HERMES_HOME/.env` at the default
umask and writes the gateway bearer key into it. Measured **0644** in the
shipped image. That file sits outside `PS_DATA_DIR`, so none of K4's chmod work
reaches it, and the key it holds dispatches agent runs — which have terminal
access. On a bare-metal install the mode follows the operator's login umask, so
the finding holds at the near-universal 022 and evaporates at 077. Nothing short
of asking settles that.

## Numbers that moved

The review's figures were taken at `ce4ac1fd`, before Phase 0. Ninety-six moved.
The ones a plan would trip over:

| What | Review said | Now | Why |
|---|---|---|---|
| `routesWithTryCatch` | 13 | **18** (25 sites) | K6 widened the measure; not one route changed |
| Raw controls seen by design-lint | 0 | **104 in 43 files** | K6 fixed the rule's lookahead; baselined |
| Documents the link gate checks | 75 | **91** | K6 widened it past `docs/` |
| `scripts/` measured by the census | unmeasured | **12,961 lines** | K6 added `scriptsLines` |
| `testLines` | 121,114 | **124,351** | four batches of oracles |
| Static import cycles in `src` | 1 | **2** (4 sites) | a real tool, not a regex |
| Unit suites | 684 | **691** | |
| e2e tests | ~276 (derived) | **296 declared / 274 runnable** | `playwright test --list` |
| Framing headers | none | `next.config.ts:82-83` | K5 landed critic-04 |
| Session-cookie design | "read, not assessed" | **a finding** | T-0158 |

Two of the review's own instruments were discredited in passing. Its
source-text suite classification (126/33/93) rests on a scratch script that is
not in the tree and cannot be reproduced; an independent detector at HEAD gives
137/44/93. And the `as unknown as` and cast censuses were counted at
`ce4ac1fd`, so every one of them needs re-deriving before it is planned against.

## What Phase 2 can and cannot set a target on

### The gate baseline, which now exists

Run on a clean tree at `8496ee9f` with nothing else on the machine, by exit code:

| Step | Exit | Duration |
|---|---:|---:|
| lint | 0 | 65.9s |
| tsc | 0 | 4.0s |
| jest | 0 | 57.3s |
| knip | 0 | 9.0s |
| canary | 0 | 0.7s |
| build | 0 | 26.8s |
| e2e | 0 | 109.5s |
| census | 0 | 48.5s |
| census:lines | 0 | 2.1s |

This matters more than it looks. A recon dimension reported a nine-step green
run as the baseline while the only gate artefact on disk recorded a **red
build** with three steps never reached. Both were true at different moments: the
red run was two agents building concurrently. The table above is a single clean
run and is the one to plan against.

### The census, which is the closing oracle's denominator

Committed at `scripts/tooling/line-census.baseline.json`, thirteen measures:

| Measure | Held |
|---|---:|
| srcLines | 100,983 |
| testLines | 124,351 |
| scriptsLines | 12,961 |
| srcRepeatedWindowLines | 1,000 |
| testRepeatedWindowLines | 4,345 |
| routesWithTryCatch | 18 |
| handRolledReadHooks | 0 |
| writeHooksWithoutMutation | 0 |
| repeatedTypeShapeFiles | 2 |
| oneImporterComponents | 103 |
| libRootFiles | 6 |
| commentEssays | 9 |
| suitesMockingDbInline | 14 |

The closing oracle reads this file, never a live count. Phase 2 sets its targets
against these thirteen and no others.

### The netted total, which is not safe to use

The review's headline was about **−12,800 lines**, stated as a ceiling. That
ceiling is void, and the recon could not replace it with a number worth
believing:

- Estimates double-count. The one cluster that was properly netted —
  `hooks-07 + hooks-08 + app-02 + components-17` — claims −445 between its four
  items and its union is about **−290**, because all four cut the same
  template-draft plumbing.
- Work is already spent. `app-06` booked −45 and T-0153 landed it. Anything K4,
  K5 or K6 did is not available to Phase 3.
- Several estimates flipped sign once measured. Gates that must be written,
  oracles, migrations and the e2e coverage that does not exist are plus numbers.
- The recon's own netted figure is internally contradictory: the K-block spend
  alone is stated six different ways in one dimension's output, moving the
  central total by roughly 780 lines.

**Phase 2 should set targets per measure against the census table above, and
should not carry a single headline line-count target.** That is a change from
the consolidation programme's shape and it is deliberate: a headline number
nobody can re-derive is what this recon spent two passes discovering it had.

## The trap in the operator actions

Two dimensions gave opposite advice on branch protection, and the more
actionable-sounding one would lock the repository.

Current state, measured:

```
gh api repos/Daniel-Parke/PatterStage/branches/main/protection
  required_status_checks.contexts  []          <- zero required checks
  required_status_checks.checks    []
  enforce_admins                   false
  required_pull_request_reviews    1
```

One dimension recommends populating the required-check set, `acceptance-gate`
included. The other established that **`acceptance-gate` is failing today** —
it depends on `e2e-full`, which fails one spec needing Hermes sessions that only
an equipped machine has (T-0150). Requiring a job that cannot pass, with
`enforce_admins` turned on, makes `main` unmergeable **including for the
operator**, whose current route through `required_pull_request_reviews: 1` on a
solo repository is precisely the admin bypass that `enforce_admins: false`
leaves open.

**The order is: fix T-0150 first, watch `acceptance-gate` go green once, then
require it.** Not the other way round.

A second release blocker sits behind the same door: merging PR #157 runs the
`Docs` workflow for the first time, and it deploys to the `github-pages`
environment, which is not configured on this repository.

## What is still open, and what it costs

Twenty-one of the thirty-one open items are things nobody has read. They cost
confidence in estimates and nothing else, and Phase 2 can proceed by marking
their batches "estimate unverified".

The ten that block are:

1. **`src/lib/missions`** — 30 files, 3,370 lines, the largest unread block of
   product code in the repository, with estimates booked against it.
2. **Visual equivalence** under six ruled component folds (components-02, -08,
   -11, -12, -21, -31). The operator ruled on "visually equivalent" claims read
   from class strings and never rendered. If a fold is not equivalent, the
   ruling rests on a false premise.
3. **The 239 unclassified catch blocks** — the largest unexamined defect class.
4. **The source-text suite classification**, which the register (tests-09b)
   requires before any move batch and whose original cannot be reproduced.
5–10. Test-side arithmetic that no surviving script can re-derive, and the
   register rulings whose stated reasons rest on numbers that have since moved.

That last one deserves its own line. **No dimension owned the decision
register.** At least seven recon findings collided with an operator ruling their
author had not read, and every collision was caught individually and by luck.
The register's 110 rulings were made on 2026-09-12 against numbers that four
batches have since changed, and the cross-check of which rulings now rest on a
false premise is itself one of the open items.

## Two defects in the recon, recorded rather than smoothed over

**The dimension summaries drifted from their own evidence.** In six verified
cases the summary sentence — the one that would have reached this document —
stated a checkable fact that the same dimension's own correction refuted: the
zod import count, an ADR line count, a suite population compared against a
different population, the K-block spend. The sceptics caught each one
individually. Nothing generated the corrected sentence back into the summary.
Every number in this document is either one I re-measured or one the critic
verified against the tree.

**The recon repeated the defect it criticised.** It faulted the review for
measurement scripts that lived only in a scratchpad, and then produced several
of its own figures the same way. Where a number here cannot be re-derived from
a committed command, it is marked as such or it is not stated.

## Method

Two workflows, 293 agents, read-only. Eleven dimensions then seven, disjoint by
subject; a sceptic per finding told that its default answer is *refuted* and
that "looks right" is a refutation; a completeness critic per pass whose only
job was to adjudicate the eleven lists item by item.

Heavy commands were owned exclusively by one dimension each — one owned
`next build` and docker, one owned jest, playwright and knip, one owned
`npm audit`, one owned `gh` read-only — and the two passes were separated by a
barrier so seven readers were not competing with a build. That was not enough:
the concurrent build collision above is what a shared machine does anyway, and
the gate table in this document was taken afterwards, alone.

Nothing was installed. `gitleaks` is still not run. No config was widened to
make a tool report more: knip's widened scope was measured through a scratch
config outside the repository, and `knip.json` is untouched.
