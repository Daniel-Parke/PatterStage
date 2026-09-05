// ═══════════════════════════════════════════════════════════════
// runtime-status.ts — how this install is configured, as data (T-0097, D109)
//
// The boot line (boot-diagnostics.ts) said this in the terminal and nowhere
// else; an operator who set PS_READ_ONLY in one shell and started the server
// from another could not tell from inside the product. This is the same set of
// facts for GET /api/status/runtime, the System page's "This install" card and
// its "Copy for a bug report" button.
//
// SERVER ONLY. It reads the file system, the database and git; the shape and
// the pasteable form live in runtime-status-format.ts so the page can import
// them without dragging any of this into a browser bundle.
//
// NO SECRETS. It says whether the token mode is on, never what the token is;
// the gateway URL is an address, not a credential. Every reader here is the
// one the guards use, so the answer cannot claim a state a guard does not
// enforce.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { join } from "path";

import { isDeployApiEnabled, isReadOnly } from "@/lib/api-auth";
import { getAuthMode } from "@/lib/auth-token";
import { getDb } from "@/lib/db";
import { getSchemaVersion } from "@/lib/db-schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { PS_DATA_DIR, getDbPath, readEnv } from "@/lib/paths";
import type { RuntimeStatus } from "@/lib/status/runtime-status-format";
import { runGit } from "@/lib/update-handlers/shared";

/** The gateway address the runtime falls back to when HERMES_GATEWAY_URL is unset. */
const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8642";

function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function gitHash(): string {
  try {
    return runGit(["rev-parse", "--short", "HEAD"]) || "unknown";
  } catch {
    return "unknown";
  }
}

function schemaVersion(): number {
  try {
    return getSchemaVersion(getDb());
  } catch {
    return 0;
  }
}

/**
 * The agent's home is the one fact core cannot read itself (ADR-0005: core
 * does not import a module), so the route hands it in.
 */
export function collectRuntimeStatus(agent: { hermesHome: string }): RuntimeStatus {
  return {
    authMode: getAuthMode(),
    deployApiEnabled: isDeployApiEnabled(),
    readOnly: isReadOnly(),
    composerEnabled: isFeatureEnabled("composer"),
    dataDir: PS_DATA_DIR,
    dbPath: getDbPath(),
    hermesHome: agent.hermesHome,
    port: Number(readEnv("PORT")) || 3000,
    schemaVersion: schemaVersion(),
    appVersion: appVersion(),
    gitHash: gitHash(),
    gatewayUrl: readEnv("HERMES_GATEWAY_URL") ?? DEFAULT_GATEWAY_URL,
    node: process.version,
    platform: process.platform,
  };
}
