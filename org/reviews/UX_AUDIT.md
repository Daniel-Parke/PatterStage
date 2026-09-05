---
summary: The prioritised UX and branding audit, with the PatterTech alignment assessment and the asset checklist
type: notes
tags: [product, design]
compiled_from: normalised
---

# PatterStage: UX & Branding Audit

A prioritized catalogue of interactivity / clarity / "fun & useful" improvements across the app, plus the **PatterTech-hybrid** branding-alignment assessment and the **brand-asset checklist** needed to finish the visual alignment.

Tags: **Impact** (H/M/L) · **Effort** (S/M/L). "Quick win" = H or M impact at S effort, the set implemented in Phase P6.

> **Status: point-in-time audit, cut 2026-06-19 (commit `bef00ba7`).** The catalogue below was written against the app as it stood that day and has not been re-walked since. Two rows were re-checked against source on 2026-08-30 and corrected in place, B5 and CF1, and both were wrong about the code rather than merely out of date. Everything else is as first written, so read an item as a lead to verify, not as a description of today's build. The app has already grown past the catalogue: the Laboratory section (Insights, Deep Research, Artifacts) landed on 2026-06-21 and 2026-06-22 and has no per-page notes here at all. Re-walk the app before scheduling from this list.

---

## 1. Branding alignment: PatterTech = deep-space Cherenkov

> **Correction (supersedes the earlier P6 note).** A previous pass mistook **WiseWattage**, a *venture* of PatterTech (the homepage serves it from `/ventures/wisewattage.png`), for the parent brand, and recommended shifting the accent cyan → WiseWattage green. That was wrong, and it was never shipped into the UI (P6 only softened glow). **PatterTech's own brand is the [Cherenkov Radiation palette](https://www.color-hex.com/color-palette/1022135) + a deep-space aesthetic** (confirmed by the owner). WiseWattage's green/lightbulb identity belongs to that product, not to PatterStage.

**Where we are = where we should be.** PatterStage's neon-dark "Cherenkov" theme *is already on-brand*: deep blue-tinted surfaces (`dark-950 #040b12`), a cyan primary, and restrained `glow-*`. The job is **precision and polish**, not a recolour.

**The palette (locked):** Cherenkov ramp `#33ddff · #00bfff · #00a1e6 · #008bd1 · #0071c2` (registered as `--color-cherenkov-100…500`), primary cyan `#00bfff`, complement Sparrow's-Fire `#ff6622` (the `orange` accent slot). Voice is accessible/principled/understated: *"Technology that is accessible to all" · "Let's build something worth owning."*

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| B1 | **Keep cyan as *the* primary; use the Cherenkov ramp for depth.** Reserve purple/green/pink/orange for **semantic** roles only (orchestration / success / heat / danger). Stop using 5 accents decoratively on one screen. Lean on the cyan→deep-blue ramp for gradients/hierarchy instead. | H | M |
| B2 | **Glow = luminescence, not floodlight.** `.glow-*` stays soft on static cards; the "reactor core" pulse is reserved for *live/active* states (running process, live session). ✅ done in P6, recalibrated in Q1. | H | S |
| B3 | **Increase whitespace + vertical rhythm.** Standardise section spacing (`space-y-6`), card padding, and the 10px micro-label scale; let panels breathe. | M | M |
| B4 | **Tighten typography.** Inter is already the sans. Define a clear H1/H2/section-label/body ladder; reduce the all-caps + mono-everywhere density (mono for data/IDs only). | M | M |
| B5 | **Brand chrome.** *Rewritten 2026-08-30: this row used to say "keep the PT / Hermes mark in the sidebar brand row", and the rename had already removed it.* The sidebar brand row is settled: a terminal glyph, the **PatterStage** wordmark, and the "The Stage is Yours" tagline (`src/components/layout/Sidebar.tsx`). The **"PT / Hermes"** mark now survives in exactly one place, the mobile header (`src/components/layout/MobileHeader.tsx`), so the open item is that inconsistency rather than preserving the mark. The logo slot (sidebar + dashboard + mobile header) is still ready to drop a supplied PatterTech logo. | M | S |

**Brand-asset checklist (palette is now settled; only chrome is outstanding):**
- [x] Primary + neutral palette: the Cherenkov ramp above (no longer a stand-in).
- [ ] Official PatterTech logo (SVG + PNG), for the sidebar/dashboard logo slot.
- [ ] Confirm heading + body fonts (Inter assumed for both today).
- [ ] Tone-of-voice notes for microcopy (empty states, errors, CTAs).

---

