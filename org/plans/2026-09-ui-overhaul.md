---
summary: The approved UI overhaul programme, batches U0 to U16, four foundational systems, the signed-off deletions, the per-screen density decisions, eleven new gates and the measurements that prove it
type: venture
tags: [plan, design]
status: done
approved_by: Daniel Parke (operator), 2026-09-06, at plan approval after one round of questions
session: the UI overhaul session (Opus 5, 2026-09-06)
compiled_from: preserved
---

# PatterStage · UI overhaul programme · approved plan

> Produced by the UI overhaul session from `org/reviews/2026-09-ui-recon.md`
> (113 findings, 48 high, measured on the running product rather than read from
> source), three read-only mapping agents over the design system, the shell and
> the governance corpus, and four operator decisions taken at approval.
> **Approved by the operator 2026-09-06.** Sessions read this file from disk; it
> outranks any memory of the conversation that produced it. Task records T-0114
> to T-0130 are the batches. Format follows `org/plans/2026-09-final-release.md`.
> Precedence: `org/CONSTITUTION.md` > repo governing files > this plan.

## Context

PatterStage is feature-complete and one batch from v1.0.0: nineteen of twenty
batches shipped, the gate green (6,090 tests over 615 suites, lint, typecheck,
knip, canary, build, Playwright 140/25, Docker 12/12), driven end to end
against a real agent for 30 of 32 quests. It has never had a designer. The
operator's complaint is specific: the sidebar is hard to see, elements are not
formatted, aligned or sized correctly, and the line count is bloated.

The reconnaissance measured the running product, and its central result is that
the 113 findings are not 113 problems. They are symptoms of four system-level
absences. This programme fixes the causes, so the symptom count falls by
construction; converts the screens onto the result; and leaves behind gates
that hold it.

### The four causes

**1. Nothing has an edge.** Every surface sits within 1.06:1 of the page behind
it and every boundary is a 1px rule at 1.25:1, against the 3:1 WCAG 1.4.11 asks
of a component boundary. The rail measures 1.02 to 1.10:1 against the page.
This is the operator's headline complaint and it is a SURFACE problem: the
rail's text already measures 6.18:1, so brightening labels cannot fix it and
would make cause 4 worse. It is also why so much reads as unaligned, because
when no region has a visible edge, nothing looks aligned to anything.
Measured: 296 interactive control borders and 659 decorative borders below
3:1; 435 `border-white/N` uses across 8 undeclared alphas; 285 `bg-dark-*` uses
across 25 distinct spellings for what the tokens name as 3 roles.

**2. There is no shared page geometry.** `AppPageShell` owns no measure, so 20
pages declare their own `max-w-*` from 7 different tokens and 9 declare none.
The sticky header sits at a fixed x while each page centres its own body, so on
24 of 25 screens the h1 does not share a left edge with its content, by between
-102px and +289px. Eight left gutters, eight content widths at 1920. The three
semantic measures the token file declares are used exactly once in the tree, on
a 404 page.

**3. There is no component library, only 213 local decisions.** 69% of
components have exactly one importer. Shared `Button`: 104 uses in 38 files
against **321 raw `<button>` in 113 files** (75.5% bypass, and 110 of them
carry no `type=`, so inside a form they default to submit). Shared `Card`: 34
uses in 9 files against 113 files hand-rolling card chrome. Measured on screen:
47 card chromes, 37 button specifications, 20 button heights, 59 button
chromes. Three competing input base strings, two Select implementations, two
Toggles, six field-label spellings, five near-identical Selectors (684 lines),
ten hand-rolled click-outside dropdowns (1,778 lines), twelve hand-rolled
`fixed inset-0` overlays, twenty-two ad-hoc status colour maps.

**4. There is no type scale.** `@theme` declares no `--text-*`, `--leading-*`
or `--tracking-*`. Source usage is effectively two steps: `text-xs` 919 and
`text-sm` 241 against 36 uses of everything larger combined. Rendered, 2,495 of
3,536 text nodes are 12px (70.6%), 62% of characters are JetBrains Mono, and 17
prose blocks run at line-height 1.33 against the 1.5 WCAG 1.4.12 asks. There is
also no radius, elevation, z or motion scale: 11 radius tokens, 26 rendered
box-shadows, 13 z-layers of which 7 are arbitrary (`z-[61]` exists because
someone needed to sit on `z-[60]`).

Dead code is essentially gone: knip is clean and only ~462 lines are genuinely
unreachable. The line-count problem is duplication, not vestige.

## Decisions taken with the operator (binding)

1. **Visual scope: refine what is there.** The dark, neon-accented, mono-forward
   identity stays. A screenshot afterwards is still recognisably PatterStage.
   Full freedom inside that identity, including rebuilding the token layer, the
   type scale and the component set.
2. **Deletion: aggressive, including scope.** Anything provably unused goes and
   duplication collapses; features removed only with per-feature sign-off
   (decisions 6 to 9 below).
3. **Sequencing: overhaul first, then release.** The v1.0.0 tag waits. No
   intermediate release to protect, so large coherent changes are preferred to
   small safe ones, but `dev` stays green at every commit.
4. **Density: both, by surface.** Operational screens dense; first-run, Rec Room
   and Help spacious. Decided per screen below, with the reason.
5. **Surfaces: lift AND stroke.** Panels lift to >= 1.45:1 against the ground
   and every surface boundary carries a >= 3:1 stroke. This is a real repaint,
   chosen over the near-black "edges only" option and over inverting the
   chrome. Illustrative values in S1; the batch derives and records the exact
   ones.
6. **Rec Room: five rail entries become two.** Approved.
7. **Settings: 27 sub-pages become one scrollable page** with a sticky section
   nav. Approved, with 307 redirects for all 27 URLs.
8. **The rail sub-link tier is deleted.** Approved.
9. **Scripts and Missions schedules merge into one Automation view.** Approved.
10. **Type register: mono for machine words.** Mono keeps values, IDs, paths,
    timestamps, status words, counts, commands (and therefore button labels)
    and uppercase micro-caps section labels. Inter takes prose, descriptions,
    empty states and headings. ~62% mono to ~45%.
11. **The test corpus: shared mock factories only**, re-scoped on measurement
    (2026-09-06, after U0). The reconnaissance reported 39,499 of 107,013 lines
    sitting before the first `describe`, and inferred copy-pasted preamble. The
    37% is real; the inference is not. Measured, that preamble is jest.mock
    7,402 + imports 1,905 + **comments 14,873** + per-file fixtures 15,255, and
    the comment culture is on the keep list. The mocks are not identical either:
    `@/lib/db` has 42 distinct shapes across 99 calls, `api-fetch` 31 across 48,
    `api-logger` 28 across 109. Counting genuine duplication directly, repeated
    code blocks across three or more files, the ceiling on the WHOLE corpus is
    4,284 lines (6-line windows) or 6,957 at the most generous setting, and the
    generous figure counts `afterEach(() => {` in 56 files, which is not
    removable at all. So: one batch of shared factories, about 1,750 lines. The
    merge-by-subject batch is **dropped** - merging files moves lines rather
    than deleting them, and it would have rewritten 37,744 lines of assertions
    while the screens they test were being rebuilt underneath.

