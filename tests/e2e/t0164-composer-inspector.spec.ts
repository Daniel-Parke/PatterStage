import { expect, test } from '@playwright/test';

test('Composer palette and selected-stage inspector stay inside the canvas', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/work/composer');
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    const canvas = page.locator('.react-flow').first();
    const node = page.locator('.react-flow__node').first();
    await node.waitFor();
    await node.click();
    const inspector = page.getByRole('heading', { name: 'Stage', exact: true }).locator('..');
    await inspector.waitFor();
    const palette = page.getByRole('heading', { name: 'Drag to add', exact: true }).locator('..');
    const canvasBox = await canvas.boundingBox();
    const inspectorBox = await inspector.boundingBox();
    const paletteBox = await palette.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(inspectorBox).not.toBeNull();
    expect(paletteBox).not.toBeNull();
    for (const box of [inspectorBox!, paletteBox!]) {
      expect(box.y, `${viewport.width}px overlay starts below its canvas`).toBeGreaterThanOrEqual(canvasBox!.y);
      expect(box.y, `${viewport.width}px overlay leaves its canvas`).toBeLessThan(canvasBox!.y + canvasBox!.height);
      expect(box.x, `${viewport.width}px overlay leaves its canvas`).toBeGreaterThanOrEqual(canvasBox!.x);
      expect(box.x + box.width, `${viewport.width}px overlay exceeds its canvas`).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width);
    }
  }
});

test('Composer canvas controls have visible icons against their buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/work/composer');
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.locator('.react-flow__controls-button').first().waitFor();
  const contrasts = await page.locator('.react-flow__controls-button').evaluateAll((buttons) => {
    const luminance = (colour: string) => {
      const values = colour.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const channels = values.map((value) => {
        const linear = value / 255;
        return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    return buttons.map((button) => {
      const background = luminance(getComputedStyle(button).backgroundColor);
      const foreground = luminance(getComputedStyle(button.querySelector('svg') ?? button).fill);
      return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
    });
  });
  expect(contrasts).toHaveLength(4);
  for (const ratio of contrasts) expect(ratio).toBeGreaterThanOrEqual(3);
});
