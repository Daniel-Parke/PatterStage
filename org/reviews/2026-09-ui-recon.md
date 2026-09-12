---
title: UI reconnaissance
summary: "Seven parallel surveys of the running product, measured rather than eyeballed, as the evidence base for the design overhaul"
---

# UI reconnaissance

Seven surveys run in parallel against the RUNNING product (production build,
seeded data, 1440x900 unless stated), measuring computed styles and real
bounding boxes rather than reading source and guessing. This is the evidence
base for the overhaul: it exists so the next session starts from findings
instead of repeating the look.

**113 findings, 48 of them high severity, across 7 surveys.**

## The three root causes

Most of the 113 findings are symptoms of three things. Fixing the symptoms one
by one would be a very long job that leaves the causes in place.

**1. Nothing has an edge.** Every surface in the product sits within 1.06:1 of
the page behind it, and every boundary is a 1px border at 1.25:1, below the
3:1 that WCAG asks of a component boundary. The sidebar measures 1.02:1
against the page. That is the whole of "the sidebar is hard to see", and it
is also why so much else reads as unaligned: when no region has a visible
edge, nothing looks aligned to anything.

**2. There is no shared page geometry.** The sticky header sits at a fixed x
while each page centres its own content in one of seven different widths, so
on 24 of 25 screens the h1 does not share a left edge with the content beneath
it, by between -102px and +289px. Eight different left gutters, eight
different content widths at 1920.

**3. There is no component library, only 213 local decisions.** 69% of
components have exactly one importer; 144 of 212 have exactly one caller. The
shared Button is used 104 times against 321 raw `<button>` elements in 113
files; the shared Card 10 times against 234 hand-rolled card chromes. The
measured result is 47 distinct card chromes, 37 button specifications and 20
button heights across 25 screens. This is also the line-count problem: the
bloat is not dead code (knip is clean, only ~462 lines are truly unreachable)
but duplication.

A fourth, smaller: **there is no type scale.** `@theme` declares no `--text-*`
at all, and 70% of every rendered character in the product is 12px.

## The design system and its tokens

> PatterStage's token system is a colour system and nothing else, `@theme` declares 38 `--color-*`, 3 `--container-*`, 2 `--font-*` and exactly one spacing step, with zero house tokens for type, radius, shadow, z-index, motion or the spacing grid. And the one thing it does token-ise is broken at the perceptual level: the whole surface ladder (ground → panel → well) spans 1.03:1 to 1.19:1 contrast and every structural edge in the app is a 1.25:1 hairline, which is why the sidebar "is hard to see", it is 1.06:1 against the page it sits on. The semantic layer that was supposed to fix naming (`ps-surface-*`, `ps-reading/wide/full`) has four real call sites in 105k lines and its only importer is the unit test that proves it exists.

### The surface ladder is perceptually flat: every surface sits within 1.03, 1.19:1 of the page. This is the sidebar complaint, measured.

*High.*

**Measured.** Computed against the painted ground #040b12 (src/app/globals.css:29-33): dark-900 solid = 1.077:1, dark-800 (well) = 1.186:1, panel-vs-well = 1.101:1. The tree does not even use the solid values, the most common card fill is `bg-dark-900/40` = #070f18 = 1.027:1 against the ground. Live measurement on http://127.0.0.1:3939/: the sidebar's own background computes to `oklab(0.192801 … / 0.8)` = dark-900/80 = #0a131d = 1.059:1 against the page, and its right edge is `oklab(0.999994 … / 0.1) 1px` = white/10 = 1.25:1. The 1440x900 dashboard screenshot shows a 224px rail with no discernible boundary at x=224. The tree spells this ladder seven different ways (dark-900 at /20 /30 /40 /50 /60 /80 /100) which land between #060d15 and #0c1520, six named steps inside a range the eye resolves as one.

**Who it hurts.** Everyone. There is no visual page structure: no region reads as raised, sunken or separate. The operator's headline complaint and most of the 'niggling' alignment complaints are downstream of this, because when nothing has an edge, nothing looks aligned to anything.

**Recommended.** Re-derive the surface ladder for separation, not for mood. Fix ground at #040b12, then set panel and well by target contrast (panel ≈ 1.6:1, well ≈ 2.2:1 against ground) rather than by hue-mixing toward #0071c2. Collapse the seven dark-900 alphas to three opaque surface tokens. Add a `contrast-check`-style gate for surface separation, exactly as `scripts/tooling/contrast-check.mjs` already does for the four text tiers, the mechanism exists, it just only measures text.

### The hairline, 428 border draws across 9 undeclared alphas, is 1.25:1, below the 3:1 WCAG floor for UI boundaries

*High.*

**Measured.** `--color-ps-surface-hairline: rgb(255 255 255 / 0.10)` (globals.css:102) is 1.25:1 on the ground. The tree draws 428 borders: `border-white/10` ×302, `/5` ×63, `/20` ×21, `/8` ×16, `/15` ×12, `/30` ×10, `/40` ×1, `/25` ×1, bare `border-white` ×2. Live census across 22 routes: 507 rendered 1px borders, 31 distinct border colours, 294 of them white/10. Computed ratios: white/5 = 1.10:1, white/8 = 1.18:1, white/10 = 1.25:1, white/15 = 1.47:1, white/20 = 1.77:1, white/30 = 2.59:1. Not one reaches 3:1. The declared token names exactly one of the nine.

**Who it hurts.** Everyone, and specifically anyone on a laptop panel or in a lit room. Card edges, table rules, panel dividers and the sidebar boundary are all at or below the visibility floor.

**Recommended.** Declare a two-rung rule scale, `hairline` (subdivision inside a surface) and `edge` (boundary between surfaces, at ≥3:1, i.e. white/40 or a lightened blue-grey), and make design-lint refuse `border-white/<n>` in .tsx the same way `no-raw-colour-in-tsx` refuses hex. The nine-alpha spread is not a design decision anyone made; it is nine people guessing.

### There is one type scale (Tailwind's, unmodified) and it is used as if it had two steps: 70% of all rendered text is 12px

*High.*

**Measured.** `@theme` declares no `--text-*`, `--leading-*` or `--tracking-*` at all (grep of globals.css: 0 hits each), the type scale is Tailwind's default, untouched. Source usage: text-xs ×921, text-sm ×247, text-lg ×14, text-xl ×10, text-base ×8, text-2xl ×4. text-xs + text-sm = 96.7% of 1,206 uses. Live census across 22 routes, text-bearing elements only: 12px ×2,218, 14px ×752, 16px ×99, 20px ×49, 18px ×27, 24px ×16, 12px alone is 69.6%, and only 106 elements in the entire app render above 14px. Font families rendered: jetbrainsMono ×1,977 (62%), inter ×1,194 (37%).

**Who it hurts.** Everyone. With no size hierarchy and 62% mono, every screen reads as one undifferentiated block of 12px monospace; the eye has nothing to land on. This is the second half of 'the layout doesn't make sense', there is no typographic ranking to tell you what matters.

