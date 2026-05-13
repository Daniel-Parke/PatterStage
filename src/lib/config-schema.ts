// ═══════════════════════════════════════════════════════════════
// Config Section Definitions — drives the UI form rendering
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/hermes";

export interface FieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "textarea";
  options?: string[];
  description?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface SectionDef {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  color: AccentColor;
  fields: FieldDef[];
  // Sections with complex/nested values that can't be edited inline
  complexKeys?: string[];
  // File-based sections (HERMES.md, .env)
  type?: "yaml" | "file";
  filePath?: string;
  sensitive?: boolean;
}

export const CONFIG_SECTIONS: Record<string, SectionDef> = {
  agent: {
    id: "agent",
    label: "Agent Settings",
    description: "Core agent behavior, reasoning, and personality configuration",
    icon: "Cpu",
    color: "cyan",
    fields: [
      { key: "max_turns", label: "Max Turns", type: "number", min: 1, max: 500, description: "Maximum conversation turns before stopping" },
      { key: "reasoning_effort", label: "Reasoning Effort", type: "select", options: ["none", "low", "medium", "high", "xhigh"], description: "How much reasoning the model should use" },
      { key: "tool_use_enforcement", label: "Tool Use Enforcement", type: "select", options: ["auto", "strict", "off"], description: "When to enforce tool usage rules" },
      { key: "verbose", label: "Verbose Mode", type: "boolean", description: "Enable verbose logging in terminal" },
      { key: "gateway_timeout", label: "Gateway Timeout (s)", type: "number", min: 60, max: 7200, description: "Seconds before gateway connections timeout" },
    ],
    complexKeys: ["personalities"],
  },
  display: {
    id: "display",
    label: "Display Settings",
    description: "Visual presentation, streaming, and tool output options",
    icon: "Activity",
    color: "green",
    fields: [
      { key: "skin", label: "CLI Skin", type: "string", description: "Visual theme name (e.g. default, ares, mono)" },
      { key: "show_cost", label: "Show Cost", type: "boolean", description: "Display token cost after each response" },
      { key: "show_reasoning", label: "Show Reasoning", type: "boolean", description: "Display model reasoning content" },
      { key: "streaming", label: "Streaming", type: "boolean", description: "Stream responses as they generate" },
      { key: "tool_progress", label: "Tool Progress", type: "boolean", description: "Show tool execution progress in terminal" },
      { key: "compact", label: "Compact Mode", type: "boolean", description: "Reduce whitespace in terminal output" },
      { key: "personality", label: "Active Personality", type: "string", description: "Currently active personality name (empty = default)" },
      { key: "tool_preview_length", label: "Tool Preview Length", type: "number", min: 50, max: 5000, description: "Max characters shown for tool output preview" },
      { key: "background_process_notifications", label: "Background Process Notifications", type: "boolean", description: "Notify when background processes complete" },
      { key: "bell_on_complete", label: "Bell on Complete", type: "boolean", description: "Terminal bell when task completes" },
      { key: "busy_input_mode", label: "Busy Input Mode", type: "select", options: ["queue", "reject", "cancel"], description: "How to handle input while agent is busy" },
      { key: "inline_diffs", label: "Inline Diffs", type: "boolean", description: "Show file diffs inline in terminal" },
      { key: "resume_display", label: "Resume Display", type: "boolean", description: "Resume display state on reconnect" },
      { key: "tool_progress_command", label: "Tool Progress Command", type: "boolean", description: "Show progress for command-based tools" },
    ],
  },
  memory: {
    id: "memory",
    label: "Memory Settings",
    description: "Memory provider (Holographic, Hindsight, or others), limits, and user profile",
    icon: "Layers",
    color: "pink",
    fields: [
      { key: "memory_enabled", label: "Memory Enabled", type: "boolean", description: "Enable memory system" },
      { key: "provider", label: "Provider", type: "select", options: ["holographic", "hindsight"], description: "Memory backend provider. Holographic = SQLite local, Hindsight = knowledge graph (local or cloud)" },
      { key: "memory_char_limit", label: "Memory Char Limit", type: "number", min: 500, max: 10000, description: "Max characters per memory entry" },
      { key: "user_char_limit", label: "User Char Limit", type: "number", min: 500, max: 10000, description: "Max characters for user profile" },
      { key: "nudge_interval", label: "Nudge Interval", type: "number", min: 1, max: 100, description: "Turns between memory flush nudges" },
      { key: "user_profile_enabled", label: "User Profile Enabled", type: "boolean", description: "Maintain a persistent user profile" },
      { key: "flush_min_turns", label: "Flush Min Turns", type: "number", min: 1, max: 100, description: "Minimum turns before memory flush" },
    ],
  },
  terminal: {
    id: "terminal",
    label: "Terminal Settings",
    description: "Shell backend, timeouts, and container configuration",
    icon: "Terminal",
    color: "orange",
    fields: [
      { key: "backend", label: "Backend", type: "select", options: ["local", "docker", "ssh", "modal", "daytona", "singularity"], description: "Terminal execution backend" },
      { key: "timeout", label: "Timeout (s)", type: "number", min: 10, max: 600, description: "Command execution timeout in seconds" },
      { key: "persistent_shell", label: "Persistent Shell", type: "boolean", description: "Keep shell session alive between commands" },
      { key: "docker_image", label: "Docker Image", type: "string", description: "Docker image for terminal backend" },
      { key: "container_cpu", label: "Container CPU", type: "number", min: 1, max: 32, description: "CPU cores for container" },
      { key: "container_memory", label: "Container Memory (MB)", type: "number", min: 256, max: 32768, description: "Memory in MB for container" },
      { key: "container_disk", label: "Container Disk (GB)", type: "number", min: 1, max: 500, description: "Disk space in GB for container" },
    ],
  },
  compression: {
    id: "compression",
    label: "Compression",
    description: "Automatic context compression to manage token limits",
    icon: "HardDrive",
    color: "cyan",
    fields: [
      { key: "enabled", label: "Enabled", type: "boolean", description: "Enable automatic context compression" },
      { key: "threshold", label: "Threshold", type: "number", min: 0.1, max: 0.95, description: "Context usage ratio to trigger compression (0.0–1.0)" },
      { key: "target_ratio", label: "Target Ratio", type: "number", min: 0.05, max: 0.8, description: "Compress down to this ratio of original" },
      { key: "protect_last_n", label: "Protect Last N", type: "number", min: 0, max: 50, description: "Number of recent messages to protect from compression" },
    ],
  },
  security: {
    id: "security",
    label: "Security",
    description: "Guardrails, secret handling, and website access controls",
    icon: "Shield",
    color: "cyan",
    fields: [
      { key: "tirith_enabled", label: "Tirith Enabled", type: "boolean", description: "Enable Tirith content guardrails" },
      { key: "tirith_fail_open", label: "Tirith Fail Open", type: "boolean", description: "Allow requests if Tirith is unreachable" },
      { key: "redact_secrets", label: "Redact Secrets", type: "boolean", description: "Auto-redact API keys and secrets from output" },
    ],
  },
  tts: {
    id: "tts",
    label: "Text-to-Speech",
    description: "Voice synthesis provider and voice selection",
    icon: "Volume2",
    color: "pink",
    fields: [
      { key: "provider", label: "Provider", type: "select", options: ["edge", "elevenlabs", "openai", "kokoro", "fish"], description: "TTS provider" },
    ],
  },
  stt: {
    id: "stt",
    label: "Speech-to-Text",
    description: "Voice recognition provider and model",
    icon: "Mic",
    color: "purple",
    fields: [
      { key: "enabled", label: "Enabled", type: "boolean", description: "Enable speech-to-text" },
      { key: "provider", label: "Provider", type: "select", options: ["local", "groq", "openai"], description: "STT provider" },
      { key: "model", label: "Model", type: "string", description: "STT model identifier" },
    ],
  },
  delegation: {
    id: "delegation",
    label: "Delegation",
    description: "Sub-agent delegation settings for autonomous tasks",
    icon: "GitBranch",
    color: "green",
    fields: [
      { key: "model", label: "Model", type: "string", description: "Model used for delegated sub-agents" },
      { key: "provider", label: "Provider", type: "string", description: "Provider for delegation model" },
      { key: "max_iterations", label: "Max Iterations", type: "number", min: 5, max: 200, description: "Max tool-calling turns for sub-agents" },
    ],
  },
  cron: {
    id: "cron",
    label: "Cron Settings",
    description: "Scheduled job configuration",
    icon: "ListTodo",
    color: "orange",
    fields: [
      { key: "wrap_response", label: "Wrap Response", type: "boolean", description: "Wrap cron job responses with context" },
    ],
  },
  checkpoints: {
    id: "checkpoints",
    label: "Checkpoints",
    description: "Session snapshot and restore settings",
    icon: "Zap",
    color: "cyan",
    fields: [
      { key: "enabled", label: "Enabled", type: "boolean", description: "Enable session checkpointing" },
      { key: "max_snapshots", label: "Max Snapshots", type: "number", min: 1, max: 500, description: "Maximum number of snapshots to keep" },
    ],
  },
  approvals: {
    id: "approvals",
    label: "Approvals",
    description: "Command approval mode and timeout settings",
    icon: "ShieldCheck",
    color: "purple",
    fields: [
      { key: "mode", label: "Mode", type: "select", options: ["manual", "auto"], description: "Approval mode for dangerous commands" },
      { key: "timeout", label: "Timeout (s)", type: "number", min: 10, max: 300, description: "Seconds to wait for manual approval" },
    ],
  },
  browser: {
    id: "browser",
    label: "Browser",
    description: "Browser automation settings and timeouts",
    icon: "Globe",
    color: "green",
    fields: [
      { key: "cloud_provider", label: "Cloud Provider", type: "select", options: ["local", "browserbase"], description: "Browser automation backend" },
      { key: "command_timeout", label: "Command Timeout (s)", type: "number", min: 10, max: 120, description: "Timeout for individual browser commands" },
      { key: "inactivity_timeout", label: "Inactivity Timeout (s)", type: "number", min: 30, max: 600, description: "Seconds before closing idle browser sessions" },
      { key: "record_sessions", label: "Record Sessions", type: "boolean", description: "Record browser sessions for debugging" },
      { key: "allow_private_urls", label: "Allow Private URLs", type: "boolean", description: "Allow navigation to private/local network URLs" },
      { key: "camofox", label: "Camofox", type: "boolean", description: "Enable anti-detection browser mode" },
    ],
  },
  session_reset: {
    id: "session_reset",
    label: "Session Reset",
    description: "Automatic session reset based on idle time or schedule",
    icon: "RotateCcw",
    color: "orange",
    fields: [
      { key: "mode", label: "Mode", type: "select", options: ["both", "idle", "scheduled", "off"], description: "When to auto-reset sessions" },
      { key: "idle_minutes", label: "Idle Minutes", type: "number", min: 5, max: 1440, description: "Minutes of inactivity before reset" },
      { key: "at_hour", label: "Reset at Hour", type: "number", min: 0, max: 23, description: "Hour of day for scheduled reset (0-23)" },
    ],
  },
  skills: {
    id: "skills",
    label: "Skills",
    description: "Skill discovery and external directory configuration",
    icon: "FileText",
    color: "green",
    fields: [
      { key: "creation_nudge_interval", label: "Creation Nudge Interval", type: "number", min: 1, max: 100, description: "Turns between skill creation reminders" },
    ],
    complexKeys: ["external_dirs"],
  },
  platform_toolsets: {
    id: "platform_toolsets",
    label: "Platform Toolsets",
    description: "Per-platform tool availability (cli, discord, telegram, etc.)",
    icon: "Wrench",
    color: "purple",
    fields: [],
    complexKeys: ["cli", "discord", "telegram", "slack", "whatsapp", "signal", "homeassistant"],
  },
  code_execution: {
    id: "code_execution",
    label: "Code Execution",
    description: "Settings for the code execution sandbox",
    icon: "Terminal",
    color: "green",
    fields: [
      { key: "max_tool_calls", label: "Max Tool Calls", type: "number", min: 1, max: 200, description: "Maximum tool calls per code execution" },
      { key: "timeout", label: "Timeout (s)", type: "number", min: 10, max: 600, description: "Code execution timeout in seconds" },
    ],
  },
  logging: {
    id: "logging",
    label: "Logging",
    description: "Log level, rotation, and file size settings",
    icon: "ScrollText",
    color: "green",
    fields: [
      { key: "level", label: "Log Level", type: "select", options: ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], description: "Minimum log level to record" },
      { key: "max_size_mb", label: "Max File Size (MB)", type: "number", min: 1, max: 500, description: "Maximum log file size before rotation" },
      { key: "backup_count", label: "Backup Count", type: "number", min: 1, max: 50, description: "Number of rotated log files to keep" },
    ],
  },
  discord: {
    id: "discord",
    label: "Discord",
    description: "Discord platform-specific settings",
    icon: "MessageSquare",
    color: "purple",
    fields: [
      { key: "auto_thread", label: "Auto Thread", type: "boolean", description: "Automatically create threads for responses" },
      { key: "reactions", label: "Reactions", type: "boolean", description: "React to messages with emoji" },
      { key: "require_mention", label: "Require Mention", type: "boolean", description: "Only respond when mentioned" },
    ],
    complexKeys: ["free_response_channels"],
  },
  human_delay: {
    id: "human_delay",
    label: "Human Delay",
    description: "Simulated human-like typing delay settings",
    icon: "Clock",
    color: "orange",
    fields: [
      { key: "mode", label: "Mode", type: "select", options: ["off", "natural", "fixed"], description: "Human delay simulation mode" },
      { key: "min_ms", label: "Min Delay (ms)", type: "number", min: 0, max: 5000, description: "Minimum delay in milliseconds" },
      { key: "max_ms", label: "Max Delay (ms)", type: "number", min: 0, max: 10000, description: "Maximum delay in milliseconds" },
    ],
  },
  voice: {
    id: "voice",
    label: "Voice",
    description: "Voice recording and auto-TTS settings",
    icon: "Mic",
    color: "pink",
    fields: [
      { key: "auto_tts", label: "Auto TTS", type: "boolean", description: "Automatically convert responses to speech" },
      { key: "max_recording_seconds", label: "Max Recording (s)", type: "number", min: 5, max: 300, description: "Maximum voice recording duration" },
      { key: "silence_threshold", label: "Silence Threshold", type: "number", min: 0, max: 1, description: "Audio level threshold for silence detection" },
      { key: "silence_duration", label: "Silence Duration (s)", type: "number", min: 0.5, max: 10, description: "Seconds of silence to end recording" },
    ],
  },
  privacy: {
    id: "privacy",
    label: "Privacy",
    description: "PII redaction and privacy settings",
    icon: "Shield",
    color: "cyan",
    fields: [
      { key: "redact_pii", label: "Redact PII", type: "boolean", description: "Automatically redact personally identifiable information" },
    ],
  },
  streaming: {
    id: "streaming",
    label: "Streaming",
    description: "Response streaming configuration",
    icon: "Activity",
    color: "cyan",
    fields: [
      { key: "enabled", label: "Enabled", type: "boolean", description: "Enable response streaming" },
    ],
  },
  smart_model_routing: {
    id: "smart_model_routing",
    label: "Smart Model Routing",
    description: "Intelligent model routing based on task complexity",
    icon: "GitBranch",
    color: "purple",
    fields: [
      { key: "enabled", label: "Enabled", type: "boolean", description: "Enable smart model routing" },
    ],
  },
  web: {
    id: "web",
    label: "Web",
    description: "Web search and extraction backend settings",
    icon: "Globe",
    color: "green",
    fields: [
      { key: "backend", label: "Backend", type: "select", options: ["parallel", "firecrawl", "builtin"], description: "Web search backend" },
    ],
  },
  hermes_md: {
    id: "hermes_md",
    label: "HERMES.md",
    description: "Priority project instructions — loaded every message",
    icon: "FileText",
    color: "cyan",
    type: "file",
    filePath: "HERMES.md",
    fields: [],
  },
  env: {
    id: "env",
    label: "Environment Variables",
    description: "API keys and secrets (.env file)",
    icon: "Lock",
    color: "orange",
    type: "file",
    filePath: ".env",
    sensitive: true,
    fields: [],
  },
};

export function getSectionDef(sectionId: string): SectionDef | null {
  return CONFIG_SECTIONS[sectionId] || null;
}
