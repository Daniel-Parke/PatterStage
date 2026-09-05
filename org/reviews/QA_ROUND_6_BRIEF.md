# PatterStage - QA brief, round 6

Get PatterStage running on this machine and then **use it for real work**. Find
everything that is broken, confusing, ugly, slow, or dishonest.

You are not running a test suite. You are being the user.

---

## What you are

**You are Hermes** - the agent PatterStage exists to drive. You are testing your
own control plane. You are already installed and running on this machine, so
nothing here asks you to install or configure Hermes.

That has one consequence you must respect:

> **Never stop, restart, or disconnect your own runtime.** Do not kill the Hermes
> process, do not take down the network, do not stop anything you are running
> inside. If a test below needs a component stopped and stopping it would end
> your session, skip it and say so in your report. A skipped test is fine. A
> dead session is a lost round.

Restarting **PatterStage** is fine - that is a separate process from you.

You are also working against a **real install with real data**. Prefer creating
your own test records over deleting things that were already there. If you do
delete something pre-existing, say so in the report.

---

## Get it running

```bash
cd <the PatterStage repo>
npm run build && npm run start
```

`npm run start` serves a build, so the build has to exist first - run both.

If PatterStage has never been set up on this device, run
`bash scripts/bootstrap/install.sh --in-repo` once before that. If setup fails,
that is finding number one: record exactly where it stopped and what it said.

Open the dashboard using the `[auth]` link the server prints. There is no login  - 
PatterStage mints one access token on first boot and checks every request against
it, so the bare URL answers **401 on purpose**.

The server also prints:

```
[config] read-only=off  deploy-api=off  auth=token  composer=on  gateway=default
```

That is what the process actually booted with. Check it before filing anything
about a mode - a previous round lost work to a restart that silently dropped the
environment, and had to retract a finding because of it.

---

## How to test

**Drive it in a real browser, as a person would** - click, type, read, scroll.
Do not test it by reading source, and do not substitute API calls for a screen
you could have looked at. Use the API only to set up a state or confirm a
diagnosis you already saw.

**If you cannot render and interact with web pages, say so at the top of your
report.** That bounds everything else you write, and it is the single most useful
thing the last round told me.

**Rebuild before filing a UI bug.** `npm run build`, restart, hard-refresh, then
reproduce. Two previous rounds filed widgets that were correct in source and
stale in the running bundle.

---

## Cover everything

Every one of these is a surface a user reaches. Visit all of them, in both the
empty state and once there is data:

**Main** - Dashboard, Sessions (list and a transcript), Memory, Logs
**Orchestration** - Missions, Composer, Scripts, Chat
**Operations** - Agents, Skills (including browsing into a skill), Tools, Personalities
**Config** - the settings index, Models, Seed, and a spread of the ~38 config
sections (a simple toggle one, one with a text area, Environment, HERMES.md,
Security, Privacy)
**Laboratory** - Insights, Deep Research, Artifacts
**Rec Room** - Story Weaver: Library, Create, Characters, Themes, and the reader

---

## Do real work with it

Not a checklist to tick - a fortnight of real usage, compressed.

**The first fifteen minutes, once.** You only get one shot at a first impression.
Follow the dashboard's own START HERE checklist exactly, in order, and stop the
moment it stops telling you what to do next. Note every point where you had to
guess, and everything you expected to be told and weren't.

**Put work through it.** Dispatch missions and read what comes back. Use the
bundled templates; write your own; save one as a template. Schedule one for later
and come back to confirm it fired. Run several at once. Cancel one mid-flight.
Build a Composer workflow with a human approval gate and drive it end to end,
including approving and rejecting. Hold long conversations in Chat, including
ones that need a tool and trigger an approval prompt. Write and run scripts.
Start a Deep Research run and read its output. Write a story in Story Weaver from
nothing - characters, theme, generate, then read it in the reader.

**Configure yourself.** These screens change *you*. Create an agent profile, edit
its SOUL.md and AGENTS.md, push it. Change a personality. Turn a skill off and
on, then check whether your own behaviour actually changed. Add a model and a
credential, use them, then delete the credential. Change real settings across
several config sections and confirm each one persisted.

**Then live with it.** Come back once there are fifty missions, a dozen sessions
and several stories. Does anything overflow, slow down, paginate badly, sort
wrongly, or show a count that is now stale?

---

## Break it, safely

Only the ones that cannot end your own session:

- Restart PatterStage while work is in flight. What does the board say?
- Reload the page halfway through filling a long form. Do you lose the work?
- Open the same page in two tabs and change the same thing in both.
- Browser back after a modal, and after arriving on a deep link.
- Feed forms nonsense: empty fields, whitespace-only, enormous pastes, emoji,
  the 30th of February, a negative timeout.
- Submit the same thing twice quickly.
- Sign out (clear the session cookie) mid-task and come back.

If you can make PatterStage's connection to the Hermes API server fail **without
ending your own session**, do it and watch what the UI says. If you cannot, skip
it and say so.

---

## Look at it as a person

- **Every empty state.** What does it say before there is any data? Helpful, or
  just blank?
- **Every error.** Could someone who does not know the internals act on it?
- **Every wait.** Do you know something is happening, and roughly how long?
- **Every destructive action.** Is there a confirmation, and can it be undone?
- **Keyboard only.** Tab through each page. Can you always see where focus is?
  Can you escape a modal? Can you reach everything a pointer could?
