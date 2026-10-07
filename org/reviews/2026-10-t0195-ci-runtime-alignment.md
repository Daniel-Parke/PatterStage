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
9062 cases pass,5 skip; one suite fails to execute its12 cases. Next build and
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
