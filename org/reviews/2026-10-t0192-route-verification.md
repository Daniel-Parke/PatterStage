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
| **01** | [boot-diagnostics.ts:46](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/deploy/boot-diagnostics.ts:46) recognises `0/false`; [feature-flags.ts:15](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/feature-flags.ts:15) also recognises `no/off`. | **Needs fix.** Operational reporting must match actual flag behaviour. In-process proof remains required. |
| **02** | [runtime-status.ts:77](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/status/runtime-status.ts:77) reads gateway env/default; [agent-runtime.ts:31](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/modules/hermes/lib/agent-runtime.ts:31) derives endpoints from `PS_LLM_API` too. | **Needs fix.** Test the full chat-completions URL case; a bare base URL does not prove the historical mismatch. |
| **03** | Different readers remain: [feature-flags.ts:15](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/feature-flags.ts:15), [boot-diagnostics.ts:46](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/deploy/boot-diagnostics.ts:46), [env loader:26](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/_env-local.mjs:26). | **Retained vocabulary; bounded convergence outstanding.** Existing split **03a→T0196**, **03b→T0194** governs tooling vocabulary and shared registry migration. T0192 fixes its operational mismatches without inventing a universal boolean parser. |
| **04** | [env loader:13](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/_env-local.mjs:13) retains supported legacy names and bridge handling. | **Deferred retirement.** **04a/04b→T0200**, first post-v1.0 under Q033. Preserve aliases and signing compatibility now. |
| **05** | `rg -n 'PS_DEPLOY_STATUS_FILE\|PS_LOG_RETENTION_DAYS\|PS_RUNTIME_LOG' docs/running/env-reference.md scripts/tooling/ps-deploy.mjs scripts/hardware/ps-log-rotate.mjs` finds live readers at deploy **82/84**, rotation **22**, but no reference rows. | **Needs documentation fix.** Three current omissions established; historical “12” not recounted. Preserve `CH_URL` fallback; regenerate derived manifest. |
| **06 + OP** | [eslint.config.mjs:25](C:/Users/Daniel/Documents/Coding/Github/PatterStage/eslint.config.mjs:25) has no scoped require-import override; [jest.config.js:1](C:/Users/Daniel/Documents/Coding/Github/PatterStage/jest.config.js:1) retains suppression. Current `rg -n 'no-require-imports' tests` returned **312 text hits**. | **Needs ruled consolidation:** override **and keep unique reasons**, atomically remove redundant directives. Neither historical 285 nor prior 294 is current. Text hits are not an AST deletion list; active oracle additions can change them. |
| **07 + OP** | [feature-flags.ts:15](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/feature-flags.ts:15); [Composer runs:39/47](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/composer/runs/route.ts:39) repeat guards. | **Retained flag; guard consolidation outstanding.** Ruling is “keep, one-line guards”. Preserve explicit-off behaviour and exact 503 response, not a 404 helper substitution. |
| **08 + OP** | Five TS copies remain, e.g. [seed-catalog.ts:15–32](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/seed-catalog.ts:15). They strip paired quotes and preserve existing env values. [ESM loader:48/60](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/_env-local.mjs:48) retains quotes and overwrites inherited values; its whitelist at **8** excludes file-sourced `CONTROL_HUB_DATA_DIR`. | **Needs fix and ruled deduplication.** Preserve **shell-wins TS scripts / file-wins deploy**, strip surrounding quotes and retain supported aliases. Deploy calls the loader at [523](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/ps-deploy.mjs:523). Restart/precedence proof remains required. |
| **09** | [tsconfig.json:33](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tsconfig.json:33) still excludes `scripts` and `trace_import.ts`. | **Needs bounded tooling proof/fix.** No current scripts typecheck established here; do not claim adding scripts will be clean or silently broaden the application compilation boundary. |
| **10** | [Story crud:19–21](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/modules/rec-room/handlers/crud.ts:19) retains direct envelopes; [api-logger.ts:16](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/api/api-logger.ts:16) is the shared logging boundary. | **Consolidate only equivalent contracts.** Coordinate with Nash’s route matrix; preserve statuses, text, nested Hindsight responses and partial-success envelopes. Historical count is not a conversion list. |
| **11 + OP** | [instrumentation.ts:31/50](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/instrumentation.ts:31) retains `[auth]/[config]`; [config-sync.ts:93/207](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/modules/hermes/lib/config-sync.ts:93) still uses function-name tags. | **Needs ruled tag reconciliation.** Closed tag list, keeping `[auth]/[config]`. Classify server/client/CLI paths before changing messages; no blanket console replacement. |
| **12** | [utils.ts:36/57/87](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/utils.ts:36), [mission-run-state.ts:92](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/missions/mission-run-state.ts:92), [ElapsedSince.tsx:16](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/composer/ElapsedSince.tsx:16). | **Consolidate only if equivalent and net-positive.** Relative, future, elapsed and ticking clock formats differ. Preserve the deliberate ticker; no general “one time formatter” mandate. |
| **13** | [ScriptRow.tsx:18](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/scripts/ScriptRow.tsx:18) emits compact units; [SessionCard.tsx:113](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/session/SessionCard.tsx:113) fixed one-decimal KB; [utils.ts:108](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/utils.ts:108) strips trailing zeros. | **Consolidate only if net-positive with preserved formatting.** These are observable differences. A single new rounding convention needs an explicit choice; preserving existing output avoids that decision. |
| **14** | [Chat MessageBubble:105](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/chat/MessageBubble.tsx:105) uses shared Markdown; [SimpleMarkdown:43/50](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/skills/SimpleMarkdown.tsx:43) has Copy and guarded links. | **Already satisfied for 14b by T0191.** **14a→T0194** owns escape-helper convergence. Preserve Research renderer and proxy exclusion; do not redo or silently reassign these splits. |
| **15** | [utils.ts:114](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/utils.ts:114) exports `truncate`; [mission-repository.ts:65–69](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/missions/mission-repository.ts:65) actively uses `safeJsonParse`. | **Retain live helper; assess only narrow dead export.** “Dead utils” is false as a compound claim. A complete symbol/import check is still needed before retiring `truncate`; CSS `truncate` hits are irrelevant. |
| **16 + OP** | [templates create:21](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/templates-handlers/create.ts:21) still builds timestamp/random IDs. | **Needs ruled UUID change for new IDs**, preserving stored IDs. Other helper bypasses require semantic comparison; do not mechanically replace differing error fallbacks or cross-runtime sleep helpers. |
| **17** | [api-fetch.ts:97](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/api/api-fetch.ts:97) defaults to `any`; [template shared:30](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/templates-handlers/shared.ts:30) retains body escape hatch; [Models page:181](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/agent/models/page.tsx:181) retains dependency suppressions. | **Consolidate/narrow only with caller proof.** Static escapes do not establish runtime bugs. Broad `unknown` migration or fetch-mock replacement is not discharged by the narrow JSON-null repair. |
| **18** | [ApiCredential:12](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/models/types.ts:12) duplicates [CredentialSummary:14](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/models/credentials-repository.ts:14). `rg -n 'import.*@/components/' src/lib` still finds analytics/API type imports. | **Measured convergence candidate**, already explicitly claimed for credentials. Preserve public hint-only projection, aliases where useful and private `CredentialWithKey`. Other type moves need individual net/consumer evidence. |
| **19** | [repository:361](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/missions/mission-category-repository.ts:361) duplicates [seed SQL:1](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/db/seeds/001_mission_categories.sql:1). | **Consolidate only if net-positive and deployment-safe.** Preserve boot/reset availability, packaging and existing `ch.cat.*` uniqueness keys; do not edit protected historical seed content without applicable authority. |
| **20** | [home.ts:19](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/modules/hermes/lib/home.ts:19), [agent-runtime.ts:15](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/modules/hermes/lib/agent-runtime.ts:15), [discover-agents.mjs:21](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/discover-agents.mjs:21). | **Consolidate only if net-positive across runtimes.** Preserve env/active-profile/default distinctions and aliases. A TS helper cannot automatically replace standalone MJS behaviour. |
| **21** | [useSelectedProfile.ts:38/53](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/hooks/useSelectedProfile.ts:38), [mission-composer-utils.ts:37/46](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/missions/mission-composer-utils.ts:37) guard storage; `useStoredBool` retains legacy migration. | **Already satisfied/retained:** **21a→T0190**; **21b ruled out existing-key renames**. Migration retirement is distinct and remains post-v1.0. |
| **22 + OP** | [package.json:94](C:/Users/Daniel/Documents/Coding/Github/PatterStage/package.json:94) retains `ts-jest`; [knip.json:25/28](C:/Users/Daniel/Documents/Coding/Github/PatterStage/knip.json:25) ignores `ts-jest/jsdom`. | **Needs dependency/tooling reconciliation.** Ruling is “all fixes **except next.config.ts**”. Verify direct `jsdom` use/declaration and dependency consumers; successful current Knip cannot prove an ignored dependency unused. |
| **23** | [seed SQL:3–10](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/db/seeds/001_mission_categories.sql:3) preserves `ch.cat.*`; non-hook helper modules remain under hooks. | **Retained historical names/keys.** **23a/23b prohibit churn; 23c→T0195** documents new subject-first naming. Remaining helper relocation is only a measured candidate, not required historical renaming. |

