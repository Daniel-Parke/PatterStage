---
title: Security
summary: How to report a vulnerability in PatterStage privately, and what to include
section: running
nav: 90
audience: operator
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
3. **Otherwise:** contact me privately on the email or DM you already use for confidential stuff (see [.github/CODEOWNERS](../.github/CODEOWNERS)).

Include whatever helps me reproduce fast:

- What you think is wrong (RCE, auth bypass, path traversal, secret leak, etc.)
- Steps to reproduce (commands, routes, config snippets, with **real keys redacted**)
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

- Issues in **Hermes Agent upstream**, which go to [Nous Research / Hermes](https://github.com/NousResearch/hermes-agent) unless PatterStage is clearly wrapping the bug wrong
- Social engineering, physical access, or "you left SSH open on the internet" (still bad, but not something I patch in this repo)
- Theoretical issues with no practical exploit path. Send anyway if you are unsure; I will triage

## The access model

Every request is checked in **one place**, `src/proxy.ts`, before any route handler runs. There is no per-route opt-in to forget.

PatterStage is a single-operator control plane, so authentication is one shared secret rather than an account system:

- A random token is minted on first boot into **`PS_DATA_DIR/auth-token`** (mode `0600`) and the full sign-in URL is printed to the server log at every start.
- **Browser:** open `http://127.0.0.1:<PORT>/?ps_token=<token>` once. The proxy exchanges it for an httpOnly `ps_session` cookie and redirects to strip the token from the URL and history.
- **Scripts / curl:** send `Authorization: Bearer <token>`.
- Cookie-authenticated writes must be **same-origin** (`Sec-Fetch-Site` / `Origin`), so a page you visit in another tab cannot drive your control plane.
- `PS_READ_ONLY=1` rejects unsafe **methods**. Reads keep working.
- `/api/health` is the only unauthenticated route. It returns `{"ok":true}` and nothing about your system; the deploy runner and container health checks use it.

> **Treat the token as root on the host.** It grants mission dispatch and agent access, and the agent's toolset includes terminal access.

### Env vars

| Var | Effect |
|-----|--------|
| `PS_AUTH_TOKEN` | Supply the token directly (containers). Wins over the token file. |
| `PS_AUTH_TOKEN_FILE` | Move the token file off the default `PS_DATA_DIR/auth-token`. |
| `PS_AUTH_MODE=none` | **Disable authentication entirely.** Only correct when something in front of PatterStage already authenticates. Logged loudly at boot, and the endpoints that reach the host (the script editor, running a script, crontab installs, the deploy actions) refuse with 403 in this mode, from a list in `src/proxy.ts` and again in each route. |

Rotate by deleting the token file and restarting; the new token is picked up without a rebuild.

### What the 401 page discloses, and to whom

When a request arrives without a valid token, PatterStage answers with an
instruction page rather than a bare refusal, because for most people that page
is the first screen they ever see. What it says depends on where the request
came from, and that is deliberate.

- **Over loopback** (`localhost`, `127.0.0.1`, `::1`, `*.localhost`) it names
  the resolved absolute path of the token file. Someone sitting at the machine
  needs the real path; telling them `PS_DATA_DIR/auth-token` is telling them a
  variable name they cannot expand.
- **From anywhere else** it says the token is in `auth-token` inside the data
  directory, and stops there. An absolute home-directory path discloses the OS
  username and the install layout, and under `npm run start:network` the server
  binds `0.0.0.0`, so that reaches whoever can route to the port.
- **The JSON 401**, served to API callers, names no path at all in either case.
  A script cannot act on a filesystem hint.

Neither page ever prints the token itself, and none of this changes what is
required to authenticate: the token check is identical for every caller.
Getting the loopback signal wrong can only produce a less specific error
message; it can never grant access.

Decided 2026-08-23 after review flagged that an earlier version returned the
resolved path to unauthenticated remote callers. Pinned by
`tests/unit/proxy-auth.test.ts`.

## If you run PatterStage yourself

- **Both start scripts bind every interface.** `next start` has no `-H` default of
  loopback: with no flag it listens on `0.0.0.0` and `::`, and Next prints the LAN
  URL to prove it. `npm run start` and `npm run start:network` therefore expose the
  port identically. To bind loopback you must pass it yourself:
  `npx next start -H 127.0.0.1`. Reaching that over SSH port-forwarding is the
  safest posture on an untrusted network.
- The access token is what actually protects the port, not the bind address. Every
  request is refused without it (`src/proxy.ts`), and a missing token file fails
  closed with a 503 rather than opening up.
- Keep the token out of shell history and shared screenshots; it is equivalent to a shell on the box.
- Set `PS_READ_ONLY=1` on instances that should not mutate config.
- Rotate keys if you think they leaked; check `~/.hermes/logs` and deploy logs for accidental echo.

Thanks for helping keep installs safe.
