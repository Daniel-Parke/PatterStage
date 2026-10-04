---
summary: T-0192 client error inventory, finite source evidence and explicit limits
type: review
tags: [refactor, evidence]
---

# T-0192 client error inventory

Independent source review recorded on 2026-10-04. This report is evidence, not programme acceptance.

The source inventory is now complete for the defined client cohort. **No files changed and no tests, builds or servers ran.** The existing `useSettingsEditor` and `useModelActions` rows remain included.

Observed snapshot: `31fa54413427e2bde5351f7e17ce48bd1710e1c8` plus the current candidate changes. HEAD advanced during inspection, but all **324 UI files remained byte-identical** between extraction and the final check.

| Measure | Observed |
|---|---:|
| UI files scanned | 324 |
| Additional shared message/validation helpers inspected | 14 |
| TypeScript parse diagnostics across those 338 files | 0 |
| Initial AST candidate nodes | 442 |
| Explicitly excluded candidate nodes | 86 |
| Retained candidate nodes | 356 |
| Distinct retained primary `file:line` locations | 317 |
| Additional locations found by lexical search and tracing | 189 |
| **Complete evidence index** | **506 locations across 126 files** |
| Repeated message spellings/expressions identified | 33 groups |

These are **source evidence locations**, not 506 different messages or failures. A producer, state assignment and renderer can describe the same event.

The 338-file fingerprint is SHA-256 of sorted `path:SHA256(raw bytes)` entries joined with LF:

```text
40a31e6990022f9b2bccd0ce33c7b596b0b6eb607c419637b9554184e6a7326e
```

**Classification and exclusions**

| Category | Included behaviour |
|---|---|
| Read failure | Initial/refetch/list/detail failure, missing expected payload, invalid link and status-specific headings. |
| Write failure | Transport/envelope refusal, thrown validation, mutation failure and retained local error state. |
| Partial result | Successful primary operation with failed sync, missing credentials, incomplete bulk work or missing followable run ID. |
| Validation/precondition | Required fields, graph validity, schedule validity, token requirement and dispatch blockers. |
| Availability | Gateway/auth/model/provider/configuration/host restrictions. These are not automatically failed operations. |
| Stream/run | Authoritative `run.failed`/`run.error`, `stream.error`, fast-chat failure and separately described transport disconnection. |
| Recorded failure | Existing run/chapter/platform/profile/log errors displayed from data. The upstream message universe is not enumerated. |
| Boundary/deploy | React error boundaries, update/check/start failures, polling timeout and failed deploy status. |
| Presentation plumbing | Toasts, last-result text, banners, error props, tooltips and persistent summaries. These do not create additional failure events. |

All 442 initial nodes have a disposition:

- **38 resets:** 37 literal null/empty resets, plus `useSettingsEditor.ts:228`.
- **21 decorative icons:** `AlertTriangle`, `AlertCircle`, `ShieldAlert`. Their surrounding messages remain inventoried.
- **17 positive-only `successMessage` expressions:** profiles:436; restore:216; system:105; Skills:251; logs:102; Composer:247; SessionManager:40; HindsightCrud:100; HindsightDirectives:63; MissionDispatch:182,227; MissionTemplateActions:102; ModelActions:205,222,303; ModelFallbackChain:77; VersionFooter:226.
- **4 progress-only toasts:** MissionDispatch:161,176,219,281.
- **6 cancellation-control throws:** Story reader:195,306,351,355,395,399. These are `AbortError` control flow, not error copy.
- **356 retained nodes:** 128 fallback properties; 33 feedback calls; 11 mixed/partial-result expressions; 33 error-state assignments; 25 throws/rethrows; 126 render/prop/alert nodes.

Additional lexical exclusions were imports, types, enum/status discriminators, CSS classes, identifiers, comments, log-severity regular expressions, script-template bodies, ordinary help text, positive progress, empty-state guidance and destructive-action confirmations. In particular, **“Tool denied” is successful completion of the operator’s denial**, not a failed approval request.

Scope excludes server implementations and their arbitrary response strings, generated Help/Markdown content, user/provider/script output, browser-native validation text and server-generated authentication HTML. Client sites that display those values are included.

**Complete location index**

The following is a rooted, machine-readable location map:

```text
root = C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/

F = read/write fallback property
T = feedback call
S = semantic or partial-result feedback
E = error-state assignment
H = client throw/rethrow
B = banner, error prop or alert plumbing
+category = supplementary source/search classification
```

