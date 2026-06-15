# Control Hub — UX & Branding Audit

A prioritized catalogue of interactivity / clarity / "fun & useful" improvements across the app, plus the **PatterTech-hybrid** branding-alignment assessment and the **brand-asset checklist** needed to finish the visual alignment.

Tags: **Impact** (H/M/L) · **Effort** (S/M/L). "Quick win" = H or M impact at S effort — the set implemented in Phase P6.

---

## 1. Branding alignment — PatterTech "hybrid"

**Where we are:** a neon-dark "Cherenkov" theme — deep blue-tinted surfaces (`dark-950 #040b12`), five competing neon accents (cyan/purple/pink/green/orange), and `glow-*` box-shadows used liberally. Strong, but louder than the parent brand.

**Where PatterTech actually sits** (observed from the live WiseWattage / PatterTech site, NI739839): a **dark** theme with a **green primary accent** — a green lightbulb logo + "WiseWattage" wordmark, green CTAs/links, clean card sections, generous whitespace, an Inter-like sans, "© PatterTech Ltd · Belfast". (Note: the *dark + green* reality is the opposite of the "light/minimal" first impression from the text-only homepage scrape.) Control Hub already carries the lineage with the **"PT / Hermes"** mark in the sidebar.

**Hybrid target (agreed, now sharpened):** Control Hub is *already dark* — so the alignment is mostly **(a) shift the primary accent from cyan → PatterTech green**, **(b) green CTAs/links**, **(c) the restraint already started in P6**, and **(d) the PT lightbulb logo lineage**. This is a smaller, lower-risk change than a light re-skin.

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| B1 | **Consolidate the accent palette.** Demote cyan to *the* primary; reserve purple/green/orange/pink for **semantic** roles only (orchestration / success / warning / danger). Stop using 5 accents decoratively on one screen. | H | M |
| B2 | **Dial back glow.** Halve `.glow-*` intensity and `GlowSurface` alpha; keep glow for *active/live* states only (pulsing process, live session), not static cards. | H | S |
| B3 | **Increase whitespace + vertical rhythm.** Standardise section spacing (`space-y-6`), card padding, and the 10px micro-label scale; let panels breathe. | M | M |
| B4 | **Tighten typography.** Inter is already the sans — define a clear H1/H2/section-label/body ladder; reduce the all-caps + mono-everywhere density (mono for data/IDs only). | M | M |
| B5 | **Brand chrome.** A wordmark/logo slot in the sidebar brand row + dashboard header + mobile header, ready for the PatterTech logo. Add a small "by PatterTech" footer line. | H | S |
| B6 | **Light-mode option (future).** A proper light theme would align closest to PatterTech; staged behind the brand-token swap, not this pass. | M | L |

**Brand-asset checklist (needed from PatterTech to finish):**
- [ ] Logo (SVG preferred + PNG fallback), light + dark variants.
- [ ] Primary brand hex + neutral ramp (we keep `#00bfff` as a stand-in until provided).
- [ ] Heading + body font families (and licence).
- [ ] Any tagline/wordmark lockup to use in the sidebar.
- [ ] Tone-of-voice notes for microcopy (empty states, errors, CTAs).

---

## 2. Cross-cutting UX (applies everywhere)

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| X1 | **Consistent loading / empty / error states.** A shared `LoadingSpinner` + `EmptyState` + `LoadErrorBanner` exist — apply them uniformly (some pages still bespoke). Every list gets a friendly empty state with a primary CTA. | H | M |
| X2 | **Micro-interactions.** Standard hover/active transitions on cards, rows, buttons (`transition-colors`/`duration-200`); subtle press feedback; respect `prefers-reduced-motion`. | M | S |
| X3 | **Keyboard affordances.** `Enter` to submit composer/search, `Esc` to close sheets/modals, focus rings on all interactive elements, focus-trap in modals. | M | M |
| X4 | **Operational toasts (deferred from N5).** Toast on real events — mission succeeded/failed, schedule fired, script finished — via prev/next diffing in the polling layer with cross-tick dedup. (Was deferred for spam-risk; do it carefully now.) | M | M |
| X5 | **Optimistic mutations.** Cancel/delete/toggle already refetch; add optimistic UI + rollback for snappier feel (mission cancel already does this — extend to schedules/skills toggles). | M | M |
| X6 | **Command palette (⌘K).** Jump to any page / mission / session / config section; high "fun & useful" payoff for power users. | H | L |
| X7 | **Mobile/touch polish.** Bigger tap targets, the mobile header chrome, swipe-to-close sheets; verify every page at 380px. | M | M |

