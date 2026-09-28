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

`src/proxy.ts` checks the shared authentication and read-only boundary before route handlers run. Sign-in and session-management handlers also validate the fresh operator credential they receive; protected streams recheck their caller while they are open. Routes cannot opt out of the proxy check.

PatterStage is a single-operator control plane, so authentication is one shared secret rather than an account system:

- A random token is minted on first boot into **`PS_DATA_DIR/auth-token`** (mode `0600`). The server log prints the file location and sign-in instructions, never the token or a token-bearing URL. On Unix, boot also narrows `PS_DATA_DIR` itself to `0700` and the database to `0600`; on Windows the directory ACL governs.
- **Browser:** enter the operator token on the sign-in page. An intentional `GET ?ps_token=` handoff is retained for compatibility and redirects to a clean URL. Each browser receives a fresh 256-bit `HttpOnly`, `SameSite=Lax` `ps_session` secret. SQLite stores only its hash. Sessions expire after 30 minutes without qualified activity, after 12 hours absolutely, or at a server restart. Settings → System lists and revokes individual sessions after a fresh operator credential; sign-out revokes the current one. The next sign-in prunes rows that have been expired or revoked for at least 30 days; active rows are retained.
- **Scripts / curl:** send `Authorization: Bearer <token>`.
- Wrong operator-token guesses have a short, capped penalty. A caller cannot reset the guess budget by changing `X-Forwarded-For`: once failed guesses claim different addresses, they share a penalty of at most 15 seconds. Repeated bad guesses can delay a fresh sign-in; existing browser sessions can still navigate and sign out. The forwarding header is never proof of a client address.
- Cookie-authenticated writes require the exact configured **`Origin`**; `Sec-Fetch-Site` cannot override a mismatch. Bearer clients remain supported.
- `PS_READ_ONLY=1` rejects application writes. Only the exact authentication lifecycle methods and a qualified interactive navigation may change session state.
- Safe-method requests to `/api/health`, `/api/healthz` and `/healthz` are unauthenticated liveness probes. The API paths return `{"ok":true}`; `/healthz` returns plain-text `ok`. None reports system state. In token mode, unsafe methods remain behind authentication. `PS_READ_ONLY=1` still refuses those writes after authentication.
- **Framing is refused everywhere.** Every response that has a body (pages, API answers, the sign-in refusal, 404s) carries `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`, so no other page can put PatterStage in a frame. (The 307s from the old pre-1.0 URLs do not carry them, which costs nothing: a redirect has no body to frame, and the page it lands on refuses.) This matters because `SameSite=Lax` is decided by site, not by port: a page served on another port of the same host would otherwise be same-site, receive your session cookie inside the frame, and be able to trick clicks on the deploy, script and credential controls. If you want PatterStage on a dashboard, link to it rather than embed it.

> **Treat the token as root on the host.** It grants mission dispatch and agent access, and the agent's toolset includes terminal access.

### Env vars

| Var | Effect |
|-----|--------|
| `PS_AUTH_TOKEN` | Supply the token directly (containers). Wins over the token file. |
| `PS_AUTH_TOKEN_FILE` | Move the token file off the default `PS_DATA_DIR/auth-token`. |
| `PS_PUBLIC_ORIGIN` | Exact browser origin, including scheme and optional port. Required for network startup. HTTPS gives `Secure` cookies. |
| `PS_INSECURE_LAN_HTTP=1` | Explicitly permit direct LAN HTTP with an `http://` public origin. Network observers may capture cookies. |
| `PS_PRIVATE_PROXY_NETWORK=1` | Permit the network listener only on an operator-isolated private network behind a trusted HTTPS proxy. Never publish its HTTP port to browsers. |
| `PS_AUTH_MODE=none` | **Disable authentication entirely.** Only correct when something in front of PatterStage already authenticates. Logged loudly at boot, and the endpoints that reach the host (the script editor, running a script, crontab installs, the deploy actions) refuse with 403 in this mode, from a list in `src/proxy.ts` and again in each route. |

Rotate a file token in place to invalidate current browser sessions and old
Bearer credentials. If the file is lost, delete it and restart to mint a new
one. Every restart also invalidates browser sessions.

If sign-out returns 503, the browser cookie is cleared locally but database
revocation is unconfirmed. After storage recovers, sign in with the operator
token and revoke the old session in Settings → System. Rotate the operator
token if you cannot identify it; rotation invalidates all existing sessions.

### What the 401 page discloses, and to whom

The HTML 401 page offers a password-style sign-in form and names the generic
`PS_DATA_DIR/auth-token` location or the operator's own service secret source.
It does not disclose the resolved home path to a request whose peer cannot be
verified. The local boot log names the resolved file path. The JSON 401 names
no path or credential. Neither response prints the token.

## If you run PatterStage yourself

- **`npm run start` binds `127.0.0.1`.** A same-host HTTPS reverse proxy can
  connect to that loopback listener. Its public URL must match
  `PS_PUBLIC_ORIGIN=https://…`; it must strip and replace forwarding headers.
  `npm run start:network` refuses to launch until `PS_PUBLIC_ORIGIN` and exactly
  one explicit network mode are set. For an isolated private proxy network, set
  `PS_PRIVATE_PROXY_NETWORK=1`, expose only the HTTPS proxy, and restrict the
  app's HTTP listener by container network or firewall. For direct household
  HTTP, set `PS_INSECURE_LAN_HTTP=1` and an `http://` public origin. That is an
  explicit confidentiality exception, not a secure transport.
- Keep the HTTP app port unreachable from browsers in private-proxy mode. A
  browser-supplied `Host` or `X-Forwarded-Proto` cannot establish trust. A
  missing root token or session store fails closed rather than opening access.
- Keep the token out of shell history and shared screenshots; it is equivalent to a shell on the box.
- Set `PS_READ_ONLY=1` on instances that should not mutate config.
- Rotate keys if you think they leaked; check `~/.hermes/logs` and deploy logs for accidental echo.

Thanks for helping keep installs safe.
