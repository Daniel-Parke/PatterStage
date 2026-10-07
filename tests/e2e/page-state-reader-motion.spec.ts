// T-0193 ORACLE Franklin-01a1062c-ad31-77c2-8ff2-71c41ee9b5d6, 2026-10-04.
// Real Reader and existing production CSS; synthetic story, isolated keyless runtime.
import { test, expect, type Runtime } from "../helpers/route-contract-runtime";
import { createStoryWeaverSaveFixture, fulfillStoryWeaverLoadOrSpend } from "../helpers/story-weaver-save-fixture";
import type { Locator, Page, TestInfo } from "@playwright/test";

async function reader(page: Page, runtime: Runtime) {
  const story = createStoryWeaverSaveFixture("t0193-reader-oracle");
  await runtime.route("**/api/stories", async route => {
    const body = route.request().postDataJSON() as { action?: string };
    if (await fulfillStoryWeaverLoadOrSpend(route, body.action, story)) return;
    if (body.action === "update") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: story }) }); return;
    }
    throw new Error(`Unmatched Reader fixture action: ${body.action}`);
  });
  await page.goto(`${runtime.origin}/recroom/story-weaver/${story.id}`);
  await expect(page.getByRole("heading", { level: 1, name: story.title })).toBeVisible();
  await expect(page.getByText("First chapter text.", { exact: true })).toBeVisible();
  return story;
}

/** Composite the browser's resolved solid backgrounds, including translucent button fills. */
async function contrast(target: Locator) {
  return target.evaluate(element => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    function rgba(css: string): number[] {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
    }
    function over(front: number[], back: number[]) { return front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3])); }
    function luminance(rgb: number[]) {
      const linear = rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    const ancestors: Element[] = [];
    for (let el: Element | null = element; el; el = el.parentElement) {
      ancestors.unshift(el);
      if (rgba(getComputedStyle(el).backgroundColor)[3] === 1) break;
    }
    let background = [255, 255, 255];
    for (const el of ancestors) {
      const style = getComputedStyle(el);
      if (style.backgroundImage !== "none" || Number(style.opacity) !== 1 || style.filter !== "none") throw new Error("Contrast sample needs a solid, unfiltered text surface");
      background = over(rgba(style.backgroundColor), background);
    }
    const style = getComputedStyle(element), foreground = over(rgba(style.color), background);
    const a = luminance(foreground), b = luminance(background);
    return { text: element.textContent?.trim(), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), color: style.color, background, fontSize: style.fontSize };
  });
}
async function attach(info: TestInfo, name: string, value: unknown) {
  await info.attach(name, { body: JSON.stringify(value, null, 2), contentType: "application/json" });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0193 Reader and motion ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test("Reader small labels, selected face and hovered face meet 4.5:1", async ({ page, runtime }, info) => {
      await reader(page, runtime);
      await page.getByRole("button", { name: "Reading settings", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Reading settings", exact: true }); await expect(dialog).toBeVisible();
      const samples = [];
      for (const label of ["Reading settings", "Font size", "17px", "Line spacing", "1.2", "Font"]) samples.push(await contrast(dialog.getByText(label, { exact: true })));
      const selected = dialog.getByRole("button", { name: "EB Garamond", exact: true });
      await expect(selected).toHaveAttribute("aria-pressed", "true"); samples.push(await contrast(selected));
      const hovered = dialog.getByRole("button", { name: "Literata", exact: true }); await hovered.hover();
      await hovered.evaluate(async element => { void getComputedStyle(element).color; await Promise.all(element.getAnimations().map(animation => animation.finished)); });
      samples.push(await contrast(hovered));
      await selected.hover();
      await selected.evaluate(async element => { void getComputedStyle(element).color; await Promise.all(element.getAnimations().map(animation => animation.finished)); });
      samples.push({ ...await contrast(selected), text: "EB Garamond (hover)" });
      await attach(info, "Reader contrast samples", samples);
      for (const sample of samples) expect.soft(sample.ratio, `${sample.text}: ${JSON.stringify(sample)}`).toBeGreaterThanOrEqual(4.5);
    });

    test("Reader keeps five faces, persisted size/face and Escape/outside dismissal", async ({ page, runtime }) => {
      const story = await reader(page, runtime);
      const trigger = page.getByRole("button", { name: "Reading settings", exact: true }); await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Reading settings", exact: true });
      for (const face of ["Literata", "EB Garamond", "Lora", "Merriweather", "Inter"]) {
        const button = dialog.getByRole("button", { name: face, exact: true }); await expect(button).toBeVisible(); await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("story-weaver-reader-settings")!).fontFamily)).toBe(face);
      }
      const size = dialog.getByRole("slider", { name: "Font size", exact: true }); await size.focus(); await page.keyboard.press("End");
      await expect(size).toHaveValue("28"); await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
      await page.reload(); await expect(page.getByRole("heading", { level: 1, name: story.title })).toBeVisible();
      await trigger.click(); await expect(size).toHaveValue("28");
      await expect(dialog.getByRole("button", { name: "Inter", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("heading", { level: 1, name: story.title }).click(); await expect(dialog).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    });

    for (const reducedMotion of ["reduce", "no-preference"] as const) {
      test(`${reducedMotion} stagger samples the first frame without delayed retries`, async ({ page, runtime }, info) => {
        await page.emulateMedia({ reducedMotion }); await reader(page, runtime);
        const frame = await page.evaluate(async () => {
          const host = document.createElement("div"); host.className = "ps-stagger";
          for (let i = 0; i < 12; i++) { const child = document.createElement("div"); child.textContent = `Owned stagger ${i + 1}`; host.append(child); }
          document.querySelector("main")!.append(host);
          // Flush the actual entrance styles before the next animation frame. No seeking or CSS override.
          void getComputedStyle(host.lastElementChild!).opacity;
          const started = performance.now();
          // A task queued from rAF samples after that first render, rather than inside the pre-paint callback.
          return new Promise<{ elapsed: number; children: { opacity: number; delay: string; duration: string }[] }>(resolve => requestAnimationFrame(() => setTimeout(() => {
            const children = [...host.children].map(child => { const style = getComputedStyle(child); return { opacity: Number(style.opacity), delay: style.animationDelay, duration: style.animationDuration }; });
            resolve({ elapsed: performance.now() - started, children }); host.remove();
          }, 0)));
        });
        await attach(info, "First-frame stagger sample", frame); expect(frame.children).toHaveLength(12);
        if (reducedMotion === "reduce") {
          for (const child of frame.children) {
            expect.soft(child.opacity, JSON.stringify({ elapsed: frame.elapsed, child })).toBe(1);
            expect.soft(parseFloat(child.delay), JSON.stringify(child)).toBe(0);
          }
        } else {
          const last = frame.children[11]; expect(parseFloat(last.delay)).toBeGreaterThanOrEqual(0.55);
          expect(parseFloat(last.duration)).toBeGreaterThan(0.02); expect(last.opacity).toBeLessThan(1);
        }
      });
    }
  });
}
