# T0193 verification

Opened under Q-036 at `9e55c5a34c10094a11930a5f4024c69a6d5a71d1`.
Hosted snapshot: `tmp/t0191-hosted-t0206-selector-current/snapshot-1791108455908.json`.
PR CI37193334646 passed10jobs and failed macOS C02/C05:18of21calls and
watchdog exceeded. The subsequent isolated20/20pass does not clear that failure.
Push CI37193331986 and both Gitleaks runs passed. T0206 remains active and red.
Q036 changes the T0193 start dependency only; closure/release checks remain.

Independent Faraday profile oracle:16behaviour cases,4passing/12failing,
zero runtime-error suites. Receipt:`tmp/t0193-profile-oracle-red-frozen.json`.
Real forms/runWrite/selection; held synthetic transport; failures reproduce
newer drafts being closed or reset, late unmounted effects and stale selection.
LF SHA256:`05cb67a1b91de7e4911bd11b03fc9012c11f4b692bbe93cf1255629aa601e4a0`.
Source implementation was unchanged at this red checkpoint. Browser proof,
full gate, causal mutations, independent acceptance and hosted checks follow.
The other18supplemental rows remain pending; no batch closure is claimed.
