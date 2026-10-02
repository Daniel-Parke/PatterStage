# T-0190 independent oracle brief

Independent REVIEWER scope PASS, Schrodinger, before freeze:

- Add `returning to a conversation does not reactivate its obsolete work`:
  A to B to A, then release old A work. Assert visible state, not a counter
  mechanism. Comparing only conversation IDs is insufficient.
- M7 must preserve a newer unrelated field on the affected mission as well as
  an unrelated row. Whole-row rollback can lose the former.
- Give blank-conversation reuse and clicked-row export explicit historical
  witness names or named new positive controls in the freeze inventory.
- Q1 freezes controlled timer/latency/focus observations, not incidental wall
  time or an assumed single timer. It does not authorise stats-hook changes.
- The current exact claims/opening text governs the older design copied below.
  C1/C2 have coordinator runtime proof; other races await independent evidence.
  Neither conditional historical seam is authorised for amendment now.
  Provider-wrapper amendments retain one stable query client across rerenders.

Author: Carver. Adopt ORACLE charter. Ruled R2; source implementation has not
started. Use the explicit thirteen test claims in org/claims.json. The six
historical amendments are provider-wrapper changes only, independently authored
before implementation; preserve every original name, assertion, fixture and
action sequence. No production, baseline, protected, record or runner edits.
Use tests/helpers/render-with-query.tsx without changing it. Other historical
seams remain unchanged unless independently justified and claimed first.

Write the six unit suites and one browser suite below. Prefer real composed
hooks/pages with controlled network/EventSource/timer boundaries. Do not mock
the ownership hooks or enforce an implementation mechanism. Observe red causes
from actual source, retaining green controls and infrastructure failures.
No artificial source-text oracle for reversible comment/type/map cleanup.

Owned validation checkout: tmp/t0190-oracle-validation, created by coordinator
after this brief commits. It has a node_modules junction: never install/rebuild
dependencies through it. Pinned node is the repository's private Node24.21.0.
Use own data/home/Hermes/temp; never operator data/env. Unit execution first;
coordinate production browser baseline with coordinator. No paid/external run.
Never change production source or build concurrently with another owned gate.

Before amendments, capture original test-name sets/hashes and run the six
historical suites unchanged. Freeze original and amended results independently.
At completion report all expanded names, exact hashes, actual passes, intended
behavioural reds, infrastructure failures and unexecuted cases separately.
Full test-program typing and scoped lint must pass. A comment or example is not
runtime evidence. Ask coordinator for a missing exact claim, not the operator.

The coordinator reproduced C1/C2 on the production page at both widths:
tmp/t0190-chat-browser-preflight-20261002.md. Those probes are supporting
evidence, not your independent acceptance. Keep positive current-generation,
blank-conversation reuse and clicked-row export controls.

Malformed template dispatch: retain last valid mode, expose validation feedback
and never dispatch the malformed value. Preserve independent drafts and explicit
dispatch acknowledgement. Retain both runWrite and useMutation. Hindsight read
errors may use scoped feedback; no global no-toast rule is implied.
The retained valid mode may be submitted after an explicit valid, acknowledged
user action. Do not invent a persistent invalid-form state or prohibit every
POST after rejecting one malformed template value. Prove the submitted payload.

The following independently prepared design is the contract inventory. Its
proposed paths now have the claims above; all48 ownership items still need final
dispositions. Claims review: tmp/t0190-claims-and-controls-20261002.md. No source
deletion or legacy-key retirement is authorised.

Propose **six unit suites and one browser suite**, plus narrowly scoped independent amendments to existing oracle seams. This covers all **21 findings, 5 dispositions and 22 coverage items** without duplicating T-0191 components or T-0192 prop restructuring.

Reviewed against HEAD `01040a43`, the [saved readiness review](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tmp/t0190-full-readiness-review-20261002.md), [approved plan](C:/Users/Daniel/Documents/Coding/Github/PatterStage/org/plans/2026-09-refactor-programme.json:415) and [ownership register](C:/Users/Daniel/Documents/Coding/Github/PatterStage/org/plans/2026-09-refactor-ownership.json:906). **No writes or tests performed.** The race findings remain source-supported, not runtime-proven.

**Exact proposed oracle claims**

