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
