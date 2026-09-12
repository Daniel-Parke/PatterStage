/**
 * @jest-environment node
 *
 * K4 · The security fixes that needed no ruling.
 *
 * Written before the fixes exist. Each case is a defect the review found,
 * stated as the behaviour that should hold instead:
 *
 *   critic-01  Deep Research's URL guard refuses a private address however the
 *              URL parser spells it. The parser normalises [::ffff:127.0.0.1]
 *              to [::ffff:7f00:1], and the guard knew only the dotted form, so
 *              loopback, cloud metadata and the LAN were reachable from a
 *              research run.
 *   critic-14  The workspace path guard refuses an escape and admits a real
 *              directory whose name merely contains two dots.
 *   critic-02s The sessions limiter tells callers apart the same way the auth
 *              throttle does, through one function rather than two copies.
 *   tooling-05 The Docker build context leaves out the local database, the auth
 *              token and the governance corpus, and still includes docs/, which
 *              prebuild reads.
 *
 *   critic-03b The deploy logs, the data directory, the database and the copy a
 *              baseline rebuild leaves behind are readable by their owner
 *              alone. Every one of them already exists on an upgraded install,
 *              so the fix is a chmod and not a mode argument.
 *
 * The mode cases come in two halves. What chmod DOES is Unix-only — it is a
 * no-op on this machine — so that half skips on win32 and the assertion would
 * otherwise be a lie. That each call site ASKS for it is the same text on every
 * host, so that half runs everywhere.
 *
 * One thing is deliberately not asserted here, rather than asserted weakly. The
 * limiter's prune, which stops an attacker-controlled map growing without
 * bound, has no observable surface without a test-only export; it is proved by
 * reading the code, and the record says so.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";

import { checkUrlSafe, checkUrlShape, isPrivateIpv6 } from "@/lib/search/url-guard";
import { resolveAllowedWorkspacePath } from "@/lib/fs/path-security";
import { OWNER_ONLY_DIR, OWNER_ONLY_FILE, restrictToOwner } from "@/lib/fs/fs-helpers";
import { authClientKey } from "@/lib/api/auth-throttle";
import {
  sessionsRateLimitResponse,
  sessionsRateWindowCount,
} from "@/lib/sessions/sessions-api-guard";

const ROOT = join(__dirname, "..", "..");
const readRepoFile = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf-8");

describe("K4 · the URL guard sees what the parser produces", () => {
  // Each is a private address the guard let through, in the spelling `new URL()`
  // reports rather than the one a person types.
  const refused: [string, string][] = [
    ["http://[::ffff:127.0.0.1]:8642/", "IPv4-mapped loopback, which normalises to ::ffff:7f00:1"],
    ["http://[::ffff:169.254.169.254]/", "IPv4-mapped cloud metadata"],
    ["http://[::127.0.0.1]/", "IPv4-compatible loopback"],
    ["http://[64:ff9b::a9fe:a9fe]/", "NAT64 carrying 169.254.169.254"],
    // The compressed spellings, which are the common ones, and the reason the
    // guard expands an address instead of matching a regex per prefix. A zero
    // second hextet disappears, and 2002:a9fe::1 is 6to4 for 169.254.0.0.
    ["http://[2002:a9fe::1]/", "6to4 carrying the cloud metadata range"],
    ["http://[2002:7f00::1]/", "6to4 carrying 127.0.0.0"],
    ["http://[2002:c0a8::1]/", "6to4 carrying 192.168.0.0"],
    ["http://[2002:a00::1]/", "6to4 carrying 10.0.0.0"],
    ["http://[64:ff9b::]/", "NAT64 carrying 0.0.0.0"],
  ];

  it.each(refused)("refuses %s", async (url) => {
    expect(checkUrlShape(url).ok).toBe(false);
    await expect(checkUrlSafe(url)).resolves.toMatchObject({ ok: false });
  });

  it("still refuses the spellings it already knew", () => {
    expect(checkUrlShape("http://127.0.0.1/").ok).toBe(false);
    expect(checkUrlShape("http://[::1]/").ok).toBe(false);
    expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
  });

  it("still allows a public address, so the guard has not simply closed", () => {
    expect(checkUrlShape("https://example.com/docs").ok).toBe(true);
    expect(checkUrlShape("http://[2606:4700:4700::1111]/").ok).toBe(true);
  });

  // The carrier prefixes are the half that can over-block: each one also
  // carries public addresses, and refusing those would break research rather
  // than protect it. Every case here is the same prefix as a refusal above,
  // decoding to a routable v4.
  it.each([
    ["http://[64:ff9b::808:808]/", "NAT64 carrying 8.8.8.8"],
    ["http://[2002:0102:0304::1]/", "6to4 carrying 1.2.3.4"],
    ["http://[2001:db8::1]/", "an ordinary v6 address with no v4 in it"],
    ["http://[2001:db8::7f00:1]/", "last 32 bits spell 127.0.0.1, but no carrier prefix"],
    ["http://[2001:db8::127.0.0.1]/", "the same, written with a dotted tail"],
  ])("allows %s", (url) => {
    expect(checkUrlShape(url).ok).toBe(true);
  });
});

describe("K4 · the workspace guard reads a path, not a substring", () => {
  const home = homedir();
  const verdict = (path: string) => resolveAllowedWorkspacePath(path).ok;

  it("admits a directory whose name contains two dots", () => {
    // The old substring test refused these. They are legal directory names.
    expect(verdict(join(home, "a..b"))).toBe(true);
    expect(verdict(join(home, "..foo"))).toBe(true);
    expect(verdict(join(home, "notes..old", "draft"))).toBe(true);
  });

  it("refuses a path that climbs out of every root", () => {
    expect(verdict(join(home, "..", "somewhere-else"))).toBe(false);
    expect(verdict(join(home, "sub", "..", "..", "escape"))).toBe(false);
  });

  it("still admits the roots themselves and what is under them", () => {
    expect(verdict(home)).toBe(true);
    expect(verdict(join(home, "projects", "thing"))).toBe(true);
  });

  it("refuses a sibling whose name merely starts with a root's name", () => {
    // relative("/home/dan", "/home/danielle") is "../danielle". A prefix test
    // on the string would have admitted it.
    expect(verdict(home + "-elsewhere")).toBe(false);
  });
});

const onWindows = process.platform === "win32" ? describe : describe.skip;
onWindows("K4 · the workspace guard refuses another drive", () => {
  it("refuses a path on a drive no root is on", () => {
    // This is what the isAbsolute clause closes, and it was open before the
    // fix: relative() gives up and returns an absolute path when the two share
    // no root, and "C:\\other" contains no "..", so the old test admitted it.
    // Windows-only, because a drive letter is not a path anywhere else — off
    // win32 the guard refuses it earlier, by shape.
    const other = homedir()[0].toUpperCase() === "Z" ? "Y" : "Z";
    expect(resolveAllowedWorkspacePath(`${other}:\\somewhere`).ok).toBe(false);
  });
});

describe("K4 · the two client-key derivations are one function", () => {
  it("keys the sessions limiter through the auth throttle's own derivation", () => {
    // Two answers to "which client is this" are two security boundaries. The
    // sessions limiter had its own copy, with no prune beside it.
    //
    // Asserting that the OLD function name is gone is not enough: inline the
    // same derivation at the call site under any other name and the file still
    // mentions authClientKey, because the import does. What actually holds is
    // that this file reads no client header of its own.
    const source = readFileSync(join(ROOT, "src", "lib", "sessions", "sessions-api-guard.ts"), "utf-8");
    expect(source).toContain("authClientKey(request.headers)");
    expect(source).not.toContain("function getSessionsApiClientKey");
    expect(source).not.toMatch(/headers\.get\(\s*["'`]x-(forwarded-for|real-ip)["'`]/);
  });

  it("says something true about loopback where it derives the key", () => {
    // The comment claimed loopback collapses to "local". Asserting the wrong
    // sentence is absent would pass on an empty comment, so this asserts the
    // behaviour the sentence was wrong about instead: a caller whose address
    // Next put in the header is keyed on that address, and "local" is what a
    // request carrying neither header gets.
    const headers = (map: Record<string, string>) => ({ get: (n: string) => map[n] ?? null });
    expect(authClientKey(headers({ "x-forwarded-for": "127.0.0.1" }))).toContain("127.0.0.1");
    expect(authClientKey(headers({ "x-forwarded-for": "::1" }))).toContain("::1");
    expect(authClientKey(headers({}))).toBe("local");
  });

  it("forgets a caller once its window has passed", () => {
    // The map is keyed by a header the caller sends, so without the prune a
    // caller varying it grows the map for as long as the process lives. That
    // the map shrinks shows up in no response, which is why the count is
    // exported: this is the only place it can be seen.
    const before = sessionsRateWindowCount();
    const hit = (who: string) =>
      sessionsRateLimitResponse(
        new NextRequest("http://localhost/api/sessions", { headers: { "x-forwarded-for": who } })
      );
    for (let i = 0; i < 5; i++) expect(hit(`10.0.0.${i}`)).toBeNull();
    expect(sessionsRateWindowCount()).toBe(before + 5);

    // One window later, every one of them is forgotten on the next request.
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 61_000;
      expect(hit("10.0.0.99")).toBeNull();
    } finally {
      Date.now = realNow;
    }
    expect(sessionsRateWindowCount()).toBe(1);
  });
});

describe("K4 · the Docker build context leaves the operator's data out", () => {
  const ignored = readFileSync(join(ROOT, ".dockerignore"), "utf-8");
  // Rules, not substrings. The mutation sweep killed the substring form: `#`
  // opens a comment here, so a commented-out `/data/*` still CONTAINS the
  // string and the image would carry the operator's database again.
  const rules = ignored.split(/\r?\n/).map((line) => line.trim());

  it.each([
    ["/data/*", "the local database, its WAL and SHM, and the auth token"],
    ["!/data/seed/", "except the seed the runner stage copies"],
    ["/org", "the governance corpus, which build-site never publishes"],
    ["/site", "generated docs output"],
    ["/public/help", "the built help, which prebuild regenerates"],
    [".claude", "editor session config"],
  ])("excludes %s", (entry) => {
    expect(rules).toContain(entry);
  });

  it("keeps docs/, because the build reads it", () => {
    // prebuild runs build-site --help-only, which walks docs/. Excluding it
    // would break the image build rather than shrink it.
    expect(rules).not.toContain("/docs");
    expect(rules).not.toContain("docs/");
    expect(existsSync(join(ROOT, "docs"))).toBe(true);
  });
});

const onUnix = process.platform === "win32" ? describe.skip : describe;

onUnix("K4 · restrictToOwner narrows what is already on disk", () => {
  // A mode argument applies only when the file is created. Every path here
  // already exists on an upgraded install, so the fix has to be a chmod.
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "k4-modes-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const modeOf = (path: string) => statSync(path).mode & 0o777;

  it("narrows a world-readable file to 0600", () => {
    const file = join(dir, "ps-runtime.log");
    writeFileSync(file, "boot line with a token in it\n");
    chmodSync(file, 0o644);
    restrictToOwner(file, OWNER_ONLY_FILE);
    expect(modeOf(file)).toBe(0o600);
  });

  it("narrows a traversable directory to 0700", () => {
    const sub = join(dir, "data");
    mkdirSync(sub);
    chmodSync(sub, 0o755);
    restrictToOwner(sub, OWNER_ONLY_DIR);
    expect(modeOf(sub)).toBe(0o700);
  });

  it("does not throw on a path that is not there", () => {
    // Boot calls this before some of these files exist. A throw here would be
    // a startup failure over a permission tidy-up.
    expect(() => restrictToOwner(join(dir, "absent"), OWNER_ONLY_FILE)).not.toThrow();
  });
});

describe("K4 · every writer of operator data names the mode", () => {
  // Cross-platform, because the call sites are the same text on every host.
  // Only their effect is Unix-only, which is what the describe above proves.

  it("opens the runtime logs with mode 0600", () => {
    // This case arrived in the first oracle commit, inside a describe that
    // skipped on win32, and it is moved and rewritten here in the batch that
    // made it pass. Both changes are corrections, and both are worth naming.
    //
    // It matched /openSync\([^)]*\)/, and `[^)]*` stops at the FIRST `)` — the
    // inner one in `logFile(base)` — so it read `openSync(logFile(base)` and
    // could never see a third argument, whatever it was. It would have failed
    // on Linux CI for a reason that had nothing to do with the fix. Reading a
    // line at a time asserts more than the old form could, not less.
    //
    // And it never needed to skip. Source text is the same on every host, so
    // skipping it put a Linux-only failure where this machine could not see
    // it, which is the thing that cost six days in K1. What is genuinely
    // Unix-only is what chmod DOES, and that is the describe above.
    const opens = readRepoFile("scripts", "tooling", "ps-deploy.mjs")
      .split(/\r?\n/)
      .filter((line) => line.includes("openSync("));
    expect(opens.length).toBeGreaterThan(0);
    for (const open of opens) expect(open).toContain("OWNER_ONLY_FILE");
    expect(readRepoFile("scripts", "tooling", "_platform.mjs")).toContain(
      "export const OWNER_ONLY_FILE = 0o600;"
    );
  });

  it("opens both deploy logs with 0600 and narrows the file that is already there", () => {
    // Counting restrictToOwner calls was the first form of this, and the
    // mutation sweep killed it: the batch ended with five of them, so deleting
    // the one beside an open still left more than the floor. What holds is the
    // pairing — every opener is followed by the narrow, because the mode
    // argument beside it does nothing for a log the last start left behind.
    const deploy = readRepoFile("scripts", "tooling", "ps-deploy.mjs");
    const lines = deploy.split(/\r?\n/);
    const openers = lines.flatMap((line, i) => (line.includes("openSync(") ? [i] : []));
    expect(openers).toHaveLength(2);
    for (const i of openers) expect(lines[i + 1]).toContain("restrictToOwner(logFile(base)");
    // The runtime log is truncated on every start, and truncation keeps the
    // old mode, so the mode option alone would not fix an existing install.
    expect(deploy).toMatch(/writeFileSync\(RUNTIME_LOG\(\), "", \{ mode: OWNER_ONLY_FILE \}\)/);
  });

  it("gives the detached child a log it opened with 0600", () => {
    const platform = readRepoFile("scripts", "tooling", "_platform.mjs");
    expect(platform).toMatch(/openSync\(logFile, "a", OWNER_ONLY_FILE\)/);
    expect(platform).toContain("restrictToOwner(logFile, OWNER_ONLY_FILE)");
  });

  it("narrows the data directory and the database at every open", () => {
    const db = readRepoFile("src", "lib", "db", "index.ts");
    expect(db).toContain("restrictToOwner(dataDir, OWNER_ONLY_DIR)");
    // :94 first open and :198 the reopen after a baseline rebuild.
    expect([...db.matchAll(/restrictToOwner\(DB_PATH, OWNER_ONLY_FILE\)/g)]).toHaveLength(2);
  });

  it("narrows the directory the token file is minted into", () => {
    // The token file was already 0600. Its directory was not, and a readable
    // directory is enough to see the name of everything in it.
    //
    // The second assertion is about there being ONE way to do this, not about
    // a particular old line: this file had its own inline chmod, and a file
    // that still imports chmodSync has kept a second answer to the question.
    const token = readRepoFile("src", "lib", "api", "auth-token.ts");
    expect(token).toContain("restrictToOwner(dir, OWNER_ONLY_DIR)");
    expect(token).not.toContain("chmodSync");
  });

  it("narrows the whole databases an older install left lying about", () => {
    // Narrowing the live database only helps the live database. A baseline
    // rebuild and the deploy runner each leave a complete copy beside it, and
    // on an install made before this batch those are world-readable.
    const db = readRepoFile("src", "lib", "db", "index.ts");
    expect(db).toContain("restrictExistingDatabaseFiles(dataDir)");
    const deploy = readRepoFile("scripts", "tooling", "ps-deploy.mjs");
    expect(deploy).toContain("restrictToOwner(bak, OWNER_ONLY_FILE)");
    expect(deploy).toContain("restrictToOwner(bak + s, OWNER_ONLY_FILE)");
  });

  it("narrows the copy a baseline rebuild leaves beside the database", () => {
    const upgrade = readRepoFile("src", "lib", "db", "upgrade.ts");
    expect(upgrade).toContain("restrictToOwner(backupPath, OWNER_ONLY_FILE)");
  });

  it("has one chmod helper, not one per caller", () => {
    // Two answers to "how tight should this be" would drift. Callers that had
    // their own inline chmod now go through fs-helpers.
    const helpers = readRepoFile("src", "lib", "fs", "fs-helpers.ts");
    expect(helpers).toContain("export function restrictToOwner");
    expect(helpers).toContain("process.platform === \"win32\"");
  });
});
