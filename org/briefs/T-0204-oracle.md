# T-0204 independent ORACLE brief

Leibniz adopts ORACLE in a fresh security dimension, before any replacement
implementation. Read this task and assigned claims only; do not inspect the
canary implementation. There are at most two writers. The coordinator owns
the canary implementation, task/claims/brief, mutant manifest, baseline, handover
and derived views. You own only the new behavioural suite, optional preload
helper and new verification ledger. Preserve all existing tests and scanner
configuration. Use apply_patch for scripts and isolated Node 24.21.0.

Public boundary: `node tests/security/secret-scan-canary.mjs` copies the actual
root config/ignore list to an owned temporary Git repository, commits a clean
control then a planted control, and runs the pinned Gitleaks 8.30.1 image with
network none, redact=100, JSON report and 120-second command bounds. It also
supports GITLEAKS_BIN. Success requires clean exit0/no findings then planted
exit1 with generic-api-key at planted.txt, and removes the owned repository.
The present candidate uses 32 random bytes encoded base64url. The replacement
must be a constructed deterministic noncredential, not a retry loop or a rule
exception. Never output candidate values or credential contents.

First prove a deterministic red of the unchanged command with the **actual**
digest-pinned scanner and real Git history. A Node preload can override
crypto.randomBytes using syncBuiltinESMExports to return bytes whose base64url
encoding is letters-only. An independently generated 43-character sequence
with its final base64 bits zero gives 32 bytes and can retain high entropy.
Actual scanner diagnostic already proves its letters-only allowance. Preserve
the exact main command and scanner/config/image/bounds. Save redacted output,
normal process exit and distinct scanner results, with owned cleanup.

Author cross-platform Jest CLI controls in
`tests/unit/secret-scan-canary-behaviour.test.ts` and optional
`tests/helpers/secret-scan-canary-preload.mjs`. Unit controls must not depend
on Docker or network access on Windows/macOS. A controlled preload may forward
real Git calls and intercept only a clearly named test scanner at the subprocess
boundary; require its real Git history, fresh report, supplied config/ignore,
redaction and command-bound witnesses. Calibrate its finite candidate cases
against actual pinned scanner observations and label the substitute honestly.
Do not claim it implements every Gitleaks rule.

Cover deterministic balanced candidate independent of crypto output, successful
clean/planted controls, clean findings/refusal, missing detection, wrong rule
or file, invalid scanner exit, launch/timeout and missing/malformed report
failures, and cleanup for success/failure. Capture only redacted metadata and
owned path lifecycle witnesses. Never classify launch/report/Git errors as
semantic detection evidence. Frozen test names must remain; no existing tests
are amended. A structural assertion is permitted only if a public CLI boundary
cannot independently witness a required fixed setting.

Write provenance and hash freeze to
`org/reviews/2026-10-t0204-canary-verification.md`. Store detailed structured
Jest/actual scanner receipts under ignored `tmp/t0204-oracle/`. Return counts,
intended assertion failures, launch/runtime errors, file hashes, and exact
names. Cease writing before coordinator red commit and implementation.
