# T0190 supplementary ownership regressions

Schrodinger adopts ORACLE, R2, independent of implementation. Existing frozen13
files remain byte-identical. Author only tests/unit/client-late-ownership.test.tsx.
Use current source snapshot to reproduce the four static findings below before
coordinator changes their implementations. Do not invent a red count: refute any
unconfirmed finding. Hold and release requests explicitly; keep valid-control cases.

1. Missions initial older deep-link request settles after the operator selects B,
   after superseding refresh, or unmount: no stale selection/URL/error mutation.
   Also inspect pre-version-check olderLinkedMission updates.
2. Mission delete A begins with A expanded, operator opens B, delete settles:
   keep B's detail and selection.
3. Chat delete inactive B begins, operator selects B and starts its stream, delete
   settles: selection moves away and B's queued stream cannot replace next view.
4. Explicit same-conversation reload after a completed Chat turn must consume
   fresh server data; retain first-chat stale-detail regression in frozen suite.

The independent client review adds these source hypotheses to the same file:
5. A failed Story background load must not hide Stop while generation is active.
6. A confirmed Story write must update the shared load cache and supersede older
   reads; reopening the same story must not offer a chapter already written.
7. Hindsight creation/addition and preference writes must not join the first
   pre-write read. Hold that response, write successfully, then release it.
These are unconfirmed until the controlled tests execute; preserve refutations.

Own validation tmp/t0190-oracle-validation, pinned Node24 as prior. Copy current
41 claimed production paths and 13 frozen tests before run; record hashes and
times so the snapshot is exact. Coordinator will not edit any of the seven ownership
implementations until red commit. No provider calls/build/server/dependency work.
Capture structured results, names, skips/runtimeerrors, fulltesttyping/scopedlint.
No historical/frozen edits or commits. Return receipt and stop writing.
