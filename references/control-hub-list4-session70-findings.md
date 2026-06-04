# List 4 (Models, HERMES.md, Environment, All Settings) — Session 70

## Refactors completed (2)

### Refactor 1 — `serverError()` factory migration in 4 List 4 sites

The List 4 routes `seed/route.ts` and `credentials/route.ts` still had inline
`NextResponse.json({ error: msg }, { status: 500 })` blocks in their catch
blocks. The `serverError(msg)` factory was added in session 56 (List 2) and
adopted across Lists 1 + 2 in sessions 56 + 68, but List 4 was missed in both
prior sweeps. Migrated 4 sites:

- `src/app/api/seed/route.ts` — 2 sites (GET `"Failed to read seed state"`,
  POST `"Failed to run seed"`)
- `src/app/api/credentials/route.ts` — 2 sites (GET `"Failed to list
  credentials"`, POST `"Failed to create credential"`)

All 4 sites are byte-equivalent: same body shape `{ error: msg }`, same
status code 500. The migration adds the `serverError` import to both files
(4 lines added in imports, 4 lines removed in bodies, net -4 LOC).

The `fallbacks/sync/route.ts` POST catch block was *deliberately* NOT
migrated — it has a custom `error instanceof Error ? error.message : "Failed
to sync fallback"` extraction (the inline form propagates the actual error
message) and matches the session-69 `cronSyncFailureResponse` exception
pattern (different error-string → different body → different result).

### Refactor 2 — `loadHermesConfigFromString(content): HermesConfig` helper

3 sites in `src/lib/hermes-config-sync.ts` independently wrote
`original ? ((yaml.load(original) as HermesConfig) ?? {}) : {}` to parse
the on-disk config.yaml body. Migrated 2 of the 3 sites:

- `syncSingleModelToHermesConfig` (lines 440-443) — 3 lines → 1 line
- `syncFallbacksToHermesConfig` (lines 551-554) — 3 lines → 1 line

The 3rd site, `syncDefaultsToHermesConfig` (lines 333-336), is **deliberately
kept inline** because it has a custom try/catch that surfaces parse errors
to server logs and skips the write to avoid corrupting a partially-written
file. The refactor adds a 3-line comment pointing at the helper so the next
reader knows why the site isn't a one-liner.

**Distinct from `readHermesYamlConfig` (session 67, List 3):** the older
helper reads from disk with `existsSync + try/catch`, returning `null` on
missing/unparseable files. The newer helper takes a string directly and is
the load-only half — it does NOT catch parse errors (callers that want
custom error reporting call `yaml.load` themselves).

**Helper signature:** `loadHermesConfigFromString(content: string): HermesConfig`
- Empty string → `{}` (matches pre-refactor `: {}` short-circuit)
- Non-empty → `(yaml.load(content) as HermesConfig) ?? {}` (matches pre-refactor
  inline form byte-for-byte)
- Malformed YAML → throws (matches pre-refactor inline behaviour — no try/catch)

**6 new unit tests** in `tests/unit/load-hermes-config-from-string.test.ts`
cover:
1. Empty string → `{}`
2. Whitespace-only → `{}`
3. Minimal `model:` parse
4. Multi-section parse (model + auxiliary + fallback_providers)
5. Parse errors propagate (does NOT silently swallow)
6. Byte-equivalence battery — runs the helper and the inline form over a
   12-input battery (`""`, `"   "`, `"\n\n"`, valid YAML variants,
   comment-only, `null`, `42`, `true`) and asserts they're equal for every
   input. This is the session-64 Pattern AJ "battery of input shapes" test
   that locks the byte-equivalence contract.

## Why these refactors (and not the obvious candidates)

Three other candidates were considered and rejected:

1. **`isChReadOnly()` inline block consolidation** in `cron/route.ts`,
   `cron/hardware/route.ts`, `sessions/route.ts`, `missions/route.ts` —
   rejected. These are Lists 1 + 2, not List 4. The migration to
   `requireNotReadOnly(context?)` helper would also silently change the
   user-visible error string from the BARE `"Control Hub is in read-only
   mode"` (status 503) to the canonical `"Control Hub is in read-only mode
   (set CH_READ_ONLY=true to allow writes)."` — session 51 explicitly
   rejected this migration as a "Pitfall J" (AT LEAST identical results
   trumps consistency).
