import { test, expect, request, type APIRequestContext, type Page } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import Database from "better-sqlite3";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      if (!address || typeof address === "string") return reject(new Error("No TCP port"));
      socket.close(() => resolve(address.port));
    });
  });
}

async function waitForListener(server: ChildProcess, origin: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`Owned mission listener exited before readiness: ${server.exitCode ?? server.signalCode}`);
    }
    try {
      const response = await fetch(`${origin}/api/agent/profiles`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch { /* Listener has not started yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Owned mission listener did not become ready within 30 seconds");
}

async function saveMission(api: APIRequestContext, name: string): Promise<string> {
  const response = await api.post("/api/missions", {
    data: { action: "dispatch", dispatchMode: "save", name, instruction: `Saved task for ${name}` },
  });
  expect(response.status(), `saving ${name}`).toBe(201);
  const body = await response.json() as { data?: { mission?: { id?: string } } };
  expect(body.data?.mission?.id, `id for ${name}`).toBeTruthy();
  return body.data!.mission!.id!;
}

async function openLink(page: Page, origin: string, missionId: string, name: string): Promise<void> {
  await page.goto(`${origin}/work/missions?mission=${encodeURIComponent(missionId)}`);
  await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
  await expect.soft(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.soft(page.getByRole("button", { name: /Edit draft/i })).toBeVisible({ timeout: 15_000 });
}

test("the oldest of 201 saved missions opens by its published link at desktop and phone widths", async ({ browser }) => {
  test.setTimeout(180_000);
  const dataDir = mkdtempSync(join(tmpdir(), "t0185-old-link-"));
  const token = randomBytes(32).toString("base64url");
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  let server: ChildProcess | undefined;
  let api: APIRequestContext | undefined;

  try {
    // Project-owned migration and session fixture, confined to this temporary database.
    const prepared = spawnSync(process.execPath, [join(process.cwd(), "tests/e2e/prepare-data-dir.mjs"), dataDir], {
      cwd: process.cwd(), encoding: "utf8", timeout: 60_000,
      env: { ...process.env, PS_DATA_DIR: dataDir, CH_DATA_DIR: dataDir },
    });
    expect(prepared.status, `isolated fixture: ${prepared.stderr}`).toBe(0);

    server = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: process.cwd(), stdio: "ignore",
      env: {
        ...process.env, PS_DATA_DIR: dataDir, CH_DATA_DIR: dataDir,
        HERMES_HOME: join(dataDir, "hermes-home"), PS_AUTH_TOKEN: token,
        PS_AUTH_MODE: "token", PS_PUBLIC_ORIGIN: origin, PS_READ_ONLY: "0",
      },
    });
    let launchError: Error | undefined;
    server.on("error", (error) => { launchError = error; });
    await waitForListener(server, origin, token);
    if (launchError) throw launchError;

    api = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const oldestName = `Oldest link fixture ${runId}`;
    const oldestId = await saveMission(api, oldestName);

    const fixtureDb = new Database(join(dataDir, "patterstage.db"));
    try {
      const oldest = fixtureDb.prepare("SELECT created_at FROM missions WHERE id = ?")
        .get(oldestId) as { created_at: string } | undefined;
      expect(oldest, "oldest mission remains in the owned database").toBeDefined();
      const oldestTimestamp = Date.parse(oldest!.created_at);
      expect(Number.isFinite(oldestTimestamp), "oldest mission has a valid timestamp").toBe(true);
      const insertNewer = fixtureDb.prepare(`
        INSERT INTO missions (id, name, prompt, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const seedNewer = fixtureDb.transaction(() => {
        for (let index = 0; index < 200; index += 1) {
          const name = `Newer link fixture ${runId}-${index}`;
          const timestamp = new Date(oldestTimestamp + (index + 1) * 1000).toISOString();
          insertNewer.run(randomUUID(), name, `Saved task for ${name}`, timestamp, timestamp);
        }
      });
      seedNewer();

      const total = fixtureDb.prepare("SELECT COUNT(*) AS count FROM missions")
        .get() as { count: number };
      expect(total.count, "the owned database contains exactly 201 missions").toBe(201);
      const newer = fixtureDb.prepare("SELECT COUNT(*) AS count FROM missions WHERE created_at > ?")
        .get(oldest!.created_at) as { count: number };
      expect(newer.count, "200 mission timestamps must be strictly newer").toBe(200);
    } finally {
      fixtureDb.close();
    }
    const firstPageResponse = await api.get("/api/missions?limit=200");
    expect(firstPageResponse.status()).toBe(200);
    const firstPage = await firstPageResponse.json() as { data?: { missions?: Array<{ id: string }> } };
    expect(firstPage.data?.missions).toHaveLength(200);
    expect(firstPage.data?.missions?.map((mission) => mission.id)).not.toContain(oldestId);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({
        viewport, extraHTTPHeaders: { Authorization: `Bearer ${token}` },
      });
      try {
        const page = await context.newPage();
        await openLink(page, origin, oldestId, oldestName);

        await page.goto(`${origin}/work/missions?mission=${encodeURIComponent(`missing-${runId}`)}`);
        await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible();
        await expect(page.getByText(/Mission .+ no longer exists/i)).toBeVisible({ timeout: 15_000 });
      } finally {
        await context.close();
      }
    }
  } finally {
    await api?.dispose();
    if (server && server.exitCode === null && server.signalCode === null) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Owned mission listener did not stop")), 5_000);
        server!.once("exit", () => { clearTimeout(timeout); resolve(); });
        server!.kill();
      });
    }
    const resolved = realpathSync(dataDir);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith("t0185-old-link-")) {
      throw new Error("Refusing to remove a directory outside the owned oracle fixture");
    }
    rmSync(resolved, { recursive: true, force: true });
  }
});
