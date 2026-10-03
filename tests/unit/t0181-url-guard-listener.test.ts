/** @jest-environment node */
import { createServer } from "node:http";

import { visitPage } from "@/lib/search/visit";

const linuxOnly = process.platform === "linux" ? it : it.skip;

describe("T-0181 mapped-private fetch boundary", () => {
  linuxOnly("a reachable mapped loopback listener receives no guarded request", async () => {
    let hits = 0;
    const server = createServer((_request, response) => {
      hits++;
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<title>local-only</title><p>private body</p>");
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Listener did not bind a TCP port");
      const mapped = `http://[::ffff:127.0.0.1]:${address.port}/`;
      const direct = await fetch(mapped, { signal: AbortSignal.timeout(3000) });
      expect(direct.status).toBe(200);
      expect(hits).toBe(1);
      await expect(visitPage(mapped)).resolves.toBeNull();
      expect(hits).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
