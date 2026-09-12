#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// scripts/docs/serve.mjs — look at the built site without deploying it
//
// node:http and nothing else. A documentation preview is not worth a dependency,
// and the point of the exercise is that site/ is a folder of static files: the
// moment previewing it needs a framework, the claim that GitHub Pages can serve
// it unchanged has quietly stopped being true.
//
// Port 0 by default, so two of these can run at once and neither fights the dev
// server for 3000. The bound port is printed once the socket is listening,
// because with port 0 the number is not knowable until then.
//
// Run: node scripts/docs/serve.mjs [--port 0] [--root site]
// ═══════════════════════════════════════════════════════════════

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function parseArgs(argv) {
  const value = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
  };
  return {
    port: Number(value("--port", "0")),
    root: resolve(ROOT, value("--root", "site")),
  };
}

const args = parseArgs(process.argv.slice(2));

if (!existsSync(args.root)) {
  console.error(`docs:serve: ${args.root} does not exist. Run \`npm run docs:build\` first.`);
  process.exit(1);
}

/**
 * Map a request path to a file inside the root, or null.
 *
 * The resolved path is checked to be under the root before anything is opened.
 * This server only ever sees localhost traffic, but a static server that walks
 * out of its own directory on `../../` is a bad habit to leave lying in a repo
 * where somebody may copy it somewhere that matters.
 */
function fileFor(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch {
    return null;
  }
  const candidate = resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  if (!existsSync(candidate)) return null;
  if (statSync(candidate).isDirectory()) {
    const index = join(candidate, "index.html");
    return existsSync(index) ? index : null;
  }
  return candidate;
}

const server = createServer((req, res) => {
  const file = fileFor(args.root, req.url ?? "/");
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`404 ${req.url}\n`);
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    // A preview that serves yesterday's build from the browser cache is worse
    // than no preview: it reports a fix that has not landed.
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
});

server.listen(args.port, "127.0.0.1", () => {
  const { port } = server.address();
  console.log(`docs:serve: http://127.0.0.1:${port}/  (serving ${args.root}, ctrl-c to stop)`);
});
