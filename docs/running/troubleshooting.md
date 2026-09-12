---
title: Troubleshooting
summary: "Symptom first: what a stuck run, a silent schedule, a dark memory page and a refused sign-in each mean"
section: running
nav: 80
audience: operator
---

# Troubleshooting

Organised by what you saw. Each entry names the cause before the fix, because
several of the symptoms below are the product working exactly as designed.

**Start on the dashboard.** The Subsystems panel is five rows, each with a state
and a reason in words: the gateway, memory, the background sync, the agent's
`config.yaml`, and the admission gate in front of the gateway. A row that cannot
be checked says so rather than disappearing. Read it before you read anything
else, because it usually names the problem outright.

## Getting in

**"PatterStage needs your access token", or a bare 401.**
Working as designed. There is no login; one random token is minted on first boot
and every request is checked against it. Open
`http://127.0.0.1:<PORT>/?ps_token=<token>` once and the token is exchanged for
a session cookie. The token is the single line in `<PS_DATA_DIR>/auth-token`,
and restarting the server prints the full URL on its first `[auth]` line.
Deleting the token file and restarting mints a new one and signs every browser
out. See [security](../SECURITY.md).

**The address does not answer at all.**
Read `PORT` in `.env.local`. Either something else has the port, in which case
`bash scripts/bootstrap/stop.sh` or a different `PORT` plus a re-run of setup
fixes it, or the server is not running. Under WSL2, use the address the server
printed rather than the Windows machine name.

## The agent

**Missions fail instantly, and the Gateway row is down.**
PatterStage cannot reach the agent. The row names the address it probed. Check
that Hermes is installed and its API server is enabled, that
`HERMES_GATEWAY_URL` points at it, and that the agent process is up.

**The Gateway row says the gateway rejects our API key.**
`API_SERVER_KEY` on the PatterStage side does not match the one in the agent's
own `.env`. Setup generates one and wires both sides; if you edited either by
hand, make them agree and restart both.

**The dashboard checklist says the agent is not installed, but it is.**
PatterStage looks for a configured agent home at `HERMES_HOME` (default
`~/.hermes`). If the agent lives elsewhere or the gateway is on another machine,
set `HERMES_HOME` or `HERMES_GATEWAY_URL` in `.env.local` and restart. A
reachable gateway counts as a usable agent even with no local install.

**Everything returns 503 and the message names a gate and an endpoint.**
The admission gate in front of the gateway is saturated: too many concurrent
requests, or a queue that waited longer than its timeout. Almost always the
agent has stopped keeping up rather than PatterStage being busy. Check what is
running, then `PS_GATEWAY_MAX_INFLIGHT`, `PS_GATEWAY_MAX_QUEUE` and
`PS_GATEWAY_QUEUE_TIMEOUT_MS` in the
[environment reference](env-reference.md).

**The config.yaml row says it does not parse.**
Pushes and pulls refuse while that is true, deliberately, rather than
overwriting a file you are midway through editing. The row carries the parser's
own complaint. Fix the file in the agent's home, or restore it from a copy.

## Missions and runs

**A mission sits in Queued and never dispatches.**
Two ordinary causes. The queue is single-flight, so it waits while another
mission is dispatched. Or the spend hard stop is armed and the budget has been
passed, which pauses unattended dispatch only: the queue drain, a schedule
falling due, and a workflow advancing on the background tick. Nothing is lost,
and dispatching by hand still works, because a person clicking dispatch is
answering for the spend. See [spend](../reference/spend.md).

**A mission sits in Dispatched for a very long time.**
Usually the agent is still working; long runs are normal. There is a safety cap:
past `PS_RUN_MAX_MINUTES` (120 by default) plus a grace period, the reconciler
treats the run as stuck and fails it. A mission's own timeout wins over the cap.

**Cancelling did not stop the agent.**
Cancel asks the agent's own API to stop the run over HTTP. Local state is
finalised either way, so the board never shows a stuck row, but a backend that
ignored the stop keeps working until it is done. Check the agent's own logs.

**A mission failed with no useful message.**
Open its [session](../guides/sessions.md) and read the transcript. The reply is
rarely where the failure is; the tool call that returned an error is.

