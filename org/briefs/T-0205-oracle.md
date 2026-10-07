# T-0205 independent HTTP call-context oracle

Adopt ORACLE from a fresh context. Read the task record, this brief, existing
HTTP fixture interfaces and assigned claims. Do not inspect the proposed
replacement, ignored prototype or install Harness implementation. Author new
behavioural tests before implementation. Keep all existing suites unchanged.

The unchanged public boundary is Harness.http_smoke. Existing private helper
release-install-http-probe.py invokes it against real selected native curl,
owned Bash children and an actual stdlib HTTP listener. A separate observer
may import that helper and instrument only its generated supervisor/probe
shell writer. Keep native transport, request mapping and all time bounds.

Acceptance witnesses: each curl entry executes in the main probe-shell
context. Record both $$ and BASHPID, comparing against that probe's identity;
do not require unique PID values. All 21 native curl calls in the stalled
case remain; distinguish pre-launch calls from recorded HTTP responses.
Status capture must consume the complete output, clear previous output on
each call, preserve curl exits and trailing-newline semantics, and refuse
malformed, partial, NUL-containing or unreadable output. Creation refusal
must occur before server launch. Owned scratch storage must be exclusive,
private, created within the existing run budget and removed on success and
failure. Preserve credentials/body discard, refusal paths and owned cleanup.

Use healthy/stalled/refused controls with real native curl. Fault injection
may alter only the returned status after the real request, or refuse the
scratch utility within the owned fixture. Label fault controls explicitly;
never present them as real server responses. Never log credentials, headers,
environment values, response bodies or generated shell source. Observer
metadata may include context PIDs, selected client hash, counts, status,
cleanup, bounds and lifecycle timings. No observer command substitutions.

All frozen 14 HTTP and seven default cases, all portable/native controls,
production deadline75, attempts20, fixture watchdog6, kill grace0.2,
accelerated curl0.1 and outer/RPC25-second limits remain. No existing test,
fixture or mutant amendment is permitted at this stage. An eventual m7
anchor retarget needs separate reviewer authority and a different author.

Own only tests/unit/release-install-http-context.test.ts,
tests/helpers/release-install-http-context-probe.py and
org/reviews/2026-10-t0205-http-context-verification.md. Save red/provenance
receipts under ignored tmp/t0205-oracle, with every exact test name, intended
matcher failure and infrastructure distinction. Demonstrate original red
and private positive/fault calibrations without inspecting a replacement.
Freeze LF hashes and cease writes before coordinator implementation.
