import { expect, test, type APIResponse, type Page } from "@playwright/test";

function directive(policy: string | undefined, name: string): string {
  expect(policy, "a built document must deliver CSP").toBeTruthy();
  const item = policy!.split(";").map((part) => part.trim()).find((part) => part.split(/\s+/)[0] === name);
  expect(item, `missing ${name} directive`).toBeDefined();
  return item!;
}

function nonce(response: APIResponse): string {
  const match = directive(response.headers()["content-security-policy"], "script-src")
    .match(/'nonce-([A-Za-z0-9+/_=-]+)'/);
  expect(match, "script-src needs a request nonce").not.toBeNull();
  const value = match![1];
  expect(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toHaveLength(16);
  return value;
}

function expectFrameDenial(response: APIResponse): void {
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(directive(response.headers()["content-security-policy"], "frame-ancestors")).toContain("'none'");
}

async function openHydratedMissions(page: Page): Promise<void> {
  const response = await page.goto("/work/missions", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Missions", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("header").getByRole("button", { name: /New Mission/i })).toBeEnabled({ timeout: 30_000 });
}

test.describe("T-0182 built response policy", () => {
  test("two authenticated document responses carry distinct 128-bit nonces and cannot be reused", async ({ request }) => {
    const first = await request.get("/work/missions");
    const second = await request.get("/work/missions");
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(nonce(first)).not.toBe(nonce(second));
    for (const response of [first, second]) {
      expect(response.headers()["cache-control"]).toMatch(/(?:^|,)\s*no-store(?:,|$)/i);
    }
  });

  test("forged request nonce and CSP cannot choose the delivered script policy", async ({ request }) => {
    const forged = "forged-client-nonce";
    const response = await request.get("/work/missions", {
      headers: {
        "x-nonce": forged,
        "content-security-policy": "script-src 'unsafe-inline' 'unsafe-eval'",
      },
    });
    expect(response.status()).toBe(200);
    expect(nonce(response)).not.toBe(forged);
    const script = directive(response.headers()["content-security-policy"], "script-src");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(directive(response.headers()["content-security-policy"], "script-src-attr")).toContain("'none'");
  });

  test("authenticated HTML keeps frame denial and the scoped inline-style exception", async ({ request }) => {
    const response = await request.get("/work/missions");
    expect(response.status()).toBe(200);
    nonce(response);
    expectFrameDenial(response);
    expect(directive(response.headers()["content-security-policy"], "style-src-attr")).toContain("'unsafe-inline'");
    expect(directive(response.headers()["content-security-policy"], "style-src-elem")).toContain("'self'");
  });

  test("unauthorised HTML and API refusals retain status and frame denial", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL, extraHTTPHeaders: {}, storageState: { cookies: [], origins: [] } });
    try {
      const document = await anonymous.get("/");
      expect(document.status()).toBe(401);
      nonce(document);
      expectFrameDenial(document);
      const api = await anonymous.get("/api/status");
      expect(api.status()).toBe(401);
      expectFrameDenial(api);
    } finally {
      await anonymous.dispose();
    }
  });
});

for (const viewport of [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "phone 390x844", width: 390, height: 844 },
] as const) {
  test.describe(`T-0182 browser policy at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("token sign-in creates a browser session that can navigate to Missions", async ({ browser, baseURL }) => {
      const token = process.env.PS_E2E_AUTH_TOKEN;
      expect(token).toBeTruthy();
      const context = await browser.newContext({
        baseURL,
        viewport: { width: viewport.width, height: viewport.height },
      });
      try {
        const page = await context.newPage();
        const response = await page.goto(`/?ps_token=${encodeURIComponent(token!)}`, { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
        await openHydratedMissions(page);
      } finally {
        await context.close();
      }
    });

    test("hydration, Missions dialog, Composer and Help work without unexpected CSP violations", async ({ page }) => {
      const violations: string[] = [];
      await page.addInitScript(() => {
        (window as Window & { __t0182Violations?: string[] }).__t0182Violations = [];
        document.addEventListener("securitypolicyviolation", (event) => {
          (window as Window & { __t0182Violations?: string[] }).__t0182Violations!.push(
            `${event.violatedDirective}: ${event.blockedURI}`,
          );
        });
      });
      await openHydratedMissions(page);
      await page.locator("header").getByRole("button", { name: /New Mission/i }).click();
      await expect(page.getByPlaceholder("e.g., Research quantum computing trends")).toBeVisible({ timeout: 15_000 });
      violations.push(...await page.evaluate(() => (window as Window & { __t0182Violations?: string[] }).__t0182Violations ?? []));
      await page.goto("/work/composer", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Build", exact: true })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Build", exact: true }).click();
      await expect(page.getByLabel("Name", { exact: true })).toBeVisible({ timeout: 15_000 });
      violations.push(...await page.evaluate(() => (window as Window & { __t0182Violations?: string[] }).__t0182Violations ?? []));
      await page.goto("/help/index", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("help-fragment")).toBeVisible({ timeout: 30_000 });
      violations.push(...await page.evaluate(() => (window as Window & { __t0182Violations?: string[] }).__t0182Violations ?? []));
      expect(violations).toEqual([]);
    });

    test("an injected inline script cannot execute", async ({ page, request }) => {
      let injectedDocuments = 0;
      await page.route("**/work/missions", async (route) => {
        if (!route.request().isNavigationRequest()) {
          await route.continue();
          return;
        }
        const original = await route.fetch();
        const body = await original.body();
        const closingBody = body.lastIndexOf(Buffer.from("</body>"));
        expect(closingBody, "the built document must contain </body>").toBeGreaterThanOrEqual(0);
        const injectedScript = Buffer.from("<script>window.__t0182InlineExecuted = true</script>");
        const injectedBody = Buffer.concat([
          body.subarray(0, closingBody),
          injectedScript,
          body.subarray(closingBody),
        ]);
        injectedDocuments += 1;
        await route.fulfill({ response: original, body: injectedBody });
      });

      const documentResponse = page.waitForResponse((response) =>
        response.request().isNavigationRequest() && new URL(response.url()).pathname === "/work/missions",
      );
      await openHydratedMissions(page);
      const delivered = await documentResponse;
      expect(injectedDocuments).toBe(1);
      const deliveredNonce = directive(delivered.headers()["content-security-policy"], "script-src")
        .match(/'nonce-([A-Za-z0-9+/_=-]+)'/);
      expect(deliveredNonce, "the injected document must retain its request nonce").not.toBeNull();
      expect(Buffer.from(deliveredNonce![1].replace(/-/g, "+").replace(/_/g, "/"), "base64")).toHaveLength(16);
      const nextDocument = await request.get("/work/missions");
      expect(nextDocument.status()).toBe(200);
      expect(deliveredNonce![1]).not.toBe(nonce(nextDocument));
      expect(await page.evaluate(() => Boolean((window as Window & { __t0182InlineExecuted?: boolean }).__t0182InlineExecuted))).toBe(false);
    });

    test("an injected event-handler attribute cannot execute", async ({ page }) => {
      await openHydratedMissions(page);
      await page.evaluate(() => {
        const button = document.createElement("button");
        button.textContent = "Untrusted event handler";
        button.setAttribute("onclick", "window.__t0182HandlerExecuted = true");
        document.body.append(button);
      });
      await page.getByRole("button", { name: "Untrusted event handler" }).click();
      expect(await page.evaluate(() => Boolean((window as Window & { __t0182HandlerExecuted?: boolean }).__t0182HandlerExecuted))).toBe(false);
    });
  });
}
