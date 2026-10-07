---
summary: Independent failure-preservation acceptance for the confirmed fallback deletion defect
type: task-brief
tags: [testing, data-integrity]
---

# T-0208 fallback refusal cohort

The owned built-server failure at runtime-XvCqW0 returns500 on DELETE after
an EPERM config.yaml replacement error. Its real SQLite has zero enabled
fallbacks while YAML still contains one. This establishes partial persistence
independently of the unknown Windows holder. No retry or recovery is proposed.

Before implementation, independently freeze behaviour controls using real
SQLite and owned valid YAML. Force a deterministic pre-replacement rename
refusal at the owned destination, never a provider or operator path. Require
the500 response and unchanged failure text, original fallback row and ordering,
unrelated rows and YAML bytes, no successful audit and no leaked staged file.
Prove successful deletion still updates/repositions the chain and YAML; a
missing identifier still returns404 without a write. Preserve all old tests.

Limit source repair to the DELETE transaction boundary. Do not change auth,
read-only guards, response envelopes, schema, keys, deadlines or concurrency.
No universal two-store atomicity, crash recovery or Windows-lock cause follows.
The remaining T0208 findings stay open. A new retry policy requires its separate
design and authority. Coordinator source implementation follows executed red.
