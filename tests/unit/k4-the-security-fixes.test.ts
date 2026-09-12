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
 * Two things are deliberately not asserted here, rather than asserted weakly.
 * File modes (critic-03b) are Unix-only: chmod is a no-op on this machine, so
 * the mode cases live in their own describe and skip on win32. And the
 * limiter's prune, which stops an attacker-controlled map growing without
 * bound, has no observable surface without a test-only export; it is proved by
 * reading the code, and the record says so.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { checkUrlSafe, checkUrlShape, isPrivateIpv6 } from "@/lib/search/url-guard";
import { resolveAllowedWorkspacePath } from "@/lib/fs/path-security";

const ROOT = join(__dirname, "..", "..");

describe("K4 · the URL guard sees what the parser produces", () => {
  // Each is a private address the guard let through, in the spelling `new URL()`
  // reports rather than the one a person types.
  const refused: [string, string][] = [
    ["http://[::ffff:127.0.0.1]:8642/", "IPv4-mapped loopback, which normalises to ::ffff:7f00:1"],
    ["http://[::ffff:169.254.169.254]/", "IPv4-mapped cloud metadata"],
    ["http://[::127.0.0.1]/", "IPv4-compatible loopback"],
    ["http://[64:ff9b::a9fe:a9fe]/", "NAT64 carrying 169.254.169.254"],
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
});

describe("K4 · the two client-key derivations are one function", () => {
  it("keys the sessions limiter through the auth throttle's own derivation", () => {
    // Two answers to "which client is this" are two security boundaries. The
    // sessions limiter had its own copy, with no prune beside it.
    const source = readFileSync(join(ROOT, "src", "lib", "sessions", "sessions-api-guard.ts"), "utf-8");
    expect(source).toContain("authClientKey");
    expect(source).not.toContain("function getSessionsApiClientKey");
  });

  it("says something true about loopback where it derives the key", () => {
    // auth-throttle's comment claimed loopback collapses to "local". It does
    // not: Next fills x-forwarded-for from the socket, so a loopback caller is
    // keyed on 127.0.0.1 or ::1, which is why a spoofed header can name it.
    const source = readFileSync(join(ROOT, "src", "lib", "api", "auth-throttle.ts"), "utf-8");
    expect(source).not.toContain("Loopback collapses to");
  });
});

describe("K4 · the Docker build context leaves the operator's data out", () => {
  const ignored = readFileSync(join(ROOT, ".dockerignore"), "utf-8");

  it.each([
    ["/data/*", "the local database, its WAL and SHM, and the auth token"],
    ["!/data/seed/", "except the seed the runner stage copies"],
    ["/org", "the governance corpus, which build-site never publishes"],
    ["/site", "generated docs output"],
    ["/public/help", "the built help, which prebuild regenerates"],
    [".claude", "editor session config"],
  ])("excludes %s", (entry) => {
    expect(ignored).toContain(entry);
  });

  it("keeps docs/, because the build reads it", () => {
    // prebuild runs build-site --help-only, which walks docs/. Excluding it
    // would break the image build rather than shrink it.
    const rules = ignored.split(/\r?\n/).map((line) => line.trim());
    expect(rules).not.toContain("/docs");
    expect(rules).not.toContain("docs/");
    expect(existsSync(join(ROOT, "docs"))).toBe(true);
  });
});

const onUnix = process.platform === "win32" ? describe.skip : describe;
onUnix("K4 · what the deploy runner writes is readable by its owner alone", () => {
  it("opens the runtime logs with mode 0600", () => {
    // Skipped on Windows, where chmod is a no-op and the mode would be a lie.
    // The runner writes into PS_DATA_DIR, which other local accounts can read
    // at the default mode, and the boot line puts the access token in there.
    const source = readFileSync(join(ROOT, "scripts", "tooling", "ps-deploy.mjs"), "utf-8");
    const opens = [...source.matchAll(/openSync\([^)]*\)/g)].map((m) => m[0]);
    expect(opens.length).toBeGreaterThan(0);
    for (const open of opens) expect(open).toContain("0o600");
  });
});