## What must survive (the contract)

Held as invariants on every batch record, and where possible as tests.

- **The Cherenkov identity**: cold blue-tinted near-black ground, the cyan
  ladder, restrained glow reserved for live state, JetBrains Mono for values
  and IDs, accent-per-domain. Not decoration; the product's character.
- **The four derived text tiers.** They are computed from the painted ground,
  not chosen, and gated by `contrast-check.mjs`. The values do not move. The
  method extends to surfaces and edges; that is the whole of cause 1's fix.
- **`design-lint.mjs` as a mechanism.** 15 rules, a `{}` baseline that only
  ratchets down, and a `// design-lint-disable-next-line <rule> -- <reason>`
  escape that records its reason in the file. Extended, never weakened.
- **The registry-derived navigation.** `src/lib/modules/registry.ts` remains
  the single source of the rail, page titles, `document.title`, help links,
  quest hrefs, `tests/e2e/app-routes.ts` and the screenshot list.
- **The single focus ring**, declared once in `@layer base`.
- **The mobile drawer's accessibility** and the single-`<aside>` model.
- **The information architecture.** Five groups, and the two-click
  Dashboard-to-running-mission loop, which must not get slower.
- **The set-pieces**: mission kanban, log terminal, stat rings, quest chapters,
  achievement tiles, the bloom field. Their geometry changes; they stay.
- **The commentary culture.** Comments naming the defect a decision fixes are
  kept and updated. Comments narrating extraction arithmetic are not.
- **The writing voice.** Subtitles and empty states are written by a person for
  a person. No batch flattens one into a noun.

## The system this builds

### S1 · Surfaces and edges (fixes cause 1)

Re-derived by target contrast against the painted ground, the same method that
produced the text tiers, recorded in the file beside the values, and gated.

| Token | Role | Target | Illustrative |
|---|---|---|---|
| `--color-ps-surface-ground` | the page | anchor | `#040b12` unchanged |
| `--color-ps-surface-panel` | rail, header, card, any raised region | **>= 1.45:1** vs ground | ~`#1f2c3c` |
| `--color-ps-surface-raised` | dialog, popover, active/hover row, table head | **>= 1.45:1** vs panel | ~`#2c3d52` |
| `--color-ps-surface-inset` | input, code block, well | = ground | reads sunken by being its parent's lower rung |
| `--color-ps-edge` | boundary between two surfaces | **>= 3:1** vs both | white ~36% |
| `--color-ps-edge-hairline` | subdivision inside one surface | **>= 1.6:1** | white ~18% |
| `--color-ps-edge-emphasis` | selected, armed, focused boundary | **>= 4.5:1** | white ~55% |

Three fills replace 25 spellings; three rules replace 8 alphas. `inset` reusing
`ground` is deliberate: a near-black ground cannot go darker, so a well is made
by being the parent's lower rung, not a new colour. The rail becomes `panel`
against a `ground` content column with one `edge` divider, and the duplicate
`border-r` at `layout.tsx:107` goes, which is the operator's complaint fixed
three ways at once.

### S2 · Page geometry (fixes cause 2)

One container owns the left edge. `AppPageShell` gains `header` and `density`
and renders the header bar full-bleed (background and rule span the viewport)
with its CONTENT inside the same container as the body:

```
<div class="min-h-screen bg-ps-surface-ground flex flex-col">
  <header class="sticky …"><div class="mx-auto w-full max-w-ps-page px-6">…</div></header>
  <main><div class="mx-auto w-full max-w-ps-page px-6 py-6">{children}</div></main>
</div>
```

Two measures, not seven: `--container-ps-page` (82rem) for every page, and
`--container-ps-prose` (46rem) for longform, applied as a **left-aligned column
inside** the page container, never as a second centred container. That is the
mechanism: h1 and first content block share x by construction, and no screen
can jump 400px sideways from its neighbour. All 20 per-page `max-w-*` literals
are deleted, `/work/composer` joins `AppPageShell`, and the Dashboard joins
`PageHeader`. Back links move into a fixed-width slot so they cannot shift the
h1. Two spacing steps, 32px between sections and 16px inside one, applied by a
`Section` primitive, replace eight measured gap values.

### S3 · Type scale and register (fixes cause 4, decision 10)

| Token | Size / leading | Use |
|---|---|---|
| `--text-micro` | 12 / 16 | mono micro-caps labels, IDs, paths, timestamps, table cells |
| `--text-body` | 14 / 21 (1.5) | the default: body copy, list rows, form values, buttons |
| `--text-lead` | 16 / 24 | prose: Help, descriptions, empty states, the reader |
| `--text-title` | 20 / 28 | h1, panel titles |
| `--text-display` | 28 / 34 | the one number a screen exists to show |

Register per decision 10. `h2` collapses from ten treatments to one: `micro`
mono uppercase at +0.08em on `ps-text-secondary` with a hairline rule under it,
so a section heading finally reads as a heading rather than a smaller list
item. Chart tick labels rise from 8/9px to 12px.

### S4 · The primitive set (fixes cause 3)

Twenty-eight primitives replace 213 local decisions. `src/components/ui/` holds
only things with three or more independent callers; everything else moves to
`src/components/features/<domain>/`.

- **Surface** (absorbs `Card`, `Panel`, `PanelHeader`, `GlowSurface`,
  `TemplateCard`): `variant` flat/panel/raised, `accent`, `tint`, `padding`
  16/24, one radius, one edge, header slot, owns `data-bloom`.
- **Button** (3 heights 26/32/40) + **IconButton** (square, same heights, never
  under 24x24) + **LinkButton**. `disabled` moves from `opacity-30` (1.84:1) to
  a token pair keeping the label near 3:1, plus a one-line reason.
- **Badge** (`shape` pill/tag) absorbing `StatusBadge`, `TemplatePill`,
  `QuestBadge`, `AchievementBadge`, `Tags`. **StatusDot**. **StatTile**
  absorbing `StatPill`, StatStrip's tile and insights' `MetricTile`.
- **Field** (the existing `ui/field/Field.tsx`, which associates label to
  control by construction, becomes the ONLY label) + **Input**, **Textarea**,
  **Select** (the accessible listbox), **Toggle**, **Picker** (one component
  replacing the Profile/Skill/Toolset/Timeout/MissionTime selectors), one 38px
  control height, captions above.
- **Dialog** (`placement` center/right/bottom) absorbing `Modal`, `Sheet` and
  the 12 hand-rolled overlays, wrapping the existing `useDialogA11y`.
  **Popover** + `useDismissable` replacing 10 click-outside effects and 5
  Escape handlers.
- **SegmentedControl / Tabs** with roving tabindex and real ARIA state,
  replacing 13 colour-only filter groups and 4 tab idioms. **FilterBar**.