### Cross-cutting coverage

| Coverage | Current evidence and qualified conclusion |
|---|---|
| **059.1** | Reuse T0191 token/removal evidence and current stylesheet. **Already satisfied only within that bounded token scope**; do not claim a fresh complete CSS audit. |
| **060.1–2** | [proxy.ts:167](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/proxy.ts:167) still emits `#05080d/#eaf2f8` in standalone refusal HTML. **Source observation satisfied; standalone visual/contrast judgement remains.** No automatic stylesheet import or redesign. |
| **081.b** | [WorkflowCanvas:34](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/composer/WorkflowCanvas.tsx:34) imports React Flow; Composer page imports `next/dynamic` and documents conditional loading. **Source topology partly established**, not current bundle-cost proof. Classify client entry reachability before claiming YAML/Zod shipping costs. |
| **084.a–b** | Exact mismatches in findings 01/02 above. **Needs fix; source evidence current.** |
| **084.c** | **Process proof outstanding.** This read-only pass ran no boot/status fixture. |
| **085.b** | Findings 17’s concrete sites remain. **Full consequence classification outstanding**; historical “253” is not a current verified inventory. |
| **087.a** | Distinct deliberate API errors and semantic-feedback paths remain. **Inventory/classification outstanding**; preserve messages unless an explicit bug-fix exception applies. |
| **088.a** | `rg -n '@/modules/' src/lib` finds **six static import declarations in five files**, plus two import-type expressions in `modules/server.ts`; comments are separate hits. **Current source recount satisfied.** |
| **088.b** | [ADR-0005:286–298](C:/Users/Daniel/Documents/Coding/Github/PatterStage/org/decisions/ADR-0005-product-modules.md:286) explicitly permits the provider-list import and three composition points: modules, frameworks and runtime. **Retained explained boundaries**, not six new violations. |

