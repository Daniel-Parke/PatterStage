# T-0203 independent oracle amendment

## 2026-09-30: preserve the selected Bash on Darwin

- Author: independent ORACLE session `01a0f0cf-033e-7b82-af84-94713bfa5bd7`.
- Authoriser: independent REVIEWER Goodall, under the R2 Q-015 amendment rule.
- Authority: Goodall's exact-proposal authorisation and the committed T-0203
  brief and claim expansion at `d200c707` and `2222fae1`. The operator's general
  programme implementation request provides the wider task scope. This is
  not a new operator approval or ADR decision.
- Proposal: `tmp/t0203-macos-amendment-proposal.md`, LF SHA-256
  `090e28fd1a93ec22f40367babba5e553044029e0b8278f8970071273fb26c01f`.
- Amended file: `tests/helpers/release-install-http-probe.py`.
- Old LF SHA-256:
  `5b36c32e905b51dca3681e3a67db4cd3aa5fca342c7faececf0d166cdd4fbedf`.
- Authorised new LF SHA-256:
  `5a807ccd3ee885890934ceb0b3b23b8072f30a1b5dcc9bd84a30c255d0852de8`.

This provenance entry is written before the helper change. The new hash is
the authorised target, not an execution or verification result.

Reason: Apple Bash 3.2's read builtin accepts only integer timeout arguments.
The existing fixture requires fractional reads, expiry status 142 and dynamic
file descriptors. Its original supervisor PATH would select native Bash for
the timeout child and env shebangs even after Python selects Homebrew Bash.
Primary evidence is Apple's `bash-3.2/builtins/read.def:195-205` and the GNU
Bash 4.0 release announcement's fractional-timeout addition.

- <https://raw.githubusercontent.com/apple-oss-distributions/bash/main/bash-3.2/builtins/read.def>
- <https://lists.gnu.org/archive/html/bug-bash/2009-02/msg00164.html>

Change only SUPERVISOR's initial PATH export to the following authorised block:

```bash
if [[ "$OSTYPE" == darwin* ]]; then
  export PATH="$T0202_ROOT/bin:${BASH%/*}:/usr/bin:/bin:$PATH"
else
  export PATH="$T0202_ROOT/bin:/usr/bin:/bin:$PATH"
fi
```

The non-Darwin export retains its exact original bytes. All other helper bytes,
functions, deadlines, iterations, real curl selection, assertion files and
test identities remain unchanged. This record does not amend the historical
T-0202 record or its existing amendment ledger.

Acceptance limits: exact diff/hash comparison and the unchanged 21 Windows
HTTP/default assertions will be recorded separately after execution. Linux
controls and native macOS interpreter/curl selection, fractional timer and
original-PATH negative controls remain coordinator obligations. Authorisation
alone does not establish fixture success, mutation kills or hosted acceptance.

## 2026-09-30: author verification receipt

After applying the block, a comparison against `git show HEAD:` proved the
entire LF-normalised helper equals the previous helper with only that single
replacement. Its observed LF SHA-256 equals the authorised target above.
The original non-Darwin export and every other LF-normalised byte are retained.

The unchanged Windows HTTP/default suites exited zero: 21 passed, zero failed,
zero skipped and zero suite runtime errors. Command:

```text
npm test -- --runInBand --runTestsByPath tests/unit/release-install-http-smoke.test.ts tests/unit/release-install-http-defaults.test.ts --json --outputFile=tmp/t0203-windows-http.json
```

The independent new oracle's final candidate exited one: three calibration
controls passed, 23 intended matcher failures, one explicitly macOS-scoped
new native case skipped on Windows, zero suite runtime errors. The failures
are 22 missing-script matchers plus the missing macOS workflow step matcher.
No script implementation exists. Command:

```text
npm test -- --runInBand --runTestsByPath tests/unit/release-test-tools.test.ts --json --outputFile=tmp/t0203-oracle-red-ready.json
```

F00 proves the resolved paths point at the instrumented tools and records all
five timeout calls while executing real GNU identity, child status 37, expiry
124, kill-after 137 and real Bash fractional/dynamic-descriptor behaviour.
F01 calibrates the fake Homebrew installation. F02 records two calls per
negative timeout and Bash control, checks their resolved paths and incorrect
semantics, and proves the absent timeout cannot fall back to a host executable.
The launcher removes duplicate case-insensitive PATH keys and restores its
isolated PATH inside the already launched Bash process.

Earlier instrument failures remain in `tmp/t0203-oracle-red.json/.log` and
`tmp/t0203-oracle-red-v3.json/.log`: raw MSYS signal reporting and Git launcher's
host PATH insertion, respectively. Neither is a product failure or mutation
kill. The final controls passed after those driver defects were corrected.
The final TypeScript correction is an explicit `NodeJS.ProcessEnv` annotation;
`npm run typecheck:tests` and focused ESLint both exited zero.

N01 executes only the helper's initial routing block and is intended to prove
modern parent/bare/env-shebang interpreter paths and versions, fractional
expiry and dynamic descriptors, real curl path and before/after binary hash,
native Bash rejection, and the original-PATH negative on hosted macOS. N01
has not executed here. Linux, native macOS and exact-head hosted acceptance
remain coordinator obligations. This receipt is technical evidence, not an
independent acceptance verdict. No commit, implementation or workflow edit
was made by this oracle author.
