---
summary: Exact hosted native crash and authorised alignment with the validated Node runtime
type: review
tags: [testing, ci, runtime]
---

# Hosted runtime alignment

At dev f1f9162c, all four workflows finished. Both secret scans and push CI
pass. PR CI passes its full browser/acceptance, install, real Hermes, Docker,
Linux and boot/shell jobs, but macOS unit coverage fails. Job112748279916 in
run37608052780 reports Jest worker8973, SIGSEGV, null exit code. Actual totals:
9062 cases pass,5 skip; one suite returns no case results. Next build and
purity in that macOS job do not run. The failed run is retained, not retried.

The failing console-shapes-and-dead-ends suite already explicitly uses Node;
its bytes, scanner and chapter-title helper are unchanged. It does not import
SQLite. No external killer, native module, timing cause or connection to the
Windows replacement failure has been established. Available timing artifacts
preserve their successful observer and original failed coverage status. No
OS crash report was uploaded, so a native-stack diagnosis is unavailable.

Hosted macOS26 arm64 selects cached Node24.20.0; Windows validation uses the
official isolated24.21.0 accepted in T0203. Setup-node may select a cached
semver match. The approved Node24 direction and ADR0020 permit this alignment.
On7October independent REVIEWER Gauss authorises changing only six CI node
selectors from24 to24.21.0. No new operator ruling/ADR or frozen amendment is
required. All coverage commands, observer body, flags, workers, deadlines,
failure propagation and unrelated workflow fields remain unchanged.

Verify: an executed red-first selector oracle, exact six-field inverse,
otherwise identical parsed workflow, unchanged observer controls, complete
local gate and restored mutation control, then all new exact-head hosted jobs.
Hosted setup logs must confirm24.21.0 and its architecture/ABI. This aligns
reproducibility; it does not prove SIGSEGV repair. T0195 remains in-review and
T0206 remains active. OS-crash collection is a separate proposed diagnostic,
not silently introduced here. Other Node24/Docker/docs selectors are outside
this narrow confirmed CI mismatch repair.

Sources: [setup-node cache/version behaviour](https://github.com/actions/setup-node/blob/v5/README.md),
[official Node24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0).
Bounded reviewer authority:tmp/t0195-ci-runtime-alignment-authority-20261007.json.
Hosted receipts:tmp/t0195-hosted-1791370067890/snapshot.json and
tmp/t0195-native-crash-classification-20261007.json. No universal compatibility
or release acceptance follows from a later green run.


## Red adoption and exact implementation

The prepatch one-case oracle freezes at SHA256
67c48a1498376629aa9f21aa264a10030affed3fbdcf6db634aaea9aa6e3fca1:
one intended matcher red,ten unchanged observer passes,zero runtime errors.
Gauss independently adopts the preserved red receipt. It is committed at
f9c95d56 before changing only six version selectors. The inverse is exact;
parsed workflow fields are otherwise identical. The same eleven focused
cases then pass. Proofs:tmp/t0206-runtime-proof and
tmp/t0206-runtime-focus-1791371333271. Whole gate/sweep/hosted checks pending.

Correction: sixteen static it declarations are present in the crashed suite.
The earlier12 figure incorrectly subtracted cross-platform pass totals with
different platform-dependent cases. Report the missing returned suite results,
not an inferred unexecuted count. Original logs and failed head stay preserved.

## Local landing and causal verification, 7 October

The exact six selectors land in `2e923aed`; the separately gated Chat prerequisite lands in `ba85d4c5`. Complete combined gate `1791376312504` passes all ten steps with 9,075 unit and 523 browser passes, two build-purity controls and unchanged tree stamp `4ec3a994db1cfd0d9543aa2163813be78d72e824eda3dda1662be9d9d58e9d31`. Main and the preserved owned checkpoint share committed tree `46ae635b5d1a7f832f48aab7dfe6a8a1ad5ca07b`.

Production sweep `tmp/t0206-runtime-sweep-1791377211714/summary.json` runs on clean `ba85d4c5`: one control passes, one exact selector reversal causes the intended `toEqual` failure, and the restored control passes. All three structured runs contain the same case, no skips or runtime errors. Actual source newline adaptation precedes unique-anchor classification. The unchanged production runner verifies source/mode restoration and clean status. This is one representative selector kill, not evidence that Node changes resolve SIGSEGV.

Independent R2 adoption: `tmp/t0195-combined-gate-adoption-20261007.json`. Final exact-head hosted runtime and every applicable job still need observation. T-0206's historical timing failures and native-crash cause remain open. No retry, worker reduction, timeout increase or failure waiver has been made.
