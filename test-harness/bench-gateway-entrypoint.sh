#!/bin/sh
# Combined CH+Hermes entrypoint (BD4). Seed CH's HERMES_HOME with the
# mock-llm-pointing Hermes config so the gateways CH spawns for benchmark
# profiles inherit a working LLM provider + API-server key, then start CH.
set -e

mkdir -p "${PS_DATA_DIR:-/data/ch}" "${HERMES_HOME:-/data/hermes}"

# Only seed once so restarts keep any CH-written profile state.
if [ ! -f "${HERMES_HOME}/config.yaml" ]; then
  cp /seed-hermes/config.yaml "${HERMES_HOME}/config.yaml"
  cp /seed-hermes/hermes.env "${HERMES_HOME}/.env"
  echo "[ch-bench-entry] seeded ${HERMES_HOME} with mock-llm Hermes config"
fi

echo "[ch-bench-entry] HERMES_BIN=${HERMES_BIN} ($(${HERMES_BIN} --version 2>/dev/null || echo 'not runnable'))"
exec npm run start:network
