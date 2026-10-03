# T-0187 hardware-log provenance oracle

Independent ORACLE owns only `tests/unit/legacy-hardware-log-provenance.test.ts`.
Do not edit implementation, existing oracles, records or protected paths.

In an isolated `.env.local`, set `CH_HARDWARE_LOG_DIR=legacy-dir` followed by
`PS_HARDWARE_LOG_DIR=   `. Both the Node and Git Bash loaders currently claim
the legacy key wins. Their final environment leaves the canonical value as
three spaces. The Node and Bash `ps-log-rotate` consumers choose that raw,
non-empty canonical value. Test selected-value versus warning behaviour with
child processes and no real log deletion; if the consumer cannot run safely,
evaluate its actual selection expression in the isolated child.

Include a positive legacy-wins control and ensure no path or secret value is
printed by the warning. Run the new suite before source repairs and report the
named test set, matcher failures and passing controls. Do not commit.