These are proposed file claims, not files created or ownership already granted.

| Ref | Exact path |
|---|---|
| C | `C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/chat-response-ownership.test.tsx` |
| M | `C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/mission-query-ownership.test.tsx` |
| S | `C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/story-client-boundaries.test.tsx` |
| H | `C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/hindsight-query-feedback.test.tsx` |
| P | `C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/preference-write-contract.test.tsx` |
| Q | `C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/client-query-observers.test.tsx` |
| B | `C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/e2e/client-read-ownership.spec.ts` |

Reserve two **conditional, independent amendment claims**:

- [mission-old-link-boundary.tsx](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/helpers/mission-old-link-boundary.tsx): currently mocks `useMissionsApi`. If that adapter disappears, change the seam while retaining the existing suites’ names, fixtures and behavioural assertions.
- [load-hindsight-list.test.ts](C:/Users/Daniel/Documents/Coding/Github/PatterStage/tests/unit/load-hindsight-list.test.ts:320): only if its helper contract changes. Its no-toast assertion does **not** prohibit an in-place banner. The comment claiming `safeApiCall` already displays errors is incorrect. Preserve the historical witness; do not let an implementer rewrite it to obtain green.

Keep transport fakes local to these suites initially. No runner, script, baseline or production files belong to the oracle writer’s claim.

**Test names and contracts**

Use the following names literally. Parameterised cases must include their case label in the expanded test name.

C must render the real `useChatPage` composition. Defer network responses and stream events, rather than mocking the ownership hooks or manually incrementing their generation counters.

| ID | Exact test name | Contract |
|---|---|---|
| C1 | `New Chat completion cannot replace a later selected conversation` | Start delayed creation, select B, release creation. B remains selected with its transcript and draft. Do not require the server-created conversation to disappear. |
| C2 | `New Chat completion preserves text typed after creation began` | Delay creation, type a fresh draft, resolve. The newer text survives even without a conversation switch. |
| C3 | `send preflight creation cannot clear a newer conversation draft` | Send without an active conversation, delay creation, select B and type, resolve. No stale selection, draft clearing or send into B. |
| C4 | `late send failure cannot change the current conversation state` | Delay A’s send response, select B, reject A. B’s transcript, draft, approval and streaming state remain unchanged. This is not, alone, proof of draft-loss prevention. |
| C5 | `queued agent events cannot change state after conversation selection` | After switching away from A, deliver queued delta, approval and terminal events from A’s closed source. None becomes current state. |
| C6 | `an obsolete terminal event cannot close the current stream` | Start B’s stream, deliver A’s terminal event, then a valid B event. B still receives it and retains its own pending state. |
| C7 | `late fast-stream output cannot change the selected conversation` | Deliver a queued chunk and completion after abort and selection change. They cannot overwrite B or clear B’s state. |
| C8 | `stream recovery cannot replace a conversation selected before recovery starts` | Trigger stream failure, switch before the 1,500 ms recovery timer. No obsolete reconciliation becomes visible. |
| C9 | `stream recovery cannot replace a conversation selected while recovery is pending` | Let recovery fetch begin, switch, then resolve A’s fetch. B remains intact. |
| C10 | `late Stop reconciliation cannot replace the selected conversation` | Delay Stop/reconciliation, switch to B, release A. No stale transcript or selection. |
| C11 | `late approval completion cannot clear a newer approval` | Hold A’s approval write, establish B’s approval through its stream, release A. B’s approval remains. |
| C12 | `current generation completion still reconciles its own conversation` | Positive control: normal send, completion, approval and reconciliation still work. |

These distinguish the missing invalidation around [closeStream](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/hooks/useChatTranscript.ts:39), delayed [New Chat creation](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/hooks/useChatConversations.ts:106), and checks surrounding asynchronous boundaries. A fake that refuses to deliver anything after `close()` would conceal the queued-event cases.

M must exercise actual query keys and cache invalidation with one shared `QueryClient`.

