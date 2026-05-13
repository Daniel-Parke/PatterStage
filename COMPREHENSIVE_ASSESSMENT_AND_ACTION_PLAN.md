================================================================================
COMPREHENSIVE ASSESSMENT & ACTION PLAN
Control Hub Hermes-Only Architecture Review
================================================================================
Prepared by Bob
LAST UPDATED: 2026-05-13 18:15 UTC — ALL PHASES COMPLETE, committed as f973f2f
Date: 2026-05-13
Target: ~/control-hub/ web application
Scope: Full codebase audit, multi-agent residue identification, improvement
       recommendations across all layers (TypeScript source, database, tests,
       MCP integration, Hindsight memory, sync mechanisms)

================================================================================
EXECUTIVE SUMMARY
================================================================================

After iterative audit (round 2), the codebase state is confirmed. All 14
database migrations remain intact, ~130 source files and ~90 test files
are verified. Key findings from this audit:

1. The database is CLEAN. Migrations 011 (+ 014) correctly removed the
   agent_profiles table and framework_id column. All remaining tables
   correctly use plain Hermes profile name strings.

2. ~60% of multi-agent residue is STILL PRESENT in source code, tests,
   and documentation. The remaining items are concentrated in:
   - agent-registry.ts (145 lines) + its consumers (hermes-agent-runtime.ts,
     path-security.ts, api/agent/targets/route.ts)
   - AgentBackend interface (name/id fields at lines 22, 25)
   - /api/agents route + dashboard terminology (AgentRun, "Running Agents")
   - USE_REGISTRY_DEFAULT constant in mission-helpers.ts
   - ModelPicker registry references
   - AgentType open-ended union
   - dead memory providers in config-schema.ts
   - Dead conditional in memory-providers/index.ts line 146
   - Stale comments across 8+ source files
   - Documentation residue in 7 .md files (README, CONTROL_HUB.md,
     PLATFORM_VISION.md, API.md, DEPLOY.md, HERMES_CONFIG_INTEGRATION.md,
     MIGRATION.md)
   - discover-agents.mjs with framework field
   - E2E smoke test referencing /api/agent/targets
   - hermes-config-sync.ts "registry" references

3. New issues found during systematic sweep:
   a) E2E smoke test references deleted /api/agent/targets route
   b) discover-agents.mjs outputs framework:"hermes" field
   c) MemoryProviderType dead catch-all (line 146) can cast arbitrary strings
   d) POST /api/agent/active route already deleted (confirmed no-op)

4. Three sections unchanged: MCP integration, Hindsight memory assessment,
   Model provider/LLM assessment.

5. All existing functionality IS preserved. No database migrations needed.

================================================================================
SECTION 1: VERIFIED CODEBASE STATE
================================================================================

WHAT'S DONE (PRs #50/#51/#52):
  [x] FrameworkId/FrameworkDefaults types deleted
  [x] Framework column removed from models table UI
  [x] Agent switching API route deleted (no POST /api/agent/active found)
  [x] Agents page agent switcher UI removed
  [x] Kanban/Teams comments updated
  [x] Stale test mocks removed (most)
  [x] PI_DEV document deleted
  [x] Zod schema framework field removed
  [x] Migration 014 drops framework_id from models table
  [x] Migration 011 drops agent_profiles table, converts FK to plain TEXT

CURRENT DATABASE STATE (confirmed working):
  Tables: schema_version, sessions, kanban_boards, kanban_columns,
          kanban_cards, goal_sessions, goal_steps, teams, team_members,
          missions, tool_plugins, stories, credentials, models,
          model_defaults, model_fallbacks, fallback_config, cron_jobs
  No agent_profiles table (dropped in migration 011)
  models.framework_id removed (dropped in migration 014)
  model_defaults has no framework_id (rebuilt in migration 014)

