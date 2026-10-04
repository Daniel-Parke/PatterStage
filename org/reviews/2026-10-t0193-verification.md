# T0193 verification

Opened under Q-036 at `9e55c5a34c10094a11930a5f4024c69a6d5a71d1`.
Hosted snapshot: `tmp/t0191-hosted-t0206-selector-current/snapshot-1791108455908.json`.
PR CI37193334646 passed10jobs and failed macOS C02/C05:18of21calls and
watchdog exceeded. The subsequent isolated20/20pass does not clear that failure.
Push CI37193331986 and both Gitleaks runs passed. T0206 remains active and red.
Q036 changes the T0193 start dependency only; closure/release checks remain.

Independent Faraday profile oracle:16behaviour cases,4passing/12failing,
zero runtime-error suites. Receipt:`tmp/t0193-profile-oracle-red-frozen.json`.
Real forms/runWrite/selection; held synthetic transport; failures reproduce
newer drafts being closed or reset, late unmounted effects and stale selection.
LF SHA256:`05cb67a1b91de7e4911bd11b03fc9012c11f4b692bbe93cf1255629aa601e4a0`.
Source implementation was unchanged at this red checkpoint. Browser proof,
full gate, causal mutations, independent acceptance and hosted checks follow.
The other18supplemental rows remain pending; no batch closure is claimed.

Q015 independent amendment by Franklin adds one recovery case. With the
profile repair in progress, all16 original controls pass; the new case fails
causally: second confirmed rename selects default after the first refresh
refuses. Receipt: `tmp/t0193-profile-amendment-red.json`;17cases,16pass,
1fail,0runtime errors. Original frozen hash remains recorded above and in
commit e1eea671. Amendment LF SHA256: `77ab9c3c79be00642ef09cce4ac62f79b6597f42a6f8d7d40763bacabd43ee12`.

Faraday's four frozen browser cases reproduce the missing replacement dialog
after a real persisted old write at1440x900 and390x844. Existing isolated
production build at64ed3aca; real opaque sign-in and keyless owned fixtures.
Receipt:`tmp/t0193-profile-browser-red.json`; four failures. Each first failure
is a disappeared dialog, followed by soft assertion timeouts. Fixture boot,
authentication and persistence succeeded; these are not launch failures.
LF SHA256:`acf9c71fa7450adb062d6e451a68cb7db740c7d3de66aef3e8d2df1c144a7886`. No source build was performed for this red control.
The additional profile recovery control now passes17/17, zero runtime errors:
`tmp/t0193-profile-amendment-green.json`. Browser green awaits the batch build.

Independent read-truth oracle:14cases,8pass6causal failures,0runtime errors.
Receipt:`tmp/t0193-read-truth-red.json`; LF SHA256:`ceba024fdee96317882e56fcff6bfaad2f04debce3ff61b4a3b728e42abef97b`.
Models primary-read failures show false empty, Skill500/network says missing,
and Growth failure asserts no completed work. The cached/disclosure control
and genuine empty/missing/malformed/thin success controls already pass.

Independent Franklin followup oracle:17cases,6pass11fail,0runtime errors.
Receipt:`tmp/t0193-followups-red.json`; LF SHA256:`16f1e4377c3581b2cabe650573727052a32acd794dc2bb1abd6c9bf305658856`.
Includes held Composer ownership, keyboard navigation/indent/save controls,
clipboard refusal/success, exports/labels, search context, daily chart values
and collection state. These source hypotheses now have runnable controls.
Read truth/profile combined31/31 and existing five-page suites38/38 pass.

Faraday independent review identified cached-row reselect and stale-description
reopen risks. Franklin independently added two controls under Q015, retaining
17existing cases. Red19cases:17pass2fail0runtime errors,
`tmp/t0193-profile-cache-red.json`; amended LF SHA256:`9f6003bb94a453ea3c33495e8f37488e2700b9c10987b439dcf412b8ff46a977`.

