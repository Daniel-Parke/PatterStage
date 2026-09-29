# T-0187 concurrent register oracle

Independent ORACLE owns only `tests/unit/legacy-concurrent-boot-warning.test.ts`.
Do not edit implementation, existing oracles, records or protected paths.

Run the actual `register()` entrypoint twice concurrently under Node runtime,
with a winning `CH_READ_ONLY=true` and isolated boot dependencies. The warning
must print once, name the key pair and omit the value. Verify both boot calls
complete and the expected services are invoked. Use controlled async imports or
mocked dependencies if needed to expose the interval between the initial
warning guard and its state change; do not merely replay the source block.
Include a sequential or PS-only control. Run the suite red-first and report
the named test set and exact matcher failures. Do not commit.