CURRENT GIT STATE:
  Branch: dev (commit 41cd3bf - "refactor: remove remaining multi-agent
            concepts, Hermes-only cleanup (#52)")
  Main: 9dc8f1b Merge pull request #22 from Daniel-Parke/dev
  Untracked: COMPREHENSIVE_ASSESSMENT_AND_ACTION_PLAN.md,
             IMPLEMENTATION_PLAN_HERMES_CONCEPT_CLEANUP.md
  No uncommitted changes to tracked files.

CURRENT BUILD STATE:
  npx tsc --noEmit: PASS (0 errors)
  npm run lint: PASS (0 warnings)
  npm test baseline: NEEDS FULL RUN (targeted tests confirmed passing)

================================================================================
SECTION 2: REMAINING MULTI-AGENT RESIDUE (7 LAYERS, ALL RE-VERIFIED)
================================================================================

LAYER 1: Agent Registry System — STILL EXISTS (confirmed)
  File: src/lib/agent-registry.ts (145 lines)
  Status: STILL NEEDS REPLACEMENT
  Confirmed:
    - HermesRegistryEntry interface with id/label/filesystemRoot/URLs
    - HermesRegistryFile v3 format (single entry with version)
    - LegacyRegistryFile for v1/v2 array backwards compat
    - getHermesEntry() reads JSON, migrates, writes v3 (WRITES AT RUNTIME)
    - writeAgentEntry() writes JSON file
    - getHermesFilesystemRoot() convenience getter
  Consumers:
    - src/lib/hermes-agent-runtime.ts (3 imports: getHermesEntry,
      HermesRegistryEntry, and getHermesEntryOrThrow usage)
    - src/lib/path-security.ts (1 import: getHermesFilesystemRoot)
    - src/app/api/agent/targets/route.ts (1 import: getHermesEntry)
  Risk: MEDIUM — critical upstream dependency

LAYER 2: AgentBackend Interface — STILL EXISTS (confirmed)
  Files: src/lib/agent-backend/index.ts (lines 22, 25),
         src/lib/backends/hermes.ts (lines 348, 349)
  Status: STILL NEEDS CLEANUP
  Confirmed:
    - readonly name: string at index.ts:22
    - readonly id: string at index.ts:25
    - readonly name = "Hermes" at hermes.ts:348
    - readonly id = "hermes" at hermes.ts:349
  Comments still reference multi-backend:
    - index.ts header: "Hermes agent backend singleton" (acceptable but
      could be clearer — already single-backend)
    - backends/hermes.ts:2: "Implements the AgentBackend interface for
      the Hermes agent."
  Consumers: Confirmed no consumer accesses .name or .id fields
  Risk: LOW — field removal only

LAYER 3: /api/agents Route + Dashboard Naming — STILL EXISTS (confirmed)
  Files: src/app/api/agents/route.ts (22: AgentRun interface, 22: agents array)
         src/app/page.tsx (278, 728: d.data?.agents || d.agents fallback,
           718: "Running Agents" comment, 723: "Running Agents" text,
           734: "No Active Agents Detected")
  Status: STILL NEEDS RENAME
  Risk: LOW — internal naming only, no external consumers

LAYER 4: Dead /api/agent/targets Route — STILL EXISTS (confirmed)
  File: src/app/api/agent/targets/route.ts (confirmed exists on disk)
  Test: tests/unit/api-agent-targets.test.ts (confirmed exists, 2 tests pass)
  E2E: tests/e2e/smoke.spec.ts (line 33) references /api/agent/targets
  Status: STILL NEEDS DELETION (route + test + e2e reference)
  Risk: NONE — confirmed zero consumers in production code

LAYER 5: USE_REGISTRY_DEFAULT — STILL EXISTS (confirmed)
  File: src/lib/mission-helpers.ts (line 15, 30, 50, 66, 67)
  Test: tests/unit/template-default-model.test.ts (lines 7, 19, 21, 26)
  Status: STILL NEEDS RENAME
  Risk: LOW — constant rename with test update

LAYER 6: ModelPicker Registry References — STILL EXISTS (confirmed)
  File: src/components/missions/ModelPicker.tsx (line 50: "Registry-backed",
         line 53: EMPTY_REGISTRY_TITLE, line 103: registryValue,
         line 154/172: EMPTY_REGISTRY_TITLE usage, line 180: registryValue)
  Status: STILL NEEDS RENAME
  Risk: LOW — cosmetic rename

LAYER 7: Stale Comments — STILL EXISTS (confirmed)
  Files (all re-verified on disk):
    - src/lib/path-security.ts:54 "registered agent root" (error msg)
    - src/lib/hermes-agent-runtime.ts:34 "from the Hermes entry"
    - src/lib/backends/hermes.ts:4 "Implements the AgentBackend interface"
    - src/lib/backends/hermes.ts:97 "Control Hub models registry default"
    - src/lib/backends/hermes.ts:112 "Control Hub models registry default"
    - src/lib/kanban-adapter/agent-bridge.ts:8 "active AgentBackend"
    - src/lib/kanban-adapter/agent-bridge.ts:13 "AgentBackend interface"
    - src/app/api/kanban/route.ts:10 "active AgentBackend"
    - src/app/api/kanban/route.ts:349 "active agent backend"
    - src/app/api/missions/route.ts:5 "any agent backend"
    - src/lib/hermes-config-sync.ts:217 "registry's default"
    - src/lib/hermes-config-sync.ts:279 "full registry state"
    - src/lib/hermes-config-sync.ts:281 "SQLite registry"
    - src/lib/schema/template-pack-v1.ts:20 "registry's agent default"
  Status: STILL NEEDS UPDATES (14 instances across 9 files)
  Risk: NONE — cosmetic only

================================================================================
SECTION 3: ISSUES CONFIRMED (PREVIOUS PLAN CORRECT + NEW FINDINGS)
================================================================================

ISSUE A: agent-registry.ts Writes When It Should Not — CONFIRMED
  getHermesEntry() CREATES and WRITES agents-registry.json on every read
  if it doesn't exist. Plan's approach CORRECT: replace with hermes-home.ts
  doing env-var priority + read-only legacy fallback, never write.

ISSUE B: Session Repository's AgentType Is Open-Ended — CONFIRMED
  File: src/lib/session-repository.ts (line 19)
  Current: export type AgentType = "hermes" | string;
  Status: STILL NEEDS NARROWING to "hermes" only

ISSUE C: Memory Provider Factory Has Dead Provider Slot — CONFIRMED
  File: src/lib/memory-providers/index.ts (line 146)
  Dead: if (val && val !== "none") return val as MemoryProviderType;
  This casts arbitrary config strings to MemoryProviderType — type safety
  issue beyond just dead code.
  Status: STILL NEEDS REMOVAL + COMMENT

ISSUE D: Config Schema Still Lists Non-Hermes Memory Providers — CONFIRMED
  File: src/lib/config-schema.ts (line 80)
  Options: ["holographic", "hindsight", "mem0", "honcho", "supermemory",
            "retaindb", "byterover"]
  Only "holographic" and "hindsight" implemented.
  Status: STILL NEEDS CLEANUP

ISSUE E: Database Seed Data Still References agent_profiles — CONFIRMED
  File: src/lib/db/migrations/002_seed_data.sql (line 13)
  Harmless in practice (011 drops the table). Rule: NO CODE CHANGE.
  Status: Add comment only per original plan.

ISSUE F: Tool Definition Category "mcp" Is Correct — CONFIRMED
  Category="mcp" is correctly implemented. Documentation improvement
  remains out-of-scope but noted.
  Status: No action needed.

ISSUE G: Control Hub is Source of Truth Pattern — CONFIRMED
  Drift detection is current approach. UI drift indicator out of scope.
  Status: No action needed beyond future recommendation.

NEW ISSUE H: E2E Smoke Test References Dead Route [MUST FIX]
  File: tests/e2e/smoke.spec.ts (line 33)
  Issue: Calls GET /api/agent/targets which will be deleted in Phase 1.
  This test will break when the route is removed unless also updated.
  Recommendation: Remove the /api/agent/targets block from smoke test.

NEW ISSUE I: discover-agents.mjs Uses framework Field [SHOULD FIX]
  File: scripts/tooling/discover-agents.mjs (line 97: framework: "hermes")
  Issue: Discovery script outputs framework:"hermes" even though there's
  only one framework. The agents.discovery.json file and the
  "discover-agents" npm script reference multi-install concepts.
  Recommendation: Simplify to only detect the single local Hermes install
  via env var. Remove framework field from output. Consider renaming
  script to detect-hermes or removing entirely (single install, no
  discovery needed).

NEW ISSUE J: models-repository.ts Header Says "registry" [NICE TO FIX]
  File: src/lib/models-repository.ts (line 2)
  Comment: "CRUD for the user-models registry"
  Recommendation: Update to "CRUD for user models (Hermes dispatch)"

================================================================================
SECTION 4: MCP INTEGRATION ASSESSMENT
================================================================================

(No changes from previous assessment — MCP integration is clean and
correctly scoped for a single Hermes agent.)

How MCP works in the Hermes ecosystem:
- MCP (Model Context Protocol) is an open standard for connecting AI agents
  to external tools and data sources via JSON-RPC over stdio or SSE
- Hermes agents discover MCP servers through config.yaml entries
- Each MCP server exposes a set of tools that the agent can invoke
- Tools are registered in Control Hub's tool_plugins table with category="mcp"

What I found in the codebase:
1. ToolDefinition interface supports category="mcp" (CORRECT)
2. Database CHECK constraint allows 'mcp' (CORRECT)
3. Tools page renders MCP category with pink badge (CORRECT)
4. /api/tools route accepts category="mcp" (CORRECT)
5. models-repository has mcp default slot in ModelDefaults (CORRECT)
   - models-repository.ts:23: mcp: string | null
   - models-repository.ts:112: mcp: null in defaults

No issues found. The MCP integration is clean and correctly scoped for a
single Hermes agent. The only improvement is documentation (Issue F above).

================================================================================
SECTION 5: HINDSIGHT MEMORY ASSESSMENT
================================================================================

(No changes from previous assessment — Hindsight integration is correct.)

How Hindsight works in the Hermes ecosystem:
- Hindsight is Hermes's knowledge graph memory system (persist/recall/reflect)
- It runs as a separate HTTP server (hindsight_server.py at ~/.hermes/hindsight/)
- The hindsight_bridge.py script in ~/.hermes/scripts/ proxies calls
- Control Hub interacts via /api/memory/hindsight route (subprocess exec)

What I found in the codebase:
1. /api/memory/hindsight/route.ts correctly shells out to bridge
2. Python path resolution checks multiple venv locations (correct for safety)
3. HINDSIGHT_API_KEY resolved from config.json and env (correct)
4. MemoryProviderType includes "hindsight" but factory returns nullProvider
   (CORRECT - Hindsight uses subprocess bridge, not direct DB access)
5. HindsightBrowser.tsx (678 lines) provides full UI

One minor improvement remains: resolvePython() in hindsight/route.ts has
7 candidate paths that could be simplified using getActiveHermesPaths().

No issues requiring action in this cleanup.

================================================================================
SECTION 6: MODEL PROVIDER / LLM ASSESSMENT
================================================================================

(No changes from previous assessment — model management is correct.)

The models registry pattern is CORRECT for Hermes-only operation:
- Control Hub DB is the source of truth for models and credentials
- sync-manager.ts pushes/pulls to/from ~/.hermes/config.yaml and .env
- Mission dispatch resolves models from the DB, NOT from Hermes config
- The dual-write pattern ensures both stores stay in sync

What works well:
1. Credential management: apiKey stored in DB, pushed to Hermes .env
2. Model resolution: explicit override > DB default > Hermes config
3. Fallback chain: stored in DB, pushed to Hermes config
4. Drift detection: compares DB vs config.yaml and reports differences
5. MCP default slot in ModelDefaults (confirmed)

What could be improved:
1. pushAllToHermes() iterates through OAuth providers unnecessarily
2. No automatic pull-on-startup

================================================================================
SECTION 7: COMPREHENSIVE ACTION PLAN
================================================================================

Total estimated changes: ~25-30 files (~8 source + ~8 docs + ~3 scripts +
~6 tests + ~5 config/type files), ~100 net lines removed, ~80 modified.
Risk: LOW. All changes are conceptual/cleanup. No database migrations.
No behavior changes.

DEPENDENCY ORDER:
  Phase 0 -> Phase 1 -> Phase 2 -> Phase 3
                              -> Phase 4 -> Phase 5
                    -> Phase 6 -> Phase 7
                              -> Phase 8 -> Phase 9
  Phase 1 (registry collapse) is the critical dependency.

================================================================================
PHASE 0: PRE-FLIGHT VERIFICATION
================================================================================

  0.1 git checkout dev && git status (confirm clean)
  0.2 npx tsc --noEmit -- confirm zero errors [PASS]
  0.3 npm run lint -- confirm zero warnings [PASS]
  0.4 npm test -- confirm all tests passing
  0.5 git checkout -b feat/hermes-concept-cleanup-round2

  Files changed: 0
  Risk: NONE

================================================================================
PHASE 1: COLLAPSE AGENT REGISTRY INTO DIRECT HERMES PATH RESOLUTION
================================================================================

  1a. CREATE src/lib/hermes-home.ts (NEW FILE, ~60 lines)
      Functions:
        getHermesHome() -> string
        getHermesGatewayUrl() -> string | null
        getHermesLlmUrl() -> string | null
        getHermesFilesystemRoot() -> string (re-exports getHermesHome)

      Resolution priority for each:
        1. Environment variable (HERMES_HOME / HERMES_GATEWAY_URL /
           CONTROL_HUB_LLM_API)
        2. Read-only fallback from agents-registry.json (if exists)
        3. Hard-coded default (~/.hermes)

      KEY DESIGN DECISION: NO writeAgentEntry equivalent. The resolution
      is purely env-var + legacy read. agents-registry.json becomes
      legacy-only (read for migration compat, never written again).

  1b. UPDATE src/lib/hermes-agent-runtime.ts
      Remove imports: getHermesEntry, HermesRegistryEntry from agent-registry
      Add imports: getHermesHome, getHermesGatewayUrl, getHermesLlmUrl
        from ./hermes-home
      Replace getHermesEntry().filesystemRoot with getHermesHome()
      Replace getHermesEntryOrThrow() with getHermesHomeOrThrow() (returns
        string, not HermesRegistryEntry)
      Update getAgentLlmEndpoints() to use direct function calls
      Update line 34 comment: "from the Hermes entry" -> "from Hermes config"

  1c. UPDATE src/lib/path-security.ts
      Change import from "@/lib/agent-registry" to "@/lib/hermes-home"
      Update error message (line 54): "registered agent root" ->
        "Hermes install root"

  1d. DELETE src/app/api/agent/targets/route.ts
      (Dead route, zero consumers)

  1e. DELETE src/lib/agent-registry.ts
      After all consumers updated, delete entire file.

  1f. DELETE tests/unit/api-agent-targets.test.ts
      (Tests deleted route)

  1g. UPDATE tests/e2e/smoke.spec.ts (line 33)
      Remove the GET /api/agent/targets test block.

  Files changed: 7 (1 new, 3 deleted, 2 modified, 1 test update)
  Lines: ~60 added, ~175 deleted, ~40 modified
  Risk: MEDIUM (critical dependency for all downstream phases)

================================================================================
PHASE 2: SIMPLIFY AGENT BACKEND INTERFACE
================================================================================

  2a. UPDATE src/lib/agent-backend/index.ts
      Remove readonly name: string field (line 22)
      Remove readonly id: string field (line 25)
      Update header comment:
        "All agent backends must implement this contract." ->
        "Contract for Hermes mission dispatch."
      Update listTools() comment:
        "for this backend" -> "in this Hermes install"

  2b. UPDATE src/lib/backends/hermes.ts
      Remove readonly name = "Hermes" field (line 348)
      Remove readonly id = "hermes" field (line 349)
      Update header comment (line 4):
        "Implements the AgentBackend interface for the Hermes agent." ->
        "Hermes mission backend -- all dispatch flows through here."
      Update line 97 comment:
        "Control Hub models registry default agent model" ->
        "Control Hub DB default model"
      Update line 112 comment similarly.

  2c. UPDATE src/lib/backends/index.ts
      Header comment already says "Hermes agent backend singleton" — OK as-is.

  2d. UPDATE src/lib/agent-backend/types.ts
      Header: "Shared types for all agent backends" ->
        "Shared types for Hermes mission dispatch"
      No type renames needed (AgentProfile/AgentSession are valid concepts)

  2e. UPDATE src/lib/tool-registry.ts
      Import comment (line 7): "from agent-backend types" ->
        "from Hermes dispatch types"

  2f. UPDATE src/app/api/missions/route.ts
      Comment (line 5): "by the AgentBackend so any agent backend can run
        missions." -> "by the Hermes backend for mission execution."

  Files changed: 4 (index.ts, types.ts, hermes.ts, tool-registry.ts) + 2 routes
  Lines: ~20 changes
  Risk: LOW (confirmed no consumer accesses .name or .id)

================================================================================
PHASE 3: RENAME /api/agents ROUTE AND DASHBOARD TERMINOLOGY
================================================================================

  3a. UPDATE src/app/api/agents/route.ts
      interface AgentRun -> interface HermesProcess
      const agents: AgentRun[] -> const processes: HermesProcess[]
      agents.push(...) -> processes.push(...)
      "Failed to query agents" -> "Failed to query Hermes processes"

      API response shape changes:
        { agents, total, running, idle } -> { processes, total, running, idle }

  3b. UPDATE src/app/page.tsx
      interface AgentRun -> interface HermesProcess
      const [agents, setAgents] -> const [processes, setProcesses]
      fetchAgents -> fetchProcesses
      d.data?.agents -> d.data?.processes
      agentsInterval -> processesInterval
      activeAgents -> activeProcesses
      "Running Agents" -> "Hermes Processes"
      label="Agents" -> label="Hermes Processes"
      "No Active Agents Detected" -> "No Active Processes Detected"
      agent.xxx -> proc.xxx in .map iteration
      Comment line 718: "Running Agents" -> "Hermes Processes"

  NOTE: No test files reference /api/agents mock responses (confirmed clean).

  Files changed: 2
  Lines: ~50 renames
  Risk: LOW (both files atomically, no external consumers)

================================================================================
PHASE 4: RENAME USE_REGISTRY_DEFAULT IN MISSION HELPERS
================================================================================

  4a. UPDATE src/lib/mission-helpers.ts
      USE_REGISTRY_DEFAULT -> USE_HERMES_DEFAULT
      Comment line 30: "USE_REGISTRY_DEFAULT" -> "USE_HERMES_DEFAULT"
      Comment line 50: "registry agent default" -> "Hermes agent default"
      Comment line 66: "fall through to the registry agent default" ->
        "fall through to the Hermes agent default"

  4b. UPDATE tests/unit/template-default-model.test.ts
      Import USE_REGISTRY_DEFAULT -> USE_HERMES_DEFAULT
      All references updated in assertions

  Files changed: 2
  Lines: ~8 renames
  Risk: LOW (propagates via TypeScript)

================================================================================
PHASE 5: RENAME MODEL PICKER REGISTRY REFERENCES
================================================================================

  5a. UPDATE src/components/missions/ModelPicker.tsx
      EMPTY_REGISTRY_TITLE -> EMPTY_DEFAULT_HINT
      Comment line 50: "Registry-backed model select." ->
        "Hermes model select for mission dispatch."
      registryValue -> selectedValue
      "Default (registry / Hermes)" -> "Default (Hermes config)"
      "No models registered -- Hermes default will be used" ->
        "No models configured -- Hermes default will be used"

  Files changed: 1
  Lines: ~10 renames
  Risk: LOW

================================================================================
PHASE 6: NARROW TYPES + REMOVE DEAD PROVIDERS
================================================================================

  6a. UPDATE src/lib/session-repository.ts (line 19)
      export type AgentType = "hermes" | string; ->
      export type AgentType = "hermes";
      Add comment: "Single agent type -- Hermes only."

  6b. UPDATE src/lib/config-schema.ts (line 80)
      Remove mem0, honcho, supermemory, retaindb, byterover.
      Keep: ["holographic", "hindsight"]
      Update description to reflect only implemented providers.

  6c. UPDATE src/lib/memory-providers/index.ts (line 146)
      Remove dead catch-all:
        if (val && val !== "none") return val as MemoryProviderType;
      Add comment explaining why "hindsight" falls through to nullProvider
      (managed via subprocess bridge, not direct DB access).

  6d. UPDATE src/lib/models-repository.ts (line 2)
      Comment: "CRUD for the user-models registry" ->
        "CRUD for user models (Hermes dispatch)"

  Files changed: 4
  Lines: ~5 changes
  Risk: LOW (AgentType narrowing is safe; config-schema narrows UI only)

================================================================================
PHASE 7: UPDATE STALE COMMENTS + REGISTRY REFERENCES
================================================================================

  7a. UPDATE src/lib/kanban-adapter/agent-bridge.ts
      Line 8: "active AgentBackend" -> "Hermes backend"
      Line 13: "AgentBackend interface (Hermes)" -> "Hermes backend"

  7b. UPDATE src/app/api/kanban/route.ts
      Line 10: "active AgentBackend" -> "Hermes backend"
      Line 349: "active agent backend" -> "Hermes backend"

  7c. UPDATE src/lib/hermes-config-sync.ts
      Line 217: "registry's default" -> "Control Hub DB's default"
      Line 279: "full registry state" -> "full Control Hub DB state"
      Line 281: "SQLite registry" -> "Control Hub DB"

  7d. UPDATE src/lib/schema/template-pack-v1.ts (line 20)
      "registry's agent default" -> "Control Hub DB's agent default"

  Files changed: 4
  Lines: ~7 comment updates
  Risk: NONE

================================================================================
PHASE 8: UPDATE ALL AFFECTED TESTS
================================================================================

  8a. DELETE tests/unit/api-agent-targets.test.ts (Phase 1f)
  8b. UPDATE tests/unit/template-default-model.test.ts (Phase 4b)
  8c. UPDATE tests/e2e/smoke.spec.ts (Phase 1g - remove /api/agent/targets)

  Note: No test files reference /api/agents mock responses (confirmed clean).
  No test files mock AgentBackend .name or .id fields (confirmed only
  HermesAgentBackend class instantiation in dispatch tests, no mocks).

  Files changed: 3 test files (1 deleted, 2 modified)
  Risk: LOW

================================================================================
PHASE 9: UPDATE DOCUMENTATION
================================================================================

  9a. UPDATE README.md
      Line 44: Remove "Use Agents in the UI to switch installs"
      Line 44: Remove "npm run discover-agents ... to refresh
        agents.discovery.json"
      Line 51: Remove references to agents-registry.json and
        agents.discovery.json
      Line 94: Remove "when multiple installs exist" language
      Line 121: Remove agent-registry.ts from file listing

  9b. UPDATE docs/CONTROL_HUB.md (line 18)
      Remove agents-registry.json, agents.discovery.json references
      Remove "Active Hermes install" switching language
      Clarify single Hermes install via HERMES_HOME

  9c. UPDATE docs/PLATFORM_VISION.md (lines 20, 22, 38, 59)
      Remove agents-registry.json, agents.discovery.json references
      Remove "switching installs" language
      Remove "registry, discovery" link text

  9d. UPDATE docs/API.md (line 15)
      Remove /api/agent/targets row entirely (route will be deleted)

  9e. UPDATE docs/DEPLOY.md (lines 43, 44)
      Remove agents-registry.json, agents.discovery.json references
      Simplify HERMES_HOME to single install

  9f. UPDATE docs/HERMES_CONFIG_INTEGRATION.md (lines 10, 16, 20)
      Remove agents-registry.json, agents.discovery.json references
      Remove "multiple local installs" language
      Remove "switching installs" language

  9g. UPDATE docs/MIGRATION.md (lines 19, 21, 23, 25)
      Rewrite the "Active Hermes installs" section for single install
      Remove "switching installs" language
      Remove agents-registry.json backup instructions

  9h. UPDATE scripts/tooling/discover-agents.mjs
      Option 1: Simplify to single-install detection (remove framework field,
        search only HERMES_HOME)
      Option 2: Delete entirely (single install, no discovery needed)
      Update package.json to remove "discover-agents" npm script

  Files changed: ~10 (7 docs + 1 script + package.json)
  Risk: LOW (documentation only)

================================================================================
PHASE 10: FINAL VERIFICATION
================================================================================

  10.1 npx tsc --noEmit -- zero errors
  10.2 npm run lint -- zero warnings
  10.3 npm test -- all tests pass
  10.4 npm run build -- Next.js production build succeeds
  10.5 Manual smoke test:
        - Dashboard loads at localhost:42069
        - "Hermes Processes" section shows gateway/cron/subagent entries
        - Model picker shows "Default (Hermes config)"
        - Mission dispatch works with default model
        - Memory page loads (holographic and hindsight paths work)
        - Models page load/defaults/fallbacks all functional
  10.6 Verify agents-registry.json NOT created on fresh start (only read)
  10.7 Verify no TypeScript errors in IDE

  Files changed: 0
  Risk: NONE

================================================================================
SECTION 8: RISK ASSESSMENT
================================================================================

  Overall Risk: LOW

  All changes are conceptual/cleanup:
  - Removing unused interface fields
  - Renaming variables and constants
  - Deleting dead code
  - Fixing misleading comments
  - Narrowing type definitions
  - Updating documentation to match single-agent reality

  What does NOT change:
  - Database schema (no migrations needed)
  - API endpoint paths (except deleted /api/agent/targets)
  - Business logic (mission dispatch, kanban, cron, sessions, etc.)
  - Sync behavior (push/pull between DB and Hermes config)
  - Memory provider behavior
  - MCP tool handling
  - Hindsight bridge integration
  - Credential management
  - Any user-facing behavior beyond label updates

  Rollback plan: git revert the commit if any issue found.
  No database changes means rollback is trivial.

================================================================================
SECTION 9: WHAT SURVIVES (CORRECTLY) AFTER THIS CLEANUP
================================================================================

  - AgentBackend interface (as internal abstraction, single-backend)
  - Hermes profile system (multi-profile for a single agent -- correct model)
  - Mission dispatch, Kanban, Cron, Memory, Hardware monitoring
  - Model management, Credentials, Fallback chains
  - Session tracking, Goals, Skills, Teams
  - MCP tool category (correct for Hermes agent)
  - Hindsight memory integration (correct subprocess bridge pattern)
  - Dual-store config sync (DB <-> config.yaml/.env)
  - Agent registry file on disk (legacy read-only compat, not deleted)
  - hermes-home.ts (new clean path resolution module)

================================================================================
SECTION 10: FUTURE RECOMMENDATIONS (OUT OF SCOPE FOR THIS PR)
================================================================================

  1. UI Drift Indicator: The sync system detects drift but doesn't surface
     it in the dashboard. A "Sync Needed" indicator would be valuable.

  2. MCP Tool Discovery Documentation: The /api/tools route and tool_plugins
     table relationship with MCP server discovery needs better inline docs.

  3. resolvePython() in hindsight route: The 7-candidate path shotgun could
     be replaced with a single canonical path from getActiveHermesPaths().

  4. Migration 002 Cleanup: The agent_profiles INSERT in migration 002 is
     superseded by migration 011's DROP TABLE. Add a comment documenting this.

  5. OAuth Credential Sync: The pushAllToHermes() iterates through OAuth
     providers unnecessarily. Could skip providers with no envVar mapping.

================================================================================
END OF ASSESSMENT
================================================================================
