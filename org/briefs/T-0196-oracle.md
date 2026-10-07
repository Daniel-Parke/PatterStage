# T-0196 first cohort: npm standardisation

Authority: the operator's tooling-17 ruling, `org/reviews/2026-09-decision-register.md:1898`, selects standardisation on npm. Independent R2 closure/scope authority is `tmp/t0195-closure-review-ffd9608c.json`. T-0195's landed harness is closed against all four successful exact-head workflows at `ffd9608c`. Observe the closing metadata head's hosted checks before downstream implementation.

The first cohort removes unused pnpm project settings and duplicate ignore rules. It does not finish T-0196. Root configuration claims must be recorded before authoring. New oracle: `tests/unit/t0196-npm-standardisation.test.ts`, within the existing Jest gate. No extra CI invocation, dependency, lockfile or existing test edit is authorised.

Required properties:

- An actual npm configuration read emits no unknown-project-configuration warning. Use isolated empty user/global configuration and cache; do not read or print operator credentials. Exercise the existing portable npm CLI with Node, not a platform-specific shell wrapper. No registry network call or installation is needed for the configuration read.
- The package has no pnpm-only install block. Existing scripts, dependency maps, engines, overrides and installed versions remain unchanged. Independent byte/parsed-JSON transfer proof and unchanged existing contract suites hold these invariants; do not add a duplicate frozen copy of every dependency map.
- Local private `.npmrc` files are ignored by Git. Known valid npm configuration remains possible; do not prohibit a benign local `.npmrc` solely because it exists. Preserve one canonical copy of existing artifact ignore rules, including pnpm lock/workspace artifacts, and all unrelated ignore behaviour.

Freeze meaningful red results before implementation, with names/hashes and no runtime-error kill. Prefer observable command results over source patterns. Do not edit existing oracles, roots outside the isolated fixture, protected material or append-only ledgers. Declare any fixture limitation; a separate session is not automatically clean-context independence.

Exact implementation allowlist: `.npmrc`, `package.json`, `.gitignore`. Only remove the ruled pnpm settings/block, root `.npmrc` tracking exceptions and duplicate ignore block; retain canonical artifact rules. New tests and live record/review/brief/census producer metadata are separate claims. No broad codemod, package installation, store deletion or source cleanup is included.

Verify: frozen red oracle then unchanged green; original npm script/dependency/engine/override maps and lockfile bytes; isolated Windows and Linux npm configuration/install behaviour; the complete gate on an unchanged candidate; valid representative causal reversals, restoration and passing controls; every final hosted job. Rollback: restore only the exact three-file pnpm configuration delta if a retained caller demonstrates a live need. Do not restore warnings to bypass a gate or change supported npm commands.

Other T-0196 obligations remain open: shared mock JSON reader/standalone Docker packaging, shell/environment duplication, full install/update/build/Docker checks, design/read/write planted controls, tooling targets, gap-105.c argument/Windows probes, lib-domains-19, licence/audit and historical gap005b/expired-secret provenance. No first-cohort completion closes the whole task.
