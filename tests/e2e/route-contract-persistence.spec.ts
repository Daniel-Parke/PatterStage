import { test, expect, seedFallbacks, type Runtime } from '../helpers/route-contract-runtime';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

test.use({ extraHTTPHeaders: {} });
type Profile = { id: string; name: string; description: string };
type Chain = { data: { entries: { id: string; enabled: boolean; modelIdString?: string }[] } };
const config = (runtime: Runtime) => load(readFileSync(join(runtime.hermes, 'config.yaml'), 'utf8')) as { fallback_providers?: { model: string }[]; oracle_unrelated: string };

test.describe('T-0192 owned HTTP and persistence', () => {
  for (const variant of ['changed slug', 'unchanged slug', 'empty description'] as const) {
    test(`profile ${variant}: submitted metadata and owned files survive reload without losing snapshots`, async ({ runtime }) => {
      expect((await runtime.api('/api/agent/profiles', 'POST', { name: 'Oracle Alpha', description: 'Before' })).status).toBe(200);
      const oldDirectory = join(runtime.hermes, 'profiles/oracle-alpha');
      expect(existsSync(oldDirectory), 'real profile directory control').toBe(true);
      writeFileSync(join(oldDirectory, 'oracle-sentinel.txt'), 'independent file bytes\n');
      runtime.sql(db => db.prepare("INSERT INTO sessions(id,source,profile_name,title,started_at) VALUES ('oracle-history','oracle','oracle-alpha','Historical title','2026-10-03T00:00:00Z')").run());
      const snapshot = runtime.sql(db => db.prepare("SELECT * FROM sessions WHERE id='oracle-history'").get());
      const name = variant === 'changed slug' ? 'Oracle Beta' : 'ORACLE ALPHA';
      const description = variant === 'empty description' ? '' : 'Submitted metadata';
      const slug = variant === 'changed slug' ? 'oracle-beta' : 'oracle-alpha';
      const response = await runtime.api('/api/agent/profiles/oracle-alpha', 'PUT', { name, description });
      expect(response.status).toBe(200);
      const row = runtime.sql(db => db.prepare('SELECT slug,display_name,description FROM agent_profiles WHERE slug=?').get(slug));
      expect.soft(row).toEqual({ slug, display_name: name, description });
      const profiles = (await runtime.api('/api/agent/profiles')).json<{ data: { profiles: Profile[] } }>().data.profiles;
      expect.soft(profiles.find(profile => profile.id === slug)).toMatchObject({ name, description });
      expect(readFileSync(join(runtime.hermes, 'profiles', slug, 'oracle-sentinel.txt'), 'utf8')).toBe('independent file bytes\n');
      expect(runtime.sql(db => db.prepare("SELECT * FROM sessions WHERE id='oracle-history'").get())).toEqual(snapshot);
      if (slug !== 'oracle-alpha') expect(runtime.sql(db => db.prepare("SELECT slug FROM agent_profiles WHERE slug='oracle-alpha'").get())).toBeUndefined();
    });
  }

  test('profile rename filesystem refusal preserves old row and directory and reports failure', async ({ runtime }) => {
    expect((await runtime.api('/api/agent/profiles', 'POST', { name: 'Oracle Original', description: 'Retain' })).status).toBe(200);
    const original = runtime.sql(db => db.prepare("SELECT * FROM agent_profiles WHERE slug='oracle-original'").get());
    // A file at the destination is a cross-platform deterministic rename refusal.
    writeFileSync(join(runtime.hermes, 'profiles/oracle-blocked'), 'owned obstruction');
    const response = await runtime.api('/api/agent/profiles/oracle-original', 'PUT', { name: 'Oracle Blocked', description: 'Not saved' });
    expect.soft(response.status).toBeGreaterThanOrEqual(400);
    expect(runtime.sql(db => db.prepare("SELECT * FROM agent_profiles WHERE slug='oracle-original'").get())).toEqual(original);
    expect(existsSync(join(runtime.hermes, 'profiles/oracle-original'))).toBe(true);
    expect(readFileSync(join(runtime.hermes, 'profiles/oracle-blocked'), 'utf8')).toBe('owned obstruction');
  });

  for (const action of ['disable sole', 'delete last', 'sync empty'] as const) {
    test(`fallback ${action}: SQLite and real YAML both contain an empty enabled chain`, async ({ runtime }) => {
      const [id] = seedFallbacks(runtime, ['fallback-one']);
      expect(config(runtime).fallback_providers?.map(entry => entry.model)).toEqual(['fallback-one']);
      let response;
      if (action === 'delete last') response = await runtime.api(`/api/models/fallbacks/${id}`, 'DELETE');
      else {
        response = await runtime.api('/api/models/fallbacks', 'POST', { action: 'toggle', entryId: id, enabled: false });
        if (action === 'sync empty') response = await runtime.api('/api/models/fallbacks', 'POST', { action: 'sync' });
      }
      expect(response.status).toBe(200);
      expect(runtime.sql(db => db.prepare('SELECT id FROM model_fallbacks WHERE enabled=1').all())).toEqual([]);
      expect.soft(config(runtime).fallback_providers ?? []).toEqual([]);
      expect(config(runtime).oracle_unrelated).toBe('preserve-me');
      const reloaded = (await runtime.api('/api/models/fallbacks')).json<Chain>().data.entries;
      expect(reloaded.filter(entry => entry.enabled)).toEqual([]);
    });
  }

  test('fallback nonempty order, unrelated YAML and backup bytes survive sync', async ({ runtime }) => {
    seedFallbacks(runtime, ['first', 'second']);
    const original = readFileSync(join(runtime.hermes, 'config.yaml'), 'utf8');
    expect((await runtime.api('/api/models/fallbacks', 'POST', { action: 'sync' })).status).toBe(200);
    expect(config(runtime).fallback_providers?.map(entry => entry.model)).toEqual(['first', 'second']);
    expect(config(runtime).oracle_unrelated).toBe('preserve-me');
    const backup = join(runtime.hermes, 'backups');
    expect(readdirSync(backup).some(name => readFileSync(join(backup, name), 'utf8') === original)).toBe(true);
  });

  test('fallback malformed owned YAML is a reported refusal, never silent replacement', async ({ runtime }) => {
    seedFallbacks(runtime, ['fallback-one']);
    const path = join(runtime.hermes, 'config.yaml'), damaged = 'agent: [unterminated\n';
    writeFileSync(path, damaged);
    const response = await runtime.api('/api/models/fallbacks', 'POST', { action: 'sync' });
    expect.soft(response.status >= 400 || Boolean(response.json<{ data?: { error?: string }; error?: string }>().data?.error)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(damaged);
  });

  test('script successful read, edit, real PUT and reload preserve exact independent file bytes', async ({ runtime }) => {
    const directory = join(runtime.data, 'scripts'); mkdirSync(directory, { recursive: true });
    const path = join(directory, 'oracle-control.mjs'), original = '// Never executed\nexport const value = 40;\n';
    writeFileSync(path, original);
    const read = await runtime.api('/api/scripts/oracle-control.mjs');
    expect(read.status).toBe(200);
    expect(read.json<{ data: { content: string } }>().data.content).toBe(original);
    const edited = original.replace('40', '41');
    expect((await runtime.api('/api/scripts/oracle-control.mjs', 'PUT', { content: edited })).status).toBe(200);
    expect(readFileSync(path, 'utf8')).toBe(edited);
    expect((await runtime.api('/api/scripts/oracle-control.mjs')).json<{ data: { content: string } }>().data.content).toBe(edited);
  });
});
