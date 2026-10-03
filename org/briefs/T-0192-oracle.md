# T-0192 independent oracle brief, opened before implementation

Authors: Galileo owns unit and route-contract files; Sartre owns browser, persistence helper and historical Composer fixture files. The coordinator implements; Laplace independently reviews. Source exposure is disclosed. No production patch exists. Every new test must run against the current unmodified source before implementation; preserve genuine reds separately from setup errors. Freeze names, assertions, fixtures and hashes, then commit the red oracle. Existing tests may not be weakened; the one proposed Composer fixture amendment requires exact independent review and three unchanged names/assertions before integration.

## Public invariants

Preserve every shipped route URL/method, auth and read-only boundary, response-time session reauthorisation, guard order, optional-body policy, exact published errors, HTTP200 partial-success errors, specialised Hindsight envelopes and stream responses. Compatibility aliases remain throughv1. Four retained operator APIs need individual documentation labels and explicit caller-gate allowlist. A route inventory must freeze methods as well as paths before route edits. No generic object-validation change to parseJsonBody. Story list SQL failure is the narrow approved exception: deliberate error rather than false successful empty data.

## Initial defect oracles

Exact proposed claims:

- tests/unit/api-fetch-error-envelope.test.ts
- tests/unit/settings-save-draft-ownership.test.tsx
- tests/unit/model-bulk-default-feedback.test.tsx
- tests/unit/story-list-failure-contract.test.ts
- tests/e2e/route-contract-persistence.spec.ts
- tests/e2e/route-contract-followups.spec.ts
- tests/helpers/route-contract-runtime.ts
- tests/unit/composer-review-control.test.tsx (independent fixture amendment only)

1. For failed HTTP responses, test JSON null, primitives, arrays, objects and invalid JSON. Preserve HTTP diagnosis, published-error precedence, nested errors and `cronPushError`. Do not require exporting `ApiError`.
2. Start Settings at 40, submit 41, then type 42 while the response is held. After release, the saved baseline must be 41 and the visible draft 42 must remain unsaved. Add unchanged-success, refusal and later-save controls. Hold delivery of a real PUT response; distinguish persistence from response settlement.
3. Test bulk defaults with all-success, semantic-error, transport-error and mixed results. Require truthful feedback and refreshed defaults. HTTP 200 with `data.error` must not announce unconditional success. Use malformed owned YAML to distinguish SQLite success from YAML refusal.
4. Inject a genuine Story repository read exception. Compare healthy, empty and damaged-row parser controls, plus consumer failure and recovery. Keep injected handler proof separate from real-storage proof.
5. Use real HTTP, SQLite and owned profile directories. Test changed and unchanged slugs, submitted metadata, empty descriptions, references and reload. A deterministic filesystem refusal must not report success or leave inconsistent references.
6. Use real HTTP, SQLite and owned YAML. Disable the sole fallback, delete the last entry and explicitly sync an empty chain. Preserve nonempty ordering, unrelated fields, backup and refusal behaviour. Do not claim Hermes execution.
7. A held or refused existing-script GET must not permit overwriting unread bytes. Keep PUT real. Compare synthetic file bytes independently and test successful read, edit, save, reload and stale selection. Never execute the script.
8. A pending, refused or stale Composer graph must not make an incomplete review appear complete. Recovery must disclose stages and the write warning. Only explicit confirmation may submit once. Capture and refuse the run request to avoid providers. Preserve engine HIL tests.

Use browser widths 1440x900 and 390x844, ordinary keyboard and pointer interactions, real sign-in and owned data. The existing full Playwright gate must discover these tests.

The runtime helper requires independent review. Each test owns its root, token and loopback port. Use the current `process.execPath`, compatible native dependencies and the existing build. Strip inherited runtime and provider overrides; set owned data, Hermes, home and temporary directories explicitly. Refuse checkout environment files. Use the explicit owned origin, never the gate's shared base URL, and clear inherited Bearer headers. Bound readiness, await owned-process exit, drain callbacks and close database handles. A bind collision is an infrastructure failure; never stop another listener. Preserve normal concurrency, zero retries, failure evidence and roots still in use. Use synthetic keyless fixtures. Never modify operator data or build output.

## Subsequent contracts before corresponding implementation

Independently freeze tests/unit/api-route-public-contract.test.ts, tests/unit/api-route-caller-gate.test.ts, tests/fixtures/api-route-contract-baseline.json and tests/unit/runtime-operational-consistency.test.ts. Use actual TS exports for complete URL/methodinventory and explicit operatorallowlist. Reuse existing public/proxy/browser-session tests; mockedhandlerauth is not proxyproof. Characterise exact Error/emptyError/string/nonError catches before any helperfold; preserve prefs/update/backfill/Composerapproval exceptions. Boot recovery must survive failure in earlier bootsteps without silently swallowing thosefailures; Composerflag no/off and gatewayconfiguration must match actualruntime consumers.

The remaining82owned disposition rows, publiccredentialshape and propconvergence require evidence and netcounts. No eight-defect subtotal closes the batch. Real six-endpoint latency requires controlled cold/warm Windows/Linux builtapp and eventloopmeasurement; preloadfixture is not performanceproof. Additional scope/oraclepaths are claimed and independently frozen before their implementation.

