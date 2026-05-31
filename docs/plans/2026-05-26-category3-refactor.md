# Category 3 Refactor — Models, Agents, Skills, Tools, Personalities

**Branch:** mission/hermes-review-and-refactor  
**PR:** #129 (updated by subsequent commits)

## Completion Status

All planned tasks completed in this session.

## Tasks

### Task 1: Auth on GET /api/agent/files/[key]
**Status: DONE (already fixed in prior session)**  
File: `src/app/api/agent/files/[key]/route.ts` (line 67)  
Fix: Added `const auth = requireAuth(request); if (auth) return auth;`

### Task 2: Auth on GET /api/agent/profiles/[id]/toolsets
**Status: DONE (already fixed in prior session)**  
File: `src/app/api/agent/profiles/[id]/toolsets/route.ts` (line 19)  
Fix: Added `const auth = requireAuth(request); if (auth) return auth;`

### Task 3: Auth on GET /api/agent/profiles
**Status: DONE (already fixed in prior session)**  
File: `src/app/api/agent/profiles/route.ts` (line 120)  
Fix: `export async function GET(request: NextRequest)` + requireAuth

### Task 4: Auth on GET /api/models/sync/drift
**Status: DONE (already fixed in prior session)**  
File: `src/app/api/models/sync/drift/route.ts` (line 9)  
Fix: Import NextRequest + requireAuth, add auth check

### Task 5: Auth on GET /api/models/fallbacks
**Status: DONE (already fixed in prior session)**  
File: `src/app/api/models/fallbacks/route.ts` (line 20)  
Fix: `_request` is already `NextRequest` — just add requireAuth

### Task 6: Remove dead code — `getProfileBySeedKey` + `listSeededProfiles`
**Status: KEEP — functions are still referenced by seed code**  
File: `src/lib/profiles-repository.ts` (lines 99-104)  
`getProfileBySeedKey` is used by `catalog-seed.ts` (legitimate import)  
`listSeededProfiles` was already removed (not found in codebase)

### Task 7: Remove dead function `handleImportDiscovered`
**Status: KEEP — function IS wired to ProfileSyncBar**  
File: `src/app/operations/agents/page.tsx` (lines 98-104)  
`handleImportDiscovered` is passed as `onImportDiscovered` prop to `ProfileSyncBar` at line 285  
The import/discovered feature is legitimate and should remain

### Task 8: Remove unnecessary `canActOnOne` in ProfileSyncBar
**Status: DONE**  
File: `src/components/profiles/ProfileSyncBar.tsx` (line 24)  
Fix: Replaced `const canActOnOne = selectedSlug != null;` with inline `selectedSlug != null` — eliminates unnecessary intermediate variable

### Task 9: Fix non-atomic swap in fallbacks/reorder
**Status: DONE (already fixed in prior session)**  
File: `src/app/api/models/fallbacks/reorder/route.ts` (lines 63-64)  
Fix: Wrapped position updates in `inTransaction()`

### Task 10: Remove unnecessary template literal
**Status: DONE (already fixed in prior session)**  
File: `src/app/api/models/fallbacks/toggle/route.ts` (line 48)  
Fix: `` fallback.toggle`` → `fallback.toggle`

---

## Additional Auth Fixes Found During Review

### Task 11: Auth on GET /api/personalities
**Status: DONE (this session)**  
File: `src/app/api/personalities/route.ts` (line 56)  
Fix: Changed `export async function GET()` to `GET(request: NextRequest)` and added `requireAuth` check

### Task 12: Auth on GET /api/credentials
**Status: DONE (this session)**  
File: `src/app/api/credentials/route.ts` (line 17)  
Fix: Changed `export async function GET()` to `GET(request: NextRequest)` and added `requireAuth` check

### Task 13: Auth on GET /api/skills/[...path]
**Status: DONE (this session)**  
File: `src/app/api/skills/[...path]/route.ts` (line 9)  
Fix: Added `requireAuth` check and changed `_request` to `request` parameter
