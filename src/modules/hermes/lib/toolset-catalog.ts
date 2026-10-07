// ═══════════════════════════════════════════════════════════════
// toolset-catalog.ts — Known Hermes toolset IDs for PatterStage UI
// ═══════════════════════════════════════════════════════════════
// Mirrors hermes-agent configurable toolsets (not runtime-expanded tool names).

export interface HermesPlatformDef {
  id: string;
  label: string;
  defaultBundle: string;
}

export interface HermesToolsetDef {
  id: string;
  label: string;
  description: string;
}

export const HERMES_PLATFORMS: HermesPlatformDef[] = [
  { id: "cli", label: "CLI", defaultBundle: "hermes-cli" },
  { id: "discord", label: "Discord", defaultBundle: "hermes-discord" },
  { id: "telegram", label: "Telegram", defaultBundle: "hermes-telegram" },
  { id: "slack", label: "Slack", defaultBundle: "hermes-slack" },
  { id: "whatsapp", label: "WhatsApp", defaultBundle: "hermes-whatsapp" },
  { id: "signal", label: "Signal", defaultBundle: "hermes-signal" },
  { id: "homeassistant", label: "Home Assistant", defaultBundle: "hermes-homeassistant" },
];

/** Granular + platform bundles selectable per platform in config.yaml. */
export const HERMES_CONFIGURABLE_TOOLSETS: HermesToolsetDef[] = [
  { id: "hermes-cli", label: "Hermes CLI", description: "Full default CLI tool bundle" },
  { id: "hermes-discord", label: "Hermes Discord", description: "Discord gateway bundle" },
  { id: "hermes-telegram", label: "Hermes Telegram", description: "Telegram gateway bundle" },
  { id: "hermes-slack", label: "Hermes Slack", description: "Slack gateway bundle" },
  { id: "hermes-whatsapp", label: "Hermes WhatsApp", description: "WhatsApp gateway bundle" },
  { id: "hermes-signal", label: "Hermes Signal", description: "Signal gateway bundle" },
  { id: "hermes-homeassistant", label: "Hermes Home Assistant", description: "Home Assistant gateway bundle" },
  { id: "terminal", label: "Terminal", description: "Shell and process tools" },
  { id: "file", label: "File", description: "Read, write, patch, search files" },
  { id: "web", label: "Web", description: "Web search and extract" },
  { id: "browser", label: "Browser", description: "Browser automation" },
  { id: "skills", label: "Skills", description: "Skill CRUD and viewing" },
  { id: "cronjob", label: "Cron", description: "Scheduled jobs" },
  { id: "memory", label: "Memory", description: "Persistent memory" },
  { id: "code_execution", label: "Code execution", description: "Execute Python with tool access" },
  { id: "delegation", label: "Delegation", description: "Subagent delegation" },
  { id: "image_gen", label: "Image generation", description: "Text-to-image" },
  { id: "vision", label: "Vision", description: "Image analysis" },
  { id: "clarify", label: "Clarify", description: "Ask user questions" },
  { id: "todo", label: "Todo", description: "Task lists" },
  { id: "session_search", label: "Session search", description: "Search past sessions" },
  { id: "messaging", label: "Messaging", description: "Cross-platform send_message" },
];
