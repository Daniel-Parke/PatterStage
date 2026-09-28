/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";

type Boundary = {
  configuredPublicOrigin: (environment: Record<string, string>) => URL;
  selectedNetworkMode: (origin: URL, environment: Record<string, string>) => string;
};

type ComposeService = {
  environment: Record<string, string>;
  ports: string[];
};

const root = join(__dirname, "..", "..");
const compose = yaml.load(readFileSync(join(root, "docker-compose.real-hermes.yml"), "utf8")) as {
  services: Record<string, ComposeService>;
};

function resolveFixture(hostPort?: string) {
  const service = compose.services.patterstage;
  const hostEnvironment = hostPort ? { PORT: hostPort } : {};
  const interpolate = (value: string) => value.replace(/\$\{([A-Z_][A-Z0-9_]*):-([^}]+)\}/g,
    (_match, name: string, fallback: string) => hostEnvironment[name as keyof typeof hostEnvironment] || fallback);
  const environment = Object.fromEntries(Object.entries(service.environment).map(([key, value]) => [key, interpolate(value)]));
  const publishedPort = interpolate(service.ports[0]);
  const portMatch = /^(\d+):(\d+)$/.exec(publishedPort);
  expect(portMatch).not.toBeNull();
  return { environment, publishedHostPort: portMatch![1], containerPort: portMatch![2] };
}

describe("T-0158 real-Hermes network fixture", () => {
  let boundary: Boundary;

  beforeAll(async () => {
    boundary = (await import("../../scripts/tooling/network-boundary.mjs")) as unknown as Boundary;
  });

  test.each([
    ["default", undefined, "42069"],
    ["overridden", "43123", "43123"],
  ])("Given the %s host PORT, the Compose environment selects an explicit mode and matching public origin", (_label, override, expectedPort) => {
    const { environment, publishedHostPort, containerPort } = resolveFixture(override);
    expect(publishedHostPort).toBe(expectedPort);
    expect(containerPort).toBe(environment.PORT);

    let origin: URL | undefined;
    expect(() => { origin = boundary.configuredPublicOrigin(environment); }).not.toThrow();
    expect(origin?.port).toBe(publishedHostPort);
    expect(boundary.selectedNetworkMode(origin!, environment)).toBe("insecure-lan");
  });

  test("Given an explicit insecure-LAN environment, the boundary accepts HTTP and selects insecure-lan", () => {
    const environment = { PS_PUBLIC_ORIGIN: "http://127.0.0.1:42069", PS_INSECURE_LAN_HTTP: "1" };
    const origin = boundary.configuredPublicOrigin(environment);
    expect(origin.origin).toBe("http://127.0.0.1:42069");
    expect(boundary.selectedNetworkMode(origin, environment)).toBe("insecure-lan");
  });
});
