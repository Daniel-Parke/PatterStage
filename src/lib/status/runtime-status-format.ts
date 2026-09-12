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

/**
 * The same facts as one pasteable block, the shape the boot line uses, so a
 * bug report reads the way the maintainer expects and carries no secret.
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
