#!/usr/bin/env bash
# Deploy status file for dashboard polling (written by ps-deploy-impl.sh).

PS_DEPLOY_STATUS_FILE="${PS_DEPLOY_STATUS_FILE:-$HOME/.hermes/logs/ps-deploy.status}"

ps_deploy_status_ensure_dir() {
  mkdir -p "$(dirname "$PS_DEPLOY_STATUS_FILE")"
}

# ps_deploy_status_write <state> <action> <phase> <message> [exitCode] [logHint]
ps_deploy_status_write() {
  local state="$1"
  local action="$2"
  local phase="$3"
  local message="$4"
  local exit_code="${5:-}"
  local log_hint="${6:-}"
  local started_at finished_at
  ps_deploy_status_ensure_dir

  if [ "$state" = "running" ]; then
    started_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    finished_at=""
  else
    started_at="$(grep -m1 '^startedAt=' "$PS_DEPLOY_STATUS_FILE" 2>/dev/null | cut -d= -f2- || date -u '+%Y-%m-%dT%H:%M:%SZ')"
    finished_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  fi

  local tmp="${PS_DEPLOY_STATUS_FILE}.$$.tmp"
  {
    echo "state=$state"
    echo "action=$action"
    echo "phase=$phase"
    # Strip newlines from message for single-line files
    echo "message=${message//$'\n'/ }"
    echo "startedAt=$started_at"
    echo "finishedAt=$finished_at"
    echo "exitCode=$exit_code"
    echo "logHint=$log_hint"
  } >"$tmp"
  mv -f "$tmp" "$PS_DEPLOY_STATUS_FILE"
}

ps_deploy_status_clear_idle() {
  ps_deploy_status_write "idle" "" "" "Ready" "" ""
}
