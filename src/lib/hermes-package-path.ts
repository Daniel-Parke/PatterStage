// ═══════════════════════════════════════════════════════════════
// hermes-package-path.ts — Hermes agent package + venv (single layout)
// ═══════════════════════════════════════════════════════════════
//
// Canonical install: $HERMES_HOME/hermes-agent/ (default ~/.hermes/hermes-agent).

import { existsSync } from "fs";
import { join, resolve } from "path";

import { getHermesHome } from "./hermes-home";
import { getHermesDefaultRootFromHome } from "./hermes-profile-paths";

function hasCronJobsModule(packageDir: string): boolean {
  return existsSync(join(packageDir, "cron", "jobs.py"));
}

/** Directory containing the hermes-agent Python package (cron/jobs.py). */
export function getHermesAgentPackageDir(hermesHome?: string): string {
  const home = hermesHome ?? getHermesHome();
  const root = getHermesDefaultRootFromHome(home);
  return resolve(join(root, "hermes-agent"));
}

/** Human-readable expected venv path for error messages. */
function expectedHermesVenvPythonPath(hermesHome?: string): string {
  return join(getHermesAgentPackageDir(hermesHome), "venv", "bin", "python3");
}

/**
 * Resolve the hermes-agent package directory when cron/jobs.py is present.
 */
export function resolveHermesAgentPackage(hermesHome?: string): string | null {
  const pkg = getHermesAgentPackageDir(hermesHome);
  return hasCronJobsModule(pkg) ? pkg : null;
}

/**
 * Python interpreter for Hermes cron subprocesses.
 * @throws Error when package or venv python is missing
 */
export function resolveHermesVenvPython(hermesHome?: string): string {
  const pkg = resolveHermesAgentPackage(hermesHome);
  const expectedDir = getHermesAgentPackageDir(hermesHome);

  if (!pkg) {
    throw new Error(
      `Hermes agent package not found at ${expectedDir} (missing cron/jobs.py). ` +
        `Install Hermes under HERMES_HOME (default ~/.hermes).`
    );
  }

  for (const rel of ["venv/bin/python3", ".venv/bin/python3"]) {
    const p = join(pkg, rel);
    if (existsSync(p)) return p;
  }

  throw new Error(
    `Hermes venv Python not found under ${pkg}. ` +
      `Expected ${expectedHermesVenvPythonPath(hermesHome)} — run the Hermes installer.`
  );
}