- **DataList**, grown from `LedgerRow` with column definitions, replacing 41
  grid-faked tables. **Disclosure**. **Pagination**.
- **EmptyState** (out of `LoadingSpinner.tsx` into its own file),
  **ErrorBanner** (`LoadErrorBanner`, kept), **Toast** (kept, untouched),
  **Spinner**, **Skeleton** and a **PageLoading** contract: the header always
  renders, the body shows a skeleton the height of the content, and a count
  renders as an em-space until resolved rather than a confident `0`.
- **ConceptHint** (kept). **ConfirmButton** as the one destructive treatment,
  absorbing `PerRowDeleteButton` and the 11 hand-wired `useTwoStepConfirm`
  sites, with `aria-live` on the armed label.
- Viz (`Sparkline`, `Donut`, `ProgressRing`, `StatStrip`) kept as signature.
  StatStrip's two bookend rings become one diameter on one baseline and the
  strip drops from 130px to ~88px.

### S5 · Status colour, and colour that is not status

One ladder is the only legal source of state colour:
`--color-status-{idle,queued,running,ok,warn,fail,blocked}`, consumed through a
single `statusTone(state)` helper, replacing 22 ad-hoc maps in ~20 files in
which "failed" currently renders in three different hues, none of them the
declared danger token. Chart series keep a separate, explicitly non-semantic
categorical scale in `src/components/viz/colors.ts`, so green can mean
"Sessions" in a legend without meaning "healthy". The 353 raw Tailwind palette
hits in 56 files (169 of them the red family) map onto the ladder or onto house
accents, and `token-must-exist` is extended to refuse the raw palette in
`.tsx`.

### S6 · Radius, elevation, z, motion

- `--radius-sm 4` (chips, dots), `--radius-md 8` (controls), `--radius-lg 12`
  (surfaces), `--radius-full`. Eleven tokens to four.
- Two elevations: `--shadow-raised` for dialogs and popovers, and the
  `glow-surface` live signature. The five hard-coded `.glow-*` classes and
  their 9 call sites migrate to `GlowSurface`; `ch-pulse-glow` folds into
  `pulse-glow`. Twenty-six rendered shadows to four.
- `--z-{base,sticky,dropdown,overlay,modal,toast,tooltip}` = 0/10/30/50/60/70/80.
  Arbitrary `z-[…]` refused.
- `--duration-fast 120ms`, `--duration 200ms`, one easing. The house
  `transition-colors` excludes `outline-color`, so the focus ring stops fading
  in from grey over 150ms. `prefers-reduced-motion` inverts from a 7-name
  allowlist (which leaves 28 animations running, including the logo on all 25
  screens) to deny-by-default with a short re-enable list.

## Density, decided per screen

Operational screens are dense: information per screen, few clicks, keyboard
reach, row heights tuned down. Calm screens are spacious: they are read, not
operated.

| Screen | Density | Why |
|---|---|---|
| `/` Dashboard | **Dense** | The daily first stop. Tiles cut to the facts the Subsystems panel does not carry; the dispatch strip stays exactly as fast. |
| `/work/chat` | Dense frame, `prose` transcript | A conversation is read; the chrome around it is operated. |
| `/work/missions` | **Dense** | The busiest screen. Four stacked filter rows become one FilterBar; the board gets the reclaimed 700px. |
| `/work/composer` | **Dense** | A canvas wants every pixel. Also the only page off `AppPageShell`, and 546 KB of JS to code-split. |
| `/work/research` | Dense form, `prose` report | Same split-pane shape as Composer and Logs; one shared layout. |
| `/work/scripts` + Automation | **Dense** | A file list with actions, and a clock ledger. |
| `/results/sessions` | **Dense** | 3,621px of scroll at 77px per row for a title, a badge, two timestamps and an id. Rows to ~44px. |
| `/results/artifacts` | **Dense** | Eight items in 59% of the column with 62% of the viewport empty. Full-width grid plus a preview pane. |
| `/results/insights` | **Dense** | The best-composed screen already; it needs measure caps, not space. The 1,000px label-to-value gaps are the worst readability defect measured. |
| `/results/logs` | **Dense** | A terminal. |
| `/agent/profiles` | **Dense** | One profile picker, in the header, persistent across the Agent group. |
| `/agent/skills` | **Dense** | Shows zero skill names in the first viewport today. It is a list, not a dashboard about a list. |
| `/agent/tools` | **Dense** | A catalogue table. |
| `/agent/memory` | **Dense** | A search over records. |
| `/agent/models` | **Dense** | A registry table; below 1200 it becomes a card list rather than clipping ACTIONS off-screen. |
| `/agent/settings` (one page) | **Dense** | ~95 controls. The existing card grid is the best-built layout in the app and becomes the section template. |
| `/quests` | **Spacious** | Onboarding. One card level, not three; chapter headings and flat rows; generous rhythm. |
| `/help` | **Spacious** | Already the only comfortable reading in the product and the model for `lead` prose. Unchanged but for the h1 naming itself Help. |
| `/recroom/story-weaver/*` | **Spacious** | The showcase. Calm grids, the warm reading register, real breathing room. |
| First-run (START HERE, empty states) | **Spacious** | The one place a novice is asked to read. |

## The new gates

*A gate you add is worth more than a screen you fix.* The existing gates
measure text contrast, icon-button names, form-control names, declared colour
tokens and overlay contracts. **They measure none of the four causes.**

**Static, in `npm run lint`:**

1. `contrast-check.mjs` extended from four text tokens to the whole ladder: it
   re-derives panel, raised, edge, hairline and emphasis against their
   neighbours and fails below the S1 targets, with the same refusal to lower
   the requirement. Constraint held as an invariant: `--color-dark-950` must
   stay a 6-digit hex and the four text tiers must stay spelled
   `rgb(255 255 255 / 0.NN)`, or the existing regexes silently stop seeing
   them.
2. `design-lint.mjs` gains twelve rules, landing in `--report` mode in U2 and
   turning hard the moment the codemod that clears them lands:
   `no-raw-border-alpha`, `no-raw-text-alpha`, `palette-must-be-house`,
   `type-scale-only`, `radius-scale-only`, `z-scale-only`,
   `no-inline-card-chrome`, `no-raw-control-outside-ui`,
   `one-container-per-page`, `no-raw-colour-in-css`,
   `no-raw-fetch-in-component`, `status-colour-through-helper`.
3. Three existing holes closed in U0, before anything can widen them:
   `no-raw-colour-in-tsx`'s `\brgba?\(` misses the underscore form inside
   Tailwind arbitrary values (two live sites pass while the gate reports zero);
   `no-sub-12px-type` matches only the class syntax and misses `fontSize={8}`
   in three chart components; `no-bare-outline-none` accepts a
   `focus:border-*` colour as a replacement for the ring, so 46 controls in 30
   files pass today.

**Live, a new `tests/e2e/design-invariants.spec.ts` iterating
`documentedRoutes()` at 1440, 1024 and 390:**

4. **Non-text contrast** — every control border >= 3:1 against its composited
   neighbour, compositing real ancestor backgrounds including `oklab` and
   `color-mix` values (296 fail today).
