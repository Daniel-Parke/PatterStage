---
summary: PatterStage adaptive testing law, staged verification, timing by change class, why the test map is not instantiated, quality signals
type: venture
tags: [eos]
compiled_from: kernel/templates/org/TESTING.tpl.md
---

# TESTING · The adaptive law

Tests exist to catch harm at the cheapest moment, so timing follows
the change class and the ruled tier. The router and the capability
profile may tighten any default here; nothing may loosen one below
this floor.

## Timing by change class

| Change | When tests land |
| --- | --- |
| Bug fix | Reproduce first with a failing test; the repro is kept forever |
| Invariants, money, security, personal data, irreversible operations, public contracts | Executable acceptance authored independently before implementation, then frozen |
| Ordinary feature | Alongside implementation |
| Spike | Later, behind the hardening gate; a spike merges nothing |
| Refactor | Characterisation proportional to tier, pinned before the change |
| Docs | No behavioural tests by default; link resolution, executable snippet checks, schema validation and generated-doc drift checks still apply |
| Generated change | Verify the generator, not each output |

Row two is a risk floor. It is not staged, not deferred and not
softened by anything below. Personal data and irreversible operations
join it because the harm they carry is the same shape as money and
security: it reaches someone outside the venture and it does not come
back.

## Staged verification, as a default

This is a default set, not law. The floors above are the law; the
staging is argued. A venture overrides any of it in its lock-book with
a recorded reason.

| Stage | What runs | Switched on by |
| --- | --- | --- |
| Risk floors | The acceptance row above, plus the guard's runtime floors | Day one, unconditionally |
| Cheap executable checks | Build, types, lint, schema, smoke | Day one, before the first feature lane opens |
| Contract tests | The boundary's cases, blocking for its neighbours | The moment that interface is declared stable |
| Comprehensive harness | Regression breadth across the product | When the stability signals below fire |
| Deletion | Tests that only protect retired structure | The same change that retires the structure |

Executable is the operative word in the cheap tier. A tier that is a
list in this file and not a command that exits non-zero buys nothing,
and a check named as a gate that cannot go red is documentation.

The comprehensive harness is derived from the product map and the
specifications rather than read off the code, authored or reviewed by
someone other than the implementing agent, and mutation-checked before
it blocks anything. A harness nobody has seen fail is an instrument
nobody has calibrated.

Default stability signals, and these are starting values to be
overridden rather than measured thresholds:

- Every journey green on the acceptance spine.
- Three consecutive integrations with no interface churn.
- A flat trend in open defects across the same window.

**No percentage gates any of this.** Not coverage, and not how much of
the product is finished. We found no standard, study or mature practice
that gates rigour on a completeness figure; the precedents gate on
consequence class and on measured behaviour. While the harness is
deferred, name the deferral at the retro, because deferred breadth is a
loan and nobody sees the interest until it is due.

## The test map: NOT INSTANTIATED HERE

The kernel template this file is compiled from describes a queryable
test map: a derived artefact whose generator the stack profile names,
every row carrying a confidence score built from generator freshness,
path coverage and recent miss history, with low confidence widening the
run. **None of that exists in PatterStage.** There is no map, no
generator and no confidence score, and the stack profile that was
supposed to name the generator does not exist either: the lock-book
records that no registry profile fits and pins the stack as authored
prose (`docs/LOCKBOOK.md`, the `stack:` field). Nothing in this
repository consumes or produces such an artefact.

**The resolution in force until a generator exists.** Affected suites
are selected by hand, from the layout table in `docs/TESTING.md`, by
the agent making the change. `npm test` is the whole Jest suite, and
both build-and-test jobs in CI run `npm run test:coverage` over all of
it, so a full run is always available and is the honest fallback when
the affected set is unclear. Widen rather than guess. Full suites run
at integration and at release, by tier, as below.

Anything below that says "the map" means this manual selection. Do not
write instructions that assume the artefact, and do not treat a
selection made this way as evidence of anything more than the reasoning
recorded beside it.

## Verification by mode

- Express: targeted checks only, the affected tests plus lint and
  types on the touched scope.
- Standard: affected tests, selected by hand per the section above;
  sampled review.
- Exploration: checks may wait, inside the spike only; the hardening
  gate runs everything the ruling demands before anything merges.
- High-assurance: the frozen acceptance oracle, the full affected
  surface, independent review at acceptance.
- Parallel: no fan-out without a verifier that predates the lanes and
  was not written by the agents it judges, and lane count set by what
  that verifier can actually judge; then per lane before merge,
  affected plus shared contract tests; rolling integration checks after
  each merge; the full suite at release.

## Quality signals

- Requirements coverage: acceptance criteria ids map to test ids,
  enforced at High-assurance.
- Mutation strength on protected modules, measured at hardening.
- Pass-to-pass regression rate across the suite.

Coverage percentage is never a universal gate. A project may ratchet
a specific number only with recorded evidence and a written reason,
and the ratchet is revisited at retro.

## Timing defaults, and what the capability profile decides

Neither test-first nor end-stage testing is mandated universally. What
binds is that the check deciding whether a change is correct was not
authored by the agent holding that implementation in its context, and
that it has been seen to fail at least once. Ordering is free.

`org/policy.json` sets `test_timing` per mode, and some modes set it to
`per-profile`. Resolve that here. The timing table at the top of this
file is the answer; there is no second copy anywhere else, and if you
find one, this file wins.

The capability-profile record that `org/policy.json` names decides three
things and no more. It is a record a person reads, not a file any code
loads:

- `level` picks how far the Express thresholds, the free decision band
  and the review sampling rate loosen. It never moves a tier floor and
  it never changes a row in the table above.
- `expires` ends that. Past the date the profile reads as
  `conservative`, whatever `level` says.
- `regression_rule` says what pulls the level back down: escaped
  defects over its stated maximum, or a sampled-review pass rate under
  its stated minimum. A threshold with no measurements behind it is not
  evaluable, and the profile is expected to say so rather than imply a
  pass.

Everything else in that record is provenance for those three.

## The floor

A failing check is never weakened, skipped or deleted to pass, in any
mode, at any tier. A check believed wrong is escalated through the
oracle amendment workflow or a question, with the reasoning on
record.

## Where these defaults come from

The timing table is argued, with its figures, in
`packs/delivery-testing/wargames/WG-DEL-007-test-timing.md` at the EOS
commit this venture pins. The short of it: a timing ablation run in the
EOS on 2026-08-03 found every arm passing, so the cells stand on cost
and on independence and say nothing about which timing catches more
faults. Row two is unaffected either way, being a risk floor rather
than a timing preference.

The staging table has no comparable measurement behind it. No
controlled comparison of building the harness early against building it
on stability signals was found, so it is a default with an argument,
and its signals are starting values this venture is expected to replace
with its own.
