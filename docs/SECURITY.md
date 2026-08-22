---
summary: How to report a vulnerability in PatterStage privately, and what to include
type: policy
tags: [security]
compiled_from: normalised
---

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

## The access model

Every request is checked in **one place**, `src/proxy.ts`, before any route handler runs. There is no per-route opt-in to forget.

PatterStage is a single-operator control plane, so authentication is one shared secret rather than an account system:

- A random token is minted on first boot into **`PS_DATA_DIR/auth-token`** (mode `0600`) and the full sign-in URL is printed to the server log at every start.
- **Browser:** open `http://127.0.0.1:<PORT>/?ps_token=<token>` once. The proxy exchanges it for an httpOnly `ps_session` cookie and redirects to strip the token from the URL and history.
- **Scripts / curl:** send `Authorization: Bearer <token>`.
- Cookie-authenticated writes must be **same-origin** (`Sec-Fetch-Site` / `Origin`), so a page you visit in another tab cannot drive your control plane.
- `PS_READ_ONLY=1` rejects unsafe **methods** — reads keep working.
- `/api/health` is the only unauthenticated route. It returns `{"ok":true}` and nothing about your system; the deploy runner and container health checks use it.

> **Treat the token as root on the host.** It grants mission dispatch and agent access, and the agent's toolset includes terminal access.

### Env vars

| Var | Effect |
|-----|--------|
| `PS_AUTH_TOKEN` | Supply the token directly (containers). Wins over the token file. |
| `PS_AUTH_TOKEN_FILE` | Move the token file off the default `PS_DATA_DIR/auth-token`. |
| `PS_AUTH_MODE=none` | **Disable authentication entirely.** Only correct when something in front of PatterStage already authenticates. Logged loudly at boot, and endpoints that write host-executed content (the script editor, crontab installs) refuse to run in this mode. |

Rotate by deleting the token file and restarting; the new token is picked up without a rebuild.

## If you run PatterStage yourself

- Prefer binding to loopback and reaching it over SSH port-forwarding. `npm run start:network` binds `0.0.0.0` — only do that on a network you trust.
- Keep the token out of shell history and shared screenshots; it is equivalent to a shell on the box.
- Set `PS_READ_ONLY=1` on instances that should not mutate config.
- Rotate keys if you think they leaked; check `~/.hermes/logs` and deploy logs for accidental echo.

Thanks for helping keep installs safe.