Banach independently selected existing Missions unit/browser contracts before
binding-only consolidation. Existing unit control: 30cases passing,
`tmp/t0193-missions-before.json`; no new assertions or test retirements.
The existing page hook and interface stay; only repeated bindings/aliases go.
This cohort uses behaviour parity controls; it is not a newly red behavioural
defect. The batch red-first defects remain separately recorded above.
Frozen existing-test LF hashes: {"tests/unit/mission-query-ownership.test.tsx": "645d7bcf373803a83a7b3e0e674d767f71f8c8a848730de9cde27443e6ce1b5a", "tests/unit/mission-template-editor-wiring.test.tsx": "5970075307193edafa251aaa93db6ffaf27c6021b63d1a593052a654944f64ef", "tests/e2e/missions-flows.spec.ts": "0b6b72b33bd9f717b4feaba08b78ce3cfa36ba23e65f2561429fd1683ff4170c", "tests/e2e/missions-compose.spec.ts": "b03c3daa0ead65eeaa49538f6f8ae1fc96c0e30fdc9b7f8bccae7d3a044e5caa"}

Franklin visual oracle:8cases,4pass4fail on isolated old64ed3aca build.
Reader small-text contrast and reduced-motion first-frame reveal each fail
at1440x900/390x844. Five faces/persistence/dismissal and normal-motion controls
pass. Receipt:`tmp/t0193-reader-browser-red.json`; LF SHA256:`4eed73564270643e4849b4ef9ee005a6a5c4c1d11698d99de99e2b4b801a3aa2`.
Measured muted labels4.0328:1, and delayed reduced-motion children remain
opacity0 (last delay0.55s) despite duration0.01ms. No rule was changed yet.

Coordinator pre-gate:50new unit controls pass; existing five-page suites38pass;
Missions before/after30pass with identical complete name sets. App typecheck
and changed-source ESLint pass. Initial test typecheck failed on five unsupported
Testing Library `exact` options. Faraday independently removed only those
properties; string matching stays exact,17names/assertions preserved; focused
17and complete test typecheck pass. Amended LF hash is recorded on the task.

Census before full gate: source102077(+15), tests151608(+841), source repeated
windows693(−12); test windows4787 and one-importer103 unchanged. The new50unit
and12browser controls are retained regression coverage. Source growth is the
net cost of draft ownership, truthful read errors and accessible state after
Missions−41, label-map−6 and narration cleanup. Targets remain unchanged.
Reader production green, controlled walks, full gate, sweep and acceptance
remain pending. No batch closure or macOS repair is claimed.

First full gate stopped at lint, unchanged tree406bf8ab7384899e74b317ccc6d7f8d165b04a908de888539a296c3bd4b59d97:
`tmp/t0193-coordinator-gate-1791111618337/gate/summary.json`. Three deliberate
computed-style reads in the frozen browser oracle violated no-unused-expressions.
Faraday independently prefixed those reads with `void`, preserving all eight
names/assertions/style flushes. Focused ESLint passes without a rule change.
The exact amended file was replayed on the old compiled Reader/CSS:4pass4fail,
zero flaky retries; `tmp/t0193-reader-lint-amendment-red.json`. This replay
supersedes the earlier browser red receipt at the same output path. Frozen LF
hash:`9737b028b3f37669c010247a248c65563db195f216883d3ce2d9fd25b0f2d80b`. Full gate must repeat on the amended tree.
After correcting the stale Models header, source102070(+8), tests151608(+841),
source repeated windows693(−12). Fixed targets remain unchanged.


Second unchanged-tree full gate stopped at Jest, 8880pass/3fail/9existing skips,
850passing suites/twofailed/twoexisting skipped. Lint and app types passed.
Receipt: tmp/t0193-coordinator-gate-1791111981141/gate/summary.json.
Three failures are two historical chart emission assertions and the C5 directive
floor after three unnecessary Models suppressions were removed with correct
callback dependencies. Independent Q015 amendment is required; no green claimed.

Banach independently found a real Composer regression in the keyed child:
closing/reopening the Sheet lost pending/saved protection. Faraday independently
added eight held-transport controls; original17 case bodies/names retained.
25controls:19pass/6causal matcher failures, zero runtime errors. Receipt:
tmp/t0193-composer-lifecycle-red-final.json. Frozen LF hash: 959c9091b94fd29c88eca0a1f03fe6e8bd3721ada6ab2e3b0e25c9fba13262d0.
Controls cover close/reopen, A to B to A, run identity, synchronous claim,
refusal retry and unmounted feedback. Parent-local repair follows this red commit.
The cached-reselect mutant was independently found type-invalid; its replacement
now retains pendingRename null narrowing while bypassing stale-row correction.
No mutation kill is claimed until the committed sweep runs.


