---
title: The output canary
summary: The output canary, what it proves, how to read a failure and how to re-bless the golden honestly
section: contributing
nav: 40
audience: contributor
type: reference
tags: [testing, architecture]
compiled_from: authored
---
# The output canary

WG-ARCH-006 says a large move must be provably output-neutral before it is
made. Before this existed, PatterStage had no way to prove it: the July 2026
module move could only be asserted neutral, which is why WG-ARCH-001 could not
rule C. The canary turns that assertion into a check.

It is `scripts/tooling/output-canary.mjs`, gated by
`tests/unit/output-canary.test.ts` and by `npm run canary:check` in CI. It runs
on plain `node` with no build step, so it can gate a commit that has not been
compiled yet.

## What it hashes

Six surfaces, in two groups: four held against a golden, two recorded only.

**Held against the committed golden** (`scripts/tooling/output-canary.golden.json`),
so a change here fails the build:

| Surface | What it covers |
| --- | --- |
| `httpSurface` | Every route file's URL, the HTTP methods it exports, and its route segment config |
| `appConfig` | `next.config`'s redirects, rewrites and headers |
| `seedPack` | `npm run seed-pack`'s deterministic artefacts |
| `generatedArtefacts` | The committed JSON Schemas and other generated files |

**Recorded but not goldened:**

| Surface | Why it is not in the golden |
| --- | --- |
| `moduleGraph` | A path-independent multiset hash of every normalised module source. It moves on any ordinary edit, so pinning it would train everyone to re-bless without reading, which is how a gate becomes decoration. |
| `prerender` | The normalised HTML of the prerendered routes. Strongest evidence available, but it needs a build and it moves whenever any page's markup moves. CI uploads it as an artefact so one run can be compared against the run before it. |

The deliberate bias is **over-sensitive, never under-sensitive**. It fires on a
comment-only edit. That is the safe direction: a canary that can miss a change
is worthless, and one that occasionally says "look again" is merely annoying.

## Proving a move is neutral

Two modes, and they take different arguments. The first is the one to reach for.

**Against committed history.** Commit the move with `[move]` in the subject line,
then from the branch tip:

```bash
npm run canary:move-neutral -- origin/dev
```

The argument is a **git base ref**, never a file. It walks `<baseRef>..HEAD`, picks
out the commits whose subject matches `[move]`, and rebuilds the canary on both
sides of each one in a throwaway worktree. The `[move]` marker is not decoration
here, it is the whole selector: without it the command prints "no `[move]` commits",
exits 0, and proves nothing. Hand it a filename and `git rev-list` fails.

**Comparing two working trees by hand.** A snapshot file goes to `canary:assert`,
which is a different flag:

```bash
npm run canary:snapshot -- before.json    # on the commit before the move
# ... perform the move ...
npm run canary:assert -- before.json
```

`moduleGraph` is the surface that matters in both. It hashes a multiset of
normalised sources with paths discarded and internal import specifiers
collapsed to a bare module name, so moving `src/lib/foo.ts` into
`src/lib/missions/foo.ts` and repointing its importers leaves the hash
unchanged. Changing one line inside `foo.ts` does not.

The marker is matched case-insensitively against the commit **subject** only, so
`[move]` has to be on the first line. Automatic detection was considered and
rejected: a real move commit is renames plus the import rewrites those renames
force, so no diff-shaped rule separates it from ordinary work. Making the claim
explicit puts it on the record and holds the author to it.

## Reading a failure

**`canary:check` failed and you did not mean to change a contract.** Something
in the URL surface, `next.config`, the seed pack or a generated artefact moved.
Read the surface it names and find out what. This is the gate doing its job;
the usual cause is a route file gaining or losing an exported method, or a
generated artefact that needs regenerating rather than re-blessing.

**`canary:move-neutral` says the move was not neutral.** Then it was not a pure
move. Either split the behaviour change out into its own commit, or drop the
`[move]` claim and let it be reviewed as an ordinary change.

**You genuinely changed a contract on purpose.** Re-bless in the same commit as
the change, never in a commit of its own:

```bash
npm run canary:bless
```

Re-blessing in a separate commit is the failure mode this whole file exists to
prevent: it produces a diff nobody reads, and the golden stops meaning anything.
A blessing commit should always show the contract change beside it.

## What it cannot see

Stated plainly, because a gate whose blind spots are undocumented is a gate
people over-trust.

- **`export * from "./handlers"`** in a route module names no method in that
  file. The star is recorded as itself, so a split that hides `GET` behind one
  still moves the surface; what the canary cannot tell you is which methods
  survived. Look, do not assume.
- **Rendered date and time formats.** `normalisePrerenderedHtml` masks
  dates, times and clocks so a page rendered a second later is not a diff.
  A change to how a date is formatted is invisible in `prerender`; it is
  visible in `moduleGraph`, which is where it should be caught.
- **`canary:check` does not gate ordinary `src/lib/` behaviour.** Only the four
  contract surfaces are goldened. Behaviour changes are the test suite's job;
  the canary's job is contracts and moves.

## The canary's own gate

`tests/unit/output-canary.test.ts` pairs every invariance assertion with a
sensitivity assertion over the same function. If someone ever loosens the
normalisation until it stops seeing behaviour changes, the paired test goes
red. It also asserts the tree it read is non-empty (more than 400 modules, more
than 100 routes, `seed-pack exit=0`), because comparing an empty surface to an
empty surface is the exact failure this task existed to prevent.
