// ═══════════════════════════════════════════════════════════════
// frameworks — the pluggable agent-framework seam (Hermes today)
// ═══════════════════════════════════════════════════════════════

export type { FrameworkAdapter, FrameworkConfig, FrameworkInfo, FrameworkType } from "./types";
export { getActiveFramework } from "./registry";
export {
  listFrameworks,
  getActiveFrameworkRow,
  getActiveFrameworkConfig,
  updateFramework,
  type FrameworkRow,
} from "./repository";
