---
type: venture
summary: Dated T-0202 oracle amendment limited to Linux HTTP log-path relocation, with unchanged assertions and observed platform results
tags: [eos, testing, oracle-amendment]
date: 2026-09-30
author: 01a0ef6e-78e7-7290-9aac-e9af8a73ebcb
authoriser: Goodall
authoriser_id: 01a0ef6e-780c-77e2-9377-b20014518524
original_oracle_author_id: 01a0ef7c-4f50-7ce3-88ba-5b8029ea0672
authority: Q-015, exact amendment authorised by the operator on 2026-09-30
reason: Global /tmp/ relocation rewrote the Linux tempfile workspace itself and prevented actual cases from launching
old_helper_sha256: c2fa52345a6aa07f8369f8dd21114c404e5c1d765ad009556bab58e2380ac3d9
new_helper_sha256: bb8a75c57f8d8434c4e4777e7aff9cfa6dadded0959ca7f4e7ea186da5a18b25
unchanged_suite_sha256: f5601e1420d246be1edca594e4ff0028ccb970ed235255f36cc33dff74ae35fc
hash_normalisation: UTF-8 file bytes with CRLF converted to LF
---

# T-0202 dated oracle amendment

Goodall authorised this exact one-line instrument amendment under Q-015.
The amendment author is a different session from both the implementation owner
and the original oracle author. This new record is append-only. The parent
coordinator stages these two files; this session made no commit.

At `tests/helpers/release-install-http-probe.py:200`, the global
`script.replace("/tmp/", f"{shell_path(fixture)}/scratch/")` became
`script.replace("/tmp/ch-http-smoke.log", f"{shell_path(fixture)}/scratch/ch-http-smoke.log")`.
Only the generated server log path is relocated. Linux workspace paths remain
intact. No other helper logic, assertion, test identity or application/harness
source was changed by this author.

The helper diff contains exactly one removed line and one added line. The
TypeScript suite has no diff against frozen red commit `10881bca`; its entire
normalised SHA-256 remains the value in the frontmatter. All 14 names, the
successful control and all assertions are preserved.

## Validation

