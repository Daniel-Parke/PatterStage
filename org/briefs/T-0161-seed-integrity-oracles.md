# T-0161 explicit seed integrity oracles

Independent review found two more candidate zero-exit failures in the configured setup/deploy seed chain. Verify them with isolated behavioural oracles before any source change:

1. `seed-catalog.ts --merge` can print normal counts and exit zero when a required shipped manifest is absent or malformed. The tool and memory seeders catch parse failures and return zero. Intercept one bundled manifest read in a child process so the canonical repository file is never altered. Prove a valid-manifest control reaches that manifest and succeeds, then that a malformed or missing manifest is reached and the explicit command exits non-zero. Preserve the boot seeder's best-effort behaviour.
2. `ensure-hermes-model-sync.ts` can receive `{ error }` from `finalizeRootConfigOnDisk()` and still exit zero. Use a disposable migrated database with an agent model default and a malformed Hermes `config.yaml` so the finaliser refuses it. Prove a no-default or valid control, then require a non-zero exit and safe failure message. Do not print model credentials or config content.

The independent ORACLE lane owns only `tests/unit/t0161-seed-input-integrity.test.ts` and `tests/unit/t0161-model-sync-cli-failures.test.ts` in its separate checkout. A failed fixture, migration, launch or intercept is infrastructure, not a passing test. Preserve all existing test names. Report the exact red result, LF SHA-256 and test-only commit. Do not edit implementation, claims, records, baselines or protected files, and do not push.

Three other review candidates (config disappearing after a configured probe, partial-profile retry shortcut, and discovery `statSync` errors) require separate reproduction and compatibility analysis. They remain open for T-0164 evidence and cannot be cited as fixed by this batch.
