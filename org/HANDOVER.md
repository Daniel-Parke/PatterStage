---
summary: Where the consolidation programme stands, how a batch is landed, what is open, and how to pick the work up tomorrow
type: venture
tags: [handover, consolidation]
updated: 2026-09-10
---

# Handover · PatterStage, evening of 2026-09-10

This page is the one to read before touching the tree. It says where the
work stands, what was learned landing it, what is still open, and the exact
steps a batch goes through. Everything it names is on disk; nothing lives in
a chat.

## Read in this order

1. `CLAUDE.md` (the never-rules), then `org/START.md` (boot by mode).
2. `org/plans/2026-09-consolidation.md`: the programme, batches C0 to C8,
   the census that referees it, and the corrections each batch wrote into
   its row.
3. The last task record, `org/tasks/T-0142.json`, and `org/TASKS.md` (the
   derived live view) for the rest.
4. `docs/contributing/testing.md` ("Shared test doubles") and
   `docs/contributing/repo-guide.md` (the read and write rules) for the
   conventions the last batches introduced.

## Where the programme stands

`dev` is pushed and green. Every batch below has a task record, an oracle
committed red first, a gate by exit code, a mutation sweep against the
committed tree, and a chore commit carrying the record and the derived views.

| Batch | Record | What it did | Landed |
| --- | --- | --- | --- |
| C0 the line census | T-0135 | `npm run census:lines`, twelve measures, shrink-only | yes |
| C1 one route body | T-0136 | `route()` wrapper over 115 handlers; 13 routes keep their own catch with a reason | yes |
| C2 one type each | T-0137 | MissionDraftFields, ModelIdentity/ModelRow/ApiModel, syncSuccess/syncFailure | yes |
| C3 one way to write | T-0138 | `runWrite` in `src/lib/api-write.ts`; four helpers and toastFromResult deleted; Story Weaver reads on `useApiResource`; census reads by AST; lint rule `no-raw-write-outside-the-helper` | yes |
| (fix) Models page keeps its body | T-0139 | a reload no longer swaps the page for a spinner; found by C3's walk | yes |
| (fix) custom fallback identity | T-0140 | migration 042 (head is 42): a custom fallback keeps its typed name, provider, model id | yes |
| C4 the test harnesses | T-0141 | fifteen factories in `tests/helpers`; 130 suites adopted by six agents with per-file identity; census counts dbSingletonMock as a factory | yes |
| C5 comments that narrate | T-0142 | narration cut file by file (two passes, ten agents); code proved unchanged by a stripped-code diff | yes |
| C6 the page layer | T-0143 | next: folds, card chromes onto `Card`, raw controls onto primitives, palette and z | no |
| C7 the lib root | T-0144 | 71 root files into domains, by script | no |
| C8 closing | T-0145 | the census after beside the before; the plan marked done | no |

The plan's remaining ids moved by two for the fixes taken in between; the
plan header says so.

## The census, now against the plan's targets

