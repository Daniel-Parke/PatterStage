---
title: Getting help
summary: "Where the answer probably is, and where to ask when it is not"
section: start-here
nav: 50
audience: operator
---

# Getting help

PatterStage is maintained by one person in his spare cycles. The more precisely
you can say what happened, the faster it gets fixed. This page is the order to
try things in.

## 1. The Help section in the app

`/help` carries this same documentation, rendered inside the app, and each
screen's header links straight to its own guide. If you are looking at a screen
and want to know what a control does, that link is the shortest path.

## 2. These pages

- [Troubleshooting](../running/troubleshooting.md) is organised by symptom: what
  you saw, why it happens, what to do.
- The [guides](../guides/dashboard.md) cover one screen each.
- The [concepts](../concepts/agent.md) pages are for when a word is the problem
  rather than a control.
- [Running it](../running/deploy.md) and the
  [environment reference](../running/env-reference.md) cover the host side.

## 3. Work out whose bug it is

Two separate projects are involved, and reports land in different places.

| Symptom | Where it belongs |
|---|---|
| A PatterStage screen, an API route, the database, a script, this repository's CI | PatterStage |
| The agent loop itself, a tool misbehaving, gateway behaviour, agent config semantics | [Hermes Agent](https://github.com/NousResearch/hermes-agent), upstream |

The line is rarely sharp. If PatterStage is clearly wrapping an upstream thing
wrongly, that is a PatterStage bug. If in doubt, report it here and it can be
passed on.

## 4. Open an issue

[Issues](https://github.com/Daniel-Parke/PatterStage/issues), with steps to
reproduce or a clear description of what you wanted to do. Screenshots help.

Settings > System has a **Copy for a bug report** button that puts the facts
that usually matter on your clipboard in one go: auth mode, read-only, the data
directory and database path, the Hermes home and gateway, the port, the schema
version, the app version and commit, and your Node version and platform. Paste
that into the issue and most of the back and forth disappears.

Check the [logs](../guides/logs.md) before you write, and quote the actual
error. A run that failed also leaves a [transcript](../concepts/transcript.md)
in [Sessions](../guides/sessions.md), which usually contains the real cause.

## 5. Security, which is different

Do not open a public issue for a suspected vulnerability. Use
[private reporting](../SECURITY.md), which sets out what to include and what to
expect. Redact real keys from anything you paste, anywhere.

## The wider policy

[Support](../SUPPORT.md) is the short policy version of this page, and the
[code of conduct](../CODE_OF_CONDUCT.md) covers how discussion is expected to
go. If you want to fix it yourself, start at
[contributing](../CONTRIBUTING.md).
