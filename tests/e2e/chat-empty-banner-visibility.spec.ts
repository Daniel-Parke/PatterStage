import { test, expect } from "../helpers/route-contract-runtime";
import type { Locator } from "@playwright/test";

// Natural empty Chat is the precondition: geometry is captured before any
// focus, click or fill can scroll a clipped warning back into view.
async function intersection(locator: Locator) {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
    let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
    const ancestors = [];
    for (let node = element.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node), box = node.getBoundingClientRect();
      const clip = { left: box.left + node.clientLeft, top: box.top + node.clientTop,
        right: box.left + node.clientLeft + node.clientWidth,
        bottom: box.top + node.clientTop + node.clientHeight };
      const clipsX = /hidden|clip|auto|scroll/.test(style.overflowX);
      const clipsY = /hidden|clip|auto|scroll/.test(style.overflowY);
      if (clipsX) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      if (clipsY) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
      if (clipsX || clipsY) ancestors.push({ tag: node.tagName, clip,
        overflowX: style.overflowX, overflowY: style.overflowY, scrollTop: node.scrollTop });
    }
    const width = Math.max(0, right - left), height = Math.max(0, bottom - top);
    const x = (left + right) / 2, y = (top + bottom) / 2;
    const hit = width > 0 && height > 0 ? document.elementFromPoint(x, y) : null;
    return { rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      visible: { left, top, width, height }, ancestors,
      reachable: !!hit && (element.contains(hit) || hit.contains(element)) };
  });
}

const conditions = ["offline", "auth-missing", "model-missing", "checking-model-missing", "ready"] as const;
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`Natural empty Chat ${viewport.width}x${viewport.height}`, () => {
    for (const condition of conditions) {
      test(`${condition}: warnings and Message remain reachable`, async ({ page, runtime }, info) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        const memory = runtime.sql(db => {
          const config = JSON.stringify({ host: "127.0.0.1", port: Number(new URL(runtime.refusalOrigin).port), bank: "owned-chat-oracle" });
          db.prepare("UPDATE memory_providers SET enabled=0,is_active=0,config_json=?").run(config);
          db.prepare("INSERT INTO memory_providers(type,label,enabled,is_active,config_json) VALUES ('hindsight','Owned disabled memory',0,1,?) ON CONFLICT(type) DO UPDATE SET enabled=0,is_active=1,config_json=excluded.config_json").run(config);
          return db.prepare("SELECT type,enabled,is_active,config_json FROM memory_providers WHERE is_active=1").all();
        });
        expect(memory).toHaveLength(1);
        expect(memory[0]).toMatchObject({ type: "hindsight", enabled: 0, is_active: 1 });
        const held = runtime.hold();
        const reads: string[] = [];
        const missing = condition === "model-missing" || condition === "checking-model-missing";
        const answers: Record<string, unknown> = {
          "/api/gateway/health": { data: { online: condition !== "offline", authConfigured: condition !== "auth-missing", baseUrl: runtime.refusalOrigin } },
          "/api/gateway/models": { data: { models: [] } },
          "/api/models": { data: { models: [] } },
          "/api/models/defaults": { data: { modelReadiness: { state: missing ? "missing" : "ready", ready: !missing, label: "Owned model", modelName: missing ? null : "owned-model", detail: missing ? "The agent has no model to answer with, so a message will not get a reply." : "" } } },
          "/api/chat": { data: { conversations: [] } },
        };
        for (const [path, body] of Object.entries(answers)) {
          await runtime.route(`**${path}`, async route => {
            expect(route.request().method(), `controlled read ${path}`).toBe("GET");
            reads.push(path);
            if (path === "/api/gateway/health" && condition === "checking-model-missing") await held.promise;
            await route.fulfill({ status: 200, json: body });
          });
        }
        await page.goto(`${runtime.origin}/work/chat`, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Chat with your agent", exact: true })).toBeVisible();
        const titles = condition === "offline" ? ["Gateway Offline"]
          : condition === "auth-missing" ? ["Gateway up — PatterStage can't authenticate"]
          : condition === "model-missing" ? ["No model is ready yet"]
          : condition === "checking-model-missing" ? ["No model is ready yet", "Checking gateway connection..."] : [];
        for (const title of titles) await page.getByText(title, { exact: true }).waitFor({ state: "attached" });
        await expect.poll(() => reads.includes("/api/models/defaults") && reads.includes("/api/gateway/health")).toBe(true);
        if (condition === "ready") {
          await expect(page.getByText("Checking gateway connection...", { exact: true })).toHaveCount(0);
          await expect(page.getByText("No model is ready yet", { exact: true })).toHaveCount(0);
          await expect(page.getByText("Gateway Offline", { exact: true })).toHaveCount(0);
          await expect(page.getByText("Gateway up — PatterStage can't authenticate", { exact: true })).toHaveCount(0);
        }
        await page.evaluate(() => document.fonts.ready);
        // Let native smooth scrolling finish; do not set scroll positions.
        await page.waitForTimeout(700);
        const geometry: Record<string, Awaited<ReturnType<typeof intersection>>> = {};
        for (const title of titles) {
          const text = page.getByText(title, { exact: true });
          const card = condition === "checking-model-missing" && title.startsWith("Checking")
            ? text.locator("..") : text.locator('xpath=ancestor::*[@role="alert" or @role="status"][1]');
          geometry[`${title}:card`] = await intersection(card);
          geometry[`${title}:title`] = await intersection(text);
        }
        const action = page.getByRole("link", { name: "Open models", exact: true });
        if (missing) {
          await expect(action).toHaveAttribute("href", "/agent/models");
          geometry.action = await intersection(action);
        }
        const message = page.getByRole("textbox", { name: "Message", exact: true });
        geometry.Message = await intersection(message);
        const documentGeometry = await page.evaluate(() => ({ h1: document.querySelectorAll("h1").length,
          width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        await info.attach("natural-intersections", { body: JSON.stringify({ condition, viewport, reads, memory,
          runtimeRoot: runtime.root, documentGeometry, geometry }, null, 2), contentType: "application/json" });
        await info.attach("natural-viewport", { body: await page.screenshot(), contentType: "image/png" });
        expect.soft(documentGeometry.h1, "one h1").toBe(1);
        expect.soft(documentGeometry.scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(documentGeometry.width);
        for (const [label, value] of Object.entries(geometry)) {
          expect.soft(value.visible.height, `${label}: full height inside every clipping ancestor`).toBeGreaterThanOrEqual(value.rect.height - 1);
          expect.soft(value.visible.width, `${label}: full width inside every clipping ancestor`).toBeGreaterThanOrEqual(value.rect.width - 1);
          expect.soft(value.reachable, `${label}: painted hit target`).toBe(true);
        }
        await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
        if (condition === "offline") {
          await expect(message).toBeDisabled();
        } else {
          await message.fill("Owned unsent draft");
          await expect(message).toHaveValue("Owned unsent draft");
        }
        held.release();
      });
    }
  });
}
