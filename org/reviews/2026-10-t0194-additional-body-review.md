---
summary: Additional complete repository and path-caller reads with independent sceptic limits
type: review
tags: [security, reconnaissance, evidence]
---

# Additional body review, 2026-10-04

Inspected HEAD57aad470 plus the recorded working-tree source. These are reads,
not runtime fault reproduction. No provider calls, operator data or processes
were used. Source bytes stayed unchanged during each review.

## Missions and models

Franklin read every body in these six repositories, including the relevant
default, transaction and settlement callers. LF SHA-256 binds the source.

| File under src/lib | Lines | LF SHA-256 |
| --- | --- | --- |
| missions/mission-category-repository.ts | 419 | 3fdbc93cb404d2cdf4cdc8fe668d4f2603aea3f2428836eeb295a4b69c17cc9e |
| missions/mission-category-schema-repository.ts | 37 | 93442b3a516b6a824341b5d9ff543191a9ae2220231e1ffed0e95cc027c5600a |
| missions/mission-repository.ts | 444 | 1815876ef4bdec3bef955ee8f2691c74fa3d9b5e3a417a8a04227b9d2b5e331c |
| models/credentials-repository.ts | 247 | 40e714877efc4e5c9920872708700d71c6fd0348cada0a3de8f68a7717aa5717 |
| models/fallbacks-repository.ts | 188 | 52347283c4dfcd70773830e53da85ef21aa3687ad30c339362173541af29a896 |
| models/models-repository.ts | 493 | 1f65a77663ba0696aa39f27fe04f9f34c1f097bb51b689b4f4efb1d1c35534ab |

Mission reservation and settlement bind the immediate transaction to the
active claim; cancellation persists before remote Stop. Category ordinary
exception recovery stages/restores file writes and reassigns references inside
the transaction. This does not establish process-crash file/SQLite atomicity.
Credential summary mapping excludes plaintext keys; internal keyed reads remain
separate. Model/default changes are transactional; import/upsert paths have
different boundaries and need two-connection controls before race claims.

Parfit independently checks the two fallback hypotheses and their callers:

- Explicit overwrite=true bypasses the skip and always adds a chain entry:
  src/modules/hermes/lib/fallback-import.ts:61-77. Repeated identical entries are
  allowed by the schema. Replacement semantics are unspecified. The default UI
  omits the flag; its route passes false, so default literal identity duplication
  is refuted at caller/algorithm level. Whole-import idempotence is unproved.
- The three config writes at src/lib/models/fallbacks-repository.ts:169-184 have
  no transaction. Config PUT, sync action and import supply no enclosing one.
  Reachable partial-write risk is supported by source; actual refusal is unproved.
  A real owned SQLite trigger rejecting the second setting write, with positive
  controls and no success/sync after refusal, is the next proof. An all-or-nothing
  oracle must state its accepted contract before implementation.

Existing mocked SQL-loop/import tests do not prove rollback. An unused mission
audit snake_case/camelCase cast mismatch has no inspected executable consumer;
it is not promoted to a demonstrated product defect. These reads add evidence
for gap-102.a/b without closing their runtime uncertainties.

## Path and execution callers

Helmholtz read path-security.ts:18-139 and every direct caller: fs/list,
fs/git/branches, agent/files/key, profiles collection/id/toolsets, skills
collection/catch-all/name/toggle. Lexical admission accepts home, data and the
active workspace. No realpath/existing-parent check occurs in that guard.
The log guard separately implements physical checks; it is not these callers.

Skills/name GET checks the name, but PUT passes it to upsert and push without
that check (route.ts:19-55). profile-push.ts:128-139 replaces backslashes and
constructs the target, supporting a traversal hypothesis. HTTP decoding and an
actual outside write remain unproved. Linked workspace/profile/skill parents
also need owned canary fixtures. Do not infer that every symlink is forbidden,
that rename follows a final-file symlink, or that deletion outside root occurs.

Script resolution at scripts-manager.ts:129 checks the name and existence,
but not physical containment/file type. Execution at427 uses interpreter argv,
600000ms and8388608-byte bounds. platform.ts:202 explicitly uses cmd.exe /c for
batch files; the generic no-shell comment is inaccurate. Actual Windows command
injection is unproved. A mocked argv check cannot qualify Windows parsing.

Key LF bindings: path-security.ts
8e8df0ab7f1de724bcc22c6a4dd61a37ef86d6fa9300682ded5018da0692c789;
scripts-manager.ts 55d27f512b19111f9db9307289164e908c4b195d0188d2e041551eed3ec4bb39;
profile-push.ts 1cf0dc610d0c4cab6355ca6f16f1088275fa3c96e89fa31fc8c1c90aa172dffb.

gap-105.a/c remain open for independent contract checking and isolated probes.
Reproduce caller inventory with rg -n 'resolveAllowedWorkspacePath|resolveSafeProfileName|requireSafeProfileName|resolveSkillDirUnderRoot'
src, then inspect the entire caller bodies. Use owned sibling roots and canaries,
an in-memory catalogue and recording process doubles before imports. No operator
filesystem, real script execution or paid backend is required.
