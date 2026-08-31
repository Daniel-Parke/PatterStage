/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

// T-0082 acceptance oracle — QA finding 7: a toolset PUT reports ENOENT and the
// change persists anyway.
//
// THE ROOT CAUSE, and it is one missing line. `pushProfileToHermes` calls
// `ensureProfileDirs(root)` before it writes. `pushRootToHermes` does not — the
// import is right there in the same file, three lines above the function that
// uses it. On a Hermes home without a `memories/` directory, write #5 of 7
// (`memories/USER.md`) ENOENTs after four files have already landed, so the
// push half-succeeds and reports a crash.
//
// WHY NO TEST CAUGHT IT. The existing suite mocks `pushRootToHermes` wholesale.
// A push that never touches a filesystem cannot notice a missing directory.
// This file drives the real function against a real, deliberately-bare
// directory, which is the only shape of test that could ever have failed.
//
// AND THE HONESTY HALF. Four smaller defects around the same failure:
//
//   * the error names the `.tmp-<pid>-<ts>` staging path, a file that does not
//     exist and never will, instead of the file the operator was trying to
//     write;
//   * the 500 says "failed" about a change that IS saved, so an operator who
//     reloads sees their edit and cannot tell whether it took;
//   * the drift banner headlines "Profile drift" when nothing has drifted and
//     the only problem is a sync ERROR;
//   * and `POST /api/agent/profiles/sync/push` answers 200 {success:false} for
//     the same failure the toolsets route answers 500 for -- while putting the
//     reason at `data.result.error`, where runSyncAction does not look, so the
//     operator gets a generic "Push failed" and never sees the ENOENT at all.

import { mkdtempSync, existsSync, rmSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const hermesHome = mkdtempSync(join(tmpdir(), "ps-push-oracle-"));

// Only the HOME is faked. The path bundle is built by the real function, so
// every path this push touches is the one production would build -- the point
// of the file is that a directory is missing, and a hand-written bundle could
// have quietly disagreed about where that directory is.
//
// BOTH modules are mocked, and the reason is written here because getting it
// wrong is expensive. `profile-push` imports getHermesDefaultRoot from
// `profile-paths`, NOT from `agent-runtime`. Mocking only the latter leaves the
// real resolver in place, and the real resolver answers with the operator's
// actual Hermes home — so a test that believes it is writing to a temp
// directory writes SOUL.md, AGENTS.md and the memories over the top of somebody
// real. That happened while this file was being written. See the fuse below.
jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => hermesHome,
  resolveProfileHermesHome: (slug: string) => join(hermesHome, "profiles", slug),
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  return {
    getHermesDefaultRoot: () => hermesHome,
    getActiveHermesPaths: () => buildHermesPathBundle(hermesHome),
    getActiveHermesHome: () => hermesHome,
  };
});

const rootRow = {
  displayName: "Bob",
  description: "",
  personality: "technical",
  configYaml: "",
  soulMd: "# Soul\n",
  agentsMd: "# Agents\n",
  frameworkMd: "",
  userMd: "# User\n",
  memoryMd: "# Memory\n",
  disabledSkillsJson: "[]",
  platformToolsetsJson: "{}",
  syncedAt: null,
  syncError: null,
};

const mockSetAgentRootSyncStatus = jest.fn();
jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: () => rootRow,
  setAgentRootSyncStatus: (...a: unknown[]) => mockSetAgentRootSyncStatus(...a),
  updateAgentRoot: jest.fn(),
}));

// A REAL in-memory database rather than a stub. finalizeRootConfigOnDisk reads
// the model defaults on its way through, and mocking that away would have cut
// out part of the very path this file exists to exercise.
let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => ({
  now: () => "2026-08-31T12:00:00Z",
  getDb: () => testDb!,
  ensureDb: () => undefined,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  uuid: () => "test-uuid",
}));

import { execBaselineSchema } from "../helpers/baseline-db";
import { pushRootToHermes } from "@/modules/hermes/lib/profile-push";
import {
  describeWriteFailure,
  targetPathFromWriteError,
} from "@/modules/hermes/lib/hermes-config-write";
import { driftBannerHeadline } from "@/components/profiles/drift-banner-headline";

