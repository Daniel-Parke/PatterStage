// Materialise the review-to-plan assignment without changing the T-0164 ledgers.
// Each entry is an accountable plan disposition, not permission to edit source.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rows = (name) => readFileSync(join(root, "org/reviews", name), "utf8")
  .trim().split("\n").map((line) => JSON.parse(line));
const findings = rows("2026-09-t0164-findings.jsonl");
const coverage = rows("2026-09-t0164-coverage.jsonl");

const deliberateKeep = new Set([
  "app-22", "app-24", "tooling-33", "lib-data-08", "lib-data-18", "org-19",
  "hooks-03", "hooks-10", "hooks-19", "hooks-23", "cross-cutting-24",
  "critic-02", "critic-15",
]);
const specific = new Map([
  ["critic-01", "T-0181"], ["critic-06", "T-0196"],
  ["critic-14", "T-0181"], ["tooling-29", "T-0180"],
  ["app-15", "T-0200"], ["docs-04", "T-0200"],
  ["tooling-02", "T-0199"], ["tooling-12", "T-0186"],
  ["org-11", "T-0187"],
  ["lib-data-05", "T-0199"], ["critic-08", "T-0200"],
  ["critic-05", "T-0197"], ["critic-07", "T-0196"],
  ["lib-domains-12", "T-0194"], ["app-03", "T-0186"],
]);
function findingTask(id) {
  if (specific.has(id)) return specific.get(id);
  if (id.startsWith("lib-data-")) return "T-0189";
  if (id.startsWith("lib-domains-")) return "T-0194";
  if (id.startsWith("components-")) return "T-0191";
  if (id.startsWith("hooks-")) return "T-0190";
  if (id.startsWith("app-")) return "T-0192";
  if (id.startsWith("tests-")) return "T-0195";
  if (id.startsWith("tooling-")) return "T-0196";
  if (id.startsWith("docs-")) return "T-0197";
  if (id.startsWith("org-")) return "T-0198";
  if (id.startsWith("cross-cutting-")) return "T-0192";
  if (id.startsWith("critic-")) return "T-0182";
  throw new Error(`unassigned finding: ${id}`);
}

const findingOwners = findings.map((row) => {
  if (row.status === "refuted") return {
    id: row.id, outcome: "ruled-out", task: null,
    reason: `T-0164 independent current-tree verdict refuted the proposed finding: ${row.uncertainty}`,
  };
  if (row.id === "app-23") return {
    id: row.id, outcome: "deferred", task: null,
    reason: `Operator keeps the existing guards; build proof remains pending before any reconsideration: ${row.uncertainty}`,
  };
  if (deliberateKeep.has(row.id)) return {
    id: row.id, outcome: "ruled-out", task: null,
    reason: `Existing operator keep or accepted-risk ruling controls this source observation: ${row.ruling}`,
  };
  return {
    id: row.id, outcome: "planned", task: findingTask(row.id),
    reason: `Reverify this T-0164 source-level observation and its item ruling before any edit: ${row.uncertainty}`,
  };
});

