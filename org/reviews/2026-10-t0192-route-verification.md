# T-0192 route and application verification

Opened at clean dev `49aa7a604cfead440c6cce827a53d2a294408e60`, ruledR2. Closure-head hosted jobs for T0191 allpass. No oracle authored or implementation started.

# T-0192 opening preparation at 2f0ccfb7

Read-only preparation by Halley and Nash, coordinator transcription. No task opening, oracle freeze or implementation acceptance. T-0191 closure-head hosted jobs must pass first.

Halley reconciled 41 findings,16 OP dispositions,25 coverage obligations. Reuse completed app-06 non-host proxy guard, app-04 catch detector, cross-cutting-14 Chat SimpleMarkdown migration, cross-cutting-21 storage guard and T0190 hook ownership. Preserve cross-cutting-04/app-21 compatibility to first-post-v1 under T0200. app-02/app-14 needs narrower prop composition, not another hook extraction.

Required route cohorts: app-05/07/11/12/13/18, cross-cutting-10 exact wrapper, params, scheduling, guards, envelopes and required/optional parsing contracts. app-16 startup recovery remains after throwing calls; cross-cutting-01 boot flag no/off mismatch; cross-cutting-02 gateway status/runtime mismatch. Environment/home/logging/types/config/type convergence must receive bounded evidence, not blanket rewrites. Preserve shell-wins scripts versus file-wins deploy and ADR0005 exceptions. Assess standalone proxy independently.

Six source-supported defect claims: profiles/[id]/route.ts changed-slug metadata; useSettingsEditor.ts newer draft erased at save; fallback-sync.ts empty chain early return; useModelActions.ts semantic bulk failures; rec-room/handlers/crud.ts false-empty catch; api-fetch.ts JSON-null cronPushError access. Add independent red reproduction for each. Additional current followups: unread Script Save; incomplete Composer graph disclosure; six real seed endpoints latency cause unproved. Public ApiCredential/CredentialSummary convergence must keep hint-only surface and private CredentialWithKey.

Nash proposes minimum consolidation using existing factories: sync/status plain envelopes projected18source lines, not implemented savings. Fixed-message catches syncGET/updateGET/POST can reuse route with exact guard order. Dynamic syncPOST/categoryGET/PUT errors are not compatible with serverErrorFromError as written: String(Error) preserves Error: prefix in sync; categories require message/fallback. Freeze Error/empty/string/nonError throws before selecting helper. Do not add a general body framework.

Existing 76 route files use route();24 mention schema parser,24 plain parser,3optional parser. Remaining direct route request.json sites prefs/update/backfill must stay separate. Preferences has distinct wording; update signature/read-only/deploy order; backfill default dry-run and null distinction; Composer approval bespoke errors; Hindsight503/500nesteddata; HTTP200partialsuccess; auth/cookies/raw/streams retain contracts. New URL/method inventory and caller-gate tests are absent and need exact claims. Handler tests with mocked auth cannot prove proxy refusals.

Reuse c1-one-route-body,api-response,parse-optional-json-body,api-json-400-regressions,missions-invalid-json-400,sync-api-route,mission-categories-route,update-api,deploy-action-fallback and current framework/session e2e. Retain all identities. Actual net counts include helpers/imports and separate test/docs growth.

No new operator choice identified yet. Scope/router/exact claims and current contracts must be frozen before implementation; the Story false-empty bug fix needs its existing explicit response-behaviour exception restated. Broader proposed claim globs are not ownership.

## Independent defect oracle proposal, Galileo

No implementation read beyond current source. Proposed exact files: tests/unit/api-fetch-error-envelope.test.ts; tests/unit/settings-save-draft-ownership.test.tsx; tests/unit/model-bulk-default-feedback.test.tsx; tests/unit/story-list-failure-contract.test.ts; tests/integration/t0192-route-persistence.mjs; tests/e2e/route-contract-followups.spec.ts.

Profiles require real isolated SQLite/profile directories, changed/same slug metadata, clearing description, filesystem failure and reference consistency. Settings requires40->submit41->type42 while real response held, baseline41/draft42, refusal and unchanged success. Fallback requires actual endpoints+SQLite+synthetic YAML for sole-disable/last-delete/explicitempty, nonempty order, unrelated keys, backup/write refusal. Bulk defaults covers allsuccess/semantic/transport/mixed, refreshed defaults and malformed owned YAML partial success. Story separates injected repository exception from genuine empty/healthy/parser preservation and UI recovery. apiFetch uses real Response with null/primitives/arrays/objects/invalidJSON and exact published error precedence. Script holds/refuses GET but keeps PUT real and independently checks synthetic file bytes, then successful read/edit/save and stale selection. Composer holds/refuses graph, requires complete stages/write warning/recovery and one explicit confirmation, refuses run response to prevent providers; stale graph must not qualify. Preserve engine HIL tests.

Historical composer-review-control.test.tsx supplies no graph but expects launch. Independently amend only fixture to loaded graph after exact review, retaining three names/assertions: labelled Review; opens review rather than running; run only from Confirm and launch. Capture hash/name baseline and authority before amendment. Other profile/fallback/feedback/Story/Settings suites retain all identities. Browser fixtures use normal concurrency, real signin, both widths, drained callbacks and no timeout/retry relaxation. This defect subset does not discharge route matrix, credential shape or latency evidence.

## Laplace opening critique

Approach fits existing authority, no new operator decision evident. Three mandatory details: standalone persistence.mjs would be outside Jest/gate and needs executable mandatory wiring, preferably discovered e2e with isolated real storage; freeze full URL/method inventory and caller-gate plus individual four-operator-route labels/allowlist before route edits; explicitly measure built-app cold/warm Windows AND Linux endpoints with event-loop investigation. Preserve Story's narrow failure-response exception and all other contract boundaries. Historical Composer fixture amendment requires exact independent review and unchanged three names/assertions/two-step launch. No phase can discharge the82rows without evidence or justify unmeasured savings.

Galileo refinement replaces standalone persistence.mjs with discovered tests/e2e/route-contract-persistence.spec.ts plus tests/helpers/route-contract-runtime.ts. Test-scoped root/random token/loopbackport, real production build and SQLite, stripped inherited runtime/provider env, owned data/Hermes/home/temp, refuse checkout envfiles, explicit origin+signin and cleared inheritedBearer, synthetic profiles/keylessmodels/neverexecutedscripts, awaited readiness/callbackdrain/DBclose/process-exit. Preserve normal concurrency/zero retries; do not kill foreign listeners or delete roots still in use. Deterministic owned-path obstruction proves write refusal crossplatform. Helper isolation/lifecycle require exact independent review before freeze. Current process.execPath must remain ABI-compatible with builtdependencies; do not hardcode localWindowsNode path in portabletests.


The preceding preparation is historical read-only evidence; this opening record now governs exact claims. The complete82-row ledger remains pending; none is discharged by source review alone.

## Itemised source reconciliation at 4a0ce196

The following independent reviews are source evidence, not test or implementation acceptance. All final dispositions remain pending.

### Application and cross-cutting inventory

Reviewer session `01a10195-e680-7d01-b79a-86627d74049c`:

Reviewed at **`4a0ce1968befcfd33f392478627b9ac668e67ef1`**. No writes, tests or oracle changes. The table covers **23 cross-cutting findings**, including their **six T0192 OP rows**. “Needs fix” identifies remaining work, not implementation permission before oracle freeze.

### Findings and operator rulings

