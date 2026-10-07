---
summary: T-0192 exact error sentence mapping, finite source evidence and explicit limits
type: review
tags: [refactor, evidence]
---

# T-0192 exact error sentence mapping

Independent source review recorded on 2026-10-04. This report is evidence, not programme acceptance.

**gap-061.1 now has a bounded sentence-to-assertion map. Exact wording is pinned for some contracts, but not all retained 400 responses. app-19 still has concrete surviving comment defects.** No writes or test execution.

“Uncovered” below means **no exact route-level assertion located in the inspected unit/e2e sources**, not proof that no other protection exists. Status-only checks, substring checks, helper tests and mocked responses are distinguished.

### Exact assertions located

| Producer and exact error | Existing test name and assertion |
|---|---|
| [parse-json-body.ts:22](../../src/lib/api/parse-json-body.ts#L22): `Invalid JSON` | [api-route-public-contract.test.ts:90](../../tests/unit/api-route-public-contract.test.ts#L90), **“preserves the generic parser's exact invalid JSON error”**. Status and full `{ error }` equality at 94–95. **Helper-level**, not every consuming route. |
| [api-schemas.ts:149](../../src/lib/api/api-schemas.ts#L149): `Invalid request body`; consumed by [credential PATCH:74](../../src/app/api/credentials/[id]/route.ts#L74) | [b6-credentials-rotate-route.test.ts:196](../../tests/unit/b6-credentials-rotate-route.test.ts#L196), **“refuses an empty key”**. Exact error at 200. Does not pin every Zod `details` payload or every schema consumer. |
| [prefs/route.ts:19](../../src/app/api/prefs/route.ts#L19): `Body must be { key, value } with a key from the allow-list.` | [api-route-public-contract.test.ts:205](../../tests/unit/api-route-public-contract.test.ts#L205), **“preserves the preference-specific error for body %s”**, bodies `{`, `null`, `false`, `[]`, `{}`; exact equality at 208. |
| [Composer approval:77](../../src/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route.ts#L77): `action must be "accept" or "reject" (got <JSON value>). To approve a gate, send "accept".` | [api-route-public-contract.test.ts:259](../../tests/unit/api-route-public-contract.test.ts#L259), **“preserves Composer's bespoke approval error for %s”**. Pins malformed JSON, `"approve"` and absent action/null wording; equality at 269 and no lookup/approval mutation. |
| [fs/list/route.ts:27](../../src/app/api/fs/list/route.ts#L27): `Not a directory` | [fs-list-api.test.ts:94](../../tests/unit/fs-list-api.test.ts#L94), **“returns 400 when the resolved path is not a directory”**; exact error at 108. |
| [schedules/route.ts:49](../../src/app/api/schedules/route.ts#L49): `missionId is required for a mission schedule` | [b13-scheduler-runs-scripts.test.ts:275](../../tests/unit/b13-scheduler-runs-scripts.test.ts#L275), **“refuses a mission schedule with no mission”**; equality 278, no create. Also [HTTP suite:50](../../tests/e2e/schedule-validation-contract.spec.ts#L50), **“missing targets and missing rows retain precedence over an invalid expression”**, equality 54. |
| [schedules/route.ts:52](../../src/app/api/schedules/route.ts#L52): `scriptName is required for a script schedule` | [b13-scheduler-runs-scripts.test.ts:268](../../tests/unit/b13-scheduler-runs-scripts.test.ts#L268), **“refuses a script schedule with no script to run”**; equality 271, no create. |
| [sessions/[id]/route.ts:46](../../src/app/api/sessions/[id]/route.ts#L46): `Invalid session ID` | [route-local-catch-contract.test.ts:139](../../tests/unit/route-local-catch-contract.test.ts#L139), **“invalid Session id is refused before state or file reads”**; equality 141, no repository/file read or error log. |

**Schedule sentences are pinned through actual POST/PATCH responses.** The producer is [schedule-problem.ts:12](../../src/lib/schedule/schedule-problem.ts#L12), delegating interval wording to [interval-bounds.ts:68](../../src/lib/schedule/interval-bounds.ts#L68). Consumers are [POST:55](../../src/app/api/schedules/route.ts#L55) and [PATCH:46](../../src/app/api/schedules/[id]/route.ts#L46).

| Input | Exact expected sentence |
|---|---|
| `whenever` | `Unrecognized schedule: whenever` |
| `0 0 30 2 *` | `Schedule "0 0 30 2 *" can never fire: it names a date that does not exist, or a field outside its range. Check the day-of-month against the month.` |
| `every 0m` | `Schedule "every 0m" repeats too often. The shortest gap between runs is 1 minute, because each run starts real work that has to finish. Try "every 5m".` |
| `every 367d` | `Schedule "every 367d" repeats too rarely. The longest gap between runs is 366 days. Use a smaller number, or a cron schedule such as "0 9 1 1 *" to run once a year.` |

[The HTTP suite:10](../../tests/e2e/schedule-validation-contract.spec.ts#L10) contains these literals. Its eight identities expand **`${method} refuses ${schedule} with exact text and unchanged persisted rows`** at line 20; status/equality/persistence assertions are at 26–28. The same maximum-interval sentence is used by the existing **`${action} above-maximum interval preserves mission, schedule and run rows`** cases at 62–72. Those mission cases are complementary evidence outside the 69-route roster.

### Partial assertions: do not describe these as exact sentence pins

| Producer | Existing test and actual limit |
|---|---|
| [Profiles POST:150](../../src/app/api/agent/profiles/route.ts#L150): `Name is required (min 2 characters)` | [profiles-api.test.ts:354](../../tests/unit/profiles-api.test.ts#L354), **“rejects missing name”** checks `toContain("Name is required")`; **“rejects name shorter than 2 chars”** checks status only. |
| [Profile pull:89](../../src/app/api/agent/profiles/sync/pull/route.ts#L89): `slug, all, root, or skills required` | [profiles-sync-api.test.ts:64](../../tests/unit/profiles-sync-api.test.ts#L64), **“POST pull requires slug”**, status only. The complete sentence is explicitly published in [API reference:42](../../docs/reference/api.md#L42). |
| [Config PUT:91](../../src/app/api/config/route.ts#L91): `Invalid values for '<section>': <joined problems>` | [b6-config-values-and-unset.test.ts:256](../../tests/unit/b6-config-values-and-unset.test.ts#L256), **“max_turns 9999 is a 400 naming the bounds, and nothing is written”** checks prefix and included bounds. **“lists every problem, joined by '; '”** at 319 checks fragments/separator, not complete equality. |
| [Credential POST:38](../../src/app/api/credentials/route.ts#L38): `<provider> authenticates with OAuth (hermes model); it has no API key to store` | [b6-keyless-providers.test.tsx:416](../../tests/unit/b6-keyless-providers.test.tsx#L416), **“nous is refused up front, naming OAuth, and no row is created or rolled back”** checks `/nous/` and `/OAuth/`. |
| [Composer workflow:33](../../src/app/api/composer/workflows/[id]/route.ts#L33): `Cannot change a workflow with active runs — let them finish or cancel them first.` | [b12-workflow-delete-route.test.ts:158](../../tests/unit/b12-workflow-delete-route.test.ts#L158), **“GREEN CONTROL: active runs are refused with 400 BEFORE the count is offered”** checks `active runs` substring. |
| [Composer cancellation:35](../../src/app/api/composer/runs/[id]/cancel/route.ts#L35), completed/rejected explanations | [composer-cancel-is-a-decision.test.ts:297](../../tests/unit/composer-cancel-is-a-decision.test.ts#L297), **“refuses a run that already completed, and says so”**; at 307, **“refuses a rejected run, and repeats the reason it ended”**. Status plus keywords/stored-reason fragments. |
| [Composer approval state errors:43](../../src/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route.ts#L43) | [composer-reject-is-not-a-cliff.test.ts:242](../../tests/unit/composer-reject-is-not-a-cliff.test.ts#L242): **“names the rejection and repeats the reason, instead of 'not awaiting approval'”**, **“reads differently for a run that completed”**, **“still refuses a run that never reached its gate, and says which state it is in”**. Semantic fragments, not exact sentences. |
| [Git branches:15](../../src/app/api/fs/git/branches/route.ts#L15): `path is required` | [fs-git-branches-api.test.ts:32](../../tests/unit/fs-git-branches-api.test.ts#L32), **“requires path query param”**, status only. |
| [Prefs validator:43](../../src/lib/system/operator-prefs-repository.ts#L43): unknown-key/wrong-shape messages | [b3-operator-prefs.test.ts:97](../../tests/unit/b3-operator-prefs.test.ts#L97), **“PUT refuses an unknown key and a wrong shape with 400, naming the key”**. Key regex and statuses, not complete wording. |
| [Log errors:232](../../src/lib/fs/log-files.ts#L232): `Invalid log name` / `Invalid log path`, consumed at [logs:84](../../src/app/api/logs/route.ts#L84) and 141 | [log-files.test.ts:37](../../tests/unit/log-files.test.ts#L37), **“maps 'invalid-name' to 'Invalid log name'”** and **“maps 'invalid-path' to 'Invalid log path'”**, pin helper strings. [logs-api-route.test.ts:117](../../tests/unit/logs-api-route.test.ts#L117), **“returns 400 for invalid name query characters”**, pins route status only. |

Malformed JSON route tests for Sessions, Config, Credentials and Skills commonly use `/invalid json/i`. They prove the refusal class but permit spelling/capitalisation changes. Examples: [Sessions:56](../../tests/unit/api-json-400-regressions.test.ts#L56), [Config:115](../../tests/unit/config-values-validation.test.ts#L115), [Skills PUT:103](../../tests/unit/skills-put-route.test.ts#L103).

### Exact route-level wording not located

| Producer | Unpinned sentence or branch |
|---|---|
| [Profile item:29](../../src/app/api/agent/profiles/[id]/route.ts#L29), 111 | `Cannot modify the default profile slug`; `Cannot delete the default profile`. |
| [Profile import:51](../../src/app/api/agent/profiles/sync/import/route.ts#L51); [push:80](../../src/app/api/agent/profiles/sync/push/route.ts#L80) | `Valid slug is required`; `slug, all, root, skills, or skillKey required`. |
| [Root metadata:39](../../src/app/api/agent/root/route.ts#L39), 42, 49, 52, 58 | `Give the agent a name — an empty one leaves it unnamed everywhere it is shown.`; `Keep the name to 60 characters or fewer.`; `The description must be text.`; `Keep the description to 400 characters or fewer.`; `Send a name or a description to change.` Existing blank/empty-patch tests check status. |
| [Chat approval:30](../../src/app/api/chat/[id]/approval/route.ts#L30), 31 | `runId is required`; `approved (boolean) is required`. |
| [Chat message:28](../../src/app/api/chat/[id]/messages/route.ts#L28); [message PATCH:42](../../src/app/api/chat/[id]/messages/[messageId]/route.ts#L42) | `content (non-empty string) is required`; `status must be one of: streaming, complete, failed, cancelled`. |
| [Composer launch:55](../../src/app/api/composer/runs/route.ts#L55); [clarification:36](../../src/app/api/composer/runs/[id]/clarify/route.ts#L36) | `Unknown workflow`; `Run is not awaiting clarification`. Approval’s joined Zod issue sentence at line 83 also lacks a located exact route assertion. |
| [Research preset DELETE:46](../../src/app/api/laboratory/research/presets/route.ts#L46) | `id is required`. Matching text in mission-category tests does not cover this route. |
| [Memory config:61](../../src/app/api/memory/config/route.ts#L61) | `Unknown provider`. A repository/helper test using similar text is not this route’s assertion. |
| [Fast chat:131](../../src/app/api/orchestration/chat/route.ts#L131) | `messages array is required`. |
| [Schedule run:19](../../src/app/api/schedules/[id]/run/route.ts#L19) | `Schedule has no linked mission`. |
| [Script logs:15](../../src/app/api/scripts/logs/route.ts#L15) | `name is required`. Matching mission-category wording is unrelated coverage. |
| [Sessions POST:114](../../src/app/api/sessions/route.ts#L114), 132, 146 | `source is required`; `id is required`; `Unknown action`. |
| [Skills PUT:42](../../src/app/api/skills/[name]/route.ts#L42); [toggle:39](../../src/app/api/skills/[name]/toggle/route.ts#L39) | `Content is required`; `enabled (boolean) is required`. |
| [Auth body reader:29](../../src/lib/auth/request-auth.ts#L29), 44; [session revoke:13](../../src/app/api/auth/sessions/revoke/route.ts#L13) | `Could not read sign-in body.`; `Invalid JSON body.`; `A session identifier is required.` |

Delegated profile/path refusals also remain **helper/source evidence rather than located exact route assertions**:

- [profile-slug.ts:54](../../src/lib/agents/profile-slug.ts#L54): minimum name, path separator, leading dot, control characters, missing letter/digit and Windows reserved-device wording.
- [path-security.ts:39](../../src/lib/fs/path-security.ts#L39): `Path is required`, Windows-style-path refusal, `Invalid path`, allowed-root sentence; lines 77 and 131: `Invalid profile name`, `Invalid skill path`.
- Mock definitions returning these strings and UI fixtures displaying them were **not counted** as route assertions.

### Retained parser exceptions

- [Optional parser:27](../../src/lib/api/parse-optional-json-body.ts#L27) intentionally returns `{}` for missing/malformed/non-object bodies. [Its tests](../../tests/unit/parse-optional-json-body.test.ts#L38) pin malformed, empty, null, array, string and number handling. A subsequent route-specific missing-flag 400 is a different contract.
- [Backfill:41](../../src/app/api/admin/sessions/backfill-status/route.ts#L41) intentionally defaults malformed/empty input to dry-run. [Public-contract tests:211](../../tests/unit/api-route-public-contract.test.ts#L211) preserve that and the direct-handler JSON-null rejection. **Do not turn this into generic `Invalid JSON` 400.**
- Update lies outside the 69-path roster but remains an explicitly retained parser exception. [Public-contract tests:236](../../tests/unit/api-route-public-contract.test.ts#L236) preserve malformed-body default dispatch and guard-before-parsing order. They do not establish a new 400 contract.

### app-19: surviving scoped comment findings

The historical app-19 route list was checked separately from the 69-route error roster.

| Source | Verified disposition |
|---|---|
| [Backfill:43](../../src/app/api/admin/sessions/backfill-status/route.ts#L43) | **Fixed:** comment now says `dryRun=true`, matching line 45. |
| [Backfill:22](../../src/app/api/admin/sessions/backfill-status/route.ts#L22) | **Still wrong:** says the inner read-only guard is “Kept as defence-in-depth”; no such inner guard remains. Response settlement guarding is not that guard. |
| [Backfill:15](../../src/app/api/admin/sessions/backfill-status/route.ts#L15) | **Unsupported retained narration:** “admin UI immediately” conflicts with the explicitly retained no-UI-caller disposition. Line 17 also retains the historical “every other admin route” comparison. |
| [Gateway health:2](../../src/app/api/gateway/health/route.ts#L2) | **Still stale:** “Proxied through CH”. |
| [Memory:52](../../src/app/api/memory/route.ts#L52) | **Historical ambiguity survives:** `/* unreachable — fall through ... */` sits in the catch around provider resolution/stats. Describe provider failure/fallback explicitly; do not suggest the catch itself is unreachable. |
| [Tools:21](../../src/app/api/tools/route.ts#L21) | **Still stale:** describes `api/agent/personality` as currently PUT-only with a GET 405, but that route file is absent. Historical narration should not imply a current sibling. |
| [Cron hardware:25](../../src/app/api/cron/hardware/route.ts#L25) | **Behavioural explanation retained:** proxy enforcement plus deliberate host-side guards matches code. Line 31’s `proxy.ts:58-63` pointer is stale; the current host-prefix declaration is line 82. |
| [Sessions detail:72](../../src/app/api/sessions/[id]/route.ts#L72) | **Stale path:** names `src/lib/session-title.ts`; actual file is [src/lib/sessions/session-title.ts](../../src/lib/sessions/session-title.ts). |
| [Config:119](../../src/app/api/config/route.ts#L119) | **Stale reference:** cites a “Rule of Three” in `api-response.ts`; the inspected file contains no such rule. |

**Recommended checkpoint:** record gap-061.1 as **mapped with explicit exact-wording gaps**, not “all 400 sentences pinned”. app-19 remains **unresolved for the surviving comments above**. The non-route historical page/component claims were not re-audited in this pass.


## Subsequent comment correction

The seven route comment defects were corrected after this source review. The runtime emission comparison in `tmp/t0192-route-comment-proof.json` is identical for all seven files. Laplace independently accepted the current wording, including aggregate backfill previews and concurrent-count limits. Earlier line references describe the inspected snapshot. No claim of complete error-sentence test coverage is added.
