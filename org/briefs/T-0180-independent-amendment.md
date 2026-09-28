---
summary: Independent amendment brief for the T-0180 hosted secret-scan workflow
type: brief
tags: [oracle, security]
---

# T-0180 independent workflow oracle amendment

The coordinator owns `.github/workflows/gitleaks.yml` and the existing frozen
`tests/unit/t0180-secret-scan-config.test.ts`. The independent author owns
only `tests/unit/t0180-workflow-order-amendment.test.ts`. Do not edit any other
file or alter the original three test names. Add a narrow behavioural or
structural oracle that fails on the current workflow for the independently
reviewed issues: a PR-controlled canary runs before both real scans, and
`--log-opts=--all` replaces the scanner's full-history default selection.
Require the hosted scanner to precede the canary, default full-history options,
read-only checkout credentials and minimal token permissions. Run the new suite
red and report the failing test names, exact exit and changed path. The
coordinator will commit the red amendment, implement, run the gate and record
the separate author in T-0180.
