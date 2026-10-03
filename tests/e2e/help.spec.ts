import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

interface Guide { slug: string; title: string }
interface Section { pages: Guide[] }

const manifest = JSON.parse(readFileSync(join(process.cwd(), "docs", "manifest.json"), "utf8")) as {
  sections?: Section[];
};
const guides = (manifest.sections ?? []).flatMap((section) => section.pages ?? []);
if (guides.length === 0) throw new Error("The committed Help manifest lists no guides");

test.describe("manifest-driven Help routes", () => {
  test("every listed guide renders its article", async ({ request }) => {
    test.setTimeout(120_000);
    const failures: string[] = [];
    for (const guide of guides) {
      const response = await request.get(`/help/${guide.slug}`);
      const html = await response.text();
      if (response.status() !== 200 || !html.includes('data-testid="help-fragment"')) {
        failures.push(`${guide.slug}: HTTP ${response.status()}, article=${html.includes('data-testid="help-fragment"')}`);
      }
    }
    expect(failures, `Every one of the ${guides.length} committed guides must render`).toEqual([]);
  });

  test("a guide and its previous-link icon cross the server/client boundary", async ({ page }) => {
    const guide = guides.find((entry) => entry.slug !== "index");
    if (!guide) throw new Error("The Help manifest has no guide after its index");

    const response = await page.goto(`/help/${guide.slug}`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: guide.title })).toBeVisible();
    await expect(page.getByTestId("help-fragment")).toBeVisible();
    const previous = page.getByRole("navigation", { name: "Help pages" }).getByRole("link", { name: /^Previous:/ });
    await expect(previous.locator("svg")).toBeVisible();
  });

  test("an unlisted guide remains missing", async ({ request }) => {
    const response = await request.get("/help/t0156-unlisted-guide");
    expect(response.status()).toBe(404);
  });
});