```text
app/agent/models/page.tsx | B:259
app/agent/profiles/page.tsx | F:114,276,294,337,437 T:322 B:515 +write:200,210,218,226,234
app/agent/settings/page.tsx | B:184,185,194 +availability:196
app/agent/settings/restore/page.tsx | F:125,132,139,177,217 S:176 E:182,194,223 B:236,263,264 +recorded:380
app/agent/settings/system/page.tsx | F:66,70,106 T:82,93 B:126,186 +availability:179
app/agent/skills/[...path]/page.tsx | F:66 +read:71,85
app/agent/skills/page.tsx | F:108,198,252,294 T:280,319 B:351 +read:318
app/agent/tools/page.tsx | F:119,191,216 T:177 B:310,321,326,329,338
app/error.tsx | +boundary:30,33
app/help/[[...slug]]/page.tsx | B:95
app/layout.tsx | B:150
app/page.tsx | F:116,152 B:306,312,349,350,417,418 +availability:268,270
app/quests/page.tsx | B:100,101,111
app/recroom/story-weaver/[id]/page.tsx | H:50,196,307,352,396 F:131 E:202,219,309,320,364,408,437,449 B:518,527,562,563
app/recroom/story-weaver/create/page.tsx | F:148,153,316,374,408,433 S:373 H:489,492 E:500 B:544,545,612,655 +write:376,392,421
app/recroom/story-weaver/page.tsx | F:52,67 B:119
app/results/artifacts/page.tsx | F:82 B:110
app/results/insights/page.tsx | B:173,174
app/results/logs/page.tsx | F:104 B:247,248 +read:243
app/results/sessions/[id]/page.tsx | B:131,254,255
app/results/sessions/page.tsx | B:231,232 +read:234
app/work/chat/page.tsx | B:325,327,354,355
app/work/composer/page.tsx | S:220 F:224,248,261,279 B:294,297,381,435 +recorded:459
app/work/missions/page.tsx | B:126,128
app/work/research/page.tsx | S:141 F:145,170,185 B:205,208 +recorded:363
app/work/scripts/page.tsx | E:165 T:166,181,239,247,254,394 F:193,218,287 B:325 +read:267

components/agents/AgentProfilesOverview.tsx | +recorded:46
components/agents/AgentProfilesTable.tsx | +recorded:73,78
components/agents/AgentSetupNotice.tsx | +availability:49,51
components/auth/SessionManager.tsx | F:41,64,77 H:43 +validation:51
components/automation/AutomationList.tsx | E:139,145,157 B:204,205 +write:169,276,389,413
components/chat/ChatModelSelector.tsx | +availability:61
components/chat/GatewayBanner.tsx | +availability:74,88,90,108,110,119,120
components/chat/MessageBubble.tsx | B:121 +recorded:124,125,141
components/composer/ComposerNodeRunDetail.tsx | F:90 +recorded:178,180
components/composer/ComposerRunForm.tsx | +availability:169
components/composer/WorkflowCanvas.tsx | B:142 F:336,371,412 +validation:169,322,399,489
components/config/ConfigYamlErrorAlert.tsx | B:35 +availability:38
components/config/SettingsSection.tsx | B:139,156 +validation:63
components/dashboard/ErrorsPanel.tsx | +recorded:67,68
components/dashboard/ProgressLine.tsx | B:49,51
components/dashboard/SubsystemsPanel.tsx | B:78
components/memory/hindsight/health-message.ts | +availability:37,40,43,46,48
components/memory/hindsight/useHindsightCrudTab.ts | F:58,101,119,135
components/memory/hindsight/useHindsightDirectives.ts | F:64
components/memory/hindsight/useHindsightMemories.ts | F:36,40,125 T:90,108 +availability:51
components/memory/hindsight/useHindsightModels.ts | F:57
components/memory/HindsightBrowser.tsx | B:156 +read:69,70
components/memory/MemoryProviderSettings.tsx | S:155,195 F:161,202 B:240 +partial:138,159,199
components/missions/CategoryManagerModal.tsx | B:134
components/missions/DirectoryPickerModal.tsx | F:41 B:99
components/missions/MissionCreateForm.tsx | B:580 +validation:330,338
components/missions/MissionEditorPanel.tsx | F:63 B:68,125 +recorded:338,422
components/missions/MissionsList.tsx | B:264
components/missions/ModelPicker.tsx | +availability:85,90
components/models/FallbackConfigPanel.tsx | +write:151,152
components/models/ModelEditor.tsx | E:183,189 H:220,234 F:251 B:283 +validation:99,100,105
components/profiles/drift-banner-headline.ts | +partial:25,27
components/providers/FeedbackProvider.tsx | +plumbing:161
components/quests/QuestRow.tsx | +availability:147
components/schedule/RunProgress.tsx | +stream:30
components/schedule/SchedulePicker.tsx | E:213 +validation:396
components/scripts/ScheduleScriptModal.tsx | E:53,58 H:92 F:96 B:126
components/scripts/ScriptEditorModal.tsx | B:108
components/scripts/ScriptRow.tsx | +recorded:53
components/session/SessionCard.tsx | +recorded:81
components/spend/SpendPanel.tsx | E:80 +validation:241,253,319
components/system/DeployControls.tsx | +deploy:79,112
components/ui/ErrorBoundary.tsx | +boundary:30,44,47
components/ui/LoadErrorBanner.tsx | B:56
components/ui/Toast.tsx | T:209 +plumbing:177

hooks/useAgentRunStream.ts | +stream:91,102,139
hooks/useAnalytics.ts | F:19,32,45
hooks/useApiResource.ts | H:91,111,134
hooks/useChatConversations.ts | F:75 T:137,168,201
hooks/useChatSend.ts | E:131 T:167,181,333 +stream:205,252
hooks/useConfig.ts | F:20
hooks/useCopyToClipboard.ts | T:78
hooks/useDashboard.ts | F:86,104
hooks/useEventStream.ts | E:50 +stream:43
hooks/useGatewayHealth.ts | F:89,112,124,128 +availability:149
hooks/useLogs.ts | F:19
hooks/useMissionCategories.ts | T:43 F:58,74,91 +read:46
hooks/useMissionComposer.ts | F:237,244,360,365 +validation:303
hooks/useMissionDispatch.ts | T:134,142,195,284 F:165,183,209,228,260,298
hooks/useMissionsData.ts | T:144,241,248 H:181 E:252,262,290,317,320
hooks/useMissionTemplateActions.ts | F:103,240
hooks/useModelActions.ts | S:93,173,244,275 F:97,145,193,209,224,250,289,308,323,348 T:340 +partial:95,106,178,181,183,186,189,282,283,284
hooks/useModelFallbackChain.ts | F:66,78,90,109,120,132,144
hooks/useModelFallbackConfig.ts | E:72 T:125 S:133 F:139
hooks/useModels.ts | F:22
hooks/useModelsRegistry.ts | F:47,51,55 +read:37
hooks/useOperatorPrefs.ts | F:44
hooks/usePreferenceWrite.ts | H:14
hooks/useRunProgress.ts | +stream:97,125
hooks/useSchedules.ts | F:33,101 H:44,52,63,73
hooks/useScripts.ts | F:69 H:100
hooks/useSessionDetail.ts | F:27
hooks/useSettingsEditor.ts | F:119,123,250 H:246 T:272 E:272
hooks/useSpend.ts | F:33,53 H:49 +write:26,58
hooks/useStats.ts | F:14
hooks/useVersionFooter.ts | F:155,227 H:242,246 +deploy:189,198,338,369

lib/api/api-fetch.ts | +transport:41,89,93,121,128,132,137,185,190,218,233
lib/api/api-write.ts | +transport:92,94,120,131,147,151,156
lib/chat/chat-utils.ts | +stream:107,109,270,449,450,455,462
lib/composer/canvas-graph.ts | +validation:178,179,181,184,185,188,200
lib/config/config-schema.ts | +validation:562,569,577,585,595,603
lib/deploy/deploy-action-fallback.ts | +deploy:39
lib/memory/memory-error-copy.ts | +availability:31,33,62
lib/missions/mission-submit-requirement.ts | +validation:11,31,34
lib/schedule/interval-bounds.ts | +validation:68,74
lib/schedule/schedule-problem.ts | +validation:12,14
lib/seed/describe-restore-result.ts | +partial:106
lib/sessions/session-load-error.ts | +read:14,16,18,20,22
lib/spend/spend-law.ts | +validation:176,177,187
lib/ui/dispatch-mode.ts | +plumbing:61

modules/hermes/components/PlatformsPanel.tsx | +recorded:112
modules/rec-room/components/ChapterReader.tsx | +recorded:77
modules/rec-room/components/CharacterEditorDialog.tsx | E:130 B:154
modules/rec-room/components/CharacterLibraryPanel.tsx | B:63
modules/rec-room/components/LibraryPanel.tsx | B:67
modules/rec-room/components/ReaderBanners.tsx | B:31,58 +recorded:39,61,62
modules/rec-room/components/ReaderPlaceholders.tsx | +read:26,27
modules/rec-room/components/StoryReaderOverlays.tsx | +plumbing:130
modules/rec-room/components/ThemeEditorDialog.tsx | E:77 B:101
modules/rec-room/components/ThemeLibraryPanel.tsx | B:50
```

