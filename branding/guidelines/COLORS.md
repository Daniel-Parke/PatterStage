---
summary: The official Cherenkov colour palette for PatterStage and PatterTech, and where it is implemented
type: brand
tags: [branding, design]
compiled_from: normalised
---

# PatterStage colour palette

Official visual identity for PatterStage and PatterTech. Inspired by Cherenkov radiation: the blue glow produced by charged particles moving through water.

Reference: [Cherenkov radiation palette #1022135](https://www.color-hex.com/color-palette/1022135): *"The colors of Cherenkov radiation illuminating deep water."*

**These colours are reserved.** Third-party forks and products must not use this scale as their product identity. See [../../TRADEMARK.md](../../TRADEMARK.md).

> Canonical implementation: [`docs/design-tokens.md`](../../docs/design-tokens.md), [`src/lib/theme.ts`](../../src/lib/theme.ts), and the `@theme` tokens in [`src/app/globals.css`](../../src/app/globals.css). This file is the brand-protection summary; the design-tokens doc is the source of truth for engineering.

## Official Cherenkov scale

Brightest to deepest:

| Name | Hex | RGB |
|------|-----|-----|
| Cherenkov glow | `#33ddff` | (51, 221, 255) |
| Deep sky | `#00bfff` | (0, 191, 255) |
| Azure | `#00a1e6` | (0, 161, 230) |
| Cerulean | `#008bd1` | (0, 139, 209) |
| Deep water (anchor) | `#0071c2` | (0, 113, 194) |

## PatterStage neon accents

The Cherenkov blue above is *the* primary identity. PatterStage layers a small, **semantic** neon accent set on top (cyan = primary, not decorative):

| Slot | Hex | Role |
|------|-----|------|
| cyan | `#00bfff` | Primary brand / Cherenkov interactive |
| purple | `#8b5cff` | Orchestration |
| green | `#a3ff12` | Success / online |
| pink | `#e879f9` | Cool magenta–fuchsia |
| orange | `#ff6622` | Heat / Cherenkov complement |

## Usage

- **Primary accents:** `#00bfff` or `#33ddff` for highlights, links, and active UI elements
- **Depth and backgrounds:** darker stops (`#008bd1`, `#0071c2`) for panels, headers, and depth; surfaces are blue-tinted neutrals (`dark-950` … `dark-600`), not flat gray
- **Neon glow:** combine light stops with a soft outer glow, reserved for live/active states, for example:

  ```css
  box-shadow: 0 0 20px rgba(51, 221, 255, 0.5);
  ```

Keep few competing accents per screen — the Cherenkov blue scale is the defining Patter look.
