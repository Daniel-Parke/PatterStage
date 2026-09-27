# T-0161 root-content and early deploy-config oracle

The independent test author owns only `tests/unit/t0161-state-import-completeness.test.ts` and `tests/unit/t0161-required-step-failures.test.ts`. Keep every existing test name and assertion; do not edit implementation.

1. In a disposable migrated database, give `agent_root.config_yaml` a SQLite-only value, leave `soul_md` empty and have no skill or profile rows. Supply a different Hermes disk config and run `--import-missing-profiles`. The existing SQLite root config must remain byte-identical. A nonzero refusal is acceptable because the partial state needs review; a successful full pull is not.
2. In the deploy fixture, make Hermes config present when rebuild begins and remove it during the build, before database migration and import. The deploy must fail before restart and must not report complete. Prove the fixture's initial presence and build-time removal.

Run the two focused cases against the current candidate, commit them red with exact result and unchanged test-name identity, and report the test-only commit. The implementer will integrate before fixing the guards.