**Duplicate disposition**

All **33 repeated spellings/expressions** below are legitimate contextual reuse or repeated fallback layers. This inventory does **not** justify changing their wording or extracting another abstraction merely to remove repetition.

| Repeated copy/expression | Exact sites, using the root above |
|---|---|
| `Push failed` | profiles page:200,210; tools page:216; useModelActions:348 |
| `Import failed` | profiles page:218; Skills page:198; useModelFallbackChain:144 |
| `Pull failed` | profiles page:226; tools page:216; useModelActions:323 |
| `The read failed` | restore page:125,132,139 |
| `Restore failed` | restore page:177,182,194,217,223 |
| `Unknown error` | skill-detail page:66; Story create:500; session-detail page:131 |
| `Something went wrong` | app/error:30; ErrorBoundary:44 |
| `Sync failed` | app/page:116; useModelFallbackConfig:139 |
| `Failed to cancel mission` | app/page:152; useMissionDispatch:298 |
| `Could not save that character` | Story create:316,421 |
| `Story write could not be confirmed` | Story reader:50,196,307,352,396 |
| `Delete failed` | logs page:104; WorkflowCanvas:371; useModelActions:145,193; useModelFallbackChain:90 |
| `Could not start that run` | Composer page:224; Research page:145 |
| `Live updates: ${liveError}` | Composer page:297; Research page:208 |
| `Failed to start the run` | AutomationList:169; useSchedules:73 |
| `Failed to update the schedule` | AutomationList:389; useSchedules:63 |
| `Failed to delete the schedule` | AutomationList:413; useSchedules:52 |
| `Save failed` | WorkflowCanvas:336; MemoryProviderSettings:196,202; ModelEditor:251; useSettingsEditor:250,272 |
| `Connection test failed` | MemoryProviderSettings:138,161 |
| `Failed to schedule` | ScheduleScriptModal:92,96 |
| `Failed to load` | useApiResource:91,111,134 |
| `Failed to start a new conversation` | useChatConversations:137; useChatSend:181 |
| `Failed to load conversation` | useChatSend:131; chat-utils:107 |
| `Failed to load the model registry` | useGatewayHealth:124; useMissionComposer:365 |
| `Gateway models unavailable` | useGatewayHealth:128,149 |
| `Failed to load log` | useLogs:19; useScripts:100 |
| `Failed to update mission` | useMissionDispatch:165,183 |
| `Failed to load missions` | useMissionsData:262; useSchedules:101 |
| `${label} failed` | useModelActions:95,97,106 |
| `Add failed` | useModelFallbackChain:120,132 |
| `run failed` | useRunProgress:97; chat-utils:270 |
| `Could not read the file` | useSettingsEditor:119,123 |
| `Request failed` | api-fetch:185,190; api-write:147,151,156; chat-utils:449 |

