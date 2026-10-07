---
summary: What a fork must change before it distributes this software under its own name
type: legal
tags: [branding, licensing]
compiled_from: normalised
---

# Rebranding guide for forks

If you modify this software and distribute your version, you must rebrand it. The code is open; the Patter name and visual identity are not.

## Checklist

1. **Rename your project**: Do not use Patter, PatterStage, PatterTech, PatterOS, or any Patter* name in your repo, packages, services, or marketing.

2. **Remove `branding/`**: Delete the entire [`branding/`](branding/) directory from what you ship. Those files are not licensed for redistribution.

3. **Replace name references**: Search your distribution for leftover Patter branding, including installer banners and script output if you keep the provided scripts:

   ```bash
   grep -ri patter .
   ```

   Note: this project keeps a small set of internal operational identifiers (e.g. the `ps-*` script names, the `PS_*` env vars, the `~/patterstage` data dir) — rename these too if you want a clean fork.

4. **Use your own colours and logos**: Do not replicate the Cherenkov palette from [`branding/guidelines/COLORS.md`](branding/guidelines/COLORS.md) as your product theme.

5. **Read the trademark policy** — [TRADEMARK.md](TRADEMARK.md) has the full rules.

You may still say your project is *compatible with* or *based on* PatterStage if that is accurate, as long as you make clear it is not official or endorsed.


## Note

I reserve the right to be strict if someone acts in bad faith, but in general just don't take the piss and you can do whatever you want. If you wouldn't like someone doing it to your project, please don't do it to mine.