### Claim reconciliation before any additional work

The opening’s [scope note](C:/Users/Daniel/Documents/Coding/Github/PatterStage/org/tasks/T-0192.json:341) explicitly requires all obligations to be dispositioned; initial claims are not an exemption.

- **08 is not automatically transferred to T0196.** `tooling-09→T0196` overlaps the same five TS parsers. Record one execution owner and shared completion evidence. If T0192 implements its explicit ruling, add the five parser files, `_env-local.mjs`, any shared destination and env documentation as exact claims; preserve T0196’s historical attribution without repeating the extraction.
- **06/09/22 remain T0192-owned despite being tooling work.** Current claims omit `eslint.config.mjs`, `jest.config.js`, affected directive files, TS configurations, `package.json`, lockfile and `knip.json`. Select and claim the exact cohort before changes; do not hand it away merely because of its directory.
- **03/14/21/23 have actual existing split owners/rulings.** Preserve those boundaries rather than treating every parent finding as wholly executable in T0192.
- **05/11/16/19/20 extend beyond current claims.** Their documentation, logging, template-ID, category-seed and cross-runtime home cohorts need explicit selection/claims and preservation evidence. The two active oracle packages do not silently cover them.

The principal unresolved decision is **scope coordination for the overlapping env-parser cohort**. No new operator choice is needed to execute its existing two-precedence ruling. Changing formatter output or weakening existing compatibility would be a separate decision, not implied consolidation authority.