## 2. Cross-cutting UX (applies everywhere)

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| X1 | **Consistent loading / empty / error states.** A shared `LoadingSpinner` + `EmptyState` + `LoadErrorBanner` exist. Apply them uniformly (some pages still bespoke). Every list gets a friendly empty state with a primary CTA. | H | M |
| X2 | **Micro-interactions.** Standard hover/active transitions on cards, rows, buttons (`transition-colors`/`duration-200`); subtle press feedback; respect `prefers-reduced-motion`. | M | S |
| X3 | **Keyboard affordances.** `Enter` to submit composer/search, `Esc` to close sheets/modals, focus rings on all interactive elements, focus-trap in modals. | M | M |
| X4 | **Operational toasts (deferred from N5).** Toast on real events (mission succeeded/failed, schedule fired, script finished) via prev/next diffing in the polling layer with cross-tick dedup. (Was deferred for spam-risk; do it carefully now.) | M | M |
| X5 | **Optimistic mutations.** Cancel/delete/toggle already refetch; add optimistic UI + rollback for snappier feel (mission cancel already does this, so extend it to schedules/skills toggles). | M | M |
| X6 | **Command palette (⌘K).** Jump to any page / mission / session / config section; high "fun & useful" payoff for power users. | H | L |
| X7 | **Mobile/touch polish.** Bigger tap targets, the mobile header chrome, swipe-to-close sheets; verify every page at 380px. | M | M |

---

## 3. Per-page notes

### Dashboard (`/`)
- D1. The Command Center + stat pills + per-agent strip are strong. **Make the stat pills clickable** (Processes → agents, Sessions → /sessions, Memory → /memory). *H/S*
- D2. Errors panel: add a one-click "copy" + "open log" per row, and a sparkline of error rate. *M/M*
- D3. Dispatch strip: remember the last-expanded state; add a tiny "recently dispatched" row. *M/S*
- D4. Live polish: the monitor now refreshes live (fixed in N). Add a subtle "updated Xs ago" timestamp so users trust it's live. *M/S*

### Missions (`/orchestration/missions`)
- M1. The board is dense. Add **drag-to-reorder within a column** and a compact/comfortable density toggle. *M/M*
- M2. Composer: a **live preview** of the assembled mission prompt; inline validation as you type; a "dry-run" that shows what would dispatch. *H/M*
- M3. Schedule picker: a human-readable "next 3 runs" preview under the cron/interval input. *H/S* (reuses `computeNextRun`)
- M4. Active-mission rows: live elapsed time + a mini progress indicator from `useRunProgress`. *M/M*

### Sessions (`/sessions` + `/sessions/[id]`)
- S1. Transcript: collapse long tool-output blocks by default with expand; syntax-highlight code/JSON. *H/M*
- S2. "Jump to next role" exists, so surface it as visible nav chips, not just double-click. *M/S*
- S3. Session list: a tiny activity sparkline per mission group; "resume / re-run" affordance. *M/M*

### Chat (`/orchestration/chat`)
- C1. The new gateway banners are good. Add a **streaming typing indicator** + stop button while a response streams. *H/M*
- C2. Model dropdown: show context length + provider badges; disable models not in the registry with a tooltip. *M/S*
- C3. Slash-commands / prompt-library quick-insert. *M/M*

### Memory (`/memory`)
- ME1. The new insights strip is in. Add **relevance-score bars** on recall results and a tag filter chips row. *M/S*
- ME2. Mental-models / directives: inline edit, and a "why was this recalled" explainer. *M/M*

### Models (`/config/models`)
- MO1. Fallback chain: drag-to-reorder (currently up/down buttons); show which model is "active default" per task slot at a glance. *M/M*
- MO2. Surface the sync/drift state inline per model (the data exists) rather than only a banner. *M/S*

### Skills / Tools / Personalities (`/operations/*`)
- SK1. Skills (185 of them): virtualise the list; add bulk enable/disable; category quick-filter chips. *H/M*
- SK2. Tools: the new insights strip is in; add a per-platform matrix view toggle. *M/M*
- SK3. Personalities: live SOUL.md preview diff vs disk; "duplicate as starting point". *M/M*

### Scripts (`/orchestration/scripts`)
- SC1. Empty state is correct but bare: add a "register your first script" guided CTA with the backup-script example. *M/S*
- SC2. Run-now: stream the script output live (currently logs after). *M/M*

### Story Weaver (`/recroom/story-weaver`)
- SW1. Reading view polish: typography settings exist; add progress + estimated reading time + chapter nav rail. *M/S*

### Config (`/config` + sections)
- CF1. The config index is clean. Add **search across config fields** and a "changed from default" badge per section. *H/M* (This row used to say "the 28-section index" and the count was wrong. The page derives it from `CONFIG_SECTIONS` at render time, so prose here carries no number.)
- CF2. Per-section editors: show the on-disk YAML diff before save; "reset section to default". *M/M*

---

## 4. Phase P6 shortlist (implemented this pass)

The low-risk **quick wins** pulled forward into P6: **B1, B2, B3, B4, B5** (restraint + chrome), **X1, X2** (consistent states + micro-interactions), **D1, D4, M3, ME1** (clickable pills, live-timestamp, next-runs preview, relevance bars). Everything else is catalogued here for follow-up, sized so it can be scheduled independently.

B5 is the one entry on that list that P6 did not close. The rename overtook it: the sidebar took the PatterStage wordmark, the mobile header kept "PT / Hermes", and the two have disagreed since. See the rewritten B5 row above.
