# T-0161 configured model-sync presence oracle

The independent test author owns only `tests/unit/t0161-model-sync-cli-failures.test.ts`, `tests/unit/t0161-shell-seed-selected-dir.test.ts`, and `tests/unit/t0161-required-step-failures.test.ts`. Preserve every existing test name and assertion. Do not edit implementation.

Add behaviour tests showing: an explicit model-sync command with `--require-config` exits nonzero when `config.yaml` is absent; shell setup initially detects Hermes, then loses config.yaml after catalog seed and stops rather than reporting complete; and, if the existing deploy fixture supports it, a configured deploy refuses a config loss between import/seed and model sync. The control must prove the earlier step saw config, and distinguish a configured install from standalone mode. Use disposable files and no credential contents. Commit red with exact failing names. The implementer will integrate before code changes.
