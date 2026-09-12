---
summary: PatterStage questions, the human decision queue and its folding rule
type: venture
tags: [eos]
compiled_from: kernel/templates/org/QUESTIONS.tpl.md
---

# QUESTIONS · Human decision queue

Anything an AI session must not decide lands here. Operator: answer
inline under each item; a PLAN session folds answers into decisions,
specs or registries and marks the item folded. Sessions blocked on a
question say so in `org/STATE.md` and move to other work.

Entry format: `Q-### (domain): the question, the context link, and the
owner.` One decision per entry; a question hiding two decisions is
split. Where a guard verdict raised the question, the entry names the
verdict (require-approval or manual-only) so the operator knows what
execution waits on the answer.

## Open

- Q-001 (product): how do the PatterTech product layers link together,
  and how does one developer working with AI release and maintain them?
  Context: `docs/VENTURE_BRIEF.md` death #2, and ADR-0001, which settles
  the principle and leaves the mechanism open. Owner: operator.
  - raised at Session 0, 2026-07-25, by the operator, unprompted, in his
    answer to the personal-data question. His words: "I am honestly
    really confused how I should link all of these together, and this is
    something I want you to help me with. I have a lot of different
    product layers and applications, and I really want to deploy/release
    them in the most effective way for myself (a sole dev with AI) to
    maintain them."
  - why it is recorded rather than answered: it is the venture's central
    open question and the reason death #2, the integration layer eating
    the product, is cheap. Guessing at it in the interview would have
    been the exact failure the challenge steps exist to prevent.
  - how it gets answered: the adopted smaller version defers it
    deliberately. Nothing integrates until one person who is not the
    author has installed PatterStage from scratch and used it for a week.
    The install gate is task `T-0004`. The answer then comes from what
    that person reaches for, not from a topology chosen in advance.
  - shape of the answer when it arrives: an ADR. ADR-0001 already fixes
    the settled half, so what is open is the mechanism, not the
    principle.

- Q-003 (process): does the compiled `AGENTS.md` say enough? Re-aimed at
  the v2 router, since the ADR-0008 recompile replaced the file the
  question was first asked about. Context: `AGENTS.md`, `org/START.md`,
  and `docs/LOCKBOOK.md`'s Structural contracts section. Owner: operator.
  - what happened at Session 0: the compile replaced PatterStage's
    hand-written 39-line router with the kernel's, which is correct (the
    matrix lists `AGENTS.md` as a compiled file) but dropped the repo's
    own prohibitions in favour of routing onward.
  - what happened at the cutover: the v2 router routes to `org/START.md`,
    to the task record's ruled tier and to a charter in `org/roles/`. It
    is a different file answering the same question, so the question is
    asked again rather than carried as answered.
  - what was preserved: every dropped rule is in the lock-book's
    structural contracts, which is where a venture's specifics belong
    under this scheme.
  - the open part: whether an agent reading only `AGENTS.md`, and
    following it, arrives at those contracts reliably. The H1 cold-start
    test at sign-off is what answers this, and it is the only test of the
    seed that matters.

- Q-017 (process): should a closed plan's arithmetic be held row by row rather
  than section-wide? Context: `org/reviews/2026-09-decision-register.md`
  (c8-plan-check-scope). Owner: operator.
  - found on 2026-09-12 by the ORACLE session amending c8 under Q-015, while
    proving the amended check still bites: restating `oneImporterComponents`
    from "missed by 8" to "met" in the plan's closing table left the suite
    green, because the number 103 also appears in the prose below it.
  - recommended: row-scoped. It is a strengthening, and it is a second
    amendment to a closed oracle, which is why it is asked rather than taken.
  - what waits on it: nothing. The check is sound against a number dropped from
    the section, which is the common failure.

## Folded

