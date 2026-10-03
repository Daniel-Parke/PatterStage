# T-0175 independent dependency oracle brief

Author: a separate ORACLE session. Own only `tests/unit/t0175-dependency-proposals.test.ts`. Read `org/START.md`, `org/tasks/T-0175.json` and `org/roles/ORACLE.md`. Do not edit the package files, task record, claims, existing tests or other documentation.

Freeze executable acceptance before the package edit. Parse `package.json` and `package-lock.json` as JSON. Require only these intended direct ranges and their matching resolved lockfile records: `@tanstack/react-query` `^5.102.8`, `tsx` `^4.23.13`, `@dagrejs/dagre` `^3.1.1`. The root lockfile package must match the manifest. Preserve the pinned Next and `eslint-config-next` 16.3.6 pair, React and React DOM 19.2.7 pair, and the other current direct ranges. Write discrete assertions so the original tree is red for the three proposals and green for the preserved constraints. Where useful, test actual package resolution or a public API rather than only file text. Do not require unrelated transitive versions that npm may legally choose.

Record stable test names, red count and zero skipped. Do not amend the oracle after implementation; any necessary amendment goes to another author.
