// ═══════════════════════════════════════════════════════════════
// frameworks/types.ts — the pluggable agent-framework seam
//
// A FrameworkAdapter projects PatterStage's DB-owned config onto a concrete
// agent framework (Hermes today) and reports where it lives + whether it's
// available. Mirrors the AgentRuntime/MemoryProvider seams so a second
// framework can be added behind the interface without rewiring the runtime.
// ═══════════════════════════════════════════════════════════════

export type FrameworkType = "hermes" | (string & {});

export interface FrameworkConfig {
  /** Override the framework home/install directory; null ⇒ the adapter default. */
  home?: string | null;
}

export interface FrameworkInfo {
  type: FrameworkType;
  name: string;
  /** Resolved home/install directory. */
  home: string;
  /** Whether the framework is installed/reachable (its config is present). */
  available: boolean;
}

/** A pluggable agent-framework adapter. */
export interface FrameworkAdapter {
  readonly type: FrameworkType;
  /** Resolved home/install directory for this framework. */
  home(): string;
  /** Static info + availability (cheap, synchronous). */
  info(): FrameworkInfo;
}
