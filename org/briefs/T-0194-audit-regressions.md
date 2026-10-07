# T0194 independently verified library audit regressions

Faraday authors tests/unit/lib-domain-audit-regressions.test.ts only, alongside
the independently reviewed obsolete-test amendments. Franklin owns queue code.
Coordinator is read-only during both writing lanes. No core repair yet.

Reverify these source hypotheses through small behavioural cases, then freeze
the red controls before implementation. Do not inflate the source review into
runtime assurance. Use real disposable SQLite where ownership/data matter.

1. Models: setting model B's agent-default flag false must not clear model A's
   slot; clearing the owner works; true replaces it; omitted flags preserve it.
2. Hindsight: directive name/content/priority and model name use literal protocol
   keys, never their values as keys. Preserve omitted fields, numeric zero,
   false activation, tags and source_query mapping. Inspect the real builders
   and handlers; browser-to-app payload tests do not prove upstream PATCH keys.
3. Skills: inherited object names such as constructor and toString must group
   without crashing, while ordinary normalisation, item identity and sorting
   remain. Use current grouping behaviour and a persisted/API case if cheap.
4. Cron: negative, zero, malformed and enormous steps/ranges must be rejected
   in bounded time without writes. Never call a known negative-step loop inside
   Jest's process. Use a bounded owned child and an assertion on its outcome;
   distinguish intended nontermination from launch/configuration failure.
   Preserve positive-step controls and the existing six-field parsing contract.
5. Stats/analytics: script schedules retain their kind; same-day overdue ISO
   schedules are not upcoming; mixed ISO/SQLite timestamps obey exact cutoff
   semantics. Exercise actual query results, not source substrings.

Use existing helpers, not duplicated application mocks. Keep the cohort compact.
Known provider data is synthetic; no network/paid calls, operator data, browser
server or full gate. Existing names/assertions stay. New source defects outside
library claims stay separately assigned, not silently absorbed.
