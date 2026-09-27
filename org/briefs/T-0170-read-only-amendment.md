# T-0170 independent oracle amendment

**Author session:** `01a0e1fd-fece-7642-8b9d-ec3e48d04e25` (Pauli).
**Claim:** `tests/unit/t0170-healthz-liveness.test.ts` only. The coordinator
owns all other T-0170 paths. This is the only second writing lane.

The original four named tests at red-oracle commit `980dfdc3` must retain
their names and assertions. The current green implementation exposes two
public liveness paths. Add a distinct behavioural case that sets
`PS_READ_ONLY=1`: unauthenticated safe GET to both liveness paths stays
available, while an authenticated unsafe request to each path receives the
read-only refusal. This protects the task's exact read-only invariant.

Run the amended suite, the existing proxy-auth suite and the existing
read-only suite. Report the original four-name set before and after, all
new test names, results and the file hash. Do not edit production code, the
public ADR index, or any closed oracle. If a test fails, report it rather
than changing its expectation to pass. The coordinator will run the final
complete gate and mutation sweep after merging this claimed file.
