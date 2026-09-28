import { expect, test, type Page, type Response } from "@playwright/test";

type Violation = {
  blockedURI: string;
  effectiveDirective: string;
  sourceFile: string;
};

type ViolationProbe = {
  installed: boolean;
  violations: Violation[];
  controlExecuted?: boolean;
};

declare global {
  interface Window {
    __t0182GlobalErrorProbe?: ViolationProbe;
  }
}

const errorPath = "/_global-error";
const headingPattern = /this page couldn.t load|application error|internal server error|something went wrong|server error/i;

function expectFrameDenial(response: Response): void {
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toMatch(
    /(?:^|;)\s*frame-ancestors\s+'none'\s*(?:;|$)/i,
  );
}

async function expectUsefulErrorPage(page: Page): Promise<Response> {
  const response = await page.goto(errorPath, { waitUntil: "load" });
  expect(response, "the built error route must answer directly").not.toBeNull();
  expect(response!.status()).toBe(500);
  expectFrameDenial(response!);
  await expect(page.getByRole("heading", { name: headingPattern }).first()).toBeVisible();
  await expect(page.getByText(/a server error occurred|reload to try again/i).first()).toBeVisible();
  return response!;
}

for (const [name, viewport] of [
  ["desktop 1440x900", { width: 1440, height: 900 }],
  ["phone 390x844", { width: 390, height: 844 }],
] as const) {
  test.describe(`T-0182 global error ${name}`, () => {
    test.use({ viewport });

    test("500 fallback keeps framing denial and emits no unexpected CSP violations", async ({ page }) => {
      // Install before the first document is parsed. The positive control below
      // proves that this listener actually receives browser CSP events.
      await page.addInitScript(() => {
        const probe: ViolationProbe = { installed: true, violations: [] };
        window.__t0182GlobalErrorProbe = probe;
        document.addEventListener("securitypolicyviolation", (event) => {
          probe.violations.push({
            blockedURI: event.blockedURI,
            effectiveDirective: event.effectiveDirective,
            sourceFile: event.sourceFile,
          });
        });
      });

      await expectUsefulErrorPage(page);
      await page.waitForTimeout(300);
      const initial = await page.evaluate(() => window.__t0182GlobalErrorProbe);
      expect(initial?.installed, "CSP event listener must be present on the error document").toBe(true);

      await page.evaluate(() => {
        const button = document.createElement("button");
        button.setAttribute("onclick", "window.__t0182GlobalErrorProbe.controlExecuted = true");
        document.body.append(button);
        button.click();
      });
      await expect.poll(async () => page.evaluate(() =>
        window.__t0182GlobalErrorProbe?.violations.some((violation) =>
          violation.blockedURI === "inline" && violation.effectiveDirective === "script-src-attr",
        ) ?? false,
      )).toBe(true);
      expect(await page.evaluate(() => window.__t0182GlobalErrorProbe?.controlExecuted)).not.toBe(true);
      expect(initial?.violations, "the built error page must not violate its own policy").toEqual([]);
    });

    test.describe("without JavaScript", () => {
      test.use({ javaScriptEnabled: false });

      test("500 fallback still shows a useful error heading", async ({ page }) => {
        await expectUsefulErrorPage(page);
      });
    });
  });
}
