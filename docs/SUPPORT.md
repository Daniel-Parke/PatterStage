---
title: Support
summary: Where to get help, and which questions belong to Hermes rather than to this repository
section: start-here
nav: 60
audience: operator
type: policy
tags: [community]
compiled_from: normalised
---
# Support

Need help? Here is how to get unstuck without shouting into the void.

## Hermes Agent vs this repo

- **[Hermes Agent](https://github.com/NousResearch/hermes-agent)** is the upstream runtime (gateways, tools, agent loop).
- **This repo** is **PatterStage**, the dashboard and APIs I ship on top of your local Hermes install.

If the agent itself misbehaves on Discord or in a CLI session, Hermes docs and channels are usually the right place. If the PatterStage UI, REST routes, `PS_DATA_DIR`, or this repo's CI is wrong, you are in the right place.

## Getting help with PatterStage

1. **Docs first:** [documentation index](README.md), then [USER_WALKTHROUGH_GUIDE.md](README.md), [RUNTIME_ARCHITECTURE.md](reference/runtime-architecture.md), and [DEPLOY.md](running/deploy.md).
2. **Bug or feature:** [open an issue](https://github.com/Daniel-Parke/PatterStage/issues) with steps to reproduce or a clear use case. Screenshots help.
3. **You want to contribute:** [CONTRIBUTING.md](CONTRIBUTING.md) and [TESTING.md](contributing/testing.md).

I maintain this in my spare cycles; the more specific your report, the faster I can fix it.

## Security

Do **not** open public issues for suspected vulnerabilities. See [SECURITY.md](SECURITY.md).

## Code of conduct

Participation follows [How this repo works (people-wise)](CODE_OF_CONDUCT.md). Short version: ideas and results matter; do not be a menace please.
