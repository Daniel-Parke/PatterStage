// ═══════════════════════════════════════════════════════════════
// Sidebar Navigation — Static configuration data
// ═══════════════════════════════════════════════════════════════

import {
  Terminal, FileText, Database, Clock, Shield, Zap,
  Cpu, Activity, Layers, HardDrive, Wrench, ListTodo, Globe, Globe2,
  ScrollText, Sparkles, Rocket, Volume2, Mic, GitBranch,
  RotateCcw, ShieldCheck, MessageSquare, Lock, Code,
  BookOpen, Users, Layout, Kanban, Bot, MessageCircle,
  AudioLines, Calendar, Settings2, Network, Monitor,
} from "lucide-react";

import type { AccentColor } from "@/types/hermes";

// ── Types ──────────────────────────────────────────────────────

export interface SidebarLink {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  color: AccentColor;
  subLinks?: { label: string; href: string }[];
}

export interface SidebarSection {
  label: string;
  links: SidebarLink[];
}

export interface ConfigGroup {
  label: string;
  defaultOpen?: boolean;
  links: SidebarLink[];
}

// ── Main Sections ──────────────────────────────────────────────

export const mainSections: SidebarSection[] = [
  {
    label: "Main",
    links: [
      { icon: Zap, label: "Dashboard", href: "/", color: "cyan" },
      { icon: Rocket, label: "Missions", href: "/missions", color: "cyan" },
      { icon: ListTodo, label: "Cron", href: "/cron", color: "orange" },
      { icon: Clock, label: "Sessions", href: "/sessions", color: "orange" },
      { icon: Database, label: "Memory", href: "/memory", color: "pink" },
      { icon: Globe, label: "Gateway", href: "/gateway", color: "cyan" },
      { icon: ScrollText, label: "Logs", href: "/logs", color: "cyan" },
    ],
  },
  {
    label: "Orchestration",
    links: [
      { icon: Users, label: "Teams", href: "/orchestration/teams", color: "purple" },
      { icon: Kanban, label: "Kanban", href: "/kanban", color: "purple" },
    ],
  },
  {
    label: "Rec Room",
    links: [
      {
        icon: BookOpen, label: "Story Weaver", href: "/recroom/story-weaver", color: "purple",
        subLinks: [
          { label: "Library", href: "/recroom/story-weaver/library" },
          { label: "Create", href: "/recroom/story-weaver/create" },
          { label: "Characters", href: "/recroom/story-weaver/characters" },
          { label: "Themes", href: "/recroom/story-weaver/themes" },
        ],
      },
    ],
  },
  {
    label: "Operations",
    links: [
      { icon: Bot, label: "Agents", href: "/agent/agents", color: "purple" },
      { icon: FileText, label: "Skills", href: "/skills", color: "green" },
      { icon: Wrench, label: "Tools", href: "/agent/tools", color: "purple" },
      { icon: Sparkles, label: "Personalities", href: "/personalities", color: "purple" },
      { icon: Cpu, label: "HERMES.md", href: "/config/hermes_md", color: "cyan" },
      { icon: Lock, label: "Environment", href: "/config/env", color: "orange" },
    ],
  },
];

// ── Config Groups ──────────────────────────────────────────────

export const configGroups: ConfigGroup[] = [
  {
    label: "Core",
    defaultOpen: false,
    links: [
      { icon: Cpu, label: "Agent", href: "/config/agent", color: "cyan" },
      { icon: Globe, label: "Model", href: "/config/model", color: "purple" },
      { icon: Activity, label: "Display", href: "/config/display", color: "green" },
      { icon: Layers, label: "Memory", href: "/config/memory", color: "pink" },
    ],
  },
  {
    label: "Infrastructure",
    links: [
      { icon: Terminal, label: "Terminal", href: "/config/terminal", color: "orange" },
      { icon: HardDrive, label: "Compression", href: "/config/compression", color: "cyan" },
      { icon: Globe2, label: "Browser", href: "/config/browser", color: "green" },
      { icon: Zap, label: "Checkpoints", href: "/config/checkpoints", color: "cyan" },
      { icon: Code, label: "Code Execution", href: "/config/code_execution", color: "green" },
      { icon: ScrollText, label: "Logging", href: "/config/logging", color: "green" },
    ],
  },
  {
    label: "Security",
    links: [
      { icon: Shield, label: "Security", href: "/config/security", color: "cyan" },
      { icon: Lock, label: "Privacy", href: "/config/privacy", color: "cyan" },
      { icon: ShieldCheck, label: "Approvals", href: "/config/approvals", color: "purple" },
    ],
  },
  {
    label: "Voice & Audio",
    links: [
      { icon: AudioLines, label: "Text-to-Speech", href: "/config/tts", color: "pink" },
      { icon: Mic, label: "Speech-to-Text", href: "/config/stt", color: "purple" },
      { icon: Volume2, label: "Voice", href: "/config/voice", color: "pink" },
    ],
  },
  {
    label: "Automation",
    links: [
      { icon: GitBranch, label: "Delegation", href: "/config/delegation", color: "green" },
      { icon: ListTodo, label: "Cron", href: "/config/cron", color: "orange" },
      { icon: RotateCcw, label: "Session Reset", href: "/config/session_reset", color: "orange" },
      { icon: FileText, label: "Skills", href: "/config/skills", color: "green" },
    ],
  },
  {
    label: "Integrations",
    links: [
      { icon: MessageCircle, label: "Discord", href: "/config/discord", color: "purple" },
      { icon: Network, label: "Web", href: "/config/web", color: "green" },
      { icon: Cpu, label: "Auxiliary Models", href: "/config/auxiliary", color: "cyan" },
      { icon: Settings2, label: "Platform Toolsets", href: "/config/platform_toolsets", color: "purple" },
      { icon: GitBranch, label: "Smart Routing", href: "/config/smart_model_routing", color: "purple" },
      { icon: Clock, label: "Human Delay", href: "/config/human_delay", color: "orange" },
    ],
  },
];
