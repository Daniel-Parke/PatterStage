# T-0182 supplementary global-error oracle

You are a separate R3 ORACLE author under `org/roles/ORACLE.md`. Read
`org/START.md`, `org/tasks/T-0182.json`, accepted
`org/decisions/ADR-0015-content-security-policy.md` and this brief. Do not
read source implementation, including the uncommitted CSP proxy change. Your
only write claim is `tests/e2e/t0182-global-error.spec.ts`, recorded in the
committed `org/claims.json`. The coordinator will make no other writes while
you author it.

The current built app answers `GET /_global-error` with HTTP 500. It is the
framework's static fallback and has un-nonced script and style tags. An
isolated Chromium probe observed CSP violations for these tags under the
accepted nonce policy. Author one or more behavioural Playwright acceptance
cases at desktop 1440×900 and phone 390×844. Request that built error page,
assert the meaningful error heading and 500 status, retain framing denial,
and observe zero unexpected CSP violations. Use a browser violation event or
console probe that actually catches the known red response. Do not turn a
missing event listener into a green result. The page must retain useful
fallback content even if framework hydration is unavailable.

Use the existing Playwright isolated data/server fixture. Do not touch operator
data or create application routes. Run the focused test on the unchanged built
error response, report exact red counts, file hash and stable test names. If
the fixture cannot express the behaviour, report the gap rather than a passing
skip. Do not modify source, shared fixtures, the first frozen oracle, task
records or baselines. Do not commit; coordinator freezes the red-first case.
