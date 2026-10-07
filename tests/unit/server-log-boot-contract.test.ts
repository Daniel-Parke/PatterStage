/** @jest-environment node */
import "../helpers/runtime-boot-boundary";
import { register } from "@/instrumentation";

const auth = jest.requireMock<typeof import("@/lib/api/auth-token")>("@/lib/api/auth-token");
auth.getAuthMode = jest.fn();
auth.describeTokenSource = jest.fn();

it.each(["env", "file", "none", "failure"] as const)("preserves exact auth and configuration output for %s boot", async mode => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  process.env.PS_COMPOSER = "off";
  process.env.PS_AUTH_MODE = mode === "none" ? "none" : "token";
  jest.mocked(auth.getAuthMode).mockReturnValue(mode === "none" ? "none" : "token");
  jest.mocked(auth.describeTokenSource).mockReturnValue(mode === "file" ? { kind: "file", location: "/owned/operator-token" } : { kind: "env", location: "PS_AUTH_TOKEN" });
  const failure = new Error("existing auth failure");
  if (mode === "failure") jest.mocked(auth.ensureAuthToken).mockImplementationOnce(() => { throw failure; });
  await register();
  const selected = [console.log, console.info, console.warn, console.error].flatMap(method =>
    jest.mocked(method).mock.calls.filter(args => typeof args[0] === "string" && /^\[(auth|config)\]/.test(args[0])));
  const config = `[config] read-only=off  deploy-api=off  auth=${mode === "none" ? "NONE" : "token"}  composer=off  gateway=default`;
  expect(jest.mocked(console.info).mock.calls).toContainEqual([config]);
  const message = mode === "env"
    ? "[auth] Read the operator token from your service's PS_AUTH_TOKEN secret source, then sign in. The token is never printed here."
    : mode === "file"
      ? "[auth] Read the operator token locally from /owned/operator-token, then sign in. The token is never printed here."
      : mode === "none"
        ? "[auth] PS_AUTH_MODE=none — every endpoint is UNAUTHENTICATED. Only correct behind your own access control."
        : "[auth] could not establish an access token";
  const args = mode === "failure" ? [message, failure] : [message];
  const stream = mode === "failure" ? console.error : mode === "none" ? console.warn : console.info;
  expect(jest.mocked(stream).mock.calls).toContainEqual(args);
  if (mode === "failure") expect(jest.mocked(console.error).mock.calls.find(call => call[0] === message)?.[1]).toBe(failure);
  expect(selected).toHaveLength(2);
});
