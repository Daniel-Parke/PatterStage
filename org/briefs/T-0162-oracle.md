# T-0162 oracle and ownership brief

Task record: `org/tasks/T-0162.json`. Work on `dev`; the coordinator owns the
detector implementations, baselines, task record, claims and final gate. Keep
at most two concurrent writing lanes. Every oracle first fails against the
committed pre-fix tree and is committed on its own before its implementation.

Prove the actual gate sees a raw `fetch` write, a cross-file effect read, and
an unnamed house primitive. Prove Knip includes tests and the harness without
silently deleting or ignoring a surfaced export. A passing test of a helper
alone is insufficient: plant a representative violation and observe the
command's non-zero exit. Preserve all existing test names and coverage floors.

Q-015 and Q-021 require a **different author** for any change to a closed C6
or C8 oracle. That author owns only the explicitly claimed oracle file, records
the old and new file hash and retained test-name set, and adds a dated
`Amended 2026-09-27 (T-0162)` explanation for the exact assertion changed.
The implementer does not edit that file. The amendment must be red against the
wrong detector and green only when the ruled baseline or fixed result holds.

The 104 raw controls already surfaced under K6. Q-025 keeps Select and Picker
separate. Q-011 keeps structural removals behind an operator release. Record
any baseline per file or site with its present reason; do not bless a green
scan that reads zero or an unexplained growth.