| ID | Exact test name | Contract |
|---|---|---|
| M1 | `late detail cannot replace the newly selected mission` | Request A, select/request B, resolve B then A. B’s detail and loading/error state remain authoritative. |
| M2 | `late detail cannot reopen a collapsed or deleted mission [case]` | Separate collapse and successful-deletion cases. Releasing old detail cannot restore the panel or row. |
| M3 | `obsolete list failure cannot replace a newer successful list` | Reach overlapping requests through real polling/invalidation/retry behaviour. Older rejection cannot install an error over newer success. Do not bypass legitimate cache coalescing to manufacture overlap. |
| M4 | `mission read failures remain visible without repeated read toasts [resource]` | List, templates, categories and selected detail: repeated failures retain scoped feedback; recovery clears it; no repeated assertive toast. |
| M5 | `a mission read retry refreshes only the relevant error state [resource]` | Retry each failed resource. Successful siblings remain usable, and unrelated detail cannot satisfy the retry. |
| M6 | `board writes refresh dashboard template and category readers [write]` | Mount both consumers. Successful template/category writes invalidate matching shared keys and expose the server’s new values. |
| M7 | `failed cancellation rolls back its optimistic change without losing unrelated updates` | Show the optimistic cancellation, update an unrelated row, reject cancellation. Restore the affected state without replacing the newer unrelated state. |
| M8 | `injected category reads remain effective after cache migration` | Preserve the existing injected-fetcher seam and its failure behaviour. |
| M9 | `template editing preserves the independent composer draft and acknowledgement` | Exercise actual editor/composer actions, including acknowledgement effects. Do not merge drafts to simplify the fixture. |
| M10 | `template dispatch modes preserve valid values and reject invalid values [mode]` | Cover each canonical mode and malformed input. No invalid value reaches dispatch. Freeze the precise invalid-template UI outcome before implementation. |

Retain all three old-link unit suites and their browser witness. Their historical assertions remain part of M’s acceptance, rather than being rewritten as weaker new cases.

S must mount the real Story pages. Inject storage failure only for `story-weaver-draft` and only at the intended operation.

| ID | Exact test name | Contract |
|---|---|---|
| S1 | `denied draft detection leaves Story creation usable` | Mount-time `getItem` throws. Fields and creation remain usable. |
| S2 | `failed draft autosave preserves the current form` | `setItem` throws after editing. Current values remain usable; no render failure. |
| S3 | `denied Load Draft preserves the current form` | Mount succeeds; arm `getItem` failure immediately before Load Draft. Existing edits survive. |
| S4 | `failed draft cleanup does not turn successful creation into failure` | Server returns a valid story ID; `removeItem` throws. Success proceeds to that story without a false creation error or duplicate creation. |
| S5 | `available draft storage preserves the existing key and round trip` | Positive control for `story-weaver-draft`, saved fields and loading. Retain malformed-JSON handling. |
| S6 | `Story reads preserve request identity and truthful failures [operation]` | Load and spend remain reads despite using POST; story identity participates in caching. Failed load is visible; unknown spend is not presented as zero. |
| S7 | `Story writes preserve explicit intent and failure semantics [operation]` | Seven cases: title sync, generate, retry, edit, continue, read-status, create. Preserve payloads, abort signals, pending state, confirmation and creation-ID validation; retain nonfatal title-sync behaviour. No automatic provider work from query retries. |

Keep the existing Story Stop/concurrent-call, write-latch, reader-error, explicit-write and create/library/model suites unchanged. The four storage calls are independently reachable at [create page lines 189, 207, 211 and 489](C:/Users/Daniel/Documents/Coding/Github/PatterStage/src/app/recroom/story-weaver/create/page.tsx:189).

| ID | Exact Hindsight test name | Contract |
|---|---|---|
| H1 | `active Hindsight reads expose failure instead of successful emptiness [tab, failure]` | Memories, models and directives; HTTP failure, rejected transport and application error envelope. Visible failure must differ from a successful empty result. |
| H2 | `Hindsight retry clears the error only after a successful read [tab]` | Successful retry displays returned data; inactive tabs do not start unnecessary reads. |
| H3 | `Hindsight CRUD preserves drafts and updates readers only after success [operation]` | Create/save/delete: failed writes preserve relevant state and visible errors; success reloads or updates the correct collection. |
| H4 | `memory queries preserve health total count and stale filtering` | Cover initial list, health fallback, recall and existing stale filtering. |
| H5 | `reflection runs only after explicit operator intent` | Mount, focus, invalidation and retry cannot automatically invoke reflection. |
| H6 | `model refresh preserves the busy model identity and failure` | Only the targeted model is busy; success refreshes its reader; failure remains visible. |
| H7 | `directive activation preserves tags priority and failed-write state` | Keep parsing/payload semantics and refresh only after successful writes. |

