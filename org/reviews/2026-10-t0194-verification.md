---
summary: T0194 opening authority, owned validation and qualified queue readiness evidence
type: review
tags: [refactor, verification]
---

# T0194 verification

Inspected opening revision93e425d556f384663fe5715c983d8b0c0c47fd07.
Record ruledR3 before implementation; accepted exact ADR0018 proposal is
preserved. No protected entry or source implementation yet. Independent
oracle author owns only the named test files. All20findings/14OP/42coverage
rows remain draft until individually evidenced; supplemental work is separate.

Start proof: every11PR/9required push/both Gitleaks jobs passes at that revision.
Snapshot tmp/t0191-hosted-t0206-actual-ready/snapshot-1791129063547.json.
Previous local diagnostic full gate at3d62a0d7 and seven-mutant sweep at9b2d140e
remain separately qualified in the T0206 evidence. They do not prove this batch.

## Completed-queue readiness trace, read-only Franklin

Pinned source inspected: /opt/hermes/gateway/platforms/api_server.py,
hash matched existing pinned release evidence. Admission3566-3568/3642-3646
counts _run_streams capped10, including completed unconsumed queues.
Completion3900-3907 removes task/agent handles but retains queue. Polling
3927-3985 returns status/output/usage without consumption. SSE4120-4153
subscribers consume the same queue and finally remove it, including disconnect.
No separate acknowledgement API. Queue retention is300s from creation,
sweep60s; terminal status retention3600s. The sweep also removes active handles.

PatterStage run-reconcile.ts134-136 persists Composer output/usage and advances;
Composer/Research SSE publishes SQLite snapshots without draining Hermes.
src/app/api/runs/[id]/events/route.ts90 opens an upstream reader per request,
including Composer-backed runs. Chat/mission readers can therefore compete.
Long chat/LLM calls use /v1/chat/completions outside this run registry.
RunSync is registered in every process; scheduler194 does not use the scheduling
lease for reconciliation. Documented one-server deployment still permits
multiple browser readers in that process. No exclusive acknowledgement owner.

Completed queue retention explains10completed→11th429; it does not prove
ten active executions. A terminal-only cleanup after durable persistence and
before successor admission is a candidate, not an implemented or accepted
repair. Qualify ownership, retry recovery and late subscribers before source
edits. Preserve both causal controls, stored output/usage and active cap10.
New upstream API/image or public fan-out/replay policy needs separate authority.

No paid provider calls, dispatch, operator data or unrelated processes used.


## Lib-domains12 foreign implementation qualification

Current Chat MessageBubble.tsx105 renders SimpleMarkdown; its CodeBlock43
copies text directly. No source renderMarkdown/data-code path remains.
The full components-chat-markdown.test.tsx50-76 fixture contains fenced
code with leading/trailing whitespace and newlines, asserts exact clipboard
payload and truthful refusal. It is not a whole-response Copy test.
T0191's m03-exact-code-payload mutant in tests/fixtures/mutants/T-0191.json
trims the fenced payload and causally kills both controls. Existing test
bytes match accepted T0191. See its final-acceptance and component-verification
notes. Banach independently corrects the stale preliminary qualification.
Reuse this foreign implementation; no duplicate rewrite or savings credit.
Focused browser code-Copy evidence remains with T0194; Session Copy has
separate controls and is not interchangeable proof.


## First-cohort independent oracle, red before implementation

Faraday authors20new gateway Stop/deadline controls and independently amends
one obsolete Q027 roundtrip assertion.31cases:17pass14causal matcherfail,
zero runtime errors/skips. Four held waits remain pending after Stop; caller
links remain1after success and3after terminal failure. Held delays/attempts,
zero/precedence/submission arithmetic stay green. Separate existing controls
17/17pass. Proof: tmp/t0194-first-cohorts-freeze.json and
tmp/t0194-first-cohorts-red-final.json. Banach independently accepts the freeze.
All implementation and existing control bytes match93e425afterLFnormalisation.

Roundtrip amendment: operator-authoriser isQ027's explicit deadline/guidance
ruling and approved programme. Faraday changes only the obsolete inactivity
expectation to Elapsed run deadline:30minutes and records the amendment comment.
All11names and other assertions remain. OldLFhash:
4d47b150186cb696bc65864d642a7b3aac129ce1b99285cc55021bda1a764ac3;
newLFhash52866b3dd2d6e2c023fb73bf8331e31a844df724a8b86bbe9022eef4cfa1aed8.
Reversing that exact insertion/change reconstructs originalbytes. Other frozen
deadline/reconcile/Stop suites are untouched. This entry preserves the original
amendment provenance; it is not authority for any future amendment.

New frozen LFhashes:
retry-stop98c4f37356f0130b8499e5ae7863ddaeaf6c6f11e3b6d3f65edfbf8694993574;
guidance2e11d97dee246755c8d7316e09c3349a9676286189b80862676164ea1fa1bab2.
Test-specific types and focusedESLint pass. No source/protected implementation
existed at freeze. Later queue/ownership/parity cohorts require their own
independent controls before applicable edits. Fullbatchgate/sweep/closure pending.