Reviewer session `01a10198-6b4f-7593-aa19-e0b3c8facad8`:

**App-side disposition support is below. This is source evidence, not closure of runtime obligations.** No writes, tests, builds or oracle changes. Halley’s cross-cutting inventory remains separate.

The opening [dispositions](C:/Users/Daniel/Documents/Coding/Github/PatterStage/org/reviews/2026-10-t0192-dispositions.json) are provisional. Historical counts and proposed savings must not become current acceptance evidence.

### App findings

| Item | Current evidence | Ruling and bounded conclusion |
|---|---|---|
| **app-02: template prop forwarding** | [useMissionsPage.ts:158](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/hooks/useMissionsPage.ts:158) still individually re-exports template state; [missions/page.tsx:250](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/work/missions/page.tsx:250) forwards it into the modal. | **Consolidation only if net-positive.** Bundle the existing draft boundary rather than repeat T0190 hook extraction. Include modal, hook, consumer and fixture costs. `b10-template-editor-has-its-own-draft.test.tsx` tests the hook, not modal rendering; it cannot alone prove the new prop boundary. |
| **app-04: catch census** | [line-census.mjs](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/line-census.mjs) already detects hand-rolled log-and-500 catches. | **Detector already repaired.** Do not count another detector implementation as T0192 work. The opening’s 18-route/25-site result still needs its exact receipt bound to closure. Response conversion is separate app-04b work. |
| **app-05: parameterised catches** | Surviving sites include [missions:82](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/missions/route.ts:82), [scripts/logs:23](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/scripts/logs/route.ts:23), [scripts/run:53](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/scripts/run/route.ts:53), [models/sync/push:69](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/models/sync/push/route.ts:69), [agent/files:200](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/agent/files/[key]/route.ts:200), [sessions/detail:293](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/sessions/[id]/route.ts:293), [models/fallbacks:137](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/models/fallbacks/route.ts:137). | **Consolidation remains.** Existing `RouteText` resolves route params; several log contexts instead derive from query/body/local state. Do not replace those with params-only messages. Each conversion needs exact log context, one-log behaviour, response and side-effect preservation. The historical “seven of thirteen” is not a current population count. |
| **app-06: duplicate read-only guards** | Current route search leaves host controls in [cron/hardware:45](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/cron/hardware/route.ts:45), [scripts/name:37](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/scripts/[name]/route.ts:37), [scripts/run:22](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/scripts/run/route.ts:22), plus GET-side suppression in sessions, stats and profile toolsets. [proxy.ts:236](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/proxy.ts:236) distinguishes lifecycle writes. | **Broad non-host removal already implemented; remaining exceptions retained.** Preserve auth lifecycle writes and GET suppression. Handler-unit calls do not establish proxy coverage. Reuse framework/session/read-only tests rather than repeat the old removal. |
| **app-07: route context types** | Current read-only count: **19 `interface Ctx`, six `type Ctx` declarations**. Examples: [schedules/id:16](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/schedules/[id]/route.ts:16), [approval:62](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route.ts:62). | **Consolidation only after whole-cohort count.** Preserve Promise params, multiple keys and catch-all arrays. A `Record<K,string>` abstraction does not cover `path:string[]`. Inline annotations often save no physical lines; imports/helper costs count. |
| **app-08: overlapping error boundaries** | [layout.tsx:150](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/layout.tsx:150) still wraps children in `ErrorBoundary`; `app/error.tsx` also exists. No `app/global-error.tsx`. | **Retain pending runtime proof.** A page throw reaching the inner fallback does not prove the outer boundary redundant when that fallback fails. Existing `t0182-global-error.spec.ts` checks useful fallback heading/CSP, not equivalence of removing the wrapper. |
| **app-09: loading/error/not-found surfaces** | Session detail already has [loading/error handling:130](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/results/sessions/[id]/page.tsx:130) and [PageHeader:171](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/results/sessions/[id]/page.tsx:171). Skill detail has [loading:76](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/agent/skills/[...path]/page.tsx:76) and [PageHeader:112](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/agent/skills/[...path]/page.tsx:112). | **Partially completed; remaining visual convergence needs evidence.** Do not redo T0191’s session-heading repair. Distinguish initial loading, stale-data refresh, failed read and genuine missing resource. Models’ aggregate-loading delay remains an unresolved latency issue, not evidence of a state race. |
| **app-10: `toastElement`** | [Toast.tsx:195](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/components/ui/Toast.tsx:195) documents shell ownership; the fallback element is still constructed below it. | **Product-shell redundancy, not universally dead code.** Preserve standalone/test consumers. Any removal needs a complete consumer migration and net count; do not delete the fallback merely because shell consumers receive `null`. |
| **app-11: schedule validation** | Four relevant paths still check interval feasibility/bounds: [schedule create:62](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/schedules/route.ts:62), [schedule update:54](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/schedules/[id]/route.ts:54), [mission promotion:105](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/missions/mission-promote-handler.ts:105), [dispatch:135](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/missions/mission-handlers/dispatch.ts:135). | **Equivalent validation may consolidate; result boundaries stay distinct.** Preserve exact refusal words, next-run calculation, partial-update behaviour and no write/dispatch on refusal. Reuse schedule parsing/bounds and mission-dispatch tests. A helper should return domain validation data, not force all callers into one HTTP shape. |
| **app-12: envelopes** | Plain candidates remain in [sync/route.ts:21](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/sync/route.ts:21) and [status/route.ts:31](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/status/route.ts:31). | **Consolidation only for exact factory equivalents.** Earlier projected −18 lines remains a proposal, not delivered savings. Retain auth/health raw bodies, cookies, Hindsight nested errors, migration metadata, streaming and HTTP200 partial-success contracts. |
| **app-13: Composer flag guards** | The exact disabled sentence remains at 12 sites across Composer routes, including [runs:40](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/composer/runs/route.ts:40) and [events:30](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/composer/runs/[id]/events/route.ts:30). | **Consolidation candidate, not permission to alter gating.** Preserve 503/body and guard-before-read/write/stream ordering. `b1-composer-events-honour-the-flag.test.ts` is relevant existing coverage. Halley owns the cross-cutting flag-semantics mapping. |
| **app-14: large pages** | Current roster still contains 11 substantial pages; examples include [profiles:24](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/agent/profiles/page.tsx:24), [Skills:120](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/agent/skills/page.tsx:120), [Composer:55](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/work/composer/page.tsx:55). They already use domain hooks alongside local state. | **No blanket extraction.** Large size is not proof of a defect or savings. App-02’s narrower prop fold is more concrete. Preserve T0190/T0191 ownership fixes; any extraction must count destinations/imports and preserve source-pinned historical identities through authorised amendments. |
| **app-16: boot recovery order** | [instrumentation.ts:79–90](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/instrumentation.ts:79) starts sync/scheduler/catalog before recovery beginning at 92. | **Needed ruled repair.** OP explicitly says **“Fail fast, sweeps first.”** Preserve fatal sync/scheduler failure; do not introduce catch-and-continue. Independent injected-failure evidence must show recovery preceding failure. `boot-says-how-it-is-configured.test.ts` tests reporting, not this ordering. |
| **app-17: thick routes** | Historical cohort remains agent/files, sessions/detail, agent/profiles, Hindsight and mission-categories. Session helpers already exist in [session-detail.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/sessions/session-detail.ts). | **Partially extracted; further movement only with measured benefit.** Moving a body into `src/lib` is zero consolidation by itself. Preserve response guards, auth order, streaming, write effects and domain-specific catches. |
| **app-18: body parsing** | Raw exceptions remain in [prefs:17](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/prefs/route.ts:17), [update:107](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/update/route.ts:107), [backfill:41](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/admin/sessions/backfill-status/route.ts:41). Shared required/optional/schema parsers already exist. | **OP: “Keep sentences, convert the rest.”** Distinguish absent, malformed, `null`, array, primitive and object. Backfill’s default is dry-run true; prefs has bespoke wording; update defaults action and retains signature/deploy guards. No global object-validation change under a consolidation claim. |
| **app-19: misleading comments** | [stories/route.ts:3](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/stories/route.ts:3) names the obsolete `src/lib/story-handlers`; [backfill:43–45](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/admin/sessions/backfill-status/route.ts:43) has contradictory default commentary. | **Specific documentation corrections needed.** Record exact surviving sites; do not claim the entire historical comment inventory repaired from these examples. Avoid counting unrelated narration removal as behavioural consolidation. |
| **app-20: duplicate gateway fetch** | [chat fetch:72–115](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/orchestration/chat/route.ts:72) versus [gateway-client.ts:28](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/models/gateway-client.ts:28). | **Not a drop-in fold.** Details below. Savings remain unproved once timeout/signal/auth compatibility is included. |
| **app-21: CH aliases** | [next.config.ts:9](C:/Users/Daniel/Documents/Coding/Github/PatterStage/next.config.ts:9) retains `CH_ALLOWED_DEV_ORIGINS`; [profiles/sync/pull:52](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/agent/profiles/sync/pull/route.ts:52) retains `CH_PULL_RECONCILE_DISK`. | **Retained under release-dependent retirement policy.** No T0192 deletion. Existing warning/migration work is separate from retirement; T0200 dependency remains. |