**Recommended.** Declare a real house type scale in `@theme` as `--text-*`: five steps, e.g. 12 / 14 / 16 / 20 / 28 with paired line-heights, and rule which is body. Keep JetBrains Mono for data, IDs, numbers and status words (that is the product's character); move prose, labels and headings to Inter. Then gate it: design-lint already has `no-sub-12px-type`, so extend it to refuse any `text-*` size class outside the declared five.

### The semantic surface/measure layer is dead on arrival: 4 real call sites, and its only importer is its own test

*High.*

**Measured.** `surfaceClasses` and `measureClasses` (src/lib/theme.ts:26-39) are imported by exactly one file in the repo, tests/unit/lockbook-tokens.test.ts:35 (185 lines). Grep of the whole tree for the utilities themselves: `bg-ps-surface-well` ×3 (agent/settings/system/page.tsx:201, system/DeployControls.tsx:116, plus theme.ts), `max-w-ps-reading` ×1 (help/[[...slug]]/not-found.tsx:20), and `bg-ps-surface-ground`, `bg-ps-surface-panel`, `border-ps-surface-hairline`, `max-w-ps-wide`, `max-w-ps-full`, `space-y-ps-block` ×0 outside theme.ts. Against that: `bg-dark-900` ×177, `bg-dark-800` ×68, `bg-dark-950` ×52, `border-white/10` ×311. The measures fare no better: 35 raw `max-w-{2,3,4,5,6,7}xl` / `max-w-screen-xl` uses against 4 token uses, and 6 distinct page widths in a system that declares 3. globals.css spends 51 lines (74-174) documenting this layer.

**Who it hurts.** Contributors and future agents. The docs, the CSS comments, the TS mirror and a 185-line test all assert a semantic layer that the product does not use, so anyone reading the design system is being told about a system that isn't there. This is pure ceremony cost.

**Recommended.** Either finish the migration mechanically (a codemod: dark-950→ground, dark-900→panel, dark-800→well, border-white/10→hairline is 612 sites and entirely automatable) and then have design-lint refuse the appearance-named spellings, or delete the layer. Do not leave both spellings live, that is the state that produced 78 distinct rendered backgrounds.

### 384 component colours are outside the token system entirely, and design-lint is blind to them by construction

*High.*

**Measured.** 25 distinct Tailwind-palette colours are used directly in .tsx/.ts: red-500 ×90, red-400 ×68, green-500 ×55, green-400 ×25, red-300 ×20, orange-500 ×16, blue-500 ×16, cyan-500 ×15, pink-500 ×14, blue-400 ×10, yellow-500 ×9, and 14 more, 384 uses total, against 1,111 house-token uses. `token-must-exist` explicitly exempts them: its own law text says "Tailwind's own palette (text-red-400, bg-white/5) is not a house token and is not this rule's business" (design-lint.mjs:79-81). The collisions are exact: `text-red-400` IS #f87171, byte-identical to `--color-semantic-danger` and `--color-neon-red`, spelled two ways 68 and 27 times. `--color-neon-pink` #e879f9 is Tailwind fuchsia-400, while `pink-500` #ec4899 is a genuinely different hue used 14 times. Result: six cyans in the tree (#00bfff, #33ddff, #06b6d4, #22d3ee, #67e8f9, #06d6d6), five greens (#a3ff12, #22c55e, #4ade80, #86efac, emerald), four reds, four purples.

**Who it hurts.** Everyone. Retheming is impossible; two adjacent chips can be two different reds; and the gate that exists to prevent exactly this reports 0 violations while a quarter of the app's colour is off-system.

**Recommended.** Extend `token-must-exist` to refuse the raw Tailwind palette in .tsx outright (it is a one-line regex change: add the palette names to the class matcher). Baseline the 384 at today's count and ratchet down, the ratchet machinery in design-lint.mjs is already built and already refuses growth.

### There is no status token layer, so 22 files each invented their own state→colour map, and 'failed' renders in three different hues

*High.*

**Measured.** 22 ad-hoc colour lookup maps across ~20 files: STATUS_COLOR (work/composer/page.tsx), STATUS_BORDER + STATUS_DOT (composer/WorkflowRunCanvas.tsx), BADGE_TONE (rec-room/StoryCard.tsx), KIND_TONE (results/artifacts/page.tsx), RUN_TONE_TEXT (missions/mission-page-constants.tsx), STEP_COLOR + STEP_DOT (research/ResearchReport.tsx), WORD_COLOR (dashboard/SubsystemsPanel.tsx), ROLE_COLORS (story-weaver/characters/page.tsx), CATEGORY_COLOR_CLASSES (lib/missions/mission-categories.ts), ACCENT_BORDER, MISSION_BADGE_STYLES, TIER_COLOR, dotColorMap, badgeColorMap, toggleColorMap, MODULE_ACCENTS and more. Failure is `text-neon-pink` in composer STATUS_COLOR, `text-neon-pink` in SubsystemsPanel WORD_COLOR (state 'down'), `text-red-400 bg-red-500/10` in StoryCard BADGE_TONE, `text-red-400` in RUN_TONE_TEXT ('bad'), three hues, none of them the declared `--color-semantic-danger` (used ×12 in the whole tree; `semantic-success` ×2). Individual maps are internally split: ROLE_COLORS paints `mystery` with the house `neon-purple` and `protagonist`/`ally`/`antagonist` with Tailwind `green-400`/`blue-400`/`red-400`. On /results/insights the same six accents simultaneously serve as a categorical chart series (donut + 9-item legend) and as semantic status elsewhere, so green means both 'Healthy' and 'Sessions', orange means 'degraded', 'queued', 'cancelled', 'rejected', 'waiting', 'overdue', 'stopped' and 'Automation'.

**Who it hurts.** Operators. Colour carries no reliable meaning across screens, so it has to be re-learned per page, which defeats the entire point of a status colour.

**Recommended.** Declare one status ladder (`--color-status-{idle,running,ok,warn,fail,blocked}`) as the only legal source of state colour, plus a separate, explicitly non-semantic categorical series scale for charts (viz/colors.ts is the right home and already exists). Delete the 22 maps in favour of one shared `statusTone(state)` helper. This is roughly 180 lines of map literal removed and, more importantly, makes 'pink means down' impossible to reintroduce.

### The Card and Button primitives are bypassed by most of the app: 75 files hand-roll card chrome, 321 raw <button> against 104 <Button>

*High.*

**Measured.** `src/components/ui/Card.tsx:39` defines the canonical chrome as `rounded-xl border border-white/10 bg-dark-900/50`. It is imported by 10 files. 75 other files spell card chrome inline (120 occurrences of a rounded + border + bg-dark-900/xx className). The exact canonical string appears inline 19 times; `rounded-xl … bg-dark-900/40` 18 times; `rounded-lg … /50` 11; `rounded-lg … /40` 4; `… /30` 4; plus 52 more as `border border-white/10 rounded-lg`. Live confirmation: probing 8 routes for (background, border-colour, radius) triples on bordered elements returned 35 distinct card spellings, the top five being dark-900/40+white/10+12px ×50, white/5+white/10+8px ×15, dark-900/50+white/10+12px ×12, white/2+white/5+12px ×12, dark-900/60+white/10+16px ×11. Raw `<button` ×321 vs `<Button` ×104. `Badge` imported by 10 files, `Input` by 7, `Select` by 1.

**Who it hurts.** Everyone. Cards on adjacent screens differ in fill, edge and corner radius for no reason, which is precisely the 'not formatted/aligned/sized correctly' complaint. And it is the single largest LoC reduction available in the UI layer.

**Recommended.** Make Card, Button, Badge, Input and Select the only legal way to draw those things, add a design-lint rule refusing inline card chrome in .tsx (the regex used to count them here works as-is), and codemod the 120 sites. Conservatively 400, 600 lines of duplicated className soup, and it forces the radius/fill/edge decisions to be made once.

### globals.css carries a 39-line comment stating that ~20 of its own rules paint nothing. Measured against the running production build, that is false, and it instructs the next maintainer not to fix it.

*Medium.*

**Measured.** globals.css:492-507 asserts "That is a live defect with nineteen other sites in this file, including .scanlines, .grid-bg, .text-glow-* and every .glow-* box-shadow, all of which currently paint nothing" and "Do not 'simplify' these two lines onto the --ps-rgb-* triplet; that is a straight revert to invisible." Measured in Chromium against http://127.0.0.1:3939 (production build): `.glow-cyan` → `rgba(0, 191, 255, 0.08) 0px 0px 14px 0px, rgba(0, 191, 255, 0.024) 0px 0px 28px 0px`; `.text-glow-cyan` → `rgba(0, 191, 255, 0.55) 0px 0px 10px`; `.grid-bg` → `linear-gradient(rgba(0, 191, 255, 0.03) 1px, …)`; a bare probe element given `box-shadow: 0 0 14px rgb(var(--ps-rgb-neon-cyan) / 0.08)` computes to `rgba(0, 191, 255, 0.08) …`. The premise is stale: the comment says the token holds a comma list, but `--ps-rgb-neon-cyan` computes to `0 191 255` (space-separated), docs/contributing/design-tokens.md records that the spelling was corrected on 2026-08-30, and this comment was not.

**Who it hurts.** Contributors and agents. The design system's central file contains a confident, wrong, load-bearing claim with a standing instruction not to touch the code it describes. Any future agent reading globals.css inherits it.

**Recommended.** Delete globals.css:479-517 down to about six lines that say what the bloom does and why the fine-pointer and reduced-motion guards exist. Keep the `color-mix` implementation or move it to the triplet, but stop asserting a defect that the browser disproves. Add this to the redesign's first commit so nobody plans around a phantom.

### design-lint's no-raw-colour-in-tsx has a word-boundary hole: the underscore form inside Tailwind arbitrary values slips straight through

*Medium.*

**Measured.** The rule is `/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/` (design-lint.mjs:162). Tailwind arbitrary values use `_` for spaces, so the character before `rgba` is `_`, which is a word character, there is no `\b`. Verified in node: `no-raw-colour-in-tsx` returns false for both `shadow-[0_0_8px_rgba(6,214,214,0.3)]` (src/components/logs/LogsHeaderActions.tsx:47) and `shadow-[0_0_12px_2px_rgb(34_211_238/0.4)]` (src/components/composer/WorkflowRunCanvas.tsx:67). `node scripts/tooling/design-lint.mjs --report` reports "no-raw-colour-in-tsx (0 in 0 files)" while both live in the tree. The colours are rogue too: #06d6d6 is a teal declared nowhere, #22d3ee is Tailwind cyan-400, neither is `--color-neon-cyan` #00bfff.

**Who it hurts.** Contributors. The single most valuable rule in the gate has a hole exactly where a designer reaches for a one-off glow, and the gate reports clean.

**Recommended.** Change `\brgba?\(` to `(?<![\w.$])rgba?\(` or just drop the leading `\b`, re-baseline, and fix the two sites onto tokens. One-line fix; do it before any redesign work starts so the redesign can't add more.

### globals.css itself paints three colours that no token declares, including a second cyan for the app's 'live' signature

*Medium.*

**Measured.** Raw colour literals in globals.css outside the token block: `rgb(34 211 238 …)` at lines 332, 336, 341, 345, 346, five sites, #22d3ee (Tailwind cyan-400), used for `.ps-rail-flow`, `.ps-edge-glow` and `.ps-electrified`, i.e. the composer's live-pathway signature; `rgba(6, 214, 214, …)` at 462-464, #06d6d6, a teal, used only by `.animate-auto-refresh-tick`; `rgb(74 222 128 / 0.45)` at 338, #4ade80 (green-400), for `.ps-rail-done`. The brand cyan is #00bfff and the brand green is #a3ff12. So the state the whole design language reserves for 'this is running' is painted in a cyan that is not the brand cyan, next to elements that are.

**Who it hurts.** Operators and anyone retheming. 'Glow means running' is the product's stated signature (design-tokens.md, Restraint section) and it is the one place the brand colour is not used.

**Recommended.** Repoint all three onto `--color-neon-cyan` / `--color-neon-green` (or declare a `--color-status-live` if the brighter cyan is genuinely wanted for motion), and extend design-lint to scan .css for raw literals outside the `@theme`/`:root` declaration blocks, it already reads globals.css for `token-must-exist`.

### The canonical input ships an illegible placeholder, and 157 sites paint text below the project's own 'faint' floor

*Medium.*

**Measured.** `baseInputStyles` (src/lib/theme.ts:149), the string docs/contributing/design-tokens.md tells contributors to prefer, contains `placeholder-white/20`. White at 20% on #040b12 is 1.77:1. There are 14 `placeholder-white/20`, 4 `placeholder-white/30` (2.59:1), 3 `placeholder-white/15` (1.47:1) and 1 `placeholder-white/25` in the tree. Separately, 23 text sites use `text-white/20` (×15), `/10` (×6) and `/15` (×2), 1.77:1, 1.25:1 and 1.47:1, against globals.css:65-67 which states "There is deliberately no tier below `faint`" (50%, 5.3:1). And 134 sites use bare `text-white` (19.78:1), which is not a tier either, `primary` is 92%. Rendered census confirms: `rgb(255,255,255)` appears on 273 text elements. `contrast-check.mjs` cannot see any of this: it reads four token declarations out of globals.css and measures nothing that renders.

**Who it hurts.** Operators filling in forms, and anyone reading a timestamp or unit label. Placeholders in this app are effectively invisible.

**Recommended.** Add a `hint` tier at white/50 for placeholders and point `baseInputStyles` at it. Add a design-lint rule refusing `text-white/<n>` and `placeholder-white/<n>` in .tsx (the tiers exist; there is no reason to spell hierarchy raw). Point the 134 bare `text-white` at `ps-text-primary`, or, if pure white is wanted for headings, declare it as a fifth tier so it is a decision rather than a habit.

### Chart tick labels render at 8px and 9px, below the project's own declared legibility floor, because no-sub-12px-type only matches the Tailwind class syntax

*Medium.*

**Measured.** `no-sub-12px-type` matches `text-\[(?:[0-9]|1[01])px\]` (design-lint.mjs:167) and reports 0 violations. Live census of /results/insights found 11 SVG `<text>` elements at 8px and 3 at 9px, carrying real data ('<5s', '5, 15s', '15, 30s', '30, 60s', '1, 2m', '2, 5m', '5m+', and bar counts). Source: src/components/viz/DistributionHistogram.tsx:68 `fontSize={9}`, :76 `fontSize={8}`, src/components/viz/RadialActivityClock.tsx:64 `fontSize={8}`.

**Who it hurts.** Operators reading the Insights charts. The axis labels on the distribution histogram are two-thirds the size of the minimum the project declares readable.

**Recommended.** Raise all three to 12px (rotate or thin the ticks if they collide), and extend the rule to also match `fontSize={n}` and `fontSize="n"` for n<12 in .tsx. The chart-text-goes-through-ps-text-* doctrine in globals.css:136-140 is right; it just isn't enforced for size.

### Radius, shadow and z-index have no token layer at all, and it shows: 7 radii, 26 shadows, 7 arbitrary z values

*Medium.*

**Measured.** `@theme` declares zero `--radius-*`, `--shadow-*` and `--z-*`. Rendered across 22 routes: 7 distinct border-radii, 6px ×456, 8px ×286, 4px ×282, 12px ×210, 9999px ×114, 5px ×22, 16px ×20. Source: rounded-lg ×318, bare `rounded` ×119, rounded-xl ×113, rounded-full ×68, rounded-md ×35, rounded-2xl ×9, rounded-sm ×3, `rounded-[5px]` ×2. Shadows: 26 distinct rendered box-shadows, including near-duplicate inner glows at `0 0 16px inset` and `0 0 18px inset` on five different accents. Z-index is entirely ad-hoc: z-50 ×21, z-[60] ×10, z-10 ×7, z-30 ×4, z-[70] ×3, z-[61] ×3, z-[55] ×3, z-40 ×1, z-[65] ×1, z-[80] ×1, z-[90] ×1, z-[9999] ×1, 22 of the 56 uses are arbitrary values, and `z-[61]` exists because someone needed to sit on top of `z-[60]`. Border width is the one disciplined axis: 507 rendered borders, essentially all 1px.

**Who it hurts.** Everyone. Adjacent cards have 8px and 12px corners; overlays stack by trial and error, which is how a modal ends up under a toast.

**Recommended.** Declare `--radius-{sm,md,lg,full}` = 4/8/12/9999 and refuse anything else; declare a named z ladder (`base 0, sticky 10, dropdown 30, overlay 50, modal 60, toast 70, tooltip 80`) as `--z-*` and refuse `z-[…]`. Fold the 26 shadows onto two: a resting elevation and the `glow-surface` live signal.

### The Story Weaver reader is a second, parallel design system: 13 custom properties consumed by 3 files

*Medium.*

**Measured.** globals.css:198-226 declares `--ps-reader-{dark,black}-{bg,text,panel}`, `--ps-reader-accent` (#a855f7, Tailwind purple-500, not `--color-neon-purple` #a480ff), `--ps-reader-rule`, and a five-state chapter-dot ladder (`done/writing/pending/failed/idle` = #4a3f35 / #3b82f6 / #f59e0b / #7f1d1d / var(--ps-reader-rule)). Total consumers: src/modules/rec-room/components/ReaderSettings.tsx, src/modules/rec-room/components/chapter-dot.ts, src/lib/modules/registry.ts, 15 usages. The comment at globals.css:216-221 admits the chapter ladder duplicates the app's `semantic-info/-warning/-danger` and defers the merge. Rec-room also holds 18 of the tree's 62 inline `style={{}}` sites.

**Who it hurts.** Contributors. One feature carries 13 of the app's ~29 declared colours, doubling the palette to serve three files, and the merge that would end it is documented but unowned.

**Recommended.** Keep the warm reading register, it is a deliberate and good idea for longform prose, but reduce it to three tokens (page, ink, rule) and delete the second 'black' theme (3 values, one toggle) and the parallel chapter ladder in favour of the status tokens. That removes 8 of the 13 properties and the chapter-dot module.

### Two overlapping glow systems and two identical pulse keyframes coexist in globals.css

*Low.*

**Measured.** `.glow-cyan/-purple/-green/-pink/-orange` (globals.css:249-273, 25 lines) hard-code one accent each and are used 9 times total across src. `.glow-surface` (360-384) does the same job variable-driven via `--glow-surface-rgb` and is used 28 times, and `Card.tsx` routes through it. Separately, `@keyframes ch-pulse-glow` (284-288, `50% { opacity: 0.45 }`, class `.animate-pulse-glow`, 2 uses) and `@keyframes pulse-glow` (411-417, `50% { opacity: 0.5 }`, class `.pulse-glow`, 12 uses) are the same animation with different names and a 0.05 opacity difference nobody can see.

**Who it hurts.** Contributors. Two ways to do the same thing means new code picks at random, which is how the 35 card spellings happened.

**Recommended.** Delete the five `.glow-*` classes and migrate their 9 call sites to `GlowSurface`; delete `ch-pulse-glow` and point `.animate-pulse-glow` at `pulse-glow`. About 35 lines of CSS plus one keyframe, and it leaves one glow mechanism.

### The same token at the same alpha renders in three different computed colour spaces depending on how it was spelled

*Low.*

**Measured.** Probed in the live page: `border-neon-cyan/30` computes to `oklab(0.755335 -0.0951848 -0.120285 / 0.3)`; the same colour written as an inline `rgb(0 191 255 / 0.3)` computes to `rgba(0, 191, 255, 0.3)`; and `color-mix(in srgb, …)` from viz/colors.ts computes to `color(srgb 0 0.74902 1 / 0.3)`. All three appear side by side in the rendered census (e.g. `color(srgb 0 0.74902 1 / 0.08)` cards next to `oklab(…)` cards). The values are visually equivalent, but they are not comparable as strings.

**Who it hurts.** Tooling, not users. It means no automated audit, including any contrast gate the redesign might add, can group colours reliably without normalising first.

**Recommended.** Not worth chasing for its own sake, but any new colour-audit script must parse to sRGB before comparing. Worth one helper in scripts/tooling/ shared by contrast-check.mjs and whatever the redesign adds.

### What this area could delete

Design-system layer, high confidence, ~850-1,100 lines: (1) the dead semantic layer, `surfaceClasses`/`measureClasses` in src/lib/theme.ts (14 lines), the 51-line comment block in globals.css:74-174 that documents it, and most of tests/unit/lockbook-tokens.test.ts (185 lines; the text-tier half is worth keeping, so call it ~120), ~185 lines, unless the migration is finished instead, which is the better option and is fully codemod-able (612 sites). (2) The stale bloom essay, globals.css:479-517 → ~6 lines kept, ~33 deleted. (3) The five `.glow-*` classes plus the duplicate `ch-pulse-glow` keyframe, ~35 lines of CSS and 9 call-site migrations. (4) The 22 ad-hoc state→colour maps across ~20 files, replaced by one `statusTone()` helper, ~180 lines of map literal. (5) `Button.tsx`'s own 8-slot `colorMap` (40 lines), which is a third copy of the accent map already in theme.ts; and theme.ts's own `colorBorderMap`/`focusColorMap`/`badgeBgMap`/`iconColorMap` are each consumed by 1-9 files while being forced to enumerate 8 slots, three of which (red/blue/yellow) are not house colours at all, cutting AccentColor to the five real brand slots removes ~40 more literal lines and makes the maps honest. (6) The reader register: 8 of 13 `--ps-reader-*` properties plus chapter-dot.ts, once the black theme and the parallel chapter ladder go. Component layer, larger and higher value, ~400-600 lines: 120 inline card-chrome className strings across 75 files collapsing onto `<Card>`, and the 321 raw `<button>` elements (against 104 `<Button>`) collapsing onto `<Button>`, this is where the bulk of the LoC reduction lives, and it is the same work that fixes the 35 distinct card spellings. Total realistic: 1,200-1,700 lines removed from src/ with no feature loss, plus a proportional cut in the test tree.

## The sidebar

> The rail is not hard to see because its text is dim, every text tier clears AA on it (muted = 6.18:1). It is hard to see because it has no edge (rail #0a131d vs page #041119 = 1.02:1, with two stacked 1px borders at 1.21-1.31:1, all far below the 3:1 WCAG 1.4.11 asks of a component boundary) and because 63 of its ~68 coloured elements are painted the identical white/55%, so brand tagline, section heading, nav label, icon, utility link and collapse control are all one tone and there is no hierarchy left to read.

### The rail has no visible boundary: 1.02:1 against the page

*High.*

**Measured.** Sampled from full-1280x720-expanded.png (C:/Users/Daniel/AppData/Local/Temp/claude/C--Users-Daniel-Documents-Coding-Github-PatterStage/26ae90e2-8445-4867-b1d2-cf80feb0fa02/scratchpad/rail/). Rail body composites to #0a131d (bg-dark-900/80 over #040b12, Sidebar.tsx:147). Page ground beside it is #041119. Luminance ratio 1.022:1, imperceptible. The only separation is a 2px seam: x=223 is #232b34 (the aside's own border-r, 1.31:1 vs rail) and x=224 is #1d232a (a SECOND border-r on the wrapper div at src/app/layout.tsx:110, 1.21:1 vs page). Both are far under the 3:1 WCAG 1.4.11 requires for a UI component boundary. `backdrop-blur-xl` on the aside is a no-op on desktop: computed position is `static`, so nothing is behind it, it buys a compositing layer for zero pixels.

**Who it hurts.** This is the operator's literal complaint. The rail reads as an empty left margin with words in it, not a panel. Affects every screen, every session.

**Recommended.** Give the rail a real surface: either drop it to the ground colour and paint the CONTENT area lighter, or lift the rail to a value with >=3:1 separation, plus one hairline at >=3:1 (not two at 1.2). Delete the duplicate border-r in layout.tsx:110 and delete backdrop-blur-xl from Sidebar.tsx:147.

### One tone for the whole rail: 63 elements at rgba(255,255,255,0.55)

*High.*

**Measured.** Colour census via getComputedStyle over every element in the aside (measurements2.json): rgba(255,255,255,0.55) x63, rgb(255,255,255) x34 (mostly inherited wrappers), rgb(0,191,255) x2, rgb(255,102,34) x2, white/0.92 x1, white/0.5 x1. The single 0.55 tone carries: the brand tagline (14px block), all 4 section headings (WORK/RESULTS/AGENT/REC ROOM), all 17 nav labels, all 17 nav icons, both footer utility links, and the Collapse control. Nine distinct type roles exist (brand name 14/700 Inter white; tagline 12/400 Inter 55%; heading 12/400 mono uppercase +1.2px 55%; item 14/400 Inter 55%; sub-link 12/400 Inter 55%; utility 12/400 mono 55%; quest badge 12 mono orange; collapse 12 mono 55%; version 12 mono 50%) and four of them are identical in size, family AND colour.

**Who it hurts.** There is no scannable hierarchy. Section headings do not read as headings, they read as smaller list items. Proximity makes it worse: 'Dashboard' sits 6px above the WORK heading and WORK sits 2px above 'Chat', so the heading is nearly equidistant from the group above and the group it labels.

**Recommended.** Assign real tiers: headings at ps-text-faint or a dedicated quiet tier with 8-12px more space above than below; item labels at ps-text-secondary (9.4:1) so the resting state is legible and the active state has somewhere to go; icons quieter than labels, not equal to them. Collapse the four 12px-mono roles (heading, utility, collapse, version) down to two.

### The rail overflows and CLIPS the active sub-link at 1280x720, and the guard test only covers "/"

*High.*

**Measured.** measurements.json: on /recroom/story-weaver/library at 1280x720 the nav scrollHeight is 660 vs clientHeight 571, 89px of overflow. Content bottom is y=732 against a nav bottom of y=651. The active sub-link 'Library' (y=630, h=24) is clipped 3px into its own text; Create (656), Characters (682) and Themes (708) are entirely below the fold, behind a 6px scrollbar. /agent/settings overflows by 37px, hiding 'System'. tests/e2e/rail-no-scroll.spec.ts:10 navigates to "/" only, so the 720px guarantee the Sidebar.tsx:186 comment claims is unverified on exactly the two routes that break it. See rail-sublinks.png.

**Who it hurts.** On the two routes with sub-navigation, the rail hides the sub-navigation. The operator on Story Weaver at a laptop resolution cannot see where in Story Weaver they are.

**Recommended.** Extend rail-no-scroll.spec.ts to every route in tests/e2e/app-routes.ts, not just "/". Then fix the cause, see the sub-link finding below; deleting the rail sub-link tier removes this overflow entirely.

### Collapsed nav rows are 39x22px, under the 24x24 WCAG minimum, and SMALLER than the expanded rows

*High.*

**Measured.** measurements.json, 1280x720-collapsed: every nav <a> box is x=12, w=39, h=22. The rail is 64px wide, so 25px (39%) to the right of every icon and 12px to the left are dead, clicking the rail edge does nothing. Expanded rows are 199x26. The height drops from 26 to 22 in collapsed mode because the 20px label line-height disappears and only the 16px icon plus py-[3px] remains (Sidebar.tsx:99). The footer is worse: collapsed, /quests is 38x26 at x=12.5 and /help is 26x26 at x=18.5, the two stacked utility glyphs are 6px out of vertical alignment with each other (visible in zoom-collapsed.png).

**Who it hurts.** The icons-only mode is the mode most dependent on precise pointing, and it has the product's worst hit targets. WCAG 2.5.8 (AA in 2.2) requires 24x24 CSS px.

**Recommended.** Make the collapsed row a 40x40 (or at minimum 44x44) square centred in the rail, with the icon centred in it. Same padding token drives expanded rows to >=32px. Centre the collapsed footer glyphs on the rail axis, not on flex content width.

### The collapse preference visibly un-collapses on every hard load: 224px for ~200ms

*Medium.*

**Measured.** measure3.mjs against the live instance with sidebar.collapsed=true. On "/": first paint w=224px at 16ms, still >100px through 173ms, settles at 64.6px at 266ms. On /work/missions: 224px at 7ms, >100px through 206ms, settled at 306ms. Cause: Sidebar.tsx:44 initialises `collapsed=false` and Sidebar.tsx:56-67 fetches /api/prefs client-side after mount, then `transition-all duration-200` (Sidebar.tsx:147) animates the 160px shrink, reflowing the whole main column with it.

**Who it hurts.** The operator set a preference and watches the app forget and re-remember it on every refresh and every deep link. This is exactly the 'niggling issue' class the operator named.

**Recommended.** RootLayout is already a server component (src/app/layout.tsx). Read sidebar.collapsed server-side and pass it as an initial prop, or stamp a data-rail="collapsed" attribute on <html> so the first paint is correct. Also narrow `transition-all` to `transition-[width]`, animating `all` on a 160px width change reflows every card in main for 200ms.

### aria-current lands on the parent, not on the page you are actually on

*Medium.*

**Measured.** measurements2.json, on /agent/settings/system: the top-level link href="/agent/settings" carries aria-current="page"; the sub-link href="/agent/settings/system" carries aria-current=null. Sidebar.tsx:97 sets aria-current from the prefix-matching isActive() (Sidebar.tsx:36-39); the sub-link branch (Sidebar.tsx:105-118) never sets it and signals current state with colour alone (white/0.92 vs white/0.55).

**Who it hurts.** A screen-reader user on System is told 'Settings, current page'. Sighted users get a 1.7:1 colour-only cue on the sub-link, which is also a WCAG 1.4.1 use-of-colour problem.

**Recommended.** aria-current="page" belongs on the exact-match link only; give the parent aria-current="true" or nothing. Give the active sub-link a non-colour cue (a filled left marker on the existing rule).

### The sub-link tier is 3px of indent and a 1.12:1 rule, and it duplicates navigation the destination page already has

*Medium.*

**Measured.** Measured on /recroom/story-weaver/library: parent label starts at x=50, sub-link label at x=53, 3px of indentation to carry a whole hierarchy level. The nesting rule is border-white/5 (Sidebar.tsx:104), which composites to #161f28 = 1.12:1 against the rail, invisible. Sub-links are suppressed entirely when iconsOnly (Sidebar.tsx:93), so 6 of the product's 23 rail destinations are unreachable from a collapsed rail (measurements2.json collapsedSublinks: 17 links, none of the 6 sub hrefs). Meanwhile src/app/recroom/story-weaver/page.tsx:85-99 already renders four buttons to Create/Library/Characters/Themes, and src/app/agent/settings/page.tsx:150 already advertises Models/Restore/System as cards.

**Who it hurts.** A fifth visual level that reads as an accident, that breaks the 720px budget (finding 3), that disappears when collapsed, that gets aria-current wrong, to duplicate navigation the page itself already provides.

**Recommended.** Delete sub-links from the rail (removes ~25 lines from Sidebar.tsx, the NavSubLink type from src/lib/modules/types.ts, and the 1280x720 overflow). If a redesign keeps them, they need real indentation (>=16px), a >=3:1 rule, and their own aria-current.

### The active and hover chips are 1.31:1 and 1.12:1, the state is carried almost entirely by the label tone

*Medium.*

**Measured.** Sampled: active row bg-white/10 composites to #232b34, 1.31:1 against the rail #0a131d. Hover bg-white/5 = #161f28, 1.12:1. WCAG 1.4.11 asks 3:1 of a graphical state indicator. The active row does also flip the label from white/55 to white/100 and the icon to its registry accent (e.g. #00bfff at 8.81:1), which is what actually makes it readable, but the chip itself is inset 12px from the rail edge (nav px-3), so there is no edge-anchored 'you are here' marker at all.

**Who it hurts.** 'You are here' works, but weakly, and hover feedback is effectively absent, at 1.12:1 the operator gets no confirmation the row is live before clicking.

**Recommended.** Keep the accent-icon-on-active idea (it is the best thing in the rail). Add an edge-anchored active marker, a 3px accent bar flush to the rail's left edge in the item's registry colour, and raise the hover chip to something perceivable (white/8 minimum, or a border).

### Density is tuned for 720p and wastes 385px at 1080p

*Medium.*

**Measured.** measurements.json across three viewports: rows are 26px tall at 26px pitch with zero gap (py-[3px], Sidebar.tsx:99), headings 16px. Content ends at y=626 in every case. Nav bottom is 651 at 1280x720 (25px slack, 3.5% of the rail), 831 at 1440x900 (205px, 22.8%), 1011 at 1920x1080 (385px, 35.6%). Collapsed at 1920x1080: 465px of slack, 43.1% of the rail. Brand block is a fixed 80px (11.1% of a 720px viewport) for a 32px logo. Footer is a fixed 69px.

**Who it hurts.** Simultaneously starved and wasteful. The 26px row was chosen to survive the worst case and then applied to every case, so on the machines most operators actually use, a third of the rail is empty while the rows are still cramped.

**Recommended.** Make row height responsive to available height (a container query or a simple two-step: 26px under ~800px tall, 32-36px above), or spend the 1080p slack on something, pinned/recent destinations, a status block. Reclaim the fixed 80px brand block: on a collapsed rail it holds one 32px glyph.

### The footer is a third layout language, and truncates the string it makes two network calls to fetch

*Medium.*

**Measured.** measurements.json 1280x720-expanded: /quests is 125.7x24 and /help is 69.3x24, two ghost buttons of unequal width sitting on a 26px nav rhythm they do not share. The version span is 95.4px wide and renders 'v0.1.0 · 1c3…', truncated (visible in zoom-expanded.png). RailFooter.tsx:37-51 fires /api/status/runtime AND /api/update on mount to produce that string. Across a cold load the rail chrome accounts for 5 of the page's 6 API calls: /api/prefs (collapse), /api/feature-flags (link visibility), /api/status/runtime (version), /api/update (badge), /api/stats (quest badge), measured on /recroom/story-weaver/library, whose own data is one call.

**Who it hurts.** The most-visited chrome in the product costs five round-trips per hard load, and the visible result of two of them is an ellipsis.

**Recommended.** Fold the version/update check into the /api/stats poll the rail already makes (removes 2 requests and ~20 lines from RailFooter.tsx). Put the version on its own full-width line or move it to Settings > System where the update lives anyway. Give Quests/Help the same row geometry as nav items instead of inventing a two-up ghost-button row.

### The mobile header still brands the product 'PT / Hermes'

*Low.*

**Measured.** src/components/layout/MobileHeader.tsx:29-31 renders 'PT' + '/' + 'Hermes'. Confirmed on the live instance at 390x844 (zoom-mobile-header.png). The desktop rail two lines away says 'PatterStage / The Stage is Yours' (Sidebar.tsx:175-181). The dashboard page header at 1920 also reads 'Hermes AGENT FRAMEWORK' (full-1920.png). MobileHeader also re-implements the rail's animated-border logo lockup at w-7 h-7 against the rail's w-8 h-8, the same mark, two sizes, two files.

**Who it hurts.** The rename is visibly incomplete on the first thing a phone user sees. Two brand lockups drift independently.

**Recommended.** Fix the string. Extract the logo lockup into one <BrandMark size> component used by both Sidebar and MobileHeader.

### 18 of 37 declared nav icons are unused, and the ICONS map keeps every one in the bundle

*Low.*

**Measured.** src/lib/modules/types.ts:40-51 declares 37 IconName variants; `grep -o 'icon: "..."' src/lib/modules/registry.ts | sort -u` returns 19. The 18 dead ones (Sparkles, Cpu, Lock, RotateCcw, Activity, Layers, HardDrive, Globe2, Code, Shield, ShieldCheck, AudioLines, Mic, Volume2, GitBranch, ListTodo, Network, Settings2) are imported at sidebar-config.ts:16-22 and held in a live const map (sidebar-config.ts:54-64), so the bundler cannot drop them. Sidebar.tsx also imports iconColorMap from src/lib/theme.ts for exactly one use, colouring the active icon, when the registry link already carries `color`.

**Who it hurts.** 18 unnecessary lucide components in the chunk that loads on every page, plus a stale union that suggests options that do not exist.

**Recommended.** Trim IconName to what the registry uses and let the compile error (the map is exhaustive by design) enforce it. Resolve the accent class from the link's own colour rather than importing a global map.

### What this area could delete

Realistically ~130-180 lines from the rail's own 618 lines across 7 files in src/components/layout/, plus 2 of the 5 chrome API calls per page load. Concretely: (1) the sub-link tier, the `showSubs` branch and its render block in Sidebar.tsx:93, 102-118, the NavSubLink type and subLinks field in src/lib/modules/types.ts, and the subLinks arrays in registry.ts (~35 lines total); both destinations already have full in-page navigation (story-weaver/page.tsx:85-99, settings/page.tsx:150), so nothing is stranded, and the 1280x720 overflow and the aria-current bug both disappear with it. (2) 18 unused IconName variants plus their lucide imports and ICONS entries (sidebar-config.ts:16-22 and 54-64, types.ts:40-51), ~18 lines and 18 components out of the shared chunk. (3) RailFooter's /api/update fetch folded into the /api/stats poll the rail already makes, ~20 lines and one request (RailFooter.tsx:44-49). (4) The Home-section double partition: `utilityLinks` at Sidebar.tsx:80 filters Home one way and the nav map at Sidebar.tsx:200 filters it the complementary way; declaring a `utility` section in the registry removes both filters (~6 lines). (5) The `iconColorMap` import and lookup (Sidebar.tsx:29, 101) in favour of the colour the link already carries. (6) One of the two stacked border-r declarations (layout.tsx:110 vs Sidebar.tsx:147) and the no-op `backdrop-blur-xl`, 2 tokens. (7) ~45 of the 69 comment lines across Sidebar.tsx (23), RailFooter.tsx, QuestBadge.tsx and sidebar-config.ts are historical narration about defects already fixed ("it used to be rendered twice…", "which is why the icon-button gate once counted…") rather than documentation of current behaviour. Separately, src/components/layout/BranchDropdown.tsx (105 lines) is misfiled, its only consumer is src/components/system/DeployControls.tsx:132, so it should move out of layout/ rather than be deleted.

## Alignment, sizing and spacing, screen by screen

> PatterStage has no shared page geometry: the sticky header sits at a fixed x while every page centres its own content in one of seven different widths, so on 24 of 25 screens the h1 does not share a left edge with the page beneath it (offsets from -102px on /agent/settings to +289px on /results/logs). Underneath that, every surface in the app, the rail included, is within 1.06:1 of the page background, which is the operator's "the sidebar is quite hard to see" expressed as a number.

### Every container in the app is invisible; only hairlines separate anything

*High.*

**Measured.** Measured composites over --color-dark-950 #040b12 (src/app/globals.css:29-31). Rail <aside> is dark-900/80 → rgb(10,19,29) = 1.06:1 against the page. Its only edge is a 1px white/10 border = 1.25:1. The ACTIVE nav item's background (bg-white/10) is 1.298:1 against the rail, effectively no highlight. Card surfaces dark-900/40, /50, /60 measure 1.027, 1.035, 1.042:1 against the ground; their white/10 borders are 1.28:1 and the 27 places using white/05 borders are 1.11:1. Text is fine: ps-text-muted (white/55) is 6.21:1, ps-text-faint 5.33:1. So the tokens pass the project's own contrast script while the containers are invisible.

**Who it hurts.** This is the root cause of the operator's complaint. The rail does not read as a panel, the selected item does not read as selected, and 73 distinct card treatments all render as the same faint rectangle. It affects all 25 screens.

**Recommended.** Give the rail a real surface (target ≥1.6:1 vs the ground, e.g. #0f1a26 opaque, no backdrop-blur) and give the active item a left accent bar or a ≥3:1 fill plus its accent icon colour. Introduce two real elevation steps (ground / panel / raised) with measured deltas rather than 4-6% alpha washes. Keep the text tokens, they are already correct.

### The page title never lines up with the page content

*High.*

**Measured.** PageHeader (src/components/layout/PageHeader.tsx) is a full-width sticky bar with px-6, but each page centres its own body. Measured h1 left edge takes 8 values at 1440px: 89, 281, 328.5, 371.6, 388.4, 405.2, 438.8, 461.4, it moves 158px depending on whether the page passes backHref (back arrow + label + divider are rendered before the icon, lines 63-84). Delta between the h1's left edge and the page's dominant content edge: /agent/settings -102px, /agent/models -90px, /sw-library -51px, /results/artifacts -43px, /quests +162px, /results/logs +289px. Only /help is 0.

**Who it hurts.** The single most visible 'not aligned correctly' defect. On /quests the word 'Quests' floats 162px left of everything it names, with a 184px empty gutter between the rail edge (x=225) and the first card (x=409).

**Recommended.** Move the measure into the shell: one container element that both PageHeader's inner content and the page body sit inside, so the h1 and the first card always share x. Put the back link above the title or as an icon-only affordance in a fixed-width slot so it cannot shift the h1.

### Seven different content widths and eight different left gutters across 25 screens

*High.*

**Measured.** Measured body widths at 1440: 1215px (14 screens, full-bleed), 1280 (/), 1152 (/agent/models, /help), 1120 (/work/research), 1024 (/agent/tools, /sw-home, /sw-library), 896 (6 screens), 854 (/results/artifacts). Left gutters: 0 (×14), 32, 48, 96 (×2), 160 (×6), 180, 191. In code: max-w-3xl ×10, max-w-4xl ×9, max-w-5xl ×5, max-w-6xl ×4, max-w-2xl ×4, max-w-screen-xl ×2, max-w-7xl ×2, 36 uses of 7 tokens, and 11 screens with no max-width at all. 22 files declare their own container inside AppPageShell (src/components/layout/AppPageShell.tsx), which owns no measure.

**Who it hurts.** Line length changes on every navigation. /results/artifacts uses 854 of 1215px (59%); /agent/settings/system uses 896 (62%); /work/scripts uses all 1215. Nothing feels like the same application.

**Recommended.** Pick two measures, a wide one for boards/tables (~1280) and a reading one for forms/settings (~896), put them in AppPageShell as a prop, and delete all 36 per-page max-w literals.

### 37 distinct button specifications; the Button component is bypassed 321 times

*High.*

**Measured.** Across the 25 screens I measured 37 distinct (height × padding × radius × font-size) button combinations and 34 distinct rendered control heights: 16,17,20,21,22,24,26,28,30,32,34,36,38,40,42,44,48,50,52,54,58,62,66,76,78,86,94,100,117,126,130,146,154,173px. src/components/ui/Button.tsx:70-73 defines exactly three sizes (sm/md/lg) and is imported by 38 files, while the tree contains 321 raw <button> tags with hand-written padding (px-3 py-2 ×91, px-4 py-3 ×46, px-3 py-1.5 ×45, px-2 py-1 ×41, px-4 py-2 ×37, and 15 more). Worst single rows: /agent/profiles puts 30px/1px-border/8px-radius buttons 20px away from 24px/0-border/0-radius ones doing the same verb (Push all vs Push default); /agent/memory puts a 42px search input beside three 62px buttons; /results/logs' header holds a 16px '?', a 28px icon button and two 30px buttons at y=31.5/25.5/24.5/24.5.

**Who it hurts.** Buttons of different heights sit side by side in almost every toolbar. This is most of the 'not sized correctly' complaint.

**Recommended.** Adopt Button everywhere (3 heights: 26/32/40), give icon-buttons a square variant at the same heights, and add a lint rule banning padding utilities on <button>. This alone removes ~400-700 LoC of className.

### StatStrip renders two bookend rings at different diameters with three different top offsets, on 8 screens

*High.*

**Measured.** src/components/viz/StatStrip.tsx:86 wraps `grid grid-cols-1 items-center gap-5 rounded-2xl ... p-4`; line 90 renders `<Donut size={96}>` and line 100 `<ProgressRing size={84}>`. Measured on /results/sessions: grid-template-columns `96px 913px 84px`, strip 130px tall; the three columns land at y=121, y=141 and y=127, 16px, 36px and 22px from the strip's top edge. The left ring is 12px larger than the right. Present on /work/missions, /results/sessions, /results/logs, /agent/skills, /agent/tools, /agent/memory, /agent/models (+ /agent/profiles' variant). MissionInsights.tsx:53-79 is a verbatim copy of the same 96/84 markup rather than a StatStrip call (87 LoC).

**Who it hurts.** The most-repeated component in the product is visibly asymmetric on eight screens, and costs 130px of vertical space to display six numbers.

**Recommended.** Make both rings the same diameter, align the three columns to a shared top or baseline instead of items-center, and cut the strip to ~88px. Replace MissionInsights' copy with a StatStrip call.

### /results/insights: a 1,000px empty span between each label and its number

*High.*

**Measured.** 'THIS MONTH, BY SOURCE' renders four justify-between rows. Measured: 'Agent runs' ends at x=168, its value begins at x=1191, a 1023px gap. Composer stages 1021px, Deep Research 999px, Story Weaver 1045px. No leader dots, no rule, no column. Above it the streak row gives its left group flex-1 (1151px measured) to render roughly 110px of ink (a flame and '3 days / best 3'), pushing four stat tiles to the far right edge. The activity chart is 1293px wide with all its data in the right ~10% and no axis.

**Who it hurts.** Unreadable: the eye cannot carry a label 1000px to its number. This is the worst single readability defect measured.

**Recommended.** Cap these lists at a ~640px measure, or make them a two-column table with the values in a fixed right column. Do not use justify-between across a full-width card.

### /quests: three concentric card borders and a ragged title edge

*High.*

**Measured.** Measured card left edges 409 / 426 / 443 and right edges 1257 / 1240 / 1223, three nested bordered boxes, 17px apart, on the busiest list in the app. Quest titles start at x=516.9 when the status word is 'COMPLETE' (71px) and x=493.5 when it is 'TO DO' (47px), so the title column zig-zags 23.4px down the list. 'Go' (54.4×26px) and 'Skip' (50.8×26px) are stacked vertically 9px apart instead of sitting in a row. The whole page runs in 896px of a 1215px column with 160px gutters.

**Who it hurts.** The onboarding screen, the one a new user is steered to, looks the least resolved.

**Recommended.** One card level, not three: chapter as a heading + rule, quests as flat rows. Give the status word a fixed-width column so titles align. Put Go and Skip in a row.

### Three different page-header treatments across 25 screens

*High.*

**Measured.** 22 screens render PageHeader full-bleed at x=225, w=1215, h=80, sticky. /results/artifacts renders it INSIDE its centred column at x=405.4, w=854.2, its bottom rule stops 180px short of both viewport edges. /work/research does the same at x=272.5, w=1120. /(dashboard) has no <header> element at all; it writes its own bar with a cyan 'Hermes' wordmark and no page icon. /agent/skills' header is 83px, not 80px, because a 54px profile picker in the actions slot outgrows the 80px min-height.

**Who it hurts.** The one element that should anchor every screen is one of four things.

**Recommended.** Always full-bleed, always outside the measure, fixed 72-80px, actions constrained to a single control height so the bar cannot grow. Convert the dashboard to PageHeader.

### No vertical rhythm: eight section-gap values, and six screens use three of them at once

*Medium.*

**Measured.** Gaps between top-level sections, all 25 screens: 24px ×25, 32px ×18, 16px ×8, 20px ×6, 40px ×5, 12px ×3, 8px ×2, 0px ×1. Within one screen: /agent/models 40,40,20,24,40,40,40; /agent/tools 16,20,24; /agent/profiles 16,20,16; /results/sessions 24,24,12; /work/scripts 20,32; /sw-characters 8,24. Only / (24×7) and /agent/settings (32×9) are internally consistent.

**Who it hurts.** Sections do not group; the eye cannot tell what belongs to what.

**Recommended.** One section gap (32px) and one intra-section gap (16px), applied by a Stack/Section primitive rather than per-page space-y and mb-* utilities.

### 21 distinct card padding/radius pairs; 71 files hand-roll card chrome while Card is used by 10

*Medium.*

**Measured.** Measured across the 25 screens: radii 8/12/16px combined with paddings 0/6/8/10/12/16/20/24px, 21 distinct (padding, radius) pairs, and 73 distinct full chrome signatures counting border and background alpha. `grep -rl 'rounded-(lg|xl|2xl).*border.*bg-dark-900'` matches 71 files; src/components/ui/Card.tsx is imported by 10. 454 className strings in src are ≥80 chars, 201 are ≥120.

**Who it hurts.** Nine components can look like nine products. It is also the largest single source of LoC bloat.

**Recommended.** Three card variants (flat / panel / raised), two paddings (16/24), one radius (12). Migrate the 71 files; expect 500-800 LoC removed.

### 12px monospace is the app's default body text

*Medium.*

**Measured.** Font inventory across all 25 screens: 1485 text nodes at 12px/400 JetBrains Mono, next largest bucket 241 at 12px Inter, then 202 at 14px Inter. 28 distinct size/weight/family combinations in total. h1 is stable at 20px/700 Inter on all 25 (good), but h2 has 10 treatments: 12/400/upper/1.2px, 12/400/upper/0.6px, 14/400/upper/1.4px, 14/400/upper/0.7px, 14/700/upper/0.7px, 14/400/none, 14/600/none, 16/600/none, 18/600/none, 18/700/none. /agent/settings/restore uses three h2 sizes on one page. /help is the only screen with 16px Inter body copy.

**Who it hurts.** Dense, hard to read, and section headings carry no consistent weight, so scanning a long screen is slow.

**Recommended.** Keep mono for values, IDs, paths and logs. Make prose 14px Inter minimum. Collapse h2 to one treatment (13px/600 uppercase mono, 0.08em) and h3 to one.

### Text truncated by ellipsis loses up to 138px of its content while the page has 300px of unused width

*Medium.*

**Measured.** /agent/models: eight `.truncate` subtitle lines clip, 'Auto-naming sessions, threads, and…' loses 138px, 'Memory recall + reflection (knowle…' 137px, 'Primary mission model, drives `he…' 118px, 'Routing requests to the right spec…' 116px, inside a max-w-6xl column with 32px gutters. /work/missions: a card title loses 394px. / (dashboard): 'last tick 2s ago · pid 21260' loses 69px, the gateway URL 18px. /agent/settings: the section filter's placeholder ('Find a setting by name, e.g. reasoning, timeout, voice…') is clipped by a 448px input sitting in a 1167px column.

**Who it hurts.** Information is being thrown away in order to fit a column that is narrower than the space available.

**Recommended.** Widen or wrap. Where truncation is genuinely needed, add a title attribute and drop the fixed narrow column.

### /agent/tools: max-w-5xl with no mx-auto, 191px of dead space on the right only

*Medium.*

**Measured.** Measured: content column x=225 → right=1249 inside a main of x=225 → right=1440. Class string is `px-6 py-6 max-w-5xl` (no mx-auto). Same page: the Profile column measures 288×70px beside a toolsets column of 638×252, a 182px height difference, the largest sibling spread on any screen, leaving ~180px of empty column under a single select.

**Who it hurts.** The page reads as if it fell over to the left.

**Recommended.** Add mx-auto (or better, remove the max-w and let the shell own it). Move the profile picker into the header's actions slot and let the toolsets use the full width.

### Dashboard: one tile in a row of six breaks the baseline, and another has an opaque white border

*Medium.*

**Measured.** Six status tiles, all 184.5×86px at x=249/445.5/642/838.5/1035/1231.5. Five put their label at y=489 and value at y=505; the 'Processes' tile (2 lines of content instead of 3) puts them at y=497 and y=513, an 8px break across the row because the tile centres its content. The 'Spend' tile's border-color computes to rgb(255,255,255), opaque white, while the other five use 20%-alpha accent colours; it reads as a focus ring left on.

**Who it hurts.** The first screen a user sees has a visibly crooked row.

**Recommended.** Top-align tile content (or pad short tiles to three lines) and normalise the emphasis border to the same alpha convention as its neighbours.

### /results/sessions: the same 'open' affordance sits at three different x in one list

*Medium.*

**Measured.** Measured chevron left edges in the session list: 1277, 1383, 1400, grouped mission rows put it at 1277 with a separate '↗ Mission' button at 1316, ungrouped rows put it at 1383/1400. Same list, same scroll, three right edges. The filter row is worse: a 42px search input beside seven controls that measure h=24, padding 4px 8px, border-width 0px, the unselected filters have no chrome at all, only the selected one gets a background, so 'CLI / Mission / Subagent / Failed' read as labels rather than controls.

**Who it hurts.** The user cannot learn where to click.

**Recommended.** One trailing affordance per row at a fixed right offset. Give filter chips a resting border so they read as controls.

### Four different tab idioms across four screens

*Medium.*

**Measured.** /work/composer: uppercase mono with a cyan underline (34px). /agent/profiles: sentence-case with an underline (Identity/Files). /agent/memory: filled purple pill for active, plain text with icons for inactive (32px). /recroom/story-weaver: four 54px bordered buttons acting as tabs that duplicate the rail's own sub-items (Library/Create/Characters/Themes appear in both places).

**Who it hurts.** Nothing transfers between screens; the user relearns navigation on each.

**Recommended.** One Tabs component, underline variant, mono uppercase to match the section headings. Delete the Story Weaver button row, the rail already carries it.

### /work/composer and /work/chat put two different gutters on one page

*Medium.*

**Measured.** /work/composer: header ends y=80, tab strip starts y=96 (16px gap, every other screen's header-to-content gap is 0), content starts y=146. Horizontally the upper card starts at x=243 while the lower half (RUNS list + run detail) is edge-to-edge at x=225. An empty zero-size div sits between the blocks. /work/chat: the conversation panel is flush at x=225 with no gutter and full-bleed rows, while the message pane's content starts at x=489.

**Who it hurts.** Panels appear welded to the sidebar on some screens and inset on others.

**Recommended.** Decide one rule, full-bleed split panes OR gutter-inset cards, and apply it to chat, composer, research and logs, which are all the same split-pane shape built four times.

### /recroom/story-weaver/create: one title in a row of four sits 8px higher than its neighbours

*Medium.*

**Measured.** Four template cards, all h=76 at y=161 in a 4-column grid. Title y positions: 182, 182, 174, 182. The third card ('The Frozen Colony') has a three-line genre list, and because its content is vertically centred inside the stretched cell, its whole block rises 8px. Same screen: the story-title input is 54px tall at 18px in `ui-serif`, the only serif text in the entire application and the only 54px input; chips come in two heights (26 and 30) across 40 of them; five labelled sections and zero <h2>.

**Who it hurts.** A grid of cards that ought to be the calmest thing on the screen is visibly uneven.

**Recommended.** items-start on card content (or a fixed-height meta line). Decide whether the serif is a deliberate 'story' cue, if so, apply it consistently in the Rec Room; if not, remove it.

### Six screens ship a layout shift at or near the failing threshold

*Medium.*

**Measured.** Measured CLS with a buffered layout-shift observer at 1440×900, 3.5s after domcontentloaded: /agent/settings/restore 0.116 (fails the 0.1 threshold), /results/insights 0.099, /agent/tools 0.096, /agent/skills 0.094, /agent/settings/system 0.091, /work/composer 0.068, /agent/settings 0.044. Nine screens are 0. The shifts land at t=150-250ms, i.e. skeletons that do not reserve the height of what replaces them.

**Who it hurts.** Content jumps under the cursor on the settings screens, which are the ones people click through fastest.

**Recommended.** Give the loading state the same measured height as the loaded state, most of these are the StatStrip (130px) and the card grids (154px rows).

### /results/artifacts wastes 41% of the content column and 400px of page height

*Medium.*

**Measured.** Header inset to x=405.4/w=854.2 (see the header finding). 8 artifact cards at 94px in a 3-column grid spanning 854px of a 1215px column; the last row leaves a 555px hole; the page's main scrollHeight is 900 = exactly the viewport, with content ending at y≈497. The toolbar band above is 100px tall to hold one count ('8 ARTIFACTS') and one select.

**Who it hurts.** A list screen that shows eight items in half the space available.

**Recommended.** Full-width grid at the wide measure (4-5 columns at 1440), toolbar collapsed into the header's actions slot.

### /agent/memory and /work/research: form rows where controls of three heights share one line

*Medium.*

**Measured.** /agent/memory: a 42px search input beside Recall/Reflect/Add Memory at 62px each, a 20px mismatch, with the buttons centred against the input plus its 'Press Enter to search' hint. HOST/PORT/BANK fields measure 494/116/494px. Two label idioms in one form: 'Provider' at 14px sentence case, 'HOST/PORT/BANK' at 12px uppercase mono. /work/research: MODEL/SEARCH/DEPTH/BREADTH row mixes 38px and 50px controls because two of them carry a caption underneath; the PRESETS block stacks controls at widths 139/446/60 and heights 38/38/30, with 'Start research' floating on a different baseline 200px to the right.

**Who it hurts.** Forms look assembled rather than designed; the fields do not scan as a row.

**Recommended.** One field height (38px), captions above not below, and a Field primitive that owns label + control + hint so the row cannot drift.

### /work/missions: the board is clipped at the viewport edge with no affordance

*Medium.*

**Measured.** The five-column kanban overflows its container: at 1440 with the rail expanded the 'Walk B17 mi…' card is cut mid-word at x=1416 and the FAILED column header shows no count badge; with the rail collapsed the same card reads 'Cancelled 19h 24m a'. The container is a scrollable but paints no edge fade or scroll hint. The page also has no max-width in effect (max-w-screen-xl renders at 1215), so its line length changes by 136px when the rail is toggled.

**Who it hurts.** Content is silently hidden on the app's busiest screen.

**Recommended.** Either fit five columns to the measure or add a visible horizontal scroll affordance (edge fade + arrows) and pin the column headers to their cards.

### The collapsed rail is 17 indistinguishable 16px glyphs, and its state is persisted server-side

*Low.*

**Measured.** Collapsed measures 64px with links at x=12, w=39, h=22, all at rgba(255,255,255,0.55) with no group separators and no labels. The Sessions clock, Artifacts, Insights and Logs icons are four near-identical monochrome glyphs. Collapsing in one browser and then opening a brand-new browser context showed the rail still at 64px, the preference is stored per install, not per browser.

**Who it hurts.** In the state the operator may well be running, the rail is both invisible (1.06:1) and unreadable.

**Recommended.** Keep group separators in the collapsed rail, add tooltips, and give the active item the accent bar. Consider whether the collapse preference should be per-browser.

### /help calls itself Documentation, and its in-page nav is inset differently from every other screen

*Low.*

**Measured.** The rail entry and the tab title say 'Help'; the h1 says 'Documentation'. Its 40-link in-page nav column runs x=281→504, inset 56px from the main's left edge where every other screen uses 24px, with no rule or surface separating it from the content at x=529. It is also the only screen where the h1 and the content share a left edge (both 281) and the only one with 16px Inter body copy.

**Who it hurts.** Minor naming inconsistency on an otherwise well-built screen.

**Recommended.** Name it once. Keep the typography, it is the model for what the rest of the app's prose should look like.

### What this area could delete

"Roughly 1,500-2,500 LoC out of 36,344 tsx LoC (4-7%) can go without removing a single feature, plus a large drop in variant count. (1) Card chrome: 71 files hand-roll `rounded-* border bg-dark-900/*` against 10 that import ui/Card; consolidating to three variants collapses 73 chrome signatures and 21 padding/radius pairs, ~500-800 LoC. (2) Buttons: 321 raw <button> tags with hand-written padding against 38 files importing ui/Button; adopting Button collapses 37 button specs to 3, ~400-700 LoC. (3) Page containers: 36 max-w-* literals across 7 tokens in 22 files that already sit inside AppPageShell; moving the measure into the shell removes all of them plus their justifying comments, ~150-250 LoC. (4) Layout literals generally: 454 className strings are ≥80 chars and 201 are ≥120; a Stack/Section/Field primitive absorbs most of them. (5) Duplicate components: MissionInsights.tsx:53-79 is a verbatim reimplementation of StatStrip.tsx:86-100 (87 LoC → one call site); AgentPerformanceStrip.tsx (78 LoC) is a third copy of the same strip. (6) Routes: /recroom/story-weaver/characters (404 LoC) and /themes (311 LoC) are two full rail-reachable routes each rendering a single empty state and one button inside an 896px column, fold them into Story Weaver as tabs and delete the four duplicate nav buttons on its home page, ~500 LoC. (7) The dashboard's bespoke header bar (the only screen with no <header>) can become a PageHeader call. (8) The split-pane 'list + detail + form' shape is built independently four times in chat, composer, research and logs; one shared layout would retire three of them, though that is a refactor rather than a deletion."

## The component layer

> The component layer is not a library: only 25 of 212 components have four or more callers and 144 have exactly one, so new work has almost nothing to reach for and hand-rolls instead -- 321 raw buttons in 113 files against 104 uses of the shared Button, and 234 inline card chromes against 10 uses of the shared Card. The live consequence, measured across 25 routes, is 266 card surfaces in 47 distinct chromes and 307 buttons in 20 distinct heights. That variance IS the operator's "not formatted/aligned/sized correctly"; it is not a taste problem, it is an arithmetic one.

### There is no shared card. There are four, plus 234 hand-rolled copies, producing 47 distinct card chromes on 25 screens

*High.*

**Measured.** Shared surfaces: src/components/ui/Card.tsx (10 callers), src/components/dashboard/Panel.tsx (9), src/components/ui/GlowSurface.tsx (5), src/components/ui/TemplateCard.tsx (1). Against that, 234 inline `rounded-{lg,xl,2xl} + border + bg-` class strings across 113 files. Live measurement (Playwright, 1600x1000, 25 routes): 266 rendered card-like surfaces with 47 distinct (radius | border | background) combinations and 8 distinct paddings (16px x86, 12px x48, 20px x43, 8/12px x29, 0 x23, 12/16px x14, 6/10px x5, 24px x4). The three most common are the same intent rendered three ways: radius 12px + white/0.1 border + dark-900/0.4 bg (54), the identical thing at dark-900/0.5 (48), and 12px + white/0.05 + white/0.02 (27). That 0.4-vs-0.5 split is 102 surfaces where nobody made a choice. Worst files: WorkflowCanvas.tsx (11 inline cards), story-weaver/create/page.tsx (9), ReaderHeader.tsx (8), ScheduledMissions.tsx (8), SpendPanel.tsx (6), ScriptRow.tsx (6).

**Who it hurts.** This is the single largest source of the 'doesn't look right' feeling. Three cards at 8px, 12px and 16px radius sit on the same screen (/results/insights, /agent/models, /agent/skills, /results/logs all render all three). Any global surface change is a 113-file edit, so it never happens.

**Recommended.** One `Surface` primitive with `accent`, `tint`, `padding`, `header` props, absorbing Card + Panel + PanelHeader + GlowSurface + TemplateCard. Ban bare `rounded-* border bg-*` in a lint rule (the project already has design-lint infrastructure with disable-comments, so the mechanism exists). One radius for cards, one for controls.

### 321 raw <button> elements in 113 files against 104 uses of the shared Button: 20 distinct button heights and 59 distinct button chromes render live

*High.*

**Measured.** src/components/ui/Button.tsx has 38 importers / 104 `<Button` usages. Raw `<button` appears 321 times in 113 files. Measured live across 25 routes: 307 buttons under 60px tall with 20 distinct heights (16,17,20,21,22,24,26,28,30,32,34,36,38,40,42,44,50,52,54,58px), 6 radii (8px x186, 0px x46, 6px x45, rounded-full x12, 4px x11, 12px x7), 3 font sizes and 2 font families (241 JetBrains Mono, 66 Inter -- the 66 opted out of Button's hardcoded `font-mono`). 59 distinct full chromes. Only heights 30 and 38 come from the shared Button (sm/md); those account for 128 of 307. Separately, 110 of the 321 raw buttons carry no `type=` attribute, so inside a form they default to submit -- Button.tsx:101 hardcodes `type="button"` correctly. Raw-only offenders that never import Button: story-weaver/create/page.tsx (14), story-weaver/characters/page.tsx (11), ReaderHeader.tsx (10), MissionsList.tsx (10), story-weaver/themes/page.tsx (10), FallbackChainList.tsx (8), CategoryManagerModal.tsx (8).

**Who it hurts.** Nothing in the product has a consistent click target. Adjacent controls differ by 4-12px in height, which reads as misalignment. The 110 missing `type` attributes are a live bug class.

**Recommended.** Extend Button with the two variants people are hand-rolling (bare icon button, text link button) so there is no reason to reach for `<button`, then convert. Lint `<button` outside src/components/ui.

### Three Selects, three Toggles, six field labels and five near-identical dropdown 'Selector' components all ship as shared primitives

*High.*

**Measured.** Select: src/components/ui/field/Select.tsx (accessible listbox, bg-dark-900/0.8, 10 importers), src/components/ui/Select.tsx `InlineSelect` (native <select>, bg-dark-900/0.5, 1 caller: ChatModelSelector.tsx:10), src/components/ui/Input.tsx:324 `Select` (label wrapper, 2 callers). Plus 28 raw `<select>` in 16 files. Toggle: ui/Input.tsx:224 `Toggle` and :278 `InlineToggle` (a 36x20 sliding switch) vs ui/field/Toggle.tsx (a pill button with a status dot) -- same job, unrelated appearance. Field labels, six implementations: ui/field/Field.tsx:66 `text-xs font-medium uppercase tracking-wider text-ps-text-muted`; ui/Input.tsx:91 `text-sm font-medium text-ps-text-secondary`; MissionComposerLayout.tsx:8 `text-xs text-ps-text-muted font-mono block mb-1.5`; ComposerGatePrompt.tsx:27 and ComposerNodeRunDetail.tsx:30 (byte-identical `text-xs font-mono uppercase tracking-widest text-ps-text-muted`); rec-room/Tags.tsx `text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5`; plus insights/page.tsx:57 as an h2. Live: 6 distinct label styles measured, letter-spacing 0.3/0.6/1.2px, weight 400/500. Selectors: ui/ProfileSelector (179L), SkillSelector (155L), ToolsetSelector (140L), TimeoutSelector (110L), MissionTimeSelector (100L) = 684 lines, all rendering the identical trigger chrome `w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm hover:border-white/30` plus an identical compact `px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono` variant, each with its own click-outside effect, none of them keyboard-accessible.

**Who it hurts.** Form-heavy screens are visibly two products. A form built from ui/Input has 14px sentence-case labels; a form built from ui/field has 12px uppercase tracked labels. Five dropdowns look like the accessible one and are not.

**Recommended.** Delete ui/Select.tsx and ui/Input.tsx (354L; its TextInput/NumberInput/Toggle/Select are consumed by exactly one file, components/config/ConfigField.tsx). Keep the Field Kit as the only form layer. Collapse the five Selectors into one `Picker` taking icon, accent, options, and a `multi` flag -- 684 lines to roughly 180.

### Only 25 of 212 components have four or more callers; 144 have exactly one. Eight of the 29 files in components/ui have one caller or none

*High.*

**Measured.** Caller counts computed by grepping each component's import path across src. Histogram: 1 caller x144, 2 x29, 3 x13, 4 x5, 5-11 x9, 14+ x7. The genuinely shared set is: Button 38, AppPageShell 29, PageHeader 28, Toast 26, LoadErrorBanner 26, LoadingSpinner 25, Modal 14, ConceptHint 14, ConfirmButton 11, Card 10, Badge 10, Panel 9, field/Input 8, ui/Input 8, LedgerRow 7. Misplaced in components/ui with <=1 caller: CollapsibleSection, ErrorBoundary, MissionTimeSelector, Pagination, TemplateCard, TimeoutSelector, ToolsetSelector, Select(InlineSelect), field/Toggle. There is no shared Tabs, no shared Table, no shared Skeleton, and EmptyState is buried as a named export inside ui/LoadingSpinner.tsx (11 call sites; ~21 more empty states are hand-rolled inline across 10 files).

**Who it hurts.** src/components is not a component library, it is 192 named fragments of 29 pages. New work has nothing to reach for, so it hand-rolls, which is why the ad-hoc counts above are what they are.

**Recommended.** Split the tree explicitly: `ui/` = only things with >=3 independent callers; `features/<domain>/` = the rest. Move EmptyState into its own file. Add the three primitives that do not exist: Tabs/SegmentedControl, DataTable, Skeleton.

### Modal and Sheet do the same job with different header typography, and 12 more overlays are hand-rolled around them

*Medium.*

**Measured.** ui/Modal.tsx:69 titles are `text-lg font-bold text-white`; ui/Sheet.tsx:74 titles are `text-sm font-mono text-neon-cyan uppercase tracking-widest`. Same dialog role, same close button, same footer slot, same useDialogA11y hook -- two different-looking dialogs. Beyond them, 12 files hand-roll `fixed inset-0`: story-weaver create/characters/themes pages, Sidebar.tsx, FallbackUrlEditModal.tsx, ModelSyncButtons.tsx, and six in rec-room (ContinueStoryModal, EditChapterModal, GenerateOverlay, MobileChapterDrawer, ReaderSettings, StoryBiblePanel). The behaviour hook `useDialogA11y` IS shared (14 files) -- only the chrome was duplicated.

**Who it hurts.** The user sees at least three different dialog headers depending on which screen opened them.

**Recommended.** One `Dialog` with `placement: 'center' | 'right' | 'bottom'`, absorbing Modal, Sheet and the 12 hand-rolled overlays. The a11y hook already exists and stays.

### src/modules/rec-room is a second UI codebase: 17 of its 18 components import zero shared primitives

*Medium.*

**Measured.** `grep -c 'components/ui/'` over modules/rec-room/components/*.tsx returns 1 for StoryCard.tsx and 0 for the other 17 (1,825 lines). Its six pages under app/recroom/story-weaver import 0-2 shared components each; [id]/page.tsx (512L) imports none. It carries its own overlays (6), its own cards (StoryCard, CharacterCard), its own tag pills (Tags.tsx), its own labels. story-weaver/create/page.tsx is the worst single file in the product: 634 lines, 32 useState, 42 hook calls, 14 raw buttons, 2 raw inputs, 21 inline card chromes, 2 hand-rolled overlays.

**Who it hurts.** Roughly 4,100 lines -- an eighth of the UI layer -- outside the design system entirely. Any redesign that stops at src/components leaves a quarter of the rail screens untouched and visibly older.

**Recommended.** Treat Rec Room as the pilot for the new primitive set, not as a follow-up. It is self-contained, so converting it proves the primitives cover a real screen without risking the operator's daily surfaces.

### Four stat-tile implementations and six badge implementations for two concepts

*Medium.*

**Measured.** Stat tiles: dashboard/StatPill.tsx:49 `rounded-lg border-{accent}/20 bg-dark-900/50 px-4 py-3`, value text-lg accent-coloured; viz/StatStrip.tsx:36 `rounded-xl border-white/5 bg-white/[0.02] px-3 py-2`, value text-xl white; insights/page.tsx:74 MetricTile `rounded-xl border-white/10 bg-dark-900/40 p-3`, value text-2xl white; StatStrip's own outer shell `rounded-2xl border-white/10 bg-dark-900/40 p-4`. Three radii, three value sizes (18/20/24px), three backgrounds for 'a number with a label'. Badges: ui/Badge.tsx (rounded, text-xs), dashboard/StatusBadge.tsx (rounded-full, icon+label), ui/TemplatePill.tsx, quests/QuestBadge.tsx, achievements/AchievementBadge.tsx, rec-room/Tags.tsx. Live: 84 rendered pills with 23 distinct chromes.

**Who it hurts.** Visible on /agent/models and /work/missions, where a donut sits beside three flat boxes of a different radius and a fourth tile style appears further down the same page.

**Recommended.** One `StatTile` (icon, label, value, accent, optional trend/href) and one `Badge` with a `shape: 'pill' | 'tag'` prop. Keep the viz layer (Sparkline, Donut, ProgressRing) as-is -- those are signature and good.

### /work/missions renders one taxonomy twice, in two different pill vocabularies, on one screen -- and the board it sits above is clipped

*Medium.*

**Measured.** MissionsList.tsx:138-172 renders 8 template categories as raw `<button>` filter pills; MissionsList.tsx:174-198 immediately re-renders the same 8 categories as CategoryAccordion headers. Measured live: the pills are `radius=full h=26 pad=4/12 fs=12px border=1px`, the accordion headers are `radius=0 h=28 pad=6/4 fs=16px border=0` -- same eight strings, two shapes, two font sizes. Below them a third pill row (mission categories) and a fourth (status filter, `radius=6px h=26 pad=4/10`) stack vertically. 11 distinct small-control shapes on this one screen. The kanban below overflows at a 1600px viewport: scrollWidth 1264 vs clientWidth 1184 on `.flex.flex-col.lg:flex-row.gap-4.overflow-x-auto`, clipping the FAILED column mid-word (screenshot shows 'Sh...' and 'Cancelled 19h a...').

**Who it hurts.** The busiest screen in the product spends its first 700px on four stacked filter rows that show the same information twice, then clips the actual work.

**Recommended.** One `FilterBar` primitive (segmented control + search) used once per screen. Delete the duplicate category pill row; the accordion already carries the counts. Give the board a real column layout rather than overflow-x on a flex row.

### Ten independent click-outside effects and five Escape handlers, despite a shared hook existing for exactly this

*Medium.*

**Measured.** `addEventListener("mousedown"|"click")` for dismissal appears in 10 files: ConceptHint.tsx, BranchDropdown.tsx, CategoryCombobox.tsx, SchedulePicker.tsx, ui/MissionTimeSelector.tsx, ui/ProfileSelector.tsx, ui/SkillSelector.tsx, ui/TimeoutSelector.tsx, ui/ToolsetSelector.tsx, ui/field/Select.tsx. Separately, 5 files hand-roll `"Escape"` outside useDialogA11y. Each copy is ~8-12 lines of identical effect + ref + cleanup.

**Who it hurts.** ~100 lines of duplicated plumbing, and the copies drift: only field/Select.tsx implements arrow-key navigation, so the other nine dropdowns are mouse-only.

**Recommended.** One `useDismissable({ onClose })` hook, and route every dropdown through one `Popover` primitive that owns positioning, dismissal and roving focus.

### The largest files are two different problems: god-containers with no markup, and god-views with all of it

*Medium.*

**Measured.** app/agent/profiles/page.tsx (559L) contains 21 useState / 33 hook calls and ZERO raw buttons, inputs or card chromes -- it is pure orchestration delegating to 10 imported components. Same shape: app/agent/tools/page.tsx (531L, 14 useState), app/agent/settings/[section]/page.tsx (540L, 10 useState). Against that, components/composer/WorkflowCanvas.tsx (670L) splits 120 lines of imports/consts, 275 lines of CanvasInner state and handlers, and 268 lines of JSX holding a toolbar, the board, a node inspector and an edge inspector in one return. components/missions/MissionCreateForm.tsx (735L) is 200 lines of types/consts, a second exported component (MissionComposerActions, 91L), 139 lines of state wiring, and 305 lines of form JSX built from 11 repetitions of the same ComposerFieldLabel + raw control shape. app/recroom/story-weaver/create/page.tsx (634L) is both problems at once: 32 useState AND 14 raw buttons AND 21 inline cards.

**Who it hurts.** The containers are fine to leave alone; the views are where redesign cost concentrates.

**Recommended.** For the containers, lift state into hooks (the codebase already does this well -- useMissionComposer, useMissionsData, useModelActions) and leave the page as a 100-line composition. For MissionCreateForm, the 305-line form body becomes ~11 `<Field>` rows and drops to roughly 120 lines once ComposerFieldLabel and the raw inputs are replaced. Extract WorkflowCanvas's inspector into WorkflowInspector.tsx (~130L) and its palette/toolbar into WorkflowToolbar.tsx (~70L).

### No shared table primitive; tabular data is rendered five different ways

*Low.*

**Measured.** Only 4 files use `<table>`: models/FallbackChainList.tsx, models/ModelsTableSection.tsx, skills/SimpleMarkdown.tsx, tools/ToolsetReferenceTable.tsx. 41 files use `grid-cols-*` to fake a table with a header row. dashboard/LedgerRow.tsx (7 callers) is a good row primitive that never grew a header, a sort or a column definition.

**Who it hurts.** Column alignment is per-screen guesswork -- part of the operator's 'not aligned correctly'.

**Recommended.** Grow LedgerRow into a `DataList` with column defs (label, width, align, render). It already has the padding/hover/bloom semantics right; it needs a header and a column contract.

### What this area could delete

Roughly 8,000-11,000 of the 36,278 lines of .tsx (components 24,067 + modules 1,996 + app 10,215), and about 100 of the 212 components. Concretely: DELETE OUTRIGHT -- ui/Select.tsx (62L, 1 caller), ui/Input.tsx (354L; TextInput/NumberInput/Toggle/Select consumed only by components/config/ConfigField.tsx, SearchInput by 5 files that the Field Kit covers), ui/TemplateCard.tsx (80L, 1 caller, already contains a pill variant that duplicates TemplatePill), ui/CollapsibleSection.tsx OR ui/CategoryAccordion.tsx (165L combined, one disclosure survives), one of Modal/Sheet (~100L), and the byte-identical private `Label` in ComposerGatePrompt.tsx:27 / ComposerNodeRunDetail.tsx:30 plus ComposerFieldLabel and rec-room/Tags' label (~40L). COLLAPSE 5 INTO 1 -- ProfileSelector/SkillSelector/ToolsetSelector/TimeoutSelector/MissionTimeSelector, 684L to ~180L, saving ~500L and 4 files. COLLAPSE 4 INTO 1 -- StatPill / StatStrip's inner tile / insights MetricTile / StatStrip outer, ~120L saved. COLLAPSE 6 INTO 1-2 -- the badge family (Badge, StatusBadge, TemplatePill, QuestBadge, AchievementBadge, Tags), ~200L. COLLAPSE 14 INTO 1 -- Modal + Sheet + the 12 hand-rolled `fixed inset-0` overlays (6 of them in rec-room), each currently carrying its own backdrop, panel, header and close button: ~600-800L. DEDUPE PLUMBING -- 10 click-outside effects and 5 Escape handlers into one useDismissable + one Popover, ~120L. THE BIG ONE, mechanical rather than file-level -- converting 234 inline card chromes to one Surface and 321 raw buttons to one Button removes roughly 2 lines of className soup each and, more importantly, deletes the 47-chrome and 20-height variance: ~1,500-2,500L. REC ROOM -- 17 of 18 module components plus 6 pages (~4,100L) rebuilt on the shared primitives should land near 2,400L, saving ~1,700L. BIG-FILE EXTRACTIONS -- MissionCreateForm 735L to ~350L once its 11 hand-built field rows become <Field> rows and MissionComposerActions moves out; WorkflowCanvas 670L to ~350L plus WorkflowInspector.tsx and WorkflowToolbar.tsx; story-weaver/create 634L to ~300L. TARGET SHAPE: about 30 primitives in ui/ (Surface, SectionHeader, Button, IconButton, Badge, Field, Input, Textarea, Select, Picker, Toggle, Dialog, Popover, Tabs/SegmentedControl, FilterBar, DataList, Disclosure, StatTile, EmptyState, ErrorBanner, Spinner, Skeleton, Toast, Pagination, Tooltip/ConceptHint, StatusDot, plus the 4 viz marks), about 60-70 feature components under features/<domain>/, and the 29 pages -- roughly 100 components where there are now 212.

## Information architecture and screen purpose

> The information architecture is sound, the five-group rail is right and the primary loop is genuinely fast (2 clicks from Dashboard to a running, fully-prefilled mission), but the screens inside it don't hold their shape: the page title lands at eight different x-positions across 25 screens, six screens restate the same number 2, 5 times in a stat strip that shows no actual content, and the rail itself is measurably invisible at 1.058:1 against the canvas. Roughly 1,600 lines can go by merging four Rec Room screens into two and collapsing seven near-clone stat-strip wrappers.

### The sidebar has no edge: 1.058:1 against the canvas

*High.*

**Measured.** Measured on the live instance at 1440x900. Rail background computes to oklab(0.1928,-0.0072,-0.0252)/0.8 over body rgb(4,11,18) = rgb(10,19,29). Body is rgb(4,11,18). Contrast ratio between the rail surface and the page surface is 1.058:1. The only separator is `border-r border-white/10` (src/components/layout/Sidebar.tsx:151), which composites to 1.25:1 against the body. The label text itself is fine (rgba(255,255,255,0.55) on the rail = 6.20:1); it is the SURFACE that does not exist.

**Who it hurts.** This is the operator's stated complaint, and it is a surface problem, not a text problem. A redesign that only brightens the labels will not fix it. The rail reads as text floating on the same plane as the content, so the eye has no anchor for 'where am I / where can I go'.

**Recommended.** Give the rail a real surface delta, target >= 1.3:1 against the canvas (e.g. rail at ~rgb(16,26,38) or canvas darkened), plus a 1px border at >= 2:1. Do not fix this by raising label opacity; the labels already pass AA.

### The rail has no internal hierarchy, and two of its groups are demoted to footer chrome

*High.*

**Measured.** Measured rail computed styles: group headers WORK / RESULTS / AGENT / REC ROOM render at rgba(255,255,255,0.55), 12px, weight 400. The nav items beneath them render at rgba(255,255,255,0.55), 14px, weight 400, the SAME colour and weight, only 2px smaller. Meanwhile Dashboard sits above the first group with no group label at all, and Quests + Help are pushed into a 12px footer row at y=840, smaller than the items they are peers of in src/lib/modules/registry.ts (all three are `label: "Home"`, order 1/2/3). The registry assigns each link an accent colour (cyan/orange/pink/green/purple) but all 17 rest-state links render identically, the accent system is dead weight at rest.

**Who it hurts.** A group header dimmer-or-equal to its children is not a header. The declared 'Home' group (Dashboard, Quests, Help) is rendered as three unrelated things in three places. Nothing in the rail tells you which of five groups you are in.

**Recommended.** Give group headers a distinct treatment (uppercase micro-caps at higher contrast, or a rule) and pull Dashboard/Quests/Help into a visible HOME group at the top. Either use the registry accent colours for the active/hover state or delete the `color` field from the registry.

### The page title lands at eight different horizontal positions across 25 screens

*High.*

**Measured.** Measured h1 left edge at 1440x900: 249 (/), 281 (chat, missions, composer, scripts, sessions, insights, logs, profiles, skills, tools, memory, quests, help), 329 (/work/research), 372 (/agent/settings, /recroom/story-weaver), 388 (/agent/models, /agent/settings/restore), 405 (/agent/settings/system), 439 (four Story Weaver sub-pages), 461 (/results/artifacts). A 212px spread. Underneath, six content max-widths are in use: 768, 896, 1024, 1152, 1280, and full-bleed. And three different header/content relationships: header full-bleed with content inset 160px (quests, system, restore, sw/create, characters, themes), header full-bleed with content inset 32, 96px (models, help, story-weaver, library), and header inset with content (research at x=273, artifacts at x=405).

**Who it hurts.** This is the operator's 'not formatted/aligned/sized correctly' in one number. Clicking down the rail makes the page title jump horizontally on almost every step. On Artifacts the header bar's bottom border floats 180px inside the canvas, pointing at nothing.

**Recommended.** Pick two content widths and one rule: a wide width for boards/tables/lists and a narrow reading width for forms/prose. The header bar must share the content column's left edge on every screen, no exceptions. This alone removes most of the 'niggling issues'.

### The stat strip restates the same number 2, 5 times and shows no actual content

*High.*

**Measured.** Measured repeated integers in the top 400px: /agent/skills renders "4" five times (donut centre 4 SKILLS, tile TOTAL 4, tile ACTIVE 4, tile CATEGORIES 4, ring 100% ACTIVE, plus the subtitle '4 skills'). /results/sessions renders "40" twice and "0" twice, the ring says '0 ACTIVE' and a tile 800px to its left says 'ACTIVE 0'. /work/missions repeats 19 and 0. /agent/tools repeats 22. /agent/models repeats 4, and its subtitle already says '4 models in registry · 0 credentials', which the three tiles then restate verbatim in 130px of vertical space. The donut centre duplicating a tile is a caller bug repeated in all seven wrappers (src/components/{logs,memory,models,session,skills,missions}/*Insights.tsx, src/modules/hermes/components/ToolsInsights.tsx, 482 lines total, several with comments saying they 'mirror' each other).

**Who it hurts.** Every list screen spends its most valuable 130px restating its own subtitle before showing a single row. The strip is the single most-repeated visual element in the app and it carries close to zero information.

**Recommended.** One strip component, configured by data, that shows at most three numbers you cannot get by counting the rows below it (e.g. 'failed 8', 'spend $0.01', 'last run 19h ago'). Delete the donut-centre/tile duplication and the vanity rings ('100% ACTIVE' when inactive is 0).

### /agent/skills shows zero skill names in the first viewport

*High.*

**Measured.** Screenshot at 1440x900. Text coverage 7.0% (lowest of all list screens). The viewport contains: a 128px stat strip saying 4 five times; a search box over 4 items; an 'Active 4 / 4 categories / collapse' band; four COLLAPSED category accordions each containing exactly one skill; an 'Inactive 0 / 0 categories' band; and a ~330px empty state reading 'No inactive skills / All skills are currently active'. Not one skill name is on screen.

**Who it hurts.** The screen answers 'how many skills are there' (which the subtitle already answered) and refuses to answer 'which skills'. Four accordion clicks are required to see four items.

**Recommended.** Show the skills. Default the accordions open below ~20 items, drop the empty 'Inactive' section entirely when the count is 0, and cut the strip to a single line. This screen should be a list, not a dashboard about a list.

### /work/missions renders mission status three times and template categories twice

*High.*

**Measured.** Screenshot at 1440x900. Status counts appear as: (1) stat tiles TOTAL 19 / RUNNING 0 / COMPLETED 0 / FAILED 8; (2) a filter pill row All / Draft / Queued / Running / Completed / Failed; (3) kanban column headers DRAFT 11 / QUEUED 0 / RUNNING 0 / COMPLETED 0 / FAILED. Template categories appear as: (1) nine filter chips 'All, General (4), Engineering (2), Research & Report (1)…'; (2) immediately below, the same eight categories as accordion rows 'GENERAL 4 / ENGINEERING 2 / RESEARCH & REPORT 1…'. There is also a third filter row ('All missions / Uncategorized (19)') between them. Three of the five kanban columns are empty and consume 60% of the board width to say 'No missions'; the FAILED column is clipped at the right edge (x=1300 of 1440).

**Who it hurts.** Four stacked filter systems and three renderings of one fact before you reach a mission. src/components/missions/ is 3,452 lines across 15 files for one screen.

**Recommended.** One status control (the kanban columns already are one, delete the pill row and the status tiles). One category control (chips OR accordion, not both). Collapse empty kanban columns to a thin rail. Estimated 200, 300 lines removable from MissionsList.tsx and the page.

### The Dashboard duplicates itself: Gateway, Memory and Errors each appear twice on one screen

*High.*

**Measured.** Screenshot and DOM at 1440x900. The Subsystems panel lists five rows: Gateway Healthy / Memory Healthy / Sync Healthy / config.yaml Healthy / Gateway gate Healthy. Directly beneath it, a six-tile row repeats GATEWAY Healthy and MEMORY Healthy with the same status and the same detail string. Separately, an ERRORS tile reads '0 recent errors' and an Errors panel further down reads 'No recent errors'. Three of the six tiles also clip their own subtext while 200px of the row sits unused: 'http://127.0.0.1:8747' needs 151px in a 133px box, 'last tick 9s ago · pid 6832' needs 194px in 133px, '2 facts · Hindsight' needs 137px in 133px.

**Who it hurts.** The first screen a user sees says the same thing twice in two different visual languages, and clips the half that carries the detail.

**Recommended.** Keep the Subsystems panel (it is the better of the two, labelled, detailed, timestamped) and cut the tiles to the three facts it does not carry: SPEND, PROCESSES, SCHEDULER. Widen or wrap the tile subtext.

### The Dashboard's h1 names the wrong product and never names the page

*High.*

**Measured.** DOM at /: `H1: "Hermes AGENT FRAMEWORK"`. The document title is 'Dashboard · PatterStage'; the rail header says 'PatterStage, The Stage is Yours'; the rail's active item says 'Dashboard'. Every other screen's h1 matches its rail label (enforced by useRegistryTitle in src/components/layout/PageHeader.tsx). The Dashboard is the only screen that opts out, src/app/page.tsx uses PageTitle directly rather than PageHeader.

**Who it hurts.** The product's home screen is branded after its dependency. A new user's first impression is that they installed Hermes.

**Recommended.** Make the Dashboard use PageHeader like the other 24 screens. Move the agent identity ('Hermes · deepseek-v4-flash · nous · ONLINE') into a status chip in the header actions, where it belongs.

### Characters and Themes: 715 lines and two rail entries for 278 characters of empty state

*High.*

**Measured.** src/app/recroom/story-weaver/characters/page.tsx is 404 lines; themes/page.tsx is 311 lines. Rendered content, measured: Characters = 149 chars of text, 2 buttons, text coverage 4.3%; Themes = 129 chars, 2 buttons, 4.1%. Both are the two emptiest screens in the app. Both are structurally identical (nine useState hooks each, an edit modal, duplicated FIELD/LABEL class constants, a delete confirm). Both hold data that /create already reads and writes inline (create/page.tsx lines 138, 159 fetch savedCharacters and savedThemes; the Create form has 'Add Character' and 'Save as Theme' in place). themes/page.tsx still exports `function PromptsPage()`, a name from a concept that no longer exists.

**Who it hurts.** Two of 25 rail destinations exist to manage two small reusable lists that are already managed on the screen that consumes them.

**Recommended.** Delete both pages. Put saved characters and saved themes as two panels (or tabs) inside Create, where they are used. Removes ~500 lines and two rail entries.

### Story Weaver's index duplicates its own Library, and renders a second copy of the rail's sub-nav

*High.*

**Measured.** Screenshots side by side. Index shows six stat tiles (2 STORIES / 1 COMPLETED / 1 WAITING FOR YOU / 0 RUNNING / 7 CHAPTERS / 317 WORDS) then 'RECENT STORIES' with two cards. Library shows three stat tiles (2 STORIES / 1 COMPLETED / 317 WORDS, an exact subset of the index's) then the same two stories as rows with the same fields. The index also renders four buttons 'Create / Library / Characters / Themes' while the rail, on screen at the same moment, shows those same four as sub-links. Index text coverage: 8.6%, with 340px of dead space below the fold. Index page 136 lines + library 251 lines.

**Who it hurts.** Five rail entries for what is one list, one editor and one reader. Two navigation systems for four destinations, visible simultaneously.

**Recommended.** Merge index into Library (the richer of the two) and make it the Story Weaver landing. Delete the in-page sub-nav, the rail already does that job. Rec Room goes from 5 rail entries to 2 (Stories, Create).

### Three different agent pickers for one global selection, and the screens disagree about the agent's facts

*High.*

**Measured.** /agent/profiles selects the agent with a left list; /agent/skills selects it with a header dropdown ('Bob (local default)' top-right); /agent/tools selects it with a 'Profile' card in the page body. Three UIs, one concept. Worse, the facts disagree: on /agent/profiles the performance strip reads '22 RUNS' while the detail panel 300px below reads 'Runs completed 11' for the same agent, and the detail reads 'Memory facts 0' while /agent/memory reads '2 FACTS' and the Dashboard MEMORY tile reads '2 facts · Hindsight'. Bob's name appears four times on the Profiles screen.

**Who it hurts.** The selected profile is the most consequential piece of state in the Agent group and there is no persistent indicator of it. When two numbers on the same screen disagree, the user stops trusting all of them.

**Recommended.** One profile picker, in the header, persistent across every Agent screen (and shown read-only where it matters elsewhere). Reconcile or explicitly scope the run/memory counts, if 'Memory facts' is profile-scoped and Memory is global, label them so.

### Composer, Research and Missions are three builds of the same loop, with three vocabularies for the same noun

*Medium.*

**Measured.** Measured layout geometry: Research = form card [1120x382], RUNS list [300x424], result viewer [804x424]. Composer = form card [1375x381], RUNS list [320x574], result viewer [1039x574]. Same three-box composition, different widths, different left edges (Research's header starts at x=273, Composer's at x=225). Both have a run list, both write to /results/artifacts, both write to /results/sessions. Saved starting points are called 'Presets' (Research), 'Templates' (Missions), 'Workflows' (Composer), and 'Templates'+'Themes' (Story Weaver), four or five names for one idea. All three run lists show indistinguishable duplicate rows ('Walk B12: what are the trade-offs?' x4 on Research, x2 on Composer, x4 on Artifacts) with no disambiguator.

**Who it hurts.** Three screens teach the same interaction three times. A user who learns Missions learns nothing transferable about Composer.

**Recommended.** Standardise the run-list + viewer as one shared component with one width and one left edge. Standardise the saved-config noun across all four surfaces. Add a disambiguator (short run id or start time) to every run row.

### Breadcrumbs name four parents, none of which are rail groups, and siblings disagree

*Medium.*

**Measured.** Measured header eyebrows: /agent/settings = 'HOME'; /agent/models = 'CONFIG'; /agent/settings/system = 'SETTINGS'; /agent/settings/restore = 'CONFIG'; /recroom/story-weaver = 'HOME'; the four Story Weaver children = 'STORY WEAVER'; the other 17 screens have none. The rail's actual groups are Work / Results / Agent / Rec Room. Restore and System are siblings under Settings and carry different eyebrows. Models is a top-level rail item but also the first card on the Settings page.

**Who it hurts.** The breadcrumb contradicts the rail on every screen that has one, and is absent on the 17 that don't.

**Recommended.** Either drop the eyebrow entirely (the rail already shows where you are) or derive it from the registry's section label so it can only ever say Work / Results / Agent / Rec Room. Decide whether Models is a Settings child or an Agent peer and render it in one place.

### Settings is an index of an index: 30 cards leading to 27 pages averaging 3.5 fields

*Medium.*

**Measured.** /agent/settings renders 32 links and zero settings: three page-cards (Models, Restore, System) plus 27 config-section cards grouped into CORE / INFRASTRUCTURE / SECURITY / VOICE & AUDIO / AUTOMATION / INTEGRATIONS / FILES. Field counts printed on the cards: 5, 14, 7, 7, 4, 6, 2, 2, 3, 3, 1, 2, 1, 3, 4, 3, 1, 3, 1 … roughly 95 fields total. Page scroll height 2656px. All 27 render from one template (src/app/agent/settings/[section]/page.tsx, 540 lines).

**Who it hurts.** Changing two settings in different sections costs four navigations. The card grid is 2656px of chrome for ~95 controls that would fit on two scrollable pages.

**Recommended.** Make Settings one scrollable page with a sticky section nav down the left, sections expanded in place. Keep the search box (it is the only fast path today). Keep Models/Restore/System as genuinely separate pages, they are not config fields.

### 54 files hand-roll card chrome; 10 import the shared Card

*Medium.*

**Measured.** grep across src/: 54 files match the inline pattern `rounded-(xl|2xl|lg) border border-white/10 bg-dark-900…`; only 10 files import @/components/ui/Card. Measured consequence at 1440x900: card corner radius is 8px on /agent/tools and /quests, 12px on /, /work/composer, /agent/memory, /agent/models, /agent/settings/system, /restore and the Story Weaver pages, and 16px on /work/missions, /results/sessions, /results/insights, /results/logs, /agent/profiles, /agent/skills. /results/insights defines its own local `Card` and `CardTitle` at the top of the page file rather than importing either.

**Who it hurts.** Three card radii shipping simultaneously is why the app reads as several apps. Any future token change has to be applied 54 times.

**Recommended.** One Card with variants (panel / tile / row). Codemod the 54 files. This is the highest-leverage single cleanup in the codebase for both LoC and visual consistency.

### Content is clipped while free space sits beside it

*Medium.*

**Measured.** Measured scrollWidth > clientWidth at 1440x900: three of six Dashboard status tiles clip their subtext (needing 151/137/194px in 133px boxes) on a row with ~200px unused. On /work/composer the primary call to action renders as 'Review…', the button is 107px wide and ellipsises its own label. On /work/missions the FAILED kanban column is cut off at the viewport's right edge. On /results/sessions the search input is 380px while the row it shares has 400px unused.

**Who it hurts.** Truncation on a primary CTA is a correctness bug, not a style one, the user cannot read what the button will do.

**Recommended.** Never ellipsise a button label; wrap or shorten the copy. Give the tile row `min-width` per tile and let it wrap to two rows rather than clip.

### /results/artifacts is the worst-aligned and least useful screen in Results

*Medium.*

**Measured.** Measured: the header bar starts at x=405 and ends at x=1260, leaving a 180px void between the rail edge (x=225) and the header, and 180px to its right. Content column 854px. 62% of the viewport is empty below the last card. Text coverage 11.1%. Three of the eight artifact cards are titled 'Walk B12: what are the trade-offs?' with identical metadata (RESEARCH · MD · 142 B · 23h ago) and nothing distinguishes them. No preview, no content, despite the subtitle promising 'collected to view + download'.

**Who it hurts.** The screen that is supposed to be the payoff of every run shows the least. It is a filename list with a filter.

**Recommended.** Align the header to the rail edge like every other screen. Add a preview pane (list left, content right, the pattern Logs, Research and Composer already use). Add a source link and a run id to each row.

### Information density varies 10x across screens that share a shell

*Medium.*

**Measured.** Measured text coverage of the first viewport at 1440x900: Themes 4.1%, Characters 4.3%, Skills 7.0%, Chat 7.7% (legitimate, it is a conversation), Story Weaver 8.6%, Scripts 9.4%, Sessions 10.3%, Artifacts 11.1% … up to Models 24.8%, Logs 26.5%, Settings 27.2%, Tools 30.4%, Help 41.7%. Vertical scroll extent ranges from 900px (eight screens fit entirely) to 3621px (/results/sessions, four viewports of 77px-tall rows carrying a title, a badge, two timestamps and an id each).

**Who it hurts.** Screens that fit in a viewport with 60% empty space sit next to screens four viewports deep. Nothing in the shell mediates between them, so the app has no rhythm.

**Recommended.** Set a density target per screen archetype (board, list, form, reader) and hold every screen to its archetype. Sessions rows should be ~44px, not 77px. The eight screens that fit in a viewport with room to spare are candidates for merging (see Rec Room and Characters/Themes findings).

### Scripts and Missions split scheduling by what is being scheduled, and the split is only explained in prose

*Low.*

**Measured.** /work/scripts body copy: 'Drop a .sh, .mjs … under PS_DATA_DIR/scripts and it appears here … Scheduling agent work is on the Missions page.' /work/missions has a 'Schedules' section at the bottom ('Schedule a mission … No schedules yet'). Each script row also carries its own 'Schedule' button. So there are two schedule surfaces and one of them explains itself by pointing at the other.

**Who it hurts.** 'What is running on a clock on this machine' has no single answer. A user has to check two screens and reconcile them.

**Recommended.** One Automation view listing every scheduled thing, script or mission, with its next run, last run and log. Scripts keeps the file list; Missions keeps dispatch. Neither needs a schedules section.

### What this area could delete

Roughly 1,600, 1,900 lines from the information-architecture changes alone, before any shared-component work. (1) Rec Room merge: characters/page.tsx 404 + themes/page.tsx 311 → one panel inside Create, and story-weaver/page.tsx 136 merged into library/page.tsx 251 → save ~550, 650 lines and 3 of 25 rail entries. (2) The seven near-clone stat-strip wrappers total 482 lines (LogInsights 72, MemoryInsights 76, MissionInsights 87, ModelInsights 45, SessionInsights 93, SkillsInsights 62, ToolsInsights 47) and several carry comments saying they mirror each other; one data-driven strip saves ~300. (3) Missions: deleting the duplicate status filter row and the duplicate template-category chips (status is rendered three times, categories twice) should take 200, 300 lines out of the 3,452 currently in src/components/missions/. (4) The Dashboard's six status tiles duplicate two of five Subsystems rows and the Errors panel; cutting to three tiles removes ~80 lines from src/app/page.tsx (500). (5) Adjacent but large: 54 files hand-roll card chrome against 10 that import ui/Card, a codemod there is the biggest single LoC and consistency win available, and it is what produced the three card radii (8/12/16px) currently shipping.

## Accessibility, responsiveness and interaction

> The accessibility fundamentals here are unusually strong, 25 screens, zero enabled-text contrast failures under live compositing, one h1 per route, a working skip link, and a mission-dispatch loop that announces itself and returns focus to its trigger. What fails is everything the existing gates do not measure: non-text contrast (the rail is 1.10:1 against the canvas it sits beside, which is the operator's "hard to see" in one number), the focus ring (silently defeated on 46 controls in 30 files by a bare `outline-none` that the `no-bare-outline-none` rule accepts), and consistency (8 different content widths at 1920, 3 loading behaviours, 3 destructive-button treatments, 13 filter groups with no ARIA state).

### The rail is 1.10:1 against the page beside it, the operator's complaint, measured

*High.*

**Measured.** Live at 1440 (/work/missions, canvas-resolved oklab compositing): rail surface rgb(13,23,36) vs main surface rgb(4,11,18) = 1.098:1. Its `border-r border-white/10` divider paints rgb(30,36,42) = 1.261:1 vs the canvas, 1.148:1 vs the rail. The current-page row's `bg-white/10` highlight paints rgb(37,47,58) = 1.326:1 against the rail. WCAG 1.4.11 asks 3:1 for a boundary that identifies a component. By contrast the rail's LABEL text is fine: 6.26:1 (ps-text-muted) and 19.78:1 (active). src/components/layout/Sidebar.tsx:141-144.

**Who it hurts.** Every user, every screen. The sidebar is not dim, its type is well above AA. The surface, the divider and the you-are-here fill are all invisible, so the rail reads as loose text floating on the same plane as the content. This is the single highest-reach finding and it is exactly what the operator reported.

**Recommended.** Give the rail a real surface step (target >=1.4:1 vs canvas is still too little, go to a distinctly darker or lighter plane), raise the divider to >=3:1, and stop carrying the active state on a 1.3:1 fill alone: add a left accent bar or a token'd active surface. Do not fix this by brightening text; the text is already correct.

### The one focus ring is silently switched off on 46 controls in 30 files, and the gate that exists to prevent it accepts the replacement

*High.*

**Measured.** globals.css:677 declares one ring: `:focus-visible { outline: 2px solid var(--color-neon-cyan); outline-offset: 2px }`. 46 controls across 30 .tsx files carry a BARE `outline-none` (not `focus:outline-none`), which lands in Tailwind's utilities layer and sets `outline-style:none` unconditionally, beating the base rule whether focused or not. 40 of those 46 pair it with a 1px `focus:border-*` and only 1 uses a ring. Measured live with real Tab focus: /work/chat message textarea → `outline: none/2px/rgb(0,191,255)` (style suppressed), only cue is border white/10 → neon-cyan/50 ≈ 3.0:1 at 1px; /agent/settings search and /results/sessions search → border → neon-orange/50 = 2.41:1 at 1px. design-lint's `no-bare-outline-none` passes all of them because its test accepts `focus:border-` as a replacement (scripts/tooling/design-lint.mjs:118-121).

**Who it hurts.** Every keyboard user, on the highest-traffic inputs in the product: the chat composer, the settings search, the session search, and every Story Weaver field. They get a 1px tint at 2.4, 3.0:1 instead of the 2px cyan ring the rest of the app uses. Fails WCAG 2.4.11 (Focus Appearance) and is inconsistent with 405 controls that get the ring correctly.

**Recommended.** Delete the bare `outline-none` from all 46 sites and let the global ring paint (the `focus:border-*` can stay as a supplementary cue). Then tighten the lint rule: a replacement must be `focus-visible:ring-2`/`focus-visible:outline-*`, never a border colour. This deletes classes rather than adding them.

### 127 sub-24px touch targets, including a 16x16 Help link on 25 of 25 screens

*High.*

**Measured.** Live census at 1440 across all 25 rail routes, excluding inline-in-sentence links: 127 controls under 24x24. The worst repeat offender is `HelpLink`, src/components/help/HelpLink.tsx:95-97 renders `<HelpCircle className="w-4 h-4">` inside a link with no padding, giving a 16x16 hit box on every single screen. /results/sessions has 34 (session title links at 20px tall). The pattern `text-xs font-mono` action links ("Manage categories" 122x16, "Edit Templates" 117x16, "Hide this guide" 108x16, "Save as Theme" 110x16) yields 16-17px tall targets, unchanged at 390px.

**Who it hurts.** Everyone on a touch device or a trackpad, plus anyone with a motor impairment. WCAG 2.2 AA 2.5.8 requires 24x24. The Help affordance, the product's own escape hatch, is the smallest control in the app and it is on every screen.

**Recommended.** One rule in the redesign: no interactive element under 24x24, enforced with a live Playwright gate (the static gates cannot see box sizes). HelpLink needs `p-1` (24x24) or `p-1.5` (26x26). Convert the `text-xs` bare-text actions into a single small-button primitive with vertical padding.

### Eight different content widths at 1920, the page jumps sideways between screens

*High.*

**Measured.** Measured content-container width at 1920 across all 25 routes: 886, 896, 1024, 1152, 1280, 1455, 1695 px. Left gutter varies 225px → 629px. Source: 6 distinct `max-w-* mx-auto` values across 19 sites (max-w-4xl x7, 6xl x3, 5xl x3, screen-xl x2, 7xl x2, 3xl x2). Vertical rhythm varies too: first card top ranges 0→176px. The dashboard is the only route with no page header at all (header height 0 vs 80px everywhere else).

**Who it hurts.** Every desktop user on every navigation. Moving from /agent/settings/system (896px, gutter 625) to /results/sessions (1695px, gutter 225) shifts the whole content column 400px left. It reads as instability rather than as a considered measure.

**Recommended.** Pick two measures, a wide one for tables/boards and a reading one for forms/prose, put them in one `PageContainer` component, and delete the 19 ad-hoc `max-w-* mx-auto px-*` strings. Give the dashboard the same PageHeader as everything else.

### Below 1024px there is no navigation at all, one breakpoint, no intermediate rail

*High.*

**Measured.** src/hooks/useIsMobile.ts sets a single breakpoint at `(max-width: 1023px)`. At 1024 you have a 224px rail; at 1023 the entire rail becomes a hidden drawer behind a hamburger in a 48px header (src/components/layout/MobileHeader.tsx). The rail ALREADY supports a 64px icons-only mode (`lg:w-16`, Sidebar.tsx:151) but it is only reachable above 1024.

**Who it hurts.** Anyone on a 1280x800 laptop with a window snapped to half-screen, a tablet in landscape, or any browser under 1024. They lose persistent navigation entirely and must open a modal to change page, on a screen with plenty of room for an icon rail the code already has.

**Recommended.** Use the collapsed 64px icon rail from ~768 to 1024 instead of dropping to the drawer, and reserve the drawer for <768. This is a breakpoint change, not new code.

### The dashboard is clipped on a phone: 31 elements run past the viewport by up to 40px

*High.*

**Measured.** At 390x844, `/` has main.scrollWidth 430 vs clientWidth 390. 31 elements overflow; every card's right border is off-screen ("START HERE" panel +16px, Subsystems +16px, the tile grid +16px, "Add the API key your provider needs. Skip this one if" cut mid-sentence). Cause: src/app/page.tsx:335 `<div className="max-w-7xl mx-auto px-6 py-6 space-y-6">` is a flex item in a `flex flex-col` shell; `mx-auto` cancels `align-self: stretch`, so it sizes to max-content (430px) with `min-width: auto`. `<main class="flex-1 overflow-y-auto">` computes overflow-x to `auto`, so it scrolls sideways silently instead of failing loudly. /work/missions has the same at +71px on its status filter row. Every other route is clean at 390.

**Who it hurts.** Everyone who opens the front door of the product on a phone. The document does not scroll, so my viewport-level check found nothing, the damage is inside `main`, invisible to any test that only asserts `document.scrollWidth`.

**Recommended.** Add `w-full` (or `min-w-0`) to the dashboard container so it stretches rather than sizing to max-content, and make this a repo-wide rule in the shared PageContainer. Add a live gate that asserts `main.scrollWidth <= main.clientWidth` at 390 for all routes, the existing suite would never have caught this.

### The mobile drawer's focus trap leaks onto the hamburger behind the backdrop

*High.*

**Measured.** At 390 on /work/missions: open the drawer, Tab 20 times through its links, and tab stop 21 is `button "Open navigation"`, the header hamburger sitting behind a 60%-black backdrop, outside the dialog. Cause: src/hooks/useDialogA11y.ts:74-80, `focusableWithin` is deliberately NOT filtered by visibility (documented at lines 48-58: "Real hidden controls are rare inside a dialog"). The drawer's Collapse button is `hidden lg:flex` (src/components/layout/Sidebar.tsx:232), so on a phone it IS in `items` and IS `last`, meaning the real last link ("Help") never triggers the wrap. Everything else about the drawer is right: role=dialog, aria-modal, aria-label, Escape closes, focus restores to the hamburger, scroll locked (verified: main.scrollTop 0 → 0 under a 800px wheel).

**Who it hurts.** Every keyboard and screen-reader user on a phone or narrow window, the most-used dialog in the product. The stated assumption in the hook's comment is false for the one dialog it matters most for.

**Recommended.** Filter `focusableWithin` by `getClientRects().length > 0`, guarded so jsdom (which does no layout) still sees elements, e.g. only apply the filter when `document.body.getClientRects().length > 0`. That preserves the unit tests the comment was protecting.

### StatPill builds Tailwind classes at runtime, so 3 of 8 accents paint a white border and all 10 hover states are dead

*High.*

**Measured.** src/components/dashboard/StatPill.tsx:48 `const borderClass = textColor.replace(/^text-/, "border-") + "/20"` and :81 `hover:border-` + `/45`. Tailwind scans statically, so these only work when some OTHER file happens to use the identical literal. Static-use counts in src/: border-neon-purple/20 x18, border-neon-orange/20 x15, border-neon-cyan/20 x11, border-neon-pink/20 x4, border-neon-green/20 x3, but border-yellow-400/20 x0, border-red-400/20 x0, border-blue-400/20 x0, and ALL TEN `hover:border-*/45` x0. Live proof on the dashboard: the SPEND tile's only matching border rule is Tailwind preflight `*,::after,::before{border:0px solid}`, so it computes `rgb(255,255,255)`, a solid white 1px border where a 20%-yellow was intended. Hovering GATEWAY changes only background alpha 0.5→0.7 (a 1.04:1 step); border colour does not change on any pill. design-lint's `no-template-literal-tailwind` cannot see a `.replace()`.

**Who it hurts.** Visible on the app's front door: one of six tiles has a bright white border and reads as selected or focused when it is neither. Every stat pill is a link whose hover affordance does nothing. This is the same defect class as T-0095/D114, and the gate written for it only inspects `neon-`/`semantic-`/`ps-` prefixed literals.

**Recommended.** Replace the two `.replace()` derivations with an explicit `Record<AccentColor, string>` of literal classes (as `theme.ts` already does for BORDER_BASE). Extend `no-template-literal-tailwind` to flag string methods that produce a class, or add a build-time check that every class in `theme.ts`'s maps exists in the emitted CSS.

### 296 interactive control borders measured below 3:1, nothing gates non-text contrast

*High.*

**Measured.** Live audit of all 25 routes at 1440: 296 CONTROL-BORDER instances and 659 decorative BORDER instances compute below 3:1 against their adjacent background. Top offenders: border-white/10 at 1.26, 1.36:1 (x171 in one bucket, plus x64 and x57 on controls), border-white/6 at 1.17:1 (x200), border-white/5 at 1.14:1 (x136), border-white/8 at 1.24:1 (x29). Accent variants sit at 2.3, 2.7:1 (`border-neon-orange/30` x31 on /quests, `border-neon-purple/30`, `border-green-500/30`). The source carries 8 distinct `border-white/N` alphas (10 x311, 5 x63, 20 x21, 8 x16, 15 x12, 30 x10, 40 x1, 25 x1), 12 distinct `bg-white/N` values, and 84 distinct border colour utilities overall. contrast-check.mjs only re-derives the four `--color-ps-text-*` tiers against `--color-dark-950` (scripts/tooling/contrast-check.mjs:33-45); it never looks at a border, a fill, or a real painted background.

**Who it hurts.** Anyone in bright light, on a low-quality panel, or with reduced contrast sensitivity cannot see where a button, input or card begins. It is also the mechanical cause of the "everything floats" feeling: 1.2:1 edges are not edges.

**Recommended.** Collapse 84 border utilities to a 3-step scale (hairline / edge / emphasis) with the interactive tier at >=3:1, and extend the contrast gate to run against the live DOM (a Playwright pass that composites real backgrounds, the technique is ~40 lines) rather than parsing globals.css.

### Thirteen filter/segmented groups convey selection by colour alone, with no ARIA state

*High.*

**Measured.** Live across the 25 routes: 13 groups of 3+ sibling <button>s where exactly one is styled differently and NONE carries aria-pressed, aria-checked, aria-current, aria-selected or role=tab. The whole app has only 15 aria-pressed, 5 aria-current, 2 role=tab and 2 aria-selected. Examples: the mission dispatch mode (Save/Queue/Run now/Schedule, verified `{role:null, ariaPressed:null, ariaChecked:null, parentRole:null}`, selection = cyan text + cyan/10 fill + cyan/50 border), /work/missions status filter (All/Draft/Queued/Running/Completed/Failed), /results/insights 7d/30d/90d, /recroom/story-weaver Create/Library/Characters/Themes (visually tabs, semantically 4 unrelated buttons), /agent/profiles 8 profiles.

**Who it hurts.** Screen-reader users cannot tell which filter or dispatch mode is active. Keyboard users tab through every option instead of arrowing within one group, 6 extra stops just to reach the missions board. And on the dispatch panel the SELECTED style (2px cyan ring) is visually identical to the FOCUS style, so a sighted keyboard user cannot tell selection from focus either; the UI apologises for itself with the caption "The button below runs the selected dispatch mode."

**Recommended.** One `SegmentedControl` primitive: roving tabindex, arrow-key navigation, `aria-pressed` or a real radiogroup, and a selected treatment (filled surface) that is categorically different from the focus ring (outline). Replacing 13 hand-rolled groups removes roughly 200 lines and fixes the semantics once.

### Three loading behaviours, zero skeletons, and three screens that assert a false zero while loading

*High.*

**Measured.** With API responses throttled 1800ms, the 25 routes split into spinner+text (10), bare spinner (9), and content-already (6). `animate-pulse` appears in 13 files but NOT ONE route renders a skeleton on load. /work/missions and /recroom/story-weaver/{characters,themes} render a completely empty `main` (innerText length 0), the page header vanishes too, so there is no context and a full layout shift when data lands. Worse, three routes render a confident wrong number before the fetch resolves: /results/sessions "0 recorded sessions across all agents", /agent/skills "0 skills", /agent/models "0 models in registry · 0 credentials". /agent/profiles shows "Loading profiles..." twice at once. 24 distinct hard-coded "Loading X" strings, inconsistently ending in `...` (7) vs `…` (3).

**Who it hurts.** Every user on every cold load. The false zeros are the serious half: the app states a fact that is not true, and on a slow gateway a user will believe they have no sessions.

**Recommended.** One `PageLoading` contract: header always renders, body shows a skeleton shaped like the content, counts render as `, ` (never 0) until resolved. Deleting 24 bespoke loading strings and 26 ad-hoc LoadingSpinner call sites is worth ~150 lines.

### Destructive actions have three visual treatments, one of which is indistinguishable from a neutral icon button

*Medium.*

**Measured.** Live inventory: /results/logs "Delete All" is 116x30 with red text on a red-tinted fill; /agent/models "Delete gpt-4o" is a 26x26 icon at `text-ps-text-muted` (rgba(255,255,255,0.55)) on a transparent background, no danger colour at all until hover; /work/chat "Delete conversation" is 28x28, same neutral grey. The two-step confirm rule has three implementations: `ConfirmButton` (15 import sites), `PerRowDeleteButton` (its own 8-line copy, src/components/models/PerRowDeleteButton.tsx), and 11 files that hand-wire `useTwoStepConfirm` directly (src/app/page.tsx, results/logs, work/chat, work/composer, memory/hindsight/RowActionButtons, missions/templates/TemplateManagerModal, models/CredentialsPanel, hooks/useMissionDispatch, useMissionTemplateActions, useVersionFooter). The armed ring has three values: `ring-1 ring-red-500/30` (x5), `ring-1 ring-red-500/40` (x3), `ring-1 ring-semantic-danger/60` (x1). Arming announces nothing: live test on /agent/models showed the aria-label change to "Click again to confirm deleting gpt-4o-mini" with zero live regions on the page.

**Who it hurts.** A user cannot tell a delete from an edit on two of the three screens I sampled. A screen-reader user who has already read the button gets no announcement that it armed, so the second press is unguarded. ConfirmButton's own header comment says it exists to end exactly this duplication, and 11 sites never adopted it.

**Recommended.** One destructive treatment (danger colour at rest, not on hover), one armed state, one `ConfirmButton`. Migrate the 11 hand-wired sites and fold PerRowDeleteButton into it as a size variant (~130 lines removed). Add `aria-live="polite"` to the armed label.

### A failed agent run is rendered as a paragraph, not as a recoverable error

*Medium.*

**Measured.** src/components/chat/MessageBubble.tsx:41-45: `if (msg.status === "failed") return <span className="text-neon-red/80 italic text-sm">{msg.error || "The agent run failed."}</span>` inside an ordinary assistant bubble. Seen live on /work/chat: "Hermes gateway at http://127.0.0.1:8749 did not answer within 30s..." in red italic, with a timestamp, no error icon, no role=alert, no Retry, no resend. Contrast is fine (4.56:1), this is purely interaction design. The app has three competing error surfaces overall: Toast (73 call sites), LoadErrorBanner (30 files, and chat DOES use it correctly for load failures with onRetry, page.tsx:187,216), and 51 files of inline `text-red-*` over 35 local `setError` states.

**Who it hurts.** The failure state of the product's primary conversational loop offers no way forward. The user must retype. And the same product has a well-built retry banner two components away.

**Recommended.** Give a failed message the same shape as LoadErrorBanner: icon, reason, Retry (resend the same prompt), and `role="alert"`. Then pick ONE error surface per situation, Toast for transient mutation results, LoadErrorBanner for a region that failed to load, and retire the 35 bespoke local error states.

### At 1024 the Models table's ACTIONS column is entirely off-screen with no scroll affordance

*Medium.*

**Measured.** At 1024 on /agent/models: the table is 898px inside a 774px scroll container, overflowing by 124px. The clipped part is the ACTIONS `<th>`/`<td>` containing the edit and delete buttons (three 26x26 buttons at x=1036, 1102, viewport 1024). Screenshot confirms the table ends at CONTEXT / DEFAULT FOR with no gradient, shadow or scrollbar cue. The page header also truncates: "4 models in registry · 0 c…". Clean at 1280 and above. Separately, /work/missions' kanban board hides 305px at 1280 and 80px at 1920 with the same lack of affordance (the FAILED column is cut mid-word: "Walk B17 mi").

**Who it hurts.** At 1024 a user cannot see, and would not guess, that row actions exist. Destructive and editing controls are precisely the part that disappears.

**Recommended.** Below ~1200 collapse the table to a card list (or pin the ACTIONS column). Add a shared scroll-affordance treatment, an edge fade plus a visible thin scrollbar, to every horizontally scrolling region; there are only two in the app.

### prefers-reduced-motion is an allowlist of 7 class names, so 28 animations keep running

*Medium.*

**Measured.** globals.css:350 and :544 list `.animate-flame, .animate-pulse-glow, .animate-float-in, .ps-electrified, .animate-shimmer::after, .viz-draw, .ps-rail-flow, [data-bloom]::after`. Measured with Playwright `reducedMotion: "reduce"`: 28 animations still running across the 25 routes, `gradient-shift [animated-border]` on the logo on ALL 25 screens, plus `pulse-glow`, `ping`, `spin-slow`. Not covered: animate-spin (34 uses), animate-pulse (13), animate-bounce (4), animate-ping (2), animate-spin-slow (2), animate-auto-refresh-tick (2), animate-in (1), and every `transition-*`.

**Who it hurts.** Users with vestibular sensitivity get a perpetually animating logo on every screen of the app after explicitly asking the OS for less motion.

**Recommended.** Invert to deny-by-default: `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important } }`, then re-enable the handful of spinners that carry meaning. That deletes the allowlist rather than growing it.

### 12px is 71% of all text, and 17 prose blocks run at a 1.33 line-height

*Medium.*

**Measured.** Font-size histogram over every text node on all 25 routes: 8px x9 (SVG chart labels on /results/insights, which `no-sub-12px-type` misses because it only reads .tsx class strings), 12px x2495, 13px x10, 14px x849, 16px x110, 18px x21, 20px x34, 24px x8. So 2495 of 3536 text nodes, 71%, are 12px. Separately, 17 long-prose blocks (>80 chars) compute `font-size:12px / line-height:16px` = 1.33, below the 1.5 WCAG 1.4.12 asks for body text: page subtitles, the /agent/settings and /agent/tools explanatory paragraphs, /help intro, /agent/models drift notes.

**Who it hurts.** Everyone reading. The scale itself is disciplined (only 8 sizes, that is genuinely good), but the product's default reading size is 12px, which is a terminal size applied to sentences. The long explanatory paragraphs this product relies on to teach itself are the worst-affected.

**Recommended.** Keep 12px as the mono/metadata size, promote body copy and descriptions to 13, 14px at line-height 1.5, and set the SVG chart label floor to 11, 12px. This is a token change, not a layout change.

### The focus ring fades in from currentColor over 150ms because transition-colors animates outline-color

*Medium.*

**Measured.** Tabbing to a rail link and sampling `outlineColor`: t+0ms rgba(255,255,255,0.55), t+30ms rgba(49,203,255,0.863), t+80ms rgba(4,192,255,0.984), t+160ms rgb(0,191,255). The element's computed `transition-property` is `color, background-color, border-color, outline-color, ...` at 0.15s, Tailwind v4's `transition-colors` includes `outline-color`. Screenshot of a freshly-focused rail link shows a dim grey ring, not a cyan one. Elements without `transition-colors` (skip link, logo) are cyan immediately.

**Who it hurts.** Anyone tabbing at normal speed through the 22-stop rail never sees the cyan ring, only a low-contrast grey one that is still resolving when they press Tab again. It also means the app has two apparent focus colours depending on whether a component happens to carry `transition-colors`.

**Recommended.** Add `transition-property: color, background-color, border-color, text-decoration-color, fill, stroke` as the house `transition-colors` (excluding outline-color), or set `outline-color` transition to 0s in the `:focus-visible` rule. One line.

### The form-control-names gate is satisfied by copying the placeholder into aria-label, which is the defect it was written to stop

*Low.*

**Measured.** scripts/tooling/check-form-control-names.mjs's header states "A PLACEHOLDER IS NOT A NAME" and refuses placeholder-only controls. Live, 3 controls pass it by setting aria-label to the placeholder verbatim: /results/sessions `aria-label="Search sessions by title, ID, profile, or mission"` == placeholder; /agent/skills `"Search all 4 skills..."`; /agent/memory `"Search memories (semantic search)..."`. In the New Mission panel the visible label reads "Instruction" but the accessible name is "The agent's task instructions..." and "Goals" is named "e.g. Gather data", a WCAG 2.5.3 Label-in-Name failure that also breaks voice control ("click Instruction" matches nothing). One control has no accessible name at all: the "Save current as…" input on /work/research.

**Who it hurts.** Screen-reader and voice-control users. Small headcount, but the gate reports green while the exact failure it documents is present in the product's primary form.

**Recommended.** Fix the one unnamed field, then extend the gate: reject `aria-label` that equals `placeholder`, and require the visible label's text to be a substring of the accessible name where a visible label exists.

### Disabled primary actions render at opacity 0.3, 1.84:1, and read as absent rather than unavailable

*Low.*

**Measured.** The only enabled-text contrast failures across all 25 screens are disabled controls, and they are severe: /work/composer "Review…" 1.87:1 (neon-cyan at opacity 0.3), /work/research "Start research" 1.87:1 and "Save" 1.96:1, /agent/memory "Recall"/"Reflect" 1.84:1, /agent/settings/system "Restart" 2.35:1, "Rebuild" 2.42:1, "Check for updates" 2.62:1 (opacity 0.5). WCAG exempts disabled controls, so no gate flags these.

**Who it hurts.** On /work/research and /work/composer the primary call to action is the disabled one at first load. A user does not see a button they cannot yet press, they see nothing, and cannot tell whether the feature exists.

**Recommended.** Replace `disabled:opacity-30` with a disabled token pair (muted fill + ps-text-muted foreground) that keeps the control legible at ~3:1, and pair it with a one-line reason ("Add a prompt first"). The control should read as "not yet", not as "not here".

### What this area could delete

Roughly 700, 900 lines are removable from the accessibility/interaction surface alone, all of it by consolidation rather than deletion of features. (1) One `SegmentedControl` replacing 13 hand-rolled filter/mode groups: ~200 lines, and it fixes ARIA state and arrow-key navigation for all of them at once. (2) One `PageLoading` contract replacing 24 hard-coded "Loading X..." strings, 26 ad-hoc LoadingSpinner call sites and 3 divergent behaviours: ~150 lines. (3) Migrating the 11 files that hand-wire `useTwoStepConfirm` onto `ConfirmButton`, and folding `PerRowDeleteButton` in as a size variant: ~130 lines, plus it collapses 3 armed-ring values to 1. (4) Consolidating 35 local `setError` states and 51 files of inline `text-red-*` onto Toast + LoadErrorBanner: ~200 lines. (5) Deleting the 46 bare `outline-none` declarations and their 40 `focus:border-*` partners so the global ring paints: small LoC but it removes a whole bug class and lets `no-bare-outline-none` become a simple ban. (6) One `PageContainer` replacing 19 ad-hoc `max-w-* mx-auto px-*` strings across 6 different widths. (7) Collapsing 84 distinct border colour utilities (8 `border-white/N` alphas, 12 `bg-white/N` values) to a 3-step scale, a large mechanical diff that shrinks class strings everywhere. (8) StatPill's two `.replace()`-derived class expressions become one static map (net ~0 lines, fixes 3 broken accents and 10 dead hover states). Separately worth flagging to whoever owns layout: the dashboard renders the Gateway and Memory subsystem status twice, once in the Subsystems panel and again in the tile row directly beneath it.

## Dead code, duplication and line count

> Classic dead code is essentially gone, only 462 lines are truly unreachable and knip is clean, so the LoC problem is structural, not vestigial: 37% of the 107k-line unit-test corpus is copy-pasted mock preamble, and 69% of components have exactly one importer, meaning there is no design system, just 213 independent local decisions about how a card, a button and a label should look.

### 37% of the 107k-line unit-test corpus is copy-pasted preamble, not tests

*High.*

**Measured.** Measured across all 615 files in C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit: 107,013 lines total, of which 39,499 (36.9%) sit BEFORE the first `describe(`/`it(`, imports and jest.mock scaffolding. 1,331 `jest.mock()` calls across 321 files. Top mock targets: @/lib/api-logger x109, @/lib/db x99, lucide-react x55, @/lib/api-auth x53, @/lib/audit-log x52, @/lib/api-fetch x48, next/navigation x36, next/server x33. 7,460 lines repeat VERBATIM in >=4 different files. The db-mock stanza (`let testDb: import("better-sqlite3").Database | null = null;` x50, `inTransaction: <T,>(fn) => testDb!.transaction(fn)()` x51, `execBaselineSchema(testDb)` x47) is pasted ~50 times at ~20 lines each. Worst preambles: b5-dashboard-is-an-operations-board.test.tsx 360 of 871 lines; b6-models-origin.test.ts 292 of 801; b4-emits-agent.test.ts 261 of 621. Meanwhile C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/helpers/ is only 211 lines in 3 files, and one of the three (render-with-query.tsx, 22L) has ZERO users.

**Who it hurts.** The largest single block of removable lines in the repo. Every new test starts with 64 lines of ceremony, which is why the suite grew to 111,664 lines against 105,965 of source. It also makes the suite brittle: changing @/lib/db's shape means editing 99 files.

**Recommended.** Hoist the repeated mocks. (a) Move the always-identical ones (api-logger, audit-log, api-auth, record-event, lucide-react, next/link, next/navigation) into tests/jest.setup.ts or jest.config moduleNameMapper, they need no per-file customisation. (b) Ship one `tests/helpers/with-test-db.ts` exporting a factory that the 50 db-mock sites call in one line (jest.mock's hoisting is satisfied by `jest.mock('@/lib/db', () => require('../helpers/db-mock').make())`). (c) Delete tests/helpers/render-with-query.tsx. Expect 12,000, 18,000 lines removed with zero behaviour change; it is a mechanical, reviewable pass.

### The component tree has almost no reuse: 69% of components have exactly one importer

*High.*

**Measured.** Import-graph measurement over 213 .tsx component files in C:/Users/Daniel/Documents/Coding/Github/PatterStage/src: 146 files (17,787 lines) have exactly ONE importer; 29 files (4,145 lines) have two; only 38 files (4,410 lines) have three or more. The entire genuinely-shared set is Button (38 importers), AppPageShell (29), PageHeader (28), LoadErrorBanner (26), Toast (26), LoadingSpinner (25), ConceptHint (14), Modal (14), ConfirmButton (11), Badge (10), Card (10). The consequence is measurable in the markup: 321 raw `<button>` elements vs 104 `<Button>` usages (76% bypass the shared button); 56 raw `<input>`, 28 raw `<select>`, 25 raw `<textarea>`; 106 hand-rolled card-chrome class strings (`rounded-* border border-white/10 bg-dark-900…`) across 69 files, against only 10 files that import C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/ui/Card.tsx. And 12 files hand-roll `fixed inset-0` modal overlays outside ui/Modal.tsx and ui/Sheet.tsx (6 of them in src/modules/rec-room/components/).

**Who it hurts.** This is the mechanism behind the operator's 'not formatted/aligned/sized correctly'. There is no design system enforcing size and spacing, there are 213 independent local decisions. It is also why the tree is 25,565 lines for what renders as ~25 fairly simple screens.

**Recommended.** Do not try to delete these 146 files; extract from them. Pick the 8, 10 recurring shapes (card, panel-with-header, list row, toolbar, empty state, form field, table) and make them primitives, then rewrite call sites against them. The LoC win is second-order but real (rough 15, 20% of the 22k single-use lines); the consistency win is the point. Add a lint rule banning raw `<button>`/`<input>` outside src/components/ui/, the repo already has custom linters (check-icon-button-names.mjs, check-form-control-names.mjs) so the enforcement machinery exists.

### Two competing data-fetching layers cause duplicate requests on every page; the dashboard fires 23 requests on load and 29 in 30 idle seconds

*High.*

**Measured.** Measured live against http://127.0.0.1:3939 with Playwright. GET / issues 23 API requests, 17 distinct, 6 endpoints are fetched TWICE: /api/status/runtime, /api/prefs, /api/monitor, /api/agents, /api/missions, /api/status/subsystems. In 30 seconds of idle the dashboard makes 29 requests (/api/monitor x4, /api/agents x3, /api/missions x3, /api/status/subsystems x3). Cause is two idioms coexisting: `useApiResource` on @tanstack/react-query (19 importers) and raw `safeApiCall` inside `useEffect` (16 files). Exact collisions: C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/layout/Sidebar.tsx:58 raw-fetches /api/prefs that src/hooks/useOperatorPrefs.ts:48 already caches; src/components/layout/RailFooter.tsx:40 raw-fetches /api/status/runtime that src/hooks/useQuestHost.ts:39 caches; src/hooks/useDashboard.ts runs six useQuery calls AND calls loadInitialDashboardData (src/lib/dashboard/dashboard-initial-load.ts:138) which fetches /api/agents a second time. Sidebar and RailFooter live in the layout, so all 25 screens pay it. Query keys make dedup impossible by construction: useDashboard uses ["dashboard","subsystems"] while useQuestHost uses ["status-subsystems"] for the same endpoint. A further 5 chrome calls fire on every screen (/api/stats via useStats inside the global FeedbackProvider, /api/status/runtime, /api/update, /api/feature-flags, /api/prefs).

**Who it hurts.** Doubles server load and DB reads for no benefit, and the racing responses are a likely source of the 'niggling' flicker the operator describes. It also means the react-query dependency is being paid for without getting its main benefit.

**Recommended.** Make useApiResource the only way to read from the API in a component; ban bare `safeApiCall` in useEffect via lint. Normalise query keys to the endpoint path so the cache dedupes by construction. Delete the loadInitialDashboardData second loader (155L) and let the six useQuery calls stand alone. This is a small diff with a large measurable effect: dashboard load should fall from 23 requests to ~13.

### Ten components each hand-roll the same click-outside dropdown, 1,778 lines, and half cannot be closed with Escape

*Medium.*

**Measured.** Every one of these registers its own `addEventListener("mousedown")` + ref.contains handler: C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/help/ConceptHint.tsx (118L), src/components/layout/BranchDropdown.tsx (105L), src/components/missions/CategoryCombobox.tsx (274L), src/components/schedule/SchedulePicker.tsx (462L), src/components/ui/field/Select.tsx (135L), src/components/ui/MissionTimeSelector.tsx (100L), src/components/ui/ProfileSelector.tsx (179L), src/components/ui/SkillSelector.tsx (155L), src/components/ui/TimeoutSelector.tsx (110L), src/components/ui/ToolsetSelector.tsx (140L). Only 5 files in the whole of src handle `key === "Escape"` (CategoryCombobox, SchedulePicker, ui/field/Select, useDialogA11y, rec-room/Tags), so BranchDropdown, MissionTimeSelector, ProfileSelector, SkillSelector, ToolsetSelector and ConceptHint trap the keyboard user. The duplication detector confirms verbatim 12-line clones between MissionTimeSelector:23 and TimeoutSelector:31, and between SkillSelector:24 and ToolsetSelector:26.

**Who it hurts.** 1,778 lines to maintain, six accessibility defects, and six subtly different dropdown appearances on screens the operator says look inconsistent.

**Recommended.** Build one headless Popover/Listbox primitive (click-outside + Escape + focus return + roving tabindex, ~120 lines) and rewrite the ten against it. Expect ~1,000 lines removed and the Escape bug fixed once rather than six times.

### Two competing form kits, three Select implementations, two Toggles, and eight spellings of one field label

*Medium.*

**Measured.** C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/ui/Input.tsx (354L) exports SearchInput, TextInput, NumberInput, Toggle, InlineToggle and Select; C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/ui/field/ (292L across Field/Input/Select/Toggle/index) exports a second Input, Textarea, Select and Toggle. A third Select lives at src/components/ui/Select.tsx:32 (InlineSelect). Both kits have 8 importers, so neither is winning. Separately, scanning all 2,919 className literals in src (136,313 characters, 9.4% of the .tsx bytes): the field label is written eight different ways, `text-xs font-mono uppercase tracking-widest text-ps-text-muted` x15, `text-xs text-ps-text-muted font-mono block mb-1` x11, `…block mb-1.5` x8, `block text-sm text-ps-text-muted mb-1` x9, `text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5` x5, `…block mb-2` x4, `mt-0.5 text-xs uppercase tracking-wider text-ps-text-muted` x5, plus a bare `text-xs font-mono text-ps-text-muted uppercase tracking-widest` x4, 61 label sites, three different bottom margins, three different tracking values. The full-page loading state is written twice as well (`min-h-screen bg-dark-950 grid-bg flex items-center justify-center` x5 and the same string without grid-bg x5). 200 className strings exceed 120 characters; hoisting only the strings repeated 4+ times removes 7,206 characters.

**Who it hurts.** This is precisely the 'not formatted/aligned/sized correctly' complaint, and it is not subjective: labels above adjacent fields are 2px and 4px apart in margin and differ in letter-spacing, because there are eight independent definitions.

**Recommended.** Collapse to ONE form kit (keep ui/field/, fold ui/Input.tsx's SearchInput/NumberInput into it, delete ui/Select.tsx), ~300 lines. Define `Label`, `Field`, `PageLoading` and `EmptyState` as components, not as class strings, so there is one margin and one tracking. Add these to design-lint's ruleset.

### 144 of 615 unit-test files are named after the batch that produced them, not the thing they test

*Medium.*

**Measured.** C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit contains 144 files prefixed b1- through b19- (37,744 lines; b6 alone has 19 files). These are per-batch regression logs rather than per-subject suites, and they overlap: 553 duplicated 15-line windows across 25 distinct file-groups. Concrete clusters, the composer db-migration setup block is identical across a-hil-gate-asks-the-human.test.ts, b12-starter-workflows.test.ts, b12-workflow-description-round-trip.test.ts, b19-the-broken-end-is-repaired.test.ts, composer-builder.test.ts, composer-engine.test.ts and composer-group-node.test.ts (7 copies); the NextResponse stub is duplicated across b14-research-cancel, b14-stories-route-signal, b14-story-edit-controls-and-premise, b14-story-handlers-pass-spend, b6-models-drift-banner, b6-models-origin and story-stop-is-not-a-provider-timeout (7 copies); the same stats-shape fixture appears in 6 files. The suite is 5,471 `it()` blocks in 1,534 describes.

**Who it hurts.** Nobody can tell what is covered or find the test for a given module, so new work adds another batch file rather than extending the existing suite, which is how the corpus reached 111k lines. Redesigning the UI will require rewriting these tests; halving them first halves that cost.

**Recommended.** Rename/merge by subject, not by batch: one composer-engine suite, one models-repository suite, one sessions-filters suite. Do this in the same pass as the mock-hoisting above, the two together are the single biggest LoC reduction available. Estimate 8,000, 12,000 lines.

### /work/composer ships 546 KB of JavaScript; every other screen ships 28, 139 KB

*Medium.*

**Measured.** Measured with Playwright by summing decoded response bodies for /_next/static/**/*.js per route on the live build: /work/composer 546 KB over 15 files, / 139 KB, /work/missions 133 KB, /agent/models 66 KB, /results/insights 51 KB, /results/sessions 49 KB, /work/chat 28 KB. The delta is @xyflow/react (3.2 MB in node_modules) plus @dagrejs/dagre (1.8 MB), imported eagerly by C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/composer/WorkflowCanvas.tsx (670L), src/components/composer/WorkflowRunCanvas.tsx and src/lib/composer/canvas-graph.ts. /work/composer is also the only one of 29 pages that does not use AppPageShell.

**Who it hurts.** One screen is 4, 19x heavier than the rest, on a self-hosted app the operator runs on modest hardware. The graph is not visible until a workflow is selected, so most of that payload is loaded for nothing.

**Recommended.** `next/dynamic` the two canvas components with `ssr: false` and a placeholder. Moves ~400 KB off the route's initial load with no functional change. Also bring composer/page.tsx onto AppPageShell so all 29 pages share one frame.

### 38 migration wrappers where 17 are the identical 20-line stanza, plus a dead benchmark subsystem still in the schema

*Medium.*

**Measured.** C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/db/ holds 38 `apply-*-migration.ts` files totalling 1,838 lines against 41 SQL files totalling 1,931 lines (schema v41). Seventeen of the TS wrappers (582 lines) contain no logic at all beyond `getSchemaVersion → execMigrationFile(join(dir, 'NNN_x.sql')) → setSchemaVersion`, see apply-artifacts-migration.ts (28L) as the template; the other 20 carry real column-repair logic. Two migrations exist only to undo earlier ones (011_drop_game_tables.sql, 020_retire_mission_phases.sql). Querying the seeded live DB: 49 tables, 13 of them empty, including benchmark_runs, benchmark_item_results and bench_gateways, created by migrations 014, 017, with benchmark_item_results referenced by nothing but its own migration, and src/hooks/useAgentExperience.ts:7 recording that the /api/benchmarks/leaderboard endpoint that fed them was removed. Also 0-row and vestigial: cron_jobs (superseded by schedules per src/lib/missions/mission-types.ts:39), agent_processes, gateway_platforms, error_log_entries. Test cost is real too: 16 unit files import apply-composer-migration and 12 import apply-composer-group-link-migration.

**Who it hurts.** ~600 lines of pure ceremony in src plus the tests that hold it, and a schema that carries four tables for a feature whose UI and endpoint were deleted.

**Recommended.** Replace the 17 pure wrappers with one `applyMigration(db, dir, version, file)` driver plus a `[version, filename]` table in db/index.ts (~480 lines out). Add migration 042 dropping benchmark_runs, benchmark_item_results, bench_gateways and cron_jobs. Do NOT squash the whole 41-step chain to a new baseline unless the release programme confirms no installs predate it, that would remove ~3,700 lines but breaks upgrades.

### 32 of 59 hooks (4,665 lines) have exactly one importer; three page-controller chains are pass-through plumbing

*Medium.*

**Measured.** Import counts over C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/hooks: 32 hooks have exactly one importer, totalling 4,665 lines, 60% of the 7,836-line hooks directory. Three chains dominate. Missions: useMissionsPage (267L) is the sole importer of useMissionDispatch (422L), useMissionsData (360L), useMissionTemplateActions (336L) and useMissionsFiltering (111L), which itself solely imports useMissionCategories (138L). Models: useModelsPage (105L) is the sole importer of useModelActions (453L), useModelFallbackChain (233L), useModelFallbackConfig (169L) and useModelsRegistry (142L). Chat: useChatPage (183L) is the sole importer of useChatSend (307L), useChatConversations (211L), useAgentRunStream (172L), useGatewayHealth (198L), useChatTranscript (62L) and useChatInput (40L). The duplication scanner shows the cost directly: src/app/work/missions/page.tsx:57 and src/hooks/useMissionTemplatesState.ts:199 share a verbatim 12-line prop-forwarding block, as do src/components/memory/HindsightBrowser.tsx:85 and src/components/memory/hindsight/useHindsightDirectives.ts:147.

**Who it hurts.** Each layer re-declares and forwards the same ~30 fields, so a single new mission field is edited in four files. This is the structural reason the missions feature totals ~10,200 lines (components 4,093 + lib 3,495 + hooks 2,583).

**Recommended.** These chains exist because the pages are 400, 700 lines of orchestration. Fix the page, not the hook: when the redesign splits a page into sections, each section owns its own data, and the forwarding layers disappear. Estimate ~2,000 lines. Do not do this as a standalone refactor, it only pays off alongside the page rewrite.

### The dashboard states Gateway and Memory health twice, 60 pixels apart

*Medium.*

**Measured.** Screenshot of http://127.0.0.1:3939/ at 1440x900 (saved to C:/Users/Daniel/Documents/Coding/Github/PatterStage/tmp/survey/dashboard.png). C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/page.tsx:355 renders SubsystemsPanel with five rows, Gateway/Healthy, Memory/Healthy, Sync/Healthy, config.yaml/Healthy, Gateway gate/Healthy, and immediately below at page.tsx:362-403 renders six StatPills labelled Gateway, Memory, Scheduler, Spend, Processes, Errors. Gateway and Memory each appear twice with the same value. The two are fed by two different endpoints (/api/status/subsystems for the panel, /api/monitor for the pills), both of which are among the six duplicated fetches above. The dashboard renders 589 DOM elements for 1,725 characters of visible text.

**Who it hurts.** The landing screen spends its most valuable vertical space saying the same thing twice, and pays two polls to do it. This is the cheapest visible win in the redesign.

**Recommended.** Keep one. The SubsystemsPanel rows carry a reason string ('reachable at http://127.0.0.1:8747', '131 admitted, 0 refused') which the pills do not, so keep the panel and drop Gateway/Memory from the pill strip, or fold both into one status strip fed by /api/status/subsystems alone. Removes ~150 lines and one poll.

### Ten unreachable modules (1,429 lines), four alive only because a test imports them

*Low.*

**Measured.** Reachability walk from all 138 Next.js entrypoints (page/layout/route/error + instrumentation.ts + proxy.ts) over 822 src modules: 812 reachable, 10 not. Lines and paths, all under C:/Users/Daniel/Documents/Coding/Github/PatterStage/: src/lib/retention/retention-repository.ts (352L), src/lib/retention/retention-prune.ts (285L), src/lib/runtime/run-trajectory.ts (243L), src/lib/retention/retention-law.ts (138L), src/lib/llm-judge.ts (128L), src/lib/schema/generate.ts (75L), src/lib/retention/retention-status.ts (66L), src/lib/sessions/session-window.ts (53L), src/lib/schema/mission-v1.ts (51L), src/lib/help/concept-attachments.ts (38L). Of these, the retention chain (841L) and schema/generate are reachable from scripts/tooling (npm run db:retention, npm run generate:schema-json) so they are tooling, not dead. The genuinely dead set is run-trajectory (243L), llm-judge (128L), session-window (53L), concept-attachments (38L) = 462 lines, each kept green by exactly one test file (tests/unit/run-trajectory.test.ts, llm-judge.test.ts, session-window.test.ts, and the help suite). knip does not see them because knip.json declares `tests/**/*.test.{ts,tsx}` as entrypoints. Separately, three API routes have zero callers anywhere in src: /api/agent/profiles/sync/drift (24L), /api/cron/hardware/meta (23L), /api/missions/[id]/dispatch (47L), all three ARE documented in docs/reference/api.md, and two of those doc rows are factually wrong (the drift banner actually reads `syncStatus` from GET /api/agent/profiles, and the UI dispatches missions through the POST /api/missions action envelope, not the 'replacement' route that route.ts's own header claims superseded it).

**Who it hurts.** Small in lines but it is the honest answer to 'what is actually dead': the codebase has been swept well and there is very little. Worth taking because each one also carries a test file.

**Recommended.** Delete run-trajectory.ts, llm-judge.ts, session-window.ts, concept-attachments.ts and their four test files (462 src lines + ~400 test lines). Delete the three orphan routes and their rows in docs/reference/api.md, or wire them up, but fix the two wrong doc rows either way. Then add `ignore` entries or drop tests from knip's `entry` list so knip stops giving a clean bill to modules only tests keep alive.

### Framer Motion is a runtime dependency serving three wrappers used by two files, and nine CSS classes match nothing

*Low.*

**Measured.** C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/motion/index.tsx (75L) is the ONLY file in src importing `motion/react`. It exports Stagger, StaggerItem and Collapse, consumed by exactly two files: src/app/results/insights/page.tsx and src/components/achievements/AchievementShowcase.tsx. node_modules/motion is 669 KB and pulls framer-motion at 5.5 MB. globals.css already ships equivalent CSS (`animate-float-in`, and grid-template-rows handles Collapse). Separately, scanning all 25 class selectors in C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/globals.css (682 lines: 415 code, 206 comment, 61 blank) against the whole tsx/ts tree, nine match nothing: .glow-purple (:254), .glow-green (:259), .glow-pink (:264), .glow-orange (:269), .animate-pulse-glow (:288), .ps-rail-done (:338), .ps-electrified (:348), .text-glow-purple (:389), .skeleton-shimmer (:448), plus their keyframes and the prefers-reduced-motion entries at :352-354.

**Who it hurts.** A whole animation runtime in the bundle for ~40 lines of effect, and ~40 lines of CSS that can never fire. Also: .skeleton-shimmer existing-but-unused suggests a skeleton-loading pattern was designed and never adopted, which matters for the redesign's loading states.

**Recommended.** Rewrite Stagger/StaggerItem/Collapse in CSS, delete src/components/motion/, and drop `motion` from package.json dependencies. Delete the nine dead CSS rules and their keyframes. Decide deliberately whether skeleton loading is part of the redesign, if yes, adopt .skeleton-shimmer everywhere; if no, delete it.

### What this area could delete

Total realistic deletion: 26,000, 36,000 lines, 12, 17% of the 217,600-line ts/tsx corpus (src 105,965 + tests 111,664). SRC, 6,000, 8,500 lines (6, 8%), ranked by lines x safety: (1) ten hand-rolled dropdowns behind one Popover primitive, ~1,000 lines, medium risk; (2) page-controller hook chains collapsed during the page rewrite, ~2,000 lines, medium-low risk, only pays off alongside the redesign; (3) 17 pure migration wrappers replaced by a [version, filename] table, 480 lines, high safety; (4) genuinely unreachable modules run-trajectory/llm-judge/session-window/concept-attachments plus their four test files, 462 src lines, high safety; (5) two form kits merged to one, ~300 lines, medium; (6) dashboard Gateway/Memory double-statement plus the second dashboard loader dashboard-initial-load.ts, ~305 lines, high safety; (7) three orphan API routes, 94 lines, high safety once the docs rows go with them; (8) src/components/motion/ plus the `motion` dependency, 75 lines and a 669 KB package, high safety; (9) nine dead CSS classes and their keyframes, ~40 lines, high safety; (10) hoisting the class strings repeated 4+ times, 7,206 characters, high safety. TESTS, 20,000, 28,000 lines (18, 25%), and this is where the money is: hoisting the repeated jest.mock preamble (39,499 lines of preamble across 615 files; 1,331 mock calls; 7,460 verbatim-duplicated lines) removes 12,000, 18,000 lines mechanically with zero behaviour change, and consolidating the 144 batch-named files (37,744 lines, 553 duplicated 15-line windows) by subject rather than by batch removes another 8,000, 12,000. NOT RECOMMENDED without a policy decision: squashing the 41-migration chain into a new baseline would remove ~3,700 further lines but breaks any install predating it. NOT AVAILABLE: there is no retired-feature dead zone to sweep, /orchestration (1,532 lines) and /laboratory (1,668 lines) are both fully wired and live despite the route renames, and the only vestige of a deleted feature is the benchmark table set (four tables, all 0 rows, endpoint already removed), worth one drop migration rather than a code deletion.

## What is good, and must survive the overhaul

Collected from every survey. A redesign that loses these has failed, however
tidy the result: the operator likes this product and its character is not
negotiable.

**The design system and its tokens**

- The four-tier text system (--color-ps-text-primary/secondary/muted/faint, globals.css:69-72). It is DERIVED, not chosen: 92/70/55/50% white against the actual painted ground, with the derivation written beside it. It is genuinely adopted, 1,197 source uses, and 81.5% of every text element rendered across 22 routes resolves to one of the four. Every tier clears AA, and my own per-element contrast walk of 22 routes found zero failures on tier-painted text. This is the single best thing in the design system. Do not touch the values; the redesign should extend the same method to surfaces and borders.
- scripts/tooling/contrast-check.mjs. Narrow (it measures four token declarations, not the DOM) but the idea is exactly right: the tokens are re-derived from the background on every run and the gate refuses to lower the requirement. Widen its scope; do not weaken it.
- scripts/tooling/design-lint.mjs as a mechanism, 15 rules, a baseline that only ratchets down, and a `--allow-growth "<reason>"` escape that records the reason inside the baseline file. The baseline is currently `{}`: zero violations across 105k lines. Raw hex and rgba() in .tsx are genuinely at zero. Most codebases this size have no such thing.
- The single focus ring: `:focus-visible { outline: 2px solid var(--color-neon-cyan) }` declared once (globals.css:676-681) with `no-bare-outline-none` refusing any control that removes it without replacing it. Keep the rule and the enforcement verbatim.
- The literal accent maps in src/lib/theme.ts and the `no-template-literal-tailwind` rule that keeps them literal. The header comment (theme.ts:49-72) explains that generated classes silently compile to nothing and names the two defects that caused. This is real, hard-won knowledge.
- src/components/viz/colors.ts, 17 lines, every chart series resolving through `var(--color-neon-*)` and `color-mix` for alpha. The right size and the right idea. Chart series colour is the one part of the colour system that is not sprawling.
- 1px border width discipline: 507 rendered borders, effectively all 1px. Whatever else is inconsistent, stroke weight is not.
- The comment culture in globals.css, every token block says why the value is what it is, what it replaced, and what was measured. The bloom comment being stale is an argument for keeping these accurate, not for deleting them. A redesign that strips the reasoning and leaves bare hex is a downgrade.
- The Cherenkov identity itself: cold blue-tinted dark ground, a five-rung cyan ladder, a restrained glow reserved for live/active state, and a mono-forward operator register. That is what makes this look like a reactor console rather than a generic dark-mode admin panel. The fix is fewer competing accents and more contrast, not a different palette.

**The sidebar**

- The nav is DERIVED, not written. src/components/layout/sidebar-config.ts is a pure presentation adapter over src/lib/modules/registry.ts, the registry owns labels, hrefs, order, colours and feature flags, and the ICONS map is exhaustive over IconName so a new surface without an icon is a compile error, not a blank row. Any redesign must keep consuming the registry; do not go back to a hand-written array.
- One <aside>, rendered once, that is both the desktop rail and the phone drawer (Sidebar.tsx:139-247). This was hard-won (it used to render twice and put ~30 invisible links in the phone's tab order) and tests/e2e/rail-no-scroll.spec.ts:30 pins it. Keep the single-element model.
- The drawer accessibility is genuinely better than most products: role=dialog + aria-modal + inert + aria-hidden when closed, a focus trap via useDialogA11y, a real <button aria-label="Close navigation"> as the backdrop rather than a click-catching div, and a skip link as the first tab stop on every page (layout.tsx:82-87). Keep all of it.
- The focus ring: 2px solid #00bfff at 2px offset, measured 8.81:1 against the rail. Consistent, visible, and applied by default. Do not replace it with a subtle one.
- The collapse state is a server-persisted operator preference in /api/prefs, not localStorage, so it follows the operator across browsers and machines. The MODEL is right; only the client-side-fetch implementation causes the flash. Keep the persistence, fix the read.
- The text tiers are derived from the painted background rather than picked by eye, documented inline at globals.css:47-73, and gated by scripts/tooling/contrast-check.mjs. Measured against the real rail background (#0a131d, not the #040b12 the tool assumes) all four still clear AA: primary 15.82:1, secondary 9.40:1, muted 6.18:1, faint 5.30:1. The tiers are sound, the failure is that the rail uses one of them for everything. Keep the tiers and the gate (and teach the gate about the rail's composited background).
- Colour-per-destination already exists in the data: every registry link carries an AccentColor, and the active icon renders in it (cyan 8.81:1, purple 6.33:1, green 15.01:1, pink 7.59:1, orange 6.39:1 on the rail, all pass AA). This is the single best idea in the rail and it currently fires on exactly one row at a time. A redesign should lean on it harder, not remove it.
- The brand mark has character: the animated-border terminal glyph and 'The Stage is Yours' with the cyan glow. It is the one place the product's personality shows in the chrome. Keep the mark and the line; the 80px fixed block around them is what needs rethinking, not the mark.
- QuestBadge's restraint (src/components/quests/QuestBadge.tsx): renders nothing while stats are unread, nothing once all quests are done, a dot instead of '25/32' when collapsed so the rail's width never changes, aria-hidden so it does not fight the link's accessible name, and it rides an existing deduped poll rather than adding a request. That is the standard the rest of the rail should be held to.

**Alignment, sizing and spacing, screen by screen**

- The identity. Dark console ground, per-section neon accents (cyan Work / green Results / purple Agent / pink Rec Room), JetBrains Mono for values and IDs, the ring dials, the traffic-light terminal chrome on the log viewer. It is a distinctive product and a rewrite that flattens it into generic dashboard grey fails.
- PageHeader's contract. h1 renders at a stable 20px/700 white on all 25 screens, the title comes from the registry so the rail entry, the h1 and the tab agree, and every header carries a ? into its guide. Fix the geometry, keep the contract.
- The rail's information architecture. Dashboard, then Work / Results / Agent / Rec Room, 17 destinations, Quests progress and Help pinned in the footer with the version string. The map is good, only its rendering is weak.
- The token layer in src/app/globals.css (lines 29-31, 53-137). Three named surfaces (ground/panel/well), four derived text tokens, documented derivations and a contrast-check script. ps-text-muted measures 6.21:1 and ps-text-faint 5.33:1, the text colours are already right. Extend this file rather than replacing it.
- /agent/settings' card grid: three 378px columns, 16px gap, uniform 154px rows, icon top-left and chevron top-right, uniform 32px section gaps, section title plus one-line description. It is the best-built layout in the app and should be the template for the rest.
- /help's typography: 16px Inter body at a sensible measure, real prose, proper link colour. It is the only comfortable reading in the product and shows what the rest could be.
- Basic hygiene that is already solid: zero horizontal document overflow on all 25 screens at 1440, zero console errors on all 25, CLS exactly 0 on nine screens, and the sticky header's backdrop-blur genuinely works when content scrolls under it.
- The characterful set-pieces: the mission kanban, the log terminal window, the stat rings, the quest chapter progression, the achievement tiles. Fix their geometry; do not delete them.

**The component layer**

- The visual identity itself. Dark console ground, JetBrains Mono for data, Inter for prose, neon cyan/purple/green/orange/pink accents, and the GlowSurface bloom-on-pointer field (data-bloom, src/kit/BloomField.tsx). /agent/models and /work/missions are genuinely handsome screens. A redesign that flattens this into a generic dashboard fails.
- src/components/ui/Toast.tsx (26 callers). Portaled to body to escape backdrop-blur stacking contexts, z-ordered above Sheet(61)/Modal(70), aria-live, errors persist while successes auto-dismiss, and a stack rather than one slot so a success cannot destroy an unread error. Best-engineered component in the repo. Do not touch it.
- src/components/ui/LoadErrorBanner.tsx (26 callers) and the read contract it enforces: a failed read shows a persistent banner with Retry, never the empty state. Rare discipline; keep the rule and the component.
- src/hooks/useDialogA11y.ts (14 callers) -- focus trap, focus restoration, Escape, scroll lock, shared once. The new Dialog primitive should wrap this, not replace it.
- src/components/layout/AppPageShell.tsx (29 callers) + PageHeader.tsx (28). Every page in the product wears the same frame, and it works. This is the one layer that already is a system.
- src/lib/theme.ts accent maps (iconColorMap, colorBorderMap, focusColorMap) as the token source, and the literal-class discipline documented in Panel.tsx:69 (Tailwind cannot see interpolated class names). Any new primitive must follow the same rule.
- src/components/viz/* -- Sparkline, Donut, ProgressRing, StatStrip. Distinctive, well-scoped, and the donuts are a signature the operator should keep.
- src/components/help/ConceptHint.tsx (14 callers) -- inline glossary on a dotted underline. A real product feature, not chrome.
- src/components/ui/field/Field.tsx -- labels associated with controls by construction (it mints the id and clones it onto the child). The right idea. It should become the ONLY label, not one of six.
- src/components/ui/field/Select.tsx -- a real keyboard-accessible listbox with roving focus and Escape. This is the dropdown the other nine should have been.
- src/components/dashboard/LedgerRow.tsx + Panel.tsx -- the row-inside-panel pattern with correct innermost-wins bloom semantics. Good bones for the DataList primitive.
- The commentary culture. Files like Panel.tsx, Toast.tsx and Field.tsx explain WHY, citing the task and the defect that forced the change. Preserve that habit through the rebuild; it is why the good components are good.

**Information architecture and screen purpose**

- The primary loop is genuinely fast and must not get slower. Measured on the live instance: Dashboard → click the 'Bug Hunt' template pill → the New Mission sheet opens with Name, Instruction AND Goals fully prefilled and the CTA already reading 'Dispatch now' → click it. Two clicks, zero typing, from home to a running mission. Getting back is one click: 'CONTINUE WORK → open transcript'. This dispatch strip is the single best thing in the product.
- /results/insights is the best-composed screen in the app (measured 19.2% density, ten charts, all legible at 1440). Its spend copy is honest in a way most products are not: it names the fallback price, says how many runs were estimated, and flags the one run with no token usage. Keep the screen, keep that copy discipline.
- The New Mission sheet's progressive disclosure: four numbered sections (DISPATCH, MISSION PARAMETERS, RUNTIME, ASSEMBLED AGENT PROMPT) collapsed by default with three fields visible. This is the right pattern for a form with ~30 possible inputs and it should be the template for Composer and Research too.
- /work/chat's three-pane layout (conversation list, transcript, composer) is correct and needs no redesign beyond the shared shell fixes.
- Quests as a first-class, chapter-structured, auto-ticking ledger (25/32, seven chapters, 'Each ticks itself when the product records you doing it, so there is nothing here to mark off by hand'). The rail badge, the Dashboard 'START HERE' card and the 'Hide this guide' retirement are a coherent onboarding system. Do not turn this into a checklist widget.
- The registry-derived navigation (src/lib/modules/registry.ts → sidebar-config.ts). Labels, hrefs, order and the h1 all come from one place, and PageHeader's useRegistryTitle keeps the rail entry, the h1 and the tab title identical. This is the right architecture; the redesign should use it harder, not replace it.
- Help: one guide per screen, ~90 pages in six named tiers, and a ? in every page header that resolves to that screen's own guide. Densest screen in the app at 41.7% and it earns it.
- The character of the thing: neon-on-near-black, mono labels, uppercase micro-caps, the lucide icon set, the accent palette (cyan/orange/green/purple/pink). It reads as an operator console and that is what it is. The redesign should tighten it, not neutralise it.
- The writing voice throughout. Subtitles like 'Deliverables your agents produced, reports, run outputs, saved snippets' and empty states like 'Create character sheets to reuse across stories' are written by a person for a person. Every screen has one. Do not let a redesign flatten these into nouns.
- StatStrip's per-tile `hint`, every number carries a tooltip saying exactly what it counted, with code comments recording the three times a tile lied. Keep the discipline even when the strip itself is cut down.
- Composer's RUN / BUILD tab split, and its 'EXAMPLES, CLICK TO FILL' affordance. Same idea as the Dashboard template pills and equally good.

**Accessibility, responsiveness and interaction**

- The text-contrast discipline is real and it survives live measurement. I composited every ancestor background (including oklab/color-mix values, which a naive parser silently skips) for every text node on all 25 routes: ZERO enabled-text failures. Only disabled controls fall below AA. Whatever process produced --color-ps-text-* and the neon-purple brightening note in globals.css:16-22 is working, do not restart the palette from scratch.
- The mission dispatch loop is textbook and must be copied, not replaced. Timed live: Dispatch now → role=status "Dispatching mission..." at t+90ms → "Mission dispatched" at t+263ms → panel closes → focus returns to the New Mission trigger. That is the correct sequence and most products get it wrong.
- The Toast component (src/components/ui/Toast.tsx). Portaled to body to escape backdrop-blur stacking contexts, z-raised above Sheet/Modal, aria-live polite/assertive by type, and errors persist until dismissed while successes auto-dismiss. Its header comment records four separate real defects it fixes. Keep the component and the reasoning.
- The mobile drawer's dialog behaviour, minus the one trap leak: role=dialog, aria-modal, aria-label, focus moves in, Escape closes, focus restores to the hamburger, scroll locked (verified main.scrollTop 0 → 0 under an 800px wheel). Also that the rail renders ONCE rather than twice, Sidebar.tsx's header records the tab-order bug that fixed.
- Skip link and document structure. Tab 1 on every route is "Skip to main content", Enter moves focus to <main tabindex=-1>, and the next Tab lands in content. Exactly one <h1> on all 25 routes. No horizontal DOCUMENT scroll at 1920/1440/1280/1024/768/390 on any route.
- Every icon-only button I focused had an accessible name, the icon-button gate is doing its job across 22 rail stops and hundreds of controls. Keep the gate.
- The typography scale: 8 distinct sizes across 3,536 text nodes. That is unusually tight. Fix the 12px default, keep the restraint.
- The two-step arm/confirm pattern itself (arm, act, self-disarm at 4s, never disabled by being armed). It is the right destructive interaction for a console. The problem is three implementations, not the idea.
- The code's commentary. Files like ConfirmButton.tsx, useDialogA11y.ts, Toast.tsx and check-icon-button-names.mjs encode the actual defect that caused each decision, with the numbers. A redesign that strips these comments will re-introduce the bugs they document.
- The character: the cyan-on-near-black terminal aesthetic, the mono labels, the accent-per-domain colour coding, the animated-border logo. None of my findings require softening it, they require making the surfaces and edges legible enough for the aesthetic to actually read.

**Dead code, duplication and line count**

- The visual identity. The Cherenkov-blue-on-dark-950 palette with neon accents, mono uppercase labels and the subsystem/pill status language reads like a product with a point of view, not a bootstrap template. A redesign that lands on generic shadcn grey has failed even if every measurement improves.
- The derived token layer in src/app/globals.css. --color-ps-text-primary/secondary/muted/faint are not picked by eye, they are derived from measured contrast against the actual painted background (16.7:1, 9.7:1, 6.3:1, 5.3:1) with the derivation written down and re-derivable via scripts/tooling/contrast-check.mjs. Same for --color-ps-surface-ground/panel/well/hairline, which record real usage counts. Extend this layer; do not replace it.
- AppPageShell + PageHeader + PageTitle. 28 of 29 pages already use all three, so the page frame is the one part of the system that IS consistent. Only src/app/work/composer/page.tsx opts out, bring it in rather than loosening the rule.
- useApiResource (101 lines, 19 importers). It is the right abstraction and the fix is to route the remaining 16 raw-fetch files through it, not to replace it. Same for useDialogA11y (13 importers) and useTwoStepConfirm (11), real shared behaviour, already shared.
- The custom lint gate: design-lint.mjs, contrast-check.mjs, check-icon-button-names.mjs, check-form-control-names.mjs, coverage-floor-check.mjs. The comment blocks in globals.css name the specific defects these caught (2,377 elements failing AA; thirteen sites using an undeclared neon-red). The redesign should ADD rules to this gate, never relax it.
- The dead-code discipline itself. knip is configured, passing, and honest, 812 of 822 modules are reachable from real entrypoints. Whatever process produced that should survive; it just needs its blind spot closed (tests declared as knip entrypoints hide test-only modules).
- The Subsystems panel's reason strings. 'reachable at http://127.0.0.1:8747', '131 admitted, 0 refused', 'last cycle clean at ...', these tell an operator what to DO. The pill strip's bare 'Healthy' does not. When the two are merged, keep the reasons.

