#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# PatterStage — the Reinstall step of install.sh, as a function with checks
# ═══════════════════════════════════════════════════════════════
#
# install.sh used to answer "Reinstall? (y/N)" with `rm -rf "$INSTALL_DIR"`,
# which deleted the database under `data/` on one keypress and never said so
# (T-0095, D106). This function is that step, and it does two things the old
# line did not: it moves the data directory aside BEFORE anything is removed,
# and it takes a typed word rather than a keypress.
#
#   ps_reinstall_confirm_and_remove <install_dir> <backup_root>
#
# Reads one line from stdin. Only the word DELETE proceeds; anything else
# returns 1 and touches nothing. When <install_dir>/data exists it is moved to
# <backup_root>/patterstage-data-backup-<stamp>/ and that path is printed, so
# the database survives the reinstall and the operator knows where it went.
# Sourced by scripts/bootstrap/install.sh; checked by
# tests/scripts/run-shell-custom-tests.sh.

ps_reinstall_confirm_and_remove() {
  local install_dir="$1"
  local backup_root="$2"
  local reply=""

  printf '   Reinstall? This removes %s. Type DELETE to continue: ' "$install_dir"
  IFS= read -r reply || reply=""
  echo ""
  if [ "$reply" != "DELETE" ]; then
    echo "   Kept $install_dir."
    return 1
  fi

  if [ -d "$install_dir/data" ]; then
    local stamp dest
    stamp="$(date +%Y%m%d-%H%M%S)"
    dest="$backup_root/patterstage-data-backup-$stamp"
    mkdir -p "$backup_root"
    mv "$install_dir/data" "$dest"
    echo "   Data directory moved to $dest (the database is in it). Delete it yourself once you are sure you do not need it."
  fi

  rm -rf "$install_dir"
  echo "   Removed $install_dir."
  return 0
}