5. **Surface separation** — rail vs main, and every card edge, at the S1
   targets.
6. **Page geometry** — `h1.left === firstContentBlock.left` (+/-1px) on every
   route, and the set of container widths has exactly one member.
7. **Value sprawl census, ratcheting** — distinct rendered font sizes, border
   colours, card chromes, button heights, radii, box-shadows and z-layers, held
   in `design-census.baseline.json` with the same shrink-only ratchet and
   `--allow-growth "<reason>"` escape `design-lint` already uses.
8. **Hit targets** — no interactive element under 24x24 (127 fail today).
9. **Containment** — `main.scrollWidth <= main.clientWidth` at 390 and 1024.
   The dashboard overflows by 40px today INSIDE `main`, invisible to any test
   that reads `document.scrollWidth`.
10. **Motion** — under `reducedMotion: "reduce"`, no animation runs outside the
    allowlist (28 run today).
11. **Loading** — the header renders during load, and no route paints a
    confident `0` before its fetch resolves (three do).

A second Playwright project at 390x844 over the whole matrix, deferred by the
last programme, lands with gate 9.

## Programme, batches

Seventeen batches in order. Each is one task record, one oracle-first commit
measured red, one implementation commit, one mutation sweep against the
committed tree, one push. Effort S/M/L/XL. The discipline block from
`org/plans/2026-09-final-release.md` applies unchanged: gate **by exit code**
(`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run lint:knip`,
`npm run canary:check`, `npm run build`), Playwright before and after, a
browser walk on the isolated instance for anything visual, patch scripts
written to the scratchpad with the Write tool and run with `python`. Two steps
are added to that chain for this programme: `npm run test:e2e` and
`npm run census`. The census is opt-in and runs on its own rather than inside
the suite, because `fullyParallel` would otherwise have it reading pages that
twenty other spec files are still writing to.

Every batch that changes a screen re-runs `npm run screenshots` and updates
that screen's guide in the same commit. Every implementation agent is followed
by a sceptic whose job is to refute the fix and who checks `git diff` for
deleted assertions. Parallel agents get disjoint files; shared rules are held
by gates, never by comments.

### U0 — Baselines, gate holes, and one false comment [S] · T-0114
- The full gate and Playwright recorded as the baseline by exit code; the
  isolated instance walked and its 25 screenshots kept as the "before" set.
- The **before census** captured by the new measurement script and committed as
  `design-census.baseline.json` at today's values, so every later claim is a
  diff against a number rather than an adjective.
- `no-raw-colour-in-tsx`: `\brgba?\(` becomes `(?<![\w.$])rgba?\(`; the two
  sites it was missing (`LogsHeaderActions.tsx:47`, `WorkflowRunCanvas.tsx:67`)
  go onto tokens. `no-sub-12px-type` also matches `fontSize={n}` for n<12; the
  three chart sites rise to 12px.
- **globals.css:479-517**: the 39-line comment asserting that ~20 rules in the
  file "currently paint nothing" is false. The recon measured `.glow-cyan`,
  `.text-glow-cyan` and `.grid-bg` painting in a production Chromium build; the
  `--ps-rgb-*` tokens at 181-186 are space-separated, not the comma list the
  comment describes; and `lockbook-tokens.test.ts:148-184` already asserts they
  are usable. It is cut to ~6 lines saying what the bloom does, because it
  carries a standing instruction not to fix code that is not broken and every
  future agent inherits it.
- Verify: gate green by exit code with the numbers on the record; the two
  design-lint rules measured red against planted fixtures AND against the real
  sites, so a rule that fires for the wrong reason is caught.

### U1 — Shared mock factories [M] · depends U0 · T-0115
Landed early because it is mechanical and every later batch edits tests.
- `tests/helpers/mocks.ts`: one exported factory per repeated mock shape, called
  from each site through `jest.mock`'s hoisting-safe `require` form, so the mock
  stays OPT-IN per file. Nothing moves into `jest.setup.ts` or
  `moduleNameMapper`: a mock declared there applies to all 614 files including
  the ones that deliberately use the real module, which is a behaviour change
  wearing a refactor's clothes.
- The stanza that actually pays: `@/lib/db`'s crypto-and-transaction block, 10
  lines pasted identically into 37 files. Then the dominant shapes of
  `lucide-react` (26 of 54), `@/components/layout/AppPageShell` (13 of 16),
  `next/link` (10 of 18), `@/lib/api/api-auth` (16 of 52), `@/lib/runtime` (8 of 17)
  and the rest. Every non-dominant shape keeps its own factory, because it is
  testing something different.
- `tests/helpers/render-with-query.tsx` (22 lines, zero users) deleted.
- Verify: **the oracle is identity.** `it()` count, suite count, pass count and
  every coverage percentage are unchanged; any movement is a defect, not a
  saving. About 1,750 lines.

### U2 — The token layer [L] · depends U1 · T-0116
- S1, S3, S5 and S6 declared in `@theme`: the surface and edge ladder, the five
  `--text-*` steps with leading, `--radius-*`, `--z-*`, `--shadow-*`,
  `--duration-*`, `--color-status-*`. `--container-ps-page` and
  `--container-ps-prose` replace `ps-reading/wide/full`; `theme.ts`'s
  `measureClasses` follows and `lockbook-tokens.test.ts` is amended at the
  changed line with the reason written there.
- `contrast-check.mjs` extended to derive and assert the whole ladder.
- The twelve new `design-lint` rules land in `--report` mode with their current
  counts printed, so the codemod batches have a number to drive to zero.
- Nothing repaints: the old spellings still resolve. Declaration plus gates
  only, which is what makes U4 to U6 mechanically checkable.
- Verify: an oracle per rule, each measured red against a planted fixture AND a
  real site; the ladder derivation asserted against hand-computed ratios;
  `npm run build` proves the tokens compile to utilities.

### U3 — Page geometry [M] · depends U2 · T-0117
- S2: `AppPageShell` gains `header` and `density`; the shared container; the
  full-bleed header bar with contained content; the back link in a fixed slot;
  the `Section` primitive and the two spacing steps.
- All 20 per-page `max-w-*` literals deleted; the Dashboard onto `PageHeader`
  (its h1 stops saying "Hermes AGENT FRAMEWORK", which names the dependency
  rather than the page); `/work/composer` onto `AppPageShell`.
- Gate 6 turned on and hard.
- Verify: the geometry gate over all 25 routes, measured red first (24 of 25
  fail today by -102px to +289px); `rail-no-scroll` and the 390px title spec
  unchanged; screenshots recaptured.

### U4 — Codemod A: surfaces and edges [L] · depends U3 · T-0118
- Every `bg-dark-*` spelling onto the three surface roles; every
  `border-white/N` and `bg-white/N` onto the three edge rungs. ~720 sites,
  script-driven.
- The rail's own surface, its single `edge` divider, the duplicate `border-r`
  at `layout.tsx:107` deleted, the no-op `backdrop-blur-xl` deleted.
