# T-0192 type ownership, bounded library cohort

Cross18: remove the twelve core/Hermes library imports of component-owned
types. This is dependency-direction cleanup, not a claimed line reduction.
Do not change runtime imports, values, public type shapes or historical paths.
The exact 21 production claims are coordinator-owned. Galileo owns only
`tests/unit/type-owner-equivalence.test.ts`, in validation until integration.

Canonical owners: MissionTemplate and ManagedCategory in mission-types;
DriftLine and SyncDrift in model-types; HistogramBin, StackedPoint,
StackedSeries, AreaPoint, NeonColor, ToastType and FeedbackContextValue in
types/console. Preserve all old type exports and re-exports. Keep driftLineKey,
React contexts, components and rendering helpers in their original modules.
Keep NeonColor distinct from AccentColor and preserve the optional toast
cleanup return. Hook imports through compatible old re-exports remain; the
hook layer already owns UI coordination. No generic new type module.

Before implementation, capture current candidate hashes, pinned compiler
options, emitted JavaScript and exact public type contracts. Use source-informed
metamorphic proof, explicitly qualified as TypeScript-emitter equivalence,
not Next/SWC bundle or browser evidence. Add in-memory negative controls for a
required-field change, toast return change and executable-statement change.
Do not execute application code or add historical test retirements. Keep the
oracle concise and check its own types and lint before review and red freeze.

Submit exact hash, red counts, passing controls and reproducible evidence for
Laplace review. No production writes before freeze. All runtime and UI gates
remain required after the move, and net line growth must be measured honestly.
