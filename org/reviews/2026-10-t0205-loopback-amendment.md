---
summary: Independent T-0205 Q015 loopback oracle RED freeze and calibration provenance
type: venture
tags: [oracle, testing, refactor]
---

# T-0205 loopback amendment provenance

## 2026-10-02: independent oracle frozen before fixture amendment

Author: fresh independent ORACLE, session
`01a0fa2e-b45c-72b0-9e03-984a3403bb34`. The author is distinct from the
coordinator and original T-0202 author. Clean-context authorship and private
differential/fault calibration apply. The Harness implementation was not read.

Authority: the pre-implementation `loopback_amendment_authority` in
`org/tasks/T-0205.json`, granted by independent R2 REVIEWER Schrodinger under
Q015. The four claimed paths are the original HTTP fixture, the new loopback
observer, the new loopback Jest suite and this provenance file. The fixture has
not been amended. Proposed future class symbol: `LoopbackHttpServer`.

The operator subsequently recommended a seventh DNS-binding mutant. That is
an operator recommendation, not a reviewer request or existing expanded
authority. The existing mutant manifest remains unchanged. Additional reviewer
scope approval and claim transfer are prerequisites to authoring that entry.
If approved before the fixture amendment, its future constructor anchor will
be absent. That condition is NOT APPLIED, not a mutation kill.

The observer imports the existing fixture interface and delegates its native
curl transport, launch, handlers, requests and cleanup. A process-local
`socket.getfqdn` sentinel records calls and returns the input without DNS.
The independent sentinel control calls it directly and constructs the original
stdlib threaded HTTP server. A reverse-resolution guard records zero external
attempts. All replacements restore in `finally`.

Five real fixture cases execute: independent control, healthy,
wrong-credential, occupied-listener and stubborn. The observer records the
actual socket address, numeric metadata, activation, IPv4/stream socket type,
address reuse and threaded HTTP handling. Existing owned-child, decoy,
credential-discard and request-bound checks remain. Native process objects
supply client hashes, completed exits, registration and cleanup evidence.
Only classifications and metadata are exported; no credentials, bodies,
environment values or generated scripts are exported.

The Jest subprocess carries only operating-system/tool essentials. Home,
temporary and data paths are exclusively owned. No dependencies were installed
and no operator environment file was copied. Runtime: Node `v24.21.0`, ABI
`137`, using the existing primary native module pool. Python: `3.14.4`.

Frozen LF SHA-256:

| Path | SHA-256 |
| --- | --- |
| `tests/helpers/release-install-http-probe.py`, unchanged original | `5a807ccd3ee885890934ceb0b3b23b8072f30a1b5dcc9bd84a30c255d0852de8` |
| `tests/helpers/release-install-http-loopback-probe.py` | `b14445344c7d3a609c2d7c86fe1193dc2da0d4565a5b485b9f77e8b7444f95c6` |
| `tests/unit/release-install-http-loopback.test.ts` | `ee94496c4ad484b9f1f6070a427a17a05cc5200961d5406406c804d7557c8641` |

Base HEAD: `b586556db4e7b95e3f5d8b5f48d191f30d124d3f`.
The freeze receipt is `tmp/t0205-loopback-oracle/freeze.json`; it additionally
binds this provenance file and the unchanged historical files.

### Executed RED and independent calibration

The final original-fixture command ran the unchanged repository Jest
configuration, in band, against only the new suite. Jest exited normally with
code 1: six passed, one failed, zero skipped, zero runtime-error suites.
L02 fails the executed `toEqual([])` resolver assertion at line 103, receiving
`["127.0.0.1"]`. Native exchanges and cleanup assertions preceding that
matcher passed. L01 and L03 through L07 also passed.

Structured report: `tmp/t0205-loopback-oracle/red-final-jest.json`, SHA-256
`7ac261d57334d0d734a134609542474f0605c28e9ac9cdb0a51df0d69d6b234f`.
The matching summary records exit status, all exact names and classifications.
`original-observations.json` separately retains real observations for all five
cases. Each case records one sentinel call, actual native curl and restored
hooks. These runs do not measure actual DNS duration.

The first structured RED report is retained as `red-jest.json`. After Jest
completed, the ignored receipt launcher failed decoding UTF-8 stderr as
Windows CP1252. Only the launcher was corrected to use explicit UTF-8. The
tracked oracle was unchanged; the final run above proves the observed normal
exit and intended assertion failure. The launcher error is not a mutation kill.

Private calibration uses an independently authored numeric TCP-binding
reference and three separate faults. Each executes all five actual fixture
cases. An isolated Jest replay reads those labelled observations; every
matcher function and test identity is byte-identical to the tracked suite.
The private reference does not change the tracked fixture.

