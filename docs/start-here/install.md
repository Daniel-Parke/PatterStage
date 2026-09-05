---
title: Installing
summary: "Getting PatterStage onto Linux, macOS, or Windows under WSL2, and what the installer does for you"
section: start-here
nav: 20
audience: operator
---

# Installing

PatterStage is Linux-first. Linux is the supported and tested target, macOS is a
best-effort developer environment, and on Windows you run it inside WSL2, which
is Linux. The reasoning and the support tiers are in
[platforms](../running/cross-platform.md).

## Before you start

| You need | Notes |
|---|---|
| Linux, macOS, or Windows with WSL2 | See the per-platform steps below. |
| Node.js 20 or newer | Matches what CI builds against. |
| git | The installer clones, and the in-app updater pulls. |
| The Hermes agent | Install it on the same machine. PatterStage boots without it, but nothing can be dispatched until it is there or a gateway is reachable. |

Install the agent first if you can: [Hermes installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation).
If you install it afterwards, restart PatterStage so it picks the agent up.

## Windows: set up WSL2 first

There is no native-Windows install. From an elevated PowerShell, once:

```powershell
wsl --install -d Ubuntu
```

Reboot if prompted, open the Ubuntu app, and follow the Linux steps below inside
it. WSL2 forwards `localhost`, so the dashboard opens in a normal Windows
browser at the address the server prints.

## Linux and macOS

1. **Clone the repository.**

   ```bash
   git clone https://github.com/Daniel-Parke/PatterStage.git
   cd PatterStage
   ```

2. **Run the installer.**

   ```bash
   bash scripts/bootstrap/install.sh --in-repo
   ```

   `--in-repo` installs into the clone you are standing in. Leave it off and the
   installer clones to `~/patterstage` for you. It asks whether to install
   Hermes and whether to set up the Hindsight memory server, and it writes
   `.env.local` with a free port (usually in the 42069 to 42100 range) and a
   shared key that wires PatterStage to the agent's API server.

   On macOS, `npm install` builds a native SQLite module. If that step fails,
   install the Xcode Command Line Tools and run the installer again.

3. **Start the server.**

   ```bash
   npm run start
   ```

   Next binds every interface by default. `npm run start:network` is the same
   thing with the bind stated explicitly.

4. **Open the link the server prints.** PatterStage has no login. It mints one
   random access token on first boot and checks every request against it, so the
   bare address answers 401 on purpose. The first `[auth]` line of the output is
   your way in:

   ```
   [auth] Open PatterStage at http://127.0.0.1:<PORT>/?ps_token=<your token>
   [auth] Token file: <PS_DATA_DIR>/auth-token
   ```

   Open that URL once. The token is exchanged for a session cookie and stripped
   back out of the address bar, so you paste it once per browser. Lose the line
   and the token is the single line in that file; restarting prints the URL
   again.

That token grants mission dispatch, and the agent's toolset includes terminal
access. Treat it as root on the host, and read
[security](../SECURITY.md) before you expose the port to anything wider than the
machine itself.

## What went where

| Path | Holds |
|---|---|
| `~/patterstage/data` (`PS_DATA_DIR`) | PatterStage's SQLite database, scripts, logs and backups. |
| `~/.hermes` (`HERMES_HOME`) | The agent's own home: `config.yaml`, profiles, skills, sessions. |

Both are configurable in `.env.local`. The full list of variables is the
[environment reference](../running/env-reference.md), and the longer story about
which file the server actually opened is in
[where your data lives](../running/data-storage.md).

## If it did not work

- **The page says PatterStage needs your access token.** That is the design, not
  a fault. Use the `?ps_token=` URL above.
- **The port is already in use.** Read `PORT` in `.env.local`, then either
  `bash scripts/bootstrap/stop.sh` or change the port and re-run setup.
- **Missions fail immediately.** Usually the agent is missing or has no model.
  The dashboard's checklist says which, and [the first hour](first-hour.md)
  walks through fixing it.

Anything else: [troubleshooting](../running/troubleshooting.md).

## Unattended installs

The bootstrap scripts prompt by default and skip every prompt when they are not
attached to a terminal. Set `PS_INSTALL_NONINTERACTIVE=1` (or `CI=1`) and make
the choices with `INSTALL_HERMES`, `INSTALL_HINDSIGHT` and
`PS_SETUP_SKIP_CATALOG_SEED`. Deploying to a host you keep is covered in
[deploying](../running/deploy.md).