### OP reachability and preservation items

- **app-01a/b/c/d:** retain the four documented operator routes: backfill-status, agents/progression, memory status and mission-by-id. Current API rows at [62](C:/Users/Daniel/Documents/Coding/Github/PatterStage/docs/reference/api.md:62), [72](C:/Users/Daniel/Documents/Coding/Github/PatterStage/docs/reference/api.md:72), [77](C:/Users/Daniel/Documents/Coding/Github/PatterStage/docs/reference/api.md:77) and [100](C:/Users/Daniel/Documents/Coding/Github/PatterStage/docs/reference/api.md:100) do not yet supply all the ruled item-specific no-UI/operator labels.
- **app-01h:** caller gate must include `tests/integration` and assembled URLs, not only literal `fetch("/api/...")`. “No UI caller” is not “unreachable” or deletion authority. The active oracle author owns the new gate; I have not assessed its unfinished bytes.
- **app-04b:** preserve thrown-text contracts. Existing `serverErrorFromError` is incompatible with sync’s `String(error)` prefix and categories’ message-or-fallback behaviour. Freeze these before conversion.
- **app-06/app-16/app-18/app-21 OP rows:** conclusions are respectively completed-with-exceptions, needed ordering repair, wording-preserving parsing convergence, and retained compatibility.