| Calibration | Exit | Passed / failed | Intended failure | Structured report SHA-256 |
| --- | --- | --- | --- | --- |
| Numeric reference | 0 | 7 / 0 | None | `dff0266bfe5be6ec726350bf60e810fdd0635ef678e79f5bf837debd5605cced` |
| Explicit resolver-call fault | 1 | 6 / 1 | L02 resolver assertion | `c6575d2655418e9385d22ce599339610dcad5b7c1e7cc1e20b1732ecd6dd4e50` |
| Incorrect name metadata | 1 | 6 / 1 | L03 bound-name assertion | `76b90cfcec4c66e5beb61f0073da8543d6bff27b3b578f6cf71ec56313f54273` |
| Incorrect port metadata | 1 | 6 / 1 | L03 bound-port assertion | `da2f329f4ef9bd908b18173d4b71a1a3ea2301bf9f371c09400195af7d87a35e` |

Every calibration has zero skips and zero runtime-error suites. Reports,
observations, matcher-tail equality check and the private runner remain under
`tmp/t0205-loopback-oracle/`. These are calibration controls, not committed
mutation sweeps or platform acceptance. Focused ESLint on the new test exits 0.

Exact frozen test identities:

1. T-0205 independent loopback binding oracle L01 resolver sentinel detects the stdlib constructor without actual DNS
2. T-0205 independent loopback binding oracle L02 literal loopback binding performs zero resolver calls during actual native HTTP
3. T-0205 independent loopback binding oracle L03 activated threaded listener metadata matches its actual numeric bound address and port
4. T-0205 independent loopback binding oracle L04 independent control and healthy probe retain real public 200 anonymous 401 authenticated 200
5. T-0205 independent loopback binding oracle L05 actual authenticated 401 refuses the probe and preserves owned cleanup
6. T-0205 independent loopback binding oracle L06 occupied listener retains real 200 401 200 and survives the probe refusal
7. T-0205 independent loopback binding oracle L07 TERM resistant owned child stops while successful native HTTP and decoy survive

Historical HTTP/default/context suites and their helpers are unchanged from
HEAD. Their source hashes preserve historical names and assertions. No
historical suite execution or post-amendment green is claimed at this stage.
The Harness, bridge, existing other oracles, deadlines, request arguments,
attempt counts and mutant manifest remain unchanged.

Stop point: RED is frozen for coordinator review and commit. No fixture
implementation, commit, push, full gate, committed sweep or final acceptance
has been performed by this author. Resume fixture work only after the
coordinator commits this RED and sends explicit authority to proceed. Append
later fixture hashes and validation provenance; retain these original receipts.
Actual native macOS DNS attribution remains the coordinator's reference-first
diagnostic and independent REVIEWER work.

## 2026-10-02: separately approved additive m7 freeze

After the original RED freeze, independent R2 REVIEWER Schrodinger granted
the additional mutant scope. The coordinator recorded `additiveMutant` under
the task's loopback authority, extended the written brief and transferred
exclusive `tests/fixtures/mutants/T-0205.json` ownership to this ORACLE session
before the manifest edit. The recommendation originated with the operator;
the subsequent reviewer PASS authorises this addition.

Appended only `m7-restore-resolver-binding`, selecting only
`tests/unit/release-install-http-loopback.test.ts`. Its exact single-line
anchor is `        server = LoopbackHttpServer(("127.0.0.1", 0), Handler)`;
the replacement is `        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)`.
The same handler, literal address and ephemeral port remain. The reason tests
resolver independence with actual native HTTP. It makes no historical DNS
cause or duration claim.

Old manifest raw SHA-256:
`b50f44b99209fd9b305b119e3b38c10dc8f42f8eac98a17f020174a4374d8430`.
New manifest raw SHA-256:
`2c1613e89f7eb99eb665a6cd5687ae85763b8a2b854e33e915c611c61421af5a`.
The manifest contains exactly seven mutants. The six original JSON rows are
semantically identical. Their complete source prefix is byte-identical,
apart from the necessary comma after the existing final row; the original
closing suffix is unchanged. The original manifest snapshot is retained as
`tmp/t0205-loopback-oracle/m7-original-manifest.json`.

The actual fixture still has the original hash
`5a807ccd3ee885890934ceb0b3b23b8072f30a1b5dcc9bd84a30c255d0852de8`.
The future m7 anchor occurs zero times, so its current classification is
**NOT APPLIED**. No mutation was applied or swept, and no m7 kill is claimed.
Unique application, actual native HTTP controls, the intended L02 resolver
assertion, and exact restoration must be proved after implementation.

The original helper/test hashes, all seven oracle identities, original
structured RED and private calibration receipts remain unchanged. The
original `freeze.json` is retained without modification. The additive receipt
`tmp/t0205-loopback-oracle/m7-freeze.json` links that freeze, binds the amended
manifest and this appended provenance, and records the current missing anchor.

