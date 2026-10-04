/** @jest-environment node */
import { NextRequest, type NextResponse } from "next/server";
import { proxy } from "@/proxy";
import { createBrowserSession } from "@/lib/auth/session-store";

// Only the authentication dependencies are synthetic; proxy and Response are real.
jest.mock("@/lib/api/auth-token", () => ({
  SESSION_COOKIE: "ps_session", TOKEN_QUERY_PARAM: "ps_token",
  getAuthMode: () => "token", readAuthToken: () => "metadata-oracle-private-token",
  describeTokenSource: () => ({ kind: "file", location: "/owned/private/auth-token" }),
  tokenMatches: jest.fn(() => false),
}));
jest.mock("@/lib/auth/session-store", () => ({ createBrowserSession: jest.fn(), validateBrowserSession: jest.fn() }));
jest.mock("@/lib/auth/public-origin", () => ({ publicOrigin: jest.fn(), hasExactOrigin: jest.fn(), sessionCookieOptions: jest.fn() }));
jest.mock("@/lib/api/read-only", () => ({ isReadOnly: () => false, readOnlyMessage: () => "Read only" }));
jest.mock("@/lib/api/auth-throttle", () => ({
  authClientKey: () => "owned-metadata-client", authPenaltySeconds: () => 0,
  clearAuthFailures: jest.fn(), recordAuthFailure: jest.fn(),
}));

const { JSDOM } = require("jsdom") as {
  JSDOM: new (html: string) => { window: { document: Document; close(): void } };
};
let response: NextResponse;
let html: string;
let dom: InstanceType<typeof JSDOM>;
beforeAll(async () => {
  response = proxy(new NextRequest("http://owned.test/work/missions"));
  html = await response.text();
  dom = new JSDOM(html);
});
afterAll(() => dom?.window.close());
afterEach(() => { expect(createBrowserSession).not.toHaveBeenCalled(); });

it("declares English on the actual unauthenticated sign-in document", () => {
  expect(dom.window.document.documentElement.lang).toBe("en");
});
it("declares device-width and initial scale on the actual sign-in document", () => {
  const metas = dom.window.document.querySelectorAll('meta[name="viewport"]');
  expect(metas).toHaveLength(1);
  const directives = Object.fromEntries(metas[0].getAttribute("content")!.split(",").map(part => part.trim().split(/\s*=\s*/)));
  expect(directives).toMatchObject({ width: "device-width", "initial-scale": "1" });
});
it("preserves the 401 HTML refusal and credential form without issuing authentication cookies", () => {
  expect(response.status).toBe(401);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(html).not.toContain("metadata-oracle-private-token");
  expect(html).not.toContain("/owned/private/auth-token");
  const form = dom.window.document.querySelector("form")!;
  expect(form.getAttribute("method")).toBe("post");
  expect(form.getAttribute("action")).toBe("/api/auth/sign-in");
  expect(form.querySelector('input[name="token"]')?.getAttribute("type")).toBe("password");
});
it("preserves the API JSON refusal without issuing authentication cookies", async () => {
  const api = proxy(new NextRequest("http://owned.test/api/status"));
  expect(api.status).toBe(401);
  expect(api.headers.get("content-type")).toContain("application/json");
  expect(api.headers.get("set-cookie")).toBeNull();
  expect(await api.json()).toEqual({ error: "Unauthorized. Send 'Authorization: Bearer <token>' or sign in with your operator credential." });
});
