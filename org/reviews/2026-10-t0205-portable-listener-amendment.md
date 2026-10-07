---
summary: Independent Q015 portable actual-accept witness amendment and scoped refreeze
type: venture
tags: [oracle, testing, refactor]
---

# T-0205 portable listener witness amendment

Date: 2026-10-02. Status: author refreeze ready for independent R2 review.
This report does not grant R2 acceptance, whole-gate or hosted acceptance.

## Authority and provenance

Fresh independent ORACLE, registered session
`2026-10-02-portable-listener-oracle`, lane
`T-0205-portable-observer-oracle`. Clean-context authorship plus independent
stdlib behavioural controls and deliberately faulty private observer variants.
No product/Harness implementation was inspected. The existing observer and
seven-name suite supplied the observable contract. The fixture was hashed,
not inspected or edited.

Independent R2 REVIEWER Schrodinger
`01a0f7b7-f68a-79b2-ba74-81cdddf2f3ef` authorised this Q015 scope before edits
at `2026-10-02T11:31:58.332Z`, as recorded in T-0205
`portable_observer_authority` and
`org/briefs/T-0205-portable-listener-amendment.md`.
The registered source lane contains exactly:

- `tests/helpers/release-install-http-loopback-probe.py`
- `org/reviews/2026-10-t0205-portable-listener-amendment.md`

Preparation initially wrote source and private calibration files only. The
operator subsequently reported the passive corpus diagnostic complete and
authorised private controls plus the seven-name suite, with only the observer
overlaid after checking its preimage. No validation ran before that permission.
No full gate, dependency installation, product edit, TypeScript edit, manifest
edit, earlier report edit, task-record edit, commit or push was performed.

Private retained evidence root, relative to the repository:

`tmp/t0205-portable-listener-oracle-20261002-aad3588229e145eea389bacb457f3720/`

Original observer, suite and cleanup helper bytes are retained there as
`original-probe.py`, `original-suite.ts` and `original-cleanup.ts`.
`preparation-baseline.json` records the initial identities and hashes.
`authority-brief.md` preserves the brief used before edits.

## Amendment

The observer no longer queries `SO_ACCEPTCONN`. Each listener starts with
`accepting: false`. An instance hook calls that listener's original
`get_request` with unchanged arguments. Only successful return changes the
flag to true, and the hook returns the exact original accepted tuple.
A never-called getter remains false. A throwing getter remains false and
propagates the same exception.

The existing `finally` restores the exact original instance attribute when
one existed; otherwise it deletes the temporary attribute to restore inherited
lookup. The existing `restored` result additionally checks ownership and
original callable restoration. Existing constructor, native curl requests,
numeric endpoint, HTTP status assertions, threading, socket options and cleanup
remain in place. No timeout or readiness-attempt value changed.

Observer SHA-256, raw on-disk bytes:

- Before: `faa966a9367dd4b0a9a7b97d1c4934ebe67d1be90d9c8522ab209294a447bb61`
- After: `90c3eb25f3f51981f81134a1462db3605d6f97f3577675feab32b7f1a63b6a27`

## Independent controls

`calibrate.py` ran once with Python at `C:/Python314/python.exe`; exit 0.
It uses separate stdlib fixtures through the existing private fixture override.
It does not load the installation fixture or product implementation.

Twenty controls passed: each of the following five behaviours ran with
inherited and instance-local getters, with ordinary sockets and with a
socket whose `SO_ACCEPTCONN` query deliberately raises `ENOPROTOOPT`.

| Behaviour | Required and observed result |
| --- | --- |
| Real native curl HTTP | HTTP 200 and successful original acceptance; flag true |
| Direct real socket acceptance | Original arguments and returned tuple identity preserved; flag true |
| Never-called getter | Zero getter calls; flag false |
| Throwing getter | Same exception and arguments; flag false |
| Exception escaping fixture | Same exception escapes observer; exact restoration still holds |

Every control checks exact instance/inherited getter restoration, the original
global hooks and handler, closed owned sockets and stopped owned threads.
Unsupported-option controls explicitly exercise the rejecting socket query;
the observer itself makes zero such queries. Real curl paths, binary hashes,
commands, exit codes and HTTP status are retained in the individual receipts.

