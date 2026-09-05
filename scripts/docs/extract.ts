// ═══════════════════════════════════════════════════════════════
// scripts/docs/extract.ts — the generated-block extractor
//
// Nine facts in the documentation are already written down somewhere a machine
// can read: the achievements, the analytics taxonomy, the lint chain, the
// settings sections, the seed manifests, the API route tree, the head of the
// migration chain, the quest definitions and the environment variables in
// .env.example. Every one of them has drifted in prose at least once — the API
// inventory asserted an invariant that three routes broke — so instead of being
// retyped they are fenced between markers and regenerated:
//
//   npm run docs:generate          rewrite every fence, in place
//   npx tsx scripts/docs/extract.ts   check only: print the diff, exit 1 if stale
//
// The marker syntax is not repeated here. findGeneratedBlocks and
// replaceGeneratedBlock live in ./lib.mjs, which build-site.mjs, check.mts and
// the oracle all read, so there is one definition of what a fence is.
//
// EVERY import at module scope is a node builtin or that pure sibling, and the
// app's own modules are pulled in lazily inside generateBlock(). That split is
// load-bearing and is asserted by tests/unit/b15-generated-blocks.test.ts: a
// top-level `@/lib/...` import would drag better-sqlite3, the database and the
// whole analytics tree into `npm run lint` just to render a markdown table.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { GENERATED_BLOCK_IDS, findGeneratedBlocks, replaceGeneratedBlock } from "./lib.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DOCS = join(ROOT, "docs");

/** Repo-root-relative and forward-slashed, so a printed path reads the same on every host. */
function rel(absolute: string): string {
  return relative(ROOT, absolute).split(sep).join("/");
}

function readText(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf-8");
}

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readText(...parts)) as T;
}

/**
 * Codepoint order, not `localeCompare`. A locale collation folds punctuation
 * away — it files `/[id]/toolsets` above `/[id]` — so the order of a gated
 * table would depend on the host's locale data.
 */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A table cell can hold any prose the source holds; a bare pipe would end the row. */
function cell(value: unknown): string {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function table(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines = [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`];
  for (const row of rows) lines.push(`| ${row.map(cell).join(" | ")} |`);
  return lines.join("\n");
}

// ── the nine ──────────────────────────────────────────────────

async function achievementsBlock(): Promise<string> {
  const derive = await import("../../src/lib/stats/derive");
  return table(
    ["Achievement", "Tier", "Points", "Unlocked by"],
    derive.ACHIEVEMENT_DEFS.map((def) => [
      def.name,
      derive.achievementTier(def.id),
      derive.achievementPoints(def.id),
      def.description,
    ]),
  );
}

/**
 * The taxonomy, with the column that actually matters to a reader: whether a
 * type counts toward Completionist. Three failure types and the not-yet-emitted
 * ones are deliberately outside that list, and a hand-written table forgot it.
 */
async function eventTypesBlock(): Promise<string> {
  const types = await import("../../src/lib/analytics/event-types");
  const completionist = new Set<string>(types.COMPLETIONIST_EVENT_TYPES);
  return table(
    ["Event type", "Counts toward Completionist"],
    types.ANALYTICS_EVENT_TYPES.map((t) => [`\`${t}\``, completionist.has(t) ? "yes" : "no"]),
  );
}

/** `npm run lint` is one long `&&` chain; the docs list it a step per line. */
function lintStepsBlock(): string {
  const pkg = readJson<{ scripts: Record<string, string> }>("package.json");
  const steps = pkg.scripts.lint
    .split("&&")
    .map((s) => s.trim())
    .filter(Boolean);
  return steps.map((step, i) => `${i + 1}. \`${step}\``).join("\n");
}

async function configSectionsBlock(): Promise<string> {
  const sections = await import("../../src/lib/config-sections");
  return table(
    ["Group", "Sections", "What it covers"],
    sections.SETTINGS_GROUPS.map((group) => [
      group.label,
      group.sectionIds.map((id) => `\`${id}\``).join(", "),
      group.description,
    ]),
  );
}

/**
 * What ships in data/seed/. Each manifest holds exactly one array — the facts,
 * the profiles, the skills, the tools — so the kind is read off the key rather
 * than kept in a list here that would go stale the first time one is added.
 */
