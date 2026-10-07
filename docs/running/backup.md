---
title: Backup and restore
summary: "The three stores worth copying, how to take a snapshot safely while the app is running, and how to restore one"
section: running
nav: 40
audience: operator
---

# Backup and restore

Nobody else is keeping a copy of this install. PatterStage is a single-operator
control plane on your own machine, so the backup story is yours, and it is short
enough to read in one sitting.

## The three stores, and which one a snapshot covers

| Store | Holds | Covered by a snapshot? |
|---|---|---|
| `PS_DATA_DIR/patterstage.db` | Everything PatterStage owns: missions, runs, schedules, the session index, profiles, the skills catalogue, models and credentials, workflows, artifacts, stories, your spend policy | Yes |
| `HERMES_HOME` (`~/.hermes` by default) | The agent's own home: `config.yaml`, its `.env`, profiles and skills on disk, its sessions | No |
| The memory provider | Hindsight's own database, separate from both of the above | No |

Most of what you would grieve is in the first one, and PatterStage projects the
parts of it the agent needs back onto disk on a push, so a rebuilt agent home is
recoverable from the database in a way the reverse is not. That is why the
in-app backup is a database backup. See
[where your data lives](data-storage.md) for the full layout.

## Taking one

**Settings > System > Back up now.** It writes a file into
`PS_DATA_DIR/backups/db` named after the database, the label `manual` and the
moment it was taken, and the list on that card refreshes to show it with its
size.

The snapshot goes through SQLite's own online backup rather than a file copy, so
it is safe to take while the server is running and while a mission is in flight.
That distinction matters: the database runs in WAL mode, so committed pages can
still be sitting in the `-wal` sidecar, and a naive `cp` of the `.db` alone can
miss them. What the button writes is one self-contained file that needs no
sidecars beside it.

Nothing is scheduled by default. Taking the first one before you have anything
to lose is the whole discipline.

### It is not the only thing that writes a backup

The same card lists every backup of this database, newest first, whoever made
it:

| Label | Written when |
|---|---|
| `manual` | You pressed the button |
| `pre-restore` | Before a restore on Agent > Settings > Restore overwrites rows |
| `pre-clean` | Before a purge of throwaway test data |
| `pre-migrate` | By the deploy path, before a schema migration |
| `pre-baseline` | Before a database too old to upgrade in place is rebuilt |

The last two are written beside the database rather than in the backups
directory, and the card reads both places so you do not have to.

## Restoring

Restoring is deliberately a shell step with the server stopped. The product
shows you the exact command, with your own paths filled in, and runs nothing:

```bash
# stop the server first
cp "<backup file>" "<your database>"
rm -f "<your database>-wal" "<your database>-shm"
# then start the server again
```

Two things in there are load-bearing. The server has to be stopped, because it
holds the database open and copying underneath a live writer gives you a torn
file. And the `-wal` and `-shm` sidecars have to go, because a stale write-ahead
log left beside a restored database is replayed onto it, which quietly undoes
part of the restore you just performed.

**Agent > Settings > Restore is a different thing.** It puts back what PatterStage
ships: the seeded profiles, mission templates, categories and catalogue entries.
It does not read your backups. It does take a `pre-restore` snapshot before any
overwrite, and refuses to proceed if it cannot take one.

## Getting a copy off the machine

A backup on the same disk as the database survives a bad migration and nothing
else.

- Set `PS_DB_BACKUP_DIR` to a mounted volume or a synced directory, and both the
  button and the bundled script write there instead.
- Schedule `ps-db-backup.mjs` from the [Scripts](../guides/scripts.md) page for
  an unattended copy. It keeps the newest `PS_DB_BACKUP_KEEP` of its own
  snapshots, fourteen by default, and deletes the rest. It rotates only the
  files it wrote itself, so a backup you took with the button, or one taken
  before a restore or a purge, stays put however old it gets. A copy off this
  machine is still the one that survives the disk.
- Copy the file yourself. It is one ordinary file, and that is the point.

## The other two stores

- **The agent's home.** `bash scripts/bootstrap/backup-hermes-config.sh
  [target]` copies `config.yaml`, the agent's identity and memory files, its
  skills tree and the PatterStage data directory into one folder. Its `.env` is
  written out as a template with the values stripped, so the backup never
  carries your provider keys. It is a manual command; nothing schedules it.
- **Memory.** `ps-backup.sh` snapshots the Hindsight store to JSON. It needs
  bash, `jq` and a Hindsight server that is actually running, which makes it
  Unix-only, and it rotates its own output by age. The details and its
  environment variables are in [host scheduling](host-scheduling.md).

## When something has gone wrong

| Symptom | Cause | What to do |
|---|---|---|
| The Backups card says "No backups yet" | Nothing has written one; the directory is created on the first write, not at install | Press **Back up now** |
| The button is disabled and the card says read-only is on | `PS_READ_ONLY=1` rejects unsafe methods | Unset it and restart, or copy the database file by hand with the server stopped |
| The list is missing a backup you know exists | It is not a backup of *this* database, or it was a scheduled snapshot and the rotation reached it | Check which file the server actually opened, on Settings > System under **Database** |
| A restore appears to have lost recent work | A stale `-wal` sidecar was replayed onto the restored file | Restore again, including the `rm -f` of both sidecars |
| The database will not open after a restore | The copy came from a different install, or was taken with `cp` while the server ran | Use a snapshot taken through the button, and see [upgrades](migration.md) for the baseline rebuild path |

A backup you have never restored is a hope rather than a plan. Trying one into a
throwaway `PS_DATA_DIR` costs ten minutes and tells you whether the other half
of the procedure works.
