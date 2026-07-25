---
summary: PatterStage Venture STATE , the session claim line, live sections and the Resume Packet spec
type: venture
tags: [eos]
compiled_from: kernel/templates/org/STATE.tpl.md
---

# STATE

The live state of the organisation. Touched at session start (the
claim) and session close (the Resume Packet). Reality wins over this
file; fix it and note the correction in the session log.

active_session: none

The claim protocol: at session start, if `active_session` is set, dated
today or yesterday and not yours, stop and tell the operator. Otherwise
write your session id, assignment and date; clear the line to `none` at
close. A claim older than a day is stale; sweep it and note the sweep.

## Now

One short paragraph: the current milestone, the phase, and what is true
right now that a cold session must know.

## In progress

The items currently claimed, with owning session ids, or "none".

## Flags for the operator

Bullets only the human can act on: approvals due, spend decisions,
stale questions, risks that need a call.

## Resume Packet

Written at every session close and at named milestones. Fixed keys; a
fresh session must be able to resume from this packet plus the files it
names, alone.

- venture:
- eos_pin: <version and commit from the lock-book>
- phase: <milestone or phase, and the item just closed>
- last_verified: <what was proven green, and when>
- next_action: <the exact next step, with its playbook or procedure>
- blockers:
- constraints: <the top three in force right now>
- files_in_flight: <un-merged work and where it lives, or none>

