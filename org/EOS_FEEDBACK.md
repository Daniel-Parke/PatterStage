---
summary: PatterStage feedback to the EOS, re-cut to the v2 template at the ADR-0008 recompile
type: feedback
tags: [eos]
compiled_from: kernel/templates/EOS_FEEDBACK.tpl.md
---

# EOS feedback

The venture's channel back to the shared brain. One writer per repo per
concern: the venture writes here at will; the EOS harvest (PB-E02)
reads it monthly and never writes here. Nothing in this file blocks the
venture; it banks what the estate should learn.

Entry format, newest first, one dated entry per item:

- `YYYY-MM-DD · friction` · a template, playbook or rule that fought
  you, with the file and the moment it hurt.
- `YYYY-MM-DD · ruling-report` · a wargame ruled here worth counting
  early, or a default that felt wrong when argued.
- `YYYY-MM-DD · draft-wargame` · a fork no wargame covered. State the
  question, the options you saw, the decision rule you used, and your
  ruling as the first worked entry.
- `YYYY-MM-DD · ceremony-complaint` · ceremony that cost more than it
  protected, with the evidence.
- `YYYY-MM-DD · lesson` · anything the estate would pay to know.

Every entry below is privacy-reviewed for ingestion: no credentials, no
authentication mechanics beyond the shape of a design decision, no
personal data, no commercial context. Five entries filed at this
venture's 2026-07-25 Session 0 were never harvested, because the venture
had no registry row until the 2026-08 recompile. They are re-cut here in
this template, resolved where the v2 rebuild resolved them and re-filed
where it did not.

## Entries

- `2026-08-30 · friction` · **`eos-compile.mjs` has been a silent no-op
  and reported success the whole time.** Found during the T-0057
  documentation audit, when the audit's own premise (that seven `docs/`
  paths are matrix-owned and would be regenerated) turned out to be
  false in practice. `readMatrix()` matches rows with a regex expecting
  five columns, `path | template | S | M | L`. The matrix at
  `kernel/SCALE_MATRIX.md` now has four, `path | source | S | ORG`. The
  regex therefore matches nothing, `readMatrix()` returns an empty
  array, and the script writes no file while printing `0 missing
  template(s), 0 unfilled slot(s)` and exiting 0. Independently,
  `const SCALE = "M"` names a column that no longer exists, so even a
  correct row parse would select nothing. Either fault alone is enough.
  The cost is not the wasted run, it is the false belief: an audit
  concluded six documents could not be corrected in this repo because a
  compile would overwrite them, which was wrong, and correctable
  documents were nearly left broken on the strength of it. The repair
  applied here is deliberately NOT to fix the parse. Making it match
  would regenerate 32 files from pack templates, including `AGENTS.md`,
  `CLAUDE.md`, `OPERATORS_GUIDE.md`, `org/CONSTITUTION.md`,
  `org/START.md` and `docs/LOCKBOOK.md`, discarding hand corrections in
  all of them, and would write `docs/policy.json` and `docs/TASKS.md` at
  paths this venture does not use, since both live under `org/`. That is
  an operator decision about seed ancestry. Instead the script now exits
  1 when the matrix parses to zero rows, on the principle the venture
  already applies to its own gates: a tool that cannot fail is not a
  check. For the pack: the matrix shape changed without the consumer
  changing, and nothing detected it, because the consumer's failure mode
  was silence.

- `2026-08-30 · friction` · **`task-record.schema.json` forbids the keys
  the practice actually needs, and 26 of this venture's 58 records
  violate it.** The schema sets `additionalProperties: false` over
  fifteen keys. The corpus adds `invariants`, `rollback`,
  `verification`, `deferred` and `notes` almost universally, from
  T-0024 onward, and those sections carry the most load-bearing content
  in the records: what the task guarantees, how to undo it, and how it
  was proved. Two observations rather than a request. First, the pack
  contradicts itself: `org/policy.json` requires `rollback-plan` and
  `review-verdict` artefacts, and `additionalProperties: false` leaves
  them nowhere legal to live inside the record. Second, nothing in the
  venture runs the schema, so a divergence this wide went unnoticed for
  35 records. Three genuine violations were fixed here, being ones the
  schema is unambiguously right about: a `status` of `in_progress` that
  is not in the enum, corrected to `active`, and two records missing the
  required `claims` key. The `additionalProperties` divergence is left
  standing and reported rather than resolved, because resolving it
  downward would delete the best content in 26 records and resolving it
  upward is the pack's call, not the venture's.