The fixture implementation remains stopped pending the coordinator's RED
commit and explicit proceed message. This author has made no commit, push,
full gate or committed sweep.

## 2026-10-02: observer constructor-hook amendment before RED commit

The operator identified a real observation gap: replacing the fixture's
`ThreadingHTTPServer` symbol would miss a future direct
`LoopbackHttpServer(...)` construction. The operator explicitly authorised
this observer amendment and required the same seven names and assertions,
fresh original RED and reference/fault calibration, and a new freeze receipt.

The observer now wraps inherited `HTTPServer.__init__`. The hook forwards
the original positional and keyword arguments and delegates bind/activation
through the original constructor. It records the actual constructed server
after activation. It replaces neither fixture constructor symbol nor
`server_bind`. Both original threaded construction and directly constructed
subclasses inherit the hook. Native bridge delegation remains unchanged.

The hook also records the actual class name for calibration evidence. It
restores the stdlib constructor, resolver, bridge, handler and listener hooks
in `finally`, including whether `HTTPServer.__init__` and `serve_forever`
originally existed as local attributes. These changes preserve the existing
test assertions; the Jest suite is byte-identical to the original freeze.

Old observer SHA-256:
`b14445344c7d3a609c2d7c86fe1193dc2da0d4565a5b485b9f77e8b7444f95c6`.
New observer SHA-256:
`faa966a9367dd4b0a9a7b97d1c4934ebe67d1be90d9c8522ab209294a447bb61`.
The old observer and provenance bytes are retained under
`tmp/t0205-loopback-oracle/` as `observer-before-constructor-hook.py` and
`provenance-before-constructor-hook.md`.

Private calibration compiles the existing fixture in memory with only the
constructor call changed to the proposed direct `LoopbackHttpServer` symbol.
That symbol holds an independently authored numeric-binding reference or a
labelled fault class. The private fixture's original `ThreadingHTTPServer`
symbol is replaced with a function that raises if invoked. Every calibration
records zero calls to that poisoned symbol, one actual subclass listener per
case and restored hooks. The directly constructed classes are observed
without dependence on the fixture factory symbol. The tracked fixture is
unchanged; this is a private calibration, not fixture implementation.

All controls execute five actual HTTP cases and replay byte-identical matcher
functions/test identities. Fresh structured results under
`tmp/t0205-loopback-oracle/constructor-hook/`:

| Run | Jest exit | Passed / failed | Intended failure | Report SHA-256 |
| --- | --- | --- | --- | --- |
| Original fixture, `red-confirmed` | 1 | 6 / 1 | L02 resolver assertion | `6d1802f74b85896e8a3daee802b5fd49512a0bf7ee16d708f068840cb9d3659e` |
| Direct numeric subclass reference | 0 | 7 / 0 | None | `199c3999c829e6d8908bd6d65f275e910cb3570bdeb8e01aab695fe0d64c7add` |
| Direct subclass lookup fault | 1 | 6 / 1 | L02 resolver assertion | `01283f0bc6a19776c22c841c0d50a305bef02e9cdb805aac39c8d5ae455dc34b` |
| Direct subclass name fault | 1 | 6 / 1 | L03 bound-name assertion | `6ff39cd3df63c919d49ecec5ae61c876c82364399109a2d732160584120640f6` |
| Direct subclass port fault | 1 | 6 / 1 | L03 bound-port assertion | `f2ca48cdb89810dc6c348dfa4578aa90513cf9c40856c2b185629c57cfd74b33` |

Every run has zero skips and zero runtime-error suites. Original RED again
observes `["127.0.0.1"]` at the unchanged L02 `toEqual([])` matcher. Actual
native exchanges, metadata and ownership/cleanup checks pass. The original
case observations and four direct-construction proof files are retained.

The first new RED execution is separately retained as `red-final-jest.json`
in the new subdirectory. It also produced the intended six-pass/one-fail
result, but the ignored launcher's later cache-root removal encountered
Windows `WinError 145`. That launcher cleanup failure is not a test or mutation
kill. Subsequent runs retain their exclusively owned launcher/cache roots as
evidence and complete normally. Actual fixture and test-owned cleanup
assertions remain unchanged and pass.

`constructor-hook-freeze.json` is a new additive receipt. Both preceding
freezes and all preceding report hashes remain unchanged. The manifest retains
the approved seven entries and its hash
`2c1613e89f7eb99eb665a6cd5687ae85763b8a2b854e33e915c611c61421af5a`.
The actual fixture retains hash
`5a807ccd3ee885890934ceb0b3b23b8072f30a1b5dcc9bd84a30c255d0852de8`;
the m7 future anchor still occurs zero times and remains NOT APPLIED.

Fixture implementation remains stopped pending the coordinator's RED commit
and explicit proceed message. Post-implementation m7 application/restoration,
full gates, committed sweeps and native DNS attribution remain unproved.
