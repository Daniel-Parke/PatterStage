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
un-restarted dev server**: the running bundle predated the fixes. Before filing
any "X doesn't work" UI bug:

```bash
npm run build && <restart the server>      # then hard-refresh the browser (Ctrl/Cmd-Shift-R)
```

If a behaviour still reproduces *after* a clean rebuild + hard refresh, it's a
real runtime/hydration bug worth a live investigation. If it disappears, it was
stale.

## Transient feedback is not "no feedback"

One-click actions (Sync Now, Push all, Pull, Import, Save, etc.) confirm via a
**toast**, via `useToast` + `runSyncAction` / `runFallbackMutation`. Since T-0050
the duration depends on the kind: a SUCCESS toast still auto-dismisses after ~4
seconds, but an ERROR toast now PERSISTS until dismissed, because the reason a
mutation failed should not self-destruct while it is being read.

So a DOM snapshot taken a moment after a successful click will still miss the
toast, and that remains a tooling artifact rather than a missing-feedback bug.
A snapshot that misses an ERROR toast is now a real finding and should be filed.

Two other things changed with T-0050 and are worth probing directly. Toasts are
portaled to `document.body` at `z-[80]`, above the Sheet backdrop (`z-[60]`) and
panel (`z-[61]`); before that they rendered UNDERNEATH an open sheet, which is
why an earlier pass reported "no toast appeared" and was describing an invisible
one. And every toast is now an ARIA live region (`role="status"` polite for
success/info, `role="alert"` assertive for errors), so `[role=status], [role=alert]`
is a valid probe where it previously returned nothing.

Persistent busy states exist where it matters (the drift banners show
"Pushing…/Syncing…"), and settings-shaped surfaces additionally keep a
`[data-testid="last-result"]` line reading "Saved at HH:MM: …" that outlives the
toast entirely.

## Confirmed code-correct (do not re-file without a post-rebuild repro)

These have been read at the source level and verified working; re-file only with
a fresh-build reproduction:

- **Composer** workflow/profile dropdowns: the field-kit `Select` commits
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

## Confirmed code-correct, round 2 (2026-08-29 pass)

Four findings from the second live pass were accurate observations with the
wrong mechanism. Each cost a real investigation; none was a defect.

- **Deep Research runs DO live-update.** The runs list polls every **4 seconds**
  and the detail view every 3, on top of an SSE stream. Missions are the slow
  one at 15s. A headless browser that never focuses the tab is the likely cause
  of a list that appears frozen: TanStack suspends `refetchInterval` while a tab
  is hidden. Drive it focused, or assert against the API.
- **Writes are guarded BEFORE the body is parsed.** All 51 write handlers call
  their guard first; none parses first. Under `PS_READ_ONLY` the proxy refuses
  by method before a handler runs at all, so a malformed-JSON 400 cannot precede
  the 503.
- **`title` is a valid accessible name.** Per HTML-AAM, a `title` attribute
  supplies an accessible name when nothing else does, so an icon-only button
  carrying one is announced. It is the weaker mechanism (not exposed on touch or
  to keyboard-only users) and `aria-label` is preferred for new controls, but a
  button with `title` is not unlabelled.
- **A toast under a sheet was invisible, not absent.** Until T-0050 the toast
  sat at `z-50` beneath the Sheet's `z-[61]`, so a mutation confirmed from inside
  a dialog was covered by that dialog. It is now `z-[80]` and portaled to the
  body, and it carries `role="status"` / `role="alert"`. If you count live
  regions and find zero, that is now a real finding.

## Read the boot line before filing anything about a mode

Three sessions of the 2026-08-29 pass were lost to a watchdog restarting the
server without their environment, and one finding had to be retracted because of
it. The server now prints, beside the `[auth]` line:

```
[config] read-only=off  deploy-api=off  auth=token  composer=on  gateway=default
```

That is what the process actually booted with. It costs nothing to check and it
settles the whole class of question.

Two related traps from the same pass:

- **A mission killed mid-run is not wedged.** A run whose backend is unreachable
  is failed after its declared timeout plus a five-minute grace, so a gateway
  blip cannot kill a legitimate long run. Waiting thirty seconds and calling it
  stuck is impatience.
- **The advertised port is trustworthy.** Next assigns `process.env.PORT` at
  bind time before the boot line is printed, so the URL it prints always matches
  the port actually listening, `-p` or not.

## Known data-vs-code distinction

Some "bugs" are **data in the live DB**, not code or seed: a `Testy` workflow,
duplicate `Test Story 2026`, a `Test description` profile, a `Peronalities` typo
in a *user-created* template. The seed catalog (`data/seed/**`) is clean. Use the
**Seed → Clean dev / test data** tool to purge throwaway artifacts; profile copy
edits are made on the Agents page.

See also [DATA_STORAGE.md](DATA_STORAGE.md) for where data lives and which legacy
`control-hub` / `ch.*` names are intentional back-compat.
