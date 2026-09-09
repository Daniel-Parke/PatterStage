---
title: Settings
summary: "Every configuration section the agent reads, plus this install's own facts"
section: guides
nav: 160
audience: operator
screen: /agent/settings
type: guide
tags: [product, config]
shots: [docs/images/settings.png]
---

# Settings

Settings is where you change how the agent behaves, and where you look when you
need to know how this install is put together.

## What you see

![Settings screen](../images/settings.png)

The header names the page and counts what is under it: 27 sections of
`config.yaml`, each saved with a backup. The `?` at the right of the header
opens this guide, and pressing `?` does the same.

Under the header, one line says whose settings these are. It names the agent
whose file this page edits, and if the profile you have chosen on Agents,
Skills and Tools is a different one, it says so and points you at the place
that profile's own settings live.

Then a search box: **Find a setting by name, e.g. reasoning, timeout,
voice…**. Typing narrows the page to the sections that match, and a section
that matched because of one of its fields shows that field's name as a small
chip in its header, so searching for `reasoning` keeps **Agent Settings** on
the page and tells you that **Reasoning Effort** is why. When nothing matches,
the page says so and suggests a word from a field's own name.

Below that the page is in two columns. Down the right, a list of every section
in its group: **Core**, **Infrastructure**, **Security**, **Voice & Audio**,
**Automation**, **Integrations** and **Files**, then **Pages** for the three
things that are not sections: **Models**, **Restore** and **System**. The list
stays put while you scroll and marks the section you are looking at; press a
name to jump to it. On a narrow window the list is a **Jump to section** select
at the top instead, with the three pages as links beside it.

On the right, every section, expanded, in the same order. Each is a card
headed with the section's name, a sentence about it, and badges: how many
fields it has, **configured** in green when the agent already holds values for
it, **+N read-only** when it also has nested values you cannot edit here, and
**file** on the two in Files. At the right of that header sit **Reset** and
**Save**, for that section alone.

### A section's fields

Each field is a switch, a number box, a drop-down or a text box, with its
description above the control and, beneath the control, one of two things:

- **Not set**, with the line *Hermes uses its own default*. The agent has no
  value of its own for this field, so it uses whatever it would have used if
  you had never opened this page.
- A **Clear** button. The field holds a value, and Clear takes it away again
  rather than writing a zero or an empty string in its place.

If a value already in the file is not the kind the field expects, an orange
line under the control says which value it found and what it expected, instead
of the control quietly rendering it as off or blank.

As soon as you change anything in a section, **UNSAVED** appears in that
section's header beside its **Reset** and **Save**. Reset puts back what the
page loaded. Save turns into **Saving…**, then **Saved!** for a moment. A
change in one section never enables another section's Save.

On a wide window a section lays its fields two to a row.

Sections with nested values keep them behind a line reading **N read-only
fields**. Open it and they are shown formatted, with a note that they are
edited in the agent's own file. **Platform Toolsets** is the same shape and
points at the Tools page, which is where toolsets are actually changed.

The two sections in **Files** behave differently from the rest. **HERMES.md**
is a plain text editor with the same Reset and Save. **Environment
Variables** is a read-only view behind a line counting its variables: open it
and every line is listed with its key visible and its value masked, with a note
that sensitive values are edited on the server rather than here.

Each section has an address of its own, `/agent/settings#<section>`, which the
list on the right uses and which you can bookmark. The old addresses, one page
per section, still work: each sends you to its section on this page. If you
reach a section address that does not exist, the page lists every section
there is as a link rather than leaving you to guess.

### Restore

Restore opens with a sentence counting what the app ships: Bob (the default
agent), the professional agents, mission templates, mission categories, skills,
tool bundles and memory facts. The numbers come from the pack itself, so they
describe what is in the box rather than what you already have. A **How this
works** disclosure explains the mechanics for anyone who wants them.

Then the sections, each with its own buttons:

- **Restore everything**, with **Restore everything**, **Restore Bob** and
  **Add what's missing**. Above the buttons, a line reading how many agents and
  templates are installed now out of how many the pack holds; below them, the
  date of the last restore.
- **Professional agents**, one row per bundled agent with its sync state and a
  **Restore this agent** button.
- **Mission templates**, one row per shipped template with a **Restore**
  button.
- **Categories**, with **Restore categories**.
- **Clear test clutter**, which starts with **Look for test data**. That lists
  the throwaway workflows, stories and missions it recognises, by name, and
  only then offers **Remove N items**.

Every overwrite takes two clicks: the button arms itself and asks. After it
runs, a line appears under that section saying what happened and when, and the
same sentence appears as a toast.

### System

Three cards.

**This install** is a plain table of facts: auth mode, whether the deploy API
is on, whether the install is read-only, whether Composer is on, the data
directory, the database, the agent's home, the gateway, the port, the schema
version, the app version, the commit, the Node version and the platform.
**Copy for a bug report** puts the same block on your clipboard. No secret is
in it.

