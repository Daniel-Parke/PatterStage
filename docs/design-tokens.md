---
summary: The Cherenkov palette, the semantic colour layer, and how TypeScript maps to CSS tokens
type: reference
tags: [product, design]
compiled_from: normalised
---

# PatterStage: design tokens

Reference for the Cherenkov-forward palette, semantic colours, and how TypeScript maps to CSS. Use this when adding UI so new screens match the rest of the app.

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

Dark scales are slightly mixed toward `#0071c2` so panels read “cool reactor core” rather than flat gray.

| Token | Hex (approx) |
|-------|----------------|
| `dark-950` | `#040b12` |
| `dark-900` | `#0c1520` |
| `dark-800` | `#121f2d` |
| `dark-700` | `#1c2d40` |
| `dark-600` | `#263d54` |

### Layer B2, surface roles (the semantic layer)

Layer B names surfaces for how they look, which is why it cannot say whether
`dark-900` is a panel or a well. These four say it. Ruled at the first-build
lock-in sitting of 2026-08-24 (`docs/LOCKBOOK.md`, Tokens), derived from what the
tree already paints, and minting no new colour.

| Role | Utility | Is | Use |
|------|---------|----|-----|
| ground | `bg-ps-surface-ground` | `var(--color-dark-950)` | the page itself |
| panel | `bg-ps-surface-panel` | `var(--color-dark-900)` | a raised card, panel or bar |
| well | `bg-ps-surface-well` | `var(--color-dark-800)` | a sunken field, code block or row |
| hairline | `border-ps-surface-hairline` | `rgb(255 255 255 / 0.10)` | the rule between two surfaces |

The hairline is the one role with no `dark-*` rung behind it: the tree draws its
rules as `border-white/10`, which matches no rung, so the composite is recorded
rather than a rung invented. `dark-700` and `dark-600` carry no role.

New surfaces use the role names. The appearance-named spellings still paint the
same pixels and are still everywhere, so both are live until the migration lands.

### Measures

| Utility | Value | Is |
|---------|-------|----|
| `max-w-ps-reading` | 48rem | the longform column (reader, research report, artifact viewer) |
| `max-w-ps-wide` | 56rem | the ordinary page shell |
| `max-w-ps-full` | 80rem | the dense boards |
| `space-y-ps-block` | 1.5rem | the gap between blocks on a page shell |

Text hierarchy is the `--color-ps-text-*` tiers in `globals.css`, gated by
`scripts/tooling/contrast-check.mjs`; the derivation is in the comment beside
them. Never spell hierarchy as a raw white opacity.

`src/lib/theme.ts` mirrors the roles and the measures as `surfaceClasses` and
`measureClasses`, and `tests/unit/lockbook-tokens.test.ts` reads `globals.css`
and fails if either map names a token the CSS does not declare.

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

The last three are status slots with no `neon-*` token behind them. The maps in
`src/lib/theme.ts` spell them with Tailwind's own palette, written out
literally, so do not reach for a `neon-red` or `neon-blue`: neither exists.

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

**Restraint (deep-space Cherenkov):** the `.glow-*` box-shadows in `globals.css` are intentionally soft (`14px @ 0.08` + `28px @ 0.025`) so glow reads as a subtle luminescence, not a flat light source. The brand's "reactor core" signature lives in the stronger `pulse-glow` + `glow-surface` reserved for **live/active** states (running process, live session), not static cards. New surfaces follow the same discipline: cyan (Cherenkov) is *the* primary; the other accents (purple/green/pink/orange) are semantic, not decorative. Keep few competing accents per screen.

## Form inputs

Prefer `inputFieldClasses(accent)` from `src/lib/theme.ts` (wraps `baseInputStyles` + `focusColorMap`) for text inputs and selects instead of duplicating `bg-dark-*` / `focus:border-*` strings in TSX.

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
