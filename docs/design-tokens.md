# Control Hub — design tokens

Single reference for the Cherenkov-forward palette, semantic colours, and how TypeScript maps to CSS.

## Layer A — Cherenkov primitives

Source ladder ([Cherenkov radiation palette](https://www.color-hex.com/color-palette/1022135)):

| Token / role | Hex | RGB |
|--------------|-----|-----|
| Brightest glow | `#33ddff` | 51, 221, 255 |
| Interactive / links | `#00bfff` | 0, 191, 255 |
| Mid blue | `#00a1e6` | 0, 161, 230 |
| Deep blue | `#008bd1` | 0, 139, 209 |
| Anchor blue | `#0071c2` | 0, 113, 194 |

Registered in `src/app/globals.css` as `--color-cherenkov-100` … `--color-cherenkov-500` (100 = brightest).

## Layer B — Surfaces (blue-tinted neutrals)

Dark scales are slightly mixed toward `#0071c2` so panels read “cool reactor core” rather than flat gray.

| Token | Hex (approx) |
|-------|----------------|
| `dark-950` | `#040b12` |
| `dark-900` | `#0c1520` |
| `dark-800` | `#121f2d` |
| `dark-700` | `#1c2d40` |
| `dark-600` | `#263d54` |

## Layer C — Accent slots (`AccentColor` → `--color-neon-*`)

TypeScript `AccentColor` in `src/types/hermes.ts` is unchanged: `cyan | purple | green | pink | orange`. Utilities stay `text-neon-cyan`, `bg-neon-purple/20`, etc.; only **hex values** change.

| Slot | Hex | RGB | Role |
|------|-----|-----|------|
| `cyan` | `#00bfff` | 0, 191, 255 | Primary brand / Cherenkov interactive |
| `purple` | `#8b5cff` | 139, 92, 255 | Blue-violet / orchestration |
| `green` | `#a3ff12` | 163, 255, 18 | Success / online / electric lime |
| `pink` | `#e879f9` | 232, 121, 249 | Cool magenta–fuchsia |
| `orange` | `#ff9f1c` | 255, 159, 28 | Warning / heat / amber accent |
| `neon-yellow` (non-AccentColor) | `#facc15` | 250, 204, 21 | Crown / leader highlights |

## Layer D — Semantic status (Tailwind utilities)

| Token | Hex | Use |
|-------|-----|-----|
| `semantic-success` | `#a3ff12` | Aligns with success accent |
| `semantic-warning` | `#fbbf24` | Paused / degraded |
| `semantic-danger` | `#f87171` | Errors / destructive |
| `semantic-info` | `#00a1e6` | Informational chips |

## Glow / TS parity

`src/lib/theme.ts` exports `glowSurfaceRgbMap` with **comma-separated RGB triplets** matching the table above for each `AccentColor`. If you change `@theme` neon hexes, update `glowSurfaceRgbMap` in the same PR.

## Shell chrome

- `--ch-shell-header-min-height`: `5rem` — sidebar brand row + `PageHeader` / dashboard bar.
- `--ch-mobile-header-min-height`: `3rem` — mobile compact chrome for touch targets.

## Forbidden patterns

- Do not add raw `#rrggbb` or `rgba(...)` for brand accents in TSX; use `neon-*`, `cherenkov-*`, `semantic-*`, or `dark-*` utilities.
- Exceptions: rare third-party embeds or one-off charts — comment why.

## Adding a colour

1. Add primitive to `@theme` in `globals.css`.
2. If used in `GlowSurface`, extend `glowSurfaceRgbMap` and `AccentColor` only if it must appear on `Button`/`Badge`.
3. Document the hex + role in this file.
