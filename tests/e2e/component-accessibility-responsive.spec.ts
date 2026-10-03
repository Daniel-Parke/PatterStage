import { test as base, expect, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import { createStoryWeaverSaveFixture, fulfillStoryWeaverLoadOrSpend } from '../helpers/story-weaver-save-fixture';

// T-0191 clean-context browser oracle. Expectations come from the behavioural
// brief; HTTP shapes and selectors were checked against the public baseline.
// Existing preservation coverage is not replaced: "confirmed save marks the
// chapter read and survives reload", "overlapping selections preserve both read
// marks after reload", and "Composer palette and selected-stage inspector stay
// inside the canvas" remain separate historical tests.
const date = '2026-10-01T12:00:00Z';
const credentialLabel = 'Observatory research credential with a long readable label';
const modelName = 'Model for detailed observatory research with a deliberately long identity';
const storyTitle = 'A long story title about the observatory beyond the northern mountains';
const missionValues = {
  profile: 'Agent Observational Research Specialist',
  model: 'Model Northern Observatory Research Edition',
  provider: 'Provider Independent Local Laboratory',
};
type Story = Omit<ReturnType<typeof createStoryWeaverSaveFixture>, 'chapterContents'> & { chapterContents: Record<string, string> };
type RequestBody = { action?: string; chapters?: Story['chapters']; [key: string]: unknown };
type Reply = (route: Route, body: RequestBody, url: URL) => Promise<void>;
type Oracle = {
  handlers: Map<string, Reply>;
  calls: { path: string; method: string; body: RequestBody }[];
  respond: (route: Route, data: unknown, status?: number) => Promise<void>;
};

const test = base.extend<{ oracle: Oracle }>({
  oracle: [async ({ page, baseURL }, use, info) => {
    if (!baseURL || !process.env.PS_E2E_AUTH_TOKEN) throw new Error('Isolated runtime and sign-in token required');
    const origin = new URL(baseURL).origin;
    const signedIn = await page.request.post(`${origin}/api/auth/sign-in`, {
      headers: { Origin: origin }, data: { token: process.env.PS_E2E_AUTH_TOKEN },
    });
    expect(signedIn.ok(), 'real sign-in must succeed before fixture interception').toBe(true);
    const session = (await page.context().cookies()).find(cookie => cookie.name === 'ps_session');
    expect(session?.httpOnly).toBe(true);
    expect(session?.value).not.toBe(process.env.PS_E2E_AUTH_TOKEN);
    const handlers = new Map<string, Reply>();
    const calls: Oracle['calls'] = [];
    const errors: string[] = [], consoleErrors: { text: string; url: string }[] = [], unhandled: string[] = [];
    const refusals = new Map<string, number>();
    const respond: Oracle['respond'] = async (route, data, status = 200) => {
      if (status >= 400) refusals.set(route.request().url(), status);
      await route.fulfill({ status, json: status >= 400 ? { error: data } : { data } });
    };
    // Real isolated seed responses preserve the complete shell/stats envelopes.
    // Only these read-only endpoints may fall through; no paid request can pass.
    const seededReads = new Set(['/api/stats', '/api/status/runtime', '/api/feature-flags', '/api/models/defaults',
      '/api/models/fallbacks/config', '/api/models/sync/drift', '/api/agent/profiles', '/api/mission-categories',
      '/api/templates', '/api/composer/workflows', '/api/composer/runs', '/api/memory/config', '/api/monitor', '/api/sessions']);
    const cached = new Map<string, unknown>();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url }); });
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { unhandled.push(`external ${url.origin}${url.pathname}`); await route.abort('blockedbyclient'); return; }
      if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
      const body = request.postData() ? request.postDataJSON() as RequestBody : {};
      calls.push({ path: url.pathname + url.search, method: request.method(), body });
      const handler = handlers.get(url.pathname);
      if (handler) { await handler(route, body, url); return; }
      if (url.pathname === '/api/update') { await respond(route, { updateAvailable: false, checkFailed: false, deployEnabled: false }); return; }
      if (request.method() === 'GET' && (seededReads.has(url.pathname) || /^\/api\/composer\/workflows\/[^/]+$/.test(url.pathname))) {
        if (!cached.has(request.url())) {
          const response = await route.fetch();
          expect(response.ok(), `seed fixture ${url.pathname}`).toBe(true);
          cached.set(request.url(), await response.json());
        }
        await route.fulfill({ json: cached.get(request.url()) }); return;
      }
      unhandled.push(`${request.method()} ${url.pathname}`);
      await respond(route, 'Unconfigured oracle request', 503);
    });
    handlers.set('/api/models', route => respond(route, { models: [] }));
    handlers.set('/api/credentials', route => respond(route, { credentials: [] }));
    handlers.set('/api/chat', route => respond(route, { conversations: [] }));
    handlers.set('/api/gateway/health', route => respond(route, { online: true, authConfigured: true, baseUrl: 'http://127.0.0.1:8642' }));
    handlers.set('/api/gateway/models', route => respond(route, { models: [] }));
    handlers.set('/api/models/fallbacks', route => respond(route, { entries: [], config: { restorePrimaryOnFallback: true, fallbackNotification: true, apiMaxRetries: 3 } }));
    await use({ handlers, calls, respond });
    const signals = await page.evaluate(() => (window as unknown as { __oracleSignals?: unknown }).__oracleSignals ?? []).catch(() => []);
    await info.attach('observed-client-signals', { body: JSON.stringify(signals), contentType: 'application/json' });
    await info.attach('browser-state', { body: await page.locator('body').ariaSnapshot().catch(() => 'page closed'), contentType: 'text/plain' });
    if (!page.isClosed()) await capture(page, info, 'final-viewport');
    const intentional = consoleErrors.filter(error => refusals.has(error.url) && /Failed to load resource/.test(error.text));
    const unexpected = consoleErrors.filter(error => !intentional.includes(error));
    await info.attach('http-and-console', { body: JSON.stringify({ calls, refusals: [...refusals], intentional, unexpected, errors, unhandled }, null, 2), contentType: 'application/json' });
    expect.soft(unhandled, 'fixture/configuration errors are not behavioural reds').toEqual([]);
    expect.soft(errors, 'unexpected page exceptions').toEqual([]);
    expect.soft(unexpected, 'unexpected console errors').toEqual([]);
  }, { auto: true }],
});

