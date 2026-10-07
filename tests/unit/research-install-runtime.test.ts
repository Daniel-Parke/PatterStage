/** @jest-environment node */

// Independent T0207 build-input oracle, Faraday, 2026-10-04. No Docker launch.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");
const harness = readFileSync(join(root, "tests/integration/test_full_install_update_process.py"), "utf8");
const selections = [...harness.matchAll(/^DOCKERFILE_REL\s*=\s*Path\("([^"]+)"\)\s*$/gm)].map(match => match[1]);

it("the Python install harness builds its selected docker/TestHarness.dockerfile", () => {
  expect(selections).toEqual(["docker/TestHarness.dockerfile"]);
  expect(harness).toMatch(/dockerfile = self\.repo_root \/ DOCKERFILE_REL/);
  expect(harness).toMatch(/"docker",\s*"build",\s*"-f",\s*str\(dockerfile\)/);
});

it("the selected install image uses the accepted Node24 Bookworm slim platform-neutral base", () => {
  expect(selections).toEqual(["docker/TestHarness.dockerfile"]);
  const image = readFileSync(join(root, selections[0]), "utf8");
  const bases = image.split(/\r?\n/).filter(line => /^\s*FROM\s+/i.test(line)).map(line => line.trim());
  expect(bases).toEqual(["FROM node:24-bookworm-slim"]);
});
