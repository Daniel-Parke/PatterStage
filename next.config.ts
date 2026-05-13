import type { NextConfig } from "next";

// Comma-separated full origins (scheme + host + port). scripts/bootstrap/setup.sh generates
// CH_ALLOWED_DEV_ORIGINS for your chosen PORT (localhost, 127.0.0.1, LAN IPv4s).

const extraOrigins = (process.env.CH_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  // Strip scheme prefix — Next.js allowedDevOrigins expects bare host:port, not full URLs
  .map((s) => s.replace(/^https?:\/\//, ""));

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Allow devices on local network to access dev server (explicit list; no CIDR).

  allowedDevOrigins: ["*.local", ...extraOrigins],
};

export default nextConfig;