async function capture(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
}

async function bounds(target: Locator) {
  await expect(target).toBeVisible();
  return target.evaluate(element => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    let opacity = 1;
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
    return { x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
      hit: hit === element || (hit !== null && element.contains(hit)), opacity };
  });
}

async function reachable(target: Locator) {
  const box = await bounds(target);
  expect(box.width, JSON.stringify(box)).toBeGreaterThan(0);
  expect(box.height, JSON.stringify(box)).toBeGreaterThan(0);
  expect(box.x, JSON.stringify(box)).toBeGreaterThanOrEqual(-1);
  expect(box.y, JSON.stringify(box)).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, JSON.stringify(box)).toBeLessThanOrEqual(box.viewportWidth + 1);
  expect(box.y + box.height, JSON.stringify(box)).toBeLessThanOrEqual(box.viewportHeight + 1);
  expect(box.hit, `covered target: ${JSON.stringify(box)}`).toBe(true);
  expect(Number(box.opacity)).toBeGreaterThan(0);
  return box;
}

// Explicit wheel navigation is evidence of a deliberate scroll. No locator
// scrollIntoView, forced clicks or evaluate-clicks establish reachability.
async function wheelTo(page: Page, target: Locator) {
  await expect(target).toBeAttached();
  for (let i = 0; i < 80; i++) {
    const box = await target.boundingBox(), viewport = page.viewportSize()!;
    if (box && box.y >= 8 && box.y + box.height <= viewport.height - 8) return;
    await page.mouse.move(viewport.width - 30, Math.floor(viewport.height / 2));
    await page.mouse.wheel(0, box && box.y < 8 ? -350 : 350);
    await page.waitForTimeout(80);
  }
  await reachable(target);
}

async function fallbackActionReachable(page: Page, target: Locator, info: TestInfo) {
  await wheelTo(page, target);
  const sample = () => target.evaluate(element => {
    const targetRect = element.getBoundingClientRect();
    let left = 0, right = innerWidth;
    const containers: { left: number; right: number; top: number; bottom: number; offset: number; maximum: number }[] = [];
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor), rect = ancestor.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
        left = Math.max(left, rect.left); right = Math.min(right, rect.right);
      }
      if (/auto|scroll/.test(style.overflowX) && ancestor.scrollWidth > ancestor.clientWidth) {
        containers.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          offset: ancestor.scrollLeft, maximum: ancestor.scrollWidth - ancestor.clientWidth });
      }
    }
    return { target: { left: targetRect.left, right: targetRect.right, centreY: targetRect.top + targetRect.height / 2 },
      left, right, height: innerHeight, containers };
  });
  const attempts = [];
  let current = await sample(), outcome = 'attempt-limit';
  for (let attempt = 0; attempt < 16; attempt++) {
    const direction = current.target.left < current.left - 1 ? -1 : current.target.right > current.right + 1 ? 1 : 0;
    if (!direction) { outcome = 'target-within-visible-horizontal-bounds'; break; }
    const container = current.containers.find(c => direction < 0 ? c.offset > 1 : c.offset < c.maximum - 1);
    if (!container) { outcome = current.containers.length ? 'scroll-boundary' : 'no-user-scroll-container'; break; }
    const visibleLeft = Math.max(current.left, container.left), visibleRight = Math.min(current.right, container.right);
    const visibleTop = Math.max(0, container.top), visibleBottom = Math.min(current.height, container.bottom);
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) { outcome = 'scroll-container-outside-viewport'; break; }
    const pointer = { x: (visibleLeft + visibleRight) / 2,
      y: Math.max(visibleTop + 1, Math.min(current.target.centreY, visibleBottom - 1)) };
    const distance = direction < 0 ? current.left - current.target.left : current.target.right - current.right;
    const deltaX = direction * Math.min(160, Math.max(16, distance + 4));
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.wheel(deltaX, 0);
    await page.waitForTimeout(150);
    const after = await sample();
    const moved = after.containers.some((c, index) => Math.abs(c.offset - (current.containers[index]?.offset ?? c.offset)) > 0.5);
    attempts.push({ attempt: attempt + 1, pointer, deltaX, before: current, after, moved });
    current = after;
    // An ineffective wheel is recorded separately from a measured boundary.
    // A second wheel allows for delivery/scroll animation before giving up.
    if (!moved && attempts.length > 1 && !attempts[attempts.length - 2].moved) { outcome = 'wheel-no-movement'; break; }
  }
  const name = await target.getAttribute('aria-label') ?? await target.getAttribute('title') ?? await target.innerText();
  await info.attach(`fallback-scroll-${name}`, { body: JSON.stringify({ name, outcome, attempts, final: current }, null, 2), contentType: 'application/json' });
  await capture(page, info, `fallback-target-${name}`);
  await reachable(target);
}

async function activate(page: Page, target: Locator) {
  await reachable(target);
  if (page.viewportSize()!.width === 390) await target.tap(); else await target.click();
}

async function keyboardFocus(page: Page, target: Locator, info: TestInfo) {
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => element === document.activeElement)) {
      await reachable(target);
      expect(await target.evaluate(element => element.matches(':focus-visible'))).toBe(true);
      const style = await target.evaluate(element => { const s = getComputedStyle(element); return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow }; });
      expect((style.outline !== 'none' && style.width !== '0px') || style.shadow !== 'none', JSON.stringify(style)).toBe(true);
      await capture(page, info, 'keyboard-focus'); return;
    }
  }
  throw new Error(`Target was not reached in 150 physical Tab presses: ${await target.ariaSnapshot()}`);
}

