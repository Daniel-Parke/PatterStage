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

## Folded

- Q-017 (process): should a closed plan's arithmetic be held row by row rather
  than section-wide? Folded 2026-09-26. Answer, from the operator: strengthen
  c8's plan check row by row. Q-023 records the same choice in the new decision
  addendum. A different author makes the dated, narrow oracle amendment.

- Q-018 (process): how should c8's testLines ratchet be held? Folded
  2026-09-12. Answer, from the operator: the committed census baseline governs
  growth, and c8's testLines case asserts the account rather than a live count.
  The other eleven ratchet cases remain live against C0.

- Q-019 (security): upgrade Next and its matching ESLint configuration to
  16.3.6 before the general dependency batch. Folded 2026-09-26. Answer, from the
  operator: upgrade together in T-0157.
- Q-020 (security): replace raw-token browser cookies with revocable opaque
  sessions while preserving Bearer clients. Folded 2026-09-26. Answer, from the
  operator: T-0158 needs an
  accepted ADR before its new schema and public contract land.
- Q-021 (process): extend Q-015's independent, dated closed-oracle amendment
  rule to hooks-04, hooks-05 and critic-06. Folded 2026-09-26. Answer, from the
  operator: T-0162 applies the independent amendment procedure.
- Q-022 (security): retain loopback HTTP, use HTTPS for LAN browser access by
  default, and require explicit opt-in for insecure LAN HTTP. Folded
  2026-09-26. Answer, from the operator: T-0158 records this transport policy.
- Q-023 (process): strengthen Q-017's C8 check row by row. Folded
  2026-09-26. Answer, from the operator: a different author amends that oracle
  for this ruled item.
- Q-024 (security): prepare the four repository security controls for operator
  activation: Dependabot alerts and security updates, secret scanning and push
  protection. Folded 2026-09-26. Answer, from the operator: prepare instructions;
  activation remains the operator's action.
- Q-025 (product): Select and Picker remain separate primitives; add explicit
  contextual names to the ten unnamed Select uses. Folded 2026-09-26. This
  supersedes the contrary components-02 detail under Q-016. Answer, from the
  operator: retain both primitives and name the ten unnamed Select uses.
- Q-026 (security): require browser sign-in after every server restart.
  Folded 2026-09-26. Answer, from the operator: T-0158 invalidates prior
  browser sessions on restart.
- Q-027 (product): retain elapsed mission run deadlines and correct the prompt,
  interface and guides. Folded 2026-09-26. Answer, from the operator: retain
  elapsed deadlines and reconciliation grace; correct the wording.
- Q-028 (security): allow exact authentication lifecycle writes under
  `PS_READ_ONLY`, while refusing every application write. Folded 2026-09-26;
  Answer, from the operator: T-0158 records the route/method contract in its ADR.

For Q-019 to Q-028, the options, consequences, corrections and authority chain
are recorded in `org/reviews/2026-09-refactor-addendum.md`.

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

- Q-029 (release operations): pause new Dependabot version-update pull
  requests until the next release? Folded 2026-09-27. Answer, from the
  operator: yes, set both npm and GitHub Actions version-PR limits to zero.
  The operator expressly authorised the narrow default-branch `main`
  configuration exception because GitHub reads `.github/dependabot.yml` from
  the default branch; T-0173 mirrors that file on `dev`. The eleven existing
  proposals remain individually accountable. Dependabot alerts and security
  updates were disabled in repository settings at the ruling and are a
  separate operator action. This pause is reversed at release.

- Q-030 (publication): may a manual Docs workflow dispatch deploy a branch
  other than `main`? Folded 2026-09-27. Answer, from the operator: no.
  T-0174 adds a `main`-ref job guard for push and manual dispatch. This closes
  the gap between the workflow's branch filter and its existing main-only
  publishing test. A `github-pages` environment rule restricted to `main`
  is a separate release-setting check for the operator before Pages is enabled.

- Q-031 (mission dispatch): if PatterStage restarts after a gateway may have
  accepted a mission but before the reply is recorded, should it replay the
  submission? Answer, from the operator on 2026-09-28: hold the outcome as
  unconfirmed for operator review. Do not automatically replay, and do not
  claim the run was never submitted. T-0183 owns the durable claim, visible
  uncertainty and cancellation behaviour. This ruling does not assert that
  the gateway provides durable idempotency or that a remote run was stopped.

- Q-032 (programme sequence): may the approved structural batches run before
  the main release? Answer, from the operator on 2026-09-30: amend Q-011 and
  finish consolidation before release. The approved T-0188–T-0201 structural
  work may proceed on `dev` after the current release-verification repairs.
  Merging PR #157, tagging and publishing remain operator actions. The earlier
  Q-011 answer is preserved as history; this answer supersedes its release-first
  sequencing requirement. Item-specific compatibility retirement dates require
  their own explicit disposition and are not silently inferred from sequence.

- Q-033 (compatibility retirement): does Q-032 also bring T-0200 legacy
  configuration aliases, signing headers and redirect retirement before
  v1.0.0? Answer, from the operator on 2026-10-01: keep compatibility through
  v1.0.0 and defer T-0200 retirement. Q-032 permits the other approved
  consolidation before release. The separate item-specific retirement
  promise remains; T-0200 is not silently marked implemented or removed.

- Q-034 (test identity): may critic-09 retire the four dynamically generated
  RGB mirror-format cases alongside the four explicitly ruled unused declarations?
  Answer, from the operator on 2026-10-03: approve these four test retirements.
  The unchanged lockbook-token suite still checks every retained and future mirror,
  its non-vacuity guard and the code mirror. Four new component-oracle cases prove
  the removed declarations remain absent. T-0191 records the original identities
  and results; this adds four exact exceptions to its two Schedule retirements,
  not authority to weaken a failing check or retire other tests.

- Q-035 (programme sequence): may product batches resume while the intermittent
  macOS timing investigation remains open? Answer, from the operator on
  2026-10-04: "Continue product batches; keep T-0206 open". T-0193 may open
  after the current selector correction passes the full local gate and every
  required hosted job. T-0206 remains active; its cause and repair are unproved.
  Preserve the original failed runs, every timeout and assertion, and the
  T-0195 follow-up. No failing check or other dependency is waived.
