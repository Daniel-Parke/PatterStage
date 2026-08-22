// ═══════════════════════════════════════════════════════════════
// Script templates — the starter shell scripts the Scripts page offers
//
// Extracted verbatim from app/orchestration/scripts/page.tsx. Data only:
// picking one opens it in the editor, it is never written to disk from here.
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
