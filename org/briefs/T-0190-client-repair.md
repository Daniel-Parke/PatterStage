# T0190 client cache repairs after supplemental red freeze

Averroes EXECUTOR R2. Only four production paths in assigned repairlane:
Story reader page, useHindsightCrudTab, useHindsightMemories, usePreferenceWrite.
New33case supplementary oracle independently authored by Schrodinger, reviewed
by Sagan, committed d0e48d9d red16/33. Original13frozenfiles unchanged. No tests,
shared APIs, metadata or other source edits. No commit/push. Two writers only.

Repair reproduced Story background read error hiding Stop; preserve cached/local
content and live cancellation with scoped error feedback. Confirmed writes must
update the shared complete Story load envelope, superseding pre-write reads.
Preserve each response shape, partial confirmation, title repair, concurrent
calls, Stop, failure ceiling and explicit billed intent. Read-only advice:
tmp/t0190-cache-publication-review.md. Do not mechanically publish partial data.

Coordinator added publishApiResource(client, endpoint, {body?,responseBody}) in
useApiResource. It awaits exact-key cancellation and stores private raw envelope.
Pass validated read-equivalent {data:completeStory}; keep storyID in the read key.
Cancellation is logical query cancellation, not physical HTTP abort.

Hindsight post-write collection refresh must cancel the exact initial read before
refetch. Keep query failure visible without turning confirmed writes into false
write failures. A simple afterWrite flag on load callbacks plus useQueryClient
cancelQueries then existing refetch is sufficient; do not force a new abstraction.
Memory add must refresh the appropriate submitted query/recent collection.
Prefs: cancel the exact key before invalidating active observers. Keep Sidebar's
no-added-GET, optimistic quiet behaviour and existing pending/error semantics.

Use tmp/t0190-client-validation only, materialise current41claimed source and14
frozen tests there, record hashes. No install/rebuild/build/server/provider work.
Pinned Node24 and scrubbed own data/home/Hermes/temp as prior. Run client oracles,
supplementarycases, historical controls, types/lint. Report any coordinator-only
supplement failures separately rather than changing foreign source. Preserve all
33 identities and14frozen hashes. New findings require evidence, not test edits.
Return receipt/changedpaths/exactchecks, then stop writing for integration.
