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

## A claim this file used to make, retired by a tester who ignored it

**"The config write path refuses to overwrite a malformed config.yaml."** That
sentence was wrong, it came from here, and it cost a round.

T-0054 corrupted a config.yaml, watched the server stay up, saw a refusal logged,
and concluded the write path was defended. It was: `syncDefaultsToHermesConfig`
in the Hermes adapter genuinely refuses, logs the line and column, and hands the
backup path back. But `PUT /api/config` is a different writer and it was never
tested against a malformed file. Generalising "a write path" to "the write path"
turned a real observation into a false guarantee, and the record went further,
calling a malformed config **"a reporting gap rather than a data-loss risk"**.

That phrase then travelled into a QA brief as a do-not-file. A tester ignored it,
typed a value into `/config/agent`, pressed Save, and watched 15,016 bytes of
operator configuration become 23. Fixed in T-0060: the route now parses the file
itself and answers 409, and the whole config survives, byte-identical.

Two things to take from it when reading anything else in this file:

- **A defence proved for one caller is not proved for the caller beside it.**
  If a note says "the X path is safe", ask which X.
- **A do-not-file entry is a claim like any other.** Everything in the appendix of
  a QA brief, and everything below in this file, is written by someone who could
  be wrong. If the product disagrees with it, the product wins and I want the
  report.

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
- **A write cannot reach a handler under `PS_READ_ONLY`.** The observation was
  right, the mechanism was not: it is not that every write handler guards before
  it parses. `src/proxy.ts` refuses every unsafe method before any handler runs,
  so a malformed-JSON 400 cannot precede the 503 whatever the handler does with
  the body. Most write handlers carry no guard of their own at all since T-0048
  deleted `requireAuth`. The handful that do are there for the wording or for a
  second condition: `requireNotReadOnly` names the resource in the refusal
  (missions, skills, tools), `requireAuthenticatedHostWrites` covers writes that
  reach the host (scripts, crontab), and the update route additionally demands
  the deploy API be enabled and the request signed. Do not file a route for
  parsing first, and do not file one for carrying no guard.
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
duplicate `Test Story 2026`, a `Test description` profile, a `Personalities` typo
in a *user-created* template. The seed catalog (`data/seed/**`) is clean. Use the
**Settings > Restore > Clear test clutter** tool to purge throwaway artifacts; profile copy
edits are made on the Agents page.

See also [DATA_STORAGE.md](DATA_STORAGE.md) for where data lives and which legacy
`control-hub` / `ch.*` names are intentional back-compat.

## Round 6 (2026-09-04): run by the operator's own Hermes agent

The report disclosed its model (MiniMax-M3), could not render web pages, and
could not stop the gateway it lived behind. It said all three plainly, which is
why its findings could be trusted where they held and traced where they did
not. Every claim was validated against the code before anything was changed;
three mechanisms were wrong and the symptoms were real. Read these before
re-filing anything from that report.

### Three mechanisms the report got wrong (the symptoms were real)

- **config.yaml corruption (finding 9).** Blamed `syncDefaultsToHermesConfig`
  and a missing pre-write check. That function is an object round-trip that
  structurally cannot emit a duplicate key, and it was the only writer that
  already refused corrupt input. The corrupter was the text-level assembler in
  `profile-config-builder`, with three independent faults, and a loop that
  copied the corrupt disk file back into the database. Fixed in T-0086; every
  config.yaml write now parses before it lands, and a refusal names the backup
  to restore. Existing installs: run Pull all once after upgrading.
- **Story creation crash (finding 1).** Blamed an orphaned draft row from a
  crash after insert. The crash was before the insert; the empty 500 body was
  the router returning fourteen handler promises without awaiting them, so no
  rejection ever reached the catch. Fixed in T-0087. The real orphan paths were
  a restart during the LLM window (now swept at boot) and the cron-schedule 400
  that fired after the row was written (now judged before it, T-0088).
- **Chat title collision (finding 5).** Said the gateway's 400 surfaced as an
  opaque failure. It never surfaced: the catch swallowed it, the conversation
  was created with no session, and the route answered 201. Fixed in T-0089:
  one retry with a suffixed title, then the honest fallback.

### Already done when the report arrived

- **Finding 19** (offline banner mid-conversation): verified live in a browser
  on this device in T-0080 before round 6 ran.
- **Finding 20** (logs empty state): T-0079's message reached the page; round 6
  was right that it rendered as a red alert, and that an empty logs directory
  got the same treatment. Both are a calm status now (T-0087).

### Fixed this round, do not re-file

T-0086 config assembler and belt; T-0087 stories (return await, body guards,
update allowlist, `id` alias, boot sweep, logs calm state); T-0088 mission
timeouts 1..4320, list-field guards, name hygiene on update, schedule judged
before the row exists, every list bounded; T-0089 stop treats 404 as stopped,
chat title retry, live elapsed time on a running stage, gate verbs accept and
reject only, `Allow` on every 405 and stubs on the skills toggle, the
Personalities "Set as active" control removed; T-0090 the gateway gate (a
saturated endpoint answers 503 naming the gate); T-0091 `GET
/api/status/subsystems` and the dashboard panel; T-0092 the six browser
findings from this device.

### Environment, not product

- **A stale `.next/` build** serves yesterday's bundle. Rebuild before filing a
  UI bug, as Step 0 says.
- **A stale port** from a previous process is the previous process, not a
  second instance. The boot line names the port actually listening.

### Deferred, on purpose

- **Database as the single source of truth** for everything the agent reads:
  aligned with the standing V1-foundations roadmap (phases 2 to 5), recorded
  there, not done in this round. The config assembler fix (T-0086) made the
  database copy trustworthy, which is the precondition.