- `2026-08-30 · lesson` · **The 2026-08-22 `DOC-IDENT-001` ruling-report
  below overstates itself twice, and the corrected version is worth more
  to the pack than the original.** That entry is left standing, as this
  file's convention requires; this is the qualification a harvest should
  carry with it. It was found by an audit of this repository's own
  documentation, not by the estate, which is itself part of the report:
  an entry offered as countable evidence went eight days unchallenged.

  **First, the word is wrong.** What is decided once, at a single
  interception layer every request passes through, is AUTHENTICATION.
  `src/proxy.ts` resolves the shared access token for every request and
  fails closed, refusing with a 503 when boot has not minted one yet. The
  read-only refusal is decided in the same place, by HTTP method. The
  entry claimed that of AUTHORISATION, "never inside a route handler",
  and that absolute is false as written:
  `requireAuthenticatedHostWrites()` in `src/lib/api-auth.ts` returns a
  403 from inside five handlers, across
  `src/app/api/cron/hardware/route.ts` and the scripts-by-name route
  beside it. The qualification that matters to the pack is what those
  five sites are. The mode they read comes from an environment variable
  and is constant for the life of the process, so they inspect nothing
  about the caller: they are a deployment-posture capability gate,
  structurally the same as the deploy-API gate declared next to them,
  refusing host-affecting writes when the operator has switched
  authentication off entirely. The doctrine's one-layer rule does not
  name that category, so a venture that has one can report itself
  compliant or in breach on a coin toss. Naming it would fix that.

  **Second, the enforcement claim is wider than the rule.** The entry
  said a lint rule fails the build if authorisation identifiers appear
  anywhere under the route directory. The rule is
  `no-auth-in-route-handler` in `scripts/tooling/design-lint.mjs`, and it
  matches three authentication-token identifiers under the API route
  directory: the token reader, the token comparison, and the session
  cookie name. Its own law text says "Authentication is enforced once",
  which is the accurate word; the report is what drifted. The rule does
  not match the other primitives exported by the very module it guards,
  so a handler that reads the auth mode directly to decide access keeps
  the build green, and the five sites above are live proof that it does.
  One tempting overcount to avoid, because this correction nearly made
  it: the read-only guards are not a gap in that rule. They are a mode
  restriction rather than an authorisation decision, they are correctly
  outside its scope, and they are policed separately by
  `scripts/tooling/check-read-only-guards.mjs`, which forbids them only
  inside GET, HEAD and OPTIONS handlers.

  **The lesson the estate would pay for.** An identifier denylist is a
  good rule and a bad claim. It buys "these three names may not appear
  here". It does not buy "this decision is never made here", and the
  distance between the two is invisible in the green build that seems to
  prove it. A ruling-report that offers the second while shipping the
  first is a shape the harvest should learn to discount on sight, and the
  cheapest test is the one that caught this: ask which identifiers the
  rule actually lists, then grep the guarded directory for every other
  export of the module it guards.

