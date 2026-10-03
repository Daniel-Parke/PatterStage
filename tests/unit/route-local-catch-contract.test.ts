/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { pendingLookup } from '../helpers/mission-async-deferred';

let mockAuthorised = true;
jest.mock('@/lib/auth/stream-guard', () => ({ streamAuthorizer: () => () => mockAuthorised }));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn(), readFileSync: jest.fn(), writeFileSync: jest.fn(), statSync: jest.fn() }));
jest.mock('@/lib/db', () => ({ ensureDb: jest.fn(), inTransaction: (fn: () => unknown) => fn() }));
jest.mock('@/lib/sync', () => ({ ensureSyncLayer: jest.fn() }));
jest.mock('@/lib/api/api-auth', () => ({ isReadOnly: jest.fn(), requireAuthenticatedHostWrites: jest.fn() }));
jest.mock('@/lib/api/audit-log', () => ({ appendAuditLine: jest.fn() }));
jest.mock('@/lib/analytics/record-event', () => ({ recordEvent: jest.fn() }));
jest.mock('@/lib/host/paths', () => ({ PATHS: { missions: '/owned/missions' }, readEnv: () => undefined }));
jest.mock('@/lib/missions/mission-repository', () => ({ listMissions: jest.fn() }));
jest.mock('@/lib/runs/runs-repository', () => ({ getLatestRunForMission: jest.fn(), listLatestRunsForMissions: jest.fn() }));
jest.mock('@/lib/schedule/schedules-repository', () => ({ getScheduleForMission: jest.fn(), listSchedulesForMissions: jest.fn() }));
jest.mock('@/lib/missions/mission-handlers/shared', () => ({ getMissionOrNotFound: jest.fn() }));
jest.mock('@/lib/missions/mission-handlers/dispatch', () => ({ handleDispatchMission: jest.fn() }));
jest.mock('@/lib/missions/mission-handlers/promote', () => ({ handlePromoteMission: jest.fn() }));
jest.mock('@/lib/missions/mission-handlers/update', () => ({ handleUpdateMission: jest.fn() }));
jest.mock('@/lib/missions/mission-handlers/cancel', () => ({ handleCancelMission: jest.fn() }));
jest.mock('@/lib/missions/mission-handlers/delete', () => ({ handleDeleteMission: jest.fn() }));
jest.mock('@/lib/scripts/scripts-manager', () => ({ tailScriptLog: jest.fn(), runScriptFile: jest.fn() }));
jest.mock('@/modules/hermes/lib/sync-manager', () => ({ pushModelToHermes: jest.fn(), pushCredential: jest.fn() }));
jest.mock('@/lib/models/models-repository', () => ({ getModelWithKey: jest.fn() }));
jest.mock('@/modules/hermes/lib/profile-paths', () => ({ resolveProfileHermesHome: () => '/owned/hermes', buildProfileHermesPathBundle: () => ({ hermes: '/owned/hermes/HERMES.md', env: '/owned/hermes/.env', config: '/owned/hermes/config.yaml' }) }));
jest.mock('@/modules/hermes/lib/behavior-files', () => ({ getBehaviorFiles: () => ({ hermes: { name: 'HERMES.md', description: 'Owned file' }, env: { name: '.env' }, config: { name: 'config.yaml' } }) }));
jest.mock('@/lib/fs/fs-stats', () => ({ safeStat: jest.fn() }));
jest.mock('@/lib/fs/fs-helpers', () => ({ ensureDir: jest.fn(), backupTimestamp: () => 'owned-backup' }));
jest.mock('@/modules/hermes/lib/profiles-repository', () => ({ getProfile: jest.fn() }));
jest.mock('@/modules/hermes/lib/agent-file-store', () => ({ isManagedKey: jest.fn(), readManagedFileContent: jest.fn(), writeManagedFileContent: jest.fn() }));
jest.mock('@/modules/hermes/handlers/profile-patch', () => ({ applyProfileOrRootPatchOrFail: jest.fn(), pushProfileOrRootOrFail: jest.fn() }));
jest.mock('@/modules/hermes/lib/profile-config-builder', () => ({ configYamlToColumnValues: jest.fn(), platformToolsetsFromJson: jest.fn(), serializeJsonToolsets: jest.fn() }));
jest.mock('@/lib/runtime/workspace', () => ({ getAgentWorkspace: () => ({ sessions: '/owned/sessions' }) }));
jest.mock('@/lib/runtime/state-db', () => ({ readAgentSessionDetail: jest.fn() }));
jest.mock('@/lib/sessions/sessions-api-guard', () => ({ getMaxSessionMessages: () => 20, getMaxSessionFileBytes: () => 1024, sessionsRateLimitResponse: jest.fn() }));
jest.mock('@/lib/sessions/session-repository', () => ({ getSession: jest.fn(), estimateSessionSize: jest.fn() }));
jest.mock('@/lib/sessions/session-mission-links', () => ({ lookupMissionIdForCronSession: jest.fn() }));
jest.mock('@/lib/sessions/session-detail', () => ({ findFileWithExtension: jest.fn(), buildSessionData: (data: unknown) => data, dbSessionFields: jest.fn(), parseAssistantLines: jest.fn() }));
jest.mock('@/lib/models/fallbacks-repository', () => ({ addFallbackEntry: jest.fn(), getFallbackConfig: jest.fn(), getFallbackEntry: jest.fn(), listFallbackChain: jest.fn(), toggleFallbackEntry: jest.fn(), updateFallbackEntry: jest.fn(), updateFallbackConfigBatch: jest.fn() }));
jest.mock('@/modules/hermes/lib/fallback-sync', () => ({ commitFallbackChange: jest.fn(), syncEnabledFallbackChainToHermes: jest.fn() }));
jest.mock('@/modules/hermes/lib/fallback-import', () => ({ importFallbacksFromHermesYaml: jest.fn() }));

