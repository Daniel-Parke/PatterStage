# T-0158 route-wrapper test amendments

The independent held-response oracle exposed a missing revocation check. The
repair wraps 19 protected direct API route files without changing URLs, methods,
read-only decisions or response bodies. Two existing suites now fail because
their direct-call/source-shape expectations predate the wrapper:

- `tests/unit/k5-the-ruled-security-fixes.test.ts` assumes host-side guards
  live in `export async function METHOD`. The wrapped file instead has
  `async function METHODImpl` with the same `isReadOnly` check and
  `export const METHOD = guardRoute(METHODImpl)`. Amend its source inspection
  to require both the preserved guard and the protected export mapping.
  Preserve its full test-name set and the exact six host-side guards and three
  documented skips. Old SHA-256:
  `2346E48B558356DCA27B6D2740CD91251A1C250A7CC56D9DA373AFC236821D0F`.
- `tests/unit/feature-flags-route.test.ts` calls the former synchronous GET
  without awaiting it. Next accepts an async handler; update only the direct
  invocation to await the response. Preserve both names, flag values and
  response assertions. Old SHA-256:
  `A4F0D50ACC0DA08934C76321B7C6BA050EDD4E6467309249D8EE172911FE7B4F`.

A different author from the original closed oracle owns only these two test
files. Prove identical test-name sets before and after, focused tests green,
test TypeScript and targeted ESLint exit zero. Do not edit the route source or
weaken a guard count. Record old/new hashes for the T-0158 task amendment log.

## Separate held-oracle fixture fold

The two independent held-response suites now overlap on 149 counted six-line
windows (78 and 71 lines by `node scripts/tooling/line-census.mjs --report`).
Before holding the census baseline, a different author from their original
author must extract their real SQLite/session setup into
`tests/helpers/t0158-held-session.ts`. Keep both route-specific held provider
methods in their own suites, all seven full test names, the valid-cookie and
Bearer controls, and the revocation assertions. The helper must not mock away
the session repository or response guard. Compare test-name sets and hashes,
run both focused suites, TypeScript and ESLint, then verify repeated test
windows fall to the prior baseline or lower. No source edits.

## Mixed route-method oracle

Some API files export one method through `route()` but export another method
directly. For example, `src/app/api/templates/route.ts` wraps POST but its GET
awaits `handleListTemplates()` without a completion check. An independent
oracle author owns `tests/unit/t0158-mixed-held-response.test.ts` only. Hold a
real protected templates GET, revoke its real SQLite-backed browser session,
then release the handler. Require a denial with no protected marker. Include a
valid-cookie and Bearer control. Run it against the unmodified route and commit
the intended red result before the coordinator changes source. Preserve the
shared held-session helper and all existing oracle files unchanged.