async function readable(target: Locator) {
  await expect(target).toBeVisible();
  const result = await target.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    const clipped: string[] = [];
    const own = element.getBoundingClientRect();
    if (element.tagName === 'BUTTON' && rects.some(r => r.left < own.left - 1 || r.right > own.right + 1 || r.top < own.top - 1 || r.bottom > own.bottom + 1)) clipped.push('button-label-outside-border');
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const s = getComputedStyle(ancestor), r = ancestor.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(s.overflowX) && rects.some(t => t.left < r.left - 1 || t.right > r.right + 1)) clipped.push(`${ancestor.tagName}:x`);
      if (/hidden|clip/.test(s.overflowY) && rects.some(t => t.top < r.top - 1 || t.bottom > r.bottom + 1)) clipped.push(`${ancestor.tagName}:y`);
    }
    return { text: element.textContent, rectangles: rects.length, clipped };
  });
  expect.soft(result.rectangles, JSON.stringify(result)).toBeGreaterThan(0);
  expect.soft(result.clipped, `visible text must not rely on title/DOM alone: ${JSON.stringify(result)}`).toEqual([]);
}

function models(oracle: Oracle) {
  const model = { id: 'oracle-model', name: modelName, provider: 'ollama', modelId: 'observatory-large', baseUrl: null,
    contextLength: 32768, credentialsId: null, apiStyle: null, defaults: {}, createdAt: date, updatedAt: date };
  const credential = { id: 'oracle-credential', label: credentialLabel, provider: 'ollama', keyHint: 'test...only', createdAt: date, updatedAt: date };
  oracle.handlers.set('/api/models', route => oracle.respond(route, { models: [model] }));
  oracle.handlers.set('/api/credentials', route => oracle.respond(route, { credentials: [credential] }));
  oracle.handlers.set('/api/credentials/oracle-credential', route => oracle.respond(route, { credential }));
  const entries = [1, 2, 3].map((n) => ({ id: `fallback-${n}`, modelId: model.id, modelName: `${modelName} ${n}`,
    provider: model.provider, modelIdString: model.modelId, position: n - 1, enabled: true, overrideBaseUrl: null, createdAt: date, updatedAt: date }));
  oracle.handlers.set('/api/models/fallbacks', route => oracle.respond(route, { entries, config: { restorePrimaryOnFallback: true, fallbackNotification: true, apiMaxRetries: 3 } }));
}

function reader(oracle: Oracle, pending = false) {
  const story: Story = createStoryWeaverSaveFixture('t0191-browser-story');
  story.title = storyTitle;
  story.chapterContents['1'] = 'First beginning.\n\n' + 'The first chapter follows the observations across the northern mountains.\n\n'.repeat(90);
  story.chapterContents['2'] = 'Second beginning.\n\n' + 'The second chapter follows the researchers back to the observatory.\n\n'.repeat(90);
  if (pending) story.chapters.push({ number: 3, title: 'Third', status: 'pending', readStatus: 'unread', wordCount: 0 });
  oracle.handlers.set('/api/stories', async (route, body) => {
    if (body.action === 'list') { await oracle.respond(route, { stories: [story] }); return; }
    if (await fulfillStoryWeaverLoadOrSpend(route, body.action, { ...story, chapterContents: { '1': story.chapterContents['1'], '2': story.chapterContents['2'], ...story.chapterContents } })) return;
    if (body.action === 'update' && Array.isArray(body.chapters)) {
      for (const chapter of body.chapters) Object.assign(story.chapters.find(c => c.number === chapter.number) ?? {}, chapter);
      await oracle.respond(route, story); return;
    }
    if (body.action === 'delete') { await oracle.respond(route, { success: true }); return; }
    throw new Error(`Unconfigured story action ${body.action}`);
  });
  return story;
}

async function openReader(page: Page, oracle: Oracle, pending = false) {
  const story = reader(oracle, pending);
  await page.goto(`/recroom/story-weaver/${story.id}`);
  await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
  return story;
}

async function beginEdit(page: Page) {
  const edit = page.getByRole('button', { name: 'Edit', exact: true });
  await wheelTo(page, edit); await activate(page, edit);
  const dialog = page.getByRole('dialog', { name: 'Edit chapter 1' });
  await dialog.getByRole('textbox', { name: 'What to change in chapter 1' }).fill('Make the observation clearer.');
  await activate(page, dialog.getByRole('button', { name: 'Edit chapter', exact: true }));
}

async function beginContinue(page: Page) {
  await activate(page, page.getByRole('button', { name: /^Continue(?: this story)?$/ }));
  const dialog = page.getByRole('dialog', { name: 'Continue story', exact: true });
  await dialog.getByRole('textbox', { name: 'Direction for the continuation' }).fill('Continue towards the northern observatory.');
  await activate(page, dialog.getByRole('button', { name: 'Continue story', exact: true }));
}

async function observeStorySignals(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch;
    const observations: { action: string; aborted: boolean; signalled: boolean }[] = [];
    Object.defineProperty(window, '__oracleSignals', { value: observations });
    window.fetch = function(input, init) {
      if (typeof init?.body === 'string' && String(input).includes('/api/stories')) {
        const body = JSON.parse(init.body) as { action?: string };
        if (body.action && ['edit-chapter', 'continue', 'generate-chapter', 'retry-chapter'].includes(body.action)) {
          const signal = init.signal ?? (input instanceof Request ? input.signal : undefined);
          const observation = { action: body.action, aborted: signal?.aborted ?? false, signalled: Boolean(signal) };
          observations.push(observation);
          signal?.addEventListener('abort', () => { observation.aborted = true; }, { once: true });
        }
      }
      return original.call(this, input, init);
    };
  });
}

