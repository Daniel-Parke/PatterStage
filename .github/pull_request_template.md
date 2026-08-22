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
- [ ] `npm run build`
- [ ] If the PR changes UI or navigation: `npm run prebuild && npm run build && npm run test:e2e` (or smoke as appropriate); updated **`tests/e2e/app-routes.ts`** if sidebar routes changed (see [docs/TESTING.md](docs/TESTING.md)).
- [ ] Docs / API tables updated when behaviour or env vars changed ([docs/README.md](docs/README.md)).

## Related

<!-- Issues, design notes, or N/A -->
