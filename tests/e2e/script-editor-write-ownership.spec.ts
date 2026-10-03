import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../helpers/route-contract-runtime';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0192 Script write ownership ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    for (const method of ['PUT', 'DELETE'] as const) {
      for (const replacement of [false, true]) {
        test(`${method} ${replacement ? 'late success preserves replacement editor B and its draft' : 'normal completion closes editor A and persists the operation'}`, async ({ page, runtime }) => {
          const first = 'oracle-write-a.mjs', second = 'oracle-write-b.mjs';
          const pathA = join(runtime.data, 'scripts', first), pathB = join(runtime.data, 'scripts', second);
          const originalA = '// owned A; never executed\n', originalB = '// owned B; never executed\n';
          const savedA = '// changed A; never executed\n', draftB = '// unsaved B\n  exact whitespace\n';
          writeFileSync(pathA, originalA); writeFileSync(pathB, originalB);
          const hold = runtime.hold(); let writes = 0, persisted = false;
          await runtime.route(`**/api/scripts/${first}`, async route => {
            if (route.request().method() !== method) { await route.fallback(); return; }
            writes++;
            const response = await runtime.api(`/api/scripts/${first}`, method, method === 'PUT' ? route.request().postDataJSON() : undefined);
            expect(response.status).toBe(200);
            if (method === 'PUT') expect(readFileSync(pathA, 'utf8')).toBe(savedA);
            else expect(existsSync(pathA)).toBe(false);
            persisted = true;
            await hold.promise;
            await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body });
          });
          await page.goto(`${runtime.origin}/work/scripts`);
          await page.getByText(first, { exact: true }).locator('../..').getByRole('button', { name: 'Edit', exact: true }).click();
          const editorA = page.getByRole('dialog', { name: `Edit · ${first}`, exact: true });
          await expect(editorA.getByRole('textbox', { name: 'Script content' })).toHaveValue(originalA);
          const delivered = page.waitForResponse(response => response.url() === `${runtime.origin}/api/scripts/${first}` && response.request().method() === method);
          if (method === 'PUT') {
            await editorA.getByRole('textbox', { name: 'Script content' }).fill(savedA);
            await editorA.getByRole('button', { name: 'Save', exact: true }).click();
          } else {
            await editorA.getByRole('button', { name: 'Delete', exact: true }).click();
            await editorA.getByRole('button', { name: 'Delete for good?', exact: true }).click();
          }
          await expect.poll(() => persisted).toBe(true);
          expect(writes).toBe(1);
          await expect(editorA).toBeVisible();
          if (replacement) {
            await editorA.getByRole('button', { name: 'Close dialog', exact: true }).click();
            await expect(editorA).toHaveCount(0);
            await page.getByText(second, { exact: true }).locator('../..').getByRole('button', { name: 'Edit', exact: true }).click();
            const editorB = page.getByRole('dialog', { name: `Edit · ${second}`, exact: true });
            await expect(editorB.getByRole('textbox', { name: 'Script content' })).toHaveValue(originalB);
            await editorB.getByRole('textbox', { name: 'Script content' }).fill(draftB);
            hold.release(); await (await delivered).finished();
            await expect(page.getByText(`${method === 'PUT' ? 'Saved' : 'Deleted'} ${first}`, { exact: true })).toBeVisible();
            expect(readFileSync(pathB, 'utf8')).toBe(originalB);
            await expect.soft(editorB).toBeVisible();
            await expect.soft(editorB.getByRole('textbox', { name: 'Script content' })).toHaveValue(draftB);
          } else {
            hold.release(); await (await delivered).finished();
            await expect(page.getByText(`${method === 'PUT' ? 'Saved' : 'Deleted'} ${first}`, { exact: true })).toBeVisible();
            await expect(editorA).toHaveCount(0);
          }
          expect(writes).toBe(1);
          if (method === 'PUT') expect(readFileSync(pathA, 'utf8')).toBe(savedA);
          else expect(existsSync(pathA)).toBe(false);
          expect(readFileSync(pathB, 'utf8')).toBe(originalB);
        });
      }
    }
  });
}
