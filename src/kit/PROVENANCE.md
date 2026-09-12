# src/kit/ · Provenance

This directory is the vendored design kit. ADR-0003 Part 1 rules the
distribution model: files are copied verbatim from their source repository
with this record naming the repository and the commit, so that no
cross-repo coupling and nothing private enters the dependency tree.

Nothing in here is authored in PatterStage. A change to a vendored file is
a change to its source, followed by a re-copy and an update to the row
below. Editing a vendored file in place breaks the only property that
makes the copy worth anything, which is that it is still the same file.

## Vendored files

### BloomField.tsx

| Field | Value |
| --- | --- |
| Source repository | `PatterTech_Website` (github.com/Daniel-Parke/PatterTech_Website, private) |
| Source path | `src/components/ui/BloomField.tsx` |
| Commit read | `6a86bc25087e00508cb4e63a52d3a1cd9585a1b4` (2026-07-27) |
| Commit that last changed the file | `9f149c790a000a73f11f25552fe4c69a1b478813` (2026-07-07) |
| git blob SHA-1 | `58fc69edbe91c74049efa88dd5e886d85a890336` |
| SHA-256 of the stored (LF) bytes | `0317e253dab48d07775261b20e915f461360e5f12c76718fcfdce8a403bdfde8` |
| Vendored | 2026-08-24, task T-0024, source row WO-0017 |
| Warrant | WG-WEB-011 ruled C (field-reactive), WG-WEB-005 ruled C (full) |

Verbatim was verified at the level that the repository stores, not at the
level a Windows working copy checks out. Both repositories keep LF in the
repository and hand out CRLF on Windows, so the two working copies were
byte-identical on this machine and the blob SHA-1 of the vendored copy
equals the blob SHA-1 of the source, above. That SHA is the check to
re-run: `git hash-object src/kit/BloomField.tsx` must print it.

The source repository is private and carries no LICENSE file. PatterStage
is public under Apache-2.0 and both repositories are owned by the same
author, which is the reason this copy is available to be made at all. The
vendored copy is covered by PatterStage's Apache-2.0 licence. This matters
because ADR-0003 requires the public product to stay buildable by a
stranger who cannot see the source repository, and after this copy it is.

## What is NOT here yet

ADR-0003 Part 1 also calls for a CI drift test that fails when a vendored
copy diverges from its recorded source. `tests/unit/kit-provenance.test.ts`
holds the vendored bytes against the SHA recorded above, which catches an
in-place edit of the copy. It cannot catch drift in the other direction,
because CI has no access to a private repository on one developer's
filesystem, and a check that silently passes when it cannot see its
subject is worse than no check. Closing that half needs the source to be
reachable from CI, which is ADR-0003 Part 2 (`PatterTech_Core`), not this
task.

`@pattertech/ui` itself is not vendored here. This directory holds one
component, taken because WG-WEB-011's own deferral target was empty: a
grep for `BloomField` or `data-bloom` across `PatterStudio/shared/ui`
returns nothing, so waiting for the kit to ship it was an unbounded wait.