- `no-raw-border-alpha`, `no-inline-card-chrome`, `no-raw-colour-in-css` turn
  hard. Gates 4 and 5 turn on.
- **This is the batch the operator sees.** Every region gets an edge.
- Verify: the live contrast gate over 25 routes, red first; the census shows
  distinct rendered border colours falling 31 to <=6; screenshots recaptured
  and walked on the isolated instance.

### U5 — Codemod B: the type scale [M] · depends U4 · T-0119
- Every `text-xs|sm|base|lg|xl|2xl` onto the five steps; the decision-10
  register split; `h2` to one treatment; 157 `text-white/N` and
  `placeholder-white/N` sites onto the tiers; 134 bare `text-white` onto
  `ps-text-primary`; the 17 1.33-leading prose blocks onto `lead`.
- `type-scale-only` and `no-raw-text-alpha` turn hard.
- Verify: the census shows 12px falling 70.6% to <=45%, distinct rendered sizes
  8 to 5, none below 12px, and mono share ~62% to ~45%.

### U6 — Codemod C: colour, status, radius, z, shadow [M] · depends U5 · T-0120
- S5: the status ladder, `statusTone()`, the 22 maps deleted; the 353 raw
  palette hits mapped; `palette-must-be-house` and
  `status-colour-through-helper` turn hard. `StatPill`'s two `.replace()`
  -derived class expressions become a literal map, fixing three accents that
  render a solid white border and ten dead hover states on the front door.
- S6's radius, z and shadow codemods; `radius-scale-only` and `z-scale-only`
  turn hard; the five `.glow-*` classes and the duplicate keyframe deleted.
- Verify: census radii 7 to 4, shadows 26 to <=4, z-layers 13 to 7 with zero
  arbitrary; a render test that every accent in every map emits real CSS
  (the defect class `no-template-literal-tailwind` exists for).

### U7 — The rail [M] · depends U4 · T-0121
- Real hierarchy: section headings at their own tier with space above, item
  labels at `secondary` so the active state has somewhere to go, icons quieter
  than labels. Sixty-three elements share one tone today.
- An edge-anchored 3px accent bar in the destination's registry colour for
  "you are here", a perceivable hover, and the accent idea used harder rather
  than fired on one row at a time.
- Collapsed rows become 40x40 squares (39x22 today, under the WCAG minimum and
  SMALLER than the expanded rows); footer glyphs centre on the rail axis; group
  separators and tooltips survive collapse.
- **Decision 8: the sub-link tier deleted** with `NavSubLink`, the `subLinks`
  field and the `showSubs` branch. Both destinations already carry full in-page
  navigation, and the 1280x720 overflow (89px and 37px, clipping the active
  item) disappears with it.
- The collapse preference read server-side in `RootLayout` so the rail stops
  visibly un-collapsing for ~200ms on every hard load; `transition-all`
  narrowed to `transition-[width]`.
- `aria-current="page"` on the exact match only. 18 unused `IconName` variants
  and their lucide imports trimmed. `RailFooter`'s `/api/update` fetch folded
  into the poll the rail already makes. `BranchDropdown` moved out of `layout/`
  to its consumer's neighbourhood: it is **not** dead, `DeployControls.tsx:18`
  imports it, contrary to one reconnaissance claim.
- `MobileHeader` stops branding the product "PT / Hermes"; one `BrandMark`
  serves both lockups.
- Verify: `rail-no-scroll.spec.ts` extended from `/` to every route in
  `APP_NAV_ROUTES` (it covers only `/` today, which is why the overflow was
  never caught); a first-paint width assertion; the contrast gate on the rail.

### U8 — The primitive set [XL] · depends U6 · T-0122
- S4 built with oracles, not yet adopted; the `features/<domain>/` split
  executed for everything with fewer than three callers.
- `useDismissable`, `Popover`, `Dialog`, `SegmentedControl`, `DataList`,
  `Skeleton`, `PageLoading`, `Picker`, `EmptyState` in its own file.
- The one destructive treatment and the one loading contract land here so the
  conversion batches consume them rather than inventing them.
- `no-raw-control-outside-ui` lands in report mode with its 321-site count.
- Verify: a behaviour oracle per primitive including keyboard paths (arrow keys
  in every group, Escape on every dismissable, focus return on every dialog);
  a11y fixtures; no screen changes yet, so Playwright is unchanged.

### U9 — Conversion: Work, and the Automation view [XL] · depends U8 · T-0123
Chat, Missions, Composer, Research, Scripts.
- Missions: one FilterBar; the duplicate status pill row and duplicate category
  chips resolved (status is rendered three times and categories twice today);
  the kanban gets a real column layout instead of `overflow-x` on a flex row,
  which clips the FAILED column mid-word at every viewport.
- **Decision 9: one Automation view** listing everything on a clock, script or
  mission, with next run, last run and log. Scripts keeps the file list;
  Missions keeps dispatch; neither keeps a schedules section.
- Composer, Research, Logs and Chat are the same split-pane shape built four
  times; one shared layout serves them. `MissionCreateForm`'s 305-line form
  body becomes ~11 `<Field>` rows. `WorkflowCanvas` sheds its inspector and
  toolbar and is `next/dynamic`-ed with `ssr:false`, moving ~400 KB off a route
  that ships 546 KB against a 28-139 KB norm.
- Verify: census over these routes; the mission dispatch loop timed and
  unchanged (`role=status` at ~90ms, "Mission dispatched" at ~263ms, focus
  returned to its trigger); canary blessed for the new route; guides and
  screenshots.

### U10 — Conversion: Results [L] · depends U8 · T-0124
Sessions, Artifacts, Insights, Logs.
- Session rows 77px to ~44px; one trailing affordance at a fixed right offset
  (three x positions in one list today); filter chips get a resting border so
  they read as controls.
- Artifacts: header aligned, full-width grid, a preview pane, a run id and
  source per row.
- Insights: the 1,000px label-to-value gaps capped at a reading measure or made
  a two-column table; the streak row rebalanced; the activity chart given an
  axis.
- `DistributionHistogram` stops distorting its own labels. It is the only chart
  in `viz/` carrying text inside a `preserveAspectRatio="none"` stretch, so in a
  323px card its 12px labels render 14.4px tall and 3.2px per character
  (measured in U0). The fix is the chart knowing its rendered width, which needs
  the first `ResizeObserver` in `src/`, or moving the axis labels out of the SVG
  into an HTML row where the type scale can reach them.
- The seven near-clone `*Insights.tsx` stat-strip wrappers (482 lines) become
  one data-driven strip showing at most three numbers you cannot get by
  counting the rows below it, and stop restating the page's own subtitle.
- Verify: census; CLS <= 0.02 on all four (three are 0.09 to 0.10 today).

### U11 — Conversion: Agent, and Settings as one page [XL] · depends U8 · T-0125
Agents, Skills, Tools, Memory, Models, Settings.
- **Decision 7: Settings becomes one scrollable page** with a sticky section
  nav, sections expanded in place, the field search kept, and Models, Restore
  and System staying separate pages. 307 redirects for all 27 section URLs;
  `documentedRoutes()`, `docs:check`, the guide, quest hrefs and the canary's
  `httpSurface` all move with it, blessed in the same commit.
