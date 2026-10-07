# T-0161 second independent safety oracle

Own only `tests/unit/t0161-backup-selection.test.ts`, `tests/unit/t0161-node-setup-safety.test.ts`, `tests/unit/t0161-required-step-failures.test.ts` and new T-0161 test files you declare in `org/claims.json` before writing. Do not edit implementation, baseline or protected files. The coordinator owns those paths.

The independent reviewer found that setup, deploy and shell backup only the database selected at one instant. Schema migration can rebuild it below the other database's size, then import code can select and write that previously unbacked candidate. Prove that both existing `patterstage.db` and `control-hub.db`, with their WAL and SHM sidecars, have pre-migration backups when both exist. Amend the existing backup-selection test so it tests this stronger invariant; retain its test-name set where possible, and report every name changed. Exercise Node setup, shell setup and the deploy backup function or update path. A path-only source assertion is insufficient.

The reviewer also found that Node `copyFileSync` creates a backup with the source file's permissive mode before the later chmod. On Linux, use a permissive `0644` source and `umask 000` to prove that each backup exists as owner-only (0600) immediately after copy and before any later mode change. If a Windows unit fixture cannot observe POSIX creation modes, provide a Linux Docker probe or Linux-gated test that can run in hosted CI. Do not read or print database contents.

Commit only the oracle changes while the implementation is still red. Report the exact red result, test-name identity before/after and the SHA-256 LF hashes of changed test files. The coordinator will integrate your test commit and fix the implementation separately.