Recommend scoped error feedback with Retry for H1/H2. Preserve existing write feedback. The mission banner-only ruling must not silently become a global prohibition on Hindsight toasts.

| ID | Exact preference/query test name | Contract |
|---|---|---|
| P1 | `preference success refreshes every observer of the shared preference key` | Multiple observers receive the server map after a successful write, including array values. |
| P2 | `preference failure exposes pending and error without pretending persistence` | Hold, reject, then successfully retry a write. Assert pending/error transitions and retained server truth. |
| P3 | `Sidebar preference failure preserves its local choice without a toast` | Both offline and read-only refusal retain the local collapsed state and quiet failure behaviour. |
| P4 | `Sidebar uses its server initial value without adding a preference read` | Sharing write ownership must not introduce a Sidebar GET or initial-state flash. |
| Q1 | `staggered stats observers preserve the frozen request timeline` | Independently measure mount A at 0 s, mount B at 5 s, blur at 19 s, focus at 21 s, continue through 45 s. Record request starts/settlements using current 20 s polling and 10 s stale time, then freeze the observed trace. |

Q1 is a **measurement requirement**, not an invented request-count expectation or a promised performance improvement. Use one real query client; nesting `FeedbackProvider` around another client would test different cache ownership.

B needs four journey names, each at **1440×900 and 390×844**:

- `New Chat preserves a newer selection and typed draft`
- `mission polling failures remain visible and recover in place`
- `Hindsight distinguishes failed reads from an empty bank`
- `Story controls preserve page-owned writes and successful creation when storage is denied`

Use controlled responses with the actual page UI. Assert rendered state, accessible feedback and resulting requests. Preserve existing preference, old-link, security and Story journeys where they already provide equivalent evidence.

**Complete 48-item disposition map**

“I” means implement with the named evidence. “R” means retain and preserve existing evidence. “D” means defer explicitly. Static-only changes do not need artificial behavioural tests.

| Finding | Disposition and oracle requirement |
|---|---|
| `hooks-07` | **D:** T-0192 owns `app-02` prop restructuring; no product decision needed. |
| `hooks-08` | **R:** M9 and existing independent-draft regression. |
| `hooks-01` | **I:** M1–M8, retained old-link suites, B mission journey. |
| `hooks-06` | **R:** existing standalone/provider toast tests; retain fallback. |
| `hooks-15` | **I:** existing focus/token tests plus B keyboard checks; remove empty behaviour, retain tokens/mirror. |
| `hooks-09` | **R:** footer cadence, attempt cap, deadline and restart tests; write conversion under `hooks-04`. |
| `hooks-17` | **D:** event-list unification; C tests protect chat semantics without authorising a common event union. |
| `hooks-25` | **D:** retain legacy-key migration through the ruled retirement boundary. |
| `hooks-12` | **I:** canonical defaults typing, existing schema tests and typecheck; no server imports into clients. |
| `hooks-13` | **I:** canonical toast signature; typecheck narrower callers and retain toast behaviour. |
| `hooks-18` | **I:** P1–P4. |
| `hooks-16` | **I:** comment corrections, reviewed diff only. |
| `hooks-11` | **I/R:** correct comment; retain provider ownership, not an unproved nesting redesign. |
| `hooks-14` | **I:** M10, canonical dispatch tests and typecheck. |
| `hooks-02` | **I:** M4/M5/B; remove read toasts after scoped error surfaces exist. |
| `hooks-20` | **R:** retain `list-bounds` placement; existing contract checks. |
| `hooks-22` | **R:** conditional options/refetch-envelope behaviour; existing resource tests. |
| `hooks-24` | **R:** arbitrary media-query support; no naming migration. |
| `hooks-21` | **R:** confirmation timer/unmount behaviour; no unmeasured memoisation work. |
| `hooks-04` | **I:** C/S and existing footer/deadline tests; retain both sanctioned write paths and detector. |
| `hooks-05` | **I:** M/H/S plus later existing census checks; recorded baseline is not fresh execution evidence. |

