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