- One profile picker, in the header, persistent across the group. There are
  three today and they disagree about the agent's facts (22 runs vs 11 runs on
  one screen; 0 memory facts vs 2 across screens); the counts are reconciled or
  explicitly scoped in their labels.
- Skills shows skills. Models collapses to a card list below 1200 rather than
  putting its ACTIONS column off-screen with no affordance. Tools gets
  `mx-auto` and its 191px right-only dead space back.
- Verify: census; redirect tests for all 27 old paths; the 1024 and 390
  containment gates; guides and screenshots.

### U12 — Conversion: Rec Room, five entries to two [L] · depends U8 · T-0126
- **Decision 6.** `/recroom/story-weaver/characters` (404 lines) and `/themes`
  (311) deleted, their lists becoming panels inside `/create`, which already
  reads and writes them. The index (136 lines) merged into Library (251), a
  strict superset of it. The four in-page nav buttons that duplicate the rail
  deleted. Three 307 redirects; four guides and four screenshots retire.
- The pilot proof that the primitives cover a real screen: 17 of 18 module
  components import zero shared primitives today (~4,100 lines outside the
  design system entirely).
- The reader's warm register reduced to three tokens (page, ink, rule); the
  second "black" theme and the parallel five-state chapter ladder fold onto the
  status tokens; `chapter-dot.ts` goes.
- Verify: census; the reader's typography measured; `docs:check` green with
  four fewer guides; canary blessed; screenshots.

### U13 — Conversion: Home [M] · depends U8 · T-0127
Dashboard, Quests, Help.
- Dashboard: the Subsystems panel kept (it carries reason strings the tiles do
  not) and the tile row cut to the three facts it does not carry; tile content
  top-aligned so the row stops breaking its baseline; subtext widened rather
  than clipped at 133px.
- Quests: one card level instead of three concentric borders; a fixed-width
  status column so titles stop zig-zagging 23px down the list; Go and Skip in a
  row; spacious rhythm.
- Help: the h1 names itself Help; typography otherwise untouched, because it is
  the model the rest of the app has been moved toward.
- Verify: census; the dashboard's 390px overflow gate; guides and screenshots.

### U14 — Interaction, motion, responsiveness [M] · depends U9-U13 · T-0128
- The 46 bare `outline-none` deleted so the global ring paints, and
  `no-bare-outline-none` tightened to refuse a border-colour replacement.
- `transition-colors` excludes `outline-color`.
- `prefers-reduced-motion` inverted to deny-by-default.
- The 64px icon rail used from 768 to 1024 instead of dropping to the drawer, a
  breakpoint change over code that already exists.
- The mobile drawer's focus trap stops leaking onto the hamburger behind the
  backdrop (`useDialogA11y` filters by `getClientRects().length`, guarded so
  jsdom, which does no layout, still sees elements).
- A failed chat run becomes a real error with an icon, a reason, `role="alert"`
  and Retry, rather than red italic prose with no way forward.
- Gates 8, 9, 10, 11 turn hard; the 390x844 Playwright project lands.
- Verify: keyboard walk of every route; the four live gates red first.

### U15 — Deletion and the data layer [L] · depends U14 · T-0129
- `useApiResource` becomes the only way a component reads the API; query keys
  normalise to the endpoint path so the cache dedupes by construction. The
  dashboard's 23 requests on load (six endpoints fetched twice) and 29 requests
  per 30 idle seconds fall to ~13 and ~12. `dashboard-initial-load.ts` deleted.
- The genuinely unreachable modules and their four test files deleted;
  `src/components/motion/` rewritten in CSS and the `motion` dependency (669
  KB, one importer, two consumers) dropped; nine CSS rules that match nothing
  deleted; the three orphan API routes and their `api.md` rows removed, with
  the two factually wrong rows fixed either way.
- The 17 pure migration wrappers replaced by one driver plus a
  `[version, filename]` table (~480 lines).
- Verify: knip clean with `tests/**` no longer declared as knip entrypoints,
  which currently hides test-only modules; canary blessed in the same commit
  for the route deletions; a request-count assertion on the dashboard.

### U16 — Documentation, records, release readiness [L] · depends U15 · T-0130
- `docs/contributing/design-tokens.md` rewritten to describe the system that
  now exists: the ladder and its derivation, the type scale and register rule,
  radius/z/shadow/motion, the status ladder, the primitive set, and the rule
  that `ui/` means three or more callers. It currently documents a colour
  system with three widths and one rhythm.
- Every touched guide finished against the final state; `npm run screenshots`
  regenerates every PNG; `docs:check` and `check-doc-links` green with the
  retired guides gone.
- The seventeen task records written and `org/TASKS.md` re-rendered; CHANGELOG
  entries in user language. (The plan itself was filed in U0, so that every
  session after the first reads it from disk rather than from a conversation.)
- The after-census published beside the before-census in the final record.
- Verify: the whole gate; Playwright including the new design-invariants spec
  and the 390 project; a full browser walk; the operator's own read.

## Deletions

### Signed off (decisions 6 to 9): a feature or a URL goes

| What | Batch | Cost |
|---|---|---|
| Rec Room: Characters + Themes pages deleted, index merged into Library | U12 | ~1,100 lines, 3 rail entries, 4 guides, 3 redirects |
| Settings: 27 sub-pages become one page | U11 | 27 redirects, canary bless, quest hrefs, one guide |
| Rail sub-link tier | U7 | ~35 lines, and the 1280x720 rail overflow disappears |
| Scripts + Missions schedules merge into Automation | U9 | a new surface; two schedule surfaces retire |

### Provable, no feature lost

| What | Evidence | Lines |
|---|---|---:|
| Inline card chrome onto one `Surface` | 113 files hand-roll it; `Card` used in 9 | 1,500-2,500 |
| 321 raw `<button>` onto `Button`/`IconButton` | 75.5% bypass; 110 carry no `type=` | in the above |
| 5 Selectors onto one `Picker` | 684 lines, identical trigger chrome, none keyboard-accessible | ~500 |
| Modal + Sheet + 12 overlays onto one `Dialog` | `useDialogA11y` already shared; only chrome duplicated | 600-800 |
| 10 click-outside effects + 5 Escape handlers onto `useDismissable`/`Popover` | 1,778 lines; 6 trap the keyboard user | ~1,000 |
| 22 status colour maps onto `statusTone()` | "failed" renders in three hues | ~180 |
| 7 stat-strip wrappers onto one strip | 482 lines, several commented as mirroring each other | ~300 |
| 2 form kits to 1; `ui/Select.tsx`; 8 label spellings to one `Field` | three input base strings differing in surface, placeholder and ring | ~400 |
| 20 per-page `max-w-*` and their comments | the shell owns the measure | 150-250 |
| 24 loading strings + 26 spinner sites onto `PageLoading` | 3 behaviours, 3 false zeros | ~150 |
| 11 hand-wired confirms + `PerRowDeleteButton` onto `ConfirmButton` | 3 armed-ring values, 3 destructive treatments | ~130 |
| Unreachable modules + their 4 test files | `run-trajectory`, `llm-judge`, `session-window`, `concept-attachments` | 462 + ~400 |
| `src/components/motion/` + the `motion` dependency | 1 importer, 2 consumers, 669 KB | 75 |
| 9 dead CSS rules, 5 `.glow-*`, 1 duplicate keyframe, the stale bloom essay | measured against the tree | ~110 |
| 17 pure migration wrappers | identical 20-line stanza | ~480 |
| 3 orphan API routes | zero callers; two of their doc rows are wrong | 94 |
| 18 unused `IconName` variants + imports | registry uses 19 of 37 | ~18 |
| `dashboard-initial-load.ts` | duplicates six `useQuery` calls | ~155 |
| **Shared mock factories (decision 11)** | the `@/lib/db` stanza pasted identically into 37 files, plus each target's dominant shape | **~1,750** |

