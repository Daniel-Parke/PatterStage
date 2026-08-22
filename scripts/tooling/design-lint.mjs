// scripts/tooling/design-lint.mjs
//
// Dependency-free enforcement of the laws this repo keeps breaking.
//
// WG-WEB-013 ruled that design law is enforced by "docs, plus colocated law
// headers, plus a dependency-free lint inside the standard lint command, with
// pragma escapes carrying written reasons". PatterStage shipped the docs and
// none of the lint, and the 2026-07 review found the predictable result: a
// typo'd token shipping two dead CSS classes, an entire hover treatment Tailwind
// never compiles, and an AGENTS.md instructing contributors to write custom
// properties that do not exist.
//
// A rule that is not a red build does not exist.
//
// ── The baseline ────────────────────────────────────────────────────────────
// Turning eleven rules on against 79k lines produces hundreds of failures, and a
// gate that is red on day one gets deleted rather than fixed. So violations that
// exist TODAY are recorded in design-lint.baseline.json and allowed; the gate
// fails on anything NEW, and on any file whose count grows. The baseline only
// ever shrinks — `--update-baseline` after a genuine cleanup.
//
//   node scripts/tooling/design-lint.mjs                  # gate (runs in npm run lint)
//   node scripts/tooling/design-lint.mjs --report         # every violation, grouped
//   node scripts/tooling/design-lint.mjs --update-baseline

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "fs";
import { join, relative, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BASELINE_PATH = join(ROOT, "scripts", "tooling", "design-lint.baseline.json");

const SCAN_DIRS = ["src", "docs"];
const SCAN_EXTS = new Set([".ts", ".tsx", ".css", ".md"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "images"]);

/** `// design-lint-disable-next-line <rule> -- <reason>` — the reason is required. */
const PRAGMA = /design-lint-disable-next-line\s+([\w-]+)\s+--\s+\S/;

const rel = (p) => relative(ROOT, p).split(sep).join("/");

const RULES = [
  {
    id: "no-ch-custom-properties",
    law: "The shell/effect custom properties are --ps-*. There are no --ch-* variables; writing one produces CSS that silently does nothing.",
    files: (f) => f.startsWith("src/"),
    pattern: /--ch-[a-z0-9-]+/,
  },
  {
    id: "no-template-literal-tailwind",
    law: "Tailwind scans source statically. A class assembled from a template literal (`border-${token}`) is never generated, so the style silently does not exist.",
    files: (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
    // Anchored on Tailwind's utility prefixes so a filename or a React key
    // (`agent-card-${id}.json`) is not mistaken for a class. The second branch
    // catches an opacity modifier applied to an interpolated class, which fails
    // the same way: `${iconColorMap[c]}/60`.
    pattern:
      /\b(?:text|bg|border|ring|shadow|from|via|to|fill|stroke|outline|decoration|accent|divide|placeholder)-\$\{|\$\{[^}]+\}\/\d+/,
  },
  {
    id: "no-raw-colour-in-tsx",
    law: "Colour comes from a token, never a literal. Design tokens are in globals.css @theme + src/lib/theme.ts (docs/design-tokens.md).",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/,
  },
  {
    id: "no-sub-12px-type",
    law: "Type below 12px fails legibility for a dense operator surface and is unreadable at arm's length. Use the type scale.",
    files: (f) => f.startsWith("src/"),
    pattern: /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/,
  },
  {
    id: "hermes-outside-adapter",
    law: "Hermes filesystem layout is an ADAPTER detail. Only src/lib/runtime/, the Hermes adapters and the config-sync layer may know it; orchestration and UI go through the AgentRuntime port (org/decisions/ADR-0002).",
    files: (f) =>
      f.startsWith("src/") &&
      !f.startsWith("src/lib/runtime/") &&
      !f.startsWith("src/lib/frameworks/") &&
      // The module IS the adapter now, which is what the old
      // `src/lib/hermes-*.ts` filename exemption was standing in for. That
      // exemption is gone: src/lib holds no such file.
      !f.startsWith("src/modules/hermes/"),
    pattern: /getActiveHermesPaths|getAgentLlmEndpoints|HERMES_HOME|\.hermes\//,
  },
  {
    id: "no-unsanitised-html",
    law: "dangerouslySetInnerHTML renders model output. It is allowed only where the HTML came from a renderer that escapes at the boundary, and each site needs a written reason.",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern: /dangerouslySetInnerHTML/,
  },
  {
    id: "no-auth-in-route-handler",
    law: "Authentication is enforced once, in src/proxy.ts. A per-route check invites the belief that routes without one are unprotected by choice — which is how this app shipped an unauthenticated RCE.",
    files: (f) => f.startsWith("src/app/api/"),
    pattern: /readAuthToken|tokenMatches|ps_session/,
  },
  {
    id: "module-registry-stays-pure",
    law: "src/lib/modules/ is imported by the e2e route matrix (plain node) as well as the sidebar (client React). It must not pull in React, lucide, next or the database, or the route matrix stops loading and the boundary it defines becomes unenforceable (ADR-0005).",
    files: (f) => f.startsWith("src/lib/modules/"),
    pattern:
      /^\s*import\s[^;]*\sfrom\s+["'](?:react|react-dom|lucide-react|next(?:\/[\w-]+)?|better-sqlite3|@\/lib\/db)["']/,
  },
  {
    id: "core-imports-no-module",
    law: "Core may not import a module; modules import core (ADR-0005). Reach module capability through the composition root, src/lib/modules/server.ts, which is the ONE file exempt from this rule. A boundary an agent can cross without a red build does not exist.",
    // src/lib/modules/ is the seam itself: registry.ts declares nav, server.ts is
    // the composition root. Everything else in core is bound by the rule.
    //
    // src/lib/frameworks/registry.ts is the SECOND composition root, and naming it
    // is more honest than pretending there is only one. It maps a framework id to
    // its adapter -- `case "hermes": return new HermesAdapter(config)` -- which is
    // by definition a place where a neutral id becomes a concrete implementation.
    // A boundary needs designated crossing points; an undeclared one is a hole.
    //
    // src/lib/runtime/ is the THIRD, and it is the port. workspace.ts and
    // gateway.ts each say in their own header that they are the one file that
    // knows the answer comes from Hermes; that is what a port binding is. This
    // rule and `hermes-outside-adapter` above now agree on which directory is the
    // adapter layer, rather than each having its own idea.
    //
    // Covers src/ EXCEPT app/ (routing, may delegate), modules/ (the modules
    // themselves) and the three composition points. Previously an enumerated
    // prefix list that left src/instrumentation.ts -- the boot path -- outside the
    // rule entirely, so core could have imported a module there on a green build.
    files: (f) =>
      f.startsWith("src/") &&
      !f.startsWith("src/app/") &&
      !f.startsWith("src/modules/") &&
      !f.startsWith("src/lib/modules/") &&
      !f.startsWith("src/lib/runtime/") &&
      f !== "src/lib/frameworks/registry.ts",
    pattern: /from\s+["']@\/modules\//,
  },
  {
    id: "sql-outside-repository",
    law: "SQL belongs to the repository layer. A prepared statement in a route handler, a sync source or a stats calculator makes the table shape a public interface, so a column rename becomes an archaeology exercise instead of one file's problem (WG-ARCH-002, ruled B).",
    // Exempt: any *repository*.ts under src/ (a module's own repository is still
    // the repository layer -- forcing module SQL into src/lib would break the
    // ADR-0005 boundary to satisfy this one), src/lib/db/ (the migration chain and
    // its plumbing), and src/lib/db-schema.ts by name.
    //
    // db-schema.ts is named rather than globbed because its own header says why it
    // sits outside src/lib/db/: migrations import it, and being outside means the
    // global @/lib/db Jest mock does not intercept it. That is a real constraint,
    // not an accident, so it gets a named exemption instead of a wider glob.
    //
    // src/lib/db.ts used to be deliberately outside that exemption, with its 6
    // sites baselined: four were plumbing, but getGatewayPlatforms() was a
    // repository function that happened to live in the connection file, and a
    // wholesale exemption would have licensed it forever. Operator ruling D8
    // (2026-08-22) closed that out. getGatewayPlatforms went to
    // sync/sync-repository.ts and getSchemaHealth's two mission_categories
    // statements to missions/mission-category-schema-repository.ts; the file
    // then moved to src/lib/db/index.ts, keeping every `@/lib/db` import byte
    // identical. The three statements it still holds -- a sqlite_master probe
    // and the migration runner's two execs -- are exempt by that location now,
    // and their own reasons are recorded in the file's header.
    files: (f) =>
      f.startsWith("src/") &&
      (f.endsWith(".ts") || f.endsWith(".tsx")) &&
      !/repository/i.test(f) &&
      !f.startsWith("src/lib/db/") &&
      f !== "src/lib/db-schema.ts",
    // `.prepare(` needs no receiver: nothing else in the codebase has that method,
    // and the chained form (`getDb()\n  .prepare(...)`) still puts it on its own
    // line. `.exec(` DOES need one, because RegExp.prototype.exec is everywhere --
    // 5 of the 10 .exec( sites in src/ are regex matching.
    //
    // Known gap, stated rather than papered over: the .exec( half only sees the
    // receivers actually used for SQL today. `fresh.exec(sql)` in src/lib/db/
    // upgrade.ts would slip past on name alone if that file were not already
    // exempt. Closing it properly needs a parser, which WG-WEB-013 rules out
    // (dependency-free). The .prepare( half, which is 52 of the 57 sites, has no
    // such gap -- and an ALTER TABLE run outside the migration chain
    // (session-sync.ts:240) is exactly the bypass worth catching.
    pattern:
      /\.prepare\s*\(|(?:\bdb\(\)|\bgetDb\(\)|\bdatabase\b|\bthis\.db\b)\s*\.\s*exec\s*\(/,
  },
  {
    id: "no-em-dash",
    law: "Voice law: no em-dashes. A hard E004 error in the EOS check, and these files are headed for a compiled seed.",
    files: (f) => f.startsWith("docs/") && f.endsWith(".md"),
    pattern: /—/,
    codeOnly: false,
  },
];

// ── Scan ────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXTS.has(entry.slice(entry.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.filter((d) => existsSync(join(ROOT, d))).flatMap((d) =>
  walk(join(ROOT, d)),
);

/** violations keyed `rule::file` -> [{line, text}] */
const found = new Map();

for (const abs of files) {
  const path = rel(abs);
  const lines = readFileSync(abs, "utf-8").split(/\r?\n/);
  for (const rule of RULES) {
    if (!rule.files(path)) continue;
    for (let i = 0; i < lines.length; i++) {
      if (!rule.pattern.test(lines[i])) continue;
      // A rule that flags prose about the anti-pattern makes documenting it
      // impossible. Code rules ignore comment-only lines; the voice rule does not
      // (a comment is still text a human reads).
      if (rule.codeOnly !== false) {
        const t = lines[i].trimStart();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
      }
      const prev = i > 0 ? lines[i - 1] : "";
      const pragma = PRAGMA.exec(prev);
      if (pragma && pragma[1] === rule.id) continue;
      const key = `${rule.id}::${path}`;
      if (!found.has(key)) found.set(key, []);
      found.get(key).push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
    }
  }
}

const counts = Object.fromEntries(
  [...found.entries()].map(([k, v]) => [k, v.length]).sort((a, b) => a[0].localeCompare(b[0])),
);

// ── Modes ───────────────────────────────────────────────────────────────────

const mode = process.argv[2];

if (mode === "--update-baseline") {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + "\n");
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`design-lint: baseline written — ${Object.keys(counts).length} files, ${total} violations`);
  process.exit(0);
}

if (mode === "--report") {
  const byRule = new Map();
  for (const [key, hits] of found) {
    const [ruleId, path] = key.split("::");
    if (!byRule.has(ruleId)) byRule.set(ruleId, []);
    byRule.get(ruleId).push({ path, hits });
  }
  for (const rule of RULES) {
    const entries = byRule.get(rule.id) ?? [];
    const total = entries.reduce((a, e) => a + e.hits.length, 0);
    console.log(`\n${rule.id}  (${total} in ${entries.length} files)`);
    console.log(`  ${rule.law}`);
    for (const { path, hits } of entries.sort((a, b) => b.hits.length - a.hits.length).slice(0, 12)) {
      console.log(`    ${path}: ${hits.length}  e.g. :${hits[0].line} ${hits[0].text}`);
    }
    if (entries.length > 12) console.log(`    ... and ${entries.length - 12} more files`);
  }
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf-8"))
  : {};

const regressions = [];
for (const [key, count] of Object.entries(counts)) {
  const allowed = baseline[key] ?? 0;
  if (count > allowed) {
    const [ruleId, path] = key.split("::");
    const rule = RULES.find((r) => r.id === ruleId);
    regressions.push({ ruleId, path, count, allowed, rule, hits: found.get(key) });
  }
}

if (regressions.length > 0) {
  console.error("design-lint: NEW violations\n");
  for (const r of regressions) {
    console.error(`  ${r.ruleId}  ${r.path}  (${r.allowed} allowed, ${r.count} found)`);
    console.error(`    ${r.rule.law}`);
    for (const hit of r.hits.slice(0, 3)) console.error(`    :${hit.line}  ${hit.text}`);
    console.error("");
  }
  console.error(
    "Fix them, or add `// design-lint-disable-next-line <rule> -- <reason>` above the line.\n" +
      "Do NOT run --update-baseline to silence a new violation; the baseline only shrinks.",
  );
  process.exit(1);
}

const outstanding = Object.values(counts).reduce((a, b) => a + b, 0);
const allowed = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(
  `design-lint: no new violations (${outstanding} baselined, ${allowed} allowed). ` +
    `Run with --report to see the debt.`,
);