2. **`existingFallbackKeys()` helper in `fallbacks/import/route.ts`** —
   rejected per session-51 Rule of Three. 2 sites with the same
   `new Set(existingChain.map((e) => fallbackKey(e.provider, e.modelIdString)))`
   pattern. The pattern is 4 lines, the helper would be 1 line called
   2 times — net -2 LOC for an indirection level. Not justified at 2 sites.
   When the 3rd caller appears, promote to a helper then.
3. **`agent-file-store.ts` 6-line if/else ladder for `key === "soul" |
   "agent" | ...` → patch.X = content** — rejected. 2 sites (default vs
   non-default branch), 6 lines each. The session-51 Rule of Three
   threshold isn't met; the existing if/else is more grep-able than a
   `Record<ManagedFileKey, keyof AgentRootPatch>` lookup would be (the
   field names differ between the two patch types — `hermesMd` only exists
   on `AgentRootPatch`).

## Verification

- All 1116 unit tests pass (184 suites, +6 new)
- `npx tsc --noEmit` clean
- `CI=true npx eslint` clean on touched files
- `npm run build` passes
- 0 user-visible behaviour changes (byte-equivalent body + status on all
  4 `serverError` migrations; byte-equivalent parse result on all 3
  `loadHermesConfigFromString` migrations)

## Patterns to take forward

1. **The "List X factory migration gap" pattern** — when a session
   migrates a factory (e.g. `serverError`, `notFound`, `badRequest`,
   `forbidden`) in one list, the OTHER lists are likely to have a few
   missed sites. A dedicated `grep -rn "status: 500" src/app/api/<other-list>/`
   audit at session start can catch them. The session-68 + 70
   `serverError` migration closed the List 2 + List 4 gaps; List 1
   and List 3 may still have stragglers.
2. **"Inline-pattern with custom error handling" exception** — when
   extracting a 3-site helper and 1 site has a custom try/catch with
   error reporting, leave that site inline with a 3-line comment
   explaining why. The 2-site migration is still worth it (cleaner
   body, single source of truth for the happy path); the 1 outlier
   just gets a comment so the next reader doesn't try to "complete
   the migration."
3. **`loadHermesConfigFromString` is a 2-arity generalization of the
   1-arity `readHermesYamlConfig`** — together they cover the full
   "read YAML from disk" / "parse YAML string" matrix. Future
   helper-extraction tasks in this module should reach for the
   appropriate helper before re-deriving inline.

## "Next session should:" block

1. **`serverError` migration in remaining lists** — run
   `grep -rn "status: 500" src/app/api/` to find any remaining
   inline 500 sites. List 1 (operations/agents, skills, tools,
   personalities) and List 3 (operations/*, config/*) may have a
   few more.
2. **Consider also the `badRequest` and `notFound` factory gaps**
   in List 4 — `badRequest` was migrated in session 59 across
   7 sites but a few may remain (especially in the credentials +
   seed surface).
3. **`existingFallbackKeys()` in `fallbacks/import/route.ts`** —
   defer until a 3rd caller appears. The pattern is 2 sites with
   4-line bodies; a 1-line helper at 2 sites is borderline
   per session-51 Rule of Three.
4. **`agent-file-store.ts` if/else ladder** — defer. 2 sites,
   6 lines each, with intentionally-different field names per
   branch. The if/else is more honest about the type-system
   constraint than a generic Record lookup would be.
5. **Refactor B refactor: consider adding a 2nd helper for the
   `try { config = yaml.load(...); } catch (err) { log; return
   early; }` pattern in `syncDefaultsToHermesConfig`.** Currently
   that site is the only one with custom parse-error handling —
   if a 2nd caller needs the same "log + early return" behaviour,
   promote to a `loadConfigOrLog(content, context: string):
   { config: HermesConfig; error: string | null }` helper that
   unifies the load + parse-error reporting.
