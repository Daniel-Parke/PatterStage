// ═══════════════════════════════════════════════════════════════
// Script templates — the starters the Scripts page offers
//
// The bash trio was extracted verbatim from app/orchestration/scripts/page.tsx.
// Data only: picking one opens it in the editor, it is never written to disk
// from here.
//
// The gallery shipped three bash starters and nothing else, on a product whose
// own bundled scripts are `.mjs` and which runs on native Windows, where bash
// is not there to run them. So a Windows operator's first click produced a file
// their machine could not execute. The `.mjs` pair leads for that reason: the
// first card an operator meets should be one that runs wherever PatterStage
// does. The bash trio is kept — it is still the better answer on Linux.
//
// The gallery calls openNew(name, content) with the full filename, so the
// editor's bare-name defaulting never fires here and no card can produce a
// double extension.
// ═══════════════════════════════════════════════════════════════

export interface ScriptTemplate {
  id: string;
  name: string;
  label: string;
  description: string;
  content: string;
}

// Starter templates installable from the gallery (open in the editor first).
export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "skeleton-node",
    name: "my-script.mjs",
    label: "Blank skeleton (cross-platform)",
    description: "A safe starting point with logging. Runs wherever Node does.",
    content: `#!/usr/bin/env node
// my-script.mjs — describe what this does
// Node is the one interpreter PatterStage can count on, so this runs on
// Linux, macOS and native Windows alike.

const log = (...args) => console.log(\`[\${new Date().toISOString()}]\`, ...args);

log("started");
// … your commands here …
log("done");
`,
  },
  {
    id: "http-ping-node",
    name: "http-ping.mjs",
    label: "HTTP health ping (cross-platform)",
    description: "Fetch a URL and exit non-zero if it's not 200. No curl needed.",
    content: `#!/usr/bin/env node
// http-ping.mjs — fail (non-zero) unless URL returns 200
// PING_URL overrides the target.

const url = process.env.PING_URL || "https://example.com";
const stamp = () => \`[\${new Date().toISOString()}]\`;

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  console.log(stamp(), url, "->", res.status);
  // exitCode rather than exit(): it lets stdout flush before we end.
  if (res.status !== 200) process.exitCode = 1;
} catch (err) {
  console.error(stamp(), url, "-> unreachable:", err.message);
  process.exitCode = 1;
}
`,
  },
  {
    id: "skeleton",
    name: "my-script.sh",
    label: "Blank skeleton",
    description: "A safe starting point with logging + strict mode.",
    content: `#!/usr/bin/env bash
# my-script.sh — describe what this does
set -euo pipefail

log() { echo "[$(date -Iseconds 2>/dev/null || date)] $*"; }

log "started"
# … your commands here …
log "done"
`,
  },
  {
    id: "http-ping",
    name: "http-ping.sh",
    label: "HTTP health ping",
    description: "Curl a URL and exit non-zero if it's not 200.",
    content: `#!/usr/bin/env bash
# http-ping.sh — fail (non-zero) unless URL returns 200
set -uo pipefail
URL="\${PING_URL:-https://example.com}"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null || echo "000")
echo "[$(date -Iseconds 2>/dev/null || date)] $URL -> $code"
[ "$code" = "200" ]
`,
  },
  {
    id: "dir-backup",
    name: "dir-backup.sh",
    label: "Directory backup",
    description: "Tar a directory into a timestamped archive + rotate.",
    content: `#!/usr/bin/env bash
# dir-backup.sh — tar a directory, keep the newest \$KEEP archives
set -euo pipefail
SRC="\${BACKUP_SRC:-$HOME/important}"
DEST="\${BACKUP_DEST:-$HOME/backups}"
KEEP="\${BACKUP_KEEP:-7}"
mkdir -p "$DEST"
ts=$(date -u +%Y%m%dT%H%M%SZ)
tar -czf "$DEST/backup-$ts.tar.gz" -C "$(dirname "$SRC")" "$(basename "$SRC")"
echo "[$(date -Iseconds)] wrote $DEST/backup-$ts.tar.gz"
ls -1t "$DEST"/backup-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
`,
  },
];
