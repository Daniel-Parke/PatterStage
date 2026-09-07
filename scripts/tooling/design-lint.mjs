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
 * Every `--shadow-<name>` declared in a stylesheet.
 *
 * `shadow-ps-raised` is a house class too, and it names a SHADOW token, not a
 * colour: the rule below read it as `ps-raised` with no `--color-` behind it
 * and refused the first dialog to use the elevation U6 declared for dialogs
 * (T-0125). A shadow utility is checked against the shadow tokens.
 */
export function declaredShadowTokens(css) {
  const out = new Set();
  for (const m of css.matchAll(/--shadow-([a-z0-9-]+)\s*:/g)) out.add(m[1]);
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

/**
 * The house tokens named on a line that `declared` does not contain, in order.
 * A `shadow-` utility is held to `shadows` instead, when given.
 */
export function undeclaredColourClasses(line, declared, shadows = new Set()) {
  const out = [];
  for (const m of line.matchAll(HOUSE_COLOUR_CLASS)) {
    const isShadow = /(?:^|[^\w-])shadow-/.test(m[0]);
    const known = isShadow ? shadows.has(m[1]) : declared.has(m[1]);
    if (!known && !out.includes(m[1])) out.push(m[1]);
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

let shadowCache = null;
function declaredShadows() {
  if (!shadowCache) {
    shadowCache = existsSync(GLOBALS_CSS)
      ? declaredShadowTokens(readFileSync(GLOBALS_CSS, "utf-8"))
      : new Set();
  }
  return shadowCache;
}

const SCAN_DIRS = ["src", "docs"];
const SCAN_EXTS = new Set([".ts", ".tsx", ".css", ".md"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "images"]);

/** `// design-lint-disable-next-line <rule> -- <reason>` — the reason is required. */
const PRAGMA = /design-lint-disable-next-line\s+([\w-]+)\s+--\s+\S/;

const rel = (p) => relative(ROOT, p).split(sep).join("/");

export const RULES = [
  {
    id: "no-native-confirm",
    law: "A destructive click is two clicks on a ConfirmButton (src/components/ui/ConfirmButton.tsx): arm, then act, disarming on its own. The native window.confirm blocks the thread with an OS dialog the product cannot style, and it is the pattern five sites still used beside eleven that did not (T-0096, D51).",
    files: (f) => f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".tsx")),
    // Not `.confirm(`: the two-step hook's own method is called that way.
    pattern: /(?<![\w.$])(?:window\.|globalThis\.)?confirm\(/,
  },
  {
    id: "no-bare-outline-none",
    law: "outline-none removes the one focus ring the console has (globals.css :focus-visible). A control may remove it only on a line that puts a focus ring, border or outline back (T-0096, D117).",
    files: (f) => f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".tsx")),
    // `focus:outline-none` is itself an outline-none, not a ring put back.
    //
    // And neither is a BORDER. The rule used to accept `focus:border-*` as the
    // replacement, so 55 controls removed the console's one indicator and put
    // a 1px colour change in its place: it fires on :focus rather than
    // :focus-visible, so a mouse click draws it, and 47 of the 56 measured in
    // T-0120 were below the 3:1 WCAG 1.4.11 asks of it. `bg` and `text` go for
    // the same reason. What still counts is a ring: an outline, a ring, or a
    // shadow standing in for one (T-0122).
    test: (line) =>
      /\boutline-none\b/.test(line) &&
      !/focus(?:-visible|-within)?:(?:ring|shadow|outline-(?!none))/.test(line),
  },
  {
    id: "overlay-uses-dialog-a11y",
    law: "A file that paints a `fixed inset-0` overlay must call useDialogA11y (role, aria-modal, Escape, the Tab trap, focus restored to the trigger, scroll lock). Modal and Sheet already do; twelve bespoke overlays did not, and a keyboard user could not close them (T-0096, D116).",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    // File-level: reported at the first overlay line when nothing in the
    // file calls the hook.
    fileTest: (lines) => {
      const at = lines.findIndex((l) => /\bfixed inset-0\b/.test(l));
      if (at < 0) return null;
      return lines.some((l) => /useDialogA11y\(/.test(l)) ? null : at;
    },
  },
  {
    id: "token-must-exist",
    law: "A house colour class (text-, bg-, border-, ring- and friends carrying a neon-, semantic- or ps- token) must name a token declared in src/app/globals.css @theme. Tailwind generates nothing for an unknown class and says nothing, so the element renders with no colour (T-0095, D114).",
    files: (f) => f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".tsx")),
    test: (line) => undeclaredColourClasses(line, declaredTokens(), declaredShadows()).length > 0,
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
    // Four shapes, because there are four ways to build a class Tailwind
    // cannot see, and the two added at T-0120 are the two that were live:
    // StatPill edited a class with `.replace(/^text-/, "border-") + "/20"`,
    // and ModelsSectionHeader concatenated `/60` onto an interpolated class by
    // putting two interpolations next to each other. Both rendered only
    // because the class name they assembled happened to be written down
    // somewhere else Tailwind was also scanning - a document for one, a unit
    // test for the other.
    //
    // The last branch is deliberately narrowed to a className: `${a}${b}` is
    // how every URL and every message in this codebase is built.
    pattern:
      /\b(?:text|bg|border|ring|shadow|from|via|to|fill|stroke|outline|decoration|accent|divide|placeholder)-\$\{|\$\{[^}]+\}\/\d+|\.replace\([^)]*["'/](?:text|bg|border|ring|shadow|from|via|to|fill|stroke|outline|decoration|accent|divide|placeholder)-|className=[^\n]*\$\{[^}]+\}\$\{[^}]+\}/,
  },
  {
    id: "no-dangling-variant",
    law: "A Tailwind variant prefix with no utility after it (`focus:`) is a class that can never exist. Inert, so nothing fails - and evidence that something removed half of a class.",
    files: (f) => f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".tsx")),
    // Eleven of these were left by T-0122's focus pass, which deleted
    // `outline-none` with a \b anchor. `:` is a word boundary, so it matched
    // inside `focus:outline-none` and left the prefix standing.
    //
    // Three narrowings, all load-bearing. The variants are SPELLED OUT rather
    // than matched as [a-z-]+, because prose ends in a colon too ("error:") and
    // so does a pseudo-selector in a plain string. It is anchored on the QUOTE
    // that closes the string rather than on whitespace, because a ternary
    // (`cond ? "x" : "y"`) puts a colon before a space and is not a class. And
    // the prefix must FOLLOW another class: skills-config.ts writes
    // `"  disabled:"` as a YAML key and `startsWith("disabled:")` as a parser,
    // and a rule without that lookbehind would have deleted both.
    pattern:
      /(?<=[\w\]/%.-]) (?:(?:focus-visible|focus-within|focus|hover|active|disabled|visited|checked|group-hover|group-focus|peer-focus|peer-checked|first|last|odd|even|placeholder|motion-safe|motion-reduce|dark|print|sm|md|lg|xl|2xl):)+(?=["'`])/,
  },
  {
    id: "no-raw-colour-in-tsx",
    law: "Colour comes from a token, never a literal. Design tokens are in globals.css @theme + src/lib/theme.ts (docs/contributing/design-tokens.md).",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    // The lookbehind, not \b, and it excludes letters and digits but NOT the
    // underscore. Tailwind writes a space as `_` inside an arbitrary value, so
    // the character before `rgba(` in `shadow-[0_0_8px_rgba(6,214,214,0.3)]` is
    // a word character and \b never matched: the rule reported "0 in 0 files"
    // while two raw colours shipped (T-0114). Excluding `.` and `$` as well
    // keeps `palette.rgba(1,2,3)`, a method call, out of it, which the old
    // anchor did flag. Requiring a DIGIT after the paren is what leaves
    // `rgb(var(--ps-rgb-neon-cyan) / 0.3)` alone: that is a token reference,
    // four live call sites use it, and the built stylesheet proves it compiles.
    pattern: /#[0-9a-fA-F]{3,8}\b|(?<![A-Za-z0-9.$])rgba?\(\s*\d/,
  },
  {
    id: "no-sub-12px-type",
    law: "Type below 12px fails legibility for a dense operator surface and is unreadable at arm's length. Use the type scale. An SVG chart sets its size as a prop, so fontSize={n} counts too.",
    files: (f) => f.startsWith("src/"),
    // The second alternative is the SVG half. An axis label is text, it reads
    // through --color-ps-text-*, and the class rule could never see it because
    // a chart writes `fontSize={8}`, not a class. Three chart sites rendered at
    // 8px and 9px, two thirds of the floor this rule exists to hold (T-0114).
    // A computed size (`fontSize={size * 0.06}`) is out of scope for a regex
    // and is left to the rendered census.
    pattern:
      /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|\bfontSize=(?:\{(?:[0-9]|1[01])(?:\.\d+)?\}|"(?:[0-9]|1[01])(?:\.\d+)?")/,
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
  // ══════════════════════════════════════════════════════════════════════════
  // The token layer's rules (U2, T-0116).
  //
  // Each of these lands at TODAY'S count, not at zero. That is what the ratchet
  // is for: the number may fall and never rise, so the codemod batches can take
  // them down while the gate refuses anything new on the way. A rule at zero
  // that nobody can satisfy for six batches gets disabled; a rule at its real
  // count is a debt with a direction.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "no-raw-border-alpha",
    law: "A rule is a token: --color-ps-edge for a control boundary or a shell seam, --color-ps-edge-hairline for a card outline or a rule inside a surface, --color-ps-edge-emphasis for selected or armed. The tree draws 435 rules across eight undeclared white alphas, none of which reaches 1.8:1 and all of which are below the 3:1 WCAG 1.4.11 asks of a component boundary.",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern: /(?:^|[^\w-])(?:border(?:-[trblxyse])?|divide|ring|outline|bg)-white\/\d{1,3}(?![\w-])/,
  },
  {
    id: "no-raw-text-alpha",
    law: "Text hierarchy is the four --color-ps-text-* tiers, which are derived from the painted ground and gated by contrast-check. Spelling it as a raw white opacity is how 2,377 elements once failed AA; 157 sites still do it, and 23 of them are below the 50% floor the file says has no tier beneath it.",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern: /(?:^|[^\w-])(?:text|placeholder|caret|decoration)-white(?:\/\d{1,3})?(?![\w-])/,
  },
  {
    id: "palette-must-be-house",
    law: "Tailwind's own palette is not this product's palette. 353 sites in 56 files paint red-400, green-500 and 23 other ramp colours directly, and the collisions are exact: text-red-400 IS --color-semantic-danger, spelled two ways. Use a house token or the status ladder.",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern:
      /(?:^|[^\w-])(?:text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|shadow|from|via|to|fill|stroke|outline|decoration|accent|divide|placeholder|caret)-(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?(?![\w-])/,
  },
  {
    id: "type-scale-only",
    law: "Five steps: text-micro 12/16, text-body 14/21, text-lead 16/24, text-title 20/28, text-display 28/34. Tailwind's default scale was used as if it had two, with text-xs 919 times and text-sm 241 against 36 uses of everything larger, and 70% of every character rendered is 12px.",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern:
      /(?:^|[^\w-])text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?![\w-])/,
  },
  {
    id: "radius-scale-only",
    law: "Three radii: rounded-ps-sm 4 for a chip, rounded-ps-md 8 for a control, rounded-ps-lg 12 for a surface, plus rounded-full. Seven render today from eleven spellings, and adjacent cards on the same screen have 8px and 12px corners.",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern:
      /(?:^|[^\w-])rounded(?:-[trblse]{1,2})?-(?:none|sm|md|lg|xl|2xl|3xl|\[[^\]]+\])(?![\w-])/,
  },
  {
    id: "z-scale-only",
    law: "Seven named layers: base, sticky, dropdown, overlay, modal, toast, tooltip. Thirteen z values are in use and seven are arbitrary; z-[61] exists because someone needed to sit on z-[60], which is how a modal ends up under a toast.",
    files: (f) => f.startsWith("src/") && f.endsWith(".tsx"),
    pattern: /(?:^|[^\w-])z-(?:\[[^\]]+\]|\d+)(?![\w-])/,
  },
  {
    id: "no-inline-card-chrome",
    law: "A card is <Surface>. 113 files spell its chrome inline instead, and the measured result is 108 distinct card chromes across 23 screens: the same intent at dark-900/40 and dark-900/50 accounts for 102 surfaces where nobody made a choice.",
    files: (f) =>
      f.startsWith("src/") && f.endsWith(".tsx") && !f.startsWith("src/components/ui/"),
    // All three on one line: a corner, an edge and a fill is a card, wherever
    // the author put the words.
    test: (line) =>
      /(?:^|[^\w-])rounded(?:-|\b)/.test(line) &&
      /(?:^|[^\w-])border(?:-|\s|")/.test(line) &&
      /(?:^|[^\w-])bg-/.test(line),
  },
  {
    id: "no-raw-control-outside-ui",
    law: "A control is a primitive. 321 raw <button> elements live in 113 files against 104 uses of the shared Button, which is why 20 distinct button heights render; 110 of them carry no type= and default to submit inside a form.",
    files: (f) =>
      f.startsWith("src/") &&
      f.endsWith(".tsx") &&
      !f.startsWith("src/components/ui/") &&
      !f.startsWith("src/kit/"),
    pattern: /<(?:button|input|select|textarea)(?=[\s/>])/,
  },
  {
    id: "one-container-per-page",
    law: "The shell owns the measure. A page that centres its own column is how 21 of 23 screens end up with their h1 on a different left edge from their content, by as much as 289px, across eight content widths.",
    files: (f) => f.startsWith("src/app/") && f.endsWith("page.tsx"),
    // The page's OWN scale: 4xl (56rem) and up, a viewport width, or a house
    // measure other than the prose one. Deliberately not every cap. Holding a
    // paragraph to a reading measure is something the programme asks for, and
    // centring a 12px icon in an empty state is not a layout decision at all;
    // a rule that banned those would be making the product worse to satisfy a
    // rule about something else. What a page may not own is a CONTAINER.
    pattern: /(?:^|[^\w-])max-w-(?:4xl|5xl|6xl|7xl|screen-[\w-]+|ps-(?!prose\b)[\w-]+)\b/,
  },
  {
    id: "no-raw-colour-in-css",
    law: "globals.css paints three colours no token declares, including a second cyan (#22d3ee) for the product's own live-pathway signature, next to elements painted in the brand cyan. Declare it or use the one that exists.",
    files: (f) => f === "src/app/globals.css",
    // Inside the declaration blocks a literal IS the token; everywhere else it
    // is a colour nobody can retheme. The line test is the cheap approximation:
    // a raw colour on a line that is not a custom-property declaration.
    // A declaration's NAME may carry digits: --color-cherenkov-100 and
    // --color-dark-950 both do, and `[a-z-]+` matched neither, so the rule
    // reported its own token block as raw colour. Comments are skipped for the
    // same reason: the paragraph explaining why an accent was brightened is
    // prose about a hex, not a use of one.
    test: (line) =>
      !/^\s*--[a-z0-9-]+:/.test(line) &&
      !/^\s*(?:\/\*|\*|\/\/)/.test(line) &&
      /#[0-9a-fA-F]{3,8}\b|(?<![A-Za-z0-9.$])rgba?\(\s*\d/.test(line),
  },
  {
    id: "no-raw-fetch-in-component",
    law: "A component reads the API through useApiResource, which is cached and deduped. Sixteen files call safeApiCall inside a useEffect instead, and the dashboard therefore issues 23 requests on load with six endpoints fetched twice.",
    files: (f) =>
      (f.startsWith("src/components/") || f.startsWith("src/app/") || f.startsWith("src/modules/")) &&
      f.endsWith(".tsx"),
    fileTest: (lines) => {
      const usesEffect = lines.some((l) => /\buseEffect\s*\(/.test(l));
      if (!usesEffect) return null;
      const at = lines.findIndex((l) => /\bsafeApiCall\s*[(<]/.test(l));
      return at >= 0 ? at : null;
    },
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
 * Which lines sit inside a block comment.
 *
 * The per-line skip below recognises a comment by its leading marker, which is
 * the house style in .ts and .tsx and is not CSS: a `/* … *\/` block's interior
 * lines carry no marker at all. globals.css documents the surface ladder as a
 * table of hexes inside one, and every row of it read as a raw colour (T-0118).
 *
 * A line counts as comment when it STARTED inside one and contributed no code
 * of its own, so `foo: red; /* note *\/` is still code and the closing line of
 * a block is still comment.
 */
export function blockCommentLines(lines) {
  const inside = new Array(lines.length).fill(false);
  let open = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const startedInside = open;
    let code = false;
    for (let j = 0; j < line.length; j++) {
      if (!open && line.startsWith("/*", j)) {
        open = true;
        j += 1;
      } else if (open && line.startsWith("*/", j)) {
        open = false;
        j += 1;
      } else if (!open && !/\s/.test(line[j])) {
        code = true;
      }
    }
    inside[i] = startedInside && !code;
  }
  return inside;
}

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
  const commented = blockCommentLines(lines);
  for (const rule of RULES) {
    if (!rule.files(path)) continue;
    // A file-level rule answers once per file with the line to report, or
    // null. The pragma on the line above that line excuses it, like any other.
    if (rule.fileTest) {
      const at = rule.fileTest(lines);
      if (at === null || at === undefined || at < 0) continue;
      const prev = at > 0 ? lines[at - 1] : "";
      const pragma = PRAGMA.exec(prev);
      if (pragma && pragma[1] === rule.id) continue;
      found.set(`${rule.id}::${path}`, [{ line: at + 1, text: lines[at].trim().slice(0, 120) }]);
      continue;
    }
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
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) continue;
        // And the interior of a block comment, which carries no marker in CSS.
        if (commented[i]) continue;
      }
      // A pragma line names the rule it excuses; it is never itself a hit.
      if (PRAGMA.test(lines[i])) continue;
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
