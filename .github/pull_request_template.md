---
summary: The pull request template: base branch, the gate checklist, and what a description must carry
type: process
tags: [process, ci]
compiled_from: normalised
---

## Summary

<!-- What does this PR change and why? Keep it concrete—I merge from dev when CI is green and the diff matches the description. -->

## Base branch

- [ ] PR targets **`dev`** (not `main`).

## Checklist

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit -p tsconfig.json`
- [ ] `npm test`
- [ ] `npm run lint:knip`
- [ ] `npm run canary:check`
- [ ] `npm run build`
- [ ] If the PR changes UI or navigation: `npm run prebuild && npm run build && npm run test:e2e` (or smoke as appropriate). Do NOT hand-edit `tests/e2e/app-routes.ts` -- it is DERIVED from the module registry (`allModuleRoutes()`, ADR-0005). It used to be hand-maintained and had already drifted, silently dropping a whole page from the navigation matrix. Add the route to `src/lib/modules/registry.ts` and the matrix follows. See [TESTING.md](../docs/contributing/testing.md).
- [ ] Docs / API tables updated when behaviour or env vars changed ([docs index](../docs/README.md)).

## Related

<!-- Issues, design notes, or N/A -->
