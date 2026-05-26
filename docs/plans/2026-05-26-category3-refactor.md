# Category 3 Refactor — Models, Agents, Skills, Tools, Personalities

**Branch:** mission/hermes-review-and-refactor  
**PR:** #127 (update existing)

## Priority Order

1. **Security fixes** — Add `requireAuth` to 5 GET endpoints missing auth
2. **Dead code removal** — Remove unused functions, variables, handlers
3. **Quality fixes** — Transaction safety, template literals, memoization

## Tasks

### Task 1: Auth on GET /api/agent/files/[key]
File: `src/app/api/agent/files/[key]/route.ts` (line 67)
Fix: Add `const auth = requireAuth(request); if (auth) return auth;`

### Task 2: Auth on GET /api/agent/profiles/[id]/toolsets
File: `src/app/api/agent/profiles/[id]/toolsets/route.ts` (line 19)
Fix: Add `const auth = requireAuth(request); if (auth) return auth;`

### Task 3: Auth on GET /api/agent/profiles
File: `src/app/api/agent/profiles/route.ts` (line 120)
Fix: `export async function GET(request: NextRequest)` + requireAuth

### Task 4: Auth on GET /api/models/sync/drift
File: `src/app/api/models/sync/drift/route.ts` (line 9)
Fix: Import NextRequest + requireAuth, add auth check

### Task 5: Auth on GET /api/models/fallbacks
File: `src/app/api/models/fallbacks/route.ts` (line 20)
Fix: `_request` is already `NextRequest` — just add requireAuth

### Task 6: Remove dead code — `getProfileBySeedKey` + `listSeededProfiles`
File: `src/lib/profiles-repository.ts` (lines 99-104, 343-359)
Fix: Remove unreferenced exports

### Task 7: Remove dead function `handleImportDiscovered`
File: `src/app/operations/agents/page.tsx` (lines 98-104)
Fix: Remove dead handler — never wired to ProfileSyncBar

### Task 8: Remove unused `canActOnOne` in ProfileSyncBar
File: `src/components/profiles/ProfileSyncBar.tsx` (line 24)
Fix: Remove unused variable declaration

### Task 9: Fix non-atomic swap in fallbacks/reorder
File: `src/app/api/models/fallbacks/reorder/route.ts` (lines 63-64)
Fix: Wrap position updates in a transaction

### Task 10: Remove unnecessary template literal
File: `src/app/api/models/fallbacks/toggle/route.ts` (line 48)
Fix: `fallback.toggle` not `` `fallback.toggle` ``