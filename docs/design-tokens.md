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

## Layer C: Accent slots (`AccentColor` → `--color-neon-*`)

TypeScript `AccentColor` in `src/types/console.ts` is unchanged: `cyan | purple | green | pink | orange`. Utilities stay `text-neon-cyan`, `bg-neon-purple/20`, etc.; only **hex values** change.

| Slot | Hex | RGB | Role |
|------|-----|-----|------|
| `cyan` | `#00bfff` | 0, 191, 255 | Primary brand / Cherenkov interactive |
| `purple` | `#a480ff` | 164, 128, 255 | Blue-violet / orchestration (brightened 2026-08-23: #8b5cff failed WCAG AA as text even at full opacity) |
| `green` | `#a3ff12` | 163, 255, 18 | Success / online / electric lime |
| `pink` | `#e879f9` | 232, 121, 249 | Cool magenta–fuchsia |
| `orange` | `#ff6622` | 255, 102, 34 | Heat / Cherenkov complement (Sparrow's Fire) accent |
| `neon-yellow` (non-AccentColor) | `#facc15` | 250, 204, 21 | Crown / leader highlights |

## Layer D: Semantic status (Tailwind utilities)

| Token | Hex | Use |
|-------|-----|-----|
| `semantic-success` | `#a3ff12` | Aligns with success accent |
| `semantic-warning` | `#fbbf24` | Paused / degraded |
| `semantic-danger` | `#f87171` | Errors / destructive |
| `semantic-info` | `#00a1e6` | Informational chips |

## Glow / TS parity

`src/lib/theme.ts` exports `glowSurfaceRgbMap` with **comma-separated RGB triplets** matching the table above for each `AccentColor`. If you change `@theme` neon hexes, update `glowSurfaceRgbMap` in the same PR.

**Restraint (deep-space Cherenkov):** the `.glow-*` box-shadows in `globals.css` are intentionally soft (`14px @ 0.08` + `28px @ 0.025`) so glow reads as a subtle luminescence, not a flat light source. The brand's "reactor core" signature lives in the stronger `pulse-glow` + `glow-surface` reserved for **live/active** states (running process, live session), not static cards. New surfaces follow the same discipline: cyan (Cherenkov) is *the* primary; the other accents (purple/green/pink/orange) are semantic, not decorative. Keep few competing accents per screen.

## Form inputs

Prefer `inputFieldClasses(accent)` from `src/lib/theme.ts` (wraps `baseInputStyles` + `focusColorMap`) for text inputs and selects instead of duplicating `bg-dark-*` / `focus:border-*` strings in TSX.

## Shell chrome

- `--ch-shell-header-min-height`: `5rem`, the sidebar brand row + `PageHeader` / dashboard bar.
- `--ch-mobile-header-min-height`: `3rem`, the compact mobile chrome for touch targets.

## Forbidden patterns

- Do not add raw `#rrggbb` or `rgba(...)` for brand accents in TSX; use `neon-*`, `cherenkov-*`, `semantic-*`, or `dark-*` utilities.
- Exceptions: rare third-party embeds or one-off charts. Comment why.

## Adding a colour

1. Add primitive to `@theme` in `globals.css`.
2. If used in `GlowSurface`, extend `glowSurfaceRgbMap` and `AccentColor` only if it must appear on `Button`/`Badge`.
3. Document the hex + role in this file.
