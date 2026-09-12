-- 017_bench_gateways.sql — ephemeral per-profile benchmark gateways
--
-- A benchmark of an agent's CONFIG (skills/tools/memory toggles) can only be
-- real if Hermes actually serves that config. Hermes serves one profile per
-- gateway, so the benchmark gateway manager spawns a short-lived `hermes
-- gateway run` process bound to the ephemeral __bench_<runId> profile on its own
-- port. This table tracks the live process so a crashed PatterStage can kill the
-- orphaned gateway on next boot (the in-memory registry is the fast path).
CREATE TABLE IF NOT EXISTS bench_gateways (
  slug       TEXT PRIMARY KEY,      -- ephemeral profile slug (__bench_<runId>)
  run_id     TEXT,                  -- owning benchmark run
  pid        INTEGER,               -- spawned `hermes gateway run` process id
  host       TEXT NOT NULL DEFAULT '127.0.0.1',
  port       INTEGER NOT NULL,
  home       TEXT,                  -- HERMES_HOME the gateway was launched with
  created_at TEXT NOT NULL
);
