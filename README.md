# PatterStage

PatterStage is a local-first web console for running and watching a
[Hermes](https://hermes-agent.nousresearch.com/docs/getting-started/installation)
AI agent on your own machine. You give the agent work from a browser tab, and
PatterStage keeps the record: what ran, when, what the agent said, what it
produced and what it cost. It is built for one person on one install, so there
are no accounts and no service in the middle. The database is a SQLite file in
your home directory, the agent is a process on the same box, and the only thing
that leaves the machine is the call to whichever model provider you chose.

> A [PatterTech](https://www.pattertech.com) venture.

What you do with it:

- Send the agent a **mission**: one instruction, once, or on a repeating schedule.
- **Chat** with it a turn at a time, with its reasoning and tool calls visible.
- Chain several steps in **Composer**, where edges can loop back and chosen stages stop and wait for your decision.
- Read the **transcript** of every run, and keep what each one produced.
- Shape the agent itself: profiles, skills, tools, models and its long-term memory.
- Put your own shell or Node **scripts** on a timer on the host, with no agent involved at all.

## What you need

| You need | Notes |
|---|---|
| Linux, macOS, or Windows with WSL2 | Linux is the supported and tested target. macOS is a development tier. There is no native-Windows install. |
| Node.js 20 or newer | What CI builds against, and what `engines.node` requires. |
| git | The installer clones, and the in-app updater pulls. |
| The Hermes agent | Installed separately, on the same machine. PatterStage boots without it and tells you what is missing, but nothing can be dispatched until it is there or a gateway is reachable. |
| A model provider | An API key for a hosted model, or a base URL for one you run yourself. Nothing dispatches successfully until a model is configured, and the provider call is the only thing that costs money. |

Install the agent first if you can. If you install it afterwards, restart
PatterStage so it picks the agent up. On macOS, `npm install` builds a native
SQLite module; if that step fails, install the Xcode Command Line Tools and run
the installer again.

## Install

On Linux or macOS. On Windows, do this inside WSL2, see below.

```bash
git clone https://github.com/Daniel-Parke/PatterStage.git
cd PatterStage
bash scripts/bootstrap/install.sh --in-repo
npm run start
```

`--in-repo` installs into the clone you are standing in. Leave it off and the
installer clones to `~/patterstage` for you. It asks whether to install Hermes
and whether to set up the Hindsight memory server, installs dependencies, builds
the app, writes `.env.local` with a free port (usually between 42069 and 42100),
and offers to seed a starter catalogue of agent profiles and mission templates.

Windows, one time, from an elevated PowerShell:

```powershell
wsl --install -d Ubuntu
```

Reboot if prompted, open the Ubuntu app, and run the four commands above inside
it. WSL2 forwards `localhost`, so the console opens in an ordinary Windows
browser at the address the server prints.

### Open the link the server prints, not the bare address

PatterStage has no login. It mints one random access token on first boot and
checks every request against it, so `http://127.0.0.1:<PORT>/` answers 401 on
purpose. The first `[auth]` line of the server output is your way in:

```
[auth] Open PatterStage at http://127.0.0.1:<PORT>/?ps_token=<your token>
[auth] Token file: <PS_DATA_DIR>/auth-token
```

Open that URL once. The token is exchanged for a session cookie and stripped
back out of the address bar, so you paste it once per browser. Lose the line and
the token is the single line in that file; restarting prints the URL again.

That token grants mission dispatch, and the agent's toolset includes terminal
access. Treat it as root on the host, and read
[security](docs/SECURITY.md) before you open the port to anything wider than the
machine itself.

Longer version, including unattended and non-interactive installs:
[installing](docs/start-here/install.md).

## Documentation

[docs/README.md](docs/README.md) is the reading path: what PatterStage is, how
to install it, one hour that takes you from a fresh boot to a mission you
dispatched and read the output of, then a page per screen, the concepts behind
the words on those screens, and the reference material.

The product serves those same pages at `/help` once it is running, so you can
read the guide for a screen without leaving it.

Good places to start:

- [What PatterStage is](docs/start-here/index.md)
- [Installing](docs/start-here/install.md)
- [The first hour](docs/start-here/first-hour.md)
- [Platforms](docs/running/cross-platform.md)
- [Getting help](docs/start-here/getting-help.md)

## What it does not do

- **It is not the agent, and it is not a model.** Hermes does the work and a
  provider serves the model. PatterStage is the screen you steer them from.
- **It is not multi-user.** No accounts, no roles, no sharing. One install, one
  person, one access token.
- **It is not hosted.** Nobody else can see your data, and nobody else is
  keeping a backup of it.
- **There is no native-Windows install.** Windows runs it under WSL2, which is
  Linux. The dev server incidentally starts on a native-Windows box, but that
  path is neither tested nor supported.
- **Host-script scheduling depends on the platform.** On Linux and macOS,
  scripts go in the user crontab and fire whether PatterStage is running or not.
  Native Windows has no crontab, so PatterStage's own timer runs them instead,
  which means they only fire while PatterStage is up. The Scripts page says
  which of the two it wrote.

The support tiers and the reasoning behind them are in
[platforms](docs/running/cross-platform.md).

## AGENTS.md and CLAUDE.md are not for you

`AGENTS.md` and `CLAUDE.md` in the repository root are instructions for AI
coding sessions working on PatterStage itself. They are not documentation for
the reader, and you do not need either of them to install or run anything. The
same goes for the `org/` folder, which holds the project's governance corpus.

## Contributing

Branch from `dev`, run the checks, open a pull request into `dev`. The full
path, the code standards and the gates CI runs are in
[contributing](docs/CONTRIBUTING.md), with the repository tour in the
[repository guide](docs/contributing/repo-guide.md) and the test story in
[testing](docs/contributing/testing.md).

## Licence and trademarks

Source code and technical documentation in this repository are licensed under
the [Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

The names **Patter**, **PatterStage**, **PatterTech** and related marks, plus
the visual identity in [`branding/`](branding/), are not part of that licence.
See [TRADEMARK.md](TRADEMARK.md). If you distribute a modified version, read
[REBRANDING.md](REBRANDING.md) first.

---

This repository was called `hermes-control-hub` and is now `PatterStage`.
Existing clones and forks keep working through GitHub's redirect. To repoint
one: `git remote set-url origin https://github.com/Daniel-Parke/PatterStage.git`.
