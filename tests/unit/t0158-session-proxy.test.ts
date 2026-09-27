/** @jest-environment node */
/** Source-level proxy oracle. No production bundle is needed for the Jest gate. */
import { NextRequest } from 'next/server';

const token = 't0158-proxy-source-oracle-83c0974d';
const previousToken = process.env.PS_AUTH_TOKEN;
const previousReadOnly = process.env.PS_READ_ONLY;

beforeEach(() => {
  process.env.PS_AUTH_TOKEN = token;
  jest.resetModules();
});

afterEach(() => {
  if (previousToken === undefined) delete process.env.PS_AUTH_TOKEN;
  else process.env.PS_AUTH_TOKEN = previousToken;
  if (previousReadOnly === undefined) delete process.env.PS_READ_ONLY;
  else process.env.PS_READ_ONLY = previousReadOnly;
});

async function invoke(path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}): Promise<Response> {
  const implementation = jest.requireActual('@/proxy') as { proxy?: (request: NextRequest) => Response | Promise<Response>; default?: (request: NextRequest) => Response | Promise<Response> };
  const handler = implementation.proxy ?? implementation.default;
  if (!handler) throw new Error('The Next proxy module has no request handler');
  return handler(new NextRequest(`http://127.0.0.1:3000${path}`, init));
}

test('Given no browser session, exact POST sign-in reaches its handler without widening other auth paths', async () => {
  const signIn = await invoke('/api/auth/sign-in', {
    method: 'POST', headers: { Origin: 'http://127.0.0.1:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  expect(signIn.status).toBeLessThan(400);
  for (const path of ['/api/auth/sessions/list', '/api/auth/sessions/revoke', '/api/auth/sign-in/other']) {
    const denied = await invoke(path, { method: 'POST', headers: { Origin: 'http://127.0.0.1:3000' } });
    expect([401, 403]).toContain(denied.status);
  }
});

test('Given read-only mode, application writes are refused with a defined status', async () => {
  process.env.PS_READ_ONLY = '1';
  const response = await invoke('/api/orchestration/chat', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'http://127.0.0.1:3000' },
  });
  expect([403, 503]).toContain(response.status);
});

test('Given intentional GET token hand-off, proxy redirects without putting the root token in the cookie', async () => {
  const response = await invoke(`/?ps_token=${encodeURIComponent(token)}`);
  expect(response.status).toBeGreaterThanOrEqual(300);
  expect(response.status).toBeLessThan(400);
  expect(response.headers.get('location') ?? '').not.toContain('ps_token');
  expect(response.headers.get('set-cookie') ?? '').toMatch(/ps_session=/);
  expect(response.headers.get('set-cookie') ?? '').not.toContain(token);
});
