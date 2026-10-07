# T0194 Composer queue implementation lane

Franklin owns only these production files after the independent red oracle
ae6a47be. Faraday owns test files; coordinator is read-only during both lanes.
No test, protected ADR, task, baseline, commit or push edits in this lane.

- src/lib/composer/queue-cleanup.ts
- src/lib/composer/dispatch.ts
- src/lib/composer/engine.ts
- src/lib/runtime/composer-queue.ts
- src/lib/runtime/HermesRuntime.ts
- src/lib/orchestration/run-reconcile.ts
- src/lib/system/system-repository.ts
- src/app/api/runs/[id]/events/route.ts

Implement accepted ADR0019 and T-0194-queue.md exactly, with the signatures
frozen in tests/unit/lib-domain-queue-admission.test.ts. Read its thirty cases
before changes; do not amend it. Queue oracle LF hash is
c7b8c5657a6b57371ac5d01c1a902189a26901bf7c51f6d70cd8ca40c8b6ecec.

Existing helper consolidation in composer-repository.ts belongs to another
cohort; leave it alone. Keep general submitRun behaviour and API unchanged.
Private Composer submission captures and pins the actual POST endpoint across
429 retries. Fail before unsupported dispatch; never fake endpoint identity
to satisfy old runtime mocks. Propose necessary narrow old-mock amendments
to Faraday via coordinator, preserving names/assertions.

Persist outcomes and cleanup atomically, preserve late cancellation, hold
advancement until release, recover terminal cleanup independently of active
polling, prove finite quiet-reader deadlines and exact owner-token writes.
Never steal a live or uncertain owner. Bound ten records per sweep, one-minute
retry spacing and thirty-day retirement to explicit operator review. Original
output and usage survive. Other stream types and authentication remain held.

Run focused queue controls and test TypeScript using the pinned Node24 runtime.
Owned evidence may be written only under tmp/t0194-queue-implementation/.
No full gate, browser server, providers or operator data. Report exact changes,
tests and source limitations. Stop editing when the lane is handed back.