import * as fs from 'fs';
import { ensureDb } from '@/lib/db';
import { ensureSyncLayer } from '@/lib/sync';
import { requireAuthenticatedHostWrites, isReadOnly } from '@/lib/api/api-auth';
import { listMissions } from '@/lib/missions/mission-repository';
import { listLatestRunsForMissions } from '@/lib/runs/runs-repository';
import { listSchedulesForMissions } from '@/lib/schedule/schedules-repository';
import { getMissionOrNotFound } from '@/lib/missions/mission-handlers/shared';
import { tailScriptLog, runScriptFile } from '@/lib/scripts/scripts-manager';
import { pushModelToHermes, pushCredential } from '@/modules/hermes/lib/sync-manager';
import { getModelWithKey } from '@/lib/models/models-repository';
import { safeStat } from '@/lib/fs/fs-stats';
import { isManagedKey, writeManagedFileContent } from '@/modules/hermes/lib/agent-file-store';
import { configYamlToColumnValues } from '@/modules/hermes/lib/profile-config-builder';
import { readAgentSessionDetail } from '@/lib/runtime/state-db';
import { findFileWithExtension } from '@/lib/sessions/session-detail';
import { addFallbackEntry, getFallbackConfig } from '@/lib/models/fallbacks-repository';
import { syncEnabledFallbackChainToHermes } from '@/modules/hermes/lib/fallback-sync';
import { GET as missions } from '@/app/api/missions/route';
import { GET as logs } from '@/app/api/scripts/logs/route';
import { POST as run } from '@/app/api/scripts/run/route';
import { POST as push } from '@/app/api/models/sync/push/route';
import { GET as fileGet, PUT as filePut } from '@/app/api/agent/files/[key]/route';
import { GET as session } from '@/app/api/sessions/[id]/route';
import { POST as fallback } from '@/app/api/models/fallbacks/route';

