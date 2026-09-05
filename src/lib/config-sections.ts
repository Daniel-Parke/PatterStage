// ═══════════════════════════════════════════════════════════════
// config-sections.ts — the Settings index, as data (T-0097, D79)
//
// The index page carried its own grouping of section ids, the sidebar carried
// another in the registry, and the two disagreed: the page listed 25 of the
// 27 sections and printed "27 sections" over them. This file is the one
// grouping. The index renders it; the registry derives the settings routes
// from it, so the e2e matrix still visits every section.
//
// PURE DATA, like the registry: no React, no lucide, no db. The fields each
// section carries stay in src/lib/config-schema.ts (which the editor page
// needs and which imports lucide); tests/unit/b3-registry-regroup.test.ts
// holds the two lists to the same set of ids.
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";
import type { IconName } from "@/lib/modules/types";

export interface SettingsGroup {
  label: string;
  description: string;
  sectionIds: string[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: "Core",
    description: "The settings changed most often: how the agent behaves, what it shows, and how it remembers",
    sectionIds: ["agent", "display", "memory"],
  },
  {
    label: "Infrastructure",
    description: "Terminal backends, compression, browser automation, checkpoints, code execution and logging",
    sectionIds: ["terminal", "compression", "browser", "checkpoints", "code_execution", "logging"],
  },
  {
    label: "Security",
    description: "Guardrails, personal-data protection and command approvals",
    sectionIds: ["security", "privacy", "approvals"],
  },
  {
    label: "Voice & Audio",
    description: "Text-to-speech, speech-to-text and voice recording",
    sectionIds: ["tts", "stt", "voice"],
  },
  {
    label: "Automation",
    description: "Delegation, scheduled jobs, session lifecycle and skill discovery",
    sectionIds: ["delegation", "cron", "session_reset", "skills"],
  },
  {
    label: "Integrations",
    description: "Platform connections, streaming, web backends and auxiliary models",
    sectionIds: ["discord", "streaming", "web", "platform_toolsets", "smart_model_routing", "human_delay"],
  },
  {
    label: "Files",
    description: "The two files the agent reads as they are: its instructions and its environment",
    sectionIds: ["hermes_md", "env"],
  },
];

/** The three cards on the index that are pages rather than sections. */
export interface SettingsTool {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  color: AccentColor;
}

export const SETTINGS_TOOLS: readonly SettingsTool[] = [
  {
    href: "/agent/models",
    label: "Models",
    description: "The model registry, defaults per task and the fallback chain; push to and pull from Hermes",
    icon: "Globe",
    color: "purple",
  },
  {
    href: "/agent/settings/restore",
    label: "Restore",
    description: "Put back the starter set, restore one agent's defaults, clear out test clutter",
    icon: "RotateCcw",
    color: "cyan",
  },
  {
    href: "/agent/settings/system",
    label: "System",
    description: "How this install is configured, updates, rebuild and restart, and backups",
    icon: "Settings",
    color: "orange",
  },
];

/** Every section id, in index order. */
export function settingsSectionIds(): string[] {
  return SETTINGS_GROUPS.flatMap((g) => g.sectionIds);
}

/** The `/agent/settings/<id>` route of every section, for the registry. */
export function settingsRoutes(): string[] {
  return settingsSectionIds().map((id) => `/agent/settings/${id}`);
}
