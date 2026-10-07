---
summary: Accepted T0194 authority and the remaining elapsed-deadline wording obligation
type: review
tags: [refactor, missions]
---

# T-0194 preparation

Inspected revision: 070f24eac34edb82ff65b730e770ff9a6a46cf54.
T0193 is independently accepted; its closure-head hosted jobs remain a start
dependency. This note does not open implementation or close foreign findings.

ADR0018 is accepted as drafted by Daniel Parke on 4 October through the
interactive operator reply. Preserve the exact [proposal](2026-10-t0194-settings-schema-adr-proposal.md).
Create its protected entry only after recording T0194's routed tier. Keep the
Settings field table in core, preserve the lint predicate and existing public
contracts, move the parser and agent_root ownership to Hermes as ruled.
Laboratory relocation remains deferred. ADR0005 remains unchanged.

## Already ruled Q027 follow-up

[Q027](2026-09-refactor-addendum.md) retains elapsed run deadlines and requires
the prompt, interface and guide to agree. A personal owned Missions draft walk
confirmed the contradiction in the published prompt. No new product decision
is required.

Re-run: `rg -n 'inactivity|stay active|reset|GRACE_MINUTES|declaredTimeoutMinutes'
src/components/missions/AgentRuntimeDefaultsCard.tsx
src/lib/missions/build-mission-prompt.ts docs/guides/missions.md
src/lib/orchestration/run-deadline.ts`.

The Runtime card comment/label, generated Safety Limits paragraph and guide
currently describe an inactivity kill switch and tool-call renewal.
`declaredTimeoutMinutes` instead selects timeout before scope, with explicit
zero suppressing scope fallback; `runDeadline` adds five minutes of
reconciliation grace to elapsed time since submission. Without a declared
deadline, the safety cap applies only when the backend stops answering.
Retain those distinctions and the existing zero/unlimited behaviour.

Expand T0194 claims to the card, prompt, guide and independently authored
behavioural controls. Verify: generated prompt and visible Runtime guidance
describe the actual elapsed deadline and five-minute reconciliation grace;
tool activity never promises renewal; explicit zero, scope fallback and
unreachable-backend controls retain their test identities and pass. Walk the
owned draft at both widths, run the complete unchanged gate, sweep causal
mutants and observe every required hosted job before closure.

Banach's final T0193 sceptic verdict assigns this unresolved wording to
T0194. T0193's19-row dispositions do not count it as repaired.
