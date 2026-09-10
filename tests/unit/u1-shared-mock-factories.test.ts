/**
 * U1 (T-0115): the mock stanzas that are genuinely identical, behind one
 * factory each.
 *
 * The reconnaissance reported that 37% of tests/unit sits before the first
 * `describe` and read that as copy-pasted preamble. The 37% is real and the
 * reading is not: measured, those 39,435 lines are jest.mock 7,402 + imports
 * 1,905 + comments 14,873 + per-file fixtures 15,255, and the comments are the
 * half worth keeping. The mocks are not interchangeable either. `@/lib/db` has
 * 42 distinct shapes across 99 calls; `@/lib/api/api-fetch` has 31 across 48. A
 * mock with a per-file factory is testing something different, and hoisting it
 * would be a behaviour change wearing a refactor's clothes.
 *
 * What IS identical, byte for byte, is a much smaller set, and this is it. The
 * factories below are the only shapes with enough sites to be worth a name.
 *
 * Nothing goes into jest.setup.ts or moduleNameMapper. A mock declared there
 * applies to all 614 files, including the ones that deliberately exercise the
 * real module, and no test would fail to tell you. Each site keeps its own
 * `jest.mock(...)` and calls the factory through `require`, which is the form
 * jest documents for a hoisted factory: opt-in, per file, one line.
 *
 * Two kinds of claim here. The first is that each factory behaves the way the
 * stanza it replaces behaved, asserted against the shape rather than against
 * the code. The second is the seam: once a factory exists, the inline copy must
 * not. That one is the ratchet, and it is what was red on write.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { dbSingletonMock } from "../helpers/baseline-db";
import {
  agentRuntimeMock,
  appPageShellMock,
  lucideMock,
  nextLinkMock,
  nextServerMock,
  pathsMock,
} from "../helpers/mocks";

const UNIT = join(__dirname);

/**
 * Every unit test's source, keyed by filename, EXCEPT this file.
 *
 * This one quotes each stanza verbatim, because a seam assertion has to name
 * the thing it refuses. Without the exclusion it finds its own string literals
 * and reports itself as the last offender, which is exactly how it failed the
 * first time it ran against a migrated tree.
 */
const SELF = "u1-shared-mock-factories.test.ts";

function corpus(): Array<[string, string]> {
  return readdirSync(UNIT)
    .filter((f) => f !== SELF && (f.endsWith(".test.ts") || f.endsWith(".test.tsx")))
    .map((f) => [f, readFileSync(join(UNIT, f), "utf-8").replace(/\r\n/g, "\n")]);
}

/**
 * The stanzas this batch replaces, verbatim. A near-miss is deliberately NOT
 * matched: it is a different test, and rewriting it would be a guess.
 */
const REPLACED: ReadonlyArray<{ name: string; text: string }> = [
  {
    name: "the db singleton over an in-memory database",
    text: `jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});`,
  },
  {
    name: "every lucide icon as a named svg",
    text: `jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
})`,
  },
  {
    name: "the page shell as a plain div",
    text: `jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))`,
  },
];

