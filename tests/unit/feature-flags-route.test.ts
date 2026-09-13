/**
 * @jest-environment node
 *
 * GET /api/feature-flags returns the current flag state under the `ok()`
 * envelope, so the client (sidebar) can hide disabled surfaces.
 */

import { GET } from "@/app/api/feature-flags/route";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PS_COMPOSER;
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

async function flagsOf(res: { json: () => Promise<unknown> }) {
  const body = (await res.json()) as { data: { flags: Record<string, boolean> } };
  return body.data.flags;
}

describe("GET /api/feature-flags", () => {
  it("reports composer ON by default", async () => {
    expect(await flagsOf(GET())).toEqual({ composer: true });
  });

  it("reports composer OFF when PS_COMPOSER=0", async () => {
    process.env.PS_COMPOSER = "0";
    expect(await flagsOf(GET())).toEqual({ composer: false });
  });
});
