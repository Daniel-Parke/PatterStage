/** @jest-environment node */

import { join, resolve } from "path";
import { homedir } from "os";

import {
  getHermesDefaultRoot,
  isProfileHermesHome,
  resolveProfileHermesHome,
} from "@/modules/hermes/lib/profile-paths";

const native = join(homedir(), ".hermes");

describe("hermes-profile-paths", () => {
  const savedHermes = process.env.HERMES_HOME;
  const savedAgent = process.env.AGENT_HOME;

  afterEach(() => {
    if (savedHermes === undefined) delete process.env.HERMES_HOME;
    else process.env.HERMES_HOME = savedHermes;
    if (savedAgent === undefined) delete process.env.AGENT_HOME;
    else process.env.AGENT_HOME = savedAgent;
  });

  it("default root is native when env unset", () => {
    delete process.env.HERMES_HOME;
    delete process.env.AGENT_HOME;
    expect(getHermesDefaultRoot()).toBe(native);
  });

  it("detects profile-as-home layout", () => {
    const profileHome = join(native, "profiles", "coder");
    expect(isProfileHermesHome(profileHome)).toBe(true);
    expect(isProfileHermesHome(native)).toBe(false);
  });

  it("resolves named profile under default root", () => {
    process.env.HERMES_HOME = native;
    expect(resolveProfileHermesHome("coder")).toBe(join(native, "profiles", "coder"));
  });

  it("when env is profile home, resolveProfile returns env for matching profile", () => {
    const profileHome = join(native, "profiles", "coder");
    process.env.HERMES_HOME = profileHome;
    expect(resolveProfileHermesHome("coder")).toBe(profileHome);
    expect(getHermesDefaultRoot()).toBe(native);
  });

  it("docker root with profiles subdir", () => {
    const dockerRoot = resolve("/opt/data");
    const workerHome = join(dockerRoot, "profiles", "worker");
    process.env.HERMES_HOME = workerHome;
    expect(getHermesDefaultRoot()).toBe(dockerRoot);
    expect(resolveProfileHermesHome("worker")).toBe(workerHome);
  });

  it("docker root without profile segment", () => {
    const dockerRoot = resolve("/opt/data");
    process.env.HERMES_HOME = dockerRoot;
    expect(getHermesDefaultRoot()).toBe(dockerRoot);
    expect(resolveProfileHermesHome("default")).toBe(dockerRoot);
  });
});
