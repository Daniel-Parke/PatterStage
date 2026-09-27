/** @jest-environment node */
/** T-0158 migration contract, run against the real SQLite driver before build. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type RealDb } from '../helpers/baseline-db';

jest.mock('better-sqlite3', () => ({
  __esModule: true,
  default: jest.requireActual(join(process.cwd(), 'node_modules', 'better-sqlite3', 'lib', 'index.js')),
}));
jest.unmock('@/lib/db');

let dataDir: string;
let openedDb: RealDb | null = null;
const priorDataDir = process.env.PS_DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 't0158-sqlite-'));
  openedDb = null;
  process.env.PS_DATA_DIR = dataDir;
  jest.resetModules();
});

afterEach(() => {
  if (!openedDb) {
    try { openedDb = (jest.requireActual('@/lib/db') as typeof import('@/lib/db')).getDb(); } catch { /* no handle after failed bootstrap */ }
  }
  openedDb?.close();
  if (priorDataDir === undefined) delete process.env.PS_DATA_DIR;
  else process.env.PS_DATA_DIR = priorDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

test('Given a fresh SQLite database, migration creates a separate auth_sessions table', () => {
  const { ensureDb, getDb } = jest.requireActual('@/lib/db') as typeof import('@/lib/db');
  ensureDb();
  const database = getDb();
  openedDb = database;
  const row = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_sessions'").get();
  expect(row).toBeDefined();
  const columns = database.prepare('PRAGMA table_info(auth_sessions)').all() as { name: string; type: string }[];
  const names = columns.map(column => column.name);
  const lastActivity = columns.find(column => /last.*activ|activ.*last/i.test(column.name));
  expect(lastActivity).toBeDefined();
  expect(lastActivity!.type).toMatch(/INT|TEXT|REAL|NUMERIC|DATE/i);
  expect(names.some(name => /idle.*expir|expir.*idle/i.test(name))).toBe(true);
  expect(names.some(name => /absolute.*expir|expir.*absolute/i.test(name))).toBe(true);
  expect(names.some(name => /hash/i.test(name))).toBe(true);
});

test('Given a missing v43 SQL file, migration fails rather than recording v43 or admitting later requests', () => {
  const Database = jest.requireActual(join(process.cwd(), 'node_modules', 'better-sqlite3', 'lib', 'index.js')) as unknown as new (path: string) => RealDb;
  const preserved = new Database(join(dataDir, 'patterstage.db'));
  preserved.exec("CREATE TABLE auth_sessions (sentinel TEXT NOT NULL); INSERT INTO auth_sessions (sentinel) VALUES ('keep-on-failure')");
  preserved.close();
  const fs = jest.requireActual('node:fs') as typeof import('node:fs');
  const originalRead = fs.readFileSync;
  const originalExists = fs.existsSync;
  let requested43 = false;
  const missing43 = (path: unknown): boolean => /[\\/]0?43[^\\/]*\.sql$/i.test(String(path));
  const read = jest.spyOn(fs, 'readFileSync').mockImplementation(((path: Parameters<typeof originalRead>[0], ...args: unknown[]) => {
    if (missing43(path)) {
      requested43 = true;
      throw Object.assign(new Error('oracle: v43 SQL file absent'), { code: 'ENOENT' });
    }
    return (originalRead as (...values: unknown[]) => unknown)(path, ...args);
  }) as typeof originalRead);
  const exists = jest.spyOn(fs, 'existsSync').mockImplementation(((path: Parameters<typeof originalExists>[0]) => {
    if (missing43(path)) { requested43 = true; return false; }
    return originalExists(path);
  }) as typeof originalExists);
  try {
    const { ensureDb, getDb } = jest.requireActual('@/lib/db') as typeof import('@/lib/db');
    expect(() => ensureDb()).toThrow();
    expect(requested43).toBe(true);
    expect(() => ensureDb()).toThrow();
    try { openedDb = getDb(); } catch { /* failed bootstrap may withhold the handle */ }
    const verification = openedDb ?? new Database(join(dataDir, 'patterstage.db'));
    try {
      expect(verification.prepare("SELECT value FROM meta WHERE key='schema_version'").get()).toEqual({ value: '42' });
      expect(verification.prepare('SELECT sentinel FROM auth_sessions').get()).toEqual({ sentinel: 'keep-on-failure' });
    } finally { if (verification !== openedDb) verification.close(); }
  } finally {
    read.mockRestore();
    exists.mockRestore();
  }
});
