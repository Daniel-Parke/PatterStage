---
title: Agents
summary: "Agent profiles, their behaviour files, and pushing and pulling them to the agent on disk"
section: guides
nav: 110
audience: operator
screen: /agent/profiles
concepts: [agent, profile, personality]
type: guide
tags: [product, agents]
shots: [docs/images/agents.png]
---

# Agents

Every agent you can run lives on this screen: what it sounds like, the files it reads before each run, and whether the copy PatterStage holds still matches the copy on disk.

## What you see

The header reads **Agents**, with the number of profiles under it. On the right, the profile picker that every Agent screen shares, and a **New Profile** button. The picker decides which profile the card at the foot of the page shows; choosing here is the same choice as choosing on Skills or Tools.

Directly under the header, if no agent is installed on this machine, an orange notice says so. You can still configure everything on this page, but nothing will run until the agent is installed.

Then one sentence says what a profile is: one agent, its voice, the skills it may use and the tools it may reach. A **Where a profile is stored** link folds out the file names behind that sentence if you want them.

Then two strips that appear only when they have something to say. **Agent performance · from real activity** is one tile per agent that has actually done work, showing how many runs it has been given (dispatched), its mission success rate, tokens used and average run time; an agent that has not done anything yet is not listed. Under it, an orange banner appears when the console and the files on disk disagree, or when a push did not complete. It names the counts and carries a **Push all to Hermes** button.

The row of sync buttons below is always there: **Push all**, **Pull all** and **Import discovered**. Push and pull for one profile are on its row in the table, as two arrows at the right-hand end.

Then the table, one row per profile: the name, its short name, how many skills and behaviour files it has, when it was last pushed (or **Never pushed**), and the two arrows. Your main agent carries a **Local default** badge. A profile whose files no longer match disk carries **Drift**; one whose last push failed carries **Sync error**, with the reason printed underneath it. The name is a button: press it to select that profile, which is the same as choosing it in the header. The selected row is highlighted. On a narrow window each row's columns stack, labelled.

Under the table, the profile you have selected, at full width:

- Its name and description, with **Edit profile** and, for every profile except the default one, **Delete profile**.
- A growth block: a level badge and the counts behind it, runs completed, active days, skills enabled and toolsets attached, plus the total XP. Before the agent's first finished run this reads "No completed work yet".
- A line about behaviour files, with a **Which file holds what** link that expands to name them.
- Two tabs, **Identity** and **Files**.

**Identity** shows **Voice**: the personality recorded for this profile, or a note that none has been recorded yet. Opening this tab also opens `SOUL.md` in the editor below, because that file is where the voice is written.

**Files** lists the behaviour files under the heading **Behaviour files**: `SOUL.md`, `AGENTS.md`, `USER.md`, `MEMORY.md` and `config.yaml`, plus `HERMES.md` on the default agent only. Each row shows its size, or the word **missing**, and a button reading **Edit** or **Create**.

The **editor** opens as a card at the bottom of the right-hand column. It names the file, shows an **Unsaved** badge the moment you change anything, and offers **Preview** / **Edit**, **Reset**, **Save** and **Close**. It opens in preview; the toggle switches it to a plain text box. If you try to leave a file with unsaved changes, a prompt appears at the top of the profile card offering **Discard changes** or **Keep editing**, and your work stays in the editor until you pick one.

## Typical use

### Change how an agent speaks

1. Pick the profile in the header, or press its name in the table.
2. Open the **Identity** tab. `SOUL.md` opens in the editor at the bottom.
3. Press **Edit** to switch out of preview, and write.
4. Press **Save**. The button confirms with **Saved!**, and the change is written through to the agent's own files straight away, so the next run reads it.

### Add a second agent

1. Press **New Profile**.
2. Give it a name and a description. The name becomes its short name, so "Research Assistant" becomes `research-assistant`.
3. Under **Clone From**, leave the default agent selected to start from a copy of it, or choose another profile. The clone copies its voice, its guide file and its settings.
4. Press **Create**. The new profile appears in the table, already written to disk.

### Reconcile a profile that has drifted

