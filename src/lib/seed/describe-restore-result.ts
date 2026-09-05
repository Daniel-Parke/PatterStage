// ═══════════════════════════════════════════════════════════════
// describe-restore-result.ts — what a restore just did, in one sentence
// ═══════════════════════════════════════════════════════════════
//
// The Restore page ran real work and said nothing: an operator clicked
// "Reseed all", watched a spinner, and had no way to tell whether seven agents
// had been installed, whether anything had been pushed to the agent framework,
// or whether the click had done nothing at all because everything was already
// there (T-0100, D17).
//
// Pure, and shared by the page's result line and its toast, so the two can
// never disagree about what happened.

/** The seed route's answer, read loosely so a partial fixture still describes. */
type RestoreResult = Record<string, unknown>;

interface ImportedShape {
  root?: { backupPath?: string | null } | null;
  skills?: unknown[];
  profiles?: unknown[];
}

const num = (result: RestoreResult, key: string): number => {
  const value = result[key];
  return typeof value === "number" ? value : 0;
};

/** "a, b and c" — no Oxford comma, matching the rest of the product's copy. */
function list(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const NAMED: Array<[string, string, string]> = [
  ["profiles", "agent", "agents"],
  ["templates", "template", "templates"],
  ["categories", "category", "categories"],
  ["skills", "skill", "skills"],
  ["tools", "tool bundle", "tool bundles"],
  ["memories", "memory fact", "memory facts"],
];

/**
 * The counts a merge can honestly claim to have ADDED.
 *
 * Categories and memory facts are re-counted on every merge whether or not a
 * row was missing, so a merge that added two agents would otherwise report
 * eight categories it did not install.
 */
const ADDED_KEYS = new Set(["root", "profiles", "templates", "skills", "tools"]);

function countedParts(result: RestoreResult, only?: Set<string>): string[] {
  const wanted = (key: string) => !only || only.has(key);
  const parts: string[] = [];
  if (wanted("root") && num(result, "root") > 0) parts.push("Bob");
  for (const [key, one, many] of NAMED) {
    if (!wanted(key)) continue;
    const n = num(result, key);
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  }
  return parts;
}

/**
 * True only when the Hermes import actually read something.
 *
 * The import short-circuits when it has run before, and still answers a
 * success-shaped object. Counting that as an import would put "Imported your
 * existing Hermes files first" in front of every restore forever.
 */
function importedSomething(result: RestoreResult): boolean {
  const imported = result.imported as ImportedShape | null | undefined;
  if (!imported) return false;
  const skills = Array.isArray(imported.skills) ? imported.skills.length : 0;
  const profiles = Array.isArray(imported.profiles) ? imported.profiles.length : 0;
  return skills + profiles > 0 || imported.root?.backupPath != null;
}

/**
 * One sentence for what a restore did.
 *
 * `name` is the display name of the single profile or template a targeted
 * restore acted on; it is ignored for the whole-pack targets.
 */
export function describeRestoreResult(
  target: string,
  mode: string,
  result: RestoreResult,
  name?: string,
): string {
  const pushed = num(result, "pushed");
  let body: string;

  if (target === "root") {
    body =
      num(result, "root") > 0
        ? `Restored Bob${pushed > 0 ? " and pushed him to Hermes" : ""}`
        : "Bob already had content, nothing changed";
  } else if (target === "profiles" && name) {
    body =
      num(result, "profiles") > 0
        ? `Restored ${name}${
            pushed > 0
              ? " and pushed it to Hermes"
              : ", but could not push it to Hermes (see the agent's sync status)"
          }`
        : `${name} already had content, nothing changed`;
  } else if (target === "templates" && name) {
    body = `Restored the ${name} template`;
  } else if (target === "categories") {
    body = `Restored ${num(result, "categories")} categories`;
  } else if (mode === "merge") {
    const added = [...ADDED_KEYS].reduce((sum, key) => sum + num(result, key), 0);
    body =
      added === 0
        ? "Nothing was missing: everything the pack ships is already installed."
        : `Added what was missing: ${list(countedParts(result, ADDED_KEYS))}${
            pushed > 0 ? ` · pushed ${pushed} ${pushed === 1 ? "agent" : "agents"} to Hermes` : ""
          }`;
  } else {
    const parts = countedParts(result);
    body = `Restored ${parts.length > 0 ? list(parts) : "nothing"}${
      // Agents, not files: the push writes several files per agent and
      // reporting the file count read as a much larger change than it was.
      pushed > 0 ? ` · pushed ${pushed} ${pushed === 1 ? "agent" : "agents"} to Hermes` : ""
    }`;
  }

  const prefix = importedSomething(result) ? "Imported your existing Hermes files first · " : "";
  const backup = result.backup as { path?: string } | null | undefined;
  const suffix = backup?.path ? ` · backup saved: ${backup.path}` : "";
  return `${prefix}${body}${suffix}`;
}
