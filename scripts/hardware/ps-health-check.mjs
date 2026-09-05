#!/usr/bin/env node
// ps-health-check.mjs — probe PatterStage + Hermes gateway health (read-only).
// Cross-platform (Windows/macOS/Linux). Exits non-zero if PatterStage is
// unreachable (a useful scheduled heartbeat).
//   PS_URL      (http://127.0.0.1:${PORT:-3000})
//   GATEWAY_URL (http://127.0.0.1:8642)

const PS_URL = process.env.PS_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:8642";
const log = (m) => console.log(`[${new Date().toISOString()}] [ps-health] ${m}`);

async function probe(name, url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.status === 200) {
      log(`OK   ${name} (${url}) → 200`);
      return true;
    }
    log(`FAIL ${name} (${url}) → ${res.status}`);
  } catch {
    log(`FAIL ${name} (${url}) → unreachable`);
  }
  return false;
}

const psOk = await probe("PatterStage", `${PS_URL}/api/health`);
await probe("Gateway", `${GATEWAY_URL}/health`); // gateway down is informational
const rc = psOk ? 0 : 1;
log(`health check complete (rc=${rc})`);
process.exit(rc);
