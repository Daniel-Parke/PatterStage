// scripts/tooling/check-agent-files.mjs
//
// Two mechanical rules from the PatterTech EOS, enforced here so they cannot rot:
//   E003  CLAUDE.md must be a BYTE-IDENTICAL copy of AGENTS.md.
//   E007  the router (AGENTS.md) is hard-capped at 40 lines.
//
// Why the cap: AGENTS.md reached 183 lines of project detail, went stale, and
// agents followed it anyway — it told them to write `--ch-*` CSS variables that
// do not exist and to use a component that had been deleted. A router that stays
// short stays read; the detail belongs in docs/contributing/repo-guide.md where being wrong is
// survivable.
//
// Run by `npm run lint`. Exits non-zero on a violation.

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROUTER_CAP = 40;

const failures = [];

const agentsPath = join(ROOT, "AGENTS.md");
const claudePath = join(ROOT, "CLAUDE.md");

if (!existsSync(agentsPath)) {
  failures.push("AGENTS.md is missing");
} else {
  const agents = readFileSync(agentsPath);
  // Match Python's str.splitlines(), which eos_check.py uses: a trailing newline
  // does NOT add a line. Counting differently would put this gate at odds with
  // the EOS's own gate, which is exactly the derived-state drift it warns about.
  const lines = agents.toString("utf-8").replace(/\r?\n$/, "").split(/\r?\n/).length;
  if (lines > ROUTER_CAP) {
    failures.push(
      `AGENTS.md is ${lines} lines, cap ${ROUTER_CAP}. Move detail into docs/contributing/repo-guide.md.`,
    );
  }

  if (!existsSync(claudePath)) {
    failures.push("CLAUDE.md is missing — it must be a byte-identical copy of AGENTS.md");
  } else if (!readFileSync(claudePath).equals(agents)) {
    failures.push(
      "CLAUDE.md is not byte-identical to AGENTS.md. Copy it: cp AGENTS.md CLAUDE.md",
    );
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`agent-files: ${f}`);
  process.exit(1);
}

console.log("agent-files: AGENTS.md within cap, CLAUDE.md identical");
