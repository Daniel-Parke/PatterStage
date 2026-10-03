import { test, expect, seedFallbacks } from '../helpers/route-contract-runtime';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import type { Page } from '@playwright/test';

const configWrite = (page: Page, origin: string) => page.waitForResponse(response =>
  response.url() === `${origin}/api/config` && response.request().method() === 'PUT');

// Public browser contracts, independently authored before implementation.
// Request delivery may be held/refused; persistence writes remain real except
// Composer submission, which is captured and refused before any execution.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0192 public follow-ups ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, extraHTTPHeaders: {} });

    test('HTTP diagnosis: null error response retains HTTP failure and unsaved Settings draft', async ({ page, runtime }) => {
      await runtime.route('**/api/config', async route => {
        if (route.request().method() === 'PUT') await route.fulfill({ status: 503, contentType: 'application/json', body: 'null' });
        else await route.fallback();
      });
      await page.goto(`${runtime.origin}/agent/settings#agent`);
      const section = page.locator('section#agent'), field = section.getByRole('spinbutton', { name: /Max Turns/ });
      await expect(field).toHaveValue('40'); await field.fill('41');
      await section.getByRole('button', { name: 'Save Agent Settings' }).click();
      await expect.soft(section.getByText(/503|Service Unavailable/)).toBeVisible();
      await expect(field).toHaveValue('41');
      expect((load(readFileSync(join(runtime.hermes, 'config.yaml'), 'utf8')) as { agent: { max_turns: number } }).agent.max_turns).toBe(40);
    });

    for (const outcome of ['success', 'refusal'] as const) {
      test(`Settings unchanged draft ${outcome}: response and independent persisted baseline agree`, async ({ page, runtime }) => {
        if (outcome === 'refusal') await runtime.route('**/api/config', async route => {
          if (route.request().method() === 'PUT') await route.fulfill({ status: 503, json: { error: 'Owned settings refusal' } });
          else await route.fallback();
        });
        await page.goto(`${runtime.origin}/agent/settings#agent`);
        const section = page.locator('section#agent'), field = section.getByRole('spinbutton', { name: /Max Turns/ });
        const save = section.getByRole('button', { name: 'Save Agent Settings' });
        await expect(field).toHaveValue('40'); await field.fill('41');
        const response = configWrite(page, runtime.origin); await save.click();
        expect((await response).status()).toBe(outcome === 'success' ? 200 : 503);
        if (outcome === 'success') { await expect(save).toHaveText('Saved!'); await expect(save).toBeDisabled(); }
        else { await expect(section.getByText('Owned settings refusal', { exact: true })).toBeVisible(); await expect(save).toBeEnabled(); }
        await expect(field).toHaveValue('41');
        expect((load(readFileSync(join(runtime.hermes, 'config.yaml'), 'utf8')) as { agent: { max_turns: number } }).agent.max_turns).toBe(outcome === 'success' ? 41 : 40);
        await page.reload(); await expect(field).toHaveValue(outcome === 'success' ? '41' : '40');
      });
    }

    test('Settings held real PUT: submitted 41 persists while later draft 42 stays unsaved and can be saved', async ({ page, runtime }) => {
      const hold = runtime.hold(); let persisted = false, writes = 0;
      await runtime.route('**/api/config', async route => {
        if (route.request().method() !== 'PUT') { await route.fallback(); return; }
        writes++;
        const response = await runtime.api('/api/config', 'PUT', route.request().postDataJSON());
        expect(response.status).toBe(200);
        if (writes === 1) { persisted = true; await hold.promise; }
        await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body });
      });
      await page.goto(`${runtime.origin}/agent/settings#agent`);
      const section = page.locator('section#agent'), field = section.getByRole('spinbutton', { name: /Max Turns/ });
      const save = section.getByRole('button', { name: 'Save Agent Settings' });
      await expect(field).toHaveValue('40'); await field.fill('41');
      const delivered = configWrite(page, runtime.origin); await save.click();
      await expect.poll(() => persisted).toBe(true);
      expect((load(readFileSync(join(runtime.hermes, 'config.yaml'), 'utf8')) as { agent: { max_turns: number } }).agent.max_turns).toBe(41);
      await field.fill('42'); hold.release(); await delivered;
      await expect.soft(field).toHaveValue('42');
      await expect.soft(save, '42 differs from the confirmed saved baseline of 41').toBeEnabled();
      if (await save.isEnabled()) {
        const later = configWrite(page, runtime.origin); await save.click(); await later;
        await expect(save).toHaveText('Saved!'); await expect(save).toBeDisabled();
        expect((load(readFileSync(join(runtime.hermes, 'config.yaml'), 'utf8')) as { agent: { max_turns: number } }).agent.max_turns).toBe(42);
        await page.reload(); await expect(field).toHaveValue('42');
      }
    });

    test('bulk defaults: real SQLite success plus malformed YAML refusal is not unconditional success', async ({ page, runtime }) => {
      runtime.sql(db => db.prepare("INSERT INTO models(id,name,provider,model_id,base_url) VALUES ('oracle-model','Oracle model','openai','oracle-model',?)").run(`${runtime.refusalOrigin}/v1`));
      await page.goto(`${runtime.origin}/agent/models`);
      await page.getByRole('button', { name: /Bulk Set Auxiliaries/ }).click();
      await page.getByRole('button', { name: /Select model/ }).click();
      await page.getByRole('option', { name: /Oracle model/ }).click();
      writeFileSync(join(runtime.hermes, 'config.yaml'), 'agent: [broken\n');
      const responses: unknown[] = [];
      await runtime.route('**/api/models/defaults', async route => {
        if (route.request().method() !== 'PUT') { await route.fallback(); return; }
        const response = await runtime.api('/api/models/defaults', 'PUT', route.request().postDataJSON());
        responses.push(response.json());
        await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body });
      });
      const apply = page.getByRole('button', { name: /^Apply to \d+ slots/ });
      const slots = Number((await apply.innerText()).match(/\d+/)![0]);
      await apply.click();
      await expect.poll(() => responses.length).toBe(slots);
      await expect(page.getByRole('button', { name: /Bulk Set Auxiliaries/ })).toBeEnabled();
      expect(runtime.sql(db => db.prepare("SELECT task_type FROM model_defaults WHERE model_id='oracle-model'").all()).length).toBeGreaterThan(0);
      expect(responses.some(value => Boolean((value as { data?: { error?: string } }).data?.error))).toBe(true);
      expect.soft(await page.getByText(/Set \d+ auxiliary defaults?/i).count(), 'settled bulk feedback must not claim unconditional success').toBe(0);
      await expect(page.getByText(/failed|could not|couldn't|error|partial/i).filter({ visible: true }).first()).toBeVisible();
    });

    test('Story real repository failure is distinguished from healthy empty and recovers', async ({ page, runtime }) => {
      expect((await runtime.api('/api/stories', 'POST', { action: 'list' })).status).toBe(200);
      runtime.sql(db => db.exec('ALTER TABLE stories RENAME TO oracle_unavailable_stories'));
      try {
        const failed = await runtime.api('/api/stories', 'POST', { action: 'list' });
        expect.soft(failed.status, 'genuine SQLite failure must not masquerade as an empty library').toBeGreaterThanOrEqual(500);
        await page.goto(`${runtime.origin}/recroom/story-weaver`);
        await expect.soft(page.getByText(/failed|unable|error/i).filter({ visible: true }).first()).toBeVisible();
      } finally { runtime.sql(db => db.exec('ALTER TABLE oracle_unavailable_stories RENAME TO stories')); }
      await page.reload();
      expect((await runtime.api('/api/stories', 'POST', { action: 'list' })).status).toBe(200);
      await expect(page.getByRole('heading', { name: /Story Weaver/ }).first()).toBeVisible();
    });

    test('profile rename: browser reload displays submitted metadata from real persistence', async ({ page, runtime }) => {
      expect((await runtime.api('/api/agent/profiles', 'POST', { name: 'Oracle Before', description: 'Old description' })).status).toBe(200);
      expect((await runtime.api('/api/agent/profiles/oracle-before', 'PUT', { name: 'Oracle After', description: 'New description' })).status).toBe(200);
      await page.goto(`${runtime.origin}/agent/profiles`);
      await expect.soft(page.getByText('Oracle After', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Oracle After', exact: true }).click();
      await expect.soft(page.getByText('New description', { exact: true })).toBeVisible();
      expect(runtime.sql(db => db.prepare("SELECT display_name,description FROM agent_profiles WHERE slug='oracle-after'").get())).toEqual({ display_name: 'Oracle After', description: 'New description' });
    });

    test('fallback disabling final entry: browser reload and real YAML agree with persisted disabled state', async ({ page, runtime }) => {
      const [id] = seedFallbacks(runtime, ['Oracle fallback']);
      expect((await runtime.api('/api/models/fallbacks', 'POST', { action: 'toggle', entryId: id, enabled: false })).status).toBe(200);
      await page.goto(`${runtime.origin}/agent/models`);
      await page.getByRole('button', { name: /Fallback Chain/ }).click();
      await expect(page.getByText('Oracle fallback', { exact: true })).toBeVisible();
      expect(runtime.sql(db => db.prepare('SELECT enabled FROM model_fallbacks').all())).toEqual([{ enabled: 0 }]);
      expect((load(readFileSync(join(runtime.hermes, 'config.yaml'), 'utf8')) as { fallback_providers?: unknown[] }).fallback_providers ?? []).toEqual([]);
    });

    for (const state of ['held', 'refused', 'successful', 'stale selection'] as const) {
      test(`existing Script ${state}: unread bytes cannot be overwritten; successful edits persist`, async ({ page, runtime }) => {
        const file = join(runtime.data, 'scripts/oracle-first.mjs'), original = '// owned, never run\nexport const sentinel = 41;\n';
        writeFileSync(file, original); writeFileSync(join(runtime.data, 'scripts/oracle-second.mjs'), '// second owned file\n');
        const hold = runtime.hold(); let reads = 0, writes = 0, settled = false;
        await runtime.route('**/api/scripts/oracle-first.mjs', async route => {
          if (route.request().method() === 'PUT') { writes++; await route.fallback(); return; }
          if (route.request().method() !== 'GET') { await route.fallback(); return; }
          reads++;
          if (state === 'held' || state === 'stale selection') await hold.promise;
          if (state === 'refused') await route.fulfill({ status: 500, json: { error: 'Owned script read refused' } });
          else { const response = await runtime.api('/api/scripts/oracle-first.mjs'); await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body }); }
          settled = true;
        });
        await page.goto(`${runtime.origin}/work/scripts`);
        const row = page.getByText('oracle-first.mjs', { exact: true }).locator('../..');
        await row.getByRole('button', { name: 'Edit', exact: true }).click();
        await expect.poll(() => reads).toBe(1);
        const dialog = page.getByRole('dialog'), save = dialog.getByRole('button', { name: 'Save', exact: true });
        if (state === 'held' || state === 'refused') {
          if (state === 'refused') await expect(dialog.getByText('Loading script…')).toHaveCount(0);
          await expect.soft(save).toBeDisabled();
          if (await save.isEnabled()) {
            const response = page.waitForResponse(response => response.url() === `${runtime.origin}/api/scripts/oracle-first.mjs` && response.request().method() === 'PUT');
            await save.click(); await (await response).finished();
          }
          expect.soft(writes).toBe(0);
          expect.soft(readFileSync(file, 'utf8')).toBe(original);
          hold.release();
        } else if (state === 'stale selection') {
          await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
          await page.getByText('oracle-second.mjs', { exact: true }).locator('../..').getByRole('button', { name: 'Edit', exact: true }).click();
          await expect(dialog.getByRole('textbox', { name: 'Script content' })).toHaveValue('// second owned file\n');
          hold.release(); await expect.poll(() => settled).toBe(true);
          await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
          await expect(dialog.getByRole('textbox', { name: 'Script content' })).toHaveValue('// second owned file\n');
        } else {
          const editor = dialog.getByRole('textbox', { name: 'Script content' });
          await expect(editor).toHaveValue(original); const edited = original.replace('41', '42');
          await editor.fill(edited); await save.click(); await expect(dialog).toHaveCount(0);
          expect(readFileSync(file, 'utf8')).toBe(edited);
          await page.reload(); await row.getByRole('button', { name: 'Edit', exact: true }).click();
          await expect(editor).toHaveValue(edited);
        }
      });
    }

    for (const state of ['pending', 'refused', 'loaded', 'stale selection'] as const) {
      test(`Composer ${state} graph: review is complete only for the selected loaded graph; launch requires confirmation`, async ({ page, runtime }) => {
        const workflow = (name: string) => ({ name, nodes: [{ key: 'write', label: `${name} write stage`, kind: 'implement', gate: 'hil', isStart: true, isTerminal: true }], edges: [] });
        const created = await runtime.api('/api/composer/workflows', 'POST', workflow('Oracle First'));
        expect(created.status).toBeLessThan(300);
        await runtime.api('/api/composer/workflows', 'POST', workflow('Oracle Second'));
        const list = (await runtime.api('/api/composer/workflows')).json<{ data: { workflows: { id: string; name: string }[] } }>().data.workflows;
        const first = list.find(w => w.name === 'Oracle First')!, second = list.find(w => w.name === 'Oracle Second')!;
        const hold = runtime.hold(); let requested = false, settled = false; const submissions: unknown[] = [];
        await runtime.route(`**/api/composer/workflows/${first.id}`, async route => {
          requested = true;
          if (state === 'pending' || state === 'stale selection') await hold.promise;
          if (state === 'refused') await route.fulfill({ status: 500, json: { error: 'Owned graph refusal' } });
          else { const response = await runtime.api(`/api/composer/workflows/${first.id}`); await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body }); }
          settled = true;
        });
        await runtime.route('**/api/composer/runs', async route => {
          if (route.request().method() !== 'POST') { await route.fallback(); return; }
          submissions.push(route.request().postDataJSON());
          await route.fulfill({ status: 503, json: { error: 'Owned capture: never execute' } });
        });
        await page.goto(`${runtime.origin}/work/composer`);
        await page.getByLabel('Workflow', { exact: true }).click();
        await page.getByRole('option', { name: 'Oracle First', exact: true }).click();
        await page.locator('#composer-input').fill('Review the owned synthetic fixture only.');
        await expect.poll(() => requested).toBe(true);
        if (state === 'refused') await expect.poll(() => settled).toBe(true);
        if (state === 'stale selection') {
          await page.getByLabel('Workflow', { exact: true }).click();
          await page.getByRole('option', { name: 'Oracle Second', exact: true }).click();
          hold.release(); await expect.poll(() => settled).toBe(true);
        }
        const review = page.getByRole('button', { name: 'Review…', exact: true });
        if (state === 'pending' || state === 'refused') {
          if (await review.isEnabled()) {
            await review.click();
            const confirm = page.getByRole('dialog').getByRole('button', { name: /Confirm/ });
            await expect.soft(confirm).toBeDisabled();
            await expect.soft(page.getByRole('dialog').getByText(/loading|unavailable|failed|incomplete/i)).toBeVisible();
          }
          expect(submissions).toEqual([]); hold.release();
        } else {
          await review.click(); const dialog = page.getByRole('dialog');
          await expect(dialog.getByText(`${state === 'stale selection' ? 'Oracle Second' : 'Oracle First'} write stage`, { exact: true }).first()).toBeVisible();
          await expect(dialog.getByText(/may write code/)).toBeVisible();
          expect(submissions).toEqual([]);
          await dialog.getByRole('button', { name: /Confirm.*includes write stages/ }).click();
          await expect.poll(() => submissions.length).toBe(1);
          expect(submissions[0]).toMatchObject({ workflowId: state === 'stale selection' ? second.id : first.id });
        }
      });
    }
  });
}
