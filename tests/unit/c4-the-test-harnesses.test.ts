/**
 * C4 · The test harnesses.
 *
 * The census counted 6,044 lines of tests/unit inside a six-line window that
 * appears in another suite, and a hundred suites mocking `@/lib/db` by hand.
 * The recon (org/reviews/2026-09-consolidation-recon.md §6) named the
 * stanzas: the db double in its stub and its in-memory forms, the paths
 * block, the next/server request and response, the page suites' fetch map,
 * the matchMedia listener surface, the story suites' fixtures and parked
 * fetch, and the fixtures the biggest suites each built (the stats ledger's
 * zero row, the composer's form, the missions board's view model, the
 * ProfilePicker select, the fake Hermes root). One factory each, in
 * tests/helpers, opt-in per file the way U1 (T-0115) left it: a suite that
 * mocks differently keeps its own mock, because it is testing something
 * different.
 *
 * The oracle is identity: every factory behaves the way the stanza it
 * replaces behaved, the corpus carries none of the stanzas, and the census
 * reads the fall. The it() count is read at the gate.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { dbMock, matchMediaMock, nextServerMock, pathsMock, profilePickerMock, agentRuntimeFakeRootMock } from "../helpers/mocks";
import { dbSingletonMock } from "../helpers/baseline-db";
import { fetchMap, jsonResponse } from "../helpers/fetch-map";
import { story, halfWritten, oneFailedTwoPending, markComplete, writeNextChapter, park, bodies, callsFor, storyRepositoryMock, type Parked } from "../helpers/story";
import { rawMetrics, composerFormState, missionsViewModel } from "../helpers/fixtures";

const ROOT = join(__dirname, "..", "..");
const UNIT = join(__dirname);
const SELF = "c4-the-test-harnesses.test.ts";
// The U1 oracle quotes the stanzas it refuses, as this one does; neither is corpus.
const ORACLES = new Set([SELF, "u1-shared-mock-factories.test.ts"]);

function corpus(): Array<[string, string]> {
  return readdirSync(UNIT)
    .filter((f) => !ORACLES.has(f) && (f.endsWith(".test.ts") || f.endsWith(".test.tsx")))
    .map((f) => [f, readFileSync(join(UNIT, f), "utf-8").replace(/\r\n/g, "\n")]);
}

describe("the factories behave the way the stanzas they replace behaved", () => {
  it("the db stub answers every call the routes make, with fixed words unless the suite gives its own", () => {
    const m = dbMock();
    expect(typeof m.ensureDb).toBe("function");
    expect(m.getDb()).toBeUndefined();
    expect(m.now()).toBe("2026-01-01T00:00:00.000Z");
    expect(m.uuid()).toBe("test-uuid");
    expect(m.inTransaction(() => 7)).toBe(7);
    const own = dbMock({ now: () => "t", uuid: () => "u", getDb: () => ({ prepare: () => null }) });
    expect(own.now()).toBe("t");
    expect(own.uuid()).toBe("u");
    expect((own.getDb() as { prepare: unknown }).prepare).toBeDefined();
  });

  it("the in-memory db double takes the suite's own uuid and now, and keeps the real ones otherwise", () => {
    const fake = { transaction: (fn: () => number) => () => fn() + 1 } as unknown as import("better-sqlite3").Database;
    const own = dbSingletonMock(() => fake, { uuid: () => "b6-uuid", now: () => "2026-08-31T12:00:00Z" });
    expect(own.getDb()).toBe(fake);
    expect(own.uuid()).toBe("b6-uuid");
    expect(own.now()).toBe("2026-08-31T12:00:00Z");
    expect(own.inTransaction(() => 1)).toBe(2);
    const real = dbSingletonMock(() => fake);
    expect(real.uuid()).toMatch(/^[0-9a-f-]{36}$/);
    expect(real.now()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("matchMedia answers with the listener surface jsdom lacks, and a query rule when given one", () => {
    matchMediaMock();
    const r = window.matchMedia("(max-width: 1023px)");
    expect(r.matches).toBe(false);
    expect(typeof r.addEventListener).toBe("function");
    expect(typeof r.addListener).toBe("function");
    matchMediaMock((q) => /max-width/.test(q));
    expect(window.matchMedia("(max-width: 1023px)").matches).toBe(true);
    expect(window.matchMedia("(min-width: 1024px)").matches).toBe(false);
  });

  it("next/server's request parses the body it was given and carries nextUrl; the response carries status, ok and the data", async () => {
    const { NextRequest, NextResponse } = nextServerMock();
    const req = new NextRequest("http://localhost/api/x?a=1", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(req.method).toBe("POST");
    expect(req.nextUrl.searchParams.get("a")).toBe("1");
    expect(await req.json()).toEqual({ a: 1 });
    const bare = new NextRequest("http://localhost/api/x");
    expect(bare.method).toBe("GET");
    expect(await bare.json()).toEqual({});
    const res = NextResponse.json({ ok: 1 }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ ok: 1 });
    expect(res.body).toEqual({ ok: 1 });
    const bad = NextResponse.json({ error: "no" }, { status: 400 });
    expect(bad.ok).toBe(false);
    expect(bad.statusText).toBe("Bad Request");
    expect(NextResponse.json({}) instanceof NextResponse).toBe(true);
  });

  it("the paths block takes a suite's own template dir and its own readEnv", () => {
    const base = pathsMock();
    expect(base.PATHS.templates).toBe("/tmp/ch-data/templates");
    const own = pathsMock({ PATHS: { templates: "/tmp/test-templates" }, readEnv: () => "yes" });
    expect(own.PATHS.templates).toBe("/tmp/test-templates");
    expect(own.PATHS.stories).toBe("/tmp/ch-data/stories");
    expect((own as unknown as { readEnv: () => string }).readEnv()).toBe("yes");
  });

  it("the fetch map answers exact, then the longest prefix, and throws for what the suite did not stub", async () => {
    const original = global.fetch;
    try {
      const mock = fetchMap({ "/api/models": { body: { data: { models: [] } } }, "/api/models/defaults": { body: { data: { defaults: {} } }, status: 200 } });
      expect(await (await fetch("/api/models/defaults")).json()).toEqual({ data: { defaults: {} } });
      expect(await (await fetch("/api/models?limit=1")).json()).toEqual({ data: { models: [] } });
      await expect(fetch("/api/nothing")).rejects.toThrow(/Unmatched fetch/);
      expect(mock).toHaveBeenCalledTimes(3);
      const fallen = fetchMap({}, { fallback: (url) => (url.includes("/drift") ? { body: { data: null } } : undefined) });
      expect(await (await fetch("/api/models/sync/drift")).json()).toEqual({ data: null });
      expect(fallen).toHaveBeenCalledTimes(1);
      expect(jsonResponse({ a: 1 }, 500).ok).toBe(false);
    } finally {
      global.fetch = original;
    }
  });

  it("the story fixtures write their chapters' text, mark the next pending one, and park a fetch until told", async () => {
    const s = halfWritten();
    expect(Object.keys(s.chapterContents)).toEqual(["1", "2"]);
    expect(oneFailedTwoPending().chapters[1].status).toBe("failed");
    const written = writeNextChapter(s);
    expect(written.chapters[2].status).toBe("complete");
    expect(written.chapterContents["3"]).toBe("Text of chapter 3.");
    expect(written).not.toBe(s);
    expect(markComplete(story([]), 9)).toEqual(story([]));
    const parked: Parked[] = [];
    const controller = new AbortController();
    const p = park(parked, "generate-chapter", { signal: controller.signal });
    expect(parked).toHaveLength(1);
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    const fetchMock = jest.fn();
    fetchMock.mock.calls.push(["/api/stories", { body: JSON.stringify({ action: "load" }) }], ["/api/stories", { body: JSON.stringify({ action: "update", x: 1 }) }]);
    expect(bodies(fetchMock)).toHaveLength(2);
    expect(callsFor(fetchMock, "update")).toEqual([{ action: "update", x: 1 }]);
    const repo = storyRepositoryMock();
    expect(repo.__getStory).toBe(repo.getStory);
    expect(repo.STORY_DATA_DIR).toBe("/tmp/test-hermes/stories");
  });

  it("the fixtures take overrides and keep everything else at rest", () => {
    expect(rawMetrics().completedMissions).toBe(0);
    expect(rawMetrics({ stories: 3 }).stories).toBe(3);
    expect(composerFormState().newDispatch).toBe("save");
    expect(composerFormState({ newName: "" }).newName).toBe("");
    const vm = missionsViewModel([], { filter: "draft" });
    expect(vm.filter).toBe("draft");
    expect(vm.missions).toEqual([]);
    expect(jest.isMockFunction(vm.handleDelete)).toBe(true);
    expect(profilePickerMock().__esModule).toBe(true);
    (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = "/tmp/fake-root";
    const paths = agentRuntimeFakeRootMock().getActiveHermesPaths();
    expect(paths.root).toBe("/tmp/fake-root");
    expect(paths.config.replace(/\\/g, "/")).toBe("/tmp/fake-root/config.yaml");
    expect(agentRuntimeFakeRootMock().getActiveHermesHome()).toBe("/tmp/fake-root");
  });
});

/**
 * The stanzas, spelled the way they were pasted; a suite that still carries
 * one is named, unless it is listed under `keeps` with the reason its own
 * mock is not the stanza (a class that records its calls is testing the
 * recording, and stays).
 */
