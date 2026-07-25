---
summary: PatterStage Cadence , the recurring session schedule and the rules that keep it honest
type: venture
tags: [eos]
compiled_from: kernel/templates/org/CADENCE.tpl.md
---

# CADENCE · Recurring sessions

The heartbeat. The operator (later: a scheduler) launches whatever is
due; the running session updates `last_run` and `next_due`. Frequencies
are starting values, tuned only via the retrospective.

| Cadence | Role | Frequency | last_run | next_due |
| --- | --- | --- | --- | --- |
| Triage and queue ordering: reorder `org/QUEUE.md`, promote or decline suggestions, check what is due below | PLAN | Weekly | | |
| Stakeholder update: built, blocked, changed, next | PLAN | Weekly or per agreement | | |
| Retrospective and freshness sweep: what dragged, expired `review_by` items, EOS feedback filed | PLAN | Monthly | | |

Rules: a due cadence outranks new P2 and P3 work. Every run leaves a
session log. A cadence that finds nothing still records checked, clean,
sources and date; silence is not evidence.
