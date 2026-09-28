---
summary: Redacted full-history Gitleaks control scan and the current configuration blind spot
type: review
tags: [review, security, phase-1]
status: partial
---

# Gitleaks history control, 2026-09-27

This is a Phase 1 evidence note, not a completed secret-clearance verdict. It
inspected committed history reachable from local refs at `dev@7d739435`; the
working tree was dirty and was not part of the Git-history scan. The scanner was
the official `ghcr.io/gitleaks/gitleaks:v8.30.1` image, digest
`sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`.
The image ran without network access, with the repository mounted read-only.
All invocations used `gitleaks git --redact=100 --report-format json`; no
candidate value is reproduced here. [Gitleaks documents](https://github.com/gitleaks/gitleaks#usage)
that `git` scans patches, the default scan traverses history, and a custom
configuration needs `[extend] useDefault = true` to retain default rules.

The scan input held 21 local refs and 1,716 reachable commits; Gitleaks
reported 1,614 commits scanned and about 32.27 MB of patches per run. The
equivalent local Git log selection produced 1,621 commit headers. The seven
header difference and the gap from 1,716 reachable commits remain unexplained;
the scanner count must not be presented as complete commit coverage. The local
refs were:

```text
refs/heads/cursor/f7b69026
refs/heads/dev
refs/heads/feature/t0157-framework-auth-oracle
refs/heads/feature/t0160-nested-stack-oracle
refs/heads/feature/t0161-c8-shrink-oracle
refs/heads/main
refs/remotes/origin/dependabot/github_actions/dev/actions/deploy-pages-5
refs/remotes/origin/dependabot/github_actions/dev/actions/upload-pages-artifact-5
refs/remotes/origin/dependabot/npm_and_yarn/dev/dagrejs/dagre-3.1.1
refs/remotes/origin/dependabot/npm_and_yarn/dev/eslint-config-next-16.3.2
refs/remotes/origin/dependabot/npm_and_yarn/dev/knip-6.32.2
refs/remotes/origin/dependabot/npm_and_yarn/dev/lucide-react-1.33.0
refs/remotes/origin/dependabot/npm_and_yarn/dev/multi-9b1536b8cd
refs/remotes/origin/dependabot/npm_and_yarn/dev/playwright/test-1.62.1
refs/remotes/origin/dependabot/npm_and_yarn/dev/tailwindcss/postcss-4.3.3
refs/remotes/origin/dependabot/npm_and_yarn/dev/tanstack/react-query-5.102.2
refs/remotes/origin/dependabot/npm_and_yarn/dev/tsx-4.23.12
refs/remotes/origin/dependabot/npm_and_yarn/dev/xyflow/react-12.11.3
refs/remotes/origin/dev
refs/remotes/origin/HEAD
refs/remotes/origin/main
```

The controls changed only the TOML configuration passed to the same pinned
scanner. The two exact control files are committed beside this note:
[strict](./2026-09-gitleaks-strict.toml) and
[default rules with the test exclusion](./2026-09-gitleaks-test-exclusion-control.toml).
The local runs used byte-identical temporary copies of these files, verified
by the SHA-256 hashes below. The repository was mounted at `/repo`; re-run the
strict control with:

```powershell
$repoRoot = (Get-Location).Path
$scanOutput = Join-Path $repoRoot '.gate/t0164-secret-scan'
New-Item -ItemType Directory -Force $scanOutput | Out-Null
docker run --rm --network none --mount "type=bind,source=$repoRoot,target=/repo,readonly" --mount "type=bind,source=$scanOutput,target=/out" ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f git --redact=100 --report-format json --report-path /out/report.json --config /repo/org/reviews/2026-09-gitleaks-strict.toml /repo
```

The strict file contains `[extend] useDefault = true` (SHA-256
`5FDE397963BDFA9EDB9C0300D0EDEC25E3B056BB887EDE3DECF4B0E477D56964`).
The second control retains the current `[allowlist] paths = ['''tests/''']`
(SHA-256 `95EDB4BC58C2CE9CB6D7EB3B6A495AB48E4628534A24FF7AA4256C91F9011B22`).
The repository configuration was `.gitleaks.toml` (SHA-256
`08071DBFC9CF40C6974713843426FBFFC31D106EBD76CE349DAC58E869483F5F`).
For the second control or repository config, replace the example command's
`--config` path with `/repo/org/reviews/2026-09-gitleaks-test-exclusion-control.toml` or
`/repo/.gitleaks.toml` and give each run its own `--report-path`. Both failed
controls return exit 1 because they found candidates; the repository scan
returned 0 because no rule ran.
The digest-pinned strict command was rerun against the saved config: exit 1,
1,614 scanner-reported commits, ten candidates, and the same ten
`rule|file|line|commit` identities as the initial strict report.

| Configuration | Default rules | `tests/` excluded | Candidates | Exit |
|---|---|---|---:|---:|
| Strict control | Yes | No | 10 | 1, findings |
| Default rules plus existing exclusion | Yes | Yes | 1 | 1, finding |
| Repository `.gitleaks.toml` | No | Yes | 0 | 0 |

The repository config declares an allowlist but does not extend the default
rules. The local scan using it is blind, not evidence of zero secrets. The test
exclusion independently hides nine of the ten strict-control candidates.
The hosted action's exact configuration path still needs a planted-violation
probe; a green hosted job alone does not establish that it read any rules.
Repair needs a red-first gate batch after T-0158; the current configuration
must not be re-blessed as a clean result.

The strict report contained ten `generic-api-key` candidates, listed without
values:

| Source at introducing commit | Commit | Disposition |
|---|---|---|
| `tests/e2e/t0158-browser-sessions.spec.ts:706` | `7d739435` | Synthetic isolated-process operator-token fixture |
| `org/tasks/T-0163.json:59` | `304207a6` | Refuted as a secret: value is a 64-hex SHA-256 hash of a test file |
| `tests/unit/b6-settings-index-sees-a-parse-error.test.tsx:226` | `71836316` | Synthetic render non-disclosure fixture |
| `tests/unit/b6-models-origin.test.ts:432` | `71836316` | Synthetic in-memory migration fixture |
| `tests/unit/b1-config-masks-every-api-key.test.ts:13` | `9696dc87` | Synthetic nested-config masking fixture |
| `tests/unit/secret-mask.test.ts:58` | `d5d5e52a` | Synthetic pure masking-helper fixture |
| `tests/unit/secret-mask.test.ts:59` | `d5d5e52a` | Synthetic pure masking-helper fixture |
| `tests/unit/secret-mask.test.ts:64` | `d5d5e52a` | Synthetic pure masking-helper fixture |
| `tests/unit/credentials-repository.test.ts:119` | `6dfa455f` | Synthetic in-memory repository fixture |
| `tests/unit/credentials-repository.test.ts:129` | `388d2596` | The same synthetic repository fixture at a later introducing commit |

Independent read-only sceptic `01a0e465-667b-7f23-a534-80bf287fbf06`
checked all nine test findings at their introducing commits without printing
candidate values. Re-run the proof by inspecting the cited source and these
named tests: `Given no qualifying activity, idle expiry refuses at exactly 30
minutes and accepts one millisecond before`; `Given qualifying navigation,
absolute expiry refuses at exactly 12 hours and accepts one millisecond before`;
`the alert never contains a key: only the first line the route sends is
rendered`; `a prebuild-shaped v3 database with an import_key row reaches
'import' on the first climb`; `masks the three declared shapes and the ones
nobody declared`; `masks the key the old two-branch walker missed`; `fully
masks passwords, secrets, tokens, and private keys (no first/last hint)`;
`keeps the first4…last4 hint for API keys and other non-secret names`; and
`listCredentials never includes api_key in the row shape`. The test-local
values are fixed synthetic sequences used in temporary processes, mock config,
in-memory SQLite or pure masking checks. These ten candidate dispositions do
not clear unrelated history or current uncommitted files.

Three July 25 workflow failures remain unresolved: runs `30157793265` at
`11385922` and `30157702926`/`30157701589` at `5e5802af`. Their old reports
expired. Five of the synthetic test candidates were already in those heads,
but the repository config excluded their paths and omitted default rules.
The action's effective arguments and failed reports are unavailable, so the
three failures cannot be mapped to a candidate or called remediated.
Independent sceptic `01a0e468-e114-7dc2-8033-00d272b1bf9f` confirmed the
configuration blind spot against Gitleaks v8.30.1 source and the 10/1/0
control reports; it limited the ref claim to this local checkout.

## Native Windows rescan at the T-0164 cut

Docker Desktop was stopped, so the coordinator obtained the official
`gitleaks_8.30.1_windows_x64.zip` and release checksum through `gh release
download v8.30.1 -R gitleaks/gitleaks`. The archive's SHA-256 was
`d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`,
equal to the published checksum. `gitleaks.exe version` reported `8.30.1`.
The binary and redacted reports remain in ignored `.gate/t0164-gitleaks/`.

From the repo root, each run used `gitleaks git . --no-banner --redact=100
--log-opts='--all' --report-format json`, with one of the three configs named
above. `git for-each-ref --format='%(refname)'` froze the exact 45 local refs
in [the ref scope](./2026-09-t0164-secret-ref-scope.txt). `git rev-list --all
--count` returned 1,753 reachable commits; `--no-merges` returned 1,666.
Gitleaks reported **1,651 commits scanned**. Its count is not identical to
either Git count, so complete patch coverage beyond its reported scan remains
unproved. The working tree and unreachable Git objects are outside this scan.

| Configuration | Redacted candidates | Exit | Scope |
| --- | ---: | ---: | --- |
| Default rules, no test exclusion | 10 | 1 | The same ten `rule/file/line/introducing-commit` identities in the table above |
| Default rules plus `tests/` exclusion | 1 | 1 | The T-0163 task-record SHA-256 candidate |
| Repository `.gitleaks.toml` | 0 | 0 | No default rules were loaded; green is blind |

The ten candidate dispositions remain as above. This newer scan adds refs and
commits, but it does not recover the three expired July 25 hosted reports or
prove that current hosted Gitleaks executes a real rule. A red-first config and
hosted-action repair remains urgent; the ten redacted candidates are a control
set for that change.
