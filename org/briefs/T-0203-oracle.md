# T-0203 independent ORACLE brief

Read the R2 task record and relevant governing files. Author only
`tests/unit/release-test-tools.test.ts`. Do not implement its script or change
the workflow, frozen T-0202 files, protected files or historical records.

The future `scripts/tooling/prepare-release-test-tools.sh` must verify the GNU
timeout and fractional-read Bash prerequisites. macOS resolves Homebrew
coreutils' `libexec/gnubin` and Bash's `bin`, installs only when required, and
publishes both directories through `GITHUB_PATH` for later coverage steps.
It must fail on missing, incompatible or failed installation. Linux and Windows
keep their already working commands. Apple Bash 3.2 accepts only integer read
timeouts. A different-author Q-015 Darwin-only helper routing amendment requires
an exact proposal and independent authorisation before any frozen helper edit;
this brief does not authorise that edit. Preserve all bounds and real curl.
Use isolated fake commands to test behaviour and failure propagation. Keep a
small workflow assertion for the macOS setup-before-coverage ordering. Preserve
all existing test identities, deadlines, coverage and CI jobs.

Commit no implementation. Run the new suite against the missing script and
unmodified workflow; identify intended matcher failures separately from launch
or configuration errors. Supply test names, LF SHA-256 and changed paths.
The coordinator commits this red oracle before any implementation.
