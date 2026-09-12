// ═══════════════════════════════════════════════════════════════
// framework-adapter.ts — FrameworkAdapter impl #1 (Hermes)
//
// Wraps the existing Hermes path resolution behind the FrameworkAdapter seam.
// Home comes from the DB config override, else the default Hermes root;
// availability = the framework's config.yaml is present.
// ═══════════════════════════════════════════════════════════════

import { existsSync } from "fs";
import { join } from "path";
import { getHermesDefaultRoot } from "./profile-paths";
import type { FrameworkAdapter, FrameworkConfig, FrameworkInfo } from "@/lib/frameworks/types";

export class HermesAdapter implements FrameworkAdapter {
  readonly type = "hermes";

  constructor(private readonly config: FrameworkConfig) {}

  home(): string {
    const override = this.config.home?.trim();
    return override && override.length > 0 ? override : getHermesDefaultRoot();
  }

  info(): FrameworkInfo {
    const home = this.home();
    return {
      type: "hermes",
      name: "Hermes",
      home,
      available: existsSync(join(home, "config.yaml")),
    };
  }
}