### Gateway, fonts and proxy distinctions

**Gateway:** the shared client always supplies `AbortSignal.timeout(timeoutMs ?? 3000)`, overriding a caller signal. Chat instead forwards request cancellation, has no explicit three-second deadline, propagates upstream status/error text, returns 502 for missing stream bodies, and wraps SSE with [per-chunk/one-second authorisation checks](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/api/orchestration/chat/route.ts:22). Non-streaming completion rechecks authorisation before release.

Any shared transport must preserve:

- Gateway bearer injection separately from browser-session authorisation.
- Request abort, downstream cancellation and upstream reader cancellation.
- No buffered replacement for SSE.
- Existing health/models timeout versus chat lifetime.
- Upstream errors and missing-body response contracts.

Reuse `gateway-client.test.ts`, gateway health/models suites and stream/session tests. A header-equivalence unit test cannot discharge revocation or cancellation behaviour.

**Fonts:** the [app-22 ruling](C:/Users/Daniel/Documents/Coding/Github/PatterStage/org/reviews/2026-09-decision-register.md:2212) is **keep**. Four local font declarations remain; [ReaderSettings:29–38](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/modules/rec-room/components/ReaderSettings.tsx:29) exposes them, and [reader:500](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/recroom/story-weaver/[id]/page.tsx:500) resolves the selection. Source proves reachability, not readability/accessibility. The layout’s “may be deleted” comment remains stale. No font deletion proposal.