| ID | Current source evidence | Existing ruling and current conclusion |
|---|---|---|
| **01** | [boot-diagnostics.ts:46](../../src/lib/deploy/boot-diagnostics.ts#L46) recognises `0/false`; [feature-flags.ts:15](../../src/lib/feature-flags.ts#L15) also recognises `no/off`. | **Needs fix.** Operational reporting must match actual flag behaviour. In-process proof remains required. |
| **02** | [runtime-status.ts:77](../../src/lib/status/runtime-status.ts#L77) reads gateway env/default; [agent-runtime.ts:31](../../src/modules/hermes/lib/agent-runtime.ts#L31) derives endpoints from `PS_LLM_API` too. | **Needs fix.** Test the full chat-completions URL case; a bare base URL does not prove the historical mismatch. |
| **03** | Different readers remain: [feature-flags.ts:15](../../src/lib/feature-flags.ts#L15), [boot-diagnostics.ts:46](../../src/lib/deploy/boot-diagnostics.ts#L46), [env loader:26](../../scripts/tooling/_env-local.mjs#L26). | **Retained vocabulary; bounded convergence outstanding.** Existing split **03a→T0196**, **03b→T0194** governs tooling vocabulary and shared registry migration. T0192 fixes its operational mismatches without inventing a universal boolean parser. |
| **04** | [env loader:13](../../scripts/tooling/_env-local.mjs#L13) retains supported legacy names and bridge handling. | **Deferred retirement.** **04a/04b→T0200**, first post-v1.0 under Q033. Preserve aliases and signing compatibility now. |
| **05** | `rg -n 'PS_DEPLOY_STATUS_FILE\|PS_LOG_RETENTION_DAYS\|PS_RUNTIME_LOG' docs/running/env-reference.md scripts/tooling/ps-deploy.mjs scripts/hardware/ps-log-rotate.mjs` finds live readers at deploy **82/84**, rotation **22**, but no reference rows. | **Needs documentation fix.** Three current omissions established; historical “12” not recounted. Preserve `CH_URL` fallback; regenerate derived manifest. |
| **06 + OP** | [eslint.config.mjs:25](../../eslint.config.mjs#L25) has no scoped require-import override; [jest.config.js:1](../../jest.config.js#L1) retains suppression. Current `rg -n 'no-require-imports' tests` returned **312 text hits**. | **Needs ruled consolidation:** override **and keep unique reasons**, atomically remove redundant directives. Neither historical 285 nor prior 294 is current. Text hits are not an AST deletion list; active oracle additions can change them. |
| **07 + OP** | [feature-flags.ts:15](../../src/lib/feature-flags.ts#L15); [Composer runs:39/47](../../src/app/api/composer/runs/route.ts#L39) repeat guards. | **Retained flag; guard consolidation outstanding.** Ruling is “keep, one-line guards”. Preserve explicit-off behaviour and exact 503 response, not a 404 helper substitution. |
| **08 + OP** | Five TS copies remain, e.g. [seed-catalog.ts:15–32](../../scripts/tooling/seed-catalog.ts#L15). They strip paired quotes and preserve existing env values. [ESM loader:48/60](../../scripts/tooling/_env-local.mjs#L48) retains quotes and overwrites inherited values; its whitelist at **8** excludes file-sourced `CONTROL_HUB_DATA_DIR`. | **Needs fix and ruled deduplication.** Preserve **shell-wins TS scripts / file-wins deploy**, strip surrounding quotes and retain supported aliases. Deploy calls the loader at [523](../../scripts/tooling/ps-deploy.mjs#L523). Restart/precedence proof remains required. |
| **09** | [tsconfig.json:33](../../tsconfig.json#L33) still excludes `scripts` and `trace_import.ts`. | **Needs bounded tooling proof/fix.** No current scripts typecheck established here; do not claim adding scripts will be clean or silently broaden the application compilation boundary. |
| **10** | [Story crud:19–21](../../src/modules/rec-room/handlers/crud.ts#L19) retains direct envelopes; [api-logger.ts:16](../../src/lib/api/api-logger.ts#L16) is the shared logging boundary. | **Consolidate only equivalent contracts.** Coordinate with Nash’s route matrix; preserve statuses, text, nested Hindsight responses and partial-success envelopes. Historical count is not a conversion list. |
| **11 + OP** | [instrumentation.ts:31/50](../../src/instrumentation.ts#L31) retains `[auth]/[config]`; [config-sync.ts:93/207](../../src/modules/hermes/lib/config-sync.ts#L93) still uses function-name tags. | **Needs ruled tag reconciliation.** Closed tag list, keeping `[auth]/[config]`. Classify server/client/CLI paths before changing messages; no blanket console replacement. |
| **12** | [utils.ts:36/57/87](../../src/lib/utils.ts#L36), [mission-run-state.ts:92](../../src/lib/missions/mission-run-state.ts#L92), [ElapsedSince.tsx:16](../../src/components/composer/ElapsedSince.tsx#L16). | **Consolidate only if equivalent and net-positive.** Relative, future, elapsed and ticking clock formats differ. Preserve the deliberate ticker; no general “one time formatter” mandate. |
| **13** | [ScriptRow.tsx:18](../../src/components/scripts/ScriptRow.tsx#L18) emits compact units; [SessionCard.tsx:113](../../src/components/session/SessionCard.tsx#L113) fixed one-decimal KB; [utils.ts:108](../../src/lib/utils.ts#L108) strips trailing zeros. | **Consolidate only if net-positive with preserved formatting.** These are observable differences. A single new rounding convention needs an explicit choice; preserving existing output avoids that decision. |
| **14** | [Chat MessageBubble:105](../../src/components/chat/MessageBubble.tsx#L105) uses shared Markdown; [SimpleMarkdown:43/50](../../src/components/skills/SimpleMarkdown.tsx#L43) has Copy and guarded links. | **Already satisfied for 14b by T0191.** **14a→T0194** owns escape-helper convergence. Preserve Research renderer and proxy exclusion; do not redo or silently reassign these splits. |
| **15** | [utils.ts:114](../../src/lib/utils.ts#L114) exports `truncate`; [mission-repository.ts:65–69](../../src/lib/missions/mission-repository.ts#L65) actively uses `safeJsonParse`. | **Retain live helper; assess only narrow dead export.** “Dead utils” is false as a compound claim. A complete symbol/import check is still needed before retiring `truncate`; CSS `truncate` hits are irrelevant. |
| **16 + OP** | [templates create:21](../../src/lib/templates-handlers/create.ts#L21) still builds timestamp/random IDs. | **Needs ruled UUID change for new IDs**, preserving stored IDs. Other helper bypasses require semantic comparison; do not mechanically replace differing error fallbacks or cross-runtime sleep helpers. |
| **17** | [api-fetch.ts:97](../../src/lib/api/api-fetch.ts#L97) defaults to `any`; [template shared:30](../../src/lib/templates-handlers/shared.ts#L30) retains body escape hatch; [Models page:181](../../src/app/agent/models/page.tsx#L181) retains dependency suppressions. | **Consolidate/narrow only with caller proof.** Static escapes do not establish runtime bugs. Broad `unknown` migration or fetch-mock replacement is not discharged by the narrow JSON-null repair. |
| **18** | [ApiCredential:12](../../src/components/models/types.ts#L12) duplicates [CredentialSummary:14](../../src/lib/models/credentials-repository.ts#L14). `rg -n 'import.*@/components/' src/lib` still finds analytics/API type imports. | **Measured convergence candidate**, already explicitly claimed for credentials. Preserve public hint-only projection, aliases where useful and private `CredentialWithKey`. Other type moves need individual net/consumer evidence. |
| **19** | [repository:361](../../src/lib/missions/mission-category-repository.ts#L361) duplicates [seed SQL:1](../../src/lib/db/seeds/001_mission_categories.sql#L1). | **Consolidate only if net-positive and deployment-safe.** Preserve boot/reset availability, packaging and existing `ch.cat.*` uniqueness keys; do not edit protected historical seed content without applicable authority. |
| **20** | [home.ts:19](../../src/modules/hermes/lib/home.ts#L19), [agent-runtime.ts:15](../../src/modules/hermes/lib/agent-runtime.ts#L15), [discover-agents.mjs:21](../../scripts/tooling/discover-agents.mjs#L21). | **Consolidate only if net-positive across runtimes.** Preserve env/active-profile/default distinctions and aliases. A TS helper cannot automatically replace standalone MJS behaviour. |
| **21** | [useSelectedProfile.ts:38/53](../../src/hooks/useSelectedProfile.ts#L38), [mission-composer-utils.ts:37/46](../../src/lib/missions/mission-composer-utils.ts#L37) guard storage; `useStoredBool` retains legacy migration. | **Already satisfied/retained:** **21a→T0190**; **21b ruled out existing-key renames**. Migration retirement is distinct and remains post-v1.0. |
| **22 + OP** | [package.json:94](../../package.json#L94) retains `ts-jest`; [knip.json:25/28](../../knip.json#L25) ignores `ts-jest/jsdom`. | **Needs dependency/tooling reconciliation.** Ruling is “all fixes **except next.config.ts**”. Verify direct `jsdom` use/declaration and dependency consumers; successful current Knip cannot prove an ignored dependency unused. |
| **23** | [seed SQL:3–10](../../src/lib/db/seeds/001_mission_categories.sql#L3) preserves `ch.cat.*`; non-hook helper modules remain under hooks. | **Retained historical names/keys.** **23a/23b prohibit churn; 23c→T0195** documents new subject-first naming. Remaining helper relocation is only a measured candidate, not required historical renaming. |

### Cross-cutting coverage

| Coverage | Current evidence and qualified conclusion |
|---|---|
| **059.1** | Reuse T0191 token/removal evidence and current stylesheet. **Already satisfied only within that bounded token scope**; do not claim a fresh complete CSS audit. |
| **060.1–2** | [proxy.ts:167](../../src/proxy.ts#L167) still emits `#05080d/#eaf2f8` in standalone refusal HTML. **Source observation satisfied; standalone visual/contrast judgement remains.** No automatic stylesheet import or redesign. |
| **081.b** | [WorkflowCanvas:34](../../src/components/composer/WorkflowCanvas.tsx#L34) imports React Flow; Composer page imports `next/dynamic` and documents conditional loading. **Source topology partly established**, not current bundle-cost proof. Classify client entry reachability before claiming YAML/Zod shipping costs. |
| **084.a–b** | Exact mismatches in findings 01/02 above. **Needs fix; source evidence current.** |
| **084.c** | **Process proof outstanding.** This read-only pass ran no boot/status fixture. |
| **085.b** | Findings 17’s concrete sites remain. **Full consequence classification outstanding**; historical “253” is not a current verified inventory. |
| **087.a** | Distinct deliberate API errors and semantic-feedback paths remain. **Inventory/classification outstanding**; preserve messages unless an explicit bug-fix exception applies. |
| **088.a** | `rg -n '@/modules/' src/lib` finds **six static import declarations in five files**, plus two import-type expressions in `modules/server.ts`; comments are separate hits. **Current source recount satisfied.** |
| **088.b** | [ADR-0005:286–298](../../org/decisions/ADR-0005-product-modules.md#L286) explicitly permits the provider-list import and three composition points: modules, frameworks and runtime. **Retained explained boundaries**, not six new violations. |

### Claim reconciliation before any additional work

The opening’s [scope note](../../org/tasks/T-0192.json#L341) explicitly requires all obligations to be dispositioned; initial claims are not an exemption.

- **08 is not automatically transferred to T0196.** `tooling-09→T0196` overlaps the same five TS parsers. Record one execution owner and shared completion evidence. If T0192 implements its explicit ruling, add the five parser files, `_env-local.mjs`, any shared destination and env documentation as exact claims; preserve T0196’s historical attribution without repeating the extraction.
- **06/09/22 remain T0192-owned despite being tooling work.** Current claims omit `eslint.config.mjs`, `jest.config.js`, affected directive files, TS configurations, `package.json`, lockfile and `knip.json`. Select and claim the exact cohort before changes; do not hand it away merely because of its directory.
- **03/14/21/23 have actual existing split owners/rulings.** Preserve those boundaries rather than treating every parent finding as wholly executable in T0192.
- **05/11/16/19/20 extend beyond current claims.** Their documentation, logging, template-ID, category-seed and cross-runtime home cohorts need explicit selection/claims and preservation evidence. The two active oracle packages do not silently cover them.

The principal unresolved decision is **scope coordination for the overlapping env-parser cohort**. No new operator choice is needed to execute its existing two-precedence ruling. Changing formatter output or weakening existing compatibility would be a separate decision, not implied consolidation authority.

Reviewer session `01a10198-6b4f-7593-aa19-e0b3c8facad8`:

**App-side disposition support is below. This is source evidence, not closure of runtime obligations.** No writes, tests, builds or oracle changes. Halley’s cross-cutting inventory remains separate.

The opening [dispositions](../../org/reviews/2026-10-t0192-dispositions.json) are provisional. Historical counts and proposed savings must not become current acceptance evidence.

### App findings

| Item | Current evidence | Ruling and bounded conclusion |
|---|---|---|
| **app-02: template prop forwarding** | [useMissionsPage.ts:158](../../src/hooks/useMissionsPage.ts#L158) still individually re-exports template state; [missions/page.tsx:250](../../src/app/work/missions/page.tsx#L250) forwards it into the modal. | **Consolidation only if net-positive.** Bundle the existing draft boundary rather than repeat T0190 hook extraction. Include modal, hook, consumer and fixture costs. `b10-template-editor-has-its-own-draft.test.tsx` tests the hook, not modal rendering; it cannot alone prove the new prop boundary. |
| **app-04: catch census** | [line-census.mjs](../../scripts/tooling/line-census.mjs) already detects hand-rolled log-and-500 catches. | **Detector already repaired.** Do not count another detector implementation as T0192 work. The opening’s 18-route/25-site result still needs its exact receipt bound to closure. Response conversion is separate app-04b work. |
| **app-05: parameterised catches** | Surviving sites include [missions:82](../../src/app/api/missions/route.ts#L82), [scripts/logs:23](../../src/app/api/scripts/logs/route.ts#L23), [scripts/run:53](../../src/app/api/scripts/run/route.ts#L53), [models/sync/push:69](../../src/app/api/models/sync/push/route.ts#L69), [agent/files:200](../../src/app/api/agent/files/[key]/route.ts#L200), [sessions/detail:293](../../src/app/api/sessions/[id]/route.ts#L293), [models/fallbacks:137](../../src/app/api/models/fallbacks/route.ts#L137). | **Consolidation remains.** Existing `RouteText` resolves route params; several log contexts instead derive from query/body/local state. Do not replace those with params-only messages. Each conversion needs exact log context, one-log behaviour, response and side-effect preservation. The historical “seven of thirteen” is not a current population count. |
| **app-06: duplicate read-only guards** | Current route search leaves host controls in [cron/hardware:45](../../src/app/api/cron/hardware/route.ts#L45), [scripts/name:37](../../src/app/api/scripts/[name]/route.ts#L37), [scripts/run:22](../../src/app/api/scripts/run/route.ts#L22), plus GET-side suppression in sessions, stats and profile toolsets. [proxy.ts:236](../../src/proxy.ts#L236) distinguishes lifecycle writes. | **Broad non-host removal already implemented; remaining exceptions retained.** Preserve auth lifecycle writes and GET suppression. Handler-unit calls do not establish proxy coverage. Reuse framework/session/read-only tests rather than repeat the old removal. |
| **app-07: route context types** | Current read-only count: **19 `interface Ctx`, six `type Ctx` declarations**. Examples: [schedules/id:16](../../src/app/api/schedules/[id]/route.ts#L16), [approval:62](../../src/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route.ts#L62). | **Consolidation only after whole-cohort count.** Preserve Promise params, multiple keys and catch-all arrays. A `Record<K,string>` abstraction does not cover `path:string[]`. Inline annotations often save no physical lines; imports/helper costs count. |
| **app-08: overlapping error boundaries** | [layout.tsx:150](../../src/app/layout.tsx#L150) still wraps children in `ErrorBoundary`; `app/error.tsx` also exists. No `app/global-error.tsx`. | **Retain pending runtime proof.** A page throw reaching the inner fallback does not prove the outer boundary redundant when that fallback fails. Existing `t0182-global-error.spec.ts` checks useful fallback heading/CSP, not equivalence of removing the wrapper. |
| **app-09: loading/error/not-found surfaces** | Session detail already has [loading/error handling:130](../../src/app/results/sessions/[id]/page.tsx#L130) and [PageHeader:171](../../src/app/results/sessions/[id]/page.tsx#L171). Skill detail has [loading:76](../../src/app/agent/skills/[...path]/page.tsx#L76) and [PageHeader:112](../../src/app/agent/skills/[...path]/page.tsx#L112). | **Partially completed; remaining visual convergence needs evidence.** Do not redo T0191’s session-heading repair. Distinguish initial loading, stale-data refresh, failed read and genuine missing resource. Models’ aggregate-loading delay remains an unresolved latency issue, not evidence of a state race. |
| **app-10: `toastElement`** | [Toast.tsx:195](../../src/components/ui/Toast.tsx#L195) documents shell ownership; the fallback element is still constructed below it. | **Product-shell redundancy, not universally dead code.** Preserve standalone/test consumers. Any removal needs a complete consumer migration and net count; do not delete the fallback merely because shell consumers receive `null`. |
| **app-11: schedule validation** | Four relevant paths still check interval feasibility/bounds: [schedule create:62](../../src/app/api/schedules/route.ts#L62), [schedule update:54](../../src/app/api/schedules/[id]/route.ts#L54), [mission promotion:105](../../src/lib/missions/mission-promote-handler.ts#L105), [dispatch:135](../../src/lib/missions/mission-handlers/dispatch.ts#L135). | **Equivalent validation may consolidate; result boundaries stay distinct.** Preserve exact refusal words, next-run calculation, partial-update behaviour and no write/dispatch on refusal. Reuse schedule parsing/bounds and mission-dispatch tests. A helper should return domain validation data, not force all callers into one HTTP shape. |
| **app-12: envelopes** | Plain candidates remain in [sync/route.ts:21](../../src/app/api/sync/route.ts#L21) and [status/route.ts:31](../../src/app/api/status/route.ts#L31). | **Consolidation only for exact factory equivalents.** Earlier projected −18 lines remains a proposal, not delivered savings. Retain auth/health raw bodies, cookies, Hindsight nested errors, migration metadata, streaming and HTTP200 partial-success contracts. |
| **app-13: Composer flag guards** | The exact disabled sentence remains at 12 sites across Composer routes, including [runs:40](../../src/app/api/composer/runs/route.ts#L40) and [events:30](../../src/app/api/composer/runs/[id]/events/route.ts#L30). | **Consolidation candidate, not permission to alter gating.** Preserve 503/body and guard-before-read/write/stream ordering. `b1-composer-events-honour-the-flag.test.ts` is relevant existing coverage. Halley owns the cross-cutting flag-semantics mapping. |
| **app-14: large pages** | Current roster still contains 11 substantial pages; examples include [profiles:24](../../src/app/agent/profiles/page.tsx#L24), [Skills:120](../../src/app/agent/skills/page.tsx#L120), [Composer:55](../../src/app/work/composer/page.tsx#L55). They already use domain hooks alongside local state. | **No blanket extraction.** Large size is not proof of a defect or savings. App-02’s narrower prop fold is more concrete. Preserve T0190/T0191 ownership fixes; any extraction must count destinations/imports and preserve source-pinned historical identities through authorised amendments. |
| **app-16: boot recovery order** | [instrumentation.ts:79–90](../../src/instrumentation.ts#L79) starts sync/scheduler/catalog before recovery beginning at 92. | **Needed ruled repair.** OP explicitly says **“Fail fast, sweeps first.”** Preserve fatal sync/scheduler failure; do not introduce catch-and-continue. Independent injected-failure evidence must show recovery preceding failure. `boot-says-how-it-is-configured.test.ts` tests reporting, not this ordering. |
| **app-17: thick routes** | Historical cohort remains agent/files, sessions/detail, agent/profiles, Hindsight and mission-categories. Session helpers already exist in [session-detail.ts](../../src/lib/sessions/session-detail.ts). | **Partially extracted; further movement only with measured benefit.** Moving a body into `src/lib` is zero consolidation by itself. Preserve response guards, auth order, streaming, write effects and domain-specific catches. |
| **app-18: body parsing** | Raw exceptions remain in [prefs:17](../../src/app/api/prefs/route.ts#L17), [update:107](../../src/app/api/update/route.ts#L107), [backfill:41](../../src/app/api/admin/sessions/backfill-status/route.ts#L41). Shared required/optional/schema parsers already exist. | **OP: “Keep sentences, convert the rest.”** Distinguish absent, malformed, `null`, array, primitive and object. Backfill’s default is dry-run true; prefs has bespoke wording; update defaults action and retains signature/deploy guards. No global object-validation change under a consolidation claim. |
| **app-19: misleading comments** | [stories/route.ts:3](../../src/app/api/stories/route.ts#L3) names the obsolete `src/lib/story-handlers`; [backfill:43–45](../../src/app/api/admin/sessions/backfill-status/route.ts#L43) has contradictory default commentary. | **Specific documentation corrections needed.** Record exact surviving sites; do not claim the entire historical comment inventory repaired from these examples. Avoid counting unrelated narration removal as behavioural consolidation. |
| **app-20: duplicate gateway fetch** | [chat fetch:72–115](../../src/app/api/orchestration/chat/route.ts#L72) versus [gateway-client.ts:28](../../src/lib/models/gateway-client.ts#L28). | **Not a drop-in fold.** Details below. Savings remain unproved once timeout/signal/auth compatibility is included. |
| **app-21: CH aliases** | [next.config.ts:9](../../next.config.ts#L9) retains `CH_ALLOWED_DEV_ORIGINS`; [profiles/sync/pull:52](../../src/app/api/agent/profiles/sync/pull/route.ts#L52) retains `CH_PULL_RECONCILE_DISK`. | **Retained under release-dependent retirement policy.** No T0192 deletion. Existing warning/migration work is separate from retirement; T0200 dependency remains. |

### OP reachability and preservation items

- **app-01a/b/c/d:** retain the four documented operator routes: backfill-status, agents/progression, memory status and mission-by-id. Current API rows at [62](../../docs/reference/api.md#L62), [72](../../docs/reference/api.md#L72), [77](../../docs/reference/api.md#L77) and [100](../../docs/reference/api.md#L100) do not yet supply all the ruled item-specific no-UI/operator labels.
- **app-01h:** caller gate must include `tests/integration` and assembled URLs, not only literal `fetch("/api/...")`. “No UI caller” is not “unreachable” or deletion authority. The active oracle author owns the new gate; I have not assessed its unfinished bytes.
- **app-04b:** preserve thrown-text contracts. Existing `serverErrorFromError` is incompatible with sync’s `String(error)` prefix and categories’ message-or-fallback behaviour. Freeze these before conversion.
- **app-06/app-16/app-18/app-21 OP rows:** conclusions are respectively completed-with-exceptions, needed ordering repair, wording-preserving parsing convergence, and retained compatibility.

### Gateway, fonts and proxy distinctions

**Gateway:** the shared client always supplies `AbortSignal.timeout(timeoutMs ?? 3000)`, overriding a caller signal. Chat instead forwards request cancellation, has no explicit three-second deadline, propagates upstream status/error text, returns 502 for missing stream bodies, and wraps SSE with [per-chunk/one-second authorisation checks](../../src/app/api/orchestration/chat/route.ts#L22). Non-streaming completion rechecks authorisation before release.

Any shared transport must preserve:

- Gateway bearer injection separately from browser-session authorisation.
- Request abort, downstream cancellation and upstream reader cancellation.
- No buffered replacement for SSE.
- Existing health/models timeout versus chat lifetime.
- Upstream errors and missing-body response contracts.

Reuse `gateway-client.test.ts`, gateway health/models suites and stream/session tests. A header-equivalence unit test cannot discharge revocation or cancellation behaviour.

**Fonts:** the [app-22 ruling](../../org/reviews/2026-09-decision-register.md#L2212) is **keep**. Four local font declarations remain; [ReaderSettings:29–38](../../src/modules/rec-room/components/ReaderSettings.tsx#L29) exposes them, and [reader:500](../../src/app/recroom/story-weaver/[id]/page.tsx#L500) resolves the selection. Source proves reachability, not readability/accessibility. The layout’s “may be deleted” comment remains stale. No font deletion proposal.

**Proxy:** [proxy.ts:167](../../src/proxy.ts#L167) contains standalone refusal-page colours, while [globals.css:112](../../src/app/globals.css#L112) defines different application surfaces. This proves literal divergence, not a visual defect. Assess the unauthenticated standalone page independently; importing application styling or providers could change its dependency/security boundary.

**Dynamic pages/redirects:** retain the two explicit `force-dynamic` guards in Composer layout and Help. Source exports do not replace current build evidence. `next.config.ts:130,136` still shows the generic config-section route followed by generated settings-anchor redirects; live hop count remains unverified here. Retirement remains release-dependent, not T0192 cleanup.

### Associated coverage: what this inspection does and does not discharge

| Coverage | Current bounded disposition |
|---|---|
| **gap-055.1, gap-063.2** | Reconstructed the 11-page roster and current hook/state presence. **Not** a complete handler-ownership audit of every page. No extraction savings established. |
| **gap-056.1/.2** | Route families and representative contracts identified. Complete method/URL roster and every-method side-effect review remain the route-oracle obligation. |
| **gap-057.1/.2/.3/.5** | Existing tests identified; no tests or browser journeys run. Boundary overlap, redirects and visual equivalence remain open. |
| **gap-057.4** | Current source retains dynamic guards. Fresh build-artifact evidence still required. |
| **gap-058.1** | Caller inventory must resolve variable/path-fragment construction and integration callers. Literal search alone cannot close it. |
| **gap-059.1, gap-060.1/.2** | Current token/proxy colour sites identified. Whole stylesheet assessment and standalone visual judgement remain open. |
| **gap-061.1** | Required/optional/custom error contracts identified; reuse JSON-regression, prefs, update, backfill and Composer approval coverage. Do not replace exact words with generic parser errors. |
| **gap-061.2** | Seven historical catch sites re-located. Exact per-site log-context assertions still need reconciliation; wrapper tests alone are insufficient. |
| **gap-062.1/.2** | Font roster and reader consumption verified in source; visual/accessibility measurement remains open. |
| **gap-081.b** | Composer still dynamically imports both canvases at [page.tsx:47](../../src/app/work/composer/page.tsx#L47). This establishes source deferral, not built chunk/loading behaviour. |
| **gap-084.*, gap-085.b, gap-087.a, gap-088.*** | Left to Halley’s cross-cutting inventory; no duplicate disposition claimed. |

Repeatable read-only starting commands used:

```powershell
rg -n 'serverErrorFromCatch' src/app/api -g 'route.ts'
rg -n 'interface Ctx|type Ctx =' src/app/api -g 'route.ts'
rg -n 'requireNotReadOnly|isReadOnly\(' src/app/api
rg -n 'request.json|parseJsonBody|parseOptionalJsonBody' src/app/api
rg -n 'Composer is not enabled' src/app/api/composer -g 'route.ts'
rg -n 'force-dynamic' src/app -g '*.tsx'
rg -n 'fontFamily|FONTS' src/modules/rec-room/components/ReaderSettings.tsx
```

These searches establish locations and populations, not runtime acceptance. Any additional implementation path outside the opening’s exact claims still needs allocation before work.

### Tooling cohorts and environment precedence

Reviewer session `01a10195-e680-7d01-b79a-86627d74049c`:

**Proposed three bounded cohorts at `4a0ce196`; no implementation or tests performed.** The main blocker is independent amendment authority for existing dependency-pin tests.

### Cross-cutting-06: scoped ESLint override

**Exact candidate list:** the following read-only selector identifies **285 tracked test files / 312 matching lines** at the opening commit. These are candidate hits, not automatically removable comments.

```powershell
git grep -l 'no-require-imports' 4a0ce196 -- tests
git grep -n 'no-require-imports' 4a0ce196 -- tests
```

Additional configuration files: [eslint.config.mjs](../../eslint.config.mjs), [jest.config.js:1](../../jest.config.js#L1).

**Boundary:** disable this rule only for `tests/**/*.{ts,tsx}` and `jest.config.js`. Keep enforcement in source and scripts, including [upgrade.ts:318](../../src/lib/db/upgrade.ts#L318).

Remove redundant directive syntax; preserve useful reasons as ordinary comments. In particular, retain the missing-module/red-oracle explanations in the four `b16` suites, real-SQLite/module-mapper explanations and module-reset ordering. Do not blindly delete multiline blocks or adjacent directives. Active oracle additions require a later snapshot reconciliation.

**Smallest independent contract:**

- Resolve ESLint configuration for a test, Jest config, source file and script; prove only the intended two scopes disable the rule.
- Compare executable tokens and test identities before/after the comment-only cohort.
- Check an explicit retained-reason manifest and preserve unrelated directives.
- Override and removals land atomically because unused-disable warnings fail current lint.

### Cross-cutting-09: scripts typechecking

Current root configuration excludes scripts; test configuration includes selected roots and may reach script dependencies transitively. That is **not complete CLI coverage**.

Exact current scripts roster:

| Executable TypeScript roots | Declaration companions |
|---|---|
| [ensure-hermes-model-sync.ts](../../scripts/tooling/ensure-hermes-model-sync.ts), [import-hermes-state.ts](../../scripts/tooling/import-hermes-state.ts), [migrate-db.ts](../../scripts/tooling/migrate-db.ts) | [design-lint.d.mts](../../scripts/tooling/design-lint.d.mts), [derive-surface-ladder.d.mts](../../scripts/tooling/derive-surface-ladder.d.mts) |
| [retention-prune.ts](../../scripts/tooling/retention-prune.ts), [seed-catalog.ts](../../scripts/tooling/seed-catalog.ts), [generate-json-schema.ts](../../scripts/tooling/generate-json-schema.ts) | [output-canary.d.mts](../../scripts/tooling/output-canary.d.mts) |
| [docs/extract.ts](../../scripts/docs/extract.ts), [docs/check.mts](../../scripts/docs/check.mts) | [docs/lib.d.mts](../../scripts/docs/lib.d.mts) |

**Smallest proposed boundary:** a separate `tsconfig.scripts.json`, strict/no-emit/non-incremental, covering all current and future script TS roots plus declarations. Wire it into mandatory lint through [package.json](../../package.json). Preserve existing app/test checks. Do not enable blanket MJS checking or execute migration, seed or documentation generators.

**Smallest independent contract:**

- Resolve the configuration and assert all eight executable roots are included, alongside declaration companions.
- An isolated type-error fixture must fail the same mandatory command; a corrected fixture passes.
- Verify no emitted files or build-info files and no CLI execution.
- Treat removal of stale `trace_import.ts` exclusion separately from broadening app compilation. Actual script diagnostics remain unknown until authorised checking.

### Cross-cutting-22: dependency reconciliation

**Change cohort:** [package.json](../../package.json), [package-lock.json](../../package-lock.json), [knip.json:24](../../knip.json#L24).

- **`ts-jest`:** no executable consumer found in inspected source/tests/scripts/config. Jest uses `next/jest`; manifest and historical pin assertions remain.
- **`jsdom`:** one direct consumer at [b6-cleared-defaults-stay-cleared.test.ts:617](../../tests/unit/b6-cleared-defaults-stay-cleared.test.ts#L617). It deliberately creates a DOM inside a real-filesystem hook suite. Retain that design.
- Current lock resolves **jsdom 26.1.0**, also required by `jest-environment-jsdom 30.3.0`. Declare the direct dependency without an incidental upgrade; remove only the corresponding obsolete Knip exclusions.
- **`next.config.ts` remains unchanged**, as explicitly ruled.

**Independent amendment blocker:** these suites assert exact dependency maps, so both removing `ts-jest` and adding `jsdom` affect frozen assertions:

- [t0175:63](../../tests/unit/t0175-dependency-proposals.test.ts#L63)
- [t0176:70](../../tests/unit/t0176-visual-dependency-proposals.test.ts#L70)
- [t0177:40](../../tests/unit/t0177-knip-proposal.test.ts#L40)

**Smallest independent contract:** authorise only those dependency-map deltas; preserve every test identity and unrelated pin. Verify manifest/lock agreement, direct jsdom availability, unchanged DOM lifecycle behaviour, unchanged Next/Jest configuration and absence of executable `ts-jest` references. Record any lockfile transitive removals explicitly.

No package installation, network access, global-environment changes or oracle edits occurred.

Reviewer session `01a10198-6b4f-7593-aa19-e0b3c8facad8`:

Verified at `4a0ce196`; no tracked tooling diff. No writes or tests performed.

**One execution owner: T0192.** Include the five TS callers, shared TS helper, deploy parser repair and precedence documentation in one cohort. T0196/tooling-09 should consume the same independent proof and measured saving, without duplicate implementation or double-counting.

Authority: [cross-cutting-08 ruling](../../org/reviews/2026-09-decision-register.md#L1493), especially the accepted option at line1500 and ruling at1506: preserve two precedence rules, deduplicate TS, strip deploy quotes, admit `CONTROL_HUB_DATA_DIR`, document precedence.

### Exact TS cohort

| File | Current loader | Invocation |
|---|---:|---:|
| [ensure-hermes-model-sync.ts](../../scripts/tooling/ensure-hermes-model-sync.ts#L15) | 15–34, 20 lines | 37 |
| [import-hermes-state.ts](../../scripts/tooling/import-hermes-state.ts#L15) | 15–34, 20 lines | 44 |
| [migrate-db.ts](../../scripts/tooling/migrate-db.ts#L26) | 26–45, 20 lines | 63 |
| [seed-catalog.ts](../../scripts/tooling/seed-catalog.ts#L15) | 15–34, 20 lines | 37 |
| [retention-prune.ts](../../scripts/tooling/retention-prune.ts#L46) | 46–64, 19 lines | 74 |

Measured duplication: **99 physical lines**, including function signatures/braces. Retention inlines the file read; semantics match.

### Current semantics and permitted changes

| Concern | Five TS loaders | Standalone deploy MJS |
|---|---|---|
| Precedence | Assign only when `!process.env[key]`: non-empty shell wins; empty shell loses | Every whitelisted file entry overwrites inherited value, including empty |
| Duplicate file keys | First non-empty value wins; an empty assignment permits a later replacement | Last entry wins in parsed map |
| Whitespace | Trim whole line, key and value | Preserve key/value whitespace; remove terminal CR only |
| Quotes | Strip matching outer single/double quotes | Currently retained; **ruled repair required** |
| CRLF | LF split plus trim | LF split plus terminal `\r` removal |
| Comments | Trimmed blank/whole-line `#` skipped | Empty/column-zero `#` skipped |
| `=` | First delimiter; remaining delimiters retained | Same, but rejects delimiter at position zero |
| Whitelist | None | `PS_*`, `CH_*`, `INSTALL_HERMES_*`, `HERMES_HOME`; **add exact `CONTROL_HUB_DATA_DIR`** |
| Aliases | Load names verbatim; consumers resolve aliases | Bridges file `CH_*` to falsey `PS_*`; retains newer provenance/warning logic |
| Missing/read failure | Missing file returns; read error propagates | Missing directory/file returns empty map; read error propagates |

Neither parser implements general dotenv interpolation, escapes, inline comments or `export` syntax. Do not introduce those behaviours.

In [_env-local.mjs](../../scripts/tooling/_env-local.mjs#L55), alias warnings now distinguish canonical and legacy provenance, suppress ineffective legacy values and warn once without values. Preserve that logic. `CONTROL_HUB_DATA_DIR` is a direct data-directory fallback, not a generic `CH_` bridge.

Keep TS loading before dynamic path/database imports. Preserve `import-hermes-state`’s subsequent `--hermes-home` override.

### Restart and packaging boundary

Current chain:

- [deploy-actions.ts:31](../../src/lib/update-handlers/deploy-actions.ts#L31) invokes the runner with `restart`.
- [deploy-spawn.ts:41](../../src/lib/deploy/deploy-spawn.ts#L41) launches through `detachedSpawn`, without supplying an environment override.
- [ps-deploy.mjs:523](../../scripts/tooling/ps-deploy.mjs#L523) loads `.env.local` before dispatching restart/update/rebuild.
- [ps-deploy.mjs:348](../../scripts/tooling/ps-deploy.mjs#L348) explicitly spreads the resulting environment into `next start`.

Therefore file-wins remains necessary to replace inherited, previously loaded values.

The shell wrapper [ps-deploy.sh:17](../../scripts/application/ps-deploy.sh#L17) executes plain Node. Keep `_env-local.mjs` independently executable without TS resolution or application imports. [Dockerfile:46](../../Dockerfile#L46) copies the whole scripts directory.

Existing isolated deploy fixtures explicitly copy `_env-local.mjs` alongside the runner in:

- `migration-t0188-update-backup-order.test.ts`
- `t0161-backup-creation.test.ts`
- `t0161-direct-invocation.test.ts`
- `t0161-required-step-failures.test.ts`

A TS-only helper adds no dependency to those copies. Sharing a new runtime module with deploy would add packaging/amendment obligations.

`PORT` remains a separate exception: [resolvePort:283](../../scripts/tooling/ps-deploy.mjs#L283) prefers inherited `PORT`, then `readEnvLocalValue`. It is not part of the export whitelist. Freeze and test the intended quote handling of that accessor explicitly.

### Net candidate, without invented realised savings

A conservative concrete layout retains callers’ existing ROOT calculation and passes `ROOT` to a proposed `scripts/tooling/load-env-local.ts`:

| TS production change | Lines |
|---|---:|
| Remove five loader bodies | −99 |
| Remove now-unused fs import lines in import/seed/retention | −3 |
| Add five helper imports | +5 |
| Shared helper: two imports, blank line, existing 20-line function adapted to directory argument | +23 |
| Calls/import-specifier adjustments | 0 net |
| **Projected TS subtotal** | **−74** |

This excludes optional removal of newly unused ROOT/path setup, avoiding inflated savings.

Full cohort: **six existing production files plus one new TS helper**, documentation in [env-reference.md](../../docs/running/env-reference.md#L13), and independently authored tests.

**Whole-cohort net is not yet exact:** `−74 + deploy repair delta + test delta + documentation delta`. Packaging delta is zero for this proposed separation. The historical “about −80” is not a current measured total.

### Independent oracle cases

1. **TS precedence:** unset, empty, whitespace and non-empty inherited values; duplicate empty/non-empty file entries.
2. **Parser fidelity:** LF/CRLF, paired single/double quotes, unmatched quotes, embedded `=`, literal `#`, whitespace, malformed lines, missing file and read failure.
3. **TS integration:** all five callers use the helper before dependent dynamic imports; explicit Hermes CLI override still wins.
4. **Deploy repair:** changed file overrides inherited canonical value; paired quotes removed; empty file value still overwrites; unrelated keys remain unexported; exact `CONTROL_HUB_DATA_DIR` becomes admitted.
5. **Alias preservation:** PS/CH file ordering, empty canonical fallback, inherited aliases, CONTROL fallback, warning once and no value disclosure.
6. **Restart handoff:** stale inherited value → changed file → child launch environment; preserve restart/update/rebuild dispatch and PORT exception.
7. **Standalone packaging:** existing copied-runner fixtures resolve all imports without TS/application dependencies.

Reuse the existing `legacy-inherited-env-warning`, `legacy-branch-and-port-provenance`, `legacy-script-alias-warning` and T0161/T0188 fixture suites. They provide compatibility coverage, but do not alone prove the new quote/whitelist requirements. No oracle outcomes or runtime restart success are claimed here.

## Browser and public-contract freeze, 2026-10-03

Laplace independently accepted the exact browser files and historical Composer fixture. The first red-first cohort contains 94 new cases: 42 browser/persistence cases (15 pass, 27 behavioural failures) and 52 passing public-route contracts. The three historical Composer cases pass before and after; their bodies and assertions are unchanged. The route snapshot freezes 104 URLs and 174 exported methods.

Receipt: `tmp/t0191-green-validation/tmp/t0192-browser-oracle/freeze-provenance.json`. All 42 owned runtime receipts show child termination without callback or cleanup errors. Review compared 730 resolved server source-map files with unchanged source and found no mismatches. No operator data or provider execution was used. Keep qualified-1's two fixture timing failures and all earlier unqualified receipts. The independent unit corrections are not part of this freeze.

The browser evidence confirms empty Script overwrite during held/refused reads and loss of the original profile row after a destination obstruction. Both are bounded repairs under the existing data-preservation invariant. The failing profile case did not reach later directory assertions. Conditional later Settings save, actual Composer execution and whole-product acceptance remain unclaimed. Test-line growth is disclosed separately; the fixed repeated-test ceiling remains 4,800 (reported 4,796).

## Independent unit amendments and second red-first cohort

Laplace accepted Halley's Story and runtime corrections. Five unit suites supply 51 cases, 35 passing and 16 behavioural failures on unchanged validation source: HTTP null diagnosis, later Settings draft ownership, partial bulk feedback, genuine Story SQL failure, boot ordering and operational reporting. All original identities remain. The full111-case receipt has94 passes,16 behavioural failures andone caller-policy coverage failure; that last failure is not a product defect. All150 historical controls pass. Types and focused lint pass.

The remaining caller issue is the explicitly retained `/api/healthz` JSON liveness alias from accepted T-0170. No in-tree caller is claimed. A separate independent exact compatibility disposition will preserve its authority and the existing four operator exceptions. Neither a fake caller nor a new operator ruling is needed. Original and amended receipts remain under `tmp/t0191-green-validation/tmp/t0192-unit-oracle` and `tmp/t0191-green-validation/tmp/t0192-unit-amendment`.

## Independent finite coverage mapping, 2026-10-04

There is **no separate receipt file from this lane**. Below is the actual mapping from the completed inspection at observed HEAD `b009a0be`, including uncommitted changes. This reproduces the checkpoint without new investigation. Test links identify existing coverage; **no tests were loaded or run**.

**gap-055.1: eleven-page ownership**

| Source | Verified ownership and calls | Existing test reference |
|---|---|---|
| [Profiles:101](../../src/app/agent/profiles/page.tsx#L101) | Resource/shared-selection hooks own reads and selection. Page owns sync handlers 177–229, create 262, delete 284, file loading 308, file saving 326, discard decisions 371–406 and metadata saving 425. | [Profile persistence](../../tests/e2e/route-contract-persistence.spec.ts#L13) |
| [Story Reader:26](../../src/app/recroom/story-weaver/[id]/page.tsx#L26) | Page owns active-story publication, controllers/in-flight count, generation 182, Stop 237, edit 328, continue 373, read-status write 422, chapter selection and scroll reset. Body/overlays receive callbacks. | [Reader writes](../../tests/unit/b14-story-reader-writes-on-request.test.tsx), [late ownership](../../tests/unit/client-late-ownership.test.tsx) |
| [Story Create:103](../../src/app/recroom/story-weaver/create/page.tsx#L103) | **Inner `CreateStoryPage`**, not the default wrapper. Owns stored draft, theme/character/library changes and creation/navigation. Resource hooks read libraries; mutation/runWrite paths perform writes. | [Create library/model](../../tests/unit/b14-story-create-library-and-model.test.tsx) |
| [Skills:96](../../src/app/agent/skills/page.tsx#L96) | Hooks own profile/resource reads. Page owns grouping/filtering, previews/editor, pending toggles; import 189, toggle 233, open 270, save 285, preview 305. | [Catalogue](../../tests/unit/skills-catalogue-restructure.test.tsx) |
| [Tools:77](../../src/app/agent/tools/page.tsx#L77) | Resource reads; page-owned JSON draft, dirty/profile-switch refusal and unified controls. Save 172 validates JSON object before PUT; sync 201; discard decisions 235–256. | [Tools page](../../tests/unit/b9-tools-page.test.tsx) |
| [Sessions list:52](../../src/app/results/sessions/page.tsx#L52) | `useSessions` owns reads/polling. Page owns URL filters/paging, debounce, local-storage grouping/collapse and time refresh. No server mutation handler; URL/storage writes remain side effects. | [URL/paging](../../tests/unit/b11-sessions-list-url-and-paging.test.tsx), [refresh](../../tests/unit/b11-sessions-live-refresh.test.tsx) |
| [Dashboard:56](../../src/app/page.tsx#L56) | Dashboard/stat hooks own reads. Page owns preference write, sync 108, cancel/confirmation 147–160 and targeted refresh callbacks. | [Operations board](../../tests/unit/b5-dashboard-is-an-operations-board.test.tsx) |
| [Scripts:105](../../src/app/work/scripts/page.tsx#L105) | Hook owns list/run mutation. Page owns editor read/revision tokens, open 151, save 173, delete 208, run feedback 229, logs 260 and unschedule 273. Unschedule distinguishes PatterStage from hardware cron. | [Names/unschedule](../../tests/unit/b13-scripts-page-names-and-unschedule.test.tsx), [browser ownership cases](../../tests/e2e/route-contract-followups.spec.ts#L139) |
| [Composer:134](../../src/app/work/composer/page.tsx#L134) | Hooks own workflows/runs/detail/profiles and stream. Page owns URL/selection, launch 210, approval 236, cancellation 252 and clarification 271. Children own graph editing/review interaction. | [Run view](../../tests/unit/b12-composer-run-view.test.tsx), [review qualification](../../tests/unit/composer-review-control.test.tsx) |
| [Logs:62](../../src/app/results/logs/page.tsx#L62) | Hook owns reads. Page owns selected-file correction, clear handler 92, search/jump/scroll/refresh, clipboard and download. | [Actions](../../tests/unit/b7-logs-terminal-and-actions.test.tsx), [selection correction](../../tests/unit/logs-page-self-corrects.test.tsx) |
| [Restore:107](../../src/app/agent/settings/restore/page.tsx#L107) | Resource hooks read seed/profile/template state. Page owns scope/confirmation/results, seed POST 157, clean-preview GET 188 and **clean POST** 198, followed by refresh. | [Restore page](../../tests/unit/b6-restore-page.test.tsx) |

**gap-056.2: 61 named-family paths / 104 explicit exports**

Each link identifies the actual route file. Numbers after methods are **export declaration lines**; wrapped implementations may begin earlier. `405` denotes a refusal-only export.

Common boundaries: [proxy entry checks:236](../../src/proxy.ts#L236), [cookie-origin check:347](../../src/proxy.ts#L347), [response settlement guard:4](../../src/lib/api/response-route.ts#L4). Settlement authorisation does not roll back completed mutations. `guardRoute` alone does not provide terminal error conversion.

Test keys in the final column resolve to exact links immediately after the roster.

| Route source | Explicit methods | Validation, effects and retained exceptions | Tests |
|---|---|---|---|
| [agent/profiles](../../src/app/api/agent/profiles/route.ts#L123) | GET 123; POST 139 | GET initialises/reads catalogue and disk-derived state. POST validates name/slug/reserved/duplicate cases; writes catalogue then pushes profile. Push failure is not blanket rollback. | P |
| [agent/profiles/[id]](../../src/app/api/agent/profiles/[id]/route.ts#L23) | PUT 23; DELETE 105; GET 135 **405** | Safe/default-profile restrictions. Rename checks destination then moves directory before DB rename; metadata update and push follow. DELETE removes DB then disk. | P |
| [agent/profiles/[id]/toolsets](../../src/app/api/agent/profiles/[id]/toolsets/route.ts#L22) | GET 22; PUT 43; DELETE 69 **405** | Safe profile; GET hydration may persist, explicitly suppressed under read-only mode. PUT normalises toolsets, applies patch/sync and records event. | P |
| [agent/profiles/sync/import](../../src/app/api/agent/profiles/sync/import/route.ts#L20) | GET 20; POST 26 | Discovery read; optional-body POST selects skills/all/single import. Catalogue mutations. Single failure 500; batch partial failure 200 with explicit failure data. | PS |
| [agent/profiles/sync/pull](../../src/app/api/agent/profiles/sync/pull/route.ts#L40) | POST 40 | Optional body and retained branch precedence; imports/pulls DB state, optionally reconciles disk. Single/batch response distinction retained. | PS |
| [agent/profiles/sync/push](../../src/app/api/agent/profiles/sync/push/route.ts#L40) | POST 40 | Retains root/skills/skillKey/batch/slug precedence. Writes Hermes files and events; single/batch response distinction. | PS |
| [agent/root](../../src/app/api/agent/root/route.ts#L26) | PUT 26; GET 82; POST 84 **405** | PUT validates trimmed metadata and rejects empty patch; writes DB metadata/audit, not root-directory rename. GET reads metadata. | P |
| [analytics/timeseries](../../src/app/api/analytics/timeseries/route.ts#L18) | GET 18 | Validates type/days/bucket; initialises DB and reads aggregates. | A |
| [artifacts](../../src/app/api/artifacts/route.ts#L34) | GET 34; POST 48 | Bounded/filterable list. POST validates content/schema, persists and records event; returns **200**. | AR |
| [artifacts/[id]](../../src/app/api/artifacts/[id]/route.ts#L14) | GET 14; DELETE 27 | Missing-row 404. Successful GET records `artifact.opened`; DELETE removes row. | AR |
| [chat](../../src/app/api/chat/route.ts#L21) | GET 21; POST 25 | Bounded list. POST attempts runtime-session creation/retry, then local conversation creation; backend failure can leave a valid local conversation with null session. | CH |
| [chat/[id]](../../src/app/api/chat/[id]/route.ts#L16) | GET 16; DELETE 26 | Existence checks. GET reconciles pending messages and can write; DELETE removes conversation. | CH |
| [chat/[id]/approval](../../src/app/api/chat/[id]/approval/route.ts#L19) | POST 19 | Conversation existence, required JSON, runId/approved type checks and backend run lookup; resolves runtime approval. | CH |
| [chat/[id]/messages](../../src/app/api/chat/[id]/messages/route.ts#L20) | POST 20; GET 73 **405** | Conversation/content validation; fast or agent dispatch. Failed dispatch preserves identifying fields with 503. | CH |
| [chat/[id]/messages/[messageId]](../../src/app/api/chat/[id]/messages/[messageId]/route.ts#L26) | PATCH 26 | Checks message belongs to conversation, accepted status and optional field types; updates stored message. | CH |
| [chat/[id]/stop](../../src/app/api/chat/[id]/stop/route.ts#L20) | POST 20 | Conversation/body/run checks; no active run returns successful no-op. Backend stop failure is logged; local cancellation still proceeds. | CH |
| [composer/runs](../../src/app/api/composer/runs/route.ts#L38) | GET 38; POST 45 | Composer guard first. Bounded list; POST validates workflow/input, persists run/event and starts detached advancement. | CO |
| [composer/runs/[id]](../../src/app/api/composer/runs/[id]/route.ts#L18) | GET 18 | Composer guard, existence check; returns run/graph/node/approval state. | CO |
| [composer/runs/[id]/cancel](../../src/app/api/composer/runs/[id]/cancel/route.ts#L46) | POST 46 | Guard/existence/state checks; already cancelled is successful. Persists cancellation/audit then detached backend stop. | CO |
| [composer/runs/[id]/clarify](../../src/app/api/composer/runs/[id]/clarify/route.ts#L25) | POST 25 | Guard, answer schema and clarification-state/node checks; updates context/status then advances. | CO |
| [composer/runs/[id]/events](../../src/app/api/composer/runs/[id]/events/route.ts#L43) | GET 43 | Composer guard, DB initialisation; authorised SSE with request signal and terminal-state handling. | CO |
| [composer/runs/[id]/nodes/[nodeId]/approve](../../src/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route.ts#L64) | POST 64 | Guard, specialised action refusal/schema, run/state/gate checks; writes approval/event/context then advances. | CO |
| [composer/workflows](../../src/app/api/composer/workflows/route.ts#L20) | GET 20; POST 27 | Composer guard; definition validation before creation/event; POST 201. | CO |
| [composer/workflows/[id]](../../src/app/api/composer/workflows/[id]/route.ts#L35) | GET 35; DELETE 80; PUT 111 | Guard/existence checks. PUT validates graph. PUT/DELETE refuse active runs and protect history unless explicitly discarded; specialised 409 includes confirmation information. | CO |
| [config](../../src/app/api/config/route.ts#L56) | GET 56; PUT 72 | GET masks secrets and can report parse metadata with 200. PUT schema/section/value checks, backup, YAML parsing/merge/write/event/audit. **Backup precedes corrupt-YAML 409.** | CF |
| [credentials](../../src/app/api/credentials/route.ts#L22) | GET 22; POST 74 | Hint-only list; provider/key schema and unsupported-provider refusal. Create then environment sync; compensating DB deletion on sync failure. | CR |
| [credentials/[id]](../../src/app/api/credentials/[id]/route.ts#L72) | PATCH 72; DELETE 119; GET 174 **405** | Rotation schema/existence checks; DB update, env sync and compensating old-key restoration. DELETE can succeed while reporting env-cleanup error in 200 response. | CR |
| [fs/git/branches](../../src/app/api/fs/git/branches/route.ts#L12) | GET 12 | Required allowed-workspace path; delegates local Git metadata execution. | FS |
| [fs/list](../../src/app/api/fs/list/route.ts#L14) | GET 14 | Allowed-workspace and directory checks; directory/stat reads, skips individual stat failures; only returns allowed parent. | FS |
| [laboratory/research](../../src/app/api/laboratory/research/route.ts#L38) | GET 38; POST 43 | Bounded list; query/config schema; persists run/event then starts detached research; POST 201. | RE |
| [laboratory/research/[id]](../../src/app/api/laboratory/research/[id]/route.ts#L15) | GET 15 | Existence check; returns run/steps. | RE |
| [laboratory/research/[id]/cancel](../../src/app/api/laboratory/research/[id]/cancel/route.ts#L20) | POST 20 | Missing 404; finished-state refusal 409; cancellation write/event. | RE |
| [laboratory/research/[id]/events](../../src/app/api/laboratory/research/[id]/events/route.ts#L38) | GET 38 | DB initialisation; authorised SSE with signal and terminal-state handling. | RE |
| [laboratory/research/[id]/export](../../src/app/api/laboratory/research/[id]/export/route.ts#L33) | GET 33 | HTML export; absent run returns **plain-text 404**, not generic JSON. | RE |
| [laboratory/research/presets](../../src/app/api/laboratory/research/presets/route.ts#L32) | GET 32; POST 37; DELETE 44 | Read presets; POST validates/persists, 201. DELETE requires query ID, but does not require an existing row before successful response. | RE |
| [logs](../../src/app/api/logs/route.ts#L49) | GET 49; DELETE 129 | Safe filename/path resolution; specialised missing-directory/file responses. GET records `logs.opened`. DELETE clears contents of one/all listed logs rather than unlinking files. | LG |
| [models](../../src/app/api/models/route.ts#L22) | GET 22; POST 59 | Bounded list/schema; creates registry row, conditionally syncs defaults, compensates creation on sync failure. | MO |
| [models/[id]](../../src/app/api/models/[id]/route.ts#L18) | GET 18; PUT 25; DELETE 42 | Lookup/schema checks; DB update/delete and configuration finalisation/audit. Do not infer cross-resource atomicity. | MO |
| [models/[id]/diff](../../src/app/api/models/[id]/diff/route.ts#L65) | POST 65; GET 158 **405** | Direction schema and model lookup; masked comparison preview. Corrupt config produces diagnostic preview output; POST is not a mutation here. | MO |
| [models/defaults](../../src/app/api/models/defaults/route.ts#L63) | GET 63; PUT 117 | Readiness/default read; PUT validates, persists defaults and finalises config. May return defaults **plus error** with 200; unknown model 404. | MO |
| [models/fallbacks](../../src/app/api/models/fallbacks/route.ts#L34) | GET 34; POST 139 | Discriminated add/toggle/reorder/custom/import/sync. Reorder swaps transactionally; edge reorder no-op. DB/YAML effects and specialised sync-error response retained. | FB |
| [models/fallbacks/[id]](../../src/app/api/models/fallbacks/[id]/route.ts#L13) | GET 13; PUT 22; DELETE 36 | Schema/existence checks; entry mutation then commit/sync. | FB |
| [models/fallbacks/config](../../src/app/api/models/fallbacks/config/route.ts#L14) | GET 14; PUT 18 | Config schema; DB update before enabled-chain sync and audit. | FB |
| [models/import](../../src/app/api/models/import/route.ts#L27) | GET 27; POST 48 | Masked preview; POST imports models/credentials/links with per-item skipped/error handling and summary response. | MO |
| [models/sync/drift](../../src/app/api/models/sync/drift/route.ts#L12) | GET 12 | Reads drift diagnosis; no explicit route-level mutation. | MO |
| [models/sync/pull](../../src/app/api/models/sync/pull/route.ts#L107) | POST 107 | Optional model/exclusions schema; reads config, targeted missing-model refusal, filters fields and updates registry. No matching section can return informational 200. | MO |
| [models/sync/push](../../src/app/api/models/sync/push/route.ts#L71) | POST 71 | Required model ID/schema; model push refusal stops credential work. Subsequent credential push failure is nonfatal after model success. | MO |
| [monitor](../../src/app/api/monitor/route.ts#L39) | GET 39 | Initialises sync infrastructure; aggregates sessions, health and scheduler state. Not a uniformly pure read. | ST |
| [schedules](../../src/app/api/schedules/route.ts#L38) | GET 38; POST 42 | Bounded list; POST schema/target checks, shared schedule validation, next-run computation, persistence/event; 201. | SC |
| [schedules/[id]](../../src/app/api/schedules/[id]/route.ts#L29) | GET 29; PATCH 36; DELETE 64 | Lookup/refusal semantics. PATCH validates supplied expression; omission preserves stored next run. DELETE missing row 404. | SC |
| [schedules/[id]/run](../../src/app/api/schedules/[id]/run/route.ts#L15) | POST 15 | Requires existing schedule/linked mission. Dispatches and **records attempt even on failure**; manual run does not advance schedule. | SC |
| [sessions](../../src/app/api/sessions/route.ts#L36) | GET 36; POST 93 | GET rate limit/query checks; list may trigger sync outside read-only mode. POST create/update action validation and persistence; not a blanket strict-object schema. | SE |
| [sessions/[id]](../../src/app/api/sessions/[id]/route.ts#L296) | GET 296 | Rate limit and safe ID before reads; DB/file fallbacks, size refusal, tolerant JSONL handling and specialised failure paths. | SE |
| [skills](../../src/app/api/skills/route.ts#L17) | GET 17 | Safe/existing profile; merges catalogue/disk skills and effective disabled state. Disabled-state resolver itself reads without persistence. | SK |
| [skills/[...path]](../../src/app/api/skills/[...path]/route.ts#L10) | GET 10 | Resolves path under skills root; shared viewer result or 404. | SK |
| [skills/[name]](../../src/app/api/skills/[name]/route.ts#L12) | GET 12; PUT 30 | GET shared view. PUT checks content string, writes catalogue/frontmatter then pushes disk; push failure does not establish rollback. | SK |
| [skills/[name]/toggle](../../src/app/api/skills/[name]/toggle/route.ts#L29) | PUT 29; GET 95 **405**; POST 97 **405** | Boolean/profile/known-skill checks; applies disabled-list root/profile patch and event. | SK |
| [status](../../src/app/api/status/route.ts#L22) | GET 22 | Initialises sync layer, reads status/counts. | ST |
| [status/runtime](../../src/app/api/status/runtime/route.ts#L12) | GET 12 | Composition root supplies real gateway resolver result to runtime collector; diagnostic redaction retained. | ST |
| [status/subsystems](../../src/app/api/status/subsystems/route.ts#L11) | GET 11 | Initialises sync layer and performs subsystem health probes. | ST |
| [sync](../../src/app/api/sync/route.ts#L99) | GET 99; POST 100 | GET initialises/reads scheduler. POST single/full sync; unsuccessful source outcomes may remain 200. Missing scheduler/terminal failure 500; POST retains dynamic error prefix. | SY |

**Existing route-test references**

These are bounded references, **not proof that every method in the associated family is tested**.

| Key | Exact references and limits |
|---|---|
| P | [profiles-api:346](../../tests/unit/profiles-api.test.ts#L346), [toolsets:37](../../tests/unit/profiles-toolsets-api.test.ts#L37), [persisted rename/refusal:13](../../tests/e2e/route-contract-persistence.spec.ts#L13). |
| PS | [single/batch outcome contracts:77](../../tests/unit/b1-sync-routes-answer-with-the-outcome.test.ts#L77). |
| A | [timeseries query forwarding:42](../../tests/unit/analytics-route.test.ts#L42). |
| AR | [artifact read event:65](../../tests/unit/b17-the-two-read-events.test.ts#L65), [creation event](../../tests/unit/b4-emits-scripts-records.test.ts). |
| CH | [session-title retry](../../tests/unit/chat-title-collision-retries.test.ts), [message dispatch failure IDs:327](../../tests/unit/chat-failure-truth.test.ts#L327). These do **not** establish complete approval/PATCH/stop runtime coverage. |
| CO | [events flag guard](../../tests/unit/b1-composer-events-honour-the-flag.test.ts), [mutation/event/refusal cases](../../tests/unit/b4-emits-research-composer.test.ts), [workflow deletion](../../tests/unit/b12-workflow-delete-route.test.ts). |
| CF | [corrupt YAML refusal](../../tests/unit/config-put-refuses-unparseable-yaml.test.ts), [deep merge](../../tests/unit/config-put-deep-merge.test.ts). |
| CR | [credential API:61](../../tests/unit/credentials-api.test.ts#L61), [deletion compensation/partial outcome](../../tests/unit/deleting-a-credential-is-careful.test.ts). |
| FS | [directory API:45](../../tests/unit/fs-list-api.test.ts#L45), [Git API:26](../../tests/unit/fs-git-branches-api.test.ts#L26). |
| RE | [cancellation/refusals:175](../../tests/unit/b14-research-cancel.test.ts#L175), [creation/events](../../tests/unit/b4-emits-research-composer.test.ts). Export/preset runtime completeness remains unestablished. |
| LG | [logs API:117](../../tests/unit/logs-api-route.test.ts#L117), [read-event source assertion:94](../../tests/unit/b17-the-two-read-events.test.ts#L94). The latter is explicitly structural, not a driven logs request. |
| MO | [diff contracts:192](../../tests/unit/b6-models-diff-route.test.ts#L192), [push refusal/nonfatal credential failure:153](../../tests/unit/route-local-catch-contract.test.ts#L153), [partial defaults browser case:79](../../tests/e2e/route-contract-followups.spec.ts#L79). |
| FB | [action contracts:57](../../tests/unit/fallbacks-action-route.test.ts#L57), [real DB/YAML persistence:48](../../tests/e2e/route-contract-persistence.spec.ts#L48). |
| SC | [schedule API:60](../../tests/unit/schedules-api.test.ts#L60), [persisted refusal/precedence contracts:17](../../tests/e2e/schedule-validation-contract.spec.ts#L17). |
| SE | [query defaults](../../tests/unit/b11-sessions-route-and-url-defaults.test.ts), [rate limit](../../tests/unit/sessions-list-is-rate-limited.test.ts), [invalid ID before reads:139](../../tests/unit/route-local-catch-contract.test.ts#L139). |
| SK | [skill PUT](../../tests/unit/skills-put-route.test.ts), [toggle parser:68](../../tests/unit/skills-toggle-auth.test.ts), [shared viewer contracts:120](../../tests/unit/b9-tools-and-skills-routes.test.ts#L120). |
| ST | [monitor source errors](../../tests/unit/monitor-sync-source-errors.test.ts), [runtime/boot composition](../../tests/unit/runtime-operational-consistency.test.ts), [subsystems](../../tests/unit/subsystems-route-and-panel.test.tsx). |
| SY | [sync API](../../tests/unit/sync-api-route.test.ts), [exact catch compatibility:158](../../tests/unit/api-route-public-contract.test.ts#L158). |

**Eight additional matches from the plan’s unanchored search**

These add **12 exports**, giving the literal-search scope **69 paths / 116 exports**.

| Source | Methods | Verified contract / existing reference |
|---|---|---|
| [admin/sessions/backfill-status:38](../../src/app/api/admin/sessions/backfill-status/route.ts#L38) | POST 88; GET 89 **405** | Default dry-run; exact `dryRun:false` applies sweep. Preview still audits. Preserve JSON-null/parser distinctions. [Oracle:202](../../tests/unit/api-route-public-contract.test.ts#L202). |
| [auth/sessions/list:6](../../src/app/api/auth/sessions/list/route.ts#L6) | POST 6 | Fresh operator credential, not browser cookie alone; session list or specialised 503. [Auth contract:52](../../tests/unit/t0158-session-proxy.test.ts#L52). |
| [auth/sessions/revoke:6](../../src/app/api/auth/sessions/revoke/route.ts#L6) | POST 6 | Fresh credential; identifier aliases/shape validation; revocation, missing 404 or storage 503. Same auth suite. |
| [gateway/models:18](../../src/app/api/gateway/models/route.ts#L18) | GET 45 | Upstream request; failure deliberately returns 200 with empty models. [Suite](../../tests/unit/gateway-models-route.test.ts). |
| [memory/config:46](../../src/app/api/memory/config/route.ts#L46) | GET 46; PUT 51; POST 74 | GET providers; PUT schema/DB update, optional Hermes write and event; POST validates and performs provider health request. [Configuration/event suite](../../tests/unit/b4-emits-memory-missions-templates.test.ts). |
| [orchestration/chat:122](../../src/app/api/orchestration/chat/route.ts#L122) | POST 177 | Nonempty messages; gateway inference request, default streaming, upstream abort, timed/per-chunk authorisation and specialised failures. [Revocation suite](../../tests/unit/t0158-chat-revocation.test.ts). |
| [prefs:12](../../src/app/api/prefs/route.ts#L12) | GET 12; PUT 16 | Accidental `fs` substring match. Allowed key/value validation before persistence; specialised malformed-body refusal. [Preferences suite](../../tests/unit/b3-operator-prefs.test.ts). |
| [scripts/logs:12](../../src/app/api/scripts/logs/route.ts#L12) | GET 25 | Required name, positive line count capped at 2,000; delegated log read. Missing log returns empty text and `hasLog:false`. [Catch contract:106](../../tests/unit/route-local-catch-contract.test.ts#L106). |

**gap-063.2: repeatable methods and limits**

Static route inspection compared TypeScript HTTP exports, including export aliases, against the [frozen inventory](../../tests/fixtures/api-route-contract-baseline.json#L1). For the 61 named-family paths it observed **no additions, omissions or changed method sets**. Implicit framework HEAD/OPTIONS were excluded.

The [caller oracle:145](../../tests/unit/api-route-caller-gate.test.ts#L145) examines recognised HTTP calls, traced wrappers and finite expressions across source/scripts/e2e/integration. It establishes **path references**, not method coverage. Preserve its four separate operator exceptions and the separate `/api/healthz` compatibility ruling.

Page-shape reconstruction used TypeScript AST, immediate function-body statements, one-based `getStart()` lines and `trimEnd().split(/\r?\n/)` file length:

| Page | Function start → first top-level `if`/`return`; total lines |
|---|---|
| Profiles | `101 → 492; 592` |
| Story Reader | `26 → 38; 600` |
| Story Create inner | `103 → 508; 749` |
| Skills | `96 → 334; 410` |
| Tools | `77 → 263; 495` |
| Sessions list | `52 → 210; 307` |
| Dashboard | `56 → 205; 434` |
| Scripts | `105 → 296; 401` |
| Composer | `134 → 283; 542` |
| Logs | `62 → 202; 377` |
| Restore | `107 → 245; 528` |

Reader’s early `if` truncates that metric while substantial handlers remain. **Do not treat its small prelude as a successful extraction or repeat the historical counts as current.**

**Open at handback:** coordinator transcription and roster selection; method-complete runtime evidence; final gate/independent/hosted qualification. The reported K6 fixture, T0200 claim and 12-versus-13 documentation failures remain coordinator/Nash-owned. No blanket “done”, transaction-atomicity or acceptance claim is supported by this read-only mapping.

## Candidate gate checkpoint, 2026-10-04

All ten stages passed on an unchanged tree in `tmp/t0192-coordinator-gate-1791079520716/gate/summary.json`: 8,815 unit tests and 497 browser tests passed; the existing nine unit and 24 browser skips remain recorded. Both build-purity cases and both censuses passed. This supersedes the earlier gate failures, whose receipts remain preserved. The batch remains active pending mutation evidence, remaining review obligations, independent acceptance and hosted checks.
