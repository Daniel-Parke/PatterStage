# T-0182 independent built-error pattern amendment

You are a separate R3 ORACLE author under `org/roles/ORACLE.md`. Read
`org/START.md`, `org/tasks/T-0182.json`, accepted ADR-0015 and ADR-0016.
You did not write or amend `tests/e2e/t0182-global-error.spec.ts` before.
The operator accepted both measured fail-closed patterns on 2026-09-28
and chose to retain the default Turbopack production build. Your exclusive
write claim is that one test file in committed `org/claims.json`.

Preserve all four test names, status, heading, no-JavaScript fallback,
framing, event listener and positive blocked-event-handler control. Extend
the initial CSP-event assertion to admit **only** two exact patterns:

- Webpack: six blocked same-origin `/_next/static/chunks/` script requests,
  five unique, with one duplicated webpack runtime URL; two blocked inline
  scripts and one blocked inline style (nine events).
- Turbopack: seven blocked same-origin chunk requests, six unique, with one
  duplicated runtime URL; two blocked inline scripts and one blocked inline
  style (ten events).

Reject any extra or changed event, and do not suppress the event listener.
Avoid loose `6 or 7` counts without proving the repeated runtime and unique
counts. Run the focused suite against the current Turbopack production build
with owned isolated data. Webpack already passed 4/4 on the original exact
pattern; if you cannot run both builds without shared changes, report the
second run as unobserved. Capture before/after hashes and identical names.
Do not edit source, policy, other tests, fixtures or records, and do not
commit. The coordinator will freeze the amendment.