const request = (path: string, method = 'GET', body?: unknown) => new NextRequest(`http://owned.test/api/${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const fileContext = (key = 'hermes') => ({ params: Promise.resolve({ key }) });
const runResult = { outcome: 'succeeded' as const, exitCode: 0, ok: true, logFile: '/owned/logs/owned.mjs.log' };
const terminal = (route: string, context: string, suffix: string) => `[API ${route}] Error ${context}: ${suffix}`;
beforeEach(() => {
  jest.resetAllMocks(); mockAuthorised = true;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.mocked(fs.existsSync).mockReturnValue(true);
  jest.mocked(fs.readFileSync).mockReturnValue('{"messages":[]}');
  jest.mocked(fs.statSync).mockReturnValue({ size: 20, birthtime: new Date(0) } as fs.Stats);
  jest.mocked(safeStat).mockReturnValue({ size: 20, mtime: 'owned-time' } as ReturnType<typeof safeStat>);
  jest.mocked(listMissions).mockReturnValue([]);
  jest.mocked(listLatestRunsForMissions).mockReturnValue(new Map());
  jest.mocked(listSchedulesForMissions).mockReturnValue(new Map());
  jest.mocked(getMissionOrNotFound).mockReturnValue(NextResponse.json({ error: 'Mission not found' }, { status: 404 }));
  jest.mocked(tailScriptLog).mockReturnValue('owned log');
  jest.mocked(runScriptFile).mockResolvedValue(runResult);
  jest.mocked(pushModelToHermes).mockReturnValue({ success: true, backupPath: null, details: [] });
  jest.mocked(findFileWithExtension).mockReturnValue('/owned/sessions/session-safe.json');
  jest.mocked(addFallbackEntry).mockReturnValue({ id: 'owned-fallback' } as ReturnType<typeof addFallbackEntry>);
  jest.mocked(getFallbackConfig).mockReturnValue({} as ReturnType<typeof getFallbackConfig>);
});
afterEach(() => jest.restoreAllMocks());

const contexts = [
  { label: 'Missions list', route: 'GET /api/missions', doing: 'listing missions', message: 'Failed to load missions', dependency: listMissions, invoke: () => missions(request('missions')), status: 200 },
  { label: 'Missions id', route: 'GET /api/missions', doing: 'mission owned-id', message: 'Failed to load missions', dependency: getMissionOrNotFound, invoke: () => missions(request('missions?id=owned-id')), status: 404 },
  { label: 'Script log name', route: 'GET /api/scripts/logs', doing: 'owned.mjs', message: 'Failed to read script log', dependency: tailScriptLog, invoke: () => logs(request('scripts/logs?name=owned.mjs')), status: 200 },
  { label: 'Script run name', route: 'POST /api/scripts/run', doing: 'owned.mjs', message: 'Failed to run script', dependency: runScriptFile, invoke: () => run(request('scripts/run', 'POST', { name: 'owned.mjs' })), status: 200 },
  { label: 'Model push id', route: 'POST /api/models/sync/push', doing: 'pushing model owned-model', message: 'Failed to push model', dependency: pushModelToHermes, invoke: () => push(request('models/sync/push', 'POST', { modelId: 'owned-model' })), status: 200 },
  { label: 'Agent file read path', route: 'GET /api/agent/files/[key]', doing: 'reading /owned/hermes/HERMES.md', message: 'Failed to read file', dependency: fs.readFileSync, invoke: () => fileGet(request('agent/files/hermes'), fileContext()), status: 200 },
  { label: 'Agent file write path', route: 'PUT /api/agent/files/[key]', doing: 'writing /owned/hermes/HERMES.md', message: 'Failed to write file', dependency: fs.writeFileSync, invoke: () => filePut(request('agent/files/hermes', 'PUT', { content: 'owned' }), fileContext()), status: 200 },
  { label: 'Session sanitised id', route: 'GET /api/sessions/[id]', doing: 'reading session session-safe', message: 'Failed to read session "session-safe"', dependency: fs.statSync, invoke: () => session(request('sessions/session-safe'), { params: Promise.resolve({ id: 'session-safe' }) }), status: 200 },
  { label: 'Fallback action', route: 'POST /api/models/fallbacks', doing: 'fallback action add', message: 'Failed to process fallback action', dependency: addFallbackEntry, invoke: () => fallback(request('models/fallbacks', 'POST', { action: 'add', modelId: 'owned-model' })), status: 201 },
];
const failures = [['Error', new Error('owned failure'), 'owned failure'], ['empty Error', new Error(''), ''], ['string', 'owned refusal', 'owned refusal'], ['null', null, 'null'], ['object', { code: 7 }, '[object Object]']] as const;
describe('T-0192 route-local terminal catch contracts', () => {
  for (const entry of contexts) {
    it.each(failures)(`${entry.label}: exact terminal log and 500 for %s`, async (_label, failure, suffix) => {
      jest.mocked(entry.dependency).mockImplementationOnce(() => { throw failure; });
      const response = await entry.invoke();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: entry.message });
      const expected = terminal(entry.route, entry.doing, suffix);
      expect(jest.mocked(console.error).mock.calls.filter(args => args[0] === expected)).toEqual([[expected]]);
      expect(jest.mocked(console.error).mock.calls).toEqual([[expected]]);
      if (entry.label === 'Model push id') { expect(getModelWithKey).not.toHaveBeenCalled(); expect(pushCredential).not.toHaveBeenCalled(); }
    });
    it(`${entry.label}: normal response has no terminal error log`, async () => {
      const response = await entry.invoke();
      expect(response.status).toBe(entry.status);
      expect(entry.dependency).toHaveBeenCalledTimes(1);
      expect(console.error).not.toHaveBeenCalled();
    });
  }
  it('Missions sync bootstrap rejection remains outside the terminal catch', async () => {
    const failure = new Error('owned bootstrap failure');
    jest.mocked(ensureSyncLayer).mockImplementationOnce(() => { throw failure; });
    await expect(missions(request('missions'))).rejects.toBe(failure);
    expect(listMissions).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
  });
  it.each(['host', 'read-only'] as const)('Script %s refusal precedes parsing and execution', async mode => {
    const req = request('scripts/run', 'POST', { name: 'owned.mjs' }), parse = jest.spyOn(req, 'json');
    if (mode === 'host') jest.mocked(requireAuthenticatedHostWrites).mockReturnValueOnce(NextResponse.json({ error: 'Owned host refusal' }, { status: 403 }));
    else jest.mocked(isReadOnly).mockReturnValueOnce(true);
    const response = await run(req);
    expect(response.status).toBe(mode === 'host' ? 403 : 503);
    expect(parse).not.toHaveBeenCalled(); expect(runScriptFile).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
  });
  it('invalid Session id is refused before state or file reads', async () => {
    const response = await session(request('sessions/invalid'), { params: Promise.resolve({ id: '../invalid' }) });
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'Invalid session ID' });
    expect(readAgentSessionDetail).not.toHaveBeenCalled(); expect(fs.statSync).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
  });
  it('unknown Agent file key is refused before database or disk work', async () => {
    const response = await fileGet(request('agent/files/unknown'), fileContext('unknown'));
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'Unknown file key: unknown' });
    expect(ensureDb).not.toHaveBeenCalled(); expect(fs.readFileSync).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
  });
  it('invalid fallback action is refused before mutation and terminal logging', async () => {
    const response = await fallback(request('models/fallbacks', 'POST', { action: 'not-an-action' }));
    expect(response.status).toBe(400); expect(addFallbackEntry).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
  });
  it('model refusal prevents credential lookup and push without a terminal exception log', async () => {
    jest.mocked(pushModelToHermes).mockReturnValueOnce({ success: false, backupPath: null, details: [{ action: 'error', detail: 'owned refusal' }] });
    const response = await push(request('models/sync/push', 'POST', { modelId: 'owned-model' }));
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'Push to Hermes failed for owned-model: owned refusal' });
    expect(getModelWithKey).not.toHaveBeenCalled(); expect(pushCredential).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
  });
  it('credential inner failure stays nonfatal after successful model push', async () => {
    jest.mocked(getModelWithKey).mockReturnValueOnce({ apiKey: 'synthetic-not-used', credentialsId: 'owned-credential' } as ReturnType<typeof getModelWithKey>);
    jest.mocked(pushCredential).mockImplementationOnce(() => { throw new Error('owned credential refusal'); });
    const response = await push(request('models/sync/push', 'POST', { modelId: 'owned-model' }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ data: { success: true, backupPath: null, details: [{ action: 'warning', detail: 'Credential push failed (non-fatal)' }] } });
    expect(pushCredential).toHaveBeenCalledWith('owned-credential'); expect(console.error).not.toHaveBeenCalled();
  });
  it.each([false, true])('Agent backup warning preserves subsequent write outcome; terminal failure=%s', async failWrite => {
    jest.mocked(fs.writeFileSync).mockImplementation(file => { if (String(file).includes('/backups/')) throw new Error('owned backup refusal'); if (failWrite) throw new Error('owned write refusal'); });
    const response = await filePut(request('agent/files/hermes', 'PUT', { content: 'owned', backup: true }), fileContext());
    expect(response.status).toBe(failWrite ? 500 : 200);
    const warning = terminal('PUT /api/agent/files/[key]', 'backup /owned/hermes/HERMES.md', 'owned backup refusal');
    const final = terminal('PUT /api/agent/files/[key]', 'writing /owned/hermes/HERMES.md', 'owned write refusal');
    expect(jest.mocked(console.error).mock.calls).toEqual(failWrite ? [[warning], [final]] : [[warning]]);
    expect(await response.json()).toEqual(failWrite ? { error: 'Failed to write file' } : { data: { success: true, key: 'hermes', path: '/owned/hermes/HERMES.md' } });
  });
  it.each([false, true])('Session database warning preserves file fallback outcome; terminal failure=%s', async failRead => {
    jest.mocked(readAgentSessionDetail).mockImplementationOnce(() => { throw new Error('owned state refusal'); });
    if (failRead) jest.mocked(fs.statSync).mockImplementationOnce(() => { throw new Error('owned file refusal'); });
    const response = await session(request('sessions/session-safe'), { params: Promise.resolve({ id: 'session-safe' }) });
    expect(response.status).toBe(failRead ? 500 : 200);
    const warning = terminal('GET /api/sessions/[id]', 'reading Hermes state.db for session-safe', 'owned state refusal');
    const final = terminal('GET /api/sessions/[id]', 'reading session session-safe', 'owned file refusal');
    expect(jest.mocked(console.error).mock.calls).toEqual(failRead ? [[warning], [final]] : [[warning]]);
    if (failRead) expect(await response.json()).toEqual({ error: 'Failed to read session "session-safe"' });
  });
  it('Agent malformed config keeps its specialised 409 before managed write', async () => {
    jest.mocked(isManagedKey).mockReturnValue(true);
    jest.mocked(configYamlToColumnValues).mockImplementationOnce(() => { throw new Error('owned YAML refusal\nnot exposed'); });
    const response = await filePut(request('agent/files/config', 'PUT', { content: 'invalid' }), fileContext('config'));
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'config.yaml was not saved: owned YAML refusal' });
    expect(writeManagedFileContent).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
  });
  it.each(failures)('Fallback sync inner catch retains its own message and log for %s', async (_label, failure, suffix) => {
    jest.mocked(syncEnabledFallbackChainToHermes).mockImplementationOnce(() => { throw failure; });
    const response = await fallback(request('models/fallbacks', 'POST', { action: 'sync' }));
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: suffix });
    expect(jest.mocked(console.error).mock.calls).toEqual([[terminal('POST /api/models/fallbacks { action: sync }', 'syncing fallback to Hermes', suffix)]]);
  });
  for (const authorised of [false, true]) {
    it.each(['success', 'error'] as const)(`outer response guard after awaited %s retains authorised=${authorised}`, async outcome => {
      const held = pendingLookup<Awaited<ReturnType<typeof runScriptFile>>>();
      const entered = pendingLookup<void>();
      jest.mocked(runScriptFile).mockImplementationOnce(() => { entered.complete(); return held.promise; });
      const req = new NextRequest('http://owned.test/api/scripts/run', { method: 'POST', headers: { cookie: 'ps_session=owned-session' }, body: JSON.stringify({ name: 'owned.mjs' }) });
      const responsePromise = run(req);
      // Observe the controlled dependency before changing authorisation.
      await entered.promise;
      expect(runScriptFile).toHaveBeenCalledTimes(1); mockAuthorised = authorised;
      if (outcome === 'success') held.complete(runResult); else held.fail(new Error('owned delayed refusal'));
      const response = await responsePromise;
      expect(response.status).toBe(authorised ? outcome === 'success' ? 200 : 500 : 401);
      if (!authorised) { expect(await response.json()).toEqual({ error: 'Browser session is no longer authorised.' }); expect(response.headers.get('Cache-Control')).toBe('no-store'); }
      else if (outcome === 'error') expect(await response.json()).toEqual({ error: 'Failed to run script' });
      expect(jest.mocked(console.error).mock.calls).toEqual(outcome === 'error' ? [[terminal('POST /api/scripts/run', 'owned.mjs', 'owned delayed refusal')]] : []);
    });
  }
});
