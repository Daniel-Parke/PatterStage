// scripts/tooling/check-read-only-guards.mjs
//
// A read-only guard may not sit in a GET, HEAD or OPTIONS handler.
//
// `PS_READ_ONLY` is a restriction on WRITES. `src/proxy.ts` enforces it by HTTP
// method before any handler runs, so a guard inside a read handler cannot
// protect anything: the method was already allowed. All it can do is refuse a
// read, which is how the mode came to blank the dashboard it exists to enable.
//
// That is not hypothetical. `requireAuth()` was a thin alias for
// `requireNotReadOnly()`, 34 read handlers across 33 files called it, and
// `PS_READ_ONLY=1` therefore 503'd /api/config, /api/models, /api/skills,
// /api/sessions, /api/monitor and /api/logs (T-0048). T-0034 had already fixed
// the same thing for one directory and written down the rule:
//
//     "A GET that refuses to answer under PS_READ_ONLY is a read-only mode
//      that cannot read."
//
// It reached 33 files anyway, because nothing failed a build over it. This is
// that build failure. WG-WEB-013: a rule that is not a red build does not exist.
//
// WHY THIS IS NOT A design-lint RULE. Those are single-line regexes with a path
// predicate, and this question is not answerable one line at a time: the same
// call is correct in a POST and wrong in a GET, so the check needs to know
// which handler encloses it. A stateful rule does not fit that registry's
// shape, so it lives here in the check-derived-views.mjs mould instead.
//
// Dependency-free, per WG-WEB-013. Run by `npm run lint`; exits non-zero on a
// violation.

import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_ROOT = join(ROOT, "src", "app", "api");

/** Methods the proxy lets through, and therefore may not be self-guarded. */
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The guards. `requireAuth` is gone, and is listed so its return is caught. */
const GUARD = /\b(requireAuth|requireNotReadOnly|isReadOnly)\s*\(/;

const HANDLER = /^export\s+(?:async\s+)?function\s+([A-Z]+)\b/;

/** `// check-read-only-guards-disable-next-line -- <reason>`, reason required. */
const PRAGMA = /\/\/\s*check-read-only-guards-disable-next-line\s+--\s+\S/;

function routeFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

const failures = [];
let scanned = 0;
let handlersSeen = 0;

for (const file of routeFiles(API_ROOT)) {
  scanned += 1;
  const rel = file.replace(/\\/g, "/").split("/src/")[1];
  const lines = readFileSync(file, "utf-8").split(/\r?\n/);

  let method = "";
  let exempt = false;
  lines.forEach((raw, i) => {
    const handler = HANDLER.exec(raw);
    if (handler) {
      method = handler[1];
      handlersSeen += 1;
    }

    const trimmed = raw.trim();
    // Prose explaining why a route no longer carries a guard is the most useful
    // thing left in several of these files. A check that forbade the words
    // would delete its own explanation.
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      exempt = PRAGMA.test(raw);
      return;
    }

    if (READ_METHODS.has(method) && GUARD.test(raw)) {
      if (exempt) {
        exempt = false;
        return;
      }
      failures.push(`  ${rel}:${i + 1}  (${method})  ${trimmed}`);
    }
    exempt = false;
  });
}

// Guard the guard. An empty or mis-rooted walk must not read as a pass, which
// is the failure mode every scanner in this directory is written to avoid.
if (scanned < 50 || handlersSeen < 50) {
  console.error(
    `read-only guards: scanned only ${scanned} route files and ${handlersSeen} handlers, which is too few to be a real walk. Check API_ROOT.`,
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error("read-only guards: a read handler refuses to read.\n");
  for (const f of failures) console.error(f);
  console.error(
    "\nPS_READ_ONLY restricts WRITES, and src/proxy.ts already enforces it by" +
      "\nmethod before a handler runs. A guard in a GET, HEAD or OPTIONS handler" +
      "\ncannot protect anything; it can only 503 a read that the mode is meant" +
      "\nto keep serving. Delete the call: the proxy has it covered." +
      "\n\nA read handler that genuinely performs a write is the one real" +
      "\nexception. Mark it:" +
      "\n\n  // check-read-only-guards-disable-next-line -- <why this GET writes>\n",
  );
  process.exit(1);
}

console.log(
  `read-only guards: no read handler self-guards (${handlersSeen} handlers across ${scanned} route files).`,
);
