# T0206 HTTP budget investigation

Opened at clean dev0f14c77a after its macOS push CI37183971353 failed.
Original evidence: tmp/t0192-closure-macos-failure.log and
tmp/t0192-closure-macos-full.log. Two full-suite failures; isolated20/20pass;
stalled diagnostic21calls, withinDeadline=true, elapsed4.937716459s.
The full failure remains. Mechanism and repair are not established.

T0192's independent implementation acceptance at926a13d3 remains bounded and
its closed record is preserved. Its metadata-head hosted prerequisite is red,
so T0193 is not open. See the oracle brief for measurement, invariants and
required separate-author repair proof. No implementation performed.
