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
