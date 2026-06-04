# Session 96 — List 2 carryover finalization

See PR body for the full session-96 description. Headline:

- 6-site `serverErrorFromCatch` migration in `src/app/api/cron/route.ts` (4 sites: GET/POST/PUT/DELETE) + `src/app/api/missions/route.ts` (2 sites: GET, POST wrapper)
- 1-site `setErrorFromCaught` migration in `src/components/cron/JobFormModal.tsx` (the inline `err instanceof Error ? err.message : "Unknown error"` form)
- `rememberLastCategory` helper extracted in `src/hooks/useMissionsPage.ts` (2 callsites collapsed) + 7 new tests in `tests/unit/remember-last-category.test.ts`
- `handleCloseCreate` `useCallback` closure in `src/app/orchestration/missions/page.tsx` (3 callsites collapsed)

All 1334 unit tests pass (201 suites, +7 new). tsc clean, eslint clean, build passes. Byte-equivalent at runtime for all 7 affected API + UI call sites.
