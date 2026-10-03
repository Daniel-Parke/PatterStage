import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Diagnostic only. Never export observer output, exception messages or arguments.
export function redactFailure(stderr) {
  const files = new Set([
    'tests/helpers/release-install-http-loopback-probe.py',
    'tests/helpers/release-install-http-context-probe.py',
    'tests/helpers/release-install-http-probe.py',
    'tests/helpers/release-install-http-curl-bridge.py',
    'tests/integration/test_full_install_update_process.py',
  ]);
  const classes = new Set(['AttributeError', 'OSError', 'RuntimeError', 'ValueError',
    'TypeError', 'KeyError', 'FileNotFoundError', 'PermissionError', 'ImportError',
    'ModuleNotFoundError', 'TimeoutExpired', 'CalledProcessError', 'AssertionError']);
  const frames = [];
  let exceptionClass = 'redacted';
  for (const line of stderr.split(/\r?\n/)) {
    const frame = /^\s*File "([^"]+)", line ([0-9]+), in /.exec(line);
    if (frame) {
      const normal = frame[1].replace(/\\/g, '/');
      const marker = normal.lastIndexOf('/tests/');
      const file = marker >= 0 ? normal.slice(marker + 1) : normal;
      const number = Number(frame[2]);
      if (files.has(file) && Number.isSafeInteger(number) && number > 0 && frames.length < 12) {
        frames.push({ file, line: number });
      }
    }
    const name = /^(?:subprocess\.)?([A-Za-z]+):/.exec(line)?.[1];
    if (classes.has(name)) exceptionClass = name;
  }
  return { exceptionClass, frames };
}

let phase = 'setup';

function contextMetrics(stdout) {
  const value = JSON.parse(stdout).stalled;
  const boolean = (input) => {
    if (typeof input !== 'boolean') throw new Error('Invalid observation');
    return input;
  };
  const integer = (input, maximum) => {
    if (!Number.isInteger(input) || input < 0 || input > maximum) throw new Error('Invalid observation');
    return input;
  };
  const selectBooleans = (input, keys) => Object.fromEntries(keys.map((key) => [key, boolean(input[key])]));
  if (!Number.isFinite(value.elapsedSeconds) || value.elapsedSeconds < 0 ||
      !Array.isArray(value.native.statuses) || value.native.statuses.length > 64) throw new Error('Invalid observation');
  return {
    ...selectBooleans(value, ['accepted', 'ownedStopped', 'decoySurvived', 'signalsOwned', 'withinDeadline', 'scratchRemoved']),
    probeExit: integer(value.probeExit, 255), elapsedSeconds: value.elapsedSeconds,
    native: {
      ...selectBooleans(value.native, ['ownedCurlStopped', 'listenerStopped', 'ipcStopped']),
      ...Object.fromEntries(['calls', 'errors', 'cancelled'].map((key) => [key, integer(value.native[key], 10000)])),
      statuses: value.native.statuses.map((status) => integer(status, 255)),
    },
  };
}

function main() {
  const selectors = process.argv.slice(2);
  if (selectors.length > 1 || (selectors.length === 1 && selectors[0] !== '--context')) throw new Error('Unknown diagnostic');
  const context = selectors[0] === '--context';
  const owned = mkdtempSync(join(tmpdir(), 't0205-loopback-diagnostic-'));
  const environment = {};
  for (const name of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC']) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  Object.assign(environment, { HOME: owned, USERPROFILE: owned, TEMP: owned, TMP: owned,
    TMPDIR: owned, PS_DATA_DIR: owned, CH_DATA_DIR: owned, HERMES_HOME: owned,
    PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' });
  let report;
  try {
    phase = 'launch';
    const result = spawnSync(process.env.PYTHON || 'python',
      [resolve(`tests/helpers/release-install-http-${context ? 'context' : 'loopback'}-probe.py`), ...(context ? ['stalled'] : [])], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 150_000,
        maxBuffer: 1024 * 1024, env: environment,
      });
    const codes = new Set(['ENOENT', 'EACCES', 'ETIMEDOUT', 'ENOBUFS']);
    report = { diagnosticOnly: true, status: result.status,
      signal: /^[A-Z0-9]+$/.test(result.signal || '') ? result.signal : null,
      launchError: result.error ? (codes.has(result.error.code) ? result.error.code : 'redacted') : null,
      ...redactFailure(result.stderr || '') };
    if (context && result.status === 0 && !result.signal && !result.error) {
      phase = 'observation';
      report.context = contextMetrics(result.stdout);
    }
  } finally {
    const previousPhase = phase;
    phase = 'cleanup';
    rmSync(owned, { recursive: true, force: true });
    phase = previousPhase;
  }
  console.log(JSON.stringify(report));
  return report.status === 0 && !report.signal && !report.launchError ? 0 : 90;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    process.exitCode = main();
  } catch (error) {
    const classes = new Set(['Error', 'TypeError', 'RangeError', 'SystemError']);
    const codes = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOMEM', 'ENOSPC', 'EBUSY']);
    console.log(JSON.stringify({ diagnosticOnly: true, failed: true, phase,
      exceptionClass: classes.has(error?.name) ? error.name : 'redacted',
      code: codes.has(error?.code) ? error.code : 'redacted' }));
    process.exitCode = 90;
  }
}