- Q-009 (process): is CI the binding gate from now on? Folded 2026-09-12. Answer, from the
  operator: yes. `dev` is made green first (six case-broken doc links, the `tsx` data-URL resolution in `scripts/docs/extract.ts`, and the runtime smoke's two stale contracts), then every batch waits for its pushed commit's CI before the next starts. `npm run gate` runs the chain by exit code, the line census becomes a CI step, `main` requires acceptance-gate and build-test-ubuntu with `enforce_admins` on and required reviews at 0, and the pre-push hook is installed once.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-010 (process): does the programme follow governance as written? Folded 2026-09-12. Answer, from the
  operator: as written. ADR-0011 ratifies T-0144's four protected path lines and names the restore as its reversal; the 47 closed records get their original text back; at most two writing lanes, each with claims committed before dispatch; R2 runs high-assurance with an independent review; and public contract means routes, npm scripts, env vars, config keys and documented exports, not any exported symbol.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-011 (product): when does v1.0.0 ship, and what happens to the pre-rename names? Folded 2026-09-12. Answer, from the
  operator: rc.1 and v1.0.0 are cut after CI is green, the security fixes and the build-before-backup fix, and the structural batches follow. Every CH_, CONTROL_HUB_ and AGENT_HOME name, the x-ch-* headers, the ch-* shims, the ch.sessions.* keys and the 52 redirects stay through 1.0 with a boot warning, and retire together in the first release after it, with a tripwire refusing to boot on CH_READ_ONLY or CH_REQUEST_SIGNING_SECRET without its PS_ twin.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-012 (security): mitigation in code, or a recorded exclusion? Folded 2026-09-12. Answer, from the
  operator: both, item by item. Framing is forbidden everywhere; read-only is the proxy's, with the host-side routes keeping their own guard; the signature's gap and the deploy buttons it disables are documented; one on/off vocabulary for boolean env vars; RUL-SEC-002's pre-commit scan and deny list land. Two residual risks are recorded as ASVS 4.0.3 exclusions in one ADR: the throttle's per-caller keys, and the sign-in URL printed on the start that creates the token.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-013 (product): which shipped surface goes, and which is kept? Folded 2026-09-12. Answer, from the
  operator: delete what is dead, uncallable or undocumented; keep and label what is documented, ruled or holds data. Deleted: the bench-gateway harness and its npm script, `hindsight-rederive.sh`, the five ch-* shims and the .sh hardware twins, the pnpm settings, ts-jest, four unused rgb tokens, and the deploy-only Windows branches. Kept and labelled: the four uncalled documented routes behind a new caller gate, the benchmark tables, sync_registry, the seed toolset YAML with a drift test, the Story Weaver fonts, MODULE_ACCENTS, the declared test-only APIs, the composer flag and every npm script name.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-014 (product): how do the build, migrations and boot treat the database? Folded 2026-09-12. Answer, from the
  operator: the build touches no database, once a build on an empty `PS_DATA_DIR` proves it needs none and `db:seed` is shown to cover the build-time Hermes import. The unreachable baseline-rebuild path goes with its documented promise, migrations converge in one pass and fail loudly, duplicate error rows are hidden at read rather than deleted, and boot runs its recovery sweeps before it can fail fast.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-015 (process): how do test and lint policy change, and may a closed oracle be amended? Folded 2026-09-12. Answer, from the
  operator: a closed programme's oracle changes only by a dated amendment, for the one rule or key the ruled item fixes, authored by a session other than the implementer; c8 is re-anchored to the numbers frozen at C8. `no-require-imports` is turned off for tests in one commit, keeping the specific reasons as plain comments. Provenance headers get a ratchet rather than a trim, batch names stay with a subject-first rule for new suites, and the flat test layout stays.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-016 (product): how far does product structure converge? Folded 2026-09-12. Answer, from the
  operator: Field labels and track switches on Settings, Memory and Composer; Select and Picker stay separate primitives as the UI overhaul decided, and the ten unnamed dropdowns simply gain names; chat renders through SimpleMarkdown with a Copy button per code block; the missions board reads through the cache with errors shown in place; Laboratory waits under ADR-0005; the hermes module owns agent_root; and a superseding ADR records globals.css as the token source.
  - the per-item detail, with each option's consequence and the ruling, is in
    `org/reviews/2026-09-decision-register.md`. The operator's words on adopting them: correct any of them and
    I will unwind that one.

- Q-002 (legal): which licence does the public repository carry? Folded
  2026-07-26. Answer, from the operator: Apache-2.0. The relicence commit
  `a18063be` sits on `dev` with NOTICE, TRADEMARK.md and REBRANDING.md and
  has simply never shipped, because `dev` has not merged to `main`; GitHub
  detects the licence from the default branch, so the reported licence
  corrects itself at that merge with no metadata to edit. Copies taken
  before that merge stay MIT, because a licence already granted cannot be
  withdrawn. That is a statement of what the two licences say, not legal
  advice, and it needs no decision from anyone.

- Q-004 (process): the queue header contradicted the separation of
  duties. Folded 2026-08-22 at the cutover. Answer, from the operator via
  ADR-0008: dissolved structurally. The v2 recompile retires `org/QUEUE.md`
  entirely, and task records under router-ruled modes replace the header's
  protocol.

- Q-005 (process): three lock-book corrections needed sanction. Folded
  2026-08-22 at the cutover. Answer, from the operator via ADR-0008:
  sanctioned. (a) The WG-OPS-002 paragraph's claim that `docker-image` sits
  in branch protection's required set is corrected in `docs/LOCKBOOK.md`;
  the measured required set is empty. (b) The five ruling notes that read
  "undefined" are restored from `docs/eos-session0/WALK_RAW.json` and
  `CORRECTIVE_RAW.json` into `docs/RULINGS.json`. (c) The lint-constraint
  attribution is tightened there too.

- Q-006 (process): no session log exists for session 1. Folded 2026-08-22
  at the cutover. Answer, from the operator via ADR-0008: the gap stays
  recorded and is not reconstructed. v2 retires session logs, git is the
  log, so the series was expected to end with the migration record at
  `org/logs/2026-08/S-0002-plan.md`.
  - what happened next: two more logs were written after the fold,
    `org/logs/2026-08/S-0003-execution.md` (2026-08-23) and
    `org/logs/2026-08/S-0004-ux-and-value.md` (2026-08-24). S-0004 is the
    last one, and both are cited as real sessions elsewhere in the
    record, so they are part of the series rather than strays. The
    retirement itself stands: ADR-0008 rules it, no later ADR reverses
    it, and practice simply ran two sessions past the ruling.

- Q-007 (process): four done rows sat in the queue's Ready section.
  Folded 2026-08-22 at the cutover. Answer, from the operator via
  ADR-0008: moot. The queue file retires and closed rows live in git
  history.

- Q-008 (process): should the design-lint baseline be mechanically
  shrink-only rather than shrink-only by doctrine? Folded 2026-08-22,
  promoted rather than answered. Answer, from the operator: promoted to a
  task. It is `T-0025`, proposed: `--update-baseline` refuses to write a
  larger total, or a larger per-key count, without an explicit second flag
  carrying a written reason.
