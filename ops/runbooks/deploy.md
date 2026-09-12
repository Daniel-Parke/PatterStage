---
summary: PatterStage install and update runbook, authored at Session 0 for the ops-runbook add-on
type: runbook
tags: [ops, hosting]
authored: true
compiled_from: authored
---

# Install and update runbook

Authored at Session 0, not compiled: the `ops-runbook` add-on has no kernel
template, and the matrix says an add-on without one is authored from the doctrine
its trigger names.

**Adapted deliberately.** The add-on's trigger is "anything deployed with server
state", and the doctrine behind it assumes PatterTech deploys to a server it
controls. PatterStage inverts that: **the operator deploys nothing.** The user
installs it on their own machine and their own SQLite file is the production
database. So this runbook is written for whoever is running the app, and the
"incident" it prepares for is a failed update on a stranger's laptop rather than a
bad rollout.

## What you are operating

One Next.js process, one SQLite file, one optional agent alongside it.

- App data: `PS_DATA_DIR` (see `docs/running/env-reference.md`), holding `patterstage.db`
  and the auth token.
- The agent's own files are separate and not PatterStage's to manage.
- Nothing is remote. No account, no service, no telemetry.

## Install

```bash
bash scripts/bootstrap/install.sh
```

Then reach the app on the port it prints. The auth token is minted **at boot**, not
on first request: `src/instrumentation.ts` calls `ensureAuthToken()` during startup
and prints both a ready-to-click sign-in URL and the token's path in the boot log.
Read it there rather than hunting for it. The file is `PS_DATA_DIR/auth-token` at
mode 0600; there is no signup, because there is one operator and it is you.

**Verify the install rather than assuming it.** `GET /api/health` is the only
unauthenticated route by design. If any other route answers without a token, stop
and report it: that is the failure mode the 2026-07 hotfix existed to close.

## Update

```bash
bash scripts/application/ps-deploy.sh update
```

What it does, in order, and why the order matters:

1. **Backs up the database before touching it.** Migrations run forward only and
   there is no down-migration, so the backup is the rollback.
2. Pulls, installs, builds.
3. Runs migrations. A migration that fails **must not** bump `schema_version`, and
   as of 2026-07 it does not: `src/lib/db/apply-sql.ts` swallows only
   already-applied errors, so a real failure propagates and the version stays put.
4. Restarts.

**If the update fails part-way**, the database is either at the old version (safe,
restart the old build) or has a completed migration (safe, the chain is
transactional per file). The dangerous case, a half-applied migration recorded as
complete, is what step 3 exists to prevent.

## Restore

The restore-test add-on exists because a backup nobody has restored is a belief,
not a backup. The cadence row is in `org/cadence.json` and the procedure it
names is `org/PLAYBOOKS.md#restore-test`.

```bash
# stop the app first: a live process holds the SQLite file
# scheduled backups (scripts/hardware/ps-db-backup.mjs) land here, name first:
cp "$PS_DATA_DIR/backups/db/patterstage.<timestamp>.db" "$PS_DATA_DIR/patterstage.db"
rm -f "$PS_DATA_DIR/patterstage.db-wal" "$PS_DATA_DIR/patterstage.db-shm"
# a pre-migration backup from ps-deploy sits BESIDE the db instead:
#   cp "$PS_DATA_DIR/patterstage.db.pre-migrate-<timestamp>.bak" "$PS_DATA_DIR/patterstage.db"
```

Three more writers land in the same directory, labelled in the file name:
`manual` from the Back up now button on **Settings > System**, `pre-restore`
from a restore that overwrites rows, and `pre-clean` from a purge of throwaway
test data. Settings > System lists every one of them with its size and time, and
prints this same copy command with the paths filled in.

Then start the app and confirm the schema version and a known row:

```bash
sqlite3 "$PS_DATA_DIR/patterstage.db" \
  "select value from meta where key='schema_version'; select count(*) from missions;"
```

A restore that leaves you on an **older** schema than the build expects will
migrate forward on next boot. That is the intended path and it is why the backup
is taken before migrating rather than after.

## What is deliberately absent

No monitoring, no alerting, no uptime target. There is no server to watch and no
availability promise to anyone. The health endpoint exists for the update script
and for a user who wants to check the process is up, not for a pager.

If PatterStage ever gains a hosted surface, this file is wrong and the venture has
tripped a rescale condition (`org/VENTURE_BRIEF.md`).