describe("the factories behave the way the stanzas they replace behaved", () => {
  it("lucide gives every icon name a component that renders a named svg", () => {
    const mod = lucideMock() as Record<string, (p: Record<string, unknown>) => unknown>;
    // A Proxy, so ANY name resolves: the point of the stanza is that a test
    // never has to list the icons the component under test happens to import.
    for (const name of ["Rocket", "Zap", "SomethingNobodyHasWrittenYet"]) {
      const Icon = mod[name];
      expect(typeof Icon).toBe("function");
      const el = Icon({}) as { type: string; props: Record<string, unknown> };
      expect(el.type).toBe("svg");
      expect(el.props["data-icon"]).toBe(name);
      expect(el.props["aria-hidden"]).toBe("true");
    }
  });

  it("lucide passes the caller's props through, so a className assertion still works", () => {
    const mod = lucideMock() as Record<string, (p: Record<string, unknown>) => unknown>;
    const el = mod.Rocket({ className: "w-4 h-4" }) as { props: Record<string, unknown> };
    expect(el.props.className).toBe("w-4 h-4");
  });

  it("the page shell renders its header and its children, and nothing else", () => {
    const mod = appPageShellMock();
    expect(mod.__esModule).toBe(true);
    const el = mod.default({ children: "inside", header: "titled" }) as {
      type: string;
      props: { children: unknown };
    };
    expect(el.type).toBe("div");
    // Both, in that order. The header is a PROP rather than a child since
    // T-0117, and a mock that forwarded only children would silently erase
    // every page's title, subtitle and header actions - leaving the six suites
    // that assert on them passing against nothing.
    expect(el.props.children).toEqual(["titled", "inside"]);
  });

  it("and forwards no header for a page that hands it none", () => {
    const el = appPageShellMock().default({ children: "inside" }) as {
      props: { children: unknown };
    };
    expect(el.props.children).toEqual([undefined, "inside"]);
  });

  it("next/link renders a real anchor carrying href and the rest of its props", () => {
    const mod = nextLinkMock();
    expect(mod.__esModule).toBe(true);
    const el = mod.default({ href: "/work/missions", children: "Missions", "data-x": "1" }) as {
      type: string;
      props: Record<string, unknown>;
    };
    expect(el.type).toBe("a");
    expect(el.props.href).toBe("/work/missions");
    expect(el.props.children).toBe("Missions");
    expect(el.props["data-x"]).toBe("1");
  });

  it("next/server's NextResponse carries a status and an awaitable body", async () => {
    const { NextResponse } = nextServerMock();
    const res = NextResponse.json({ ok: true }, { status: 201 });
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("and defaults to 200 when the caller gives no init, as the stanza did", async () => {
    const { NextResponse } = nextServerMock();
    const res = NextResponse.json({ ok: false });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: false });
  });

  it("paths names every directory the stanza named, under the same root", () => {
    const mod = pathsMock();
    expect(mod.PS_DATA_DIR).toBe("/tmp/ch-data");
    expect(mod.PATHS).toEqual({
      missions: "/tmp/ch-data/missions",
      patterStageDb: "/tmp/ch-data/control-hub.db",
      templates: "/tmp/ch-data/templates",
      stories: "/tmp/ch-data/stories",
      recroom: "/tmp/ch-data/recroom",
      workspaces: "/tmp/ch-data/workspaces",
      auditLog: "/tmp/ch-data/audit",
      psScripts: "/tmp/ch-data/scripts",
      psHardwareLogs: "/tmp/ch-data/logs",
    });
    expect(mod.getPsScriptsDir()).toBe("/tmp/ch-data/scripts");
    expect(mod.getPsHardwareLogDir()).toBe("/tmp/ch-data/logs");
  });

  it("the agent runtime answers with the thirteen paths and the two endpoints", () => {
    const mod = agentRuntimeMock();
    expect(mod.getActiveHermesHome()).toBe("/tmp/test-hermes");
    const paths = mod.getActiveHermesPaths();
    expect(Object.keys(paths).sort()).toEqual(
      [
        "agents", "backups", "config", "cronJobs", "env", "hermes", "logs",
        "memoryDb", "profiles", "root", "sessions", "skills", "soul",
      ].sort(),
    );
    expect(paths.root).toBe("/tmp/test-hermes");
    expect(paths.config).toBe("/tmp/test-hermes/config.yaml");
    expect(mod.getAgentLlmEndpoints()).toEqual({
      apiUrl: "http://127.0.0.1:9/v1/chat/completions",
      gatewayBase: "http://127.0.0.1:9",
    });
  });

  /**
   * The half a shape assertion cannot make. Several call sites do
   * `jest.mocked(getActiveHermesPaths).mockReturnValueOnce(...)`, which only
   * works if the members are jest mocks rather than plain functions.
   */
  it("and its members are jest mocks, because call sites override them per test", () => {
    const mod = agentRuntimeMock();
    expect(jest.isMockFunction(mod.getActiveHermesPaths)).toBe(true);
    expect(jest.isMockFunction(mod.getActiveHermesHome)).toBe(true);
    expect(jest.isMockFunction(mod.getAgentLlmEndpoints)).toBe(true);
  });

  /**
   * Each call must build a FRESH object. A factory that returned one shared
   * instance would leak a `mockReturnValueOnce` from one test file into the
   * next, and jest gives each file its own module registry precisely so that
   * cannot happen.
   */
  it("hands every caller its own instance, so one file cannot poison another", () => {
    const a = agentRuntimeMock();
    const b = agentRuntimeMock();
    expect(a.getActiveHermesPaths).not.toBe(b.getActiveHermesPaths);
    expect(pathsMock().PATHS).not.toBe(pathsMock().PATHS);
  });
});

