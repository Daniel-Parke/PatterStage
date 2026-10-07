// ═══════════════════════════════════════════════════════════════
// runtime-status-format.ts — the runtime status's shape and its one-block form
//
// Client-safe on purpose: the System page imports this, and the collector
// (runtime-status.ts) reads the file system and the database, which a
// browser bundle cannot carry. The shape lives here so both sides share it
// without the page importing the collector.
// ═══════════════════════════════════════════════════════════════

export interface RuntimeStatus {
  authMode: "token" | "none";
  deployApiEnabled: boolean;
  readOnly: boolean;
  composerEnabled: boolean;
  dataDir: string;
  dbPath: string;
  hermesHome: string;
  port: number;
  schemaVersion: number;
  appVersion: string;
  gitHash: string;
  gatewayUrl: string;
  node: string;
  platform: string;
}

/** Redact credential-bearing URL components; arbitrary path segments are retained. */
export function diagnosticGatewayUrl(value: string): string {
  if ([...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return "invalid-endpoint";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "invalid-endpoint";
    return url.origin + (url.pathname === "/" ? "" : url.pathname);
  } catch {
    return "invalid-endpoint";
  }
}

/**
 * The same facts as one pasteable block, the shape the boot line uses, so a
 * bug report uses the same diagnostic fields. Gateway userinfo, query and
 * fragment are removed by the collector; arbitrary path segments remain.
 */
export function formatRuntimeStatus(s: RuntimeStatus): string {
  return [
    `PatterStage ${s.appVersion} commit=${s.gitHash}`,
    `auth=${s.authMode}  deploy-api=${s.deployApiEnabled ? "on" : "off"}  read-only=${s.readOnly ? "on" : "off"}  composer=${s.composerEnabled ? "on" : "off"}`,
    `schema=${s.schemaVersion}  port=${s.port}  node=${s.node}  platform=${s.platform}`,
    `data=${s.dataDir}`,
    `db=${s.dbPath}`,
    `hermes-home=${s.hermesHome}`,
    `gateway=${s.gatewayUrl}`,
  ].join("\n");
}
