import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, lstat, mkdtemp, mkdir, readlink, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const checkoutRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const checkoutData = join(checkoutRoot, 'data');
const testPrefix = 't0161-build-purity-';
const sentinelText = 'T-0161 committed fixture';

class InfrastructureFailure extends Error {
  constructor(message) {
    super('INFRASTRUCTURE: ' + message);
  }
}

class PurityFailure extends Error {
  constructor(message) {
    super('PURITY: ' + message);
  }
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function snapshotTree(root) {
  let rootStat;
  try {
    rootStat = await lstat(root);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false, rootMode: null, entries: new Map() };
    }
    throw error;
  }

  if (!rootStat.isDirectory()) {
    throw new InfrastructureFailure('snapshot root is not a directory');
  }

  const entries = new Map();
  async function visit(directory, prefix) {
    for (const name of await readdir(directory)) {
      const path = join(directory, name);
      const key = prefix ? join(prefix, name) : name;
      const stat = await lstat(path);
      const mode = stat.mode & 0o777;
      if (stat.isDirectory()) {
        entries.set(key, { kind: 'directory', mode });
        await visit(path, key);
      } else if (stat.isFile()) {
        entries.set(key, { kind: 'file', mode, digest: await hashFile(path) });
      } else if (stat.isSymbolicLink()) {
        const target = await readlink(path);
        entries.set(key, {
          kind: 'symlink',
          mode,
          digest: createHash('sha256').update(target).digest('hex'),
        });
      } else {
        entries.set(key, { kind: 'other', mode });
      }
    }
  }
  await visit(root, '');
  return { exists: true, rootMode: rootStat.mode & 0o777, entries };
}

function assertUnchanged(label, before, after) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const [path, expected] of before.entries) {
    const actual = after.entries.get(path);
    if (!actual) {
      removed += 1;
    } else if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      changed += 1;
    }
  }
  for (const path of after.entries.keys()) {
    if (!before.entries.has(path)) {
      added += 1;
    }
  }
  if (before.exists !== after.exists || before.rootMode !== after.rootMode ||
      added || removed || changed) {
    throw new PurityFailure(
      label + ' changed (root=' + (before.exists !== after.exists ||
      before.rootMode !== after.rootMode) + ', added=' + added +
      ', removed=' + removed + ', changed=' + changed + ')',
    );
  }
}

function assertEmpty(label, snapshot) {
  if (!snapshot.exists || snapshot.entries.size !== 0) {
    throw new PurityFailure(
      label + ' is no longer empty (entries=' + snapshot.entries.size + ')',
    );
  }
}

async function makeFixture(caseName) {
  const root = await mkdtemp(join(tmpdir(), testPrefix + caseName + '-'));
  const psData = join(root, 'ps-data');
  const chData = join(root, 'ch-data');
  const hermesHome = join(root, 'hermes-home');
  const home = join(root, 'home');
  const npmCache = join(root, 'npm-cache');
  await Promise.all([psData, chData, hermesHome, home, npmCache].map(
    (path) => mkdir(path),
  ));
  return { root, psData, chData, hermesHome, home, npmCache };
}

function buildEnvironment(fixture) {
  const allowed = new Set([
    'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP',
    'TMPDIR', 'OS', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS',
    'PROGRAMFILES', 'PROGRAMFILES(X86)', 'COMMONPROGRAMFILES', 'LANG',
    'LC_ALL',
  ]);
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (allowed.has(key.toUpperCase())) {
      env[key] = value;
    }
  }
  return {
    ...env,
    HOME: fixture.home,
    USERPROFILE: fixture.home,
    APPDATA: fixture.home,
    LOCALAPPDATA: fixture.home,
    npm_config_cache: fixture.npmCache,
    NEXT_TELEMETRY_DISABLED: '1',
    EOS_SESSION_ID: 'T-0161-oracle',
    PS_DATA_DIR: fixture.psData,
    CH_DATA_DIR: fixture.chData,
    HERMES_HOME: fixture.hermesHome,
  };
}

function runProductionBuild(fixture) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['run', 'build'], {
    cwd: checkoutRoot,
    env: buildEnvironment(fixture),
    shell: process.platform === 'win32',
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    timeout: 12 * 60 * 1000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error?.code || result.signal ||
      'exit ' + String(result.status);
    throw new InfrastructureFailure('production build failed (' + reason + ')');
  }
}

async function removeFixture(root) {
  const tempRoot = await realpath(tmpdir());
  const actualRoot = await realpath(root);
  const inside = relative(tempRoot, actualRoot);
  if (!inside || inside.startsWith('..') || isAbsolute(inside) ||
      !basename(actualRoot).startsWith(testPrefix)) {
    throw new InfrastructureFailure('refusing to remove fixture outside temp');
  }
  await rm(actualRoot, { recursive: true, force: true });
}

async function runCase(caseName, populated) {
  const fixture = await makeFixture(caseName);
  let db;
  try {
    if (populated) {
      const dbPath = join(fixture.psData, 'patterstage.db');
      db = new Database(dbPath);
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA wal_autocheckpoint = 0');
      db.exec('CREATE TABLE oracle_sentinel (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      db.prepare('INSERT INTO oracle_sentinel (id, value) VALUES (1, ?)').run(sentinelText);
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          await access(dbPath + suffix);
        } catch {
          throw new InfrastructureFailure('SQLite fixture lacks database or sidecar');
        }
      }
    }

    const before = {
      ps: await snapshotTree(fixture.psData),
      ch: await snapshotTree(fixture.chData),
      hermes: await snapshotTree(fixture.hermesHome),
      checkout: await snapshotTree(checkoutData),
    };

    if (!populated) {
      assertEmpty('empty PS_DATA_DIR fixture', before.ps);
    }

    runProductionBuild(fixture);

    const after = {
      ps: await snapshotTree(fixture.psData),
      ch: await snapshotTree(fixture.chData),
      hermes: await snapshotTree(fixture.hermesHome),
      checkout: await snapshotTree(checkoutData),
    };
    if (!populated) {
      assertEmpty('PS_DATA_DIR after build', after.ps);
    }
    assertUnchanged('PS_DATA_DIR', before.ps, after.ps);
    assertUnchanged('CH_DATA_DIR', before.ch, after.ch);
    assertUnchanged('HERMES_HOME', before.hermes, after.hermes);
    assertUnchanged('checkout data', before.checkout, after.checkout);

    if (populated) {
      let value;
      try {
        value = db.prepare('SELECT value FROM oracle_sentinel WHERE id = 1').get()?.value;
      } catch {
        throw new PurityFailure('SQLite sentinel is unreadable after build');
      }
      if (value !== sentinelText) {
        throw new PurityFailure('SQLite sentinel value changed after build');
      }
    }
  } finally {
    db?.close();
    await removeFixture(fixture.root);
  }
}

test('T-0161: production build leaves empty data directories and checkout data unchanged',
  { concurrency: false, timeout: 13 * 60 * 1000 },
  async () => runCase('empty', false));

test('T-0161: production build preserves populated SQLite, sidecars, and checkout data',
  { concurrency: false, timeout: 13 * 60 * 1000 },
  async () => runCase('populated', true));
