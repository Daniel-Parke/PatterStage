#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Hermes Config Backup Script
# ═══════════════════════════════════════════════════════════════
# Backs up your Hermes agent configuration, skills, memory, and
# PatterStage data to a portable directory or git repo.
#
# Usage:
#   bash scripts/bootstrap/backup-hermes-config.sh [target_dir]
#
# If no target_dir is given, creates ~/hermes-backup-YYYYMMDD/
# ═══════════════════════════════════════════════════════════════

set -e

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
TARGET="${1:-$HOME/hermes-backup-$(date +%Y%m%d)}"

echo "╔══════════════════════════════════════════╗"
echo "║       Hermes Config Backup                ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Source: $HERMES_HOME"
echo "Target: $TARGET"
echo ""

mkdir -p "$TARGET"

# 1. Config files
echo "Backing up config files..."
for f in config.yaml AGENT.md HERMES.md SOUL.md; do
    if [ -f "$HERMES_HOME/$f" ]; then
        cp "$HERMES_HOME/$f" "$TARGET/$f"
        echo "  ✓ $f"
    fi
done

# 2. .env — ONLY template (redacted), never raw secrets
if [ -f "$HERMES_HOME/.env" ]; then
    # Create template with key names and placeholder values
    grep -v '^#' "$HERMES_HOME/.env" | grep -v '^$' | sed 's/=.*/=/' > "$TARGET/.env.template"
    # Add header
    echo "# .env template — fill in your own values" > "$TARGET/.env"
    echo "# Never commit the real .env with secrets" >> "$TARGET/.env"
    cat "$TARGET/.env.template" >> "$TARGET/.env"
    rm "$TARGET/.env.template"
    echo "  ✓ .env (template only — no secrets)"
fi

# 3. Memory files
echo "Backing up memory..."
mkdir -p "$TARGET/memories"
for f in USER.md MEMORY.md; do
    if [ -f "$HERMES_HOME/memories/$f" ]; then
        cp "$HERMES_HOME/memories/$f" "$TARGET/memories/$f"
        echo "  ✓ memories/$f"
    fi
done

# 4. Memory database
if [ -f "$HERMES_HOME/memory_store.db" ]; then
    cp "$HERMES_HOME/memory_store.db" "$TARGET/memory_store.db"
    echo "  ✓ memory_store.db"
fi

# 5. Skills
echo "Backing up skills..."
if [ -d "$HERMES_HOME/skills" ]; then
    mkdir -p "$TARGET/skills"
    if command -v rsync &>/dev/null; then
        rsync -a --exclude='__pycache__' --exclude='*.pyc' "$HERMES_HOME/skills/" "$TARGET/skills/"
    else
        cp -R "$HERMES_HOME/skills/." "$TARGET/skills/"
    fi
    SKILL_COUNT=$(find "$TARGET/skills" -name "SKILL.md" 2>/dev/null | wc -l)
    echo "  ✓ skills/ ($SKILL_COUNT skills)"
fi

# 6. PatterStage data (default ~/control-hub/data; legacy ~/.hermes/control-hub/data)
echo "Backing up PatterStage data..."
PS_DATA_ROOT="${PS_DATA_DIR:-${CH_DATA_DIR:-${CONTROL_HUB_DATA_DIR:-$( [ ! -d "$HOME/patterstage/data" ] && [ -d "$HOME/control-hub/data" ] && echo "$HOME/control-hub/data" || echo "$HOME/patterstage/data" )}}}"
backup_ps_data() {
    local SRC="$1"
    local LABEL="$2"
    if [ ! -d "$SRC" ]; then
        return 0
    fi
    mkdir -p "$TARGET/control-hub/data"
    if command -v rsync &>/dev/null; then
        rsync -a "$SRC/" "$TARGET/control-hub/data/" 2>/dev/null || true
    else
        cp -R "$SRC/." "$TARGET/control-hub/data/" 2>/dev/null || true
    fi
    MISSION_COUNT=$(find "$TARGET/control-hub/data/missions" -name "*.json" 2>/dev/null | wc -l)
    TEMPLATE_COUNT=$(find "$TARGET/control-hub/data/templates" -name "*.json" 2>/dev/null | wc -l)
    echo "  ✓ $LABEL ($MISSION_COUNT missions, $TEMPLATE_COUNT templates)"
}
if [ -d "$PS_DATA_ROOT" ]; then
    backup_ps_data "$PS_DATA_ROOT" "PatterStage data ($PS_DATA_ROOT)"
elif [ -d "$HERMES_HOME/control-hub/data" ]; then
    backup_ps_data "$HERMES_HOME/control-hub/data" "PatterStage data (legacy under HERMES_HOME)"
fi

# 7. Channel directory
if [ -f "$HERMES_HOME/channel_directory.json" ]; then
    cp "$HERMES_HOME/channel_directory.json" "$TARGET/channel_directory.json"
    echo "  ✓ channel_directory.json"
fi

# 8. Create .gitignore for the backup repo
cat > "$TARGET/.gitignore" << 'EOF'
# Sensitive files — do not commit
.env
*.db
sessions/
logs/
backups/
cron/output/
__pycache__/
*.pyc

# Keep these
!.env.template
EOF
echo "  ✓ .gitignore"

# 9. Create restore script
cat > "$TARGET/restore.sh" << 'RESTORE'
#!/bin/bash
# Restore Hermes config from this backup
set -e
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
echo "Restoring to $HERMES_HOME..."
mkdir -p "$HERMES_HOME/memories"
for f in config.yaml AGENT.md HERMES.md SOUL.md; do
    [ -f "$f" ] && cp "$f" "$HERMES_HOME/$f" && echo "  ✓ $f"
done
[ -f ".env" ] && echo "  ⚠ .env: manually copy your secrets (template only in backup)"
[ -d "memories" ] && cp -r memories/* "$HERMES_HOME/memories/" && echo "  ✓ memories/"
[ -f "memory_store.db" ] && cp memory_store.db "$HERMES_HOME/memory_store.db" && echo "  ✓ memory_store.db"
[ -d "skills" ] && rsync -a skills/ "$HERMES_HOME/skills/" && echo "  ✓ skills/"
[ -d "control-hub" ] && mkdir -p "$HERMES_HOME/control-hub" && rsync -a control-hub/ "$HERMES_HOME/control-hub/" && echo "  ✓ control-hub/"
echo "Restore complete!"
RESTORE
chmod +x "$TARGET/restore.sh"
echo "  ✓ restore.sh"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Backup Complete!                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "To restore: cd $TARGET && bash restore.sh"
echo "To version: cd $TARGET && git init && git add . && git commit -m 'Hermes config backup'"
echo ""
