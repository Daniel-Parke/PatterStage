# T0190 client implementation lane

Author Averroes, EXECUTOR, R2. Independent Carver oracle frozen/red committed at
0471baf0; Schrodinger accepted freeze. Implement only the20exact production files
assigned to session2026-10-02-t0190-client-averroes in org/claims.json.
No test, metadata, baseline, shared API or other source edits. No commit/push.

Use your retained read-only preparation. Story/Hindsight/preferences plus narrow
type/map/comment cleanup are yours. Chat, Missions, useApiResource/api-write/
api-fetch and useVersionFooter are coordinator-owned. Consume current shared
interfaces; request a specific additive capability if necessary, never edit
another owner's file. At most two writers including coordinator.

Story: useApiResource for POST load/spend keyed by complete body. Keep reads
truthful and unknown spend distinct from zero. Seven explicit write operations
go through sanctioned useMutation; preserve transport/deadline behaviour, payload
validation, abort-controller set and concurrent request count, Stop, write latch,
failure ceiling, requested chapter read-status and overlay completion. Nonfatal
title sync remains nonfatal. Never make query retries trigger provider work.
Guard each draft storage operation independently; successful create must navigate
once even if removeItem fails. Preserve existing keys, fields and current input.

Hindsight: cached active-tab collection reads with error/Retry surfaces for HTTP,
transport and application errors. Health available:false is meaningful health
data. Preserve submitted recall query vs typed search, stale filter/count/health,
CRUD drafts/pending/identity, tags/priority and only explicit reflection with no
automatic mutation retry. Keep loadHindsightList compatibility behaviour/tests.

Preferences: small mutation-only usePreferenceWrite, PUT/invalidation of canonical
prefs key, no added GET. Sidebar supplied initial value and local optimistic
quiet failure stay; operator prefs expose pending/error. Keep legacy keys.

Cleanup: canonical client-safe defaults/toast types; preserve narrower callers;
remove empty focus-map indirection while retaining public prop/function signatures
and exact tokens; direct pill-map exports. Correct comments only where claimed.
FeedbackProvider ownership and standalone toast fallback remain. Do not claim a
net line reduction for necessary error/race behaviour before measuring it.

Validation checkout: tmp/t0190-client-validation, created by coordinator from
0471baf0. node_modules is a junction to acceptedT0189dependencies: NEVER install
or rebuild dependencies. Pinned node tmp/t0203-node24-runtime/node-v24.21.0-win-x64.
Private evidence under tmp/t0190-client. Own data/HOME/Hermes/temp, scrub all
PS/CH/CONTROL_HUB inherited values. No build/server/provider work; coordinator
owns production build and browser port3998. Copy only claimed source to your
checkout; preserve testbytes from committed freeze. Run the Story/Hindsight/
preference oracles and all relevant historical controls, app/testtyping and
scopedlint. List exact expanded names before/after with pass/failure receipts.
Do not change frozen tests to obtain green: report required independent amendment
with concrete evidence. Preserve every failed attempt. Return changedpaths,
checks/counts, unresolveditems and measured net cost; then stop writing for
coordinator integration/fullgate. No implementation acceptance by your own lane.
