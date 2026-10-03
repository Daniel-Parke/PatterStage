# T-0189 sync implementation lane

Do not write until the coordinator commits this assignment and releases it after
the final independent red oracle. Adopt EXECUTOR under ruled R2. Main checkout
is C:/Users/Daniel/Documents/Coding/Github/PatterStage. Write source here, not in
an unregistered fork. Claims will name exactly seven sync paths; no test edits.

Read the frozen oracle criteria and the two sync/scheduler suites. Preserve all
original and amended suite hashes and existing test names. No historical test,
protected file, ledger or generated view edit. Coordinator owns integration,
commits, mutation manifest, census and full gate. Max two writing lanes.

Implement atomic process snapshot replacement, including empty success, with
asynchronous discovery outside the transaction. Keep unrelated discovery/error
behaviour; separately recorded host-tooling hypotheses are T-0196 work.
Unify EnvSync and ProcessSync token presence: empty/comment/changeme absent,
matching quotes handled, real nonempty present; Discord/Telegram/Slack labels,
WhatsApp key OR phone-ID. Do not log or persist credentials in evidence.

Error identity is exact source/timestamp/fullmessage; repeated ticks cannot add
it again. Preserve earliest representative/severity. Read historical duplicates
by MIN(id) before LIMIT10 without deleting them. Tick insertion and existing500
retention prune are atomic. No new schema/index or migration. Remove only ruled
SessionSync sync_registry writes and now-unreferenced internal writer exports;
retain table/recovery. Preserve reported results and logging.

Scheduler shares one bounded result for each source name, across runOne, runAll
and forceSync. Timeout does not cancel underlying work; keep claim/liveness until
it settles, return the recorded timeout promptly to overlap, consume late rejects,
and never overwrite the timeout on late success. Normal settlement permits retry.
Resolved success:false retains its error. Different names can progress; runAll
still yields between serial sources. Concurrent full-cycle callers must share
the active cycle instead of receiving a fabricated empty success. Keep freshness
budgets and ConfigSync's deliberate nonfatal malformed-YAML behaviour. Correct
claims that a timer can pre-empt synchronous JavaScript.

Validation checkout and command will be supplied with release. Copy only owned
source into it, record source/test hashes, and run affected frozen suites plus
unchanged historical sync-scheduler-non-blocking, config-sync-keeps-secrets-out-of-
the-fault, b1-sync-routes-answer-with-the-outcome, sync-api-route and monitor-sync-
source-errors tests. Use pinned Node24 and cleared owned data/home/Hermes/temp.
No OS-wide process cleanup. Retain failed runs. Report exit codes, exact test
identities before/after and modified paths. Do not commit, push, amend tests or
declare final batch acceptance. Stop writing when returning the completed slice.
