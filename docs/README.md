---
title: Documentation
summary: "The reading path: what PatterStage is, the first hour, one guide per screen, and where the governing corpus lives"
section: start-here
nav: 0
type: index
tags: [product, docs]
compiled_from: normalised
---

# Documentation

Six tiers, in reading order. Start at the top and stop when you have what you
came for.

## Start here

New to PatterStage. What it is, how to install it, and one hour that takes you
from a fresh boot to a mission you dispatched, watched and read the output of.

- [What PatterStage is](start-here/index.md)
- [Installing](start-here/install.md)
- [The first hour](start-here/first-hour.md)
- [Quests](start-here/quests.md)
- [Getting help](start-here/getting-help.md)
- [Support](SUPPORT.md)

## Concepts

The nouns you meet on the screens, one page each: what it is, what it is not,
where you meet it, and the idea behind it. Written for someone who has never
run an agent before.

Start with [agent](concepts/agent.md), [mission](concepts/mission.md) and
[run](concepts/run.md); the rest are there when a screen uses a word you have
not met.

## Guides

One page per screen: what you see, what you typically do there, and the notes
that only matter once. The in-app Help section renders these same pages, and
every screen's header carries a link straight to its own.

## Running it

Keeping it up: [deploying](running/deploy.md),
[configuration](running/env-reference.md),
[where your data lives](running/data-storage.md),
[backup and restore](running/backup.md),
[upgrades](running/migration.md),
[host scheduling](running/host-scheduling.md),
[platforms](running/cross-platform.md),
[troubleshooting](running/troubleshooting.md) and [security](SECURITY.md).

## Reference

The facts, not the path: the [HTTP API](reference/api.md), the
[database schema](reference/schema.md), [spend](reference/spend.md),
[profiles and the skills catalogue](reference/catalog-and-profiles.md), and the
[runtime architecture](reference/runtime-architecture.md).

## Contributing

Working on PatterStage itself: [contributing](CONTRIBUTING.md), the
[repository guide](contributing/repo-guide.md),
[testing](contributing/testing.md), the
[output canary](contributing/output-canary.md),
[design tokens](contributing/design-tokens.md), the
[copy law](contributing/copy.md), and [decisions](adr/README.md).

## The governing corpus

PatterStage is built under a governance system with its own vocabulary: tasks,
rulings, tiers, a lock-book. None of it is needed to run the product, and it is
not written for someone who wants to. It lives under `../org/`, starting at
`org/START.md`, with its operator manual at `org/EOS_OPERATORS_GUIDE.md`;
[`../AGENTS.md`](../AGENTS.md) is the entry point an AI coding session reads.

`AGENTS.md` and `CLAUDE.md` are instructions for AI coding sessions working on
this repository. They are not documentation for you.

## How this documentation is built

`docs/**/*.md` is the single source. Every page opens with a front-matter block
naming its title, its summary, its tier and its position; a page that documents
a screen names that screen, and the build turns that into the in-app link.
[`docs/manifest.json`](manifest.json) is derived from those blocks and is never
hand-edited. `npm run docs:build` renders the static site, `npm run docs:check`
refuses a screen with no guide, a link to a route that does not exist, a missing
screenshot, an undefined concept and a stale generated block.