describe("and the inline copies are gone", () => {
  it("has a corpus to check, so none of this passes vacuously", () => {
    expect(corpus().length).toBeGreaterThan(500);
  });

  it.each(REPLACED.map((r) => [r.name, r.text]))(
    "no test file still spells out %s",
    (_name, text) => {
      const offenders = corpus()
        .filter(([, source]) => source.includes(text))
        .map(([file]) => file);
      expect(offenders).toEqual([]);
    },
  );

  /**
   * The counterweight. "No file contains it" is also true of a stanza nobody
   * ever wrote, so assert that the replacement is actually in use: if a later
   * change quietly reverts a site to its own copy, the test above catches it,
   * and if someone deletes the factory instead, this one does.
   */
  it("and the factories they were replaced by are called instead", () => {
    const sources = corpus().map(([, s]) => s);
    const callers = (fn: string) => sources.filter((s) => s.includes(`helpers/mocks").${fn}`)).length;
    expect(callers("lucideMock")).toBeGreaterThanOrEqual(20);
    expect(callers("appPageShellMock")).toBeGreaterThanOrEqual(10);
    expect(callers("nextLinkMock")).toBeGreaterThanOrEqual(8);
    const dbCallers = sources.filter((s) => s.includes("dbSingletonMock")).length;
    expect(dbCallers).toBeGreaterThanOrEqual(35);
  });
});

/**
 * Found while migrating, and unrelated to mocks except that it lives in the
 * same three lines of every file.
 *
 * jest reads `@jest-environment` out of the FIRST block comment in a file, and
 * `jest-docblock` treats `/*` and `/**` alike. So a pragma comment written
 * above the docblock hides it, and the suite silently runs in the config's
 * default environment instead of the one it asked for. Measured with a probe
 * file: pragma first gave `typeof window === "object"`, the same file with the
 * two swapped gave `undefined`.
 *
 * Forty-seven files were in that state, all of them asking for `node` and all
 * of them getting jsdom. Nothing was failing, which is the problem: a file that
 * says one thing and does another passes until the day someone writes a test
 * that depends on the difference.
 */
describe("a file that asks for a jest environment gets the one it asked for", () => {
  const FIRST_BLOCK = /^\s*(\/\*\*?(?:.|\r?\n)*?\*\/)/;

  it("has files declaring an environment, so this cannot pass vacuously", () => {
    const declaring = corpus().filter(([, s]) => s.includes("@jest-environment"));
    expect(declaring.length).toBeGreaterThan(30);
  });

  it("puts the pragma in the first block comment, where jest looks for it", () => {
    const hidden = corpus()
      .filter(([, source]) => source.includes("@jest-environment"))
      .filter(([, source]) => {
        const first = FIRST_BLOCK.exec(source);
        return !first || !first[1].includes("@jest-environment");
      })
      .map(([file]) => file);
    expect(hidden).toEqual([]);
  });
});

/**
 * The db singleton's own contract, which the sweep found unasserted.
 *
 * Thirty-nine suites drive real repository code against a real in-memory
 * SQLite through this factory, and `inTransaction` is the one member whose
 * behaviour is not obvious from its shape: written as `(fn) => fn()` it looks
 * right, passes every existing test, and silently stops rolling anything back.
 * A repository test that asserts "a failed write leaves nothing behind" would
 * then pass for the wrong reason.
 */
describe("the db singleton wraps a transaction body in a real transaction", () => {
  const openDb = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform
    const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
    const db = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
      ":memory:",
    );
    db.exec("CREATE TABLE t (id TEXT PRIMARY KEY)");
    return db;
  };

  it("commits a body that returns", () => {
    const db = openDb();
    const mod = dbSingletonMock(() => db);
    const out = mod.inTransaction(() => {
      db.prepare("INSERT INTO t (id) VALUES (?)").run("a");
      return "done";
    });
    expect(out).toBe("done");
    expect(db.prepare("SELECT COUNT(*) AS n FROM t").get()).toEqual({ n: 1 });
    db.close();
  });

  it("rolls back everything a body wrote before it threw", () => {
    const db = openDb();
    const mod = dbSingletonMock(() => db);
    expect(() =>
      mod.inTransaction(() => {
        db.prepare("INSERT INTO t (id) VALUES (?)").run("a");
        db.prepare("INSERT INTO t (id) VALUES (?)").run("b");
        throw new Error("half way");
      }),
    ).toThrow("half way");
    // Without a real transaction both rows would still be here.
    expect(db.prepare("SELECT COUNT(*) AS n FROM t").get()).toEqual({ n: 0 });
    db.close();
  });

  it("reads the database through the getter, so beforeEach can replace it", () => {
    let db = openDb();
    const mod = dbSingletonMock(() => db);
    expect(mod.getDb()).toBe(db);
    const first = db;
    db = openDb();
    expect(mod.getDb()).toBe(db);
    expect(mod.getDb()).not.toBe(first);
    first.close();
    db.close();
  });

  it("mints a different id every time, because they are primary keys", () => {
    const db = openDb();
    const mod = dbSingletonMock(() => db);
    const ids = new Set([mod.uuid(), mod.uuid(), mod.uuid()]);
    expect(ids.size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    db.close();
  });
});