async function observeAnnouncements(page: Page) {
  await page.addInitScript(() => {
    const messages: string[] = [];
    Object.defineProperty(window, '__oracleAnnouncements', { value: messages });
    new MutationObserver(() => {
      for (const element of document.querySelectorAll('[role="alert"], [role="status"]')) {
        const text = element.textContent?.trim();
        if (text && messages.at(-1) !== text) messages.push(text);
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

async function noReadyAnnouncement(page: Page) {
  // Includes the existing 2000 ms completion callback, so a delayed false
  // success is not missed by an assertion made immediately after refusal.
  await page.waitForTimeout(2300);
  await expect(page.getByText(/story is ready|chapter is ready|AbortError/i)).toHaveCount(0);
  const messages = await page.evaluate(() => (window as unknown as { __oracleAnnouncements?: string[] }).__oracleAnnouncements ?? []);
  expect(messages.filter(message => /story is ready|chapter is ready|AbortError/i.test(message))).toEqual([]);
}

function missionFixture(oracle: Oracle) {
  const mission = { id: 'oracle-mission', name: 'Observatory mission', prompt: 'Review the observations', status: 'dispatched', ...missionValues, profileId: missionValues.profile, createdAt: date, updatedAt: date };
  oracle.handlers.set('/api/missions', (route, _body, url) => oracle.respond(route, url.searchParams.has('id') ? { mission, run: null, schedule: null } : { missions: [mission] }));
  oracle.handlers.set('/api/missions/oracle-mission/run', route => oracle.respond(route, { run: null }));
  return mission;
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0191 production browser ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width === 390, extraHTTPHeaders: {} });

    for (const state of ['empty', 'offline', 'long transcript'] as const) {
      test(`Chat ${state}: composer remains visible and a draft survives the phone sheet`, async ({ page, oracle }, info) => {
        if (state === 'offline') oracle.handlers.set('/api/gateway/health', route => oracle.respond(route, { online: false, authConfigured: false, baseUrl: 'http://127.0.0.1:8642' }));
        if (state === 'long transcript') {
          const conversation = { id: 'oracle-chat', title: 'Observatory conversation', sessionId: null, profileName: null, model: null, previousResponseId: null, createdAt: date, updatedAt: date };
          const messages = Array.from({ length: 40 }, (_, i) => ({ id: `message-${i}`, conversationId: conversation.id, role: i % 2 ? 'assistant' : 'user', content: `Observation ${i}: ` + 'The observatory records a detailed account. '.repeat(12), reasoning: null, toolCalls: null, runId: null, status: 'complete', error: null, createdAt: date, updatedAt: date }));
          oracle.handlers.set('/api/chat', route => oracle.respond(route, { conversations: [conversation] }));
          oracle.handlers.set('/api/chat/oracle-chat', route => oracle.respond(route, { conversation, messages }));
        }
        await page.goto('/work/chat');
        const input = page.getByRole('textbox', { name: 'Message', exact: true });
        if (state === 'long transcript') {
          if (viewport.width === 390) await activate(page, page.getByRole('button', { name: /^Conversations/ }));
          await activate(page, page.getByRole('button', { name: /^Observatory conversation/ }));
          await expect(page.getByText(/^Observation 39:/)).toBeVisible();
        }
        await reachable(input);
        await reachable(input.locator('..'));
        if (state === 'offline') {
          await expect(input).toBeDisabled();
          await reachable(page.getByRole('button', { name: /Send/i }));
          await expect(page.getByText('Gateway Offline', { exact: true })).toBeVisible();
          await capture(page, info, 'chat-offline'); return;
        }
        await keyboardFocus(page, input, info);
        await page.keyboard.type('Preserve this draft');
        const send = page.getByRole('button', { name: /Send/i });
        await reachable(send);
        if (viewport.width === 390) {
          const opener = page.getByRole('button', { name: /^Conversations/ });
          await activate(page, opener);
          await expect(page.getByRole('dialog', { name: /^Conversations/ })).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(opener).toBeFocused();
          await expect(input).toHaveValue('Preserve this draft');
          await keyboardFocus(page, input, info);
        }
        if (state === 'long transcript') {
          await page.mouse.move(viewport.width - 50, 350); await page.mouse.wheel(0, -900);
          await reachable(input); await reachable(send);
        }
        await capture(page, info, `chat-${state}`);
      });
    }

    test('Credentials: long visible label and rotation controls remain usable', async ({ page, oracle }, info) => {
      models(oracle); await page.goto('/agent/models');
      const label = page.getByText(credentialLabel, { exact: true });
      await wheelTo(page, label); await readable(label);
      const rotate = page.getByRole('button', { name: `Rotate key for ${credentialLabel}` });
      await wheelTo(page, rotate); await activate(page, rotate);
      const key = page.getByRole('textbox', { name: `New API key for ${credentialLabel}` });
      await keyboardFocus(page, key, info);
      const save = page.getByRole('button', { name: `Save new key for ${credentialLabel}` });
      await expect(save).toBeDisabled();
      await page.keyboard.type('synthetic-oracle-key');
      await expect(key).toHaveAttribute('type', 'password');
      await reachable(save); await readable(save);
      const cancel = page.getByRole('button', { name: `Cancel rotating ${credentialLabel}` });
      await activate(page, cancel); await expect(key).toHaveCount(0);
      expect(oracle.calls.filter(c => c.method === 'PATCH')).toHaveLength(0);
      await capture(page, info, 'credential-rotation');
    });

    for (const rowNumber of [1, 2, 3]) {
      test(`Fallback row ${rowNumber}: long identity and boundary actions are discoverable`, async ({ page, oracle }, info) => {
        models(oracle); await page.goto('/agent/models');
        const disclosure = page.getByRole('button', { name: 'Fallback Chain 3' });
        await wheelTo(page, disclosure); await activate(page, disclosure);
        const row = page.getByRole('row').filter({ hasText: `${modelName} ${rowNumber}` });
        await wheelTo(page, row); await expect(row.getByText(`${modelName} ${rowNumber}`, { exact: true })).toBeVisible();
        if (rowNumber === 1) await expect(row.getByRole('button', { name: 'Move up', exact: true })).toBeDisabled();
        if (rowNumber !== 1) await expect(row.getByRole('button', { name: 'Move up', exact: true })).toBeEnabled();
        if (rowNumber === 3) await expect(row.getByRole('button', { name: 'Move down', exact: true })).toBeDisabled();
        const edit = row.getByRole('button', { name: 'Edit', exact: true });
        // Each target gets its own deliberate scroll and geometry evidence;
        // a narrow table need not expose every enabled action simultaneously.
        for (const actionButton of await row.getByRole('button').all()) {
          if (await actionButton.isEnabled()) await fallbackActionReachable(page, actionButton, info);
        }
        await fallbackActionReachable(page, edit, info); await capture(page, info, `fallback-${rowNumber}-actions`);
        await keyboardFocus(page, edit, info); await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
      });
    }

    test('Story card: readable identity, separate phone action row and two-step deletion', async ({ page, oracle }, info) => {
      reader(oracle); await page.goto('/recroom/story-weaver');
      const card = page.getByRole('article'), title = card.getByRole('link', { name: storyTitle });
      await readable(title);
      const read = card.getByRole('button', { name: `Read ${storyTitle}` }), remove = card.getByRole('button', { name: `Delete story ${storyTitle}` });
      const titleBox = await bounds(title), actionBox = await reachable(read);
      if (viewport.width === 390) expect.soft(actionBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
      const metadata = card.getByText(/chapters.*words/);
      await readable(metadata);
      if (viewport.width === 390) {
        const metadataBox = await bounds(metadata);
        expect.soft(actionBox.y).toBeGreaterThanOrEqual(metadataBox.y + metadataBox.height);
      }
      await activate(page, read); await expect(page).toHaveURL(/\/recroom\/story-weaver\/t0191-browser-story$/);
      await page.goBack(); await expect(card).toBeVisible();
      await activate(page, remove);
      expect(oracle.calls.filter(c => c.body.action === 'delete')).toHaveLength(0);
      await capture(page, info, 'story-delete-confirmation');
      await expect(remove).toHaveText('Delete?');
      await activate(page, remove);
      await expect.poll(() => oracle.calls.filter(c => c.body.action === 'delete').length).toBe(1);
      expect(oracle.calls.find(c => c.body.action === 'delete')?.body.storyId).toBe('t0191-browser-story');
    });

    for (const status of [404, 500]) {
      test(`Session ${status}: one heading, Retry and back navigation`, async ({ page, oracle }) => {
        let reads = 0;
        oracle.handlers.set('/api/sessions/oracle-session', async route => { reads++; await oracle.respond(route, status === 404 ? 'Session not found' : 'Session unavailable', status); });
        await page.goto('/results/sessions/oracle-session');
        const retry = page.getByRole('button', { name: 'Retry', exact: true });
        await expect(retry).toBeVisible();
        await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        const before = reads; await activate(page, retry); await expect.poll(() => reads).toBeGreaterThan(before);
        const back = page.getByRole('link', { name: /Back|Sessions/i }).last();
        await activate(page, back); await expect(page).toHaveURL(/\/results\/sessions$/);
      });
    }

    for (const tab of ['Directives', 'Mental Models'] as const) {
      test(`Hindsight ${tab}: full toolbar labels and named keyboard dialog`, async ({ page, oracle }, info) => {
        const longContent = 'Use the detailed observation notes from the northern observatory. '.repeat(12);
        oracle.handlers.set('/api/memory/hindsight', route => oracle.respond(route, { available: true, mode: 'ok', memories: [],
          directives: [{ id: 'directive-1', name: 'Observatory directive', content: longContent, priority: 1, is_active: true, tags: [], created_at: date }],
          models: [{ id: 'mental-1', name: 'Observatory mental model', source_query: 'Observe the sky', content: longContent, tags: [], created_at: date, last_refreshed_at: date }] }));
        await page.goto('/agent/memory');
        const tabButton = page.getByRole('button', { name: tab, exact: true });
        await wheelTo(page, tabButton); await activate(page, tabButton);
        const create = page.getByRole('button', { name: tab === 'Directives' ? 'New Directive' : 'New Model', exact: true });
        await wheelTo(page, create); await readable(create); await reachable(create);
        const refresh = page.getByRole('button', { name: 'Refresh', exact: true }).last();
        await readable(refresh); await activate(page, refresh);
        await keyboardFocus(page, create, info); await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
        for (const textbox of await dialog.getByRole('textbox').all()) await expect(textbox).toHaveAccessibleName(/.+/);
        await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(create).toBeFocused();
      });
    }

    test('Mission selected details: distinct long metadata is readable without hovering', async ({ page, oracle }, info) => {
      missionFixture(oracle);
      await page.goto('/work/missions');
      const select = page.getByRole('button', { name: /^Observatory mission/ });
      await wheelTo(page, select); await keyboardFocus(page, select, info); await page.keyboard.press('Enter');
      for (const value of Object.values(missionValues)) {
        const text = page.getByText(value, { exact: true }); await wheelTo(page, text); await readable(text);
      }
      await capture(page, info, 'mission-metadata');
    });

    test('Mission cancellation: settled feedback replaces pending while an unrelated error survives', async ({ page, oracle }, info) => {
      const mission = missionFixture(oracle), original = oracle.handlers.get('/api/missions')!;
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      oracle.handlers.set('/api/missions', async (route, body, url) => {
        if (body.action === 'delete' || route.request().method() === 'DELETE') { await oracle.respond(route, 'Unrelated deletion refusal', 503); return; }
        if (body.action === 'cancel') {
          await held;
          Object.assign(mission, { status: 'failed', result: 'Cancelled by user', queuedForRun: false });
          await oracle.respond(route, { mission, cancel: { accepted: true, processKillPending: true } }); return;
        }
        await original(route, body, url);
      });
      try {
        await page.goto('/work/missions');
        const select = page.getByRole('button', { name: /^Observatory mission/ }); await wheelTo(page, select); await activate(page, select);
        const remove = page.getByRole('button', { name: 'Delete mission', exact: true }); await wheelTo(page, remove); await activate(page, remove);
        await expect(remove).toHaveText('Confirm?'); await activate(page, remove);
        const unrelated = page.getByText('Unrelated deletion refusal', { exact: true }); await expect(unrelated).toBeVisible();
        const cancel = page.getByRole('button', { name: 'Cancel', exact: true }); await activate(page, cancel);
        await activate(page, page.getByRole('button', { name: 'Confirm?', exact: true }));
        const pending = page.getByText('Cancelling mission…', { exact: true }); await expect(pending).toBeVisible();
        await capture(page, info, 'mission-cancellation-pending');
        release(); await expect(page.getByText('Mission cancelled', { exact: true })).toBeVisible();
        // Settlement plus the existing bounded exit animation, not toast expiry.
        await expect.soft(pending).toBeHidden({ timeout: 1000 });
        await expect(unrelated).toBeVisible(); await capture(page, info, 'mission-cancellation-settled');
      } finally { release(); }
    });

    test('Session loading and normal transcript controls remain usable', async ({ page, oracle }, info) => {
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      oracle.handlers.set('/api/sessions/oracle-normal', async route => {
        await held; await oracle.respond(route, { id: 'oracle-normal', filename: 'oracle-normal', format: 'db', title: 'Observatory transcript', model: 'local', source: 'cli', created: date, status: 'completed', exitCode: 0, error: null, messages: [{ index: 0, role: 'user', content: 'Describe the northern observatory.' }, { index: 1, role: 'assistant', content: 'The northern observatory records the stars.' }], size: 200, missionId: null, note: null, messageCount: 2 });
      });
      try {
        await page.goto('/results/sessions/oracle-normal');
        await expect(page.getByText(/Loading/i).first()).toBeVisible(); await capture(page, info, 'session-loading');
        release(); await expect(page.getByRole('heading', { level: 1, name: 'Observatory transcript' })).toBeVisible();
        for (const name of ['Expand all', 'Copy transcript']) await reachable(page.getByRole('button', { name, exact: true }));
        await activate(page, page.getByRole('button', { name: 'Expand all', exact: true }));
        await expect(page.getByText('The northern observatory records the stars.', { exact: true })).toBeVisible();
      } finally { release(); }
    });

    test('Reader large supported font: footer and chapter dots remain reachable', async ({ page, oracle }, info) => {
      await openReader(page, oracle);
      const settings = page.getByRole('button', { name: 'Reading settings', exact: true }); await activate(page, settings);
      const slider = page.getByRole('slider', { name: 'Font size', exact: true }); await keyboardFocus(page, slider, info);
      await page.keyboard.press('End'); await expect(slider).toHaveValue(await slider.getAttribute('max') ?? '');
      await activate(page, settings);
      const footer = page.getByRole('button', { name: 'Second', exact: true }); await wheelTo(page, footer); await reachable(footer);
      const dot = page.getByRole('group', { name: 'Chapters' }).last().getByRole('button', { name: 'Chapter 2: Second (complete)' });
      await reachable(dot); await keyboardFocus(page, dot, info); await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Chapter 2: Second', exact: true })).toBeVisible();
      await capture(page, info, 'reader-large-font-footer');
    });

    for (const navigation of ['Next and Previous', 'chapter selection'] as const) {
      test(`Reader ${navigation}: long chapter starts below the header and read writes survive`, async ({ page, oracle }, info) => {
        await openReader(page, oracle);
        if (navigation === 'Next and Previous') {
          const next = page.getByRole('button', { name: 'Second', exact: true });
          await wheelTo(page, next); await activate(page, next);
        } else {
          if (viewport.width === 390) await activate(page, page.getByRole('button', { name: 'Show chapters', exact: true }));
          const panel = page.getByRole(viewport.width === 390 ? 'dialog' : 'complementary', { name: 'Chapters', exact: true });
          await activate(page, panel.getByRole('button', { name: /Second/ }));
        }
        const heading = page.getByRole('heading', { level: 2, name: 'Chapter 2: Second' });
        await expect(heading).toBeVisible(); await page.waitForTimeout(300);
        const top = await bounds(heading), chapterStrip = await bounds(page.getByRole('group', { name: 'Chapters' }).first());
        const headerBottom = chapterStrip.y + chapterStrip.height;
        expect.soft(top.y).toBeGreaterThanOrEqual(headerBottom);
        expect.soft(top.y + top.height).toBeLessThan(viewport.height);
        const beginning = await page.getByText(/^Second beginning\./).evaluate(element => {
          const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode();
          if (!text) throw new Error('Chapter beginning has no rendered text');
          const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, Math.min(text.textContent?.length ?? 0, 17));
          const r = range.getBoundingClientRect(); return { top: r.top, bottom: r.bottom };
        });
        expect.soft(beginning.top).toBeGreaterThanOrEqual(headerBottom);
        expect.soft(beginning.bottom).toBeLessThan(viewport.height);
        const readChapter = navigation === 'Next and Previous' ? 1 : 2;
        await expect.poll(() => oracle.calls.some(c => c.body.action === 'update' && c.body.chapters?.some(ch => ch.number === readChapter && ch.readStatus === 'read'))).toBe(true);
        await capture(page, info, 'selected-chapter-start');
        if (navigation === 'Next and Previous') {
          const previous = page.getByRole('button', { name: 'First', exact: true });
          await wheelTo(page, previous); await activate(page, previous);
          const first = await bounds(page.getByRole('heading', { level: 2, name: 'Chapter 1: First' }));
          expect(first.y).toBeGreaterThanOrEqual(headerBottom); expect(first.y + first.height).toBeLessThan(viewport.height);
        }
      });
    }

    for (const operation of ['edit', 'continue'] as const) {
      const action = operation === 'edit' ? 'edit-chapter' : 'continue';
      test(`Reader ${operation} refusal: chapter data remains and ready is never announced`, async ({ page, oracle }) => {
        await observeAnnouncements(page);
        const story = await openReader(page, oracle), original = oracle.handlers.get('/api/stories')!;
        oracle.handlers.set('/api/stories', async (route, body, url) => {
          if (body.action === action) { await oracle.respond(route, 'Oracle request refused', 503); return; }
          await original(route, body, url);
        });
        if (operation === 'edit') await beginEdit(page); else await beginContinue(page);
        await expect.poll(() => oracle.calls.some(c => c.body.action === action)).toBe(true);
        await expect(page.getByText('Oracle request refused', { exact: false }).first()).toBeVisible();
        await noReadyAnnouncement(page);
        await expect(page.getByText('Oracle request refused', { exact: false }).first()).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
        await expect(page.getByText(/^First beginning\./)).toBeVisible();
      });

      test(`Reader held ${operation}: Stop is reachable, focused and aborts the actual client`, async ({ page, oracle }, info) => {
        await observeStorySignals(page);
        await observeAnnouncements(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const story = await openReader(page, oracle), original = oracle.handlers.get('/api/stories')!;
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        oracle.handlers.set('/api/stories', async (route, body, url) => {
          if (body.action === action) { await held; await oracle.respond(route, action === 'edit-chapter' ? { story } : story).catch(() => {}); return; }
          await original(route, body, url);
        });
        try {
          if (operation === 'edit') await beginEdit(page); else await beginContinue(page);
          await expect.poll(() => oracle.calls.some(c => c.body.action === action)).toBe(true);
          const stop = page.getByRole('button', { name: /^Stop/ });
          await capture(page, info, 'pending-before-stop-assertion');
          await expect.soft(page.getByText(/^\d+(?:\.\d+)?%$/), 'held work has no measured percentage').toHaveCount(0);
          await expect(stop, 'absent Stop is distinct from covered Stop').toHaveCount(1);
          await reachable(stop); await capture(page, info, 'held-operation');
          await keyboardFocus(page, stop, info); await page.keyboard.press('Enter');
          await expect.poll(() => page.evaluate(() => (window as unknown as { __oracleSignals: { action: string; aborted: boolean }[] }).__oracleSignals.some(signal => signal.aborted))).toBe(true);
          release();
          await noReadyAnnouncement(page);
          await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
          expect(oracle.calls.filter(c => c.body.action === action)).toHaveLength(1);
        } finally { release(); }
      });

      test(`Reader ${operation} success: confirmed content survives completion`, async ({ page, oracle }) => {
        const story = await openReader(page, oracle), original = oracle.handlers.get('/api/stories')!;
        oracle.handlers.set('/api/stories', async (route, body, url) => {
          if (body.action === action) {
            if (operation === 'edit') {
              story.chapterContents['1'] = 'Confirmed revised first chapter.';
              await oracle.respond(route, { story });
            } else {
              story.chapters.push({ number: 3, title: 'Third', status: 'pending', readStatus: 'unread', wordCount: 0 });
              await oracle.respond(route, story);
            }
            return;
          }
          if (body.action === 'generate-chapter') {
            Object.assign(story.chapters[2], { status: 'complete', wordCount: 100 });
            story.chapterContents['3'] = 'Confirmed continuation chapter.';
            await oracle.respond(route, { story }); return;
          }
          await original(route, body, url);
        });
        if (operation === 'edit') await beginEdit(page); else await beginContinue(page);
        await expect.poll(() => oracle.calls.some(c => c.body.action === action)).toBe(true);
        if (operation === 'continue') {
          const write = page.getByRole('button', { name: 'Write chapter 3', exact: true });
          // A confirmed completion may retain its bounded exit overlay.
          await expect.poll(async () => (await bounds(write)).hit).toBe(true);
          await activate(page, write);
          await expect.poll(() => oracle.calls.some(c => c.body.action === 'generate-chapter')).toBe(true);
          const dot = page.getByRole('group', { name: 'Chapters' }).first().getByRole('button', { name: 'Chapter 3: Third (complete)' });
          await expect.poll(async () => (await bounds(dot)).hit).toBe(true);
          await activate(page, dot);
        }
        const content = operation === 'edit' ? 'Confirmed revised first chapter.' : 'Confirmed continuation chapter.';
        await expect(page.getByText(content, { exact: true })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.reload();
        if (operation === 'continue') await activate(page, page.getByRole('group', { name: 'Chapters' }).first().getByRole('button', { name: 'Chapter 3: Third (complete)' }));
        await expect(page.getByText(content, { exact: true })).toBeVisible();
      });
    }

    test('Reader generation plus edit overlap: Stop owns both actual abort signals', async ({ page, oracle }, info) => {
      await observeStorySignals(page);
      await observeAnnouncements(page);
      const story = await openReader(page, oracle, true), original = oracle.handlers.get('/api/stories')!;
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      oracle.handlers.set('/api/stories', async (route, body, url) => {
        if (body.action === 'generate-chapter' || body.action === 'edit-chapter') { await held; await oracle.respond(route, { story }).catch(() => {}); return; }
        await original(route, body, url);
      });
      try {
        await activate(page, page.getByRole('button', { name: 'Write chapter 3', exact: true }));
        await expect.poll(() => oracle.calls.some(c => c.body.action === 'generate-chapter')).toBe(true);
        await beginEdit(page); await expect.poll(() => oracle.calls.some(c => c.body.action === 'edit-chapter')).toBe(true);
        await capture(page, info, 'overlapping-reader-operations');
        const stop = page.getByRole('button', { name: /^Stop/ }); await reachable(stop);
        await keyboardFocus(page, stop, info); await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => (window as unknown as { __oracleSignals: { aborted: boolean }[] }).__oracleSignals.filter(signal => signal.aborted).length)).toBe(2);
        release(); await noReadyAnnouncement(page);
      } finally { release(); }
    });

    for (const operation of ['generate-chapter', 'retry-chapter']) {
      test(`Reader ordinary ${operation}: physical Stop aborts without a later write or success`, async ({ page, oracle }, info) => {
        await observeStorySignals(page); await observeAnnouncements(page);
        const story = reader(oracle, true), original = oracle.handlers.get('/api/stories')!;
        if (operation === 'retry-chapter') Object.assign(story.chapters[2], { status: 'failed', error: 'Previous controlled failure' });
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        oracle.handlers.set('/api/stories', async (route, body, url) => {
          if (body.action === operation) { await held; await oracle.respond(route, { story }).catch(() => {}); return; }
          await original(route, body, url);
        });
        try {
          await page.goto(`/recroom/story-weaver/${story.id}`);
          const start = page.getByRole('button', { name: operation === 'generate-chapter' ? 'Write chapter 3' : /^Retry/ });
          await activate(page, start); await expect.poll(() => oracle.calls.some(c => c.body.action === operation)).toBe(true);
          const stop = page.getByRole('button', { name: /^Stop/ }); await reachable(stop); await keyboardFocus(page, stop, info);
          await page.keyboard.press('Enter');
          await expect.poll(() => page.evaluate(() => (window as unknown as { __oracleSignals: { aborted: boolean }[] }).__oracleSignals.some(signal => signal.aborted))).toBe(true);
          release(); await noReadyAnnouncement(page);
          expect(oracle.calls.filter(c => c.body.action === operation)).toHaveLength(1);
          await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
        } finally { release(); }
      });
    }

    test('Composer inspector: labelled dropdown, keyboard switches and focus remain usable', async ({ page }, info) => {
      await page.goto('/work/composer'); await activate(page, page.getByRole('button', { name: 'Build', exact: true }));
      const node = page.locator('.react-flow__node').first(); await wheelTo(page, node); await activate(page, node);
      const kind = page.getByRole('button', { name: 'Kind', exact: true });
      await keyboardFocus(page, kind, info); await page.keyboard.press('Enter');
      await expect(page.getByRole('listbox')).toBeVisible(); await page.keyboard.press('Escape'); await expect(kind).toBeFocused();
      for (const name of ['HIL gate', 'Start', 'End']) {
        const toggle = page.getByRole('switch', { name, exact: true });
        await expect(toggle).toHaveAccessibleName(name);
        await keyboardFocus(page, toggle, info);
        const checked = await toggle.getAttribute('aria-checked'); await page.keyboard.press('Space');
        await expect(toggle).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true');
      }
    });
  });
}

// T0191-toggle-geometry-oracle: Laplace-authorised additive amendment.
// Source exposure: subsequent component review preceded this amendment; this
// is not clean-context evidence. Geometry expectations follow the pixel-review
// contract. The original 56 cases above are preserved byte for byte.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0191 Composer toggle geometry ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width === 390, extraHTTPHeaders: {} });

    test('switch thumbs stay inside their tracks, off left and on right', async ({ page }, info) => {
      await page.goto('/work/composer');
      await activate(page, page.getByRole('button', { name: 'Build', exact: true }));
      const node = page.locator('.react-flow__node').first();
      await wheelTo(page, node); await activate(page, node);
      const tolerance = 1; // CSS px: subpixel layout/rounding only.
      for (const name of ['HIL gate', 'Start', 'End']) {
        const toggle = page.getByRole('switch', { name, exact: true });
        await expect(toggle).toHaveAccessibleName(name);
        await keyboardFocus(page, toggle, info);
        await expect(toggle).toHaveAttribute('aria-checked', /^(true|false)$/);
        for (const checked of [false, true]) {
          if (await toggle.getAttribute('aria-checked') !== String(checked)) await activate(page, toggle);
          await expect(toggle).toHaveAttribute('aria-checked', String(checked));
          // Finish finite visual transitions before measuring the rendered state.
          await toggle.evaluate(async element => {
            await Promise.all(element.getAnimations({ subtree: true }).filter(animation =>
              animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished));
          });
          await keyboardFocus(page, toggle, info);
          const track = toggle.locator(':scope > span');
          await expect(track, 'one visual track inside the switch hit area').toHaveCount(1);
          const thumb = track.locator(':scope > span');
          await expect(thumb, 'one visible thumb inside the switch track').toHaveCount(1);
          await expect(thumb).toBeVisible();
          const geometry = await toggle.evaluate(element => {
            const rect = (target: Element) => {
              const r = target.getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, centreX: r.left + r.width / 2 };
            };
            return { checked: element.getAttribute('aria-checked'), track: rect(element.querySelector(':scope > span')!), thumb: rect(element.querySelector(':scope > span > span')!) };
          });
          const label = `${name}-${checked ? 'on' : 'off'}`;
          await info.attach(`toggle-geometry-${label}`, { body: JSON.stringify({ viewport, tolerance, ...geometry }, null, 2), contentType: 'application/json' });
          await capture(page, info, `toggle-${label}`);
          const message = `${label}: ${JSON.stringify(geometry)}`;
          expect.soft(geometry.thumb.width, message).toBeGreaterThan(0);
          expect.soft(geometry.thumb.height, message).toBeGreaterThan(0);
          expect.soft(geometry.thumb.left, message).toBeGreaterThanOrEqual(geometry.track.left - tolerance);
          expect.soft(geometry.thumb.right, message).toBeLessThanOrEqual(geometry.track.right + tolerance);
          expect.soft(geometry.thumb.top, message).toBeGreaterThanOrEqual(geometry.track.top - tolerance);
          expect.soft(geometry.thumb.bottom, message).toBeLessThanOrEqual(geometry.track.bottom + tolerance);
          if (checked) expect.soft(geometry.thumb.centreX, message).toBeGreaterThan(geometry.track.centreX + tolerance);
          else expect.soft(geometry.thumb.centreX, message).toBeLessThan(geometry.track.centreX - tolerance);
        }
      }
    });
  });
}