const splitOverrides = new Map([
  ["critic-05a", ["ruled-out", null, "Operator accepted the existing method/path/time signature without a body hash."]],
  ["critic-05b", ["planned", "T-0200", "Fold the ruled x-ch signing alias retirement into cross-cutting-04b in the first post-1.0 release; document the accepted body-hash gap separately."]],
  ["critic-05c", ["already-addressed", null, "Canonical PS signing cases are present in tests/unit/api-auth.test.ts:59-90."]],
  ["app-01h", ["planned", "T-0192", "Add the ruled caller gate for four documented, uncalled operator routes."]],
  ["app-01e", ["ruled-out", null, "Keep the live REST cancel route and its smoke caller."]],
  ["app-01f", ["ruled-out", null, "Keep the documented single-run read and smoke caller."]],
  ["app-01g", ["ruled-out", null, "Keep the reconciliation route and its four smoke callers."]],
  ["app-01a", ["planned", "T-0192", "Keep the manual sweep route and label its API reference row as an operator action with no UI caller."]],
  ["app-01b", ["planned", "T-0192", "Keep progression history and label its API reference row as having no UI caller yet."]],
  ["app-01c", ["planned", "T-0192", "Keep the provider status route and label its API reference row as having no UI caller."]],
  ["app-01d", ["planned", "T-0192", "Keep the documented operator route and add its item-specific API reference label."]],
  ["app-04a", ["already-addressed", null, "T-0154 widened the detector; preserve its held measure."]],
  ["app-15b", ["ruled-out", null, "Keep the two-hop chain until its Q-011 retirement date."]],
  ["cross-cutting-04a", ["planned", "T-0200", "Retire env aliases only in the first post-1.0 release with tripwire."]],
  ["cross-cutting-04b", ["planned", "T-0200", "Retire x-ch signing headers and CH signing secret with the other aliases."]],
  ["cross-cutting-14a", ["planned", "T-0194", "Converge the shared escape helper while preserving rendered output."]],
  ["cross-cutting-14b", ["planned", "T-0191", "Use the ruled SimpleMarkdown renderer with Copy and guarded links."]],
  ["cross-cutting-21a", ["planned", "T-0190", "Guard the four browser-storage calls without renaming stored keys."]],
  ["cross-cutting-21b", ["ruled-out", null, "Existing browser storage prefixes remain by operator choice."]],
  ["cross-cutting-23a", ["ruled-out", null, "Keep existing batch-named suites; only new suites use subject-first names."]],
  ["cross-cutting-23b", ["ruled-out", null, "Pre-rename seed_key values remain to protect existing database uniqueness."]],
  ["cross-cutting-23c", ["planned", "T-0195", "Document the subject-first rule for new suites without moving historical tests."]],
  ["cross-cutting-03a", ["planned", "T-0196", "Keep the ruled boolean environment vocabulary in tooling and CI."]],
  ["cross-cutting-03b", ["planned", "T-0194", "Move shared env reads to the parity-tested table without retiring names early."]],
  ["tooling-10b", ["planned", "T-0187", "Delete only the five dev-only ch hardware shims before v1.0.0 under their specific ruling; preserve installed data-dir copies and the separately ruled ch-backup shim."]],
  ["tooling-11a", ["planned", "T-0200", "Retire ch-deploy and ch-backup shims only after v1.0.0."]],
  ["tooling-11b", ["planned", "T-0196", "Keep ch_data, ch_hermes and /data/ch so existing Compose data remains mounted; add why-comments to the Compose files."]],
  ["tooling-11c", ["planned", "T-0199", "Remove the no-op dead library after caller and documentation checks."]],
  ["tooling-11d", ["ruled-out", null, "ps-relocate and historical control-hub.db discovery remain supported."]],
  ["tooling-12a", ["planned", "T-0186", "Delete the ruled live-destructive Hindsight rederive script before release."]],
  ["tooling-12b", ["ruled-out", null, "The conditional EOS_ROOT edit was rejected when the operator chose org-11 retirement; T-0187 owns that retirement and its evidence."]],
  ["tooling-12c", ["ruled-out", null, "Keep idempotent migrate-to-runtime for older installations."]],
  ["tooling-30a", ["deferred", null, "Required checks and branch-protection settings are operator-controlled GitHub changes."]],
  ["tooling-30b", ["deferred", null, "The operator installs the pre-push hook; repository checks can verify its instructions only."]],
  ["lib-data-09b", ["ruled-out", null, "Keep the sync_registry table and historical rows under ADR-0004."]],
  ["hooks-15b", ["ruled-out", null, "Keep the theme token mirror while removing only the empty map."]],
  ["docs-03b", ["deferred", null, "The operator owns release narrative; executor corrects only the factual docs-03a count."]],
  ["docs-05a", ["deferred", null, "A superseding accepted ADR is required before changing the protected governing token rule."]],
  ["docs-05b", ["planned", "T-0197", "Correct the repository-guide count and factual mechanics without editing the protected rule."]],
  ["docs-19a", ["ruled-out", null, "Preserve EOS metadata keys as ruled by the operator."]],
  ["lib-domains-05b", ["ruled-out", null, "Keep MODULE_ACCENTS by operator ruling."]],
  ["lib-domains-05c", ["ruled-out", null, "Keep the four declared test-only APIs by operator ruling."]],
  ["lib-domains-13a", ["ruled-out", null, "Keep the ruled Hermes prompt envelope."]],
  ["lib-domains-13b", ["deferred", null, "The log location move is deferred by operator ruling."]],
  ["lib-domains-14a", ["ruled-out", null, "Keep historical on-disk database discovery and ps-relocate."]],
  ["org-01a", ["already-addressed", null, "Accepted ADR-0011 ratified the four protected path lines."]],
  ["org-01b", ["already-addressed", null, "Closed historical task records were restored under Q-010; do not rewrite them again."]],
  ["org-12a", ["deferred", null, "The operator owns final retirement of the rescued Cursor worktree."]],
]);
const parentOwner = new Map(findingOwners.map((row) => [row.id, row]));
const operatorDispositions = findings.flatMap((parent) => (parent.operatorDispositions ?? []).map((decision) => {
  const inherited = parentOwner.get(parent.id);
  const override = splitOverrides.get(decision.id);
  const [outcome, task, reason] = override ?? [inherited.outcome, inherited.task, `Reverify the item-specific ${decision.kind} disposition against its accepted decision and parent qualification.`];
  return { id: decision.id, parentId: parent.id, outcome, task,
    reason: `${decision.record}; ${reason}` };
}));

