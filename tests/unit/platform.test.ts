// Cross-platform OS seam (src/lib/platform.ts). Tests are deterministic and
// run identically on Windows, macOS, and Linux CI runners.

import { createServer, type AddressInfo } from "net";

import * as platform from "@/lib/platform";

describe("platform", () => {
  it("homeDir / tmpDir resolve to non-empty paths", () => {
    expect(platform.homeDir().length).toBeGreaterThan(0);
    expect(platform.tmpDir().length).toBeGreaterThan(0);
  });

  it("at most one of isWindows/isMac/isLinux is true", () => {
    const set = [platform.isWindows, platform.isMac, platform.isLinux].filter(Boolean);
    expect(set.length).toBeLessThanOrEqual(1);
  });

  describe("interpreterFor", () => {
    it("runs .mjs/.cjs/.js with the current node binary", () => {
      for (const ext of [".mjs", ".cjs", ".js"]) {
        expect(platform.interpreterFor(`/scripts/x${ext}`)).toEqual({
          cmd: process.execPath,
          args: [`/scripts/x${ext}`],
        });
      }
    });

    it("returns null for unknown / extensionless files", () => {
      expect(platform.interpreterFor("/scripts/x.txt")).toBeNull();
      expect(platform.interpreterFor("/scripts/x")).toBeNull();
    });

    it("maps .ps1 to PowerShell with the right flags per platform", () => {
      const i = platform.interpreterFor("/scripts/x.ps1");
      if (platform.isWindows) {
        expect(i).toEqual({
          cmd: "powershell.exe",
          args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "/scripts/x.ps1"],
        });
      } else {
        expect(i).toEqual({ cmd: "pwsh", args: ["-NoProfile", "-File", "/scripts/x.ps1"] });
      }
    });

    it(".sh resolves to /bin/bash on Unix; .bat/.cmd are Windows-only", () => {
      if (platform.isWindows) {
        expect(platform.interpreterFor("/scripts/x.bat")).toEqual({ cmd: "cmd.exe", args: ["/c", "/scripts/x.bat"] });
      } else {
        expect(platform.interpreterFor("/scripts/x.sh")).toEqual({ cmd: "/bin/bash", args: ["/scripts/x.sh"] });
        expect(platform.interpreterFor("/scripts/x.bat")).toBeNull();
      }
    });
  });

  describe("isPidAlive / killPid", () => {
    it("our own pid is alive; impossible pids are not", () => {
      expect(platform.isPidAlive(process.pid)).toBe(true);
      expect(platform.isPidAlive(2 ** 30)).toBe(false);
      expect(platform.isPidAlive(0)).toBe(false);
      expect(platform.isPidAlive(-1)).toBe(false);
    });

    it("killPid on an invalid pid is a no-op (never throws)", () => {
      expect(() => platform.killPid(0)).not.toThrow();
      expect(() => platform.killPid(-5)).not.toThrow();
    });
  });

  describe("portInUse / pidsOnPort", () => {
    it("detects a listening port, then sees it free after close", async () => {
      const srv = createServer().listen(0, "127.0.0.1");
      await new Promise((r) => srv.once("listening", r));
      const port = (srv.address() as AddressInfo).port;

      expect(await platform.portInUse(port)).toBe(true);

      await new Promise((r) => srv.close(r));
      expect(await platform.portInUse(port)).toBe(false);
    });

    it("pidsOnPort returns an array (empty for a free port)", () => {
      expect(Array.isArray(platform.pidsOnPort(59997))).toBe(true);
    });
  });

  describe("detachedSpawn", () => {
    it("returns a positive pid for a valid command", () => {
      const pid = platform.detachedSpawn(process.execPath, ["-e", "process.exit(0)"]);
      expect(typeof pid).toBe("number");
      expect(pid as number).toBeGreaterThan(0);
    });
  });
});