function seedManifestsBlock(): string {
  const seedRoot = join(ROOT, "data", "seed");
  const rows: string[][] = [];
  for (const entry of readdirSync(seedRoot, { withFileTypes: true }).sort((a, b) => compare(a.name, b.name))) {
    if (!entry.isDirectory()) continue;
    const manifest = join(seedRoot, entry.name, "manifest.json");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(readFileSync(manifest, "utf-8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const listed = Object.entries(parsed).find(([, value]) => Array.isArray(value));
    if (!listed) continue;
    rows.push([
      `\`${rel(manifest)}\``,
      String(parsed.version ?? "—"),
      `${(listed[1] as unknown[]).length} ${listed[0]}`,
    ]);
  }
  return table(["Manifest", "Version", "Entries"], rows);
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/**
 * Every `route.ts` under src/app/api, with the verbs it actually exports.
 *
 * Read off the tree rather than the router: the inventory's whole claim is "a
 * route absent from this table does not exist", and only the filesystem can
 * settle that. Purposes stay hand-written beside the fence — a machine can list
 * the doors, not say what is behind them.
 */
function apiRoutesBlock(): string {
  const apiRoot = join(ROOT, "src", "app", "api");
  const found: { path: string; verbs: string[] }[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== "route.ts") continue;
      const source = readFileSync(full, "utf-8");
      found.push({
        path: `/api/${relative(apiRoot, dir).split(sep).join("/")}`,
        verbs: HTTP_METHODS.filter((m) =>
          new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${m}\\b`).test(source),
        ),
      });
    }
  };

  walk(apiRoot);
  found.sort((a, b) => compare(a.path, b.path));
  return table(
    ["Route", "Methods"],
    found.map((r) => [`\`${r.path}\``, r.verbs.map((v) => `\`${v}\``).join(", ") || "—"]),
  );
}

/**
 * The head of the migration chain, from the migrations directory itself.
 *
 * The applier constants live one per file in src/lib/db/, and importing any of
 * them means importing better-sqlite3. The filenames carry the same numbers and
 * are the thing `npm run db:migrate` walks, so the directory is the cheaper and
 * equally true source.
 */
function schemaHeadBlock(): string {
  const dir = join(ROOT, "src", "lib", "db", "migrations");
  const files = readdirSync(dir)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();
  const head = files[files.length - 1];
  const version = Number.parseInt(head.slice(0, head.indexOf("_")), 10);
  return [
    `Schema version **${version}**, set by \`src/lib/db/migrations/${head}\`.`,
    "",
    `${files.length} migrations make up the chain, from \`${files[0]}\` to \`${head}\`; ` +
      "`npm run db:migrate` applies them in order and is idempotent.",
  ].join("\n");
}

/**
 * B17 writes the quest chains; until it does, this block says so in the page
 * rather than throwing. A gate that cannot run because one of nine facts is not
 * in the tree yet stops gating the other eight.
 */
/**
 * The quest ledger, from the defs themselves.
 *
 * Generated rather than typed out because a quest's proof is the one thing a
 * reader most needs to trust: a page that SAYS a quest is proved by
 * `mission.dispatched` while the code reads `mission.completed` is worse than a
 * page that says nothing. The proof is rendered in plain words, because
 * "proved by the mission.dispatched event, twice" is what an operator can
 * check against their own history and `{kind:"event",target:2}` is not.
 */
async function questsBlock(): Promise<string> {
  const { QUEST_CHAPTERS, QUEST_DEFS, CONCEPT_LABELS, HOST_REQUIREMENT_COPY } = await import(
    "../../src/lib/quests/quest-defs.ts"
  );

  const proofWords = (proof: { kind: string; event?: string; fact?: string; target: number }): string => {
    if (proof.kind === "event") {
      const times = proof.target === 1 ? "once" : proof.target === 2 ? "twice" : `${proof.target} times`;
      return `proved by the \`${proof.event}\` event, ${times}`;
    }
    return proof.target === 1
      ? `proved by the store: \`${proof.fact}\``
      : `proved by the store: ${proof.target} or more \`${proof.fact}\``;
  };

  const lines: string[] = [];
  for (const chapter of QUEST_CHAPTERS) {
    lines.push(`### ${chapter.number}. ${chapter.title}`, "", chapter.blurb, "");
    lines.push("| Quest | What to do | Proof | Screen | Teaches | Earns |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const q of QUEST_DEFS.filter((d) => d.chapter === chapter.number)) {
      const teaches = q.teaches.length
        ? q.teaches.map((t) => CONCEPT_LABELS[t]).join(", ")
        : "-";
      const cells = [
        `**${q.id}** ${q.title}`,
        q.action,
        proofWords(q.proof),
        `\`${q.screen}\``,
        teaches,
        q.earns ? `\`${q.earns}\`` : "-",
      ];
      lines.push(`| ${cells.join(" | ")} |`);
    }
    lines.push("");
    const gated = QUEST_DEFS.filter((d) => d.chapter === chapter.number && d.requires);
    for (const q of gated) {
      lines.push(`On a host without it, **${q.id}** says: ${HOST_REQUIREMENT_COPY[q.requires!]}`, "");
    }
    for (const also of chapter.seeAlso ?? []) {
      lines.push(`See also, untracked: [${also.label}](${also.href}).`, "");
    }
  }
  return lines.join("\n").trimEnd();
}

/**
 * The environment table, read from .env.example.
 *
 * Every variable in there is commented out except the ones that ship set, and
 * the comment above a line is its explanation, so the file already is the table;
 * it just needed transposing. Three kinds of comment line are not an
 * explanation of anything and are dropped: the file's own opening title, the
 * `── section ──` rules, and a line that is itself a commented-out variable in
 * some other spelling (`(alias) CONTROL_HUB_DATA_DIR=`), which would otherwise
 * be read as prose about whichever variable came next.
 */
function envTableBlock(): string {
  const lines = readText(".env.example").split(/\r?\n/);
  const rows: string[][] = [];
  let note: string[] = [];

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const assignment = /^#?\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(trimmed);
    if (assignment) {
      const [, name, rawValue] = assignment;
      const value = rawValue.trim();
      const commented = trimmed.startsWith("#");
      rows.push([
        `\`${name}\``,
        value ? `\`${value}\`${commented ? " (commented out)" : ""}` : commented ? "unset" : "empty",
        note.join(" "),
      ]);
      note = [];
      continue;
    }

    if (!trimmed.startsWith("#")) continue;
    if (index === 0 || /[─═]{2,}/.test(trimmed)) continue;
    const prose = trimmed.replace(/^#+\s?/, "").trim();
    if (!prose || /[A-Z][A-Z0-9_]{2,}\s*=/.test(prose)) continue;
    note.push(prose);
  }

  return table(["Variable", "Value in `.env.example`", "What it is"], rows);
}

// ── the public entry point ────────────────────────────────────

/**
 * The current body of one fence. Async throughout: four of the nine read the
 * app's own modules, and they are imported here rather than at the top so that
 * loading this file costs nothing but node builtins.
 */
export async function generateBlock(id: string): Promise<string> {
  switch (id) {
    case "achievements":
      return achievementsBlock();
    case "event-types":
      return eventTypesBlock();
    case "lint-steps":
      return lintStepsBlock();
    case "config-sections":
      return configSectionsBlock();
    case "seed-manifests":
      return seedManifestsBlock();
    case "api-routes":
      return apiRoutesBlock();
    case "schema-head":
      return schemaHeadBlock();
    case "quests":
      return questsBlock();
    case "env-table":
      return envTableBlock();
    default:
      throw new Error(
        `docs:generate: no extractor for generated block "${id}". ` +
          `The nine the pipeline knows are ${GENERATED_BLOCK_IDS.join(", ")}.`,
      );
  }
}

// ── the CLI ───────────────────────────────────────────────────

interface DocFile {
  path: string;
  source: string;
}

function markdownFiles(dir: string, out: DocFile[] = []): DocFile[] {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => compare(a.name, b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, out);
    else if (entry.name.endsWith(".md")) out.push({ path: rel(full), source: readFileSync(full, "utf-8") });
  }
  return out;
}

/**
 * The differing middle of two bodies, with the shared head and tail trimmed
 * away. A generated table is mostly unchanged on any real edit, and printing
 * two hundred identical rows around the one that moved is how a diff stops
 * being read.
 */
function printDiff(path: string, id: string, current: string, fresh: string): void {
  const a = current.split("\n");
  const b = fresh.split("\n");
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) {
    tail += 1;
  }
  console.error(`docs:generate: ${path} block "${id}" is stale`);
  for (const line of a.slice(head, a.length - tail)) console.error(`  - ${line}`);
  for (const line of b.slice(head, b.length - tail)) console.error(`  + ${line}`);
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const files = markdownFiles(DOCS);
  const known = new Set<string>(GENERATED_BLOCK_IDS);

  const cache = new Map<string, string>();
  const bodyFor = async (id: string): Promise<string> => {
    if (!cache.has(id)) cache.set(id, await generateBlock(id));
    return cache.get(id) as string;
  };

  // Stale is "this fence holds the wrong text", which --write fixes. Broken is
  // "this fence cannot be regenerated at all" — a typo'd id, a missing closing
  // marker — which --write cannot fix and which both modes must still refuse.
  let stale = 0;
  let broken = 0;
  let rewritten = 0;
  let fences = 0;

  for (const file of files) {
    let next = file.source;
    for (const block of findGeneratedBlocks(file.source)) {
      if (!known.has(block.id)) {
        console.error(
          `docs:generate: ${file.path} fences "${block.id}", which is not one of the nine generated blocks.`,
        );
        broken += 1;
        continue;
      }
      if (!block.closed) {
        console.error(`docs:generate: ${file.path} block "${block.id}" has no closing marker.`);
        broken += 1;
        continue;
      }
      fences += 1;
      const fresh = await bodyFor(block.id);
      if (fresh === block.body) continue;
      if (write) {
        next = replaceGeneratedBlock(next, block.id, fresh);
        rewritten += 1;
      } else {
        printDiff(file.path, block.id, block.body, fresh);
        stale += 1;
      }
    }
    if (write && next !== file.source) writeFileSync(join(ROOT, file.path), next, "utf-8");
  }

  if (write) {
    console.log(`docs:generate: ${fences} generated blocks across ${files.length} pages, ${rewritten} rewritten`);
    process.exit(broken > 0 ? 1 : 0);
  }

  if (stale + broken > 0) {
    if (stale > 0) {
      console.error(`\n${stale} generated block(s) are out of date. Regenerate them:\n\n  npm run docs:generate\n`);
    }
    if (broken > 0) {
      console.error(`${broken} fence(s) cannot be regenerated at all; fix the marker or the id by hand.\n`);
    }
    process.exit(1);
  }
  console.log(`docs:generate: ${fences} generated blocks across ${files.length} pages, all current`);
}

// Only when run as a command. check.mts imports generateBlock from here, and an
// import that also ran the CLI would rewrite the tree from inside a gate.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