| Operator disposition | Requirement |
|---|---|
| `hooks-01` | **I:** shared cache, invalidation, optimistic updates and template/detail feedback together. |
| `hooks-15a` | **I:** delete empty maps, including SearchInput’s local map; preserve rendered focus behaviour. |
| `hooks-25` | **D:** retire with aliases under Q-033, not T-0190. |
| `hooks-02` | **I:** banner-only mission read failures, M4/M5/B. |
| `cross-cutting-21a` | **I:** S1–S5; four independent guards, unchanged key. |

| Coverage item | Requirement |
|---|---|
| `gap-064.1` | **I proof:** M4/M5/B repeated failures and recovery. |
| `gap-064.2` | **I proof:** M6 cross-consumer invalidation. |
| `gap-064.3` | **I measurement:** Q1; no assumed duplicate-request saving. |
| `gap-065.1` | **D experiment/R fallback:** no claimed count of suites broken by removal. |
| `gap-066.1` | **I proof:** H1–H3 shared CRUD migration. |
| `gap-066.2` | **I proof:** H1–H5 memories, health, recall and explicit reflection. |
| `gap-066.3` | **I proof:** H1–H3/H6 models and refresh. |
| `gap-066.4` | **I proof:** H1–H3/H7 directives and activation. |
| `gap-067.1` | **R/D:** M9 editor draft boundary; reshape in T-0192. |
| `gap-067.2` | **R:** M9/M10 acknowledgement, grouped form state and schedule-error behaviour. |
| `gap-067.3` | **I:** M1–M5 required detail/template error plumbing only. |
| `gap-067.4` | **D:** prop-saving measurement belongs to T-0192. |
| `gap-068.1` | **R:** existing API-auth tests; preserve current HMAC semantics and host/deploy guards. |
| `gap-068.2` | **R:** existing token tests; environment precedence, fresh reads, permissions and comparison. |
| `gap-068.3` | **R:** throttle tests; shared rotated-identity budget, monotonic timing and 15 s cap. |
| `gap-068.4` | **R + proof:** existing proxy/read-only/held-response suites; preserve refusal distinctions and narrow exceptions. |
| `gap-068.5` | **R:** strict schemas, seed alias and 400/details tests. |
| `gap-068.6` | **R:** response factories, `Allow`, failed-body/status preservation. |
| `gap-069.1` | **R inventory:** nine raw fetch sites; later inspect with word-boundary search, not `refetch` matches. |
| `gap-069.2` | **I:** S6/S7, two POST reads and seven writes, plus retained Stop tests. |
| `gap-070.1` | **R:** module/page ownership boundary; no speculative module fetch migration. |
| `gap-070.2` | **R + proof:** B Story journey and existing callback tests across page-owned operations. |

Chat C1–C12 additionally cover the plan’s explicit reviewed follow-up; they must not disappear because they lack a separate ID among the original 48.

**Opening and freeze requirements**

- Wait for coordinator-confirmed T-0189 hosted green. Then record the router verdict, exact claims and oracle authorship. Keep **at most two active writers**, including coordinator activity; oracle author/amender remains independent of implementation.
- Freeze original and amended oracle files, expanded test-name identities and LF-normalised hashes. Run the same named sets before and after implementation in the coordinator’s isolated checkout. Preserve every failed run.
- A candidate race test must fail through the public action sequence for the claimed reason. Preserve green controls. Do not call all new tests “red” before observing them.
- Use existing security, footer, focus, toast and Story suites as retention gates. Structural requirements such as shared write ownership also need source review and existing detectors; behavioural green alone does not prove deduplication.
- Freeze M10’s malformed-template outcome explicitly. **Recommendation:** retain the last valid mode, expose validation feedback and never dispatch the malformed value. That detailed fallback is a recommendation, not an established runtime contract.
- Expand production claims separately to the actual `.tsx` surfaces required by these contracts. The current hook/test globs do not grant ownership of Story pages, Sidebar, Hindsight or mission components.

No implementation has started in this review. Stats counts, browser accessibility behaviour, race reproduction and final acceptance remain unverified.
