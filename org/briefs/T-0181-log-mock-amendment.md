---
summary: Independent closed-oracle mock amendment for T-0181 log route
type: brief
tags: [oracle, security]
---

# T-0181 log route mock amendment

The coordinator owns `src/lib/fs/log-files.ts`, `src/app/api/logs/route.ts`
and the new T-0181 oracle files. A different author owns only
`tests/unit/logs-api-route.test.ts` for this amendment. Preserve every test
name and every response assertion. The existing `fs` mock has only
`existsSync`, `readFileSync`, `readdirSync` and `statSync`; the revised
descriptor-based log boundary now uses `lstatSync`, `realpathSync`, `openSync`,
`fstatSync` and `closeSync`. Extend the fake filesystem so its named regular
files have consistent path, device, inode, size, mtime and content through the
same descriptor. No production file or other test may be edited. Run the
same suite before and after; report test-name sets and all results. The
coordinator integrates and records the different author under Q-015.