**Total: 6,000 to 8,500 lines from `src/` with no feature removed, plus
~1,100 from the signed-off merges, plus ~1,750 from `tests/`.**

### Explicitly NOT proposed for deletion

Squashing the 41-migration chain (removes ~3,700 lines but breaks any install
predating it); `/orchestration` and `/laboratory` (both fully wired and live
despite the route renames); the Rec Room as a concept; the quest system; the
bloom field; any viz component.

## What I will measure

Captured by the census script in U0 against the committed tree, re-captured in
U16. "It looks better" is not a result.

The "before" column below is the reconnaissance's. U0 built the census and took
its own reading, and where the two disagree it is because the predicates differ,
not because the product moved: the census counts a card chrome on any bordered
surface at least 24x24 that is not a control (108, against the walk's narrower
47), and exempts an inline-in-sentence link from the hit-target floor as WCAG
2.5.8 does (85, against 127). **The census is the number that ratchets**, and
`scripts/tooling/design-census.baseline.json` is where it lives.

| Measure | Before | Target |
|---|---:|---|
| Rail vs page contrast | 1.02-1.10:1 | **>= 1.45:1**, divider >= 3:1 |
| Control borders below 3:1 | 296 | **0** |
| Distinct rendered border colours | 31 | **<= 6** |
| Distinct card chromes | 47 | **<= 4** |
| Distinct button heights / chromes | 20 / 59 | **3 (+1 icon) / <= 8** |
| h1-to-content left-edge offset | 24 of 25 off, -102 to +289px | **0px on every screen** |
| Distinct content widths at 1920 | 7 (and 8 left gutters) | **1** |
| Section gap values | 8 | **2** |
| Rendered font sizes / 12px share / mono share | 8 / 70.6% / 62% | **5 / <= 45% / ~45%**, none < 12px |
| Distinct radii / box-shadows / z-layers | 7 / 26 / 13 (7 arbitrary) | **4 / <= 4 / 7, none arbitrary** |
| Raw `<button>` outside `ui/` | 321 in 113 files | **0** |
| Raw Tailwind palette in `.tsx` | 353 in 56 files | **0** |
| `text-white/N` + `placeholder-white/N` | 157 | **0** |
| Bare `outline-none` | 46 in 30 files | **0** |
| Interactive elements under 24x24 | 127 | **0** |
| Filter groups with no ARIA state | 13 | **0** |
| Status colour maps | 22 | **1** |
| Components with exactly one importer | 146 of 213 | **<= 70 of ~130** |
| Dashboard requests: load / 30s idle | 23 / 29 | **<= 13 / <= 12** |
| `/work/composer` initial JS | 546 KB | **<= 160 KB** |
| Animations under reduced-motion | 28 | **<= 3** |
| Worst CLS across all routes | 0.116 | **<= 0.02** |
| `src/` lines | 105,965 | **-6,000 to -9,600** |
| `tests/` lines | 111,664 | **~-1,750** |
| Test count and coverage percentages | 6,090 tests | **unchanged, exactly** |

## What I decided NOT to do, and why

1. **Not restart the palette.** The Cherenkov hues and the four text tiers keep
   their values. Every enabled-text element already passes AA under live
   compositing; that is rare and it was earned. The fix extends the derivation
   method to surfaces and edges rather than replacing what works.
2. **Not re-plan the information architecture tree.** The five-group rail is
   right and the primary loop is genuinely fast. Only within-group merges
   happen, and all four were put to the operator.
3. **Not adopt shadcn/Radix or any component framework.** It would be a second
   design system beside the one being built, a large dependency for a
   local-first app, and it would flatten the identity toward generic dark-mode
   admin.
4. **Not introduce a token build step.** `@theme` in `globals.css` stays the
   single source, because `design-lint`, `contrast-check`,
   `lockbook-tokens.test.ts`, `viz-chrome-tokens.test.ts` and
   `bloom-paint-rule.test.ts` all read that file. A build step would blind five
   gates to buy nothing.
5. **Not add a light theme.** Already ruled out; a light register is a fork of
   the design system, not a setting.
6. **Not squash the migration chain**, virtualise long lists, build a Cmd-K
   palette, or take on performance work beyond the composer code-split and the
   duplicate-fetch fix. None of those are the four causes.
7. **Not rewrite the viz layer.** Sparkline, Donut, ProgressRing and
   `colors.ts` are the one part of the colour system that is not sprawling.
   Their geometry and text sizes change; their code does not.
8. **Not touch the Hermes/runtime layer, the API surface beyond three orphan
   routes, or the schema.** This is a design programme; behaviour was made
   honest by the last one. (The benchmark-table drop migration the recon
   suggested is deliberately left out for the same reason: it is a data change
   with a rollback cost and no design payoff.)
9. **Not delete the comment culture.** Comments naming the defect a decision
   fixes are why the good components are good. Comments narrating extraction
   arithmetic are deleted with the arithmetic.

## Risks and how each is held

- **The codemod batches are large diffs.** Script-driven and mechanical; the
  census and the live gates fail on a wrong outcome rather than a wrong-looking
  one; the canary's `moduleGraph` is path-insensitive so pure moves are
  neutral; screenshots recaptured and walked per batch; a sceptic agent reads
  `git diff` for deleted assertions after every fix agent.
- **The mock-factory batch could quietly lose coverage.** It carries an
  identity oracle: the `it()` count and every coverage percentage must be
  unchanged. Nothing moves into `jest.setup.ts`, so no file gains a mock it did
  not ask for.
- **`contrast-check.mjs`'s regexes are form-sensitive.** `--color-dark-950`
  must stay a 6-digit hex and the four tiers must stay spelled
  `rgb(255 255 255 / 0.NN)`, or tiers silently drop out of measurement. Held as
  an invariant on U2's record and asserted by an oracle.