Faraday's dated Q015 historical-guard amendment passes44/44, zero runtime
errors: tmp/t0193-historical-guards-amended-final.json. All21baseline hashes,
compiler/options, type contracts and original names remain. Only four exact
approved chart role/label pairs are validated and excluded from old emission;
one new negative control rejects missing, duplicated and changed attributes.
C5 retains37/12floors. Exactly three retired Models suppressions earn credit
only after their replacement callback dependencies are independently checked;
the remaining nine lexical matches, including the existing documentation
marker, are individually pinned. No expected hash or floor has been blessed.
Focused ESLint and targeted typecheck pass. The writer released its lane.

Composer lifecycle25/25passes; Banach independently accepts the bounded parent
ledger repair, original17identities intact and no other P1/P2 runtime findings.
Three new mutation cases challenge run ownership, synchronous duplicate claims
and unmounted feedback. These join the16representative cases;19total.
Measured pre-gate source102068(+6against102062), tests151760(+993against150767),
source repeated windows693(-12), test windows4787 and one-importer103 unchanged.
Extra test lines protect actual lifecycle defects and narrow closed-oracle
amendments. Fixed programme targets have not moved. Full gate must repeat.


Third complete unchanged-tree gate: lint, app types,8892unit checks, Knip,
canary, production Turbopack build and two build-purity checks passed.
Browser510pass/one desktop Composer geometry timeout/24existing skips.
Censuses not reached. Receipt: tmp/t0193-coordinator-gate-1791113325850/gate/summary.json.
Tree stamp:0f0a772709cc3c1468c38ade46faac98da86a6bb5806533e5c7cdf2467ee459d.
Complete failing spec alone:57pass/one different phone Mission focus failure;
desktop geometry14s and phone geometry10.4s passed. Receipt:
tmp/t0193-rerun-alone-1791115025482/gate/rerun/summary.rerun.json.
Neither run is full green. All12new T0193 browser controls passed the full run.

Banach trace diagnosis: geometry used291physical Tabs/nine scans/19.66s;
all six recorded geometries satisfied their predicates. Phone failure followed
late setup-notice insertion after wheel navigation. Faraday added only physical
Shift+Tab before Tab for an already-focused target, and phone monitor response
plus derived missing-agent notice readiness before wheel navigation. All58names,
assertions, bounds, screenshots,30s timeout and zero retries retained.
Banach independently reviewed the exact diff and returned bounded PASS.
Frozen LF hash:283bc48ad95fadcb4f3536d8a0bbfc22f9737893cf2e5a42384b3d9db7c32a74.
The amended complete spec and whole gate must repeat; no timing repair or
release acceptance is claimed. Original reds remain recorded.


Independent fixture replay:58/58pass, zero retries, unchanged tree
ddcd6fcffd2eb9841369149b09de7027394fb944bee7e6ff1a2535bbab466a9a.
Receipt:tmp/t0193-rerun-alone-1791116441138/gate/rerun/summary.rerun.json.
This is partial evidence. An earlier launch1791116384981 was stopped by its
owned PID after sandbox denial prevented validation sync; it is infrastructure
interruption, not a test result. Sync then succeeded with prior copy hashes
verified; the amended replay used61a3253b and exact owned runtime copies.

Coordinator personally walked the fresh Turbopack app at127.0.0.1:3999,
1440x900 and390x844, using only owned synthetic data. Models true-empty state
and labelled add/cancel dialogs; Profiles cancelled draft retained, creation,
selection and canonical rename; Reader five faces,18px Inter persisted over
reload, Escape dismissal, phone chapter overlay dismissal and chapter1→2;
Research owned report, five labels, truthful Copied feedback and single semantic
view/download links; Composer Build→Run→Build retained draft, successful owned
workflow save, Kind dropdown, phone inspector and HIL selection; Script
Shift+Tab preserved content and focused Filename, Tab inserted two spaces,
Ctrl+S retained the draft with the expected unauthenticated host-write refusal;
Skills filtered result retained engineering context and View rendered content;
Memory rendered unavailable-provider guidance and selected Directives state.
Inspected Models, Profiles, Reader, Research, Composer and Logs had one h1 and
zero document horizontal overflow. No captured browser console error occurred.