function freshHome(): void {
  rmSync(hermesHome, { recursive: true, force: true });
  mkdirSync(hermesHome, { recursive: true });
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  execBaselineSchema(testDb);
  jest.clearAllMocks();
  freshHome();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

afterAll(() => rmSync(hermesHome, { recursive: true, force: true }));

describe("FUSE: this file writes only where it is allowed to", () => {
  it("resolves the Hermes home inside the OS temp directory", () => {
    // This assertion exists because the alternative already happened once. A
    // missed mock left the real resolver in place, and the push wrote fixture
    // content over the operator's genuine SOUL.md, AGENTS.md, HERMES.md and
    // memories before anybody noticed. writeWithBackup's backups made it
    // recoverable; nothing about the test made it preventable.
    //
    // It runs first and it reads the value the code under test will actually
    // use, so a mock that stops intercepting fails HERE rather than on someone
    // else's disk.
    const { getHermesDefaultRoot } = require("@/modules/hermes/lib/profile-paths") as {
      getHermesDefaultRoot: () => string;
    };

    expect(getHermesDefaultRoot().startsWith(tmpdir())).toBe(true);
  });

  it("agrees with the path bundle the push will build", () => {
    const { getActiveHermesPaths } = require("@/modules/hermes/lib/agent-runtime") as {
      getActiveHermesPaths: () => { root: string };
    };

    // Matched on the mkdtemp prefix rather than on tmpdir(), because the bundle
    // normalises separators and a path comparison across that is a second thing
    // to get wrong. No real Hermes home is called "ps-push-oracle-".
    expect(getActiveHermesPaths().root).toContain("ps-push-oracle-");
  });
});

describe("the root push creates the directories it writes into", () => {
  it("succeeds against a Hermes home that has nothing in it", () => {
    // A fresh install IS this directory. The operator's very first toolset save
    // hit it, which is why the finding reads like a broken product rather than
    // an edge case.
    const result = pushRootToHermes();
    expect(result.error).toBeNull();
    expect(result.success).toBe(true);
  });

  it("actually writes the file that used to ENOENT", () => {
    // memories/USER.md, write #5 of 7. Asserting `success` alone would pass on
    // a push that had quietly stopped writing it.
    pushRootToHermes();

    expect(existsSync(join(hermesHome, "memories", "USER.md"))).toBe(true);
    expect(readFileSync(join(hermesHome, "memories", "USER.md"), "utf-8")).toContain("User");
  });

  it("writes ALL of the files, not just the ones before the old failure", () => {
    // The four that landed before the crash proved nothing about the two after
    // it. This pins the whole set.
    pushRootToHermes();

    for (const rel of ["config.yaml", "SOUL.md", "AGENTS.md", "memories/USER.md", "memories/MEMORY.md"]) {
      expect({ file: rel, exists: existsSync(join(hermesHome, rel)) }).toEqual({
        file: rel,
        exists: true,
      });
    }
  });

  it("records a clean sync, not an error, on the row", () => {
    pushRootToHermes();

    expect(mockSetAgentRootSyncStatus).toHaveBeenCalledWith("2026-08-31T12:00:00Z", null);
  });

  it("is idempotent — a second push over a populated home still succeeds", () => {
    // GREEN CONTROL for the fix: ensureProfileDirs must not object to
    // directories that are already there, which is the normal case.
    pushRootToHermes();
    const second = pushRootToHermes();

    expect(second.success).toBe(true);
  });
});

describe("a write error names the file the operator meant", () => {
  it("strips the atomic-write staging suffix", () => {
    // atomicWriteFile stages at `<target>.tmp-<pid>-<ms>` and rethrows the raw
    // error, so the operator was sent looking for
    // `memories/USER.md.tmp-33048-1788…` — a file that does not exist and never
    // will, in a directory that does not exist either.
    const err = Object.assign(
      new Error("ENOENT: no such file or directory, open '/h/memories/USER.md.tmp-33048-1788185690123'"),
      { code: "ENOENT" },
    );

    expect(targetPathFromWriteError(err)).toBe("/h/memories/USER.md");
  });

  it("leaves an error that names no staging path alone", () => {
    const err = new Error("EACCES: permission denied, open '/h/config.yaml'");

    expect(targetPathFromWriteError(err)).toBe("/h/config.yaml");
  });

  it("only strips the suffix at the END, so a real path keeps its own .tmp-", () => {
    // Mutation found this. An unanchored replace would eat a directory that
    // legitimately contains ".tmp-1-2" in the middle of its name and hand the
    // operator a path that never existed -- the same defect, pointing somewhere
    // new.
    const err = new Error("EACCES: permission denied, open '/h/notes.tmp-1-2/USER.md'");

    expect(targetPathFromWriteError(err)).toBe("/h/notes.tmp-1-2/USER.md");
  });

  it("returns null rather than guessing when there is no path at all", () => {
    expect(targetPathFromWriteError(new Error("disk on fire"))).toBeNull();
    expect(targetPathFromWriteError("not an error")).toBeNull();
  });

  it("handles a Windows path, since that is where this was found", () => {
    const err = new Error(
      "ENOENT: no such file or directory, open 'C:\\h\\memories\\USER.md.tmp-1-2'",
    );

    expect(targetPathFromWriteError(err)).toBe("C:\\h\\memories\\USER.md");
  });
});

describe("a push that REALLY fails reports the file the operator meant", () => {
  // Mutation found the gap, and it is this programme's usual one: the helper
  // was tested and the function that USES it was not. Every push test above
  // asserts a success path, so routing the catch through describeWriteFailure
  // could have been undone -- or inverted -- with nothing to notice.
  //
  // This makes a real push fail on a real filesystem, by putting a DIRECTORY
  // where memories/USER.md belongs. The staged write succeeds and the rename
  // does not, which is exactly the shape that produced the phantom path.
  function blockUserMemory(): void {
    mkdirSync(join(hermesHome, "memories", "USER.md"), { recursive: true });
  }

  it("fails, rather than silently succeeding", () => {
    blockUserMemory();

    expect(pushRootToHermes().success).toBe(false);
  });

  it("names memories/USER.md", () => {
    blockUserMemory();

    expect(pushRootToHermes().error).toContain("USER.md");
  });

  it("does NOT name the staging file that never existed", () => {
    // The whole point. `USER.md.tmp-15220-1788188853250` is not a file the
    // operator can look for, create, or reason about.
    blockUserMemory();

    expect(pushRootToHermes().error).not.toMatch(/\.tmp-\d+-\d+/);
  });

  it("keeps the errno, because EPERM and ENOENT need different fixes", () => {
    blockUserMemory();

    expect(pushRootToHermes().error).toMatch(/E[A-Z]{3,}/);
  });

  it("records the failure on the row, so the UI can show it", () => {
    blockUserMemory();
    pushRootToHermes();

    const [syncedAt, error] = mockSetAgentRootSyncStatus.mock.calls.at(-1) as [
      string | null,
      string | null,
    ];
    expect(syncedAt).toBeNull();
    expect(error).toContain("USER.md");
  });
});

describe("describeWriteFailure, the function the push routes its errors through", () => {
  // Pinned directly, because mutation showed it could not be reached through
  // the push any more -- and that is the fix working rather than a gap. Once
  // ensureProfileDirs runs, every failure this push can actually produce comes
  // from the BACKUP copy, which names the real target and never a staging file.
  // The staging path only appears when atomicWriteFile itself fails, which now
  // requires the directory to vanish mid-push.
  //
  // So the contract is held here, one layer down, where it can be exercised.

  it("replaces the staging path with the file the operator meant", () => {
    const err = Object.assign(
      new Error(
        "EPERM: operation not permitted, rename '/h/memories/USER.md.tmp-15220-1788188853250' -> '/h/memories/USER.md'",
      ),
      { code: "EPERM" },
    );

    const described = describeWriteFailure(err);

    expect(described).not.toMatch(/\.tmp-\d+-\d+/);
    expect(described).toContain("/h/memories/USER.md");
  });

  it("keeps the errno and the reason", () => {
    const err = new Error(
      "ENOENT: no such file or directory, open '/h/memories/USER.md.tmp-1-2'",
    );

    const described = describeWriteFailure(err);

    expect(described).toContain("ENOENT");
    expect(described).toContain("no such file or directory");
  });

  it("passes through an error that names no staging path", () => {
    const err = new Error("EACCES: permission denied, open '/h/config.yaml'");

    expect(describeWriteFailure(err)).toBe("EACCES: permission denied, open '/h/config.yaml'");
  });

  it("never returns an empty message", () => {
    // messageFromError(err, "") -- what the push used before -- returns "" for
    // a message-less throw, and an empty sync_error on the row is a failure the
    // UI cannot render. This is the difference between the two functions that
    // survives even when no staging path is involved.
    expect(describeWriteFailure(new Error(""))).toBe("Write failed");
    expect(describeWriteFailure(undefined)).toBeTruthy();
  });
});

describe("the drift banner headlines what is actually wrong", () => {
  it("says ERROR when nothing has drifted and a sync failed", () => {
    // "Profile drift — database and Hermes disk differ" over a zero drift count
    // sends the operator to reconcile a difference that does not exist, while
    // the real problem -- a push that threw -- goes unnamed.
    expect(driftBannerHeadline({ driftCount: 0, errorCount: 2 })).toMatch(/error/i);
    expect(driftBannerHeadline({ driftCount: 0, errorCount: 2 })).not.toMatch(/drift/i);
  });

  it("still says DRIFT when that is what happened", () => {
    expect(driftBannerHeadline({ driftCount: 3, errorCount: 0 })).toMatch(/drift/i);
  });

  it("names both when both are true", () => {
    const headline = driftBannerHeadline({ driftCount: 1, errorCount: 1 });

    expect(headline).toMatch(/drift/i);
    expect(headline).toMatch(/error/i);
  });

  it("GREEN CONTROL: says nothing when nothing is wrong", () => {
    expect(driftBannerHeadline({ driftCount: 0, errorCount: 0 })).toBeNull();
  });
});