The amendment author's Windows command was:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/release-install-http-smoke.test.ts --no-cache
```

Observed result: exit 0, one suite passed, 14 tests passed, zero snapshots,
27.169 seconds. The amended helper also passed Python `compile()` without
writing bytecode. No fixture credential was disclosed.

The final Linux run used disposable owned container
`ps-t0202-oracle-review-01a0ef6e-78e7`, existing image `47d80115ce62`,
`--rm --init --pull=never --network=none --read-only`, executable temporary
storage `--tmpfs /tmp:rw,exec,nosuid,nodev`, and only two read-only bind mounts:
the amended helper and the current install harness under `/review/tests/`.
No production data, volume, credential or application service was mounted or
launched. The container entry point was `/opt/hermes/.venv/bin/python3`.

The Python wrapper invoked the equivalent of this command in `/review`:

```bash
PYTHONDONTWRITEBYTECODE=1 T0202_BASH=/usr/bin/bash python3 tests/helpers/release-install-http-probe.py
```

The wrapper parsed all 14 observations and asserted expected acceptance,
launch counts, owned cleanup, deadline completion, decoy preservation, signal
ownership, request bounds and absence of credential leakage. It exited 1 with
18 failed checks across nine cases, in 59.184 seconds. The raw helper's JSON
generation succeeding is not an assertion pass. Linux Jest was not run.

| Preserved frozen test name | Linux accepted | ownedStopped / withinDeadline |
| --- | --- | --- |
| F00 fixture control launches, serves 200/401/200 and stops only its owned process | true | true / true |
| H01 accepts public health 200, anonymous 401 and authenticated 200 with owned cleanup | true | true / true |
| H02 rejects a credential refused by the server | false | false / false |
| H03 rejects anonymous protected access returning 200 | false | false / false |
| H04 rejects public health 204 | false | false / false |
| H05 rejects public health 503 | false | false / false |
| H06 rejects a public health redirect | false | false / false |
| H07 rejects an anonymous protected redirect | false | false / false |
| H08 rejects an authenticated protected redirect | false | false / false |
| H09 rejects authenticated protected access returning 403 | false | false / false |
| H10 rejects a dead launch | false | true / true |
| H11 rejects an occupied listener and preserves the unrelated process | false | true / true |
| H12 bounds stalled HTTP requests and cleans up without the fixture watchdog | false | false / false |
| H13 bounds cleanup of a launched process that ignores TERM | true | true / true |

All 14 acceptance outcomes match their expected values. Five cases satisfy the
checked Linux invariants. Nine negative cases hit the fixture watchdog and fail
the two cleanup/deadline observations. Every case preserved the decoy, recorded
only owned signals and reported both credential-leak fields false. Every case
launched once except occupied-listener, which correctly launched zero times.
The same nine failures occurred in an earlier amended-helper Linux run in an
existing container, taking 59.150 seconds.

A redacted diagnostic for wrong-credential recorded watchdog status 124,
no signal entries, and an owned child alive at the observation point. The
helper exports its own Bash `kill()` shim, including a bare `return` in its
`-0` branch. Its behaviour inside a nonzero EXIT trap is a candidate instrument
compatibility issue. These fixture results do not establish a product cleanup
defect. No further frozen-helper amendment or product change is made here.
The all-green Linux proof requested by the operator was not obtained.

## Invalid results and limits

The original `tmp/t0202-linux-probe.json` result predates this amendment.
Its successful control and zero launches in the actual cases exposed the
global `/tmp/` rewrite. It is an invalid instrument result, not a semantic
product failure or a mutation kill.

An initial disposable-container attempt omitted `exec` from the temporary
mount. Both fixture launchers failed to execute; all actual launch counts were
zero and the positive controls failed. Its 25.116-second result is also invalid
for behavioural acceptance. The final executable-mount run above supersedes it.

The fixture accelerates sleeps and curl timeouts and uses an external watchdog.
These observations do not prove the unscaled 75-second production harness,
the full release matrix, hosted CI or real application behaviour. Assertions
were not weakened to make Linux green.

## Role boundary

This record covers the authorised instrument amendment and its validation.
The author did not implement the harness repair. The operator reported
Goodall's acceptance of the scoped implementation and then explicitly ended
further implementation review in this session. No implementation acceptance is
claimed by this amendment record. The full Jest run, full gate, mutation sweep
and release matrix remain the coordinator's work.

## Provenance correction, 2026-09-30

The specific amendment authoriser was independent REVIEWER Goodall
(`01a0ef6e-780c-77e2-9377-b20014518524`) under Q-015. The coordinator relayed
Goodall's ruling. There was no additional operator approval specific to this
amendment on 2026-09-30. The earlier frontmatter wording, "exact amendment
authorised by the operator on 2026-09-30", overstates the authority and is
superseded by this correction. The earlier entry remains as ledger history;
no prior text has been edited.

## Second exact amendment, 2026-09-30

- Author: `01a0ef6e-78e7-7290-9aac-e9af8a73ebcb`.
- Authoriser: independent REVIEWER Goodall,
  `01a0ef6e-780c-77e2-9377-b20014518524`, under Q-015.
- Authority: Goodall's specific ruling relayed by the coordinator; no additional
  operator approval specific to this amendment is claimed.
- Old helper SHA-256: `bb8a75c57f8d8434c4e4777e7aff9cfa6dadded0959ca7f4e7ea186da5a18b25`.
- New helper SHA-256: `d5bb88e8fd2fabfde3691ecb0446112952d6e55afecef42c6b2a9f40a238599e`.
- Unchanged suite SHA-256: `f5601e1420d246be1edca594e4ff0028ccb970ed235255f36cc33dff74ae35fc`.
- Hash normalisation: UTF-8 file bytes with CRLF converted to LF.

Reason: in a nonzero Linux EXIT trap, the kill shim's bare `return` inherited
that trap's status instead of reporting the successful builtin liveness check.
The fixture falsely considered its live child absent and waited without sending
TERM. Goodall independently reproduced native builtin, stock shim and explicit
status behaviour in `tmp/t0202-review-cleanup-debug.json` and `.ps1`.
The earlier nine Linux cleanup/deadline failures were an instrument defect.

The only helper change replaces
`if [[ "$1" == -0 ]]; then builtin kill "$@"; return; fi`
with
`if [[ "$1" == -0 ]]; then builtin kill "$@"; return "$?"; fi`.
Reversing this single replacement reconstructs the recorded old normalised hash.
Python syntax passed without bytecode output. All 14 frozen test names, the
control and every TypeScript assertion remain unchanged. The harness was not
edited. No default-path cases were added and no commit was made.

The Windows rerun used the same focused Jest command recorded above. Observed:
exit 0, one suite passed, 14 tests passed, zero snapshots, 28.921 seconds.

The Linux rerun used the same disposable owned container, image `47d80115ce62`,
executable `/tmp` tmpfs, isolated network and two read-only test mounts recorded
above. The Python wrapper mirrored all frozen Jest assertions over the helper's
14 JSON observations. Observed: exit 0, 14 cases, zero semantic failures,
11.610 seconds. Linux Jest itself was not run.

Control, healthy and stubborn returned `accepted=true`; every adverse case
returned `accepted=false`. Every case reported `ownedStopped=true`,
`withinDeadline=true`, `decoySurvived=true` and `signalsOwned=true`. Both
credential-leak fields were false in every case. Request bounds, exact response
expectations and the occupied-listener control also passed. Every case launched
once except occupied-listener, which correctly launched zero times.

This successful rerun supersedes the earlier Linux validation limitation for
these 14 instrumented cases. Earlier entries remain unchanged as ledger history.
The scaled-fixture and release-evidence limits still apply. This entry records
only the independently authorised instrument amendment and its validation.
