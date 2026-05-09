# Plan: Check/Rebuild/Restart — Branch Popup + Update Transform

## Overview
Three buttons in the expanded sidebar footer:
- **Check** — transforms into **Update Available!** (orange) or **Up to Date** (green) after clicking
- **Rebuild** — branch selection popup before building
- **Restart** — as-is (no branch needed)

## Files to Modify

### 1. `src/app/api/update/route.ts`
- Add `GET /api/update/branches` — fetches remote branches via `git fetch --quiet` then `git branch -r --format='%(refname:short)'`
- POST accepts optional `branch` field for `rebuild` action (not `update` — that always uses the checked-out branch)

### 2. `scripts/update.sh`
- Accept `--branch <name>` argument to override `CH_UPDATE_GIT_BRANCH`
- Usage: `update.sh --branch main`

### 3. `scripts/build.sh`
- Accept `--branch <name>` argument — if passed, does `git fetch origin <branch>` + `git checkout <branch>` + `git reset --hard origin/<branch>` before building

### 4. `src/components/layout/Sidebar.tsx`
- Add `BranchModal` component — centered modal with branch dropdown
- `checkVersion()` — calls `GET /api/update?branch=<selected>` (if no branch selected, fetches `main`)
- **Button state machine** (for the first/leftmost button):
  - Initial: blue "Check for Update", clicking triggers version check
  - After check — `version.updateAvailable === true`: orange "Update Available!", clicking triggers `POST /api/update { action: "update" }`
  - After check — `version.updateAvailable === false`: green "Up to Date" (disabled, no action)
- `Rebuild` button: opens `BranchModal`, on confirm calls `POST /api/update { action: "rebuild", branch: <selected> }`
- `Restart` button: unchanged

## UX Flow

**Collapsed footer** (unchanged):
- Orange alert icon if `updateAvailable` (click = trigger update)
- Rebuild icon (click = open branch modal)
- Restart icon (click = trigger restart)

**Expanded footer**:
```
[Check for Update]  → check →  [Update Available! (orange)] or [Up to Date (green, disabled)]
[    Rebuild     ]  → branch popup → build
[    Restart     ]  → restart
```

## API

### GET /api/update/branches
```json
{ "data": { "branches": ["main", "dev", "feature/foo"], "default": "main" } }
```

### GET /api/update?branch=main
Check version against specified branch instead of `CH_UPDATE_GIT_BRANCH`.

### POST /api/update
```json
{ "action": "rebuild", "branch": "main" }
```