**Updates** holds three buttons. **Check for updates** asks which branch to
compare against, then becomes **Up to date**, **Update available. Install it**,
or **Could not check. Try again** in amber. A check that failed is never
painted green. **Rebuild** builds and restarts; **Restart** restarts the server
without building. Both ask for a second click before they run. An **Advanced**
disclosure says which branch this install compares against and which one it is
checked out on. If a deploy fails, the last lines of its log are shown here.

**Backups** has **Back up now**, then the backups that exist with their size
and the time they were taken, then the command to restore one, with **Copy the
restore command** beside it. The console lists and takes backups; it does not
restore one, because restoring wants the server stopped.

## Typical use

### Change a setting

1. Type a word from the setting into the search box, or press the section's
   name in the list on the right. Searching narrows the page to the sections
   that match, and the chip on a section tells you which field matched.
2. Change the control. **UNSAVED** appears in that section's header.
3. Press that section's **Save**. It reads **Saved!** when the file has been
   written.

If Save is greyed out with a change pending, hover it: the tooltip names the
value it will not accept, for example a number outside the range the field
allows.

### Change two settings in different sections

1. Change the first. Its section says **UNSAVED**; the others do not.
2. Scroll or jump to the second and change it. Two sections now say
   **UNSAVED**, and each has its own Save.
3. Save each. A save writes only the section it belongs to, and only the
   fields you changed in it.

### Put a setting back to the agent's own default

1. Find the field.
2. Press **Clear** under it. The control empties and the field reads **Not
   set**.
3. Press that section's **Save**. The key is removed from the agent's file, so
   the agent falls back to its own default rather than to a zero you did not
   choose.

### Update this install

1. Open **System**, from the list on the right or the rail.
2. Press **Back up now** first. The new backup appears in the list underneath.
3. Press **Check for updates** and confirm the branch.
4. If it comes back as **Update available. Install it**, press it. The app
   pulls that branch, builds and restarts, so the console is briefly
   unavailable while it does.

## Notes

A save sends only the fields you actually changed, in the one section you
saved. That matters on a section where some other value on disk is one this
console cannot represent: it stays where it is instead of blocking the save of
the field beside it.

Every save copies the file as it was found before writing, so a change you
regret is recoverable from the copy. Values are checked against the declared
ranges and option lists in the browser and again on the server, so a number
outside the range is refused rather than written and met later by the agent.

If the agent's configuration file cannot be read, an orange alert appears at
the top of the page, saying the sections read as unconfigured because the file
did not parse rather than because it is empty, and every section that writes
that file has its Save disabled until it is repaired. The two file sections
keep working, because they do not write that file.

Some things here are shown rather than offered. Nested values are read-only.
The memory **Provider** field displays what is active and links to the
[Memory page](./memory.md), which is the one place that changes it. The
environment variables view is read-only for the same reason it is masked.

Restore overwrites. **Add what's missing** installs only what is absent and
leaves anything you have edited alone; the other buttons replace. Anything a
restore touches is backed up first.

If this install is read-only, **Back up now** is disabled and says so. If the
deploy API is off, the three update buttons are disabled and a line above them
says which setting turns it on. Both are deliberate: a console that cannot
write should not offer buttons that pretend it can.

The in-app backup covers the PatterStage database, not the agent's home folder
or the memory store. [Backup and restore](../running/backup.md) explains the
three stores and which of them a snapshot actually covers.

<details>
<summary>Under the hood</summary>

- The sections are the sections of the agent's `config.yaml`, in the home
  directory shown as **Hermes home** on System (`~/.hermes` by default). The
  console reads and writes it through `GET` and `PUT /api/config`.
- A save posts only the changed keys. `null` on the wire means "delete this
  key", which is what **Clear** sends; a section left with nothing in it is
  removed from the file rather than written as an empty mapping.
- Before every write, the file as found is copied into the `backups` folder in
  the same home directory. If it will not parse, the write is refused with a
  409 whose message names that copy, rather than merged into an empty document
  and written over the original.
- The two file cards use `/api/agent/files/<key>`. Saving `HERMES.md` copies
  the previous version into the same `backups` folder first. `.env` is served
  with its values masked and is never written from the console.
- The page, its seven groups and the three page links are data in
  `src/lib/config-sections.ts`; the fields of each section live in
  `src/lib/config-schema.ts`. The 27 redirects from the old section addresses
  and the list the browser tests visit are derived from the same list, so a
  section added to the data appears on the page, in the redirects and in the
  tests with no second edit.
- System's table comes from `/api/status/runtime`. Backups come from
  `/api/backup`: `POST` takes one, labelled `manual`, and the restore command
  is a template with a `<backup file>` placeholder you fill in.
- The update controls need the deploy API on (`PS_ENABLE_DEPLOY_API` in
  `.env.local`). The branch compared defaults to `PS_UPDATE_GIT_BRANCH`, which
  is `dev` unless set. `PS_READ_ONLY` disables the backup button along with
  every other write. See the
  [environment reference](../running/env-reference.md) for the full list.
- Restore reads the shipped pack under `data/seed` and writes it into the
  database, copying the database first. It also imports what is already in the
  agent's home folder, so files you have are imported rather than overwritten.

</details>
