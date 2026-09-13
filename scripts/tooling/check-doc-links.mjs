// scripts/tooling/check-doc-links.mjs
//
// Every relative link in a tracked markdown file must point at a file that
// exists.
//
// The 2026-07 review found docs naming a component that had been deleted and CSS
// variables that never existed, and agents followed them. A stale link is worse
// than a missing one: it reads as verified. This session moved 30 files into
// src/modules/hermes/ and deleted a whole subsystem, which broke a batch of them
// at once and is exactly when this needs to be mechanical rather than remembered.
//
//   node scripts/tooling/check-doc-links.mjs          # gate (runs in npm run lint)
//
// Checks relative markdown links and reference-style targets. Skips absolute
// URLs, anchors, and mailto. A link with a #fragment is checked up to the '#'.
//
// SCOPE. It walked docs/ alone, so the 16 tracked markdown files outside it
// were unchecked, and when C7 moved the theme module into a domain it broke
// three of their links with nothing to say so (docs-02, tooling-19; ruled
// 2026-09-12). The old path is deliberately not written here: c7's own gate
// refuses a source file that names a lib path that moved, and it is right to.
// It now
// asks git for every tracked .md file and drops two directories:
//
//   org/        an append-only governance corpus with its own checkers, whose
//               historical records deliberately name paths that have since
//               moved. Checking it would fail the build over history.
//   data/seed/  shipped content, copied to an install's data directory, where
//               a link resolves against the install and not against this repo.
//
// Asking git rather than walking the filesystem also keeps generated and
// untracked output (site/, public/help/, node_modules) out without a list of
// exclusions to maintain. Two consequences of that, both deliberate and neither
// free:
//
//   - a markdown file that is not yet `git add`ed is not checked, so a broken
//     link in a brand-new document passes until it is staged. The filesystem
//     walk this replaced would have caught it, and would also have walked
//     generated output and reported links nobody wrote;
//   - the gate now needs a git checkout. `npm run lint` runs under
//     actions/checkout in CI and in a developer's clone, and no Dockerfile
//     runs it, so this costs nothing today; without git it throws rather than
//     reporting, which is loud enough to diagnose.

import { execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve, relative, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const rel = (p) => relative(ROOT, p).split(sep).join("/");

/** Directories whose markdown is deliberately not checked; see SCOPE above. */
const OUT_OF_SCOPE = [/^org\//, /^data\/seed\//];

/** Every tracked .md file in scope, as an absolute path. */
function trackedMarkdown() {
  const listed = execFileSync("git", ["ls-files", "-z", "*.md"], {
    cwd: ROOT,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return listed
    .split("\0")
    .filter(Boolean)
    .filter((p) => !OUT_OF_SCOPE.some((skip) => skip.test(p)))
    .map((p) => join(ROOT, p));
}

// [text](target) and [text]: target
const INLINE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REFERENCE = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

const broken = [];

const files = trackedMarkdown();

for (const file of files) {
  const src = readFileSync(file, "utf-8");
  const lines = src.split(/\r?\n/);

  for (const re of [INLINE, REFERENCE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const target = m[1];
      if (/^(https?:|mailto:|#|<)/.test(target)) continue;

      const path = decodeURIComponent(target.split("#")[0]);
      if (!path) continue;

      const abs = resolve(dirname(file), path);
      if (existsSync(abs)) continue;

      const upto = src.slice(0, m.index);
      const line = upto.split("\n").length;
      broken.push({ file: rel(file), line, target, text: lines[line - 1]?.trim().slice(0, 100) });
    }
  }
}

if (broken.length > 0) {
  console.error(`doc-links: ${broken.length} broken link(s)\n`);
  for (const b of broken) {
    console.error(`  ${b.file}:${b.line}  ->  ${b.target}`);
    console.error(`    ${b.text}`);
  }
  console.error(
    "\nA stale link reads as verified, which is worse than no link at all.\n" +
      "Point it at the file's new home, or delete the reference.",
  );
  process.exit(1);
}

console.log(`doc-links: every relative link resolves, in ${files.length} tracked documents`);
