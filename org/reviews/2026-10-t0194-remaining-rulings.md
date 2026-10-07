---
summary: Frozen independent controls for the final ruled library items
type: review
tags: [testing, consolidation]
---

# Remaining library rulings

Banach independently authored fourteen cases for lib-domains-11a, -13c, -14b
and cross-cutting-03b. Commit57aad470 records thirteen red matcher cases and
one positive duration control; there were no skips or infrastructure failures.
The frozen LF hash is
ebd5e037a14b2596859fc4bc9085ae5b3c971d8e935415d1c6c048c287488286.
Exact names, source bindings and classification are retained in
tmp/t0194-remaining-rulings-oracle/freeze.json.

After implementation all14 pass. Eight new/held suites pass83/83, with actual
exit zero and no skips/runtime errors. The independent reviewer Parfit inspected
the source and reached a bounded pass: all13 documented aliases, both selection
semantics, pure imports, exact paths export identity, five caller parser/default
hashes, ruled day formatting and imported Chat default are preserved or changed
exactly as ruled. Directory discovery remains unchanged. The prior utils helper
removal is separately measured and is not described as a neutral baseline.

These focused proofs qualify only their stated contracts. The unchanged full
gate, committed mutation sweep and every hosted job remain required.
