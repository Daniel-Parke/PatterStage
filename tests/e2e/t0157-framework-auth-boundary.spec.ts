import { expect, test, type APIResponse } from "@playwright/test";

function expectFrameProtection(response: APIResponse): void {
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toMatch(
    /(?:^|;)\s*frame-ancestors\s+'none'\s*(?:;|$)/i,
  );
}

test.describe("T-0157 production auth boundary", () => {
  // The configured request fixture carries a Bearer token. Each check below
  // creates its own context with no inherited credentials or browser cookies.
  test.use({ extraHTTPHeaders: {} });

  test("anonymous status request returns 401 with framing protection", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {},
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await anonymous.get("/api/status");
      expect(response.status()).toBe(401);
      expectFrameProtection(response);
    } finally {
      await anonymous.dispose();
    }
  });

  test("anonymous script run returns 401 with framing protection", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {},
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await anonymous.post("/api/scripts/run", { data: {} });
      expect(response.status()).toBe(401);
      expectFrameProtection(response);
    } finally {
      await anonymous.dispose();
    }
  });

  test("untrusted subrequest header cannot bypass anonymous status", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {},
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await anonymous.get("/api/status", {
        headers: { "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" },
      });
      expect(response.status()).toBe(401);
      expectFrameProtection(response);
    } finally {
      await anonymous.dispose();
    }
  });

  test("public health response retains framing protection", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {},
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await anonymous.get("/api/health");
      expect(response.status()).toBe(200);
      expectFrameProtection(response);
    } finally {
      await anonymous.dispose();
    }
  });
});
