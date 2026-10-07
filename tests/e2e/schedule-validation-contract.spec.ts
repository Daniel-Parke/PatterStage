import { test, expect, type Runtime } from '../helpers/route-contract-runtime';

const schedules = (runtime: Runtime) => runtime.sql(db => db.prepare('SELECT * FROM schedules ORDER BY id').all());
async function create(runtime: Runtime, schedule = 'every 1d') {
  const response = await runtime.api('/api/schedules', 'POST', { kind: 'script', scriptName: 'never-executed.mjs', schedule, enabled: false });
  expect(response.status).toBe(201);
  return response.json<{ data: { schedule: { id: string; nextRunAt: string | null } } }>().data.schedule;
}

const refusals = [
  ['whenever', 'Unrecognized schedule: whenever'],
  ['0 0 30 2 *', 'Schedule "0 0 30 2 *" can never fire: it names a date that does not exist, or a field outside its range. Check the day-of-month against the month.'],
  ['every 0m', 'Schedule "every 0m" repeats too often. The shortest gap between runs is 1 minute, because each run starts real work that has to finish. Try "every 5m".'],
  ['every 367d', 'Schedule "every 367d" repeats too rarely. The longest gap between runs is 366 days. Use a smaller number, or a cron schedule such as "0 9 1 1 *" to run once a year.'],
] as const;

test.describe('T-0192 schedule validation preserves write boundaries', () => {
  for (const method of ['POST', 'PATCH'] as const) {
    for (const [schedule, error] of refusals) {
      test(`${method} refuses ${schedule} with exact text and unchanged persisted rows`, async ({ runtime }) => {
        const row = await create(runtime);
        const before = schedules(runtime);
        const response = method === 'POST'
          ? await runtime.api('/api/schedules', method, { kind: 'script', scriptName: 'never-executed.mjs', schedule, enabled: false })
          : await runtime.api(`/api/schedules/${row.id}`, method, { schedule });
        expect(response.status).toBe(400);
        expect(response.json()).toEqual({ error });
        expect(schedules(runtime)).toEqual(before);
      });
    }
    for (const schedule of ['0 0 29 2 *', '2001-01-01T00:00:00Z']) {
      test(`${method} accepts ${schedule} without requiring a next run`, async ({ runtime }) => {
        const row = await create(runtime, method === 'POST' ? schedule : 'every 1d');
        if (method === 'PATCH') expect((await runtime.api(`/api/schedules/${row.id}`, 'PATCH', { schedule })).status).toBe(200);
        const saved = runtime.sql(db => db.prepare('SELECT schedule, next_run_at, enabled FROM schedules WHERE id=?').get(row.id)) as { schedule: string; next_run_at: string | null; enabled: number };
        expect(saved.schedule).toBe(schedule);
        expect(saved.enabled).toBe(0);
        if (schedule.startsWith('2001')) expect(saved.next_run_at).toBeNull();
      });
    }
  }

  test('PATCH without an expression preserves its stored next run', async ({ runtime }) => {
    const row = await create(runtime);
    expect(row.nextRunAt).not.toBeNull();
    expect((await runtime.api(`/api/schedules/${row.id}`, 'PATCH', { name: 'Renamed only' })).status).toBe(200);
    expect(runtime.sql(db => db.prepare('SELECT name, next_run_at FROM schedules WHERE id=?').get(row.id))).toEqual({ name: 'Renamed only', next_run_at: row.nextRunAt });
  });

  test('missing targets and missing rows retain precedence over an invalid expression', async ({ runtime }) => {
    const before = schedules(runtime);
    const post = await runtime.api('/api/schedules', 'POST', { schedule: 'whenever' });
    expect(post.status).toBe(400);
    expect(post.json()).toEqual({ error: 'missionId is required for a mission schedule' });
    const patch = await runtime.api('/api/schedules/no-such-owned-row', 'PATCH', { schedule: 'whenever' });
    expect(patch.status).toBe(404);
    expect(patch.json()).toEqual({ error: 'Schedule not found' });
    expect(schedules(runtime)).toEqual(before);
  });

  for (const action of ['promote', 'dispatch']) {
    test(`${action} above-maximum interval preserves mission, schedule and run rows`, async ({ runtime }) => {
      runtime.sql(db => db.prepare("INSERT INTO missions(id,name,prompt,status,queued_for_run,created_at,updated_at) VALUES ('oracle-schedule-draft','Retain','<hermes_mission></hermes_mission>','queued',0,'2026-01-01','2026-01-01')").run());
      const snapshot = () => runtime.sql(db => ['missions', 'schedules', 'runs'].map(table => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
      const before = snapshot();
      const response = await runtime.api('/api/missions', 'POST', {
        action, missionId: 'oracle-schedule-draft', instruction: 'Never run this owned fixture',
        dispatchMode: 'cron', schedule: refusals[3][0], name: 'Must not be written',
      });
      expect(response.status).toBe(400);
      expect(response.json()).toEqual({ error: refusals[3][1] });
      expect(snapshot()).toEqual(before);
    });
  }
});
