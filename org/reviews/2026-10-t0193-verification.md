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
