# Security

Found something that could let an attacker run code, steal keys, or trash someone's install? **Tell me privately first.**, pretty please! 

It would be very much appreciated if you allowed me time to apply a fix, before raising a public issue for any critical exploits or vulnerabilites.

## How to report

1. **Do not** open a public GitHub issue with exploit details.
2. **Preferred:** [GitHub private vulnerability reporting](https://github.com/Daniel-Parke/PatterStage/security/advisories/new) (if enabled on the repo: **Settings → Security → Private vulnerability reporting**).
3. **Otherwise:** contact me privately (see [.github/CODEOWNERS](../.github/CODEOWNERS))—email or DM you already use for confidential stuff.

Include whatever helps me reproduce fast:

- What you think is wrong (RCE, auth bypass, path traversal, secret leak, etc.)
- Steps to reproduce (commands, routes, config snippets—**redact real keys**)
- What you think the impact is
- Your environment (OS, Node version, how PatterStage is exposed) if it matters

## What happens next

| Step | Target |
|------|--------|
| I acknowledge your report | Within **72 hours** |
| I confirm scope and severity | Within **7 days** |
| Fix or mitigation | As soon as I have a verified patch |

I aim for **coordinated disclosure**: fix first, then a short public note (changelog/advisory) describing impact and remediation without a step-by-step exploit recipe.

## In scope (examples)

- PatterStage API routes, auth/deploy gates, cron/update hooks, path validation on disk writes
- Accidental secrets in repo, docs, logs, or default configs
- Docker/deploy scripts that expose the app unsafely by default

## Out of scope (usually)

- Issues in **Hermes Agent upstream** — report those to [Nous Research / Hermes](https://github.com/NousResearch/hermes-agent) unless PatterStage is clearly wrapping the bug wrong
- Social engineering, physical access, or "you left SSH open on the internet" — still bad, but not something I patch in this repo
- Theoretical issues with no practical exploit path—send anyway if you are unsure; I will triage

## If you run PatterStage yourself

- Bind to trusted networks or put a reverse proxy with auth in front.
- Set `CH_READ_ONLY=1` on instances that should not mutate config.
- Rotate keys if you think they leaked; check `~/.hermes/logs` and deploy logs for accidental echo.

Thanks for helping keep installs safe.
