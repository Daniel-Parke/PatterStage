import type { NextConfig } from "next";

// Comma-separated full origins (scheme + host + port). scripts/bootstrap/setup.sh generates
// CH_ALLOWED_DEV_ORIGINS for your chosen PORT (localhost, 127.0.0.1, LAN IPv4s).

const extraOrigins = (process.env.CH_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  // Strip scheme prefix — Next.js allowedDevOrigins expects bare host:port, not full URLs
  .map((s) => s.replace(/^https?:\/\//, ""))
  // Also add bare host without port (HMR WebSocket connections arrive without port)
  .flatMap((s) => {
    const results = [s];
    const [host] = s.split(":");
    // If the entry had a port and the bare host isn't already in the list
    if (s !== host && host) {
      results.push(host);
    }
    return results;
  });

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Keep the native better-sqlite3 binding external from the server bundle.
  // The orchestration scheduler now opens the DB at boot (via instrumentation),
  // not just inside request handlers, so the native module must not be traced
  // into the bundle.
  serverExternalPackages: ["better-sqlite3"],

  // Allow devices on local network to access dev server (explicit list; no CIDR).

  allowedDevOrigins: ["*.local", ...extraOrigins],
};

export default nextConfig;
