import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../helpers/route-contract-runtime';

const situations = ['existing content', 'new content', 'new filename', 'delete with later content'] as const;
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0192 Script pending draft ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    for (const situation of situations) {
      test(`${situation}: held completion preserves later draft until explicit Save`, async ({ page, runtime }) => {
        const first = 'oracle-pending-a.mjs', second = 'oracle-pending-b.mjs';
        const pathA = join(runtime.data, 'scripts', first), pathB = join(runtime.data, 'scripts', second);
        const original = '// original owned bytes; never executed\n';
        const submitted = '// submitted owned bytes; never executed\n';
        const later = '// later unsaved draft\n  exact whitespace\n';
        const deleting = situation === 'delete with later content';
        const creating = situation === 'new content' || situation === 'new filename';
        const changedName = situation === 'new filename';
        if (!creating) writeFileSync(pathA, original);
        const hold = runtime.hold();
        const writes: { method: string; name: string; content?: string }[] = [];
        let persisted = false;
        await runtime.route('**/api/scripts/*', async route => {
          const request = route.request(), method = request.method();
          if (method !== 'PUT' && method !== 'DELETE') { await route.fallback(); return; }
          const name = decodeURIComponent(new URL(request.url()).pathname.split('/').pop()!);
          const body = method === 'PUT' ? request.postDataJSON() as { content: string } : undefined;
          writes.push({ method, name, content: body?.content });
          const response = await runtime.api(`/api/scripts/${encodeURIComponent(name)}`, method, body);
          expect(response.status).toBe(200);
          if (writes.length === 1) {
            expect(name).toBe(first);
            expect(method).toBe(deleting ? 'DELETE' : 'PUT');
            if (deleting) expect(existsSync(pathA)).toBe(false);
            else { expect(body?.content).toBe(submitted); expect(readFileSync(pathA, 'utf8')).toBe(submitted); }
            persisted = true;
            await hold.promise;
          }
          await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body });
        });
        await page.goto(`${runtime.origin}/work/scripts`);
        if (creating) await page.getByRole('button', { name: 'New script', exact: true }).click();
        else await page.getByText(first, { exact: true }).locator('../..').getByRole('button', { name: 'Edit', exact: true }).click();
        const editor = page.getByRole('dialog');
        const content = editor.getByRole('textbox', { name: 'Script content' });
        if (creating) await editor.getByRole('textbox', { name: 'Filename' }).fill(first);
        else await expect(content).toHaveValue(original);
        const delivered = page.waitForResponse(response => response.url() === `${runtime.origin}/api/scripts/${first}` && response.request().method() === (deleting ? 'DELETE' : 'PUT'));
        if (deleting) {
          await editor.getByRole('button', { name: 'Delete', exact: true }).click();
          await editor.getByRole('button', { name: 'Delete for good?', exact: true }).click();
        } else {
          await content.fill(submitted);
          await editor.getByRole('button', { name: 'Save', exact: true }).click();
        }
        await expect.poll(() => persisted).toBe(true);
        expect(writes).toHaveLength(1);
        if (changedName) await editor.getByRole('textbox', { name: 'Filename' }).fill(second);
        else await content.fill(later);
        const expectedContent = changedName ? submitted : later;
        await expect(content).toHaveValue(expectedContent);
        hold.release(); await (await delivered).finished();
        await expect(page.getByText(`${deleting ? 'Deleted' : 'Saved'} ${first}`, { exact: true })).toBeVisible();
        // Persistence and no automatic second write are checked before the expected red UI assertion.
        expect(writes).toHaveLength(1);
        if (deleting) expect(existsSync(pathA)).toBe(false);
        else expect(readFileSync(pathA, 'utf8')).toBe(submitted);
        expect(existsSync(pathB)).toBe(false);
        await expect(editor).toBeVisible();
        await expect(content).toHaveValue(expectedContent);
        if (changedName) await expect(editor.getByRole('textbox', { name: 'Filename' })).toHaveValue(second);
        if (deleting) {
          await expect(page.getByRole('dialog', { name: 'New script', exact: true })).toBeVisible();
          await expect(editor.getByRole('textbox', { name: 'Filename' })).toHaveValue(first);
          await expect(editor.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
          expect(existsSync(pathA)).toBe(false);
        }
        const finalName = changedName ? second : first;
        await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
        expect(writes).toHaveLength(1);
        if (deleting) expect(existsSync(pathA)).toBe(false);
        const saved = page.waitForResponse(response => response.url() === `${runtime.origin}/api/scripts/${finalName}` && response.request().method() === 'PUT');
        await editor.getByRole('button', { name: 'Save', exact: true }).click();
        expect((await saved).status()).toBe(200);
        await expect(editor).toHaveCount(0);
        expect(writes).toHaveLength(2);
        expect(writes[1]).toEqual({ method: 'PUT', name: finalName, content: expectedContent });
        expect(readFileSync(join(runtime.data, 'scripts', finalName), 'utf8')).toBe(expectedContent);
        if (changedName) expect(readFileSync(pathA, 'utf8')).toBe(submitted);
        else expect(existsSync(pathB)).toBe(false);
      });
    }
  });
}