const REPLACED: ReadonlyArray<{ name: string; test: (text: string) => boolean; keeps?: Record<string, string> }> = [
  { name: "the db stub as a bare object", test: (t) => /jest\.mock\("@\/lib\/db", \(\) => \(\{ ensureDb: jest\.fn\(\) \}\)\)/.test(t) },
  { name: "the db stub with now t and uuid u", test: (t) => /jest\.mock\("@\/lib\/db", \(\) => \(\{[^}]*now: \(\) => "t", uuid: \(\) => "u"/.test(t) },
  { name: "the in-memory db double by hand", test: (t) => /jest\.mock\("@\/lib\/db", \(\) => \(\{[^}]*getDb: \(\) => testDb!/.test(t) },
  {
    name: "the next/server request by hand",
    test: (t) => /private _body: string;/.test(t),
    keeps: {
      "mission-categories-route.test.ts": "its NextResponse records every response into __responses and its db mock routes ensureDb through a local the tests arm",
      "mission-require-or-not-found.test.ts": "its NextResponse records every response into __responses, which the tests read",
      "missions-delete-null-check.test.ts": "the same recorder",
    },
  },
  { name: "the fetch map by hand", test: (t) => /^function jsonResponse\(/m.test(t) && /global\.fetch = jest\.fn\(async \(input: RequestInfo \| URL\)/.test(t) },
  { name: "matchMedia by hand", test: (t) => /window\.matchMedia = jest\.fn\(\(query: string\) => \(\{/.test(t) },
  { name: "next/link by hand", test: (t) => /jest\.mock\("next\/link", \(\) => \(\{\n\s*__esModule: true,\n\s*default: \(\{ href, children, \.\.\.rest \}/.test(t) },
  { name: "the story fixture by hand", test: (t) => /^function story\(chapters/m.test(t) },
  { name: "the paths block by hand", test: (t) => /stories: "\/tmp\/ch-data\/stories",\n\s*recroom: "\/tmp\/ch-data\/recroom",/.test(t) },
  { name: "the stats ledger's zero row by hand", test: (t) => /completedMissions: 0,\n\s*failedMissions: 0,\n\s*completedRuns: 0,/.test(t) },
  { name: "the composer's form by hand", test: (t) => /const baseFormState: MissionFormState = \{/.test(t) },
  { name: "the missions board's view model by hand", test: (t) => /setFilter: jest\.fn\(\),\n\s*search: "",\n\s*setSearch: jest\.fn\(\),/.test(t) },
  { name: "the ProfilePicker select by hand", test: (t) => /<option value="qa">QA Engineer<\/option>/.test(t) },
  { name: "the fake Hermes root by hand", test: (t) => /getActiveHermesPaths: \(\) => \{\n\s*const root = \(global as/.test(t) },
];

describe("the corpus carries none of the stanzas", () => {
  for (const stanza of REPLACED) {
    it(`${stanza.name}: no suite spells it`, () => {
      const offenders = corpus()
        .filter(([f, text]) => stanza.test(text) && !(stanza.keeps && f in stanza.keeps))
        .map(([f]) => f);
      expect(offenders).toEqual([]);
      // A keep that no longer spells the stanza has been converted; the reason is stale.
      for (const f of Object.keys(stanza.keeps ?? {})) {
        expect({ f, stillSpellsIt: stanza.test(readFileSync(join(UNIT, f), "utf-8")) }).toEqual({ f, stillSpellsIt: true });
      }
    });
  }
});

describe("the census reads the fall", () => {
  it("suites mocking the db inline and lines inside a repeated window", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const report = JSON.parse(out) as { counts: { suitesMockingDbInline: number; testRepeatedWindowLines: number } };
    expect(report.counts.suitesMockingDbInline).toBeLessThanOrEqual(40);
    expect(report.counts.testRepeatedWindowLines).toBeLessThanOrEqual(4800);
  });
});
