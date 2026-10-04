# T0194 queue fixture amendment and independent confirmation oracle

Date: 2026-10-04. Author: Banach (session 01a10610-cd11-7cd1-a83c-bbed065d1f98).
Independent reviewer: Parfit, pending. Franklin implements production; Faraday authored the frozen thirty-case oracle. Banach cannot approve this amendment or companion.

## Authority and scope

Coordinator assigned lane under operator-approved workflow; Q015/ADR0019. org/claims.json records Banach’s five-path writing lane. Q-015 permits the separately authored fixture amendment. [The confirmation brief](../briefs/T-0194-queue-confirmation.md), [accepted ADR-0019](../decisions/ADR-0019-composer-queue-cleanup.md) and tmp/t0194-queue-implementation/confirmation-and-mock-proposal.md bound the behaviour. This records that existing authority; it does not create another operator decision or product requirement. No production, package, shared fixture, task or claim changes were made by Banach. No commit or push was performed.

## Exact amendments

- Frozen lib-domain-queue-admission.test.ts: import applyComposerNodeCancelledMigration and include it in this fixture's openBaselineDb migration list. Exactly two changed lines; inverse reconstruction equals the original LF source. Production already applies the real cancelled-node migration. Preserve all thirty expanded names and every assertion.
- composer-engine.test.ts: an explicit private submit receipt wraps the existing mockSubmit handle and an owned identity. Successful drain is mocked. finishStage obtains the real local run, persists matching backend terminal truth and sweeps before continuation. The runaway-loop fixture now also calls finishStage instead of its direct finalize/advance pair. Remove the unused finalizer import. Preserve all six names and assertions, including the attempt cap. This exercises the production release guard without an ordinary-runtime fallback.
- composer-spend-is-counted.test.ts: the three reconciler cases expose synchronous local getRun from their same active fixture and explicitly model legacy absence of queue receipts using loadComposerQueue=null and an empty sweep result. Two inline lists become localRuns so both repository seams use the same objects. Preserve all five names and exact usage/null/failure assertions. No fabricated receipt or production fallback.

The AST comparison preserves 119 queue, 18 engine and 11 spend assertion expressions byte-for-byte after LF normalisation. Declared names are exact. The focused run matches all thirty frozen queue and six original engine full names from the frozen receipt; all five spend full names match reconstruction from the original source.

## Companion freeze

lib-domain-queue-confirmation.test.ts contains eighteen controls using real SQLite and actual dispatch, cancellation, queue recovery and private Hermes entrypoints. Synthetic owned responses and held promises replace network transport. The queue seam is explicit, and actual private transport controls use jest.requireActual with a real injected HermesRuntime. No provider calls occur.

Seven matcher reds identify: held POST cancellation before node.runId linkage leaving the agent run started; mismatched backend association; mismatched node association; an extra credential property accepted in private metadata; missing gateway identity in cancellation Stop requests; and two absent private Stop capability controls. The first five execute behaviour. The last two prove capability absence only; endpoint rotation, held admission and 404 semantics remain behaviourally unqualified until those complete green. No missing-module or runtime failure is counted as red evidence.

Eleven controls pass: locally failed/cancelled runs wait for backend terminal confirmation and preserve exact local outcomes; polling 404, failure, abort and wrong-backend results do not authorise drain or submission; malformed missing pending time fails closed; non-cooperative fetch/body polling settles within its own deadline without cancelling the caller or leaving timers; thirty-day released continuation retirement rolls back on a real SQLite delete refusal then preserves completed output/usage on retirement; and a durable paid successor survives metadata replay without a second submit. The held Stop test attaches the same actual receipt it stops. Existing thirty-case controls retain reload recovery and batch/one-minute ownership coverage.

The initial retirement check passed alone but Jest's multi-suite rejects.toThrow did not recognise the native SQLite rejection. A diagnostic observed the exact owned retirement refusal and rollback. The final assertion requires rejection with that exact message via rejects.toMatchObject; all rollback and 30-day retention assertions remain. The diagnostic console statement was removed before freezing.

## Observed checks

Pinned Node v24.21.0: four focused suites, 59 names, 52 pass / 7 matcher fail, zero skips and zero runtime-error suites. The existing 30+6+5 cases are 41/41 green. Companion: 11 pass / 7 matcher red. Jest exit 1 is expected RED, not acceptance. Actual tsc --noEmit -p tsconfig.tests.json exit 0; ESLint on the exact four test paths exit 0. No full gate or unrelated tests were run.

Receipt: tmp/t0194-confirmation-oracle/freeze.json. Raw final Jest receipt: tmp/t0194-confirmation-oracle/focused-final.json. Before snapshot and focused/type/lint logs are in the same owned directory. HEAD was 4d697485fd64afe0953061ccdfa69aa4412fb233 with the current uncommitted implementation. All nine captured queue implementation source LF hashes are unchanged before/after this lane.

## LF SHA-256 binding

| File | Before | After |
| --- | --- | --- |
| tests/unit/lib-domain-queue-admission.test.ts | c7b8c5657a6b57371ac5d01c1a902189a26901bf7c51f6d70cd8ca40c8b6ecec | c23633042114d02858820c3e96920e948089da2844a5217683c1029307ef8527 |
| tests/unit/composer-engine.test.ts | a0f135a6a6c0d2aa6859661febf4106262c27309e36d3364d25480567e2d996e | 6b838edd36e738ee97ef2e0b5760e8e043cd656d70981525af7bfb860caeb353 |
| tests/unit/composer-spend-is-counted.test.ts | ceaa2c7ee91d707cd215ffb1b5f9bf4b6b347bb572462712851efd2793c83a56 | e5700cbcd9c2b614ebdbb7fdfb487287f8e8d2a85788fa3a4c800e630886329f |

New companion LF SHA-256: 33e09c78ad7f2f5386fceb5e4ff3d8c9e7ec61fb10582c7d330b9e96038e69cc.

Parfit must review these exact files and receipts before further queue patching. Full-gate, causal sweep and hosted acceptance remain pending; this is neither T0194 closure nor a T0206 cause repair.
