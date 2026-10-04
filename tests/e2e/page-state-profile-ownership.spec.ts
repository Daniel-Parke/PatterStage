// T-0193 independent ORACLE Faraday, 2026-10-04. Real isolated reads/persistence;
// only response delivery is held. No operator data or provider execution.
import { test, expect } from "../helpers/route-contract-runtime";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0193 profile ownership ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    for (const kind of ["create", "edit"] as const) {
      test(`${kind} late completion persists A and preserves usable replacement B`, async ({ page, runtime }) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
        page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
        async function contained() {
          const widths = await page.evaluate(() => [document.documentElement, document.querySelector("main"), document.querySelector('[role="dialog"]')]
            .filter((element): element is HTMLElement => element instanceof HTMLElement)
            .map(element => ({ name: element.tagName, scroll: element.scrollWidth, client: element.clientWidth })));
          expect(widths.length).toBeGreaterThanOrEqual(2);
          for (const width of widths) expect.soft(width.scroll, `${width.name} horizontal overflow`).toBeLessThanOrEqual(width.client + 1);
        }
        for (const name of ["Oracle A", "Oracle B"]) {
          const seed = await runtime.api("/api/agent/profiles", "POST", { name, description: `Original ${name}`, cloneFrom: "default" });
          expect(seed.status).toBe(200);
        }
        await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("patterstage.selected-profile", "oracle-a"); });
        const hold = runtime.hold(); let writes = 0, persisted = false;
        const path = kind === "create" ? "/api/agent/profiles" : "/api/agent/profiles/oracle-a";
        const method = kind === "create" ? "POST" : "PUT";
        await runtime.route(`**${path}`, async route => {
          if (route.request().method() !== method) { await route.fallback(); return; }
          writes++;
          const body = route.request().postDataJSON();
          expect(body).toEqual({ name: "Submitted A", description: "Submitted description", ...(kind === "create" ? { cloneFrom: "default" } : {}) });
          const response = await runtime.api(path, method, body);
          expect(response.status).toBe(200);
          const rows = (await runtime.api("/api/agent/profiles")).json<{ data: { profiles: { id: string; name: string; description: string }[] } }>().data.profiles;
          expect(rows.find(row => row.id === "submitted-a")).toMatchObject({ name: "Submitted A", description: "Submitted description" });
          expect(rows.some(row => row.id === "oracle-b")).toBe(true);
          persisted = true;
          await hold.promise;
          await route.fulfill({ status: response.status, contentType: "application/json", body: response.body });
        });
        await page.goto(`${runtime.origin}/agent/profiles`);
        const heading = page.getByRole("heading", { level: 1 });
        await expect(heading).toHaveCount(1); await expect(heading).toHaveText("Agents");
        await expect(page.getByRole("heading", { level: 2, name: "Oracle A", exact: true })).toBeVisible();
        await contained();
        const opener = page.getByRole("button", { name: kind === "create" ? "New Profile" : "Edit profile", exact: true });
        await opener.click();
        const a = page.getByRole("dialog", { name: kind === "create" ? "New Agent Profile" : "Edit profile", exact: true });
        await a.getByRole("textbox", { name: "Name", exact: true }).fill("Submitted A");
        await a.getByRole("textbox", { name: "Description", exact: true }).fill("Submitted description");
        const delivered = page.waitForResponse(response => response.url() === `${runtime.origin}${path}` && response.request().method() === method);
        await a.getByRole("button", { name: kind === "create" ? "Create" : "Save", exact: true }).click();
        await expect.poll(() => persisted).toBe(true); expect(writes).toBe(1);
        await a.getByRole("button", { name: "Close dialog", exact: true }).click();
        await expect(opener).toBeFocused();
        if (kind === "edit") await page.getByRole("button", { name: "Oracle B", exact: true }).click();
        await opener.click();
        const b = page.getByRole("dialog", { name: kind === "create" ? "New Agent Profile" : "Edit profile", exact: true });
        await b.getByRole("textbox", { name: "Name", exact: true }).fill("Later B");
        await b.getByRole("textbox", { name: "Description", exact: true }).fill("Later description");
        if (kind === "create") {
          await b.getByRole("button", { name: "Clone from profile" }).click();
          await page.getByRole("option", { name: "Oracle B", exact: true }).click();
        }
        const selected = kind === "create" ? "oracle-a" : "oracle-b";
        await expect.poll(() => page.evaluate(() => localStorage.getItem("patterstage.selected-profile"))).toBe(selected);
        const description = b.getByRole("textbox", { name: "Description", exact: true });
        await description.focus(); await expect(description).toBeFocused();
        const refreshed = page.waitForResponse(response => response.url() === `${runtime.origin}/api/agent/profiles` && response.request().method() === "GET");
        hold.release(); await (await delivered).finished(); await (await refreshed).finished();
        await expect(page.getByRole("status").filter({ hasText: kind === "create" ? 'Profile "Submitted A" created' : 'Profile "Submitted A" updated' })).toBeVisible();
        await expect.soft(b).toBeVisible();
        await expect.soft(b.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Later B");
        await expect.soft(description).toHaveValue("Later description"); await expect.soft(description).toBeFocused();
        const action = b.getByRole("button", { name: kind === "create" ? "Create" : "Save", exact: true });
        await expect.soft(action).toBeEnabled();
        if (kind === "create") await expect.soft(b.getByRole("button", { name: "Clone from profile" })).toHaveText("Oracle B");
        await expect.poll(() => page.evaluate(() => localStorage.getItem("patterstage.selected-profile"))).toBe(selected);
        await expect.soft(page.getByRole("heading", { level: 2, name: kind === "create" ? "Oracle A" : "Oracle B", exact: true })).toBeVisible();
        await expect.soft(page.getByTestId("profile-picker")).toContainText(kind === "create" ? "Oracle A" : "Oracle B");
        await action.focus(); await page.keyboard.press("Tab");
        await expect(b.getByRole("button", { name: "Close dialog", exact: true })).toBeFocused();
        await page.keyboard.press("Shift+Tab"); await expect(action).toBeFocused();
        await contained();
        expect(writes).toBe(1);
        const final = (await runtime.api("/api/agent/profiles")).json<{ data: { profiles: { id: string; name: string; description: string }[] } }>().data.profiles;
        expect(final.find(row => row.id === "submitted-a")).toMatchObject({ name: "Submitted A", description: "Submitted description" });
        expect(final.find(row => row.id === "oracle-b")).toMatchObject({ name: "Oracle B", description: "Original Oracle B" });
        expect(final.some(row => row.name === "Later B")).toBe(false);
        await page.keyboard.press("Escape"); await expect(b).not.toBeVisible(); await expect(opener).toBeFocused();
        await expect(heading).toHaveCount(1); await expect(heading).toHaveText("Agents"); await contained();
        expect(errors).toEqual([]);
      });
    }
  });
}
