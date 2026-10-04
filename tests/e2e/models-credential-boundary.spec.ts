import { test, expect } from '../helpers/route-contract-runtime';
import { collectCensus } from './lib/census-collect';
import { compositeOver, contrastRatio, flattenStack, parseRgba } from './lib/census-analysis';

// The existing design-invariants decorative-boundary floor, unchanged.
const HAIRLINE_FLOOR = 1.55;

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0192 loaded Credentials boundary ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, extraHTTPHeaders: {} });

    test('loaded Credentials heading has a visible boundary on its actual backdrop', async ({ page, runtime }, info) => {
      test.setTimeout(90_000);
      // Controlled empty reads select the loaded empty state, not the loading shell.
      // Authentication, page rendering, CSS and runtime ownership remain real.
      const reads: Record<string, unknown> = {
        '/api/models': { models: [] },
        '/api/credentials': { credentials: [] },
        '/api/models/defaults': {},
        '/api/models/sync/drift': null,
        '/api/models/fallbacks': { entries: [] },
        '/api/models/fallbacks/config': { config: {
          restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 3,
        } },
      };
      const answered = new Set<string>();
      await runtime.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'GET' && Object.hasOwn(reads, path)) {
          await route.fulfill({ status: 200, json: { data: reads[path] } });
          answered.add(path);
        } else await route.fallback();
      });
      await page.goto(`${runtime.origin}/agent/models`, { waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { level: 2, name: 'Credentials', exact: true });
      await expect(heading).toBeVisible({ timeout: 30_000 });
      await expect(heading).toHaveCount(1);
      await expect(page.getByText('No credentials yet.', { exact: false })).toBeVisible();
      await expect(page.getByText('Loading models', { exact: false })).toHaveCount(0);
      await expect.poll(() => [...answered].sort()).toEqual(Object.keys(reads).sort());
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
      await heading.scrollIntoViewIfNeeded();

      const geometry = await heading.evaluate(element => {
        const style = getComputedStyle(element), box = element.getBoundingClientRect();
        return { width: box.width, height: box.height, borderBottomWidth: parseFloat(style.borderBottomWidth),
          borderBottomStyle: style.borderBottomStyle,
          documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
      });
      expect(geometry.width).toBeGreaterThan(0);
      expect(geometry.height).toBeGreaterThan(0);
      expect(geometry.borderBottomWidth).toBeGreaterThan(0);
      expect(geometry.borderBottomStyle).not.toBe('none');
      expect(geometry.borderBottomStyle).not.toBe('hidden');
      expect(geometry.documentOverflow).toBe(0);

      // An inert, temporary census identity selects this exact accessible heading;
      // neither class names nor CSS are changed. Restore the original attribute.
      const previousId = await heading.getAttribute('data-testid');
      await heading.evaluate(element => element.setAttribute('data-testid', 'oracle-loaded-credentials-heading'));
      let census: Awaited<ReturnType<typeof collectCensus>>;
      try { census = await page.evaluate(collectCensus, '/agent/models'); }
      finally {
        await heading.evaluate((element, previous) => {
          if (previous === null) element.removeAttribute('data-testid');
          else element.setAttribute('data-testid', previous);
        }, previousId);
      }
      expect(census.geometry.overflowX).toBe(0);
      const borders = census.borders.filter(border => border.what === 'h2[oracle-loaded-credentials-heading]');
      expect(borders, 'the actual loaded heading must contribute a painted boundary').toHaveLength(1);
      const border = borders[0];
      expect(border.control).toBe(false);
      const colour = parseRgba(border.colour), pageColour = parseRgba(census.pageBackground);
      expect(colour).not.toBeNull(); expect(pageColour).not.toBeNull();
      expect(colour!.a).toBeGreaterThan(0);
      const backdrop = border.backdrop.map(value => {
        const parsed = parseRgba(value); expect(parsed, `unparsed backdrop ${value}`).not.toBeNull(); return parsed!;
      });
      expect(backdrop.length).toBeGreaterThan(0);
      const ground = compositeOver(pageColour!, { r: 0, g: 0, b: 0 });
      const behind = flattenStack(backdrop, ground);
      const painted = compositeOver(colour!, behind), ratio = contrastRatio(painted, behind);
      await info.attach('loaded-credentials-measurement', { contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ viewport, geometry, border, behind, painted, ratio, floor: HAIRLINE_FLOOR }, null, 2)) });
      await info.attach('loaded-credentials-viewport', { contentType: 'image/png', body: await page.screenshot() });
      expect(ratio, `loaded Credentials boundary ${ratio.toFixed(3)}:1 against ${JSON.stringify(behind)}`)
        .toBeGreaterThanOrEqual(HAIRLINE_FLOOR);
    });
  });
}
