#!/usr/bin/env bash
# Real-Hermes integration gate: bring up PatterStage + the REAL Hermes Agent +
# a mock LLM, run the contract-conformance + full-stack smoke tests against the
# stack, then tear down. This is the merge gate for runtime changes.
set -euo pipefail
cd "$(dirname "$0")/../.."

PROJECT="${COMPOSE_PROJECT:-hermes-realtest}"
COMPOSE="docker compose -f docker-compose.real-hermes.yml -p ${PROJECT}"
PS_PORT="${PORT:-42069}"
H_PORT="${HERMES_PORT:-8642}"
KEY="hermes-real-itest-key"
# PatterStage operator token; must match PS_AUTH_TOKEN in docker-compose.real-hermes.yml.
PS_TOKEN="hermes-real-itest-token"

cleanup() { [ "${KEEP_STACK:-0}" = "1" ] || ${COMPOSE} down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Start from a clean slate so prior runs don't count against Hermes' concurrency
# limit (max 10 concurrent runs) and session-title uniqueness.
${COMPOSE} down -v >/dev/null 2>&1 || true

echo "[itest] building + starting real-Hermes stack (first run pulls a ~5GB image)…"
${COMPOSE} up -d --build

echo "[itest] waiting for PatterStage (depends on real Hermes being healthy)…"
up=0
for i in $(seq 1 150); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PS_PORT}/api/health" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then up=1; echo "[itest] patterstage up after ~$((i*2))s"; break; fi
  sleep 2
done
if [ "$up" != "1" ]; then
  echo "[itest] patterstage did not come up"; ${COMPOSE} ps; ${COMPOSE} logs --tail 50 hermes patterstage; exit 1
fi

echo "[itest] ── contract conformance (raw real Hermes API server) ──"
HERMES_URL="http://localhost:${H_PORT}" API_SERVER_KEY="${KEY}" \
  node tests/integration/runtime/hermes-contract.mjs

echo "[itest] ── full-stack smoke (PatterStage → real Hermes) ──"
PS_URL="http://localhost:${PS_PORT}" HERMES_URL="http://localhost:${H_PORT}" API_SERVER_KEY="${KEY}" \
  PS_AUTH_TOKEN="${PS_TOKEN}" \
  node tests/integration/runtime/full-stack-smoke.mjs

echo "[itest] ── DB upgrade path (legacy DB self-migrates on boot) ──"
# Seed a legacy pre-rewrite DB (schema_version 2, no cron_jobs.workdir, no
# runs/schedules) into the PatterStage data volume, restart, and assert the
# server self-migrates: /api/schedules returns 200 (it needs the `schedules`
# table the legacy seed dropped — restored by migration 009 on the v2→latest
# upgrade). Guards the upgrade path the fresh-DB stack skips.
${COMPOSE} stop patterstage >/dev/null
${COMPOSE} run --rm --no-deps --entrypoint node patterstage -e '
  const Database = require("better-sqlite3");
  const fs = require("fs");
  const p = "/data/ch/control-hub.db";
  for (const s of ["", "-wal", "-shm"]) { try { fs.rmSync(p + s); } catch (e) {} }
  const db = new Database(p);
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  db.exec(fs.readFileSync("/app/src/lib/db/migrations/001_baseline.sql", "utf8"));
  db.pragma("foreign_keys = OFF");
  db.exec("ALTER TABLE cron_jobs DROP COLUMN workdir");
  db.exec("DROP TABLE IF EXISTS runs");
  db.exec("DROP TABLE IF EXISTS schedules");
  db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)").run("schema_version", "2");
  db.close();
  console.log("seeded legacy DB (v2, no workdir/runs/schedules)");
'
${COMPOSE} start patterstage >/dev/null
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PS_PORT}/api/health" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 2
done
if [ "$up" != "1" ]; then
  echo "[itest] patterstage did not restart after legacy seed"; ${COMPOSE} logs --tail 40 patterstage; exit 1
fi
# /api/cron was removed with the legacy cron page (Phase M); assert /api/schedules
# instead — it requires the `schedules` table the legacy seed dropped, so a 200
# proves the v2→latest migration restored the runs/schedules schema.
mcode=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${PS_TOKEN}" "http://localhost:${PS_PORT}/api/missions")
scode=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${PS_TOKEN}" "http://localhost:${PS_PORT}/api/schedules")
echo "[itest] post-upgrade: /api/missions=${mcode} /api/schedules=${scode}"
if [ "$mcode" != "200" ] || [ "$scode" != "200" ]; then
  echo "[itest] upgrade FAILED — runs/schedules migration likely incomplete"; ${COMPOSE} logs --tail 40 patterstage; exit 1
fi
echo "[itest] DB upgrade path OK ✅"

echo "[itest] PASSED ✅"
