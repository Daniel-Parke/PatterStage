# T-0182 independent global-error oracle amendment

You are an R3 ORACLE author under `org/roles/ORACLE.md`. Read
`org/START.md`, `org/tasks/T-0182.json`, accepted ADR-0015 and
ADR-0016. The operator authorised ADR-0016's fail-closed exception on
2026-09-28. You wrote the first CSP oracle, but **not** this global-error
oracle. Its original independent author has finished and is not editing
it. Your only write claim is `tests/e2e/t0182-global-error.spec.ts`,
recorded in committed `org/claims.json`.

Amend only the initial zero-violation assertion in the two viewport
copies of "500 fallback keeps framing denial and emits no unexpected CSP
violations" to recognise the exact known fail-closed pattern. Preserve
all four test names, the 500/heading and no-JavaScript assertions,
framing denial, initial event listener and positive blocked-event-handler
control. Do not suppress browser events or accept arbitrary new ones.
The current Chromium production probe at `/_global-error` found exactly
six `script-src-elem` blocked requests for same-origin `/_next/static/chunks/`
URLs (including a repeated webpack URL), two `script-src-elem` blocked
`inline` events and one `style-src-elem` blocked `inline` event.

Capture before/after hashes and the four-name set. Run the focused
browser suite with owned isolated data. Report exact result. Do not edit
source, policy, fixtures or records, and do not commit. The coordinator
will freeze the amended oracle.