**Proxy:** [proxy.ts:167](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/proxy.ts:167) contains standalone refusal-page colours, while [globals.css:112](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/globals.css:112) defines different application surfaces. This proves literal divergence, not a visual defect. Assess the unauthenticated standalone page independently; importing application styling or providers could change its dependency/security boundary.

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
| **gap-081.b** | Composer still dynamically imports both canvases at [page.tsx:47](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/work/composer/page.tsx:47). This establishes source deferral, not built chunk/loading behaviour. |
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

Additional configuration files: [eslint.config.mjs](C:/Users/Daniel/Documents/Coding/Github/PatterStage/eslint.config.mjs), [jest.config.js:1](C:/Users/Daniel/Documents/Coding/Github/PatterStage/jest.config.js:1).

**Boundary:** disable this rule only for `tests/**/*.{ts,tsx}` and `jest.config.js`. Keep enforcement in source and scripts, including [upgrade.ts:318](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/db/upgrade.ts:318).

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
| [ensure-hermes-model-sync.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/ensure-hermes-model-sync.ts), [import-hermes-state.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/import-hermes-state.ts), [migrate-db.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/migrate-db.ts) | [design-lint.d.mts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/design-lint.d.mts), [derive-surface-ladder.d.mts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/derive-surface-ladder.d.mts) |
| [retention-prune.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/retention-prune.ts), [seed-catalog.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/seed-catalog.ts), [generate-json-schema.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/generate-json-schema.ts) | [output-canary.d.mts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/output-canary.d.mts) |
| [docs/extract.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/docs/extract.ts), [docs/check.mts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/docs/check.mts) | [docs/lib.d.mts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/docs/lib.d.mts) |

**Smallest proposed boundary:** a separate `tsconfig.scripts.json`, strict/no-emit/non-incremental, covering all current and future script TS roots plus declarations. Wire it into mandatory lint through [package.json](C:/Users/Daniel/Documents/Coding/Github/PatterStage/package.json). Preserve existing app/test checks. Do not enable blanket MJS checking or execute migration, seed or documentation generators.

**Smallest independent contract:**

- Resolve the configuration and assert all eight executable roots are included, alongside declaration companions.
- An isolated type-error fixture must fail the same mandatory command; a corrected fixture passes.
- Verify no emitted files or build-info files and no CLI execution.
- Treat removal of stale `trace_import.ts` exclusion separately from broadening app compilation. Actual script diagnostics remain unknown until authorised checking.

### Cross-cutting-22: dependency reconciliation

**Change cohort:** [package.json](C:/Users/Daniel/Documents/Coding/Github/PatterStage/package.json), [package-lock.json](C:/Users/Daniel/Documents/Coding/Github/PatterStage/package-lock.json), [knip.json:24](C:/Users/Daniel/Documents/Coding/Github/PatterStage/knip.json:24).

- **`ts-jest`:** no executable consumer found in inspected source/tests/scripts/config. Jest uses `next/jest`; manifest and historical pin assertions remain.
- **`jsdom`:** one direct consumer at [b6-cleared-defaults-stay-cleared.test.ts:617](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/b6-cleared-defaults-stay-cleared.test.ts:617). It deliberately creates a DOM inside a real-filesystem hook suite. Retain that design.
- Current lock resolves **jsdom 26.1.0**, also required by `jest-environment-jsdom 30.3.0`. Declare the direct dependency without an incidental upgrade; remove only the corresponding obsolete Knip exclusions.
- **`next.config.ts` remains unchanged**, as explicitly ruled.

**Independent amendment blocker:** these suites assert exact dependency maps, so both removing `ts-jest` and adding `jsdom` affect frozen assertions:

- [t0175:63](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/t0175-dependency-proposals.test.ts:63)
- [t0176:70](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/t0176-visual-dependency-proposals.test.ts:70)
- [t0177:40](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/t0177-knip-proposal.test.ts:40)

