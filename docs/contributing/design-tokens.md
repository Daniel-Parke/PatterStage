---
title: Design tokens
summary: The design system as built - the surface and edge ladder, the type scale and its register, the status ladder, radius, layers, elevation and duration, the primitive set and the rule for ui/ - and how TypeScript maps to the CSS tokens
section: contributing
nav: 50
audience: contributor
type: reference
tags: [product, design]
compiled_from: normalised
---
# PatterStage: design tokens

The design system as it exists after the 2026-09 overhaul (`org/plans/2026-09-ui-overhaul.md`):
one source in `src/app/globals.css` (`@theme`), mirrored where TypeScript needs
it in `src/lib/theme.ts`, and held by gates rather than by asking nicely
(`design-lint`, `contrast-check`, the live census). Read it top to bottom once;
after that, the rule for any new screen is the same everywhere: pick the role,
not the value.

## Layer A: Cherenkov primitives

Source ladder ([Cherenkov radiation palette](https://www.color-hex.com/color-palette/1022135)):

| Token / role | Hex | RGB |
|--------------|-----|-----|
| Brightest glow | `#33ddff` | 51, 221, 255 |
| Interactive / links | `#00bfff` | 0, 191, 255 |
| Mid blue | `#00a1e6` | 0, 161, 230 |
| Deep blue | `#008bd1` | 0, 139, 209 |
| Anchor blue | `#0071c2` | 0, 113, 194 |

Registered in `src/app/globals.css` as `--color-cherenkov-100` … `--color-cherenkov-500` (100 = brightest).

## Layer B: Surfaces (blue-tinted neutrals)

Dark scales are slightly mixed toward `#0071c2` so panels read "cool reactor core" rather than flat gray. These are the primitives the ladder below is solved from; no component picks one directly any more (see B2).

| Token | Hex (approx) |
|-------|----------------|
| `dark-950` | `#040b12` |
| `dark-900` | `#0c1520` |
| `dark-800` | `#121f2d` |
| `dark-700` | `#1c2d40` |
| `dark-600` | `#263d54` |

### Layer B2, the surface and edge ladder

Layer B names colours for how they look, which is why it cannot say whether
`dark-900` is a panel or a well. These seven say it, and every one of them is
SOLVED rather than picked: `scripts/tooling/derive-surface-ladder.mjs` is given
a ground, a ray and a target ratio, and `contrast-check.mjs` recomputes each
ratio from the hex actually written in `globals.css`. An edit that looks nicer
and measures worse fails the gate.

**Fills.** Each rung is at least 1.45:1 above the one it sits on.

| Role | Utility | Is | Use |
|------|---------|----|-----|
| ground | `bg-ps-surface-ground` | `#040b12` | the page itself |
| panel | `bg-ps-surface-panel` | `#1e3042` | rail, header, card, any raised region |
| raised | `bg-ps-surface-raised` | `#2e4a66` | dialog, popover, active row, table head |
| inset | `bg-ps-surface-inset` | = ground | input, code block, well |

`inset` reusing `ground` is deliberate. A near-black page cannot go darker, so
a well is made by being its parent's lower rung rather than by a new colour.

**Rules.** A separate ladder on a cooler, far less saturated ray, because on the
surface ray a 3:1 stroke comes out a blue line rather than an edge.

| Role | Utility | Is | Use |
|------|---------|----|-----|
| edge | `border-ps-edge` | `#6c7887` | a control's boundary and the shell's seams. 3:1, WCAG 1.4.11 |
| hairline | `border-ps-edge-hairline` | `#474f59` | a card outline, a rule inside one surface. 1.63:1 |
| emphasis | `border-ps-edge-emphasis` | `#8797aa` | selected, armed, focused. 4.52:1 |

The hairline is deliberately below 3:1. A card whose fill already sits 1.47:1
off the page does not also need a 3:1 stroke, and drawing one round every tile
reads as wireframe. A CONTROL is different: its boundary is what identifies it,
and that is the one WCAG 1.4.11 is about. When in doubt, ask whether the thing
can be operated.

A hairline is measured against the PANEL. On `raised` it comes out at 1.11:1,
so a seam inside a dialog or a menu uses `edge`.

No component picks a rung off the `dark-*` ramp any more, and none draws a
boundary with a raw white alpha: `tests/unit/u4-surfaces-and-edges.test.ts`
holds both, `tests/e2e/design-invariants.spec.ts` measures the result on every
route, and the census ratchets what is left. `dark-700` and `dark-600` carry no
role and are not used.

### Measures

| Utility | Value | Is |
|---------|-------|----|
| `max-w-ps-page` | 82rem | every page. `AppPageShell` applies it; no page spells it |
| `max-w-ps-prose` | 46rem | longform, as a LEFT-aligned column inside the page container |
| `max-w-ps-reading` | 48rem | legacy |
| `max-w-ps-wide` | 56rem | legacy |
| `max-w-ps-full` | 80rem | legacy |
| `space-y-ps-block` | 1.5rem | the gap between blocks on a page shell |

The first two are the ones to use, and a page uses neither directly: it picks a
`density` and the shell applies the measure. That is the whole mechanism. When
twenty pages centred their own column in one of seven widths, twenty-three of
twenty-three screens put their h1 on a different left edge from their own
content, by up to 237px, across eight content widths and eight padding rhythms
(T-0117). The three legacy measures are what the last attempt declared; between
them they had one call site in the tree, on a 404 page.

Text hierarchy is the `--color-ps-text-*` tiers in `globals.css`, gated by
`scripts/tooling/contrast-check.mjs`; the derivation is in the comment beside
them. Never spell hierarchy as a raw white opacity.

`src/lib/theme.ts` mirrors the roles and the measures as `surfaceClasses` and
`measureClasses`, and `tests/unit/lockbook-tokens.test.ts` reads `globals.css`
and fails if either map names a token the CSS does not declare.

## Type: five steps and two registers

Declared in `@theme` as `--text-*` with their line heights, so a step carries
its own leading and nobody sets both.

| Utility | Size / leading | Is |
|---------|----------------|----|
| `text-micro` | 12 / 16 | a machine word: an ID, a path, a timestamp, a count, a status, a micro-caps section label |
| `text-body` | 14 / 21 | the default. Body copy, list rows, form values, button labels |
| `text-lead` | 16 / 24 | prose meant to be read: Help, descriptions, empty states |
| `text-title` | 20 / 28 | an h1, a dialog's title, a panel's title |
| `text-display` | 28 / 34 | the one number a screen exists to show |

**The register is the decision, not the size.** Mono keeps machine words,
because a fixed-width column of values is what makes a console readable. Inter
takes prose. The two questions are therefore the same question: if the thing is
a value, it is mono and it is `micro`; if it is a sentence, it is Inter and it
is at least `body`.

Prose at `micro` is the defect this replaced: 291 sites set descriptions and
empty states two steps below the body size, and 70% of every character rendered
came out at 12px.

**A section heading is `sectionHeadingClasses` in `src/lib/theme.ts`**, not a
size you choose. Thirty h2 elements wore ten treatments between them and a
section heading was indistinguishable from a slightly emphatic list item; the
one treatment is micro-caps mono on the secondary tier with a hairline under it,
so it reads as a heading by register and rule rather than by being bigger. It
owns the typography only: where the heading sits, and what sits beside it, stays
at the call site.

`type-scale-only` refuses Tailwind's default scale in `.tsx`, and
`no-raw-text-alpha` refuses a hierarchy spelled as a white opacity. Both are at
zero.

## Status: the word decides the colour

Seven rungs, `--color-status-{idle,queued,running,ok,warn,fail,blocked}`, and
you do not pick one. You pick a WORD.

`src/lib/status-labels.ts` holds thirteen ratified words and the maps from each
domain enum onto them, typed with `satisfies` so an enum member with no word is
a compile error. `STATUS_TONE` hangs a tone off the word by the same mechanism,
and `statusToneClasses` in `src/lib/theme.ts` turns a tone into four literal
classes: `text`, `dot`, `fill` and `border`.

```tsx
const label = SESSION_STATUS_LABELS[session.status];
<span className={statusToneClasses[statusTone(label)].text}>{label}</span>
```

The point of the indirection is that a thing cannot be CALLED one thing and
PAINTED another. Before it existed, thirty-four sites in twenty-six files each
decided for themselves: a Hermes process that was `running` painted green on the
dashboard while every other screen painted running cyan, and `failed` was
`text-neon-pink` on two screens while the declared danger token went unused.

**What is not a status.** A log's severity, a notification's tone, an artifact's
source kind, a research step's kind, a category's chosen colour and an
achievement's tier are all keyed by something that is not a state word, and
folding them onto this ladder would be a category error. A duration that came in
on time is not a success either: it is an absence of news, and it stays neutral.
`tests/unit/u6-the-status-ladder.test.ts` holds both halves , it refuses a state
word painted an accent, and it requires each exemption to say why in its own
file.

## Radius: three rungs and a pill

| Utility | Value | Is |
|---------|-------|----|
| `rounded-ps-sm` | 4px | a chip, a tag, a dot's box |
| `rounded-ps-md` | 8px | a control: button, input, select, menu row |
| `rounded-ps-lg` | 12px | a surface: card, panel, dialog, sheet |
| `rounded-full` | pill | a status dot, an avatar, a pill |

Side-specific spellings keep their side: `rounded-t-ps-lg` on a bottom sheet,
`rounded-l-ps-lg` on a row's rail. Eleven spellings produced seven rendered
radii before this, with forty files painting an 8px card edge on the same screen
as a 12px one.

## Layers: seven rungs, and nothing between them

| Utility | Value | Is |
|---------|-------|----|
| `z-base` | 0 | the page |
| `z-sticky` | 10 | a sticky header or bar |
| `z-dropdown` | 30 | a menu, a popover, a combobox list |
| `z-overlay` | 50 | a backdrop |
| `z-modal` | 60 | a dialog or sheet panel, the open drawer |
| `z-toast` | 70 | notifications |
| `z-tooltip` | 80 | a tooltip, above everything |

Declared as `--z-*` on `:root` and exposed as one `@utility` each, so a layer is
a word. Thirteen z-layers existed before, seven of them arbitrary: `z-[61]`
existed because someone needed to sit on `z-[60]`. `z-scale-only` refuses an
arbitrary `z-[...]` in `.tsx`; the twenty it still tolerates are in its
baseline, which only ratchets down.

## Elevation: two, and the glow

| Token | Is | Use |
|-------|----|-----|
| `shadow-ps-raised` | `0 8px 24px -4px rgb(0 0 0 / 0.55), 0 2px 6px -2px rgb(0 0 0 / 0.4)` | a dialog, a popover, a menu: the one shadow that means "above the page" |
| `glow-surface` | two soft coloured shadows driven by `--glow-surface-rgb` | the live signature only: a running process, a live session, a pulsing dot |

A card is not raised; its rung on the surface ladder is what separates it. The
recon measured 26 rendered box-shadows; the census counts what is left and
holds it. `GlowSurface` owns the glow and sets the triplet inline (see Glow / TS
parity below); nothing else paints a coloured shadow.

## Duration: one pair, and the house transition

| Property | Value | Is |
|----------|-------|----|
| `--ps-duration-fast` | 120ms | the transition you do not notice: a hover, a focus, a colour |
| `--ps-duration` | 200ms | the one you do: a drawer, a rail width, a panel opening |

The house `transition-colors` is Tailwind's without `outline-color`, redefined
in the utilities layer after Tailwind's own, so the focus ring is instant where
everything else fades (T-0128). Do not write a duration in a class; pick the
pair.

## A class name in prose used to be CSS

Tailwind v4 scans SOURCE, and its automatic detection reads the whole project.
This repository documents its own class names, so `org/`, `docs/` and every task
record were generating utilities: measured at T-0120, 94 candidate-shaped
strings and 46 colour classes shipped only because a file outside `src/`
mentioned them.

`globals.css` therefore says `@import "tailwindcss" source(none)` and
`@source "../../src"`. Widen that only for a directory that actually renders
markup, and note that the generated help fragments do not, because they carry
no `class` attribute at all.

The corollary matters more. **A class Tailwind cannot see as a literal string
does not exist.** Never build one:

```tsx
// no: none of these reach the stylesheet
className={`border-${tone}`}
className={`${iconColorMap[c]}/60`}
const b = textColor.replace(/^text-/, "border-") + "/20";

// yes: a whole class, chosen from a map written out one entry per line
className={pillBorderMap[color]}
```

`no-template-literal-tailwind` refuses all three of the first shapes. It missed
two of them until T-0120, and both were live: the dashboard's stat pills had
three accents with no border rule and eight dead hovers, and the models section
header's muted icon tint existed only because a unit test spelled the class out.

### Layer B3, viz chrome

The furniture a chart is drawn **on**, as opposed to the data drawn **in** it.
Series colour already goes through the named scale in
`src/components/viz/colors.ts`; the chrome was nineteen raw colours across eleven
files until T-0034 named it. Use these instead of a raw `rgba(...)` in a chart
component.

| Token | Value | Is |
|-------|-------|----|
| `--color-ps-viz-empty` | white / 4% | the disc behind a locked badge or a cold streak |
| `--color-ps-viz-guide` | white / 5% | a ring or cell marking where data would be |
| `--color-ps-viz-track` | white / 6% | the unfilled remainder of a gauge or badge ring |
| `--color-ps-viz-axis` | white / 8% | the baseline a chart is measured against |
| `--color-ps-viz-inert` | white / 15% | a graph edge that is not on the live path |
| `--color-ps-viz-glyph-idle` | white / 22% | a locked achievement's icon |
| `--color-ps-viz-scrim` | black / 60% | the veil a minimap draws over the canvas |

These are written as the custom property, `stroke="var(--color-ps-viz-axis)"`,
not as a Tailwind class: the charts are hand-rolled SVG and set `fill` / `stroke`
attributes. Tailwind does also generate `bg-ps-viz-*` and friends from them.

There is deliberately no rung here for chart **text**. An axis label is text and
reads through `--color-ps-text-*`, which is the only set `contrast-check.mjs`
measures.

## Layer C: Accent slots (`AccentColor`)

TypeScript `AccentColor` in `src/types/console.ts` has **eight** members:
`cyan | purple | pink | green | orange | red | blue | yellow`. Every accent map
in `src/lib/theme.ts` is a `Record<AccentColor, …>` and supplies all eight, so a
map written against a shorter list does not typecheck. This file listed only the
first five for a long time; the other three are not new.

The first five are the brand slots and resolve to `--color-neon-*` in
`globals.css`, so their utilities are `text-neon-cyan`, `bg-neon-purple/20` and
so on:

| Slot | Hex | RGB | Role |
|------|-----|-----|------|
| `cyan` | `#00bfff` | 0, 191, 255 | Primary brand / Cherenkov interactive |
| `purple` | `#a480ff` | 164, 128, 255 | Blue-violet / orchestration (brightened 2026-08-23: #8b5cff failed WCAG AA as text even at full opacity) |
| `green` | `#a3ff12` | 163, 255, 18 | Success / online / electric lime |
| `pink` | `#e879f9` | 232, 121, 249 | Cool magenta-fuchsia |
| `orange` | `#ff6622` | 255, 102, 34 | Heat / Cherenkov complement (Sparrow's Fire) accent |

The last three are status slots. `neon-red` is declared as the danger colour
under its accent-slot name (the same value as `--color-semantic-danger`, by
intent), so `text-neon-red` and `text-semantic-danger` paint the same pixel;
there is no `neon-blue` and no `semantic-error`. The maps in `src/lib/theme.ts`
spell the status slots with Tailwind's own palette, written out literally.
Reaching for a house token that is not declared is a red build: design-lint's
`token-must-exist` rule checks every `text-`, `bg-`, `border-` and friends class
with a `neon-`, `semantic-` or `ps-` token against the `@theme` block, because
Tailwind generates nothing for an unknown class and says nothing, and thirteen
sites once rendered with no colour at all that way.

| Slot | Icon / border / badge classes | Glow RGB | Role |
|------|-------------------------------|----------|------|
| `red` | `text-red-400` · `border-red-400/40` · `bg-red-500/10` | 239, 68, 68 | Errors / destructive |
| `blue` | `text-blue-400` · `border-blue-400/40` · `bg-blue-500/10` | 96, 165, 250 | Neutral informational |
| `yellow` | `text-yellow-400` · `border-yellow-400/40` · `bg-yellow-500/10` | 250, 204, 21 | Crown / leader highlights |

`--color-neon-yellow` (`#facc15`, the same value as Tailwind's `yellow-400`) is
declared in `@theme` and used directly as `text-neon-yellow` /
`bg-neon-yellow/10` in components. It is not what the `yellow` **accent** maps
emit, which is why both spellings appear in the tree.

## Layer D: Semantic status (Tailwind utilities)

| Token | Hex | Use |
|-------|-----|-----|
| `semantic-success` | `#a3ff12` | Aligns with success accent |
| `semantic-warning` | `#fbbf24` | Paused / degraded |
| `semantic-danger` | `#f87171` | Errors / destructive |
| `semantic-info` | `#00a1e6` | Informational chips |

## Glow / TS parity

`src/lib/theme.ts` exports `glowSurfaceRgbMap`, built by `makeMap` over the
`GLOW_RGBS` literal, with **space-separated RGB triplets** (`0 191 255`) for each
of the eight `AccentColor` slots. The separator is load-bearing, not a style
choice: `GlowSurface` sets the triplet inline as `--glow-surface-rgb`, and
`globals.css` reads it back as `rgb(var(--glow-surface-rgb) / <alpha>)`. That is
the CSS Color 4 slash-alpha form, which rejects the legacy comma syntax, so a
comma triplet yields a glow that silently does not render. This file said
"comma-separated" until 2026-08-30. The `--ps-rgb-*` mirrors in `globals.css` are
spelled the same way for the same reason. If you change an `@theme` neon hex,
update `GLOW_RGBS` and the matching `--ps-rgb-*` in the same PR.

**Restraint (deep-space Cherenkov):** glow is the live signature and nothing else. `pulse-glow` and `glow-surface` are reserved for **live/active** states (a running process, a live session, a status dot that is on), never for a static card; the five hard-coded `.glow-<colour>` classes that once painted cards went in T-0120 and their nine call sites moved onto `GlowSurface`. New surfaces follow the same discipline: cyan (Cherenkov) is *the* primary; the other accents (purple/green/pink/orange) are semantic, not decorative. Keep few competing accents per screen.

## Form inputs

A form control is the Field Kit, `src/components/ui/field`: `Field` (the only
label, associated to its control by construction), `Input`, `Textarea`,
`Select` (the accessible listbox) and `Toggle`, at one control height, with
captions above. None of them paints a focus ring of its own; the global ring
below is the ring. `inputFieldClasses(accent)` in `src/lib/theme.ts` still
exists for the seven sites that predate the kit; do not add an eighth.

## The primitive set, and what ui/ means

`src/components/ui/` holds a component when three or more independent places
call it. A component with one or two callers lives beside its callers under
`src/components/<domain>/`; the S4 split of 2026-09 (T-0122) moved everything
that failed the rule out, and a new primitive earns its place by the third
caller, not by being generic.

| Primitive | Is |
|-----------|----|
| `Button`, `IconButton`, `LinkButton` | one chrome (`button-chrome.ts`), three heights (26 / 32 / 40), four variants; an icon-only control is never under 24x24; a link that looks like a button is `LinkButton` and stays a link |
| `Badge` | the one chip: seven colours, solid or outline, `title` for the long form |
| `Card` | the one surface: `panel` or `raised`, one radius, one edge, a header slot |
| `Dialog` | the one overlay: centre, right, bottom or sheet, on `useDialogA11y` (role, modal, Escape, the Tab trap over what is drawn, focus returned) |
| `Popover` | anything dismissable that is not modal, on `useDismissable` |
| `SplitPane` | the one two-column shape: a list that chooses and the thing chosen. Two columns from lg; below lg the list is behind a button that opens it as a sheet and closes when the choice changes (Chat, Logs, Composer, Research) |
| `CollapsibleSection` | the disclosure: a heading, a count, a body that opens on demand; uncontrolled, or controlled by the caller that needs to open it from elsewhere (Missions' templates, Models' fallback chain) |
| `SegmentedControl` | a radiogroup with roving tabindex and real ARIA state; every filter row |
| `DataList` | a table that stacks below its breakpoint instead of clipping a column |
| `ConfirmButton` | the one destructive treatment: arm, then act, `aria-live` on the armed label |
| `LoadErrorBanner`, `EmptyState`, `PageLoading`, `Skeleton` | the loading contract: the header always renders, a failed read is an error with Retry, an empty state renders only after a successful read, a count is a pending mark until known |
| `Picker`, `ProfilePicker` | the one selector, keyboard-reachable |
| `Toast` | the shell's, three at most, a success never evicts an error |
| Field Kit (`ui/field`) | above |

Seven files in `ui/` are below the rule today and are named here rather than
hidden: `Popover` and `TemplateCard` are building blocks other primitives
compose (`Select` and `Picker` sit on `Popover`; `TemplatePill` on
`TemplateCard`); `ErrorBoundary` is the layout's and has one caller by nature;
`DataList` is the newest primitive (T-0125) with two callers and forty-one
grid-faked tables still to move onto it; `AutoTextarea`, `TemplatePill` and
`Pagination` have one or two callers and are the next programme's to place. The measure the recon set, components with exactly one
importer, read 146 of 213 at the start and 128 of 201 at the end: the split
happened at the primitive layer and has not yet reached the page layer.

## Focus

One visible focus ring for the whole console, declared once in `globals.css`:
`:focus-visible { outline: 2px solid var(--color-neon-cyan); outline-offset: 2px }`.
It paints on keyboard focus only, and nothing in the tree removes it: there is
no `outline-none` in `src/`, and `design-lint`'s `no-bare-outline-none` rule
fails the build on one that does not put a ring back on the same line (an
outline, a `ring-*`, or a shadow standing in for one). A border colour is not a
ring. The house `transition-colors` leaves `outline-color` alone, so the ring
is instant where everything else fades. The root layout carries a skip link to
`#main`.

## Motion

Under `prefers-reduced-motion: reduce` every animation and transition halts,
by one universal rule in `globals.css`, and two things are put back: the
spinners (`animate-spin`, `animate-spin-slow`), because "still working" is
information rather than decoration. A new keyframe is therefore halted by
default, and `tests/e2e/motion.spec.ts` fails on anything else found running.

## Overlays and confirms

- Anything that paints a `fixed inset-0` overlay calls `useDialogA11y`
  (role, `aria-modal`, Escape, the Tab trap, focus returned to the trigger,
  scroll lock). `Modal` and `Sheet` already do; a bespoke overlay must too, or
  `overlay-uses-dialog-a11y` fails the build.
- A destructive click is two clicks on `ConfirmButton`
  (`src/components/ui/ConfirmButton.tsx`): arm, then act, disarming on its
  own, never disabled by being armed. `no-native-confirm` refuses
  `window.confirm`.
- Feedback is the shell's: `FeedbackProvider` in the root layout owns the
  toast stack (three at most; a success never evicts an error) and the
  achievement toast. `useToast()` keeps its API on every page.
- A list read that failed shows `LoadErrorBanner` with a Retry, never the
  page's empty state; `EmptyState` renders only after a successful read.

## Shell chrome

Declared on `:root` in `globals.css`, below the `@theme` block:

- `--ps-shell-header-min-height`: `5rem`, the sidebar brand row + `PageHeader` / dashboard bar.
- `--ps-mobile-header-min-height`: `3rem`, the compact mobile chrome for touch targets.

There are **no `--ch-*` custom properties**. This file named them for months, and
`min-h-[var(--ch-shell-header-min-height)]` resolves to nothing, which silently
collapses the header. `design-lint`'s `no-ch-custom-properties` rule now fails
the build on a `--ch-*` under `src/`.

## Forbidden patterns

- Do not add a raw `#rrggbb` or `rgba(...)` in TSX. Use `neon-*`, `cherenkov-*`,
  `semantic-*`, `dark-*`, `ps-surface-*`, `ps-text-*` or `ps-viz-*`.
  `design-lint`'s `no-raw-colour-in-tsx` rule fails the build on a new one.
- Do not assemble a Tailwind class from a template literal
  (`` `border-${token}` ``). Tailwind scans statically, so the class is never
  generated and the style silently does not exist. That is why the accent maps
  in `src/lib/theme.ts` are written out one literal per entry, and
  `no-template-literal-tailwind` keeps them that way.
- The escape hatch is a single line:
  `// design-lint-disable-next-line <rule> -- <reason>`. The reason is required.

## Adding a colour

1. Add the primitive to `@theme` in `globals.css`.
2. If it needs a glow, add its **space-separated** triplet to `GLOW_RGBS` in
   `src/lib/theme.ts` and mirror it as a `--ps-rgb-*` on `:root`.
3. Extend `AccentColor` in `src/types/console.ts` only if it must appear on
   `Button` / `Badge`. Adding a member means filling it in on every
   `Record<AccentColor, …>` map in `src/lib/theme.ts`, which is the point:
   the compiler will list them for you.
4. Document the hex + role in this file.
