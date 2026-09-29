---
summary: Read-only adversarial review of T-0185 prompt, model and old-link repair
type: brief
tags: [missions, review, prerelease]
---

# T-0185 independent sceptic

Read `org/START.md`, `org/tasks/T-0185.json`, `org/roles/REVIEWER.md`, the
three frozen T-0185 oracle suites and the current source diff against
`d7555b0f`. **Do not edit or commit any file.** This is a read-only review and
uses no writing lane.

Challenge the repaired behaviour, not its style. Probe a stored mission prompt
with decoy tags in CDATA, CDATA split sequences and accepted nested examples.
Trace numeric/null/valid model inputs through dispatch, promote and update to
the first write. For an old-link mission outside the first 200, inspect initial
load, the 15-second refresh, genuine 404, temporary 5xx and overlapping fetches.
Ask whether the panel, URL and board row remain truthful at both widths.

For each surviving issue, give a safe reproduction or a file and line with a
concrete failing state. Default an unconfirmed concern to refuted. State which
frozen tests you reran, their results and any important untested limit. Report
findings to the coordinator without changing a test or source file.