**Smallest independent contract:** authorise only those dependency-map deltas; preserve every test identity and unrelated pin. Verify manifest/lock agreement, direct jsdom availability, unchanged DOM lifecycle behaviour, unchanged Next/Jest configuration and absence of executable `ts-jest` references. Record any lockfile transitive removals explicitly.

No package installation, network access, global-environment changes or oracle edits occurred.

Reviewer session `01a10198-6b4f-7593-aa19-e0b3c8facad8`:

Verified at `4a0ce196`; no tracked tooling diff. No writes or tests performed.

**One execution owner: T0192.** Include the five TS callers, shared TS helper, deploy parser repair and precedence documentation in one cohort. T0196/tooling-09 should consume the same independent proof and measured saving, without duplicate implementation or double-counting.

Authority: [cross-cutting-08 ruling](C:/Users/Daniel/Documents/Coding/Github/PatterStage/org/reviews/2026-09-decision-register.md:1493), especially the accepted option at line1500 and ruling at1506: preserve two precedence rules, deduplicate TS, strip deploy quotes, admit `CONTROL_HUB_DATA_DIR`, document precedence.

### Exact TS cohort

| File | Current loader | Invocation |
|---|---:|---:|
| [ensure-hermes-model-sync.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/ensure-hermes-model-sync.ts:15) | 15–34, 20 lines | 37 |
| [import-hermes-state.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/import-hermes-state.ts:15) | 15–34, 20 lines | 44 |
| [migrate-db.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/migrate-db.ts:26) | 26–45, 20 lines | 63 |
| [seed-catalog.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/seed-catalog.ts:15) | 15–34, 20 lines | 37 |
| [retention-prune.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/retention-prune.ts:46) | 46–64, 19 lines | 74 |

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

In [_env-local.mjs](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/_env-local.mjs:55), alias warnings now distinguish canonical and legacy provenance, suppress ineffective legacy values and warn once without values. Preserve that logic. `CONTROL_HUB_DATA_DIR` is a direct data-directory fallback, not a generic `CH_` bridge.

Keep TS loading before dynamic path/database imports. Preserve `import-hermes-state`’s subsequent `--hermes-home` override.

### Restart and packaging boundary

Current chain:

- [deploy-actions.ts:31](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/update-handlers/deploy-actions.ts:31) invokes the runner with `restart`.
- [deploy-spawn.ts:41](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/lib/deploy/deploy-spawn.ts:41) launches through `detachedSpawn`, without supplying an environment override.
- [ps-deploy.mjs:523](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/ps-deploy.mjs:523) loads `.env.local` before dispatching restart/update/rebuild.
- [ps-deploy.mjs:348](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/ps-deploy.mjs:348) explicitly spreads the resulting environment into `next start`.

Therefore file-wins remains necessary to replace inherited, previously loaded values.

The shell wrapper [ps-deploy.sh:17](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/application/ps-deploy.sh:17) executes plain Node. Keep `_env-local.mjs` independently executable without TS resolution or application imports. [Dockerfile:46](C:/Users/Daniel/Documents/Coding/Github/PatterStage/Dockerfile:46) copies the whole scripts directory.

Existing isolated deploy fixtures explicitly copy `_env-local.mjs` alongside the runner in:

- `migration-t0188-update-backup-order.test.ts`
- `t0161-backup-creation.test.ts`
- `t0161-direct-invocation.test.ts`
- `t0161-required-step-failures.test.ts`

A TS-only helper adds no dependency to those copies. Sharing a new runtime module with deploy would add packaging/amendment obligations.

`PORT` remains a separate exception: [resolvePort:283](C:/Users/Daniel/Documents/Coding/Github/PatterStage/scripts/tooling/ps-deploy.mjs:283) prefers inherited `PORT`, then `readEnvLocalValue`. It is not part of the export whitelist. Freeze and test the intended quote handling of that accessor explicitly.

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

Full cohort: **six existing production files plus one new TS helper**, documentation in [env-reference.md](C:/Users/Daniel/Documents/Coding/Github/PatterStage/docs/running/env-reference.md:13), and independently authored tests.

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