Validation: focused controls and redcounts; exact identities/hashes; coordinator fullunit/types; personal desktop/phonewalk and images; unchanged ten-stagegate; committed causal mutation sweep with restoration andcontrols; independentR2; all implementation andclosure hostedjobs. No coverage/timeout/concurrency/target weakening.

## Disjoint authoring lanes

Galileo owns:

- tests/unit/api-fetch-error-envelope.test.ts
- tests/unit/settings-save-draft-ownership.test.tsx
- tests/unit/model-bulk-default-feedback.test.tsx
- tests/unit/story-list-failure-contract.test.ts
- tests/unit/api-route-public-contract.test.ts
- tests/unit/api-route-caller-gate.test.ts
- tests/fixtures/api-route-contract-baseline.json
- tests/unit/runtime-operational-consistency.test.ts

Sartre owns:

- tests/e2e/route-contract-persistence.spec.ts
- tests/e2e/route-contract-followups.spec.ts
- tests/helpers/route-contract-runtime.ts
- tests/unit/composer-review-control.test.tsx

Authors work only in the isolated validation checkout and their exact claimed paths. Do not commit, edit source, expand claims or change runners. Return structured evidence in messages; private ignored receipts are permitted inside the validation checkout. Do not share mutable data or processes. The coordinator performs no writes while both lanes are active. Stop writing when handing off for review.

## Independent pre-implementation corrections, 2026-10-03

Laplace withheld unit freeze. Halley owns only runtime-operational-consistency.test.ts, api-route-caller-gate.test.ts and story-list-failure-contract.test.ts in tests/unit in the isolated validation checkout. Require original fatal rejection, both sweeps before fallible startup and no later startup after failure. Restrict caller evidence to recognised request calls or traced wrappers; exclude unused literals and fixture/interception references, adding negative controls. Add a non-null guard before Story error-object matching while retaining all existing assertions. Preserve original identities and receipts, independently re-run all seven oracle suites and historical controls, and return exact hashes and failure classification. No production edits, commits or other file changes. Private ignored receipts are permitted. The coordinator is read-only while both author lanes are active.

## Existing liveness compatibility disposition

Laplace accepted the Story/runtime amendments and held the complete unit freeze only for the caller policy. Accepted T-0170 requires keeping `/api/healthz` as the public JSON liveness alias; no in-tree caller is asserted. Sartre owns only tests/unit/api-route-caller-gate.test.ts in the validation checkout: add a separately named exact public-liveness disposition, cite T-0170 and the documented JSON contract, pin exact membership and reason, and explicitly use it in missing-caller calculation. Preserve the four operator exceptions and all existing identities/negative controls. No fabricated caller, broad documentation scan or production change. Retain the previous111-case receipt as16 behavioural reds plusone policy-coverage failure. Return revised hashes and focused receipts for independent review; stop writing on handback.

## Historical runtime-status fixture

Galileo owns only tests/unit/b3-runtime-status.test.ts in the validation checkout. Expose the real endpoint resolver in its incomplete module mock, keeping the home double; isolate relevant LLM override environment if needed. Preserve all four case bodies, assertions and names. Q015 supplies independent amendment authority for the approved gateway fix. Record original hash, prior4/4control, current missing-export failures and amended focused results. Return exact patch/hash for Laplace and stop. No source changes or other tests.

## Profile detail selection amendment

Halley owns only tests/e2e/route-contract-followups.spec.ts in the validation checkout. Laplace authorised clicking the existing Oracle After row button between the current name and description assertions. Descriptions belong to the selected detail panel. Preserve every assertion, both viewport identities, actual writes, independent database checks, timeouts and teardown. Capture the original hash and exact one-line patch, run the two affected cases and all42 cases at normal concurrency with no retries, preserving each result. Return hashes, counts and any infrastructure failures separately, then stop. No production changes.

## Diagnostic secrecy and tooling contracts

Galileo owns only tests/unit/runtime-gateway-diagnostic-redaction.test.ts, tooling-env-contract.test.ts and scripts-typecheck-contract.test.ts in the validation checkout. First freeze and return the diagnostic secrecy suite: actual register(), runtime GET and endpoint resolver; synthetic userinfo/query/fragment across all three override variables, invalid URL fail-closed diagnostics, clean/default/precedence controls and unchanged operational values. Prevent all real startup/provider side effects. Do not edit any existing test or production file. Run red against the current pre-redaction source, retain exact identities and receipts, return for independent review before implementation.

Then author the two tooling suites from the preserved cross08/cross09 review: TS shell-wins versus deploy file-wins, exact paired-quote/CONTROL_HUB_DATA_DIR repairs, alias warning provenance and no values, standalone packaging and PORT exception; strict no-emit non-incremental script coverage with mandatory command and planted-error/corrected controls. Never execute migration/seed CLIs or use operator environment/data. Prefer behavioural isolated cases and minimal structural assertions for caller wiring. Keep all existing historical tests unchanged. Missing proposed helper/config must be reported as missing-contract red, not a passing test or an infrastructure kill. Return each coherent oracle before proceeding. Private receipts allowed; no commit, dependency installation, build or source edits.