- **Narrow viewport.** Emulate ~390px wide and walk the whole product again.
  Anything overlapping, clipped, or scrolling sideways?
- **The words.** Jargon, inconsistent naming for the same thing, numbers with no
  unit, labels that do not match what the control does, copy that lies.

---

## Known already - fixed since this brief was written

Found in a browser pass on a Windows dev instance and fixed in T-0092. They
stay here so the next run confirms them rather than re-finds them.

| What was wrong | Where | Now |
|---|---|---|
| "Enter a Mission Name before submitting" showed before you had typed anything | Missions → New Mission | Silent until you start; the button stays disabled with the reason in its tooltip |
| Goals placeholder ran three goals together while the hint said "one per line" | Missions → New Mission | One example line |
| The dispatch-mode selector sat below the fold; the footer said "Save draft" | Missions → New Mission | Dispatch is the first section of the sheet |
| "Hermes is not installed - nothing will actually run" beside a working gateway | Dashboard | Says the agent runs through the gateway at its address |
| `Total`/`Active` and `Done`/`Failed` labels overlapped at ~1280px | Missions stats strip | Tiles wrap; a Playwright probe measures the boxes |
| A `[paths]` boot warning told you to set `PS_DATA_DIR` when it was already set | Server log | Quiet when it was set |

## Don't file these - they are known-correct

Read `docs/QA_NOTES.md` in full. **Every line below is a claim someone made and
could be wrong. If the product disagrees with it, the product wins and I want the
report** - a previous round's "do not file" entry was wrong and cost 15,016 bytes
of a real config file.

- **A toast is not missing because you looked a moment too late.** Success toasts
  auto-dismiss in ~4s; error toasts persist until dismissed. They carry
  `role=status` / `role=alert`. Finding *zero* live regions is a real finding.
- **Lists are not frozen.** Deep Research polls every 4s, its detail view 3s,
  missions 15s, on top of SSE. A background tab suspends refetching - keep the
  tab focused before calling something stale.
- **`title` is a valid accessible name.** Weaker than `aria-label`, not absent.
- **Read-only mode refuses at the proxy**, before any handler runs. Don't file a
  route for "parsing before guarding" or for carrying no guard of its own.
- **A mission whose backend goes away is not wedged.** It fails after its declared
  timeout plus a grace. Thirty seconds is not long enough to call it stuck.
- **Chat "New Chat" reuses an existing blank chat** deliberately.
- **Junk like a `Testy` workflow is data in the dev database**, not the seed
  catalog. The Seed tools can purge throwaway data.

---

## Confirm these still work

Fixed last round; each is one user action in the browser.

- Schedule `0 0 30 2 *` → refused, with a reason that says why. `0 0 29 2 *` (a
  real leap-year date) → accepted.
- Dispatch a mission with no name → it is named after what you asked for, not
  "Untitled Mission".
- Open Logs before anything has logged → it says that is normal on a fresh
  install, rather than looking like an empty list.
- With the gateway unreachable, send a chat message → the error names the address
  and what to do. No raw `ECONNREFUSED`, no blank failure. The offline banner
  names the port actually configured, and appears mid-conversation, not only on
  an empty chat.
- Dashboard skills and sessions counts are real numbers, not 0.
- The agent experience board includes the root agent, not only named profiles.
- Saving toolsets against a Hermes home with no `memories/` directory succeeds.
  If any push does fail, the message says the change was *saved* and only the
  mirror to Hermes failed.
- Paste a wrong access token about eight times → a few plain refusals, then a
  short "too many attempts" wait measured in seconds, then a correct token works
  again shortly after.
- Two credentials for the same provider: delete one → the shared `.env` key
  survives. Delete the second → it is removed.
- `GET /api/stories` answers a helpful 405, not a bare 404.

Fixed after round 6; each is one action in the browser or one request:

- Push a profile, then open its config.yaml: one `model:` key, personality
  intact, every preserved section still there. Pull, push, pull again: nothing
  changes.
- Create a story with a single-word mood: it creates, with a real chapter.
- Dispatch with `timeoutMinutes: 1e9`: a 400 naming 1 to 4320, and no Draft.
- A cron schedule for the 30th of February: a 400, and no Draft.
- `GET /api/missions?limit=5`: five, newest first.
- Cancel a mission whose run already finished: no error in the server log.
- Approve a gate with `action: "approve"`: a 400 naming accept and reject.
- `GET` or `POST` on `/api/skills/[name]/toggle`: a 405 with `Allow: PUT`.
- The dashboard shows a Subsystems panel with five rows, each with a reason.
- Personalities has no "Set as active" control.

---

## Report

Per finding:

- What you were trying to do, in your own words
- What you did - the actual steps
- What you expected, and what you got
- **Severity** and **confidence**, stated separately
- Evidence: a screenshot for anything visual, console/network for anything that
  failed, the exact copy for anything about wording
- Whether it still reproduced after a clean rebuild

Then three lists:

1. **Findings**, worst first.
2. **What's good**, with evidence - I need to know what not to break.
3. **What you could not test, and why.** An honest gap beats a guess.

Finally: tell me the single worst thing about using this product, even if it is
not a bug.