Qualification: preview usedPS_AUTH_MODE=none and no provider credentials.
Script successful writes, paid generation, live Hermes dispatch and healthy
Hindsight service are not claimed by this manual walk. Held save/race/refusal,
read-error/404, chart full-value naming, Logs/Hindsight state, reduced-motion
and retained Story/Composer boundaries are covered by their named unit/browser
controls. Manual coverage is bounded; programme-wide/release acceptance stays
open. No operator database, installation or listener3333 was used or changed.

Image hashes (owned synthetic fixtures; build from the third full gate,
runtime stamp0f0a7727, fixture-amendment commit61a3253b; image filenames encode
the state and viewport):
- `tmp/t0193-ui-proof/composer-inspector-phone-after.png` SHA256 `81767c3eeaf703fba624ff1c9369c6e2ee7b2411055eae588b4332bf3712bfd7`
- `tmp/t0193-ui-proof/composer-inspector-phone-clean-after.png` SHA256 `7600d0a8e4db7e3053338a4f6781e235ec12f372cf1382262e74b26567e5fa87`
- `tmp/t0193-ui-proof/models-phone-after.png` SHA256 `b844374bfe3a7462f9790993eb69a992978226ea451cf8bfece892cdba03d4d5`
- `tmp/t0193-ui-proof/profile-rename-phone-after.png` SHA256 `e26acff4b779b27483113617b52597e9667047ca1c5957e8c4b741e56592b57d`
- `tmp/t0193-ui-proof/reader-settings-desktop-after.png` SHA256 `123d93fc6ecb35eec7ed77bc1f5be5b73d17a09ade98268ba6bc0a9b615f6e62`
- `tmp/t0193-ui-proof/reader-settings-phone-after.png` SHA256 `f1d886d851e6ce132de832efa37fbb4d69bb27c29c2b71e4aa7acf3cefe06b7d`
- `tmp/t0193-ui-proof/reader-settings-phone-clean-after.png` SHA256 `777099083df0ce4411e57f1cf5a88d73438cb77bdefa5ee6e742ce2f9f595780`
- `tmp/t0193-ui-proof/research-desktop-after.png` SHA256 `828f5792d5874c6dc6047faef3d2b4d790bc7b8ab30a833093438ebae5e12f3e`


Finished local tree: all10gate stages exit0;8892unit/511browser passes,
9unit/24browser existing skips unchanged; production build, two database-purity
checks and both censuses pass. Complete receipt:
tmp/t0193-coordinator-gate-1791116785371/gate/summary.json.
Tree before/after:2db823333ea34e2c09a2ca39290f4ba5be7e81ae67c85a87467f0007b857380f.
Product commit:9ce945ac633e72c8a489812fa287aa31eb15fc5a. Reconstructing the
precommit HEAD/index with all2692current paths, actual bytes and modes exactly
reproduces that gate stamp:tmp/t0193-gate-commit-binding.json. Two mixed-CRLF
files required Git metadata refresh; there was no content or staged change.

Committed isolated sweep:19KILLED/zeroSURVIVED, NOT-APPLIED, INEFFECTIVE or
infrastructure failures. Structured21calls retain each executed matcher/name:
tmp/t0191-t0193-sweep-9ce945ac/summary.json and call-0.json throughcall-20.json.
The existing recorded-run wrapper was reused with the explicit T0193 manifest.
Original/restored controls58/58pass; actual file/mode stamp7c28f14508f74b8ee7c00263fb324dcd15be006f99caa9e5d9a8a260f6919bba
matches before/after. Causal names correspond to profile identity, duplicate
claim/unmount, read-failure truth, artifact content/run identity/claim/unmount,
clipboard, five labels, daily values and collection selection.

Banach independently accepted the bounded LOCAL evidence; required exact-head
hosted checks remain pending. All19supplemental rows are locally adjudicated,
with15implemented repairs/consolidations and four retained cohorts/rollups.
No foreign child owner is marked done. Final census:source102068(+6),
tests151770(+1003), repeatedsource693(-12), repeatedtests4787 and one-importer103.
Growth records explain regression coverage and ownership/accessible-state cost;
fixed targets remain unchanged. T0193 stays in-review, not done, until hosted
acceptance and independent final verdict. T0206 remains explicitly red.