Four deliberately faulty private variants failed their intended assertions:
unconditional acceptance with a never-called getter, and acceptance marked
before a throwing delegate, each with inherited and instance-local getters.
All four retain an executed `accepting=True, expected=False` mismatch after
successful restoration checks. They are qualified calibration rejections,
not unexpected infrastructure failures. `calibration-01/21.json` through
`24.json` preserve these failures and tracebacks. All 24 control receipts remain.
These local controls are not a replacement for native hosted validation.

Calibration source SHA-256:
`f0fa3faaa6873bbbd7258408f0216b78bc47b5af54f8ee637c99f059e6c7d2e3`.
Calibration summary `calibration-01/summary.json` SHA-256:
`5cf499b27fc21da99d4fb394059df0247d3b5c91105493adb0ce4cdfa6c93fce`.

## Seven-name suite and assertion identity

The focused Jest run exited 0: **7 passed, 0 failed, 0 skipped, 0 runtime-error
suites**, in 7.167 seconds. It used pinned Node 24.21.0 / ABI 137 in
`tmp/t0188-green-validation`, with owned home/data/Hermes/temp/cache paths.
Only the observer was overlaid. Its checkout preimage matched the original
hash above; the overlay matched the amended source exactly. The overlay is
retained for the coordinator. No report or metadata overlay was performed.

`focused-01/summary.json` contains the before-overlay, after-overlay and
after-run hashes. Every watched input stayed unchanged during execution.
The TypeScript suite and shared cleanup assertions remain byte-identical to
their saved originals, preserving every assertion, matcher, value and timer:

- `tests/unit/release-install-http-loopback.test.ts`:
  `6a600cd034b0ca8483df6da0d776ff5348b367d7decdde299e5e350621b53b57`
- `tests/helpers/release-http-cleanup-assertions.ts`:
  `4e15bd1080cdb728cb2342522d4650a61a6f435630e8ba545f7ab3d84cc1c4c2`

The suite prefix is exactly `T-0205 independent loopback binding oracle`.
Before, executed and after names match in order, with these exact suffixes:

1. `L01 resolver sentinel detects the stdlib constructor without actual DNS`
2. `L02 literal loopback binding performs zero resolver calls during actual native HTTP`
3. `L03 activated threaded listener metadata matches its actual numeric bound address and port`
4. `L04 independent control and healthy probe retain real public 200 anonymous 401 authenticated 200`
5. `L05 actual authenticated 401 refuses the probe and preserves owned cleanup`
6. `L06 occupied listener retains real 200 401 200 and survives the probe refusal`
7. `L07 TERM resistant owned child stops while successful native HTTP and decoy survive`

The unchanged assertions retain actual native 200/401/200 exchanges, authenticated
refusal, occupied-listener survival, TERM-resistant owned-child cleanup,
numeric address/port, threaded requests, socket options and every cleanup check.
The 150-second Python process limit, 160-second setup limit, shared 25-second
bound and fixture's existing request/watchdog/deadline limits remain unchanged.

Focused summary SHA-256:
`804bfdef8f1b01a7bcf45e66e5882b9d0b4e901bff5cafff1c892be0386a4c77`.
Structured Jest result `focused-01/jest.json` SHA-256:
`acef69cef53a3d034fc124172534c9238102f0858ad17e695d4342e0d833258b`.

## Limits and hand-off

The removed unconditional socket-option query is a verified portability
hazard under an unsupported-option control. This does not establish the
original native macOS failure's stack frame or cause. Native macOS hosted
acceptance remains mandatory.

The operator reports that the separate passive corpus diagnostic completed
normally with 7,681 passes, nine existing skips and the same `44d5700` stamp.
That result was not independently rerun or inspected in this lane. The Windows
EPERM remains unreproduced by that diagnostic; no T-0161 change was made.

Author writes cease at the private `freeze.json`, which records this report's
hash, the observer hash, full seven-name identity and receipt hashes. The
coordinator owns task provenance updates, metadata overlays and the later full
gate after independent R2 freeze acceptance. There is no final acceptance here.
