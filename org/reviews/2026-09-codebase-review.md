---
summary: A read-only review of the whole repository after the consolidation programme closed, 265 findings from ten dimensions and a completeness critic, each adversarially verified, 257 surviving, with the operator decisions each one needs
type: review
tags: [review, refactor, consolidation, security, governance]
status: done
---

# PatterStage · Codebase review after consolidation (2026-09-11)

> Measured read-only on `dev` at `ce4ac1fd`, the day the consolidation
> programme closed (`org/plans/2026-09-consolidation.md`). Ten reviewers
> covered disjoint scopes: app, components, hooks and the client data layer,
> lib data, lib domains and modules, tests, tooling, docs, org, and
> cross-cutting concerns. One sceptic per dimension then went back to the tree
> to refute every finding. A completeness critic swept what no dimension owned,
> security first, and was verified the same way.
>
> This page is the index. Its companion,
> `org/reviews/2026-09-codebase-review-evidence.md`, carries each finding's
> re-runnable evidence, the sceptic's reasoning, the proposal and the operator
> decision. Search it by finding id.

## The numbers

- **265 findings, 257 surviving.** Eight were refuted, and each is listed
  under its dimension with the reason.
- **110 of the 257 need an operator decision** before anyone acts on them.
  These include removing a route, a URL, an env var, a script, a dependency or
  a documented behaviour, or changing lint or test policy.
- **About 12,800 net lines**, summed across surviving findings. The
  estimates overlap: the tests sceptic showed that tests-04, tests-05 and
  tests-06 count some of the same lines. Most of the total sits outside `src`,
  in test comments, rendered YAML, tooling and harness code. Treat the sum as a
  ceiling, never as a target.
- Every estimate is net of any new shared interface. A block shared by exactly
  two consumers usually does not pay for one. The last programme measured that
  at 39 new lines to remove 48 duplicated ones.

## Read these first

1. **Governance, the consolidation programme's own breaches (org-01, org-02).**
   T-0144's codemod rewrote path strings inside the protected set with no ADR:
   `org/policy.json`, ADR-0009 and ADR-0010. It also rewrote 52 other `org/`
   files, among them historical task records that ADR-0010 section 3 says are
   never rewritten. Separately, batches C4 to C8 ran up to ten writing agents
   against `max_lanes: 2` in `org/policy.json`, with an empty
   `org/claims.json`. Both need the operator's ruling, not another edit.
2. **Security (critic-01 to critic-05, critic-14, app-06, tooling-04,
   tooling-05, tooling-29).** Deep Research's URL guard lets IPv4-mapped and
   NAT64 IPv6 literals through. The failed-auth throttle keys on a
   client-supplied X-Forwarded-For. The access token is written to a
   default-permission log that the Logs page lists. No response forbids
   framing. The optional request signature leaves the body out, so a signed
   update can be replayed with a different branch. Node 20 is past end of life,
   gitleaks skips `tests/`, and `.dockerignore` admits the local database and
   token.
3. **Defects found on the way, not refactors.** The boot line prints
   `composer=on` while the flag is off (cross-cutting-01). Runtime status names
   a gateway the runtime does not use (cross-cutting-02). Chat's Copy copies
   markup for every multi-line code block (lib-domains-12). A failing board
   read raises a new persistent alert every 15 seconds (hooks-02). LogSync
   re-inserts the same error lines every minute (lib-data-10). A failed Story
   Weaver load reads as "not found" (app-03). A template saved with the Bot
   icon cannot be drawn (components sceptic note). There are unnamed controls
   and labels that point at nothing (components-03). A progress bar
   re-announces a fabricated percentage to screen readers (critic sceptic
   note). And `prebuild` runs a legacy partial migration that swallows its
   errors (tooling-13).
4. **Gates that read zero while blind.** The raw-control lint cannot see a tag
   that ends its line (components-01). The write and read gates cannot see
   hooks or bare `fetch` (hooks-04, hooks-05, app-03). The form-control check
   reads only lowercase DOM tags (critic-06). The try/catch census misses
   hand-rolled catches (app-04). Case-broken doc links pass on Windows and
   fail on Linux (docs-01). Root documents are never link-checked (docs-02,
   tooling-19). knip does not scan tests or the harness (tooling-16, tests-13,
   lib-domains-05). No CI job holds the line census or the design census
   (tests-02, org sceptic note). The census does not count tooling, docs or
   org (tooling-22, docs-21). Fix these before trusting any later batch's
   green gate.
5. **The discipline does not survive a session (tooling-01, org-04).** No
   in-repo command runs the whole gate by exit code. The mutation sweep and the
   task-record writers lived in a session scratchpad. The record renderer lives
   in a sibling checkout (`../PatterTech_EOS`).

## How to use this review

- Every number is a hypothesis with a method attached. Re-run the method
  before acting on a finding, because the tree moves.
- A finding marked OP needs the operator's sign-off, item by item. Collect
  them into one decision register rather than asking one at a time.
- The refuted findings stay refuted for the reasons given. Do not re-propose
  them without new evidence.
