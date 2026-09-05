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
// ever shrinks: `--update-baseline` after a genuine cleanup.
//
// ── The ratchet (T-0025, warrant Q-008, drift finding D-14) ─────────────────
// That paragraph used to be the whole mechanism. --update-baseline wrote
// whatever the scan had just counted, so running it after a regression grew the
// baseline in silence, and "the baseline only ever shrinks" lived in this
// comment and in the failure text rather than in the code. Doctrine in a comment
// is not a mechanism, and the plan's risk register named a baseline grown to
// absorb violations as an all-phase risk whose only control was a person
// comparing two totals by eye.
//
// So --update-baseline now REFUSES to write a baseline whose total, or whose
// count for any single key, is higher than the committed one. The one way past
// it is `--allow-growth "<reason>"`, and the reason is recorded in the baseline
// file itself under the `__growth__` key, where the next person to open it will
// read it. This is coverage-floor-check.mjs's ratchet pointed the other way:
// that one refuses to write a DECLARED floor lower than the recorded one, this
// refuses to write a DERIVED count higher. Two gates met in the same week should
// behave the same way.
//
//   node scripts/tooling/design-lint.mjs                  # gate (runs in npm run lint)
//   node scripts/tooling/design-lint.mjs --report         # every violation, grouped
//   node scripts/tooling/design-lint.mjs --update-baseline
//   node scripts/tooling/design-lint.mjs --update-baseline --allow-growth "<reason>"

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "fs";
import { join, relative, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BASELINE_PATH = join(ROOT, "scripts", "tooling", "design-lint.baseline.json");
const GLOBALS_CSS = join(ROOT, "src", "app", "globals.css");

// ── Declared colour tokens ──────────────────────────────────────────────────
//
// Tailwind generates nothing for a class it cannot resolve, and says nothing.
// `text-neon-red` compiled to no rule at all for as long as no token declared
// it, and thirteen sites, the global error fallback among them, rendered with
// no colour (T-0095, D114). The rule below reads the @theme block once and
// fails the build on the next house colour class without a token behind it.

/** Every `--color-<name>` declared in a stylesheet, aliases included. */
export function declaredColourTokens(css) {
  const out = new Set();
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) out.add(m[1]);
  return out;
}

/**
 * A house colour class: a colour utility carrying a `neon-`, `semantic-` or
 * `ps-` token, with any variant prefix before it and any opacity after it.
 * Tailwind's own palette (`text-red-400`, `bg-white/5`) is not a house token
 * and is not this rule's business.
 */