1. Select the profile carrying the **Drift** badge.
2. Decide which side you want to keep. **Pull** takes what is on disk and brings it into PatterStage. **Push** takes what PatterStage holds and writes it to disk, overwriting what was there.
3. Press the push or pull arrow on that profile's row, or **Push all to Hermes** in the banner to settle every drifted profile at once.
4. The badge clears and the row's "Last pushed" column updates.

## Notes

- **Saving is a push.** There is no separate step. Every save writes the file through to the agent's own directory, and the previous contents are copied into that profile's backups folder first. The sync buttons exist for the times you want to move a whole profile, or move it the other way.
- **`config.yaml` is checked before it is saved.** If the YAML does not parse, the save is refused with a message beginning "config.yaml was not saved", and your file is left exactly as it was.
- **The default agent is not an ordinary profile.** It cannot be deleted, and renaming it with **Edit profile** changes only the name PatterStage shows. Nothing is written into its own files, so you can rename it back.
- **Renaming any other profile moves it.** Its short name changes and its directory on disk is renamed to match, which is why the page follows the rename rather than dropping your selection.
- **Deleting is permanent.** It removes the profile from PatterStage and its files from disk, and there is no undo.
- **Drift is a real disagreement, not a missing file.** `config.yaml` is compared by meaning, so key order and spacing do not count. The other files are compared by content. A behaviour file that does not exist on disk yet is not reported as drift. `config.yaml` is the exception: if it is missing and PatterStage holds settings to write, that counts as drift and a push clears it.
- **Pull all does more than pull.** As well as re-reading every profile, it imports any profile directory it finds on disk that PatterStage does not know about, and imports skills from disk. **Import discovered** does the adoption step on its own.
- **Push all re-applies your model defaults** into the default agent's `config.yaml` as it writes. A named profile's `config.yaml` is rebuilt from its own voice, skills and toolsets, with any model block it already held carried across untouched.
- Skills counts and toolset counts on this page are set elsewhere: see [Skills](./skills.md) and [Tools](./tools.md). What the agent remembers is on [Memory](./memory.md), and the models it can reach are on [Models](./models.md).
- Nothing on this page calls a model, so nothing here costs anything. It reads and writes local files and the local database.
- Background on the words used here: [profile](../concepts/profile.md), [personality](../concepts/personality.md) and [agent](../concepts/agent.md). If this is your first session, [the first hour](../start-here/first-hour.md) puts it in order.

<details>
<summary>Under the hood</summary>

The database is the source of truth. Profiles live in the `agent_profiles` table; the default agent is a single row in `agent_root` rather than a profile row, which is why it has its own rules above. File bodies are columns on those same rows, `soul_md`, `agents_md`, `user_md`, `memory_md` and `config_yaml`, and are mirrored to disk on every write.

On disk, the agent's root is `~/.hermes` unless `HERMES_HOME` says otherwise, and named profiles live in `profiles/<short-name>/` beneath it. Each profile directory holds `SOUL.md`, `AGENTS.md` and `config.yaml`, a `memories/` folder holding `USER.md` and `MEMORY.md`, and a `backups/` folder that receives a timestamped copy of any file before it is overwritten. `HERMES.md` belongs to the root agent only; saving it against a named profile is refused rather than silently discarded.

`config.yaml` is assembled from the database on every push. `agent.personality` is the Voice shown on the Identity tab, `skills.disabled` holds the skills this profile may not use, and `platform_toolsets` holds the tools it may reach.

The routes behind the screen: `GET /api/agent/profiles` lists them, `POST` creates one, `PUT`/`DELETE /api/agent/profiles/[id]` rename and remove. Files are read and written at `/api/agent/files/[key]`, with `?profile=` for anything other than the default agent. Sync runs through `/api/agent/profiles/sync/push`, `/pull` and `/import`. Setting `PS_PULL_RECONCILE_DISK=1` makes a pull reconcile disk as well as read it. Creates, renames, deletes and file saves are written to the audit log; pushes and pulls are recorded as events, which is what the counts on [Insights](./insights.md) are built from.

Backups of whole profiles, as opposed to the per-file copies described above, are covered in [Backup and restore](../running/backup.md).

</details>
