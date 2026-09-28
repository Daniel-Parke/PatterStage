---
summary: T-0180 redacted full-history secret-scan repair and remaining limits
type: review
tags: [review, security, phase-2]
status: done
---

# T-0180 Gitleaks evidence, 28 September 2026

The red-first Jest oracle failed all three cases at `fc2d2bd8`: no default
rules, no exact historical ignore file and no hosted planted-secret control.
The repaired configuration extends the built-in rules and excludes no path or
rule. `.gitleaksignore` lists exactly the ten previously reviewed fingerprints,
each tied to an introducing commit, rule, file and line. The dispositions and
the independent review of nine synthetic test fixtures and one SHA-256 task
record value are in
[the prior redacted control](2026-09-gitleaks-history-control.md). No secret
value is in this note or the ignore file. The three July 25 expired hosted
reports remain unresolved; their content cannot be reconstructed from a green
replacement job.

The official native 8.30.1 executable, obtained with the published checksum
as recorded in the prior control, ran a strict control in the isolated
`t0158-sweep` checkout at `052cedd2`, with no ignore file. It exited 1 with
the same ten redacted fingerprints. The repaired working checkout scanned
the same 1,667 reported patches with exact fingerprint ignores and exited 0
with zero reported leaks. Local Git listed 45 refs, 1,769 reachable commits
and 1,682 non-merge commits at the time of this comparison. Gitleaks reported
1,667 patches, so its count is not equivalent to either Git count. The
unexplained 15-patch gap against non-merge commits remains open. The scan covers
reachable history from the local refs; unreachable objects, uncommitted files
and remote refs absent from this checkout are outside that local result.

The disposable-repository control uses the same `.gitleaks.toml` and
`.gitleaksignore`: a clean commit exits 0, then a newly generated synthetic
generic API-key finding exits 1 with a structured report. The control passed
both with the native executable and with the digest-pinned Linux image under
Docker. The image is the same one the hosted workflow now runs against every
fetched remote branch, after fetching full history. The workflow leaves the
scanner's default full-history Git traversal intact. Both hosted scanner steps
run before checked-out canary code; checkout does not persist credentials and
the job token is repository read-only. The hosted action retains scan results
with an explicit config path and scanner version, but automatic PR comments
are disabled because the job no longer has write permission. A malicious PR
that changes both its scanner configuration and its own workflow still needs
the repository's separate branch-protection review boundary; a job cannot
make its checked-out workflow immutable. The hosted push and PR results are
recorded below.

Independent R2 review found the canary ordering and Git-log option mismatch.
A different author committed a separate four-case oracle amendment red at
four of four in `d8f8dc68`. The original three-case oracle and its test names
remain unchanged.

## Hosted result at `dev@ccd7c103`

The remote had exactly `dev@ccd7c103` and `main@7b9d6d68` branch heads when
queried after the push. Push and PR Gitleaks jobs `36458230381` and
`36458237777` both passed. Each job successfully fetched remote heads, ran the
Docker full-history scan, ran Gitleaks action v8.30.1 and passed the planted
control. The Docker scan reported **1,621 patches** and no unignored finding
in each job; the action then scanned three push commits or 30 PR commits.
Those smaller action windows are why the separate Docker history scan matters.
The hosted checkout and fetched refs do not include deleted branches,
unreachable Git objects or unrelated PR-only refs. The three expired July 25
alerts and the local scanner-versus-Git patch-count gap remain unresolved.

Push CI `36458230201` and PR CI `36458237763` also passed. PR acceptance ran
the full E2E, install, native build, Docker and real-Hermes jobs. The push
workflow skipped full E2E and acceptance under its existing event condition;
all its executed jobs passed. The final local ten-step gate and three-mutant
sweep results are in `org/tasks/T-0180.json`.
