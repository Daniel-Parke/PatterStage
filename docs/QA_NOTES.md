---
summary: How to run and read a QA walkthrough so the same non-bugs are not refiled every pass
type: notes
tags: [product, qa]
compiled_from: normalised
---

# QA Notes

Guidance for running (and reading) QA walkthroughs of PatterStage, so the same
non-bugs don't get re-filed every pass.

## Step 0: QA must run against a freshly built server

Two consecutive walkthroughs flagged a cluster of "broken" widgets that are
**code-correct in the current source**. The common cause was an **un-rebuilt /
un-restarted dev server** — the running bundle predated the fixes. Before filing
any "X doesn't work" UI bug:

```bash
npm run build && <restart the server>      # then hard-refresh the browser (Ctrl/Cmd-Shift-R)
```

If a behaviour still reproduces *after* a clean rebuild + hard refresh, it's a
real runtime/hydration bug worth a live investigation. If it disappears, it was
stale.

## Transient feedback is not "no feedback"

One-click actions (Sync Now, Push all, Pull, Import, Save, etc.) confirm via a
**toast that auto-dismisses after ~4 seconds** (`useToast` + `runSyncAction` /
`runFallbackMutation`). A DOM snapshot taken a moment after the click will miss
it — that is a tooling artifact, not a missing-feedback bug. Persistent busy
states exist where it matters (the drift banners show "Pushing…/Syncing…").

## Confirmed code-correct (do not re-file without a post-rebuild repro)

These have been read at the source level and verified working; re-file only with
a fresh-build reproduction:

- **Composer** workflow/profile dropdowns — the field-kit `Select` commits
  `onChange` and the label is bound to `value` (`src/components/ui/field/Select.tsx`).
- **Composer** page subtitle is present; the run canvas + approve/reject gate render.
- **Chat** "New Chat" intentionally **reuses** an existing blank chat instead of
  creating a duplicate (which collided on `invalid_title`).
- **Scripts** example chips fill the editor body (`openNew(name, content)`).
- **Sidebar** Config group headers (CORE / INFRASTRUCTURE / …) are working
  expand/collapse toggles, not dead links (`ConfigGroupSection.tsx`).
- **Missions** "Edit Templates" / "Manage categories" open modals; only one
  category-chip row renders per context.
- **Artifacts** page has an empty state ("No artifacts yet").
- **Agents / Models** sync & drift-resolution buttons fire and toast.

## Known data-vs-code distinction

Some "bugs" are **data in the live DB**, not code or seed: a `Testy` workflow,
duplicate `Test Story 2026`, a `Test description` profile, a `Peronalities` typo
in a *user-created* template. The seed catalog (`data/seed/**`) is clean. Use the
**Seed → Clean dev / test data** tool to purge throwaway artifacts; profile copy
edits are made on the Agents page.

See also [DATA_STORAGE.md](DATA_STORAGE.md) for where data lives and which legacy
`control-hub` / `ch.*` names are intentional back-compat.
