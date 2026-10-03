/** @jest-environment node */
import "../helpers/runtime-boot-boundary";

import { getAgentLlmEndpoints } from "@/modules/hermes/lib/agent-runtime";
import { GET } from "@/app/api/status/runtime/route";
import { register } from "@/instrumentation";

async function diagnostics(expected: { apiUrl: string; gatewayBase: string }) {
  expect(getAgentLlmEndpoints()).toEqual(expected);
  const response = await GET();
  const payload = await response.json();
  await register();
  expect(response.status).toBe(200);
  expect(typeof payload.data.gatewayUrl).toBe("string");
  const calls = [console.info, console.warn, console.error].flatMap(method => jest.mocked(method).mock.calls);
  const configuration = jest.mocked(console.info).mock.calls.flat().filter(
    value => typeof value === "string" && value.startsWith("[config]") && value.includes("gateway="),
  ) as string[];
  expect(configuration).toHaveLength(1);
  const bootGateway = /\bgateway=(\S+)/.exec(configuration[0])?.[1];
  expect(bootGateway).toBeTruthy();
  expect(getAgentLlmEndpoints()).toEqual(expected);
  return { gateway: payload.data.gatewayUrl as string, bootGateway, all: JSON.stringify({ payload, calls }) };
}

const overrides = ["PS_LLM_API", "CONTROL_HUB_LLM_API", "HERMES_GATEWAY_URL"] as const;
const variants = [
  ["userinfo", "http://oracle-user:oracle-password@127.0.0.1:9861", "", ["oracle-user", "oracle-password"]],
  ["encoded userinfo", "http://oracle%2Duser:oracle%2Dpassword@127.0.0.1:9861", "", ["oracle%2Duser", "oracle%2Dpassword", "oracle-user", "oracle-password"]],
  ["query", "http://127.0.0.1:9861", "?token=oracle-query", ["oracle-query", "?token="]],
  ["fragment", "http://127.0.0.1:9861", "#oracle-fragment", ["oracle-fragment"]],
  ["combined", "http://oracle-user:oracle-password@127.0.0.1:9861", "?token=oracle-query#oracle-fragment", ["oracle-user", "oracle-password", "oracle-query", "oracle-fragment"]],
] as const;

describe("T-0192 gateway diagnostics preserve operations without disclosing URL secrets", () => {
  describe.each(overrides)("%s", key => {
    it.each(variants)("redacts %s from actual boot and runtime GET", async (_label, origin, suffix, secrets) => {
      const path = key === "HERMES_GATEWAY_URL" ? "" : "/v1/chat/completions";
      const value = origin + path + suffix;
      process.env[key] = value;
      // Freeze existing operational bytes, including the current query/fragment suffix behaviour.
      const gatewayBase = key === "HERMES_GATEWAY_URL" || suffix ? value : origin;
      const expected = { gatewayBase, apiUrl: key === "HERMES_GATEWAY_URL" ? value + "/v1/chat/completions" : value };
      const observed = await diagnostics(expected);
      for (const secret of secrets) expect(observed.all).not.toContain(secret);
      const safe = "http://127.0.0.1:9861" + (suffix ? path : "");
      expect(observed.gateway).toBe(safe);
      expect(observed.bootGateway).toBe(safe);
    });

    it.each([
      ["invalid host", "http://[oracle-invalid-secret]"],
      ["non-HTTP scheme", "ftp://oracle-user:oracle-password@127.0.0.1"],
      ["opaque scheme", "data:oracle-invalid-secret"],
      ["CR", "http://127.0.0.1/oracle\rsecret"],
      ["LF", "http://127.0.0.1/oracle\nsecret"],
      ["tab", "http://127.0.0.1/oracle\tsecret"],
      ["NUL", "http://127.0.0.1/oracle\u0000secret"],
      ["DEL", "http://127.0.0.1/oracle\u007fsecret"],
    ])("uses a fixed safe label for %s before URL parsing", async (_label, base) => {
      async function observe(input: string) {
        const assigned = key === "HERMES_GATEWAY_URL" ? input : input + "/v1/chat/completions";
        // A plain environment double preserves NUL; native process.env can truncate it.
        process.env = { ...process.env, [key]: assigned };
        expect(process.env[key]).toBe(assigned);
        expect(Array.from(process.env[key]!, char => char.charCodeAt(0))).toEqual(Array.from(assigned, char => char.charCodeAt(0)));
        const result = await diagnostics({ gatewayBase: input, apiUrl: input + "/v1/chat/completions" });
        for (const marker of ["oracle-invalid-secret", "oracle-other-invalid", "oracle-user", "oracle-password", "oraclesecret", JSON.stringify(input).slice(1, -1)]) {
          expect(result.all).not.toContain(marker);
        }
        expect(result.gateway).not.toMatch(/[\u0000-\u001f\u007f]/);
        expect(result.bootGateway).not.toMatch(/[\u0000-\u001f\u007f]/);
        for (const method of [console.info, console.warn, console.error]) {
          for (const args of jest.mocked(method).mock.calls) {
            for (const arg of args) if (typeof arg === "string") expect(arg).not.toMatch(/[\u0000-\u001f\u007f]/);
          }
        }
        return result;
      }
      const observed = await observe(base);
      jest.clearAllMocks();
      const reference = await observe("http://[oracle-other-invalid]");
      expect(observed.gateway).toBe(reference.gateway);
      expect(observed.bootGateway).toBe(reference.bootGateway);
    });

    it("accepts mixed-case HTTPS without changing operational values", async () => {
      const gatewayBase = "hTtPs://127.0.0.1:9861/ordinary-path";
      const apiUrl = gatewayBase + "/v1/chat/completions";
      process.env[key] = key === "HERMES_GATEWAY_URL" ? gatewayBase : apiUrl;
      const observed = await diagnostics({ gatewayBase, apiUrl });
      for (const value of [observed.gateway, observed.bootGateway!]) {
        expect(new URL(value).href).toBe("https://127.0.0.1:9861/ordinary-path");
      }
    });

    it("preserves a clean configured URL", async () => {
      const gatewayBase = "http://127.0.0.1:9861";
      const apiUrl = gatewayBase + "/v1/chat/completions";
      process.env[key] = key === "HERMES_GATEWAY_URL" ? gatewayBase : apiUrl;
      const observed = await diagnostics({ gatewayBase, apiUrl });
      expect(observed.gateway).toBe(gatewayBase);
      expect(observed.bootGateway).toBe(gatewayBase);
    });
  });

  it("preserves the default endpoint and default boot label", async () => {
    const observed = await diagnostics({ gatewayBase: "http://127.0.0.1:8642", apiUrl: "http://127.0.0.1:8642/v1/chat/completions" });
    expect(observed.gateway).toBe("http://127.0.0.1:8642");
    expect(observed.bootGateway).toBe("default");
  });

  it("preserves explicit gateway and primary API precedence", async () => {
    Object.assign(process.env, { HERMES_GATEWAY_URL: "http://127.0.0.1:9861", PS_LLM_API: "http://127.0.0.1:9862/v1/chat/completions", CONTROL_HUB_LLM_API: "http://127.0.0.1:9863/v1/chat/completions" });
    const observed = await diagnostics({ gatewayBase: "http://127.0.0.1:9861", apiUrl: "http://127.0.0.1:9862/v1/chat/completions" });
    expect(observed.gateway).toBe("http://127.0.0.1:9861");
    expect(observed.bootGateway).toBe("http://127.0.0.1:9861");
  });
});