The shared `REGISTRY_ERROR` constant additionally feeds three read sites at `useModelsRegistry.ts:47,51,55`; that is already consolidated, not three repeated literal definitions. Hindsight’s CRUD templates likewise deliberately serve directives and mental models.

Different wording is also justified where the trigger differs:

- Story creation, generation, retry, edit, continuation and read-status persistence are separate actions.
- A disconnected event stream does not establish a failed run.
- “Saved” with failed YAML synchronisation is a partial result, not a transport failure.
- Missing provider, unsupported provider client, Redis refusal and unreachable configured provider are distinct conditions.
- Session 400/404/413/429/default failures require different headings.

**Reproduction**

This stdout-only PowerShell/Node extraction reproduces the **324-file, 442-node primary census**. The supplementary search and exact traced locations are recorded above.

```powershell
Set-Location 'C:/Users/Daniel/Documents/Coding/Github/PatterStage'
$node = 'C:/Users/Daniel/Documents/Coding/Github/PatterStage/tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe'
$code = @'
const fs = require("fs"), path = require("path"), ts = require("typescript");
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e =>
  e.isDirectory() ? walk(path.join(d,e.name)) :
  /\.tsx?$/.test(e.name) ? [path.join(d,e.name).replaceAll("\\","/")] : []);
const scope = walk("src").filter(f =>
  f.startsWith("src/hooks/") || f.startsWith("src/components/") ||
  (/^src\/app\//.test(f) && !f.startsWith("src/app/api/") && /\.tsx$/.test(f)) ||
  /^src\/modules\/.*\/(components|hooks|pages)\//.test(f) ||
  /^\s*["']use client["'];/m.test(fs.readFileSync(f,"utf8")));
const rows = [];
let diagnostics = 0;
for (const file of scope) {
  const sf = ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
  diagnostics += sf.parseDiagnostics.length;
  const add = (n,kind,expression,extra="") => rows.push({
    file, line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,
    kind, expression, extra
  });
  function visit(n) {
    if (ts.isCallExpression(n)) {
      const callee=n.expression.getText(sf), name=callee.split(".").at(-1), a=n.arguments;
      if (/^(showToast|toastError|setErrorFromCaught|toast)$/.test(name) ||
          /^toast\.(error|warning|info)$/.test(callee)) {
        const ix=name==="toastError" || name==="setErrorFromCaught" ? 2 : 0;
        if (!(name==="showToast" && a[1]?.getText(sf)==='"success"'))
          add(n,"feedback-call",a[ix]?.getText(sf)||"",callee);
      } else if (/^set\w*Error(s)?$/.test(name)) {
        const x=a[0]?.getText(sf)||"";
        add(n,/^(null|undefined|""|'')$/.test(x)?"clear-state":"error-state",x,callee);
      }
    }
    if (ts.isPropertyAssignment(n)) {
      const key=n.name.getText(sf).replace(/['"]/g,"");
      if (key==="errorMessage") add(n,"read-write-fallback",n.initializer.getText(sf));
      if (key==="successMessage" && !ts.isStringLiteral(n.initializer) &&
          !ts.isTemplateExpression(n.initializer) &&
          n.initializer.kind!==ts.SyntaxKind.NullKeyword)
        add(n,"semantic-feedback",n.initializer.getText(sf));
    }
    if (ts.isJsxAttribute(n)) {
      const key=n.name.getText(sf), x=n.initializer?.getText(sf)||"";
      if (key==="role" && x==='"alert"')
        add(n.parent.parent,"alert-render",n.parent.parent.parent?.getText(sf)||"");
      if (/^(error|errorMessage|errors)$/.test(key))
        add(n,"error-prop",x,n.parent.parent.tagName?.getText(sf)||"");
    }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const name=n.tagName.getText(sf);
      if (/(Error|Problem|Warning|Alert)/.test(name))
        add(n,"named-render",n.getText(sf),name);
    }
    if (ts.isThrowStatement(n))
      add(n,"client-throw",n.expression?.getText(sf)||"");
    ts.forEachChild(n,visit);
  }
  visit(sf);
}
process.stdout.write(JSON.stringify({
  files:scope.length, diagnostics, candidates:rows.length, scope, rows
},null,2));
'@
& $node -e $code

rg -n 'setMessage|setLogText|setSkillContent|messageFromError|failWith|onError|generationError|syncError|saveError|modelsError|blockerToShow|verdict\.message' `
  src/app src/hooks src/components src/modules `
  -g '*.ts' -g '*.tsx' -g '!src/app/api/**'

rg -n 'failed|error|could not|couldn.t|unable|unavailable|unreachable|invalid|required|no response|no reason|disconnected|timed out|not installed' `
  src/app src/hooks src/components src/modules `
  -g '*.ts' -g '*.tsx' -g '!src/app/api/**'
```

**Remaining qualifications and individual observations**

There are **no unclassified extracted candidates**. Three specific observations should remain visible without silently expanding T0192:

1. [ModelPicker:85](../../src/components/missions/ModelPicker.tsx#L85) checks `empty` before displaying `error`. With an empty model list and a read error, its placeholder chooses the empty/default explanation. This is a source-observed precedence issue; no runtime defect was reproduced here.
2. [Restore result:106](../../src/lib/seed/describe-restore-result.ts#L106) can describe “restored, but could not push” through the success-result channel. It must remain classified as a **partial consequence**, even though its toast type is not error.
3. [Fast chat:249](../../src/hooks/useChatSend.ts#L249) uses received content to choose completion; an accumulated stream error is only selected when content is empty. This inventory records that policy without claiming runtime verification or authorising a change.

This supplies the finite source inventory and duplicate disposition required by 087.a. Recording it and independent review remain coordinator actions after the freeze. It does not claim browser reachability, accessibility announcements or runtime failure coverage.

