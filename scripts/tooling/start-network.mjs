import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { configuredPublicOrigin, selectedNetworkMode } from "./network-boundary.mjs";

try {
  const origin = configuredPublicOrigin();
  const mode = selectedNetworkMode(origin);
  const port = process.env.PORT ?? "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("PORT must be a TCP port from 1 to 65535");

  if (mode === "insecure-lan") {
    console.warn("[auth] Insecure LAN HTTP is enabled. Network observers may capture browser sessions.");
  } else {
    console.warn("[auth] Private-proxy mode requires an isolated app network. Never publish this HTTP listener to browsers.");
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const next = join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [next, "start", "-H", "0.0.0.0", "-p", port], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", error => { console.error("[auth] Could not start the network listener:", error.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
} catch (error) {
  console.error(`[auth] Network startup refused: ${error instanceof Error ? error.message : "invalid configuration"}`);
  process.exitCode = 1;
}