---

## 3. Per-page notes

### Dashboard (`/`)
- D1 — The Command Center + stat pills + per-agent strip are strong. **Make the stat pills clickable** (Processes → agents, Sessions → /sessions, Memory → /memory). *H/S*
- D2 — Errors panel: add a one-click "copy" + "open log" per row, and a sparkline of error rate. *M/M*
- D3 — Dispatch strip: remember the last-expanded state; add a tiny "recently dispatched" row. *M/S*
- D4 — Live polish: the monitor now refreshes live (fixed in N) — add a subtle "updated Xs ago" timestamp so users trust it's live. *M/S*

### Missions (`/orchestration/missions`)
- M1 — The board is dense. Add **drag-to-reorder within a column** and a compact/comfortable density toggle. *M/M*
- M2 — Composer: a **live preview** of the assembled mission prompt; inline validation as you type; a "dry-run" that shows what would dispatch. *H/M*
- M3 — Schedule picker: a human-readable "next 3 runs" preview under the cron/interval input. *H/S* (reuses `computeNextRun`)
- M4 — Active-mission rows: live elapsed time + a mini progress indicator from `useRunProgress`. *M/M*

### Sessions (`/sessions` + `/sessions/[id]`)
- S1 — Transcript: collapse long tool-output blocks by default with expand; syntax-highlight code/JSON. *H/M*
- S2 — "Jump to next role" exists — surface it as visible nav chips, not just double-click. *M/S*
- S3 — Session list: a tiny activity sparkline per mission group; "resume / re-run" affordance. *M/M*

### Chat (`/orchestration/chat`)
- C1 — The new gateway banners are good. Add a **streaming typing indicator** + stop button while a response streams. *H/M*
- C2 — Model dropdown: show context length + provider badges; disable models not in the registry with a tooltip. *M/S*
- C3 — Slash-commands / prompt-library quick-insert. *M/M*

### Memory (`/memory`)
- ME1 — The new insights strip is in. Add **relevance-score bars** on recall results and a tag filter chips row. *M/S*
- ME2 — Mental-models / directives: inline edit, and a "why was this recalled" explainer. *M/M*

### Models (`/config/models`)
- MO1 — Fallback chain: drag-to-reorder (currently up/down buttons); show which model is "active default" per task slot at a glance. *M/M*
- MO2 — Surface the sync/drift state inline per model (the data exists) rather than only a banner. *M/S*

### Skills / Tools / Personalities (`/operations/*`)
- SK1 — Skills (185 of them): virtualise the list; add bulk enable/disable; category quick-filter chips. *H/M*
- SK2 — Tools: the new insights strip is in; add a per-platform matrix view toggle. *M/M*
- SK3 — Personalities: live SOUL.md preview diff vs disk; "duplicate as starting point". *M/M*

### Scripts (`/orchestration/scripts`)
- SC1 — Empty state is correct but bare — add a "register your first script" guided CTA with the backup-script example. *M/S*
- SC2 — Run-now: stream the script output live (currently logs after). *M/M*

### Story Weaver (`/recroom/story-weaver`)
- SW1 — Reading view polish: typography settings exist; add progress + estimated reading time + chapter nav rail. *M/S*

### Config (`/config` + sections)
- CF1 — The 28-section index is clean. Add **search across config fields** and a "changed from default" badge per section. *H/M*
- CF2 — Per-section editors: show the on-disk YAML diff before save; "reset section to default". *M/M*

---

## 4. Phase P6 shortlist (implemented this pass)

The low-risk **quick wins** pulled forward into P6: **B1, B2, B3, B4, B5** (restraint + chrome), **X1, X2** (consistent states + micro-interactions), **D1, D4, M3, ME1** (clickable pills, live-timestamp, next-runs preview, relevance bars). Everything else is catalogued here for follow-up, sized so it can be scheduled independently.