const HOUSE_COLOUR_CLASS =
  /(?:^|[^\w-])(?:text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|shadow|from|via|to|fill|stroke|outline|decoration|accent|divide|placeholder|caret)-((?:neon|semantic|ps)-[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/\d{1,3})?(?![\w-])/g;

/** The house tokens named on a line that `declared` does not contain, in order. */
export function undeclaredColourClasses(line, declared) {
  const out = [];
  for (const m of line.matchAll(HOUSE_COLOUR_CLASS)) {
    if (!declared.has(m[1]) && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

let declaredCache = null;
function declaredTokens() {
  if (!declaredCache) {
    declaredCache = existsSync(GLOBALS_CSS)
      ? declaredColourTokens(readFileSync(GLOBALS_CSS, "utf-8"))
      : new Set();
  }
  return declaredCache;
}

const SCAN_DIRS = ["src", "docs"];
const SCAN_EXTS = new Set([".ts", ".tsx", ".css", ".md"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "images"]);

/** `// design-lint-disable-next-line <rule> -- <reason>` — the reason is required. */
const PRAGMA = /design-lint-disable-next-line\s+([\w-]+)\s+--\s+\S/;

const rel = (p) => relative(ROOT, p).split(sep).join("/");

export const RULES = [
  {
    id: "token-must-exist",
    law: "A house colour class (text-, bg-, border-, ring- and friends carrying a neon-, semantic- or ps- token) must name a token declared in src/app/globals.css @theme. Tailwind generates nothing for an unknown class and says nothing, so the element renders with no colour (T-0095, D114).",
    files: (f) => f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".tsx")),
    test: (line) => undeclaredColourClasses(line, declaredTokens()).length > 0,
  },
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
    // sync/sync-repository.ts, where it is named readGatewayPlatforms, and
    // getSchemaHealth's two mission_categories
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

/**
 * Walk the tree once and count every violation.
 *
 * Lifted out of the top level, unchanged, so that importing this module (its own
 * test does) neither scans 79k lines nor lands on a process.exit. What counts as
 * a violation is exactly what it was.
 *
 * @returns {{ found: Map<string, {line:number,text:string}[]>, counts: Record<string, number> }}
 */
/**
 * Every violation in one file's lines, keyed `rule::path`.
 *
 * Split out of scanTree so a test can plant a line and prove the scan SEES
 * it: the B1 mutation sweep found that a scan which silently skipped the
 * predicate rule still passed "the rule lands at a zero baseline", because
 * zero offenders and a blind rule look identical from outside (T-0095).
 *
 * @returns {Map<string, {line:number,text:string}[]>}
 */
export function violationsIn(path, lines) {
  const found = new Map();
  for (const rule of RULES) {
    if (!rule.files(path)) continue;
    for (let i = 0; i < lines.length; i++) {
      // A rule is a regex, or a predicate where a regex cannot answer alone
      // (token-must-exist needs the declared set).
      const hit = rule.test ? rule.test(lines[i]) : rule.pattern.test(lines[i]);
      if (!hit) continue;
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
  return found;
}

export function scanTree() {
  const files = SCAN_DIRS.filter((d) => existsSync(join(ROOT, d))).flatMap((d) =>
    walk(join(ROOT, d)),
  );

  /** violations keyed `rule::file` -> [{line, text}] */
  const found = new Map();

  for (const abs of files) {
    const path = rel(abs);
    const lines = readFileSync(abs, "utf-8").split(/\r?\n/);
    for (const [key, hits] of violationsIn(path, lines)) found.set(key, hits);
  }

  const counts = Object.fromEntries(
    [...found.entries()].map(([k, v]) => [k, v.length]).sort((a, b) => a[0].localeCompare(b[0])),
  );

  return { found, counts };
}

// ── The ratchet ─────────────────────────────────────────────────────────────
//
// Everything below decides what --update-baseline is ALLOWED to write. The gate
// itself is untouched by it: a normal run still reads the committed counts and
// fails on anything new, exactly as before.

/** Reserved. Unreachable as a violation key, which is always `rule::path`. */
export const GROWTH_LOG_KEY = "__growth__";

/** The one way past the refusal, and it costs a written reason. */
export const ALLOW_GROWTH_FLAG = "--allow-growth";

/** A reason shorter than this is a keystroke rather than a reason. */
export const MIN_REASON_LENGTH = 12;

const total = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

/**
 * Split a parsed baseline file into the counts the gate compares against and the
 * log of every growth ever allowed through. Keeping the log inside the baseline
 * file means the reason travels with the number it excuses.
 */
export function splitBaseline(parsed) {
  const source = parsed && typeof parsed === "object" ? parsed : {};
  const counts = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === GROWTH_LOG_KEY) continue;
    counts[key] = value;
  }
  const raw = source[GROWTH_LOG_KEY];
  return { counts, log: Array.isArray(raw) ? raw : [] };
}

/** Every key that grew, plus both totals. Either kind of growth is growth. */
export function baselineGrowth(current, committed) {
  const grown = [];
  for (const [key, count] of Object.entries(current)) {
    const was = committed[key] ?? 0;
    if (count > was) grown.push({ key, was, now: count });
  }
  const totalWas = total(committed);
  const totalNow = total(current);
  return { grown, totalWas, totalNow, grew: grown.length > 0 || totalNow > totalWas };
}

/** Read `--allow-growth <reason>` or `--allow-growth=<reason>` out of argv. */
export function parseGrowthAllowance(argv) {
  const idx = argv.findIndex(
    (a) => a === ALLOW_GROWTH_FLAG || a.startsWith(`${ALLOW_GROWTH_FLAG}=`),
  );
  if (idx < 0) return { present: false, reason: "" };
  const raw = argv[idx].startsWith(`${ALLOW_GROWTH_FLAG}=`)
    ? argv[idx].slice(ALLOW_GROWTH_FLAG.length + 1)
    : (argv[idx + 1] ?? "");
  const reason = raw.trim();
  if (reason === "" || reason.startsWith("--")) {
    return {
      present: true,
      reason: "",
      problem: `${ALLOW_GROWTH_FLAG} carries a written reason: ${ALLOW_GROWTH_FLAG} "why this baseline may grow".`,
    };
  }
  if (reason.length < MIN_REASON_LENGTH) {
    return {
      present: true,
      reason: "",
      problem: `${ALLOW_GROWTH_FLAG} needs a reason a reviewer can read, at least ${MIN_REASON_LENGTH} characters. Got ${reason.length}.`,
    };
  }
  return { present: true, reason };
}

/**
 * The ONE place that decides what gets written, so the write cannot be reached
 * around it. Returns either a refusal carrying the growth that caused it, or the
 * exact object to serialise.
 */
export function planBaselineWrite({
  counts,
  committed,
  log = [],
  allowance = { present: false, reason: "" },
  when,
}) {
  const growth = baselineGrowth(counts, committed);
  if (growth.grew && !allowance.reason) return { ok: false, growth };

  const nextLog = [...log];
  if (growth.grew) {
    nextLog.push({
      when,
      reason: allowance.reason,
      total: `${growth.totalWas} -> ${growth.totalNow}`,
      grew: growth.grown.map((g) => `${g.key}: ${g.was} -> ${g.now}`),
    });
  }

  const file = {};
  if (nextLog.length > 0) file[GROWTH_LOG_KEY] = nextLog;
  Object.assign(file, counts);

  return { ok: true, growth, file, recorded: growth.grew ? nextLog[nextLog.length - 1] : null };
}

// ── Modes ───────────────────────────────────────────────────────────────────

function main(argv) {
  const mode = argv[0];
  const allowance = parseGrowthAllowance(argv);

  if (allowance.present && mode !== "--update-baseline") {
    console.error(
      `design-lint: ${ALLOW_GROWTH_FLAG} means nothing without --update-baseline.\n` +
        "The gate has no escape hatch. Escape a single line with\n" +
        "`// design-lint-disable-next-line <rule> -- <reason>` instead.",
    );
    return 2;
  }

  const { found, counts } = scanTree();

  if (mode === "--report") {
    const byRule = new Map();
    for (const [key, hits] of found) {
      const [ruleId, path] = key.split("::");
      if (!byRule.has(ruleId)) byRule.set(ruleId, []);
      byRule.get(ruleId).push({ path, hits });
    }
    for (const rule of RULES) {
      const entries = byRule.get(rule.id) ?? [];
      const count = entries.reduce((a, e) => a + e.hits.length, 0);
      console.log(`\n${rule.id}  (${count} in ${entries.length} files)`);
      console.log(`  ${rule.law}`);
      for (const { path, hits } of entries.sort((a, b) => b.hits.length - a.hits.length).slice(0, 12)) {
        console.log(`    ${path}: ${hits.length}  e.g. :${hits[0].line} ${hits[0].text}`);
      }
      if (entries.length > 12) console.log(`    ... and ${entries.length - 12} more files`);
    }
    return 0;
  }

  const { counts: baseline, log } = splitBaseline(
    existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) : {},
  );

  if (mode === "--update-baseline") {
    if (allowance.problem) {
      console.error(`design-lint: ${allowance.problem}`);
      return 2;
    }
    const plan = planBaselineWrite({
      counts,
      committed: baseline,
      log,
      allowance,
      when: new Date().toISOString().slice(0, 10),
    });
    if (!plan.ok) {
      console.error("design-lint: refusing to write a baseline that GROWS.\n");
      for (const g of plan.growth.grown) console.error(`  ${g.key}: ${g.was} -> ${g.now}`);
      console.error(`  total: ${plan.growth.totalWas} -> ${plan.growth.totalNow}\n`);
      console.error(
        "The baseline is the ratchet pawl, and a pawl you can wind backwards with a\n" +
          "flag is decorative. Fix the violation, or escape the single line with\n" +
          "`// design-lint-disable-next-line <rule> -- <reason>`.\n\n" +
          "If the growth is genuinely warranted, say so in writing and it is recorded\n" +
          `in the baseline itself:\n` +
          `  node scripts/tooling/design-lint.mjs --update-baseline ${ALLOW_GROWTH_FLAG} "<reason>"`,
      );
      return 1;
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(plan.file, null, 2) + "\n");
    console.log(
      `design-lint: baseline written, ${Object.keys(counts).length} files, ` +
        `${plan.growth.totalNow} violations (was ${plan.growth.totalWas}).`,
    );
    if (plan.recorded) {
      console.log(
        `design-lint: GROWTH ALLOWED, reason recorded in ${rel(BASELINE_PATH)}: ` +
          `${plan.recorded.reason}`,
      );
    }
    return 0;
  }

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
        "Do NOT run --update-baseline to silence a new violation; it will refuse.",
    );
    return 1;
  }

  console.log(
    `design-lint: no new violations (${total(counts)} baselined, ${total(baseline)} allowed). ` +
      `Run with --report to see the debt.`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] && process.argv[1].split(sep).join("/").endsWith("design-lint.mjs");
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
