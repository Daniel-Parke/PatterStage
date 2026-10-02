# T-0205 cleanup assertion amendment, 2026-10-02

Fresh independent ORACLE author: `01a0fa65-49e8-7eb2-afc4-cd450c8ecbab`.
Clean context, distinct from the coordinator, Raman and Einstein. Product
implementation was not inspected. Independent R2 REVIEWER Schrodinger's
Q015 authority was recorded as `authorised-before-edits` in T-0205 before
source changes. The retained whole-gate failure remains evidence.

## Exact extraction

Only the two claimed frozen callers, the new cleanup helper and this new
provenance file are authored. The helper joins the frozen oracle surface.
The context caller's lines 34 to 40 and loopback caller's lines 68 to 74
move to `tests/helpers/release-http-cleanup-assertions.ts` in this order:

```typescript
expect(result.ownedStopped).toBe(true);
expect(result.decoySurvived).toBe(true);
expect(result.signalsOwned).toBe(true);
expect(result.withinDeadline).toBe(true);
expect(result.elapsedSeconds).toBeLessThan(25);
expect(result.credentialLeaked).toBe(false);
expect(result.scriptContainsCredential).toBe(false);
```

The structural parameter requires all seven fields. Each caller invokes
the helper unconditionally at the original position inside `clean`.
The original preceding and following assertions and every `clean` call
site remain exact. No defaults, coercion, mutation, conditional assertions,
environment changes, timer changes or other assertions are introduced.

Fresh ignored receipts are exclusively owned under
`tmp/t0205-cleanup-oracle-20261002-01a0fa65/`. `before.json` captures
authority before edits, claims, HEAD, raw/LF hashes of both trees and
retained earlier freezes, failures and reports. Exact caller bytes before
and after are retained separately. `extraction.diff` contains the complete
source change. `extraction-proof.json` records reversible substitutions,
positions, seven exact statements, structural fields and measured cost.

`name-matcher-proof.json` registers both original and amended test suites
without invoking fixtures or test bodies. It records all 27 identities in
source declaration order and compares them with retained prior identities.
It records exact before/after matcher expressions, values and order by
expanding the helper at each call position. Removing the new import and
expanding that call restores every original caller byte. The proof also
compares complete `clean` statement sequences and call-site frequency.

## Bounded validation and freeze contract

Use the existing full checkout `tmp/t0188-green-validation`, its dependency
pool and pinned Node `v24.21.0`, ABI `137`. Overlay only the four claimed
files after source writes. Execute test typecheck, scoped ESLint, the
27-case selection, the 48-case HTTP selection and the unchanged C4 suite.
Retain command exits, logs and separate structured Jest reports. Measure
before/after repetition with the unchanged census `--report` command.
No census algorithm, C4 check, baseline, manifest or gate is edited.

`execution-source-binding.json` compares main and validation input hashes
without inspecting product code. `validation.json` qualifies normal exits,
case counts, identities, no skips/todos/runtime errors, actual repetition
and net source cost. It checks validation tree stability and preservation
of previous evidence and protected inputs. `refreeze.json` supplies dated
final hashes for all four files and the new receipts. The coordinator owns
the append-only task provenance update.

Stop after the dated refreeze and cease writes. No full gate, further
repeat, calibration, commit, push, mutation sweep, hosted acceptance or
final R2 acceptance is authorised to this author.


## Executed proof and refreeze, 2026-10-02T02:23:52.071826+00:00

Observed Node `v24.21.0`, ABI `137`. Test typecheck exited 0.
Scoped ESLint for both callers and the helper exited 0 with no warnings.
The structured 27-case report records 27 passed; the
48-case report records 48 passed. Both selections retain
the exact prior identities and report normal exit 0, no failures, skips,
todos or runtime-error suites. The unchanged C4 suite exited 0 with
24 passed and no failures, skips, todos or runtime-error suites.

Actual repeated test-window lines fell from
4808 to 4794, a reduction of 14,
against the unchanged 4,800 ceiling. The two six-line windows now occur
only in the helper. Their previously overlapping coverage of 14 distinct
caller lines is zero. `cleanup-window-proof.json` records exact occurrences.
All other census measures except test line count remain unchanged.

Measured source cost is +9 physical lines:
the two callers together remove 10 lines and the helper adds 19.
The census counts the helper's terminal empty line, so its measured net
cost is +10 test lines
(141133 to 141143). These are measured results.

Exact source expansion restores all original bytes in both callers.
`name-matcher-proof.json` records all 27 exact before/after names,
matcher expressions, call positions and frequencies. The seven required
fields, matcher order, values and 25-second bound are preserved.

The validation tracked tree, all main unclaimed tracked files, previous
freezes, failed gates and reports retain their pre-edit hashes. C4,
census algorithm, baseline, manifest and gate remain unchanged. No
baseline exception is introduced. Final hashes below use raw source bytes;
their LF hashes are equal.

| Frozen file | Old SHA-256 | New SHA-256 |
| --- | --- | --- |
| `tests/unit/release-install-http-context.test.ts` | `3c07258e650ddba6aa515d2f7aeb4bba19b19d85e3de2f0ebdccfd306f471e24` | `233a61456297623054540687b294c377e3630a2836f3a028248df0883682605b` |
| `tests/unit/release-install-http-loopback.test.ts` | `ea7bc1a91eab836bdc3a741e1310069cd157d9767063b091eaa5a1c16b1c8365` | `6a600cd034b0ca8483df6da0d776ff5348b367d7decdde299e5e350621b53b57` |
| `tests/helpers/release-http-cleanup-assertions.ts` | New file | `4e15bd1080cdb728cb2342522d4650a61a6f435630e8ba545f7ab3d84cc1c4c2` |

`refreeze.json` binds the final four-file frozen surface, source proofs,
command receipts, structured reports and preserved prior evidence. The
final review alone is synchronised to the validation checkout after adding
these observed results. Source tests and helper remain as executed.

Author writes cease at refreeze. The coordinator can append this provenance
to the task record and perform the required full gate after writers stop.
No whole-gate, committed sweep, hosted or final acceptance is claimed.
