// Playwright global setup: verify the environment the suite assumes is the one
// the server is actually serving.
//
// This used to wipe the isolated data dir, and it must not. Playwright starts
// `webServer` BEFORE globalSetup, so by the time this runs the server is up and
// has already seeded its catalogue at boot. Deleting the data dir here deletes
// that catalogue underneath the running server: on Windows the delete fails with
// EPERM and nothing is noticed, on Linux it succeeds and the suite spends the
// rest of the run against an empty database. The wipe now runs in
// tests/e2e/prepare-data-dir.mjs, as the first half of `webServer.command`,
// strictly before boot.
//
// What is left is the assertion that would have turned that bug into one clear
// sentence instead of one mystifying 30-second click timeout in a single spec.
// The server being up is exactly what makes this checkable: if the seeded
// catalogue is not visible through the API, every test that depends on seeded
// rows is about to fail for a reason that has nothing to do with the code under
// test, so the run should stop here and say so.

export default async function globalSetup(): Promise<void> {
  const port = process.env.PORT || "3000";
  const token = process.env.PS_E2E_AUTH_TOKEN;
  const url = `http://127.0.0.1:${port}/api/agent/profiles`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(
      `[e2e global-setup] ${url} returned ${response.status}. The suite needs a ` +
        "booted server with a readable database; nothing below this point would be " +
        "testing the application.",
    );
  }

  const body = (await response.json()) as {
    data?: { profiles?: { id: string }[] };
  };
  const profiles = body.data?.profiles ?? [];

  // `default` is synthesised by the route from the agent_root row and exists even
  // in an empty database, so it proves nothing. The seeded catalogue is what the
  // specs actually select from, and it arrives only via the boot seed.
  const seeded = profiles.filter((profile) => profile.id !== "default");
  if (seeded.length === 0) {
    throw new Error(
      "[e2e global-setup] the server's database holds no seeded profiles, only the " +
        `synthesised default (saw: ${profiles.map((p) => p.id).join(", ") || "none"}). ` +
        "The catalogue is seeded once at boot by src/instrumentation.ts, so this means " +
        "the data dir was created, emptied or replaced after the server started.",
    );
  }
}