| Measure | Plan start | Now | Target |
| --- | --- | --- | --- |
| src lines | 107,123 | 100,962 | ≤ 98,000 |
| tests lines | 121,651 | 120,624 | ≤ 116,000 |
| src lines in a repeated window | 1,416 | 1,176 | ≤ 600 |
| tests lines in a repeated window | 6,028 | 4,637 | ≤ 2,500 |
| routes with their own try/catch | 82 | 13 | ≤ 13 (met, corrected at C1) |
| hand-rolled reads (by AST since C3) | 5 (regex) | 11 (honest 13, two converted) | 0 (moves to C6) |
| named hooks writing on their own | 4 | 0 | 0 (met) |
| repeated type shapes | 23 | 2 | 3 (met) |
| one-importer components | 130 | 130 | ≤ 95 (C6) |
| lib root files | 71 | 71 | ≤ 12 (C7) |
| comment essays | 107 | 8 | ≤ 60 |
| suites mocking db inline | 100 | 14 | ≤ 20 (met) |
| design-lint debt (all rules) | 350 | 369 (19 are the new write rule's baseline) | falls in C6 |
| jest | 6,860 | 6,880 (679 suites) | unchanged by a test batch |

## How a batch is landed (the discipline, verbatim from practice)

1. Write the oracle suite first, run it red, commit it red:
   `test: the CN oracle, red at X of Y, T-01xx`.
2. Implement. Patch scripts go through the Write tool, never a bash heredoc
   (heredocs on this box strip a backslash level; a `\b` became a backspace
   byte once).
3. Walk anything visual on the isolated instance:
   `PS_AUTH_TOKEN=u14walk PS_DATA_DIR=<a scratch dir> CH_DATA_DIR=<the same dir> PORT=3939 nohup npx next start -p 3939`
   (any empty directory outside the repo; the instance seeds it),
   visit `/?ps_token=u14walk` first, drive it with a Playwright script, stop
   the port. `npm run build` first if src changed.
4. The gate, by exit code, on the finished tree, with nothing edited while
   it runs (it stamps the tree before and after): kill ports
   3000/3477/3577/3939/8642, `rm -rf .next/dev`, then in order
   `npm run lint`, `npx tsc --noEmit`, `npx jest`, `npm run lint:knip`,
   `npm run canary:check`, `npm run build`, `npm run test:e2e`,
   `npm run census`, `npm run census:lines`. Read exit codes, never grep for
   "error". A Playwright spec that fails only under the gate's load is
   re-run alone into `e2e2.log` and both are written into the record.
5. `git add -A` and the feat commit, with the gate's numbers in the message.
6. The mutation sweep against the COMMITTED tree (`sweep.py mutants.json`,
   anchors exact, mutants built with json.dump). A survivor gets the test
   it asks for as its own commit, then the mutant is re-run and killed.
7. The record: `org/tasks/T-01xx.json` (intent, tier and reasons, claims,
   invariants, commits, verification with the numbers, mutation, deviation),
   then `taskops.render_views(...)` from PatterTech_EOS,
   `node scripts/tooling/check-derived-views.mjs`,
   `node scripts/docs/build-site.mjs --manifest-only`, the chore commit,
   `git push origin dev`.
8. The line census: `--update-baseline` after a fall; a rise only with
   `--allow-growth "<reason>"`, and the reason is what the file keeps. The
   design-lint baseline works the same way. The output canary is
   re-blessed (`npm run canary:bless`) only for an intended change such as
   a new migration file, in the same commit.

Agents: a batch that touches many files in the same way is split into
disjoint file groups, one background agent each, with a written brief the
agent reads from disk; each agent runs its files before and after, proves
identity (test names through jest's JSON reporter, or the stripped-code
diff for a comment batch), and reports a table. The coordinator runs the
identity oracle, the census and the gate over the whole tree afterwards.

## Open items (none blocking)

- **C6, C7, C8** remain; C6's survey is done (below).
- **Eleven effect reads** are held on the census by name (`--report`,
  `reads.files`): profiles, skills, skills/[...path], tools, settings/restore,
  useChatConversations, useGatewayHealth, useMissionComposer,
  useModelsRegistry, useSettingsEditor, useVersionFooter. C6 takes them onto
  `useApiResource` with the page layer.
- **The same body-swap-on-reload** T-0139 fixed on Models is on
  `agent/settings/restore` and `agent/skills` (they swap their body for a
  spinner on every reload). C6.
- **Rows added as custom fallbacks before migration 042** read "Custom";
  their identity was never stored and cannot be recovered. The CHANGELOG
  says to add them again.
- **An eslint policy call** for the operator: every one-line factory
  adoption in tests pays an `eslint-disable-next-line
  @typescript-eslint/no-require-imports` for the hoisting-safe `require`
  inside `jest.mock`. A tests-scoped override of that rule would free about
  a hundred such lines. Not done, because it is a lint-policy change.
- **Two e2e specs flake only under the gate's load**: the composer spec's
  read after a save (now retries once on ECONNRESET, T-0139) and the help
  deep-link `?` shortcut on Missions (a two-second navigation window).
  Both pass alone every time; the record of each gate says so.
- **T-0140's fallback rows** on the isolated instance's data dir are walk
  artefacts, not product data.

## C6 · what the survey found (start here tomorrow)

- 29 one-importer components under sixty lines, each with its one importer
  (the census `--report` lists all 130 with line counts). Fold where the
  fold reads better; `index.ts` re-exports (field/Input, field/Toggle,
  achievements/*) are not folds. Lines, component, importer:

  | Lines | Component | Its one importer |
  | ---: | --- | --- |
  | 18 | components/skills/SkillsDenylistNote | app/agent/skills/page |
  | 22 | components/memory/hindsight/HealthBanner | components/memory/MemoryProviderSettings |
  | 27 | components/ui/field/Input | components/ui/field/index (re-export) |
  | 31 | components/achievements/StreakFlame | components/achievements/index (re-export) |
  | 34 | components/chat/ReasoningPanel | components/chat/MessageBubble |
  | 35 | components/models/ModelsTaskDefaultsSection | app/agent/models/page |
  | 36 | components/scripts/ScriptLogsModal | app/work/scripts/page |
  | 36 | components/skills/SkillsCatalogEmpty | app/agent/skills/page |
  | 37 | components/providers/QueryProvider | app/layout |
  | 39 | components/chat/TypingIndicator | app/work/chat/page |
  | 39 | components/layout/MobileHeader | app/layout |
  | 42 | components/ui/field/Toggle | components/ui/field/index (re-export) |
  | 43 | components/chat/ApprovalPrompt | app/work/chat/page |
  | 43 | components/chat/ToolCallList | components/chat/MessageBubble |
  | 43 | components/missions/MissionLiveProgress | components/missions/MissionEditorPanel |
  | 45 | components/profiles/ProfilesDriftBanner | components/agents/AgentProfilesOverview |
  | 46 | components/help/HelpFragment | app/help/[[...slug]]/page |
  | 46 | components/models/ModelInsights | app/agent/models/page |
  | 46 | components/scripts/ScriptTemplateGallery | app/work/scripts/page |
  | 47 | components/quests/QuestBadge | components/layout/Sidebar |
  | 49 | components/composer/ComposerClarifyPrompt | app/work/composer/page |
  | 49 | components/help/HelpPrevNext | app/help/[[...slug]]/page |
  | 51 | components/chat/ChatModeToggle | app/work/chat/page |
  | 52 | components/agents/DeleteProfileModal | app/agent/profiles/page |
  | 52 | components/missions/ToolsetsPicker | components/missions/MissionCreateForm |
  | 55 | components/models/FieldRow | components/models/ModelEditor |
  | 56 | components/quests/QuestTracker | components/providers/FeedbackProvider |
  | 57 | components/config/SettingsSubject | app/agent/settings/page |
  | 59 | components/achievements/AgentLevelBadge | components/achievements/index (re-export) |

  (`components/motion/index.tsx` is not on the list: it has two importers,
  the insights page and AchievementShowcase.)
- design-lint debt by rule: `no-inline-card-chrome` 221 in 86 files (top:
  WorkflowCanvas 11, MissionCreateForm 11, CategoryManagerModal 10,
  FallbackChainList 8); `palette-must-be-house` 74 in 33; `z-scale-only` 20
  in 15 (`z-[9999]` in CategoryCombobox, `z-[55]` in Sidebar, `z-[90]` in
  layout); `no-raw-control-outside-ui` 23 in 15 (raw selects in
  CategoryManagerModal, ModelPicker, CustomScheduleBuilder; raw textareas in
  chat, AgentFileEditor, ScriptEditorModal); `no-raw-border-alpha` 12 in 9.
- `Card` already takes `as`, `variant` (panel/raised), `padding`, `glow`,
  `id` and `data-testid`; the z scale has seven named layers as utilities
  (`z-base` … `z-tooltip`); the primitives are in `src/components/ui/`.
- The design census counts to ratchet: distinctCardChromes 63,
  distinctButtonChromes 56, distinctBorderColours 28,
  controlBordersBelowThree 102, decorativeBordersBelowThree 691. Re-measure
  with `npm run census` after the walk; re-cut with `UPDATE_CENSUS=1 npm run census`.
- Suites that name component file paths and would break on a fold:
  `record-surface-containers`, `b2-overlays-are-dialogs`,
  `b16-help-link-on-every-header`, `bloom-field`, `c3-one-way-to-write`,
  `dashboard-helpers-unit` (grep `tests/unit` for `src/components/`).

## Release

The v1.0.0 tag waits on the operator after the programmes; the release
actions (the migration script on a copy of a real install, the Docker
matrix, the tag) are in `docs/running/migration.md`'s release checklist and
`org/plans/2026-09-final-release.md`. Nothing here changes that order.