## Independent diagnostic oracle correction and Windows replacement regression

Nash owns only runtime-gateway-diagnostic-redaction.test.ts and config-sync-atomic-replacement.test.ts under tests/unit in the validation checkout. Galileo has stopped. First correct the diagnostic candidate e5c7f8d3590a6dd7eb6575bf0f76d4ca7624de078d1a8b482d1a63f30a7ca418: the broad secret/password vocabulary assertion rejects legitimate auth text. Preserve all 47 names and every actual contract, replacing that predicate with exact synthetic-input markers. Prove control characters survive environment assignment, including NUL; retain whole-output inspection, fixed labels and before/after operational bytes. Preserve original receipt, run revised red and return exact hash for Laplace. No implementation exists yet.

Then independently test real ConfigSync and real atomic replacement with owned YAML and controlled read scheduling. Qualify open/closed-handle controls on Windows. Hold an actual asynchronous read descriptor until the competing synchronous write attempts replacement; a synchronous read completes and closes before queued write. Assert exact write bytes, stats/results and descriptor cleanup in finally. Preserve missing/valid/malformed/deduplicated errors/read-refusal and asynchronous access semantics. The proposed repair is Windows-only synchronous content reading; Linux remains asynchronous. No size cap, retry, timeout or writer weakening. Cross-platform results must distinguish Windows causal red from POSIX semantics. Retain all historical test files unchanged. No source edits/builds/provider operations, and return this red freeze separately. Private outputs permitted; stop on handback.

## Shared boot boundary and remaining route contracts

Sartre owns exactly tests/helpers/runtime-boot-boundary.ts, tests/unit/runtime-operational-consistency.test.ts, tests/unit/runtime-gateway-diagnostic-redaction.test.ts, tests/e2e/script-editor-write-ownership.spec.ts and tests/unit/route-local-catch-contract.test.ts in the validation checkout. Nash stopped. First consolidate only shared mock/lifecycle scaffolding from the two boot suites. Preserve every existing test name, body and assertion; retain operational-suite startup resets locally, the diagnostic environment's exact control bytes, actual register/GET/resolver, SQLite closure and all side-effect isolation. Import the helper before application modules. Q015 authorises the different-author preservation amendment; Laplace must review exact hashes/identity proof. Galileo's read-only projection is minus30 physical lines and repeated windows4844 to4796; verify rather than promise it. Existing baseline-db helper remains canonical. Do not weaken isolation or reorder code merely to alter the census.

After the shared fixture handback, independently author held Script save/delete tests: actual owned HTTP writes for editor A, close A and open B while response is held, then settle A and prove B/draft survives. Both1440x900 and390x844. Reuse the frozen owned runtime helper unchanged. No script/provider execution. Existing build still contains unchanged Script write callbacks; disclose build/source scope and prove relevant Script source bytes match before a causal red. Coordinate with the coordinator before browser runs/builds; do not modify any runner or existing oracle.

The new route-local-catch suite characterises the nine requested contexts before route folding: Missions list/id, Script logs/run names, model push id, Agent file read/write resolved paths, Session sanitised id, fallback action. Use real logger/wrapper with controlled dependency failures. Pin one exact canonical log and exact500body, plus relevant success/refusal and special inner-catch/guard-order controls. No real scripts, providers or operator files. Return each coherent result separately with hash/identity/receipt and stop writing when handing back for review. Private receipts permitted; no source edits/commits.

## Same-editor pending draft contract

Nash owns tests/e2e/script-editor-pending-draft.spec.ts only, in the validation checkout. Reuse frozen owned runtime unchanged. At both viewports reproduce later typing during a held real PUT for existing script content, new script content and new script filename separately. Submitted disk bytes survive; later draft remains; no automatic second write; explicit subsequent Save persists that draft. For DELETE with later typing, preserve text as the existing New script flow, with explicit Save before recreation. This is the existing create/upsert action made visible, not a new public contract or automatic undo. Check no recreation before that explicit action. Normal and replacement-editor controls remain in the frozen eight-case suite, untouched. No script/provider execution. Record actual current built-source match, identities and causal reds; types/lint; stop after handback. Coordinator has not implemented this extension. Keep source-informed authorship honest.

## Independent fixture corrections

Halley owns tests/unit/template-create-identifiers.test.ts and tests/unit/route-local-catch-contract.test.ts in validation only. Coordinator authored the first; Sartre authored the second. Preserve every frozen name/body/assertion. For template IDs, use the actual house uuid implementation, bypassing the global jest.setup mocked uuid which uses Math.random and a test-uuid prefix; do not implement random IDs inside the oracle. Prove original create source still gives two causal reds and current corrected source passes, with production bytes restored and unchanged. Keep all real storage/providers isolated. For route catches, supply required logFile/backupPath fields in controlled fixture results, preserving exact assertions and all76 names. Run full typecheck, focused lint and before/after identity proof. Record failed current types and original erroneous success claim honestly. Do not change production or shared setup; no fixture type casts to conceal missing fields. Stop after exact handback; Laplace reviews before integration.
