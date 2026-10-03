---
summary: Independent red-first prompt, malformed-model and old-link oracle for T-0185
type: brief
tags: [missions, oracle, prerelease]
---

# T-0185 independent oracle

The approved plan names M6, M7 and M8. Own only
`tests/unit/mission-prompt-cdata-boundary.test.ts`,
`tests/unit/mission-model-input-boundary.test.ts` and
`tests/e2e/mission-old-link-boundary.spec.ts`. Do not edit source, existing
tests, baselines, task records, protected files or fixtures outside these
three files. Wait for the coordinator's claim go-ahead before writing.

1. Build and parse a stored mission prompt whose additional context contains
   a literal `<task><![CDATA[...]]></task>` before the real task. The real
   instruction, context, output and constraints must round-trip. Include an
   ordinary nested `<task>example</task>` control and a CDATA break sequence.
   Prefer a metamorphic sample over a source-text assertion.
2. Exercise the real mission action/HTTP boundary with `modelId: 42`. It must
   return a 4xx validation response, leave mission rows unchanged, and preserve
   the existing valid/absent model behaviour. Cover dispatch and any other
   action that accepts the shared mission body if the public route permits it.
   Use an isolated database. Never dispatch to an external gateway.
3. In an isolated browser fixture with at least 201 missions, open the oldest
   by its published `/work/missions?mission=<id>` URL at 1440x900 and 390x844.
   Its panel must open; a genuinely absent ID still gives the existing missing
   feedback. Use the project-owned fixture and listener patterns. Do not run
   the test against operator data.

Read `org/START.md`, the T-0185 record and `org/roles/ORACLE.md`. Freeze the
test-name set and SHA-256 values. Run focused tests against unchanged source
and report assertion-level red outcomes. If a proposed test cannot run without
changing a source or shared fixture, report the exact blocker instead of
altering the claim. No commit; the coordinator will freeze the oracle first.