**The mission board shows "No categories loaded".**
The database has not been migrated to the schema the code expects. On the host,
`npm run db:migrate`, with `PS_DATA_DIR` set to the same directory the server
uses, then restart. Building does not migrate your live database.

## Schedules and scripts

**A recurring mission never fires.**
PatterStage owns that timer, and it runs inside the server process, so the
server has to be up. Due work is recomputed from the stored next-run time rather
than an in-memory timer, so a restart does not lose an occurrence. Check the
schedule is not paused, and check [Logs](../guides/logs.md).

**A host script never fires.**
Host scripts go into your user crontab on Linux and macOS, and those fire
whether PatterStage is running or not. Where there is no host scheduler, the
Schedule button writes a PatterStage schedule instead, which only fires while
PatterStage is up, and the row says which of the two it wrote. Check the log
file the row names before assuming nothing ran.

**A script runs by hand but not on the timer.**
The command a crontab line runs is rebuilt from the script's basename and an
interpreter map: any environment prefix, path or extra argument you pasted
alongside it is discarded rather than approved. Put what the script needs inside
the script. See [host scheduling](host-scheduling.md).

## Memory

**The Memory page shows nothing, or the Memory row reads degraded.**
Memory is optional, so an absent provider is degraded rather than down. If you
did configure one, check the Hindsight server is running and answering on its
port. The connection lives in PatterStage's database and is edited in the
provider panel at the top of the [Memory](../guides/memory.md) page, not in a
file.

**Memory worked, then stopped after a deploy.**
A deploy can strip the memory wiring out of the agent's `config.yaml` when the
stored copy is out of sync with disk. Re-wire it with
`bash scripts/hardware/reconnect-hindsight.sh`, which also syncs the result back
so later pushes preserve it. Details in [deploying](deploy.md).

## Chat, Composer, Research

**A chat bubble is stuck on "Thinking...".**
In Agent mode the load path heals it: the run reaches a terminal state in the
background and its output is folded onto the message. In Fast mode there is no
run behind the turn, so closing the tab mid-stream leaves the row where it was
until the boot sweep fails it after thirty minutes with a readable reason.
Reloading the conversation is the first thing to try.

**The Composer page 404s and its link is missing from the rail.**
`PS_COMPOSER` is set to `0`. It ships on. Unset it or set it to `1` and restart.

**A workflow run stopped with a readable error naming a stage.**
That is the design: a failing stage with no recovery edge fails the run and says
which stage and why, rather than looping forever. Loops are bounded by a
per-node attempt cap and a per-run step backstop for the same reason.

## Sessions and logs

**A transcript refuses to load, or arrives truncated.**
A session file larger than `MAX_SESSION_FILE_BYTES` (64 MiB) is refused rather
than loaded, and a transcript with more messages than `MAX_SESSION_MESSAGES`
(2000) sends the newest and says so on the page. Both are adjustable.

**Reads of the sessions page start returning 429.**
A rate limit, per client, per rolling minute. Usually several tabs polling at
once. Close them, or raise `SESSIONS_API_RATE_LIMIT_MAX`.

## The install itself

**Writes are refused across the whole product.**
`PS_READ_ONLY=1` rejects unsafe HTTP methods and leaves reads working. It is a
mode, not a fault; the refusals name the resource.

**Update, Rebuild and Restart are missing or refuse with 403.**
The deploy route is gated by `PS_ENABLE_DEPLOY_API`. Setup writes it on a fresh
install and never overwrites a value already there, so an install that was
deliberately locked down stays locked down. The page says so before the click.

**Numbers look wrong, or an edit did not take.**
Confirm which database the server actually opened: Settings > System shows the
data directory and the database path it resolved. An install can legitimately be
running out of a legacy directory or filename, which is the usual reason a
migration "did nothing".

**Spend shows nothing for work you know cost money.**
Some historical runs recorded no token counts and are deliberately reported as
unmeasured rather than folded in at zero, and a run that crashed mid-way cannot
be measured at all. The rules, and which sources were fixed when, are in
[spend](../reference/spend.md).

## Still stuck

Collect the facts with **Copy for a bug report** on Settings > System, and
follow [getting help](../start-here/getting-help.md).