- "Not covered" lists what no reviewer examined. Network-dependent checks
  (`npm audit`, `npm outdated`, a gitleaks history scan) and build-dependent
  ones (bundle size, CSP with Next's inline scripts, screenshots) were all out
  of reach of a read-only review.

## Index by dimension

Each line reads: id [category, risk, net lines, verdict] OP-if-it-needs-the-operator title.

### critic (security and what no dimension owned) · 13 surviving of 15 · net -1188 · 7 need the operator

- `critic-14` [security, low, 0, adjusted] The workspace path guard compares strings without resolving symlinks, and treats another drive as inside the root on native Windows
- `critic-02` [security, medium, 3, adjusted] **OP** Failed-auth throttle keys on a client-supplied X-Forwarded-For, so a remote caller can lock the operator out and a rotating caller is never throttled
- `critic-05` [security, low, 8, adjusted] **OP** The optional request signature leaves out the body, so a captured signed update can be replayed with another branch or action for five minutes
- `critic-03` [security, medium, 10, adjusted] **OP** The access token goes into a default-permission log on every boot and is listed on the Logs page, beside a 0600 token file
- `critic-04` [security, low, 12, confirmed] **OP** No response forbids framing, so a page on any other localhost port can frame the signed-in app
- `critic-01` [security, low, 20, adjusted] url-guard lets IPv4-mapped and NAT64 IPv6 literals through, so Deep Research can fetch loopback, cloud metadata or the LAN
- `critic-07` [structure, medium, -1185, adjusted] **OP** 1,158 lines of rendered platform_toolsets YAML are committed and read at runtime, and their renderer runs in no script, CI job or test
- `critic-11` [duplication, low, -50, adjusted] The three mock servers repeat the same send, body-reader and port-in-use handler
- `critic-09` [dead-code, low, -26, adjusted] **OP** globals.css declares nine tokens and one class nothing paints, and a test comment and a docs table keep some of them alive
- `critic-13` [consistency, low, -3, confirmed] Rec-room module components need little work: one lint-invisible button, a stale Stop comment and a simulated progress bar
- `critic-12` [doc-drift, low, -2, confirmed] jest.setup.ts warns against restoreAllMocks, but Jest 30 restores only spies, so the 15 suites that call it are safe
- `critic-08` [test-debt, low, 0, adjusted] **OP** The CI install test still sets the pre-rename data-dir alias, so it will be the first thing alias retirement breaks
- `critic-06` [tooling, low, 25, adjusted] check-form-control-names only sees raw lowercase DOM tags, so the unnamed primitives components-03 found pass the lint chain
- ~~`critic-10`~~ refuted: One static runtime import cycle in sessions, and nothing gates cycles. **Why:** The cycle exists, but it is known, documented and benign. session-sync.ts:14-17 records that the repository imports syncHermesSessionsToDb 'only from inside listSessions (a function-level reference), so there's no module-init cycle'. estimateSessionSize is likewise used only inside a function (session-sync.ts:147). Moving it adds a file and a re-export for no behaviour gain. It is also not free: two suites mock estimateSessionSize through session-repository (b11-sessions-route-and-url-defaults.test.ts:20, b11-transcript-payload-cap.test.ts:72), and the route imports it from there. A 60-line cycle gate would currently have nothing to catch.
- ~~`critic-15`~~ refuted: cross-env is a devDependency kept only for cmd.exe, which the Linux-first ruling dropped. **Why:** Harmful. The operator's own development machine is Windows 11: this repository is checked out at C:\Users\Daniel\... and this review ran on win32. On Windows, npm runs scripts through cmd.exe by default whichever terminal calls it, and there is no script-shell override in .npmrc. So `PORT=3000 playwright test` would break test:e2e, census and screenshots on the operator's box. The platform ruling deliberately kept platform.ts and _platform.mjs so `npm run dev` still runs on a Windows box. The finding also misses three references: two contributor docs that document the exact `cross-env PORT=3000` command, and a dependabot pin. One line of package.json saved does not justify the breakage.

### tests · 24 surviving of 24 · net -4804 · 11 need the operator

- `tests-04` [test-debt, low, -3500, adjusted] **OP** A sixth of the unit corpus is comment, mostly batch provenance headers
- `tests-06` [performance, medium, -300, adjusted] 533 per-file jest environment docblocks, and 116 node-only suites running under jsdom
- `tests-05` [tooling, low, -279, adjusted] **OP** 284 eslint-disable lines for require() inside jest.mock, with no tests-scoped override
- `tests-11` [duplication, low, -250, adjusted] Repeated test windows: 65% are two-file pairs that do not pay; about 330 lines justify a helper
- `tests-14` [duplication, medium, -180, adjusted] **OP** Seven e2e specs each visit all 21 documented routes; several overlaps can fold
- `tests-13` [dead-code, medium, -90, adjusted] Three of four exports in api-test-helpers.ts have no users, and knip does not scan tests
- `tests-10` [process, low, -60, adjusted] **OP** 15 oracle suites pin a closed programme's records and fail whenever a record moves
- `tests-02` [tooling, medium, -35, adjusted] **OP** No gate holds the line census baseline; eight jest suites run it against looser numbers instead
- `tests-09` [test-debt, medium, -35, confirmed] **OP** 126 suites assert on source text; three re-run lint rules over the whole src tree
- `tests-01` [test-debt, medium, -20, adjusted] 47 of 53 route suites replace @/lib/api/api-auth wholesale, against the documented rule
- `tests-19` [consistency, medium, -20, adjusted] Two better-sqlite3 stubs, and two ways of reaching the real driver
- `tests-12` [structure, low, -15, confirmed] **OP** Merging suites by subject does not pay: every route group has conflicting mocks
- `tests-22` [duplication, low, -12, adjusted] The old-path redirect table is written out by hand in both a unit suite and an e2e spec
- `tests-24` [duplication, low, -10, adjusted] 5 of the 14 suites that keep an inline @/lib/db mock could use the existing factories
- `tests-15` [test-debt, low, -5, confirmed] Composer flake: a hand-rolled ECONNRESET retry in a file that already polls
- `tests-23` [doc-drift, low, -5, confirmed] Stale numbers and a broken path in the test infrastructure's own comments
- `tests-20` [tooling, low, -3, confirmed] **OP** CI type-checks src twice in each build job
- `tests-03` [tooling, medium, 0, confirmed] Coverage floors sit 13 to 35 points below the last measured coverage
- `tests-07` [naming, medium, 0, confirmed] **OP** 217 unit suites and 3 e2e specs are named after the batch that wrote them
- `tests-16` [test-debt, medium, 0, adjusted] Help deep-link flake: the spec re-presses ? every 2 s into a force-dynamic navigation
- `tests-18` [process, low, 0, confirmed] **OP** Two runtime smokes, the bench-gateway runner and two mock servers run in no CI job, and three comments say otherwise
- `tests-21` [performance, low, 0, confirmed] The slowest unit suite spends 14 s flushing 451 fake poll ticks
- `tests-08` [structure, medium, 5, confirmed] **OP** 684 unit suites in one directory: a domain layout, and what the move costs
- `tests-17` [performance, medium, 10, adjusted] About 98 s of unconditional sleeps in the default e2e run

### tooling · 30 surviving of 33 · net -1781 · 19 need the operator

- `tooling-04` [security, medium, 0, adjusted] **OP** Node 20, pinned throughout CI, Docker and engines, is past end-of-life
- `tooling-29` [security, medium, 3, adjusted] gitleaks skips the entire tests/ tree
- `tooling-05` [security, low, 9, confirmed] .dockerignore lets the local database, auth token and generated output into the build context
- `tooling-02` [dead-code, low, -368, confirmed] **OP** Benchmark-gateway harness has targeted deleted routes since the benchmark subsystem was removed
- `tooling-07` [performance, medium, -300, adjusted] Jest defaults every suite to jsdom, so 375 suites carry a node docblock and 119 more run under jsdom they do not use
- `tooling-08` [consistency, low, -265, adjusted] **OP** 116 eslint-disable lines in tests exist only because no-require-imports has no tests override
- `tooling-12` [dead-code, low, -235, adjusted] **OP** One-off maintenance scripts that have served their purpose or carry machine-specific paths
- `tooling-10` [duplication, medium, -218, confirmed] **OP** Five hardware scripts ship as both .sh and .mjs, plus forwarding ch-* shims for the .sh copies
- `tooling-03` [dead-code, low, -169, confirmed] **OP** setup.mjs, the Node twin of setup.sh, lost its only caller when install.ps1 became a stub
- `tooling-11` [dead-code, medium, -150, adjusted] **OP** The pre-rename compatibility layer (ch-*, CH_*, CONTROL_HUB_*, control-hub) persists in scripts and root config
- `tooling-13` [complexity, high, -150, adjusted] **OP** prebuild still runs the legacy partial migration applier, swallowing errors, before every build
- `tooling-09` [duplication, low, -72, confirmed] Five identical loadEnvLocal functions across scripts/tooling TypeScript entry points
- `tooling-17` [consistency, low, -25, confirmed] **OP** pnpm configuration beside an npm lockfile makes every npm command warn
- `tooling-24` [dead-code, medium, -20, adjusted] **OP** install.ps1 and Windows-only branches remain after the Linux-first decision
- `tooling-20` [duplication, low, -17, adjusted] **OP** CI workflow repeats setup blocks and runs prebuild twice back-to-back
- `tooling-15` [performance, medium, -8, adjusted] **OP** src is type-checked three times per gate, and tsconfig.json reads stale .next type stubs
- `tooling-31` [process, low, -7, adjusted] **OP** build-test-macos repeats the full Ubuntu gate for a platform ruled dev-tier
- `tooling-18` [doc-drift, low, -4, adjusted] About 20 references in tooling files point at paths C7 moved or that were deleted
- `tooling-23` [naming, medium, -3, adjusted] **OP** npm script names overlap and some have no users
- `tooling-16` [tooling, low, -2, confirmed] **OP** knip is green partly because its config hides test-harness orphans, a dead devDependency and unlisted dependencies
- `tooling-28` [tooling, low, -1, confirmed] **OP** eslint config justifies globally disabled rules with a component that no longer exists, and lints generated output
- `tooling-21` [process, low, 0, confirmed] Coverage floors are enforced only in CI, not in the gate as practised
- `tooling-30` [process, low, 0, adjusted] **OP** Nothing enforces protection of main: the pre-push hook is opt-in and branch protection requires zero checks
- `tooling-32` [test-debt, low, 0, confirmed] Unit suites pin tooling text, so every tooling refactor edits tests
- `tooling-33` [duplication, low, 0, confirmed] Two-consumer duplicates in scripts do not pay for a shared interface: leave them
- `tooling-25` [structure, low, 2, confirmed] **OP** Of three compose files, one is exercised in CI, one only in docs, one is dead
- `tooling-14` [type-safety, low, 3, confirmed] TypeScript in scripts/ is type-checked by no tsconfig
- `tooling-19` [tooling, low, 6, confirmed] check-doc-links walks docs/ only, so root and folder markdown drifts unchecked
- `tooling-22` [tooling, medium, 10, adjusted] The shrink-only census does not see tooling, and scripts carry 23% comment lines
- `tooling-01` [process, medium, 200, confirmed] **OP** No in-repo command runs the whole gate by exit code; the practiced gate lives in a handover note and scratch scripts
- ~~`tooling-06`~~ refuted: design-lint.baseline.json is a 907-line growth log for a gate that reads zero. **Why:** The proposal edits an append-only ledger, which governance forbids. T-0025, the record that created the mechanism, calls it 'an append-only __growth__ log' and says the reason is written into the baseline file beside the number it excuses. design-lint.mjs describes it as the log 'of every growth ever allowed through'. Compacting past entries rewrites that record. The saving also moves no measure, because line-census counts only .ts/.tsx/.css/.mjs files. The only legitimate variant is a mechanism change so that future entries stop writing per-file 'grew' arrays, which removes nothing now.
- ~~`tooling-26`~~ refuted: Test and harness tooling is spread across six root-level locations. **Why:** The move saves zero lines and moves no measure, and it carries a governance cost. docker/ is a sensitive path pattern in org/policy.json. Moving docker/TestHarness.dockerfile under test-harness/ silently drops it below the R2 tier floor unless the protected policy.json is amended by ADR. It also rewrites paths across knip.json, package.json, two compose files, the Python install harness and docs, just to go from 43 root entries to 39. The runbook figure is also inflated: 6 tracked files reference ops/runbooks/deploy.md, not 13 docs.
- ~~`tooling-27`~~ refuted: data/ mixes tracked seed content with the runtime database that prebuild writes. **Why:** The finding is pointless for its cost. It saves about 2 .gitignore lines but moves a runtime-read path through src (catalog-seed.ts), user-facing copy (restore page), the output canary's seed walk (likely needing a re-bless), docs extraction, the seed-pack generator, the sensitive Dockerfile and docs, and the five-spellings rule applies to every one. The operator's local backup clutter is not a repo change.

### lib-data · 26 surviving of 27 · net -1456 · 9 need the operator

- `lib-data-01` [structure, medium, -400, adjusted] **OP** Fold 13 stanza-plus-statements wrappers into the SQL_MIGRATIONS driver
- `lib-data-05` [dead-code, medium, -375, adjusted] **OP** The baseline-rebuild path in upgrade.ts cannot trigger for any database either chain wrote
- `lib-data-20` [duplication, medium, -190, adjusted] **OP** prebuild runs a hand-copied .mjs twin of the v2-to-v3 parity migration
- `lib-data-02` [duplication, medium, -100, adjusted] One rebuild step for 035 and 037, and the 037 error message that names 035
- `lib-data-12` [naming, low, -60, confirmed] triggerSyncOnce debounces a call that is already idempotent, and never runs a sync
- `lib-data-11` [duplication, low, -50, confirmed] **OP** Sync sources parse .env twice with different rules and restate a repository type
- `lib-data-19` [structure, low, -45, adjusted] Mission categories are the only seed kept as SQL: run by two paths and counted by string split
- `lib-data-04` [duplication, low, -40, adjusted] tableExists / columnExists / addColumnIfMissing defined eleven times in src
- `lib-data-23` [structure, low, -40, adjusted] A mission-categories health check lives in the connection module
- `lib-data-03` [duplication, low, -30, adjusted] Schema-version read spelled three times in src and seven more outside it; baseline version 3 declared five times
- `lib-data-13` [duplication, low, -30, confirmed] **OP** Stored run usage JSON is parsed in six places with three different totals
- `lib-data-09` [dead-code, low, -27, confirmed] **OP** sync_registry is written by one sync source and read by nobody
- `lib-data-06` [complexity, medium, -26, confirmed] **OP** runMigrations returns after the baseline, so getDb and db:migrate both loop to converge
- `lib-data-07` [doc-drift, low, -15, adjusted] Migration docs and wrapper comments describe a chain that no longer exists
- `lib-data-14` [duplication, low, -14, confirmed] safeRead is defined three times and days() twice
- `lib-data-15` [consistency, low, -10, confirmed] parse-json helpers exist but 12 inline JSON.parse calls remain, four of them unguarded in one row mapper
- `lib-data-17` [consistency, low, -6, adjusted] Transaction, timestamp and column-list styles are mixed across 34 repositories
- `lib-data-27` [complexity, low, -6, confirmed] The v3 parity step runs every migration file against a database below v3
- `lib-data-24` [dead-code, low, -4, confirmed] session-sync.ts carries an empty branch and a voided result
- `lib-data-26` [structure, low, -3, adjusted] src/lib/schema/index.ts is a barrel for one symbol
- `lib-data-16` [structure, low, 0, adjusted] mission-category-repository reads and rewrites template JSON files on disk
- `lib-data-18` [duplication, low, 0, adjusted] Two-consumer look-alikes that should stay separate
- `lib-data-21` [test-debt, low, 0, adjusted] Twelve schema-version constants exist only for tests and restate the table
- `lib-data-25` [structure, low, 0, confirmed] Page-only helpers sit in the server sessions domain
- `lib-data-10` [performance, low, 3, confirmed] **OP** LogSync re-inserts the same error lines every minute, and the dashboard counts the copies
- `lib-data-08` [dead-code, low, 12, adjusted] **OP** Three benchmark tables are created on every install and read by nothing
- ~~`lib-data-22`~~ refuted: The baseline test fixture re-spells migration steps one column at a time. **Why:** The fixture's minimal surface and its v3 pin are deliberate, and the file says why. No step list exists as data for a migrateTo helper to walk, and running runMigrations would create every table and move the version. The -35 is not demonstrated.

### components · 33 surviving of 33 · net -1000 · 7 need the operator

- `components-02` [duplication, medium, -110, adjusted] **OP** Two custom dropdowns: field-kit Select duplicates Picker and is the less accessible one
- `components-10` [duplication, medium, -90, adjusted] Three more two-click delete buttons beside ConfirmButton, one with armed state owned by the page
- `components-15` [dead-code, low, -90, adjusted] TemplateCard's full-card branch is dead, and template icons are registered twice
- `components-08` [duplication, medium, -85, adjusted] Two surface primitives: dashboard/Panel duplicates Card's chrome for 25 importers
- `components-05` [duplication, low, -72, confirmed] Modal and Sheet are thin renames of Dialog, which is the survivor
- `components-06` [duplication, medium, -60, adjusted] MissionCreateForm and TemplateEditorModal repeat the working-directories and references editors
- `components-16` [dead-code, low, -60, confirmed] **OP** SchedulePicker's compact mode and mode prop have no production caller
- `components-07` [duplication, low, -55, confirmed] Skills row handler bundle passed through four files: 88 of the census's repeated src window lines
- `components-11` [structure, medium, -45, adjusted] **OP** ui/Input.tsx holds six controls beside ui/field/Input.tsx; its labelled wrappers re-implement Field without the label link
- `components-17` [complexity, medium, -45, adjusted] MissionCreateForm carries pure dispatch logic; TemplateEditorModal takes 44 props where the form takes formState plus one setter
- `components-03` [accessibility, low, -40, adjusted] 28 labels point at nothing; ModelEditor re-implements Field without the label link; 8 AutoTextareas are named by placeholder
- `components-14` [dead-code, low, -40, confirmed] Dead accent props, an all-empty focus map, and three lint pragmas whose stated reasons are false
- `components-21` [duplication, low, -40, confirmed] Hindsight modals use raw inputs and their own chrome; the tabs' row buttons are raw
- `components-12` [duplication, low, -38, confirmed] **OP** Three switches: the field-kit pill Toggle has one consumer and looks unlike InlineToggle
- `components-19` [complexity, low, -30, confirmed] MissionsList unpacks 35 view-model fields and re-derives state; MissionEditorPanel is a read-only detail panel that skips the read contract
- `components-30` [duplication, medium, -25, confirmed] **OP** Two markdown renderers: SimpleMarkdown (JSX) for skills and renderMarkdown (HTML string) for chat
- `components-31` [consistency, low, -25, adjusted] **OP** Models screens hand-roll a radio group, row icon buttons and seven credential buttons outside the primitives
- `components-04` [accessibility, medium, -15, adjusted] Hand-rolled menus and expand/collapse toggles skip what useDismissable, Picker and CollapsibleSection already do
- `components-13` [duplication, low, -15, adjusted] Two native select chromes plus a third raw select in Pagination
- `components-28` [doc-drift, low, -15, confirmed] Comments cite files, components and line numbers that no longer exist; StatStrip's header names a user that does not use it
- `components-25` [structure, medium, -12, adjusted] 24 non-component modules (1,450 lines) live in src/components, including four data hooks and two barrels
- `components-23` [duplication, low, -10, adjusted] Status dots are drawn nine ways: StatusDot in Card.tsx, LiveDot, and seven inline spans
- `components-22` [consistency, low, -2, adjusted] Three loading primitives with stated roles, but components hand-roll five more and use the spinner for whole lists
- `components-27` [type-safety, low, -1, adjusted] 85 exported names are never imported elsewhere; ModelEditorRecord only renames ModelRow
- `components-01` [tooling, low, 0, adjusted] **OP** The raw-control lint cannot see an opening tag that ends its line; 83 raw controls in components are invisible to it
- `components-09` [structure, low, 0, confirmed] Cross-domain primitives live in components/dashboard, and StatusDot is exported from Card.tsx
- `components-24` [naming, low, 0, adjusted] Two MessageBubble components with different subjects; the session one also exports API types and has unlabelled toggles
- `components-26` [structure, medium, 0, adjusted] src/types/console.ts mixes the API envelope, a design-token type and domain records, and imports lib
- `components-29` [tooling, low, 0, adjusted] The one-importer census counts barrel files as importers; only three of the 103 are wrappers with nothing of their own
- `components-32` [consistency, low, 0, adjusted] Small tidies: hand-written plurals, a dead ternary, a doubled expression, a no-op loading icon
- `components-33` [test-debt, medium, 0, confirmed] 81 test references to component files by source-text path make every move in this dimension a test edit
- `components-18` [complexity, medium, 10, confirmed] WorkflowCanvas mixes an editor state machine, three write sequences and a duplicated node type with rendering
- `components-20` [structure, medium, 10, confirmed] Pure logic and write sequences inside components: AutomationList, Sidebar, ModelEditor, MemoryProviderSettings

### app · 24 surviving of 24 · net -584 · 8 need the operator

- `app-06` [security, medium, -45, confirmed] **OP** Route-level read-only checks guard 17 write sites the proxy has already refused, and skip the other 69
- `app-02` [duplication, medium, -130, adjusted] Missions page forwards 45 renamed props that its hook re-exports one at a time
- `app-01` [dead-code, medium, -74, adjusted] **OP** Seven API routes have no caller, and no gate asks whether a route is called
- `app-08` [dead-code, low, -65, confirmed] Root layout wraps pages in a class error boundary that app/error.tsx already covers
- `app-07` [duplication, low, -60, adjusted] The route context type is declared 23 times
- `app-22` [process, low, -58, adjusted] **OP** Story Weaver's four vendored serif fonts await a keep-or-delete ruling
- `app-05` [consistency, low, -35, confirmed] Seven of the thirteen own-try routes keep a try only for the wording of their log line
- `app-04` [tooling, low, -30, confirmed] **OP** The try-catch census is blind to hand-rolled log-and-500 catches
- `app-10` [dead-code, low, -30, adjusted] toastElement is rendered on 17 pages and is always null inside the app
- `app-11` [duplication, low, -20, adjusted] The schedule refusal checks and sentence are spelled at four call sites
- `app-13` [duplication, low, -18, confirmed] Twelve composer routes repeat the same flag guard and sentence
- `app-19` [doc-drift, low, -15, adjusted] Comments in scope that contradict their code or name the old structure
- `app-16` [complexity, low, -14, confirmed] **OP** instrumentation.ts wraps its optional boot steps in try, but not the steps whose throw skips crash recovery
- `app-12` [consistency, low, -12, adjusted] About 19 of 31 direct NextResponse.json calls are exactly a response factory's shape
- `app-03` [consistency, medium, -10, adjusted] Story Weaver pages make 10 bare fetch calls that neither lint rule can see, and a failed load reads as 'not found'
- `app-17` [structure, medium, -10, adjusted] Five route files hold domain logic that the thin-router routes keep in src/lib
- `app-20` [duplication, medium, -6, adjusted] Fast-mode chat builds its own gateway fetch beside the shared client
- `app-18` [consistency, low, -5, adjusted] **OP** Request bodies are parsed and validated three different ways
- `app-21` [naming, low, -3, confirmed] **OP** Legacy CH_ environment aliases survive the rename in next.config.ts and one route
- `app-23` [performance, low, 0, confirmed] Every page is already dynamic; keep the two force-dynamic exports as guards
- `app-24` [duplication, low, 0, adjusted] 405 stubs: leave as they are
- `app-15` [process, low, 1, adjusted] **OP** 52 old-URL redirects kept 'for one release' are waiting on a release that has not shipped
- `app-09` [consistency, low, 5, adjusted] Loading, error and not-found are each drawn several ways
- `app-14` [structure, medium, 50, adjusted] The largest pages keep state and handlers inline where a page hook would hold them

### hooks · 25 surviving of 25 · net -523 · 8 need the operator

- `hooks-07` [duplication, medium, -170, adjusted] The missions and models composition roots re-list 197 lines of fields their slices already return
- `hooks-08` [duplication, high, -100, adjusted] Two hooks hold the same 14-field mission draft in 41 useState calls and six hand-written setter sequences
- `hooks-01` [structure, medium, -90, adjusted] **OP** The missions board reads four endpoints by hand, beside the cache that already holds three of them
- `hooks-06` [dead-code, medium, -45, adjusted] useToast's single-slot fallback and toastElement are dead in the product and exist only for tests
- `hooks-15` [dead-code, low, -35, adjusted] **OP** theme.ts carries a focus-colour map of empty strings, an identity copy and two aliases
- `hooks-19` [structure, low, -22, adjusted] **OP** Small lib/api tidies: a split body parser, a one-line wrapper, and one route's field special-cased in the shared client fetch
- `hooks-09` [complexity, medium, -20, adjusted] The deploy footer polls a cached endpoint with its own setInterval and posts with bare fetch
- `hooks-17` [duplication, low, -20, adjusted] useRunProgress keeps its own list of run-event names beside the chat client's, and the two lists already disagree
- `hooks-25` [dead-code, low, -16, confirmed] **OP** useStoredBool still carries the ch.* to ps.* storage-key migration for its one page
- `hooks-12` [type-safety, low, -15, adjusted] Model reads redeclare types the library already derives
- `hooks-13` [duplication, low, -12, adjusted] The showToast function type is declared 16 times
- `hooks-03` [consistency, medium, -10, adjusted] **OP** Two sanctioned ways to write: runWrite at 57 sites and useMutation at 7, and runWrite can absorb the seven
- `hooks-18` [duplication, low, -6, confirmed] Sidebar re-implements useOperatorPrefs' preference write
- `hooks-16` [doc-drift, low, -5, confirmed] Hook and API headers name deleted helpers, moved routes and stale counts
- `hooks-11` [doc-drift, low, -2, adjusted] FeedbackProvider says it defers to an outer QueryClient but does not, and the app's query client sits in a file named for toasts
- `hooks-14` [type-safety, low, -2, confirmed] The composer writes out the dispatch-mode union twice and casts a template's mode without the guard written for it
- `hooks-02` [accessibility, low, 0, confirmed] **OP** A failing board read raises a new persistent alert toast every 15 seconds
- `hooks-20` [structure, low, 0, adjusted] src/lib/ui holds server code: list-bounds has no UI importer and most of dispatch-mode's importers are server-side
- `hooks-22` [consistency, low, 0, adjusted] Small seams around useApiResource: conditional option spreads, a renamed option, and a caller reading the hook's internal select shape
- `hooks-23` [naming, low, 0, adjusted] **OP** src/hooks holds three modules that are not hooks, and a missions read lives in the schedules file
- `hooks-24` [naming, low, 0, confirmed] useIsMobile is a general media-query hook with a device-specific name
- `hooks-21` [performance, low, 4, adjusted] useTwoStepConfirm returns a new object and a new isArmedFor on every render, so its callers' callbacks rebuild every render
- `hooks-04` [tooling, low, 8, adjusted] The write rule reads 0 while 18 client writes bypass both sanctioned ways
- `hooks-10` [performance, low, 10, adjusted] **OP** Every observer runs its own poll timer, and three list polls run with nothing live
- `hooks-05` [tooling, low, 25, adjusted] Hooks that read by hand inside effects are invisible to all three read gates

### docs · 22 surviving of 22 · net -436 · 13 need the operator

- `docs-03` [doc-drift, low, -150, adjusted] **OP** CHANGELOG Unreleased reads as an engineering diary, contradicts itself and has a wrong schema version
- `docs-08` [dead-code, medium, -120, adjusted] **OP** Seven of nine generated-block extractors fence nothing while the same facts are hand-typed
- `docs-21` [complexity, low, -80, adjusted] Docs tooling keeps batch-history comments that C5 cut elsewhere, and docs are not in the line census
- `docs-10` [duplication, low, -50, confirmed] runtime-architecture.md is two merged pages that say four sections twice, with stale claims
- `docs-11` [duplication, medium, -50, adjusted] **OP** Docs tooling re-implements the docs walk five times and page parsing three times
- `docs-12` [dead-code, low, -30, confirmed] **OP** The docs build writes a file and keeps a function nothing needs, and its refusal-code list is incomplete
- `docs-17` [structure, low, -22, adjusted] **OP** SUPPORT.md and start-here/getting-help.md are two start-here pages for one question
- `docs-06` [doc-drift, low, -15, confirmed] **OP** CONTRIBUTING.md miscounts the gates, documents a route group that is gone and contradicts testing.md
- `docs-16` [duplication, low, -15, adjusted] **OP** README repeats the install page and the start-here index
- `docs-22` [structure, low, -12, adjusted] **OP** branding/assets holds only a README describing assets to come
- `docs-05` [doc-drift, low, -10, adjusted] **OP** Repository guide describes the tree before C1 and C7
- `docs-07` [doc-drift, low, -2, confirmed] Missions guide says Schedules both are and are not on the page
- `docs-04` [process, medium, 0, confirmed] **OP** 26 redirects are promised for 'this release only', and no task tracks removing them
- `docs-13` [doc-drift, low, 0, confirmed] The tour promises a picture of every screen and shows six
- `docs-14` [naming, low, 0, confirmed] 61 link texts still name retired UPPERCASE filenames
- `docs-15` [doc-drift, low, 0, adjusted] Retired product vocabulary survives in running and reference pages
- `docs-18` [process, low, 0, adjusted] **OP** Each screenshot recapture adds about 3 MB to history, and nothing notices when shots go stale
- `docs-19` [consistency, low, 0, adjusted] **OP** Front matter carries EOS keys on some pages only, and 10 page H1s differ from their titles
- `docs-02` [doc-drift, low, 4, adjusted] **OP** Root documents are outside the link gate, and C7 broke three of their links
- `docs-01` [tooling, low, 6, confirmed] Six doc links resolve only on a case-insensitive filesystem
- `docs-20` [accessibility, low, 20, adjusted] Built docs site has two h1 elements per page and unannounced search results
- `docs-09` [tooling, medium, 90, adjusted] Docs gates cannot see prose claims, and the docs index overstates what docs:check refuses

### cross-cutting · 24 surviving of 24 · net -720 · 12 need the operator

- `cross-cutting-06` [tooling, low, -280, adjusted] **OP** 285 require-import lint directives in tests could be one eslint override
- `cross-cutting-04` [dead-code, high, -200, adjusted] **OP** Legacy CH_/CONTROL_HUB_ alias surface has no retirement date
- `cross-cutting-17` [type-safety, medium, -100, adjusted] Type escape hatches grouped by cause; test fetch doubles bypass the existing typed helpers
- `cross-cutting-08` [duplication, medium, -90, adjusted] **OP** Five identical .env.local loaders in scripts disagree with the mjs and shell loaders on precedence and quotes
- `cross-cutting-15` [dead-code, low, -68, adjusted] src/lib/utils.ts has a dead export, a near-duplicate JSON parser and a stale header
- `cross-cutting-07` [duplication, low, -18, adjusted] **OP** The only feature flag is never off in shipped config and is guarded by 12 copied blocks
- `cross-cutting-13` [duplication, low, -16, adjusted] Ten byte-size spellings and four compact-number copies with two rounding rules
- `cross-cutting-12` [duplication, low, -15, adjusted] Seven duration and relative-time formatters with three elapsed formats and a name collision
- `cross-cutting-14` [duplication, low, -10, adjusted] **OP** Three hand-written markdown renderers and three escapeHtml copies with two escape sets feed 7 innerHTML sinks
- `cross-cutting-19` [duplication, low, -9, confirmed] Mission category seed SQL is duplicated verbatim inside a TypeScript string
- `cross-cutting-22` [tooling, low, -6, confirmed] **OP** Dependency and knip hygiene: misplaced @types, unused ts-jest hidden by a knip ignore, phantom ignores, redundant Next option
- `cross-cutting-20` [duplication, low, -4, confirmed] Hermes home resolved by three src readers with unreachable fallbacks, and eight times in scripts
- `cross-cutting-16` [consistency, low, 0, adjusted] **OP** Inline spellings bypass existing helpers for error messages, plurals, ids, sleep and JSON parsing
- `cross-cutting-18` [structure, medium, 0, adjusted] Domain types live in UI component files and are imported upward into lib and hooks
- `cross-cutting-23` [naming, low, 0, adjusted] **OP** Naming drift visible only across folders: batch-named tests, non-hooks in hooks, mixed file casing, legacy ch. data keys
- `cross-cutting-24` [consistency, low, 0, adjusted] **OP** Timestamp display mixes locale-dependent and fixed-UTC formatting
- `cross-cutting-09` [tooling, low, 2, adjusted] TypeScript sources under scripts/ are type-checked by no gate; tsconfig excludes a file that does not exist
- `cross-cutting-21` [consistency, low, 4, adjusted] **OP** Browser storage uses five key-prefix conventions and four hand-rolled accessors beside useStoredBool
- `cross-cutting-01` [consistency, low, 6, confirmed] Boot line prints composer=on while the flag is off for PS_COMPOSER=off or no
- `cross-cutting-02` [consistency, low, 6, adjusted] Runtime status and boot line report a gateway the runtime does not use when only PS_LLM_API is set
- `cross-cutting-10` [consistency, low, 10, adjusted] Errors reach responses in seven ways; 62 raw NextResponse.json error bodies bypass the status-locked factories
- `cross-cutting-11` [consistency, low, 12, adjusted] **OP** Server logging outside API routes is 28 bare console calls under about 15 tag spellings, with silent failure paths
- `cross-cutting-05` [doc-drift, low, 22, adjusted] env-reference.md claims every variable but misses at least 12 that code reads
- `cross-cutting-03` [consistency, medium, 34, adjusted] **OP** Env vars read through six spellings with five boolean vocabularies and no key registry

### org · 17 surviving of 19 · net 14 · 8 need the operator

- `org-11` [dead-code, medium, -259, adjusted] **OP** eos-compile.mjs is a 248-line script that refuses to run, hard-codes a personal path, and is still pinned by a test
- `org-05` [doc-drift, low, -24, adjusted] **OP** HANDOVER.md contradicts itself, repeats the plan's table, and is outside the boot path and over its budget
- `org-08` [doc-drift, low, -6, adjusted] The closed consolidation plan still says C6 to C8 remain and gives two C0 testLines numbers
- `org-15` [test-debt, medium, -5, adjusted] **OP** The C8 suite ties jest to a closed plan's prose, so the next programme must edit a closed record to stay green
- `org-06` [duplication, low, -4, confirmed] Two procedures for landing a batch: the compiled PLAYBOOKS#standard and the practised HANDOVER steps
- `org-01` [process, high, 0, adjusted] **OP** T-0144 edited the protected set (policy.json and two accepted ADRs) under an R2 ruling that names none of it
- `org-07` [doc-drift, low, 0, adjusted] Living org documents name paths that moved on 2026-09-05, including LOCKBOOK's machine-read rulings_record
- `org-12` [process, medium, 0, adjusted] **OP** Live work and questions are stale or unrouted: two active records superseded, an operator wait hidden from STATE, answered questions still open
- `org-16` [structure, low, 0, adjusted] Task record size and key sprawl: 96 of 145 exceed the 40-line template, and 232 of 274 keys are used once
- `org-19` [structure, low, 0, confirmed] Archiving closed plans and reviews by moving them saves no lines and breaks tests and citations
- `org-14` [doc-drift, low, 1, confirmed] The public ADR index omits ADR-0010
- `org-18` [doc-drift, low, 3, confirmed] START.md's Standard boot names a 'generated context packet' that nothing generates
- `org-17` [tooling, low, 8, confirmed] The derived views' header names a command known to regenerate the wrong repo; STATE.md prints None and its commit fact lags
- `org-02` [process, medium, 10, confirmed] **OP** Parallel agent fan-out ran up to ten writers against policy max_lanes 2 with no claims file
- `org-09` [consistency, low, 15, adjusted] Closed plans still read status approved, and three reviews lack front matter
- `org-03` [type-safety, low, 100, confirmed] **OP** Task records break the template's required shape and no in-repo check reads beyond five columns
- `org-04` [tooling, medium, 175, adjusted] **OP** The landing discipline depends on scratchpad scripts and a sibling checkout; nothing in the repo enforces any step
- ~~`org-10`~~ refuted: 524 lines of EOS forms never filled (acceptance spine, product map, genesis) after Genesis-lite was discarded. **Why:** Deleting the five forms breaks the EOS seed contract that the lock-book adopts. They are required seed files at ORG scale, and the blank state is documented as legitimate. The lines are not counted by the line census either.
- ~~`org-13`~~ refuted: policy.json guard.mapping_ref points at org/guard-mapping.json, which does not exist. **Why:** A mapping_ref naming an unshipped file, with validated false, is exactly the shape the EOS sanctions. Nulling it would fail the seed check and the policy schema.

### lib-domains · 19 surviving of 19 · net -356 · 8 need the operator

- `lib-domains-05` [dead-code, low, -155, adjusted] **OP** 15 exports are reached only by tests, which knip cannot see
- `lib-domains-06` [type-safety, low, -60, adjusted] Four shapes are declared twice, outside the three shapes the C2 census watches
- `lib-domains-10` [duplication, low, -55, confirmed] Repetition that pays without any new cross-file interface
- `lib-domains-15` [structure, medium, -40, adjusted] The mission-dispatch compatibility shim has outlived its reason, and run submission is written three times
- `lib-domains-09` [duplication, low, -30, adjusted] Repetition inside the largest files, invisible to the line census
- `lib-domains-18` [duplication, low, -30, adjusted] Repeated blocks inside the hermes and rec-room modules
- `lib-domains-11` [duplication, medium, -25, adjusted] **OP** Small helpers re-implemented across domains (HTML escaping, JSON parsing, env reading, durations)
- `lib-domains-17` [structure, low, -20, adjusted] Thin domains and one-importer files that sit in the wrong place
- `lib-domains-08` [doc-drift, low, -12, confirmed] Comments that are false, or stale since the C7 moves
- `lib-domains-02` [structure, medium, -8, confirmed] **OP** The agent_root repository is in core, but its content and 12 of its 15 importers belong to the hermes module
- `lib-domains-04` [consistency, medium, 0, adjusted] Route-handler code follows four conventions, and several handlers are misfiled
- `lib-domains-14` [naming, medium, 0, adjusted] **OP** Pre-rename env aliases and data paths are still read, two of them inconsistently
- `lib-domains-07` [performance, low, 2, adjusted] A Stop during llm.ts's retry backoff waits out the sleep, up to 60 seconds
- `lib-domains-13` [naming, medium, 2, adjusted] **OP** The vendor name is used for PatterStage's own concepts in core
- `lib-domains-03` [structure, high, 5, adjusted] **OP** The Hermes config.yaml section table (336 lines) lives in core config-schema.ts
- `lib-domains-12` [consistency, low, 8, adjusted] **OP** The chat markdown renderer rewrites fenced code, so Copy copies markup
- `lib-domains-01` [structure, high, 10, adjusted] **OP** Laboratory was named a module in ADR-0005 but still lives in core, and Composer imports it directly
- `lib-domains-16` [complexity, medium, 12, adjusted] The largest files: which to split, and which to leave whole
- `lib-domains-19` [tooling, low, 40, adjusted] The line census and knip have blind spots over this scope
