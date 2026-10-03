# T-0182 Missions selector oracle amendment

You are an independent R3 ORACLE author under `org/roles/ORACLE.md`.
Read `org/START.md`, `org/tasks/T-0182.json`, accepted ADR-0015 and this
brief. The operator authorised this exact amendment on 2026-09-28. You did
not implement the CSP or write the original oracle. Your only write claim
is `tests/e2e/t0182-csp.spec.ts`, recorded in committed `org/claims.json`.

The current oracle uses a broad New Mission button locator. On an empty
board, the header and empty state both correctly offer that action. The
selector fails in strict mode after hydration. Narrow the locator in the
helper and journey click to the existing header action. Preserve the
header's enabled/hydration wait, the click, the dialog assertion, all
12 test names and every other assertion. Do not remove or weaken a case.
Do not edit source, fixtures, configuration, records or the global-error
oracle.

Capture before/after SHA-256 and the test-name set. Run the focused
browser suite on the current production build with owned isolated data.
Report the exact exit code and any remaining failures. Do not commit.