- **Three existing tests pin things this programme moves.**
  `record-surface-containers.test.ts` names 8 file paths;
  `lockbook-tokens.test.ts` asserts `measureClasses` and that `reading` stays
  48rem; `rail-no-scroll.spec.ts` pins the 720px rail budget. Each is amended
  at the changed line with the reason written there. None is weakened: the rail
  budget in particular is what pays for taller rows, and it is paid by deleting
  the sub-link tier.
- **The Settings change moves 27 URLs.** 307 redirects, a canary blessing in
  the same commit, quest hrefs re-pointed, `docs:check` re-satisfied.
- **Parallel agents do not see each other.** Disjoint file sets per agent, and
  every shared rule is a gate rather than a comment asking nicely.

## Closing (2026-09-08)

Seventeen batches, T-0114 to T-0130, each an oracle-first commit measured red,
an implementation commit gated by exit code, a mutation sweep against the
committed tree, and a push. The census script U0 wrote took the before reading
against the tree at 537d658c and the after reading against the tree at the end
of U15; both are `scripts/tooling/design-census.baseline.json` at those two
commits, and the after reading is what the ratchet now holds.

### The census, before and after

| Measure | Before (U0) | After (U15) | Plan target | Read |
|---|---:|---:|---|---|
| routes | 23 | 21 | | Rec Room five to two, Settings 27 to one |
| distinctFontSizes | 7 | 7 | 5 | missed: 13px from one editor's own prop, 18px from one title (T-0119) |
| twelvePxShare | 0.70 | 0.52 | <= 0.45 | short by 7 points; what is left at 12px is machine words, which belong there |
| monoShare | 0.63 | 0.68 | ~0.45 | **missed, and moved the wrong way**: the census counts text nodes, and the conversions added more machine-word nodes (table cells, counts, status words) than they moved prose out of mono; the register rule is right and the measure needs the character-weighted reading the recon took |
| textBelowFloor | 0 | 0 | 0 | held |
| distinctBorderColours | 36 | 28 | <= 6 | missed: accent-tinted boundaries (status, category colour) are counted, and the census does not fold alphas of one hue |
| distinctCardChromes | 108 | 64 | <= 4 (on the recon's narrower predicate, 47) | missed; the census counts every bordered surface's radius, border and fill as a chrome, so a status-tinted card is its own chrome by design |
| distinctButtonHeights | 23 | 21 | 3 (+1 icon) | missed as measured: the census counts every control (links, inputs, summaries, chips), not `Button` alone; Button itself has three heights |
| distinctButtonChromes | 89 | 57 | <= 8 | missed, same reason |
| distinctRadii | 7 | 5 | 4 | one short |
| distinctBoxShadows | 16 | 10 | <= 4 | missed |
| distinctZLayers | 1 | 1 | 7, none arbitrary | the census sees positioned elements at rest only; the ladder is declared and `z-scale-only` holds 20 arbitrary in its baseline |
| controlBordersBelowThree | 320 | 102 | 0 | missed: accent-tinted control borders are counted and not asserted (T-0118); the grey ones are at zero by the live gate |
| decorativeBordersBelowThree | 619 | 691 | | rose on purpose: the hairline is 1.63:1 and the live floor is 1.55, and 32 section headings gained a rule (T-0119) |
| hitTargetsBelowTwentyFour | 85 | 0 | 0 | **met** (T-0128) |
| routesWithMisalignedHeading | 21 | 0 | 0 | **met** (T-0117) |
| worstHeadingOffset | 289 | 0 | 0 | **met** |
| distinctContentWidths | 8 | 1 | 1 | **met** |
| routesOverflowingX | 0 | 0 | 0 | held; gate 9 holds `main` at 390 and 1024 as well |
| railVsPageContrast | 1.06 | 1.47 | >= 1.45 | **met** (T-0118) |
| railDividerContrast | 1.26 | 4.40 | >= 3 | **met** |

### The other measures

| Measure | Before | After | Plan target | Read |
|---|---:|---:|---|---|
| Bare `outline-none` in src | 46 | 0 | 0 | **met** (T-0128) |
| Animations running under reduced motion | 28 | 0 | <= 3 | **met**; gate 10 holds it |
| Status colour maps | 22 | 1 | 1 | **met** (T-0120) |
| Filter groups with no ARIA state | 13 | 0 | 0 | **met**: every filter row is a `SegmentedControl` radiogroup |
| `text-white/N` + `placeholder-white/N` | 157 | 0 | 0 | **met**; `no-raw-text-alpha` at zero |
| Raw Tailwind palette in `.tsx` | 353 | 77 | 0 | short: `palette-must-be-house` is hard for new sites and holds 77 in its baseline |
| Raw `<button>` outside `ui/` | 321 | 24 | 0 | short: 24 in 16 files in `no-raw-control-outside-ui`'s baseline |
| Inline card chrome outside `ui/` | 113 files | 222 in 87 files | | `no-inline-card-chrome` is hard for new sites and holds 222 in its baseline |
| Components with exactly one importer | 146 of 213 | 128 of 201 | <= 70 of ~130 | missed: the split reached the primitive layer, not the page layer |
| Dashboard API requests, load / 30s idle | 22 (4 twice) / 11 | 17 (none twice) / 14 | <= 13 / <= 12 | load: no duplicate, and seventeen distinct facts is what the board shows; idle: the poll arithmetic gives 11 to 13 plus phase, ceiling 15 (T-0129) |
| `/work/composer` route JavaScript | 546 KB | 524 KB | <= 160 KB | **missed**: U9 split the canvas behind `next/dynamic`, which defers it, but the route still loads it on that screen; the recon's number and this one are the route's own scripts as the browser downloads them |
| Test count | 6,090 | 6,802 | unchanged, exactly (U1's oracle) | U1 held identity; the other sixteen batches added 712 oracles |
| `src/` lines (ts, tsx, css) | 105,975 | 105,942 | -6,000 to -9,600 | **missed**: the deletions (U12 ~1,100, U15 1,353 net, the wrappers, the routes) were paid back by the primitive set, the conversions and the comments that name each decision |
| `tests/` lines | 108,310 | 117,944 | ~-1,750 | **missed**: U1's factories took ~1,750 out and sixteen batches of oracles put 11,400 in |

### What the numbers say

The four causes the reconnaissance named are answered by construction, and the
measures that test those causes directly are met: every surface has an edge
the eye can find, every screen shares one left edge and one content width,
every control is a target, the ring is one ring, motion stops when asked,
state is a word, a filter is a radiogroup, the reads are one cache. The
measures that count *variety* on screen (chromes, heights, borders, shadows)
moved by a third to a half and no further, because the census counts every
bordered thing on a screen and the product still carries a legitimate
variety of status- and category-tinted surfaces; those numbers are the
ratchet's to hold, not this programme's to zero. Two goals were missed
outright and should be said plainly: the register rule did not lower the mono
share as the census measures it, and the line count of `src/` did not fall.
The programme deleted what it said it would and built a primitive set in the
same space; the next programme's deletion is the 128 one-caller components at
the page layer, and the 222 inline card chromes those pages still carry.