- `2026-08-26 · friction` · **`python -m tools.eos task views` cannot
  regenerate the calling venture's views; it silently regenerates the
  EOS repo's own.** The command is the one both derived files name in
  their own headers ("Regenerated by python -m tools.eos task views"),
  so it is what every venture session will run. `tools/eos/cli.py:14`
  sets `REPO = Path(__file__).resolve().parent.parent.parent`, and the
  views op at `cli.py:651` calls `taskops.render_views(REPO)`. `REPO` is
  the EOS checkout the module was imported from, never the working
  directory, and no `--repo`/`--root` option exists on `task views` to
  override it. Measured here: run from the PatterStage root with
  `PYTHONPATH` pointing at the EOS checkout, the command printed
  `{"regenerated": ["org/TASKS.md", "org/STATE.md"]}` and exited 0,
  PatterStage's two views were byte-identical afterwards, and the EOS
  checkout's own `org/STATE.md` came back modified (its machine-facts
  `commit:` line, stamped from whichever repo git ran in). The success
  report is what makes this expensive: a session reads "regenerated",
  believes the derived view now matches the records, and commits the
  drift. `taskops.render_views(root)` itself takes a root and is
  correct; only the CLI hard-binds it. Calling it directly with the
  venture root regenerated PatterStage's views correctly, findings
  empty, which is the workaround in use here.

  The drift this produced was real and went unnoticed for four task
  records. `org/TASKS.md` reported T-0040 through T-0043 as
  `proposed | unassigned` while all four records read `done` with a
  named owner session, and the two newest records were absent from the
  table entirely. It surfaced in review, not in a gate: nothing in the
  venture's own suite compares the derived view against the records, so
  `npm run lint` passed green throughout. Two suggestions, either of
  which would have caught it. First, accept a root on `task views` (or
  default it to the working directory and require `--repo` for the
  EOS's own), so the documented command does what its documentation
  says. Second, and more valuable to the estate, `build_views` already
  exists precisely so "the writer and the drift check cannot disagree",
  and check E011 already compares. If a venture-runnable form of that
  compare shipped as an exit-code command, every venture could wire it
  into its own gate and derived-view drift would stop being something a
  reviewer has to notice by eye.

- `2026-08-22 · friction` · **The seed check fails a venture for
  generating the derived views the EOS tells it to generate.**
  `kernel/SCALE_MATRIX.md` is explicit that `org/TASKS.md` and
  `org/STATE.md` "are regenerated by the tooling once records exist;
  they are never seed files and never hand-edited", and the D004
  docstring in `tools/eos/checks/seed.py` says the same thing in its own
  words. The checks do not read either statement. `taskops._tasks_view`
  and `_state_view` emit a front-matter block carrying `summary`, `type`,
  `tags` and `derived: true`, and deliberately no `compiled_from`,
  because a generated file has no template ancestry to name. `D001` then
  requires `compiled_from` on any file that has front-matter, and `D003`
  requires an ancestry row in the compile report whose source word is one
  of `authored`, `normalised` or `preserved`. Measured here, read-only:
  the seed stood at 45 errors, `python -m tools.eos task views` was run
  as `AGENTS.md` instructs, and the seed stood at 48. The four new ones
  are two `D001` for the missing `compiled_from` and two `D003` for the
  missing ancestry row, one of each per view. Neither is fixable by the
  venture. Adding `compiled_from` to a derived view is a hand-edit, and
  check `E011` then fails that same file as drift against its generator,
  so the two checks demand opposite bytes. Writing an ancestry row means
  calling a generated file authored, normalised or preserved, and all
  three are false. The result is that an ORG venture with task records
  cannot both follow `AGENTS.md` and pass the seed check. Suggested fix,
  smallest first: have `D001` and `D003` skip any file whose front-matter
  carries `derived: true`. The generator already writes the mark; only
  the checks are not reading it.

- `2026-08-22 · friction` · **`task views` cannot be pointed at a
  venture, only at the EOS itself.** `tools/eos/taskops.render_views`
  takes a root argument and works correctly against any repository. The
  CLI above it does not pass one: `tools/eos/cli.py` sets
  `REPO = Path(__file__).resolve().parent.parent.parent` at import and
  hands that to `render_views`, and the `task` subcommand has no
  `--seed` or `--repo` flag, unlike `check --seed` and `migrate --seed`
  beside it. So the documented invocation regenerates the EOS's own
  views, not the venture's. To regenerate this venture's views the
  session had to import `tools.eos.taskops` and call
  `render_views(venture_root)` directly, which is the same code path
  `E011` compares against and therefore round-trips exactly, but it is a
  library call standing in for a command the contract advertises.
  `tools/CLI_CONTRACTS.md` describes the views op without saying which
  repository it writes to, so nothing there flags the gap. Suggested
  fix: give the `task` subcommand the same `--seed` flag its siblings
  already carry, and default it to the EOS root so existing use is
  unchanged.

- `2026-08-22 · friction` · **The seed check still cannot tell a seed
  file from a repository file.** Half of the 2026-07-25 report is fixed
  and half is not, and the half that is not now costs more than it did.
  `tools/eos/checks/seed.py` walks every markdown file under the seed
  root, minus `SKIP_DIRS`. `E002` fires on any file with no
  front-matter, and `D001` then requires `summary`, `type`, `tags` and
  `compiled_from` on any file that has some. Measured on a real
  application repository at ORG scale, 99 markdown files, and every
  number here is a count of lines in a
  `python -m tools.eos check --seed` run rather than an estimate:
  **157 errors before the front-matter sweep of 2026-08-22 and 45 after
  it.** The sweep completed the front-matter on every file that could
  take one and wrote the ancestry rows that took `D003` from 68 errors
  to none. What it could not reach is the residue, and the residue is
  the report: **44 of the remaining 45 sit on 26 files that cannot take
  front-matter without breaking the product.** Twenty four of the 26 are
  prompt and profile content copied verbatim into a running agent's own
  working directory, where YAML at the top of the file would ship into
  the agent's context as text; 20 of those raise one `E002` each for
  having no block at all, and 4 are skill files that already carry a
  front-matter contract another system owns, raising four `D001` each
  for the four EOS keys that have nowhere to go. The other 2 are issue
  templates whose front-matter contract belongs to the code host, four
  `D001` each. Twenty plus sixteen plus eight is 44. A venture cannot
  pass the gate without mutilating product files, so this venture's
  operator ruled the alternative on 2026-08-22 and the gate is signed
  against a stated deviation. That is an operator-approved deviation on
  a check that is supposed to be mechanical, and it is the cost being
  reported. The 2026-07-25 draft fix still reads true: derive the
  checked set from `SCALE_MATRIX.md` plus the lock-book's add-ons, and
  leave whole-tree conventions to the repo mode, with an opt-out for
  directories that ship verbatim content.

- `2026-08-22 · friction` · **The router's authentication detector
  cannot see a one-layer design, which is the design the binding
  doctrine asks for.** `DOC-IDENT-001` says decide at one layer, not per
  handler. But the only automatic route to the `auth-surface` factor is
  the `paths:auth` signal, and `tools/eos/router.py` raises that by
  matching directory names and file stems against a fixed word set
  (`auth`, `authn`, `authz`, `login`, `sso` and four more). A venture
  that follows the doctrine puts its decision in one interception layer
  above the handlers, and that layer is usually named for what it is in
  its framework rather than for authentication, so it matches nothing. A
  venture that ignores the doctrine and scatters per-handler checks
  through an `auth/` directory matches every time. The detector rewards
  the shape the doctrine warns against. Meanwhile the same file's
  `_PUBLIC_API_MARKERS` contains `api/`, so an ordinary route edit
  floors at R2 through `public-contract` while the change that actually
  moves the authorisation decision floors at R0 unless someone declares
  `touches-auth` by hand. Declaration is the designed backstop and it
  works, but the derived half is pointing the wrong way. Suggested fix:
  raise `paths:auth` from the policy's `sensitive` list as well, so a
  venture can name its own interception layer, or match on the framework
  interception filenames the stack profiles already know.

- `2026-08-22 · ruling-report` · **A worked instance of `DOC-IDENT-001`,
  offered for the identity-access pack.** This venture reached the
  doctrine's rule independently, before the pack existed, and enforces
  it mechanically, so it is offered as evidence rather than as a
  question. The ruling: authorisation is decided once, at a single
  interception layer that every request passes through, and never inside
  a route handler. What forced it was the combination the doctrine's own
  reasoning implies but does not name: a framework that discovers routes
  from the filesystem, plus agents adding routes. Under per-handler
  checks there is no way to distinguish a route that is deliberately
  public from one where the check was forgotten, and a route added by an
  agent inherits whatever the surrounding pattern implies. The
  enforcement is the part worth counting: a lint rule fails the build if
  authorisation identifiers appear anywhere under the route directory,
  so the prohibition is a red build rather than a convention. Ruled
  2026-07, argued not inherited, and still in force at the 2026-08
  recompile. Two notes for the pack. First, this was originally filed as
  a defect: at v1 the `auth` trigger named no wargame in the corpus, so
  the venture drafted its own and ruled against it. The v2 pack closes
  that gap and this entry retires the local draft in favour of citing
  the doctrine. Second, `WG-IDENT-001`'s four options all assume more
  than one kind of user; a single-operator instrument answers its
  preconditions trivially and gets no help from the fork, which may be
  worth a line in the Wargame's own preconditions.

- `2026-08-22 · ruling-report` · **The v2 selection model resolved the
  walk-budget defect independently.** Filed 2026-07-25 against v1's
  `inception/WALK_ORDER.md`, which stopped a walk past twenty rulings
  and prescribed re-ruling scale as the only remedy. The arithmetic made
  the alarm unreachable for any web venture with server state, and the
  remedy amplified the fault it diagnosed. v2 removes the alarm
  entirely: `WALK_ORDER.md` no longer walks a directory, applicable
  Doctrine is inherited, Wargames are selected by matched pressure one
  at a time, and every selection or omission carries a reason. The unit
  is no longer the module pulled in wholesale, which was the defect. No
  action needed; recorded so the harvest can close it.

- `2026-08-22 · ruling-report` · **The structured Rulings record
  resolved the un-auditable-walk defect independently.** Filed
  2026-07-25: v1 distinguished argued from inherited rulings and said
  inherited ones never count as promotion evidence, but no seed file
  recorded the trigger set in the vocabulary that rule used, so nobody
  could check whether an inherited ruling was legitimately inherited.
  The audit that found the one bad case had to re-derive the trigger set
  by hand. v2 records the facts as named predicates, keeps a
  `selection_log` in `org/RULINGS.json` with a disposition and a reason
  per candidate, and check D012 fails the seed if a selection or
  omission has no reason. That is the draft fix, arrived at
  independently. No action needed.

- `2026-08-22 · ruling-report` · **The seed check no longer walks
  `node_modules`.** Filed 2026-07-25 as the mechanical half of a
  two-part defect: the first run reported 1137 errors, of which 1073
  were about vendored dependencies. `tools/eos/repo.py` now carries a
  `SKIP_DIRS` set that includes `node_modules`, and a fresh run on the
  same repository reports 135. Resolved. The second half of that report,
  the seed-versus-repository distinction, is not resolved and is re-filed
  as its own entry at the top of this file.

- `2026-07-25 · friction` · **No stack profile fits an application with
  an embedded database that the user installs and runs themselves.**
  Re-filed unchanged in substance, with the profile list refreshed. The
  lock-book header's `stack:` pin expects a profile from
  `registry/stacks/`. There are now five and none of them fits.
  `STACK-web-static` has no server state. `STACK-fastapi-postgres` and
  `STACK-fullstack-app` both assume a deployed service with a network
  boundary between a front end and a data store, and the second assumes
  a back half that does not exist here. `STACK-local-first-pwa` is the
  closest by name and the furthest by shape: it is a browser-delivered
  product with server rendering switched off, a static adapter and a
  WebAssembly compute core. `STACK-data-compute` is an analytical
  compute profile. The venture is a server-rendered application over an
  embedded database file, distributed as a repository plus an install
  script, deployed by the user onto their own machine. Every existing
  profile assumes a deployed service, so the pins a profile is supposed
  to supply either do not apply or invert: there is no seam between
  front and back because there is no back, the hosting pin is an install
  path instead, and backup and restore are a user duty rather than an
  ops duty. The cost is unchanged: the pin cannot be filled honestly
  from the registry, so it is filled as prose and the seed carries a
  recorded deviation instead of a profile. Draft fix, unchanged: a
  profile for the local-application class, whose distinguishing pins are
  the install path, the migration story for a database the maintainer
  never sees, and restore as a user duty. This class is not exotic. It
  is what a desktop tool, a command-line tool with a web interface, or
  any sovereignty-first product looks like.