const gapTask = (number) => {
  if (number === 5) return "T-0180";
  if (number <= 2) return "T-0181";
  if (number <= 3 || number === 6 || number === 7 || number === 105) return "T-0182";
  if (number === 4 || number === 8 || (number >= 25 && number <= 34) || number === 82 || number === 83 || number === 86 || number === 98) return "T-0196";
  if (number === 9 || (number >= 35 && number <= 43) || number === 104) return "T-0189";
  if (number >= 10 && number <= 14) return "T-0194";
  if (number >= 15 && number <= 24) return "T-0195";
  if (number >= 44 && number <= 54) return "T-0191";
  if (number >= 55 && number <= 63) return "T-0192";
  if (number >= 64 && number <= 70) return "T-0190";
  if (number === 71 || number >= 101) return "T-0194";
  if (number >= 72 && number <= 80) return "T-0197";
  if (number === 81 || number >= 84 && number <= 88) return "T-0192";
  if (number >= 89 && number <= 100) return "T-0198";
  throw new Error(`unassigned gap parent: ${number}`);
};
const externalDeferred = new Set([
  "gap-002.b", "gap-002.c", "gap-003.b", "gap-003.c",
  "gap-037.1", "gap-037.2", "gap-058.2",
  "gap-079.a", "gap-079.b", "gap-079.c",
  "gap-097.b", "gap-099.a",
]);
const proofTask = new Map([
  ["gap-033.a", "T-0188"], ["gap-059.2", "T-0193"],
  ["gap-083.b", "T-0196"], ["gap-090.a", "T-0191"],
  ["gap-101.a", "T-0195"],
]);
const coverageOwners = coverage.map((row) => {
  if (row.status === "verified") return {
    id: row.id, outcome: "already-addressed", task: null,
    reason: `T-0164 and its independent sceptic verified this narrow fact, not the entire parent claim: ${row.evidence}`,
  };
  if (externalDeferred.has(row.id)) return {
    id: row.id, outcome: "deferred", task: null,
    reason: `External, historical or operator-owned proof remains outstanding: ${row.nextProof}`,
  };
  const parent = Number.parseInt(row.parentId.slice(-3), 10);
  return {
    id: row.id, outcome: "planned", task: proofTask.get(row.id) ?? gapTask(parent),
    reason: `Run this T-0164 atomic next proof before closing its owner batch: ${row.nextProof}`,
  };
});

const output = {
  sourceRevision: "1d6b23d1745eac47918ac7ff70fc2a950b783304",
  rule: "Each id points to the detailed T-0164 source, revision, evidence, sceptic, ruling and uncertainty. Planned means the owning batch must reverify; it does not authorise a change. Deferred proofs retain their exact nextProof in that ledger.",
  findings: findingOwners,
  operatorDispositions,
  coverage: coverageOwners,
};
writeFileSync(join(root, "org/plans/2026-09-refactor-ownership.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`ownership: ${findingOwners.length} findings, ${operatorDispositions.length} split decisions, ${coverageOwners.length} atomic proofs`);
