---
summary: Independent T-0181 alias and refusal oracle after R2 review
type: brief
tags: [oracle, security]
---

# T-0181 independent alias oracle amendment

The coordinator owns the source and the original frozen
`tests/unit/log-files-t0181-boundary.test.ts` and
`tests/unit/t0181-url-guard-listener.test.ts`. The independent author owns
only `tests/unit/t0181-log-alias-amendment.test.ts`. Do not edit any earlier
oracle, source file or task record. Use real temporary files on one volume to
prove that an in-root hardlink `x.log` to an outside sentinel cannot expose
its bytes through GET or truncate it through named or bulk DELETE. Prove a
dangling in-root `x.log` symlink receives a clear refusal on GET and named
DELETE, rather than 404 or successful deletion. Preserve normal regular-file
controls and clean the fixture safely. A controlled file-swap or BigInt inode
case is welcome only if it can be deterministic and behavioural; report any
unproved race separately rather than making a flaky oracle. Run the new
suite red, report exact failing names and exit, and list the sole changed
file. The coordinator will commit red before implementation.
