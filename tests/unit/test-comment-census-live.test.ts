/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

it("holds the current test corpus against its committed comment-essay baseline", () => {
  const runner = resolve("tests/helpers/test-comment-census.mjs");
  expect(existsSync(runner)).toBe(true);
  const result = spawnSync(process.execPath, [runner, "--root", process.cwd(), "--baseline", "tests/fixtures/test-comment-census.baseline.json", "--json"], {
    encoding: "utf8", timeout: 30_000, windowsHide: true,
  });
  if (result.error || result.signal) throw new Error("Comment census could not execute its owned read-only check");
  if (result.status !== 0 && result.status !== 1) throw new Error(`Comment census infrastructure exit ${result.status}`);
  const report = JSON.parse(result.stdout) as { files: unknown[]; violations: unknown[]; baselineSource: string };
  expect(report).toMatchObject({ baselineSource: "HEAD", violations: [] });
  expect(Array.isArray(report.files)).toBe(true);
  expect(report.files.length).toBeGreaterThan(0);
  expect(result.status).toBe(0);
});
