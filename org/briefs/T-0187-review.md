# T-0187 independent R2 review brief

Read `org/START.md`, `org/tasks/T-0187.json`, `org/roles/REVIEWER.md`,
the accepted Q-011, Q-013/tooling-10b and org-11 rulings, and the frozen
new suites. Review the current **uncommitted product diff** against the
task invariants. This is read-only: make no edits, commits or claims.

Adversarial checks:

1. Re-trace each supported `CH_`, `CONTROL_HUB_` and `AGENT_HOME` reader.
   Does the boot warning name only a winning input? Look for raw `||`
   versus `readEnv` blank handling, equal-value precedence, direct
   `.env.local` loading, loaders that bridge names, and build-time or
   shell-only selection. Test a counterexample if one exists.
2. Can a warning print a path, secret, token or untrusted value? Can
   repeated registration or loader calls produce duplicate warnings?
3. Are existing install data-dir copies and same-directory `ps-*.sh`
   twins preserved? Are only the five ruled shims and refused compiler
   removed? Check the two exact b15 test identities and no others.
4. Check `org/` for protected edits, historical rewrites and changes
   to prior EOS feedback entries. Verify the new feedback and retirement
   note describe what the tree actually does.
5. Look for Windows Git Bash, macOS Bash 3.2 and Linux incompatibility,
   and whether a build/start or an install path can still fail.

Report a verdict, each finding with file/line and a rerunnable test or
concrete counterexample. Separate confirmed defect from uncertainty;
do not treat a green focused suite as proof of the full gate. The
coordinator will run the full gate and an isolated real-boot walk.
